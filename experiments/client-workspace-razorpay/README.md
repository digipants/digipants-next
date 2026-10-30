# Razorpay settings and payment-evidence experiment

**Status: disabled, synthetic test-only.** No Razorpay merchant connection was
read from this repository and no live credentials are used. The owner reports
Razorpay is connected elsewhere, but this **does not verify that the intended
DigiPants Network Pvt. Ltd. merchant account, API credentials, settlement
configuration or webhook endpoint are ready for this Client Workspace**.

This experiment never calls Razorpay, creates orders, captures payments,
authorizes refunds or adds a production Next.js payment route.

## Settings contract (future production integration, not activated)

| Setting | Required guard |
| --- | --- |
| Gateway | Razorpay only after ownership, account/KYC and permitted use confirmed |
| Mode | `disabled` default; isolated code accepts only `test` and `enabled:false` |
| Key ID / Key Secret | Separate test vs live keys; secret only in trusted server environment, never Git/client JS |
| Webhook secret | Dedicated secret for the registered endpoint, **not** the key secret |
| Invoice amount | Immutable server-owned integer paise and INR, exact approved invoice revision |
| Order creation | One server-stored Razorpay order ID per approved invoice/attempt; prevent accidental retries |
| Capture/status | Check Razorpay's captured payment/order state from trusted API before a paid invoice is recorded |
| Webhooks | Verify **original raw bytes** against `X-Razorpay-Signature` HMAC-SHA256 prior to parsing |
| Event deduplication | Durable unique provider event ID + payment ID and merchant attempt; handle out-of-order delivery |
| Finance and access | Staff MFA step-up, approval authorization, reconciliation logs and immutable audit; never auto-grant projects |
| Refunds | Separate verified refund state machine, idempotency and staff approval, not inferred from capture callback |
| Exposure | No enabled public checkout, webhook or payment link until release gates and explicit approval |

The code tests checkout signature verification against the **persisted order ID**
as a pure helper. A checkout callback alone cannot establish settlement.
For incoming webhooks it returns only a **reconciliation candidate** after
verifying HMAC, order, payment id, integer amount/currency and event status.
The real implementation must durably persist the verified payload/event ID
and fetch trusted payment/order state before updating the invoice. Duplicate
and stale events never cause state regression; refunds/failures are manually
reconciled. These tests **do not** implement an exactly-once distributed
payment workflow, durable event inbox, actual provider fetch or funds transfer.

## Corporate Razorpay Test Mode adapter — isolated follow-up

`test-mode-adapter.mjs` provides a **disabled-by-default injectable provider
contract**, with a fixed Razorpay API host, Test Mode-only key ID prefix,
distinct server-side API and webhook signing secrets, and an explicit
DigiPants Network Pvt. Ltd. merchant account identity
(`acc_Tu75hN11NeaAqL`). The personal-PAN merchant is reserved for Aegis.
A second `credentialMerchantAccountId` assertion ensures configuration
matches the intended account; this is a **trusted configuration assertion,
not cryptographic proof** that the API key belongs to that merchant.
Merchant ownership must be checked through the correct Razorpay Dashboard
session and credentials before enabling a real gateway transport.

Order creation accepts only a **persisted, approved invoice attempt**
atomically claimed by the injected repository. It builds an official
`POST /v1/orders` request with integer paise, INR, non-partial payment and
a stable, stored receipt. If the provider response is lost, malformed, or
not durably bound to the attempt, the attempt is quarantined for review.
**No automatic second POST** is permitted: a receipt alone is not a proven
Razorpay Orders API idempotency contract. Duplicate requests must reuse or
review the existing attempt instead of creating another charge path.

`fetchCapturedEvidence` reads both `GET /v1/orders/:id` and
`GET /v1/payments/:id` through the injected transport and only returns a
captured candidate when order and payment are both exact matches for the
trusted attempt's order ID, INR currency and total amount. It never marks
an invoice paid, updates grants, or invokes a webhook. Tests inject a
synthetic transport: **no Razorpay network requests are made.**

**Not yet wired to the existing isolated `cw_payments` ledger:** that
experiment allocates synthetic order identifiers up front and uses a
synthetic merchant ID. A separate reviewed migration/code slice must
introduce a durable `prepared → creating → bound/needs_review`
attempt lifecycle and merchant-bound provider-order IDs before the adapter
can be used against a genuine Test Mode merchant. The corresponding
callbacks must enforce exact invoice revision, tenant/project grants,
idempotent audit and current staff/client identity. No public Next.js
payment route imports this adapter.

Future verified Test Mode transport may only be enabled after the specific
corporate account is selected, the test credentials are installed in a
trusted secret manager, and a separate owner-approved environment gate
is reviewed. Do not insert the real key secret, webhook secret, PAN,
client information, bank information or payment details in GitHub issues
or source files.

## Blocking live integration tasks

1. Verify the **correct merchant organization** owns this Client Workspace's
   intended transactions, the account is approved for this service and real
   keys, test keys, webhook settings and settlement rules are known. Never
   borrow keys from another DigiPants/Aegis/Educatia/other merchant context.
2. Confirm India GST invoice requirements, legal invoicing/receipts and
   refundable payment amounts with the business/accounting team.
3. Finish trusted staff MFA (#78), verified client enrollment (#83),
   database privileges/audit/recovery (#79) and grant-scoped invoice policy.
4. Add a dedicated, schema-versioned payments ledger and durable webhook
   inbox with unique event IDs, order links, reconciliation states and
   transactional updates. Explicit idempotency and non-regression tests.
5. Add private server-side order creation, Razorpay Test Mode checkout and
   endpoint-level raw-body webhook signature verification with strict request
   size, endpoint logging redaction and replay isolation. Test failed API
   calls, provider downtime, duplicate deliveries and missing events.
6. Run financial/operational acceptance with synthetic test payments, then
   separately authorize live merchant configuration and launch. Never
   manufacture a live charge for validation or modify live dashboard state
   without explicit approval.

Reference: [Razorpay payment security checklist](https://razorpay.com/security/checklist/)
and [payment gateway webhooks overview](https://razorpay.com/blog/payment-gateway-webhooks-india/).

No new paid services, secret values, Netlify environment variables, host
database migrations, client account records or manual deployment are needed
for this experiment.
