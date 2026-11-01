import { fileURLToPath } from "node:url";
import { checkServerIdentity, TLSSocket } from "node:tls";
import pg from "pg";

const DEMO_DB = "digipants_workspace_dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A read-only acceptance test for an explicitly disposable Neon child.
 * No production DB, direct hostname, privileged login, insecure TLS mode,
 * custom connection options or unsupported ports are accepted.
 */
export function assertPooledNeonUrl(value) {
  if(typeof value!=="string" || value.length>2000)
    throw Error("Missing or invalid pooled development URL");
  let uri;
  try{uri=new URL(value);}catch{throw Error("Malformed pooled development URL");}
  if(!["postgres:","postgresql:"].includes(uri.protocol) ||
    !/^ep-[a-z0-9-]+-pooler\.c-\d+\.[a-z0-9-]+\.aws\.neon\.tech$/i.test(uri.hostname) ||
    uri.pathname!=="/"+DEMO_DB || !uri.username || !uri.password ||
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
  poolerUrl,tenantA,tenantB,makePool,verifyClientTls=assertVerifiedPooledTlsSocket,
}) {
  if(process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED!=="1")
    throw Error("Disposable pooled acceptance must be explicitly enabled");
  const uri=assertPooledNeonUrl(poolerUrl);
  if(!UUID.test(tenantA)||!UUID.test(tenantB)||
      tenantA.toLowerCase()===tenantB.toLowerCase())
    throw Error("Two distinct synthetic tenant IDs are required");
  if(typeof verifyClientTls!=="function")
    throw Error("Client TLS inspection is mandatory");

  // Do NOT pass connectionString alongside ssl. node-postgres's URL parser
  // may override explicit TLS options when sslmode is present in the URL.
  const Pool=makePool??pg.Pool;
  const pool=new Pool({
    host:uri.hostname,
    port:uri.port?Number(uri.port):5432,
    database:DEMO_DB,
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
        has_schema_privilege(current_user,'public','CREATE') AS "canCreate"
    `)).rows[0];
    if(!grants?.canRead||grants.canInvite||grants.canForgeAudit||grants.canCreate)
      throw Error("Hosted runtime privileges exceed the narrow review contract");

    async function visible(tenant){
      await client.query("BEGIN");
      try{
        if(tenant)await client.query(
          "SELECT set_config('app.workspace_tenant_id',$1,true)",[tenant]);
        const result=await client.query(
          "SELECT id::text AS id, tenant_id::text AS \"tenantId\" FROM public.workspace_projects ORDER BY id"
        );
        await client.query("COMMIT");
        return result.rows;
      }catch{
        await client.query("ROLLBACK").catch(()=>{});
        throw Error("Tenant-scoped pooled read failed");
      }
    }
    const empty=async()=> {
      if((await visible(null)).length!==0)
        throw Error("A transaction leaked its tenant scope");
    };
    await empty();
    const a=await visible(tenantA);
    await empty();
    const b=await visible(tenantB);
    await empty();
    if(a.length!==1||b.length!==1||
       a[0].tenantId!==tenantA ||b[0].tenantId!==tenantB||
       a[0].id===b[0].id)
      throw Error("Synthetic tenants did not remain exactly isolated");
    return Object.freeze({
      clientPooledTlsVerified:true,restrictedRole:true,
      tenantScopeReset:true,exactTenantIsolation:true,
    });
  }finally{
    if(client)client.release();
    await pool.end();
  }
}

if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  runAcceptance({
    poolerUrl:process.env.WORKSPACE_POOLER_TEST_URL,
    tenantA:process.env.WORKSPACE_POOLER_TEST_TENANT_A,
    tenantB:process.env.WORKSPACE_POOLER_TEST_TENANT_B,
  }).then(result=>{
    process.stdout.write(JSON.stringify(result)+"\n");
  }).catch(()=>{
    // Deliberately avoid dumping database URLs, TLS peer details or SQL.
    process.stderr.write("Restricted Neon pooled-TLS acceptance failed; no credentials logged.\n");
    process.exitCode=1;
  });
}
