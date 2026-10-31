import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("private mailbox proof over Next.js (disposable PostgreSQL only)",
    {skip:"Explicit isolated PostgreSQL CI fixture required"},()=>{});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL,"auth_spike_test");
  assertDisposableLoopbackDatabaseUrl(process.env.WORKSPACE_DATABASE_URL,"digipants_workspace_dev");
  process.env.AUTH_EXPERIMENT_ENABLED="1";
  process.env.WORKSPACE_MAIL_PROOF_TEST_ENABLED="1";
  process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED="1";
  process.env.RUN_WORKSPACE_MAIL_INTEGRATION="1";

  const [{getAuthPrisma,getWorkspacePrisma},route,proof]=await Promise.all([
    import("../src/database.ts"),
    import("../../../app/api/workspace/invites/proof/route.ts"),
    import("../src/mailbox-proof.ts"),
  ]);
  const authDb=getAuthPrisma(),db=getWorkspacePrisma();

  test("real Next route: CSRF, private recipient delivery, non-enumeration, replay and production off",async t=>{
    const ids={tenant:randomUUID(),project:randomUUID(),staff:randomUUID(),invite:randomUUID(),failedInvite:randomUUID()};
    const token=randomBytes(32).toString("base64url");
    const failedToken=randomBytes(32).toString("base64url");
    const email=`private-${randomUUID()}@example.invalid`;
    const failedEmail=`retry-${randomUUID()}@example.invalid`;
    const originalSender=globalThis.__workspaceMailboxTestSender;
    const recorded=[];
    globalThis.__workspaceMailboxTestSender=async message=>{
      recorded.push(message);
      return true;
    };

    t.after(async ()=>{
      globalThis.__workspaceMailboxTestSender=originalSender;
      try {
        await authDb.verification.deleteMany({where:{
          identifier:{startsWith:"cw-mail-ownership-v1:"},
          id: {in: recorded.map(x=>x.challengeId)}
        }});
        await db.$executeRaw`DELETE FROM workspace_invitation_records WHERE id IN (${ids.invite}::uuid,${ids.failedInvite}::uuid)`;
        await db.$executeRaw`DELETE FROM workspace_staff_memberships WHERE principal_id=${ids.staff}::uuid`;
        await db.$executeRaw`DELETE FROM workspace_projects WHERE id=${ids.project}::uuid`;
        await db.$executeRaw`DELETE FROM workspace_principals WHERE id=${ids.staff}::uuid`;
        await db.$executeRaw`DELETE FROM workspace_tenants WHERE id=${ids.tenant}::uuid`;
      }finally{
        await authDb.$disconnect();
        await db.$disconnect();
      }
    });

    await db.$transaction(async tx=>{
      await tx.$executeRaw`INSERT INTO workspace_tenants(id,legal_name) VALUES (${ids.tenant}::uuid,'Synthetic mail proof tenant')`;
      await tx.$executeRaw`INSERT INTO workspace_principals(id,provider_subject,kind) VALUES (${ids.staff}::uuid,${"synthetic-proof-"+ids.staff},'staff')`;
      await tx.$executeRaw`INSERT INTO workspace_staff_memberships(principal_id) VALUES (${ids.staff}::uuid)`;
      await tx.$executeRaw`INSERT INTO workspace_projects(id,tenant_id,title) VALUES (${ids.project}::uuid,${ids.tenant}::uuid,'Synthetic mail project')`;
      for(const entry of [
        {id:ids.invite,email,token},
        {id:ids.failedInvite,email:failedEmail,token:failedToken},
      ]){
        await tx.$executeRaw`
          INSERT INTO workspace_invitation_records
            (id,tenant_id,project_id,intended_email,intended_role,
             invitation_token_hash,issued_by_staff_id,expires_at)
          VALUES
            (${entry.id}::uuid,${ids.tenant}::uuid,${ids.project}::uuid,
             ${entry.email},'client_viewer',${createHash("sha256").update(entry.token).digest("hex")},
             ${ids.staff}::uuid,statement_timestamp()+interval '20 minutes')
        `;
      }
    });

    const url="http://localhost:3000/api/workspace/invites/proof/";
    const GET=extra=>new Request(url,{method:"GET",headers:{
      "sec-fetch-site":"same-origin",host:"localhost:3000",...extra,
    }});
    const bootstrap=await route.GET(GET());
    assert.equal(bootstrap.status,200);
    assert.match(bootstrap.headers.get("cache-control"),/no-store/);
    assert.equal(bootstrap.headers.get("referrer-policy"),"no-referrer");
    const csrfBody=await bootstrap.json();
    assert.deepEqual(Object.keys(csrfBody),["csrf"]);
    const cookies=bootstrap.headers.getSetCookie().map(x=>x.split(";",1)[0]).join("; ");
    assert.match(cookies,/cw-local-invite-sid=/);
    assert.match(cookies,/cw-local-invite-csrf=/);
    const POST=(body,extra={})=>new Request(url,{method:"POST",headers:{
      "content-type":"application/json",
      "origin":"http://localhost:3000",
      "host":"localhost:3000",
      "sec-fetch-site":"same-origin",
      "x-workspace-csrf":csrfBody.csrf,
      cookie:cookies,
      ...extra,
    },body:JSON.stringify(body)});
    const good={email,invite:token};
    assert.equal((await route.POST(POST(good,{"origin":"https://evil.invalid"}))).status,404);
    assert.equal((await route.POST(POST(good,{"x-workspace-csrf":"wrong"}))).status,404);
    assert.equal((await route.POST(POST(good,{"sec-fetch-site":"cross-site"}))).status,404);
    assert.equal((await route.POST(POST(good,{"cookie":""}))).status,404);
    assert.equal((await route.GET(new Request(url+"?invite="+token))).status,404);
    assert.equal((await route.OPTIONS()).status,404);
    assert.equal(recorded.length,0,"no CSRF failure may send email");

    const valid=await route.POST(POST(good));
    assert.equal(valid.status,202);
    const response=await valid.json();
    assert.match(response.challengeId,/^[0-9a-f-]{36}$/i);
    assert.equal(recorded.length,1);
    const message=recorded[0];
    assert.equal(message.to,email);
    assert.ok(!message.text.includes(token));
    assert.ok(!JSON.stringify(response).includes(email));
    assert.ok(!JSON.stringify(response).includes(token));
    assert.ok(!JSON.stringify(response).includes(message.text));
    const code=message.text.split("\n").find(x=>/^[A-Za-z0-9_-]{43}$/.test(x));
    assert.ok(code,"mock private email includes a one-time random proof");
    const stored=await authDb.verification.findUnique({where:{id:response.challengeId}});
    assert.ok(stored);
    assert.notEqual(stored.value,code);
    assert.equal(stored.value.length,64);
    assert.equal(await proof.consumeSyntheticMailboxChallenge({
      authDb,workspaceDb:db,invitationId:ids.invite,intendedEmail:email,
      challengeId:response.challengeId,code:"X".repeat(43),
    }),false);
    assert.equal(await proof.consumeSyntheticMailboxChallenge({
      authDb,workspaceDb:db,invitationId:ids.invite,intendedEmail:email,
      challengeId:response.challengeId,code,
    }),true);
    assert.equal(await proof.consumeSyntheticMailboxChallenge({
      authDb,workspaceDb:db,invitationId:ids.invite,intendedEmail:email,
      challengeId:response.challengeId,code,
    }),false,"single-use proof replay denied");

    const fake=await route.POST(POST({invite:token,email:"other@example.invalid"}));
    assert.equal(fake.status,202);
    const fakeBody=await fake.json();
    assert.match(fakeBody.challengeId,/^[0-9a-f-]{36}$/i);
    assert.equal(recorded.length,1,"wrong recipient is not mailed");
    const forged=await route.POST(POST({invite:"A".repeat(43),email}));
    assert.equal(forged.status,202);
    assert.equal(recorded.length,1,"unrecognized bearer is not mailed");
    assert.notEqual(fakeBody.challengeId,response.challengeId);

    globalThis.__workspaceMailboxTestSender=async()=>false;
    const failed=await route.POST(POST({invite:failedToken,email:failedEmail}));
    assert.equal(failed.status,202,"provider failure remains indistinguishable");
    const pending=await authDb.verification.findMany({
      where:{identifier:{startsWith:`cw-mail-ownership-v1:${ids.failedInvite}:`}},
    });
    assert.equal(pending.length,0,"failed send must not retain usable proof hash");

    const previousEnv=process.env.NODE_ENV;
    try{
      process.env.NODE_ENV="production";
      assert.equal((await route.GET(GET())).status,404);
      assert.equal((await route.POST(POST(good))).status,404);
    }finally{
      if(previousEnv===undefined)delete process.env.NODE_ENV;
      else process.env.NODE_ENV=previousEnv;
    }
  });
}
