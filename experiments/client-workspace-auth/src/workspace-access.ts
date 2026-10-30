import "server-only";
import type { WorkspaceAction, WorkspaceResource } from "../../../lib/client-workspace/access-policy.js";
import { loadEffectiveWorkspaceGrants } from "../../../lib/client-workspace/effective-grants.js";
import { auth } from "./auth.js";
import { getAuthPrisma, getWorkspacePrisma } from "./database.js";
import { authorizeValidatedWorkspaceAction } from "./workspace-access-core.js";

/**
 * Server-only, fixture-scope access seam. The caller supplies incoming request
 * headers; Better Auth validates the session and its DB marker before grants
 * are queried. No route in the live Next.js app imports this module.
 */
export async function authorizeWorkspaceAction(input: {
  headers: Headers;
  tenantId: string;
  projectId: string;
  action: WorkspaceAction;
  publication: WorkspaceResource["publication"];
}): Promise<boolean> {
  try {
    const current = await auth.api.getSession({ headers: input.headers });
    if (!current?.session?.id || !current.user?.id) return false;
    return authorizeValidatedWorkspaceAction({
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
