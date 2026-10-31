import test from "node:test";
import assert from "node:assert/strict";
import { workspaceRuntimeMode, assertStagingRuntimeDatabaseUrl } from "../src/workspace-runtime.ts";

const staging = {
  NODE_ENV: "production",
  CLIENT_WORKSPACE_ENABLED: "1",
  CLIENT_WORKSPACE_ENVIRONMENT: "staging",
  CONTEXT: "production",
  BRANCH: "feat/client-workspace-mail-abuse-gates-117",
  CLIENT_WORKSPACE_ORIGIN: "https://digipants-client-workspace-staging.netlify.app",
  URL: "https://digipants-client-workspace-staging.netlify.app",
};

test("workspace enables only on the separately protected staging project branch", () => {
  assert.equal(workspaceRuntimeMode(staging), "protected-staging");
  assert.equal(workspaceRuntimeMode({ ...staging, CONTEXT: "deploy-preview" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, BRANCH: "main" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, URL: "https://digipants.com" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, NODE_ENV: "development" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, CLIENT_WORKSPACE_ENABLED: "0" }), "disabled");
});

test("local integration activation remains separate from every production context", () => {
  assert.equal(workspaceRuntimeMode({ NODE_ENV: "test", AUTH_EXPERIMENT_ENABLED: "1" }), "local-test");
  assert.equal(workspaceRuntimeMode({ NODE_ENV: "production", AUTH_EXPERIMENT_ENABLED: "1" }), "disabled");
  assert.equal(workspaceRuntimeMode({ NODE_ENV: "production", ...staging, BRANCH: "main" }), "disabled");
});

test("staging database URLs require distinct dedicated logins, correct databases, pooler and full TLS", () => {
  const url = "postgresql://cw_workspace_app:test-value@ep-example-pooler.us-east-1.aws.neon.tech/digipants_workspace_dev?sslmode=verify-full";
  assert.equal(assertStagingRuntimeDatabaseUrl(url, "digipants_workspace_dev", "WORKSPACE_DATABASE_URL", staging), url);
  assert.throws(() => assertStagingRuntimeDatabaseUrl(url.replace("-pooler", ""), "digipants_workspace_dev", "WORKSPACE_DATABASE_URL", staging));
  assert.throws(() => assertStagingRuntimeDatabaseUrl(url.replace("cw_workspace_app", "digipants_ws_dev"), "digipants_workspace_dev", "WORKSPACE_DATABASE_URL", staging));
  assert.throws(() => assertStagingRuntimeDatabaseUrl(url.replace("verify-full", "require"), "digipants_workspace_dev", "WORKSPACE_DATABASE_URL", staging));
  const authUrl = "postgresql://cw_auth_app:test-value@ep-example-pooler.us-east-1.aws.neon.tech/auth_spike_test?sslmode=verify-full";
  assert.equal(assertStagingRuntimeDatabaseUrl(authUrl, "auth_spike_test", "AUTH_DATABASE_URL", staging), authUrl);
  assert.throws(() => assertStagingRuntimeDatabaseUrl(authUrl.replace("cw_auth_app", "cw_workspace_app"), "auth_spike_test", "AUTH_DATABASE_URL", staging));
  assert.throws(() => assertStagingRuntimeDatabaseUrl(authUrl, "digipants_workspace_dev", "AUTH_DATABASE_URL", staging));
});
