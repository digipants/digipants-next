import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPooledNeonUrl,runAcceptance,
} from "../scripts/neon-pooler-acceptance.mjs";

const pooled="postgresql://cw_runtime_ci:synthetic_pw@ep-safe-pooler.c-2.us-east-2.aws.neon.tech/digipants_workspace_dev?sslmode=verify-full";
const tenantA="11111111-1111-4111-8111-111111111111";
const tenantB="22222222-2222-4222-8222-222222222222";

test("Neon pooled acceptance refuses direct, privileged and insecure connections",()=>{
  assert.equal(assertPooledNeonUrl(pooled).hostname.includes("-pooler."),true);
  const bad=[
    pooled.replace("-pooler.","-direct."),
    pooled.replace(".neon.tech",".evil.invalid"),
    pooled.replace("verify-full","require"),
    pooled.replace("cw_runtime_ci","postgres_admin"),
    pooled.replace("digipants_workspace_dev","production"),
    pooled.replace("postgresql://","http://"),
    "postgresql://cw_runtime_ci:secret@localhost/digipants_workspace_dev",
    pooled+"#fragment",
    "",
  ];
  for(const value of bad)assert.throws(()=>assertPooledNeonUrl(value));
});
test("Neon pooled acceptance verifies TLS, restricted roles and transaction-local tenant resets",async()=>{
  const before=process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED;
  process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED="1";
  let seen=0,closed=false,sessionScope=null,inside=false;
  class MockPool{
    async connect(){
      return {query:async(sql,args=[])=>{
        const s=String(sql).trim();
        if(s==="BEGIN"){inside=true;return {rows:[]};}
        if(s==="COMMIT"){inside=false;sessionScope=null;return {rows:[]};}
        if(s==="ROLLBACK"){inside=false;sessionScope=null;return {rows:[]};}
        if(s.includes("set_config(")){
          assert.equal(inside,true);
          sessionScope=args[0];
          return {rows:[]};
        }
        if(s.includes("FROM pg_roles"))
          return {rows:[{role:"cw_runtime_ci",rolcanlogin:true,
            rolsuper:false,rolcreaterole:false,rolcreatedb:false,rolbypassrls:false}]};
        if(s.includes("pg_stat_ssl"))
          return {rows:[{ssl:true,version:"TLSv1.3",cipher:"synthetic"}]};
        if(s.includes("has_table_privilege"))
          return {rows:[{can_read:true,can_write:false,can_invite:false,can_create:false}]};
        if(s.includes("count(*)::integer")){
          seen++;
          return {rows:[{n:sessionScope ? 1 : 0}]};
        }
        throw Error("Unknown SQL contract "+s.slice(0,80));
      },release:()=>{}};
    }
    async end(){closed=true;}
  }
  try{
    const result=await runAcceptance({poolerUrl:pooled,
      tenantA,tenantB,makePool:MockPool});
    assert.deepEqual(result,{pooledTls:true,restrictedRole:true,
      tenantReset:true,independentTenantReads:true});
    assert.equal(seen,5);
    assert.equal(closed,true);
    assert.equal(sessionScope,null);
    await assert.rejects(runAcceptance({poolerUrl:pooled,
      tenantA,tenantB:tenantA,makePool:MockPool}));
  }finally{
    if(before===undefined)delete process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED;
    else process.env.WORKSPACE_POOLER_ACCEPTANCE_ENABLED=before;
  }
});
