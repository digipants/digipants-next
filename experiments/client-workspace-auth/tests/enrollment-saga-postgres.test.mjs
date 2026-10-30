import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

const enabled = process.env.RUN_AUTH_EXPERIMENT_INTEGRATION === "1";
if (!enabled) {
  test("two-database enrollment recovery (disposable PostgreSQL only)", {
    skip: "Set RUN_AUTH_EXPERIMENT_INTEGRATION=1 with the named disposable PostgreSQL databases.",
  }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_SHADOW_DATABASE_URL, "auth_spike_shadow");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";
  process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString("hex");

  const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-pg"), import("../generated/client/index.js"),
  ]);
  const authDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.AUTH_DATABASE_URL, max: 8 }) });
  const workspaceDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.WORKSPACE_DATABASE_URL, max: 8 }) });
  globalThis.authExperimentAuthDb = authDb;
  globalThis.authExperimentWorkspaceDb = workspaceDb;

  const [saga, mailbox, invitation] = await Promise.all([
    import("../src/enrollment-saga.ts"), import("../src/mailbox-proof.ts"), import("../src/invitations.ts"),
  ]);

  test("reconciles crashes, spends proofs once, poisons bounded failures and creates grants only after owner approval", async (t) => {
    const tenantId = randomUUID();
    const projectId = randomUUID();
    const ownerId = randomUUID();
    const ownerSubject = randomUUID();
    const staffUserId = ownerSubject;
    const staffEmail = `staff-${randomUUID()}@example.invalid`;
    const ownerSessionId = randomUUID();
    const inviteId = randomUUID();
    const inviteToken = randomBytes(32).toString("base64url");
    const intendedEmail = `client-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString("base64url");
    const cleanAuthUserIds = [staffUserId];
    const attemptIds = [];

    await t.after(async () => {
      for (const id of cleanAuthUserIds) await authDb.$executeRaw`DELETE FROM auth_spike."user" WHERE id=${id}`;
      await authDb.$disconnect();
      await workspaceDb.$disconnect();
      delete globalThis.authExperimentAuthDb;
      delete globalThis.authExperimentWorkspaceDb;
    });

    await workspaceDb.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES (${tenantId}::uuid,'Synthetic saga tenant')`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind,status) VALUES (${ownerId}::uuid,${ownerSubject},'staff','active')`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id) VALUES (${ownerId}::uuid)`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES (${projectId}::uuid,${tenantId}::uuid,'Synthetic saga project')`;
    await workspaceDb.$executeRaw`INSERT INTO workspace_staff_project_grants(tenant_id,project_id,principal_id,role) VALUES (${tenantId}::uuid,${projectId}::uuid,${ownerId}::uuid,'workspace_owner')`;
    await workspaceDb.$executeRaw`
      INSERT INTO workspace_invitation_records
        (id,tenant_id,project_id,intended_email,intended_role,invitation_token_hash,issued_by_staff_id,expires_at)
      VALUES (${inviteId}::uuid,${tenantId}::uuid,${projectId}::uuid,${intendedEmail},'client_approver',
        ${invitation.hashInvitationToken(inviteToken)},${ownerId}::uuid,statement_timestamp()+interval '20 minutes')
    `;

    // A crash immediately after Workspace journal commit is recovered by the
    // same deterministic idempotency key and provider subject.
    const proof = await mailbox.createSyntheticMailboxChallenge({ authDb, workspaceDb, invitationId: inviteId, intendedEmail });
    assert.ok(proof);
    const stillLive = await workspaceDb.$queryRaw`
      SELECT status,lower(intended_email) AS intended_email,expires_at > statement_timestamp() AS not_expired
        FROM workspace_invitation_records WHERE id=${inviteId}::uuid
    `;
    assert.equal(stillLive.length, 1);
    assert.equal(stillLive[0].status, "pending");
    assert.equal(stillLive[0].intended_email, intendedEmail);
    assert.equal(stillLive[0].not_expired, true);
    const first = await saga.prepareEnrollmentAttempt({ token: inviteToken, intendedEmail, challengeId: proof.challengeId });
    const [retryA, retryB] = await Promise.all([
      saga.prepareEnrollmentAttempt({ token: inviteToken, intendedEmail, challengeId: proof.challengeId }),
      saga.prepareEnrollmentAttempt({ token: inviteToken, intendedEmail, challengeId: proof.challengeId }),
    ]);
    assert.ok(first);
    assert.equal(retryA?.id, first.id);
    assert.equal(retryB?.id, first.id);
    assert.equal(retryA?.providerSubject, first.providerSubject);
    attemptIds.push(first.id);
    const beforeProof = await workspaceDb.$queryRaw`
      SELECT count(*)::int AS memberships FROM workspace_client_memberships WHERE tenant_id=${tenantId}::uuid
    `;
    assert.equal(beforeProof[0].memberships, 0, "a journal entry does not create membership or permissions");

    // A crash after the Auth-database proof commit is safe to retry: the
    // durable proof receipt is bound to this attempt and only the same code.
    const [consumedA, consumedB] = await Promise.all([
      saga.consumeMailboxProofForEnrollment({ attemptId: first.id, challengeId: proof.challengeId, code: proof.code }),
      saga.consumeMailboxProofForEnrollment({ attemptId: first.id, challengeId: proof.challengeId, code: proof.code }),
    ]);
    assert.ok(consumedA || consumedB, "at least one concurrent proof spend succeeds");
    assert.equal(await saga.consumeMailboxProofForEnrollment({ attemptId: first.id, challengeId: proof.challengeId, code: proof.code }), true,
      "replaying the same receipt for the same attempt is idempotent");
    assert.equal(await saga.consumeMailboxProofForEnrollment({ attemptId: first.id, challengeId: proof.challengeId, code: randomBytes(32).toString("base64url") }), false,
      "a spent proof cannot authorize a different code");
    const spentRows = await authDb.$queryRaw`SELECT attempt_id::text AS attempt_id, code_digest_hash FROM auth_spike.workspace_mailbox_proof_spends WHERE attempt_id=${first.id}::uuid`;
    assert.equal(spentRows.length, 1);
    assert.equal(spentRows[0].code_digest_hash, createHash("sha256").update("cw-mail-ownership-v1\0").update(proof.code).digest("hex"));

    const replayInviteId = randomUUID();
    const replayEmail = `proof-replay-${randomUUID()}@example.invalid`;
    const replayToken = randomBytes(32).toString("base64url");
    await workspaceDb.$executeRaw`
      INSERT INTO workspace_invitation_records
        (id,tenant_id,project_id,intended_email,intended_role,invitation_token_hash,issued_by_staff_id,expires_at)
      VALUES (${replayInviteId}::uuid,${tenantId}::uuid,${projectId}::uuid,${replayEmail},'client_viewer',
        ${invitation.hashInvitationToken(replayToken)},${ownerId}::uuid,statement_timestamp()+interval '20 minutes')
    `;
    const replayProof = await mailbox.createSyntheticMailboxChallenge({ authDb, workspaceDb, invitationId: replayInviteId, intendedEmail: replayEmail });
    assert.ok(replayProof);
    const replayAttempt = await saga.prepareEnrollmentAttempt({ token: replayToken, intendedEmail: replayEmail, challengeId: replayProof.challengeId });
    assert.ok(replayAttempt);
    attemptIds.push(replayAttempt.id);
    assert.equal(await saga.consumeMailboxProofForEnrollment({
      attemptId: replayAttempt.id, challengeId: proof.challengeId, code: proof.code,
    }), false, "a proof spent for one attempt cannot be rebound to a different invitation");
    await workspaceDb.$executeRaw`UPDATE workspace_enrollment_attempts SET next_retry_at=statement_timestamp()-interval '1 second' WHERE id=${replayAttempt.id}::uuid`;
    assert.equal(await saga.consumeMailboxProofForEnrollment({
      attemptId: replayAttempt.id, challengeId: replayProof.challengeId, code: replayProof.code,
    }), true, "the second invitation's own proof remains independently spendable");

    // Simulate Better Auth committing its identity before the Workspace
    // after-hook does. Reconciliation creates a disabled principal only.
    await authDb.$executeRaw`
      INSERT INTO auth_spike."user"(id,name,email,email_verified,created_at,updated_at)
      VALUES (${first.providerSubject},'Synthetic Client',${intendedEmail},false,statement_timestamp(),statement_timestamp())
    `;
    cleanAuthUserIds.push(first.providerSubject);
    assert.equal(await saga.reconcileEnrollmentAttempt(first.id), "grant_ready_for_review");
    assert.equal(await saga.reconcileEnrollmentAttempt(first.id), "grant_ready_for_review", "reconciliation is repeatable");
    const review = await workspaceDb.$queryRaw`
      SELECT a.state,p.status AS principal_status,i.status AS invitation_status,
        (SELECT count(*) FROM workspace_client_memberships m WHERE m.principal_id=p.id)::int AS memberships,
        (SELECT count(*) FROM workspace_client_project_grants g WHERE g.principal_id=p.id)::int AS grants
      FROM workspace_enrollment_attempts a
      JOIN workspace_principals p ON p.provider_subject=a.provider_subject
      JOIN workspace_invitation_records i ON i.id=a.invitation_id
      WHERE a.id=${first.id}::uuid
    `;
    assert.deepEqual(review[0], {
      state: "grant_ready_for_review", principal_status: "disabled", invitation_status: "pending",
      memberships: 0, grants: 0,
    }, "identity existence alone grants no tenant or project rights");

    // A valid but non-owner MFA session cannot approve this enrollment.
    const nonOwnerId = randomUUID();
    const nonOwnerEmail = `non-owner-${randomUUID()}@example.invalid`;
    const nonOwnerSession = randomUUID();
    cleanAuthUserIds.push(nonOwnerId);
    await authDb.$executeRaw`
      INSERT INTO auth_spike."user"(id,name,email,email_verified,two_factor_enabled,created_at,updated_at)
      VALUES (${nonOwnerId},'Synthetic Non Owner',${nonOwnerEmail},true,true,statement_timestamp(),statement_timestamp())
    `;
    await authDb.$executeRaw`
      INSERT INTO auth_spike."twoFactor"(id,user_id,secret,backup_codes,verified)
      VALUES (${randomUUID()},${nonOwnerId},'synthetic-secret','[]',true)
    `;
    await authDb.$executeRaw`
      INSERT INTO auth_spike.session(id,user_id,token,expires_at,mfa_verified_at,created_at,updated_at)
      VALUES (${nonOwnerSession},${nonOwnerId},${randomBytes(32).toString("hex")},
        statement_timestamp()+interval '1 hour',statement_timestamp(),statement_timestamp(),statement_timestamp())
    `;
    assert.equal(await saga.approveEnrollmentGrantForVerifiedSubject({
      attemptId: first.id, sessionId: nonOwnerSession, providerSubject: nonOwnerId,
    }), false, "a fresh MFA session without an exact active owner grant is denied");

    await authDb.$executeRaw`
      INSERT INTO auth_spike."user"(id,name,email,email_verified,two_factor_enabled,created_at,updated_at)
      VALUES (${staffUserId},'Synthetic Owner',${staffEmail},true,true,statement_timestamp(),statement_timestamp())
    `;
    await authDb.$executeRaw`
      INSERT INTO auth_spike."twoFactor"(id,user_id,secret,backup_codes,verified)
      VALUES (${randomUUID()},${staffUserId},'synthetic-secret','[]',true)
    `;
    await authDb.$executeRaw`
      INSERT INTO auth_spike.session(id,user_id,token,expires_at,mfa_verified_at,created_at,updated_at)
      VALUES (${ownerSessionId},${staffUserId},${randomBytes(32).toString("hex")},
        statement_timestamp()+interval '1 hour',statement_timestamp(),statement_timestamp(),statement_timestamp())
    `;
    const retryWindow = await workspaceDb.$queryRaw`
      SELECT COALESCE(next_retry_at > statement_timestamp(),false) AS blocked
        FROM workspace_enrollment_attempts WHERE id=${first.id}::uuid
    `;
    assert.equal(retryWindow[0]?.blocked, true, "a rejected proof replay delays provider/proof retries");
    const approvals = await Promise.all([1, 2].map(() => saga.approveEnrollmentGrantForVerifiedSubject({
      attemptId: first.id, sessionId: ownerSessionId, providerSubject: ownerSubject,
    })));
    assert.ok(approvals.some(Boolean), "an active owner with a current MFA session can approve");
    assert.equal(await saga.approveEnrollmentGrantForVerifiedSubject({
      attemptId: first.id, sessionId: ownerSessionId, providerSubject: ownerSubject,
    }), true, "approval retry is idempotent");
    const completed = await workspaceDb.$queryRaw`
      SELECT a.state,a.next_retry_at IS NOT NULL AS retry_scheduled,
        p.status AS principal_status,i.status AS invitation_status,i.redeemed_by_client_id::text AS redeemer,
        (SELECT count(*) FROM workspace_client_memberships m WHERE m.principal_id=p.id)::int AS memberships,
        (SELECT count(*) FROM workspace_client_project_grants g WHERE g.principal_id=p.id)::int AS grants
      FROM workspace_enrollment_attempts a
      JOIN workspace_principals p ON p.provider_subject=a.provider_subject
      JOIN workspace_invitation_records i ON i.id=a.invitation_id
      WHERE a.id=${first.id}::uuid
    `;
    assert.deepEqual(completed[0], {
      retry_scheduled: false,
      state: "completed", principal_status: "active", invitation_status: "redeemed",
      redeemer: review[0] ? (await workspaceDb.$queryRaw`SELECT id::text FROM workspace_principals WHERE provider_subject=${first.providerSubject}`)[0].id : null,
      memberships: 1, grants: 1,
    }, "the approved transaction writes principal, invitation, membership, grant, journal and audit atomically");

    // Expired/revoked invitation after the provider identity commit becomes a
    // visible repair case and never creates rights.
    const invalidCases = [];
    for (const status of ["revoked", "expired"]) {
      const id = randomUUID();
      const token = randomBytes(32).toString("base64url");
      const email = `${status}-${randomUUID()}@example.invalid`;
      await workspaceDb.$executeRaw`
        INSERT INTO workspace_invitation_records
          (id,tenant_id,project_id,intended_email,intended_role,invitation_token_hash,issued_by_staff_id,expires_at)
        VALUES (${id}::uuid,${tenantId}::uuid,${projectId}::uuid,${email},'client_viewer',
          ${invitation.hashInvitationToken(token)},${ownerId}::uuid,statement_timestamp()+interval '20 minutes')
      `;
      // Expired invitations cannot receive a mailbox challenge, so create it
      // while live and later change only synthetic expiry/state.
      const liveChallenge = await mailbox.createSyntheticMailboxChallenge({ authDb, workspaceDb, invitationId: id, intendedEmail: email });
      assert.ok(liveChallenge);
      const prepared = await saga.prepareEnrollmentAttempt({ token, intendedEmail: email, challengeId: liveChallenge.challengeId });
      assert.ok(prepared);
      attemptIds.push(prepared.id);
      assert.equal(await saga.consumeMailboxProofForEnrollment({ attemptId: prepared.id, challengeId: liveChallenge.challengeId, code: liveChallenge.code }), true);
      await authDb.$executeRaw`
        INSERT INTO auth_spike."user"(id,name,email,email_verified,created_at,updated_at)
        VALUES (${prepared.providerSubject},'Synthetic Recovery',${email},false,statement_timestamp(),statement_timestamp())
      `;
      cleanAuthUserIds.push(prepared.providerSubject);
      if (status === "revoked") {
        await workspaceDb.$executeRaw`UPDATE workspace_invitation_records SET status='revoked' WHERE id=${id}::uuid`;
      } else {
        await workspaceDb.$executeRaw`UPDATE workspace_invitation_records SET expires_at=statement_timestamp()-interval '1 second' WHERE id=${id}::uuid`;
      }
      assert.equal(await saga.reconcileEnrollmentAttempt(prepared.id), "needs_repair");
      const noRights = await workspaceDb.$queryRaw`
        SELECT p.status,(SELECT count(*) FROM workspace_client_memberships WHERE principal_id=p.id)::int AS memberships,
          (SELECT count(*) FROM workspace_client_project_grants WHERE principal_id=p.id)::int AS grants
        FROM workspace_principals p WHERE p.provider_subject=${prepared.providerSubject}
      `;
      assert.equal(noRights.length, 0, "invalid invitation cannot materialize an active principal or grant");
      invalidCases.push(prepared.id);
    }

    // A workspace principal without its auth-side identity is an orphan and
    // transitions to a queryable poison state for manual repair.
    const orphanInviteId = randomUUID();
    const orphanEmail = `orphan-${randomUUID()}@example.invalid`;
    const orphanToken = randomBytes(32).toString("base64url");
    await workspaceDb.$executeRaw`
      INSERT INTO workspace_invitation_records
        (id,tenant_id,project_id,intended_email,intended_role,invitation_token_hash,issued_by_staff_id,expires_at)
      VALUES (${orphanInviteId}::uuid,${tenantId}::uuid,${projectId}::uuid,${orphanEmail},'client_viewer',
        ${invitation.hashInvitationToken(orphanToken)},${ownerId}::uuid,statement_timestamp()+interval '20 minutes')
    `;
    const orphanChallenge = await mailbox.createSyntheticMailboxChallenge({ authDb, workspaceDb, invitationId: orphanInviteId, intendedEmail: orphanEmail });
    assert.ok(orphanChallenge);
    const orphanAttempt = await saga.prepareEnrollmentAttempt({ token: orphanToken, intendedEmail: orphanEmail, challengeId: orphanChallenge.challengeId });
    assert.ok(orphanAttempt);
    attemptIds.push(orphanAttempt.id);
    await workspaceDb.$executeRaw`
      INSERT INTO workspace_principals(id,provider_subject,kind,status)
      VALUES (${randomUUID()}::uuid,${orphanAttempt.providerSubject},'client','disabled')
    `;
    assert.equal(await saga.reconcileEnrollmentAttempt(orphanAttempt.id), "needs_repair");

    // Five classified provider failures move a bounded attempt to the indexed
    // poison queue; subsequent mutation attempts are refused.
    const poisonInvite = randomUUID();
    const poisonEmail = `poison-${randomUUID()}@example.invalid`;
    const poisonToken = randomBytes(32).toString("base64url");
    await workspaceDb.$executeRaw`
      INSERT INTO workspace_invitation_records
        (id,tenant_id,project_id,intended_email,intended_role,invitation_token_hash,issued_by_staff_id,expires_at)
      VALUES (${poisonInvite}::uuid,${tenantId}::uuid,${projectId}::uuid,${poisonEmail},'client_viewer',
        ${invitation.hashInvitationToken(poisonToken)},${ownerId}::uuid,statement_timestamp()+interval '20 minutes')
    `;
    const poisonChallenge = await mailbox.createSyntheticMailboxChallenge({ authDb, workspaceDb, invitationId: poisonInvite, intendedEmail: poisonEmail });
    assert.ok(poisonChallenge);
    const poisonAttempt = await saga.prepareEnrollmentAttempt({ token: poisonToken, intendedEmail: poisonEmail, challengeId: poisonChallenge.challengeId });
    assert.ok(poisonAttempt);
    attemptIds.push(poisonAttempt.id);
    for (let n = 0; n < 4; n += 1) {
      assert.equal(await saga.recordEnrollmentFailure(poisonAttempt.id, "provider_error"), true);
      if (n < 3) {
        const blocked = await workspaceDb.$queryRaw`SELECT next_retry_at > statement_timestamp() AS active FROM workspace_enrollment_attempts WHERE id=${poisonAttempt.id}::uuid`;
        assert.equal(blocked[0].active, true, "provider failures schedule a server-clock backoff");
        await workspaceDb.$executeRaw`UPDATE workspace_enrollment_attempts SET next_retry_at=statement_timestamp()-interval '1 second' WHERE id=${poisonAttempt.id}::uuid`;
      }
    }
    const poisoned = await workspaceDb.$queryRaw`
      SELECT state,attempt_count,poisoned_at,last_error_code FROM workspace_enrollment_attempts WHERE id=${poisonAttempt.id}::uuid
    `;
    assert.equal(poisoned[0].state, "needs_repair");
    assert.equal(poisoned[0].attempt_count, 5);
    assert.ok(poisoned[0].poisoned_at instanceof Date);
    assert.equal(poisoned[0].last_error_code, "provider_error");
    assert.equal(await saga.recordEnrollmentFailure(poisonAttempt.id, "provider_error"), false);

    const audits = await workspaceDb.$queryRaw`
      SELECT count(*)::int AS count FROM workspace_audit_events
       WHERE object_type='workspace_enrollment_attempt' AND object_id=ANY(${[first.id, ...invalidCases, orphanAttempt.id, poisonAttempt.id]}::text[])
    `;
    assert.ok(audits[0].count >= 8, "state transitions and repair states are transactionally audited");
    const repairRows = await workspaceDb.$queryRaw`
      SELECT count(*)::int AS count FROM workspace_enrollment_attempts
       WHERE id=ANY(${[...invalidCases, orphanAttempt.id, poisonAttempt.id]}::uuid[]) AND state='needs_repair' AND poisoned_at IS NOT NULL
    `;
    assert.equal(repairRows[0].count, 4, "manual repair queue includes invalid invitations, orphan and poison cases");
  });
}
