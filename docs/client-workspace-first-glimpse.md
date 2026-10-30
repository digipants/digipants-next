# Client Workspace — browser first glimpse (Issue #104)

**Purpose:** give the DigiPants founder a real, responsive, clickable visual
sample on Netlify's **PR Deploy Preview** before backend auth, funding,
invoicing or portal activation is complete.

## How to view

Once GitHub/Netlify deploy preview has succeeded on the PR, open its unique
`deploy-preview-N--<site>.netlify.app/workspace-preview/` URL provided by the
Netlify check. The PR is deliberately left open and unmerged until the owner
reviews the UX. This page is not added to site navigation or sitemap, and it
carries `noindex,nofollow` metadata. No manual Netlify deployment.

The sample has four interactive views: Overview, Project progress,
Proposal and Invoices & payments. The scenario picker illustrates In progress,
Awaiting review and Schedule under review. Desktop and mobile use responsive
navigation and stacked cards. Focus-visible states and semantic headings,
navigation buttons and the expandable proposal decision explanation are
provided.

## Safety and scope

- All example entities, monetary amounts, activity dates and roles are
  fictional. A banner on every tab explicitly states this.
- The billing tab is **read-only** with no payments, payment link or invoice
  creation; its `Paid` tag is a fake example status, not a transaction.
- Proposal controls are explanation-only; they cannot accept or decline
  a real proposal.
- The project root layout still includes the existing marketing header/footer and\n  consent UI. This is a known preview-only UX limitation; a future real\n  authenticated workspace needs a dedicated shell and privacy review.\n- No workspace-specific input of personal information, authentication, database connector,
  provider API calls, files, uploads, analytics tags or secrets is implemented; the parent marketing layout may\n  still load its existing consent-gated analytics components.
- The original `prototypes/client-workspace/` and
  `prototypes/client-progress/` remain untouched and localhost-only.
- Root project navigation, contact and production pages remain unchanged.
  This is a separate new `app/workspace-preview/` route on a review PR,
  not the released customer portal.
- Preview URLs are generally accessible to anyone with the link; do not
  mistake demo noindex metadata for access control. The example contains
  no sensitive information.

## Acceptance before any production integration

The owner should inspect the Netlify preview on a desktop and phone, review
the information hierarchy, status visibility, proposal transparency,
milestone wording, timeline, invoice design and navigation. Collect feedback
in the PR. Do not merge this demo route as an unauthenticated live portal
without a separate explicit owner decision about retaining a public sample
or returning 404 in production. The server route now explicitly\nreturns Next.js 404 for every host other than Netlify PR preview URLs; this\ncheck is an additional demo visibility guard, not an identity or data security\nboundary. The preview remains synthetic-only and publicly accessible by link.

The actual workspace will need authenticated tenant-scoped session,
approved sharing and revision policy (#67), authorization and
pooler/DB acceptance (#79/#101), real staff MFA (#78), invitation and
recipient proof (#77/#83), finance approvals, corporate-only Razorpay
Test Mode integration (#94) and an audited reconciliation flow.
Those are unrelated to visual preview safety and must not block UI review.
