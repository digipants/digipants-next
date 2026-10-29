# Client Workspace proposal prototype contract

Implements #63 using #62 and owner design as baseline. **UI simulation with no secure live decisions.** Synthetic `example.test` identities only; fixed scenario clock 15 January 2030. All money/time values are fictional, not commercial commitments. No live portal, authentication, persistence, APIs, AI, analytics, uploads or integrations.

## Preview boundary and screen hierarchy

Run `node prototypes/client-workspace/preview.mjs`, then open `http://127.0.0.1:4317`. No install, build or dependency change. Restart/reset discards decisions. Server binds loopback only, validates Host, serves an exact file allowlist with no-store and restrictive CSP, rejects production NODE_ENV. These are preview boundaries, not client security. Never proxy/publish this server. Files are outside Next app/public and are not imported by production code. Next production must return 404 for prototype paths; build manifests must contain no prototype route.

Screen order: simulation notice → identity header → labeled scenario controls → project status and next action with owner/current version → proposal scope, exclusions, assumptions/responsibilities and timeline → synthetic audit history → illustrative milestone totals/conditions/expiry → decision actions. Desktop uses scope/summary columns; below 768px these stack. Light/dark zinc/emerald palettes; no external assets/fonts. Customer-visible fields are reviewed scope, approved terms/version, shared owner identity, milestone totals and shared decision events. Staff costs, margins, risk multipliers, draft estimates and model confidence are private and absent from fixtures.

## Interaction contract

- Current issued proposal: three actions open a native modal with version-specific title, description, Cancel and Confirm simulation. Initial focus on Cancel; Tab remains in modal, Escape cancels and restores trigger focus.
- Changes require nonblank text; associated error, aria-invalid and focus on textarea. User input is appended as text, never HTML. Limit 1,000 characters. Accept/decline need explicit confirmation but no mandatory reason.
- While pending, all decision actions disable. Pure reducer ignores duplicate begin/completion. Completion adds one example audit entry and focuses main; polite success and assertive error regions provide text feedback.
- Accepted leads only to **Awaiting kickoff checks**. Contract/authorized signatory/payment condition and authorized internal activation are separate future gates. No Active transition exists.
- Expired/superseded proposals retain readable details but disable every decision with a textual explanation. Stale-version injection during pending rechecks version and refuses completion. Expiry is checked at both begin and completion against an injected clock.
- Fail-next injection records nothing and permits retry through the same confirmation. Reset/scenario selection invalidates pending timers. Loading, empty, invalid and access-denied are explicit illustrations with guidance; they claim neither real fetching nor access enforcement.
- Keyboard: skip link, semantic headings/labels, visible focus, native controls/dialog, logical DOM order and focus recovery. Buttons have 44px minimum height; states never rely on color. Target WCAG 2.2 AA; no compliance certification is claimed.

## Conceptual versioned contracts (documentation only)

Notation: `ID`, `Text`, `Instant` are strings; `Money` = `{currency: ISO4217, minorUnits: integer}`. Every object carries `{id: ID, tenantId: ID, projectId: ID, schemaVersion: integer, revision: integer}`. Proposal revisions are immutable once issued. This is not an API or database schema.

| Contract | Minimal typed fields |
| --- | --- |
| ProjectBrief | goals: Text[]; users: Text[]; deliverables: {description: Text, priority: must\|nice}[]; integrations: Text[]; references: Text[]; preferredTimeframe?: Text; budget?: Money; contractingEntity: {name: Text, declaredRegion: UK\|US\|India\|other\|unknown, verifiedBy?: ID}; preferredCurrency?: ISO4217; contacts: {identity: ID, role: Text}[]; unknowns: Text[] |
| AssessmentDraft | briefRevision: integer; dimensions: {name: Text, level: bounded\|involved\|uncertain\|unknown, evidence: Text[], owner: ID}[]; questions: Text[]; disposition: needs_discovery\|ready_for_estimation; assumptions: Text[] |
| EstimateDraft | assessmentRevision: integer; tasks: {id: ID, role: Text, effortRange: {min: number, max: number, unit: person_days}, predecessors: ID[]}[]; availableCapacity: {role: Text, daysPerWeek: number, source: Text}[]; externalWaits: Text[]; contingencyRationale: Text; elapsedRange?: Text; confidenceBasis: Text; blockers: Text[]; privateCostFloor?: Money; privateMarginPolicy?: ID; approvalIds: ID[] |
| ProposalVersion | estimateRevision: integer; version: integer; state: draft\|approved_for_release\|issued\|accepted\|changes_requested\|declined\|expired\|superseded; included: Text[]; excluded: Text[]; assumptions: Text[]; responsibilities: Text[]; milestones: {id: ID, deliverable: Text, amount: Money, timelineWindow: Text, dependencies: ID[]}[]; total: Money; taxTreatment: Text; paymentConditions: Text; validUntil: Instant; changeRules: Text; approvalIds: ID[] |
| ApprovalRecord | objectId: ID; objectVersion: integer; actorId: ID; authority: Text; decision: Text; at: Instant; reason?: Text; evidence: Text[]; idempotencyKey: ID |
| MilestoneUpdate | milestoneId: ID; proposalVersion: integer; state: planned\|in_progress\|internal_verification\|awaiting_client_acceptance\|accepted; author: ID; note: Text; evidence: Text[]; verifiedBy?: ID; publishedAt?: Instant; acceptanceRecordId?: ID |

