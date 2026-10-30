# Client Workspace PostgreSQL security rehearsal

**Status: development-only experiment.** These scripts run only in an ephemeral
PostgreSQL 17 CI container after the existing version-controlled Prisma migration
has been applied and verified. Do not apply them to the Neon Free development
database, a staging database or production. No app imports this experiment.

## What this exercise actually proves

| Control | Disposable evidence | Production interpretation |
| --- | --- | --- |
| Least privilege | A NOLOGIN `cw_runtime_test` role can read only projects/audit, update only project state/revision, insert only audit; invitation/token tables are inaccessible | Still needs separate real migration, admin, app and audit roles plus authenticated server binding |
| RLS | `FORCE ROW LEVEL SECURITY` denies project/audit access with no tenant setting, filters the other tenant and prevents cross-tenant updates/inserts | **Not a security boundary yet**: any SQL user can set `app.workspace_tenant_id` to another UUID |
| State + audit | Revision update and audit append succeed inside one transaction; a duplicate idempotency key rolls back both changes | Actual production write endpoints, retries, grant revocation races and audit actor context are not exercised here |
| Append-only audit | Database triggers deny UPDATE, DELETE and TRUNCATE, including attempts by the table owner; runtime role lacks those permissions | Table owner/superuser could still disable/drop triggers; require privilege separation and independent tamper-evident copies |
| Recovery | `pg_dump` custom archive is restored to a *second* disposable database; audit, state, trigger behavior and RLS flags are checked | Not an offsite encrypted backup, restore-time objective, retention policy or disaster recovery runbook |
| Compatibility | Native Prisma 7.10.1 migration, ledger, drift, root tests, TypeScript and ordinary Next build run on Node 24/PostgreSQL 17 in pull-request CI | No hosted Neon migration and no production connection/Runtime Node deployment approval |

## Critical RLS limitation

`SET LOCAL app.workspace_tenant_id` is an application-defined PostgreSQL
configuration variable. Any ordinary SQL role that can execute SQL can **set
or spoof it**. In the test, switching the setting to Tenant B makes Tenant B's
project visible. Therefore this proves only a *query-scoping fallback*, not
robust tenancy against compromised application code or SQL injection.

**Never treat the tenant setting as the user's identity.** Production needs an
independently validated Better Auth subject, active principal/membership/grant,
transaction-scoped resource authorization, verified pooling/connection-reset
behavior and a permission model preventing the client from selecting arbitrary
tenant IDs. Before production, design a trusted RLS context mechanism or rely
on an independently verified server-side permission query plus scoped SQL,
with tests that model attacker-controlled queries. Review PostgreSQL role
`BYPASSRLS`, owner, function `SECURITY DEFINER`, connection pool and
prepared-statement semantics before any hosted rollout.

## Security acceptance matrix for parent Issue #79

- [x] Disposable role permission denials
- [x] RLS with/without tenant setting and cross-tenant negative SQL probes
- [x] Demonstrated untrusted-GUC spoof risk
- [x] DB trigger rejects audit UPDATE/DELETE/TRUNCATE
- [x] State/audit idempotency and transaction rollback fixture
- [x] Disposable dump and restore, including audit trigger
- [ ] Reviewed real migration/role separation and enforced privilege ownership
- [ ] Server-authenticated principal and tenant binding through pooler/RLS
- [ ] Independently authorized client/staff grants and revocation races under load
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
A leaked runtime DB credential could also select arbitrary tenant settings.
Those risks are explicitly **unresolved launch blockers**; merging this
experiment must not mark parent #79 complete.
