import {
  isActiveWorkspaceRuntime, isProductionWorkspace,
} from "../../experiments/client-workspace-auth/src/workspace-runtime.js";

/**
 * Drain a small bounded batch of encrypted transactional mail messages.
 * This scheduled handler is dormant unless the isolated staging project,
 * exact reviewed branch and explicit email-delivery gate all match.
 * It connects directly to the restricted staging auth database; it does not
 * make a public HTTP request that would need to bypass Netlify site password.
 */
export default async function workspaceMailOutboxDrain(): Promise<Response> {
  const realEmailsEnabled = process.env.CLIENT_WORKSPACE_REAL_EMAILS_ENABLED === "1";
  const founderEmailEnabled = process.env.CLIENT_WORKSPACE_FOUNDER_EMAIL_ENABLED === "1";
  const production = isProductionWorkspace();
  const productionEmailEnabled = process.env.CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED === "1";
  if (!isActiveWorkspaceRuntime() ||
      (production ? !productionEmailEnabled : (!realEmailsEnabled && !founderEmailEnabled))) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const [database, outbox, resend] = await Promise.all([
      import("../../experiments/client-workspace-auth/src/database.js"),
      import("../../experiments/client-workspace-auth/src/mail-delivery-outbox.js"),
      import("../../experiments/client-workspace-auth/src/resend-mailbox-transport.js"),
    ]);
    const authDb = database.getAuthPrisma();
    const founderOnly = !production && !realEmailsEnabled && founderEmailEnabled;
    const send = resend.createWorkspaceResendMailboxTransport(
      founderOnly ? "founder-bootstrap" : "all",
    );
    if (!send) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

    // Two eight-second provider calls plus DB work stay below Netlify's
    // scheduled-function execution limit. The outbox owns leases, expiry,
    // exact provider idempotency keys, retry timing and payload erasure.
    for (let count = 0; count < 2; count += 1) {
      const outcome = await outbox.deliverNextLocalMailboxMessage({
        authDb,
        send,
        ...(founderOnly ? { allowedKind: "founder_bootstrap" as const } : {}),
      });
      if (outcome === "idle" || outcome === "retry") break;
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Provider payloads, recipients, credentials and DB values stay out of logs.
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const config = { schedule: "*/1 * * * *" };
