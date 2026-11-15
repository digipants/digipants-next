import { createHmac, randomBytes } from "node:crypto";
import { checkServerIdentity, TLSSocket } from "node:tls";
import pg from "pg";

const CHILD_BRANCH = "br-restless-sound-zamshub1";
const LIVE_BRANCH = "br-floral-shadow-zapa2jbz";
const POOLER_HOST = "ep-morning-boat-zax42wmd-pooler.c-2.eu-west-2.aws.neon.tech";
const DATABASE = "digipants_workspace_prod";
const TABLES = [
  "workspace_tenants",
  "workspace_projects",
  "workspace_principals",
  "workspace_client_memberships",
  "workspace_staff_memberships",
  "workspace_client_project_grants",
  "workspace_staff_project_grants",
  "workspace_enrollment_attempts",
  "workspace_milestones",
  "workspace_progress_updates",
  "workspace_audit_events",
];

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

function assertPoolerUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Missing or malformed pooled URL"); }
  const keys = [...url.searchParams.keys()];
  requireCheck(["postgres:", "postgresql:"].includes(url.protocol), "Unsupported DB URL scheme");
  requireCheck(url.hostname === POOLER_HOST, "URL is not pinned to this disposable clone pooler");
  requireCheck(url.pathname === "/" + DATABASE, "Unexpected database in pooled URL");
  requireCheck(decodeURIComponent(url.username) === "cw_workspace_prod_app", "Unexpected pooled login role");
  requireCheck(decodeURIComponent(url.password).length >= 16, "Pooled login password is missing");
  requireCheck(!url.hash && (!url.port || url.port === "5432"), "Unexpected URL fragment or port");
  requireCheck(url.searchParams.get("sslmode") === "verify-full", "TLS hostname verification is required");
  requireCheck(url.searchParams.get("channel_binding") === "require", "TLS channel binding is required");
  requireCheck(keys.length === 2 && keys.every(key => key === "sslmode" || key === "channel_binding"),
    "Unexpected pooled URL options");
  return url;
}

function assertClientTls(client, hostname) {
  const stream = client?.connection?.stream;
  requireCheck(stream instanceof TLSSocket && stream.encrypted === true &&
    stream.authorized === true && !stream.authorizationError,
    "Client-to-pooler TLS is not authenticated");
  const certificate = stream.getPeerCertificate(true);
  requireCheck(certificate && typeof certificate === "object" &&
    (certificate.subjectaltname || certificate.subject?.CN) &&
    !checkServerIdentity(hostname, certificate),
    "Pooled TLS certificate does not match the pinned Neon host");
}

async function visibleCounts(client) {
  const sql = "SELECT " + TABLES.map(
    (table, index) => `(SELECT count(*) FROM public.${table})::int AS t${index}`,
  ).join(", ");
  const row = (await client.query(sql)).rows[0];
  return Object.values(row).map(Number);
}

function forgedToken({ transactionId, tenantId, projectId }) {
  const payload = Buffer.from([
    "v1", transactionId, tenantId, projectId, "runtime-role-smoke", "project.read_published",
  ].join("|"), "utf8");
  const signature = createHmac("sha256", randomBytes(32)).update(payload).digest("hex");
  return payload.toString("hex") + "." + signature;
}

