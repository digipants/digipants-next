import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";

if (process.env.RUN_AUTH_EXPERIMENT_INTEGRATION !== "1") {
  test("mailbox proof limits (disposable auth DB only)",
    {skip:"Isolated PostgreSQL CI fixture required"},()=>{});
} else {
  assertDisposableLoopbackDatabaseUrl(process.env.AUTH_DATABASE_URL,"auth_spike_test");
  process.env.AUTH_EXPERIMENT_ENABLED="1";
  process.env.WORKSPACE_MAIL_RATE_LIMIT_TEST_ENABLED="1";
  const [{getAuthPrisma},quota]=await Promise.all([
    import("../src/database.ts"),
    import("../src/mailbox-request-quota.ts"),
  ]);
  const authDb=getAuthPrisma();
  const token=()=>randomBytes(32).toString("base64url");
  const sid=token();
  const bearer=token();
  const email=`rate-${randomUUID()}@example.invalid`;
  const touched=new Set();
  const track=(scope,value)=>{
    const bucket=quota.hashedMailboxRateBucket({scope,value});
    assert.match(bucket,/^[0-9a-f]{64}$/);
    touched.add(bucket);
    return bucket;
  };
  test("SQL-backed quotas are atomic across workers, HMAC-only, and production off",async t=>{
    t.after(async()=>{
      for(const hash of touched) {
        await authDb.$executeRaw`
          DELETE FROM auth_spike.mailbox_proof_rate_windows
          WHERE bucket_key=${hash}
        `;
      }
      await authDb.$disconnect();
    });
    const sidKey=track("sid",sid);
    const emailKey=track("recipient",email);
    const bearerKey=track("bearer",bearer);
    assert.ok(!sidKey.includes(sid)&&!emailKey.includes(email)&&!bearerKey.includes(bearer));
    assert.notEqual(emailKey,bearerKey);
    const candidates=await Promise.all(Array.from({length:12},()=>quota.admitLocalMailboxRequest({
      authDb,sid,intendedEmail:email,invite:bearer,
    })));
    assert.equal(candidates.filter(Boolean).length,4,
      "twelve racing requests must produce exactly four admitted recipient/bearer sends");
    const rows=await authDb.$queryRaw`
      SELECT bucket_key, attempts FROM auth_spike.mailbox_proof_rate_windows
      WHERE bucket_key IN (${sidKey},${emailKey},${bearerKey})
    `;
    assert.equal(rows.length,3);
    for(const row of rows)assert.equal(row.attempts,4,
      "rejected transactions must not partially advance other buckets");
    // Rotating a browser session does not evade exact recipient throttling.
    const otherSid=token();track("sid",otherSid);
    const otherBearer=token();track("bearer",otherBearer);
    assert.equal(await quota.admitLocalMailboxRequest({
      authDb,sid:otherSid,intendedEmail:email,invite:otherBearer,
    }),false);
    const noPartial=await authDb.$queryRaw`
      SELECT count(*)::int AS n FROM auth_spike.mailbox_proof_rate_windows
      WHERE bucket_key=${quota.hashedMailboxRateBucket({scope:"sid",value:otherSid})}
    `;
    assert.equal(noPartial[0].n,0);

    // Per-session throttling still applies when recipients and invites rotate.
    for(let i=0;i<4;i++){
      const e=`rotate-${randomUUID()}@example.invalid`, b=token();
      track("recipient",e);track("bearer",b);
      assert.equal(await quota.admitLocalMailboxRequest({
        authDb,sid,intendedEmail:e,invite:b,
      }),true);
    }
    const finalE=`final-${randomUUID()}@example.invalid`,finalB=token();
    track("recipient",finalE);track("bearer",finalB);
    assert.equal(await quota.admitLocalMailboxRequest({
      authDb,sid,intendedEmail:finalE,invite:finalB,
    }),false);
    const limit=await authDb.$queryRaw`
      SELECT attempts FROM auth_spike.mailbox_proof_rate_windows
      WHERE bucket_key=${sidKey}
    `;
    assert.equal(limit[0].attempts,8);

    const previousNodeEnv=process.env.NODE_ENV;
    try{
      process.env.NODE_ENV="production";
      assert.equal(await quota.admitLocalMailboxRequest({
        authDb,sid:token(),intendedEmail:email,invite:bearer,
      }),false,"production remains disabled even with all test flags");
    }finally{
      if(previousNodeEnv===undefined)delete process.env.NODE_ENV;
      else process.env.NODE_ENV=previousNodeEnv;
    }
    const previousKey=process.env.WORKSPACE_MAIL_RATE_HMAC_KEY;
    try{
      delete process.env.WORKSPACE_MAIL_RATE_HMAC_KEY;
      assert.equal(await quota.admitLocalMailboxRequest({
        authDb,sid:token(),intendedEmail:email,invite:bearer,
      }),false,"missing keyed HMAC secret fails closed");
    }finally{
      if(previousKey===undefined)delete process.env.WORKSPACE_MAIL_RATE_HMAC_KEY;
      else process.env.WORKSPACE_MAIL_RATE_HMAC_KEY=previousKey;
    }
  });
}