## Transition/authority table

| From | To | Required authority/gate |
| --- | --- | --- |
| draft | approved_for_release | Delivery lead approves scope/capacity/timeline; commercial approver approves price/terms, exact revision |
| approved_for_release | issued | Authorized owner deliberately releases immutable version |
| issued | accepted / changes_requested / declined | Designated client approver, current unexpired version, explicit confirmation |
| issued | expired | Validity deadline reached; no client decision permitted |
| issued | superseded | Authorized replacement issued; retain original history |
| changes_requested | new draft | Staff revise into new version and repeat approvals |
| accepted | Awaiting kickoff checks | Automatic display consequence only, never project activation |
| Awaiting kickoff checks | future activation | Owner verifies contract, signatory, applicable payment condition and delivery readiness; outside prototype |

Accepted contractual history cannot be overwritten by replacement proposals. Editing a draft invalidates affected approvals. Concurrent expiry/decision ordering must become atomic in the future backend.

## Future permission matrix and denial cases

All future actions require **server-side tenant membership AND per-object role/version checks**. UI guards are insufficient. Default deny, including guessed IDs, shared links, downloads and revoked membership.

| Role | Allowed | Explicit denial |
| --- | --- | --- |
| Client viewer | Read published assigned-project records | Brief edits, decisions, private estimates |
| Client contributor | Viewer + brief edits/questions/change suggestions | Binding proposal decisions |
| Client approver | Contributor + proposal decisions and deliverable acceptance within delegation | Contract signature without signatory authority, activation |
| Client signatory | Sign approved contract within authority | Price editing, payment verification, implicit proposal authority |
| Delivery lead | Assigned scope/effort/timeline approval, milestone verification | Commercial approval without separate role |
| Commercial approver | Price/terms approval, authorized finance verification | Delivery completion or client acceptance |
| Owner | Membership, deliberate release, gated activation/closure | Bypassing missing approvals or cross-tenant access |

Roles can combine only through explicit grants; every approval records which authority was used. Prototype uses one fictional approver and implements no authorization.

## Estimation and commercial policy

Assess features/scope, architecture, integrations, migration, design, security/compliance, AI uncertainty, testing, deployment, dependencies/customer approvals independently. Capture evidence, unknowns and owner; unknown critical inputs mean `needs_discovery`, not a guessed score-to-weeks conversion. Break down task-role effort ranges, map real capacity and critical path, account for external waits/review/QA, and justify contingency without double counting. Publish only human-approved ranges/assumptions; changed commitments require re-estimation and a new proposal version.

| Verified contracting business region | Candidate maintained card / currency |
| --- | --- |
| UK | UK commercial card / GBP |
| US | US commercial card / USD |
| India | India commercial card / INR |
| Other / unknown / conflicting | Manual selection or discovery first |

No inference from IP, nationality or campaign market. Currency preferences require review. Internal floor includes role effort × delivery cost, overhead, external services and contingency; cost floor/margin stay private. Price book, discounts and final amount require authorized human approval. No current rates, tax, FX or guaranteed margins are asserted. Use integer minor units with each currency's maintained exponent; proposed future rounding is decimal half-up once per approved line, sum rounded lines exactly for total, display the same amounts, and document any adjustment explicitly. Taxes, FX source/validity, invoice treatment and exceptions remain manually reviewed. Issued prices never silently change with region or FX.

## Mandatory before real clients (all unimplemented)

Invite/session security; server-enforced cross-tenant/per-object authorization; immutable versions, concurrency and idempotency; atomic decision/audit writes; privacy minimization/retention/deletion; backup/restore exercises; private document authorization and safe upload handling. Also require reviewed contracts, finance controls, secure operations and accessibility testing with assistive technology. Fixture tests do not prove these controls.

## Acceptance traceability

| Requirement | Automated evidence | Visual/manual evidence |
| --- | --- | --- |
| Current accept/change/decline | state tests; browser confirmations | Clear next action, confirmation/result |
| Never Active | exact awaiting-kickoff assertion, unsupported activation no-op | Kickoff conditions remain visible |
| Expired/superseded | all decisions denied in reducer/browser | Disabled controls and explanation |
| Duplicate/stale/expiry boundary | duplicate completion, version/clock checks | Pending controls and stale feedback |
| Failure/retry and validation | reducer retry; browser error/required reason | Error text, focus and retry |
| Loading/empty/invalid/denied | browser scenario assertions | Guidance, no working decisions |
| Money integrity | integer/sum/invalid total tests | Fake-amount label, matching milestone total |
| Responsive/accessibility | browser overflow, modal focus/escape/tab checks | 320/375/768/1440 light/dark screenshots, labels/focus |
| Production isolation | route manifests and production HTTP 404; server production refusal | No marketing link or modified public route |

## Phases

1. This isolated design/prototype review.
2. Separately approved invitation-only manual MVP after mandatory security controls; estimation, commercial review, contracting, finance and activation stay manual.
3. Calibrated drafting assistance only after estimate-vs-actual evidence and separate approval; human commitment gates persist.
