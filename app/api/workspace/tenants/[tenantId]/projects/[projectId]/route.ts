import "server-only";
import {
  isLocalWorkspaceTest, isWorkspaceEnabled,
} from "../../../../../../../experiments/client-workspace-auth/src/workspace-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_DATA_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'",
};

function unavailable(): Response {
  return new Response(null, { status: 404, headers: NO_DATA_HEADERS });
}

function workspacePilotEnabled(): boolean {
  return isWorkspaceEnabled() && (!isLocalWorkspaceTest() ||
    (process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED === "1" &&
     process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED === "1"));
}

/** Never permit a caller-controlled identity or an unreviewed production DB. */
export async function GET(request: Request): Promise<Response> {
  if (!workspacePilotEnabled()) return unavailable();
  try {
    // Import only after the route gate. database.ts independently verifies
    // exact protected staging context and restricted pooled database logins.
    const { handleClientProjectHttpRequest } = await import(
      "../../../../../../../experiments/client-workspace-auth/src/client-project-http"
    );
    return await handleClientProjectHttpRequest(request);
  } catch {
    return unavailable();
  }
}

// Return the identical empty response for method probes, not JSON or a
// redirect that could accidentally leak the existence of a project.
export const POST = async () => unavailable();
export const PUT = async () => unavailable();
export const PATCH = async () => unavailable();
export const DELETE = async () => unavailable();
export const OPTIONS = async () => unavailable();
export const HEAD = async () => unavailable();
