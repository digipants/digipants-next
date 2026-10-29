import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import ts from "typescript";

const databaseUrl = process.env.DATABASE_URL;
if ((!process.env.WORKSPACE_DB_TEST_APPROVED && !process.env.WORKSPACE_DB_TEST_LOCAL) || !databaseUrl) {
  throw new Error("Set an explicit database-test guard and the approved test DATABASE_URL.");
}

const parsedUrl = new URL(databaseUrl);
const approvedNeonDatabase = process.env.WORKSPACE_DB_TEST_APPROVED === "1" &&
  parsedUrl.hostname.endsWith(".neon.tech") && parsedUrl.pathname === "/digipants_workspace_dev";
const approvedLocalDatabase = process.env.WORKSPACE_DB_TEST_LOCAL === "1" &&
  ["127.0.0.1", "localhost"].includes(parsedUrl.hostname) && parsedUrl.pathname === "/digipants_workspace_dev";
if (!approvedNeonDatabase && !approvedLocalDatabase) {
  throw new Error("Use the approved Neon development URL or explicitly enable a loopback-only test database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 }),
});
const testDoubleKey = "__clientWorkspacePersistenceTestDouble";
globalThis[testDoubleKey] = prisma;

async function loadServerModule(relativePath) {
  let source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  source = source.replace(/^import "server-only";\s*/m, "");
  source = source.replace(
    'import { getWorkspacePrisma } from "./database";',
    `const getWorkspacePrisma = () => globalThis.${testDoubleKey};`,
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

const { loadEffectiveWorkspaceGrants } = await loadServerModule("../lib/client-workspace/effective-grants.ts");
const { recordProjectStateChange } = await loadServerModule("../lib/client-workspace/project-state.ts");

const ids = {
  tenantA: randomUUID(),
  tenantB: randomUUID(),
  client: randomUUID(),
  staff: randomUUID(),
  projectA: randomUUID(),
  projectB: randomUUID(),
};
const tokenHash = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const idempotencyKey = `synthetic-state-${randomUUID()}`;
let fixturesCreated = false;
let assertions = 0;

async function expectRejected(label, operation) {
  let rejected = false;
  try {
    await operation();
  } catch {
    rejected = true;
  }
  assert.ok(rejected, `${label} should be rejected by PostgreSQL`);
  assertions += 1;
}

async function createFixtures() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO workspace_tenants (id, legal_name) VALUES (${ids.tenantA}::uuid, 'Synthetic Tenant A')`;
    await tx.$executeRaw`INSERT INTO workspace_tenants (id, legal_name) VALUES (${ids.tenantB}::uuid, 'Synthetic Tenant B')`;
    await tx.$executeRaw`INSERT INTO workspace_principals (id, provider_subject, kind) VALUES (${ids.client}::uuid, ${`synthetic-client-${ids.client}`}, 'client')`;
    await tx.$executeRaw`INSERT INTO workspace_principals (id, provider_subject, kind) VALUES (${ids.staff}::uuid, ${`synthetic-staff-${ids.staff}`}, 'staff')`;
    await tx.$executeRaw`INSERT INTO workspace_client_memberships (tenant_id, principal_id) VALUES (${ids.tenantA}::uuid, ${ids.client}::uuid)`;
    await tx.$executeRaw`INSERT INTO workspace_client_memberships (tenant_id, principal_id) VALUES (${ids.tenantB}::uuid, ${ids.client}::uuid)`;
    await tx.$executeRaw`INSERT INTO workspace_staff_memberships (principal_id) VALUES (${ids.staff}::uuid)`;
    await tx.$executeRaw`INSERT INTO workspace_projects (id, tenant_id, title) VALUES (${ids.projectA}::uuid, ${ids.tenantA}::uuid, 'Synthetic Project A')`;
    await tx.$executeRaw`INSERT INTO workspace_projects (id, tenant_id, title) VALUES (${ids.projectB}::uuid, ${ids.tenantB}::uuid, 'Synthetic Project B')`;
    await tx.$executeRaw`INSERT INTO workspace_client_project_grants (tenant_id, project_id, principal_id, role) VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, ${ids.client}::uuid, 'client_viewer')`;
    await tx.$executeRaw`INSERT INTO workspace_client_project_grants (tenant_id, project_id, principal_id, role) VALUES (${ids.tenantB}::uuid, ${ids.projectB}::uuid, ${ids.client}::uuid, 'client_approver')`;
    await tx.$executeRaw`INSERT INTO workspace_staff_project_grants (tenant_id, project_id, principal_id, role) VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, ${ids.staff}::uuid, 'delivery_lead')`;
    await tx.$executeRaw`INSERT INTO workspace_invitation_records (tenant_id, project_id, intended_email, intended_role, invitation_token_hash, issued_by_staff_id, expires_at)
      VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, 'synthetic@example.test', 'client_viewer', ${tokenHash}, ${ids.staff}::uuid, now() + interval '1 day')`;
  });
  fixturesCreated = true;
}

async function cleanupFixtures() {
  if (!fixturesCreated) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM workspace_audit_events WHERE tenant_id IN (${ids.tenantA}::uuid, ${ids.tenantB}::uuid)`;
    await tx.$executeRaw`DELETE FROM workspace_invitation_records WHERE tenant_id IN (${ids.tenantA}::uuid, ${ids.tenantB}::uuid)`;
    await tx.$executeRaw`DELETE FROM workspace_client_project_grants WHERE tenant_id IN (${ids.tenantA}::uuid, ${ids.tenantB}::uuid)`;
    await tx.$executeRaw`DELETE FROM workspace_staff_project_grants WHERE tenant_id IN (${ids.tenantA}::uuid, ${ids.tenantB}::uuid)`;
    await tx.$executeRaw`DELETE FROM workspace_projects WHERE tenant_id IN (${ids.tenantA}::uuid, ${ids.tenantB}::uuid)`;
    await tx.$executeRaw`DELETE FROM workspace_client_memberships WHERE tenant_id IN (${ids.tenantA}::uuid, ${ids.tenantB}::uuid)`;
    await tx.$executeRaw`DELETE FROM workspace_staff_memberships WHERE principal_id = ${ids.staff}::uuid`;
    await tx.$executeRaw`DELETE FROM workspace_principals WHERE id IN (${ids.client}::uuid, ${ids.staff}::uuid)`;
    await tx.$executeRaw`DELETE FROM workspace_tenants WHERE id IN (${ids.tenantA}::uuid, ${ids.tenantB}::uuid)`;
  });
  fixturesCreated = false;
}

