# Client Workspace — verified Better Auth cookie through a real Next.js route

**Status:** Next.js route is mounted in the source tree, but **hard-disabled in production** and Netlify deploy previews. Stacked on draft PR #111. No customer-facing access is enabled.

## End-to-end security slice exercised in disposable CI

1. An invited synthetic client signs into actual Better Auth and verifies TOTP. The integration test forwards the genuine session cookie.
2. The **real Next.js App Router GET export** lives at `app/api/workspace/tenants/[tenantId]/projects/[projectId]/route.ts`. Its local-only triple feature gate additionally requires `NODE_ENV` to be different from `production` and denies every production request, even with the experiment flags set.
3. The HTTP adapter accepts only a same-origin GET with exact tenant and project UUIDs in the disposable localhost environment. It rejects cross-origin requests and query strings.
4. The PR #111 reader resolves the user from Better Auth, checks email verification, factor verification, session expiry and recent MFA against auth PostgreSQL records.
5. A distinct non-superuser workspace database login locks the exact active client grant in a serializable transaction, sets transaction-local tenant context, and reads one published project. The caller cannot control role or trusted identity.
6. Only project ID, title, state and revision appear in JSON. Missing, stale, wrong-tenant, revoked and unverified requests receive the same empty 404. The response disables caching and does not enable CORS.
7. CI tests the real handler's positive path, a guest request, a wrong-tenant request, disabled methods, and its production-off gate alongside the existing forged-cookie/header, stale MFA and grant-revocation tests; Next.js production build passes.

## Hosted Neon finding on 31 October 2026

Read-only checks of the development primary branch showed a single login role `digipants_ws_dev` with `CREATEROLE` and `BYPASSRLS`. Neon compute metadata reports `pooler_enabled=false` (although a pooled hostname exists). This role **must not** be used as the customer-facing runtime login and the reported pooler hostname is NOT proof of working pooled access. The hosted least-privilege pooler acceptance gate #101 remains open. The primary database has not been changed.

## Required before customer activation

The protected Next route is present in source control, but its experimental Better Auth/database package **rejects production and any database other than named disposable local fixtures**. A future **separately reviewed production implementation** must have a vetted server-only auth configuration, production HTTPS cookies/origin/CSRF controls, database connection management with nonprivileged hosted credentials and real transaction pooler tests, durable invitation delivery and verified recipient proof, staff MFA reset/recovery, reviewed project progress, and scanned private files. Do not bypass the production-off gate simply by adding an env variable.

A passing route-export test and build are not a full browser/netlify deployment test. A separate live, authorized preview and negative browser suite are required before pilot sign-off.

No real customer invites, production data, merchant payments, migrations, paid upgrades, auto-merges or manual deploys were performed.

See draft PRs #109, #110, #111, #112 and issues #64, #77, #78, #79, #83, #101.
