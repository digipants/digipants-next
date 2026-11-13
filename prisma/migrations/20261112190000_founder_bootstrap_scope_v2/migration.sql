-- Production-safe founder bootstrap target. Historical synthetic fixture DML is
-- unchanged for Prisma checksum integrity; this migration ensures a live
-- founder can NEVER be granted access to a hardcoded sample tenant/project.
-- A privileged operator must explicitly bind the empty production control
-- row to a newly created, real DigiPants internal project and mailbox hash.
ALTER TABLE public.workspace_founder_bootstrap_control
  ADD COLUMN target_tenant_id uuid,
  ADD COLUMN target_project_id uuid,
  ADD COLUMN staff_role text NOT NULL DEFAULT 'delivery_lead'
    CHECK (staff_role IN ('delivery_lead','workspace_owner')),
  ADD CONSTRAINT founder_bootstrap_target_pair
    CHECK ((target_tenant_id IS NULL) = (target_project_id IS NULL));

-- Preserve existing staging/CI fixtures. Production stays unconfigured.
UPDATE public.workspace_founder_bootstrap_control
   SET target_tenant_id = '11111111-1111-4111-8111-111111111111',
       target_project_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       staff_role = 'delivery_lead'
 WHERE singleton AND current_database() <> 'digipants_workspace_prod';

CREATE OR REPLACE FUNCTION public.cw_founder_bootstrap_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_founder_bootstrap_control AS control
      JOIN public.workspace_projects AS project
        ON project.id = control.target_project_id
       AND project.tenant_id = control.target_tenant_id
      JOIN public.workspace_tenants AS tenant ON tenant.id = project.tenant_id
     WHERE control.singleton AND control.founder_email_hash IS NOT NULL
       AND control.completed_at IS NULL
       AND project.publication = 'published' AND tenant.status = 'active'
       AND (current_database() <> 'digipants_workspace_prod'
         OR (control.staff_role = 'workspace_owner'
           AND project.title <> 'Synthetic Project A'
           AND tenant.legal_name <> 'Synthetic Tenant A'))
  )
$$;
REVOKE ALL ON FUNCTION public.cw_founder_bootstrap_active() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_founder_bootstrap_is_open(p_email_hash bytea)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_email_hash IS NOT NULL AND octet_length(p_email_hash) = 32 AND EXISTS (
    SELECT 1
      FROM public.workspace_founder_bootstrap_control AS control
      JOIN public.workspace_projects AS project
        ON project.id = control.target_project_id
       AND project.tenant_id = control.target_tenant_id
      JOIN public.workspace_tenants AS tenant ON tenant.id = project.tenant_id
     WHERE control.singleton AND control.founder_email_hash = p_email_hash
       AND control.completed_at IS NULL
       AND project.publication = 'published' AND tenant.status = 'active'
       AND (current_database() <> 'digipants_workspace_prod'
         OR (control.staff_role = 'workspace_owner'
           AND project.title <> 'Synthetic Project A'
           AND tenant.legal_name <> 'Synthetic Tenant A'))
  )
$$;
REVOKE ALL ON FUNCTION public.cw_founder_bootstrap_is_open(bytea) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_begin_founder_bootstrap(
  p_email_hash bytea, p_candidate_subject text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  saved_subject text;
  v_tenant_id uuid;
  v_project_id uuid;
  v_role text;
BEGIN
  IF p_email_hash IS NULL OR octet_length(p_email_hash) <> 32 OR
     p_candidate_subject IS NULL OR
     p_candidate_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT pending_provider_subject, target_tenant_id, target_project_id, staff_role
    INTO saved_subject, v_tenant_id, v_project_id, v_role
    FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash = p_email_hash AND completed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR v_tenant_id IS NULL OR v_project_id IS NULL THEN RETURN NULL; END IF;
  IF current_database() = 'digipants_workspace_prod' AND v_role <> 'workspace_owner' THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_projects AS project
      JOIN public.workspace_tenants AS tenant ON tenant.id = project.tenant_id
     WHERE project.id = v_project_id AND project.tenant_id = v_tenant_id
       AND project.publication = 'published' AND tenant.status = 'active'
       AND (current_database() <> 'digipants_workspace_prod'
         OR (project.title <> 'Synthetic Project A'
             AND tenant.legal_name <> 'Synthetic Tenant A'))
  ) THEN RETURN NULL; END IF;

  IF saved_subject IS NULL THEN
    UPDATE public.workspace_founder_bootstrap_control
       SET pending_provider_subject = p_candidate_subject
     WHERE singleton AND completed_at IS NULL;
    saved_subject := p_candidate_subject;
  END IF;
  RETURN saved_subject;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_begin_founder_bootstrap(bytea,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_complete_founder_bootstrap(
  p_email_hash bytea, p_provider_subject text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_project_id uuid;
  v_role text;
  v_principal_id uuid;
  saved_subject text;
  completed_subject text;
  done_at timestamptz;
BEGIN
  IF p_email_hash IS NULL OR octet_length(p_email_hash) <> 32 OR
     p_provider_subject IS NULL OR
     p_provider_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  SELECT pending_provider_subject, completed_provider_subject, completed_at,
         target_tenant_id, target_project_id, staff_role
    INTO saved_subject, completed_subject, done_at,
         v_tenant_id, v_project_id, v_role
    FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash = p_email_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF done_at IS NOT NULL THEN RETURN completed_subject = p_provider_subject; END IF;
  IF saved_subject IS NULL OR saved_subject <> p_provider_subject OR
     v_tenant_id IS NULL OR v_project_id IS NULL OR
     (current_database() = 'digipants_workspace_prod' AND v_role <> 'workspace_owner') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_projects AS project
      JOIN public.workspace_tenants AS tenant ON tenant.id = project.tenant_id
     WHERE project.id = v_project_id AND project.tenant_id = v_tenant_id
       AND project.publication = 'published' AND tenant.status = 'active'
       AND (current_database() <> 'digipants_workspace_prod'
         OR (project.title <> 'Synthetic Project A'
           AND tenant.legal_name <> 'Synthetic Tenant A'))
  ) THEN RETURN false; END IF;

  INSERT INTO public.workspace_principals(provider,provider_subject,kind,status)
  VALUES ('better_auth',p_provider_subject,'staff','active')
  RETURNING id INTO v_principal_id;
  INSERT INTO public.workspace_staff_memberships(principal_id,principal_kind,status)
  VALUES (v_principal_id,'staff','active');
  INSERT INTO public.workspace_staff_project_grants
    (tenant_id,project_id,principal_id,role,status)
  VALUES (v_tenant_id,v_project_id,v_principal_id,v_role,'active');

  PERFORM set_config('app.workspace_tenant_id', v_tenant_id::text, true);
  PERFORM public.cw_append_audit_event(
    v_tenant_id,v_project_id,v_principal_id,'system','founder.bootstrap.completed',
    'workspace_staff_membership',v_principal_id::text,NULL,NULL,
    'founder-bootstrap:' || p_provider_subject || ':completed');
  UPDATE public.workspace_founder_bootstrap_control
     SET completed_provider_subject = p_provider_subject,
         completed_at = statement_timestamp()
   WHERE singleton AND completed_at IS NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_complete_founder_bootstrap(bytea,text) FROM PUBLIC;