try {
  const identity = await prisma.$queryRaw`SELECT current_database() AS database_name, current_user AS role_name`;
  assert.equal(identity[0]?.database_name, "digipants_workspace_dev");
  assert.equal(identity[0]?.role_name, "digipants_ws_dev");
  assertions += 2;

  await createFixtures();

  const clientSubject = `synthetic-client-${ids.client}`;
  const staffSubject = `synthetic-staff-${ids.staff}`;
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectA }), [
    { userId: ids.client, tenantId: ids.tenantA, projectId: ids.projectA, role: "client_viewer", status: "active" },
  ]);
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: staffSubject, tenantId: ids.tenantA, projectId: ids.projectA }), [
    { userId: ids.staff, tenantId: ids.tenantA, projectId: ids.projectA, role: "delivery_lead", status: "active" },
  ]);
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectB }), []);
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantB, projectId: ids.projectA }), []);
  assertions += 4;

  await expectRejected("cross-tenant project/grant pair", () => prisma.$executeRaw`
    INSERT INTO workspace_client_project_grants (tenant_id, project_id, principal_id, role)
    VALUES (${ids.tenantB}::uuid, ${ids.projectA}::uuid, ${ids.client}::uuid, 'client_contributor')
  `);
  await expectRejected("grant without matching tenant membership", () => prisma.$executeRaw`
    INSERT INTO workspace_client_project_grants (tenant_id, project_id, principal_id, role)
    VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, ${randomUUID()}::uuid, 'client_contributor')
  `);
  await expectRejected("staff principal as client membership", () => prisma.$executeRaw`
    INSERT INTO workspace_client_memberships (tenant_id, principal_id)
    VALUES (${ids.tenantA}::uuid, ${ids.staff}::uuid)
  `);
  await expectRejected("client principal as staff membership", () => prisma.$executeRaw`
    INSERT INTO workspace_staff_memberships (principal_id) VALUES (${ids.client}::uuid)
  `);
  await expectRejected("invalid client role", () => prisma.$executeRaw`
    INSERT INTO workspace_client_project_grants (tenant_id, project_id, principal_id, role)
    VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, ${ids.client}::uuid, 'workspace_owner')
  `);
  await expectRejected("invalid staff role", () => prisma.$executeRaw`
    INSERT INTO workspace_staff_project_grants (tenant_id, project_id, principal_id, role)
    VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, ${ids.staff}::uuid, 'client_signatory')
  `);
  await expectRejected("client principal as staff grant", () => prisma.$executeRaw`
    INSERT INTO workspace_staff_project_grants (tenant_id, project_id, principal_id, role)
    VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, ${ids.client}::uuid, 'delivery_staff')
  `);
  await expectRejected("staff principal redeemed as client invite", () => prisma.$executeRaw`
    INSERT INTO workspace_invitation_records (tenant_id, project_id, intended_email, intended_role, invitation_token_hash,
      status, issued_by_staff_id, redeemed_by_client_id, redeemed_principal_kind, expires_at, redeemed_at)
    VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, 'synthetic@example.test', 'client_viewer', ${`${tokenHash}dead`},
      'redeemed', ${ids.staff}::uuid, ${ids.staff}::uuid, 'client', now() + interval '1 day', now())
  `);
  await expectRejected("short invitation token hash", () => prisma.$executeRaw`
    INSERT INTO workspace_invitation_records (tenant_id, project_id, intended_email, intended_role, invitation_token_hash, issued_by_staff_id, expires_at)
    VALUES (${ids.tenantA}::uuid, ${ids.projectA}::uuid, 'synthetic@example.test', 'client_viewer', 'short', ${ids.staff}::uuid, now() + interval '1 day')
  `);
  await expectRejected("inconsistent revoked-membership timestamp", () => prisma.$executeRaw`
    UPDATE workspace_client_memberships SET status = 'revoked', revoked_at = NULL
    WHERE tenant_id = ${ids.tenantA}::uuid AND principal_id = ${ids.client}::uuid
  `);
  await expectRejected("principal subject reassignment", () => prisma.$executeRaw`
    UPDATE workspace_principals SET provider_subject = 'reassigned-subject'
    WHERE id = ${ids.client}::uuid
  `);
  await expectRejected("project tenant reassignment", () => prisma.$executeRaw`
    UPDATE workspace_projects SET tenant_id = ${ids.tenantB}::uuid WHERE id = ${ids.projectA}::uuid
  `);
  await expectRejected("cross-tenant audit project pair", () => prisma.$executeRaw`
    INSERT INTO workspace_audit_events (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
    VALUES (${ids.tenantB}::uuid, ${ids.projectA}::uuid, 'system', 'synthetic', 'project', ${ids.projectA}, ${`bad-${randomUUID()}`})
  `);

  await prisma.$executeRaw`UPDATE workspace_client_memberships SET status = 'revoked', revoked_at = now()
    WHERE tenant_id = ${ids.tenantA}::uuid AND principal_id = ${ids.client}::uuid`;
  assert.equal((await prisma.$queryRaw`SELECT status FROM workspace_client_project_grants WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.client}::uuid`)[0]?.status, "revoked");
  assertions += 1;
  await prisma.$executeRaw`UPDATE workspace_client_project_grants SET status = 'active', revoked_at = NULL
    WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.client}::uuid`;
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectA }), []);
  assertions += 1;
  await prisma.$executeRaw`UPDATE workspace_client_memberships SET status = 'active', granted_at = now(), revoked_at = NULL
    WHERE tenant_id = ${ids.tenantA}::uuid AND principal_id = ${ids.client}::uuid`;
  assert.equal((await prisma.$queryRaw`SELECT status FROM workspace_client_project_grants WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.client}::uuid`)[0]?.status, "revoked");
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectA }), []);
  assertions += 2;

  await prisma.$executeRaw`UPDATE workspace_client_project_grants SET status = 'active', granted_at = now(), revoked_at = NULL
    WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.client}::uuid`;
  await prisma.$executeRaw`UPDATE workspace_tenants SET status = 'suspended' WHERE id = ${ids.tenantA}::uuid`;
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectA }), []);
  assertions += 1;
  await prisma.$executeRaw`UPDATE workspace_tenants SET status = 'active' WHERE id = ${ids.tenantA}::uuid`;
  await prisma.$executeRaw`UPDATE workspace_principals SET status = 'disabled' WHERE id = ${ids.client}::uuid`;
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectA }), []);
  assert.equal((await prisma.$queryRaw`SELECT status FROM workspace_client_memberships WHERE tenant_id = ${ids.tenantA}::uuid AND principal_id = ${ids.client}::uuid`)[0]?.status, "revoked");
  assertions += 2;
  await prisma.$executeRaw`UPDATE workspace_principals SET status = 'active' WHERE id = ${ids.client}::uuid`;
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectA }), []);
  assertions += 1;

  await prisma.$executeRaw`UPDATE workspace_client_memberships SET status = 'active', granted_at = now(), revoked_at = NULL
    WHERE tenant_id = ${ids.tenantA}::uuid AND principal_id = ${ids.client}::uuid`;
  await prisma.$executeRaw`UPDATE workspace_client_project_grants SET status = 'active', granted_at = now(), revoked_at = NULL
    WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.client}::uuid`;
  await prisma.$executeRaw`UPDATE workspace_client_project_grants SET status = 'revoked', revoked_at = now()
    WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.client}::uuid`;
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: clientSubject, tenantId: ids.tenantA, projectId: ids.projectA }), []);
  assertions += 1;

  await prisma.$executeRaw`UPDATE workspace_staff_memberships SET status = 'revoked', revoked_at = now() WHERE principal_id = ${ids.staff}::uuid`;
  assert.equal((await prisma.$queryRaw`SELECT status FROM workspace_staff_project_grants WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.staff}::uuid`)[0]?.status, "revoked");
  assert.deepEqual(await loadEffectiveWorkspaceGrants({ providerSubject: staffSubject, tenantId: ids.tenantA, projectId: ids.projectA }), []);
  assertions += 2;

  await prisma.$executeRaw`UPDATE workspace_staff_memberships SET status = 'active', granted_at = now(), revoked_at = NULL WHERE principal_id = ${ids.staff}::uuid`;
  await prisma.$executeRaw`UPDATE workspace_staff_project_grants SET status = 'active', granted_at = now(), revoked_at = NULL WHERE tenant_id = ${ids.tenantA}::uuid AND project_id = ${ids.projectA}::uuid AND principal_id = ${ids.staff}::uuid`;
  assert.equal(await recordProjectStateChange({
    tenantId: ids.tenantA,
    projectId: ids.projectA,
    actorPrincipalId: ids.staff,
    expectedRevision: 1n,
    nextState: "paused",
    idempotencyKey,
  }), 2n);
  const initialState = await prisma.$queryRaw`SELECT state, revision FROM workspace_projects WHERE id = ${ids.projectA}::uuid`;
  const initialAudit = await prisma.$queryRaw`SELECT before_revision, after_revision FROM workspace_audit_events WHERE tenant_id = ${ids.tenantA}::uuid AND idempotency_key = ${idempotencyKey}`;
  assert.equal(initialState[0]?.state, "paused");
  assert.equal(initialState[0]?.revision, 2n);
  assert.equal(initialAudit.length, 1);
  assert.equal(initialAudit[0]?.before_revision, 1n);
  assert.equal(initialAudit[0]?.after_revision, 2n);
  assertions += 5;

  await expectRejected("duplicate idempotency key", () => recordProjectStateChange({
    tenantId: ids.tenantA,
    projectId: ids.projectA,
    actorPrincipalId: ids.staff,
    expectedRevision: 2n,
    nextState: "change_review",
    idempotencyKey,
  }));
  const rolledBackState = await prisma.$queryRaw`SELECT state, revision FROM workspace_projects WHERE id = ${ids.projectA}::uuid`;
  const rolledBackAudit = await prisma.$queryRaw`SELECT count(*)::int AS count FROM workspace_audit_events WHERE tenant_id = ${ids.tenantA}::uuid AND idempotency_key = ${idempotencyKey}`;
  assert.equal(rolledBackState[0]?.state, "paused");
  assert.equal(rolledBackState[0]?.revision, 2n);
  assert.equal(rolledBackAudit[0]?.count, 1);
  assertions += 3;

  await expectRejected("stale project revision", () => recordProjectStateChange({
    tenantId: ids.tenantA,
    projectId: ids.projectA,
    actorPrincipalId: ids.staff,
    expectedRevision: 1n,
    nextState: "change_review",
    idempotencyKey: `stale-${randomUUID()}`,
  }));

} finally {
  try {
    await cleanupFixtures();
  } finally {
    await prisma.$disconnect();
    delete globalThis[testDoubleKey];
  }
}

console.log(`Workspace persistence integration passed: ${assertions} assertions; synthetic fixtures were removed.`);
