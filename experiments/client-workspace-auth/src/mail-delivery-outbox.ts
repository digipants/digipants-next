import "server-only";
import {
  createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID,
} from "node:crypto";
import { normalizeInvitedEmail } from "./invite-issuance.js";

type Query = {
  $queryRaw<T=unknown>(strings:TemplateStringsArray,...values:unknown[]):Promise<T>;
  $executeRaw(strings:TemplateStringsArray,...values:unknown[]):Promise<number>;
};
type Db = Query & {
  $transaction<T>(fn:(tx:Query)=>Promise<T>):Promise<T>;
};
export type MailPayload = Readonly<{
  challengeId: string; to: string; subject: string; text: string; idempotencyKey: string;
}>;
type OutboxRow = {
  id: string; ciphertext: string; idempotencyKey: string;
  attempts: number; expiresAt: Date;
};
const CODE = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEXT_RETRY_SECONDS = 15;
const MAX_ATTEMPTS = 5;
function enabled(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.AUTH_EXPERIMENT_ENABLED === "1" &&
    process.env.WORKSPACE_MAIL_OUTBOX_TEST_ENABLED === "1";
}
function key():Buffer|null {
  const value=process.env.WORKSPACE_MAIL_OUTBOX_KEY;
  if(!enabled()||typeof value!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const binary=Buffer.from(value,"base64url");
  return binary.length===32?binary:null;
}
function safeMessage(value:unknown):MailPayload|null {
  if(!value||typeof value!=="object") return null;
  const m=value as Record<string,unknown>;
  const recipient=normalizeInvitedEmail(m.to);
  if(!UUID.test(m.challengeId as string)||
      !recipient||typeof m.subject!=="string"||
      m.subject!=="Verify your DigiPants Workspace invitation"||
      typeof m.text!=="string"||m.text.length>1500||
      !m.text.startsWith("Use this one-time code to verify the mailbox")||
      typeof m.idempotencyKey!=="string"||
      !/^cw-mailproof-[0-9a-f-]{36}$/i.test(m.idempotencyKey))return null;
  return Object.freeze({challengeId:m.challengeId as string,
    to:recipient,subject:m.subject,
    text:m.text,idempotencyKey:m.idempotencyKey});
}
/**
 * Store email contents encrypted, not plain. The key must be a separately
 * managed ephemeral 256-bit application secret, NEVER in Git or database.
 */
function seal(message:MailPayload,secret:Buffer):string {
  const nonce=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",secret,nonce);
  const body=Buffer.concat([cipher.update(JSON.stringify(message),"utf8"),cipher.final()]);
  return "v1."+nonce.toString("base64url")+"."+
    cipher.getAuthTag().toString("base64url")+"."+body.toString("base64url");
}
function open(sealed:string,secret:Buffer):MailPayload|null {
  try{
    const parts=sealed.split(".");
    if(parts.length!==4||parts[0]!=="v1")return null;
    const nonce=Buffer.from(parts[1]!,"base64url");
    const tag=Buffer.from(parts[2]!,"base64url");
    const bytes=Buffer.from(parts[3]!,"base64url");
    if(nonce.length!==12||tag.length!==16||bytes.length>2400)return null;
    const decipher=createDecipheriv("aes-256-gcm",secret,nonce);
    decipher.setAuthTag(tag);
    return safeMessage(JSON.parse(Buffer.concat([
      decipher.update(bytes),decipher.final(),
    ]).toString("utf8")));
  }catch{
    return null;
  }
}
export function sealLocalMailboxMessage(message:MailPayload):string|null {
  const secret=key();
  const checked=safeMessage(message);
  return secret&&checked?seal(checked,secret):null;
}
export function decryptLocalMailboxMessage(encrypted:string):MailPayload|null {
  const secret=key();
  return secret?open(encrypted,secret):null;
}

/**
 * Must be called inside the SAME auth-database transaction that persists
 * the one-time proof hash; a failure aborts both. No unencrypted recipient,
 * one-time code or invitation bearer is stored in the outbox.
 */
export async function enqueueLocalMailboxMessage(input:{
  tx:Query; challengeId:string; message:MailPayload;
}):Promise<boolean>{
  if(!UUID.test(input.challengeId))return false;
  const sealed=sealLocalMailboxMessage(input.message);
  if(!sealed)return false;
  const digest=createHash("sha256").update(sealed).digest("hex");
  const inserted=await input.tx.$executeRaw`
    INSERT INTO auth_spike.mail_delivery_outbox
      (id,kind,idempotency_key,payload_ciphertext,payload_sha256,expires_at)
    VALUES (
      ${input.challengeId}::uuid,'mailbox_proof',
      ${input.message.idempotencyKey},
      ${sealed},${digest},
      statement_timestamp()+ interval '10 minutes'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
  return inserted===1;
}

/** Lease one row with SKIP LOCKED; simultaneous workers cannot claim it.
 * The sender must provide provider-side idempotency for at-least-once retries.
 */
export async function deliverNextLocalMailboxMessage(input:{
  authDb:Db;
  send:(message:MailPayload)=>Promise<boolean>;
}):Promise<"sent"|"retry"|"expired"|"idle"> {
  if(!enabled()||!key()||typeof input.send!=="function")return "idle";
  const lease=randomUUID();
  let selected:OutboxRow|null=null;
  try{
    selected=await input.authDb.$transaction(async tx=>{
      const rows=await tx.$queryRaw<Array<{
        id:string; ciphertext:string; idempotencyKey:string;
        attempts:number; expiresAt:Date;
      }>>`
        SELECT id::text AS id, payload_ciphertext AS ciphertext,
          idempotency_key AS "idempotencyKey",
          attempt_count AS attempts, expires_at AS "expiresAt"
        FROM auth_spike.mail_delivery_outbox
        WHERE (state='pending' AND next_attempt_at<=statement_timestamp())
          OR (state='sending' AND leased_until<=statement_timestamp())
        ORDER BY next_attempt_at,id
        FOR UPDATE SKIP LOCKED LIMIT 1
      `;
      if(rows.length!==1)return null;
      const row=rows[0]!;
      const updated=await tx.$executeRaw`
        UPDATE auth_spike.mail_delivery_outbox
          SET state='sending',attempt_count=attempt_count+1,
            lease_id=${lease}::uuid,
            leased_until=statement_timestamp()+ interval '60 seconds'
        WHERE id=${row.id}::uuid
          AND state IN ('pending','sending')
      `;
      return updated===1?row:null;
    });
    if(!selected)return "idle";
    // Never send after expiry, including after a worker crash/restart.
    const expired=new Date(selected.expiresAt).getTime()<=Date.now();
    const payload=expired?null:decryptLocalMailboxMessage(selected.ciphertext);
    const valid=payload?.idempotencyKey===selected.idempotencyKey;
    let acknowledged=false;
    if(valid&&payload){
      try{acknowledged=(await input.send(payload))===true;}catch{acknowledged=false;}
    }
    const done=acknowledged && !expired;
    const maxed=expired||!valid||selected.attempts+1>=MAX_ATTEMPTS;
    const result=done?"sent":maxed?"expired":"retry";
    const status=done?"sent":maxed?"expired":"pending";
    const nextAt=done||maxed?new Date():new Date(Date.now()+
      NEXT_RETRY_SECONDS*1000*(2**selected.attempts));
    const changed=await input.authDb.$executeRaw`
      UPDATE auth_spike.mail_delivery_outbox
        SET state=${status},lease_id=NULL,leased_until=NULL,
          next_attempt_at=${nextAt},sent_at=
            CASE WHEN ${done} THEN statement_timestamp() ELSE sent_at END,
          payload_ciphertext=
            CASE WHEN ${done||maxed} THEN NULL ELSE payload_ciphertext END
      WHERE id=${selected.id}::uuid
        AND state='sending' AND lease_id=${lease}::uuid
    `;
    return changed===1?result:"idle";
  }catch{
    // A stale lease becomes eligible again after 60 seconds. Do not log
    // underlying SQL errors, recipient addresses, or encrypted payloads.
    return "idle";
  }
}

export function mailboxOutboxTestEnabled():boolean {
  return enabled()&&!!key();
}
