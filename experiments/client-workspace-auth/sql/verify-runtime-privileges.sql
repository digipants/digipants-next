-- Run after runtime-privileges.sql on the disposable auth_spike database.
BEGIN;
SET LOCAL ROLE cw_auth_runtime;
DO $$
DECLARE attrs record;
BEGIN
  SELECT r.rolcanlogin, r.rolsuper, r.rolbypassrls,
         r.rolcreatedb, r.rolcreaterole INTO attrs
    FROM pg_catalog.pg_roles AS r WHERE r.rolname='cw_auth_runtime';
  IF attrs.rolcanlogin OR attrs.rolsuper OR attrs.rolbypassrls OR
     attrs.rolcreatedb OR attrs.rolcreaterole THEN
    RAISE EXCEPTION 'auth runtime group role is not restricted';
  END IF;
  IF NOT has_schema_privilege('cw_auth_runtime', 'auth_spike', 'USAGE') OR
     has_schema_privilege('cw_auth_runtime', 'auth_spike', 'CREATE') THEN
    RAISE EXCEPTION 'auth runtime schema privileges are too broad or missing';
  END IF;
  IF NOT has_table_privilege('cw_auth_runtime', 'auth_spike.session', 'SELECT') OR
     NOT has_table_privilege('cw_auth_runtime', 'auth_spike.session', 'INSERT') OR
     NOT has_table_privilege('cw_auth_runtime', 'auth_spike.session', 'DELETE') OR
     NOT has_table_privilege('cw_auth_runtime', 'auth_spike.user', 'UPDATE') OR
     NOT has_table_privilege('cw_auth_runtime', 'auth_spike.verification', 'DELETE') OR
     NOT has_table_privilege('cw_auth_runtime', 'auth_spike.mail_delivery_outbox', 'INSERT') OR
     NOT has_column_privilege('cw_auth_runtime', 'auth_spike.mail_delivery_outbox', 'payload_ciphertext', 'UPDATE') THEN
    RAISE EXCEPTION 'auth runtime required operation is missing';
  END IF;
  IF has_table_privilege('cw_auth_runtime', 'auth_spike.user', 'TRUNCATE') OR
     has_table_privilege('cw_auth_runtime', 'auth_spike.workspace_mailbox_proof_spends', 'DELETE') OR
     has_table_privilege('cw_auth_runtime', 'auth_spike.mail_delivery_outbox', 'DELETE') OR
     has_table_privilege('cw_auth_runtime', 'auth_spike.mailbox_proof_rate_windows', 'DELETE') OR
     has_column_privilege('cw_auth_runtime', 'auth_spike.mail_delivery_outbox', 'payload_sha256', 'UPDATE') THEN
    RAISE EXCEPTION 'auth runtime can truncate or erase durable auth state';
  END IF;
END $$;
ROLLBACK;
