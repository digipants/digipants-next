# Founder-only Workspace production pilot — activation checkpoint

Date: 2026-11-18 (Asia/Kolkata)  
Reviewed application release: `de772825a1eeb92b9fd1a7331fb9978930d378c6`  
Production site: https://digipants.com/workspace/

## Evidence before opening the founder-only route

- Workspace and Auth databases: six applied Prisma migrations each; official Prisma CLI v7.10.1 reconciled `migrate deploy` twice, `migrate status`, `migrate diff` and checksums with no drift (founder-supplied sanitized Codex execution report).
- Workspace and Auth SQL production security preflights passed.
- [Complete synthetic-clone TLS, signed A/B isolation, session revocation and recovery acceptance](https://github.com/digipants/digipants-next/actions/runs/43592574631) passed against the reviewed release source.
- [Actual restricted production runtime-role pooled TLS smoke](https://github.com/digipants/digipants-next/actions/runs/43745075393) passed.
- Netlify `PRODUCTION_RESEND_API_KEY` restricted to secret + production context + Functions/Runtime scopes only. No development/preview/branch values.
- Production database contains one genuine DigiPants internal tenant/project and one unconsumed, allow-listed founder bootstrap. No production Auth users, sessions or TOTP enrollment before activation.
- Same-project preactivation recovery branch `br-dark-snow-za63k0le` exists; **not an independent backup**.

## Controlled founder-only switches

Set **production context only**:

| Variable | Required during founder enrollment |
| --- | --- |
| `CLIENT_WORKSPACE_ENABLED` | `1` |
| `CLIENT_WORKSPACE_PRODUCTION_ENABLED` | `1` |
| `CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED` | `1` temporarily |
| `CLIENT_WORKSPACE_PRODUCTION_FOUNDER_ENABLED` | `1` temporarily |
| `CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED` | `1` temporarily |
| `CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED` | **`0`** |

General customer invitations, email, public registration, and payments remain disabled. This documentation-only commit triggers a normal Git-connected Netlify production build; it does not change application code or migrations.

## Required browser acceptance (not complete at this checkpoint)

1. Verify `/workspace/` redirects to `/workspace/login/` and `/workspace/founder/enroll/` serves the one-time form, not 404.
2. The account holder performs private founder mailbox verification, sets a strong password and enrolls TOTP. Never print recovery codes.
3. Verify MFA login, authorized internal project read, session logout/revocation and no unauthorized access.
4. Turn **OFF** founder bootstrap, founder-enabled and founder-email-enabled switches immediately after successful one-time setup, and publish through the normal Git-connected deployment path (no manual deploy).
5. Verify fresh founder MFA sign-in still succeeds, general invitations remain disabled, and the main public website remains unaffected.
6. Before onboarding real clients, establish independent protected backup and restore coverage. Same-project recovery branches are not an independent backup.

Rollback if founder-only route/security checks fail: disable `CLIENT_WORKSPACE_ENABLED` and/or `CLIENT_WORKSPACE_PRODUCTION_ENABLED`, keep all customer email off, trigger normal Git-connected redeployment and inspect logs without exposing secrets.

Do **not** claim founder account activation is complete until an actual authorized production browser login and MFA have passed.

## Founder verification delivery correction — 18 Nov 2026

The first real founder email attempt reached `/api/workspace/founder/verification/` (GET 200; POST 202) but produced no `auth_spike.verification`, rate-window or `mail_delivery_outbox` record. The anti-enumeration design intentionally returns an opaque 202 for an ineligible or unprocessable request.

Root cause found by reviewing `experiments/client-workspace-auth/src/mailbox-request-quota.ts`: production `admitLocalMailboxRequest()` requires the production-only 32-byte base64url `PRODUCTION_WORKSPACE_MAIL_RATE_HMAC_KEY`. The secret was absent. A newly generated independent key was configured in Netlify **Production only**, **Functions/Runtime scopes**, secret flag true. Its value must never be committed or logged.

This documentation-only deployment delivers the new server-side environment secret; it does **not** enable general Workspace email, create a founder account, modify database schema, or send verification emails automatically. After deploy, account holder must explicitly retry the one-time founder verification request. Verify a successful `auth_spike.verification` / `mail_delivery_outbox` enqueue and delivery state using aggregate counts only, never reveal recipient/code.

## Founder authentication milestone and permanent bootstrap shutdown — 18 Nov 2026

The production login page displayed **Sign-in verified**, with a real production user present. Read-only Neon verification confirmed: one user, one verified TOTP factor, one active MFA-verified session, one genuine DigiPants internal published project, one `workspace_owner` staff grant, and completed one-time founder bootstrap. This confirms authentication; direct browser project-content acceptance remains a separate check.

After this milestone, the operator set the following Netlify **production-only** values to `0`:

- `CLIENT_WORKSPACE_FOUNDER_BOOTSTRAP_ENABLED`
- `CLIENT_WORKSPACE_PRODUCTION_FOUNDER_ENABLED`
- `CLIENT_WORKSPACE_PRODUCTION_FOUNDER_EMAIL_ENABLED`

`CLIENT_WORKSPACE_ENABLED=1` and `CLIENT_WORKSPACE_PRODUCTION_ENABLED=1` stay on for protected founder sign-in and project access. `CLIENT_WORKSPACE_PRODUCTION_EMAIL_ENABLED=0` keeps general invitations/delivery off. No application code or database migration changed. This docs-only commit triggers a normal Git-connected production build to apply the closed enrollment switches; no manual Netlify deployment.

The production login UI does not yet automatically route to the approved project when no `next` path is supplied. The account holder received a privately authorized exact project URL; verifying its live page is still pending. Do not assert successful browser project rendering until the account holder confirms it. A follow-up can implement a private authenticated \"My Workspace\" redirect, using a server-side grant lookup rather than hardcoding tenant/project IDs into public page code.
