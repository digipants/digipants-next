# Client Workspace Better Auth security experiment

This folder is a development-only compatibility and security harness for the
stable package pins `better-auth@1.7.14`, `@better-auth/prisma-adapter@1.7.14`
and Prisma `7.10.1`. It has no Next.js route, UI, middleware, Netlify setting,
production secret, remote database connection, or real identity. It does not
change the root application dependencies.

## Boundary

Better Auth owns the experiment's `auth_spike` schema: user, session, account,
verification, two-factor and replay-protection records. DigiPants workspace
principals, invitations, memberships and project grants stay in the existing
workspace database and schema. Signup consumes a hashed invitation token for
the intended email and records only a client principal. It does not create a
tenant membership or a project grant. Those permissions remain a separate,
explicit staff action.

Better Auth 1.7.14 returns a challenge rather than an authenticated session
when a credential user has 2FA enabled. Its generic session shape does not give
the workspace a durable, server-verifiable MFA assurance claim. The experiment
therefore uses an app-owned nullable `mfa_verified_at` session column that is
not accepted from user input or returned in API responses. A Better Auth
session-create hook stamps it only while a TOTP or backup-code challenge is
being verified. The workspace gate re-reads that value and the enabled factor
from PostgreSQL, then invokes the existing effective-grant query and access
policy. It fails closed on query, session, factor, principal or grant errors.

The TOTP hook also atomically claims accepted time steps in the separate
`auth_spike.totp_code_use` table. A reused step cannot create another assured
session. Better Auth's backup-code implementation removes a code through a
compare-and-swap update; the integration test verifies wrong and reused codes
against the real handler. Trusted-device requests are made nonpersistent and
cannot create a session assurance marker. OAuth, magic link, email OTP,
username, phone, passkey, anonymous and other passwordless entry points are not
configured and are explicitly disabled where Better Auth has a matching path.

Invitation consumption and principal creation share one PostgreSQL transaction
in the workspace database. Better Auth creates the identity in its separate
database afterward. If that later identity write fails, the invitation remains
consumed and the orphan principal has no membership or grant; cleanup or
reissuance is a future operational policy. This deliberately favors denial
over accidentally restoring a consumed bearer token.

## Local verification

Use only four disposable loopback PostgreSQL databases with the exact names
below. The integration test rejects remote hosts, Neon URLs, database-name
substitutions and connection overrides before opening a database connection.

The repository's existing workspace migration must be applied to
`digipants_workspace_dev` first. This experiment migration is applied only to
`auth_spike_test`. The two shadow databases are disposable and are used only by
Prisma's migration-diff check. No Prisma engine checksum bypass is supported.

At the repository root, apply and validate the workspace migration and existing
suite:

```sh
export DIRECT_URL='postgresql://fixture:fixture@127.0.0.1:5432/digipants_workspace_dev'
export DATABASE_URL="$DIRECT_URL"
export SHADOW_DIRECT_URL='postgresql://fixture:fixture@127.0.0.1:5432/workspace_shadow'
export WORKSPACE_DB_TEST_LOCAL=1

npm ci
npm run db:generate
npm run db:migrate:deploy
npm run db:migrate:status
npx prisma migrate diff --from-migrations prisma/migrations --to-config-datasource --exit-code
node tests/client-workspace-persistence.integration.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Then run the auth experiment from its directory:

```sh
cd experiments/client-workspace-auth
export AUTH_DATABASE_URL='postgresql://fixture:fixture@127.0.0.1:5432/auth_spike_test'
export AUTH_SHADOW_DATABASE_URL='postgresql://fixture:fixture@127.0.0.1:5432/auth_spike_shadow'
export WORKSPACE_DATABASE_URL="$DIRECT_URL"
export AUTH_EXPERIMENT_ENABLED=1
export RUN_AUTH_EXPERIMENT_INTEGRATION=1
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"

npm ci
npm run db:generate
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:migrate:diff
npm run auth:schema
npm run test:integration
npm test
npm run typecheck
```

## Remaining gates

This is an SDK compatibility experiment, not a production authentication
design. Before any product integration, independently review invitation
issuance and delivery, email ownership verification, origin/CSRF controls,
session revocation and factor reset, recovery operations, encrypted backup
codes and TOTP secrets at rest, account lockout/rate limits, database role
separation, monitoring, and the cross-database partial-failure policy. The
hosted Neon primary development branch and all production resources are out of
scope.
