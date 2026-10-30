\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 only, after roles.sql and the synthetic seed.
-- RLS below is an accidental-scope guard, never proof of user identity.

REVOKE ALL ON TABLE workspace_principals, workspace_tenants,
  workspace_client_memberships, workspace_staff_memberships,
  workspace_projects, workspace_client_project_grants,
  workspace_staff_project_grants, workspace_invitation_records,
  workspace_audit_events FROM PUBLIC;

GRANT SELECT ON TABLE workspace_principals, workspace_tenants,
  workspace_client_memberships, workspace_staff_memberships,
  workspace_projects, workspace_client_project_grants,
  workspace_staff_project_grants TO cw_runtime;
GRANT UPDATE (state, revision) ON TABLE workspace_projects TO cw_runtime;
GRANT SELECT ON TABLE workspace_projects, workspace_audit_events TO cw_audit_reader;
GRANT INSERT ON TABLE workspace_audit_events TO cw_audit_writer;
GRANT SELECT ON TABLE workspace_audit_events TO cw_runtime;

ALTER TABLE workspace_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_runtime_project_read ON workspace_projects
  FOR SELECT TO cw_runtime
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);
CREATE POLICY cw_runtime_project_update ON workspace_projects
  FOR UPDATE TO cw_runtime
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);
CREATE POLICY cw_audit_reader_project_read ON workspace_projects
  FOR SELECT TO cw_audit_reader
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);

-- The runtime cannot take row locks on authorization tables because it has no
-- UPDATE privilege there. This narrow definer function locks the exact active
-- subject/membership/grant/tenant rows while the server-owned transaction is
-- active. It is not a Better Auth verifier: callers must verify the session
-- and MFA first, and the returned actor is used only for the paired audit.
CREATE FUNCTION public.cw_lock_staff_project_grant(
  p_provider_subject text, p_tenant_id uuid, p_project_id uuid, p_action text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  authorized_principal_id uuid;
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
     AND p.kind = 'staff'
     AND p.status = 'active'
     AND m.principal_kind = 'staff'
     AND m.status = 'active'
     AND m.revoked_at IS NULL
     AND g.status = 'active'
     AND g.revoked_at IS NULL
     AND g.tenant_id = p_tenant_id
     AND g.project_id = p_project_id
     AND t.status = 'active'
     AND ((p_action IN ('project.activate', 'project.close') AND g.role = 'workspace_owner')
       OR (p_action = 'delivery.edit' AND g.role IN ('delivery_staff', 'delivery_lead')))
   LIMIT 1
   FOR SHARE OF p, m, g, t;
  RETURN authorized_principal_id;
END;
$$;
ALTER FUNCTION public.cw_lock_staff_project_grant(text, uuid, uuid, text) OWNER TO cw_schema_owner;
REVOKE ALL ON FUNCTION public.cw_lock_staff_project_grant(text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_lock_staff_project_grant(text, uuid, uuid, text) TO cw_runtime;

ALTER TABLE workspace_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY cw_runtime_audit_read ON workspace_audit_events
  FOR SELECT TO cw_runtime
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);
CREATE POLICY cw_audit_reader_read ON workspace_audit_events
  FOR SELECT TO cw_audit_reader
  USING (tenant_id = NULLIF(current_setting('app.workspace_tenant_id', true), '')::uuid);
CREATE POLICY cw_audit_writer_append ON workspace_audit_events
  FOR INSERT TO cw_audit_writer WITH CHECK (true);

-- The trusted server calls this inside the same transaction as its state
-- update. Runtime cannot write audit rows directly and the writer cannot read,
-- update, delete, or truncate history. Exact actor/scope authorization remains
-- the server's responsibility; the ordinary custom GUC is spoofable.
CREATE FUNCTION public.cw_append_audit_event(
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
ALTER FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text)
  OWNER TO cw_audit_writer;
REVOKE ALL ON FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text) TO cw_runtime;

CREATE FUNCTION public.cw_reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workspace audit records are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER cw_audit_reject_update_delete
  BEFORE UPDATE OR DELETE ON workspace_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.cw_reject_audit_mutation();
CREATE TRIGGER cw_audit_reject_truncate
  BEFORE TRUNCATE ON workspace_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.cw_reject_audit_mutation();
