import { fileURLToPath } from "node:url";
import pg from "pg";

const DEMO_DB = "digipants_workspace_dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * An intentionally read-only acceptance check. It MUST refuse a direct
 * endpoint, privileged login, production database, local Postgres and
 * TLS without full CA/hostname verification. It never logs credentials.
 */
export function assertPooledNeonUrl(value) {
  if(typeof value!=="string"||value.length>2000)throw Error("Missing/invalid pooled URL");
  let uri;
  try{uri=new URL(value);}catch{throw Error("Malformed connection URL");}
  if(!["postgres:","postgresql:"].includes(uri.protocol)||
    !uri.hostname.endsWith(".neon.tech")||
    !uri.hostname.includes("-pooler.")||
    uri.pathname!=="/"+DEMO_DB||
    !uri.username||!uri.password||
    uri.hash)throw Error("Expected a restricted Neon pooled development connection");
  if(uri.username.toLowerCase().includes("admin")||
     uri.username.toLowerCase().includes("owner"))
    throw Error("Administrative connection is prohibited");
  if(uri.searchParams.has("sslmode") &&
     uri.searchParams.get("sslmode")!=="verify-full")
    throw Error("Only full TLS hostname verification accepted");
  return uri;
}

function rowsFromQuery(result) {
  return result?.rows??[];
}
export async function runAcceptance({poolerUrl,tenantA,tenantB,makePool}) {
  if(process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED!=="1")
    throw Error("Explicit disposable pooled acceptance flag missing");
  assertPooledNeonUrl(poolerUrl);
  if(!UUID.test(tenantA)||!UUID.test(tenantB)||
    tenantA.toLowerCase()===tenantB.toLowerCase())
    throw Error("Two distinct synthetic tenant IDs are required");
  const Pool=makePool??pg.Pool;
  const pool=new Pool({
    connectionString:poolerUrl,
    max:1,
    connectionTimeoutMillis:5000,
    query_timeout:10000,
    idleTimeoutMillis:5000,
    ssl:{rejectUnauthorized:true},
    application_name:"cw_neon_pooled_acceptance",
  });
  let client;
  try{
    client=await pool.connect();
    const {rows:roles}=await client.query(`
      SELECT current_user AS "role",
        rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
      FROM pg_roles WHERE rolname=current_user
    `);
    if(roles.length!==1 || !roles[0].rolcanlogin || roles[0].rolsuper||
       roles[0].rolcreaterole||roles[0].rolcreatedb||roles[0].rolbypassrls)
       throw Error("Runtime role has excess privileges");
    const tls=rowsFromQuery(await client.query(
      "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    ))[0];
    if(tls?.ssl!==true)throw Error("TLS is not active on the pooled connection");
    const grants=rowsFromQuery(await client.query(`
      SELECT
       has_table_privilege(current_user,'public.workspace_projects','SELECT') AS can_read,
       has_table_privilege(current_user,'public.workspace_projects','UPDATE') AS can_write,
       has_table_privilege(current_user,'public.workspace_invitation_records','SELECT') AS can_invite,
       has_schema_privilege(current_user,'public','CREATE') AS can_create
    `))[0];
    if(!grants?.can_read||grants?.can_invite||grants?.can_create)
      throw Error("Hosted runtime privileges do not match review contract");
    // Project state UPDATE may be granted for carefully controlled staff
    // operations, so don't infer authorization from this privilege alone.
    async function visible(tenant){
      await client.query("BEGIN");
      try{
        if(tenant)await client.query(
          "SELECT set_config('app.workspace_tenant_id',$1,true)",[tenant]
        );
        const result=await client.query(
          "SELECT count(*)::integer AS n FROM public.workspace_projects"
        );
        await client.query("COMMIT");
        return result.rows[0].n;
      }catch(error){
        await client.query("ROLLBACK").catch(()=>{});
        throw error;
      }
    }
    // Query the same pooled frontend in four transactions. An untrusted
    // SET LOCAL must never persist into the next transaction.
    if((await visible(null))!==0)throw Error("Default tenant scope leaked");
    const a=await visible(tenantA);
    if((await visible(null))!==0)throw Error("Tenant A context persisted");
    const b=await visible(tenantB);
    if((await visible(null))!==0)throw Error("Tenant B context persisted");
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||b<1)
      throw Error("Expected two populated synthetic tenant fixtures");
    return {pooledTls:true,restrictedRole:true,tenantReset:true,
      independentTenantReads:true};
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
    process.stderr.write("Neon pooled development acceptance failed (no secret details logged).\n");
    process.exitCode=1;
  });
}
