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
