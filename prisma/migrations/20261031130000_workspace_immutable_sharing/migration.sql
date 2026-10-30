-- Development-only immutable sharing ledger. No live reads or direct runtime
-- privileges are granted. All application authorization remains blocked by
-- auth/MFA and real hosted pooler verification gates.
ALTER TABLE workspace_audit_events
  ADD CONSTRAINT workspace_audit_scope_uq UNIQUE (tenant_id, project_id, id);

CREATE TABLE workspace_shared_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  kind text NOT NULL CHECK (kind IN ('progress', 'document')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 8000),
  private_object_ref text,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint,
  media_type text,
  created_by_staff_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_shared_revisions_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES workspace_projects(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT workspace_shared_revisions_author_fkey
    FOREIGN KEY (created_by_staff_id) REFERENCES workspace_staff_memberships(principal_id) ON DELETE RESTRICT,
  CONSTRAINT workspace_shared_revisions_scope_uq UNIQUE (tenant_id, project_id, id),
  CONSTRAINT workspace_shared_resource_version_uq UNIQUE (tenant_id, project_id, resource_id, version),
  CONSTRAINT workspace_shared_kind_payload_check CHECK (
    (kind = 'progress' AND private_object_ref IS NULL AND byte_size IS NULL AND media_type IS NULL)
    OR
    (kind = 'document'
      AND private_object_ref ~ '^[a-z0-9][a-z0-9_-]{15,127}$'
      AND byte_size BETWEEN 1 AND 52428800
      AND media_type IN ('application/pdf','image/png','image/jpeg','image/webp','text/plain'))
  )
);

CREATE TABLE workspace_shared_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  revision_id uuid NOT NULL UNIQUE,
  reviewed_by_staff_id uuid NOT NULL
    REFERENCES workspace_staff_memberships(principal_id) ON DELETE RESTRICT,
  audit_event_id uuid NOT NULL UNIQUE,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_shared_publications_revision_scope_fkey
    FOREIGN KEY (tenant_id, project_id, revision_id)
    REFERENCES workspace_shared_revisions(tenant_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT workspace_shared_publications_audit_scope_fkey
    FOREIGN KEY (tenant_id, project_id, audit_event_id)
    REFERENCES workspace_audit_events(tenant_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT workspace_shared_publications_scope_uq UNIQUE (tenant_id, project_id, id)
);

CREATE TABLE workspace_shared_retractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  publication_id uuid NOT NULL UNIQUE,
  retracted_by_staff_id uuid NOT NULL
    REFERENCES workspace_staff_memberships(principal_id) ON DELETE RESTRICT,
  audit_event_id uuid NOT NULL UNIQUE,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 8 AND 1000),
  retracted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_shared_retractions_publication_scope_fkey
    FOREIGN KEY (tenant_id, project_id, publication_id)
    REFERENCES workspace_shared_publications(tenant_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT workspace_shared_retractions_audit_scope_fkey
    FOREIGN KEY (tenant_id, project_id, audit_event_id)
    REFERENCES workspace_audit_events(tenant_id, project_id, id) ON DELETE RESTRICT
);

CREATE INDEX workspace_shared_draft_idx
  ON workspace_shared_revisions(tenant_id, project_id, kind, created_at DESC);
CREATE INDEX workspace_shared_publications_project_time_idx
  ON workspace_shared_publications(tenant_id, project_id, published_at DESC);

-- A reviewer must be distinct from the author; staff membership and project
-- grant must be current at insert time. This DOES NOT authenticate any caller:
-- runtime roles lack INSERT and a verified server session is still required.
CREATE FUNCTION workspace_check_shared_publication()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  author_id uuid;
  audit_actor uuid;
  audit_action text;
