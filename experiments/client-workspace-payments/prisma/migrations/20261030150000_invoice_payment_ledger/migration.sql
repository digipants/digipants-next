-- Synthetic, test-only payment ledger. No provider routes or customer records.
CREATE SCHEMA IF NOT EXISTS cw_payments;

CREATE TABLE cw_payments.payment_invoices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  invoice_number text NOT NULL CHECK (length(invoice_number) BETWEEN 1 AND 80),
  current_approved_revision integer NOT NULL CHECK (current_approved_revision > 0),
  status text NOT NULL CHECK (status IN ('approved', 'due', 'paid', 'partially_refunded', 'refunded', 'void')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT payment_invoices_scope_id_key UNIQUE (tenant_id, project_id, id),
  CONSTRAINT payment_invoices_approved_snapshot_key UNIQUE (tenant_id, project_id, id, current_approved_revision),
  CONSTRAINT payment_invoices_scoped_number_key UNIQUE (tenant_id, project_id, invoice_number)
);

CREATE TABLE cw_payments.approved_invoice_snapshots (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  currency text NOT NULL CHECK (currency = 'INR'),
  snapshot_json jsonb NOT NULL CHECK (jsonb_typeof(snapshot_json) = 'object'),
  snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT approved_invoice_snapshots_revision_key UNIQUE (tenant_id, project_id, invoice_id, revision),
  CONSTRAINT approved_invoice_snapshot_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id)
    REFERENCES cw_payments.payment_invoices (tenant_id, project_id, id) ON DELETE RESTRICT
);

ALTER TABLE cw_payments.payment_invoices
  ADD CONSTRAINT payment_invoices_approved_snapshot_fkey
  FOREIGN KEY (tenant_id, project_id, id, current_approved_revision)
  REFERENCES cw_payments.approved_invoice_snapshots (tenant_id, project_id, invoice_id, revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE cw_payments.payment_attempts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  invoice_revision integer NOT NULL CHECK (invoice_revision > 0),
  merchant_id text NOT NULL CHECK (merchant_id = 'merchant_synthetic_digipants'),
  environment text NOT NULL CHECK (environment = 'test'),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 128),
  order_id text NOT NULL CHECK (order_id ~ '^order_[A-Za-z0-9]{4,80}$'),
  payment_id text CHECK (payment_id IS NULL OR payment_id ~ '^pay_[A-Za-z0-9]{4,80}$'),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  refunded_amount_paise bigint NOT NULL DEFAULT 0 CHECK (refunded_amount_paise >= 0 AND refunded_amount_paise <= amount_paise),
  currency text NOT NULL CHECK (currency = 'INR'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'failed', 'captured', 'partially_refunded', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT payment_attempts_merchant_env_order_key UNIQUE (merchant_id, environment, order_id),
  CONSTRAINT payment_attempts_merchant_env_payment_key UNIQUE (merchant_id, environment, payment_id),
  CONSTRAINT payment_attempts_request_key UNIQUE (tenant_id, invoice_id, invoice_revision, request_key),
  CONSTRAINT payment_attempts_snapshot_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id, invoice_revision)
    REFERENCES cw_payments.approved_invoice_snapshots (tenant_id, project_id, invoice_id, revision) ON DELETE RESTRICT,
  CONSTRAINT payment_attempts_invoice_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id)
    REFERENCES cw_payments.payment_invoices (tenant_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT payment_attempts_scope_revision_id_key UNIQUE (tenant_id, project_id, invoice_id, invoice_revision, id)
);

CREATE UNIQUE INDEX payment_attempts_one_open_per_revision
  ON cw_payments.payment_attempts (tenant_id, project_id, invoice_id, invoice_revision)
  WHERE status IN ('pending', 'authorized');
CREATE INDEX payment_attempts_invoice_state_idx
  ON cw_payments.payment_attempts (tenant_id, project_id, invoice_id, status, created_at DESC);

