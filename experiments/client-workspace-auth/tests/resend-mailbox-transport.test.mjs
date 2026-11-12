import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";

const enabled = process.env.RUN_RESEND_TRANSPORT_TEST === "1";
const resendModule = enabled
  ? await import("../src/resend-mailbox-transport.ts")
  : {makeLocalResendMailboxTransport: null,createStagingResendMailboxTransport: null,createWorkspaceResendMailboxTransport: null};
const {makeLocalResendMailboxTransport} = resendModule;

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

test("Resend adapter sends idempotent recipient-only payload in local fixture",
  {skip: !enabled && "Dedicated server-only test runtime required"},async()=>{
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
    assert.equal(typeof makeLocalResendMailboxTransport({
      ...options,from:"support@digipants.com",request:fetch,
    }),"function","a raw sender address on the verified DigiPants domain is valid");
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
test("Resend transport retries failures and rejects unapproved keys, identities and unconfigured production",
  {skip: !enabled && "Dedicated server-only test runtime required"},async()=>{
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
    }),null,"production remains disabled outside the exact production site gate");
  }finally{
    if(previous===undefined)delete process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED;
    else process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED=previous;
    if(oldNode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=oldNode;
  }
});

test("production Resend uses a separate key and explicit production email gate", {
  skip: !enabled && "Dedicated server-only test runtime required",
}, async () => {
  const keys = [
    "NODE_ENV", "CLIENT_WORKSPACE_ENABLED", "CLIENT_WORKSPACE_ENVIRONMENT",
    "CLIENT_WORKSPACE_PRODUCTION_ENABLED", "SITE_ID", "CLIENT_WORKSPACE_ORIGIN", "URL",
    "CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED", "CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED",
    "PRODUCTION_RESEND_API_KEY", "RESEND_API_KEY",
    "WORKSPACE_EMAIL_FROM", "PRODUCTION_WORKSPACE_EMAIL_FROM",
  ];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = global.fetch;
  let sent = 0;
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      CLIENT_WORKSPACE_ENABLED: "1",
      CLIENT_WORKSPACE_ENVIRONMENT: "production",
      CLIENT_WORKSPACE_PRODUCTION_ENABLED: "1",
      SITE_ID: "837d4464-7eb6-4a1f-b4ef-3a44a2829d79",
      CLIENT_WORKSPACE_ORIGIN: "https://digipants.com",
      URL: "https://digipants.com",
      CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED: "1",
      CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED: "0",
      PRODUCTION_RESEND_API_KEY: "re_" + "P".repeat(28),
      RESEND_API_KEY: "re_" + "S".repeat(28),
      WORKSPACE_EMAIL_FROM: "DigiPants Client Workspace <staging@digipants.com>",
      PRODUCTION_WORKSPACE_EMAIL_FROM: "DigiPants Client Workspace <support@digipants.com>",
    });
    global.fetch = async (_url, init) => {
      sent++;
      assert.equal(init.headers.Authorization, "Bearer " + process.env.PRODUCTION_RESEND_API_KEY);
      assert.equal(JSON.parse(init.body).from, process.env.PRODUCTION_WORKSPACE_EMAIL_FROM);
      return new Response(JSON.stringify({ id: randomUUID() }), { status: 200 });
    };
    const sender = resendModule.createWorkspaceResendMailboxTransport();
    assert.equal(typeof sender, "function");
    assert.equal(resendModule.createStagingResendMailboxTransport(), null);
    assert.equal(resendModule.createWorkspaceResendMailboxTransport("founder-bootstrap"), null,
      "production founder proof requires a separate explicit switch");
    const inviteId = randomUUID();
    assert.equal(await sender({
      kind: "workspace_invitation", challengeId: inviteId,
      to: "client@example.invalid", subject: "Your DigiPants Client Workspace invitation",
      text: "You have been invited to a private DigiPants client workspace.",
      idempotencyKey: "cw-invite-" + inviteId,
    }), true);
    assert.equal(sent, 1);
    process.env.CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED = "1";
    const founderSender = resendModule.createWorkspaceResendMailboxTransport("founder-bootstrap");
    assert.equal(typeof founderSender, "function");
    const founderId = randomUUID();
    assert.equal(await founderSender({
      kind: "founder_bootstrap", challengeId: founderId,
      to: "founder@example.invalid", subject: "Verify your DigiPants founder account",
      text: "You requested one-time mailbox verification for the DigiPants Client Workspace founder staff account.\n"
        + "A".repeat(43) + "\n",
      idempotencyKey: "cw-founder-bootstrap-" + founderId,
    }), true);
    assert.equal(sent, 2);
    process.env.CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED = "0";
    assert.equal(resendModule.createWorkspaceResendMailboxTransport("founder-bootstrap"), null);
    process.env.CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED = "0";
    assert.equal(resendModule.createWorkspaceResendMailboxTransport(), null);
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("founder-only staging mail scope cannot deliver client invitations",
  {skip: !enabled && "Dedicated server-only test runtime required"},async()=>{
  const keys=[
    "NODE_ENV","CLIENT_WORKSPACE_ENABLED","CLIENT_WORKSPACE_ENVIRONMENT",
    "SITE_ID","CLIENT_WORKSPACE_ORIGIN","URL",
    "CLIENT_WORKSPACE_FOUNDER_EMAIL_ENABLED","CLIENT_WORKSPACE_REAL_EMAILS_ENABLED",
    "RESEND_API_KEY","WORKSPACE_EMAIL_FROM",
  ];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  let sent=0;
  try{
    Object.assign(process.env,{
      NODE_ENV:"production",
      CLIENT_WORKSPACE_ENABLED:"1",
      CLIENT_WORKSPACE_ENVIRONMENT:"staging",
      SITE_ID:"ebafda7a-e6c5-48e4-a44d-daf0f5943d43",
      CLIENT_WORKSPACE_ORIGIN:"https://digipants-client-workspace-staging.netlify.app",
      URL:"https://digipants-client-workspace-staging.netlify.app",
      CLIENT_WORKSPACE_FOUNDER_EMAIL_ENABLED:"1",
      CLIENT_WORKSPACE_REAL_EMAILS_ENABLED:"0",
      RESEND_API_KEY:"re_"+"A".repeat(28),
      WORKSPACE_EMAIL_FROM:"DigiPants Client Workspace <support@digipants.com>",
    });
    global.fetch=async()=>{
      sent++;
      return new Response(JSON.stringify({id:randomUUID()}),{status:200});
    };
    const founderSender=resendModule.createStagingResendMailboxTransport("founder-bootstrap");
    assert.equal(typeof founderSender,"function");
    assert.equal(resendModule.createStagingResendMailboxTransport(),null,
      "the general invitation sender stays disabled");
    const challengeId=randomUUID();
    const founderMessage={
      kind:"founder_bootstrap",challengeId,to:"founder@example.invalid",
      subject:"Verify your DigiPants founder account",
      text:"You requested one-time mailbox verification for the DigiPants Client Workspace founder staff account.\n\n"+
        "A".repeat(43)+"\nThe code expires in 10 minutes.",
      idempotencyKey:"cw-founder-bootstrap-"+challengeId,
    };
    assert.equal(await founderSender({kind:"workspace_invitation"}),false);
    assert.equal(await founderSender(founderMessage),true);
    assert.equal(sent,1,"only the founder verification reached the mocked provider");
    process.env.CLIENT_WORKSPACE_FOUNDER_EMAIL_ENABLED="0";
    assert.equal(resendModule.createStagingResendMailboxTransport("founder-bootstrap"),null);
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});
