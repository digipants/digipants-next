import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import {
  allowSyntheticMutation, issueSyntheticCsrfToken,
} from "../../../../../experiments/client-workspace-auth/src/enrollment-request-guard";
import {
  dispatchFounderBootstrapProof, founderBootstrapEnabled,
} from "../../../../../experiments/client-workspace-auth/src/founder-bootstrap";
import {
  isLocalWorkspaceTest, isProtectedWorkspaceStaging, isTrustedWorkspaceRequest,
  workspaceOrigin,
} from "../../../../../experiments/client-workspace-auth/src/workspace-runtime";
import { mailboxOutboxTestEnabled, type MailPayload } from "../../../../../experiments/client-workspace-auth/src/mail-delivery-outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ENDPOINT = "/api/workspace/founder/verification";
const RATE_SCOPE = "A".repeat(43);
const LOCAL_COOKIE_SID = "cw-local-founder-sid";
const LOCAL_COOKIE_CSRF = "cw-local-founder-csrf";
const STAGING_COOKIE_SID = "__Secure-cw-founder-sid";
const STAGING_COOKIE_CSRF = "__Secure-cw-founder-csrf";
const HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FounderMailSender = (message: MailPayload) => Promise<boolean>;

declare global {
  var __workspaceMailboxTestSender: FounderMailSender | undefined;
}

async function readFounderDiagnosticReadiness(email: string) {
  const readiness = {
    authDatabaseReachable: false,
    workspaceDatabaseReachable: false,
    founderEmailGateOpen: false,
  };
  try {
    const { getAuthPrisma } = await import("../../../../../experiments/client-workspace-auth/src/database");
    const rows = await getAuthPrisma().$queryRaw<Array<{ ready: boolean }>>`SELECT true AS ready`;
    readiness.authDatabaseReachable = rows[0]?.ready === true;
  } catch { /* Report only a false readiness flag. */ }
  try {
    const [{ getWorkspacePrisma }, { founderBootstrapIsOpen }] = await Promise.all([
      import("../../../../../experiments/client-workspace-auth/src/database"),
      import("../../../../../experiments/client-workspace-auth/src/founder-bootstrap"),
    ]);
    const workspaceDb = getWorkspacePrisma();
    const rows = await workspaceDb.$queryRaw<Array<{ ready: boolean }>>`SELECT true AS ready`;
    readiness.workspaceDatabaseReachable = rows[0]?.ready === true;
    readiness.founderEmailGateOpen = await founderBootstrapIsOpen({ workspaceDb, email });
  } catch { /* Report only false readiness flags. */ }
  return readiness;
}

function unavailable(): Response {
  return new Response(null, { status: 404, headers: HEADERS });
}

function enabled(): boolean {
  return founderBootstrapEnabled() && (isProtectedWorkspaceStaging() ||
    (isLocalWorkspaceTest() && process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED === "1"));
}

function baseRequest(request: Request, method: "GET" | "POST"): boolean {
  const origin = workspaceOrigin();
  try {
    const url = new URL(request.url);
    return !!origin && isTrustedWorkspaceRequest(request) &&
      (url.pathname === ENDPOINT || url.pathname === ENDPOINT + "/") &&
      !url.search && !url.hash && request.method === method &&
      !request.headers.has("authorization") &&
      !request.headers.has("range");
  } catch {
    return false;
  }
}

/** Opt-in staging diagnostics expose only guard outcomes, never request data. */
function logFounderPostGuard(
  stage: string,
  request: Request,
  details: Record<string, boolean> = {},
): void {
  if (process.env.CLIENT_WORKSPACE_DIAGNOSTICS !== "1" || !isProtectedWorkspaceStaging()) return;
  const expectedOrigin = workspaceOrigin();
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  const origin = request.headers.get("origin");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WORKSPACE_EMAIL_FROM;
  console.warn("workspace founder verification POST guard", {
    stage,
    workspaceEnabled: enabled(),
    trustedRequest: isTrustedWorkspaceRequest(request),
    baseRequestAllowed: baseRequest(request, "POST"),
    hostMatches: !!expectedOrigin && host?.toLowerCase() === new URL(expectedOrigin).host.toLowerCase(),
    forwardedHostMatches: !!expectedOrigin && forwardedHost?.toLowerCase() === new URL(expectedOrigin).host.toLowerCase(),
    forwardedProtoHttps: forwardedProto === "https",
    originMatches: !!expectedOrigin && origin === expectedOrigin,
    founderEmailGateEnabled: process.env.CLIENT_WORKSPACE_FOUNDER_EMAIL_ENABLED === "1",
    authSecretReady: !!process.env.BETTER_AUTH_SECRET && Buffer.byteLength(process.env.BETTER_AUTH_SECRET) >= 32,
    resendKeyPresent: !!apiKey,
    resendKeyShapeValid: !!apiKey && /^re_[A-Za-z0-9_-]{12,}$/.test(apiKey),
    senderPresent: !!from,
    senderShapeValid: !!from && /^(?:DigiPants Client Workspace <[A-Za-z0-9._%+-]+@digipants\.com>|[A-Za-z0-9._%+-]+@digipants\.com)$/i.test(from),
    ...details,
  });
}

function cookieValue(headers: Headers, name: string): string | null {
  const header = headers.get("cookie");
  if (!header || header.length > 2000) return null;
  for (const part of header.split(";")) {
    const pair = part.trim();
    const index = pair.indexOf("=");
    if (index > 0 && pair.slice(0, index) === name) return pair.slice(index + 1);
  }
  return null;
}

