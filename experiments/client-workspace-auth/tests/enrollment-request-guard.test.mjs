import assert from "node:assert/strict";
import test from "node:test";
import { allowSyntheticMutation, issueSyntheticCsrfToken } from "../src/enrollment-request-guard.ts";

const secret = "test-only-synthetic-hmac-key-that-is-never-used-live-2026";
const session = "verified-session-subject-one";
const now = 1800000000000;
const token = issueSyntheticCsrfToken({ secret, trustedSessionId: session, now });
const valid = {
  method: "POST", origin: "https://workspace.example.invalid", host: "workspace.example.invalid",
  contentType: "application/json", fetchSite: "same-origin",
  csrfCookie: token, csrfHeader: token, expectedOrigin: "https://workspace.example.invalid",
  secret, trustedSessionId: session, now,
};

test("a complete server-bound same-origin HMAC CSRF contract is allowed", () => {
  assert.equal(allowSyntheticMutation(valid), true);
  assert.notEqual(token, issueSyntheticCsrfToken({ secret, trustedSessionId: session, now }));
});

test("cross-site, absent, forged and session-swapped requests fail closed", () => {
  const failures = [
    { origin: "https://evil.example.invalid" }, { origin: null },
    { host: "evil.example.invalid" }, { host: null },
    { method: "GET" }, { method: "PUT" }, { fetchSite: "cross-site" },
    { fetchSite: "same-site" }, { fetchSite: null },
    { contentType: "text/plain" }, { contentType: null },
    { csrfCookie: null }, { csrfHeader: null }, { csrfHeader: "x" },
    { trustedSessionId: "someone-else" }, { secret: "x".repeat(32) },
    { expectedOrigin: "http://workspace.example.invalid" },
    { now: now + 16 * 60_000 }, { now: now - 1 },
  ];
  for (const changes of failures) {
    assert.equal(allowSyntheticMutation({ ...valid, ...changes }), false, JSON.stringify(changes));
  }
});

test("spoofed or malformed CSRF tokens cannot satisfy the HMAC contract", () => {
  const forged = [
    token.replace(/.$/, token.endsWith("0") ? "1" : "0"),
    token.replace(/^\d+/, "2000000000000"), "0." + "a".repeat(64) + "." + "f".repeat(64),
    "", "not-a-token", token + ".extra",
  ];
  for (const value of forged) {
    assert.equal(allowSyntheticMutation({ ...valid, csrfCookie: value, csrfHeader: value }), false);
  }
});

test("missing session context, weak key or production non-HTTPS origin never pass", () => {
  assert.throws(() => issueSyntheticCsrfToken({ secret: "short", trustedSessionId: session }), TypeError);
  assert.equal(allowSyntheticMutation({ ...valid, expectedOrigin: "http://insecure.example.invalid",
    origin: "http://insecure.example.invalid", host: "insecure.example.invalid" }), false);
  assert.equal(allowSyntheticMutation({ ...valid, trustedSessionId: "" }), false);
});
