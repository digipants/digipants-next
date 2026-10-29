import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const testDoubleKey = "__clientWorkspacePersistenceTestDouble";

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

const effectiveGrants = await loadServerModule("../lib/client-workspace/effective-grants.ts");
const projectState = await loadServerModule("../lib/client-workspace/project-state.ts");

const tenantId = "8b5ec2d6-9672-4d3a-8a4b-a87287316690";
const projectId = "d6ed70ae-66c4-43a6-b9bd-ec59a9fdd8ea";
const principalId = "51ad20e9-7430-4844-b394-095a7a4ff835";

test("effective-grant query binds an exact tenant/project and requires every parent and grant active", async () => {
  let observed;
  globalThis[testDoubleKey] = {
    $queryRaw: async (strings, ...values) => {
      observed = { sql: strings.join("?"), values };
      return [{ userId: principalId, tenantId, projectId, role: "client_viewer" }];
    },
  };

  const grants = await effectiveGrants.loadEffectiveWorkspaceGrants({
    providerSubject: "synthetic-client-subject",
    tenantId,
    projectId,
  });

  assert.deepEqual(grants, [{ userId: principalId, tenantId, projectId, role: "client_viewer", status: "active" }]);
  assert.match(observed.sql, /workspace_client_project_grants/);
  assert.match(observed.sql, /workspace_staff_project_grants/);
  assert.match(observed.sql, /p\.status = 'active'/);
  assert.match(observed.sql, /t\.status = 'active'/);
  assert.match(observed.sql, /m\.status = 'active'/);
  assert.match(observed.sql, /g\.status = 'active'/);
  assert.match(observed.sql, /m\.revoked_at IS NULL/);
  assert.match(observed.sql, /g\.revoked_at IS NULL/);
  assert.match(observed.sql, /g\.tenant_id = \?::uuid/);
  assert.match(observed.sql, /g\.project_id = \?::uuid/);
  assert.deepEqual(observed.values, ["synthetic-client-subject", tenantId, projectId, "synthetic-client-subject", tenantId, projectId]);
});

test("invalid tenant/project IDs fail closed without touching the database", async () => {
  let called = false;
  globalThis[testDoubleKey] = { $queryRaw: async () => { called = true; return []; } };

  assert.deepEqual(await effectiveGrants.loadEffectiveWorkspaceGrants({
    providerSubject: "synthetic-client-subject",
    tenantId: "tenant-from-browser",
    projectId,
  }), []);
  assert.equal(called, false);
});

test("unknown database roles are discarded instead of widening permissions", async () => {
  globalThis[testDoubleKey] = {
    $queryRaw: async () => [{ userId: principalId, tenantId, projectId, role: "workspace_admin" }],
  };

  assert.deepEqual(await effectiveGrants.loadEffectiveWorkspaceGrants({
    providerSubject: "synthetic-client-subject",
    tenantId,
    projectId,
  }), []);
});

function stateDatabase({ role = "delivery_lead", changedCount = 1, auditError } = {}) {
  const calls = { options: undefined, grantWhere: undefined, projectUpdate: undefined, auditCreate: undefined };
  const transaction = {
    workspaceStaffProjectGrant: {
      findFirst: async ({ where }) => {
        calls.grantWhere = where;
          return role && where.role.in.includes(role) ? { role } : null;
      },
    },
    workspaceProject: {
      updateMany: async (query) => {
        calls.projectUpdate = query;
        return { count: changedCount };
      },
    },
    workspaceAuditEvent: {
      create: async (query) => {
        calls.auditCreate = query;
        if (auditError) throw auditError;
      },
    },
  };
  const database = {
    $transaction: async (callback, options) => {
      calls.options = options;
      return callback(transaction);
    },
  };
  return { database, calls };
}

function stateCommand(overrides = {}) {
  return {
    tenantId,
    projectId,
    actorPrincipalId: principalId,
    expectedRevision: 3n,
    nextState: "paused",
    idempotencyKey: "synthetic-command-1",
    ...overrides,
  };
}

