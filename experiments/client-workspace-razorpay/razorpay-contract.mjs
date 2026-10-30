import { createHmac, timingSafeEqual } from "node:crypto";

// NO public exports from the Next.js app, provider calls or live payment route.
// These pure helpers are restricted to a synthetic security experiment.

function safeHexSha256(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, "hex") : null;
}
function validSecret(secret) {
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= 24;
}
function verifyHmac(secret, message, signature) {
  if (!validSecret(secret)) return false;
  const supplied = safeHexSha256(signature);
  if (!supplied) return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** Always verify the ORIGINAL request bytes. Parsed/re-serialized JSON is unsafe. */
export function verifyRazorpayWebhookRawBody({ rawBody, signature, webhookSecret }) {
  return Buffer.isBuffer(rawBody) || rawBody instanceof Uint8Array
    ? verifyHmac(webhookSecret, rawBody, signature) : false;
}

/** Requires an order id loaded from trusted server DB, never browser input. */
export function verifyRazorpayCheckoutSignature({
  expectedOrderId, paymentId, signature, keySecret,
}) {
  if (typeof expectedOrderId !== "string" || !/^order_[A-Za-z0-9]{4,80}$/.test(expectedOrderId) ||
      typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]{4,80}$/.test(paymentId)) return false;
  return verifyHmac(keySecret, `${expectedOrderId}|${paymentId}`, signature);
}

/** Refuse production configuration in this experiment, even if keys exist. */
export function validateSyntheticTestSettings(input) {
  if (!input || input.mode !== "test" || input.enabled !== false) return false;
  if (typeof input.keyId !== "string" || !/^rzp_test_[A-Za-z0-9]+$/.test(input.keyId)) return false;
  if (!validSecret(input.keySecret) || !validSecret(input.webhookSecret) ||
      input.keySecret === input.webhookSecret) return false;
  if (input.currency !== "INR") return false;
  return true;
}

const SUPPORTED = new Set(["payment.authorized", "payment.captured", "payment.failed", "refund.processed"]);

/**
 * This does NOT write to an invoice or grant access. It produces evidence
 * requiring server-side payment fetch and a durable serializable DB update
 * before a merchant can mark an invoice paid.
 *
 * The event-id header is checked only AFTER signature verification and must
 * still be persisted under a DB uniqueness constraint in the real receiver.
 */
export function inspectVerifiedRazorpayPaymentEvent({
  rawBody, signature, webhookSecret, eventId, trustedInvoice, seenEventIds = [],
}) {
  const deny = (reason) => ({ decision: "rejected", reason });
  if (!verifyRazorpayWebhookRawBody({ rawBody, signature, webhookSecret })) return deny("signature");
  if (typeof eventId !== "string" || !/^[a-zA-Z0-9_-]{6,128}$/.test(eventId)) return deny("event-id");
  if (!trustedInvoice || typeof trustedInvoice.orderId !== "string" ||
      !/^order_[A-Za-z0-9]{4,80}$/.test(trustedInvoice.orderId) ||
      !Number.isSafeInteger(trustedInvoice.amountPaise) || trustedInvoice.amountPaise <= 0 ||
      trustedInvoice.currency !== "INR" ||
      !["created", "authorized", "captured"].includes(trustedInvoice.state)) return deny("invoice");
  if (!Array.isArray(seenEventIds) || !seenEventIds.every(x => typeof x === "string")) return deny("inbox");
  if (seenEventIds.includes(eventId)) return { decision: "duplicate", reason: "already-received" };

  let event;
  try { event = JSON.parse(Buffer.from(rawBody).toString("utf8")); }
  catch { return deny("invalid-json"); }
  if (!event || typeof event !== "object" || !SUPPORTED.has(event.event)) {
    return { decision: "manual-review", reason: "unsupported-event" };
  }

  // Refunds need separately verified amounts and refund ids; never infer
  // captured/refunded invoice state from the generic event body alone.
  if (event.event === "refund.processed") {
    return { decision: "manual-review", reason: "refund-reconciliation" };
  }
  const payment = event.payload?.payment?.entity;
  if (!payment || typeof payment !== "object" ||
      payment.order_id !== trustedInvoice.orderId ||
      payment.currency !== "INR" ||
      payment.amount !== trustedInvoice.amountPaise ||
      !Number.isSafeInteger(payment.amount) ||
      typeof payment.id !== "string" ||
      !/^pay_[A-Za-z0-9]{4,80}$/.test(payment.id) ||
      (trustedInvoice.paymentId && trustedInvoice.paymentId !== payment.id)) return deny("order-amount-currency");
  const expectedStatus = {
    "payment.authorized": "authorized",
    "payment.captured": "captured",
    "payment.failed": "failed",
  }[event.event];
  if (payment.status !== expectedStatus) return deny("event-status");

  if (trustedInvoice.state === "captured" || event.event === "payment.authorized" && trustedInvoice.state === "authorized") {
    return { decision: "ignored", reason: "no-regression" };
  }
  if (event.event === "payment.failed") {
    return { decision: "manual-review", reason: "failure-reconciliation" };
  }
  return {
    decision: "reconcile",
    reason: "verify-capture-with-provider",
    paymentId: payment.id,
    orderId: trustedInvoice.orderId,
    eventId,
    candidateState: expectedStatus,
  };
}
