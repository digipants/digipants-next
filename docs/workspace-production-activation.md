# DigiPants Client Workspace — production activation runbook (blocked until proven)

**Status:** NO-GO. This is an operator sequence and evidence contract, not permission to turn on live routes.

**Repository:** `digipants/digipants-next`, reviewed PR chain ending with draft PR #121. Do not execute from `main` or a stale commit. Record the immutable reviewed head and green CI results.

**Infrastructure:** isolated Neon project `flat-glitter-05386028`, default production branch `br-floral-shadow-zapa2jbz` (PostgreSQL 17, EU West 2), databases `digipants_workspace_prod` and `digipants_auth_prod`. Live site `digipants.com` is Netlify site `837d4464-7eb6-4a1f-b4ef-3a44a2829d79`. Staging is a distinct site, project and database. No shared passwords, synthetic data, founder MFA material, or outbox keys.

## 1. Hard constraints

- Production `CLIENT_WORKSPACE_ENABLED=0`, `CLIENT_WORKSPACE_PRODUCTION_ENABLED=0`, `CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED=0`, `CLIENT_WORKSPACE_PRODUCTION_FOUNDER_ENABLED=0`, and `CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED=0` stay OFF until go/no-go. Production Netlify environment changes take effect on the next deployment; setting them is **not** proof the deployed environment sees them.
- No staging data, synthetic tenants/projects, or credentials in production. No automatic customer invitations, public signup, payments, or open admin role. Never paste passwords, complete PostgreSQL URLs, mailbox proofs, recovery codes, or Resend keys into Git, chat, Actions logs or issue text.
- Neon Free currently rejects adding protection to the production branch because of the protected-branch limit. Do not change a subscription or unprotect any other branch without separate approval. A reviewed substitute restore/backup and deletion-control plan is required before live enablement.
- Founder bootstrap is a one-time, explicitly scoped, audited action. It must target a **real DigiPants internal tenant/project**, never Synthetic Project A. Keep founder registration CLOSED before/after its use.
- Only merge after independent code review, green exact-head CI, migration/privilege/TLS proof, backup/restore rehearsal and browser UAT. No manual Netlify deploy.

## 2. Clean versioned migration — privileged installer, NOT application credentials

Perform these steps using a trusted terminal/CI runner with masked secret inputs, no shell tracing, a direct Neon hostname (not pooled), an exact reviewed Git commit, a clean `npm ci`, and least-privileged ephemeral migration authority. Never store the migration owner's URL as an application runtime secret.

**Workspace database** — `prisma.config.ts` reads `DIRECT_URL`. Run, with this variable securely injected as the direct installer URL for **digipants_workspace_prod**:

```sh
npm ci
npm run db:migrate:deploy
npm run db:migrate:deploy
npm run db:migrate:status
```

**Authentication database** — `experiments/client-workspace-auth/prisma.config.ts` reads `AUTH_DATABASE_URL`. For this migration process only, inject the *direct installer URL* for **digipants_auth_prod**, not the production runtime URL:

```sh
npm --prefix experiments/client-workspace-auth ci
npm --prefix experiments/client-workspace-auth run db:migrate:deploy
npm --prefix experiments/client-workspace-auth run db:migrate:deploy
npm --prefix experiments/client-workspace-auth run db:migrate:status
```

The new versioned migrations include `prisma/migrations/20261112190000_founder_bootstrap_scope_v2` and `prisma/migrations/20261112210000_workspace_signed_authorization_context`. Ensure both are included in the real Prisma ledger, that the migration count and checksums match the exact source tree, and that each database's schema drift check passes. A manual SQL replay without the Prisma ledger is **not** sufficient.

Run the following **from repo root with a trusted direct Workspace installer connection**. The first two files must be atomic together, because temporary owner and audit-writer memberships are granted then revoked:

```sh
psql "$DIRECT_URL" -X -v ON_ERROR_STOP=1 -1 \
  -f experiments/client-workspace-db-security/sql/roles.sql \
  -f experiments/client-workspace-db-security/sql/hardening.sql

psql "$DIRECT_URL" -X -v ON_ERROR_STOP=1 \
  -f scripts/workspace/production-rls-hardening.sql
```

Next apply Better Auth's narrow runtime grants with the **direct authentication installer** URL, not the app login:

```sh
psql "$AUTH_INSTALLER_DIRECT_URL" -X -v ON_ERROR_STOP=1 -1 \
  -f experiments/client-workspace-auth/sql/runtime-privileges.sql
```

For both databases run their versioned read-only preflights and reject **any** false flag:

- `scripts/workspace/production-security-preflight.sql`
- `scripts/workspace/production-auth-preflight.sql`

Do not claim acceptance from role metadata alone: verify a real non-admin SQL login, transaction-local RLS, privilege denials and pooled TLS separately.
The `experiments/client-workspace-auth/scripts/neon-pooler-acceptance.mjs` runner also requires the matching disposable 32-byte `WORKSPACE_RLS_CONTEXT_KEY` alongside two synthetic tenant IDs and the restricted pooled URL; do not use production key material for this test. For a production-shaped clone, set `WORKSPACE_POOLER_TEST_DATABASE=digipants_workspace_prod`, `WORKSPACE_POOLER_TEST_BRANCH_ID` and `WORKSPACE_POOLER_LIVE_BRANCH_ID`; the runner rejects the known live production endpoint and requires distinct Neon branch IDs.

