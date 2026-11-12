-- Workspace row isolation v2: apply AFTER reviewed roles.sql and hardening.sql.
-- Run transactionally as the trusted schema installer, NEVER as an app login.
-- Separate RLS from server-verified Better Auth/session grants: the tenant GUC
-- is a scope guard only, not a trusted authentication decision.
BEGIN;
GRANT cw_schema_owner TO CURRENT_USER WITH SET TRUE;
SET LOCAL ROLE cw_schema_owner;

-- The first six tables had unrestricted SELECT for cw_runtime in the v1
-- rehearsal. Each now denies an unscoped transaction and is FORCE RLS.
ALTER TABLE public.workspace_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_v2_tenants_owner ON public.workspace_tenants
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);
CREATE POLICY cw_v2_tenants_runtime ON public.workspace_tenants
  FOR SELECT TO cw_runtime
  USING (id = public.cw_workspace_context_tenant_id());

ALTER TABLE public.workspace_client_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_client_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_v2_client_memberships_owner ON public.workspace_client_memberships
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);
CREATE POLICY cw_v2_client_memberships_runtime ON public.workspace_client_memberships
  FOR SELECT TO cw_runtime, cw_audit_writer
  USING (tenant_id = public.cw_workspace_context_tenant_id());

ALTER TABLE public.workspace_client_project_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_client_project_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_v2_client_grants_owner ON public.workspace_client_project_grants
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);
CREATE POLICY cw_v2_client_grants_runtime ON public.workspace_client_project_grants
  FOR SELECT TO cw_runtime
  USING (tenant_id = public.cw_workspace_context_tenant_id());

ALTER TABLE public.workspace_staff_project_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_staff_project_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_v2_staff_grants_owner ON public.workspace_staff_project_grants
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);
CREATE POLICY cw_v2_staff_grants_runtime ON public.workspace_staff_project_grants
  FOR SELECT TO cw_runtime, cw_audit_writer
  USING (tenant_id = public.cw_workspace_context_tenant_id());

ALTER TABLE public.workspace_staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_staff_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_v2_staff_memberships_owner ON public.workspace_staff_memberships
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);
CREATE POLICY cw_v2_staff_memberships_runtime ON public.workspace_staff_memberships
  FOR SELECT TO cw_runtime, cw_audit_writer USING (
    EXISTS (
      SELECT 1 FROM public.workspace_staff_project_grants AS grant_row
       WHERE grant_row.principal_id = workspace_staff_memberships.principal_id
         AND grant_row.tenant_id = public.cw_workspace_context_tenant_id()
         AND grant_row.status = 'active' AND grant_row.revoked_at IS NULL
    )
  );

ALTER TABLE public.workspace_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_principals FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_v2_principals_owner ON public.workspace_principals
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);
CREATE POLICY cw_v2_principals_runtime ON public.workspace_principals
  FOR SELECT TO cw_runtime, cw_audit_writer USING (
    EXISTS (
      SELECT 1 FROM public.workspace_client_memberships AS membership
       WHERE membership.principal_id = workspace_principals.id
         AND membership.tenant_id = public.cw_workspace_context_tenant_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_staff_project_grants AS grant_row
       WHERE grant_row.principal_id = workspace_principals.id
         AND grant_row.tenant_id = public.cw_workspace_context_tenant_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_enrollment_attempts AS attempt
       WHERE attempt.provider_subject = workspace_principals.provider_subject
         AND attempt.tenant_id = public.cw_workspace_context_tenant_id()
    )
  );

-- Exact lookup used only after an auth-side verified enrollment attempt.
-- Do not grant unrestricted principal SELECT before a membership exists.
CREATE OR REPLACE FUNCTION public.cw_principal_exists_for_attempt(
  p_attempt_id uuid, p_provider_subject text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_attempt_id IS NOT NULL
     AND p_provider_subject IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.workspace_enrollment_attempts AS attempt
         JOIN public.workspace_principals AS principal
           ON principal.provider = 'better_auth'
          AND principal.provider_subject = attempt.provider_subject
        WHERE attempt.id = p_attempt_id
          AND attempt.provider_subject = p_provider_subject
     );
$$;
REVOKE ALL ON FUNCTION public.cw_principal_exists_for_attempt(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_principal_exists_for_attempt(uuid,text) TO cw_runtime;

-- The journal previously exposed every tenant's invitation hashes and email.
-- All three DML policies require the current transaction's scope. A strict
-- SECURITY DEFINER scope lookup exposes only a tenant UUID, never the record.
ALTER TABLE public.workspace_enrollment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_enrollment_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_v2_enrollment_owner ON public.workspace_enrollment_attempts
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);
CREATE POLICY cw_v2_enrollment_select ON public.workspace_enrollment_attempts
  FOR SELECT TO cw_runtime, cw_audit_writer
  USING (tenant_id = public.cw_workspace_context_tenant_id());
CREATE POLICY cw_v2_enrollment_insert ON public.workspace_enrollment_attempts
  FOR INSERT TO cw_runtime
  WITH CHECK (tenant_id = public.cw_workspace_context_tenant_id());
CREATE POLICY cw_v2_enrollment_update ON public.workspace_enrollment_attempts
  FOR UPDATE TO cw_runtime
  USING (tenant_id = public.cw_workspace_context_tenant_id())
  WITH CHECK (tenant_id = public.cw_workspace_context_tenant_id());

CREATE OR REPLACE FUNCTION public.cw_enrollment_scope_by_attempt(p_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT tenant_id FROM public.workspace_enrollment_attempts
   WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.cw_enrollment_scope_by_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_enrollment_scope_by_attempt(uuid) TO cw_runtime;

CREATE OR REPLACE FUNCTION public.cw_enrollment_project_by_attempt(p_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT project_id FROM public.workspace_enrollment_attempts
   WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.cw_enrollment_project_by_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_enrollment_project_by_attempt(uuid) TO cw_runtime;

CREATE OR REPLACE FUNCTION public.cw_enrollment_scope_by_subject(p_subject text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT tenant_id FROM public.workspace_enrollment_attempts
   WHERE provider_subject = p_subject
     AND p_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;
REVOKE ALL ON FUNCTION public.cw_enrollment_scope_by_subject(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_enrollment_scope_by_subject(text) TO cw_runtime;

RESET ROLE;
REVOKE cw_schema_owner FROM CURRENT_USER;

DO $$
BEGIN
  -- A PostgreSQL superuser can assume any role by definition. Only
  -- assert membership hygiene for non-superuser migration installers.
  IF NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
     AND (pg_has_role(current_user, 'cw_schema_owner', 'SET')
          OR pg_has_role(current_user, 'cw_schema_owner', 'USAGE')) THEN
    RAISE EXCEPTION 'installer retained owner rights after v2 scope hardening';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('workspace_principals','workspace_tenants',
         'workspace_client_memberships','workspace_staff_memberships',
         'workspace_client_project_grants','workspace_staff_project_grants',
         'workspace_enrollment_attempts')
       AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'workspace v2 sensitive table RLS not forced';
  END IF;
END $$;
COMMIT;
