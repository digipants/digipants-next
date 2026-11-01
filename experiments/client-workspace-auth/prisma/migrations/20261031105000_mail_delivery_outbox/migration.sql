-- Disposable auth experiment: durable recipient-proof delivery journal.
-- No actual SMTP/Gmail or Resend credentials are stored in PostgreSQL.
-- The encrypted payload holds the one-time code for retry only until expiry.
CREATE TABLE auth_spike.mail_delivery_outbox (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('mailbox_proof')),
  idempotency_key text NOT NULL UNIQUE,
  payload_ciphertext text,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','sending','sent','expired')),
  attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  lease_id uuid,
  leased_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL,
  sent_at timestamptz,
  CONSTRAINT mail_delivery_lease_pair CHECK
    ((lease_id IS NULL) = (leased_until IS NULL)),
  CONSTRAINT mail_delivery_payload_state CHECK
    ((state IN ('pending','sending') AND payload_ciphertext IS NOT NULL)
      OR (state IN ('sent','expired') AND payload_ciphertext IS NULL)),
  CONSTRAINT mail_delivery_valid_expiry CHECK (expires_at > created_at)
);

CREATE INDEX mail_delivery_outbox_due_idx
  ON auth_spike.mail_delivery_outbox
  (state, next_attempt_at, expires_at)
  WHERE state IN ('pending','sending');

REVOKE ALL ON auth_spike.mail_delivery_outbox FROM PUBLIC;
COMMENT ON TABLE auth_spike.mail_delivery_outbox IS
  'Isolated test-only encrypted recipient-proof outbox; production deployment explicitly forbidden';
