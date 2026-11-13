\set ON_ERROR_STOP on
-- Execute against *second* ephemeral db after pg_dump/pg_restore.
\if :{?expected_tenant_count}
\else
  \echo 'restore verification requires source tenant/project/audit counts'
  \quit 2
\endif
\if :{?expected_project_count}
\else
  \echo 'restore verification requires source tenant/project/audit counts'
  \quit 2
\endif
\if :{?expected_audit_count}
\else
  \echo 'restore verification requires source tenant/project/audit counts'
  \quit 2
\endif
CREATE TEMP TABLE cw_restore_expected_counts (
  tenant_count bigint NOT NULL,
  project_count bigint NOT NULL,
  audit_count bigint NOT NULL
) ON COMMIT PRESERVE ROWS;
INSERT INTO pg_temp.cw_restore_expected_counts VALUES (
  :'expected_tenant_count'::bigint,
  :'expected_project_count'::bigint,
  :'expected_audit_count'::bigint
);
DO $$
DECLARE denied boolean := false; expected record;
BEGIN
  SELECT tenant_count, project_count, audit_count INTO expected
    FROM pg_temp.cw_restore_expected_counts;
  IF (SELECT count(*) FROM workspace_tenants) <> expected.tenant_count OR
     (SELECT count(*) FROM workspace_projects) <> expected.project_count OR
     (SELECT count(*) FROM workspace_audit_events) <> expected.audit_count THEN
    RAISE EXCEPTION 'backup restore count mismatch: expected tenants/projects/audits %/%/%, found %/%/%',
      expected.tenant_count, expected.project_count, expected.audit_count,
      (SELECT count(*) FROM workspace_tenants),
      (SELECT count(*) FROM workspace_projects),
      (SELECT count(*) FROM workspace_audit_events);
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
