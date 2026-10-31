import { randomBytes, randomUUID } from "node:crypto";
import { hashInvitationToken } from "./invitations.js";

// Invitation records are written only through narrow SECURITY DEFINER
// functions. The caller must still establish the authenticated staff session
// and fresh-MFA assurance before using this core.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set([
  "client_viewer", "client_contributor", "client_approver", "client_signatory",
]);
export type ClientInvitationRole =
  | "client_viewer" | "client_contributor" | "client_approver" | "client_signatory";

type SqlTransaction = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};
export type WorkspaceInvitationDb = {
  $transaction<T>(operation: (tx: SqlTransaction) => Promise<T>): Promise<T>;
};

export function normalizeInvitedEmail(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 5 || value.length > 254 ||
      value !== value.trim() || /[\r\n\t ]/.test(value)) return null;
  const normalized = value.toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(normalized)) return null;
  const [local, domain] = normalized.split("@");
  if (!local || local.length > 64 || local.startsWith(".") ||
      local.endsWith(".") || local.includes("..") || !domain) return null;
  const labels = domain.split(".");
  if (labels.some(label => !label || label.length > 63 ||
      label.startsWith("-") || label.endsWith("-"))) return null;
  return normalized;
}

function validScope(input: { issuerSubject: string; tenantId: string; projectId: string }): boolean {
  return typeof input.issuerSubject === "string" &&
    input.issuerSubject.length >= 1 && input.issuerSubject.length <= 255 &&
    UUID.test(input.tenantId) && UUID.test(input.projectId);
}

/**
 * The raw bearer exists only in this server-side return value for immediate
 * encrypted delivery. It is never returned by an HTTP route or persisted.
 * Issuance does not itself grant project membership.
 */
export async function issueClientInvitation(input: {
  workspaceDb: WorkspaceInvitationDb;
  issuerSubject: string;
  tenantId: string;
  projectId: string;
  intendedEmail: string;
  intendedRole: ClientInvitationRole;
}): Promise<{ id: string; token: string; email: string } | null> {
  const email = normalizeInvitedEmail(input.intendedEmail);
  if (!validScope(input) || !email || !ROLES.has(input.intendedRole)) return null;
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const digest = hashInvitationToken(token);
  try {
    return await input.workspaceDb.$transaction(async tx => {
      const issued = await tx.$queryRaw<Array<{ id: string | null }>>`
        SELECT public.cw_issue_client_invitation(
          ${id}::uuid, ${input.issuerSubject}, ${input.tenantId}::uuid,
          ${input.projectId}::uuid, ${email}, ${input.intendedRole}, ${digest}
        )::text AS id
      `;
      if (issued[0]?.id !== id) throw new Error("Invitation issuance was not authorized.");
      return { id, token, email };
    });
  } catch {
    return null;
  }
}

/** Revocation is scoped to an active owner and produces an atomic audit row. */
export async function revokeClientInvitation(input: {
  workspaceDb: WorkspaceInvitationDb;
  issuerSubject: string;
  tenantId: string;
  projectId: string;
  invitationId: string;
}): Promise<boolean> {
  if (!validScope(input) || !UUID.test(input.invitationId)) return false;
  try {
    return await input.workspaceDb.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ revoked: boolean }>>`
        SELECT public.cw_revoke_client_invitation(
          ${input.issuerSubject}, ${input.tenantId}::uuid,
          ${input.projectId}::uuid, ${input.invitationId}::uuid
        ) AS revoked
      `;
      return rows[0]?.revoked === true;
    });
  } catch {
    return false;
  }
}
