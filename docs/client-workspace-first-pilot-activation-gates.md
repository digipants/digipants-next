# DigiPants Client Workspace — first invited pilot activation gate

Last reviewed: 31 October 2026. **No production activation approved.** This document records only verified readiness evidence and outstanding release blockers.

## Pilot target and outbound email policy

- Initial test recipient: founder's connected **personal Gmail** account, selected by the owner. Do not hard-code a personal email address in Git, website HTML, build logs, or analytics.
- Existing DigiPants Netlify site currently has `RESEND_API_KEY` and `EMAIL_FROM` for the public contact route. These **do not** imply workspace mail sending is authorized or correctly scoped.
- The local/CI Resend adapter uses the official `Idempotency-Key` header for one message ID. It is disabled in production and uses fake HTTP responses in tests. **No real emails were sent.**
- Never reuse Gmail OAuth refresh tokens, a personal Gmail password, or the public contact form's unrestricted sending context in workspace server code.
- Live sending requires a dedicated least-privilege worker, provider-side idempotency, durable retry/reconciliation, privacy-safe bounce handling, recipient allowlist for the pilot, per-origin limits, and explicit go/no-go.
- The encrypted local outbox is not a production worker. Code delivery/acknowledgement, idle scheduling, key rotation and challenge expiry must be independently tested before enabling mail.

## Environment inventory (read-only inspection)

| Component | Verified finding | Required for activation |
| --- | --- | --- |
| DigiPants production | Site accessible at digipants.com; workspace routes intentionally 404 in production | Preserve public pages and consent analytics |
| Site env | Resend sender/config present; **no workspace-specific auth/database configuration** found | Dedicated encrypted runtime-only credentials, no build/exposure leakage |
| Neon development primary | No workspace tables on primary in prior hosted rehearsal; owner login `digipants_ws_dev` has `BYPASSRLS`; pooler currently off | Never use owner for runtime; prove restricted `-pooler` TLS connection |
| Disposable Neon | A fresh Free child passed real restricted-login, two-tenant RLS and negative privilege probes on 31 October; branch then deleted | The public **client-to-`-pooler`** TLS certificate/hostname proof remains **unverified** |
| Application | CI verifies real mounted Next.js auth/TOTP/project read and local headless Chrome invitation/login/guest denial | Production-grade auth secret rotation, real MFA recovery, deployment packaging, UAT |
| Dependencies | Next.js security patch **15.5.28** squash-merged as #118 to `main` (`ebdf650`); automatic Netlify production deploy ready; `npm audit --omit=dev --audit-level=high`, immutable install and production build all passed | Review remaining **development** advisories and repeat prod audit on exact workspace release head |

Do not rely on a `-pooler` hostname being returned or a compute metadata flag to claim an **actual pooled TLS connection**.

### Hosted Neon evidence — 31 October 2026

Tested on approved, branch-local Free child `tmp-cw118-pool-tls-20261031` (`br-lucky-lake-zaidjlls`, now **deleted**). Only the original three Neon branches remain. Two real workspace SQL migrations, six synthetic seed statements and the complete role/RLS hardening were applied in transactions. A distinct SQL-created `cw_pilot118_restricted` role used a password generated **inside PostgreSQL** and had `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` attributes. Login through the Neon SQL connector proved:
- `session_user=current_user=cw_pilot118_restricted` with no invitation-token SELECT, audit INSERT or schema CREATE.
- Zero project records before tenant context; precisely Tenant A's project under Tenant A; precisely Tenant B's project under Tenant B; zero after transaction reset.
- Execution of unauthorized invitation, audit and schema operations was denied.

