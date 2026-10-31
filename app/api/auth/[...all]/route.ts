import "server-only";
import {
  isTrustedWorkspaceRequest, isLocalWorkspaceTest,
  isWorkspaceEnabled,
} from "../../../../experiments/client-workspace-auth/src/workspace-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  return isWorkspaceEnabled() && (!isLocalWorkspaceTest() ||
    (process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED === "1" &&
     process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED === "1"));
}

async function handle(request: Request): Promise<Response> {
  if (!enabled()) {
    if (process.env.RUN_NEXT_AUTH_INTEGRATION === "1") console.error("synthetic auth gate denied", { production: process.env.NODE_ENV === "production", authEnabled: process.env.AUTH_EXPERIMENT_ENABLED === "1", httpEnabled: process.env.WORKSPACE_CLIENT_HTTP_TEST_ENABLED === "1", routeEnabled: process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED === "1" });
    return unavailable();
  }
  try {
    const url = new URL(request.url);
    if (!isTrustedWorkspaceRequest(request) || !url.pathname.startsWith("/api/auth/") ||
        request.headers.has("authorization") || request.headers.has("range")) {
      if (process.env.RUN_NEXT_AUTH_INTEGRATION === "1") console.error("synthetic auth URL/header guard denied", { trustedRequest: isTrustedWorkspaceRequest(request), validPrefix: url.pathname.startsWith("/api/auth/"), hasAuthorization: request.headers.has("authorization"), hasRange: request.headers.has("range") });
      return unavailable();
    }
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
