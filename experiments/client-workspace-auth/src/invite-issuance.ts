import { randomBytes, randomUUID } from "node:crypto";
import { hashInvitationToken } from "./invitations.js";

// Isolated test-harness primitives. An authenticated/assured staff-session
// boundary DOES NOT EXIST in the application and must precede any real use.
// These functions never contact a mail provider or expose a public HTTP route.

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

/** Only the exact active project owner may issue or revoke a client invite. */
async function loadProjectIssuer(tx: SqlTransaction, input: {
  issuerSubject: string; tenantId: string; projectId: string;
}): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT p.id::text AS id
      FROM workspace_principals AS p
      JOIN workspace_staff_memberships AS sm ON sm.principal_id = p.id
      JOIN workspace_staff_project_grants AS g ON g.principal_id = p.id
      JOIN workspace_projects AS project ON project.id = g.project_id AND project.tenant_id = g.tenant_id
      JOIN workspace_tenants AS tenant ON tenant.id = project.tenant_id
     WHERE p.provider = 'better_auth'
       AND p.provider_subject = ${input.issuerSubject}
       AND p.kind = 'staff'
       AND p.status = 'active'
       AND sm.status = 'active'
       AND sm.revoked_at IS NULL
       AND g.status = 'active'
       AND g.revoked_at IS NULL
       AND g.role = 'workspace_owner'
       AND g.tenant_id = ${input.tenantId}::uuid
       AND g.project_id = ${input.projectId}::uuid
       AND tenant.status = 'active'
     LIMIT 1
     FOR SHARE OF p, sm, g, project, tenant
  `;
  return rows.length === 1 ? rows[0]!.id : null;
}

function validScope(input: { issuerSubject: string; tenantId: string; projectId: string }): boolean {
  return typeof input.issuerSubject === "string" &&
    input.issuerSubject.length >= 1 && input.issuerSubject.length <= 255 &&
    UUID.test(input.tenantId) && UUID.test(input.projectId);
}

/**
 * A synthetic test-only issuance core. The raw bearer exists only in the
 * return value for a FUTURE restricted server-side delivery channel; never
 * persist/log/return it from an untrusted endpoint. No membership is granted.
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
      const issuerId = await loadProjectIssuer(tx, input);
      if (!issuerId) return null;
      const inserted = await tx.$executeRaw`
        INSERT INTO workspace_invitation_records
          (id, tenant_id, project_id, intended_email, intended_role,
           invitation_token_hash, issued_by_staff_id, expires_at)
        VALUES
          (${id}::uuid, ${input.tenantId}::uuid, ${input.projectId}::uuid,
           ${email}, ${input.intendedRole}, ${digest},
           ${issuerId}::uuid, statement_timestamp() + interval '20 minutes')
      `;
      if (inserted !== 1) throw new Error("Invitation insert failed.");
      await tx.$executeRaw`
        INSERT INTO workspace_audit_events
          (tenant_id, project_id, actor_principal_id, origin, action,
           object_type, object_id, idempotency_key)
        VALUES
          (${input.tenantId}::uuid, ${input.projectId}::uuid, ${issuerId}::uuid,
           'person', 'invitation.issued', 'workspace_invitation', ${id}, ${randomUUID()})
      `;
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
      const issuerId = await loadProjectIssuer(tx, input);
      if (!issuerId) return false;
      const changed = await tx.$executeRaw`
        UPDATE workspace_invitation_records
           SET status = 'revoked'
         WHERE id = ${input.invitationId}::uuid
           AND tenant_id = ${input.tenantId}::uuid
           AND project_id = ${input.projectId}::uuid
           AND status = 'pending'
      `;
      if (changed !== 1) return false;
      await tx.$executeRaw`
        INSERT INTO workspace_audit_events
          (tenant_id, project_id, actor_principal_id, origin, action,
           object_type, object_id, idempotency_key)
        VALUES
          (${input.tenantId}::uuid, ${input.projectId}::uuid, ${issuerId}::uuid,
           'person', 'invitation.revoked', 'workspace_invitation',
           ${input.invitationId}, ${randomUUID()})
      `;
      return true;
    });
  } catch {
    return false;
  }
}
