import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("session-bound, tenant-scoped client project reads (disposable PG only)",
    { skip: "Explicit local PostgreSQL fixture required." }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";

  const [{ PrismaPg }, { PrismaClient }, { getAuthPrisma },
    { loadPublishedProjectForTrustedIdentity, PublishedProjectAccessDenied }] = await Promise.all([
      import("@prisma/adapter-pg"), import("../generated/client/index.js"),
      import("../src/database.ts"), import("../src/trusted-published-project.ts"),
    ]);
  const authDb = getAuthPrisma();
  const adminDb = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.WORKSPACE_DATABASE_URL,
      max: 3, connectionTimeoutMillis: 5_000 }),
  });
  const restrictedUrl = assertDisposableLoopbackDatabaseUrl(
    process.env.WORKSPACE_READ_RUNTIME_DATABASE_URL, "digipants_workspace_dev");
  if (restrictedUrl.username !== "cw_client_read_ci")
    throw new Error("A distinct restricted runtime login is required.");
  const runtimeDb = new PrismaClient({
    adapter: new PrismaPg({ connectionString: restrictedUrl.toString(),
      max: 3, connectionTimeoutMillis: 5_000 }),
  });
  globalThis.authExperimentWorkspaceDb = runtimeDb;

  test("verified session + email + MFA + active exact grant + published project are all required", async t => {
    const id = {
      subject: randomUUID(), session: randomUUID(), client: randomUUID(),
      tenantA: randomUUID(), tenantB: randomUUID(),
      projectA: randomUUID(), projectB: randomUUID(),
    };
    const read = (overrides={}) => loadPublishedProjectForTrustedIdentity({
      sessionId: id.session, providerSubject: id.subject,
      tenantId: id.tenantA, projectId: id.projectA, ...overrides,
    });
    await t.after(async () => {
      try {
        // All project and identity fixtures are synthetic; no audit table is
        // changed or cleared. Clean only fixture tenant rows in this disposable DB.
        await adminDb.$executeRaw`DELETE FROM workspace_client_project_grants
          WHERE principal_id = ${id.client}::uuid`;
        await adminDb.$executeRaw`DELETE FROM workspace_client_memberships
          WHERE principal_id = ${id.client}::uuid`;
        await adminDb.$executeRaw`DELETE FROM workspace_projects WHERE id IN
          (${id.projectA}::uuid,${id.projectB}::uuid)`;
        await adminDb.$executeRaw`DELETE FROM workspace_principals WHERE id=${id.client}::uuid`;
        await adminDb.$executeRaw`DELETE FROM workspace_tenants WHERE id IN
          (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await authDb.session.deleteMany({ where: { userId: id.subject } });
        await authDb.twoFactor.deleteMany({ where: { userId: id.subject } });
        await authDb.user.deleteMany({ where: { id: id.subject } });
      } finally {
        await runtimeDb.$disconnect();
        await adminDb.$disconnect();
        await authDb.$disconnect();
        delete globalThis.authExperimentWorkspaceDb;
      }
    });

    await authDb.user.create({ data: {
      id: id.subject, name: "Synthetic Verified Client",
      email: `verified-client-${id.subject}@example.invalid`,
      emailVerified: true, twoFactorEnabled: true,
    } });
    await authDb.twoFactor.create({ data: {
      id: randomUUID(), userId: id.subject, secret: "synthetic-only-factor",
      backupCodes: "[]", verified: true,
    } });
    await authDb.session.create({ data: {
      id: id.session, userId: id.subject, token: randomUUID(),
      expiresAt: new Date(Date.now()+60*60_000), mfaVerifiedAt: new Date(),
    } });
    await adminDb.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES
        (${id.tenantA}::uuid,'Synthetic client tenant A'),(${id.tenantB}::uuid,'Synthetic client tenant B')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind)
        VALUES (${id.client}::uuid,${id.subject},'client')`;
      await tx.$executeRaw`INSERT INTO workspace_client_memberships(tenant_id,principal_id)
        VALUES (${id.tenantA}::uuid,${id.client}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES
        (${id.projectA}::uuid,${id.tenantA}::uuid,'Example Portal Project'),
        (${id.projectB}::uuid,${id.tenantB}::uuid,'Other Company Private Project')`;
      await tx.$executeRaw`INSERT INTO workspace_client_project_grants
        (tenant_id,project_id,principal_id,role) VALUES
        (${id.tenantA}::uuid,${id.projectA}::uuid,${id.client}::uuid,'client_viewer')`;
    });

    const identity = await runtimeDb.$queryRaw`SELECT current_user::text AS role`;
    assert.equal(identity[0]?.role, "cw_client_read_ci");
    // A privileged login impersonating cw_runtime through SET ROLE must deny.
    const privileged = await adminDb.$queryRaw`SELECT current_user::text AS login`;
    assert.equal(privileged[0]?.login, "digipants_ws_dev");
    globalThis.authExperimentWorkspaceDb = adminDb;
    await assert.rejects(read(), PublishedProjectAccessDenied);
    globalThis.authExperimentWorkspaceDb = runtimeDb;

    await assert.rejects(read(), PublishedProjectAccessDenied,
      "a valid grant never bypasses the unpublished-project gate");
    await adminDb.$executeRaw`UPDATE workspace_projects SET publication='published'
      WHERE tenant_id=${id.tenantA}::uuid AND id=${id.projectA}::uuid`;
    const visible = await read();
    assert.deepEqual(visible, {
      id: id.projectA, tenantId: id.tenantA, title: "Example Portal Project",
      state: "planned", revision: "1",
    });
    assert.equal(Object.isFrozen(visible), true);
    assert.equal(JSON.stringify(visible).includes("providerSubject"), false);

    await assert.rejects(read({ tenantId: id.tenantB, projectId: id.projectB }), PublishedProjectAccessDenied);
    await assert.rejects(read({ providerSubject: randomUUID() }), PublishedProjectAccessDenied);
    await assert.rejects(read({ sessionId: randomUUID() }), PublishedProjectAccessDenied);
    await assert.rejects(read({ tenantId: "injected" }), PublishedProjectAccessDenied);

    await authDb.user.update({ where: { id: id.subject }, data: { emailVerified: false } });
    await assert.rejects(read(), PublishedProjectAccessDenied);
    await authDb.user.update({ where: { id: id.subject }, data: { emailVerified: true } });

    await authDb.session.update({ where: { id: id.session },
      data: { mfaVerifiedAt: new Date(Date.now()-13*60*60_000) } });
    await assert.rejects(read(), PublishedProjectAccessDenied);
    await authDb.session.update({ where: { id: id.session }, data: { mfaVerifiedAt: new Date() } });

    await adminDb.$executeRaw`UPDATE workspace_client_project_grants
      SET status='revoked',revoked_at=statement_timestamp()
      WHERE principal_id=${id.client}::uuid`;
    await assert.rejects(read(), PublishedProjectAccessDenied);
    await adminDb.$executeRaw`UPDATE workspace_client_project_grants SET status='active',revoked_at=NULL
      WHERE principal_id=${id.client}::uuid`;
    await adminDb.$executeRaw`UPDATE workspace_client_memberships
      SET status='revoked',revoked_at=statement_timestamp() WHERE principal_id=${id.client}::uuid`;
    await assert.rejects(read(), PublishedProjectAccessDenied);
    await adminDb.$executeRaw`UPDATE workspace_client_memberships SET status='active',revoked_at=NULL
      WHERE principal_id=${id.client}::uuid`;
    // Membership reactivation intentionally leaves its grants revoked.
    // A separate, explicit owner action is required to reinstate a grant.
    await adminDb.$executeRaw`UPDATE workspace_client_project_grants SET status='active',revoked_at=NULL
      WHERE principal_id=${id.client}::uuid`;
    assert.equal((await read()).id, id.projectA, "restored authorized grant is visible again");

    await adminDb.$executeRaw`UPDATE workspace_tenants SET status='suspended' WHERE id=${id.tenantA}::uuid`;
    await assert.rejects(read(), PublishedProjectAccessDenied);
    await adminDb.$executeRaw`UPDATE workspace_tenants SET status='active' WHERE id=${id.tenantA}::uuid`;
    assert.equal((await read()).id, id.projectA, "suspended tenant reactivation alone restored normal view");
    await adminDb.$executeRaw`UPDATE workspace_projects SET publication='unpublished'
      WHERE id=${id.projectA}::uuid`;
    await assert.rejects(read(), PublishedProjectAccessDenied);

    await adminDb.$executeRaw`UPDATE workspace_projects SET publication='published'
      WHERE id=${id.projectA}::uuid`;
    assert.equal((await read()).id, id.projectA, "republishing restores authorized read");
    await authDb.session.delete({ where: { id: id.session } });
    await assert.rejects(read(), PublishedProjectAccessDenied,
      "session revoked after DB grant check cannot authorize later reads");
  });
}
