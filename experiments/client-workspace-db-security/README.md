# Client Workspace PostgreSQL security rehearsal

**Status: development-only experiment.** These scripts run only in an ephemeral
PostgreSQL 17 CI container after the existing version-controlled Prisma migration
has been applied and verified. Do not apply them to the Neon Free development
database, a staging database or production. No public app route imports this
experiment.

## What this exercise actually proves

| Control | Disposable evidence | Production interpretation |
| --- | --- | --- |
| Role separation | Versioned `roles.sql` defines NOLOGIN schema-owner/migrator, runtime, audit-writer and audit-reader roles. Runtime cannot do DDL, inspect invitations or directly mutate audit; writer can append only; reader can read only | The database login, passwords, rotation and managed-role provisioning remain environment operations. Never give runtime membership in migrator/owner/audit-writer |
| RLS | `FORCE ROW LEVEL SECURITY` denies project/audit access with no tenant setting, filters the other tenant and prevents cross-tenant updates/inserts | **Not a security boundary yet**: any SQL user can set `app.workspace_tenant_id` to another UUID |
| State + audit | A narrow `SECURITY DEFINER` append function owned by the insert-only audit role lets runtime atomically record a parameterized state change. Duplicate idempotency rolls back both | The function enforces transaction scope and relational constraints; verified actor, MFA and exact grant still come only from server authorization |
| Append-only audit | Database triggers deny UPDATE, DELETE and TRUNCATE, including attempts by the table owner; runtime role lacks those permissions | Table owner/superuser could still disable/drop triggers; require privilege separation and independent tamper-evident copies |
| Recovery | `pg_dump` custom archive is restored to a *second* disposable database; audit, state, trigger behavior and RLS flags are checked | Not an offsite encrypted backup, restore-time objective, retention policy or disaster recovery runbook |
| Compatibility | Native Prisma 7.10.1 migration, ledger, drift, root tests, TypeScript and ordinary Next build run on Node 24/PostgreSQL 17 in pull-request CI | No hosted Neon migration and no production connection/Runtime Node deployment approval |

## Critical RLS limitation

`SET LOCAL app.workspace_tenant_id` is an application-defined PostgreSQL
configuration variable. Any ordinary SQL role that can execute SQL can **set
or spoof it**. In the test, switching the setting to Tenant B makes Tenant B's
project visible. Therefore this proves only an *accidental-scope guard*, not
robust tenancy against compromised application code or arbitrary SQL.

**Never treat the tenant setting as identity or authorization.** The isolated
Better Auth server seam validates the session and persisted current MFA, then
loads the active principal and exact requested tenant/project grant from
parameterized SQL. State changes choose action-appropriate roles before the
grant query, lock principal/membership/grant/tenant/project rows `FOR SHARE`,
and commit the revision update plus audit append at `SERIALIZABLE`. A concurrent
revocation waits behind that lock; later actions deny. The helper sets the
transaction-local GUC only after this server-side authorization and continues
to include exact scope predicates. Reads and writes fail closed on database,
session, MFA, role or audit errors.

This addresses the demonstrated GUC bypass at the server authorization layer;
it does **not** make arbitrary SQL executed with a runtime credential safe. No
runtime connection is exposed by this experiment. Review role membership,
`BYPASSRLS`, object ownership, function `SECURITY DEFINER`, pool reset and SQL
injection controls before any hosted rollout.

## Security acceptance matrix for parent Issue #79

- [x] Versioned least-privilege schema-owner/migrator/runtime/audit roles and privilege denials
- [x] RLS with/without tenant setting and cross-tenant negative SQL probes
- [x] Demonstrated untrusted-GUC spoof risk
- [x] DB trigger rejects audit UPDATE/DELETE/TRUNCATE
- [x] State/audit idempotency and transaction rollback fixture
- [x] Disposable dump and restore, including audit trigger
- [ ] Reviewed real migration/role separation and enforced privilege ownership
- [x] Server-verified Better Auth subject, current MFA, active principal and exact grant in the isolated local seam
- [x] Action-role selection and serializable grant/revocation lock test
- [ ] Pooler and deployment-specific runtime role binding
- [ ] Append-only audit secured from DDL owners, copied to tamper-evident storage
- [ ] Cross-database signup outbox/saga: durable state machine, idempotent retries, alerting, manual reissue and dead-letter recovery; **never auto-grant**
- [ ] Production-suitable encrypted offsite backups, restore drill, RPO/RTO, retention and incident recovery
- [ ] Database connection/Node/Netlify provider permissions, rate limiting, secrets and monitoring
- [ ] Owner-approved hosted migrations, verified identity onboarding and public routes

## Restore/operational notes

The CI creates only two synthetic tenants in a throwaway database, applies
the isolated SQL hardening, dumps it using `pg_dump -Fc` and restores to a
second throwaway database in the same test container. No customer data, remote
secrets, paid service, persistent dump artifact or production deployment is
used. The generated dump is deleted after the drill.

The audit log can be deleted by powerful operators who disable/drop triggers.
A compromised application runtime can set the custom GUC and arbitrary SQL is
outside the tested boundary. Those risks are explicitly **unresolved launch blockers**; merging this
experiment must not mark parent #79 complete.
