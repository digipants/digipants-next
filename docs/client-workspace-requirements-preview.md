# Client Workspace — Requirements and Documents synthetic review (#106)

This is an additive UX review slice stacked on the first-glimpse PR #105.
The entry point remains the Netlify PR Deploy Preview at /workspace-preview/.
The page remains restricted to Netlify PR hosts, noindex/nofollow and synthetic.

## New client navigation
- Requirements: fictional shared project brief v02, sample inclusions and exclusions, version summary and open questions. No edit, submission, approval, change order or data transfer.
- Documents: client-published fictional documents with local-only category filter, version and publication label. No private internal file titles, links, downloads, uploads or actual storage. Explain the eventual private document access contract.

## Boundaries
- Existing Overview, Project progress, Proposal and Invoices & payments remain unchanged.
- No Next API, Better Auth, Prisma, Razorpay, server calls, secret, account, storage, real file or internal GitHub publication integration.
- Actual document visibility must derive from owner approval of an exact immutable published revision plus current tenant/project grant checks, not from a UI flag or a filter.
- There is no accepted quotation, legal document, payment state or customer data.
- The root layout still includes public marketing site chrome; a real authenticated workspace will need a dedicated root shell and appropriate consent/privacy behavior.

## Review
Check both screens and the local category filter on desktop/mobile in the PR's Netlify preview. Check the full tests, TypeScript and Next build. The stacked PR must not merge before #105; neither PR should be treated as a real customer onboarding gate.
