-- Fixed synthetic UUIDs and names for disposable CI only.
\set ON_ERROR_STOP on
INSERT INTO workspace_tenants (id, legal_name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Synthetic Tenant A'),
  ('22222222-2222-4222-8222-222222222222', 'Synthetic Tenant B');

INSERT INTO workspace_projects (id, tenant_id, title) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Synthetic Project A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Synthetic Project B');

INSERT INTO workspace_principals (id, provider_subject, kind) VALUES
  ('33333333-3333-4333-8333-333333333333', 'synthetic-security-staff-a', 'staff');
INSERT INTO workspace_staff_memberships (principal_id) VALUES
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO workspace_staff_project_grants (tenant_id, project_id, principal_id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '33333333-3333-4333-8333-333333333333', 'delivery_lead');

UPDATE workspace_projects
   SET publication='published'
 WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE workspace_founder_bootstrap_control
   SET founder_email_hash=decode(repeat('a1',32),'hex')
 WHERE singleton;

INSERT INTO workspace_milestones
  (id,tenant_id,project_id,title,detail,state,sort_order,client_visible,approved_by_staff_id,approved_at)
VALUES
  ('a1111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Confirm project scope',
   'Synthetic test milestone awaiting review.','in_progress',10,true,
   '33333333-3333-4333-8333-333333333333',statement_timestamp()),
  ('a1111111-1111-4111-8111-222222222222','11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Prepare client workspace',
   'Keep this fixture synthetic until approved.','planned',20,true,
   '33333333-3333-4333-8333-333333333333',statement_timestamp());

INSERT INTO workspace_progress_updates
  (id,tenant_id,project_id,body,next_action,status,client_visible,approved_by_staff_id,approved_at)
VALUES
  ('a2222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Synthetic staging progress only; no customer delivery or payment is represented.',
   'Review the scope before adding customer data.','approved',true,
   '33333333-3333-4333-8333-333333333333',statement_timestamp());

INSERT INTO workspace_principals (id, provider_subject, kind) VALUES
  ('44444444-4444-4444-8444-444444444444', 'synthetic-security-owner', 'staff');
INSERT INTO workspace_staff_memberships (principal_id) VALUES
  ('44444444-4444-4444-8444-444444444444');
INSERT INTO workspace_staff_project_grants (tenant_id, project_id, principal_id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '44444444-4444-4444-8444-444444444444', 'workspace_owner');

INSERT INTO workspace_audit_events
  (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'system', 'fixture.created', 'workspace_project', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'fixture-tenant-a'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'system', 'fixture.created', 'workspace_project', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'fixture-tenant-b');
