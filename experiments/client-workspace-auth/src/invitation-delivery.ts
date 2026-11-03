import { normalizeInvitedEmail } from "./invite-issuance.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BEARER = /^[A-Za-z0-9_-]{43}$/;
const ORIGIN = "https://digipants.com";
const INVITE_PATH = "/workspace/invite/";

export type InvitationMessage = Readonly<{
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}>;

/**
 * Server-only intended use. The invite is kept in the URL fragment, NOT the
 * path/query, so it is not sent in initial HTTP requests or ordinary referrers.
 * The future landing page must avoid third-party scripts, set no-referrer, and
 * exchange the fragment in an origin/CSRF-protected endpoint before clearing it.
 * IMPORTANT: this landing page and its exchange endpoint DO NOT EXIST yet.
 */
export function composePrivateInvitationEmail(input: {
  invitationId: string;
  recipient: string;
  bearerToken: string;
  workspaceOrigin: string;
}): InvitationMessage | null {
  try {
    const values = {
      invitationId: input.invitationId,
      recipient: input.recipient,
      bearerToken: input.bearerToken,
      workspaceOrigin: input.workspaceOrigin,
    };
    const email = normalizeInvitedEmail(values.recipient);
    if (!UUID.test(values.invitationId) || !email ||
        !BEARER.test(values.bearerToken) || values.workspaceOrigin !== ORIGIN) return null;
    const link = new URL(INVITE_PATH, ORIGIN);
    link.hash = "invite=" + encodeURIComponent(values.bearerToken);
    return Object.freeze({
      to: email,
      subject: "Your DigiPants Client Workspace invitation",
      text: [
        "You have been invited to a private DigiPants client workspace.",
        "This invitation expires 20 minutes after issuance and works only for your invited email address.",
        "",
        link.toString(),
        "",
        "You must also verify ownership of your email address and complete account security checks.",
        "If you were not expecting this invitation, you can ignore it.",
        "For your security, check that the link begins with https://digipants.com/.",
      ].join("\n"),
      idempotencyKey: "cw-invite-" + values.invitationId,
    });
  } catch {
    return null;
  }
}

export type ResendFetcher = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

/**
 * Isolated Resend transport adapter. No caller in the live website imports it.
 * The injected fetcher is mandatory: tests use a fake transport and can NEVER
 * accidentally deliver a real invitation. Production wiring needs review.
 */
export async function sendInvitationThroughResend(input: {
  message: InvitationMessage;
  from: string;
  apiKey: string;
  fetcher: ResendFetcher;
}): Promise<boolean> {
  try {
    const { message, from, apiKey, fetcher } = input;
    if (!message || typeof message !== "object" ||
        !normalizeInvitedEmail(message.to) ||
        typeof message.subject !== "string" ||
        message.subject !== "Your DigiPants Client Workspace invitation" ||
        typeof message.text !== "string" ||
        !message.text.startsWith("You have been invited to a private DigiPants") ||
        typeof message.idempotencyKey !== "string" ||
        !/^cw-invite-[0-9a-f-]{36}$/i.test(message.idempotencyKey) ||
        typeof from !== "string" || from.length < 3 || from.length > 254 ||
        /[\r\n<>]/.test(from) || !/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(from) ||
        typeof apiKey !== "string" || apiKey.trim() !== apiKey || apiKey.length < 16 ||
        typeof fetcher !== "function") return false;

    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return !!result && typeof result === "object" &&
      typeof (result as { id?: unknown }).id === "string" &&
      /^[A-Za-z0-9_-]{4,128}$/.test((result as { id: string }).id);
  } catch {
    // Never log transport responses, API keys, address or bearer links.
    return false;
  }
}
