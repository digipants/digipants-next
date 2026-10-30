-- Development-only schema foundation for the cross-database enrollment saga.
-- This migration is applied only by local/PR CI disposable PostgreSQL targets.

ALTER TABLE workspace_invitation_records
  ADD CONSTRAINT workspace_invitation_scope_uq UNIQUE (tenant_id, project_id, id);

CREATE TABLE workspace_enrollment_attempts (
  id uuid PRIMARY KEY,
  idempotency_hash text NOT NULL UNIQUE
    CHECK (idempotency_hash ~ '^[0-9a-f]{64}$'),
  invitation_id uuid NOT NULL UNIQUE,
  invitation_hash text NOT NULL CHECK (invitation_hash ~ '^[0-9a-f]{64}$'),
  mailbox_proof_ref_hash text NOT NULL CHECK (mailbox_proof_ref_hash ~ '^[0-9a-f]{64}$'),
  provider_subject text NOT NULL UNIQUE
    CHECK (provider_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  intended_email text NOT NULL CHECK (length(intended_email) BETWEEN 5 AND 254),
  intended_role text NOT NULL CHECK (intended_role IN
    ('client_viewer', 'client_contributor', 'client_approver', 'client_signatory')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN
    ('pending', 'auth_created', 'grant_ready_for_review', 'completed', 'needs_repair', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code IN
    ('provider_error', 'identity_conflict', 'proof_replay', 'invitation_invalid', 'audit_error', 'unknown')),
  next_retry_at timestamptz,
  poisoned_at timestamptz,
  auth_created_at timestamptz,
  principal_created_at timestamptz,
  grant_approved_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT workspace_enrollment_invitation_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invitation_id)
    REFERENCES workspace_invitation_records(tenant_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT workspace_enrollment_state_timestamps_check CHECK (
    (state NOT IN ('auth_created', 'grant_ready_for_review', 'completed') OR auth_created_at IS NOT NULL) AND
    (state <> 'completed' OR completed_at IS NOT NULL) AND
    (state <> 'cancelled' OR cancelled_at IS NOT NULL) AND
    (state <> 'needs_repair' OR poisoned_at IS NOT NULL)
  )
);

CREATE INDEX workspace_enrollment_retry_idx
  ON workspace_enrollment_attempts(state, next_retry_at, updated_at);
CREATE INDEX workspace_enrollment_poisoned_idx
  ON workspace_enrollment_attempts(poisoned_at)
  WHERE state = 'needs_repair';

CREATE FUNCTION workspace_guard_enrollment_attempt()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.idempotency_hash, NEW.invitation_id, NEW.invitation_hash,
      NEW.mailbox_proof_ref_hash, NEW.provider_subject, NEW.tenant_id, NEW.project_id,
      NEW.intended_email, NEW.intended_role)
      IS DISTINCT FROM
     (OLD.id, OLD.idempotency_hash, OLD.invitation_id, OLD.invitation_hash,
      OLD.mailbox_proof_ref_hash, OLD.provider_subject, OLD.tenant_id, OLD.project_id,
      OLD.intended_email, OLD.intended_role) THEN
    RAISE EXCEPTION 'enrollment attempt identity and intended context are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
      (OLD.state = 'pending' AND NEW.state IN ('auth_created', 'needs_repair', 'cancelled')) OR
      (OLD.state = 'auth_created' AND NEW.state IN ('grant_ready_for_review', 'needs_repair')) OR
      (OLD.state = 'grant_ready_for_review' AND NEW.state IN ('completed', 'needs_repair'))
  ) THEN
    RAISE EXCEPTION 'invalid enrollment journal state transition: % -> %', OLD.state, NEW.state
      USING ERRCODE = '23514';
  END IF;
  IF OLD.state IN ('completed', 'cancelled', 'needs_repair') AND
     (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION 'terminal enrollment attempts are immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_enrollment_attempt_guard
  BEFORE UPDATE ON workspace_enrollment_attempts
  FOR EACH ROW EXECUTE FUNCTION workspace_guard_enrollment_attempt();
