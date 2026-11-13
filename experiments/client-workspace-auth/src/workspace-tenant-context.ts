import "server-only";

import { createHmac } from "node:crypto";
import { workspaceRlsContextKey } from "./workspace-runtime.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT = /^[A-Za-z0-9_-]{1,255}$/;
const PURPOSE = /^[a-z][a-z0-9_.-]{0,47}$/;

type ContextSql = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type WorkspaceAuthorizationContext = Readonly<{
  tenantId: string;
  projectId: string | null;
  actorSubject: string | null;
  purpose: string;
}>;

/**
 * Bind one request's verified authorization scope to this PostgreSQL
 * transaction. A caller-set tenant GUC alone is never accepted by RLS.
 */
export async function setWorkspaceAuthorizationContext(
  tx: ContextSql,
  context: WorkspaceAuthorizationContext,
): Promise<void> {
  if (!UUID.test(context.tenantId) ||
      (context.projectId !== null && !UUID.test(context.projectId)) ||
      (context.actorSubject !== null && !SUBJECT.test(context.actorSubject)) ||
      !PURPOSE.test(context.purpose)) {
    throw new Error("Invalid Workspace authorization context.");
  }

  const rows = await tx.$queryRaw<Array<{ transactionId: string }>>`
    SELECT pg_current_xact_id()::text AS "transactionId"
  `;
  const transactionId = rows[0]?.transactionId;
  if (!transactionId || !/^\d{1,20}$/.test(transactionId)) {
    throw new Error("Workspace authorization context could not bind to the current transaction.");
  }

  const payload = [
    "v1", transactionId, context.tenantId, context.projectId ?? "",
    context.actorSubject ?? "", context.purpose,
  ].join("|");
  const payloadBytes = Buffer.from(payload, "utf8");
  const encoded = payloadBytes.toString("hex");
  const signature = createHmac("sha256", workspaceRlsContextKey())
    .update(payloadBytes).digest("hex");
  const token = `${encoded}.${signature}`;

  await tx.$queryRaw`
    SELECT set_config('app.workspace_tenant_id', ${context.tenantId}, true),
           set_config('app.workspace_context_token', ${token}, true)
  `;
}
