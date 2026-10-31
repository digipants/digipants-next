# Client Workspace — genuine Better Auth cookie to HTTP project read

**Status:** unmounted development-only adapter, feature-disabled in production. Stacked on draft PR #111.

## End-to-end security slice exercised

1. An invited synthetic client signs into actual Better Auth and verifies TOTP. The handler receives the genuine signed session cookie.
2. The HTTP adapter accepts only a same-origin GET with exact tenant and project UUIDs, strictly within the disposable local test environment.
3. The PR #111 reader resolves the identity from Better Auth, checks email verification, factor verification, session expiry and MFA freshness against auth PostgreSQL records.
4. A distinct non-superuser database login locks the exact active client grant in a serializable transaction, sets the transaction-local tenant context, and reads only a published project.
5. Only project ID, title, state and revision appear in JSON. All denied, missing, stale, wrong-tenant or revoked requests return the same empty 404. The response disables caching, forbids cross-site access and has no token in URL query or response.
6. Negative cases exercise missing or forged cookie, browser-injected identity/role, wrong tenant/project, malicious origin, cross-site fetch, malformed URL, unexpected method, unverified email, stale MFA and grant revocation.

## Required before a real client login

The adapter is **not** mounted in Next.js, is not a public API, and has no production database or email secrets. The isolated Better Auth/database package accepts only named disposable loopback databases and is hard-disabled in production.

Activation requires a production-reviewed Next.js server-only auth adapter, HTTPS cookie/origin/CSRF controls, hosted Neon transaction-pooler validation, strict nonprivileged runtime credentials, durable invitation delivery and mailbox proof, reviewed staff MFA recovery, signed and scanned private storage, approved progress publication, and browser-level pilot with rollback.

Do not treat a caller-controlled PostgreSQL custom tenant context, a role header, an invitation bearer or a passing unit test as authentication. No customers invited, real data read, live deployments, payments or paid upgrades are authorized here.

See PRs #109, #110, #111, #112 and issues #64, #77, #78, #79, #83, #101.
