\set ON_ERROR_STOP on
-- PostgreSQL 17 disposable role rehearsal only. This file contains role
-- definitions, never passwords or hosted account bindings. The real login
-- principal is provisioned separately and must not be a superuser.
CREATE ROLE cw_schema_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE cw_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE cw_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE cw_audit_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE cw_audit_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

GRANT cw_schema_owner TO cw_migrator;
ALTER SCHEMA public OWNER TO cw_schema_owner;
DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    ALTER TABLE public."_prisma_migrations" OWNER TO cw_schema_owner;
  END IF;
END $$;
ALTER TABLE public.workspace_principals OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_tenants OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_client_memberships OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_staff_memberships OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_projects OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_client_project_grants OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_staff_project_grants OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_invitation_records OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_enrollment_attempts OWNER TO cw_schema_owner;
ALTER TABLE public.workspace_audit_events OWNER TO cw_schema_owner;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO cw_schema_owner;
GRANT USAGE ON SCHEMA public TO cw_runtime, cw_audit_writer, cw_audit_reader;