async function assertNoRowsWithoutSignedScope(client, tenantId, projectId) {
  await client.query("BEGIN READ ONLY");
  try {
    const { rows } = await client.query("SELECT pg_current_xact_id()::text AS xid");
    const token = forgedToken({ transactionId: rows[0].xid, tenantId, projectId });
    await client.query(
      "SELECT set_config('app.workspace_tenant_id',$1,true), " +
      "set_config('app.workspace_context_token',$2,true)",
      [tenantId, token],
    );
    const counts = await visibleCounts(client);
    requireCheck(counts.every(count => count === 0),
      "Forged tenant context exposed Workspace rows");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const child = process.env.WORKSPACE_POOLER_TEST_BRANCH_ID;
  const live = process.env.WORKSPACE_POOLER_LIVE_BRANCH_ID;
  requireCheck(child === CHILD_BRANCH && live === LIVE_BRANCH && child !== live,
    "Distinct pinned disposable and production branch IDs are required");

  const uri = assertPoolerUrl(process.env.WORKSPACE_POOLER_TEST_URL);
  const pool = new pg.Pool({
    host: uri.hostname,
    port: uri.port ? Number(uri.port) : 5432,
    database: DATABASE,
    user: decodeURIComponent(uri.username),
    password: decodeURIComponent(uri.password),
    ssl: { servername: uri.hostname, rejectUnauthorized: true, checkServerIdentity },
    max: 1,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    idleTimeoutMillis: 5000,
    application_name: "cw_production_runtime_role_smoke",
  });

  let client;
  try {
    client = await pool.connect();
    assertClientTls(client, uri.hostname);

    const identity = (await client.query(`
      SELECT current_user AS login, session_user AS session_login,
        current_database() AS database, r.rolcanlogin, r.rolsuper,
        r.rolcreaterole, r.rolcreatedb, r.rolbypassrls,
        pg_has_role(current_user,'cw_runtime','USAGE') AS runtime_grant,
        pg_has_role(current_user,'cw_schema_owner','USAGE') AS owner_grant,
        pg_has_role(current_user,'cw_audit_writer','USAGE') AS audit_grant
      FROM pg_catalog.pg_roles r WHERE r.rolname=current_user
    `)).rows[0];
    requireCheck(identity?.login === "cw_workspace_prod_app" &&
      identity.session_login === identity.login && identity.database === DATABASE &&
      identity.rolcanlogin && identity.runtime_grant &&
      !identity.rolsuper && !identity.rolcreaterole && !identity.rolcreatedb &&
      !identity.rolbypassrls && !identity.owner_grant && !identity.audit_grant,
      "Pooled login is not the restricted production runtime role");

    const privileges = (await client.query(`
      SELECT has_table_privilege(current_user,'public.workspace_projects','SELECT') AS project_read,
        has_table_privilege(current_user,'public.workspace_context_signing_keys','SELECT') AS signing_key_read,
        has_table_privilege(current_user,'public.workspace_invitation_records','SELECT') AS invitation_read,
        has_table_privilege(current_user,'public.workspace_tenants','INSERT') AS tenant_insert,
        has_table_privilege(current_user,'public.workspace_audit_events','INSERT') AS audit_insert,
        has_table_privilege(current_user,'public.workspace_audit_events','UPDATE') AS audit_update,
        has_table_privilege(current_user,'public.workspace_audit_events','DELETE') AS audit_delete
    `)).rows[0];
    requireCheck(privileges?.project_read && !privileges.signing_key_read &&
      !privileges.invitation_read && !privileges.tenant_insert &&
      !privileges.audit_insert && !privileges.audit_update && !privileges.audit_delete,
      "Runtime role privilege boundary does not match the reviewed contract");

    await client.query("BEGIN READ ONLY");
    const noContextCounts = await visibleCounts(client);
    await client.query("COMMIT");
    requireCheck(noContextCounts.every(count => count === 0),
      "Workspace rows were visible without a signed tenant context");

    await assertNoRowsWithoutSignedScope(
      client, "11111111-1111-4111-8111-111111111111",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    await assertNoRowsWithoutSignedScope(
      client, "22222222-2222-4222-8222-222222222222",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );

    process.stdout.write(
      "PASS: exact runtime role, verified pooled TLS, least-privilege grants, and no rows visible without valid signed tenant scope.\n",
    );
  } finally {
    if (client) await client.release();
    await pool.end();
  }
}

main().catch(error => {
  process.stderr.write("Runtime role smoke failed; details suppressed.\n");
  process.exitCode = 1;
});