CREATE TABLE cw_payments.webhook_event_inbox (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  invoice_revision integer NOT NULL,
  payment_attempt_id uuid NOT NULL,
  merchant_id text NOT NULL CHECK (merchant_id = 'merchant_synthetic_digipants'),
  environment text NOT NULL CHECK (environment = 'test'),
  provider_event_id text NOT NULL CHECK (provider_event_id ~ '^[A-Za-z0-9_-]{6,128}$'),
  event_type text NOT NULL CHECK (event_type IN ('payment.authorized', 'payment.captured', 'payment.failed', 'refund.processed')),
  order_id text NOT NULL CHECK (order_id ~ '^order_[A-Za-z0-9]{4,80}$'),
  payment_id text NOT NULL CHECK (payment_id ~ '^pay_[A-Za-z0-9]{4,80}$'),
  refund_id text CHECK (refund_id IS NULL OR refund_id ~ '^rfnd_[A-Za-z0-9]{4,80}$'),
  raw_body_sha256 text NOT NULL CHECK (raw_body_sha256 ~ '^[0-9a-f]{64}$'),
  payload_amount_paise bigint CHECK (payload_amount_paise IS NULL OR payload_amount_paise > 0),
  payload_currency text CHECK (payload_currency IS NULL OR payload_currency = 'INR'),
  payload_status text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'reconciled', 'rejected')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 100),
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code IN ('provider_timeout', 'provider_mismatch', 'unsupported_status', 'invoice_revision_changed')),
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT webhook_event_inbox_provider_event_key UNIQUE (merchant_id, environment, provider_event_id),
  CONSTRAINT webhook_event_inbox_scope_id_key UNIQUE (tenant_id, project_id, invoice_id, invoice_revision, id),
  CONSTRAINT webhook_event_inbox_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id, invoice_revision)
    REFERENCES cw_payments.approved_invoice_snapshots (tenant_id, project_id, invoice_id, revision) ON DELETE RESTRICT,
  CONSTRAINT webhook_event_inbox_attempt_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id, invoice_revision, payment_attempt_id)
    REFERENCES cw_payments.payment_attempts (tenant_id, project_id, invoice_id, invoice_revision, id) ON DELETE RESTRICT
);

CREATE INDEX webhook_event_inbox_retry_idx
  ON cw_payments.webhook_event_inbox (state, next_retry_at, created_at);
CREATE UNIQUE INDEX webhook_event_inbox_refund_id_key
  ON cw_payments.webhook_event_inbox (merchant_id, environment, refund_id)
  WHERE refund_id IS NOT NULL;
CREATE INDEX webhook_event_inbox_attempt_idx
  ON cw_payments.webhook_event_inbox (tenant_id, project_id, invoice_id, payment_attempt_id, created_at);

CREATE TABLE cw_payments.payment_reconciliation_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  invoice_revision integer NOT NULL,
  payment_attempt_id uuid,
  webhook_event_inbox_id uuid,
  action text NOT NULL CHECK (action IN ('invoice.snapshot_approved', 'payment_attempt.created', 'event.received', 'payment.authorized', 'payment.failed', 'payment.captured', 'payment.refunded', 'payment.partial_refund', 'event.duplicate', 'event.stale_ignored', 'event.rejected', 'event.provider_timeout')),
  before_invoice_status text,
  after_invoice_status text,
  before_payment_status text,
  after_payment_status text,
  provider_evidence_sha256 text CHECK (provider_evidence_sha256 IS NULL OR provider_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT payment_reconciliation_idempotency_key UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT payment_reconciliation_invoice_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id)
    REFERENCES cw_payments.payment_invoices (tenant_id, project_id, id) ON DELETE RESTRICT,
  CONSTRAINT payment_reconciliation_snapshot_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id, invoice_revision)
    REFERENCES cw_payments.approved_invoice_snapshots (tenant_id, project_id, invoice_id, revision) ON DELETE RESTRICT,
  CONSTRAINT payment_reconciliation_attempt_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id, invoice_revision, payment_attempt_id)
    REFERENCES cw_payments.payment_attempts (tenant_id, project_id, invoice_id, invoice_revision, id) ON DELETE RESTRICT,
  CONSTRAINT payment_reconciliation_inbox_scope_fkey
    FOREIGN KEY (tenant_id, project_id, invoice_id, invoice_revision, webhook_event_inbox_id)
    REFERENCES cw_payments.webhook_event_inbox (tenant_id, project_id, invoice_id, invoice_revision, id) ON DELETE RESTRICT
);

CREATE FUNCTION cw_payments.reject_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'payment snapshots and reconciliation events are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER approved_invoice_snapshots_immutable
  BEFORE UPDATE OR DELETE ON cw_payments.approved_invoice_snapshots
  FOR EACH ROW EXECUTE FUNCTION cw_payments.reject_immutable_mutation();
CREATE TRIGGER approved_invoice_snapshots_no_truncate
  BEFORE TRUNCATE ON cw_payments.approved_invoice_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION cw_payments.reject_immutable_mutation();
CREATE TRIGGER payment_reconciliation_events_immutable
  BEFORE UPDATE OR DELETE ON cw_payments.payment_reconciliation_events
  FOR EACH ROW EXECUTE FUNCTION cw_payments.reject_immutable_mutation();