BEGIN
  SELECT r.created_by_staff_id INTO author_id
    FROM workspace_shared_revisions r
   WHERE r.tenant_id = NEW.tenant_id AND r.project_id = NEW.project_id
     AND r.id = NEW.revision_id FOR SHARE;
  SELECT a.actor_principal_id, a.action INTO audit_actor, audit_action
    FROM workspace_audit_events a
   WHERE a.tenant_id = NEW.tenant_id AND a.project_id = NEW.project_id
     AND a.id = NEW.audit_event_id FOR SHARE;
  IF author_id IS NULL OR author_id = NEW.reviewed_by_staff_id
     OR audit_actor IS DISTINCT FROM NEW.reviewed_by_staff_id
     OR audit_action IS DISTINCT FROM 'sharing.published' THEN
    RAISE EXCEPTION 'invalid independent publication review/audit' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM workspace_staff_memberships sm
    JOIN workspace_staff_project_grants g ON g.principal_id = sm.principal_id
   WHERE sm.principal_id = NEW.reviewed_by_staff_id
     AND sm.status = 'active' AND sm.revoked_at IS NULL
     AND g.tenant_id = NEW.tenant_id AND g.project_id = NEW.project_id
     AND g.role = 'delivery_lead' AND g.status = 'active'
     AND g.revoked_at IS NULL
   FOR SHARE OF sm, g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reviewer requires current delivery-lead grant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workspace_shared_publication_review_guard
  BEFORE INSERT ON workspace_shared_publications
  FOR EACH ROW EXECUTE FUNCTION workspace_check_shared_publication();

CREATE FUNCTION workspace_check_shared_retraction()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  audit_actor uuid;
  audit_action text;
BEGIN
  SELECT a.actor_principal_id, a.action INTO audit_actor, audit_action
    FROM workspace_audit_events a
   WHERE a.tenant_id = NEW.tenant_id AND a.project_id = NEW.project_id
     AND a.id = NEW.audit_event_id FOR SHARE;
  IF audit_actor IS DISTINCT FROM NEW.retracted_by_staff_id
     OR audit_action IS DISTINCT FROM 'sharing.retracted' THEN
    RAISE EXCEPTION 'invalid retraction audit' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM workspace_staff_memberships sm
    JOIN workspace_staff_project_grants g ON g.principal_id = sm.principal_id
   WHERE sm.principal_id = NEW.retracted_by_staff_id
     AND sm.status = 'active' AND sm.revoked_at IS NULL
     AND g.tenant_id = NEW.tenant_id AND g.project_id = NEW.project_id
     AND g.role IN ('delivery_lead','workspace_owner')
     AND g.status = 'active' AND g.revoked_at IS NULL
   FOR SHARE OF sm, g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'retraction requires current authorized staff grant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workspace_shared_retraction_review_guard
  BEFORE INSERT ON workspace_shared_retractions
  FOR EACH ROW EXECUTE FUNCTION workspace_check_shared_retraction();

CREATE FUNCTION workspace_reject_shared_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'shared revision/publication history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER workspace_shared_revisions_immutable
  BEFORE UPDATE OR DELETE ON workspace_shared_revisions
  FOR EACH ROW EXECUTE FUNCTION workspace_reject_shared_mutation();
CREATE TRIGGER workspace_shared_publications_immutable
  BEFORE UPDATE OR DELETE ON workspace_shared_publications
  FOR EACH ROW EXECUTE FUNCTION workspace_reject_shared_mutation();
CREATE TRIGGER workspace_shared_retractions_immutable
  BEFORE UPDATE OR DELETE ON workspace_shared_retractions
  FOR EACH ROW EXECUTE FUNCTION workspace_reject_shared_mutation();
CREATE TRIGGER workspace_shared_revisions_no_truncate BEFORE TRUNCATE ON workspace_shared_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION workspace_reject_shared_mutation();
CREATE TRIGGER workspace_shared_publications_no_truncate BEFORE TRUNCATE ON workspace_shared_publications
  FOR EACH STATEMENT EXECUTE FUNCTION workspace_reject_shared_mutation();
CREATE TRIGGER workspace_shared_retractions_no_truncate BEFORE TRUNCATE ON workspace_shared_retractions
  FOR EACH STATEMENT EXECUTE FUNCTION workspace_reject_shared_mutation();

-- Defense in depth, not identity: no runtime policy or GRANT until verified
-- session-to-role linkage and hosted connection-pool isolation pass review.
ALTER TABLE workspace_shared_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_shared_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_shared_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_shared_publications FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_shared_retractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_shared_retractions FORCE ROW LEVEL SECURITY;
