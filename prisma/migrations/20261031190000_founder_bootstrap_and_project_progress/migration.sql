-- One-time founder enrollment plus client-visible progress for the synthetic
-- staging project. Runtime writes remain behind SECURITY DEFINER functions.

CREATE TABLE workspace_founder_bootstrap_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  founder_email_hash bytea,
  pending_provider_subject text,
  completed_provider_subject text,
  completed_at timestamptz,
  CHECK (founder_email_hash IS NULL OR octet_length(founder_email_hash) = 32),
  CHECK ((completed_at IS NULL) = (completed_provider_subject IS NULL))
);

INSERT INTO workspace_founder_bootstrap_control (singleton) VALUES (true);

CREATE TABLE workspace_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  detail text NOT NULL CHECK (length(btrim(detail)) BETWEEN 1 AND 800),
  state text NOT NULL CHECK (state IN ('planned','in_progress','complete')),
  sort_order integer NOT NULL CHECK (sort_order BETWEEN 0 AND 1000),
  client_visible boolean NOT NULL DEFAULT false,
  approved_by_staff_id uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT workspace_milestones_tenant_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES workspace_projects(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT workspace_milestones_approver_fkey
    FOREIGN KEY (approved_by_staff_id)
    REFERENCES workspace_staff_memberships(principal_id) ON DELETE RESTRICT,
  CONSTRAINT workspace_milestones_scope_uq UNIQUE (tenant_id, project_id, id),
  CHECK ((approved_at IS NULL) = (approved_by_staff_id IS NULL))
);

CREATE INDEX workspace_milestones_project_order_idx
  ON workspace_milestones(tenant_id, project_id, sort_order);

