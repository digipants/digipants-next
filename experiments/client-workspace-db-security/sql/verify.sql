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
DECLARE denied boolean := false; runtime_attrs record; helper_count integer;
BEGIN
  SELECT r.rolcanlogin, r.rolsuper, r.rolbypassrls,
         r.rolcreatedb, r.rolcreaterole INTO runtime_attrs
    FROM pg_catalog.pg_roles AS r WHERE r.rolname='cw_runtime';
  IF runtime_attrs.rolcanlogin OR runtime_attrs.rolsuper OR runtime_attrs.rolbypassrls OR
     runtime_attrs.rolcreatedb OR runtime_attrs.rolcreaterole THEN
    RAISE EXCEPTION 'workspace runtime group role is not restricted';
  END IF;
  SELECT count(*) INTO helper_count
    FROM pg_catalog.pg_proc AS fn
    JOIN pg_catalog.pg_namespace AS ns ON ns.oid=fn.pronamespace
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid=fn.proowner
   WHERE ns.nspname='public' AND fn.proname IN (
     'cw_lock_staff_project_grant', 'cw_lock_client_project_grant',
     'cw_invitation_context', 'cw_issue_client_invitation',
     'cw_revoke_client_invitation', 'cw_ensure_disabled_client_principal',
     'cw_disable_client_principal', 'cw_approve_enrollment_grant')
     AND fn.prosecdef AND owner_role.rolname='cw_schema_owner'
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.aclexplode(COALESCE(fn.proacl, '{}'::aclitem[])) AS acl
       WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE');
  IF helper_count <> 8 THEN
    RAISE EXCEPTION 'restricted workflow SECURITY DEFINER functions are missing or incorrectly owned/exposed';
  END IF;
  IF has_function_privilege(
       'cw_runtime',
       'public.cw_lock_staff_project_grant(text,uuid,uuid,text)',
       'EXECUTE') IS NOT TRUE OR
     has_function_privilege(
       'cw_audit_writer',
       'public.cw_lock_staff_project_grant(text,uuid,uuid,text)',
       'EXECUTE') OR
     has_function_privilege(
       'cw_audit_reader',
       'public.cw_lock_staff_project_grant(text,uuid,uuid,text)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'grant-lock helper privileges are not runtime-only';
  END IF;
  IF has_function_privilege('cw_runtime', 'public.cw_invitation_context(uuid,text,text,boolean)', 'EXECUTE') IS NOT TRUE OR
     has_function_privilege('cw_runtime', 'public.cw_issue_client_invitation(uuid,text,uuid,uuid,text,text,text)', 'EXECUTE') IS NOT TRUE OR
     has_function_privilege('cw_runtime', 'public.cw_revoke_client_invitation(text,uuid,uuid,uuid)', 'EXECUTE') IS NOT TRUE OR
     has_function_privilege('cw_runtime', 'public.cw_ensure_disabled_client_principal(uuid,text)', 'EXECUTE') IS NOT TRUE OR
     has_function_privilege('cw_runtime', 'public.cw_disable_client_principal(uuid,text)', 'EXECUTE') IS NOT TRUE OR
     has_function_privilege('cw_runtime', 'public.cw_approve_enrollment_grant(uuid,text)', 'EXECUTE') IS NOT TRUE OR
     has_function_privilege('cw_audit_reader', 'public.cw_issue_client_invitation(uuid,text,uuid,uuid,text,text,text)', 'EXECUTE') OR
     has_function_privilege('cw_audit_writer', 'public.cw_approve_enrollment_grant(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'restricted workflow helper grants are too broad or incomplete';
  END IF;
  IF has_table_privilege('cw_runtime', 'public.workspace_principals', 'INSERT') OR
     has_table_privilege('cw_runtime', 'public.workspace_principals', 'UPDATE') OR
     has_table_privilege('cw_runtime', 'public.workspace_client_memberships', 'INSERT') OR
     has_table_privilege('cw_runtime', 'public.workspace_client_project_grants', 'INSERT') OR
     has_table_privilege('cw_runtime', 'public.workspace_invitation_records', 'INSERT') OR
     has_table_privilege('cw_runtime', 'public.workspace_invitation_records', 'UPDATE') THEN
    RAISE EXCEPTION 'runtime has direct write privileges on restricted workflow tables';
  END IF;
  IF (SELECT count(*) FROM workspace_projects) <> 0 THEN
    RAISE EXCEPTION 'missing RLS context exposed projects';
  END IF;
  IF (SELECT count(*) FROM workspace_audit_events) <> 0 THEN
    RAISE EXCEPTION 'missing RLS context exposed audit events';
  END IF;
  IF cw_lock_staff_project_grant(
       'synthetic-security-staff-a',
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'delivery.edit')
       <> '33333333-3333-4333-8333-333333333333'::uuid THEN
    RAISE EXCEPTION 'runtime could not verify and lock an exact active staff grant';
  END IF;
  IF cw_lock_staff_project_grant(
       'synthetic-security-staff-a',
       '22222222-2222-4222-8222-222222222222',
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'delivery.edit') IS NOT NULL OR
     cw_lock_staff_project_grant(
       'synthetic-security-staff-a',
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'project.activate') IS NOT NULL OR
     cw_lock_staff_project_grant(
       'synthetic-security-staff-a',
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'invoice.approve') IS NOT NULL THEN
    RAISE EXCEPTION 'grant lock accepted a wrong tenant, action role, or unknown action';
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
DECLARE denied boolean := false; changed integer; invite_id uuid; client_principal_id uuid;
        approved boolean; redeemed text;
BEGIN
  IF (SELECT count(*) FROM workspace_projects) <> 1 OR
     (SELECT count(*) FROM workspace_audit_events) <> 1 THEN
    RAISE EXCEPTION 'tenant A exact scope unexpectedly differs';
  END IF;

  invite_id := public.cw_issue_client_invitation(
    '55555555-5555-4555-8555-555555555555', 'synthetic-security-owner',
    '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'pilot@example.invalid', 'client_viewer', repeat('a', 64));
  IF invite_id <> '55555555-5555-4555-8555-555555555555'::uuid THEN
    RAISE EXCEPTION 'exact active owner could not issue an invitation through the narrow helper';
  END IF;
  IF public.cw_issue_client_invitation(
    '77777777-7777-4777-8777-777777777777', 'synthetic-security-staff-a',
    '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'unauthorized@example.invalid', 'client_viewer', repeat('b', 64)) IS NOT NULL THEN
    RAISE EXCEPTION 'non-owner staff grant issued a client invitation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cw_invitation_context(invite_id, 'pilot@example.invalid', NULL, false) AS invitation
     WHERE invitation.status='pending' AND invitation.not_expired
       AND invitation.tenant_status='active'
       AND invitation.project_tenant_id=invitation.tenant_id
  ) THEN
    RAISE EXCEPTION 'restricted invitation lookup did not return the exact pending recipient';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cw_invitation_context(
      invite_id, 'other@example.invalid', NULL, false)) THEN
    RAISE EXCEPTION 'restricted invitation lookup disclosed another recipient';
  END IF;

  SELECT id INTO client_principal_id FROM public.cw_ensure_disabled_client_principal(
    '66666666-6666-4666-8666-666666666666', '66666666-6666-4666-8666-666666666666');
  IF client_principal_id IS NULL OR
     (SELECT p.status FROM workspace_principals AS p WHERE p.id=client_principal_id) <> 'disabled' THEN
    RAISE EXCEPTION 'restricted principal helper did not create only a disabled client principal';
  END IF;
  INSERT INTO workspace_enrollment_attempts
    (id, idempotency_hash, invitation_id, invitation_hash, mailbox_proof_ref_hash,
     provider_subject, tenant_id, project_id, intended_email, intended_role,
     state, attempt_count, auth_created_at, principal_created_at)
  VALUES
    ('88888888-8888-4888-8888-888888888888', repeat('c', 64), invite_id, repeat('a', 64),
     repeat('d', 64), '66666666-6666-4666-8666-666666666666',
     '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
     'pilot@example.invalid', 'client_viewer', 'grant_ready_for_review', 1,
     statement_timestamp(), statement_timestamp());
  approved := public.cw_approve_enrollment_grant(
    '88888888-8888-4888-8888-888888888888', 'synthetic-security-owner');
  IF approved IS NOT TRUE OR
     NOT EXISTS (SELECT 1 FROM workspace_client_memberships AS m
       WHERE m.tenant_id='11111111-1111-4111-8111-111111111111'
         AND m.principal_id=client_principal_id AND m.status='active') OR
     NOT EXISTS (SELECT 1 FROM workspace_client_project_grants AS g
       WHERE g.tenant_id='11111111-1111-4111-8111-111111111111'
         AND g.project_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
         AND g.principal_id=client_principal_id
         AND g.role='client_viewer' AND g.status='active') OR
     (SELECT state FROM workspace_enrollment_attempts
       WHERE id='88888888-8888-4888-8888-888888888888') <> 'completed' THEN
    RAISE EXCEPTION 'restricted owner approval did not atomically activate the exact client grant';
  END IF;
  SELECT status INTO redeemed FROM public.cw_invitation_context(
    invite_id, 'pilot@example.invalid', NULL, false);
  IF redeemed <> 'redeemed' THEN RAISE EXCEPTION 'approval did not redeem the exact invitation'; END IF;
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
  denied := false;
  BEGIN
    UPDATE workspace_enrollment_attempts SET intended_email='forged@example.invalid';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could change immutable enrollment identity/context'; END IF;
  denied := false;
  BEGIN
    DELETE FROM workspace_enrollment_attempts;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'runtime could erase enrollment recovery history'; END IF;
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
  IF (SELECT count(*) FROM workspace_audit_events) <> 1 THEN
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
