import "server-only";

// This adapter is intentionally NOT mounted as a Next.js route. It exercises
// the complete Request -> Better Auth -> restricted PostgreSQL -> JSON boundary
// only in disposable local/CI environments. No production feature flag can
// override the NODE_ENV production hard stop.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PROJECT_PATH = new RegExp(
  "^/api/workspace/tenants/(" + UUID + ")/projects/(" + UUID + ")/?$",
  "i",
);
const EXPECTED_ORIGIN = "http://localhost:3000";

const PRIVATE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'",
});

function unavailable(): Response {
  return new Response(null, { status: 404, headers: PRIVATE_HEADERS });
}

function pilotHttpEnabled(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.AUTH_EXPERIMENT_ENABLED === "1" &&
    process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED === "1";
}

/**
 * No subject, role, tenant claim, MFA marker or email is read from untrusted
 * request headers. Only the URL's tenant/project IDs enter the reader, which
 * resolves a genuine Better Auth session and then enforces exact grants.
 *
 * A deny is indistinguishable for nonexistent, unpublished, revoked, expired
 * and cross-tenant projects. It returns no content, no redirect, no cookies,
 * no CORS allow-origin and no positive cache semantics.
 */
export async function handleClientProjectHttpRequest(request: Request): Promise<Response> {
  if (!pilotHttpEnabled() || request.method !== "GET") return unavailable();

  try {
    const url = new URL(request.url);
    if (url.origin !== EXPECTED_ORIGIN || url.search || url.hash ||
        request.headers.has("range") || request.headers.has("authorization")) return unavailable();

    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return unavailable();
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== EXPECTED_ORIGIN) return unavailable();

    const match = PROJECT_PATH.exec(url.pathname);
    if (!match) return unavailable();
    const tenantId = match[1]?.toLowerCase();
    const projectId = match[2]?.toLowerCase();
    if (!tenantId || !projectId) return unavailable();

    // Import only after the local-only guard. Any production request denies
    // BEFORE it can instantiate a credentialed auth/DB client.
    const { loadPublishedProjectForVerifiedRequest } = await import(
      "./trusted-published-project.js"
    );
    const project = await loadPublishedProjectForVerifiedRequest({
      headers: request.headers,
      tenantId,
      projectId,
    });

    return Response.json(
      { project: {
        id: project.id,
        title: project.title,
        state: project.state,
        revision: project.revision,
      } },
      { status: 200, headers: PRIVATE_HEADERS },
    );
  } catch {
    return unavailable();
  }
}
