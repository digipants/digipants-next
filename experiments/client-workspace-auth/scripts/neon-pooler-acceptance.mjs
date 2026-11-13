import { fileURLToPath } from "node:url";
import { checkServerIdentity, TLSSocket } from "node:tls";
import { createHmac } from "node:crypto";
import pg from "pg";

const DEMO_DB = "digipants_workspace_dev";
const ALLOWED_TEST_DATABASES = new Set([DEMO_DB, "digipants_workspace_prod"]);
const LIVE_PRODUCTION_ENDPOINT_ID = "ep-late-morning-za8o4jl4";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A read-only acceptance test for an explicitly disposable Neon child.
 * No production DB, direct hostname, privileged login, insecure TLS mode,
 * custom connection options or unsupported ports are accepted.
 */
export function assertPooledNeonUrl(value, expectedDatabase = DEMO_DB) {
  if(!ALLOWED_TEST_DATABASES.has(expectedDatabase))
    throw Error("Only an explicit synthetic development or disposable production-clone database is allowed");
  if(typeof value!=="string" || value.length>2000)
    throw Error("Missing or invalid pooled development URL");
  let uri;
  try{uri=new URL(value);}catch{throw Error("Malformed pooled development URL");}
  if(!["postgres:","postgresql:"].includes(uri.protocol) ||
    !/^ep-[a-z0-9-]+-pooler\.c-\d+\.[a-z0-9-]+\.aws\.neon\.tech$/i.test(uri.hostname) ||
    uri.hostname.split("-pooler.")[0].toLowerCase()===LIVE_PRODUCTION_ENDPOINT_ID ||
    uri.pathname!=="/"+expectedDatabase || !uri.username || !uri.password ||
    uri.hash || (uri.port && uri.port!=="5432") ||
    uri.searchParams.size!==1 ||
    uri.searchParams.get("sslmode")!=="verify-full")
    throw Error("A restricted Neon pooled development URL with sslmode=verify-full is required");
  const user=decodeURIComponent(uri.username).toLowerCase();
  if(user.includes("admin") || user.includes("owner") || user==="postgres" ||
     user==="digipants_ws_dev")
    throw Error("Owner/admin database login is prohibited");
  return uri;
}

/**
 * pg_stat_ssl describes the PostgreSQL BACKEND connection. Behind a pooler
 * it does not establish whether the CLIENT-to-pooler connection used TLS.
 * Inspect the exact socket that node-postgres negotiated instead.
 */
export function assertVerifiedPooledTlsSocket(client, expectedHostname) {
  const stream=client?.connection?.stream;
  if(!(stream instanceof TLSSocket) ||
      stream.encrypted!==true || stream.authorized!==true ||
      stream.authorizationError)
    throw Error("The client-to-pooler socket is not authenticated TLS");
  const certificate=stream.getPeerCertificate(true);
  if(!certificate || typeof certificate!=="object" ||
      (!certificate.subjectaltname && !certificate.subject?.CN) ||
      checkServerIdentity(expectedHostname,certificate))
    throw Error("The pooled TLS peer certificate does not match the expected Neon hostname");
  return true;
}

