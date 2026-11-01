ALTER TABLE auth_spike.mail_delivery_outbox
  DROP CONSTRAINT IF EXISTS mail_delivery_outbox_kind_check;

ALTER TABLE auth_spike.mail_delivery_outbox
  ADD CONSTRAINT mail_delivery_outbox_kind_check
  CHECK (kind IN ('mailbox_proof', 'workspace_invitation', 'founder_bootstrap'));

COMMENT ON TABLE auth_spike.mail_delivery_outbox IS
  'Protected staging encrypted mail outbox for mailbox proofs, one-time founder enrollment and client invitations';
