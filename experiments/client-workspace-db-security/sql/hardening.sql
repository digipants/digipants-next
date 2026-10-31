\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 only, after roles.sql and the synthetic seed.
-- RLS below is an accidental-scope guard, never proof of user identity.

REVOKE ALL ON TABLE workspace_principals, workspace_tenants,
  workspace_client_memberships, workspace_staff_memberships,
  workspace_projects, workspace_client_project_grants,
  workspace_staff_project_grants, workspace_invitation_records, workspace_enrollment_attempts,
  workspace_audit_events FROM PUBLIC;

GRANT SELECT ON TABLE workspace_principals, workspace_tenants,
  workspace_client_memberships, workspace_staff_memberships,
  workspace_projects, workspace_client_project_grants,
  workspace_staff_project_grants, workspace_enrollment_attempts TO cw_runtime;
GRANT INSERT ON TABLE workspace_enrollment_attempts TO cw_runtime;
GRANT UPDATE (state, attempt_count, last_error_code, next_retry_at,
  poisoned_at, auth_created_at, principal_created_at, grant_approved_at,
  completed_at, cancelled_at, updated_at)
  ON TABLE workspace_enrollment_attempts TO cw_runtime;
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
CREATE POLICY cw_schema_owner_project_all ON workspace_projects
  FOR ALL TO cw_schema_owner USING (true) WITH CHECK (true);

-- Function bodies are defined by the versioned restricted-workflows migration.
-- Transfer their definer rights to the non-login schema owner and expose only
-- the exact calls needed by the runtime.
ALTER FUNCTION public.cw_lock_staff_project_grant(text, uuid, uuid, text) OWNER TO cw_schema_owner;
REVOKE ALL ON FUNCTION public.cw_lock_staff_project_grant(text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_lock_staff_project_grant(text, uuid, uuid, text) TO cw_runtime;
ALTER FUNCTION public.cw_lock_client_project_grant(text, uuid, uuid, text)
  OWNER TO cw_schema_owner;
REVOKE ALL ON FUNCTION public.cw_lock_client_project_grant(text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_lock_client_project_grant(text, uuid, uuid, text) TO cw_runtime;

ALTER FUNCTION public.cw_invitation_context(uuid, text, text, boolean) OWNER TO cw_schema_owner;
ALTER FUNCTION public.cw_issue_client_invitation(uuid, text, uuid, uuid, text, text, text) OWNER TO cw_schema_owner;
ALTER FUNCTION public.cw_revoke_client_invitation(text, uuid, uuid, uuid) OWNER TO cw_schema_owner;
ALTER FUNCTION public.cw_ensure_disabled_client_principal(uuid, text) OWNER TO cw_schema_owner;
ALTER FUNCTION public.cw_disable_client_principal(uuid, text) OWNER TO cw_schema_owner;
ALTER FUNCTION public.cw_approve_enrollment_grant(uuid, text) OWNER TO cw_schema_owner;

GRANT EXECUTE ON FUNCTION public.cw_invitation_context(uuid, text, text, boolean) TO cw_runtime;
GRANT EXECUTE ON FUNCTION public.cw_issue_client_invitation(uuid, text, uuid, uuid, text, text, text) TO cw_runtime;
GRANT EXECUTE ON FUNCTION public.cw_revoke_client_invitation(text, uuid, uuid, uuid) TO cw_runtime;
GRANT EXECUTE ON FUNCTION public.cw_ensure_disabled_client_principal(uuid, text) TO cw_runtime;
GRANT EXECUTE ON FUNCTION public.cw_disable_client_principal(uuid, text) TO cw_runtime;
GRANT EXECUTE ON FUNCTION public.cw_approve_enrollment_grant(uuid, text) TO cw_runtime;

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

-- PostgreSQL requires the new function owner to possess CREATE on the
-- containing schema *at the instant of ownership transfer*. Revoke it
-- immediately in the same atomic installer transaction.
GRANT CREATE ON SCHEMA public TO cw_audit_writer;
ALTER FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text)
  OWNER TO cw_audit_writer;
REVOKE CREATE ON SCHEMA public FROM cw_audit_writer;
REVOKE ALL ON FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text) TO cw_runtime;
GRANT EXECUTE ON FUNCTION public.cw_append_audit_event(uuid, uuid, uuid, text, text, text, text, bigint, bigint, text) TO cw_schema_owner;

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

-- Installer-role memberships are temporary. Run roles.sql and this script
-- in the SAME SQL transaction, so any error rolls back the entire install.
REVOKE cw_audit_writer FROM CURRENT_USER;
REVOKE cw_schema_owner FROM CURRENT_USER;

DO $$
BEGIN
  -- PostgreSQL 17 CREATEROLE may retain administrative membership in a
  -- created role even after explicit SET/INHERIT rights are revoked. It is
  -- NOT the same as the ability to SET ROLE or inherit its table privileges.
  -- A superuser can assume any role by definition, so the membership test
  -- applies only to a non-superuser installer.
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AND
     (pg_has_role(current_user, 'cw_schema_owner', 'SET') OR
      pg_has_role(current_user, 'cw_schema_owner', 'USAGE') OR
      pg_has_role(current_user, 'cw_audit_writer', 'SET') OR
      pg_has_role(current_user, 'cw_audit_writer', 'USAGE')) THEN
    RAISE EXCEPTION 'installer retained owner or audit writer SET/INHERIT rights';
  END IF;
  IF has_schema_privilege('cw_audit_writer', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'audit writer retained temporary schema CREATE';
  END IF;
END;
$$;
