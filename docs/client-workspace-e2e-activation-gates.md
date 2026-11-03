# DigiPants Client Workspace — End-to-end activation contract

**Status: not customer-ready.** This checklist describes acceptance criteria, not permission to change production configuration or invite real clients. "An attractive six-tab preview" and "an isolated CI security proof" do not establish a working production portal. First pilot is invitation-only, least-privileged and manually supervised.

## Pilot: definition of *end-to-end complete*

A real, authorized test client must be able to complete the entire journey on the intended deployment (not a synthetic preview), with representative **test** data, without a SQL console or manual impersonation:

1. Submit an enquiry; a named DigiPants owner reviews/qualifies it; approve an exact tenant/project and recipient.
2. Verified DigiPants staff identity performs a recent MFA step-up and issues a scoped invitation. Resend delivers it to the exact, approved recipient. Delivery failure is reconciled and the token is revoked, never silently left active.
3. The recipient opens the first-party page, completes origin/CSRF-protected recipient mailbox proof, registers/signs in, enables/validates MFA and receives **only** the approved active tenant/project role after explicit staff grant review. Replaying, forwarding, swapping, or expiring an invite fails.
4. Client sees exactly the records authorized for the tenant/project, with working Requirements → proposal revision/approval → documented kickoff; missing approval prevents changes to delivery/payment states.
5. Staff verifies internal GitHub evidence, authors progress, another authorized reviewer publishes the exact revision. Client sees only that immutable approved version with the latest correct status and can accept/reject a milestone explicitly.
6. Upload/download at least one benign private test document through a private bucket, scan/quarantine, restricted short-lived retrieval, allowlisted metadata, audit and tested grant-revocation denial. No raw storage URLs or keys in public responses.
7. Client sees an approved invoice and corresponding **verified** payment status. For first pilot, invoice delivery and external payment may remain manual if the workspace tracks its precise verification state; never display success from the client merely clicking "Paid".
8. Client and operator finish UAT, milestone acceptance, handover, support and closure. All state transitions and recovery attempts have independent audit evidence.
9. Staff revokes membership and tests that sign-in and private-document fetches fail. Restore from backup in an isolated environment; demonstrate alerting, operational rollback and no cross-client data exposure.

**Pilot complete** means one representative transaction succeeds plus all critical negative tests and an operator signoff. **Full A–Z complete** additionally requires scalable multi-client billing, change requests, complex commercial/contract paths, warranty/support lifecycle, resilience and accessibility across devices; see #64. Do not silently conflate these milestones.

## Release gates, required owners and evidence

| Gate | Minimum proof | Current evidence |
| --- | --- | --- |
| Tenant DB & runtime | Native Prisma ledger on isolated host, separate least-privilege runtime credential, actual hosted Neon -pooler query/transaction switching, restore + monitoring | #79 / #101; local-only PgBouncer PR #110 green, hosted runtime not proven |
| Staff access | Approved staff invitation, strong Better Auth session, MFA step-up + second-operator recovery, active exact grants | #78; isolated staff state PR #111 green; recovery not live |
| Private invitation delivery | Verified issuer, durable 32-byte token hashing, exact recipient, independent mailbox proof, CSRF, provider failures, retries/revoke with reconciliation | #77 / #83; isolated PR #112 adds mockable email transport/guard; never sends real mail |
| Client account/API | Real Next.js session route, feature gate, rate limits, verified grant-backed reads and writes, no RLS bypass | PR #111 reader remains experimental, no public route |
| Requirements/proposal/contract | Editable request, explicit review and versioned proposal decision, signed contract or agreed documented pilot substitute | #64 UX preview only, not wired |
| Progress & acceptance | Exact authored revision, independent reviewer, publish/withdraw, milestone acceptance + GitHub provenance | PR #109 schema/test foundation only |
| Private files | Private storage, malware quarantine, signed authorized reads, metadata only, revoke access promptly | PR #109 metadata only; no storage |
| Invoices, verified payments | Human-approved invoice; reconciliation after provider/bank evidence, no optimistic paid status | Synthetic preview only; live Razorpay linkage not approved |
| Pilot ops | Real sign-in/onboarding tests on preview, alerts, logs without secrets, backup/restore, owner-controlled enablement/rollback, accessibility | Not done |

## PR sequence for review

- PR #107: synthetic UX reference (do not treat as backend).
- PR #109: immutable approved revisions + private file metadata.
- PR #110: local *real PgBouncer* transaction and DB runtime checks.
- PR #111: Better Auth session → exact published client project read via least-privilege runtime.
- PR #112: verified staff MFA → recipient-bound email dispatch adapter with fail-closed synthetic delivery.
- Follow-on: hosted pooler acceptance #101, staff MFA lifecycle #78, live invite lifecycle/CSRF #77/#83, feature-gated Next routes, reviewed progress API, private storage, invoicing and browser-level end-to-end pilot.

## Explicit safety constraints

- No customer/production data, real emails, live customer registrations or merchant payments until authorization and independent security review.
- No automatic merges, no manual deploy, no paid upgrade.
- Never treat a caller-controlled custom PostgreSQL GUC, a client-supplied subject/role, a bearer link or a GitHub CI success as proof of client authorization.
- The invitation URL uses a **fragment** so its bearer is not sent as ordinary HTTP path/query; the future client page must clear that fragment immediately and use strict Content-Security-Policy and Referrer-Policy. No third-party scripts on invitation exchange.
- Delivery is **not** transactional with invitation issuance; a failure requires a durable outbound queue and operator-visible reconciliation. Best-effort revoke in the current experimental slice is not sufficient for activation.
