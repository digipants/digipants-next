\set ON_ERROR_STOP on
-- Run only against the ephemeral database after seed.sql + hardening.sql.
-- Test that least privilege and RLS behave under SET ROLE, not as superuser.

BEGIN;
SET LOCAL ROLE cw_runtime_test;

DO $$
BEGIN
  IF current_user <> 'cw_runtime_test' THEN
    RAISE EXCEPTION 'role switch failed';
  END IF;
  IF (SELECT count(*) FROM workspace_projects) <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed projects';
  END IF;
  IF (SELECT count(*) FROM workspace_audit_events) <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed audit events';
  END IF;
END $$;

SET LOCAL app.workspace_tenant_id = '11111111-1111-4111-8111-111111111111';
DO $$
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM workspace_projects) <> 1 THEN
    RAISE EXCEPTION 'tenant A sees unexpected projects';
  END IF;
  IF (SELECT count(*) FROM workspace_audit_events) <> 1 THEN
    RAISE EXCEPTION 'tenant A sees unexpected audit events';
  END IF;
  BEGIN
    PERFORM 1 FROM workspace_invitation_records;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime role could read invitation secrets'; END IF;

  denied := false;
  BEGIN
    UPDATE workspace_projects SET title = 'Illegal edit'
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime can edit unapproved project columns'; END IF;

  denied := false;
  BEGIN
    DELETE FROM workspace_audit_events;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could delete audit history'; END IF;

  denied := false;
  BEGIN
    UPDATE workspace_audit_events SET object_id = 'forged';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could overwrite audit history'; END IF;

  denied := false;
  BEGIN
    TRUNCATE workspace_audit_events;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could truncate audit history'; END IF;
END $$;

-- Application-side transactional state+audit write, with explicit revision.
UPDATE workspace_projects SET state='active', revision=2
WHERE tenant_id='11111111-1111-4111-8111-111111111111'
  AND id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND revision=1;

INSERT INTO workspace_audit_events
  (tenant_id, project_id, origin, action, object_type, object_id,
   before_revision, after_revision, idempotency_key)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'system', 'project.activated', 'workspace_project',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 2, 'state-transition-001');

DO $$
DECLARE denied boolean := false; changed integer;
BEGIN
  -- Wrong-tenant rows must be invisible and unmodifiable.
  UPDATE workspace_projects SET state='closed'
  WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'cross-tenant update succeeded'; END IF;

  BEGIN
    INSERT INTO workspace_audit_events
      (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
    VALUES
      ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       'system', 'bad.audit', 'workspace_project', 'bad', 'cross-tenant-should-deny');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'cross-tenant audit insert succeeded'; END IF;

  -- A failed idempotent audit command rolls back its paired state update.
  denied := false;
  BEGIN
    UPDATE workspace_projects SET state='paused', revision=3
    WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    INSERT INTO workspace_audit_events
      (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
    VALUES
      ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'system', 'duplicate', 'workspace_project', 'bad', 'state-transition-001');
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'duplicate state/audit command succeeded'; END IF;
  IF (SELECT state FROM workspace_projects
      WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'active' THEN
    RAISE EXCEPTION 'state update survived failed audit command';
  END IF;
END $$;
COMMIT;

-- The owner/superuser can bypass RLS but normal DML still hits audit triggers.
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    UPDATE workspace_audit_events SET object_id='forged'
    WHERE idempotency_key='fixture-tenant-a';
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'audit UPDATE trigger did not fire'; END IF;

  denied := false;
  BEGIN
    DELETE FROM workspace_audit_events WHERE idempotency_key='fixture-tenant-a';
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'audit DELETE trigger did not fire'; END IF;

  denied := false;
  BEGIN
    TRUNCATE workspace_audit_events;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'audit TRUNCATE trigger did not fire'; END IF;

  IF (SELECT count(*) FROM workspace_audit_events) <> 3 THEN
    RAISE EXCEPTION 'unexpected audit fixture count';
  END IF;
  IF (SELECT state FROM workspace_projects WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 'planned' THEN
    RAISE EXCEPTION 'wrong tenant project changed';
  END IF;
END $$;

-- Deliberately prove the security limitation: a SQL role can impersonate a
-- different tenant by setting an ordinary custom GUC. RLS therefore CANNOT
-- be the security boundary until app session -> tenant context is trusted.
BEGIN;
SET LOCAL ROLE cw_runtime_test;
SET LOCAL app.workspace_tenant_id = '22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF (SELECT count(*) FROM workspace_projects) <> 1 THEN
    RAISE EXCEPTION 'custom tenant setting demonstration unexpectedly changed';
  END IF;
END $$;
ROLLBACK;
\echo 'PASS: scoped SQL role, RLS, audit DML/DDL denial, atomic rollback and custom GUC limitation verified'
