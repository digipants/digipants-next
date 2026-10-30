import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("trusted project state and concurrent revocation (disposable PG only)", { skip: "Explicit PostgreSQL fixture required." }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";
  const [{ PrismaPg }, { PrismaClient }, { getAuthPrisma }, { commitVerifiedStaffProjectStateChange }] = await Promise.all([
    import("@prisma/adapter-pg"), import("../generated/client/index.js"),
    import("../src/database.ts"), import("../src/trusted-project-state.ts"),
  ]);
  const authDb = getAuthPrisma();
  const workspaceDb = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.WORKSPACE_DATABASE_URL, max: 4, connectionTimeoutMillis: 5_000 }),
  });
  const runtimeUrl = new URL(process.env.WORKSPACE_DATABASE_URL);
  runtimeUrl.searchParams.set("options", "-c role=cw_runtime");
  const workspaceRuntimeDb = new PrismaClient({
    adapter: new PrismaPg({ connectionString: runtimeUrl.toString(), max: 4, connectionTimeoutMillis: 5_000 }),
  });
  globalThis.authExperimentWorkspaceDb = workspaceRuntimeDb;

  test("verified subject, fresh MFA, exact action role and locked grants are required", async (t) => {
    const id = { user: randomUUID(), session: randomUUID(), principal: randomUUID(),
      tenantA: randomUUID(), tenantB: randomUUID(), projectA: randomUUID(), projectB: randomUUID() };
    const runtimeRole = await workspaceRuntimeDb.$queryRaw`SELECT current_user::text AS role`;
    assert.equal(runtimeRole[0]?.role, "cw_runtime", "trusted state changes use the restricted runtime role");
    const cmd = (overrides = {}) => ({
      sessionId: id.session, providerSubject: id.user,
      tenantId: id.tenantA, projectId: id.projectA,
      expectedRevision: 1n, nextState: "paused", idempotencyKey: `trusted-state-${randomUUID()}`,
      ...overrides,
    });
    await t.after(async () => {
      try {
        await workspaceDb.$executeRawUnsafe(`DROP TRIGGER IF EXISTS cw_test_delay_state_update ON workspace_projects`);
        await workspaceDb.$executeRawUnsafe(`DROP FUNCTION IF EXISTS cw_test_delay_state_update()`);
        // Audit is intentionally append-only. The surrounding PostgreSQL 17
        // database is a one-job disposable fixture, so leave its synthetic
        // workspace rows to container teardown instead of disabling triggers.
        await authDb.session.deleteMany({ where: { userId: id.user } });
        await authDb.twoFactor.deleteMany({ where: { userId: id.user } });
        await authDb.user.deleteMany({ where: { id: id.user } });
      } finally {
        await workspaceRuntimeDb.$disconnect();
        await workspaceDb.$disconnect();
        await authDb.$disconnect();
        delete globalThis.authExperimentWorkspaceDb;
      }
    });

    await authDb.user.create({ data: { id: id.user, name: "Synthetic State Actor",
      email: `trusted-state-${id.user}@example.invalid`, emailVerified: true, twoFactorEnabled: true } });
    await authDb.twoFactor.create({ data: { id: randomUUID(), userId: id.user,
      secret: "fixture-only-encrypted-factor", backupCodes: "[]", verified: true } });
    await authDb.session.create({ data: { id: id.session, userId: id.user, token: randomUUID(),
      expiresAt: new Date(Date.now() + 60 * 60_000), mfaVerifiedAt: new Date() } });
    await workspaceDb.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES
        (${id.tenantA}::uuid,'Synthetic state tenant A'),(${id.tenantB}::uuid,'Synthetic state tenant B')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind)
        VALUES (${id.principal}::uuid,${id.user},'staff')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id) VALUES (${id.principal}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES
        (${id.projectA}::uuid,${id.tenantA}::uuid,'Synthetic project A'),
        (${id.projectB}::uuid,${id.tenantB}::uuid,'Synthetic project B')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_project_grants(tenant_id,project_id,principal_id,role) VALUES
        (${id.tenantA}::uuid,${id.projectA}::uuid,${id.principal}::uuid,'delivery_lead')`;
    });

    await assert.rejects(commitVerifiedStaffProjectStateChange(cmd({ providerSubject: randomUUID() })), /verified session/,
      "a forged identity cannot borrow another subject's session");
    await assert.rejects(commitVerifiedStaffProjectStateChange(cmd({ tenantId: id.tenantB, projectId: id.projectB })), /verified session/,
      "a project in another tenant has no matching grant");
    await assert.rejects(commitVerifiedStaffProjectStateChange(cmd({ nextState: "active" })), /verified session/,
      "activation needs an action-appropriate owner grant, not only delivery privilege");

    await authDb.session.update({ where: { id: id.session }, data: { mfaVerifiedAt: new Date(Date.now() - 20 * 60_000) } });
    await assert.rejects(commitVerifiedStaffProjectStateChange(cmd()), /verified session/,
      "stale MFA assurance denies a routine state change");
    await authDb.session.update({ where: { id: id.session }, data: { mfaVerifiedAt: new Date() } });

    const pausedCommand = cmd({
      // An extra caller-selected actor is ignored; the audit actor comes from the DB subject binding.
      actorPrincipalId: randomUUID(),
    });
    const pausedRevision = await commitVerifiedStaffProjectStateChange(pausedCommand);
    assert.equal(pausedRevision, 2n);
    const latestAudit = await workspaceDb.$queryRaw`SELECT actor_principal_id::text AS actor FROM workspace_audit_events WHERE idempotency_key=${pausedCommand.idempotencyKey}`;
    assert.equal(latestAudit[0]?.actor, id.principal);

    await workspaceDb.$executeRaw`INSERT INTO workspace_staff_project_grants(tenant_id,project_id,principal_id,role)
      VALUES (${id.tenantA}::uuid,${id.projectA}::uuid,${id.principal}::uuid,'workspace_owner')`;
    assert.equal(await commitVerifiedStaffProjectStateChange(cmd({ expectedRevision: 2n, nextState: "active" })), 3n,
      "activation succeeds only after the exact owner grant exists");
    await workspaceDb.$executeRaw`UPDATE workspace_staff_project_grants SET status='revoked',revoked_at=statement_timestamp()
      WHERE principal_id=${id.principal}::uuid AND role='workspace_owner'`;
    await assert.rejects(commitVerifiedStaffProjectStateChange(cmd({ expectedRevision: 3n, nextState: "closed" })), /verified session/,
      "a revoked owner grant cannot be borrowed from an active delivery role");

    // Exercise the exact lock used by the authorization query. The state
    // transaction holds FOR SHARE before updating; a concurrent revocation
    // cannot commit first and authorize against a stale grant.
    await workspaceDb.$executeRawUnsafe(`CREATE FUNCTION cw_test_delay_state_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.id = '${id.projectA}'::uuid THEN PERFORM pg_sleep(0.5); END IF; RETURN NEW; END $$`);
    await workspaceDb.$executeRawUnsafe(`CREATE TRIGGER cw_test_delay_state_update BEFORE UPDATE OF state ON workspace_projects
      FOR EACH ROW EXECUTE FUNCTION cw_test_delay_state_update()`);
    const change = commitVerifiedStaffProjectStateChange(cmd({ expectedRevision: 3n, nextState: "change_review" }));
    let updateInFlight = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const active = await workspaceDb.$queryRaw`SELECT count(*)::int AS count
        FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid()
         AND state = 'active' AND wait_event = 'PgSleep'
         AND query ILIKE '%workspace_projects%'`;
      if (active[0]?.count > 0) { updateInFlight = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(updateInFlight, true, "state update entered its in-transaction delay after acquiring grant locks");
    const startedAt = Date.now();
    const revoke = workspaceDb.$executeRaw`UPDATE workspace_staff_project_grants SET status='revoked',revoked_at=statement_timestamp()
      WHERE principal_id=${id.principal}::uuid AND role='delivery_lead'`;
    const [changedRevision, revokedCount] = await Promise.all([change, revoke]);
    assert.equal(changedRevision, 4n);
    assert.equal(revokedCount, 1);
    assert.ok(Date.now() - startedAt >= 350, "revocation waited behind the authorized transaction's row lock");
    await assert.rejects(commitVerifiedStaffProjectStateChange(cmd({ expectedRevision: 4n, nextState: "paused" })), /verified session/,
      "the same subject cannot mutate after grant revocation commits");

    const final = await workspaceDb.$queryRaw`SELECT state,revision FROM workspace_projects WHERE id=${id.projectA}::uuid`;
    const auditCount = await workspaceDb.$queryRaw`SELECT count(*)::int AS count FROM workspace_audit_events WHERE project_id=${id.projectA}::uuid`;
    assert.equal(final[0]?.state, "change_review");
    assert.equal(final[0]?.revision, 4n);
    assert.equal(auditCount[0]?.count, 3, "all serializable state transitions committed matching audit rows");
  });
}