export async function runAcceptance({
  poolerUrl,tenantA,tenantB,contextKey,makePool,verifyClientTls=assertVerifiedPooledTlsSocket,
  databaseName=DEMO_DB,testBranchId,productionBranchId,
}) {
  if(process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED!=="1")
    throw Error("Disposable pooled acceptance must be explicitly enabled");
  const uri=assertPooledNeonUrl(poolerUrl,databaseName);
  if(databaseName==="digipants_workspace_prod"&&
     (!/^br-[a-z0-9-]+$/i.test(testBranchId??"")||
      !/^br-[a-z0-9-]+$/i.test(productionBranchId??"")||
      testBranchId.toLowerCase()===productionBranchId.toLowerCase()))
    throw Error("A distinct verified disposable Neon branch ID is required for production-shaped acceptance");
  if(!UUID.test(tenantA)||!UUID.test(tenantB)||
      tenantA.toLowerCase()===tenantB.toLowerCase())
    throw Error("Two distinct synthetic tenant IDs are required");
  if(!Buffer.isBuffer(contextKey)||contextKey.byteLength!==32)
    throw Error("A dedicated 32-byte synthetic context signing key is required");
  if(typeof verifyClientTls!=="function")
    throw Error("Client TLS inspection is mandatory");

  // Do NOT pass connectionString alongside ssl. node-postgres's URL parser
  // may override explicit TLS options when sslmode is present in the URL.
  const Pool=makePool??pg.Pool;
  const pool=new Pool({
    host:uri.hostname,
    port:uri.port?Number(uri.port):5432,
    database:databaseName,
    user:decodeURIComponent(uri.username),
    password:decodeURIComponent(uri.password),
    ssl:{
      servername:uri.hostname,
      rejectUnauthorized:true,
      checkServerIdentity,
    },
    max:1,connectionTimeoutMillis:5000,query_timeout:10000,
    idleTimeoutMillis:5000,application_name:"cw_neon_pooled_acceptance",
  });
  let client;
  try{
    client=await pool.connect();
    if(verifyClientTls(client,uri.hostname)!==true)
      throw Error("Pooled socket TLS verification was not affirmative");

    const {rows:roles}=await client.query(`
      SELECT current_user AS "role", session_user AS "sessionUser",
        rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,
        pg_has_role(current_user,'cw_runtime','USAGE') AS "runtimeGrant"
      FROM pg_roles WHERE rolname=current_user
    `);
    if(roles.length!==1||roles[0].role!==decodeURIComponent(uri.username)||
       roles[0].sessionUser!==roles[0].role ||
       !roles[0].rolcanlogin||!roles[0].runtimeGrant||
       roles[0].rolsuper||roles[0].rolcreaterole||
       roles[0].rolcreatedb||roles[0].rolbypassrls)
      throw Error("The hosted login is not an independent restricted runtime role");

    const grants=(await client.query(`
      SELECT has_table_privilege(current_user,'public.workspace_projects','SELECT') AS "canRead",
        has_table_privilege(current_user,'public.workspace_invitation_records','SELECT') AS "canInvite",
        has_table_privilege(current_user,'public.workspace_audit_events','INSERT') AS "canForgeAudit",
        has_table_privilege(current_user,'public.workspace_context_signing_keys','SELECT') AS "canReadContextKey",
        has_table_privilege(current_user,'public.workspace_tenants','INSERT') AS "canCreateTenant",
        has_table_privilege(current_user,'public.workspace_audit_events','UPDATE') AS "canRewriteAudit",
        has_table_privilege(current_user,'public.workspace_audit_events','DELETE') AS "canDeleteAudit",
        has_table_privilege(current_user,'public.workspace_audit_events','TRUNCATE') AS "canTruncateAudit",
        has_schema_privilege(current_user,'public','CREATE') AS "canCreate"
    `)).rows[0];
    if(!grants?.canRead||grants.canInvite||grants.canForgeAudit||
       grants.canReadContextKey||grants.canCreateTenant||grants.canRewriteAudit||
       grants.canDeleteAudit||grants.canTruncateAudit||grants.canCreate)
      throw Error("Hosted runtime privileges exceed the narrow review contract");

    async function requirePrivilegeDenied(statement){
      await client.query("BEGIN");
      try{
        await client.query(statement);
        await client.query("ROLLBACK");
        throw Error("A privileged SQL probe unexpectedly succeeded");
      }catch(error){
        await client.query("ROLLBACK").catch(()=>{});
        if(error?.code!=="42501")
          throw Error("A privileged SQL probe was not denied by PostgreSQL");
      }
    }
    for(const statement of [
      "SELECT invitation_token_hash FROM public.workspace_invitation_records LIMIT 1",
      "SELECT signing_key FROM public.workspace_context_signing_keys LIMIT 1",
      "INSERT INTO public.workspace_tenants(id,legal_name) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Synthetic denied probe')",
      "INSERT INTO public.workspace_audit_events(tenant_id,project_id,origin,action,object_type,object_id,idempotency_key) VALUES ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','system','probe','workspace_project','probe','pooler-denial-probe')",
      "UPDATE public.workspace_audit_events SET object_id='probe' WHERE false",
      "DELETE FROM public.workspace_audit_events WHERE false",
      "TRUNCATE public.workspace_audit_events",
      "CREATE TABLE public.cw_pooler_acceptance_probe(id integer)",
    ]) await requirePrivilegeDenied(statement);

    const sensitiveCounts=async()=>{
      const {rows}=await client.query(`
        SELECT
          (SELECT count(*)::int FROM public.workspace_tenants) AS "tenants",
          (SELECT count(*)::int FROM public.workspace_principals) AS "principals",
          (SELECT count(*)::int FROM public.workspace_client_memberships) AS "clientMemberships",
          (SELECT count(*)::int FROM public.workspace_staff_memberships) AS "staffMemberships",
          (SELECT count(*)::int FROM public.workspace_client_project_grants) AS "clientGrants",
          (SELECT count(*)::int FROM public.workspace_staff_project_grants) AS "staffGrants",
          (SELECT count(*)::int FROM public.workspace_enrollment_attempts) AS "enrollmentAttempts"
      `);
      return rows[0];
    };

    async function visible(tenant){
      await client.query("BEGIN");
      try{
        if(tenant){
          const xid=(await client.query("SELECT pg_current_xact_id()::text AS xid")).rows[0]?.xid;
          if(typeof xid!=="string"||!/^\d{1,20}$/.test(xid))
            throw Error("Transaction context could not be bound");
          const payload=["v1",xid,tenant,"","","pooler.acceptance"].join("|");
          const bytes=Buffer.from(payload,"utf8");
          const token=`${bytes.toString("hex")}.${createHmac("sha256",contextKey).update(bytes).digest("hex")}`;
          await client.query(
            "SELECT set_config('app.workspace_tenant_id',$1,true), set_config('app.workspace_context_token',$2,true)",
            [tenant,token]);
        }
        const result=await client.query(
          "SELECT id::text AS id, tenant_id::text AS \"tenantId\" FROM public.workspace_projects ORDER BY id"
        );
        const identities=await sensitiveCounts();
        await client.query("COMMIT");
        return {projects:result.rows,identities};
      }catch{
        await client.query("ROLLBACK").catch(()=>{});
        throw Error("Tenant-scoped pooled read failed");
      }
    }
    const empty=async()=> {
      const snapshot=await visible(null);
      if(snapshot.projects.length!==0||Object.values(snapshot.identities).some(count=>count!==0))
        throw Error("A transaction leaked its tenant scope");
    };
    await empty();
    const a=await visible(tenantA);
    await empty();
    const b=await visible(tenantB);
    await empty();
    const expectedA={tenants:1,principals:2,clientMemberships:0,staffMemberships:2,
      clientGrants:0,staffGrants:2,enrollmentAttempts:0};
    const expectedB={tenants:1,principals:2,clientMemberships:1,staffMemberships:1,
      clientGrants:1,staffGrants:1,enrollmentAttempts:1};
    if(a.projects.length!==1||b.projects.length!==1||
       a.projects[0].tenantId!==tenantA ||b.projects[0].tenantId!==tenantB||
       a.projects[0].id===b.projects[0].id||
       JSON.stringify(a.identities)!==JSON.stringify(expectedA)||
       JSON.stringify(b.identities)!==JSON.stringify(expectedB))
      throw Error("Synthetic tenants did not remain exactly isolated");
    return Object.freeze({
      clientPooledTlsVerified:true,restrictedRole:true,
      tenantScopeReset:true,exactTenantIsolation:true,
      allSensitiveTablesIsolated:true,unauthorizedSqlDenied:true,
    });
  }finally{
    if(client)client.release();
    await pool.end();
  }
}

if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  runAcceptance({
    poolerUrl:process.env.WORKSPACE_POOLER_TEST_URL,
    databaseName:process.env.WORKSPACE_POOLER_TEST_DATABASE??DEMO_DB,
    testBranchId:process.env.WORKSPACE_POOLER_TEST_BRANCH_ID,
    productionBranchId:process.env.WORKSPACE_POOLER_LIVE_BRANCH_ID,
    tenantA:process.env.WORKSPACE_POOLER_TEST_TENANT_A,
    tenantB:process.env.WORKSPACE_POOLER_TEST_TENANT_B,
    contextKey:(()=>{
      const raw=process.env.WORKSPACE_RLS_CONTEXT_KEY;
      if(!raw||!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
      const key=Buffer.from(raw,"base64url");
      return key.byteLength===32&&key.toString("base64url")===raw?key:null;
    })(),
  }).then(result=>{
    process.stdout.write(JSON.stringify(result)+"\n");
  }).catch(()=>{
    // Deliberately avoid dumping database URLs, TLS peer details or SQL.
    process.stderr.write("Restricted Neon pooled-TLS acceptance failed; no credentials logged.\n");
    process.exitCode=1;
  });
}
