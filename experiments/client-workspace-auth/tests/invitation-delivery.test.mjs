import assert from "node:assert/strict";
import test from "node:test";
import {
  composePrivateInvitationEmail,
  sendInvitationThroughResend,
} from "../src/invitation-delivery.ts";

const id = "11111111-1111-4111-8111-111111111111";
const token = "A".repeat(43);
const compose = (overrides = {}) => composePrivateInvitationEmail({
  invitationId: id, recipient: "Synthetic.Client+1@EXAMPLE.invalid",
  bearerToken: token, workspaceOrigin: "https://digipants.com", ...overrides,
});

test("private invitation: exact recipient, private fragment and no token in query/path", () => {
  const message = compose();
  assert.ok(message);
  assert.equal(message.to, "synthetic.client+1@example.invalid");
  assert.equal(message.idempotencyKey, "cw-invite-" + id);
  const matches = message.text.match(/https:\/\/[^\s]+/g);
  assert.equal(matches.length, 2);
  const url = new URL(matches[0]);
  assert.equal(url.origin, "https://digipants.com");
  assert.equal(url.pathname, "/workspace/invite/");
  assert.equal(url.search, "");
  assert.equal(url.hash, "#invite=" + token);
  assert.equal(Object.isFrozen(message), true);
  assert.equal(message.subject.includes(token), false);
  assert.equal(message.idempotencyKey.includes(token), false);
});

test("malformed, spoofed or insecure origins, recipients and bearers are rejected", () => {
  for (const origin of [
    "", "http://digipants.com", "https://evil.example",
    "https://digipants.com.evil.example", "https://digipants.com/",
    "https://digipants.com:8443", "https://name@digipants.com",
    "https://digipants.com?next=evil", "https://digipants.com#x",
  ]) {
    assert.equal(compose({ workspaceOrigin: origin }), null, origin);
  }
  for (const email of ["me@evil.test\r\nBcc:x@y.test", "not-an-email",
    "client@example.invalid,other@evil.invalid", " other@example.invalid"]) {
    assert.equal(compose({ recipient: email }), null);
  }
  for (const bearer of ["x", "B".repeat(44), "A".repeat(42),
    "B".repeat(42) + "=", "B".repeat(42) + "#"]) {
    assert.equal(compose({ bearerToken: bearer }), null);
  }
  assert.equal(compose({ invitationId: "bad" }), null);
});

test("mocked Resend sends ONLY to normalized intended recipient, no browser token leakage", async () => {
  const message = compose();
  const captured = [];
  const fetcher = async (url, init) => {
    captured.push({ url, init });
    return { ok: true, json: async () => ({ id: "mail_fixture_0001" }) };
  };
  const result = await sendInvitationThroughResend({
    message, from: "DigiPants <bad>" /* invalid header */, apiKey: "synthetic-token-value-32",
    fetcher,
  });
  assert.equal(result, false);
  assert.equal(captured.length, 0);

  const delivered = await sendInvitationThroughResend({
    message, from: "onboarding@digipants.com",
    apiKey: "synthetic-token-value-32", fetcher,
  });
  assert.equal(delivered, true);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, "https://api.resend.com/emails");
  assert.equal(captured[0].init.redirect, "error");
  assert.equal(captured[0].init.headers["Idempotency-Key"], "cw-invite-" + id);
  const payload = JSON.parse(captured[0].init.body);
  assert.deepEqual(payload.to, ["synthetic.client+1@example.invalid"]);
  assert.deepEqual(Object.keys(payload).sort(), ["from", "subject", "text"]);
  assert.ok(payload.text.includes("#invite=" + token));
  assert.ok(!JSON.stringify(captured[0].init.headers).includes(token));
});

test("provider outage, missing acknowledgement and invalid input always deny without throwing", async () => {
  const message = compose();
  const defaults = {
    message, from: "onboarding@digipants.com", apiKey: "synthetic-token-value-32",
  };
  assert.equal(await sendInvitationThroughResend({
    ...defaults, fetcher: async () => { throw new Error("synthetic outage"); },
  }), false);
  assert.equal(await sendInvitationThroughResend({
    ...defaults, fetcher: async () => ({ ok: false, json: async () => ({ id: "x" }) }),
  }), false);
  assert.equal(await sendInvitationThroughResend({
    ...defaults, fetcher: async () => ({ ok: true, json: async () => ({}) }),
  }), false);
  assert.equal(await sendInvitationThroughResend({
    ...defaults, from: "x@digipants.com\nBcc:evil@example.invalid",
    fetcher: async () => { throw new Error("should not call provider"); },
  }), false);
  assert.equal(await sendInvitationThroughResend({
    ...defaults, apiKey: "short", fetcher: async () => { throw new Error("not called"); },
  }), false);
});
