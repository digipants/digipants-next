\set ON_ERROR_STOP on
-- Run only against ephemeral PostgreSQL 17 after seed.sql, roles.sql and
-- hardening.sql. Role switching here is test setup, never an app credential.

-- Migrator owns schema objects but has neither superuser nor role/database admin.
BEGIN;
SET LOCAL ROLE cw_migrator;
DO $$
DECLARE attrs record;
BEGIN
  SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication INTO attrs
    FROM pg_roles WHERE rolname = current_user;
  IF attrs.rolsuper OR attrs.rolcreatedb OR attrs.rolcreaterole OR attrs.rolreplication THEN
    RAISE EXCEPTION 'migrator has an administrative attribute';
  END IF;
END $$;
CREATE TABLE cw_migration_privilege_probe(id integer PRIMARY KEY);
ALTER TABLE cw_migration_privilege_probe ADD COLUMN migrated boolean NOT NULL DEFAULT true;
DROP TABLE cw_migration_privilege_probe;
COMMIT;

-- The runtime has narrowly scoped DML and no invitation, schema, role,
-- database, or audit mutation privileges. The app must authorize exact scope.
BEGIN;
SET LOCAL ROLE cw_runtime;
DO $$
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM workspace_projects) <> 0 THEN
    RAISE EXCEPTION 'missing RLS context exposed projects';
  END IF;
  IF (SELECT count(*) FROM workspace_audit_events) <> 0 THEN
    RAISE EXCEPTION 'missing RLS context exposed audit events';
  END IF;
  IF pg_has_role(current_user, 'cw_schema_owner', 'MEMBER') OR
     pg_has_role(current_user, 'cw_migrator', 'MEMBER') OR
     pg_has_role(current_user, 'cw_audit_writer', 'MEMBER') THEN
    RAISE EXCEPTION 'runtime inherited a privileged role';
  END IF;
  BEGIN
    PERFORM 1 FROM workspace_invitation_records;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could read invitation bearer hashes'; END IF;
  denied := false;
  BEGIN
    EXECUTE 'CREATE TABLE public.cw_runtime_ddl_probe(id integer)';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could create schema objects'; END IF;
  denied := false;
  BEGIN
    INSERT INTO workspace_audit_events
      (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
    VALUES
      ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'system', 'direct.insert', 'workspace_project', 'forged', 'runtime-direct-insert');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could insert audit rows directly'; END IF;
END $$;

SET LOCAL app.workspace_tenant_id = '11111111-1111-4111-8111-111111111111';
DO $$
DECLARE denied boolean := false; changed integer;
BEGIN
  IF (SELECT count(*) FROM workspace_projects) <> 1 OR
     (SELECT count(*) FROM workspace_audit_events) <> 1 THEN
    RAISE EXCEPTION 'tenant A exact scope unexpectedly differs';
  END IF;
  denied := false;
  BEGIN
    UPDATE workspace_projects SET title = 'Illegal edit'
      WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime edited a non-state project column'; END IF;

  UPDATE workspace_projects SET state='active', revision=2
   WHERE tenant_id='11111111-1111-4111-8111-111111111111'
     AND id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND revision=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'exact tenant state update did not match'; END IF;
  PERFORM cw_append_audit_event(
    '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NULL,
    'system', 'project.activated', 'workspace_project',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 2, 'state-transition-001');

  UPDATE workspace_projects SET state='closed'
   WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'cross-tenant update succeeded'; END IF;

  denied := false;
  BEGIN
    PERFORM cw_append_audit_event(
      '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL,
      'system', 'bad.audit', 'workspace_project', 'bad', NULL, NULL, 'cross-tenant-audit');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'server-side tenant context mismatch was accepted'; END IF;

  -- Duplicate append failure rolls back the paired state update in this block.
  denied := false;
  BEGIN
    UPDATE workspace_projects SET state='paused', revision=3
     WHERE tenant_id='11111111-1111-4111-8111-111111111111'
       AND id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND revision=2;
    PERFORM cw_append_audit_event(
      '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NULL,
      'system', 'duplicate', 'workspace_project', 'bad', 2, 3, 'state-transition-001');
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'duplicate state/audit command succeeded'; END IF;
  IF (SELECT state FROM workspace_projects WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'active' THEN
    RAISE EXCEPTION 'failed audit append left the paired project update committed';
  END IF;

  denied := false;
  BEGIN
    DELETE FROM workspace_audit_events;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could delete audit history'; END IF;
  denied := false;
  BEGIN
    UPDATE workspace_audit_events SET object_id='forged';
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
COMMIT;

-- Audit writer has INSERT only; audit reader has SELECT only.
BEGIN;
SET LOCAL ROLE cw_audit_writer;
SET LOCAL app.workspace_tenant_id = '11111111-1111-4111-8111-111111111111';
DO $$
DECLARE denied boolean := false;
BEGIN
  INSERT INTO workspace_audit_events
    (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
  VALUES
    ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
     'system', 'role.test.append', 'workspace_project', 'synthetic', 'audit-writer-role-test');
  BEGIN PERFORM 1 FROM workspace_audit_events;
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'audit writer can read history'; END IF;
  denied := false;
  BEGIN UPDATE workspace_audit_events SET object_id='forged';
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'audit writer can update history'; END IF;
  denied := false;
  BEGIN DELETE FROM workspace_audit_events;
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'audit writer can delete history'; END IF;
  denied := false;
  BEGIN TRUNCATE workspace_audit_events;
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'audit writer can truncate history'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE cw_audit_reader;
SET LOCAL app.workspace_tenant_id = '11111111-1111-4111-8111-111111111111';
DO $$
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM workspace_audit_events) <> 2 THEN
    RAISE EXCEPTION 'audit reader did not see the selected tenant history';
  END IF;
  BEGIN
    INSERT INTO workspace_audit_events
      (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
    VALUES
      ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'system', 'reader.insert', 'workspace_project', 'forged', 'reader-direct-insert');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'audit reader could append records'; END IF;
END $$;
ROLLBACK;

-- Demonstrate the limit explicitly: a caller can change an ordinary custom
-- GUC and make RLS show the other tenant. Server code therefore checks the
-- verified Better Auth subject and parameterized exact grant before scoped SQL.
BEGIN;
SET LOCAL ROLE cw_runtime;
SET LOCAL app.workspace_tenant_id = '22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF (SELECT count(*) FROM workspace_projects) <> 1 THEN
    RAISE EXCEPTION 'expected custom GUC spoof demonstration did not occur';
  END IF;
END $$;
ROLLBACK;
\echo 'PASS: role separation, denial, atomic audit, exact-scope query requirement and spoofable-GUC limitation verified'
