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
import type { MailPayload } from "../../../../../experiments/client-workspace-auth/src/mail-delivery-outbox";

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
    return !!origin && isTrustedWorkspaceRequest(request) && url.origin === origin &&
      (url.pathname === ENDPOINT || url.pathname === ENDPOINT + "/") &&
      !url.search && !url.hash && request.method === method &&
      !request.headers.has("authorization") && !request.headers.has("range");
  } catch {
    return false;
  }
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
  if (!enabled() || !baseRequest(request, "POST")) return unavailable();
  if (isProtectedWorkspaceStaging() && process.env.CLIENT_WORKSPACE_REAL_EMAILS_ENABLED !== "1") {
    return unavailable();
  }
  const sidName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_SID : LOCAL_COOKIE_SID;
  const csrfName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_CSRF : LOCAL_COOKIE_CSRF;
  const sid = cookieValue(request.headers, sidName);
  const csrfCookie = cookieValue(request.headers, csrfName);
  const secret = process.env.BETTER_AUTH_SECRET;
  const expectedOrigin = workspaceOrigin();
  if (!sid || !/^[A-Za-z0-9_-]{43}$/.test(sid) || !secret || !expectedOrigin ||
      !allowSyntheticMutation({
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
      })) return unavailable();

  const body = await readSmallJson(request);
  if (!body || Object.keys(body).join(",") !== "email" || typeof body.email !== "string" || body.email.length > 254) {
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
      ? (await import("../../../../../experiments/client-workspace-auth/src/resend-mailbox-transport")).createStagingResendMailboxTransport()
      : process.env.RUN_WORKSPACE_MAIL_INTEGRATION === "1"
        ? globalThis.__workspaceMailboxTestSender : undefined;
    if (!sender) return unavailable();
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
