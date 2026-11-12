-- Read-only, fail-closed production authentication database acceptance query.
-- Run in digipants_auth_prod as the trusted migration/audit identity after deployment.
-- Each boolean must be true before production is eligible to be enabled.
WITH required(name) AS (
  VALUES ('user'), ('session'), ('account'), ('verification'), ('twoFactor'),
         ('totp_code_use'), ('workspace_mailbox_proof_spends'),
         ('mailbox_proof_rate_windows'), ('mail_delivery_outbox')
), inventory AS (
  SELECT r.name, c.oid
    FROM required AS r
    LEFT JOIN pg_catalog.pg_namespace AS n ON n.nspname = 'auth_spike'
    LEFT JOIN pg_catalog.pg_class AS c
      ON c.relnamespace = n.oid AND c.relname = r.name AND c.relkind = 'r'
)
SELECT
  current_database() = 'digipants_auth_prod' AS expected_database,
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'cw_auth_prod_app' AND rolcanlogin
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb
      AND NOT rolcreaterole AND NOT rolreplication
  ) AS restricted_auth_login,
  pg_has_role('cw_auth_prod_app', 'cw_auth_runtime', 'USAGE')
    AND NOT pg_has_role('cw_auth_prod_app', 'cw_runtime', 'USAGE')
    AND NOT pg_has_role('cw_auth_prod_app', 'cw_schema_owner', 'USAGE')
    AND NOT pg_has_role('cw_auth_prod_app', 'cw_audit_writer', 'USAGE')
      AS auth_membership_separated,
  has_database_privilege('cw_auth_prod_app', 'digipants_auth_prod', 'CONNECT')
    AND NOT has_database_privilege('cw_auth_prod_app', 'digipants_workspace_prod', 'CONNECT')
      AS cross_database_access_denied,
  (SELECT COUNT(*) = 9 FROM inventory WHERE oid IS NOT NULL) AS auth_tables_present,
  to_regnamespace('auth_spike') IS NOT NULL
    AND COALESCE(has_schema_privilege('cw_auth_prod_app', to_regnamespace('auth_spike'), 'USAGE'), false)
    AND NOT COALESCE(has_schema_privilege('cw_auth_prod_app', to_regnamespace('auth_spike'), 'CREATE'), false)
      AS restricted_auth_schema_access,
  to_regclass('auth_spike.session') IS NOT NULL
    AND COALESCE(has_table_privilege('cw_auth_prod_app',to_regclass('auth_spike.session'),'SELECT'),false)
    AND COALESCE(has_table_privilege('cw_auth_prod_app',to_regclass('auth_spike.session'),'DELETE'),false)
      AS session_logout_grants,
  to_regclass('auth_spike.mail_delivery_outbox') IS NOT NULL
    AND COALESCE(has_table_privilege('cw_auth_prod_app',to_regclass('auth_spike.mail_delivery_outbox'),'INSERT'),false)
    AND NOT COALESCE(has_table_privilege('cw_auth_prod_app',to_regclass('auth_spike.mail_delivery_outbox'),'DELETE'),false)
      AS outbox_retries_without_deletion,
  to_regclass('public._prisma_migrations') IS NOT NULL AS migration_ledger_present;
