/**
 * Client Workspace access *policy*, not authentication or an authorization boundary.
 *
 * A future server MUST load actor and project grants from trusted session/DB state;
 * NEVER accept these objects or resource visibility from client input. It MUST also
 * authorize database queries and each object/version transition transactionally.
 * No production route currently calls this function.
 */
export type WorkspaceRole =
  | "client_viewer"
  | "client_contributor"
  | "client_approver"
  | "client_signatory"
  | "delivery_staff"
  | "delivery_lead"
  | "commercial_approver"
  | "workspace_owner";

export type WorkspaceAction =
  | "project.read_published"
  | "proposal.read_published"
  | "milestone.read_published"
  | "invoice.read_published"
  | "document.read_published"
  | "brief.edit"
  | "change.request"
  | "proposal.decide"
  | "milestone.accept"
  | "contract.sign"
  | "project.read_internal"
  | "brief.review"
  | "delivery.edit"
  | "estimate.approve"
  | "milestone.verify"
  | "progress.publish"
  | "proposal.approve_price"
  | "invoice.approve"
  | "payment.reconcile"
  | "proposal.release"
  | "project.activate"
  | "project.close";

const PUBLIC_READS = [
  "project.read_published", "proposal.read_published", "milestone.read_published",
  "invoice.read_published", "document.read_published",
] as const satisfies readonly WorkspaceAction[];

const ROLE_ACTIONS: Readonly<Record<WorkspaceRole, readonly WorkspaceAction[]>> = {
  client_viewer: PUBLIC_READS,
  client_contributor: [...PUBLIC_READS, "brief.edit", "change.request"],
  client_approver: [...PUBLIC_READS, "brief.edit", "change.request", "proposal.decide", "milestone.accept"],
  // Signing authority never inherits approval authority implicitly.
  client_signatory: [...PUBLIC_READS, "contract.sign"],
  delivery_staff: ["project.read_internal", "brief.review", "delivery.edit"],
  delivery_lead: ["project.read_internal", "brief.review", "delivery.edit", "estimate.approve", "milestone.verify", "progress.publish"],
  commercial_approver: ["project.read_internal", "proposal.approve_price", "invoice.approve", "payment.reconcile"],
  // Workspace owners are not automatically commercial or client signatories.
  workspace_owner: ["project.read_internal", "proposal.release", "project.activate", "project.close"],
};

// Reading client-facing records and taking contractual/client actions requires
// a published resource. Editing an initial client-owned brief is a distinct action.
const REQUIRES_PUBLICATION: ReadonlySet<WorkspaceAction> = new Set<WorkspaceAction>([
  ...PUBLIC_READS, "change.request", "proposal.decide", "milestone.accept", "contract.sign",
]);

export interface WorkspaceActor {
  userId: string;
  authenticated: boolean;
  status: "active" | "disabled";
}

export interface WorkspaceGrant {
  userId: string;
  tenantId: string;
  projectId: string;
  role: WorkspaceRole;
  status: "active" | "revoked";
}

export interface WorkspaceResource {
  tenantId: string;
  projectId: string;
  publication: "published" | "unpublished";
}

export interface WorkspaceAccessInput {
  actor: WorkspaceActor;
  grants: readonly WorkspaceGrant[];
  resource: WorkspaceResource;
  action: WorkspaceAction;
}

export type WorkspaceAccessDecision =
  | { allowed: true; reason: "explicit_project_grant" }
  | { allowed: false; reason: "unauthenticated" | "invalid_context" | "not_published" | "not_permitted" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
function knownAction(value: unknown): value is WorkspaceAction {
  return typeof value === "string" && Object.values(ROLE_ACTIONS).some(actions => actions.includes(value as WorkspaceAction));
}
function knownRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && Object.hasOwn(ROLE_ACTIONS, value);
}

/** Internal diagnostic reasons must never be exposed to untrusted clients. */
function evaluateWorkspaceAccessUnchecked(input: unknown): WorkspaceAccessDecision {
  if (!isRecord(input) || !isRecord(input.actor)) return { allowed: false, reason: "invalid_context" };
  const actor = input.actor;
  if (!validId(actor.userId) || actor.authenticated !== true || actor.status !== "active") {
    return { allowed: false, reason: "unauthenticated" };
  }
  if (!Array.isArray(input.grants) || !isRecord(input.resource) || !knownAction(input.action)) {
    return { allowed: false, reason: "invalid_context" };
  }
  const resource = input.resource;
  if (!validId(resource.tenantId) || !validId(resource.projectId) ||
      (resource.publication !== "published" && resource.publication !== "unpublished")) {
    return { allowed: false, reason: "invalid_context" };
  }
  if (REQUIRES_PUBLICATION.has(input.action) && resource.publication !== "published") {
    return { allowed: false, reason: "not_published" };
  }
  const permitted = input.grants.some((grant: unknown) =>
    isRecord(grant) && grant.status === "active" && knownRole(grant.role) &&
    validId(grant.userId) && validId(grant.tenantId) && validId(grant.projectId) &&
    grant.userId === actor.userId && grant.tenantId === resource.tenantId &&
    grant.projectId === resource.projectId && ROLE_ACTIONS[grant.role].includes(input.action as WorkspaceAction));
  return permitted ? { allowed: true, reason: "explicit_project_grant" } : { allowed: false, reason: "not_permitted" };
}

/** Malformed accessors or proxies fail closed instead of escaping as exceptions. */
export function evaluateWorkspaceAccess(input: unknown): WorkspaceAccessDecision {
  try {
    return evaluateWorkspaceAccessUnchecked(input);
  } catch {
    return { allowed: false, reason: "invalid_context" };
  }
}
