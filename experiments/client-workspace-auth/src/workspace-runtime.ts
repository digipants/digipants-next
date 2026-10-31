/**
 * The Client Workspace is enabled only in two explicit contexts:
 * - the existing localhost/CI security harness; or
 * - the protected Netlify staging project pinned to the reviewed workspace
 *   branch, with site-scoped staging credentials.
 * A generic production build, deploy preview, or changed NODE_ENV is not enough.
 */
export type WorkspaceRuntimeMode = "disabled" | "local-test" | "protected-staging";

const STAGING_BRANCH = "feat/client-workspace-mail-abuse-gates-117";
const STAGING_ORIGIN = "https://digipants-client-workspace-staging.netlify.app";

export function workspaceRuntimeMode(
  env: NodeJS.ProcessEnv = process.env,
): WorkspaceRuntimeMode {
  if (env.NODE_ENV !== "production" && env.AUTH_EXPERIMENT_ENABLED === "1") {
    return "local-test";
  }

  if (env.NODE_ENV !== "production" ||
      env.CLIENT_WORKSPACE_ENABLED !== "1" ||
      env.CLIENT_WORKSPACE_ENVIRONMENT !== "staging" ||
      env.CONTEXT !== "production" ||
      env.BRANCH !== STAGING_BRANCH ||
      env.CLIENT_WORKSPACE_ORIGIN !== STAGING_ORIGIN ||
      env.URL !== STAGING_ORIGIN) {
    return "disabled";
  }

  return "protected-staging";
}

export function isWorkspaceEnabled(): boolean {
  return workspaceRuntimeMode() !== "disabled";
}

export function isProtectedWorkspaceStaging(): boolean {
  return workspaceRuntimeMode() === "protected-staging";
}

export function isLocalWorkspaceTest(): boolean {
  return workspaceRuntimeMode() === "local-test";
}

export function workspaceOrigin(): string | null {
  const mode = workspaceRuntimeMode();
  if (mode === "local-test") return "http://localhost:3000";
  if (mode === "protected-staging") return STAGING_ORIGIN;
  return null;
}

/** Reject host confusion and cross-site state changes before application code. */
export function isTrustedWorkspaceRequest(request: Request): boolean {
  try {
    const expectedOrigin = workspaceOrigin();
    if (!expectedOrigin) return false;
    const expected = new URL(expectedOrigin);
    const url = new URL(request.url);
    const requestHost = request.headers.get("host");
    if (url.origin !== expectedOrigin ||
        (requestHost && requestHost.toLowerCase() !== expected.host.toLowerCase())) {
      return false;
    }
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
    const origin = request.headers.get("origin");
    const stateChanging = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
    return stateChanging ? origin === expectedOrigin : (!origin || origin === expectedOrigin);
  } catch {
    return false;
  }
}

/** Runtime URLs are always restricted logins over Neon transaction pooling. */
export function assertStagingRuntimeDatabaseUrl(
  value: string | undefined,
  expectedDatabase: string,
  variableName: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (workspaceRuntimeMode(env) !== "protected-staging" || !value) {
    throw new Error(`${variableName} is available only to the protected staging runtime.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a PostgreSQL pooler URL.`);
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  const username = decodeURIComponent(url.username);
  const expectedLogin = variableName === "WORKSPACE_DATABASE_URL"
    ? "cw_workspace_app"
    : variableName === "AUTH_DATABASE_URL" ? "cw_auth_app" : null;
  if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      !url.hostname.endsWith(".neon.tech") ||
      !url.hostname.includes("-pooler.") ||
      database !== expectedDatabase ||
      username !== expectedLogin ||
      url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error(`${variableName} must use the dedicated restricted staging login, the expected database, Neon transaction pooling, and full TLS verification.`);
  }
  return value;
}
