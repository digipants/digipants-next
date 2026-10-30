import { createRequire } from "node:module";
import type { WorkspaceAction, WorkspaceResource, WorkspaceGrant } from "../../../lib/client-workspace/access-policy.ts";
import { maxMfaAgeSecondsForAction } from "./mfa-freshness.js";

// The repository is CommonJS-scoped while this isolated package is ESM. Load
// the shared TypeScript policy through tsx's CommonJS hook instead of asking
// Node's ESM loader to reinterpret a CommonJS-scoped .ts module.
const { evaluateWorkspaceAccess } = createRequire(import.meta.url)(
  "../../../lib/client-workspace/access-policy.ts",
) as typeof import("../../../lib/client-workspace/access-policy.ts");

type RawSqlClient = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

const STAFF_ACTIONS: ReadonlySet<WorkspaceAction> = new Set([
  "project.read_internal", "brief.review", "delivery.edit", "estimate.approve",
  "milestone.verify", "progress.publish", "proposal.approve_price",
  "invoice.approve", "payment.reconcile", "proposal.release",
  "project.activate", "project.close",
]);

export type AuthenticatedWorkspaceInput = {
  sessionId: string;
  providerSubject: string;
  tenantId: string;
  projectId: string;
  action: WorkspaceAction;
  publication: WorkspaceResource["publication"];
  authDb: RawSqlClient;
  workspaceDb: RawSqlClient;
  loadEffectiveGrants: (query: {
    providerSubject: string;
    tenantId: string;
    projectId: string;
  }) => Promise<WorkspaceGrant[]>;
};

async function authorizeKind(
  input: AuthenticatedWorkspaceInput,
  kind: "client" | "staff",
): Promise<boolean> {
  try {
    // Do not silently inherit client roles as staff permissions.
    if (kind === "staff" && !STAFF_ACTIONS.has(input.action)) return false;
    // No browser-supplied assurance and no permissive fallback for new actions.
    // Use the PostgreSQL server clock to compare a persisted MFA challenge
    // timestamp, not the client's local time or an unsigned session claim.
    const maxAgeSeconds = maxMfaAgeSecondsForAction(input.action);
    if (maxAgeSeconds === null) return false;
    const assurance = await input.authDb.$queryRaw<Array<{ userId: string }>>`
      SELECT s.user_id AS "userId"
        FROM auth_spike.session AS s
        JOIN auth_spike."user" AS u ON u.id = s.user_id
        JOIN auth_spike."twoFactor" AS f ON f.user_id = u.id AND f.verified = true
       WHERE s.id = ${input.sessionId}
         AND s.user_id = ${input.providerSubject}
         AND u.two_factor_enabled = true
         AND s.expires_at > statement_timestamp()
         AND s.mfa_verified_at IS NOT NULL
         AND s.mfa_verified_at <= statement_timestamp()
         AND s.mfa_verified_at >= statement_timestamp() - (${maxAgeSeconds} * interval '1 second')
       LIMIT 1
    `;
    if (assurance.length !== 1) return false;

    const principals = await input.workspaceDb.$queryRaw<Array<{ id: string; status: "active" | "disabled" }>>`
      SELECT id::text AS id, status
        FROM workspace_principals
       WHERE provider = 'better_auth'
         AND provider_subject = ${input.providerSubject}
         AND kind = ${kind}
       LIMIT 1
    `;
    const principal = principals[0];
    if (!principal || principal.status !== "active") return false;

    const grants = await input.loadEffectiveGrants({
      providerSubject: input.providerSubject,
      tenantId: input.tenantId,
      projectId: input.projectId,
    });
    return evaluateWorkspaceAccess({
      actor: { userId: principal.id, authenticated: true, status: "active" },
      grants,
      resource: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        publication: input.publication,
      },
      action: input.action,
    }).allowed;
  } catch {
    return false;
  }
}

/** Client actions remain bound to an active client principal. */
export async function authorizeValidatedWorkspaceAction(
  input: AuthenticatedWorkspaceInput,
): Promise<boolean> {
  return authorizeKind(input, "client");
}

/**
 * Isolated staff-only grant gate. The caller MUST already have independently
 * verified its Better Auth session; this function alone does not enroll staff
 * or authenticate a bearer cookie. No production route imports it.
 */
export async function authorizeValidatedStaffWorkspaceAction(
  input: AuthenticatedWorkspaceInput,
): Promise<boolean> {
  return authorizeKind(input, "staff");
}
