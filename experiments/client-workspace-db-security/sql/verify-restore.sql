\set ON_ERROR_STOP on
-- Execute against *second* ephemeral db after pg_dump/pg_restore.
DO $$
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM workspace_tenants) <> 2 OR
     (SELECT count(*) FROM workspace_projects) <> 2 OR
     (SELECT count(*) FROM workspace_audit_events) <> 3 THEN
    RAISE EXCEPTION 'backup restore changed fixture counts';
  END IF;
  IF (SELECT state FROM workspace_projects
      WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'active' THEN
    RAISE EXCEPTION 'restored revision/state is incorrect';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM workspace_audit_events
      WHERE idempotency_key='state-transition-001' AND after_revision=2) THEN
    RAISE EXCEPTION 'restored audit command was lost';
  END IF;
  BEGIN
    UPDATE workspace_audit_events SET object_id='tampered'
    WHERE idempotency_key='state-transition-001';
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'restored audit update trigger missing'; END IF;

  denied := false;
  BEGIN
    TRUNCATE workspace_audit_events;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'restored audit truncate trigger missing'; END IF;

  IF (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
      WHERE oid='workspace_projects'::regclass) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'restored project RLS disabled';
  END IF;
END $$;
\echo 'PASS: ephemeral backup/restore preserved state, audit, triggers and RLS flags'
