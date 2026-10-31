import "server-only";

// This route is available only to the local test harness or exact protected
// staging runtime. Production and every deploy preview fail closed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { randomBytes } from "node:crypto";
import {
  allowSyntheticMutation, issueSyntheticCsrfToken,
} from "../../../../../experiments/client-workspace-auth/src/enrollment-request-guard";
import {
  isLocalWorkspaceTest, isProtectedWorkspaceStaging, isTrustedWorkspaceRequest,
  isWorkspaceEnabled, workspaceOrigin,
} from "../../../../../experiments/client-workspace-auth/src/workspace-runtime";

const ENDPOINT = "/api/workspace/invites/proof";
const LOCAL_COOKIE_SID = "cw-local-invite-sid";
const LOCAL_COOKIE_CSRF = "cw-local-invite-csrf";
const STAGING_COOKIE_SID = "__Secure-cw-invite-sid";
const STAGING_COOKIE_CSRF = "__Secure-cw-invite-csrf";
const MAX_BODY_BYTES = 900;
const HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'",
};

type MailSender = (message: {
  challengeId: string; to: string; subject: string;
  text: string; idempotencyKey: string;
}) => Promise<boolean>;

declare global {
  // A fake sender is injected only by disposable CI; it is never request data.
  var __workspaceMailboxTestSender: MailSender | undefined;
}

function unavailable(): Response {
  return new Response(null, { status: 404, headers: HEADERS });
}
function enabled(): boolean {
  return isProtectedWorkspaceStaging() || (isLocalWorkspaceTest() &&
    process.env.WORKSPACE_MAIL_PROOF_TEST_ENABLED === "1" &&
    process.env.WORKSPACE_NEXT_ROUTE_TEST_ENABLED === "1");
}
function baseRequest(request: Request, method: "GET" | "POST"): boolean {
  try {
    const expectedOrigin = workspaceOrigin();
    if (!expectedOrigin || !isTrustedWorkspaceRequest(request)) return false;
    const url = new URL(request.url);
    if (url.origin !== expectedOrigin ||
        (url.pathname !== ENDPOINT && url.pathname !== ENDPOINT + "/") ||
        url.search || url.hash || request.method !== method ||
        request.headers.has("authorization") || request.headers.has("range")) return false;
    return true;
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
    if (index > 0 && pair.slice(0,index) === name) return pair.slice(index+1);
  }
  return null;
}
async function readSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      count += part.value.byteLength;
      if (count > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(count);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk,offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string,unknown>;
  } catch { return null; }
  finally { try { reader.releaseLock(); } catch {} }
}

export async function GET(request: Request): Promise<Response> {
  if (!enabled() || !baseRequest(request,"GET")) return unavailable();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) return unavailable();
  try {
    const sid = randomBytes(32).toString("base64url");
    const csrf = issueSyntheticCsrfToken({secret,trustedSessionId:sid});
    const headers = new Headers(HEADERS);
    const secure = isProtectedWorkspaceStaging() ? "; Secure" : "";
    const attrs = "; HttpOnly; SameSite=Strict; Path=/api/workspace/invites/proof; Max-Age=900" + secure;
    const sidName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_SID : LOCAL_COOKIE_SID;
    const csrfName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_CSRF : LOCAL_COOKIE_CSRF;
    headers.append("Set-Cookie", sidName + "=" + sid + attrs);
    headers.append("Set-Cookie", csrfName + "=" + csrf + attrs);
    return Response.json({csrf}, {status:200,headers});
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!enabled() || !baseRequest(request,"POST")) return unavailable();
  const sidName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_SID : LOCAL_COOKIE_SID;
  const csrfName = isProtectedWorkspaceStaging() ? STAGING_COOKIE_CSRF : LOCAL_COOKIE_CSRF;
  const sid = cookieValue(request.headers, sidName);
  const csrfCookie = cookieValue(request.headers, csrfName);
  const secret = process.env.BETTER_AUTH_SECRET;
  const expectedOrigin = workspaceOrigin();
  if (!sid || !/^[A-Za-z0-9_-]{43}$/.test(sid) || !secret ||
      !expectedOrigin ||
      !allowSyntheticMutation({
        method: request.method,
        origin: request.headers.get("origin"),
        host: request.headers.get("host"),
        contentType: request.headers.get("content-type"),
        fetchSite: request.headers.get("sec-fetch-site"),
        csrfCookie, csrfHeader: request.headers.get("x-workspace-csrf"),
        expectedOrigin, secret, trustedSessionId: sid,
      })) return unavailable();

  // Local CI uses only an injected mock. Protected staging uses the scoped
  // Resend sender; absence of its branch-scoped key fails closed.
  const sender = isProtectedWorkspaceStaging()
    ? (await import("../../../../../experiments/client-workspace-auth/src/resend-mailbox-transport")).createStagingResendMailboxTransport()
    : process.env.RUN_WORKSPACE_MAIL_INTEGRATION === "1"
      ? globalThis.__workspaceMailboxTestSender : undefined;
  if (!sender) return unavailable();

  const body = await readSmallJson(request);
  if (!body || typeof body.email !== "string" || typeof body.invite !== "string") {
    return unavailable();
  }
  try {
    const [
      { getAuthPrisma, getWorkspacePrisma },
      { dispatchMailboxProofForBearer, publicMailboxChallengeId },
      { admitLocalMailboxRequest },
    ] = await Promise.all([
      import("../../../../../experiments/client-workspace-auth/src/database"),
      import("../../../../../experiments/client-workspace-auth/src/mailbox-proof-delivery"),
      import("../../../../../experiments/client-workspace-auth/src/mailbox-request-quota"),
    ]);
    const authDb = getAuthPrisma();
    const allowed = await admitLocalMailboxRequest({
      authDb, sid, intendedEmail: body.email, invite: body.invite,
    });
    if (!allowed) {
      // No status/timing detail identifying quota, unknown invitation,
      // recipient mismatch or a database failure.
      return Response.json({challengeId: publicMailboxChallengeId(null)},
        {status:202,headers:HEADERS});
    }
    const result = await dispatchMailboxProofForBearer({
      workspaceDb: getWorkspacePrisma(),
      authDb,
      bearer: body.invite,
      intendedEmail: body.email,
      send: sender,
    });
    // A random indistinguishable ID is returned even for unknown/expired/
    // wrong-recipient invites. Raw proof and recipient never enter response.
    return Response.json({challengeId:publicMailboxChallengeId(result)},
      {status:202,headers:HEADERS});
  } catch {
    return unavailable();
  }
}

export const OPTIONS = async () => unavailable();
export const HEAD = async () => unavailable();
export const PUT = async () => unavailable();
export const PATCH = async () => unavailable();
export const DELETE = async () => unavailable();
