import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const RUN = process.env.RUN_WORKSPACE_PGBOUNCER === "1";
const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const projectA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function requireDisposablePoolerUrl() {
  const raw = process.env.WORKSPACE_PGBOUNCER_TEST_URL;
  if (!raw) throw new Error("Missing disposable PgBouncer test URL.");
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== "127.0.0.1" || url.port !== "6432" ||
      url.pathname !== "/cw_installer_ci_db" ||
      url.username !== "cw_runtime_ci" || url.password !== "synthetic_runtime_pw" ||
      process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run on a non-disposable PostgreSQL connection.");
  }
  return raw;
}

if (!RUN) {
  test("real transaction pooler and runtime isolation (CI only)",
    { skip: "Requires explicit disposable PgBouncer fixture." }, () => {});
} else {
  const connectionString = requireDisposablePoolerUrl();
  const pool = new pg.Pool({
    connectionString,
    max: 6,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 3000,
  });
  // Never log connection strings, SQL parameters, authenticated cookies or
  // credentials. All identities and passwords here are disposable fixtures.
  const countProjects = async (client) => {
    const response = await client.query(
      "SELECT tenant_id::text AS tenant_id, id::text AS id FROM workspace_projects ORDER BY id");
    return response.rows;
  };
  async function scopedRead(tenantId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT set_config('app.workspace_tenant_id', $1, true)", [tenantId]);
      const rows = await countProjects(client);
      const backend = await client.query("SELECT pg_backend_pid()::int AS pid");
      await client.query("COMMIT");
      return { rows, pid: backend.rows[0].pid };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async function denySql(client, sql) {
    await assert.rejects(client.query(sql), /permission denied|must be owner|not authorized/i);
  }
  test("real PgBouncer transaction mode reuses server backends without tenant leakage", async (t) => {
    t.after(async () => { await pool.end(); });
    let ready = false;
    for (let attempt = 0; attempt < 35; attempt += 1) {
      try { await pool.query("SELECT 1"); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    assert.equal(ready, true, "disposable PgBouncer must accept an authenticated runtime connection");

    const identity = await pool.query(
      "SELECT current_user::text AS login, " +
      "(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass, " +
      "(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser, " +
      "(SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS can_create_roles");
    assert.deepEqual(identity.rows[0], {
      login: "cw_runtime_ci", bypass: false, superuser: false, can_create_roles: false,
    });
    const role = await pool.query("SELECT pg_has_role(current_user,'cw_runtime','USAGE') AS inherited");
    assert.equal(role.rows[0]?.inherited, true, "login must inherit only the minimal runtime role");

    const first = await scopedRead(tenantA);
    assert.deepEqual(first.rows, [{ tenant_id: tenantA, id: projectA }]);
    // A new transaction, even from a reused PgBouncer backend, must begin with
    // no RLS tenant context; no session-level tenant setting is allowed.
    const missing = await pool.query(
      "SELECT count(*)::int AS n, NULLIF(current_setting('app.workspace_tenant_id',true),'') AS ctx FROM workspace_projects");
    assert.equal(missing.rows[0].n, 0);
    assert.equal(missing.rows[0].ctx, null);
    const second = await scopedRead(tenantB);
    assert.deepEqual(second.rows, [{ tenant_id: tenantB, id: projectB }]);
    const third = await scopedRead(tenantA);
    assert.deepEqual(third.rows, first.rows);

    // Default pool size is 1: the actual backend PID must be reused across
    // different client transactions. This is not a mocked PgBouncer connection.
    assert.equal(first.pid, second.pid);
    assert.equal(second.pid, third.pid);

    for (let index = 0; index < 12; index += 1) {
      const noContext = await pool.query(
        "SELECT count(*)::int AS n FROM workspace_projects");
      assert.equal(noContext.rows[0].n, 0, "tenant context must reset after each transaction");
      const selected = await scopedRead(index % 2 === 0 ? tenantA : tenantB);
      assert.deepEqual(selected.rows, index % 2 === 0
        ? [{ tenant_id: tenantA, id: projectA }]
        : [{ tenant_id: tenantB, id: projectB }]);
    }

    const rolledBack = await pool.connect();
    try {
      await rolledBack.query("BEGIN");
      await rolledBack.query(
        "SELECT set_config('app.workspace_tenant_id', $1, true)", [tenantB]);
      assert.equal((await countProjects(rolledBack)).length, 1);
      await rolledBack.query("ROLLBACK");
    } finally { rolledBack.release(); }
    assert.equal((await pool.query(
      "SELECT count(*)::int AS n FROM workspace_projects")).rows[0].n, 0);

    const client = await pool.connect();
    try {
      await denySql(client, "SELECT invitation_token_hash FROM workspace_invitation_records");
      await denySql(client, "CREATE TABLE public.pooled_runtime_forbidden (id integer)");
      await denySql(client,
        "INSERT INTO workspace_audit_events (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key) " +
        "VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', " +
        "'system', 'forgery', 'workspace_project', 'x', 'pooler-denied')");
    } finally { client.release(); }

    // RESIDUAL SECURITY GAP (deliberate proof of a real issue, NOT a pass):
    // the session-level tenant GUC is caller-controlled. A SQL caller with
    // legitimate runtime credentials can set the other tenant's context.
    // Production must therefore authenticate and authorize the verified
    // subject+project before any SQL, and guard against SQL injection.
    const spoof = await scopedRead(tenantB);
    assert.deepEqual(spoof.rows, [{ tenant_id: tenantB, id: projectB }]);
    const forgedSubject = await pool.query(
      "SELECT cw_lock_staff_project_grant($1,$2::uuid,$3::uuid,$4)::text AS actor",
      ["synthetic-security-staff-a",tenantA,projectA,"delivery.edit"]);
    assert.equal(forgedSubject.rows[0]?.actor,
      "33333333-3333-4333-8333-333333333333",
      "definer function is not proof of caller session or identity");
  });
}
