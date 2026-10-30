# Client Workspace — Immutable sharing foundation (#108)

**Status: isolated development-only implementation, NOT customer ready.**

## What this implements

- Native Prisma 7 PostgreSQL migration for immutable, tenant/project-scoped revisions for progress summaries and private document metadata.
- A second-person review and publication record with an exact audit-event scope, active delivery-lead grant and different staff author/reviewer.
- Audited append-only retraction markers. No mutation or silent deletion of previously published revisions.
- Forced RLS and **no direct SELECT/INSERT/UPDATE/DELETE rights** on the new tables for the restricted cw_runtime role. This is intentionally closed until real authorization and hosted connection pooling are proved.
- A strict, display-only projection that exposes title, summary, version and publication time but never private object references or internal audit fields.
- PR-only PostgreSQL 17 synthetic integration checks, native migration/ledger/drift checks, repository unit tests, TypeScript and ordinary Next.js build.

## Explicitly not implemented

There is no authentication route, invitation delivery, membership activation, hosted database migration, real client data, private object bucket, malware scanning, signed download URL, file upload, download, public list API, or payment integration. This is **not** sufficient to onboard a client.

Security gates still open: #77/#83 invitations and mailbox proof, #78 staff MFA/recovery, #79/#101 pooled Neon role isolation, then a reviewed API and storage adapter. The API must revalidate a server-owned Better Auth session, persisted current MFA where required, active tenant/project grants, publication/retraction scope and file authorizations for every request. Custom PostgreSQL tenant GUC alone is not identity.

## Safety

No manual deployment, no production configuration or customer data. Existing marketing/contact pages and pending visual PR #107 are untouched. Do not merge this draft until the tests and independent security review have passed.