import "server-only";
import type { WorkspaceAction, WorkspaceResource } from "../../../lib/client-workspace/access-policy.js";
// This isolated test package runs Node ESM through tsx; importing the source
// extension avoids treating the repository's type=commonjs TS file as a
// CommonJS default export during native ESM linking.
import { loadEffectiveWorkspaceGrants } from "../../../lib/client-workspace/effective-grants.ts";
import { auth } from "./auth.js";
import { getAuthPrisma, getWorkspacePrisma } from "./database.js";
import { authorizeValidatedWorkspaceAction, authorizeValidatedStaffWorkspaceAction } from "./workspace-access-core.js";

/**
 * Server-only, fixture-scope access seam. The caller supplies incoming request
 * headers; Better Auth validates the session and its DB marker before grants
 * are queried. No route in the live Next.js app imports this module.
 */
export type WorkspaceRequestAction = {
  headers: Headers;
  tenantId: string;
  projectId: string;
  action: WorkspaceAction;
  publication: WorkspaceResource["publication"];
};

/**
 * In this experiment a server-owned Better Auth session is required before
 * either client or staff authorization. No HTTP route imports these helpers.
 */
async function authorizeFromVerifiedSession(input: WorkspaceRequestAction, staff: boolean): Promise<boolean> {
  try {
    const current = await auth.api.getSession({ headers: input.headers });
    if (!current?.session?.id || !current.user?.id) return false;
    return (staff ? authorizeValidatedStaffWorkspaceAction : authorizeValidatedWorkspaceAction)({
      sessionId: current.session.id,
      providerSubject: current.user.id,
      tenantId: input.tenantId,
      projectId: input.projectId,
      action: input.action,
      publication: input.publication,
      authDb: getAuthPrisma(),
      workspaceDb: getWorkspacePrisma(),
      loadEffectiveGrants: loadEffectiveWorkspaceGrants,
    });
  } catch {
    return false;
  }
}

export async function authorizeWorkspaceAction(input: WorkspaceRequestAction): Promise<boolean> {
  return authorizeFromVerifiedSession(input, false);
}

export async function authorizeStaffWorkspaceAction(input: WorkspaceRequestAction): Promise<boolean> {
  return authorizeFromVerifiedSession(input, true);
}