## 3. Dedicated production credentials, without exposure

Set separate random passwords for `cw_workspace_prod_app` and `cw_auth_prod_app` in a trusted secure `psql` session (for example interactive `\password ROLE`), with distinct unique values securely stored by the operator. **Never** put either in source-controlled SQL or use the Neon project owner as an app login.

Construct production-only Netlify runtime secrets with the exact actual Neon `-pooler` host, the intended database and matching restricted role, and `sslmode=verify-full`. The runtime URL validator rejects owner/staging roles and DB names. Configure **production-context and runtime/functions scope only**, marked secret:

- `PRODUCTION_WORKSPACE_DATABASE_URL`: `cw_workspace_prod_app` in `digipants_workspace_prod`
- `PRODUCTION_AUTH_DATABASE_URL`: `cw_auth_prod_app` in `digipants_auth_prod`
- `PRODUCTION_BETTER_AUTH_SECRET`: new random 256-bit+ secret, never reused from staging
- `PRODUCTION_WORKSPACE_RLS_CONTEXT_KEY`: independent random 32-byte base64url key used to sign tenant/project/actor/action scope; never reuse the staging or local test key
- `PRODUCTION_AUTH_BASE_URL`: `https://digipants.com/api/auth`
- `PRODUCTION_WORKSPACE_MAIL_OUTBOX_KEY`: independently generated AES-256-GCM outbox key
- `PRODUCTION_RESEND_API_KEY` and `PRODUCTION_WORKSPACE_EMAIL_FROM`: dedicated permitted sender/key for `digipants.com`, not the public contact-form key

Confirm all public/preview/branch/development contexts cannot read these secrets. Rotate on suspected exposure. Do not enable live email until the one-recipient founder verification acceptance is complete.

After applying the versioned Workspace migration and atomic role hardening, provision exactly one row in `workspace_context_signing_keys` through a trusted schema-owner session. Its 32-byte `signing_key` must match the decoded `PRODUCTION_WORKSPACE_RLS_CONTEXT_KEY`; enter the same generated value directly into the protected Netlify production secret field. Do not put the value in SQL files, shell history, CI logs, GitHub, or this runbook. The read-only preflight verifies only row count/length and restricted visibility; it does not prove the application key matches, so a real restricted-login app transaction must also verify signed scope and forged-GUC denial.

## 4. Real founder provisioning (not synthetic)

Using the trusted **Workspace schema-owner operator** in a transaction, create a genuine DigiPants *internal* tenant and private internal project. Approve its published state; do not seed fictional customer milestones or progress. Bind its generated `tenant_id` and `project_id`, set `staff_role='workspace_owner'`, and securely set only the SHA-256 of the normalized intended founder email in the singleton `workspace_founder_bootstrap_control`. Do not hard-code an email address into Git or browser scripts.

Before any founder signup, confirm its target is non-null, points to that exact active internal tenant and published project, `completed_at IS NULL`, and is not Synthetic Project A. Keep the explicit production bootstrap/email gates OFF until the dedicated sender and restrictions are proven.

Under controlled founder-only deployment, enable only the minimum needed: normal workspace routes, production founder bootstrap and founder-only mailbox proof; keep general invitations/mail and payments disabled. Verify real mailbox ownership, password setup, TOTP enrollment, secure session cookie, fresh MFA sign-in and exact owner grant, then **permanently disable founder enrollment**. Verify recovery through a separately approved staff process.

## 5. Actual pooled TLS, application UAT and monitoring

On a fresh **disposable, synthetic-only** production-project clone (not the real production branch), run only the approved migrations, then `experiments/client-workspace-db-security/sql/seed.sql`, the reviewed role/hardening scripts, and the production RLS hardening. Do not run `verify.sql` before the pooled acceptance: its committed workflow fixtures intentionally change the expected seed counts. Confirm the pooled hostname belongs to this child branch in Neon and record both branch IDs before running `experiments/client-workspace-auth/scripts/neon-pooler-acceptance.mjs` with a restricted login whose `session_user=current_user` equals the app role. For production-shaped acceptance, set `WORKSPACE_POOLER_TEST_DATABASE=digipants_workspace_prod`, `WORKSPACE_POOLER_TEST_BRANCH_ID=<child-branch-id>`, and `WORKSPACE_POOLER_LIVE_BRANCH_ID=br-floral-shadow-zapa2jbz`. The runner rejects the known live production endpoint and requires distinct branch IDs. It verifies Node `TLSSocket.authorized=true`, certificate hostname, `sslmode=verify-full`, owner/runtime privilege denials, cleared-scope emptiness, and isolation of tenant/project data plus all seven sensitive identity, membership, grant and enrollment tables across pooled transactions. Static URL validation or the Neon SQL connector is insufficient.

