import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertDisposableLoopbackDatabaseUrl } from "../src/test-target.ts";
import { hashInvitationToken, redeemClientInvitation } from "../src/invitations.ts";

test("database guard permits only the exact loopback fixture target", () => {
  assert.equal(
    assertDisposableLoopbackDatabaseUrl(
      "postgresql://fixture:fixture@127.0.0.1:5432/auth_spike_test",
      "auth_spike_test",
    ).hostname,
    "127.0.0.1",
  );
  assert.throws(() => assertDisposableLoopbackDatabaseUrl(
    "postgresql://fixture:fixture@db.example.neon.tech:5432/auth_spike_test",
    "auth_spike_test",
  ));
  assert.throws(() => assertDisposableLoopbackDatabaseUrl(
    "postgresql://fixture:fixture@127.0.0.1:5432/production",
    "auth_spike_test",
  ));
  assert.throws(() => assertDisposableLoopbackDatabaseUrl(
    "postgresql://fixture:fixture@127.0.0.1:5432/auth_spike_test?hostaddr=203.0.113.1",
    "auth_spike_test",
  ));
});

test("invitation digests are one-way SHA-256 values and never the bearer token", () => {
  const token = "synthetic-invitation-token-with-sufficient-entropy";
  const digest = hashInvitationToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
  assert.notEqual(digest, hashInvitationToken(`${token}-changed`));
});

test("malformed invitation fields deny without opening a transaction", async () => {
  const workspaceDb = { $transaction() { throw new Error("invalid invitation data must fail before database access"); } };
  for (const input of [
    { token: undefined, intendedEmail: "client@example.invalid", providerSubject: "subject" },
    { token: "x".repeat(32), intendedEmail: undefined, providerSubject: "subject" },
    { token: "x".repeat(32), intendedEmail: "client@example.invalid", providerSubject: undefined },
  ]) {
    assert.equal(await redeemClientInvitation({ workspaceDb, ...input }), false);
  }
});

test("auth-owned schema is isolated and session assurance is not client writable", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const auth = await readFile(new URL("../src/auth.ts", import.meta.url), "utf8");
  const database = await readFile(new URL("../src/database.ts", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /@@schema\("auth_spike"\)/);
  for (const model of ["User", "Session", "Account", "Verification", "TwoFactor"]) {
    assert.match(schema, new RegExp(`model ${model}\\s*\\{`));
  }
  assert.doesNotMatch(schema, /model Workspace(Client|Staff|Principal|Invitation|Tenant|Project)/);
  assert.match(auth, /mfaVerifiedAt:\s*\{[\s\S]*?input:\s*false[\s\S]*?returned:\s*false/);
  assert.match(database, /AUTH_EXPERIMENT_ENABLED !== "1"/);
  assert.match(database, /NODE_ENV === "production"/);
  assert.match(database, /assertDisposableLoopbackDatabaseUrl/);
  assert.match(workspace, /model WorkspaceClientProjectGrant/);
  assert.match(workspace, /model WorkspaceInvitationRecord/);
});

test("public signup and alternative passwordless routes have explicit server gates", async () => {
  const auth = await readFile(new URL("../src/auth.ts", import.meta.url), "utf8");
  const saga = await readFile(new URL("../src/enrollment-saga.ts", import.meta.url), "utf8");
  assert.match(auth, /context\.path !== "\/sign-up\/email"/);
  assert.match(auth, /prepareEnrollmentAttempt/);
  assert.match(auth, /consumeMailboxProofForEnrollment/);
  assert.match(auth, /markAuthIdentityCreated/);
  assert.doesNotMatch(auth, /redeemClientInvitation/);
  assert.match(saga, /grant_ready_for_review/);
  assert.match(saga, /return "grant_ready_for_review"/);
  assert.match(saga, /approveEnrollmentGrantForVerifiedSubject/);
  assert.doesNotMatch(saga, /CREATE\s+ROUTE|NextResponse|app\/api/i);
  for (const path of ["/sign-in/social", "/sign-in/magic-link", "/sign-in/email-otp", "/sign-in/phone-number", "/sign-in/username", "/sign-up/anonymous", "/two-factor/verify-otp"]) {
    assert.ok(auth.includes(path), `Expected disabled endpoint ${path}`);
  }
});