test("state update and audit are one serializable, tenant-scoped transaction", async () => {
  const { database, calls } = stateDatabase();
  globalThis[testDoubleKey] = database;

  assert.equal(await projectState.recordProjectStateChange(stateCommand()), 4n);
  assert.deepEqual(calls.options, { isolationLevel: "Serializable" });
  assert.equal(calls.grantWhere.tenantId, tenantId);
  assert.equal(calls.grantWhere.projectId, projectId);
  assert.equal(calls.grantWhere.principalId, principalId);
  assert.equal(calls.projectUpdate.where.tenantId, tenantId);
  assert.equal(calls.projectUpdate.where.id, projectId);
  assert.equal(calls.projectUpdate.where.revision, 3n);
  assert.deepEqual(calls.projectUpdate.data, { state: "paused", revision: { increment: 1n } });
  assert.equal(calls.auditCreate.data.tenantId, tenantId);
  assert.equal(calls.auditCreate.data.projectId, projectId);
  assert.equal(calls.auditCreate.data.beforeRevision, 3n);
  assert.equal(calls.auditCreate.data.afterRevision, 4n);
  assert.equal(calls.auditCreate.data.idempotencyKey, "synthetic-command-1");
});

test("state permissions match staff roles; activation and closure require the owner", async () => {
  for (const role of [null, "commercial_approver"]) {
    globalThis[testDoubleKey] = stateDatabase({ role }).database;
    await assert.rejects(projectState.recordProjectStateChange(stateCommand()), projectState.WorkspaceStateConflict);
  }

  globalThis[testDoubleKey] = stateDatabase({ role: "delivery_staff" }).database;
  assert.equal(await projectState.recordProjectStateChange(stateCommand()), 4n);
  globalThis[testDoubleKey] = stateDatabase({ role: "delivery_staff" }).database;
  await assert.rejects(
    projectState.recordProjectStateChange(stateCommand({ nextState: "active" })),
    projectState.WorkspaceStateConflict,
  );

  globalThis[testDoubleKey] = stateDatabase({ role: "delivery_lead" }).database;
  await assert.rejects(
    projectState.recordProjectStateChange(stateCommand({ nextState: "closed" })),
    projectState.WorkspaceStateConflict,
  );

  globalThis[testDoubleKey] = stateDatabase({ role: "workspace_owner" }).database;
  await assert.rejects(projectState.recordProjectStateChange(stateCommand()), projectState.WorkspaceStateConflict);
  assert.equal(await projectState.recordProjectStateChange(stateCommand({ nextState: "active" })), 4n);
});

test("revision conflict or audit failure rejects the entire state-change command", async () => {
  const conflict = stateDatabase({ changedCount: 0 });
  globalThis[testDoubleKey] = conflict.database;
  await assert.rejects(projectState.recordProjectStateChange(stateCommand()), projectState.WorkspaceStateConflict);
  assert.equal(conflict.calls.auditCreate, undefined);

  const auditFailure = new Error("duplicate idempotency key");
  globalThis[testDoubleKey] = stateDatabase({ auditError: auditFailure }).database;
  await assert.rejects(projectState.recordProjectStateChange(stateCommand()), /duplicate idempotency key/);
});

test("invalid state commands fail before opening a transaction", async () => {
  let called = false;
  globalThis[testDoubleKey] = { $transaction: async () => { called = true; } };

  await assert.rejects(
    projectState.recordProjectStateChange(stateCommand({ nextState: "active_typo" })),
    TypeError,
  );
  assert.equal(called, false);
});

test("migration includes tenant/kind/role constraints and revocation/reassignment guards", async () => {
  const migration = await readFile(
    new URL("../prisma/migrations/20261029130000_client_workspace_foundation/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /FOREIGN KEY \(tenant_id, project_id\)[\s\S]*REFERENCES workspace_projects\(tenant_id, id\)/);
  assert.match(migration, /FOREIGN KEY \(principal_id, principal_kind\)[\s\S]*REFERENCES workspace_principals\(id, kind\)/);
  assert.match(migration, /client_viewer','client_contributor','client_approver','client_signatory/);
  assert.match(migration, /delivery_staff','delivery_lead','commercial_approver','workspace_owner/);
  assert.match(migration, /invitation_token_hash text NOT NULL UNIQUE/);
  assert.match(migration, /workspace_principal_identity_immutable/);
  assert.match(migration, /workspace_project_tenant_immutable/);
  assert.match(migration, /workspace_client_membership_revoke_grants/);
  assert.match(migration, /workspace_staff_membership_revoke_grants/);
  assert.match(migration, /workspace_disabled_principal_revoke_memberships/);
});
