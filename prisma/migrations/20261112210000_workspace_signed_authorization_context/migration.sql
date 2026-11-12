-- Signed request scope prevents a database login from selecting a tenant by
-- setting an ordinary PostgreSQL custom GUC. The key is provisioned out of
-- band per environment; this migration intentionally creates no key material.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.workspace_context_signing_keys (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  signing_key bytea NOT NULL CHECK (octet_length(signing_key) = 32),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
REVOKE ALL ON public.workspace_context_signing_keys FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_verified_workspace_context()
RETURNS TABLE (tenant_id uuid, project_id uuid, actor_subject text, purpose text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  token text;
  payload_hex text;
  supplied_signature text;
  payload_bytes bytea;
  payload text;
  parts text[];
  secret bytea;
BEGIN
  token := NULLIF(current_setting('app.workspace_context_token', true), '');
  IF token IS NULL OR length(token) > 1089 OR token !~ '^[0-9a-f]+\.[0-9a-f]{64}$' THEN RETURN; END IF;
  payload_hex := split_part(token, '.', 1);
  supplied_signature := split_part(token, '.', 2);
  payload_bytes := decode(payload_hex, 'hex');
  payload := convert_from(payload_bytes, 'UTF8');
  parts := string_to_array(payload, '|');
  IF cardinality(parts) <> 6 OR parts[1] <> 'v1' OR
     parts[2] <> pg_current_xact_id()::text OR
     parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     (parts[4] <> '' AND parts[4] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') OR
     (parts[5] <> '' AND parts[5] !~ '^[A-Za-z0-9_-]{1,255}$') OR
     parts[6] !~ '^[a-z][a-z0-9_.-]{0,47}$' THEN
    RETURN;
  END IF;
  SELECT signing_key INTO secret
    FROM public.workspace_context_signing_keys WHERE singleton;
  IF secret IS NULL OR
     hmac(payload_bytes, secret, 'sha256') <> decode(supplied_signature, 'hex') THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT parts[3]::uuid,
    CASE WHEN parts[4] = '' THEN NULL ELSE parts[4]::uuid END,
    NULLIF(parts[5], ''), parts[6];
EXCEPTION WHEN OTHERS THEN
  -- Malformed/untrusted context fails closed without exposing validation detail.
  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_verified_workspace_context() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_workspace_context_tenant_id()
RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT tenant_id FROM public.cw_verified_workspace_context() LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.cw_workspace_context_tenant_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_workspace_context_allows(
  p_tenant_id uuid, p_project_id uuid, p_actor_subject text, p_purpose text
) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cw_verified_workspace_context() AS context
     WHERE context.tenant_id = p_tenant_id
       AND context.project_id IS NOT DISTINCT FROM p_project_id
       AND context.actor_subject IS NOT DISTINCT FROM p_actor_subject
       AND context.purpose = p_purpose
  )
$$;
REVOKE ALL ON FUNCTION public.cw_workspace_context_allows(uuid,uuid,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_lock_staff_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE authorized_principal_id uuid;
BEGIN
  IF p_action NOT IN ('project.activate', 'project.close', 'delivery.edit') OR
     NOT public.cw_workspace_context_allows(p_tenant_id, p_project_id, p_provider_subject, p_action) THEN
    RETURN NULL;
  END IF;
  SELECT p.id INTO authorized_principal_id
    FROM public.workspace_principals AS p
    JOIN public.workspace_staff_memberships AS m ON m.principal_id = p.id
    JOIN public.workspace_staff_project_grants AS g ON g.principal_id = p.id
    JOIN public.workspace_tenants AS t ON t.id = g.tenant_id
   WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject
     AND p.kind = 'staff' AND p.status = 'active'
     AND m.principal_kind = 'staff' AND m.status = 'active' AND m.revoked_at IS NULL
     AND g.status = 'active' AND g.revoked_at IS NULL
     AND g.tenant_id = p_tenant_id AND g.project_id = p_project_id
     AND t.status = 'active'
     AND ((p_action IN ('project.activate', 'project.close') AND g.role = 'workspace_owner')
       OR (p_action = 'delivery.edit' AND g.role IN ('delivery_staff', 'delivery_lead')))
   LIMIT 1 FOR SHARE OF p, m, g, t;
  RETURN authorized_principal_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_lock_staff_project_grant(text,uuid,uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_lock_client_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE authorized_principal_id uuid;
BEGIN
  IF p_action <> 'project.read_published' OR
     NOT public.cw_workspace_context_allows(p_tenant_id, p_project_id, p_provider_subject, p_action) THEN
    RETURN NULL;
  END IF;
  SELECT p.id INTO authorized_principal_id
    FROM public.workspace_principals AS p
    JOIN public.workspace_client_memberships AS m ON m.principal_id = p.id
    JOIN public.workspace_client_project_grants AS g ON g.tenant_id = m.tenant_id AND g.principal_id = p.id
    JOIN public.workspace_tenants AS t ON t.id = g.tenant_id
   WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject
     AND p.kind = 'client' AND p.status = 'active'
     AND m.principal_kind = 'client' AND m.status = 'active' AND m.revoked_at IS NULL
     AND m.tenant_id = p_tenant_id AND g.project_id = p_project_id
     AND g.tenant_id = p_tenant_id AND g.status = 'active' AND g.revoked_at IS NULL
     AND g.role IN ('client_viewer','client_contributor','client_approver','client_signatory')
     AND t.status = 'active'
   LIMIT 1 FOR SHARE OF p, m, g, t;
  RETURN authorized_principal_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_lock_client_project_grant(text,uuid,uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_append_audit_event(
  p_tenant_id uuid, p_project_id uuid, p_actor_principal_id uuid,
  p_origin text, p_action text, p_object_type text, p_object_id text,
  p_before_revision bigint, p_after_revision bigint, p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF context.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'workspace audit context mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_actor_principal_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.workspace_principals AS principal
      WHERE principal.id = p_actor_principal_id
        AND principal.provider = 'better_auth'
        AND principal.provider_subject = context.actor_subject)
       OR context.project_id IS DISTINCT FROM p_project_id THEN
      RAISE EXCEPTION 'workspace audit actor mismatch' USING ERRCODE = '42501';
    END IF;
  ELSIF p_origin <> 'system' OR p_object_type <> 'workspace_enrollment_attempt' OR
        NOT EXISTS (SELECT 1 FROM public.workspace_enrollment_attempts AS attempt
          WHERE attempt.id::text = p_object_id AND attempt.tenant_id = p_tenant_id
            AND attempt.project_id = p_project_id
            AND (
              (context.purpose = 'enrollment' AND context.project_id IS NOT DISTINCT FROM p_project_id
                AND attempt.provider_subject = context.actor_subject)
              OR (context.purpose = 'project.activate' AND context.project_id IS NOT DISTINCT FROM p_project_id AND EXISTS (
                SELECT 1 FROM public.workspace_principals AS staff
                  JOIN public.workspace_staff_memberships AS membership
                    ON membership.principal_id = staff.id
                  JOIN public.workspace_staff_project_grants AS grant_row
                    ON grant_row.principal_id = staff.id
                 WHERE staff.provider = 'better_auth'
                   AND staff.provider_subject = context.actor_subject
                   AND staff.kind = 'staff' AND staff.status = 'active'
                   AND membership.principal_kind = 'staff'
                   AND membership.status = 'active' AND membership.revoked_at IS NULL
                   AND grant_row.tenant_id = p_tenant_id
                   AND grant_row.project_id = p_project_id
                   AND grant_row.role = 'workspace_owner'
                   AND grant_row.status = 'active' AND grant_row.revoked_at IS NULL
              ))
            )) THEN
    RAISE EXCEPTION 'workspace system audit context mismatch' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.workspace_audit_events
    (tenant_id, project_id, actor_principal_id, origin, action,
     object_type, object_id, before_revision, after_revision, idempotency_key)
  VALUES (p_tenant_id, p_project_id, p_actor_principal_id, p_origin, p_action,
    p_object_type, p_object_id, p_before_revision, p_after_revision, p_idempotency_key);
END;
$$;
REVOKE ALL ON FUNCTION public.cw_append_audit_event(uuid,uuid,uuid,text,text,text,text,bigint,bigint,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_ensure_disabled_client_principal(
  p_principal_id uuid, p_provider_subject text
) RETURNS TABLE (id uuid, kind text, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_principal_id IS NULL OR p_provider_subject IS NULL OR
     p_provider_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     context.actor_subject IS DISTINCT FROM p_provider_subject OR context.purpose <> 'enrollment' OR
     NOT EXISTS (SELECT 1 FROM public.workspace_enrollment_attempts AS attempt
       WHERE attempt.provider_subject = p_provider_subject AND attempt.tenant_id = context.tenant_id
         AND attempt.project_id IS NOT DISTINCT FROM context.project_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.workspace_principals (id, provider, provider_subject, kind, status)
  VALUES (p_principal_id, 'better_auth', p_provider_subject, 'client', 'disabled')
  ON CONFLICT (provider_subject) DO NOTHING;
  RETURN QUERY SELECT p.id, p.kind, p.status FROM public.workspace_principals AS p
    WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_ensure_disabled_client_principal(uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_disable_client_principal(
  p_attempt_id uuid, p_provider_subject text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE context record; changed integer;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_attempt_id IS NULL OR p_provider_subject IS NULL OR
     context.actor_subject IS DISTINCT FROM p_provider_subject OR context.purpose <> 'enrollment' OR
     NOT EXISTS (SELECT 1 FROM public.workspace_enrollment_attempts AS a
       WHERE a.id = p_attempt_id AND a.provider_subject = p_provider_subject
         AND a.tenant_id = context.tenant_id AND a.project_id IS NOT DISTINCT FROM context.project_id
         AND a.state IN ('pending','auth_created','grant_ready_for_review','needs_repair')) THEN
    RETURN false;
  END IF;
  UPDATE public.workspace_principals SET status = 'disabled'
   WHERE provider = 'better_auth' AND provider_subject = p_provider_subject
     AND kind = 'client' AND status = 'active';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_disable_client_principal(uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_founder_bootstrap_target(p_email_hash bytea)
RETURNS TABLE (tenant_id uuid, project_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT control.target_tenant_id, control.target_project_id
    FROM public.workspace_founder_bootstrap_control AS control
    JOIN public.workspace_projects AS project ON project.id = control.target_project_id
      AND project.tenant_id = control.target_tenant_id
    JOIN public.workspace_tenants AS tenant ON tenant.id = project.tenant_id
   WHERE p_email_hash IS NOT NULL AND octet_length(p_email_hash) = 32
     AND control.singleton AND control.founder_email_hash = p_email_hash
     AND control.completed_at IS NULL AND project.publication = 'published'
     AND tenant.status = 'active'
     AND (current_database() <> 'digipants_workspace_prod'
       OR (control.staff_role = 'workspace_owner'
         AND project.title <> 'Synthetic Project A'
         AND tenant.legal_name <> 'Synthetic Tenant A'))
$$;
REVOKE ALL ON FUNCTION public.cw_founder_bootstrap_target(bytea) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_begin_founder_bootstrap(
  p_email_hash bytea, p_candidate_subject text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE saved_subject text; v_tenant_id uuid; v_project_id uuid;
        v_role text; context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_email_hash IS NULL OR octet_length(p_email_hash) <> 32 OR
     p_candidate_subject IS NULL OR
     p_candidate_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT pending_provider_subject,target_tenant_id,target_project_id,staff_role
    INTO saved_subject,v_tenant_id,v_project_id,v_role
    FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash=p_email_hash AND completed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_tenant_id IS NULL OR v_project_id IS NULL OR
     context.tenant_id IS DISTINCT FROM v_tenant_id OR
     context.project_id IS DISTINCT FROM v_project_id OR
     context.actor_subject IS DISTINCT FROM p_candidate_subject OR
     context.purpose <> 'founder.bootstrap' THEN RETURN NULL; END IF;
  IF current_database()='digipants_workspace_prod' AND v_role <> 'workspace_owner' THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_projects AS project
    JOIN public.workspace_tenants AS tenant ON tenant.id=project.tenant_id
    WHERE project.id=v_project_id AND project.tenant_id=v_tenant_id
      AND project.publication='published' AND tenant.status='active'
      AND (current_database()<>'digipants_workspace_prod'
        OR (project.title<>'Synthetic Project A' AND tenant.legal_name<>'Synthetic Tenant A'))) THEN
    RETURN NULL;
  END IF;
  IF saved_subject IS NULL THEN
    UPDATE public.workspace_founder_bootstrap_control SET pending_provider_subject=p_candidate_subject
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
DECLARE v_tenant_id uuid; v_project_id uuid; v_role text; v_principal_id uuid;
        saved_subject text; completed_subject text; done_at timestamptz; context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_email_hash IS NULL OR octet_length(p_email_hash)<>32 OR p_provider_subject IS NULL OR
     p_provider_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  SELECT pending_provider_subject,completed_provider_subject,completed_at,
         target_tenant_id,target_project_id,staff_role
    INTO saved_subject,completed_subject,done_at,v_tenant_id,v_project_id,v_role
    FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash=p_email_hash FOR UPDATE;
  IF NOT FOUND OR context.tenant_id IS DISTINCT FROM v_tenant_id OR
     context.project_id IS DISTINCT FROM v_project_id OR
     context.actor_subject IS DISTINCT FROM p_provider_subject OR
     context.purpose <> 'founder.bootstrap' THEN RETURN false; END IF;
  IF done_at IS NOT NULL THEN RETURN completed_subject=p_provider_subject; END IF;
  IF saved_subject IS NULL OR saved_subject<>p_provider_subject OR v_tenant_id IS NULL OR
     v_project_id IS NULL OR (current_database()='digipants_workspace_prod' AND v_role<>'workspace_owner') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_projects AS project
    JOIN public.workspace_tenants AS tenant ON tenant.id=project.tenant_id
    WHERE project.id=v_project_id AND project.tenant_id=v_tenant_id
      AND project.publication='published' AND tenant.status='active'
      AND (current_database()<>'digipants_workspace_prod'
        OR (project.title<>'Synthetic Project A' AND tenant.legal_name<>'Synthetic Tenant A'))) THEN
    RETURN false;
  END IF;
  INSERT INTO public.workspace_principals(provider,provider_subject,kind,status)
  VALUES ('better_auth',p_provider_subject,'staff','active') RETURNING id INTO v_principal_id;
  INSERT INTO public.workspace_staff_memberships(principal_id,principal_kind,status)
  VALUES (v_principal_id,'staff','active');
  INSERT INTO public.workspace_staff_project_grants(tenant_id,project_id,principal_id,role,status)
  VALUES (v_tenant_id,v_project_id,v_principal_id,v_role,'active');
  PERFORM set_config('app.workspace_tenant_id',v_tenant_id::text,true);
  PERFORM public.cw_append_audit_event(v_tenant_id,v_project_id,v_principal_id,'system',
    'founder.bootstrap.completed','workspace_staff_membership',v_principal_id::text,
    NULL,NULL,'founder-bootstrap:'||p_provider_subject||':completed');
  UPDATE public.workspace_founder_bootstrap_control
     SET completed_provider_subject=p_provider_subject,completed_at=statement_timestamp()
   WHERE singleton AND completed_at IS NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_complete_founder_bootstrap(bytea,text) FROM PUBLIC;

DO $$
BEGIN
  -- All public RLS policies are installed by the atomic role hardening scripts.
  -- This assertion keeps the migration safe to apply before those scripts.
  IF to_regclass('public.workspace_context_signing_keys') IS NULL THEN
    RAISE EXCEPTION 'Workspace context key table was not created';
  END IF;
END $$;
 THEN RETURN; END IF;
  payload_hex := split_part(token, '.', 1);
  supplied_signature := split_part(token, '.', 2);
  payload_bytes := decode(payload_hex, 'hex');
  payload := convert_from(payload_bytes, 'UTF8');
  parts := string_to_array(payload, '|');
  IF cardinality(parts) <> 6 OR parts[1] <> 'v1' OR
     parts[2] <> pg_current_xact_id()::text OR
     parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     (parts[4] <> '' AND parts[4] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') OR
     (parts[5] <> '' AND parts[5] !~ '^[A-Za-z0-9_-]{1,255}$') OR
     parts[6] !~ '^[a-z][a-z0-9_.-]{0,47}$' THEN
    RETURN;
  END IF;
  SELECT signing_key INTO secret
    FROM public.workspace_context_signing_keys WHERE singleton;
  IF secret IS NULL OR
     hmac(payload_bytes, secret, 'sha256') <> decode(supplied_signature, 'hex') THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT parts[3]::uuid,
    CASE WHEN parts[4] = '' THEN NULL ELSE parts[4]::uuid END,
    NULLIF(parts[5], ''), parts[6];
EXCEPTION WHEN OTHERS THEN
  -- Malformed/untrusted context fails closed without exposing validation detail.
  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_verified_workspace_context() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_workspace_context_tenant_id()
RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT tenant_id FROM public.cw_verified_workspace_context() LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.cw_workspace_context_tenant_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_workspace_context_allows(
  p_tenant_id uuid, p_project_id uuid, p_actor_subject text, p_purpose text
) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cw_verified_workspace_context() AS context
     WHERE context.tenant_id = p_tenant_id
       AND context.project_id IS NOT DISTINCT FROM p_project_id
       AND context.actor_subject IS NOT DISTINCT FROM p_actor_subject
       AND context.purpose = p_purpose
  )
$$;
REVOKE ALL ON FUNCTION public.cw_workspace_context_allows(uuid,uuid,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_lock_staff_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE authorized_principal_id uuid;
BEGIN
  IF p_action NOT IN ('project.activate', 'project.close', 'delivery.edit') OR
     NOT public.cw_workspace_context_allows(p_tenant_id, p_project_id, p_provider_subject, p_action) THEN
    RETURN NULL;
  END IF;
  SELECT p.id INTO authorized_principal_id
    FROM public.workspace_principals AS p
    JOIN public.workspace_staff_memberships AS m ON m.principal_id = p.id
    JOIN public.workspace_staff_project_grants AS g ON g.principal_id = p.id
    JOIN public.workspace_tenants AS t ON t.id = g.tenant_id
   WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject
     AND p.kind = 'staff' AND p.status = 'active'
     AND m.principal_kind = 'staff' AND m.status = 'active' AND m.revoked_at IS NULL
     AND g.status = 'active' AND g.revoked_at IS NULL
     AND g.tenant_id = p_tenant_id AND g.project_id = p_project_id
     AND t.status = 'active'
     AND ((p_action IN ('project.activate', 'project.close') AND g.role = 'workspace_owner')
       OR (p_action = 'delivery.edit' AND g.role IN ('delivery_staff', 'delivery_lead')))
   LIMIT 1 FOR SHARE OF p, m, g, t;
  RETURN authorized_principal_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_lock_staff_project_grant(text,uuid,uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_lock_client_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE authorized_principal_id uuid;
BEGIN
  IF p_action <> 'project.read_published' OR
     NOT public.cw_workspace_context_allows(p_tenant_id, p_project_id, p_provider_subject, p_action) THEN
    RETURN NULL;
  END IF;
  SELECT p.id INTO authorized_principal_id
    FROM public.workspace_principals AS p
    JOIN public.workspace_client_memberships AS m ON m.principal_id = p.id
    JOIN public.workspace_client_project_grants AS g ON g.tenant_id = m.tenant_id AND g.principal_id = p.id
    JOIN public.workspace_tenants AS t ON t.id = g.tenant_id
   WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject
     AND p.kind = 'client' AND p.status = 'active'
     AND m.principal_kind = 'client' AND m.status = 'active' AND m.revoked_at IS NULL
     AND m.tenant_id = p_tenant_id AND g.project_id = p_project_id
     AND g.tenant_id = p_tenant_id AND g.status = 'active' AND g.revoked_at IS NULL
     AND g.role IN ('client_viewer','client_contributor','client_approver','client_signatory')
     AND t.status = 'active'
   LIMIT 1 FOR SHARE OF p, m, g, t;
  RETURN authorized_principal_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_lock_client_project_grant(text,uuid,uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_append_audit_event(
  p_tenant_id uuid, p_project_id uuid, p_actor_principal_id uuid,
  p_origin text, p_action text, p_object_type text, p_object_id text,
  p_before_revision bigint, p_after_revision bigint, p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF context.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'workspace audit context mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_actor_principal_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.workspace_principals AS principal
      WHERE principal.id = p_actor_principal_id
        AND principal.provider = 'better_auth'
        AND principal.provider_subject = context.actor_subject)
       OR context.project_id IS DISTINCT FROM p_project_id THEN
      RAISE EXCEPTION 'workspace audit actor mismatch' USING ERRCODE = '42501';
    END IF;
  ELSIF p_origin <> 'system' OR p_object_type <> 'workspace_enrollment_attempt' OR
        NOT EXISTS (SELECT 1 FROM public.workspace_enrollment_attempts AS attempt
          WHERE attempt.id::text = p_object_id AND attempt.tenant_id = p_tenant_id
            AND attempt.project_id = p_project_id
            AND (
              (context.purpose = 'enrollment' AND context.project_id IS NOT DISTINCT FROM p_project_id
                AND attempt.provider_subject = context.actor_subject)
              OR (context.purpose = 'project.activate' AND context.project_id IS NOT DISTINCT FROM p_project_id AND EXISTS (
                SELECT 1 FROM public.workspace_principals AS staff
                  JOIN public.workspace_staff_memberships AS membership
                    ON membership.principal_id = staff.id
                  JOIN public.workspace_staff_project_grants AS grant_row
                    ON grant_row.principal_id = staff.id
                 WHERE staff.provider = 'better_auth'
                   AND staff.provider_subject = context.actor_subject
                   AND staff.kind = 'staff' AND staff.status = 'active'
                   AND membership.principal_kind = 'staff'
                   AND membership.status = 'active' AND membership.revoked_at IS NULL
                   AND grant_row.tenant_id = p_tenant_id
                   AND grant_row.project_id = p_project_id
                   AND grant_row.role = 'workspace_owner'
                   AND grant_row.status = 'active' AND grant_row.revoked_at IS NULL
              ))
            )) THEN
    RAISE EXCEPTION 'workspace system audit context mismatch' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.workspace_audit_events
    (tenant_id, project_id, actor_principal_id, origin, action,
     object_type, object_id, before_revision, after_revision, idempotency_key)
  VALUES (p_tenant_id, p_project_id, p_actor_principal_id, p_origin, p_action,
    p_object_type, p_object_id, p_before_revision, p_after_revision, p_idempotency_key);
END;
$$;
REVOKE ALL ON FUNCTION public.cw_append_audit_event(uuid,uuid,uuid,text,text,text,text,bigint,bigint,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_ensure_disabled_client_principal(
  p_principal_id uuid, p_provider_subject text
) RETURNS TABLE (id uuid, kind text, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_principal_id IS NULL OR p_provider_subject IS NULL OR
     p_provider_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     context.actor_subject IS DISTINCT FROM p_provider_subject OR context.purpose <> 'enrollment' OR
     NOT EXISTS (SELECT 1 FROM public.workspace_enrollment_attempts AS attempt
       WHERE attempt.provider_subject = p_provider_subject AND attempt.tenant_id = context.tenant_id
         AND attempt.project_id IS NOT DISTINCT FROM context.project_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.workspace_principals (id, provider, provider_subject, kind, status)
  VALUES (p_principal_id, 'better_auth', p_provider_subject, 'client', 'disabled')
  ON CONFLICT (provider_subject) DO NOTHING;
  RETURN QUERY SELECT p.id, p.kind, p.status FROM public.workspace_principals AS p
    WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_ensure_disabled_client_principal(uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_disable_client_principal(
  p_attempt_id uuid, p_provider_subject text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE context record; changed integer;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_attempt_id IS NULL OR p_provider_subject IS NULL OR
     context.actor_subject IS DISTINCT FROM p_provider_subject OR context.purpose <> 'enrollment' OR
     NOT EXISTS (SELECT 1 FROM public.workspace_enrollment_attempts AS a
       WHERE a.id = p_attempt_id AND a.provider_subject = p_provider_subject
         AND a.tenant_id = context.tenant_id AND a.project_id IS NOT DISTINCT FROM context.project_id
         AND a.state IN ('pending','auth_created','grant_ready_for_review','needs_repair')) THEN
    RETURN false;
  END IF;
  UPDATE public.workspace_principals SET status = 'disabled'
   WHERE provider = 'better_auth' AND provider_subject = p_provider_subject
     AND kind = 'client' AND status = 'active';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_disable_client_principal(uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_founder_bootstrap_target(p_email_hash bytea)
RETURNS TABLE (tenant_id uuid, project_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT control.target_tenant_id, control.target_project_id
    FROM public.workspace_founder_bootstrap_control AS control
    JOIN public.workspace_projects AS project ON project.id = control.target_project_id
      AND project.tenant_id = control.target_tenant_id
    JOIN public.workspace_tenants AS tenant ON tenant.id = project.tenant_id
   WHERE p_email_hash IS NOT NULL AND octet_length(p_email_hash) = 32
     AND control.singleton AND control.founder_email_hash = p_email_hash
     AND control.completed_at IS NULL AND project.publication = 'published'
     AND tenant.status = 'active'
     AND (current_database() <> 'digipants_workspace_prod'
       OR (control.staff_role = 'workspace_owner'
         AND project.title <> 'Synthetic Project A'
         AND tenant.legal_name <> 'Synthetic Tenant A'))
$$;
REVOKE ALL ON FUNCTION public.cw_founder_bootstrap_target(bytea) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_begin_founder_bootstrap(
  p_email_hash bytea, p_candidate_subject text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE saved_subject text; v_tenant_id uuid; v_project_id uuid;
        v_role text; context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_email_hash IS NULL OR octet_length(p_email_hash) <> 32 OR
     p_candidate_subject IS NULL OR
     p_candidate_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT pending_provider_subject,target_tenant_id,target_project_id,staff_role
    INTO saved_subject,v_tenant_id,v_project_id,v_role
    FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash=p_email_hash AND completed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_tenant_id IS NULL OR v_project_id IS NULL OR
     context.tenant_id IS DISTINCT FROM v_tenant_id OR
     context.project_id IS DISTINCT FROM v_project_id OR
     context.actor_subject IS DISTINCT FROM p_candidate_subject OR
     context.purpose <> 'founder.bootstrap' THEN RETURN NULL; END IF;
  IF current_database()='digipants_workspace_prod' AND v_role <> 'workspace_owner' THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_projects AS project
    JOIN public.workspace_tenants AS tenant ON tenant.id=project.tenant_id
    WHERE project.id=v_project_id AND project.tenant_id=v_tenant_id
      AND project.publication='published' AND tenant.status='active'
      AND (current_database()<>'digipants_workspace_prod'
        OR (project.title<>'Synthetic Project A' AND tenant.legal_name<>'Synthetic Tenant A'))) THEN
    RETURN NULL;
  END IF;
  IF saved_subject IS NULL THEN
    UPDATE public.workspace_founder_bootstrap_control SET pending_provider_subject=p_candidate_subject
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
DECLARE v_tenant_id uuid; v_project_id uuid; v_role text; v_principal_id uuid;
        saved_subject text; completed_subject text; done_at timestamptz; context record;
BEGIN
  SELECT * INTO context FROM public.cw_verified_workspace_context() LIMIT 1;
  IF p_email_hash IS NULL OR octet_length(p_email_hash)<>32 OR p_provider_subject IS NULL OR
     p_provider_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  SELECT pending_provider_subject,completed_provider_subject,completed_at,
         target_tenant_id,target_project_id,staff_role
    INTO saved_subject,completed_subject,done_at,v_tenant_id,v_project_id,v_role
    FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash=p_email_hash FOR UPDATE;
  IF NOT FOUND OR context.tenant_id IS DISTINCT FROM v_tenant_id OR
     context.project_id IS DISTINCT FROM v_project_id OR
     context.actor_subject IS DISTINCT FROM p_provider_subject OR
     context.purpose <> 'founder.bootstrap' THEN RETURN false; END IF;
  IF done_at IS NOT NULL THEN RETURN completed_subject=p_provider_subject; END IF;
  IF saved_subject IS NULL OR saved_subject<>p_provider_subject OR v_tenant_id IS NULL OR
     v_project_id IS NULL OR (current_database()='digipants_workspace_prod' AND v_role<>'workspace_owner') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_projects AS project
    JOIN public.workspace_tenants AS tenant ON tenant.id=project.tenant_id
    WHERE project.id=v_project_id AND project.tenant_id=v_tenant_id
      AND project.publication='published' AND tenant.status='active'
      AND (current_database()<>'digipants_workspace_prod'
        OR (project.title<>'Synthetic Project A' AND tenant.legal_name<>'Synthetic Tenant A'))) THEN
    RETURN false;
  END IF;
  INSERT INTO public.workspace_principals(provider,provider_subject,kind,status)
  VALUES ('better_auth',p_provider_subject,'staff','active') RETURNING id INTO v_principal_id;
  INSERT INTO public.workspace_staff_memberships(principal_id,principal_kind,status)
  VALUES (v_principal_id,'staff','active');
  INSERT INTO public.workspace_staff_project_grants(tenant_id,project_id,principal_id,role,status)
  VALUES (v_tenant_id,v_project_id,v_principal_id,v_role,'active');
  PERFORM set_config('app.workspace_tenant_id',v_tenant_id::text,true);
  PERFORM public.cw_append_audit_event(v_tenant_id,v_project_id,v_principal_id,'system',
    'founder.bootstrap.completed','workspace_staff_membership',v_principal_id::text,
    NULL,NULL,'founder-bootstrap:'||p_provider_subject||':completed');
  UPDATE public.workspace_founder_bootstrap_control
     SET completed_provider_subject=p_provider_subject,completed_at=statement_timestamp()
   WHERE singleton AND completed_at IS NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_complete_founder_bootstrap(bytea,text) FROM PUBLIC;

DO $$
BEGIN
  -- All public RLS policies are installed by the atomic role hardening scripts.
  -- This assertion keeps the migration safe to apply before those scripts.
  IF to_regclass('public.workspace_context_signing_keys') IS NULL THEN
    RAISE EXCEPTION 'Workspace context key table was not created';
  END IF;
END $$;
