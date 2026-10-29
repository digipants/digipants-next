# Client Workspace persistence foundation

This is a development-only persistence layer for Issue #72. It adds the reviewed tenant, principal, membership, project, grant, invitation-hash and audit schema. It does not add Better Auth tables, authentication, routes, customer data, or a production database connection.

## Pinned stack and connection boundaries

Prisma ORM, `@prisma/client` and `@prisma/adapter-pg` are pinned to **7.10.1**. The tested baseline is Node 24.19.0, Next.js 15.5.27 and TypeScript 5.5.4. Prisma 7.10.1 requires Node 20.19+, 22.12+ or 24.0+ and TypeScript 5.4+; confirm the actual Netlify build/runtime Node version before enabling this code there.

Use `DATABASE_URL` with Neon’s pooled endpoint for warm Node/Netlify request traffic. `getWorkspacePrisma()` lazily reuses one adapter-backed client per warm process and caps each pool at one connection. Schema tools use `DIRECT_URL` for the unpooled endpoint. `SHADOW_DIRECT_URL` is optional and must point to a separate disposable development database when running migration-history drift checks. Do not use the application pool URL as a migration or shadow URL.

No connection value is stored in this repository. The `prebuild` hook runs `prisma generate` only. `prisma migrate deploy` is a separate, manual development operation and is never part of `npm run build`, Netlify builds, Deploy Previews, or deployment.

## Schema and authorization contract

`prisma/schema.prisma` describes the typed model. The versioned SQL migration adds PostgreSQL checks and triggers that Prisma’s schema language does not represent:

- Client and staff principal kinds and role sets remain separate. Membership and invitation redemption foreign keys include the principal kind.
- Grant and audit project references use `(tenant_id, project_id)` against the matching composite project key. Client grants also reference `(tenant_id, principal_id)` membership rows.
- Invitation records store one unique token hash field; there is no plaintext-token column and invite redemption does not automatically create a project grant.
- Effective-grant reads are server-only, resource-scoped queries. Every result requires an active principal, tenant, membership and grant, and also joins the project using both tenant and project IDs. Unknown roles are dropped.
- Disabling a principal revokes memberships. Revoking or reactivating a membership revokes its existing grants; a reactivated parent therefore cannot revive an old grant. A new explicitly approved grant is required.
- Provider subject, principal kind and project tenant ownership are immutable authorization bindings.
- Project state updates are scoped by tenant, project and expected revision. The active staff grant is rechecked in the same serializable transaction that writes the state and audit event. A duplicate audit idempotency key rolls the state change back.

The audit table is not yet append-only at the database permission layer. RLS, least-privilege application/migration roles, Better Auth session checks, invitation redemption, audit retention, backup/restore, public routes and production use remain separate review gates. Callers must validate a server-side session and run the existing access policy before invoking state changes.

## Development commands

```sh
npm run db:generate
npm run db:migrate:status
npm run db:migrate:deploy
```

Set `DIRECT_URL` only in a secure local development environment before migration commands. `db:migrate:deploy` applies the checked-in migration and is safe to rerun after Prisma records it as applied. This additive foundation has no automatic down migration; recover a failed disposable validation by recreating that development branch from its parent. Do not use a production database or delete schema objects to simulate rollback.

For migration-history drift checks, supply an isolated disposable `SHADOW_DIRECT_URL` and compare the checked-in migration directory to the selected development datasource with `prisma migrate diff --from-migrations prisma/migrations --to-config-datasource --exit-code`. The shadow database is reset by Prisma during this operation; never point it at the development source branch or any production data.

The database integration suite requires an explicit guard and accepts only the approved Neon workspace database or a loopback-only disposable PostgreSQL instance:

```sh
WORKSPACE_DB_TEST_APPROVED=1 npm run test:client-workspace:db
```

Use a secure shell environment or secret injector for `DATABASE_URL`; do not paste connection strings into GitHub. The script checks the database and role names, inserts uniquely named synthetic fixtures, verifies constraints, grants and transaction rollback, then removes those fixtures. `WORKSPACE_DB_TEST_LOCAL=1` is reserved for a temporary loopback-only PostgreSQL container. The regular repository test suite does not connect to a database.

The issue validation branch is separate from the development source branch. Its synthetic fixtures were removed after the tests. The branch’s remaining schema is for migration review only and is not a production-ready or migration-ledger source of truth.