**This is not public pooled TLS proof.** The Neon SQL connector reported `pg_stat_ssl.ssl=false` (internal database connection). That reflects the backend transport and says nothing about an independent Node.js connection to the public `-pooler` frontend. The updated [pooled acceptance script](../experiments/client-workspace-auth/scripts/neon-pooler-acceptance.mjs) now verifies the actual Node `TLSSocket`, certificate authorization and hostname. It also validates the restricted login and exact synthetic rows. Its current CI test uses injected mock connections; **no real pooled socket was tested**. See [Issue #101](https://github.com/digipants/digipants-next/issues/101).

### Run the remaining pooled-TLS gate securely

Run from an approved GitHub Actions runner or another network-capable, isolated environment; do not run from the live production app or store credentials in Git. The test requires a **new temporary Neon child** with the reviewed schema, two synthetic tenant fixtures and a separate SQL-created restricted login. The temp branch must be deleted after the probe.

1. Provision a restricted login using credentials generated through a secure operator flow, never the Neon API-created privileged role or `digipants_ws_dev`. Its own `session_user` must be nonprivileged and inherit only `cw_runtime`.
2. Store the pooled URL only in a protected environment secret, with `sslmode=verify-full` and the actual `-pooler` hostname. Do not print, paste into issue comments or expose it in Actions logs. The current GitHub connector cannot create an Actions secret on the user's behalf.
3. In the isolated auth experiment, run `WORKSPACE_POOLER_ACCEPTANCE_ENABLED=1 node scripts/neon-pooler-acceptance.mjs`, supplying `WORKSPACE_POOLER_TEST_URL`, `WORKSPACE_POOLER_TEST_TENANT_A`, and `WORKSPACE_POOLER_TEST_TENANT_B` from protected runner configuration. The test's failure message is intentionally generic.
4. Save **only** the boolean pass/fail indicators, exact Git commit, runtime restricted role attributes, disposal confirmation and synthetic tenant checks. Verify hostname/certificate, role separation, no-scoped/after-transaction zero, and A/B exact records. On failure keep customer routes closed.

Caution: node-postgres documents that `sslmode` inside `connectionString` can override a separately supplied `ssl` configuration. The script deliberately parses the URL and passes explicit socket verification settings instead: https://node-postgres.com/features/ssl.


## Mandatory activation phases

1. **Review & consolidate stacked drafts.** Security-review auth, tenant policies, RLS, invitations, mail outbox, and audit trails. Confirm dependencies between #111, #112, #113, #114, #115, #116, #117 and earlier foundation PRs; no independent merge of a stacked leaf.
2. **Hosted pooled-TLS proof.** Use a new approved temporary Free Neon child of the dev branch with strictly synthetic data. Install the reviewed schema transactionally and create a limited `NOBYPASSRLS NOCREATEROLE NOCREATEDB` login. Run `scripts/neon-pooler-acceptance.mjs` with a verified TLS `-pooler` connection and independent tenant fixtures. Do not paste database passwords in tickets, chat, logs or Git. Document proof and remove disposable branch.
3. **Production-safe runtime.** Do not set experimental `AUTH_EXPERIMENT_ENABLED`, `WORKSPACE_MAIL_PROOF_TEST_ENABLED`, `WORKSPACE_NEXT_ROUTE_TEST_ENABLED` to enable deployed access. Replace disposable-only auth and DB guards with an independently reviewed architecture using production secrets, strict host allowlists, nonprivileged DB and reliable migrations. Add rate limiting at a **trusted edge** (the local HMAC quota is not a substitute).
4. **Real worker and invite proof.** Verify sender domain and separate workspace Resend permissions. Require rate controls, audit and retries. Exercise one explicitly approved invitation to the founder's Gmail, without forwarding the code to logs or third parties. Review mailbox ownership, registration, TOTP, MFA recovery and true staff membership approval.
5. **Independent browser UAT.** Invite → proof email → password registration → TOTP setup → fresh MFA sign-in → exactly one approved project → revoked grant denied → logout invalidates session. Check wrong tenant/recipient, no analytics, page titles and accessibility. Verify all under a protected staging hostname before touching live deployment.
6. **Rollback and monitoring.** Prepared emergency off switch, server-side session revocation, mail queue pause, read-only DB backup/restore rehearsal, error-rate alerts, staff on-call and incident handling. A failed gate leaves production routes closed.
7. **Go/no-go approval.** Review green exact-commit CI, tests under trusted hosted resources, production env audit, dependencies, and recovery. Only then explicitly authorize squash-merge and automatic deployment; no manual deployment.

## Deterministic pilot limits

- Initially one project, one invited recipient, one authorized staff approver; no self-service signup or public browsing.
- Client-facing progress must be actually reviewed/published. Do not depict placeholder invoices, payments or requirements as operational.
- Use manually reconciled payment status until Razorpay merchant policy, webhook signature, idempotency and payout reconciliation are independently verified.
- No paid Neon upgrade, no production-data access, no background use of personal Gmail credentials.

## Evidence reference

- [CI #41171851692](https://github.com/digipants/digipants-next/actions/runs/41171851692): earlier local auth security, root build and headless Chrome (synthetic screenshots).
- [Issue #101](https://github.com/digipants/digipants-next/issues/101): hosted Neon rehearsal and unresolved actual `-pooler` TLS acceptance.
- [Resend idempotency keys](https://resend.com/changelog/idempotency-keys): same-key retries within provider's published 24-hour retention window.
- [Next.js LTS policy](https://nextjs.org/support-policy): Next 15 maintenance security releases, upgrade plan must stay current.
