import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("founder owner published project read (disposable PG only)", {
    skip: "Explicit local PostgreSQL fixture required.",
  }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";

  const [{ PrismaPg }, { PrismaClient }, { getAuthPrisma },
    { loadPublishedProjectForTrustedIdentity, PublishedProjectAccessDenied }] =
    await Promise.all([
      import("@prisma/adapter-pg"), import("../generated/client/index.js"),
      import("../src/database.ts"), import("../src/trusted-published-project.ts"),
    ]);

  const authDb = getAuthPrisma();
  const workspaceAdmin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.WORKSPACE_DATABASE_URL,
      max: 3, connectionTimeoutMillis: 5_000 }),
  });
  const restrictedUrl = assertDisposableLoopbackDatabaseUrl(
    process.env.WORKSPACE_READ_RUNTIME_DATABASE_URL, "digipants_workspace_dev");
  if (restrictedUrl.username !== "cw_client_read_ci")
    throw new Error("A separate nonowner runtime login is required");
  const workspaceRuntime = new PrismaClient({
    adapter: new PrismaPg({ connectionString: restrictedUrl.toString(),
      max: 3, connectionTimeoutMillis: 5_000 }),
  });
  globalThis.authExperimentWorkspaceDb = workspaceRuntime;

  test("workspace_owner can read only its published project with fresh verified MFA", async t => {
    const id = {
      user: randomUUID(), session: randomUUID(), principal: randomUUID(),
      tenantA: randomUUID(), tenantB: randomUUID(),
      projectA: randomUUID(), projectB: randomUUID(),
    };
    const read = (overrides = {}) => loadPublishedProjectForTrustedIdentity({
      sessionId: id.session, providerSubject: id.user,
      tenantId: id.tenantA, projectId: id.projectA, ...overrides,
    });

    t.after(async () => {
      try {
        await workspaceAdmin.$executeRaw`DELETE FROM workspace_staff_project_grants
          WHERE principal_id=${id.principal}::uuid`;
        await workspaceAdmin.$executeRaw`DELETE FROM workspace_staff_memberships
          WHERE principal_id=${id.principal}::uuid`;
        await workspaceAdmin.$executeRaw`DELETE FROM workspace_projects
          WHERE id IN (${id.projectA}::uuid,${id.projectB}::uuid)`;
        await workspaceAdmin.$executeRaw`DELETE FROM workspace_principals
          WHERE id=${id.principal}::uuid`;
        await workspaceAdmin.$executeRaw`DELETE FROM workspace_tenants
          WHERE id IN (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await authDb.session.deleteMany({ where: { userId: id.user } });
        await authDb.twoFactor.deleteMany({ where: { userId: id.user } });
        await authDb.user.deleteMany({ where: { id: id.user } });
      } finally {
        await workspaceRuntime.$disconnect();
        await workspaceAdmin.$disconnect();
        await authDb.$disconnect();
        delete globalThis.authExperimentWorkspaceDb;
      }
    });

    await authDb.user.create({ data: {
      id: id.user, name: "Synthetic Founder Owner",
      email: `synthetic-founder-${id.user}@example.invalid`,
      emailVerified: true, twoFactorEnabled: true,
    } });
    await authDb.twoFactor.create({ data: {
      id: randomUUID(), userId: id.user, secret: "synthetic-only",
      backupCodes: "[]", verified: true,
    } });
    await authDb.session.create({ data: {
      id: id.session, userId: id.user, token: randomUUID(),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      mfaVerifiedAt: new Date(),
    } });

    await workspaceAdmin.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES
        (${id.tenantA}::uuid,'Synthetic founder company A'),
        (${id.tenantB}::uuid,'Synthetic unrelated company B')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind)
        VALUES (${id.principal}::uuid,${id.user},'staff')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id)
        VALUES (${id.principal}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES
        (${id.projectA}::uuid,${id.tenantA}::uuid,'Internal Founder Project'),
        (${id.projectB}::uuid,${id.tenantB}::uuid,'Other Tenant Private Project')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_project_grants
        (tenant_id,project_id,principal_id,role)
        VALUES (${id.tenantA}::uuid,${id.projectA}::uuid,${id.principal}::uuid,'workspace_owner')`;
    });
    assert.equal((await workspaceRuntime.$queryRaw`SELECT current_user::text AS role`)[0]?.role,
      "cw_client_read_ci");

    await assert.rejects(read(), PublishedProjectAccessDenied,
      "Owner cannot read unpublished project from this published-only HTTP seam");
    await workspaceAdmin.$executeRaw`UPDATE workspace_projects SET publication='published'
      WHERE id=${id.projectA}::uuid`;
    const visible = await read();
    assert.deepEqual(visible, {
      id: id.projectA, tenantId: id.tenantA, title: "Internal Founder Project",
      state: "planned", revision: "1", milestones: [], progressUpdates: [],
    });

    await workspaceAdmin.$executeRaw`UPDATE workspace_projects SET publication='published'
      WHERE id=${id.projectB}::uuid`;
    await assert.rejects(read({ tenantId: id.tenantB, projectId: id.projectB }),
      PublishedProjectAccessDenied, "Owner of tenant A cannot read tenant B");
    await assert.rejects(read({ providerSubject: randomUUID() }),
      PublishedProjectAccessDenied, "Caller cannot forge a different principal");
    await assert.rejects(read({ sessionId: randomUUID() }),
      PublishedProjectAccessDenied, "Missing authenticated session is denied");

    await workspaceAdmin.$executeRaw`UPDATE workspace_staff_project_grants
      SET status='revoked',revoked_at=statement_timestamp()
      WHERE principal_id=${id.principal}::uuid`;
    await assert.rejects(read(), PublishedProjectAccessDenied,
      "Revoked owner project grant cannot authorize a read");
    await workspaceAdmin.$executeRaw`UPDATE workspace_staff_project_grants
      SET status='active',revoked_at=NULL WHERE principal_id=${id.principal}::uuid`;
    await workspaceAdmin.$executeRaw`UPDATE workspace_staff_memberships
      SET status='revoked',revoked_at=statement_timestamp()
      WHERE principal_id=${id.principal}::uuid`;
    await assert.rejects(read(), PublishedProjectAccessDenied,
      "Revoked staff membership cannot authorize a read");
    await workspaceAdmin.$executeRaw`UPDATE workspace_staff_memberships
      SET status='active',revoked_at=NULL WHERE principal_id=${id.principal}::uuid`;
    assert.equal((await read()).id, id.projectA);

    await authDb.session.update({ where: { id: id.session },
      data: { mfaVerifiedAt: new Date(Date.now() - 13 * 60 * 60_000) } });
    await assert.rejects(read(), PublishedProjectAccessDenied,
      "Stale owner MFA assurance cannot authorize a read");
    await authDb.session.update({ where: { id: id.session },
      data: { mfaVerifiedAt: new Date() } });
    assert.equal((await read()).id, id.projectA);
  });
}
