import test from "node:test";
import assert from "node:assert/strict";
import {
  workspaceRuntimeMode,
  assertStagingRuntimeDatabaseUrl,
  assertProductionRuntimeDatabaseUrl,
  workspaceRlsContextKey,
  isTrustedWorkspaceRequest,
} from "../src/workspace-runtime.ts";

const staging = {
  NODE_ENV: "production",
  CLIENT_WORKSPACE_ENABLED: "1",
  CLIENT_WORKSPACE_ENVIRONMENT: "staging",
  SITE_ID: "ebafda7a-e6c5-48e4-a44d-daf0f5943d43",
  CLIENT_WORKSPACE_ORIGIN: "https://digipants-client-workspace-staging.netlify.app",
  URL: "https://digipants-client-workspace-staging.netlify.app",
};
const production = {
  NODE_ENV: "production",
  CLIENT_WORKSPACE_ENABLED: "1",
  CLIENT_WORKSPACE_ENVIRONMENT: "production",
  CLIENT_WORKSPACE_PRODUCTION_ENABLED: "1",
  SITE_ID: "837d4464-7eb6-4a1f-b4ef-3a44a2829d79",
  CLIENT_WORKSPACE_ORIGIN: "https://digipants.com",
  URL: "https://digipants.com",
};

test("workspace enables only on exact protected staging or explicitly enabled production site", () => {
  assert.equal(workspaceRuntimeMode(staging), "protected-staging");
  assert.equal(workspaceRuntimeMode({ ...staging, CLIENT_WORKSPACE_ENVIRONMENT: "production" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, SITE_ID: "another-site" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, URL: "http://digipants-client-workspace-staging.netlify.app" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, URL: "https://digipants.com" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, URL: "https://digipants-client-workspace-staging.netlify.app/path" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, URL: "https://digipants-client-workspace-staging.netlify.app/?next=x" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, URL: undefined }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, NODE_ENV: "development" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...staging, CLIENT_WORKSPACE_ENABLED: "0" }), "disabled");
  assert.equal(workspaceRuntimeMode(production), "production");
  assert.equal(workspaceRuntimeMode({ ...production, CLIENT_WORKSPACE_PRODUCTION_ENABLED: "0" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...production, CLIENT_WORKSPACE_PRODUCTION_ENABLED: undefined }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...production, CLIENT_WORKSPACE_ENVIRONMENT: "staging" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...production, SITE_ID: "another-site" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...production, URL: "https://deploy-preview-117--digipants.netlify.app" }), "disabled");
  assert.equal(workspaceRuntimeMode({ ...production, URL: "http://digipants.com" }), "disabled");
});

test("local integration activation remains separate from every production context", () => {
  assert.equal(workspaceRuntimeMode({ NODE_ENV: "test", AUTH_EXPERIMENT_ENABLED: "1" }), "local-test");
  assert.equal(workspaceRuntimeMode({ NODE_ENV: "production", AUTH_EXPERIMENT_ENABLED: "1" }), "disabled");
  assert.deepEqual(workspaceRlsContextKey({ NODE_ENV: "test", AUTH_EXPERIMENT_ENABLED: "1" }), Buffer.alloc(32, 0x11));
});

test("signed database context keys are exact, separate and fail closed by runtime", () => {
  const stagingKey = Buffer.alloc(32, 0x22).toString("base64url");
  const productionKey = Buffer.alloc(32, 0x33).toString("base64url");
  assert.deepEqual(workspaceRlsContextKey({ ...staging, WORKSPACE_RLS_CONTEXT_KEY: stagingKey }), Buffer.alloc(32, 0x22));
  assert.deepEqual(workspaceRlsContextKey({ ...production, PRODUCTION_WORKSPACE_RLS_CONTEXT_KEY: productionKey }), Buffer.alloc(32, 0x33));
  assert.throws(() => workspaceRlsContextKey(staging));
  assert.throws(() => workspaceRlsContextKey({ ...staging, WORKSPACE_RLS_CONTEXT_KEY: productionKey + "=" }));
  assert.throws(() => workspaceRlsContextKey({ ...production, WORKSPACE_RLS_CONTEXT_KEY: stagingKey }));
});

