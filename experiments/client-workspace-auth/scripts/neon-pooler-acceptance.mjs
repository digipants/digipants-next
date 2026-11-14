import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";
import { checkServerIdentity, TLSSocket } from "node:tls";
import pg from "pg";

export const CHILD_BRANCH_ID = "br-sweet-resonance-zatbu439";
export const LIVE_BRANCH_ID = "br-floral-shadow-zapa2jbz";
export const CHILD_POOLER_HOST = "ep-summer-haze-za0emgk3-pooler.c-2.eu-west-2.aws.neon.tech";
export const CHILD_DATABASE = "digipants_workspace_prod";
export const TENANT_A = "11111111-1111-4111-8111-111111111111";
export const TENANT_B = "22222222-2222-4222-8222-222222222222";
export const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYNTHETIC_CONTEXT_KEY = Buffer.alloc(32, 0x11);

/**
 * Accept only the one pooler endpoint on the disposable child and its
 * non-admin runtime login. No direct URL or production host is accepted.
 */
export function assertPooledNeonUrl(value) {
  if (typeof value !== "string" || value.length > 2000) {
    throw Error("Missing or invalid disposable pooled URL");
  }
  let url;
  try { url = new URL(value); } catch { throw Error("Malformed pooled URL"); }
  const queries = [...url.searchParams.keys()];
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== CHILD_POOLER_HOST ||
      url.pathname !== "/" + CHILD_DATABASE ||
      decodeURIComponent(url.username) !== "cw_pooler_acceptance" ||
      decodeURIComponent(url.password).length < 16 ||
      url.hash || (url.port && url.port !== "5432") ||
      url.searchParams.get("sslmode") !== "verify-full" ||
      queries.some(key => key !== "sslmode" && key !== "channel_binding") ||
      (url.searchParams.has("channel_binding") &&
        url.searchParams.get("channel_binding") !== "require")) {
    throw Error("Only the pinned disposable Neon pooler and restricted login are permitted");
  }
  return url;
}

/**
 * Check the actual client-to-pooler socket. pg_stat_ssl reports a backend
 * connection and cannot prove TLS from this CI client to the Neon pooler.
 */
export function assertVerifiedPooledTlsSocket(client, expectedHostname) {
  const stream = client?.connection?.stream;
  if (!(stream instanceof TLSSocket) || stream.encrypted !== true ||
      stream.authorized !== true || stream.authorizationError) {
    throw Error("Client-to-pooler TLS is not authenticated");
  }
  const certificate = stream.getPeerCertificate(true);
  if (!certificate || typeof certificate !== "object" ||
      (!certificate.subjectaltname && !certificate.subject?.CN) ||
      checkServerIdentity(expectedHostname, certificate)) {
    throw Error("Pooled TLS peer certificate does not match the pinned Neon hostname");
  }
  return true;
}

export function createSignedContextToken({ transactionId, tenantId, projectId, actorSubject, purpose }) {
  if (!/^\d{1,20}$/.test(transactionId) || !UUID.test(tenantId) ||
      (projectId !== null && !UUID.test(projectId)) ||
      (actorSubject !== null && !/^[A-Za-z0-9_-]{1,255}$/.test(actorSubject)) ||
      !/^[a-z][a-z0-9_.-]{0,47}$/.test(purpose)) {
    throw Error("Invalid synthetic authorization context");
  }
  const payloadBytes = Buffer.from([
    "v1", transactionId, tenantId, projectId || "",
    actorSubject || "", purpose,
  ].join("|"), "utf8");
  const payloadHex = payloadBytes.toString("hex");
  const signature = createHmac("sha256", SYNTHETIC_CONTEXT_KEY)
    .update(payloadBytes).digest("hex");
  return payloadHex + "." + signature;
}

function expectedSnapshot(tenantId) {
  if (tenantId === TENANT_A) return {
    tenants: 1, projects: 1, principals: 2, clientMemberships: 0,
    staffMemberships: 2, clientGrants: 0, staffGrants: 2,
    enrollmentAttempts: 0, milestones: 2, progressUpdates: 1, audits: 1,
    projectIds: [PROJECT_A],
  };
  return {
    tenants: 1, projects: 1, principals: 2, clientMemberships: 1,
    staffMemberships: 1, clientGrants: 1, staffGrants: 1,
    enrollmentAttempts: 1, milestones: 0, progressUpdates: 0, audits: 1,
    projectIds: [PROJECT_B],
  };
}

async function beginContext(client, context, options = {}) {
  await client.query("BEGIN");
  const { rows } = await client.query(
    "SELECT pg_current_xact_id()::text AS xid");
  const token = options.tokenOverride ??
    createSignedContextToken({ transactionId: rows[0].xid, ...context });
  const tenantSetting = options.tenantSetting ?? context.tenantId;
  await client.query(
    "SELECT set_config('app.workspace_tenant_id',$1,true), " +
    "set_config('app.workspace_context_token',$2,true)",
    [tenantSetting, token]);
  return { token, xid: rows[0].xid };
}