CREATE TABLE workspace_progress_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1200),
  next_action text NOT NULL CHECK (length(btrim(next_action)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  client_visible boolean NOT NULL DEFAULT false,
  approved_by_staff_id uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT workspace_progress_updates_tenant_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES workspace_projects(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT workspace_progress_updates_approver_fkey
    FOREIGN KEY (approved_by_staff_id)
    REFERENCES workspace_staff_memberships(principal_id) ON DELETE RESTRICT,
  CONSTRAINT workspace_progress_updates_scope_uq UNIQUE (tenant_id, project_id, id),
  CHECK ((status = 'approved' AND approved_at IS NOT NULL AND approved_by_staff_id IS NOT NULL) OR
         (status <> 'approved' AND approved_at IS NULL AND approved_by_staff_id IS NULL)),
  CHECK (status <> 'approved' OR client_visible)
);

CREATE INDEX workspace_progress_updates_project_approved_idx
  ON workspace_progress_updates(tenant_id, project_id, approved_at DESC)
  WHERE status = 'approved' AND client_visible;

REVOKE ALL ON TABLE workspace_founder_bootstrap_control,
  workspace_milestones, workspace_progress_updates FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_founder_bootstrap_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_founder_bootstrap_control
     WHERE singleton AND founder_email_hash IS NOT NULL AND completed_at IS NULL
  )
$$;
REVOKE ALL ON FUNCTION public.cw_founder_bootstrap_active() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_founder_bootstrap_is_open(p_email_hash bytea)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_email_hash IS NOT NULL AND octet_length(p_email_hash) = 32 AND EXISTS (
    SELECT 1 FROM public.workspace_founder_bootstrap_control
     WHERE singleton AND founder_email_hash = p_email_hash AND completed_at IS NULL
  )
$$;
REVOKE ALL ON FUNCTION public.cw_founder_bootstrap_is_open(bytea) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_begin_founder_bootstrap(
  p_email_hash bytea,
  p_candidate_subject text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  saved_subject text;
  tenant_id uuid := '11111111-1111-4111-8111-111111111111';
  project_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
BEGIN
  IF p_email_hash IS NULL OR octet_length(p_email_hash) <> 32 OR
     p_candidate_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash = p_email_hash AND completed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT pending_provider_subject INTO saved_subject
    FROM public.workspace_founder_bootstrap_control WHERE singleton;
  IF saved_subject IS NULL THEN
    UPDATE public.workspace_founder_bootstrap_control
       SET pending_provider_subject = p_candidate_subject
     WHERE singleton AND completed_at IS NULL;
    saved_subject := p_candidate_subject;
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_projects AS p
      JOIN public.workspace_tenants AS t ON t.id = p.tenant_id
      WHERE p.id = project_id AND p.tenant_id = tenant_id
        AND p.title = 'Synthetic Project A' AND t.legal_name = 'Synthetic Tenant A'
        AND p.publication = 'published' AND t.status = 'active'
    ) THEN
      RAISE EXCEPTION 'the synthetic pilot project is unavailable';
    END IF;
  END IF;
  RETURN saved_subject;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_begin_founder_bootstrap(bytea, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cw_complete_founder_bootstrap(
  p_email_hash bytea,
  p_provider_subject text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tenant_id uuid := '11111111-1111-4111-8111-111111111111';
  project_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  principal_id uuid;
  saved_subject text;
  completed_subject text;
  done_at timestamptz;
BEGIN
  IF p_email_hash IS NULL OR octet_length(p_email_hash) <> 32 OR
     p_provider_subject IS NULL OR p_provider_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  SELECT pending_provider_subject, completed_provider_subject, completed_at
    INTO saved_subject, completed_subject, done_at
    FROM public.workspace_founder_bootstrap_control
   WHERE singleton AND founder_email_hash = p_email_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF done_at IS NOT NULL THEN
    RETURN completed_subject = p_provider_subject;
  END IF;
  IF saved_subject IS NULL OR saved_subject <> p_provider_subject THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_projects AS p
    JOIN public.workspace_tenants AS t ON t.id = p.tenant_id
    WHERE p.id = project_id AND p.tenant_id = tenant_id
      AND p.title = 'Synthetic Project A' AND t.legal_name = 'Synthetic Tenant A'
      AND p.publication = 'published' AND t.status = 'active'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.workspace_principals(provider, provider_subject, kind, status)
  VALUES ('better_auth', p_provider_subject, 'staff', 'active')
  RETURNING id INTO principal_id;
  INSERT INTO public.workspace_staff_memberships(principal_id, principal_kind, status)
  VALUES (principal_id, 'staff', 'active');
  INSERT INTO public.workspace_staff_project_grants
    (tenant_id, project_id, principal_id, role, status)
  VALUES (tenant_id, project_id, principal_id, 'delivery_lead', 'active');

  PERFORM set_config('app.workspace_tenant_id', tenant_id::text, true);
  PERFORM public.cw_append_audit_event(
    tenant_id, project_id, principal_id, 'system', 'founder.bootstrap.completed',
    'workspace_staff_membership', principal_id::text, NULL, NULL,
    'founder-bootstrap:' || p_provider_subject || ':completed');
  UPDATE public.workspace_founder_bootstrap_control
     SET completed_provider_subject = p_provider_subject,
         completed_at = statement_timestamp()
   WHERE singleton AND completed_at IS NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cw_complete_founder_bootstrap(bytea, text) FROM PUBLIC;

-- Retire only the fixed, synthetic CI/staging staff identities. They have no
-- usable Better Auth account and must not remain as authorization fixtures.
UPDATE public.workspace_staff_project_grants AS g
   SET status = 'revoked', revoked_at = COALESCE(revoked_at, statement_timestamp())
  FROM public.workspace_principals AS p
 WHERE p.id = g.principal_id AND p.provider = 'better_auth'
   AND p.kind = 'staff'
   AND p.provider_subject IN ('synthetic-security-staff-a', 'synthetic-security-owner');
UPDATE public.workspace_staff_memberships AS m
   SET status = 'revoked', revoked_at = COALESCE(revoked_at, statement_timestamp())
  FROM public.workspace_principals AS p
 WHERE p.id = m.principal_id AND p.kind = 'staff'
   AND p.provider_subject IN ('synthetic-security-staff-a', 'synthetic-security-owner');
UPDATE public.workspace_principals
   SET status = 'disabled'
 WHERE kind = 'staff'
   AND provider_subject IN ('synthetic-security-staff-a', 'synthetic-security-owner');

-- Publish explicit synthetic-only project content for the protected pilot.
UPDATE public.workspace_projects
   SET publication = 'published', revision = revision + 1
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   AND tenant_id = '11111111-1111-4111-8111-111111111111'
   AND title = 'Synthetic Project A' AND publication = 'unpublished';

INSERT INTO public.workspace_milestones
  (id, tenant_id, project_id, title, detail, state, sort_order, client_visible,
   approved_by_staff_id, approved_at)
SELECT 'a1111111-1111-4111-8111-111111111111', p.tenant_id, p.id,
       'Confirm project scope',
       'This synthetic pilot milestone is awaiting founder review. It does not claim customer delivery.',
       'in_progress', 10, true, m.principal_id, statement_timestamp()
  FROM public.workspace_projects AS p
  JOIN public.workspace_staff_memberships AS m
    ON m.principal_id = '33333333-3333-4333-8333-333333333333'
 WHERE p.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   AND p.tenant_id = '11111111-1111-4111-8111-111111111111'
   AND p.title = 'Synthetic Project A'
ON CONFLICT (id) DO NOTHING;

-- Seed the isolated demo content before forcing RLS. The migration installer
-- owns this transaction; the runtime never receives write access to these
-- tables. The role hardening migration installs tenant read policies next.
ALTER TABLE workspace_founder_bootstrap_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_founder_bootstrap_control FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_milestones FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_progress_updates FORCE ROW LEVEL SECURITY;

INSERT INTO public.workspace_milestones
  (id, tenant_id, project_id, title, detail, state, sort_order, client_visible,
   approved_by_staff_id, approved_at)
SELECT 'a1111111-1111-4111-8111-222222222222', p.tenant_id, p.id,
       'Prepare client workspace',
       'Keep the pilot data synthetic until the founder approves customer-facing use.',
       'planned', 20, true, m.principal_id, statement_timestamp()
  FROM public.workspace_projects AS p
  JOIN public.workspace_staff_memberships AS m
    ON m.principal_id = '33333333-3333-4333-8333-333333333333'
 WHERE p.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   AND p.tenant_id = '11111111-1111-4111-8111-111111111111'
   AND p.title = 'Synthetic Project A'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_progress_updates
  (id, tenant_id, project_id, body, next_action, status, client_visible,
   approved_by_staff_id, approved_at)
SELECT 'a2222222-2222-4222-8222-222222222222', p.tenant_id, p.id,
       'Synthetic staging update: the private workspace and sample project record are ready for founder review. No customer delivery or payment is represented.',
       'Review the synthetic project scope and agree the first client-facing milestone before adding customer data.',
       'approved', true, m.principal_id, statement_timestamp()
  FROM public.workspace_projects AS p
  JOIN public.workspace_staff_memberships AS m
    ON m.principal_id = '33333333-3333-4333-8333-333333333333'
 WHERE p.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   AND p.tenant_id = '11111111-1111-4111-8111-111111111111'
   AND p.title = 'Synthetic Project A'
ON CONFLICT (id) DO NOTHING;
