-- Read-only, fail-closed production workspace security acceptance query.
-- Execute in digipants_workspace_prod as a migration/audit identity AFTER migrations.
-- A 'false' or NULL flag means NO-GO. Do not use this query to turn on any route.
WITH sensitive(name) AS (
  VALUES
    ('workspace_principals'),
    ('workspace_tenants'),
    ('workspace_client_memberships'),
    ('workspace_staff_memberships'),
    ('workspace_client_project_grants'),
    ('workspace_staff_project_grants'),
    ('workspace_enrollment_attempts')
),
sensitive_audit AS (
  SELECT s.name, c.oid, c.relrowsecurity, c.relforcerowsecurity,
         COALESCE(has_table_privilege('cw_workspace_prod_app', c.oid, 'SELECT'), false) AS can_select
    FROM sensitive AS s
    LEFT JOIN pg_catalog.pg_namespace AS n ON n.nspname = 'public'
    LEFT JOIN pg_catalog.pg_class AS c
      ON c.relnamespace = n.oid AND c.relname = s.name AND c.relkind = 'r'
),
protected_content AS (
  SELECT COUNT(*) FILTER (WHERE c.oid IS NOT NULL AND c.relrowsecurity AND c.relforcerowsecurity) AS protected_count
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('workspace_projects','workspace_milestones','workspace_progress_updates','workspace_audit_events')
     AND c.relkind = 'r'
),
roles AS (
  SELECT
    COUNT(*) FILTER (
      WHERE rolname IN ('cw_workspace_prod_app', 'cw_auth_prod_app')
        AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
        AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
    ) AS restricted_login_count
  FROM pg_catalog.pg_roles
)
SELECT
  current_database() = 'digipants_workspace_prod' AS expected_database,
  (SELECT restricted_login_count = 2 FROM roles) AS restricted_login_roles,
  pg_has_role('cw_workspace_prod_app','cw_runtime','USAGE')
    AND NOT pg_has_role('cw_workspace_prod_app','cw_auth_runtime','USAGE')
    AND NOT pg_has_role('cw_workspace_prod_app','cw_schema_owner','USAGE')
    AND NOT pg_has_role('cw_workspace_prod_app','cw_audit_writer','USAGE')
      AS workspace_membership_separated,
  has_database_privilege('cw_workspace_prod_app','digipants_workspace_prod','CONNECT')
    AND NOT has_database_privilege('cw_workspace_prod_app','digipants_auth_prod','CONNECT')
    AND has_database_privilege('cw_auth_prod_app','digipants_auth_prod','CONNECT')
    AND NOT has_database_privilege('cw_auth_prod_app','digipants_workspace_prod','CONNECT')
      AS cross_database_access_denied,
  (SELECT COUNT(*) = 7 FROM sensitive_audit WHERE oid IS NOT NULL) AS sensitive_tables_present,
  NOT EXISTS (
    SELECT 1 FROM sensitive_audit
     WHERE can_select AND NOT (relrowsecurity AND relforcerowsecurity)
  ) AS no_unscoped_sensitive_select,
  (SELECT protected_count = 4 FROM protected_content) AS customer_content_force_rls,
  to_regclass('public.workspace_invitation_records') IS NOT NULL
    AND NOT COALESCE(has_table_privilege('cw_workspace_prod_app',to_regclass('public.workspace_invitation_records'),'SELECT'),false) AS invitation_bearers_private,
  to_regclass('public.workspace_audit_events') IS NOT NULL
    AND NOT COALESCE(has_table_privilege('cw_workspace_prod_app',to_regclass('public.workspace_audit_events'),'INSERT'),false) AS audit_append_restricted,
  to_regclass('public._prisma_migrations') IS NOT NULL AS migration_ledger_present,
  CASE WHEN to_regclass('public.workspace_projects') IS NULL THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'workspace_projects' AND n.nspname = 'public'
        AND c.relrowsecurity = false
    )
  END AS project_rls_enabled;
