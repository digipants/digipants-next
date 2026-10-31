\set ON_ERROR_STOP on
-- PostgreSQL 17 disposable role rehearsal only. This file contains role
-- definitions, never passwords or hosted account bindings. The real login
-- principal is provisioned separately and must not be a superuser.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cw_schema_owner') THEN
    CREATE ROLE cw_schema_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cw_migrator') THEN
    CREATE ROLE cw_migrator NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cw_runtime') THEN
    CREATE ROLE cw_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cw_auth_runtime') THEN
    CREATE ROLE cw_auth_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cw_audit_writer') THEN
    CREATE ROLE cw_audit_writer NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cw_audit_reader') THEN
    CREATE ROLE cw_audit_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

-- PostgreSQL 17 / Neon: ALTER OWNER requires the installer to have SET ROLE
-- permission for the target owner. The install MUST be wrapped in a single
-- transaction with hardening.sql, whose final statements revoke these grants.
-- Never execute the two scripts independently in a hosted environment.
GRANT cw_schema_owner TO CURRENT_USER WITH SET TRUE;
GRANT cw_audit_writer TO CURRENT_USER WITH SET TRUE;

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
