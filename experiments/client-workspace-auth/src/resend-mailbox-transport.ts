import "server-only";

import { normalizeInvitedEmail } from "./invite-issuance.js";
import type { MailPayload } from "./mail-delivery-outbox.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const KEY = /^re_[A-Za-z0-9_-]{12,}$/;
const IDEMPOTENCY = /^cw-mailproof-[0-9a-f-]{36}$/i;
const VERIFIED_FROM = /^DigiPants Client Workspace <[A-Za-z0-9._%+-]+@digipants\.com>$/;
type Http = (url: string, options: RequestInit) => Promise<Response>;

/**
 * Provider adapter prepared for a reviewed worker. It is intentionally NOT
 * connected to public workspace HTTP routes or live Netlify runtime. The
 * activation gate is local-only; no actual email is sent in tests.
 */
export function makeLocalResendMailboxTransport(input: {
  apiKey: string; from: string; request: Http;
}): ((message: MailPayload) => Promise<boolean>) | null {
  if (process.env.NODE_ENV==="production" ||
      process.env.WORKSPACE_RESEND_TRANSPORT_TEST_ENABLED!=="1" ||
      typeof input.apiKey!=="string" || !KEY.test(input.apiKey) ||
      !VERIFIED_FROM.test(input.from) ||
      typeof input.request!=="function") return null;
  return async message => {
    try{
      if(!message || !IDEMPOTENCY.test(message.idempotencyKey) ||
         message.idempotencyKey!=="cw-mailproof-"+message.challengeId ||
         normalizeInvitedEmail(message.to)!==message.to ||
         message.subject!=="Verify your DigiPants Workspace invitation" ||
         typeof message.text!=="string" || message.text.length>1500 ||
         !message.text.startsWith("Use this one-time code to verify the mailbox"))
        return false;
      const result=await input.request(RESEND_ENDPOINT,{
        method:"POST",
        redirect:"error",
        cache:"no-store",
        signal:AbortSignal.timeout(8000),
        headers:{
          "Authorization":"Bearer "+input.apiKey,
          "Content-Type":"application/json",
          "Idempotency-Key":message.idempotencyKey,
        },
        body:JSON.stringify({
          from:input.from, to:[message.to],
          subject:message.subject,text:message.text,
        }),
      });
      // 409 concurrent idempotent requests and 429 throttling are NOT
      // acknowledgements. The outbox retries with the exact same key/body.
      if(!result.ok)return false;
      const response=await result.json().catch(()=>null) as unknown;
      return Boolean(response && typeof response==="object" &&
        typeof (response as {id?:unknown}).id==="string" &&
        /^[A-Za-z0-9-]{8,128}$/.test((response as {id:string}).id));
    }catch{
      // Never log recipient, request/response, bearer, token or API key.
      return false;
    }
  };
}
