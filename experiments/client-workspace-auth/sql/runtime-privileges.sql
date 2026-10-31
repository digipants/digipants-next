-- Apply after all auth_spike Prisma migrations using a migration/admin role.
-- The app login is created separately on the isolated staging branch, then
-- granted membership in cw_auth_runtime. No database-owner password is used
-- by the application.

GRANT USAGE ON SCHEMA auth_spike TO cw_auth_runtime;
REVOKE ALL ON TABLE auth_spike."user", auth_spike.session,
  auth_spike.account, auth_spike.verification, auth_spike."twoFactor",
  auth_spike.totp_code_use, auth_spike.workspace_mailbox_proof_spends,
  auth_spike.mailbox_proof_rate_windows, auth_spike.mail_delivery_outbox
  FROM PUBLIC;

-- Better Auth owns only its authentication records. Session and consumed
-- verification-token deletion support logout/revocation and token cleanup.
GRANT SELECT, INSERT, UPDATE ON TABLE
  auth_spike."user", auth_spike.account, auth_spike."twoFactor"
  TO cw_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  auth_spike.session, auth_spike.verification
  TO cw_auth_runtime;

-- Workspace enrollment, MFA replay prevention, quota buckets and delivery
-- outbox retain only the operations used by their corresponding state machine.
GRANT SELECT, INSERT ON TABLE
  auth_spike.totp_code_use,
  auth_spike.workspace_mailbox_proof_spends
  TO cw_auth_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE
  auth_spike.mailbox_proof_rate_windows
  TO cw_auth_runtime;
GRANT SELECT, INSERT ON TABLE auth_spike.mail_delivery_outbox TO cw_auth_runtime;
GRANT UPDATE (state, attempt_count, lease_id, leased_until, next_attempt_at,
  sent_at, payload_ciphertext)
  ON TABLE auth_spike.mail_delivery_outbox TO cw_auth_runtime;
