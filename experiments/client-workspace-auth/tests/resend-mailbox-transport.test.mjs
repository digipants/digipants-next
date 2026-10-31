import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";

const {makeLocalResendMailboxTransport}=
  await import("../src/resend-mailbox-transport.ts");

const id=randomUUID();
const msg={
  challengeId:id,
  to:"synthetic-pilot@example.invalid",
  subject:"Verify your DigiPants Workspace invitation",
  text:"Use this one-time code to verify the mailbox receiving your DigiPants Client Workspace invitation.\n\n"+
    "R".repeat(43),
  idempotencyKey:"cw-mailproof-"+id,
};
const options={apiKey:"re_"+ "A".repeat(28),
  from:"DigiPants Client Workspace <support@digipants.com>"};

test("Resend adapter sends idempotent recipient-only payload in local fixture",async()=>{
  const previous=process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED;
  process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED="1";
  try{
    let sent=0;
    const fetch=async(url,init)=>{
      sent++;
      assert.equal(url,"https://api.resend.com/emails");
      assert.equal(init.method,"POST");
      assert.equal(init.redirect,"error");
      assert.equal(init.cache,"no-store");
      assert.equal(init.headers["Idempotency-Key"],msg.idempotencyKey);
      assert.equal(init.headers.Authorization,"Bearer "+options.apiKey);
      const body=JSON.parse(init.body);
      assert.deepEqual(body,{
        from:options.from,to:[msg.to],subject:msg.subject,text:msg.text,
      });
      assert.ok(!JSON.stringify(body).includes("sensitive app session"));
      return new Response(JSON.stringify({id:randomUUID()}),{status:200});
    };
    const send=makeLocalResendMailboxTransport({...options,request:fetch});
    assert.equal(typeof send,"function");
    assert.equal(await send(msg),true);
    assert.equal(await send({...msg,to:"wrong@example.invalid",
      idempotencyKey:"cw-mailproof-"+randomUUID()}),false,
      "mismatched challenge and idempotency must fail closed");
    assert.equal(sent,1);
  }finally{
    if(previous===undefined)delete process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED;
    else process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED=previous;
  }
});
test("Resend transport retries failures and rejects unapproved keys, identities and production",async()=>{
  const previous=process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED;
  const oldNode=process.env.NODE_ENV;
  process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED="1";
  try{
    for(const status of [400,401,409,429,500]){
      const send=makeLocalResendMailboxTransport({
        ...options,request:async()=>new Response("{}",{status}),
      });
      assert.equal(await send(msg),false);
    }
    const invalid=makeLocalResendMailboxTransport({
      ...options,from:"DigiPants <attacker@example.invalid>",
      request:async()=>new Response("{}",{status:200}),
    });
    assert.equal(invalid,null);
    const noKey=makeLocalResendMailboxTransport({
      ...options,apiKey:"",request:async()=>new Response("{}",{status:200}),
    });
    assert.equal(noKey,null);
    process.env.NODE_ENV="production";
    assert.equal(makeLocalResendMailboxTransport({
      ...options,request:async()=>new Response("{}",{status:200}),
    }),null,"transport remains intentionally disconnected in production");
  }finally{
    if(previous===undefined)delete process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED;
    else process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED=previous;
    if(oldNode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=oldNode;
  }
});
