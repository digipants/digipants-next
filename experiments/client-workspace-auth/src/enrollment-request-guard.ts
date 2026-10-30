import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Isolated server-side contract test. NOT a live auth middleware or a
// replacement for Better Auth session, CSRF/origin and cookie checks.
const MAX_CSRF_AGE_MS = 15 * 60_000;

function equalStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function mac(secret: string, sessionId: string, payload: string): string {
  return createHmac("sha256", secret).update("cw-csrf-v1\n").update(sessionId)
    .update("\n").update(payload).digest("hex");
}
function validSecret(value: unknown): value is string {
  return typeof value === "string" && Buffer.byteLength(value) >= 32;
}
/** Generate only inside a trusted server session; never send the secret. */
export function issueSyntheticCsrfToken(input: {
  secret: string; trustedSessionId: string; now?: number;
}): string {
  if (!validSecret(input.secret) || !input.trustedSessionId ||
      input.trustedSessionId.length > 255) throw new TypeError("Invalid CSRF context.");
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError("Invalid clock.");
  const payload = `${now.toString(10)}.${randomBytes(32).toString("hex")}`;
  return `${payload}.${mac(input.secret, input.trustedSessionId, payload)}`;
}
/**
 * Both token copies must be tied to the same verified server session and
 * the exact configured origin. Header names are caller-normalized by Headers.
 * A forged Origin/Host value is NOT proof of identity; session verification
 * and mail ownership are independent prerequisites before any live route.
 */
export function allowSyntheticMutation(input: {
  method: string; origin: string | null; host: string | null;
  contentType: string | null; fetchSite: string | null;
  csrfCookie: string | null; csrfHeader: string | null;
  expectedOrigin: string; secret: string; trustedSessionId: string;
  now?: number;
}): boolean {
  try {
    const origin = new URL(input.expectedOrigin);
    if (origin.protocol !== "https:" && origin.origin !== "http://localhost:3000") return false;
    if (input.method !== "POST" || input.origin !== origin.origin ||
        input.host !== origin.host || input.fetchSite !== "same-origin" ||
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(input.contentType ?? "") ||
        !validSecret(input.secret) || !input.trustedSessionId ||
        typeof input.csrfCookie !== "string" || typeof input.csrfHeader !== "string" ||
        !equalStrings(input.csrfCookie, input.csrfHeader)) return false;
    const parts = input.csrfHeader.split(".");
    if (parts.length !== 3 || !/^\d{1,16}$/.test(parts[0]!) ||
        !/^[a-f0-9]{64}$/.test(parts[1]!) || !/^[a-f0-9]{64}$/.test(parts[2]!)) return false;
    const issuedAt = Number(parts[0]);
    const now = input.now ?? Date.now();
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(issuedAt) ||
        issuedAt > now || now - issuedAt > MAX_CSRF_AGE_MS) return false;
    const payload = `${parts[0]}.${parts[1]}`;
    return equalStrings(parts[2]!, mac(input.secret, input.trustedSessionId, payload));
  } catch {
    return false;
  }
}
