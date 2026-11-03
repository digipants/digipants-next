import "server-only";

import { randomUUID } from "node:crypto";
import { normalizeInvitedEmail } from "./invite-issuance.js";
import {
  deliverNextLocalMailboxMessage, enqueueLocalMailboxMessage,
  mailboxOutboxTestEnabled,
} from "./mail-delivery-outbox.js";
import {
  createSyntheticMailboxChallenge, findPendingInvitationIdForBearer,
} from "./mailbox-proof.js";

type Sql = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...params: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...params: unknown[]): Promise<number>;
};
type Db = Sql & {
  $transaction<T>(operation: (tx: Sql) => Promise<T>): Promise<T>;
};
export type MailboxProofMessage = Readonly<{
  challengeId: string;
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9_-]{43}$/;

export function composeMailboxProofMessage(input: {
  challengeId: string; recipient: string; code: string;
}): MailboxProofMessage | null {
  const to = normalizeInvitedEmail(input?.recipient);
  if (!to || !UUID.test(input.challengeId) || !CODE.test(input.code)) return null;
  return Object.freeze({
    challengeId: input.challengeId,
    to,
    subject: "Verify your DigiPants Workspace invitation",
    text: [
      "Use this one-time code to verify the mailbox receiving your DigiPants Client Workspace invitation.",
      "",
      input.code,
      "",
      "The code expires after 10 minutes. It does not sign you in or grant project access.",
      "Do not share this code. If you did not request it, ignore this email.",
    ].join("\n"),
    idempotencyKey: "cw-mailproof-" + input.challengeId,
  });
}

export type MailboxSender = (message: MailboxProofMessage) => Promise<boolean>;

/**
 * Local/disposable orchestration ONLY. Recipient and invitation are bound
 * through the hashed token in the workspace DB, then a code hash is stored
 * separately in the auth DB. The raw code is only provided to an injected
 * mockable private mail transport, NEVER to an HTTP caller.
 *
 * A failure tries to delete the provisional one-time code. This is not a
 * durable transactional outbox and is insufficient for a production rollout.
 */
export async function dispatchMailboxProofForBearer(input: {
  workspaceDb: Sql; authDb: Db;
  bearer: string; intendedEmail: string;
  send: MailboxSender;
}): Promise<{ challengeId: string } | null> {
  try {
    if (process.env.NODE_ENV === "production" ||
        process.env.AUTH_EXPERIMENT_ENABLED !== "1" ||
        process.env.WORKSPACE_MAIL_PROOF_TEST_ENABLED !== "1" ||
        typeof input.send !== "function") return null;

    const email = normalizeInvitedEmail(input.intendedEmail);
    if (!email || typeof input.bearer !== "string" ||
        !CODE.test(input.bearer)) return null;
    const invitationId = await findPendingInvitationIdForBearer({
      workspaceDb: input.workspaceDb, token: input.bearer, intendedEmail: email,
    });
    if (!invitationId) return null;
    const queued = process.env.WORKSPACE_MAIL_OUTBOX_TEST_ENABLED === "1";
    const queueReady = mailboxOutboxTestEnabled();
    // Opt-in queue mode MUST NOT silently fall back to inline mail delivery
    // when its encryption key or durable journal is misconfigured.
    if (queued && !queueReady) return null;
    const challenge = await createSyntheticMailboxChallenge({
      workspaceDb: input.workspaceDb, authDb: input.authDb,
      invitationId, intendedEmail: email,
      ...(queued ? {
        queueInTransaction: async (tx, values) => {
          const message = composeMailboxProofMessage({
            challengeId: values.challengeId,
            recipient: values.email, code: values.code,
          });
          return message ? await enqueueLocalMailboxMessage({
            tx, challengeId: values.challengeId, message,
          }) : false;
        },
      } : {}),
    });
    if (!challenge) return null;
    if (queued) {
      // This is a local synchronous test drain. Production needs an
      // authenticated background worker, bounded retry scheduling and
      // provider-side idempotent acknowledgements.
      await deliverNextLocalMailboxMessage({
        authDb: input.authDb, send: input.send,
      });
      return { challengeId: challenge.challengeId };
    }
    let delivered = false;
    try {
      const message = composeMailboxProofMessage({
        challengeId: challenge.challengeId,
        recipient: challenge.email,
        code: challenge.code,
      });
      if (message) delivered = (await input.send(message)) === true;
    } catch {
      delivered = false;
    }
    if (!delivered) {
      try {
        // Only the exact synthetic challenge may be removed; never modify
        // a different recipient's verification record.
        await input.authDb.$executeRaw`
          DELETE FROM auth_spike.verification WHERE id = ${challenge.challengeId}
            AND identifier = ${"cw-mail-ownership-v1:" + invitationId + ":" + email}
        `;
      } catch {
        // If cleanup fails, the stored code hash is still not known to the
        // HTTP caller; a durable repair worker is needed for production.
      }
      return null;
    }
    return { challengeId: challenge.challengeId };
  } catch {
    return null;
  }
}

/** Public responses may reveal neither invitation existence nor delivery. */
export function publicMailboxChallengeId(result: {challengeId: string} | null): string {
  return result && UUID.test(result.challengeId) ? result.challengeId : randomUUID();
}
