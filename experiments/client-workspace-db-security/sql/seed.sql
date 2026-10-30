-- Fixed synthetic UUIDs and names for disposable CI only.
\set ON_ERROR_STOP on
INSERT INTO workspace_tenants (id, legal_name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Synthetic Tenant A'),
  ('22222222-2222-4222-8222-222222222222', 'Synthetic Tenant B');

INSERT INTO workspace_projects (id, tenant_id, title) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Synthetic Project A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Synthetic Project B');

INSERT INTO workspace_audit_events
  (tenant_id, project_id, origin, action, object_type, object_id, idempotency_key)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'system', 'fixture.created', 'workspace_project', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'fixture-tenant-a'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'system', 'fixture.created', 'workspace_project', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'fixture-tenant-b');
