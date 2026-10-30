import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWorkspaceTestTarget } from "./client-workspace-db-test-target.mjs";

const databaseUrl = "postgresql://synthetic-user:synthetic-password@ep-approved-123.neon.tech/digipants_workspace_dev?sslmode=require";

function approvedNeon(overrides = {}) {
  return resolveWorkspaceTestTarget({
    databaseUrl,
    neonApproval: "1",
    expectedNeonHost: "ep-approved-123.neon.tech",
    ...overrides,
  });
}

test("Neon database tests require the separately supplied exact approved hostname", () => {
  assert.equal(approvedNeon(), "neon");
  assert.throws(() => approvedNeon({ expectedNeonHost: undefined }), /separately approved exact Neon hostname/);
  assert.throws(() => approvedNeon({ expectedNeonHost: "*.neon.tech" }), /separately approved exact Neon hostname/);
  assert.throws(() => approvedNeon({ expectedNeonHost: "ep-another-project.neon.tech" }), /does not match/);
  assert.throws(() => approvedNeon({ databaseUrl: databaseUrl.replace("ep-approved-123", "ep-another-project") }), /does not match/);
});

test("Neon database tests reject the wrong database and non-PostgreSQL URL before access", () => {
  assert.throws(() => approvedNeon({ databaseUrl: databaseUrl.replace("digipants_workspace_dev", "neondb") }), /database name/);
  assert.throws(() => approvedNeon({ databaseUrl: databaseUrl.replace("postgresql:", "https:") }), /must use PostgreSQL/);
  assert.throws(() => approvedNeon({ databaseUrl: `${databaseUrl}&host=ep-unapproved.neon.tech` }), /connection override/);
  assert.throws(() => approvedNeon({ databaseUrl: databaseUrl.replace(".tech/", ".tech:6543/") }), /connection override/);
});

test("local database tests accept only explicit loopback targets and reject ambiguous guards", () => {
  assert.equal(resolveWorkspaceTestTarget({
    databaseUrl: "postgresql://synthetic-user:synthetic-password@127.0.0.1/digipants_workspace_dev",
    localApproval: "1",
  }), "local");
  assert.throws(() => resolveWorkspaceTestTarget({
    databaseUrl,
    localApproval: "1",
  }), /loopback-only/);
  assert.throws(() => resolveWorkspaceTestTarget({
    databaseUrl,
    localApproval: "1",
    neonApproval: "1",
    expectedNeonHost: "ep-approved-123.neon.tech",
  }), /exactly one/);
  assert.throws(() => resolveWorkspaceTestTarget({
    databaseUrl,
    neonApproval: "true",
  }), /exact approved Neon host/);
});
