# Client Workspace foundation ADR 0001 — identity, tenant data and persistence

Status: **free-first architecture revision for review**. User approved use of free development resources, and a dedicated Neon Free development project has been created; no live auth or application tables are deployed. Issue #70; parent #64; follows merged security-policy #68. Baseline: `main` at `b69f234c53d103bbe41be13a1d8d2e3913464c1e` (Next.js 15.5.27 App Router, React 18.3.1, TS 5.5.4, Netlify build). No auth SDK, ORM or DB is currently installed; no production workspace route exists. Existing proposal/progress UIs are synthetic, local-only.

## Decisions proposed, not deployed

| Concern | Preferred option | Alternative / reason not first |
| --- | --- | --- |
| Authentication and session lifecycle | **Self-hosted Better Auth** on Next.js Node with server-enforced invitation-only enrollment and the open-source TOTP 2FA/backup-code plugin, pending compatibility testing | Clerk Hobby has no production MFA without upgrading; Neon Managed Better Auth is free but its roadmap does not yet support MFA. Supabase Free includes basic MFA but requires a separate provider/data control plane |
| Tenant & project authorization | **DigiPants-owned PostgreSQL records**; Better Auth proves identity only; `lib/client-workspace/access-policy.ts` receives exclusively server-loaded project grants | Provider organization/user metadata, email domains and browser JWT claims must never grant contracts, projects or finance rights |
| Relational data | **Dedicated Neon Free PostgreSQL dev project**, verified in AWS London, PostgreSQL 17, `digipants_workspace_dev`, capped at 0.25 CU. No tables or customers yet | Development only; UK physical region is not a production data-residency decision. No paid upgrades, backups or production links authorized |
| Data access/migrations | **Prisma ORM 7** is the proposed compatibility-spike target: stable PostgreSQL support, typed schema/client, migrations and transactions on the Node runtime. Pin v7 in a later implementation rather than following `latest` implicitly. | **Drizzle** is a good leaner alternative, especially for Neon serverless-driver queries. For approval+audit transactions prefer a proven transactional driver rather than treating individually issued HTTP queries as one atomic operation |
| Route runtime | **Next.js Node.js route handlers/server-only data layer**, Netlify functions; resource-level checks at every read/write | Middleware alone is not authorization; no edge-runtime requirement. Future API may be deployed separately only if Node/Netlify compatibility fails the spike |
| Client organization model | One DigiPants `tenant` per contracting business; projects have exactly one tenant. Staff grants are explicit per project | Neither Better Auth user accounts nor provider organizations confer workspace role grants |

### Why this is the conservative fit

**Free-first:** Neon Free is the development data host and **self-hosted Better Auth** is the proposed identity/session system, with TOTP 2FA and backup codes. This avoids Clerk's paid production MFA and Neon Managed Better Auth's unsupported MFA plugin. It is an architectural choice pending a local compatibility and security spike, not a deployed login solution.

**Enforce invitation-only on the server:** no open registration endpoint, no auto-created tenant membership, and no account/identity-based grant. Verify a high-entropy single-use invitation against the intended client, expiration, identity and project before provisioning access. Disable OAuth/magic-link/passwordless paths until the same gate is proved. Better Auth's 2FA plugin currently challenges credential-based sign-in by default, not every OAuth or passwordless flow. Staff/finance/contract actions require session-verified MFA assurance; absence or ambiguity means deny. Provide secure recovery and revocation.

**Free-tier limits:** The connected Neon organization is on plan `free`; official October 2026 Free allowances describe 1 GB database storage, 100 compute-unit-hours/month/project, 10 branches, and a six-hour restore window. The new dev project has a 0.25 CU compute cap and no real client data. Do not enable paid compute, overages, storage/functions add-ons or a card-backed subscription. A free tier is for controlled development, not a substitute for verified backups, recovery, incident handling or contractual production requirements. Netlify's site-level runtime and billing plan remain unverified.

PostgreSQL holds tenant association, staff status, per-project access grants, approvals, billing and audit history. Neon pooled URL is for serverless application queries; direct URL is only for migrations/administration. Prisma's current stable v7 minimums are Node.js 20.19 on the 20.x line, 22.12 on 22.x, or 24.0 on 24.x, plus TypeScript 5.4; the repository's TypeScript 5.5.4 meets the version floor. Prisma v7 is ESM-first and its PostgreSQL setup uses a driver adapter (including a Neon adapter); the repository already uses `module: ESNext` and `moduleResolution: Bundler`, but uses `target: ES2020` and does not declare `type: module`, so package generation, build bundling and transaction behavior still need an isolated spike. Prisma ORM 8 is currently a release candidate and requires TypeScript 5.9+, Node.js 22.18+ / 24.11+ / 26+, and `module: preserve` for bundler-built apps; it does **not** fit the current TypeScript configuration unchanged, and its release-candidate feature list currently omits transaction isolation levels. It is not the target for this ADR.

