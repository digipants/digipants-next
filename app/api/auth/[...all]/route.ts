import "server-only";

// Local integration seam only. The actual Better Auth config and database.ts
// explicitly reject production and any non-loopback connection; no deploy flag
// can turn this into a public customer auth service.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ORIGIN = "http://localhost:3000";
const NO_STORE = "private, no-store, no-cache, max-age=0, must-revalidate";

function unavailable(): Response {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": NO_STORE,
      "Pragma": "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

function enabled(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.AUTH_EXPERIMENT_ENABLED === "1" &&
    process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED === "1" &&
    process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED === "1";
}

async function handle(request: Request): Promise<Response> {
  if (!enabled()) return unavailable();
  try {
    const url = new URL(request.url);
    if (url.origin !== ORIGIN || !url.pathname.startsWith("/api/auth/") ||
        request.headers.has("authorization") || request.headers.has("range")) {
      return unavailable();
    }
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return unavailable();
    const origin = request.headers.get("origin");
    // POST is state-changing: do not allow requests with an absent Origin,
    // or any origin other than the only allowed local app origin.
    if (request.method === "POST" && origin !== ORIGIN) return unavailable();
    if (origin && origin !== ORIGIN) return unavailable();

    const { auth } = await import("../../../../experiments/client-workspace-auth/src/auth");
    const response = await auth.handler(request);
    // Some auth handlers return immutable Headers (especially cookie and
    // sign-out responses). Never mutate the provider's Response in place.
    // Reconstruct a response with the original body and Set-Cookie headers.
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", NO_STORE);
    headers.set("Pragma", "no-cache");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    if (process.env.RUN_NEXT_AUTH_INTEGRATION === "1" &&
        url.pathname === "/api/auth/sign-out" && !response.ok) {
      console.error("synthetic mounted sign-out provider status", response.status);
    }
    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers,
    });
  } catch (error) {
    if (process.env.RUN_NEXT_AUTH_INTEGRATION === "1") {
      // Test-only, deliberately excludes URL, cookies, body, subjects and
      // provider error messages. Never log authentication secrets.
      console.error("synthetic mounted auth adapter failure", error instanceof Error ? error.name : "unknown");
    }
    return unavailable();
  }
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = async () => unavailable();
export const HEAD = async () => unavailable();
export const PUT = async () => unavailable();
export const PATCH = async () => unavailable();
export const DELETE = async () => unavailable();
