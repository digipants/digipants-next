import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  composeFounderBootstrapMessage,
  founderBootstrapEnabled,
} from "../src/founder-bootstrap.ts";

const staging = {
  NODE_ENV: "production",
  CLIENT_WORKSPACE_ENABLED: "1",
  CLIENT_WORKSPACE_ENVIRONMENT: "staging",
  CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED: "1",
  CLIENT_WORKSPACE_BUILD_CONTEXT: "production",
  CLIENT_WORKSPACE_BUILD_BRANCH: "feat/client-workspace-mail-abuse-gates-117",
  CLIENT_WORKSPACE_BUILD_SITE_ID: "ebafda7a-e6c5-48e4-a44d-daf0f5943d43",
  SITE_ID: "ebafda7a-e6c5-48e4-a44d-daf0f5943d43",
  CLIENT_WORKSPACE_ORIGIN: "https://digipants-client-workspace-staging.netlify.app",
  URL: "https://digipants-client-workspace-staging.netlify.app",
};

test("founder bootstrap is enabled only on the exact protected staging runtime", () => {
  assert.equal(founderBootstrapEnabled(staging), true);
  assert.equal(founderBootstrapEnabled({ ...staging, CLIENT_WORKSPACE_BUILD_BRANCH: "main" }), false);
  assert.equal(founderBootstrapEnabled({ ...staging, CLIENT_WORKSPACE_BUILD_CONTEXT: "deploy-preview" }), false);
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
