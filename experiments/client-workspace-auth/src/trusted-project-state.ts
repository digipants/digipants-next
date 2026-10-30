import "server-only";

import type { WorkspaceProjectState } from "../../../lib/client-workspace/project-state.js";
import { auth } from "./auth.js";
import { getAuthPrisma, getWorkspacePrisma } from "./database.js";
import { maxMfaAgeSecondsForAction } from "./mfa-freshness.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES: readonly WorkspaceProjectState[] = ["planned", "active", "paused", "change_review", "handover", "closed"];

type Sql = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};
type WorkspaceTransaction = Sql;
type WorkspaceDatabase = Sql & {
  $transaction<T>(operation: (transaction: WorkspaceTransaction) => Promise<T>, options?: { isolationLevel?: "Serializable" }): Promise<T>;
};

export class TrustedProjectStateDenied extends Error {
  constructor() {
    super("The verified session, current MFA assurance, exact project grant, or project revision is no longer valid.");
    this.name = "TrustedProjectStateDenied";
  }
}

function debugTrustedStateFailure(error: unknown): void {
  if (process.env.AUTH_EXPERIMENT_DEBUG !== "1") return;
  const value = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; message?: unknown };
    cause?: { code?: unknown; message?: unknown };
  };
  const rawMessage = value?.meta?.message ?? value?.cause?.message ?? value?.message;
  const message = typeof rawMessage === "string"
    ? rawMessage
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "[uuid]")
      .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}/gi, "[email]")
      .replace(/trusted-state-[a-z0-9-]+/gi, "[test-key]")
      .slice(0, 180)
    : null;
  console.error("synthetic trusted-state diagnostic", {
    code: typeof value?.code === "string" ? value.code : null,
    databaseCode: typeof value?.meta?.code === "string" ? value.meta.code :
      typeof value?.cause?.code === "string" ? value.cause.code : null,
    message,
  });
}

function actionForState(state: WorkspaceProjectState): "project.activate" | "project.close" | "delivery.edit" {
  if (state === "active") return "project.activate";
  if (state === "closed") return "project.close";
  return "delivery.edit";
}

/**
 * Commits a staff transition after its caller has obtained the identity from
 * Better Auth's verified session API. The workspace transaction derives the
 * principal and permitted role from PostgreSQL, locks the exact active grant
 * chain against concurrent revocation, then writes state and audit together.
 * No tenant GUC, caller role, or caller-supplied principal ID is authoritative.
 */
