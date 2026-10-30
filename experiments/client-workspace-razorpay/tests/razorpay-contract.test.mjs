import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  validateSyntheticTestSettings, verifyRazorpayWebhookRawBody,
  verifyRazorpayCheckoutSignature, inspectVerifiedRazorpayPaymentEvent,
} from "../razorpay-contract.mjs";

const webhookSecret = "synthetic-webhook-test-secret-32-bytes-only";
const keySecret = "synthetic-server-key-test-secret-32-bytes";
const orderId = "order_TESTABC12345", paymentId = "pay_TESTABC12345";
const invoice = Object.freeze({ invoiceId: "synthetic-invoice-1", orderId,
  paymentId: null, amountPaise: 249900, currency: "INR", state: "created" });
const signed = (event, status, overrides = {}) => {
  const rawBody = Buffer.from(JSON.stringify({
    event,
    payload: { payment: { entity: { id: paymentId, order_id: orderId,
      amount: 249900, currency: "INR", status, ...overrides } } },
  }));
  const signature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return { rawBody, signature };
};
const inspect = (args = {}) => inspectVerifiedRazorpayPaymentEvent({
  ...signed("payment.captured", "captured"), webhookSecret,
  eventId: "evt_test_1234", trustedInvoice: invoice, ...args,
});

test("all Razorpay payment settings remain explicitly disabled and test-only", () => {
  const config = { mode: "test", enabled: false, keyId: "rzp_test_FAKE123",
    keySecret, webhookSecret, currency: "INR" };
  assert.equal(validateSyntheticTestSettings(config), true);
  for (const change of [
    { mode: "live" }, { enabled: true }, { keyId: "rzp_live_FAKE123" },
    { keySecret: "short" }, { webhookSecret: keySecret }, { currency: "USD" },
  ]) assert.equal(validateSyntheticTestSettings({ ...config, ...change }), false);
  assert.equal(validateSyntheticTestSettings(undefined), false);
});

test("raw webhook body HMAC and checkout signature deny tampering and malformed signatures", () => {
  const { rawBody, signature } = signed("payment.captured", "captured");
  assert.equal(verifyRazorpayWebhookRawBody({ rawBody, signature, webhookSecret }), true);
  for (const input of [
    { rawBody: Buffer.from(rawBody.toString().replace("captured", "authorized")) },
    { signature: "0".repeat(64) },
    { signature: "invalid" }, { signature: null },
    { webhookSecret: "different-provider-secret-from-dashboard" },
    { rawBody: JSON.parse(rawBody.toString()) },
  ]) assert.equal(verifyRazorpayWebhookRawBody({ rawBody, signature, webhookSecret, ...input }), false);

  const checkoutSig = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const checkout = { expectedOrderId: orderId, paymentId, signature: checkoutSig, keySecret };
  assert.equal(verifyRazorpayCheckoutSignature(checkout), true);
  for (const input of [
    { expectedOrderId: "order_OTHER9999" },
    { paymentId: "pay_OTHER9999" },
    { signature: "x".repeat(64) },
    { keySecret: webhookSecret },
  ]) assert.equal(verifyRazorpayCheckoutSignature({ ...checkout, ...input }), false);
});

test("valid signed capture is a reconciliation candidate, never a paid invoice mutation", () => {
  assert.deepEqual(inspect(), { decision: "reconcile", reason: "verify-capture-with-provider",
    paymentId, orderId, eventId: "evt_test_1234", candidateState: "captured" });
  assert.equal(invoice.state, "created");
  assert.deepEqual(inspect({ seenEventIds: ["evt_test_1234"] }),
    { decision: "duplicate", reason: "already-received" });
  assert.deepEqual(inspect({ trustedInvoice: { ...invoice, state: "captured", paymentId } }),
    { decision: "ignored", reason: "no-regression" });
});

test("signed mismatched payment evidence, malformed JSON or fake event headers deny", () => {
  for (const paymentChange of [
    { amount: 1 }, { amount: "249900" }, { currency: "USD" },
    { order_id: "order_WRONG1234" }, { id: "pay_WRONG1234" },
    { status: "authorized" },
  ]) assert.equal(inspect({ ...signed("payment.captured", "captured", paymentChange) }).decision, "rejected");
  assert.equal(inspect({ eventId: "" }).decision, "rejected");
  assert.equal(inspect({ trustedInvoice: { ...invoice, amountPaise: 249901 } }).decision, "rejected");
  assert.equal(inspect({ trustedInvoice: { ...invoice, paymentId: "pay_ANOTHER1111" } }).decision, "rejected");
  const rawBody = Buffer.from("not-json");
  const signature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  assert.equal(inspect({ rawBody, signature }).reason, "invalid-json");
});

test("authorized, failed, refunded and out-of-order evidence cannot silently settle invoices", () => {
  assert.equal(inspect({ ...signed("payment.authorized", "authorized") }).candidateState, "authorized");
  assert.deepEqual(inspect({ ...signed("payment.authorized", "authorized"),
    trustedInvoice: { ...invoice, state: "captured", paymentId } }),
    { decision: "ignored", reason: "no-regression" });
  assert.deepEqual(inspect({ ...signed("payment.failed", "failed") }),
    { decision: "manual-review", reason: "failure-reconciliation" });
  assert.deepEqual(inspect({ ...signed("refund.processed", "processed") }),
    { decision: "manual-review", reason: "refund-reconciliation" });
  assert.deepEqual(inspect({ ...signed("totally.unknown", "unknown") }),
    { decision: "manual-review", reason: "unsupported-event" });
});
