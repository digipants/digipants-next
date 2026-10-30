\set ON_ERROR_STOP on
-- Executed as the SAME non-superuser login that installed the schema.
-- Neither owner-role membership nor schema CREATE should survive commit.
DO $$
DECLARE attrs record;
BEGIN
  SELECT rolsuper, rolbypassrls, rolcreaterole INTO attrs
    FROM pg_roles WHERE rolname = current_user;
  IF attrs.rolsuper OR attrs.rolbypassrls OR NOT attrs.rolcreaterole THEN
    RAISE EXCEPTION 'CI installer does not model hosted Neon CREATEROLE login';
  END IF;
  IF pg_has_role(current_user,'cw_schema_owner','SET') OR
     pg_has_role(current_user,'cw_schema_owner','USAGE') OR
     pg_has_role(current_user,'cw_audit_writer','SET') OR
     pg_has_role(current_user,'cw_audit_writer','USAGE') OR
     pg_has_role(current_user,'cw_runtime','SET') OR
     pg_has_role(current_user,'cw_runtime','USAGE') THEN
    RAISE EXCEPTION 'installer retained owner/audit/runtime SET or INHERIT privileges';
  END IF;
  IF has_schema_privilege('cw_audit_writer','public','CREATE') THEN
    RAISE EXCEPTION 'temporary schema CREATE was not revoked';
  END IF;
  IF has_table_privilege('cw_runtime',(SELECT oid FROM pg_class WHERE relname='workspace_invitation_records'),'SELECT') OR
     has_table_privilege('cw_runtime',(SELECT oid FROM pg_class WHERE relname='workspace_audit_events'),'INSERT') OR
     has_schema_privilege('cw_runtime','public','CREATE') THEN
    RAISE EXCEPTION 'runtime has a forbidden permission';
  END IF;
  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname='cw_runtime') THEN
    RAISE EXCEPTION 'runtime bypasses RLS';
  END IF;
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
          WHERE relname='workspace_projects') THEN
    RAISE EXCEPTION 'project RLS is not forced';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_roles r ON p.proowner=r.oid
      WHERE p.proname='cw_append_audit_event'
        AND r.rolname='cw_audit_writer'
    ) THEN
    RAISE EXCEPTION 'audit function does not have the intended owner';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM pg_class t JOIN pg_roles r ON r.oid=t.relowner
      WHERE t.relname='workspace_projects'
        AND r.rolname='cw_schema_owner'
    ) THEN
    RAISE EXCEPTION 'projects are not owned by schema owner';
  END IF;
  IF has_function_privilege('cw_audit_reader',
       (SELECT oid FROM pg_proc WHERE proname='cw_lock_staff_project_grant'),'EXECUTE') THEN
    RAISE EXCEPTION 'audit reader can invoke staff authorization helper';
  END IF;
END $$;

\echo 'PASS: hosted-compatible non-superuser install, privilege revocation and RLS ownership checks'
