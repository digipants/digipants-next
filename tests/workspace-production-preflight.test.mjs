import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../scripts/workspace/production-security-preflight.sql", import.meta.url), "utf8");
const auth = readFileSync(new URL("../scripts/workspace/production-auth-preflight.sql", import.meta.url), "utf8");

test("production SQL preflights are read-only", () => {
  for (const sql of [workspace, auth]) {
    const withoutComments = sql.replace(/^--.*$/gm, "");
    assert.doesNotMatch(withoutComments, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\s+(?:TABLE|ROLE|SCHEMA|DATABASE|INTO|FROM|ON|POLICY|FUNCTION)\b/i);
    assert.match(withoutComments, /^\s*WITH\s+/i);
    assert.match(withoutComments, /\bmigration_ledger_present\b/);
  }
});

test("Workspace production preflight covers every sensitive journal and grant table", () => {
  for (const name of [
    "workspace_principals", "workspace_tenants",
    "workspace_client_memberships", "workspace_staff_memberships",
    "workspace_client_project_grants", "workspace_staff_project_grants",
    "workspace_enrollment_attempts",
  ]) assert.ok(workspace.includes(name), `Missing RLS audit: ${name}`);
  assert.match(workspace, /relrowsecurity\s+AND\s+relforcerowsecurity/);
  assert.match(workspace, /can_select\s+AND\s+NOT/);
  assert.match(workspace, /cross_database_access_denied/);
  assert.match(workspace, /invitation_bearers_private/);
  assert.match(workspace, /customer_content_force_rls/);
  assert.match(workspace, /signed_context_key_private/);
  assert.match(workspace, /signed_context_key_configured/);
  assert.match(workspace, /signed_context_helpers_owned/);
});

test("Better Auth production preflight denies administrator privileges and mail deletion", () => {
  for (const flag of [
    "restricted_auth_login", "auth_membership_separated",
    "cross_database_access_denied", "outbox_retries_without_deletion",
    "session_logout_grants", "auth_tables_present",
  ]) assert.ok(auth.includes(flag), `Missing authentication audit: ${flag}`);
  assert.match(auth, /NOT\s+rolbypassrls/);
  assert.match(auth, /NOT\s+rolcreaterole/);
  assert.match(auth, /to_regnamespace\('auth_spike'\)/);
});
