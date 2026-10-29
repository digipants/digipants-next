# DigiPants Client Workspace — progress UX contract (#66)

Baseline: issues #62/#63/#64 and owner direction; #63 merged through #65 into `main` at `690c69c60aa7a0d5dababf352a71f796bbb16fb8` before this work. Issue #66's `Closes #65` text is a reference typo; this slice closes #66 as requested.

## Scope and preview

Fixture-only progress UX, not a live portal or secure client workflow. All identities use `example.test`. Dates, publication records, acceptance records and milestones are fictional; no delivery or commercial promise. Proposal/commercial behavior, marketing, contact, analytics and Capability Core remain unchanged.

From repository root: `node prototypes/client-progress/preview.mjs`, then open `http://127.0.0.1:4320`. Separate loopback server, no Next/public route, no production imports, no navigation from the website. Server refuses production NODE_ENV, validates Host and serves only HTML, compiled client JS and CSS. Query selection changes the local HTML document, not an API call. No persistence, auth, external calls, integration, uploads, downloads, AI, payments or dependencies added. Never proxy/publish the preview server.

Strict TypeScript is checked separately because the production tsconfig intentionally excludes prototypes:

```sh
npx tsc -p prototypes/client-progress/tsconfig.json
node --test tests/client-progress.test.mjs
```

The preview uses the repository's existing TypeScript compiler to transpile in memory. It writes no compiled output. Optional browser checks use environment-supplied Playwright and `/usr/bin/chromium`: start the preview, then run `node prototypes/client-progress/browser-check.cjs` from the repository root.

## Client experience

DigiPants zinc/emerald branding, prominent identity/status and next step with named owner. Desktop uses milestone/content and context/review columns; mobile stacks them. Milestone cards contain status text, owner, original approved illustrative target, dependency titles and explanatory notes. Blocked/paused states explain cause and next action; delay never silently changes the approved baseline. No percentages, automatic completion or automatic date promises.

Published update timeline shows separately labeled publication and verification timestamps (UTC). Context distinguishes last published update from last engineering sync. Stale/disconnected sources retain the approved record and explain that source freshness proves neither stopped work nor completion. No live indicator. Empty activity says no published updates, rather than no work.

Deliverables show only approved mock artifacts, reviewer notes and review/change-request/accepted states. Artifact buttons open a local, read-only mock journey dialog; they cannot navigate to arbitrary URLs or submit acceptance. Billing is a read-only future-module placeholder without amounts, invoices or actions. Clients never need GitHub navigation.

Scenarios: active, internal review, QA, awaiting client, changes requested, blocked/delayed, paused, accepted milestone, no activity, unpublished work, mismatched evidence, disconnected source, stale source, loading, error/retry and access-denied illustration. Fixed example record dates are in January/February 2030; freshness is an explicit scenario, not the wall clock.

## Internal-to-published boundary

`fixtures.ts` and `model.ts` run only in the loopback Node process. The client receives **one selected projection** embedded in the HTML plus a UI module containing no internal fixtures. No raw repository, issue, pull request, commit, logs, notes, evidence mapping or credentials are served. Source-file requests return 404. Denied/loading/error responses carry only `{kind}`; no project fields are embedded.

1. Synthetic engineering evidence maps to a project and milestone; unmatched/unmapped evidence stays internal.
2. Overview, milestone, update and deliverable records each bind approval to an exact-content revision token. Tokens are canonical, domain-separated serializations of allowlisted content, mapping context and review identity/timestamps; they are not cryptographic signatures or live authorization. The fixture-author-only `approveFixtureRevisions` step runs explicitly after constructing a scenario. Projection never approves or refreshes a token. Missing/invalid/out-of-order approval metadata or a mismatched token prevents visibility. Verified-only or unpublished work is excluded.
3. Projection constructs allowlisted fields explicitly, without spreading internal records. An unapproved overview edit (including identity, status, next action or source timestamp/state) yields the existing neutral error view without project data. Edited milestones, updates or deliverables are excluded until their exact new revision is explicitly approved; affected child records are also hidden if their milestone is no longer published. Content, dates, dependencies, separate acceptance evidence and publication timestamps cannot reuse old approvals. Unpublished milestones/deliverables and unknown artifact destinations are excluded. Hidden dependencies become a neutral owner-confirmation requirement rather than leaking IDs or falsely implying no dependency.
4. Browser renders only client-safe text, using escaping; embedded JSON escapes script delimiters. These safeguards prevent structural/raw-field leaks, **not** accidental sensitive language in an authorized author's summary. Content review remains mandatory; there is no automated redaction/compliance claim.
5. Engineering merge/CI fields never drive milestone/project state, acceptance, invoices or money. Accepted milestone status needs a separate valid client-acceptance record. No acceptance action is implemented here. Reconnect never verifies, publishes or advances anything.

The fixture approval helper preserves existing actor/date metadata, including missing values, and cannot manufacture publication authority. Rebinding an edited revision is an explicit fixture-author simulation of renewed approval, not a production workflow. A real backend must record new authorized approval decisions and protect approval records from tampering. The fixture projection models future server responsibilities; it does not implement authentication or authorization. Internal review identifiers are fictional evidence metadata, not proof of a real privileged approval. A future backend must enforce per-object tenant roles, immutable publication versions, atomic audit/idempotency/concurrency, privacy retention and secure documents before real clients.

## Accessibility / recovery

Semantic main, headings, ordered milestone/feed lists, definition lists and time elements; visible labels and status text independent of color. Skip link and focus-visible rings, native controls and minimum button heights. Artifact dialog has an accessible title, initial close-button focus, Tab/Shift+Tab containment, Escape dismissal and native focus restoration; close announces that no decision occurred in a polite status region. Error illustration uses an alert and retry link. Loading marks its region busy; denied view contains only neutral guidance. Scenario navigation starts at the top of a new document. Responsive checks target 320/375/768/1440px in light/dark. WCAG 2.2 AA is a target, not certification; real screen-reader/cross-browser audits remain.

## Acceptance map

| Requirement | Evidence |
| --- | --- |
| Private/unpublished data absent from clients | Projection allowlist/missing-review/mismatch tests; browser HTML, JSON and script checks |
| Explicit review/publication | Missing verifier/date/approver/publication and chronology tests; exact-revision mismatch and renewed-approval tests |
| Engineering events cannot accept/complete | Merge-unverified and passed/failed CI tests; separate acceptance-record test |
| All milestone states and negative paths | Scenario/state tests, empty/delayed/stale/reconnect/denial checks |
| Baselines/dependencies stay honest | Approved target retained; hidden dependency uses owner-confirmation placeholder |
| Approved artifacts only | Runtime enum allowlist test; local mock dialog without arbitrary destinations |
| Responsive and accessible interaction | Browser overflow checks for all scenarios at four widths, theme screenshots, keyboard/modal/labels/status checks |
| Production isolation | Separate server production refusal, build manifests without route, production HTTP 404 checks |

See [validation and screenshots](client-progress-evidence/README.md) for results and limitations.