Netlify's current adapter supports Next.js 13.5+, so Next.js 15.5.27 is in its documented range. Current Netlify build documentation lists Node 24 as its default and says the build Node normally determines the Functions runtime, but site settings can override it. This repository has no `.nvmrc`/`.node-version`, and `netlify.toml` only sets `npm run build`; the actual site's build/function Node configuration is not visible here. Verify it meets Prisma v7's Node minimum, then test the chosen Prisma adapter, Neon pooled/direct URLs, migrations and multi-table transactions in a non-production Netlify preview. Never run migrations during a public site build or on deploy previews; never let a preview connect to production data.

## Exact model proposal (schema-only, not a deployed migration)

See [client-workspace-schema-proposal.sql](client-workspace-schema-proposal.sql). Tables:

- `workspace_principals`: internal UUID mapped to a unique Better Auth subject intended to be immutable; active/disabled status and staff/client kind. This DDL does not prevent rebinding `provider_subject`, so a later database role/trigger must enforce immutability before use. Email is a profile attribute, **not** an authorization key.
- `workspace_tenants`: one record per contracting client; internal company/staff are not wildcard tenants.
- `workspace_client_memberships`: user-to-tenant membership for client principals, with explicit active/revoked status.
- `workspace_staff_memberships`: allowlisted DigiPants staff principals. Staff must also receive explicit *per-project* grants.
- `workspace_projects`: tenant ownership intended to be immutable, lifecycle/record revision and composite key constraint. The composite key supports safe references but does not by itself forbid changing an unreferenced project's `tenant_id`; a later database role/trigger must enforce the ownership invariant.
- `workspace_client_project_grants` / `workspace_staff_project_grants`: distinct role universes, referential integrity, explicit project scope, revocation timestamps.
- `workspace_invitation_records`: internal intended tenant/project/role matched to a **server-controlled invitation**. Store only a securely hashed, high-entropy invitation token; never store raw tokens. Creating/signing into a Better Auth account never automatically makes the invitee a member; redemption must verify the identity, intended invite, approval and non-expiration under server authority.
- `workspace_audit_events`: append-only intent, actor, tenant/project, version and idempotency key; audit write and business change must occur in the **same** database transaction. Audit immutability requires restricted DB permissions/triggers in a future implementation (DDL alone is insufficient).

Real proposals, project briefs, immutable published snapshots, documents, invoice ledger, payment allocations, GitHub mappings, webhook-event receipts, change orders and milestone approvals require **separate reviewed future schemas**, not guessed columns in this foundational migration.

### Critical distinction: two mutually exclusive role sets

An authenticated subject is classified as `client` or `staff` in a server-owned principal row; the proposed SQL enforces the kind of each membership. A **client** must have an active tenant membership AND an active client project grant. A **staff member** must be active in the staff roster AND have an active staff grant for the exact project. Both rely on the same existing pure policy evaluator after server-side conversion, but its `authenticated` field is populated **only** from a validated session and its grants exclusively from tenant-scoped SQL. Role separation alone is not sufficient: record status, proposal version/expiry, publication approval, signing authority and payment gates must all be independently checked.

### Trusted request path

```text
Next Node request (same origin)
  -> validate Better Auth session and required authentication assurance
  -> resolve immutable provider subject to active DB principal
  -> load resource by project ID AND tenant ID (never ID alone)
  -> verify principal kind, active tenant membership/staff roster, active project grants
  -> run evaluateWorkspaceAccess() with single trusted snapshots
  -> check object version, publication and operation-specific contract/finance gates
  -> atomic transaction: guarded update + audit + idempotency
  -> return only the authorized, reviewed client projection
```

Default deny, including when auth, DB or grant lookup is unavailable; do not leak whether another tenant's project exists. Never use client-submitted org IDs, roles, amounts, payment redirects, approval metadata, GitHub events, or provider/user metadata as trusted grants. Use composite tenant-project keys in DB queries and FKs. Staff permission is not global; no wildcard, including for admins.

### Operations, access and tenancy

