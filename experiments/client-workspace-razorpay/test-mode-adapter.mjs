// ISOLATED Razorpay Test Mode contract. No production Next.js import, fetch,
// route, merchant API call, secret loading, hosted DB or live order creation.
// The caller supplies a transport and an atomic persistence adapter. The
// default is disabled and these helpers do not contact a gateway themselves.

export const DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT = "acc_Tu75hN11NeaAqL";
const API_ORIGIN = "https://api.razorpay.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_ID = /^order_[a-zA-Z0-9]{4,80}$/;
const PAYMENT_ID = /^pay_[a-zA-Z0-9]{4,80}$/;
const RECEIPT = /^[a-zA-Z0-9_-]{8,40}$/;

export function isDigiPantsTestConfiguration(config) {
  return config?.enabled === true && config.mode === "test" &&
    config.merchantAccountId === DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT &&
    config.credentialMerchantAccountId === DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT &&
    typeof config.keyId === "string" && /^rzp_test_[A-Za-z0-9]{8,}$/.test(config.keyId) &&
    typeof config.keySecret === "string" && config.keySecret.length >= 24 &&
    typeof config.webhookSecret === "string" && config.webhookSecret.length >= 24 &&
    config.keySecret !== config.webhookSecret &&
    config.environment === "isolated-test";
}

function approvedAttempt(attempt) {
  return attempt && UUID.test(attempt.id ?? "") &&
    UUID.test(attempt.tenantId ?? "") && UUID.test(attempt.projectId ?? "") &&
    UUID.test(attempt.invoiceId ?? "") && Number.isSafeInteger(attempt.invoiceRevision) &&
    attempt.invoiceRevision > 0 && Number.isSafeInteger(attempt.amountPaise) &&
    attempt.amountPaise > 0 && attempt.currency === "INR" &&
    attempt.environment === "test" &&
    attempt.merchantAccountId === DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT &&
    RECEIPT.test(attempt.receipt ?? "");
}
function orderBound(attempt) {
  return approvedAttempt(attempt) && ORDER_ID.test(attempt.orderId ?? "");
}
function basicAuth(config) {
  return "Basic " + Buffer.from(`${config.keyId}:${config.keySecret}`, "utf8").toString("base64");
}
function validOrderResponse(order, attempt) {
  return order?.entity === "order" && ORDER_ID.test(order.id ?? "") &&
    order.amount === attempt.amountPaise &&
    order.currency === "INR" && order.receipt === attempt.receipt &&
    order.status === "created" &&
    (order.amount_paid === 0 || order.amount_paid === undefined);
}
function validCapturedResponse(order, payment, attempt, paymentId) {
  return order?.entity === "order" && order.id === attempt.orderId &&
    order.amount === attempt.amountPaise && order.currency === "INR" &&
    order.amount_paid === attempt.amountPaise && order.status === "paid" &&
    payment?.entity === "payment" && payment.id === paymentId &&
    payment.order_id === attempt.orderId &&
    payment.amount === attempt.amountPaise && payment.currency === "INR" &&
    payment.status === "captured" && payment.captured === true;
}

/**
 * Creating an order is not idempotent merely because the same receipt is
 * supplied. The repository MUST atomically claim a prepared DB attempt before
 * the outbound POST. If the response/binding is ambiguous, quarantine the
 * attempt and DO NOT automatically POST again. This is test-only wiring.
 */
export function createDigiPantsTestModeAdapter({ config, transport, repository } = {}) {
  if (!isDigiPantsTestConfiguration(config) ||
      typeof transport !== "function" ||
      typeof repository?.claimPreparedAttempt !== "function" ||
      typeof repository?.bindOrder !== "function" ||
      typeof repository?.markNeedsReview !== "function") return null;

  async function request(method, path, body = undefined) {
    // This is a fixed host and fixed allowlisted API path, not user input.
    const allowed = path === "/v1/orders" ||
      /^\/v1\/orders\/order_[A-Za-z0-9]{4,80}$/.test(path) ||
      /^\/v1\/payments\/pay_[A-Za-z0-9]{4,80}$/.test(path);
    if (!allowed) throw new Error("Blocked provider endpoint");
    const response = await transport({
      method, url: API_ORIGIN + path, headers: {
        Authorization: basicAuth(config),
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response || ![200, 201].includes(response.status) ||
        !response.body || typeof response.body !== "object") {
      throw new Error("Provider returned an unavailable or invalid response");
    }
    return response.body;
  }

  async function createOrderForAttempt({ attemptId } = {}) {
    if (!UUID.test(attemptId ?? "")) return { decision: "rejected", reason: "attempt-id" };
    let claimed;
    try { claimed = await repository.claimPreparedAttempt(attemptId); }
    catch { return { decision: "rejected", reason: "claim-persistence" }; }
    // No automatic POST if another worker already owns this attempt.
    if (claimed?.decision !== "claimed") {
      return { decision: "not-created", reason: claimed?.decision ?? "unavailable" };
    }
    const attempt = claimed.attempt;
    if (!approvedAttempt(attempt) || attempt.orderId !== null) {
      await repository.markNeedsReview(attemptId, "invalid-approved-attempt");
      return { decision: "needs-review", reason: "invalid-approved-attempt" };
    }
    try {
      const order = await request("POST", "/v1/orders", {
        amount: attempt.amountPaise, currency: "INR", receipt: attempt.receipt,
        partial_payment: false,
      });
      if (!validOrderResponse(order, attempt)) {
        await repository.markNeedsReview(attemptId, "provider-order-mismatch");
        return { decision: "needs-review", reason: "provider-order-mismatch" };
      }
      // Must commit with a compare-and-swap on the claimed attempt, merchant,
      // invoice revision, amount, and absent order id.
      const bound = await repository.bindOrder(attemptId, order.id, attempt);
      if (bound !== true) {
        await repository.markNeedsReview(attemptId, "ambiguous-order-binding");
        return { decision: "needs-review", reason: "ambiguous-order-binding" };
      }
      return { decision: "bound", orderId: order.id, amountPaise: attempt.amountPaise, currency: "INR" };
    } catch {
      // The provider may have created an order even if response was lost.
      // Treat it as ambiguous, never retry creation blindly.
      try { await repository.markNeedsReview(attemptId, "ambiguous-provider-response"); }
      catch { /* Original claim remains reserved; fail closed. */ }
      return { decision: "needs-review", reason: "ambiguous-provider-response" };
    }
  }

  async function fetchCapturedEvidence({ attempt, paymentId } = {}) {
    if (!orderBound(attempt) || !PAYMENT_ID.test(paymentId ?? "")) {
      return { decision: "rejected", reason: "identity" };
    }
    try {
      const order = await request("GET", "/v1/orders/" + attempt.orderId);
      const payment = await request("GET", "/v1/payments/" + paymentId);
      if (!validCapturedResponse(order, payment, attempt, paymentId)) {
        return { decision: "rejected", reason: "provider-evidence-mismatch" };
      }
      // Credential-to-merchant binding is asserted by trusted configuration;
      // Razorpay Order/Payment response payloads do not themselves prove
      // which merchant legal entity owns the supplied key pair.
      return {
        decision: "verified",
        evidence: {
          merchantAccountId: DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT,
          environment: "test",
          order: { id: order.id, amountPaise: order.amount, currency: order.currency },
          payment: {
            id: payment.id, orderId: payment.order_id, amountPaise: payment.amount,
            currency: payment.currency, status: "captured",
          },
        },
      };
    } catch {
      return { decision: "pending", reason: "provider-unavailable" };
    }
  }

  return Object.freeze({ createOrderForAttempt, fetchCapturedEvidence });
}
