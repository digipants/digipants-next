import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPooledNeonUrl,assertVerifiedPooledTlsSocket,runAcceptance,
} from "../scripts/neon-pooler-acceptance.mjs";

const pooled="postgresql://cw_runtime_ci:synthetic_pw@ep-safe-pooler.c-2.us-east-2.aws.neon.tech/digipants_workspace_dev?sslmode=verify-full";
const tenantA="11111111-1111-4111-8111-111111111111";
const tenantB="22222222-2222-4222-8222-222222222222";

test("Pooled acceptance refuses direct, privileged, malformed and insecure connection strings",()=>{
  assert.ok(assertPooledNeonUrl(pooled).hostname.includes("-pooler."));
  const invalid=[
    pooled.replace("-pooler.","-direct."),
    pooled.replace(".neon.tech",".evil.invalid"),
    pooled.replace("verify-full","require"),
    pooled.replace("?sslmode=verify-full",""),
    pooled+"&host=attacker.invalid",
    pooled.replace("cw_runtime_ci","postgres_admin"),
    pooled.replace("digipants_workspace_dev","production"),
    pooled.replace("postgresql://","http://"),
    pooled.replace(".neon.tech/",".neon.tech:5433/"),
    "postgresql://cw_runtime_ci:secret@localhost/digipants_workspace_dev?sslmode=verify-full",
    pooled+"#fragment",
    "",
  ];
  for(const value of invalid)
    assert.throws(()=>assertPooledNeonUrl(value));
});
test("Backend SQL or a fake encrypted socket does not count as client-to-pooler TLS",()=>{
  const hostname=assertPooledNeonUrl(pooled).hostname;
  assert.throws(()=>assertVerifiedPooledTlsSocket({
    connection:{stream:{encrypted:true,authorized:true,authorizationError:null,
      getPeerCertificate:()=>({subjectaltname:"DNS:"+hostname})}},
  },hostname));
  assert.throws(()=>assertVerifiedPooledTlsSocket({},hostname));
});

function mockPoolFactory(state){
  return class MockPool{
    constructor(config){
      state.configuration=config;
      assert.equal("connectionString" in config,false,
        "URL query options must never overwrite explicit TLS config");
      assert.equal(config.ssl.rejectUnauthorized,true);
      assert.equal(config.ssl.servername,"ep-safe-pooler.c-2.us-east-2.aws.neon.tech");
      assert.equal(typeof config.ssl.checkServerIdentity,"function");
      assert.equal(config.user,"cw_runtime_ci");
      assert.equal(config.database,"digipants_workspace_dev");
    }
    async connect(){
      return {connection:{stream:{simulated:true}},query:async(sql,args=[])=>{
        const s=String(sql).trim();
        if(s==="BEGIN"){state.inside=true;return {rows:[]};}
        if(s==="COMMIT"||s==="ROLLBACK"){
          state.inside=false;state.scope=null;return {rows:[]};
        }
        if(s.includes("set_config(")){
          assert.equal(state.inside,true);
          state.scope=args[0];
          return {rows:[]};
        }
        if(s.includes("FROM pg_roles"))
          return {rows:[{role:"cw_runtime_ci",sessionUser:"cw_runtime_ci",
            rolcanlogin:true,rolsuper:false,rolcreaterole:false,
            rolcreatedb:false,rolbypassrls:false,runtimeGrant:true}]};
        if(s.includes("has_table_privilege"))
          return {rows:[{canRead:true,canInvite:state.forgeInvitation??false,
            canForgeAudit:false,canCreate:false}]};
        if(s.includes("FROM public.workspace_projects")){
          state.seen++;
          return {rows:state.scope?[{
            id:state.scope===tenantA?"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            tenantId:state.spoofTenant??state.scope,
          }]:[]};
        }
        throw Error("Unexpected SQL fixture");
      },release:()=>{state.released=true}};
    }
    async end(){state.closed=true;}
  };
}
test("Acceptance verifies restricted login and exact tenant reads with transaction resets",async()=>{
  const previous=process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED;
  process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED="1";
  const state={scope:null,inside:false,seen:0,closed:false,released:false,configuration:null};
  let tlsChecked=0;
  const verifyClientTls=(client,hostname)=>{
    assert.equal(client.connection.stream.simulated,true);
    assert.equal(hostname,"ep-safe-pooler.c-2.us-east-2.aws.neon.tech");
    tlsChecked++;
    return true; // The injected predicate is only used by the MOCK fixture.
  };
  try{
    const result=await runAcceptance({
      poolerUrl:pooled,tenantA,tenantB,
      makePool:mockPoolFactory(state),verifyClientTls,
    });
    assert.deepEqual(result,{
      clientPooledTlsVerified:true,restrictedRole:true,
      tenantScopeReset:true,exactTenantIsolation:true,
    });
    assert.equal(state.seen,5);
    assert.equal(state.closed,true);
    assert.equal(state.released,true);
    assert.equal(tlsChecked,1);
    assert.equal(state.scope,null);

    await assert.rejects(runAcceptance({
      poolerUrl:pooled,tenantA,tenantB:tenantA,
      makePool:mockPoolFactory(state),verifyClientTls,
    }));

    const badIdentity={scope:null,inside:false,seen:0,closed:false,forgeInvitation:true};
    await assert.rejects(runAcceptance({
      poolerUrl:pooled,tenantA,tenantB,
      makePool:mockPoolFactory(badIdentity),verifyClientTls,
    }),/privileges exceed/);

    const wrongTenant={scope:null,inside:false,seen:0,closed:false,spoofTenant:tenantB};
    await assert.rejects(runAcceptance({
      poolerUrl:pooled,tenantA,tenantB,
      makePool:mockPoolFactory(wrongTenant),verifyClientTls,
    }),/exactly isolated/);

    const noRealTls={scope:null,inside:false,seen:0,closed:false};
    await assert.rejects(runAcceptance({
      poolerUrl:pooled,tenantA,tenantB,makePool:mockPoolFactory(noRealTls),
    }),/not authenticated TLS/);
    assert.equal(noRealTls.seen,0,
      "a missing verified socket must abort BEFORE any data query");
  }finally{
    if(previous===undefined)delete process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED;
    else process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED=previous;
  }
});