export async function commitVerifiedStaffProjectStateChange(input: {
  sessionId: string;
  providerSubject: string;
  tenantId: string;
  projectId: string;
  expectedRevision: bigint;
  nextState: WorkspaceProjectState;
  idempotencyKey: string;
}): Promise<bigint> {
  let values: {
    sessionId: string; providerSubject: string; tenantId: string; projectId: string;
    expectedRevision: bigint; nextState: WorkspaceProjectState; idempotencyKey: string;
  };
  try {
    // Snapshot every caller-controlled field exactly once. A changing getter
    // must not validate one identity/scope and authorize a different one.
    values = {
      sessionId: input.sessionId,
      providerSubject: input.providerSubject,
      tenantId: input.tenantId,
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      nextState: input.nextState,
      idempotencyKey: input.idempotencyKey,
    };
  } catch {
    throw new TrustedProjectStateDenied();
  }
  if (!UUID.test(values.tenantId) || !UUID.test(values.projectId) ||
      typeof values.sessionId !== "string" || values.sessionId.length < 1 ||
      typeof values.providerSubject !== "string" || values.providerSubject.length < 1 || values.providerSubject.length > 255 ||
      typeof values.expectedRevision !== "bigint" || values.expectedRevision < 1n ||
      !STATES.includes(values.nextState) || typeof values.idempotencyKey !== "string" ||
      values.idempotencyKey.trim().length < 1 || values.idempotencyKey.length > 128) {
    throw new TypeError("Invalid trusted project-state command.");
  }

  const action = actionForState(values.nextState);
  const maxAgeSeconds = maxMfaAgeSecondsForAction(action);
  if (maxAgeSeconds === null) throw new TrustedProjectStateDenied();
  const authDb: Sql = getAuthPrisma();
  const workspaceDb: WorkspaceDatabase = getWorkspacePrisma() as unknown as WorkspaceDatabase;
  try {
    const assured = await authDb.$queryRaw<Array<{ userId: string }>>`
      SELECT s.user_id AS "userId"
        FROM auth_spike.session AS s
        JOIN auth_spike."user" AS u ON u.id = s.user_id
        JOIN auth_spike."twoFactor" AS f ON f.user_id = u.id AND f.verified = true
       WHERE s.id = ${values.sessionId}
         AND s.user_id = ${values.providerSubject}
         AND u.two_factor_enabled = true
         AND s.expires_at > statement_timestamp()
         AND s.mfa_verified_at IS NOT NULL
         AND s.mfa_verified_at <= statement_timestamp()
         AND s.mfa_verified_at >= statement_timestamp() - (${maxAgeSeconds} * interval '1 second')
       LIMIT 1
    `;
    if (assured.length !== 1) throw new TrustedProjectStateDenied();

    return await workspaceDb.$transaction(async (tx) => {
      // Select action-appropriate roles before touching the grant rows. FOR
      // SHARE makes a concurrent membership/grant revocation wait until this
      // authorized state+audit transaction finishes (or this transaction
      // fails). User input can choose the requested transition, never the role.
      const actors = await tx.$queryRaw<Array<{ principalId: string }>>`
        SELECT p.id::text AS "principalId"
          FROM workspace_principals AS p
          JOIN workspace_staff_memberships AS m ON m.principal_id = p.id
          JOIN workspace_staff_project_grants AS g ON g.principal_id = p.id
          JOIN workspace_tenants AS t ON t.id = g.tenant_id
          JOIN workspace_projects AS project
            ON project.tenant_id = g.tenant_id AND project.id = g.project_id
         WHERE p.provider = 'better_auth'
           AND p.provider_subject = ${values.providerSubject}
           AND p.kind = 'staff'
           AND p.status = 'active'
           AND m.principal_kind = 'staff'
           AND m.status = 'active'
           AND m.revoked_at IS NULL
           AND g.status = 'active'
           AND g.revoked_at IS NULL
           AND g.tenant_id = ${values.tenantId}::uuid
           AND g.project_id = ${values.projectId}::uuid
           AND t.status = 'active'
           AND ((${values.nextState}::text IN ('active', 'closed') AND g.role = 'workspace_owner')
             OR (${values.nextState}::text NOT IN ('active', 'closed') AND g.role IN ('delivery_staff', 'delivery_lead')))
         LIMIT 1
         FOR SHARE OF p, m, g, t, project
      `;
      const actor = actors[0];
      if (!actor) throw new TrustedProjectStateDenied();

      // This value scopes the defense-in-depth RLS policy only. It is set
      // after the verified subject's exact active grant has been locked, and
      // every following query still carries exact tenant/project predicates.
      await tx.$queryRaw`SELECT set_config('app.workspace_tenant_id', ${values.tenantId}, true)`;

      const changed = await tx.$executeRaw`
        UPDATE workspace_projects
           SET state = ${values.nextState}, revision = revision + 1
         WHERE tenant_id = ${values.tenantId}::uuid
           AND id = ${values.projectId}::uuid
           AND revision = ${values.expectedRevision}
           AND EXISTS (SELECT 1 FROM workspace_tenants WHERE id = ${values.tenantId}::uuid AND status = 'active')
      `;
      if (changed !== 1) throw new TrustedProjectStateDenied();

      const nextRevision = values.expectedRevision + 1n;
      const audit = await tx.$queryRaw<Array<{ appended: boolean }>>`
        SELECT NOT (cw_append_audit_event(
          ${values.tenantId}::uuid, ${values.projectId}::uuid, ${actor.principalId}::uuid,
          'person', 'project.state_changed', 'workspace_project', ${values.projectId},
          ${values.expectedRevision}, ${nextRevision}, ${values.idempotencyKey}) IS NULL) AS appended
      `;
      if (audit[0]?.appended !== true) throw new TrustedProjectStateDenied();
      return nextRevision;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof TrustedProjectStateDenied) throw error;
    debugTrustedStateFailure(error);
    throw new TrustedProjectStateDenied();
  }
}

/** Public seam for the isolated experiment: identity is read from Better Auth, never request fields. */
export async function changeProjectStateForVerifiedRequest(input: {
  headers: Headers;
  tenantId: string;
  projectId: string;
  expectedRevision: bigint;
  nextState: WorkspaceProjectState;
  idempotencyKey: string;
}): Promise<bigint> {
  try {
    const values = {
      headers: new Headers(input.headers),
      tenantId: input.tenantId,
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      nextState: input.nextState,
      idempotencyKey: input.idempotencyKey,
    };
    const current = await auth.api.getSession({ headers: values.headers });
    if (!current?.session?.id || !current.user?.id) throw new TrustedProjectStateDenied();
    return await commitVerifiedStaffProjectStateChange({
      sessionId: current.session.id,
      providerSubject: current.user.id,
      tenantId: values.tenantId,
      projectId: values.projectId,
      expectedRevision: values.expectedRevision,
      nextState: values.nextState,
      idempotencyKey: values.idempotencyKey,
    });
  } catch (error) {
    if (error instanceof TrustedProjectStateDenied) throw error;
    throw new TrustedProjectStateDenied();
  }
}
