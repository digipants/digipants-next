import "server-only";

import { createHmac } from "node:crypto";
import { normalizeInvitedEmail } from "./invite-issuance.js";
import { isLocalWorkspaceTest, isProtectedWorkspaceStaging } from "./workspace-runtime.js";

type Sql = {
  $queryRaw<T=unknown>(strings: TemplateStringsArray, ...params: unknown[]): Promise<T>;
};
type Db = Sql & {
  $transaction<T>(operation:(tx: Sql)=>Promise<T>): Promise<T>;
};
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const SESSION=TOKEN;

/**
 * Atomic auth DB quotas for session, recipient, and invitation. Network-level
 * per-IP limiting is enforced separately by Netlify's trusted edge.
 */
export function localRateLimitEnabled(): boolean {
  return isProtectedWorkspaceStaging() || (isLocalWorkspaceTest() &&
    process.env.WORKSPACE_MAIL_RATE_LIMIT_TEST_ENABLED==="1");
}
function rateKey():Buffer|null{
  const value=process.env.WORKSPACE_MAIL_RATE_HMAC_KEY;
  if(!localRateLimitEnabled()||typeof value!=="string"||
    !TOKEN.test(value))return null;
  const bytes=Buffer.from(value,"base64url");
  return bytes.length===32?bytes:null;
}
export function hashedMailboxRateBucket(input:{
  scope:"sid"|"recipient"|"bearer"; value:string;
}):string|null{
  const secret=rateKey();
  if(!secret||typeof input.value!=="string"||!input.value.length||
     input.value.length>320)return null;
  return createHmac("sha256",secret)
    .update("digipants-mail-rate-v1\0"+input.scope+"\0"+input.value)
    .digest("hex");
}
/**
 * Attempts are counted in one DB transaction across session, exact
 * normalized recipient and opaque invitation bearer. Rows are HMACs only.
 * Every bucket must be admitted; failure rolls back ALL counters, and a
 * caller still gets an indistinguishable fake challenge ID.
 *
 * This does not prove that a client controls the claimed mailbox or IP.
 */
export async function admitLocalMailboxRequest(input:{
  authDb:Db; sid:string; intendedEmail:string; invite:string;
}):Promise<boolean>{
  if(!rateKey() || typeof input.sid!=="string" || !SESSION.test(input.sid) ||
     typeof input.invite!=="string" || !TOKEN.test(input.invite))return false;
  const email=normalizeInvitedEmail(input.intendedEmail);
  if(!email)return false;
  const buckets: Array<{scope:"sid"|"recipient"|"bearer";value:string;cap:number}>= [
    {scope:"sid",value:input.sid,cap:8},
    {scope:"recipient",value:email,cap:4},
    {scope:"bearer",value:input.invite,cap:4},
  ];
  const derived=buckets.map(b=>({...b,key:hashedMailboxRateBucket(b)}));
  if(derived.some(b=>!b.key))return false;
  try{
    return await input.authDb.$transaction(async tx=>{
      for(const bucket of derived){
        const rows=await tx.$queryRaw<Array<{attempts:number}>>`
          INSERT INTO auth_spike.mailbox_proof_rate_windows
            (bucket_key,window_start,expires_at,attempts)
          VALUES
            (${bucket.key}, statement_timestamp(),
             statement_timestamp() + interval '15 minutes', 1)
          ON CONFLICT (bucket_key) DO UPDATE
          SET attempts = CASE
              WHEN auth_spike.mailbox_proof_rate_windows.expires_at <= statement_timestamp()
              THEN 1
              ELSE auth_spike.mailbox_proof_rate_windows.attempts + 1 END,
              window_start = CASE
              WHEN auth_spike.mailbox_proof_rate_windows.expires_at <= statement_timestamp()
              THEN statement_timestamp()
              ELSE auth_spike.mailbox_proof_rate_windows.window_start END,
              expires_at = CASE
              WHEN auth_spike.mailbox_proof_rate_windows.expires_at <= statement_timestamp()
              THEN statement_timestamp() + interval '15 minutes'
              ELSE auth_spike.mailbox_proof_rate_windows.expires_at END
          WHERE auth_spike.mailbox_proof_rate_windows.expires_at <= statement_timestamp()
             OR auth_spike.mailbox_proof_rate_windows.attempts < ${bucket.cap}
          RETURNING attempts
        `;
        if(rows.length!==1 ||
          !Number.isInteger(rows[0]!.attempts)||
          rows[0]!.attempts>bucket.cap){
          // This rollback deliberately preserves the previous counters.
          throw Error("mailbox quota exceeded");
        }
      }
      return true;
    });
  }catch{
    // No detailed error: callers must not distinguish a nonexistent invite,
    // abuse quota, database outage or invalid recipient.
    return false;
  }
}
