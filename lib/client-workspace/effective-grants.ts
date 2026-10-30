import "server-only";

import type { WorkspaceGrant, WorkspaceRole } from "./access-policy";
import { getWorkspacePrisma } from "./database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ROLES = new Set<WorkspaceRole>([
  "client_viewer",
  "client_contributor",
  "client_approver",
  "client_signatory",
]);
const STAFF_ROLES = new Set<WorkspaceRole>([
  "delivery_staff",
  "delivery_lead",
  "commercial_approver",
  "workspace_owner",
]);

type EffectiveGrantRow = {
  userId: string;
  tenantId: string;
  projectId: string;
  role: string;
};

/**
 * Loads grants only for one exact resource from a server-validated Better Auth
 * subject. This function does not authenticate the subject; no browser input or
 * identity-provider role claim may be used as a substitute for that check.
 */
export async function loadEffectiveWorkspaceGrants(input: {
  providerSubject: string;
  tenantId: string;
  projectId: string;
}): Promise<WorkspaceGrant[]> {
  const { providerSubject, tenantId, projectId } = input;
  if (typeof providerSubject !== "string" || providerSubject.length < 1 || providerSubject.length > 255 ||
      !UUID.test(tenantId) || !UUID.test(projectId)) {
    return [];
  }

  const prisma = getWorkspacePrisma();
  const rows = await prisma.$queryRaw<EffectiveGrantRow[]>`
    SELECT p.id::text AS "userId",
           g.tenant_id::text AS "tenantId",
           g.project_id::text AS "projectId",
           g.role
      FROM workspace_client_project_grants AS g
      JOIN workspace_client_memberships AS m
        ON m.tenant_id = g.tenant_id
       AND m.principal_id = g.principal_id
      JOIN workspace_principals AS p
        ON p.id = m.principal_id
       AND p.kind = m.principal_kind
      JOIN workspace_tenants AS t
        ON t.id = g.tenant_id
      JOIN workspace_projects AS project
        ON project.tenant_id = g.tenant_id
       AND project.id = g.project_id
     WHERE p.provider_subject = ${providerSubject}
       AND p.provider = 'better_auth'
       AND p.kind = 'client'
       AND p.status = 'active'
       AND t.status = 'active'
       AND m.status = 'active'
       AND m.revoked_at IS NULL
       AND g.status = 'active'
       AND g.revoked_at IS NULL
       AND g.tenant_id = ${tenantId}::uuid
       AND g.project_id = ${projectId}::uuid

    UNION ALL

    SELECT p.id::text AS "userId",
           g.tenant_id::text AS "tenantId",
           g.project_id::text AS "projectId",
           g.role
      FROM workspace_staff_project_grants AS g
      JOIN workspace_staff_memberships AS m
        ON m.principal_id = g.principal_id
      JOIN workspace_principals AS p
        ON p.id = m.principal_id
       AND p.kind = m.principal_kind
      JOIN workspace_tenants AS t
        ON t.id = g.tenant_id
      JOIN workspace_projects AS project
        ON project.tenant_id = g.tenant_id
       AND project.id = g.project_id
     WHERE p.provider_subject = ${providerSubject}
       AND p.provider = 'better_auth'
       AND p.kind = 'staff'
       AND p.status = 'active'
       AND t.status = 'active'
       AND m.status = 'active'
       AND m.revoked_at IS NULL
       AND g.status = 'active'
       AND g.revoked_at IS NULL
       AND g.tenant_id = ${tenantId}::uuid
       AND g.project_id = ${projectId}::uuid
  `;

  return rows.flatMap((row) => {
    const allowedRoles = row.role.startsWith("client_") ? CLIENT_ROLES : STAFF_ROLES;
    if (!allowedRoles.has(row.role as WorkspaceRole)) return [];
    return [{
      userId: row.userId,
      tenantId: row.tenantId,
      projectId: row.projectId,
      role: row.role as WorkspaceRole,
      status: "active" as const,
    }];
  });
}
