import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { auth } from "./auth.js";
import { getAuthPrisma, getWorkspacePrisma } from "./database.js";
import { maxMfaAgeSecondsForAction } from "./mfa-freshness.js";
import { normalizeInvitedEmail } from "./invite-issuance.js";
import { hashInvitationToken } from "./invitations.js";

type Sql = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};
type TransactionalSql = Sql & {
  $transaction<T>(operation: (tx: Sql) => Promise<T>, options?: { isolationLevel?: "Serializable" }): Promise<T>;
};
type AttemptRow = {
  id: string;
  idempotencyHash: string;
  invitationId: string;
  invitationHash: string;
  mailboxProofRefHash: string;
  providerSubject: string;
  tenantId: string;
  projectId: string;
  intendedEmail: string;
  intendedRole: string;
  state: string;
  attemptCount: number;
  nextRetryAt: Date | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ROLES = new Set(["client_viewer", "client_contributor", "client_approver", "client_signatory"]);
const MAX_ATTEMPTS = 5;
const PROOF_PURPOSE = "cw-mail-ownership-v1";

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function proofDigest(code: string): string {
  return digest(`${PROOF_PURPOSE}\0${code}`);
}
function proofIdentifier(invitationId: string, email: string): string {
  return `${PROOF_PURPOSE}:${invitationId}:${email}`;
}
function proofReferenceHash(invitationId: string, email: string, challengeId: string): string {
  return digest(`cw-enrollment-proof-ref-v1\0${invitationId}\0${email}\0${challengeId}`);
}
function idempotencyHash(invitationHash: string, email: string, proofHash: string): string {
  return digest(`cw-enrollment-idempotency-v1\0${invitationHash}\0${email}\0${proofHash}`);
}
function auditKey(attemptId: string, event: string, sequence = 0): string {
  return `enrollment:${attemptId}:${event}:${sequence}`;
}
function debugEnrollmentFailure(stage: string, detail: Record<string, unknown>): void {
  if (process.env.AUTH_EXPERIMENT_DEBUG === "1") {
    // Emit only a generic stage and database error codes, never query values,
    // bearer tokens, mailbox proofs, subjects or invitation contents.
    console.error("synthetic enrollment diagnostic", { stage, ...detail });
  }
}
function liveInvitation(row: { status: string; notExpired: boolean; tenantStatus: string; projectTenantId: string | null }): boolean {
  return row.status === "pending" && row.notExpired &&
    row.tenantStatus === "active" && row.projectTenantId !== null;
}

async function appendAudit(tx: Sql, values: {
  tenantId: string; projectId: string; actorId?: string | null;
  action: string; objectId: string; idempotencyKey: string;
}): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ appended: boolean }>>`
    SELECT NOT (cw_append_audit_event(
      ${values.tenantId}::uuid, ${values.projectId}::uuid, ${values.actorId ?? null}::uuid,
      'system', ${values.action}, 'workspace_enrollment_attempt', ${values.objectId},
      NULL, NULL, ${values.idempotencyKey}) IS NULL) AS appended
  `;
  if (rows[0]?.appended !== true) throw new Error("Enrollment audit append did not complete.");
}

function publicAttempt(row: AttemptRow): Pick<AttemptRow,
  "id" | "providerSubject" | "tenantId" | "projectId" | "intendedEmail" | "intendedRole" | "state" | "attemptCount"> {
  return {
    id: row.id, providerSubject: row.providerSubject,
    tenantId: row.tenantId, projectId: row.projectId,
    intendedEmail: row.intendedEmail, intendedRole: row.intendedRole,
    state: row.state, attemptCount: row.attemptCount,
  };
}

/**
 * Create or resume the durable Workspace-side journal row. Its idempotency
 * identity is deterministic from hashed invite/proof references and normalized
 * email, so retries return the same provider subject. No principal, membership
 * or grant is created here.
 */