async function snapshot(client, tenantId, options = {}) {
  const context = tenantId === TENANT_A
    ? { tenantId: TENANT_A, projectId: PROJECT_A,
        actorSubject: "synthetic-security-staff-a", purpose: "delivery.edit" }
    : { tenantId: TENANT_B, projectId: PROJECT_B,
        actorSubject: "99999999-9999-4999-8999-999999999999",
        purpose: "project.read_published" };
  await beginContext(client, context, options);
  try {
    const counts = (await client.query(
      "SELECT " +
      "(SELECT count(*) FROM public.workspace_tenants)::int AS tenants, " +
      "(SELECT count(*) FROM public.workspace_projects)::int AS projects, " +
      "(SELECT count(*) FROM public.workspace_principals)::int AS principals, " +
      "(SELECT count(*) FROM public.workspace_client_memberships)::int AS \"clientMemberships\", " +
      "(SELECT count(*) FROM public.workspace_staff_memberships)::int AS \"staffMemberships\", " +
      "(SELECT count(*) FROM public.workspace_client_project_grants)::int AS \"clientGrants\", " +
      "(SELECT count(*) FROM public.workspace_staff_project_grants)::int AS \"staffGrants\", " +
      "(SELECT count(*) FROM public.workspace_enrollment_attempts)::int AS \"enrollmentAttempts\", " +
      "(SELECT count(*) FROM public.workspace_milestones)::int AS milestones, " +
      "(SELECT count(*) FROM public.workspace_progress_updates)::int AS \"progressUpdates\", " +
      "(SELECT count(*) FROM public.workspace_audit_events)::int AS audits"
    )).rows[0];
    const projects = (await client.query(
      "SELECT id::text AS id, tenant_id::text AS \"tenantId\" " +
      "FROM public.workspace_projects ORDER BY id")).rows;
    return {
      ...counts,
      projectIds: projects.map(row => row.id),
      tenantIds: projects.map(row => row.tenantId),
    };
  } finally {
    await client.query("COMMIT");
  }
}

function assertSnapshot(actual, tenantId) {
  const expected = expectedSnapshot(tenantId);
  const normalized = {
    ...actual,
    projectIds: actual.projectIds,
  };
  delete normalized.tenantIds;
  if (JSON.stringify(normalized) !== JSON.stringify(expected)) {
    throw Error("Signed RLS tenant snapshot did not match its synthetic fixture");
  }
  if (actual.tenantIds.length !== 1 || actual.tenantIds[0] !== tenantId) {
    throw Error("A project from another synthetic tenant was visible");
  }
}

async function assertEmptyWithoutContext(client) {
  const result = await client.query(
    "SELECT public.cw_workspace_context_tenant_id()::text AS tenant, " +
    "(SELECT count(*) FROM public.workspace_projects)::int AS projects, " +
    "(SELECT count(*) FROM public.workspace_tenants)::int AS tenants");
  const row = result.rows[0];
  if (row.tenant !== null || row.projects !== 0 || row.tenants !== 0) {
    throw Error("Transaction-local tenant context leaked or an unsigned scope was accepted");
  }
}

async function expectDenied(client, sql) {
  try {
    await client.query(sql);
  } catch {
    return;
  }
  throw Error("The restricted runtime login performed a forbidden operation");
}

async function verifyRoleAndPrivateData(client) {
  const { rows } = await client.query(
    "SELECT current_user AS role, session_user AS \"sessionUser\", " +
    "r.rolcanlogin, r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls, " +
    "pg_has_role(current_user,'cw_runtime','USAGE') AS runtime, " +
    "pg_has_role(current_user,'cw_schema_owner','USAGE') AS owner, " +
    "pg_has_role(current_user,'cw_audit_writer','USAGE') AS audit, " +
    "has_database_privilege(current_user,'digipants_auth_prod','CONNECT') AS authConnect " +
    "FROM pg_catalog.pg_roles r WHERE r.rolname=current_user");
  const role = rows[0];
  if (rows.length !== 1 || role.role !== "cw_pooler_acceptance" ||
      role.sessionUser !== role.role || !role.rolcanlogin || !role.runtime ||
      role.rolsuper || role.rolcreaterole || role.rolcreatedb || role.rolbypassrls ||
      role.owner || role.audit || role.authConnect) {
    throw Error("The pooled identity is not an isolated restricted runtime login");
  }
  await expectDenied(client,
    "SELECT signing_key FROM public.workspace_context_signing_keys");
  await expectDenied(client,
    "SELECT invitation_token_hash FROM public.workspace_invitation_records");
  await expectDenied(client,
    "INSERT INTO public.workspace_audit_events " +
    "(tenant_id,project_id,origin,action,object_type,object_id,idempotency_key) " +
    "VALUES ('" + TENANT_A + "','" + PROJECT_A + "','system','forged','test','x','forged-audit')");
  await expectDenied(client,
    "UPDATE public.workspace_audit_events SET action='tampered' " +
    "WHERE idempotency_key='fixture-tenant-a'");
  await expectDenied(client,
    "DELETE FROM public.workspace_audit_events WHERE idempotency_key='fixture-tenant-a'");
  await expectDenied(client,
    "CREATE TABLE public.cw_pooler_forbidden_ddl(id integer)");
  await expectDenied(client, "SET ROLE cw_schema_owner");
  await expectDenied(client, "SET ROLE cw_audit_writer");
}

