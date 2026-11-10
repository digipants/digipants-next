ALTER TABLE auth_spike.mail_delivery_outbox
  DROP CONSTRAINT IF EXISTS mail_delivery_outbox_kind_check;

ALTER TABLE auth_spike.mail_delivery_outbox
  ADD CONSTRAINT mail_delivery_outbox_kind_check
  CHECK (kind IN ('mailbox_proof', 'workspace_invitation'));

COMMENT ON TABLE auth_spike.mail_delivery_outbox IS
  'Protected staging encrypted mail outbox for mailbox proofs and client invitations; recipient tokens and codes are not stored in plaintext';
