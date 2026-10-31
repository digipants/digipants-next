-- Isolated, disposable Better Auth experiment only.
-- Atomic, database-wide invitation mailbox request limits; no raw email,
-- bearer, remote IP or browser cookie is stored. Not a production edge limit.
CREATE TABLE auth_spike.mailbox_proof_rate_windows (
  bucket_key text PRIMARY KEY CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
  window_start timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 8),
  CONSTRAINT mailbox_rate_window_valid CHECK (expires_at > window_start)
);
CREATE INDEX mailbox_proof_rate_expiry_idx
  ON auth_spike.mailbox_proof_rate_windows (expires_at);
REVOKE ALL ON auth_spike.mailbox_proof_rate_windows FROM PUBLIC;
COMMENT ON TABLE auth_spike.mailbox_proof_rate_windows IS
  'Local pilot DB-backed per-recipient, bearer and session rate buckets; production remains disabled';