async function verifyScopedAuthorization(client, expectStaffRevoked) {
  const active = await snapshot(client, TENANT_A);
  assertSnapshot(active, TENANT_A);
  const staffContext = { tenantId: TENANT_A, projectId: PROJECT_A,
    actorSubject: "synthetic-security-staff-a", purpose: "delivery.edit" };
  await beginContext(client, staffContext);
  try {
    const staff = await client.query(
      "SELECT public.cw_lock_staff_project_grant($1,$2::uuid,$3::uuid,'delivery.edit')::text AS id",
      ["synthetic-security-staff-a", TENANT_A, PROJECT_A]);
    const expectedStaff = expectStaffRevoked ? null : "33333333-3333-4333-8333-333333333333";
    if (staff.rows[0]?.id !== expectedStaff) {
      throw Error("Staff grant active/revoked state did not match the acceptance phase");
    }
    const wrongTenant = await client.query(
      "SELECT public.cw_lock_staff_project_grant($1,$2::uuid,$3::uuid,'delivery.edit')::text AS id",
      ["synthetic-security-staff-b", TENANT_B, PROJECT_B]);
    if (wrongTenant.rows[0]?.id !== null) {
      throw Error("A signed tenant context authorized a foreign project");
    }
  } finally {
    await client.query("ROLLBACK");
  }

  const b = await snapshot(client, TENANT_B);
  assertSnapshot(b, TENANT_B);
  await beginContext(client, { tenantId: TENANT_B, projectId: PROJECT_B,
    actorSubject: "99999999-9999-4999-8999-999999999999",
    purpose: "project.read_published" });
  try {
    const clientGrant = await client.query(
      "SELECT public.cw_lock_client_project_grant($1,$2::uuid,$3::uuid,'project.read_published')::text AS id",
      ["99999999-9999-4999-8999-999999999999", TENANT_B, PROJECT_B]);
    if (clientGrant.rows[0]?.id !== "cccccccc-cccc-4ccc-8ccc-cccccccccccc") {
      throw Error("The exact synthetic client grant did not authorize its own tenant");
    }
  } finally {
    await client.query("ROLLBACK");
  }
}

async function verifyContextFailureModes(client) {
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT set_config('app.workspace_tenant_id',$1,true)", [TENANT_A]);
    const unsigned = await client.query(
      "SELECT count(*)::int AS count FROM public.workspace_projects");
    if (unsigned.rows[0].count !== 0) throw Error("An unsigned tenant GUC granted access");
  } finally {
    await client.query("ROLLBACK");
  }

  try {
    const context = { tenantId: TENANT_A, projectId: PROJECT_A,
      actorSubject: "synthetic-security-staff-a", purpose: "delivery.edit" };
    const { token } = await beginContext(client, context);
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    await client.query(
      "SELECT set_config('app.workspace_context_token',$1,true)", [tampered]);
    const result = await client.query(
      "SELECT count(*)::int AS count FROM public.workspace_projects");
    if (result.rows[0].count !== 0) throw Error("A tampered signature granted access");
  } finally {
    await client.query("ROLLBACK");
  }

  const context = { tenantId: TENANT_A, projectId: PROJECT_A,
    actorSubject: "synthetic-security-staff-a", purpose: "delivery.edit" };
  const { token } = await beginContext(client, context);
  await client.query("COMMIT");
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT set_config('app.workspace_tenant_id',$1,true), " +
      "set_config('app.workspace_context_token',$2,true)",
      [TENANT_A, token]);
    const replay = await client.query(
      "SELECT count(*)::int AS count FROM public.workspace_projects");
    if (replay.rows[0].count !== 0) throw Error("A token replayed across transactions was accepted");
  } finally {
    await client.query("ROLLBACK");
  }
}

