-- Run once against the newly isolated production Neon branch after the
-- schema-owner/runtime groups exist in both production databases. No password
-- values belong in this file; set each login password in Neon securely.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'digipants_workspace_prod') OR
     NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'digipants_auth_prod') THEN
    RAISE EXCEPTION 'both isolated production databases must exist first';
  END IF;
  IF to_regrole('cw_runtime') IS NULL OR to_regrole('cw_auth_runtime') IS NULL OR
     to_regrole('cw_schema_owner') IS NULL OR to_regrole('cw_audit_writer') IS NULL THEN
    RAISE EXCEPTION 'production workspace role groups must be installed first';
  END IF;
  IF to_regrole('cw_workspace_prod_app') IS NOT NULL OR
     to_regrole('cw_auth_prod_app') IS NOT NULL THEN
    RAISE EXCEPTION 'production application logins already exist; inspect them before proceeding';
  END IF;
  EXECUTE 'CREATE ROLE cw_workspace_prod_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION';
  EXECUTE 'CREATE ROLE cw_auth_prod_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION';
END
$$;

GRANT cw_runtime TO cw_workspace_prod_app;
GRANT cw_auth_runtime TO cw_auth_prod_app;

REVOKE CONNECT ON DATABASE digipants_workspace_prod FROM PUBLIC;
REVOKE CONNECT ON DATABASE digipants_auth_prod FROM PUBLIC;
REVOKE CONNECT ON DATABASE digipants_workspace_prod FROM cw_auth_prod_app;
REVOKE CONNECT ON DATABASE digipants_auth_prod FROM cw_workspace_prod_app;
GRANT CONNECT ON DATABASE digipants_workspace_prod TO cw_workspace_prod_app;
GRANT CONNECT ON DATABASE digipants_auth_prod TO cw_auth_prod_app;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
     WHERE rolname = 'cw_workspace_prod_app' AND rolcanlogin
       AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb
       AND NOT rolcreaterole AND NOT rolreplication AND rolinherit
  ) OR NOT pg_has_role('cw_workspace_prod_app', 'cw_runtime', 'USAGE') OR
       pg_has_role('cw_workspace_prod_app', 'cw_auth_runtime', 'USAGE') OR
       pg_has_role('cw_workspace_prod_app', 'cw_schema_owner', 'USAGE') OR
       pg_has_role('cw_workspace_prod_app', 'cw_audit_writer', 'USAGE') OR
       NOT has_database_privilege('cw_workspace_prod_app', 'digipants_workspace_prod', 'CONNECT') OR
       has_database_privilege('cw_workspace_prod_app', 'digipants_auth_prod', 'CONNECT') THEN
    RAISE EXCEPTION 'workspace production login is not restricted to cw_runtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
     WHERE rolname = 'cw_auth_prod_app' AND rolcanlogin
       AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb
       AND NOT rolcreaterole AND NOT rolreplication AND rolinherit
  ) OR NOT pg_has_role('cw_auth_prod_app', 'cw_auth_runtime', 'USAGE') OR
       pg_has_role('cw_auth_prod_app', 'cw_runtime', 'USAGE') OR
       pg_has_role('cw_auth_prod_app', 'cw_schema_owner', 'USAGE') OR
       pg_has_role('cw_auth_prod_app', 'cw_audit_writer', 'USAGE') OR
       NOT has_database_privilege('cw_auth_prod_app', 'digipants_auth_prod', 'CONNECT') OR
       has_database_privilege('cw_auth_prod_app', 'digipants_workspace_prod', 'CONNECT') THEN
    RAISE EXCEPTION 'auth production login is not restricted to cw_auth_runtime';
  END IF;
END
$$;
COMMIT;
