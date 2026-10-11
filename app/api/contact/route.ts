export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_BUCKETS = 5_000;
const SUPPORT_EMAIL = "support@digipants.com";
// Best-effort per-instance throttling; the honeypot and request limits remain effective across requests handled by a warm instance.
const rateLimits = new Map<string, { count: number; resetAt: number }>();

type ContactFields = {
  name: string;
  email: string;
  project: string;
  budget: string;
  timeline: string;
  message: string;
  company: string;
};

const FIELD_LIMITS = {
  name: 160,
  email: 254,
  project: 160,
  budget: 100,
  timeline: 100,
  message: 5_000,
  company: 200,
} as const;

function json(body: Record<string, string>, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function getClientAddress(request: Request) {
  const platformAddress = request.headers.get("x-nf-client-connection-ip")?.trim();
  if (platformAddress) return platformAddress;

  const forwardedAddresses = request.headers.get("x-forwarded-for");
  const proxyAddress = forwardedAddresses?.split(",").at(-1)?.trim();
  return proxyAddress || "unknown";
}

function checkRateLimit(address: string, now = Date.now()) {
  for (const [key, limit] of rateLimits) {
    if (limit.resetAt <= now) rateLimits.delete(key);
  }

  const current = rateLimits.get(address);
  if (current && current.resetAt > now && current.count >= RATE_LIMIT_MAX) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  }

  if (!current || current.resetAt <= now) {
    rateLimits.set(address, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    current.count += 1;
  }

  while (rateLimits.size > RATE_LIMIT_MAX_BUCKETS) {
    const oldestAddress = rateLimits.keys().next().value;
    if (!oldestAddress) break;
    rateLimits.delete(oldestAddress);
  }

  return null;
}

async function readBodyWithinLimit(request: Request) {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    byteLength += value.byteLength;
    if (byteLength > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

function parseContactFields(input: unknown): ContactFields | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const values = input as Record<string, unknown>;
  const fields = {} as ContactFields;

  for (const [name, maxLength] of Object.entries(FIELD_LIMITS)) {
    const value = values[name] ?? "";
    if (typeof value !== "string" || value.length > maxLength) return null;
    fields[name as keyof ContactFields] = value.trim();
  }

  if (!fields.name || !fields.email || !fields.message) return null;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fields.email)) return null;
  if ([fields.name, fields.project, fields.budget, fields.timeline].some((value) => /[\r\n\u0000-\u001f\u007f]/.test(value))) return null;

  return fields;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const requestUrl = new URL(request.url);
    const expectedOrigins = new Set([requestUrl.origin]);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = request.headers.get("host")?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);

    for (const host of [forwardedHost, requestHost]) {
      if (host && !/[\r\n]/.test(host) && /^https?$/i.test(protocol)) {
        expectedOrigins.add(new URL(`${protocol}://${host}`).origin);
      }
    }

    return expectedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return json({ error: "This request could not be accepted." }, 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ error: "Please submit the enquiry form again." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "Your message is too large. Please shorten it and try again." }, 413);
  }

  const retryAfter = checkRateLimit(getClientAddress(request));
  if (retryAfter !== null) {
    return json(
      { error: "Too many enquiries were submitted. Please wait and try again." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  let rawBody: string | null;
  try {
    rawBody = await readBodyWithinLimit(request);
  } catch {
    return json({ error: "We could not read your enquiry. Please try again." }, 400);
  }

  if (rawBody === null) {
    return json({ error: "Your message is too large. Please shorten it and try again." }, 413);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return json({ error: "Please check the form fields and try again." }, 400);
  }

  const fields = parseContactFields(parsedBody);
  if (!fields) {
    return json({ error: "Please enter a valid name, email, and message." }, 400);
  }

  if (fields.company) {
    return json({ error: "We could not accept this enquiry." }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from || /[\r\n]/.test(from)) {
    return json({ error: "The enquiry service is not configured." }, 503);
  }

  const text = [
    "A new project enquiry was submitted through digipants.com.",
    "",
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Project or service: ${fields.project || "Not provided"}`,
    `Budget: ${fields.budget || "Not provided"}`,
    `Timeline: ${fields.timeline || "Not provided"}`,
    "",
    "Message:",
    fields.message,
  ].join("\n");

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [SUPPORT_EMAIL],
        reply_to: fields.email,
        subject: "New DigiPants project enquiry",
        text,
      }),
    });

    if (!resendResponse.ok) {
      return json({ error: "We could not send your enquiry." }, 502);
    }

    const result: unknown = await resendResponse.json().catch(() => null);
    if (!result || typeof result !== "object" || typeof (result as { id?: unknown }).id !== "string") {
      return json({ error: "We could not confirm your enquiry was sent." }, 502);
    }

    return json({ message: "Your enquiry has been submitted." }, 200);
  } catch {
    return json({ error: "We could not send your enquiry." }, 502);
  }
}
