-- Disposable PostgreSQL 17 experiment ONLY. Never apply to hosted Neon or production.
-- This script is deliberately NOT a Prisma migration or production role plan.
-- Run after the existing root Prisma migration and synthetic fixture seed.
-- Runtime is NOLOGIN; tests use SET ROLE, never store passwords in Git.

CREATE ROLE cw_runtime_test NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

REVOKE ALL ON TABLE workspace_projects, workspace_audit_events FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cw_runtime_test;
GRANT SELECT ON TABLE workspace_projects TO cw_runtime_test;
GRANT UPDATE (state, revision) ON TABLE workspace_projects TO cw_runtime_test;
GRANT SELECT, INSERT ON TABLE workspace_audit_events TO cw_runtime_test;

-- This custom GUC is *not authenticated*: anyone with SQL privileges can set it.
-- The policy demonstrates defense-in-depth only. Real sessions must establish
-- a trusted tenant context in a transaction-scoped, pooled-connection-safe path.
ALTER TABLE workspace_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_runtime_project_read ON workspace_projects
  FOR SELECT TO cw_runtime_test
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);
CREATE POLICY cw_runtime_project_update ON workspace_projects
  FOR UPDATE TO cw_runtime_test
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);

ALTER TABLE workspace_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_runtime_audit_read ON workspace_audit_events
  FOR SELECT TO cw_runtime_test
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);
CREATE POLICY cw_runtime_audit_insert ON workspace_audit_events
  FOR INSERT TO cw_runtime_test
  WITH CHECK (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);

-- Trigger complements (not replaces) revoked privileges. A database
-- superuser/table owner can disable triggers: production must separate these
-- privileges and use offsite, tamper-evident audit replication.
CREATE FUNCTION cw_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workspace audit records are append-only'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER cw_audit_reject_update_delete
  BEFORE UPDATE OR DELETE ON workspace_audit_events
  FOR EACH ROW EXECUTE FUNCTION cw_reject_audit_mutation();
CREATE TRIGGER cw_audit_reject_truncate
  BEFORE TRUNCATE ON workspace_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION cw_reject_audit_mutation();
