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

export async function authorizeValidatedWorkspaceAction(input: {
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
}): Promise<boolean> {
  try {
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
         AND kind = 'client'
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
