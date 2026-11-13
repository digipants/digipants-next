import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  composeFounderBootstrapMessage,
  dispatchFounderBootstrapProof,
  founderBootstrapEnabled,
} from "../src/founder-bootstrap.ts";

const staging = {
  NODE_ENV: "production",
  CLIENT_WORKSPACE_ENABLED: "1",
  CLIENT_WORKSPACE_ENVIRONMENT: "staging",
  CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED: "1",
  SITE_ID: "ebafda7a-e6c5-48e4-a44d-daf0f5943d43",
  CLIENT_WORKSPACE_ORIGIN: "https://digipants-client-workspace-staging.netlify.app",
  URL: "https://digipants-client-workspace-staging.netlify.app",
};

test("founder bootstrap requires the exact staging or separately gated production site", () => {
  assert.equal(founderBootstrapEnabled(staging), true);
  const production = {
    ...staging,
    CLIENT_WORKSPACE_ENVIRONMENT: "production",
    CLIENT_WORKSPACE_PRODUCTION_ENABLED: "1",
    CLIENT_WORKSPACE_PRODUCTION_FOUNDER_ENABLED: "1",
    SITE_ID: "837d4464-7eb6-4a1f-b4ef-3a44a2829d79",
    CLIENT_WORKSPACE_ORIGIN: "https://digipants.com",
    URL: "https://digipants.com",
  };
  assert.equal(founderBootstrapEnabled(production), true);
  assert.equal(founderBootstrapEnabled({ ...production, CLIENT_WORKSPACE_PRODUCTION_FOUNDER_ENABLED: "0" }), false);
  assert.equal(founderBootstrapEnabled({ ...production, CLIENT_WORKSPACE_PRODUCTION_ENABLED: "0" }), false);
  assert.equal(founderBootstrapEnabled({ ...production, SITE_ID: staging.SITE_ID }), false);
  assert.equal(founderBootstrapEnabled({ ...staging, SITE_ID: "another-site" }), false);
  assert.equal(founderBootstrapEnabled({ ...staging, CLIENT_WORKSPACE_ENVIRONMENT: "production" }), false);
  assert.equal(founderBootstrapEnabled({ ...staging, CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED: "0" }), false);
  assert.equal(founderBootstrapEnabled({
    NODE_ENV: "test", AUTH_EXPERIMENT_ENABLED: "1",
    WORKSPACE_FOUNDER_BOOTSTRAP_TEST_ENABLED: "1",
    CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED: "1",
  }), true);
  assert.equal(founderBootstrapEnabled({
    NODE_ENV: "test", AUTH_EXPERIMENT_ENABLED: "1",
    CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED: "1",
  }), false);
});

test("founder verification message is recipient-bound, one-use and contains no URL token", () => {
  const challengeId = randomUUID();
  const code = "A".repeat(43);
  const message = composeFounderBootstrapMessage({
    challengeId,
    recipient: "Founder.Pilot@example.com",
    code,
  });
  assert.equal(message?.kind, "founder_bootstrap");
  assert.equal(message?.to, "founder.pilot@example.com");
  assert.equal(message?.subject, "Verify your DigiPants founder account");
  assert.match(message?.text ?? "", new RegExp(`\\n${code}\\n`));
  assert.equal(message?.idempotencyKey, `cw-founder-bootstrap-${challengeId}`);
  assert.doesNotMatch(message?.text ?? "", /https?:\/\//);
  assert.equal(composeFounderBootstrapMessage({ challengeId, recipient: "bad", code }), null);
  assert.equal(composeFounderBootstrapMessage({ challengeId, recipient: "founder@example.com", code: "short" }), null);
});
test("repeated founder verification request resumes the active proof without a duplicate email", async t => {
  const keys = [
    "NODE_ENV", "AUTH_EXPERIMENT_ENABLED", "CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED",
    "WORKSPACE_FOUNDER_BOOTSTRAP_TEST_ENABLED", "WORKSPACE_MAIL_OUTBOX_TEST_ENABLED",
    "WORKSPACE_MAIL_OUTBOX_KEY",
  ];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: "test",
    AUTH_EXPERIMENT_ENABLED: "1",
    CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED: "1",
    WORKSPACE_FOUNDER_BOOTSTRAP_TEST_ENABLED: "1",
    WORKSPACE_MAIL_OUTBOX_TEST_ENABLED: "1",
    WORKSPACE_MAIL_OUTBOX_KEY: "A".repeat(43),
  });
  t.after(() => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const activeChallengeId = randomUUID();
  let sendCalls = 0;
  const workspaceDb = {
    async $queryRaw() { return [{ open: true }]; },
  };
  const authDb = {
    async $transaction(operation) {
      return operation({
        async $queryRaw(strings) {
          const sql = strings.join("");
          if (sql.includes("pg_advisory_xact_lock")) return [{ lock_acquired: true }];
          if (sql.includes("SELECT id FROM auth_spike.verification")) return [{ id: activeChallengeId }];
          throw new Error("Unexpected query in active-proof test.");
        },
        async $executeRaw() { throw new Error("Active proof must not be rewritten."); },
      });
    },
  };

  const result = await dispatchFounderBootstrapProof({
    workspaceDb,
    authDb,
    email: "founder.pilot@example.com",
    async send() { sendCalls += 1; return true; },
  });

  assert.deepEqual(result, { challengeId: activeChallengeId });
  assert.equal(sendCalls, 0);
});