test("Netlify forwarded origin is trusted only with exact staging host and HTTPS", () => {
  const host = "digipants-client-workspace-staging.netlify.app";
  const forwardedRequest = (headers = {}, method = "GET") => new Request(
    "https://netlify-internal.invalid/api/workspace/founder/verification/",
    { method, headers: { host, "x-forwarded-host": host, "x-forwarded-proto": "https", ...headers } },
  );
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest(), staging), true);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest({ "x-forwarded-host": "evil.example" }), staging), false);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest({ "x-forwarded-proto": "http" }), staging), false);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest({ host: "evil.example" }), staging), false);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest({}, "POST"), staging), false);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest({
    origin: "https://digipants-client-workspace-staging.netlify.app",
  }, "POST"), staging), true);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest({ origin: "https://evil.example" }), staging), false);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest({ origin: "https://digipants-client-workspace-staging.netlify.app" }), staging), true);
  assert.equal(isTrustedWorkspaceRequest(forwardedRequest(), { ...staging, SITE_ID: "another-site" }), false);
  assert.equal(isTrustedWorkspaceRequest(new Request("http://netlify-internal.invalid/api/workspace"), {
    ...staging, NODE_ENV: "production",
  }), false);
  assert.equal(isTrustedWorkspaceRequest(new Request("http://localhost:3000/api/auth/sign-in/email"), {
    NODE_ENV: "test", AUTH_EXPERIMENT_ENABLED: "1",
  }), true);

  const productionHost = "digipants.com";
  const forwardedProduction = new Request("https://netlify-internal.invalid/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      host: productionHost,
      "x-forwarded-host": productionHost,
      "x-forwarded-proto": "https",
      origin: "https://digipants.com",
    },
  });
  assert.equal(isTrustedWorkspaceRequest(forwardedProduction, production), true);
  assert.equal(isTrustedWorkspaceRequest(new Request("https://netlify-internal.invalid/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      host: productionHost,
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
      origin: "https://digipants.com",
    },
  }), production), false);
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

test("production database URLs require isolated production identities, databases, pooler and full TLS", () => {
  const workspaceUrl = "postgresql://cw_workspace_prod_app:test-value@ep-prod-pooler.us-east-1.aws.neon.tech/digipants_workspace_prod?sslmode=verify-full";
  assert.equal(assertProductionRuntimeDatabaseUrl(workspaceUrl, "digipants_workspace_prod", "PRODUCTION_WORKSPACE_DATABASE_URL", production), workspaceUrl);
  assert.throws(() => assertProductionRuntimeDatabaseUrl(workspaceUrl.replace("cw_workspace_prod_app", "cw_workspace_app"), "digipants_workspace_prod", "PRODUCTION_WORKSPACE_DATABASE_URL", production));
  assert.throws(() => assertProductionRuntimeDatabaseUrl(workspaceUrl.replace("digipants_workspace_prod", "digipants_workspace_dev"), "digipants_workspace_prod", "PRODUCTION_WORKSPACE_DATABASE_URL", production));
  assert.throws(() => assertProductionRuntimeDatabaseUrl(workspaceUrl.replace("-pooler", ""), "digipants_workspace_prod", "PRODUCTION_WORKSPACE_DATABASE_URL", production));
  assert.throws(() => assertProductionRuntimeDatabaseUrl(workspaceUrl.replace("verify-full", "require"), "digipants_workspace_prod", "PRODUCTION_WORKSPACE_DATABASE_URL", production));
  const authUrl = "postgresql://cw_auth_prod_app:test-value@ep-prod-pooler.us-east-1.aws.neon.tech/digipants_auth_prod?sslmode=verify-full";
  assert.equal(assertProductionRuntimeDatabaseUrl(authUrl, "digipants_auth_prod", "PRODUCTION_AUTH_DATABASE_URL", production), authUrl);
  assert.throws(() => assertProductionRuntimeDatabaseUrl(authUrl, "auth_spike_test", "PRODUCTION_AUTH_DATABASE_URL", production));
  assert.throws(() => assertProductionRuntimeDatabaseUrl(authUrl, "digipants_auth_prod", "AUTH_DATABASE_URL", production));
});