Run protected browser UAT with a real founder login and separately invited test client: rightful scope visible, foreign tenant/project denied, logout and session revocation enforced, MFA recovery tested, no client-content analytics, no exposed mail proofs, no open registration. Keep client-facing progress and documents approval-gated. Confirm sending quotas, encrypted outbox delivery/ack/retry, rate limit and fail-closed provider outage.

Rehearse Neon backup/restore and database read-only recovery, session revocation, function/email disable, error/latency monitoring, owner-on-call response and rollback. Validate the public DigiPants contact form, existing marketing consent flow and SEO remain unchanged.

## 6. Release decision and rollback

Only after all preceding evidence is green **on the exact reviewed release SHA**: approve the consolidated PR chain, squash-merge in correct order, allow Netlify's normal automatic deploy, verify live routes remain OFF, review production env/runtime diagnostics, and turn on the smallest approved pilot gate. Keep payments and non-pilot invitations disabled.

If any gate fails, restore `CLIENT_WORKSPACE_ENABLED=0` or `CLIENT_WORKSPACE_PRODUCTION_ENABLED=0`, `CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED=0`, `CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED=0`, revoke affected sessions and pause outbox deliveries. Roll back automatically deployed code using a reviewed Git rollback followed by Netlify normal deployment; do not expose staging credentials or synthetic records as an emergency bypass.

**Tracking:** #117 (bundle), #120 (sensitive-table RLS release blocker), #121 (RLS/founder changes + preflights), #101 (real pooled-TLS).


## Hosted production execution evidence — 14 November 2026

- **Production project/branch:** `flat-glitter-05386028` / `br-floral-shadow-zapa2jbz`. These immutable IDs, rather than the mutable branch name, are authoritative.
- **Schema state:** six versioned Workspace SQL migrations and six Better Auth migrations from reviewed head `9370f1c79155ea6407f9d2b7cacd2e2f329209b9` executed in database-scoped transactions. A Prisma-compatible `_prisma_migrations` ledger was populated using SHA-256 of each exact repository migration file. **These steps used the connected Neon SQL API, not `prisma migrate deploy`; a separate official Prisma CLI reconciliation and schema drift check remain required before final activation.** Do not falsely label this as a CLI run.
- **Hardening:** reviewed Workspace owner/role scripts, FORCE RLS and signed-context hardening applied. Auth runtime grants applied. Both read-only production database preflights returned all flags true. Restricted actual role logins on their respective databases succeeded through the Neon connector, while unscoped Workspace reads returned zero. The connector **does not** establish independent client-to-pooler TLS.
- **Production secrets:** matching restricted Workspace/Auth pooled connection URLs, a unique Better Auth secret, a mail-outbox encryption key, and the database-matched signed RLS context key are set in Netlify's **production-only** scope. Production activation, founder and general email switches remain `0`. A separately provisioned production Resend API key is **not configured**; do not enable founder or general mail until available.
- **Founder scope:** one real internal DigiPants tenant and internal project are configured for a one-time, approved founder mailbox hash with `workspace_owner` scope. No customer tenant or synthetic fixture data was imported into the production branch. Real mailbox proof, password, TOTP and independent browser authentication are pending.
- **Rehearsal:** synthetic two-tenant signed-RLS tests passed under a genuine `session_user=cw_workspace_prod_app` login via the Neon SQL connector. Forged GUC/token denied all rows; signed Tenant A and B each saw exactly one own tenant/project and zero foreign projects. The temporary synthetic branch was deleted.

### Neon snapshot restore hazard — verified

The first snapshot of the empty production branch (`snap-round-shape-zaj2mp2k`) was restored into a **new** branch for recovery rehearsal. Despite specifying no existing target branch, the restore operation **promoted the restored branch to default and moved/replaced the compute hostname**, renaming the original production branch. This was detected and corrected immediately:

1. The original production branch ID `br-floral-shadow-zapa2jbz` was explicitly made default again and renamed `production`.
2. Database migration counts, signing key, and real internal target were verified on that original branch.
3. The temporary restored branch was deleted; only the original production branch remains active.
4. The replacement production compute `ep-steep-resonance-zaen4209` was configured for transaction pooling. Both production Netlify pooled URLs were updated to its matching hostname without revealing credentials, and both restricted runtime logins were retested successfully.

**Critical recovery rule:** Never assume a Neon snapshot restore is a harmless branch creation. Before and immediately after any restore, check the default branch ID, compute binding, public pooler hostname, database contents and Netlify runtime URLs. Avoid restore rehearsals in the active production project while customer data is live unless the restore operation and its default-branch behavior are independently documented and controlled.

The Neon Free project currently permits only one snapshot and has no remaining protected-branch allowance. Its existing snapshot is from the **empty** preactivation schema, not a backup of the current production schema or future customer data. Obtain an approved, verified post-schema/data recovery strategy before real client onboarding.

### Still required for GO

A live independent TLS-verified pooled login/tenant test on an isolated child, official Prisma migration-ledger reconciliation, tested post-schema/data backup recovery, production mail sender/API key, real founder mailbox/password/TOTP onboarding, protected browser UAT and signed-context/revocation-race security review. **A passing catalog preflight alone does not authorize enabling the production site.**
