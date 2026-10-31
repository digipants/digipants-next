-- Narrow write paths for invitations, enrollment principals and client grants.
-- Runtime callers can execute these functions but receive no direct write
-- privileges on bearer-bearing invitations, principals, memberships or grants.

CREATE OR REPLACE FUNCTION public.cw_lock_staff_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE authorized_principal_id uuid;
BEGIN
  IF p_action NOT IN ('project.activate', 'project.close', 'delivery.edit') THEN
    RETURN NULL;
  END IF;
  SELECT p.id INTO authorized_principal_id
    FROM public.workspace_principals AS p
    JOIN public.workspace_staff_memberships AS m ON m.principal_id = p.id
    JOIN public.workspace_staff_project_grants AS g ON g.principal_id = p.id
    JOIN public.workspace_tenants AS t ON t.id = g.tenant_id
   WHERE p.provider = 'better_auth'
     AND p.provider_subject = p_provider_subject
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
REVOKE ALL ON FUNCTION public.cw_lock_staff_project_grant(text, uuid, uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_lock_client_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE authorized_principal_id uuid;
BEGIN
  IF p_action <> 'project.read_published'
     OR p_provider_subject IS NULL OR length(p_provider_subject) NOT BETWEEN 1 AND 255 THEN
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
     AND m.tenant_id = p_tenant_id
     AND g.project_id = p_project_id AND g.tenant_id = p_tenant_id
     AND g.status = 'active' AND g.revoked_at IS NULL
     AND g.role IN ('client_viewer','client_contributor','client_approver','client_signatory')
     AND t.status = 'active'
   LIMIT 1 FOR SHARE OF p, m, g, t;
  RETURN authorized_principal_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_lock_client_project_grant(text, uuid, uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_append_audit_event(
  p_tenant_id uuid, p_project_id uuid, p_actor_principal_id uuid,
  p_origin text, p_action text, p_object_type text, p_object_id text,
  p_before_revision bigint, p_after_revision bigint, p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_tenant_id IS DISTINCT FROM NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid THEN
    RAISE EXCEPTION 'audit tenant context mismatch' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.workspace_audit_events
    (tenant_id, project_id, actor_principal_id, origin, action,
     object_type, object_id, before_revision, after_revision, idempotency_key)
  VALUES
    (p_tenant_id, p_project_id, p_actor_principal_id, p_origin, p_action,
     p_object_type, p_object_id, p_before_revision, p_after_revision, p_idempotency_key);
END;
$$;
REVOKE ALL ON FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_invitation_context(
  p_invitation_id uuid,
  p_intended_email text,
  p_token_hash text,
  p_lock boolean DEFAULT false
) RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  project_id uuid,
  intended_email text,
  intended_role text,
  status text,
  not_expired boolean,
  tenant_status text,
  project_tenant_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_intended_email IS NULL OR length(p_intended_email) NOT BETWEEN 5 AND 254 OR
     ((p_invitation_id IS NULL) = (p_token_hash IS NULL)) OR
     (p_token_hash IS NOT NULL AND p_token_hash !~ '^[0-9a-f]{64}$') THEN
    RETURN;
  END IF;

  IF p_lock THEN
    RETURN QUERY
      SELECT i.id, i.tenant_id, i.project_id, i.intended_email, i.intended_role,
             i.status, i.expires_at > statement_timestamp(), t.status, p.tenant_id
        FROM public.workspace_invitation_records AS i
        JOIN public.workspace_tenants AS t ON t.id = i.tenant_id
        JOIN public.workspace_projects AS p ON p.tenant_id = i.tenant_id AND p.id = i.project_id
       WHERE lower(i.intended_email) = lower(p_intended_email)
         AND ((p_invitation_id IS NOT NULL AND i.id = p_invitation_id) OR
              (p_token_hash IS NOT NULL AND i.invitation_token_hash = p_token_hash))
       LIMIT 1
       FOR UPDATE OF i, t, p;
  ELSE
    RETURN QUERY
      SELECT i.id, i.tenant_id, i.project_id, i.intended_email, i.intended_role,
             i.status, i.expires_at > statement_timestamp(), t.status, p.tenant_id
        FROM public.workspace_invitation_records AS i
        JOIN public.workspace_tenants AS t ON t.id = i.tenant_id
        JOIN public.workspace_projects AS p ON p.tenant_id = i.tenant_id AND p.id = i.project_id
       WHERE lower(i.intended_email) = lower(p_intended_email)
         AND ((p_invitation_id IS NOT NULL AND i.id = p_invitation_id) OR
              (p_token_hash IS NOT NULL AND i.invitation_token_hash = p_token_hash))
       LIMIT 1;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_invitation_context(uuid, text, text, boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_issue_client_invitation(
  p_invitation_id uuid,
  p_issuer_subject text,
  p_tenant_id uuid,
  p_project_id uuid,
  p_intended_email text,
  p_intended_role text,
  p_token_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  issuer_id uuid;
BEGIN
  IF p_invitation_id IS NULL OR p_tenant_id IS NULL OR p_project_id IS NULL OR
     p_issuer_subject IS NULL OR length(p_issuer_subject) NOT BETWEEN 1 AND 255 OR
     p_intended_email IS NULL OR length(p_intended_email) NOT BETWEEN 5 AND 254 OR
     p_intended_email <> lower(btrim(p_intended_email)) OR
     p_intended_email ~ '[[:space:]]' OR
     p_intended_role IS NULL OR
     p_intended_role NOT IN ('client_viewer','client_contributor','client_approver','client_signatory') OR
     p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;

  issuer_id := public.cw_lock_staff_project_grant(
    p_issuer_subject, p_tenant_id, p_project_id, 'project.activate');
  IF issuer_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.workspace_invitation_records
    (id, tenant_id, project_id, intended_email, intended_role,
     invitation_token_hash, issued_by_staff_id, expires_at)
  VALUES
    (p_invitation_id, p_tenant_id, p_project_id, p_intended_email, p_intended_role,
     p_token_hash, issuer_id, statement_timestamp() + interval '20 minutes');

  PERFORM set_config('app.workspace_tenant_id', p_tenant_id::text, true);
  PERFORM public.cw_append_audit_event(
    p_tenant_id, p_project_id, issuer_id, 'person', 'invitation.issued',
    'workspace_invitation', p_invitation_id::text, NULL, NULL,
    'invitation:' || p_invitation_id::text || ':issued');
  RETURN p_invitation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_issue_client_invitation(uuid, text, uuid, uuid, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_revoke_client_invitation(
  p_issuer_subject text,
  p_tenant_id uuid,
  p_project_id uuid,
  p_invitation_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  issuer_id uuid;
  changed integer;
BEGIN
  IF p_issuer_subject IS NULL OR p_tenant_id IS NULL OR p_project_id IS NULL OR p_invitation_id IS NULL THEN
    RETURN false;
  END IF;
  issuer_id := public.cw_lock_staff_project_grant(
    p_issuer_subject, p_tenant_id, p_project_id, 'project.activate');
  IF issuer_id IS NULL THEN RETURN false; END IF;

  UPDATE public.workspace_invitation_records
     SET status = 'revoked'
   WHERE id = p_invitation_id AND tenant_id = p_tenant_id
     AND project_id = p_project_id AND status = 'pending';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RETURN false; END IF;

  PERFORM set_config('app.workspace_tenant_id', p_tenant_id::text, true);
  PERFORM public.cw_append_audit_event(
    p_tenant_id, p_project_id, issuer_id, 'person', 'invitation.revoked',
    'workspace_invitation', p_invitation_id::text, NULL, NULL,
    'invitation:' || p_invitation_id::text || ':revoked');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_revoke_client_invitation(text, uuid, uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_ensure_disabled_client_principal(
  p_principal_id uuid,
  p_provider_subject text
) RETURNS TABLE (id uuid, kind text, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_principal_id IS NULL OR p_provider_subject IS NULL OR
     p_provider_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN;
  END IF;
  INSERT INTO public.workspace_principals
    (id, provider, provider_subject, kind, status)
  VALUES (p_principal_id, 'better_auth', p_provider_subject, 'client', 'disabled')
  ON CONFLICT (provider_subject) DO NOTHING;
  RETURN QUERY
    SELECT p.id, p.kind, p.status
      FROM public.workspace_principals AS p
     WHERE p.provider = 'better_auth' AND p.provider_subject = p_provider_subject
     LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_ensure_disabled_client_principal(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_disable_client_principal(
  p_attempt_id uuid, p_provider_subject text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE changed integer;
BEGIN
  IF p_attempt_id IS NULL OR p_provider_subject IS NULL OR
     length(p_provider_subject) NOT BETWEEN 1 AND 255 THEN
    RETURN false;
  END IF;
  UPDATE public.workspace_principals
     SET status = 'disabled'
   WHERE provider = 'better_auth' AND provider_subject = p_provider_subject
     AND kind = 'client' AND status = 'active'
     AND EXISTS (
       SELECT 1 FROM public.workspace_enrollment_attempts AS a
        WHERE a.id = p_attempt_id
          AND a.provider_subject = p_provider_subject
          AND a.state IN ('pending','auth_created','grant_ready_for_review','needs_repair')
     );
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_disable_client_principal(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_approve_enrollment_grant(
  p_attempt_id uuid,
  p_staff_subject text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  attempt_row public.workspace_enrollment_attempts%ROWTYPE;
  invitation_row public.workspace_invitation_records%ROWTYPE;
  client_row public.workspace_principals%ROWTYPE;
  owner_id uuid;
  changed integer;
  live_tenant text;
  project_tenant uuid;
BEGIN
  IF p_attempt_id IS NULL OR p_staff_subject IS NULL OR length(p_staff_subject) NOT BETWEEN 1 AND 255 THEN
    RETURN false;
  END IF;

  SELECT a.* INTO attempt_row
    FROM public.workspace_enrollment_attempts AS a
   WHERE a.id = p_attempt_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT i.* INTO invitation_row
    FROM public.workspace_invitation_records AS i
   WHERE i.id = attempt_row.invitation_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  owner_id := public.cw_lock_staff_project_grant(
    p_staff_subject, attempt_row.tenant_id, attempt_row.project_id, 'project.activate');
  IF owner_id IS NULL THEN RETURN false; END IF;
  IF attempt_row.state = 'completed' THEN RETURN true; END IF;

  SELECT t.status, p.tenant_id INTO live_tenant, project_tenant
    FROM public.workspace_tenants AS t
    JOIN public.workspace_projects AS p ON p.tenant_id = t.id
   WHERE t.id = attempt_row.tenant_id AND p.id = attempt_row.project_id
   FOR UPDATE OF t, p;

  IF attempt_row.state <> 'grant_ready_for_review' OR
     attempt_row.intended_role NOT IN ('client_viewer','client_contributor','client_approver','client_signatory') OR
     invitation_row.status <> 'pending' OR invitation_row.expires_at <= statement_timestamp() OR
     invitation_row.tenant_id <> attempt_row.tenant_id OR invitation_row.project_id <> attempt_row.project_id OR
     invitation_row.intended_email <> attempt_row.intended_email OR invitation_row.intended_role <> attempt_row.intended_role OR
     live_tenant IS DISTINCT FROM 'active' OR project_tenant IS DISTINCT FROM attempt_row.tenant_id THEN
    UPDATE public.workspace_enrollment_attempts
       SET state = 'needs_repair', last_error_code = 'invitation_invalid',
           next_retry_at = NULL, poisoned_at = statement_timestamp(), updated_at = statement_timestamp()
     WHERE id = attempt_row.id AND state IN ('pending','auth_created','grant_ready_for_review');
    PERFORM public.cw_disable_client_principal(attempt_row.id, attempt_row.provider_subject);
    PERFORM set_config('app.workspace_tenant_id', attempt_row.tenant_id::text, true);
    PERFORM public.cw_append_audit_event(
      attempt_row.tenant_id, attempt_row.project_id, NULL, 'system', 'enrollment.needs_repair',
      'workspace_enrollment_attempt', attempt_row.id::text, NULL, NULL,
      'enrollment:' || attempt_row.id::text || ':poisoned:' || (attempt_row.attempt_count + 1)::text);
    RETURN false;
  END IF;

  SELECT p.* INTO client_row
    FROM public.workspace_principals AS p
   WHERE p.provider = 'better_auth' AND p.provider_subject = attempt_row.provider_subject AND p.kind = 'client'
   FOR UPDATE;
  IF NOT FOUND OR client_row.status <> 'disabled' THEN
    UPDATE public.workspace_enrollment_attempts
       SET state = 'needs_repair', last_error_code = 'identity_conflict',
           next_retry_at = NULL, poisoned_at = statement_timestamp(), updated_at = statement_timestamp()
     WHERE id = attempt_row.id AND state IN ('pending','auth_created','grant_ready_for_review');
    PERFORM public.cw_disable_client_principal(attempt_row.id, attempt_row.provider_subject);
    PERFORM set_config('app.workspace_tenant_id', attempt_row.tenant_id::text, true);
    PERFORM public.cw_append_audit_event(
      attempt_row.tenant_id, attempt_row.project_id, NULL, 'system', 'enrollment.needs_repair',
      'workspace_enrollment_attempt', attempt_row.id::text, NULL, NULL,
      'enrollment:' || attempt_row.id::text || ':poisoned:' || (attempt_row.attempt_count + 1)::text);
    RETURN false;
  END IF;

  PERFORM set_config('app.workspace_tenant_id', attempt_row.tenant_id::text, true);
  UPDATE public.workspace_principals SET status = 'active'
   WHERE id = client_row.id AND status = 'disabled';
  INSERT INTO public.workspace_client_memberships
    (tenant_id, principal_id, principal_kind, status)
  VALUES (attempt_row.tenant_id, client_row.id, 'client', 'active')
  ON CONFLICT (tenant_id, principal_id) DO UPDATE
    SET status = 'active', revoked_at = NULL, granted_at = statement_timestamp();
  INSERT INTO public.workspace_client_project_grants
    (tenant_id, project_id, principal_id, role, status)
  VALUES (attempt_row.tenant_id, attempt_row.project_id, client_row.id, attempt_row.intended_role, 'active')
  ON CONFLICT (tenant_id, project_id, principal_id, role) DO UPDATE
    SET status = 'active', revoked_at = NULL, granted_at = statement_timestamp();

  UPDATE public.workspace_invitation_records
     SET status = 'redeemed', redeemed_by_client_id = client_row.id,
         redeemed_at = statement_timestamp()
   WHERE id = invitation_row.id AND status = 'pending'
     AND expires_at > statement_timestamp();
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'invitation was no longer redeemable'; END IF;

  UPDATE public.workspace_enrollment_attempts
     SET state = 'completed', next_retry_at = NULL,
         grant_approved_at = statement_timestamp(), completed_at = statement_timestamp(),
         updated_at = statement_timestamp()
   WHERE id = attempt_row.id AND state = 'grant_ready_for_review';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'enrollment approval was no longer available'; END IF;

  PERFORM public.cw_append_audit_event(
    attempt_row.tenant_id, attempt_row.project_id, owner_id, 'person', 'enrollment.grant_approved',
    'workspace_enrollment_attempt', attempt_row.id::text, NULL, NULL,
    'enrollment:' || attempt_row.id::text || ':grant-approved:0');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_approve_enrollment_grant(uuid, text) FROM PUBLIC;