async function readSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 500) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch {
    return null;
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!enabled() || !baseRequest(request, "GET")) return unavailable();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) return unavailable();
  try {
    const sid = randomBytes(32).toString("base64url");
    const csrf = issueSyntheticCsrfToken({ secret, trustedSessionId: sid });
    const secure = isProtectedWorkspaceStaging() ? "; Secure" : "";
    const attrs = "; HttpOnly; SameSite=Strict; Path=/api/workspace/founder/verification; Max-Age=900" + secure;
    const sidName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_SID : LOCAL_COOKIE_SID;
    const csrfName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_CSRF : LOCAL_COOKIE_CSRF;
    const headers = new Headers(HEADERS);
    headers.append("Set-Cookie", sidName + "=" + sid + attrs);
    headers.append("Set-Cookie", csrfName + "=" + csrf + attrs);
    return Response.json({ csrf }, { status: 200, headers });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request): Promise<Response> {
  const diagnosticOnly = process.env.CLIENT_WORKSPACE_DIAGNOSTICS === "1" && isProtectedWorkspaceStaging();
  if (!enabled() || !baseRequest(request, "POST")) {
    logFounderPostGuard("request-guard", request);
    return unavailable();
  }
  if (isProtectedWorkspaceStaging() && process.env.CLIENT_WORKSPACE_FOUNDER_EMAIL_ENABLED !== "1") {
    logFounderPostGuard("founder-email-gate", request);
    return unavailable();
  }
  const sidName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_SID : LOCAL_COOKIE_SID;
  const csrfName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_CSRF : LOCAL_COOKIE_CSRF;
  const sid = cookieValue(request.headers, sidName);
  const csrfCookie = cookieValue(request.headers, csrfName);
  const secret = process.env.BETTER_AUTH_SECRET;
  const expectedOrigin = workspaceOrigin();
  const sessionIdValid = !!sid && /^[A-Za-z0-9_-]{43}$/.test(sid);
  const csrfAllowed = !!sessionIdValid && !!secret && !!expectedOrigin && allowSyntheticMutation({
        method: request.method,
        origin: request.headers.get("origin"),
        host: request.headers.get("host"),
        contentType: request.headers.get("content-type"),
        fetchSite: request.headers.get("sec-fetch-site"),
        csrfCookie,
        csrfHeader: request.headers.get("x-workspace-csrf"),
        expectedOrigin,
        secret,
        trustedSessionId: sid,
      });
  if (!sessionIdValid || !csrfAllowed) {
    logFounderPostGuard("csrf-guard", request, {
      sessionCookiePresent: !!sid,
      sessionIdShapeValid: sessionIdValid,
      csrfCookiePresent: !!csrfCookie,
      csrfHeaderPresent: !!request.headers.get("x-workspace-csrf"),
      csrfAllowed,
    });
    return unavailable();
  }

  const body = await readSmallJson(request);
  if (!body || Object.keys(body).join(",") !== "email" || typeof body.email !== "string" || body.email.length > 254) {
    logFounderPostGuard("body-guard", request, { bodyShapeValid: false });
    return unavailable();
  }
  // Diagnostic mode is a strict no-side-effect preflight. It exits before
  // quota accounting, database access, outbox writes, or transport creation.
  if (diagnosticOnly) {
    const readiness = await readFounderDiagnosticReadiness(body.email);
    logFounderPostGuard("preflight-ready", request, {
      bodyShapeValid: true,
      ...readiness,
      outboxRuntimeReady: mailboxOutboxTestEnabled(),
      databaseWriteSkipped: true,
      mailSendSkipped: true,
    });
    return unavailable();
  }
  const fakeChallenge = () => Response.json({ challengeId: randomUUID() }, { status: 202, headers: HEADERS });
  try {
    const [{ getAuthPrisma, getWorkspacePrisma }, { admitLocalMailboxRequest }] = await Promise.all([
      import("../../../../../experiments/client-workspace-auth/src/database"),
      import("../../../../../experiments/client-workspace-auth/src/mailbox-request-quota"),
    ]);
    const authDb = getAuthPrisma();
    if (!(await admitLocalMailboxRequest({
      authDb, sid, intendedEmail: body.email, invite: RATE_SCOPE,
    }))) return fakeChallenge();

    const sender = isProtectedWorkspaceStaging()
      ? (await import("../../../../../experiments/client-workspace-auth/src/resend-mailbox-transport")).createStagingResendMailboxTransport("founder-bootstrap")
      : process.env.RUN_WORKSPACE_MAIL_INTEGRATION === "1"
        ? globalThis.__workspaceMailboxTestSender : undefined;
    if (!sender) {
      logFounderPostGuard("sender-unavailable", request);
      return unavailable();
    }
    const result = await dispatchFounderBootstrapProof({
      workspaceDb: getWorkspacePrisma(),
      authDb,
      email: body.email,
      send: sender,
    });
    return Response.json({ challengeId: result && UUID.test(result.challengeId)
      ? result.challengeId : randomUUID() }, { status: 202, headers: HEADERS });
  } catch {
    return fakeChallenge();
  }
}

export const OPTIONS = async () => unavailable();
export const HEAD = async () => unavailable();
export const PUT = async () => unavailable();
export const PATCH = async () => unavailable();
export const DELETE = async () => unavailable();
