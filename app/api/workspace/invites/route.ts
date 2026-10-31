import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isProtectedWorkspaceStaging, isTrustedWorkspaceRequest } from "../../../../experiments/client-workspace-auth/src/workspace-runtime";
import type { ClientInvitationRole } from "../../../../experiments/client-workspace-auth/src/invite-issuance";

const HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set<ClientInvitationRole>([
  "client_viewer", "client_contributor", "client_approver", "client_signatory",
]);

function unavailable() { return new Response(null, {status:404,headers:HEADERS}); }
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const lengthHeader = request.headers.get("content-length");
  const length = lengthHeader === null ? null : Number(lengthHeader);
  if (length !== null && (!Number.isFinite(length) || length < 2 || length > 900)) return null;
  if (!request.body) return null;
  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 900) { await reader.cancel(); return null; }
        chunks.push(part.value);
      }
    } finally { try { reader.releaseLock(); } catch {} }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch { return null; }
}

/** Staff-only invitation issuance; the raw bearer never enters this response. */
export async function POST(request: Request): Promise<Response> {
  if (!isProtectedWorkspaceStaging() ||
      process.env.CLIENT_WORKSPACE_REAL_EMAILS_ENABLED !== "1" ||
      !isTrustedWorkspaceRequest(request) ||
      request.headers.has("authorization") || request.headers.has("range") ||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return unavailable();
  const body = await readBody(request);
  if (!body || Object.keys(body).sort().join(",") !== "email,projectId,role,tenantId" ||
      typeof body.email !== "string" || body.email.length > 254 ||
      typeof body.tenantId !== "string" || !UUID.test(body.tenantId) ||
      typeof body.projectId !== "string" || !UUID.test(body.projectId) ||
      typeof body.role !== "string" || !ROLES.has(body.role as ClientInvitationRole)) return unavailable();

  try {
    const [delivery, database, outbox, resend] = await Promise.all([
      import("../../../../experiments/client-workspace-auth/src/trusted-invitation-delivery"),
      import("../../../../experiments/client-workspace-auth/src/database"),
      import("../../../../experiments/client-workspace-auth/src/mail-delivery-outbox"),
      import("../../../../experiments/client-workspace-auth/src/resend-mailbox-transport"),
    ]);
    const sender = resend.createStagingResendMailboxTransport();
    if (!sender) return unavailable();
    const authDb = database.getAuthPrisma();
    const queued = await delivery.dispatchInvitationForVerifiedStaffRequest({
      headers: request.headers,
      tenantId: body.tenantId,
      projectId: body.projectId,
      intendedEmail: body.email,
      role: body.role as ClientInvitationRole,
      send: async message => {
        const inserted = await authDb.$transaction(tx => outbox.enqueueLocalMailboxMessage({
          tx,
          challengeId: message.idempotencyKey.slice("cw-invite-".length),
          message: {
            kind: "workspace_invitation",
            challengeId: message.idempotencyKey.slice("cw-invite-".length),
            to: message.to,
            subject: message.subject,
            text: message.text,
            idempotencyKey: message.idempotencyKey,
          },
        }));
        if (!inserted) return false;
        // Best-effort immediate send; the encrypted outbox remains durable
        // for the scheduled retry worker when Resend is temporarily unavailable.
        await outbox.deliverNextLocalMailboxMessage({authDb,send:sender});
        return true;
      },
    });
    return queued
      ? Response.json({queued:true},{status:202,headers:HEADERS})
      : unavailable();
  } catch {
    return unavailable();
  }
}

export const GET = unavailable;
export const OPTIONS = unavailable;
export const HEAD = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
