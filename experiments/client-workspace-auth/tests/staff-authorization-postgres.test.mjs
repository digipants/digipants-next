import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("staff grant gate (disposable PG only)", { skip: "Explicit CI fixture required." }, () => {});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL, "auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL, "digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED = "1";
  const [{ getAuthPrisma, getWorkspacePrisma }, { authorizeValidatedStaffWorkspaceAction }] = await Promise.all([
    import("../src/database.ts"), import("../src/workspace-access-core.ts"),
  ]);
  const authDb = getAuthPrisma(), workspaceDb = getWorkspacePrisma();
  const doubleKey = "__staffAuthGateWorkspaceDb";
  globalThis[doubleKey] = workspaceDb;
  let source = await readFile(new URL("../../../lib/client-workspace/effective-grants.ts", import.meta.url), "utf8");
  source = source.replace(/^import "server-only";\s*/m, "");
  source = source.replace('import { getWorkspacePrisma } from "./database";', `const getWorkspacePrisma = () => globalThis.${doubleKey};`);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { loadEffectiveWorkspaceGrants } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

  test("staff roles, recent verified MFA and tenant scope are necessary; revocations deny", async t => {
    const id = { authUser: randomUUID(), session: randomUUID(),
      principal: randomUUID(), tenantA: randomUUID(), tenantB: randomUUID(),
      projectA: randomUUID(), projectB: randomUUID() };
    const base = { authDb, workspaceDb, loadEffectiveGrants: loadEffectiveWorkspaceGrants,
      sessionId: id.session, providerSubject: id.authUser, tenantId: id.tenantA,
      projectId: id.projectA, publication: "unpublished" };
    const action = (name, overrides={}) => authorizeValidatedStaffWorkspaceAction({ ...base, action: name, ...overrides });
    await t.after(async () => {
      try {
        await workspaceDb.$executeRaw`DELETE FROM workspace_staff_project_grants WHERE principal_id=${id.principal}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_staff_memberships WHERE principal_id=${id.principal}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_projects WHERE id IN (${id.projectA}::uuid,${id.projectB}::uuid)`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_principals WHERE id=${id.principal}::uuid`;
        await workspaceDb.$executeRaw`DELETE FROM workspace_tenants WHERE id IN (${id.tenantA}::uuid,${id.tenantB}::uuid)`;
        await authDb.session.deleteMany({ where: { userId: id.authUser } });
        await authDb.twoFactor.deleteMany({ where: { userId: id.authUser } });
        await authDb.user.deleteMany({ where: { id: id.authUser } });
      } finally { await authDb.$disconnect(); await workspaceDb.$disconnect(); delete globalThis[doubleKey]; }
    });
    await authDb.user.create({ data: { id: id.authUser, name: "Synthetic Staff",
      email: `synthetic-staff-${id.authUser}@example.invalid`, emailVerified: true, twoFactorEnabled: true } });
    await authDb.twoFactor.create({ data: { id: randomUUID(), userId: id.authUser,
      secret: "test-only-not-real-totp", backupCodes: "[]", verified: true } });
    await authDb.session.create({ data: { id: id.session, userId: id.authUser, token: randomUUID(),
      expiresAt: new Date(Date.now()+60*60_000), mfaVerifiedAt: new Date() } });
    await workspaceDb.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES
        (${id.tenantA}::uuid,'Staff test A'),(${id.tenantB}::uuid,'Staff test B')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind)
        VALUES (${id.principal}::uuid,${id.authUser},'staff')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id) VALUES (${id.principal}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES
        (${id.projectA}::uuid,${id.tenantA}::uuid,'Staff test A'),
        (${id.projectB}::uuid,${id.tenantB}::uuid,'Staff test B')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_project_grants
        (tenant_id,project_id,principal_id,role) VALUES
        (${id.tenantA}::uuid,${id.projectA}::uuid,${id.principal}::uuid,'workspace_owner'),
        (${id.tenantA}::uuid,${id.projectA}::uuid,${id.principal}::uuid,'commercial_approver')`;
    });
    assert.equal(await action("project.activate"), true);
    assert.equal(await action("invoice.approve"), true);
    assert.equal(await action("proposal.decide"), false, "client approval rights never inherit to staff");
    assert.equal(await action("project.activate", { tenantId: id.tenantB, projectId: id.projectB }), false);
    assert.equal(await action("project.activate", { tenantId: id.tenantA, projectId: id.projectB }), false);
    assert.equal(await action("unknown.synthetic"), false);
    await authDb.session.update({ where: { id: id.session }, data: { mfaVerifiedAt: new Date(Date.now()-10*60_000) } });
    assert.equal(await action("invoice.approve"), false, "high-impact staff authority expires after five minutes");
    await authDb.session.update({ where: { id: id.session }, data: { mfaVerifiedAt: new Date() } });
    await authDb.twoFactor.updateMany({ where: { userId: id.authUser }, data: { verified: false } });
    assert.equal(await action("project.activate"), false);
    await authDb.twoFactor.updateMany({ where: { userId: id.authUser }, data: { verified: true } });
    await workspaceDb.$executeRaw`UPDATE workspace_staff_project_grants SET status='revoked',revoked_at=statement_timestamp()
      WHERE principal_id=${id.principal}::uuid AND role='commercial_approver'`;
    assert.equal(await action("invoice.approve"), false, "owner does not inherit finance role");
    assert.equal(await action("project.activate"), true);
    await workspaceDb.$executeRaw`UPDATE workspace_staff_memberships SET status='revoked',revoked_at=statement_timestamp()
      WHERE principal_id=${id.principal}::uuid`;
    assert.equal(await action("project.activate"), false);
    await authDb.session.delete({ where: { id: id.session } });
    assert.equal(await action("project.activate"), false, "deleted session immediately denies");
  });
}