export async function prepareEnrollmentAttempt(input: {
  token: string; intendedEmail: string; challengeId: string;
}): Promise<ReturnType<typeof publicAttempt> | null> {
  let values: { token: string; intendedEmail: string; challengeId: string };
  try { values = { token: input.token, intendedEmail: input.intendedEmail, challengeId: input.challengeId }; }
  catch { return null; }
  const email = normalizeInvitedEmail(values.intendedEmail);
  if (!email || typeof values.token !== "string" || values.token.length < 32 || values.token.length > 512 ||
      !UUID.test(values.challengeId)) {
    debugEnrollmentFailure("input-rejected", {
      hasValidEmail: Boolean(email), tokenLengthValid: typeof values.token === "string" && values.token.length >= 32 && values.token.length <= 512,
      challengeIdValid: UUID.test(values.challengeId),
    });
    return null;
  }

  const workspaceDb = getWorkspacePrisma() as unknown as TransactionalSql;
  const invitationHash = hashInvitationToken(values.token);
  const lookupStableAttempt = async () => {
    const rows = await workspaceDb.$queryRaw<AttemptRow[]>`
      SELECT id::text AS id, idempotency_hash AS "idempotencyHash",
             invitation_id::text AS "invitationId", invitation_hash AS "invitationHash",
             mailbox_proof_ref_hash AS "mailboxProofRefHash", provider_subject AS "providerSubject",
             tenant_id::text AS "tenantId", project_id::text AS "projectId",
             intended_email AS "intendedEmail", intended_role AS "intendedRole", state,
             attempt_count AS "attemptCount", next_retry_at AS "nextRetryAt"
        FROM workspace_enrollment_attempts
       WHERE invitation_hash=${invitationHash} AND intended_email=${email}
       LIMIT 1
    `;
    const row = rows[0];
    if (!row || row.mailboxProofRefHash !== proofReferenceHash(row.invitationId, email, values.challengeId)) return null;
    return row;
  };
  try {
    return await workspaceDb.$transaction(async (tx) => {
      const invitations = await tx.$queryRaw<Array<{
        id: string; tenantId: string; projectId: string; intendedEmail: string; intendedRole: string;
        status: string; notExpired: boolean; tenantStatus: string; projectTenantId: string | null;
      }>>`
        SELECT i.id::text AS id, i.tenant_id::text AS "tenantId", i.project_id::text AS "projectId",
               i.intended_email AS "intendedEmail", i.intended_role AS "intendedRole",
               i.status, i.expires_at > statement_timestamp() AS "notExpired", t.status AS "tenantStatus",
               p.tenant_id::text AS "projectTenantId"
          FROM workspace_invitation_records AS i
          JOIN workspace_tenants AS t ON t.id = i.tenant_id
          JOIN workspace_projects AS p ON p.tenant_id = i.tenant_id AND p.id = i.project_id
         WHERE i.invitation_token_hash = ${invitationHash}
           AND lower(i.intended_email) = ${email}
         FOR UPDATE OF i, t, p
      `;
      const invitation = invitations[0];
      if (!invitation || !CLIENT_ROLES.has(invitation.intendedRole)) {
        debugEnrollmentFailure("invitation-not-found-or-role-rejected", {
          invitationFound: Boolean(invitation), roleAllowed: invitation ? CLIENT_ROLES.has(invitation.intendedRole) : false,
        });
        return null;
      }
      const proofHash = proofReferenceHash(invitation.id, email, values.challengeId);
      const idemHash = idempotencyHash(invitationHash, email, proofHash);
      const existing = await tx.$queryRaw<Array<AttemptRow & { retryBlocked: boolean }>>`
        SELECT id::text AS id, idempotency_hash AS "idempotencyHash",
               invitation_id::text AS "invitationId", invitation_hash AS "invitationHash",
               mailbox_proof_ref_hash AS "mailboxProofRefHash", provider_subject AS "providerSubject",
               tenant_id::text AS "tenantId", project_id::text AS "projectId",
               intended_email AS "intendedEmail", intended_role AS "intendedRole", state,
               attempt_count AS "attemptCount", next_retry_at AS "nextRetryAt",
               COALESCE(next_retry_at > statement_timestamp(), false) AS "retryBlocked"
          FROM workspace_enrollment_attempts
         WHERE idempotency_hash = ${idemHash}
         LIMIT 1 FOR UPDATE
      `;
      if (existing[0]) {
        const prior = existing[0];
        if (prior.state !== "pending") return publicAttempt(prior);
        if (prior.retryBlocked) return null;
        const nextCount = Math.min(MAX_ATTEMPTS, prior.attemptCount + 1);
        if (nextCount >= MAX_ATTEMPTS) {
          await tx.$executeRaw`
            UPDATE workspace_enrollment_attempts SET state='needs_repair', attempt_count=${MAX_ATTEMPTS},
              last_error_code='unknown', next_retry_at=NULL, poisoned_at=statement_timestamp(),
              updated_at=statement_timestamp() WHERE id=${prior.id}::uuid AND state='pending'
          `;
          await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${prior.tenantId}, true)`;
          await appendAudit(tx, { tenantId: prior.tenantId, projectId: prior.projectId,
            action: "enrollment.needs_repair", objectId: prior.id,
            idempotencyKey: auditKey(prior.id, "poisoned", MAX_ATTEMPTS) });
          return { ...publicAttempt(prior), state: "needs_repair", attemptCount: MAX_ATTEMPTS };
        }
        await tx.$executeRaw`
          UPDATE workspace_enrollment_attempts SET attempt_count=${nextCount}, next_retry_at=NULL,
            updated_at=statement_timestamp() WHERE id=${prior.id}::uuid AND state='pending'
        `;
        await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${prior.tenantId}, true)`;
        await appendAudit(tx, { tenantId: prior.tenantId, projectId: prior.projectId,
          action: "enrollment.retry_started", objectId: prior.id,
          idempotencyKey: auditKey(prior.id, "retry-started", nextCount) });
        return { ...publicAttempt(prior), attemptCount: nextCount };
      }
      const priorForInvite = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id::text AS id FROM workspace_enrollment_attempts
         WHERE invitation_id = ${invitation.id}::uuid LIMIT 1
      `;
      if (priorForInvite.length) {
        debugEnrollmentFailure("invitation-already-journaled", { priorAttemptFound: true });
        return null;
      }

      const attemptId = randomUUID();
      const providerSubject = randomUUID();
      const isLive = liveInvitation({
        status: invitation.status, notExpired: invitation.notExpired,
        tenantStatus: invitation.tenantStatus, projectTenantId: invitation.projectTenantId,
      });
      const state = isLive ? "pending" : "cancelled";
      const inserted = await tx.$queryRaw<AttemptRow[]>`
        INSERT INTO workspace_enrollment_attempts
          (id, idempotency_hash, invitation_id, invitation_hash, mailbox_proof_ref_hash,
           provider_subject, tenant_id, project_id, intended_email, intended_role, state,
           attempt_count, last_error_code, cancelled_at)
        VALUES
          (${attemptId}::uuid, ${idemHash}, ${invitation.id}::uuid, ${invitationHash}, ${proofHash},
           ${providerSubject}, ${invitation.tenantId}::uuid, ${invitation.projectId}::uuid,
           ${email}, ${invitation.intendedRole}, ${state}, 1,
           ${isLive ? null : "invitation_invalid"},
           CASE WHEN ${isLive} THEN NULL ELSE statement_timestamp() END)
        RETURNING id::text AS id, idempotency_hash AS "idempotencyHash",
                  invitation_id::text AS "invitationId", invitation_hash AS "invitationHash",
                  mailbox_proof_ref_hash AS "mailboxProofRefHash", provider_subject AS "providerSubject",
                  tenant_id::text AS "tenantId", project_id::text AS "projectId",
                  intended_email AS "intendedEmail", intended_role AS "intendedRole", state,
                  attempt_count AS "attemptCount", next_retry_at AS "nextRetryAt"
      `;
      await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${invitation.tenantId}, true)`;
      await appendAudit(tx, {
        tenantId: invitation.tenantId, projectId: invitation.projectId,
        action: isLive ? "enrollment.started" : "enrollment.cancelled",
        objectId: attemptId, idempotencyKey: auditKey(attemptId, isLive ? "started" : "cancelled"),
      });
      return publicAttempt(inserted[0]!);
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const safeError = error as {
      code?: unknown;
      message?: unknown;
      cause?: { code?: unknown; message?: unknown };
      meta?: { code?: unknown; message?: unknown };
    };
    const rawDatabaseMessage = safeError?.meta?.message ?? safeError?.cause?.message ?? safeError?.message;
    const databaseMessage = typeof rawDatabaseMessage === "string"
      ? rawDatabaseMessage
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "[uuid]")
        .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}/gi, "[email]")
        .replace(/[A-Za-z0-9_-]{32,}/g, "[opaque-token]")
        .slice(0, 180)
      : null;
    debugEnrollmentFailure("transaction-failed", {
      code: typeof safeError?.code === "string" ? safeError.code : null,
      databaseCode: typeof safeError?.meta?.code === "string" ? safeError.meta.code :
        typeof safeError?.cause?.code === "string" ? safeError.cause.code : null,
      databaseMessage,
    });
    // A parallel attempt may win the invitation's UNIQUE journal slot while
    // this serializable transaction is resolving. Re-read by the full stable
    // input identity rather than handing the caller a second subject.
    try {
      const existing = await lookupStableAttempt();
      if (existing) return publicAttempt(existing);
    } catch { /* fail closed below */ }
    return null;
  }
}

