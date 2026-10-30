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

Better Auth's configured account lockout is exercised by the real TOTP handler
and PostgreSQL adapter. Five consecutive failed second-factor sign-in
verifications persist `failedVerificationCount` and `lockedUntil` on the
Better Auth two-factor row for 60 seconds; Better Auth applies this shared
counter in both the TOTP and backup-code handlers. Correct factors are rejected
during the lock before session creation. After 60 seconds, the next verification
lazily clears the expired lock and failure count. Better Auth's separate
five-attempt challenge limit may also require a fresh password sign-in; after
that, a valid factor succeeds and leaves the counter reset to zero. The
integration test backdates the lock only in its disposable PostgreSQL fixture
to exercise this expiry path without waiting a minute. There is no manual
unlock, password-reset bypass, or factor reset route in this experiment. A
future audited factor-recovery process must revoke existing sessions and clear
the lock only after identity verification.

## Bounded MFA recency and session revocation (Issue #76)

The isolated authorization seam now requires a **DB-stored, server-created and bounded**
`mfa_verified_at` timestamp in addition to a live Better Auth session, an
enabled and verified second factor, an active DigiPants principal and an exact,
active tenant/project grant. It rejects absent, future-dated, stale, revoked
or otherwise invalid assurance. Its clock is PostgreSQL's
`statement_timestamp()`, never a browser-supplied value. The action age is
supplied to a parameterized Prisma query, not interpolated as SQL text.

These are **provisional risk windows for the isolated experiment**, not
production session defaults or proof of a real step-up challenge:

| Action class | Maximum age | Examples |
| --- | --- | --- |
| Read-only | 12 hours | published project/proposal/invoice reads and internal read |
| Routine change | 15 minutes | editing/reviewing briefs, requesting changes, delivery edits |
| High-impact / contractual / financial | 5 minutes | proposal decision, milestone acceptance, contract signature, invoice approval, payment reconciliation, project activation/closure |

Every current `WorkspaceAction` is assigned explicitly; unrecognized actions
deny before database access. An integration test ages a real verified session
inside disposable PostgreSQL and checks each boundary, rejects a fabricated
future date, disables the factor and confirms denial, then signs out and verifies
the old session ID cannot authorize actions even though its earlier MFA
timestamp had been valid.

**Important limitations:** This does not implement fresh TOTP prompting or a
server-side step-up flow at the point of an approval. The experiment still
restricts its principal lookup to `kind = 'client'`; staff MFA and staff
session enrollment remain unproven. Reset/recovery must invalidate old sessions
and assurance. Before real client/staff use, review all time windows against
a product security policy and test factor reset, absolute/idle session expiry,
audit, rate limits, cross-database consistency and clock/replica behavior.

Invitation consumption and principal creation share one PostgreSQL transaction
in the workspace database. Better Auth creates the identity in its separate
database afterward. If that later identity write fails, the invitation remains
consumed and the orphan principal has no membership or grant; cleanup or
reissuance is a future operational policy. This deliberately favors denial
over accidentally restoring a consumed bearer token.

## Isolated project-owner invitation issuance and revocation (#81)

The `invite-issuance.ts` core adds the **issuance half** of the invitation
contract, without introducing a route or sending any mail. It creates a
cryptographically random 32-byte bearer token, stores only its SHA-256 digest,
sets a PostgreSQL-clock 20-minute expiry, binds the intended recipient to an
explicit client role and exact tenant/project, and creates an audit row in the
same transaction. The bearer is returned to its **test-only** caller solely to
enable future controlled delivery; never log or expose it to a browser/API.

The issuer lookup requires an active DigiPants `staff` principal, active
staff membership and an explicit active `workspace_owner` grant on the exact
active tenant and project. The query takes shared row locks before the
invitation is committed. Revocation similarly checks active ownership and
atomically records an audit event; only pending invitations can be revoked.
There is **no** automatic membership or project grant upon issuance.

This is **not a production staff authorization boundary**. The issuer subject
is injected by a synthetic test harness; there is not yet a verified
staff-session/MFA binding (see #78). Real delivery, verified email ownership,
CSRF/origin restrictions, rate limits, audit append-only permissions,
resend/reconciliation and recovery remain blockers under #77 and #79.
No external email, SMTP integration, actual recipients, password resets or
production database writes occur here. The isolated SQL test inserts only
synthetic fixtures on disposable loopback PostgreSQL, checks cross-tenant and
unassigned-staff denials, token secrecy, audit linkage and revocation.

## Isolated mailbox-ownership proof and request guard (#84)

The `mailbox-proof.ts` experiment creates a second, separately random
32-byte ownership secret for the **exact pending invitation recipient**.
The challenge's SHA-256 digest lives in `auth_spike.verification` with a
10-minute expiration. Two concurrent requests for the same invitation and
recipient serialize on a PostgreSQL advisory transaction lock, limiting the
fixture to one active code. Checking a proof deletes the matching hash
atomically, denying replay, other emails, expired proofs and revoked invites.
The code exists only in its private test return value; no email, account,
tenant membership or grant is created. **A real provider must deliver it only
to the address on the invite, and production signup must independently consume
a valid proof; neither is implemented here.** Proof success alone cannot be
relied on to enable sign-up.

`enrollment-request-guard.ts` separately demonstrates a strict server-side
same-origin POST/JSON and HMAC double-submit token contract, bound to an
already verified, server-owned session and short validity window. It rejects
mismatched Origin/Host, missing or cross-site fetch metadata, a wrong CSRF
cookie/header, altered HMAC, incorrect session or expired/future timestamp.
This experimental helper is **not middleware**, does not establish identity,
does not replace Better Auth's built-in CSRF and session protection and does
not secure routes merely because an HTTP client supplied Origin/Host headers.

Remaining **blocking #83/#78/#79 work**: controlled mail delivery, email
verification linked atomically to identity provisioning, request rate limits,
origin/CSRF integration, abuse/suppression monitoring, auditable recovery
of the separate auth/workspace databases, production secret and cookie policy,
staff MFA and least-privilege roles. The isolated Better Auth signup hook now requires BOTH the invitation bearer
and a separately issued, pending-recipient mailbox challenge ID and code. The
challenge is consumed before the invitation, while identity creation occurs
in the other database afterwards. Each step fails closed, but partial failures
can consume a valid proof/invitation without creating an account. Operations
must have auditable reconciliation/reissue before real use. The proof code is
returned only to the synthetic test; **no verified mail delivery, recipient
ownership channel, rate limit or production signup endpoint exists**. Do not
expose this to the public Next app until those remaining gates are approved.

## Isolated staff grant gate (#86)

The isolated staff-only validator uses a verified server Better Auth session,
enabled and verified TOTP, DB-stored MFA age, active staff membership and exact
project grants. Staff actions are explicitly allowlisted; client privileges do
not carry over. Synthetic PostgreSQL tests check tenant/role separation,
stale MFA, disabled factor, revoked grants/memberships and deleted sessions.
The fixture inserts test-only staff identity and assurance state directly in
a disposable database: real staff enrollment, operator approval, live TOTP
challenge and factor-reset recovery are **not** implemented. #78 remains a
production blocker. No live route imports this experimental helper.

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
