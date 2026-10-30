# Client Workspace — Actual transaction pooler rehearsal (Issue #101)

This CI-only experiment exercises a **real PgBouncer 1.25.2 transaction-mode container**, not an emulated SQL interface. The backing database is PostgreSQL 17 in a disposable GitHub Actions service. The installer is a non-superuser. The separate runtime login has no SUPERUSER, BYPASSRLS or CREATEROLE privilege; it only inherits the restricted cw_runtime role. All usernames, tenant IDs and credentials in this workflow are static synthetic test fixtures.

## Verified behavior sought

- Native Prisma 7 migrations use a direct connection (never PgBouncer). Reapplication, migration status and drift checks are required.
- Installer privilege changes use one atomic transaction; verify no retained SET/INHERIT schema ownership or audit-writing privilege.
- PgBouncer uses **transaction** pool mode, SCRAM auth, a one-server-connection pool, and a separate runtime login.
- Queries using a transaction-local app.workspace_tenant_id show the selected fixture tenant only.
- Subsequent transactions without setting the tenant must show zero projects, including after connection and backend reuse, rollback and repeated tenant switching.
- Runtime attempts to read invitation hashes, mutate audit records or create tables must fail.
- Critically, the test demonstrates that **an arbitrary runtime SQL caller can set another tenant's ordinary GUC and invoke the grant-lock helper with a known subject. This remains a security gap, not successful authentication.** Server-side verified identity, active project grant and SQL-injection protection must be enforced before a customer-facing read or write.

## What this does NOT establish

This does not exercise the actual Neon -pooler endpoint, nor does it establish hosted Prisma migration ledger, production authentication, invitation delivery, staff MFA lifecycle, secure public document reads or sufficient tenant isolation under a hostile DB runtime caller. Issue #101 remains open and requires an approved temporary Neon Free branch and secret-managed pooled client, without using customer data or the default development branch. No production env vars or Netlify configuration are changed.

## Operations

Pull request only. The job uses a real local pooler; direct database credentials are for migrations only. The workflow never persists its fixture credentials, does not pull from a live database, and cleans up the pooler after execution. This is not authorization to merge a customer-facing portal or to deploy real invitations.
