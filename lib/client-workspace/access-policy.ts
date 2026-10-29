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
  if (!isRecord(input)) return { allowed: false, reason: "invalid_context" };

  // Read each untrusted top-level property once. All checks below operate on
  // these captured values, so accessors cannot swap identities or permissions
  // between validation and authorization.
  const actorInput = input.actor;
  const grantsInput = input.grants;
  const resourceInput = input.resource;
  const action = input.action;
  if (!isRecord(actorInput)) return { allowed: false, reason: "invalid_context" };

  // Snapshot each actor field before validating it. In particular, don't
  // validate a getter result and then read it again while matching a grant.
  const actorUserId = actorInput.userId;
  const actorAuthenticated = actorInput.authenticated;
  const actorStatus = actorInput.status;
  if (!validId(actorUserId) || actorAuthenticated !== true || actorStatus !== "active") {
    return { allowed: false, reason: "unauthenticated" };
  }
  if (!Array.isArray(grantsInput) || !isRecord(resourceInput) || !knownAction(action)) {
    return { allowed: false, reason: "invalid_context" };
  }

  const resourceTenantId = resourceInput.tenantId;
  const resourceProjectId = resourceInput.projectId;
  const resourcePublication = resourceInput.publication;
  if (!validId(resourceTenantId) || !validId(resourceProjectId) ||
      (resourcePublication !== "published" && resourcePublication !== "unpublished")) {
    return { allowed: false, reason: "invalid_context" };
  }
  if (REQUIRES_PUBLICATION.has(action) && resourcePublication !== "published") {
    return { allowed: false, reason: "not_published" };
  }

  // Array and record accessors are untrusted too. Copy each slot and each
  // grant field exactly once before evaluating permissions.
  const grantCount = grantsInput.length;
  if (!Number.isSafeInteger(grantCount) || grantCount < 0 || grantCount > 0xffff_ffff) {
    return { allowed: false, reason: "invalid_context" };
  }
  const grantSnapshots: Array<{
    userId: unknown;
    tenantId: unknown;
    projectId: unknown;
    role: unknown;
    status: unknown;
  } | null> = [];
  for (let index = 0; index < grantCount; index += 1) {
    const grant = grantsInput[index] as unknown;
    if (!isRecord(grant)) {
      grantSnapshots.push(null);
      continue;
    }
    const userId = grant.userId;
    const tenantId = grant.tenantId;
    const projectId = grant.projectId;
    const role = grant.role;
    const status = grant.status;
    grantSnapshots.push({ userId, tenantId, projectId, role, status });
  }

  const permitted = grantSnapshots.some(grant =>
    grant !== null && grant.status === "active" && knownRole(grant.role) &&
    validId(grant.userId) && validId(grant.tenantId) && validId(grant.projectId) &&
    grant.userId === actorUserId && grant.tenantId === resourceTenantId &&
    grant.projectId === resourceProjectId && ROLE_ACTIONS[grant.role].includes(action));
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
