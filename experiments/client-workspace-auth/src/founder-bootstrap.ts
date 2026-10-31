import { createHash, randomBytes, randomUUID } from "node:crypto";
import { normalizeInvitedEmail } from "./invite-issuance.js";
import { workspaceRuntimeMode } from "./workspace-runtime.js";
import {
  deliverNextLocalMailboxMessage,
  enqueueLocalMailboxMessage,
  mailboxOutboxTestEnabled,
} from "./mail-delivery-outbox.js";
import type { MailPayload } from "./mail-delivery-outbox.js";

type Sql = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};
type TransactionalDb = Sql & {
  $transaction<T>(operation: (tx: Sql) => Promise<T>): Promise<T>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9_-]{43}$/;
const PURPOSE = "cw-founder-bootstrap-proof-v1";
const IDENTIFIER_PREFIX = "cw-founder-bootstrap-v1:";

export function founderBootstrapEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = workspaceRuntimeMode(env);
  const contextEnabled = mode === "protected-staging" || (mode === "local-test" &&
    env.WORKSPACE_FOUNDER_BOOTSTRAP_TEST_ENABLED === "1");
  return contextEnabled && env.CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED === "1";
}

function normalizedEmail(value: string): string | null {
  return normalizeInvitedEmail(value);
}

function emailHash(value: string): Buffer | null {
  const email = normalizedEmail(value);
  return email ? createHash("sha256").update(email, "utf8").digest() : null;
}

function proofDigest(code: string): string {
  return createHash("sha256").update(PURPOSE).update("\0").update(code).digest("hex");
}

function proofIdentifier(email: string): string {
  return IDENTIFIER_PREFIX + email;
}

export function composeFounderBootstrapMessage(input: {
  challengeId: string;
  recipient: string;
  code: string;
}): MailPayload | null {
  const to = normalizedEmail(input.recipient);
  if (!to || !UUID.test(input.challengeId) || !CODE.test(input.code)) return null;
  return Object.freeze({
    kind: "founder_bootstrap",
    challengeId: input.challengeId,
    to,
    subject: "Verify your DigiPants founder account",
    text: [
      "You requested one-time mailbox verification for the DigiPants Client Workspace founder staff account.",
      "Enter this code on the protected staging enrollment page:",
      "",
      input.code,
      "",
      "The code expires in 10 minutes. It verifies mailbox ownership only; secure password and authenticator setup are still required.",
      "Do not share this code. If you did not request it, ignore this email.",
    ].join("\n"),
    idempotencyKey: "cw-founder-bootstrap-" + input.challengeId,
  });
}

export async function founderBootstrapIsOpen(input: {
  workspaceDb: Sql;
  email: string;
}): Promise<boolean> {
  const hash = emailHash(input.email);
  if (!hash) return false;
  try {
    const rows = await input.workspaceDb.$queryRaw<Array<{ open: boolean }>>`
      SELECT public.cw_founder_bootstrap_is_open(${hash}) AS open
    `;
    return rows.length === 1 && rows[0]?.open === true;
  } catch {
    return false;
  }
}

/**
 * Issues a one-use code only for the allow-listed founder email hash. The
 * code hash and encrypted outbox entry commit together in the auth database.
 */
export async function dispatchFounderBootstrapProof(input: {
  workspaceDb: Sql;
  authDb: TransactionalDb;
  email: string;
  send: (message: MailPayload) => Promise<boolean>;
}): Promise<{ challengeId: string } | null> {
  if (!founderBootstrapEnabled() || typeof input.send !== "function") return null;
  const email = normalizedEmail(input.email);
  const hash = email && emailHash(email);
  if (!email || !hash || !(await founderBootstrapIsOpen({ workspaceDb: input.workspaceDb, email }))) return null;
  if (!mailboxOutboxTestEnabled()) return null;

  const identifier = proofIdentifier(email);
  const id = randomUUID();
  const code = randomBytes(32).toString("base64url");
  try {
    const queued = await input.authDb.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identifier}, 0))`;
      const active = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM auth_spike.verification
         WHERE identifier = ${identifier} AND expires_at > statement_timestamp()
         LIMIT 1 FOR UPDATE
      `;
      if (active.length) return false;
      await tx.$executeRaw`
        DELETE FROM auth_spike.verification
         WHERE identifier = ${identifier} AND expires_at <= statement_timestamp()
      `;
      const inserted = await tx.$executeRaw`
        INSERT INTO auth_spike.verification
          (id, identifier, value, expires_at, updated_at)
        VALUES (${id}, ${identifier}, ${proofDigest(code)},
                statement_timestamp() + interval '10 minutes', statement_timestamp())
      `;
      const message = composeFounderBootstrapMessage({ challengeId: id, recipient: email, code });
      if (inserted !== 1 || !message || !(await enqueueLocalMailboxMessage({ tx, challengeId: id, message }))) {
        throw new Error("Could not persist the founder verification message.");
      }
      return true;
    });
    if (!queued) return null;
    await deliverNextLocalMailboxMessage({
      authDb: input.authDb,
      challengeId: id,
      send: input.send,
    });
    return { challengeId: id };
  } catch {
    return null;
  }
}

/** Consume mailbox proof, then reserve the single allowed founder subject. */
export async function beginFounderBootstrap(input: {
  workspaceDb: Sql;
  authDb: Sql;
  email: string;
  challengeId: string;
  code: string;
}): Promise<string | null> {
  if (!founderBootstrapEnabled()) return null;
  const email = normalizedEmail(input.email);
  const hash = email && emailHash(email);
  if (!email || !hash || !UUID.test(input.challengeId) || !CODE.test(input.code)) return null;
  if (!(await founderBootstrapIsOpen({ workspaceDb: input.workspaceDb, email }))) return null;
  const identifier = proofIdentifier(email);
  try {
    const spent = await input.authDb.$executeRaw`
      DELETE FROM auth_spike.verification
       WHERE id = ${input.challengeId}
         AND identifier = ${identifier}
         AND value = ${proofDigest(input.code)}
         AND expires_at > statement_timestamp()
    `;
    if (spent !== 1) return null;
    const rows = await input.workspaceDb.$queryRaw<Array<{ subject: string | null }>>`
      SELECT public.cw_begin_founder_bootstrap(
        ${hash}, ${input.challengeId}
      ) AS subject
    `;
    const subject = rows[0]?.subject;
    return typeof subject === "string" && UUID.test(subject) ? subject : null;
  } catch {
    return null;
  }
}

/** Finalizes exactly one project-scoped delivery-lead grant after signup. */
export async function completeFounderBootstrap(input: {
  workspaceDb: Sql;
  email: string;
  providerSubject: string;
}): Promise<boolean> {
  if (!founderBootstrapEnabled() || !UUID.test(input.providerSubject)) return false;
  const hash = emailHash(input.email);
  if (!hash) return false;
  try {
    const rows = await input.workspaceDb.$queryRaw<Array<{ completed: boolean }>>`
      SELECT public.cw_complete_founder_bootstrap(
        ${hash}, ${input.providerSubject}
      ) AS completed
    `;
    return rows.length === 1 && rows[0]?.completed === true;
  } catch {
    return false;
  }
}
