import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("mailbox proof (disposable PG only)", { skip: "Enable test fixture" }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";
  const [{ getAuthPrisma, getWorkspacePrisma }, proof] = await Promise.all([
    import("../src/database.ts"), import("../src/mailbox-proof.ts"),
  ]);
  const authDb = getAuthPrisma(), workspaceDb = getWorkspacePrisma();

  test("one-time email proof requires a live, matching invitation", async (t) => {
    const tenant = randomUUID(), project = randomUUID(), staff = randomUUID(), invite = randomUUID();
    const email = `fixture-${randomUUID()}@example.invalid`;
    const key = { authDb, workspaceDb, invitationId: invite, intendedEmail: email };
    await t.after(async () => {
      try {
        await authDb.verification.deleteMany({ where: { identifier: { startsWith: `cw-mail-ownership-v1:${invite}:` } } });
        await workspaceDb.$executeRaw`DELETE FROM workspace_invitation_records WHERE id=${invite}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_staff_memberships WHERE principal_id=${staff}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_projects WHERE id=${project}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_principals WHERE id=${staff}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_tenants WHERE id=${tenant}::uuid`;
      } finally { await authDb.$disconnect(); await workspaceDb.$disconnect(); }
    });
    await workspaceDb.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES (${tenant}::uuid,'Fixture tenant')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind) VALUES (${staff}::uuid,${`staff-${staff}`},'staff')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id) VALUES (${staff}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES (${project}::uuid,${tenant}::uuid,'Fixture project')`;
      await tx.$executeRaw`INSERT INTO workspace_invitation_records
        (id,tenant_id,project_id,intended_email,intended_role,invitation_token_hash,issued_by_staff_id,expires_at)
        VALUES (${invite}::uuid,${tenant}::uuid,${project}::uuid,${email},
        'client_viewer',${randomBytes(32).toString("hex")},${staff}::uuid,
        statement_timestamp()+interval '20 minutes')`;
    });
    assert.equal(await proof.createSyntheticMailboxChallenge({ ...key, intendedEmail: "different@example.invalid" }), null);
    const parallel = await Promise.all([proof.createSyntheticMailboxChallenge(key), proof.createSyntheticMailboxChallenge(key)]);
    assert.equal(parallel.filter(Boolean).length, 1);
    const first = parallel.find(Boolean);
    assert.ok(first);
    const stored = await authDb.verification.findUnique({ where: { id: first.challengeId } });
    assert.ok(stored);
    assert.notEqual(stored.value, first.code);
    assert.match(stored.value, /^[a-f0-9]{64}$/);
    const consume = overrides => proof.consumeSyntheticMailboxChallenge({ ...key, challengeId: first.challengeId, code: first.code, ...overrides });
    assert.equal(await consume({ intendedEmail: "different@example.invalid" }), false);
    assert.equal(await consume({ code: randomBytes(32).toString("base64url") }), false);
    const claims = await Promise.all([consume({}), consume({})]);
    assert.deepEqual(claims.sort(), [false, true]);
    assert.equal(await consume({}), false);
    const second = await proof.createSyntheticMailboxChallenge(key);
    assert.ok(second);
    await authDb.verification.update({ where: { id: second.challengeId }, data: { expiresAt: new Date(Date.now()-1000) } });
    assert.equal(await proof.consumeSyntheticMailboxChallenge({ ...key, challengeId: second.challengeId, code: second.code }), false);
    await workspaceDb.$executeRaw`UPDATE workspace_invitation_records SET status='revoked' WHERE id=${invite}::uuid`;
    assert.equal(await proof.createSyntheticMailboxChallenge(key), null);
    const grantCount = await workspaceDb.$queryRaw`SELECT count(*)::int AS n FROM workspace_client_project_grants WHERE tenant_id=${tenant}::uuid`;
    assert.equal(grantCount[0].n, 0);
  });
}
