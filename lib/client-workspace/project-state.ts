import "server-only";

import { getWorkspacePrisma } from "./database";

export const WORKSPACE_PROJECT_STATES = [
  "planned",
  "active",
  "paused",
  "change_review",
  "handover",
  "closed",
] as const;

export type WorkspaceProjectState = (typeof WORKSPACE_PROJECT_STATES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WorkspaceStateConflict extends Error {
  constructor() {
    super("The project state changed or access is no longer active.");
    this.name = "WorkspaceStateConflict";
  }
}

/**
 * Persists an already-authorized staff state change and its audit event in one
 * serializable transaction. The caller must validate its session and use the
 * same exact tenant/project grant through evaluateWorkspaceAccess first.
 */
export async function recordProjectStateChange(input: {
  tenantId: string;
  projectId: string;
  actorPrincipalId: string;
  expectedRevision: bigint;
  nextState: WorkspaceProjectState;
  idempotencyKey: string;
}): Promise<bigint> {
  const validStates = WORKSPACE_PROJECT_STATES as readonly string[];
  if (!validStates.includes(input.nextState) || typeof input.expectedRevision !== "bigint" ||
      input.expectedRevision < 1n || !UUID.test(input.tenantId) || !UUID.test(input.projectId) ||
      !UUID.test(input.actorPrincipalId) || typeof input.idempotencyKey !== "string" ||
      input.idempotencyKey.trim().length < 1 || input.idempotencyKey.length > 128) {
    throw new TypeError("Invalid project state-change command.");
  }

  const prisma = getWorkspacePrisma();
  const permittedRoles = input.nextState === "active" || input.nextState === "closed"
    ? ["workspace_owner"]
    : ["delivery_staff", "delivery_lead"];
  return prisma.$transaction(async (transaction) => {
    const activeGrant = await transaction.workspaceStaffProjectGrant.findFirst({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        principalId: input.actorPrincipalId,
        status: "active",
        revokedAt: null,
        role: { in: permittedRoles },
        membership: {
          is: {
            status: "active",
            revokedAt: null,
            principal: { is: { kind: "staff", status: "active" } },
          },
        },
        project: { is: { tenant: { is: { status: "active" } } } },
      },
      select: { role: true },
    });
    if (!activeGrant) throw new WorkspaceStateConflict();

    const changed = await transaction.workspaceProject.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.projectId,
        revision: input.expectedRevision,
        tenant: { is: { status: "active" } },
      },
      data: {
        state: input.nextState,
        revision: { increment: 1n },
      },
    });
    if (changed.count !== 1) throw new WorkspaceStateConflict();

    const nextRevision = input.expectedRevision + 1n;
    await transaction.workspaceAuditEvent.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        actorPrincipalId: input.actorPrincipalId,
        origin: "person",
        action: "project.state_changed",
        objectType: "workspace_project",
        objectId: input.projectId,
        beforeRevision: input.expectedRevision,
        afterRevision: nextRevision,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return nextRevision;
  }, { isolationLevel: "Serializable" });
}
