-- Auth-database side of the local two-database enrollment saga. Synthetic only.
CREATE TABLE "auth_spike"."workspace_mailbox_proof_spends" (
  "proof_ref_hash" TEXT NOT NULL,
  "attempt_id" UUID NOT NULL,
  "code_digest_hash" TEXT NOT NULL,
  "consumed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_mailbox_proof_spends_pkey" PRIMARY KEY ("proof_ref_hash"),
  CONSTRAINT "workspace_mailbox_proof_ref_hash_check"
    CHECK ("proof_ref_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "workspace_mailbox_proof_code_digest_check"
    CHECK ("code_digest_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "auth_spike_mailbox_proof_attempt_key" UNIQUE ("attempt_id")
);