- **Invitations**: staff-authorized issuance; provider invite ID plus app-side intended assignment. Verify identity/expiry/redeemer, prevent replay and allow revocation. Do not expose customer lookup or invite lists through public routes. Carefully handle existing users invited to additional client tenants.
- **Revocation**: server-recheck active principal, membership and grant on every protected operation or prove cache invalidation semantics. This DDL permits an active grant row to reference a revoked membership; authorization must require the parent membership **and** the grant to be active. In the same transaction, revoke the membership and all of its active grants and record actor/time. Re-activation must not revive old grants; require fresh approved grants. Revoke provider sessions when appropriate. Test refresh, multiple tabs, stale sessions and races with in-flight approvals.
- **MFA**: require staff MFA and verified authenticator assurance before privileged staff actions, with recovery policy; if conditional staff MFA isn't supported on selected plan, adopt global MFA or reject the provider. Never assume OAuth sign-in alone guarantees the required assurance.
- **Writes**: production state transitions need optimistic record revision, idempotency key with bounded retention, audit, and transaction isolation/retries for conflicts. Out-of-order jobs/webhooks cannot bypass the transition gate.
- **Read projection**: send only approved client-facing snapshots. Raw GitHub metadata, secret flags, internal costing and draft notes are never serialized. A signed-in client must not see staff data or another client's project.
- **Files**: use separately authorized private object storage later; no unscoped URLs, raw repo attachments or public bucket by default.
- **Payments**: separate ledger/provider integration later. Payment gateway/browser redirect never authorizes `paid` or kickoff.

## Security and environment gates before real customers

1. Verify Node/Next/Netlify+Better Auth/2FA+Prisma compatibility in a throwaway or isolated branch; no production setup during this ADR. Netlify middleware naming for Next 15 is `middleware.ts`, **not** Next 16's `proxy.ts`. Protect at resource level regardless of middleware.
2. Verify regional hosting, client contractual obligations, DPA/processor terms, retention/deletion and data-export requirements before selecting a physical region or provider contract; India/UK/US clients may have different compliance expectations. No legal or tax position is asserted.
3. Confirm production **MFA availability and costs**, invitation restrictions, rate limits, passwordless/OAuth sign-in policy, session expiry, incident response and break-glass recovery.
4. Isolate **Better Auth secret keys/configurations** and Neon DB/roles for development vs production. Netlify Deploy Previews must not inherit production secrets or connect to production data; mask server errors. No secrets in GitHub issues/PRs.
5. Establish least-privilege DB roles, migration approval, branch/backups and **restore drill**; audit events must be append-only with controlled access. Evaluate DB row-level security after demonstrating compatibility with pooled transactional connections; never assume RLS works merely because it is described in a design.
6. Test cross-tenant read/write, revoked role, disabled principal, invalid session, expired invitation, stale approval, provider outage, malformed query and concurrent decisions; negative tests must run against the actual server/data layer, not just the pure policy function.
7. Preserve DigiPants public contact/Resend/consent-safe analytics, existing case studies and proposal/progress prototypes until real access gates are independently reviewed.

## Release sequence and next issue

- **This PR**: ADR + proposed SQL only. No package, runtime, route, migrations, CI changes, provider accounts, credentials or deployment.
- **Next implementation slice**: review/validate a minimum **tenant-aware persistence schema with migrations and isolated test DB**, including grant lookups; no client-facing routes, auth setup or production data. OR choose an isolated Better Auth + TOTP compatibility experiment first if provider/hosting compatibility is uncertain. Do not combine both.
- Then invite-only auth and staff assurance; server-side DB lookup and permission gates; typed API/transactional audit; client pilot only after cross-tenant/authorization/recovery validation. GitHub and payments come after verified base.

## Primary references checked 29 October 2026

- [Better Auth installation](https://better-auth.com/docs/installation), [Next.js](https://better-auth.com/docs/integrations/next), [Prisma](https://better-auth.com/docs/adapters/prisma), [2FA](https://better-auth.com/docs/plugins/2fa), and [signup gates](https://better-auth.com/docs/reference/errors/signup_disabled)
- [Neon Free allowances (2 Oct 2026)](https://neon.com/blog/neon-free-plan-1-gb-per-project) and [Neon Managed Better Auth roadmap: MFA pending](https://neon.com/docs/auth/roadmap)
- Alternatives: [Clerk pricing](https://clerk.com/pricing) (MFA not in Hobby), [Supabase Free](https://supabase.com/pricing) (basic MFA included)
- [Neon serverless pooling and direct connections](https://neon.com/docs/connect/connection-pooling)
- [Current Neon usage-based pricing](https://neon.com/pricing)
- [Prisma ORM 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements), [Prisma ORM release status](https://www.prisma.io/docs/orm/release-status), and [PostgreSQL/Neon connector adapters](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
- [Netlify Next.js adapter support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [build Node version configuration](https://docs.netlify.com/build/configure-builds/available-software-at-build-time/), and [Functions Node runtime behavior](https://docs.netlify.com/build/functions/configuration/)
- [Drizzle-Neon transaction-driver distinction](https://orm.drizzle.team/docs/connect-neon)
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