async function verifyConcurrentContexts(pool) {
  let arrivals = 0;
  let open;
  const barrier = new Promise(resolve => { open = resolve; });
  async function read(tenantId) {
    const client = await pool.connect();
    try {
      const context = tenantId === TENANT_A
        ? { tenantId: TENANT_A, projectId: PROJECT_A,
            actorSubject: "synthetic-security-staff-a", purpose: "delivery.edit" }
        : { tenantId: TENANT_B, projectId: PROJECT_B,
            actorSubject: "99999999-9999-4999-8999-999999999999",
            purpose: "project.read_published" };
      await beginContext(client, context);
      arrivals++;
      if (arrivals === 2) open();
      await barrier;
      const rows = (await client.query(
        "SELECT id::text AS id, tenant_id::text AS tenant " +
        "FROM public.workspace_projects ORDER BY id")).rows;
      await client.query("COMMIT");
      if (rows.length !== 1 || rows[0].tenant !== tenantId) {
        throw Error("Concurrent pooled transactions crossed tenant context");
      }
      return rows[0].id;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  const [a, b] = await Promise.all([read(TENANT_A), read(TENANT_B)]);
  if (a !== PROJECT_A || b !== PROJECT_B) {
    throw Error("Concurrent tenant-scoped reads returned the wrong synthetic projects");
  }
}

export async function runAcceptance({
  poolerUrl, makePool = pg.Pool,
  verifyClientTls = assertVerifiedPooledTlsSocket,
}) {
  let stage = "configuration";
  let pool;
  let client;
  try {
    if (process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED !== "1") {
      throw Error("Disposable Neon pooler acceptance must be explicitly enabled");
    }
    if (process.env.WORKSPACE_POOLER_TEST_BRANCH_ID !== CHILD_BRANCH_ID ||
        process.env.WORKSPACE_POOLER_LIVE_BRANCH_ID !== LIVE_BRANCH_ID ||
        process.env.WORKSPACE_POOLER_TEST_DATABASE !== CHILD_DATABASE ||
        process.env.WORKSPACE_POOLER_TEST_TENANT_A !== TENANT_A ||
        process.env.WORKSPACE_POOLER_TEST_TENANT_B !== TENANT_B) {
      throw Error("The disposable child identity does not match the reviewed test target");
    }
    stage = "pooled URL validation";
    const uri = assertPooledNeonUrl(poolerUrl);
    pool = new makePool({
      host: uri.hostname, port: uri.port ? Number(uri.port) : 5432,
      database: CHILD_DATABASE, user: decodeURIComponent(uri.username),
      password: decodeURIComponent(uri.password),
      ssl: { servername: uri.hostname, rejectUnauthorized: true, checkServerIdentity },
      max: 3, connectionTimeoutMillis: 7000, query_timeout: 12000,
      idleTimeoutMillis: 5000, application_name: "cw_neon_clone_acceptance",
    });

    stage = "pool connection";
    client = await pool.connect();
    stage = "client-to-pooler TLS authentication";
    if (verifyClientTls(client, uri.hostname) !== true) {
      throw Error("Client-to-pooler certificate verification was not affirmative");
    }
    stage = "restricted role and private-data checks";
    await verifyRoleAndPrivateData(client);
    stage = "transaction context reset";
    await assertEmptyWithoutContext(client);
    stage = "unsigned, tampered, and replayed context rejection";
    await verifyContextFailureModes(client);
    stage = "signed tenant isolation and grant scope";
    await verifyScopedAuthorization(client,
      process.env.WORKSPACE_POOLER_EXPECT_STAFF_REVOKED === "1");
    stage = "concurrent pooled tenant isolation";
    await verifyConcurrentContexts(pool);
    stage = "final transaction context reset";
    await assertEmptyWithoutContext(client);
    return Object.freeze({
      directClonePoolerTlsVerified: true,
      restrictedRuntimeLogin: true,
      keyAndInvitationRecordsPrivate: true,
      signedTenantIsolationAcrossTables: true,
      transactionContextReset: true,
      tamperReplayAndUnsignedGucDenied: true,
      concurrentTenantContextsIsolated: true,
      staffGrantRevocationObserved:
        process.env.WORKSPACE_POOLER_EXPECT_STAFF_REVOKED === "1",
      clientGrantScopeVerified: true,
      auditAndSchemaMutationDenied: true,
    });
  } catch (error) {
    const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,32}$/.test(error.code)
      ? error.code : "validation";
    process.stderr.write("Restricted Neon clone acceptance failed at " +
      stage + " (code " + code + "); details suppressed.\n");
    throw error;
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAcceptance({
    poolerUrl: process.env.WORKSPACE_POOLER_TEST_URL,
  }).then(result => {
    process.stdout.write(JSON.stringify(result) + "\n");
  }).catch(() => {
    process.stderr.write(
      "Restricted Neon clone acceptance failed; connection and SQL details suppressed.\n");
    process.exitCode = 1;
  });
}