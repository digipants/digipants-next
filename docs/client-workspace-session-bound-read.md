# Client Workspace — Verified session to exact published project (isolated read slice)

## What this PR establishes

A private, server-only read function `loadPublishedProjectForVerifiedRequest` resolves the user's identity via Better Auth's server-side `getSession`; its internal helper requires the exact verified session/user pair. It then checks persisted auth session expiry, independently verified email address, verified two-factor enrollment, and action-specific fresh MFA. These records come from the isolated `auth_spike` database.

The workspace database must be connected as the dedicated restricted runtime role, with **no** SUPERUSER, BYPASSRLS, CREATEROLE, schema-owner inheritance, audit-writer inheritance or invitation token table SELECT. This fails closed on misconfigured connections.

Inside one serializable workspace transaction, an explicitly scoped PostgreSQL SECURITY DEFINER helper checks and holds FOR SHARE locks on the exact active client principal, membership, project grant and active tenant, denying grant revocation races within that transaction. The app then sets its **transaction-local** tenant GUC, queries the exact published project ID and tenant, and returns only a strictly allowlisted title, state and revision. The identity+email+MFA assurance is rechecked before returning to narrow the cross-database revocation window. Missing, unauthorized, unpublished, revoked, expired and wrong-tenant requests all return a nondisclosing generic error.

The helper **is not an authenticator**. Anyone with raw SQL access can present a known provider subject or spoof a tenant GUC; the verified session is required before calling it. The isolated harness does not expose HTTP, Netlify settings, production credentials, signup, invitation delivery, user lists or private document URLs.

## Tests

The disposable PostgreSQL 17 auth integration runs with Better Auth and a restricted workspace Prisma connection. It exercises: legitimate client read, unpublished denial, wrong tenant, forged subject/session, unverified email, expired MFA, revoked grant/membership, disabled tenant and revoked session. The normal auth test suite, trusted staff state tests, entire root test suite, TypeScript and build are prerequisites.

## Remaining activation gates

- #101 / #79: real hosted Neon transaction-pooler app connections; dedicated non-superuser credentials, native migrations/ledger, no session leakage, restore drills, independent security review.
- #77 / #83: controlled email delivery, subject+recipient identity and CSRF/origin-protected invitation enrollment, rate limits, operational controls, staff grant review.
- #78: staff MFA step-up, factor reset/recovery and revocation.
- #108 / PR #109: separately reviewed immutable progress/document metadata, content publication and withdrawal. Private files need a private object store, malware inspection, signed bounded authorization and revocation.
- Production auth routing, environment secrets, consent-safe logging, alerts and supervised pilot; use an explicit rollout/rollback plan. A cross-database session revocation between the second check and HTTP transmission is a residual risk to review.

## Scope

Development-only. No live customer activation, no production release, no paid upgrades, no manual deployment, and no real client data. Do not merge without full green CI and independent review.