/** Spend a mailbox proof exactly once and bind the durable receipt to this attempt. */
export async function consumeMailboxProofForEnrollment(input: {
  attemptId: string; challengeId: string; code: string;
}): Promise<boolean> {
  let values: { attemptId: string; challengeId: string; code: string };
  try { values = { attemptId: input.attemptId, challengeId: input.challengeId, code: input.code }; }
  catch { return false; }
  if (!UUID.test(values.attemptId) || !UUID.test(values.challengeId) ||
      typeof values.code !== "string" || values.code.length < 32 || values.code.length > 512) return false;
  const workspaceDb = getWorkspacePrisma() as unknown as Sql;
  const authDb = getAuthPrisma() as unknown as TransactionalSql;
  try {
    const attempts = await workspaceDb.$queryRaw<Array<AttemptRow & { inviteStatus: string; notExpired: boolean; retryBlocked: boolean }>>`
      SELECT a.id::text AS id, a.idempotency_hash AS "idempotencyHash",
             a.invitation_id::text AS "invitationId", a.invitation_hash AS "invitationHash",
             a.mailbox_proof_ref_hash AS "mailboxProofRefHash", a.provider_subject AS "providerSubject",
             a.tenant_id::text AS "tenantId", a.project_id::text AS "projectId",
             a.intended_email AS "intendedEmail", a.intended_role AS "intendedRole", a.state,
             a.attempt_count AS "attemptCount", a.next_retry_at AS "nextRetryAt",
             i.status AS "inviteStatus", i.expires_at > statement_timestamp() AS "notExpired",
             COALESCE(a.next_retry_at > statement_timestamp(), false) AS "retryBlocked"
        FROM workspace_enrollment_attempts AS a
        JOIN workspace_invitation_records AS i ON i.id = a.invitation_id
       WHERE a.id = ${values.attemptId}::uuid
    `;
    const attempt = attempts[0];
    if (!attempt || attempt.state !== "pending") return false;
    if (attempt.inviteStatus !== "pending" || !attempt.notExpired) {
      await transitionPendingToCancelled(attempt, "invitation_invalid");
      return false;
    }
    const reference = proofReferenceHash(attempt.invitationId, attempt.intendedEmail, values.challengeId);
    if (reference !== attempt.mailboxProofRefHash) {
      await recordEnrollmentFailure(attempt.id, "proof_replay");
      return false;
    }
    const identifier = proofIdentifier(attempt.invitationId, attempt.intendedEmail);
    const consumed = await authDb.$transaction(async (tx) => {
      const spent = await tx.$queryRaw<Array<{ attemptId: string; codeDigestHash: string }>>`
        SELECT attempt_id::text AS "attemptId", code_digest_hash AS "codeDigestHash"
          FROM auth_spike.workspace_mailbox_proof_spends
         WHERE proof_ref_hash = ${reference}
         FOR UPDATE
      `;
      if (spent[0]) return spent[0].attemptId === attempt.id && spent[0].codeDigestHash === proofDigest(values.code);
      if (attempt.retryBlocked) return false;
      const alreadyUsedByAttempt = await tx.$queryRaw<Array<{ proofRefHash: string }>>`
        SELECT proof_ref_hash AS "proofRefHash"
          FROM auth_spike.workspace_mailbox_proof_spends
         WHERE attempt_id = ${attempt.id}::uuid
         LIMIT 1 FOR UPDATE
      `;
      if (alreadyUsedByAttempt.length) return false;
      const proof = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM auth_spike.verification
         WHERE id = ${values.challengeId}
           AND identifier = ${identifier}
           AND value = ${proofDigest(values.code)}
           AND expires_at > statement_timestamp()
         LIMIT 1 FOR UPDATE
      `;
      if (!proof.length) return false;
      const removed = await tx.$executeRaw`
        DELETE FROM auth_spike.verification WHERE id = ${values.challengeId}
          AND identifier = ${identifier} AND value = ${proofDigest(values.code)}
          AND expires_at > statement_timestamp()
      `;
      if (removed !== 1) return false;
      const recorded = await tx.$executeRaw`
        INSERT INTO auth_spike.workspace_mailbox_proof_spends(proof_ref_hash, attempt_id, code_digest_hash)
        VALUES (${reference}, ${attempt.id}::uuid, ${proofDigest(values.code)})
      `;
      return recorded === 1;
    });
    if (consumed) return true;
    const racedReceipt = await authDb.$queryRaw<Array<{ attemptId: string; codeDigestHash: string }>>`
      SELECT attempt_id::text AS "attemptId", code_digest_hash AS "codeDigestHash"
        FROM auth_spike.workspace_mailbox_proof_spends WHERE proof_ref_hash=${reference}
    `;
    if (racedReceipt[0]?.attemptId === attempt.id && racedReceipt[0]?.codeDigestHash === proofDigest(values.code)) return true;
    await recordEnrollmentFailure(attempt.id, "proof_replay");
    return false;
  } catch {
    await recordEnrollmentFailure(values.attemptId, "provider_error");
    return false;
  }
}

async function transitionPendingToCancelled(attempt: AttemptRow, errorCode: "invitation_invalid"): Promise<void> {
  const workspaceDb = getWorkspacePrisma() as unknown as TransactionalSql;
  await workspaceDb.$transaction(async (tx) => {
    const changed = await tx.$executeRaw`
      UPDATE workspace_enrollment_attempts SET state='cancelled', cancelled_at=statement_timestamp(),
        last_error_code=${errorCode}, updated_at=statement_timestamp()
       WHERE id=${attempt.id}::uuid AND state='pending'
    `;
    if (!changed) return;
    await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${attempt.tenantId}, true)`;
    await appendAudit(tx, {
      tenantId: attempt.tenantId, projectId: attempt.projectId,
      action: "enrollment.cancelled", objectId: attempt.id,
      idempotencyKey: auditKey(attempt.id, "cancelled", attempt.attemptCount),
    });
  }, { isolationLevel: "Serializable" });
}

/**
 * Store a bounded provider/failure classification without logging provider
 * payloads, tokens or email proofs. Five unsuccessful retries create an
 * alertable terminal poison record that needs controlled manual repair.
 */
export async function recordEnrollmentFailure(
  attemptId: string,
  errorCode: "provider_error" | "identity_conflict" | "proof_replay" | "invitation_invalid" | "audit_error" | "unknown",
): Promise<boolean> {
  if (!UUID.test(attemptId)) return false;
  const workspaceDb = getWorkspacePrisma() as unknown as TransactionalSql;
  try {
    return await workspaceDb.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<AttemptRow & { retryBlocked: boolean }>>`
        SELECT id::text AS id, idempotency_hash AS "idempotencyHash",
               invitation_id::text AS "invitationId", invitation_hash AS "invitationHash",
               mailbox_proof_ref_hash AS "mailboxProofRefHash", provider_subject AS "providerSubject",
               tenant_id::text AS "tenantId", project_id::text AS "projectId",
               intended_email AS "intendedEmail", intended_role AS "intendedRole", state,
               attempt_count AS "attemptCount", next_retry_at AS "nextRetryAt",
               COALESCE(next_retry_at > statement_timestamp(), false) AS "retryBlocked"
          FROM workspace_enrollment_attempts WHERE id=${attemptId}::uuid FOR UPDATE
      `;
      const attempt = rows[0];
      if (!attempt || attempt.retryBlocked || !["pending", "auth_created", "grant_ready_for_review"].includes(attempt.state)) return false;
      const count = Math.min(MAX_ATTEMPTS, attempt.attemptCount + 1);
      const poison = count >= MAX_ATTEMPTS;
      const backoffSeconds = Math.min(240, 15 * (2 ** Math.max(0, count - 1)));
      const changed = await tx.$executeRaw`
        UPDATE workspace_enrollment_attempts
           SET attempt_count=${count}, last_error_code=${errorCode},
               next_retry_at=CASE WHEN ${poison} THEN NULL
                 ELSE statement_timestamp() + (${backoffSeconds} * interval '1 second') END,
               poisoned_at=CASE WHEN ${poison} THEN statement_timestamp() ELSE NULL END,
               state=${poison ? "needs_repair" : attempt.state},
               updated_at=statement_timestamp()
         WHERE id=${attempt.id}::uuid
      `;
      if (!changed) return false;
      await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${attempt.tenantId}, true)`;
      await appendAudit(tx, {
        tenantId: attempt.tenantId, projectId: attempt.projectId,
        action: poison ? "enrollment.needs_repair" : "enrollment.retry_failed",
        objectId: attempt.id, idempotencyKey: auditKey(attempt.id, poison ? "poisoned" : "retry", count),
      });
      return true;
    }, { isolationLevel: "Serializable" });
  } catch {
    return false;
  }
}

async function poisonInTransaction(
  tx: Sql,
  attempt: AttemptRow,
  errorCode: "identity_conflict" | "invitation_invalid",
): Promise<void> {
  const changed = await tx.$executeRaw`
    UPDATE workspace_enrollment_attempts SET state='needs_repair', poisoned_at=statement_timestamp(),
      last_error_code=${errorCode}, next_retry_at=NULL, updated_at=statement_timestamp()
     WHERE id=${attempt.id}::uuid AND state IN ('pending','auth_created','grant_ready_for_review')
  `;
  if (!changed) return;
  await tx.$executeRaw`
    UPDATE workspace_principals SET status='disabled'
     WHERE provider='better_auth' AND provider_subject=${attempt.providerSubject} AND kind='client' AND status='active'
  `;
  await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${attempt.tenantId}, true)`;
  await appendAudit(tx, {
    tenantId: attempt.tenantId, projectId: attempt.projectId,
    action: "enrollment.needs_repair", objectId: attempt.id,
    idempotencyKey: auditKey(attempt.id, "poisoned", attempt.attemptCount + 1),
  });
}

async function poisonAttempt(attempt: AttemptRow, errorCode: "identity_conflict" | "invitation_invalid"): Promise<void> {
  const workspaceDb = getWorkspacePrisma() as unknown as TransactionalSql;
  await workspaceDb.$transaction((tx) => poisonInTransaction(tx, attempt, errorCode), { isolationLevel: "Serializable" });
}

/** Reconcile an auth identity committed before the Workspace journal advanced. */
export async function reconcileEnrollmentAttempt(attemptId: string): Promise<string | null> {
  if (!UUID.test(attemptId)) return null;
  const workspaceDb = getWorkspacePrisma() as unknown as Sql;
  const authDb = getAuthPrisma() as unknown as Sql;
  try {
    const attempts = await workspaceDb.$queryRaw<AttemptRow[]>`
      SELECT id::text AS id, idempotency_hash AS "idempotencyHash",
             invitation_id::text AS "invitationId", invitation_hash AS "invitationHash",
             mailbox_proof_ref_hash AS "mailboxProofRefHash", provider_subject AS "providerSubject",
             tenant_id::text AS "tenantId", project_id::text AS "projectId",
             intended_email AS "intendedEmail", intended_role AS "intendedRole", state,
             attempt_count AS "attemptCount", next_retry_at AS "nextRetryAt"
        FROM workspace_enrollment_attempts WHERE id=${attemptId}::uuid
    `;
    const attempt = attempts[0];
    if (!attempt) return null;
    const users = await authDb.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id, email FROM auth_spike."user" WHERE id=${attempt.providerSubject} LIMIT 1
    `;
    if (!users.length) {
      const orphan = await workspaceDb.$queryRaw<Array<{ present: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM workspace_principals WHERE provider='better_auth'
          AND provider_subject=${attempt.providerSubject}) AS present
      `;
      if (orphan[0]?.present) await poisonAttempt(attempt, "identity_conflict");
      else if (attempt.state === "pending") {
        const invite = await workspaceDb.$queryRaw<Array<{ valid: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM workspace_invitation_records i
            JOIN workspace_tenants t ON t.id=i.tenant_id
            JOIN workspace_projects p ON p.tenant_id=i.tenant_id AND p.id=i.project_id
            WHERE i.id=${attempt.invitationId}::uuid AND i.status='pending'
              AND i.expires_at > statement_timestamp() AND t.status='active') AS valid
        `;
        if (!invite[0]?.valid) await transitionPendingToCancelled(attempt, "invitation_invalid");
      }
      return (await workspaceDb.$queryRaw<Array<{ state: string }>>`
        SELECT state FROM workspace_enrollment_attempts WHERE id=${attempt.id}::uuid
      `)[0]?.state ?? null;
    }
    if (users[0]!.email.toLowerCase() !== attempt.intendedEmail.toLowerCase()) {
      await poisonAttempt(attempt, "identity_conflict");
      return "needs_repair";
    }
    return await markAuthIdentityCreated(attempt.providerSubject, users[0]!.email);
  } catch {
    return null;
  }
}

/** Called by Better Auth's user-create after hook; it never creates a grant. */
export async function markAuthIdentityCreated(providerSubject: string, emailInput: string): Promise<string | null> {
  const email = normalizeInvitedEmail(emailInput);
  if (!UUID.test(providerSubject) || !email) return null;
  const authDb = getAuthPrisma() as unknown as Sql;
  const workspaceDb = getWorkspacePrisma() as unknown as TransactionalSql;
  try {
    const users = await authDb.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id,email FROM auth_spike."user" WHERE id=${providerSubject} LIMIT 1
    `;
    if (users.length !== 1 || users[0]!.email.toLowerCase() !== email) return null;
    return await workspaceDb.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<AttemptRow & {
        inviteStatus: string; notExpired: boolean; tenantStatus: string; projectTenantId: string | null;
      }>>`
        SELECT a.id::text AS id, a.idempotency_hash AS "idempotencyHash",
               a.invitation_id::text AS "invitationId", a.invitation_hash AS "invitationHash",
               a.mailbox_proof_ref_hash AS "mailboxProofRefHash", a.provider_subject AS "providerSubject",
               a.tenant_id::text AS "tenantId", a.project_id::text AS "projectId",
               a.intended_email AS "intendedEmail", a.intended_role AS "intendedRole", a.state,
               a.attempt_count AS "attemptCount", a.next_retry_at AS "nextRetryAt",
               i.status AS "inviteStatus", i.expires_at > statement_timestamp() AS "notExpired", t.status AS "tenantStatus",
               p.tenant_id::text AS "projectTenantId"
          FROM workspace_enrollment_attempts a
          JOIN workspace_invitation_records i ON i.id=a.invitation_id
          JOIN workspace_tenants t ON t.id=a.tenant_id
          LEFT JOIN workspace_projects p ON p.tenant_id=a.tenant_id AND p.id=a.project_id
         WHERE a.provider_subject=${providerSubject}
         FOR UPDATE OF a,i,t
      `;
      const attempt = rows[0];
      if (!attempt) return null;
      const proofSpend = await authDb.$queryRaw<Array<{ attemptId: string; proofRefHash: string }>>`
        SELECT attempt_id::text AS "attemptId", proof_ref_hash AS "proofRefHash"
          FROM auth_spike.workspace_mailbox_proof_spends
         WHERE attempt_id=${attempt.id}::uuid
      `;
      if (proofSpend.length !== 1 || proofSpend[0]!.proofRefHash !== attempt.mailboxProofRefHash) {
        await poisonInTransaction(tx, attempt, "identity_conflict");
        return "needs_repair";
      }
      if (["grant_ready_for_review", "completed"].includes(attempt.state)) return attempt.state;
      if (attempt.state !== "pending" && attempt.state !== "auth_created") return attempt.state;
      if (users[0]!.email.toLowerCase() !== attempt.intendedEmail.toLowerCase()) {
        await poisonInTransaction(tx, attempt, "identity_conflict");
        return "needs_repair";
      }
      if (!liveInvitation({
        status: attempt.inviteStatus, notExpired: attempt.notExpired,
        tenantStatus: attempt.tenantStatus, projectTenantId: attempt.projectTenantId,
      })) {
        await poisonInTransaction(tx, attempt, "invitation_invalid");
        return "needs_repair";
      }
      const principals = await tx.$queryRaw<Array<{ id: string; kind: string; status: string }>>`
        SELECT id::text AS id, kind, status FROM workspace_principals
         WHERE provider='better_auth' AND provider_subject=${providerSubject}
         LIMIT 1 FOR UPDATE
      `;
      let principalId: string;
      if (principals[0]) {
        if (principals[0].kind !== "client" || principals[0].status !== "disabled") {
          await poisonInTransaction(tx, attempt, "identity_conflict");
          return "needs_repair";
        }
        principalId = principals[0].id;
      } else {
        principalId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO workspace_principals(id,provider,provider_subject,kind,status)
          VALUES (${principalId}::uuid,'better_auth',${providerSubject},'client','disabled')
        `;
      }
      await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${attempt.tenantId}, true)`;
      if (attempt.state === "pending") {
        await tx.$executeRaw`
          UPDATE workspace_enrollment_attempts SET state='auth_created', auth_created_at=statement_timestamp(),
            principal_created_at=statement_timestamp(), updated_at=statement_timestamp()
           WHERE id=${attempt.id}::uuid AND state='pending'
        `;
        await appendAudit(tx, {
          tenantId: attempt.tenantId, projectId: attempt.projectId,
          action: "enrollment.auth_created", objectId: attempt.id,
          idempotencyKey: auditKey(attempt.id, "auth-created"),
        });
      }
      await tx.$executeRaw`
        UPDATE workspace_enrollment_attempts SET state='grant_ready_for_review', updated_at=statement_timestamp()
         WHERE id=${attempt.id}::uuid AND state='auth_created'
      `;
      await appendAudit(tx, {
        tenantId: attempt.tenantId, projectId: attempt.projectId,
        action: "enrollment.grant_review_ready", objectId: attempt.id,
        idempotencyKey: auditKey(attempt.id, "grant-review-ready"),
      });
      return "grant_ready_for_review";
    }, { isolationLevel: "Serializable" });
  } catch {
    return null;
  }
}

async function authorizeCurrentStaffSession(sessionId: string, providerSubject: string): Promise<boolean> {
  const maxAge = maxMfaAgeSecondsForAction("project.activate");
  if (!maxAge) return false;
  const authDb = getAuthPrisma() as unknown as Sql;
  const rows = await authDb.$queryRaw<Array<{ userId: string }>>`
    SELECT s.user_id AS "userId" FROM auth_spike.session s
      JOIN auth_spike."user" u ON u.id=s.user_id
      JOIN auth_spike."twoFactor" f ON f.user_id=u.id AND f.verified=true
     WHERE s.id=${sessionId} AND s.user_id=${providerSubject} AND u.two_factor_enabled=true
       AND s.expires_at > statement_timestamp() AND s.mfa_verified_at IS NOT NULL
       AND s.mfa_verified_at <= statement_timestamp()
       AND s.mfa_verified_at >= statement_timestamp() - (${maxAge} * interval '1 second')
     LIMIT 1
  `;
  return rows.length === 1;
}

/** Explicit owner approval is the only path that creates workspace membership/grant. */
export async function approveEnrollmentGrantForVerifiedSubject(input: {
  attemptId: string; sessionId: string; providerSubject: string;
}): Promise<boolean> {
  let values: { attemptId: string; sessionId: string; providerSubject: string };
  try { values = { attemptId: input.attemptId, sessionId: input.sessionId, providerSubject: input.providerSubject }; }
  catch { return false; }
  if (!UUID.test(values.attemptId) || typeof values.sessionId !== "string" || !values.sessionId ||
      typeof values.providerSubject !== "string" || !UUID.test(values.providerSubject)) return false;
  let stage = "verify-owner-session";
  try {
    if (!(await authorizeCurrentStaffSession(values.sessionId, values.providerSubject))) {
      debugEnrollmentFailure("owner-approval-session-denied", {});
      return false;
    }
    const workspaceDb = getWorkspacePrisma() as unknown as TransactionalSql;
    return await workspaceDb.$transaction(async (tx) => {
      stage = "lock-attempt-and-invitation";
      const attempts = await tx.$queryRaw<Array<AttemptRow & { inviteStatus: string; notExpired: boolean }>>`
        SELECT a.id::text AS id, a.idempotency_hash AS "idempotencyHash",
               a.invitation_id::text AS "invitationId", a.invitation_hash AS "invitationHash",
               a.mailbox_proof_ref_hash AS "mailboxProofRefHash", a.provider_subject AS "providerSubject",
               a.tenant_id::text AS "tenantId", a.project_id::text AS "projectId",
               a.intended_email AS "intendedEmail", a.intended_role AS "intendedRole", a.state,
               a.attempt_count AS "attemptCount", a.next_retry_at AS "nextRetryAt",
               i.status AS "inviteStatus", i.expires_at > statement_timestamp() AS "notExpired"
          FROM workspace_enrollment_attempts a
          JOIN workspace_invitation_records i ON i.id=a.invitation_id
         WHERE a.id=${values.attemptId}::uuid
         FOR UPDATE OF a,i
      `;
      const attempt = attempts[0];
      if (!attempt || !CLIENT_ROLES.has(attempt.intendedRole)) {
        debugEnrollmentFailure("owner-approval-attempt-denied", {
          attemptFound: Boolean(attempt),
          roleAllowed: attempt ? CLIENT_ROLES.has(attempt.intendedRole) : false,
        });
        return false;
      }
      stage = "lock-exact-owner-grant";
      const owners = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT p.id::text AS id
          FROM workspace_principals p
          JOIN workspace_staff_memberships m ON m.principal_id=p.id
          JOIN workspace_staff_project_grants g ON g.principal_id=p.id
          JOIN workspace_tenants t ON t.id=g.tenant_id
          JOIN workspace_projects pr ON pr.tenant_id=g.tenant_id AND pr.id=g.project_id
         WHERE p.provider='better_auth' AND p.provider_subject=${values.providerSubject}
           AND p.kind='staff' AND p.status='active'
           AND m.status='active' AND m.revoked_at IS NULL
           AND g.status='active' AND g.revoked_at IS NULL AND g.role='workspace_owner'
           AND g.tenant_id=${attempt.tenantId}::uuid AND g.project_id=${attempt.projectId}::uuid
           AND t.status='active'
         LIMIT 1 FOR SHARE OF p,m,g,t,pr
      `;
      const owner = owners[0];
      if (!owner) {
        debugEnrollmentFailure("owner-approval-grant-denied", {});
        return false;
      }
      if (attempt.state === "completed") return true;
      // Retry backoff applies to provider/proof retry work. It cannot block
      // the separate owner decision once identity is ready for review; current
      // owner MFA, exact scope/role, invitation validity and bounded state are
      // rechecked below before any grant is written.
      if (attempt.state !== "grant_ready_for_review" || attempt.inviteStatus !== "pending" ||
          !attempt.notExpired) {
        debugEnrollmentFailure("owner-approval-state-denied", {
          stateAllowed: attempt.state === "grant_ready_for_review",
          invitationPending: attempt.inviteStatus === "pending", invitationUnexpired: attempt.notExpired,
        });
        await poisonInTransaction(tx, attempt, "invitation_invalid");
        return false;
      }
      stage = "activate-client-principal";
      const principals = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id::text AS id,status FROM workspace_principals
         WHERE provider='better_auth' AND provider_subject=${attempt.providerSubject} AND kind='client'
         LIMIT 1 FOR UPDATE
      `;
      const client = principals[0];
      if (!client || client.status !== "disabled") {
        debugEnrollmentFailure("owner-approval-principal-denied", {
          principalFound: Boolean(client), principalDisabled: client?.status === "disabled",
        });
        await poisonInTransaction(tx, attempt, "identity_conflict");
        return false;
      }
      stage = "commit-membership-grant-and-audit";
      await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${attempt.tenantId}, true)`;
      await tx.$executeRaw`UPDATE workspace_principals SET status='active' WHERE id=${client.id}::uuid AND status='disabled'`;
      await tx.$executeRaw`
        INSERT INTO workspace_client_memberships(tenant_id,principal_id,principal_kind,status)
        VALUES (${attempt.tenantId}::uuid,${client.id}::uuid,'client','active')
        ON CONFLICT (tenant_id,principal_id) DO UPDATE
          SET status='active', revoked_at=NULL, granted_at=statement_timestamp()
      `;
      await tx.$executeRaw`
        INSERT INTO workspace_client_project_grants(tenant_id,project_id,principal_id,role,status)
        VALUES (${attempt.tenantId}::uuid,${attempt.projectId}::uuid,${client.id}::uuid,${attempt.intendedRole},'active')
        ON CONFLICT (tenant_id,project_id,principal_id,role) DO UPDATE
          SET status='active', revoked_at=NULL, granted_at=statement_timestamp()
      `;
      const redeemed = await tx.$executeRaw`
        UPDATE workspace_invitation_records SET status='redeemed', redeemed_by_client_id=${client.id}::uuid,
          redeemed_at=statement_timestamp()
         WHERE id=${attempt.invitationId}::uuid AND tenant_id=${attempt.tenantId}::uuid
           AND project_id=${attempt.projectId}::uuid AND status='pending'
           AND expires_at > statement_timestamp()
      `;
      if (redeemed !== 1) throw new Error("Invitation was no longer redeemable.");
      const completed = await tx.$executeRaw`
        UPDATE workspace_enrollment_attempts SET state='completed', grant_approved_at=statement_timestamp(),
          completed_at=statement_timestamp(), updated_at=statement_timestamp()
         WHERE id=${attempt.id}::uuid AND state='grant_ready_for_review'
      `;
      if (completed !== 1) throw new Error("Enrollment approval was no longer available.");
      await appendAudit(tx, {
        tenantId: attempt.tenantId, projectId: attempt.projectId, actorId: owner.id,
        action: "enrollment.grant_approved", objectId: attempt.id,
        idempotencyKey: auditKey(attempt.id, "grant-approved"),
      });
      return true;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const safeError = error as {
      code?: unknown;
      message?: unknown;
      cause?: { code?: unknown; message?: unknown };
      meta?: { code?: unknown; message?: unknown };
    };
    const rawMessage = safeError?.meta?.message ?? safeError?.cause?.message ?? safeError?.message;
    const message = typeof rawMessage === "string"
      ? rawMessage
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "[uuid]")
        .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}/gi, "[email]")
        .replace(/[A-Za-z0-9_-]{32,}/g, "[opaque-token]")
        .slice(0, 180)
      : null;
    debugEnrollmentFailure("owner-approval-transaction-failed", {
      stage,
      code: typeof safeError?.code === "string" ? safeError.code : null,
      databaseCode: typeof safeError?.meta?.code === "string" ? safeError.meta.code :
        typeof safeError?.cause?.code === "string" ? safeError.cause.code : null,
      message,
    });
    return false;
  }
}

/** Request wrapper binds approval to Better Auth's verified current session. */
export async function approveEnrollmentGrantForVerifiedRequest(input: {
  headers: Headers; attemptId: string;
}): Promise<boolean> {
  try {
    const headers = new Headers(input.headers);
    const attemptId = input.attemptId;
    const current = await auth.api.getSession({ headers });
    if (!current?.session?.id || !current.user?.id) return false;
    return approveEnrollmentGrantForVerifiedSubject({
      attemptId, sessionId: current.session.id, providerSubject: current.user.id,
    });
  } catch {
    return false;
  }
}
