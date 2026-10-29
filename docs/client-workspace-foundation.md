# Client Workspace foundation — tenant/project access contract (slice 1)

Parent roadmap: #64. First implementation issue: #68. This is an **isolated policy module**, not a production authorization mechanism or operational client portal.

## Current baseline and why this slice is small

The DigiPants site has no installed identity provider, persistent workspace database, or real client accounts. Proposal and progress screens are standalone local synthetic prototypes. Their approval/publication simulations do not authenticate people or protect live resources. A server-side access boundary must come before linking those screens to real records, GitHub, documents or payments.

## Trust boundaries and future request pipeline

1. **Authenticate on the server** using a selected, audited provider and secure session cookies. Never trust a client-supplied user ID, role, membership, tenant, project, publication state, approval or invoice status.
2. **Resolve active tenant and project grants from the database** at request time (or through short-lived invalidation-aware authorization data), and verify that the requested resource belongs to that tenant and project. All project reads and writes must also be constrained at the SQL/data-access layer; a pure policy function does not replace tenant-filtered queries.
3. **Evaluate the explicit capability policy** with the server-trusted principal, active project grants and resource publication status. Deny by default. Missing, inactive or cross-tenant grants never authorize access. Staff are assigned per project; there is no wildcard/grant-all behavior.
4. **Enforce operation-specific business gates** in the same transaction: current issued proposal version, signature authority, contract/payment prerequisites for activation, project phase and approval evidence for publication. A role alone never bypasses these checks.
5. **Commit the authorized transition atomically** with an append-only audit event, idempotency key and optimistic version check. Replays, concurrent clicks, stale sessions, revoked grants and inconsistent state must fail safely. Return a generic error to the client; internal access-policy diagnostics must never reveal tenant/project identity.
6. Use secure private file storage, server-side download authorization, least-privilege provider secrets, monitoring, backup/restore exercises, retention/deletion rules and verified payment/GitHub webhook processing before a real client pilot.

## Roles and action policy

All permissions are per exact `tenantId + projectId + userId` grant. An actor can hold several explicitly assigned roles. `workspace_owner` is not automatically a commercial approver or contractual signatory.

| Role | Included actions (each explicit) |
| --- | --- |
| Client viewer | Read published project, proposal, milestone, invoice and document |
| Client contributor | Viewer + edit own brief + request change |
| Client approver | Contributor + proposal decision + milestone acceptance |
| Client signatory | Viewer + sign contract, *not* proposal approval |
| Delivery staff | Read internal assigned project + review briefs + edit delivery drafts |
| Delivery lead | Staff + approve effort estimate + verify milestone + publish reviewed progress |
| Commercial approver | Read internal assigned project + approve price/invoice + reconcile verified payments |
| Workspace owner | Read internal assigned project + release approved proposal + gated activate/close |

Every published read and client contractual/acceptance action requires explicit published visibility. An initial client-owned brief can be edited while unpublished. The policy does not encode document sharing, time windows, or proposal version/lifecycle rules yet: those will be validated when real routes are introduced.

## Security invariants and tests

- Fail closed for anonymous, disabled, malformed, unknown-role, unknown-action and revoked actors/grants.
- A matching project ID in another tenant does not grant access.
- A staff member assigned to one client project cannot access another project by changing an ID.
- A signatory cannot approve a proposal without a separate approver grant; an owner cannot approve money without a commercial grant.
- Client-visible content cannot be read while unpublished, regardless of role.
- Do not expose internal reason codes or protected object data to users.

## Next independent implementation slices

**Slice 2:** Compare and select auth/session and relational persistence approach for Next.js/Netlify; write short ADR and exact database tenant/grant schema. Do not provision resources without owner authorization.

**Slice 3:** Invite-only staff and client auth plus secure session lifecycle, MFA for staff, verified membership and revocation; test cross-tenant negative paths.

**Slice 4:** Tenant-scoped persistent project/brief records and server-only route handlers, audit and optimistic locking.

**Slice 5:** Versioned proposal/approval publication, manual verified progress and signed contract/payment gates.

**Subsequent:** GitHub App read-only evidence ingestion and verified finance/invoice reconciliation, each behind separate review gates. Capability Core grows only alongside actual validated needs.

No live route, UI, auth service, migrations, webhook, checkout, credentials or deployment is created by this slice. The module is an advisory policy to integrate **only after** server trust boundaries exist.
