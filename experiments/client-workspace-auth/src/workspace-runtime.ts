/**
 * The Client Workspace is enabled only in two explicit contexts:
 * - the existing localhost/CI security harness; or
 * - the password-protected Netlify staging project, pinned by its immutable
 *   site id and exact HTTPS origin; or
 * - the live DigiPants site, pinned by a separate production gate, site id,
 *   origin, database identities and secrets.
 * Generic production builds and deploy previews remain disabled.
 */
export type WorkspaceRuntimeMode = "disabled" | "local-test" | "protected-staging" | "production";

const STAGING_ORIGIN = "https://digipants-client-workspace-staging.netlify.app";
const STAGING_SITE_ID = "ebafda7a-e6c5-48e4-a44d-daf0f5943d43";
const STAGING_HOST = new URL(STAGING_ORIGIN).hostname;
const PRODUCTION_ORIGIN = "https://digipants.com";
const PRODUCTION_SITE_ID = "837d4464-7eb6-4a1f-b4ef-3a44a2829d79";
const PRODUCTION_HOST = new URL(PRODUCTION_ORIGIN).hostname;

function isStagingNetlifyUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === STAGING_HOST && !url.port &&
      url.pathname === "/" && !url.username && !url.password &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
}

function isProductionNetlifyUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === PRODUCTION_HOST && !url.port &&
      url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function workspaceRuntimeMode(
  env: NodeJS.ProcessEnv = process.env,
): WorkspaceRuntimeMode {
  if (env.NODE_ENV !== "production" && env.AUTH_EXPERIMENT_ENABLED === "1") {
    return "local-test";
  }

  if (env.NODE_ENV !== "production" || env.CLIENT_WORKSPACE_ENABLED !== "1") return "disabled";
  if (env.CLIENT_WORKSPACE_ENVIRONMENT === "staging" &&
      env.SITE_ID === STAGING_SITE_ID &&
      env.CLIENT_WORKSPACE_ORIGIN === STAGING_ORIGIN &&
      isStagingNetlifyUrl(env.URL)) return "protected-staging";
  if (env.CLIENT_WORKSPACE_ENVIRONMENT === "production" &&
      env.CLIENT_WORKSPACE_PRODUCTION_ENABLED === "1" &&
      env.SITE_ID === PRODUCTION_SITE_ID &&
      env.CLIENT_WORKSPACE_ORIGIN === PRODUCTION_ORIGIN &&
      isProductionNetlifyUrl(env.URL)) return "production";
  return "disabled";
}

export function isWorkspaceEnabled(): boolean {
  return workspaceRuntimeMode() !== "disabled";
}

export function isProtectedWorkspaceStaging(): boolean {
  return workspaceRuntimeMode() === "protected-staging";
}

export function isProductionWorkspace(env: NodeJS.ProcessEnv = process.env): boolean {
  return workspaceRuntimeMode(env) === "production";
}

export function isActiveWorkspaceRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = workspaceRuntimeMode(env);
  return mode === "protected-staging" || mode === "production";
}

export function usesSecureWorkspaceCookies(env: NodeJS.ProcessEnv = process.env): boolean {
  return workspaceRuntimeMode(env) !== "local-test";
}

export function workspaceAuthSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const mode = workspaceRuntimeMode(env);
  return mode === "production" ? env.PRODUCTION_BETTER_AUTH_SECRET : env.BETTER_AUTH_SECRET;
}

export function isLocalWorkspaceTest(): boolean {
  return workspaceRuntimeMode() === "local-test";
}

export function workspaceOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const mode = workspaceRuntimeMode(env);
  if (mode === "local-test") return "http://localhost:3000";
  if (mode === "protected-staging") return STAGING_ORIGIN;
  if (mode === "production") return PRODUCTION_ORIGIN;
  return null;
}

/** Reject host confusion and cross-site state changes before application code. */
export function isTrustedWorkspaceRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    const expectedOrigin = workspaceOrigin(env);
    if (!expectedOrigin) return false;
    const expected = new URL(expectedOrigin);
    const url = new URL(request.url);
    const requestHost = request.headers.get("host");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto")
      ?.split(",", 1)[0]?.trim().toLowerCase();
    const directOriginMatches = url.origin === expectedOrigin;
    const mode = workspaceRuntimeMode(env);
    const trustedNetlifyOriginMatches = (mode === "protected-staging" || mode === "production") &&
      url.protocol === "https:" &&
      requestHost?.toLowerCase() === expected.host.toLowerCase() &&
      forwardedHost?.toLowerCase() === expected.host.toLowerCase() &&
      forwardedProto === "https";
    if ((!directOriginMatches && !trustedNetlifyOriginMatches) ||
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
  return assertRestrictedPooledDatabaseUrl(value, expectedDatabase, variableName,
    variableName === "WORKSPACE_DATABASE_URL" ? "cw_workspace_app" :
      variableName === "AUTH_DATABASE_URL" ? "cw_auth_app" : null);
}

export function assertProductionRuntimeDatabaseUrl(
  value: string | undefined,
  expectedDatabase: string,
  variableName: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (workspaceRuntimeMode(env) !== "production" || !value) {
    throw new Error(`${variableName} is available only to the explicitly enabled production runtime.`);
  }
  return assertRestrictedPooledDatabaseUrl(value, expectedDatabase, variableName,
    variableName === "PRODUCTION_WORKSPACE_DATABASE_URL" ? "cw_workspace_prod_app" :
      variableName === "PRODUCTION_AUTH_DATABASE_URL" ? "cw_auth_prod_app" : null);
}

function assertRestrictedPooledDatabaseUrl(
  value: string | undefined,
  expectedDatabase: string,
  variableName: string,
  expectedLogin: string | null,
): string {
  if (!value) throw new Error(`${variableName} is required for the enabled workspace runtime.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a PostgreSQL pooler URL.`);
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  const username = decodeURIComponent(url.username);
  if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      !url.hostname.endsWith(".neon.tech") ||
      !url.hostname.includes("-pooler.") ||
      database !== expectedDatabase ||
      username !== expectedLogin ||
      url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error(`${variableName} must use its environment-specific restricted login, the expected database, Neon transaction pooling, and full TLS verification.`);
  }
  return value;
}
