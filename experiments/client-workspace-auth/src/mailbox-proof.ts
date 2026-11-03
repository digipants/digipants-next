import { createHash, randomBytes, randomUUID } from "node:crypto";
import { normalizeInvitedEmail } from "./invite-issuance.js";
import { hashInvitationToken } from "./invitations.js";

// Synthetic demonstration only; no mail transport, public endpoint, signup
// hook or real onboarding. This can prove ownership of an email inbox only
// when a trusted separate delivery service sends the code to that inbox.
type Query = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...params: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...params: unknown[]): Promise<number>;
};
type TransactionalDb = Query & {
  $transaction<T>(operation: (transaction: Query) => Promise<T>): Promise<T>;
};
type Scope = {
  workspaceDb: Query;
  authDb: TransactionalDb;
  invitationId: string;
  intendedEmail: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PURPOSE = "cw-mail-ownership-v1";
function digest(code: string): string {
  return createHash("sha256").update(PURPOSE).update("\0").update(code).digest("hex");
}
function identifier(invitationId: string, email: string): string {
  return `${PURPOSE}:${invitationId}:${email}`;
}
async function pendingInvite(input: Scope, email: string): Promise<boolean> {
  const rows = await input.workspaceDb.$queryRaw<Array<{ present: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM workspace_invitation_records AS i
        JOIN workspace_tenants AS t ON t.id = i.tenant_id
        JOIN workspace_projects AS p ON p.tenant_id = i.tenant_id AND p.id = i.project_id
       WHERE i.id = ${input.invitationId}::uuid
         AND lower(i.intended_email) = ${email}
         AND i.status = 'pending'
         AND i.expires_at > statement_timestamp()
         AND t.status = 'active'
    ) AS present
  `;
  return rows.length === 1 && rows[0]?.present === true;
}
function valid(input: Scope): string | null {
  if (!UUID.test(input.invitationId)) return null;
  return normalizeInvitedEmail(input.intendedEmail);
}

/**
 * Resolve the invitation ID from a hashed bearer and expected recipient on
 * the server. Never accept an invitation ID from a signup request as an
 * alternative to this lookup. The proof is checked separately afterwards.
 */
export async function findPendingInvitationIdForBearer(input: {
  workspaceDb: Query; token: string; intendedEmail: string;
}): Promise<string | null> {
  const email = normalizeInvitedEmail(input.intendedEmail);
  if (!email || typeof input.token !== "string" ||
      input.token.length < 32 || input.token.length > 512) return null;
  try {
    const rows = await input.workspaceDb.$queryRaw<Array<{ id: string }>>`
      SELECT i.id::text AS id
        FROM workspace_invitation_records AS i
        JOIN workspace_tenants AS t ON t.id = i.tenant_id
        JOIN workspace_projects AS p ON p.id = i.project_id AND p.tenant_id = i.tenant_id
       WHERE i.invitation_token_hash = ${hashInvitationToken(input.token)}
         AND lower(i.intended_email) = ${email}
         AND i.status = 'pending'
         AND i.expires_at > statement_timestamp()
         AND t.status = 'active'
       LIMIT 1
    `;
    return rows.length === 1 && UUID.test(rows[0]!.id) ? rows[0]!.id : null;
  } catch {
    return null;
  }
}

/**
 * Generates a private mailbox challenge for an exact still-pending invite.
 * A live implementation must rate-limit this action and deliver the raw code
 * solely to the intended mailbox; this experiment RETURNS it to a CI harness.
 */
export async function createSyntheticMailboxChallenge(input: Scope & {
  /** Optional durable queue hook, in the same auth transaction as proof hash. */
  queueInTransaction?: (tx: Query, values: {
    challengeId: string; code: string; email: string;
  }) => Promise<boolean>;
}): Promise<{ challengeId: string; code: string; email: string } | null> {
  const email = valid(input);
  if (!email) return null;
  try {
    if (!(await pendingInvite(input, email))) return null;
    const key = identifier(input.invitationId, email);
    const code = randomBytes(32).toString("base64url");
    const id = randomUUID();
    return await input.authDb.$transaction(async tx => {
      // Serialize challenge creation even though Better Auth's generic
      // verification table has no unique constraint on identifier.
      await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS guard`;
      const active = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM auth_spike.verification
         WHERE identifier = ${key} AND expires_at > statement_timestamp()
         LIMIT 1 FOR UPDATE
      `;
      if (active.length) return null;
      await tx.$executeRaw`
        DELETE FROM auth_spike.verification
         WHERE identifier = ${key} AND expires_at <= statement_timestamp()
      `;
      const inserted = await tx.$executeRaw`
        INSERT INTO auth_spike.verification
          (id, identifier, value, expires_at, updated_at)
        VALUES (${id}, ${key}, ${digest(code)},
                statement_timestamp() + interval '10 minutes', statement_timestamp())
      `;
      if (inserted !== 1) throw new Error("Unable to create mailbox challenge");
      if (input.queueInTransaction &&
          !(await input.queueInTransaction(tx, {challengeId:id, code, email}))) {
        // Roll back both the one-time code and its outbound journal.
        throw new Error("Unable to persist mailbox delivery envelope");
      }
      return { challengeId: id, code, email };
    });
  } catch {
    return null;
  }
}

/**
 * A one-time check against a separately delivered proof. Consuming the proof
 * does not create an account, grant, staff role or durable verified-email flag.
 * Identity creation later must be a separate, reviewed fail-closed workflow.
 */
export async function consumeSyntheticMailboxChallenge(input: Scope & {
  challengeId: string; code: string;
}): Promise<boolean> {
  const email = valid(input);
  if (!email || !UUID.test(input.challengeId) ||
      typeof input.code !== "string" || input.code.length < 32 || input.code.length > 512) return false;
  try {
    if (!(await pendingInvite(input, email))) return false;
    const key = identifier(input.invitationId, email);
    return await input.authDb.$transaction(async tx => {
      const consumed = await tx.$executeRaw`
        DELETE FROM auth_spike.verification
         WHERE id = ${input.challengeId}
           AND identifier = ${key}
           AND value = ${digest(input.code)}
           AND expires_at > statement_timestamp()
      `;
      return consumed === 1;
    });
  } catch {
    return false;
  }
}
