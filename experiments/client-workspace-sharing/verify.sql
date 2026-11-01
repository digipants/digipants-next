\set ON_ERROR_STOP on
-- Disposable PostgreSQL 17 only. Run after root migrations, seed.sql,
-- and the atomic role/hardening installation, with no real customer records.
DO $$
DECLARE
  ta uuid := '11111111-1111-4111-8111-111111111111';
  pa uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  tb uuid := '22222222-2222-4222-8222-222222222222';
  pb uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  reviewer uuid := '33333333-3333-4333-8333-333333333333';
  author uuid := '44444444-4444-4444-8444-444444444444';
  author_b uuid := '55555555-5555-4555-8555-555555555555';
  revision_id uuid;
  audit_id uuid;
  publication_id uuid;
  retract_audit_id uuid;
  mismatched_audit_id uuid;
BEGIN
  INSERT INTO workspace_principals(id, provider_subject, kind)
    VALUES(author,'synthetic-author-a','staff'),(author_b,'synthetic-author-b','staff');
  INSERT INTO workspace_staff_memberships(principal_id)
    VALUES(author),(author_b);
  INSERT INTO workspace_staff_project_grants(tenant_id,project_id,principal_id,role)
    VALUES(ta,pa,author,'delivery_lead'),(tb,pb,author_b,'delivery_lead');

  INSERT INTO workspace_shared_revisions
    (tenant_id,project_id,resource_id,version,kind,title,summary,content_sha256,created_by_staff_id)
    VALUES(ta,pa,gen_random_uuid(),1,'progress','Sample progress','Reviewed milestone update',repeat('a',64),author)
    RETURNING id INTO revision_id;
  INSERT INTO workspace_shared_revisions
    (tenant_id,project_id,resource_id,version,kind,title,summary,
     private_object_ref,content_sha256,byte_size,media_type,created_by_staff_id)
    VALUES(tb,pb,gen_random_uuid(),1,'document','Private sample document',
      'Only opaque metadata; no live file or download',
      'obj_private_document_123456789',repeat('b',64),1024,'application/pdf',author_b);
  BEGIN
    INSERT INTO workspace_shared_revisions
      (tenant_id,project_id,resource_id,version,kind,title,summary,
       private_object_ref,content_sha256,byte_size,media_type,created_by_staff_id)
    VALUES(ta,pa,gen_random_uuid(),2,'document','Unsafe URL','Must be denied',
      'https://example.invalid/file.pdf',repeat('c',64),42,'application/pdf',author);
    RAISE EXCEPTION 'unexpected public URL accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A staff member assigned only to tenant B cannot author in tenant A.
  BEGIN
    INSERT INTO workspace_shared_revisions
      (tenant_id,project_id,resource_id,version,kind,title,summary,content_sha256,created_by_staff_id)
    VALUES(ta,pa,gen_random_uuid(),99,'progress','Unauthorized author','Must deny',repeat('d',64),author_b);
    RAISE EXCEPTION 'cross-project author unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO workspace_audit_events(tenant_id,project_id,actor_principal_id,
    origin,action,object_type,object_id,idempotency_key)
    VALUES(ta,pa,reviewer,'person','sharing.published','workspace_shared_revision',
      revision_id::text,'sharing-fixture-publish') RETURNING id INTO audit_id;
  BEGIN
    INSERT INTO workspace_shared_publications
      (tenant_id,project_id,revision_id,reviewed_by_staff_id,audit_event_id)
      VALUES(ta,pa,revision_id,author,audit_id);
    RAISE EXCEPTION 'self-review unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO workspace_shared_publications
      (tenant_id,project_id,revision_id,reviewed_by_staff_id,audit_event_id)
      VALUES(tb,pb,revision_id,author_b,audit_id);
    RAISE EXCEPTION 'cross-tenant publication unexpectedly accepted';
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL;
  END;
  INSERT INTO workspace_audit_events(tenant_id,project_id,actor_principal_id,
    origin,action,object_type,object_id,idempotency_key)
    VALUES(ta,pa,reviewer,'person','sharing.published','workspace_shared_revision',
      '00000000-0000-4000-8000-000000000000','sharing-wrong-object')
    RETURNING id INTO mismatched_audit_id;
  BEGIN
    INSERT INTO workspace_shared_publications
      (tenant_id,project_id,revision_id,reviewed_by_staff_id,audit_event_id)
      VALUES(ta,pa,revision_id,reviewer,mismatched_audit_id);
    RAISE EXCEPTION 'mismatched audit object unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO workspace_shared_publications
    (tenant_id,project_id,revision_id,reviewed_by_staff_id,audit_event_id)
    VALUES(ta,pa,revision_id,reviewer,audit_id) RETURNING id INTO publication_id;
  BEGIN
    UPDATE workspace_shared_revisions SET summary='tampered' WHERE id=revision_id;
    RAISE EXCEPTION 'immutable revision unexpectedly updated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM workspace_shared_publications WHERE id=publication_id;
    RAISE EXCEPTION 'immutable publication unexpectedly deleted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO workspace_audit_events(tenant_id,project_id,actor_principal_id,
    origin,action,object_type,object_id,idempotency_key)
    VALUES(ta,pa,reviewer,'person','sharing.retracted','workspace_shared_publication',
      publication_id::text,'sharing-fixture-retract') RETURNING id INTO retract_audit_id;
  INSERT INTO workspace_shared_retractions
    (tenant_id,project_id,publication_id,retracted_by_staff_id,audit_event_id,reason)
    VALUES(ta,pa,publication_id,reviewer,retract_audit_id,'Approved staff withdrawal');
  IF NOT EXISTS(SELECT 1 FROM workspace_shared_retractions
    WHERE tenant_id=ta AND project_id=pa) THEN
    RAISE EXCEPTION 'retraction marker missing';
  END IF;
  BEGIN
    INSERT INTO workspace_shared_retractions
      (tenant_id,project_id,publication_id,retracted_by_staff_id,audit_event_id,reason)
      VALUES(ta,pa,publication_id,reviewer,retract_audit_id,'Duplicate withdrawal');
    RAISE EXCEPTION 'duplicate retraction unexpectedly allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END;
$$;
DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'workspace_shared_revisions','workspace_shared_publications','workspace_shared_retractions'
  ] LOOP
    IF has_table_privilege('cw_runtime','public.'||name,'SELECT')
      OR has_table_privilege('cw_runtime','public.'||name,'INSERT')
      OR has_table_privilege('cw_runtime','public.'||name,'UPDATE')
      OR has_table_privilege('cw_runtime','public.'||name,'DELETE') THEN
      RAISE EXCEPTION 'runtime role has forbidden shared-table permission: %', name;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=name AND c.relrowsecurity AND c.relforcerowsecurity) THEN
      RAISE EXCEPTION 'shared-table forced RLS missing: %', name;
    END IF;
  END LOOP;
END;
$$;
SELECT 'sharing security fixtures passed' AS result;