CREATE TRIGGER payment_reconciliation_events_no_truncate
  BEFORE TRUNCATE ON cw_payments.payment_reconciliation_events
  FOR EACH STATEMENT EXECUTE FUNCTION cw_payments.reject_immutable_mutation();

CREATE FUNCTION cw_payments.guard_invoice_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.tenant_id, NEW.project_id, NEW.invoice_number, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.tenant_id, OLD.project_id, OLD.invoice_number, OLD.created_at) THEN
    RAISE EXCEPTION 'invoice identity and scope are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.current_approved_revision < OLD.current_approved_revision THEN
    RAISE EXCEPTION 'approved invoice revision cannot regress' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'approved' AND NEW.status IN ('due', 'void')) OR
    (OLD.status = 'due' AND NEW.status IN ('paid', 'void')) OR
    (OLD.status = 'paid' AND NEW.status IN ('partially_refunded', 'refunded')) OR
    (OLD.status = 'partially_refunded' AND NEW.status = 'refunded')
  ) THEN
    RAISE EXCEPTION 'invoice payment state cannot regress: % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_invoice_state_guard
  BEFORE UPDATE ON cw_payments.payment_invoices
  FOR EACH ROW EXECUTE FUNCTION cw_payments.guard_invoice_state();

CREATE FUNCTION cw_payments.guard_payment_attempt_state()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_rank integer; new_rank integer;
BEGIN
  IF (NEW.id, NEW.tenant_id, NEW.project_id, NEW.invoice_id, NEW.invoice_revision,
      NEW.merchant_id, NEW.environment, NEW.request_key, NEW.order_id,
      NEW.amount_paise, NEW.currency, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.tenant_id, OLD.project_id, OLD.invoice_id, OLD.invoice_revision,
      OLD.merchant_id, OLD.environment, OLD.request_key, OLD.order_id,
      OLD.amount_paise, OLD.currency, OLD.created_at) THEN
    RAISE EXCEPTION 'payment attempt identity, approved snapshot and order are immutable' USING ERRCODE = '23514';
  END IF;
  old_rank := CASE OLD.status WHEN 'pending' THEN 0 WHEN 'authorized' THEN 1 WHEN 'failed' THEN 2
    WHEN 'captured' THEN 3 WHEN 'partially_refunded' THEN 4 WHEN 'refunded' THEN 5 END;
  new_rank := CASE NEW.status WHEN 'pending' THEN 0 WHEN 'authorized' THEN 1 WHEN 'failed' THEN 2
    WHEN 'captured' THEN 3 WHEN 'partially_refunded' THEN 4 WHEN 'refunded' THEN 5 END;
  IF new_rank < old_rank OR (OLD.status = 'authorized' AND NEW.status = 'pending') OR
     (OLD.status = 'failed' AND NEW.status IN ('pending', 'authorized')) OR
     NEW.refunded_amount_paise < OLD.refunded_amount_paise THEN
    RAISE EXCEPTION 'payment attempt state cannot regress: % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;
  IF OLD.status IN ('captured', 'partially_refunded', 'refunded') AND NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
    RAISE EXCEPTION 'settled payment identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_attempt_state_guard
  BEFORE UPDATE ON cw_payments.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION cw_payments.guard_payment_attempt_state();

CREATE FUNCTION cw_payments.guard_webhook_inbox_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.tenant_id, NEW.project_id, NEW.invoice_id, NEW.invoice_revision,
      NEW.payment_attempt_id, NEW.merchant_id, NEW.environment, NEW.provider_event_id,
      NEW.event_type, NEW.order_id, NEW.payment_id, NEW.refund_id, NEW.raw_body_sha256,
      NEW.payload_amount_paise, NEW.payload_currency, NEW.payload_status, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.tenant_id, OLD.project_id, OLD.invoice_id, OLD.invoice_revision,
      OLD.payment_attempt_id, OLD.merchant_id, OLD.environment, OLD.provider_event_id,
      OLD.event_type, OLD.order_id, OLD.payment_id, OLD.refund_id, OLD.raw_body_sha256,
      OLD.payload_amount_paise, OLD.payload_currency, OLD.payload_status, OLD.created_at) THEN
    RAISE EXCEPTION 'signed webhook evidence is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.state IN ('reconciled', 'rejected') AND
    (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION 'terminal webhook inbox event is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state AND NOT
    (OLD.state = 'pending' AND NEW.state IN ('reconciled', 'rejected')) THEN
    RAISE EXCEPTION 'invalid webhook inbox transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER webhook_inbox_state_guard
  BEFORE UPDATE ON cw_payments.webhook_event_inbox
  FOR EACH ROW EXECUTE FUNCTION cw_payments.guard_webhook_inbox_state();
