import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/contact/route.ts";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.EMAIL_FROM;

function restoreEnvironment() {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  if (originalFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = originalFrom;
}

function setTestEmailConfig() {
  process.env.RESEND_API_KEY = "test-only-key";
  process.env.EMAIL_FROM = "DigiPants <enquiries@example.test>";
}

function request(body, { ip = crypto.randomUUID(), headers = {}, url = "https://digipants.test/api/contact/" } = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nf-client-connection-ip": ip,
      ...headers,
    },
    body,
  });
}

function validFields(overrides = {}) {
  return {
    name: "Jordan Example",
    email: "jordan@example.test",
    project: "Web application",
    budget: "₹1–5L",
    timeline: "Flexible",
    message: "Please contact me about this project.",
    company: "",
    ...overrides,
  };
}

test("sends every visible field to the fixed support recipient through Resend", async (t) => {
  t.after(restoreEnvironment);
  setTestEmailConfig();
  let apiRequest;
  globalThis.fetch = async (url, options) => {
    apiRequest = { url, options };
    return Response.json({ id: "mock-resend-message-id" });
  };

  const response = await POST(request(JSON.stringify(validFields())));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: "Your enquiry has been submitted." });
  assert.equal(apiRequest.url, "https://api.resend.com/emails");
  assert.equal(apiRequest.options.headers.Authorization, "Bearer test-only-key");

  const sentEmail = JSON.parse(apiRequest.options.body);
  assert.deepEqual(sentEmail.to, ["support@digipants.com"]);
  assert.equal(sentEmail.reply_to, "jordan@example.test");
  for (const field of ["Jordan Example", "jordan@example.test", "Web application", "₹1–5L", "Flexible", "Please contact me about this project."]) {
    assert.ok(sentEmail.text.includes(field), `email body should include ${field}`);
  }
});

test("rejects invalid fields before contacting Resend", async (t) => {
  t.after(restoreEnvironment);
  setTestEmailConfig();
  globalThis.fetch = async () => {
    assert.fail("Resend must not be called for invalid input");
  };

  const response = await POST(request(JSON.stringify(validFields({ email: "not-an-email" }))));
  assert.equal(response.status, 400);
});

test("rejects oversized request bodies", async (t) => {
  t.after(restoreEnvironment);
  setTestEmailConfig();
  const response = await POST(request(JSON.stringify(validFields({ message: "x".repeat(12_100) }))));
  assert.equal(response.status, 413);
});

test("applies a per-address request limit", async (t) => {
  t.after(restoreEnvironment);
  const ip = crypto.randomUUID();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await POST(request("{", { ip }));
    assert.equal(response.status, 400);
  }

  const limited = await POST(request("{", { ip }));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});

test("fails clearly when server-side Resend configuration is missing", async (t) => {
  t.after(restoreEnvironment);
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  globalThis.fetch = async () => {
    assert.fail("Resend must not be called without server-side configuration");
  };

  const response = await POST(request(JSON.stringify(validFields())));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/i);
});

test("never reports success or leaks provider details when Resend rejects the send", async (t) => {
  t.after(restoreEnvironment);
  setTestEmailConfig();
  globalThis.fetch = async () =>
    Response.json({ message: "private upstream diagnostic" }, { status: 401 });

  const response = await POST(request(JSON.stringify(validFields())));
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /could not send/i);
  assert.doesNotMatch(body, /private upstream diagnostic|test-only-key/);
});

test("rejects cross-origin submissions", async (t) => {
  t.after(restoreEnvironment);
  setTestEmailConfig();
  globalThis.fetch = async () => {
    assert.fail("Resend must not be called for cross-origin requests");
  };

  const response = await POST(
    request(JSON.stringify(validFields()), { headers: { origin: "https://attacker.example" } }),
  );
  assert.equal(response.status, 403);
});

test("accepts the public Netlify alias origin when the server URL is deploy-specific", async (t) => {
  t.after(restoreEnvironment);
  setTestEmailConfig();
  globalThis.fetch = async () => {
    assert.fail("Invalid fields must not reach Resend");
  };

  const response = await POST(
    request(JSON.stringify(validFields({ email: "invalid" })), {
      url: "https://deploy-id--digipants.netlify.app/api/contact/",
      headers: {
        origin: "https://deploy-preview-25--digipants.netlify.app",
        "x-forwarded-host": "deploy-preview-25--digipants.netlify.app",
        "x-forwarded-proto": "https",
      },
    }),
  );
  assert.equal(response.status, 400);
});
