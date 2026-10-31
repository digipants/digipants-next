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
  process.env.WORKSPACE_MAIL_OUTBOX_TEST_ENABLED="1";
  process.env.WORKSPACE_MAIL_RATE_LIMIT_TEST_ENABLED="1";

  const [{getAuthPrisma,getWorkspacePrisma},route,proof,outbox]=await Promise.all([
    import("../src/database.ts"),
    import("../../../app/api/workspace/invites/proof/route.ts"),
    import("../src/mailbox-proof.ts"),
    import("../src/mail-delivery-outbox.ts"),
  ]);
  const authDb=getAuthPrisma(),db=getWorkspacePrisma();

  test("real Next route: CSRF, private recipient delivery, non-enumeration, replay and production off",async t=>{
    const ids={tenant:randomUUID(),project:randomUUID(),staff:randomUUID(),invite:randomUUID(),failedInvite:randomUUID()};
    const token=randomBytes(32).toString("base64url");
    const failedToken=randomBytes(32).toString("base64url");
    const email=`private-${randomUUID()}@example.invalid`;
    const failedEmail=`retry-${randomUUID()}@example.invalid`;
    let failedChallengeId=null;
    const originalSender=globalThis.__workspaceMailboxTestSender;
    const recorded=[];
    globalThis.__workspaceMailboxTestSender=async message=>{
      const rows=await authDb.$queryRaw`
        SELECT state,payload_ciphertext FROM auth_spike.mail_delivery_outbox
        WHERE id=${message.challengeId}::uuid
      `;
      assert.equal(rows.length,1,"encrypted message must exist before transport");
      assert.equal(rows[0].state,"sending","worker must hold a lease");
      assert.ok(rows[0].payload_ciphertext.startsWith("v1."));
      assert.ok(!rows[0].payload_ciphertext.includes(message.to),
        "recipient must not appear as plaintext in durable outbox");
      assert.ok(!rows[0].payload_ciphertext.includes(message.text),
        "one-time code must not appear as plaintext in durable outbox");
      recorded.push(message);
      return true;
    };

    t.after(async ()=>{
      globalThis.__workspaceMailboxTestSender=originalSender;
      try {
        await authDb.$executeRaw`
          DELETE FROM auth_spike.mail_delivery_outbox
          WHERE id IN (SELECT id FROM auth_spike.mail_delivery_outbox
            WHERE id IN (${recorded[0]?.challengeId ?? randomUUID()}::uuid,
                         ${failedChallengeId ?? randomUUID()}::uuid))
        `;
        await authDb.verification.deleteMany({where:{
          identifier:{startsWith:"cw-mail-ownership-v1:"},
          id: {in: [recorded[0]?.challengeId, failedChallengeId].filter(Boolean)}
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
    const sentJournal=await authDb.$queryRaw`
      SELECT state,attempt_count,payload_ciphertext,lease_id,sent_at
      FROM auth_spike.mail_delivery_outbox WHERE id=${response.challengeId}::uuid
    `;
    assert.equal(sentJournal.length,1);
    assert.equal(sentJournal[0].state,"sent");
    assert.equal(sentJournal[0].attempt_count,1);
    assert.equal(sentJournal[0].payload_ciphertext,null,
      "remove sensitive plaintext-equivalent ciphertext after provider ack");
    assert.equal(sentJournal[0].lease_id,null);
    assert.ok(sentJournal[0].sent_at);
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
    assert.equal(pending.length,1,
      "transient delivery failure keeps a recoverable one-time proof");
    failedChallengeId=pending[0].id;
    const waiting=await authDb.$queryRaw`
      SELECT state,attempt_count,payload_ciphertext,lease_id
        FROM auth_spike.mail_delivery_outbox
       WHERE id=${failedChallengeId}::uuid
    `;
    assert.equal(waiting.length,1);
    assert.equal(waiting[0].state,"pending","failed delivery is durably retryable");
    assert.equal(waiting[0].attempt_count,1);
    assert.ok(waiting[0].payload_ciphertext.startsWith("v1."));
    assert.equal(waiting[0].lease_id,null);
    assert.equal(await outbox.deliverNextLocalMailboxMessage({
      authDb,send:async()=>{throw Error("synthetic sender outage");},
    }),"idle","backoff blocks instant retry loops");
    await authDb.$executeRaw`
      UPDATE auth_spike.mail_delivery_outbox
         SET next_attempt_at=statement_timestamp()-interval '1 second'
       WHERE id=${failedChallengeId}::uuid
    `;
    const retries=[];
    assert.equal(await outbox.deliverNextLocalMailboxMessage({
      authDb,send:async message=>{retries.push(message);return true;},
    }),"sent","a later worker retry can acknowledge the same message");
    assert.equal(retries.length,1);
    assert.equal(retries[0].challengeId,failedChallengeId);
    assert.equal(retries[0].idempotencyKey,"cw-mailproof-"+failedChallengeId);
    const recovered=await authDb.$queryRaw`
      SELECT state,attempt_count,payload_ciphertext,sent_at
      FROM auth_spike.mail_delivery_outbox WHERE id=${failedChallengeId}::uuid
    `;
    assert.equal(recovered[0].state,"sent");
    assert.equal(recovered[0].attempt_count,2);
    assert.equal(recovered[0].payload_ciphertext,null);

    // The route must conceal rate limits behind the identical 202 response
    // and must not permit further delivery from an exhausted browser session.
    for(let n=0;n<4;n++){
      const denied=await route.POST(POST({
        email:`rotate-${randomUUID()}@example.invalid`,
        invite:randomBytes(32).toString("base64url"),
      }));
      assert.equal(denied.status,202);
      const shape=await denied.json();
      assert.deepEqual(Object.keys(shape),["challengeId"]);
      assert.match(shape.challengeId,/^[0-9a-f-]{36}$/i);
    }
    const exhausted=await route.POST(POST({
      email:`exhausted-${randomUUID()}@example.invalid`,
      invite:randomBytes(32).toString("base64url"),
    }));
    assert.equal(exhausted.status,202,"rate limit may not reveal its decision");
    assert.deepEqual(Object.keys(await exhausted.json()),["challengeId"]);
    assert.equal(recorded.length,1,
      "exhausted anonymous session cannot trigger a new email");

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
