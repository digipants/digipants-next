import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT, createDigiPantsTestModeAdapter,
  isDigiPantsTestConfiguration,
} from "../test-mode-adapter.mjs";

const config = Object.freeze({
  enabled: true, mode: "test", environment: "isolated-test",
  merchantAccountId: DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT,
  credentialMerchantAccountId: DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT,
  keyId: "rzp_test_SYNTHETICKEY123", keySecret: "synthetic-api-secret-for-test-fixture-only",
  webhookSecret: "independent-fake-webhook-signing-secret-123",
});
const receipt = "CWTEST_FIXEDRECEIPT20261031";
const orderId = "order_SYNTHETIC0001", paymentId = "pay_SYNTHETIC0001";
const attempt = () => ({
  id: randomUUID(), tenantId: randomUUID(), projectId: randomUUID(), invoiceId: randomUUID(),
  invoiceRevision: 1, amountPaise: 249900, currency: "INR", environment: "test",
  merchantAccountId: DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT, receipt, orderId: null,
});
function setup(transport = null) {
  const state = { claimed: false, bound: null, review: [], requests: [] };
  const snapshot = attempt();
  const repository = {
    async claimPreparedAttempt(id) {
      assert.equal(id, snapshot.id);
      if (state.claimed) return { decision: "busy" };
      state.claimed = true;
      return { decision: "claimed", attempt: snapshot };
    },
    async bindOrder(id, order, item) {
      assert.equal(id, snapshot.id);
      assert.equal(item, snapshot);
      state.bound = order;
      return true;
    },
    async markNeedsReview(id, reason) {
      assert.equal(id, snapshot.id);
      state.review.push(reason);
      return true;
    },
  };
  const send = async req => {
    state.requests.push(req);
    if (transport) return transport(req);
    if (req.method === "POST") {
      return { status: 200, body: {
        entity: "order", id: orderId, receipt, amount: snapshot.amountPaise,
        currency: "INR", status: "created", amount_paid: 0,
      } };
    }
    if (req.url.endsWith(orderId)) {
      return { status: 200, body: {
        entity: "order", id: orderId, amount: snapshot.amountPaise,
        amount_paid: snapshot.amountPaise, currency: "INR", status: "paid",
      } };
    }
    return { status: 200, body: {
      entity: "payment", id: paymentId, order_id: orderId,
      amount: snapshot.amountPaise, currency: "INR", status: "captured",
      captured: true,
    } };
  };
  const adapter = createDigiPantsTestModeAdapter({ config, transport: send, repository });
  return { adapter, state, snapshot, repository, transport: send };
}

test("corporate account only; disabled, live, Aegis and weak-key configurations fail closed", () => {
  assert.equal(isDigiPantsTestConfiguration(config), true);
  for (const changes of [
    { enabled: false }, { enabled: undefined }, { mode: "live" },
    { environment: "production" }, { merchantAccountId: "acc_PERSONALPAN_AEGIS" },
    { credentialMerchantAccountId: "acc_PERSONALPAN_AEGIS" },
    { keyId: "rzp_live_CANNOTBEUSED" }, { keySecret: "short" },
    { webhookSecret: config.keySecret },
  ]) {
    assert.equal(isDigiPantsTestConfiguration({ ...config, ...changes }), false,
      JSON.stringify(changes));
  }
  assert.equal(createDigiPantsTestModeAdapter({ config: { ...config, enabled: false } }), null);
  assert.equal(createDigiPantsTestModeAdapter({ config, transport: undefined }), null);
});

test("one atomic claim permits one order POST and binds only exact approved invoice amount", async () => {
  const { adapter, snapshot, state } = setup();
  const first = await adapter.createOrderForAttempt({ attemptId: snapshot.id });
  assert.deepEqual(first, { decision: "bound", orderId, amountPaise: 249900, currency: "INR" });
  assert.equal(state.bound, orderId);
  assert.equal(state.requests.length, 1);
  const request = state.requests[0];
  assert.equal(request.url, "https://api.razorpay.com/v1/orders");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization.startsWith("Basic "), true);
  assert.equal(JSON.parse(request.body).amount, snapshot.amountPaise);
  assert.equal(JSON.parse(request.body).receipt, receipt);
  assert.equal(JSON.parse(request.body).partial_payment, false);
  const again = await adapter.createOrderForAttempt({ attemptId: snapshot.id });
  assert.equal(again.decision, "not-created");
  assert.equal(state.requests.length, 1, "never duplicate the provider POST");
});

test("ambiguous gateway response reserves attempt and mandates review rather than retry", async () => {
  let count = 0;
  const fixture = setup(async () => { count += 1; throw new Error("synthetic timeout"); });
  const a = await fixture.adapter.createOrderForAttempt({ attemptId: fixture.snapshot.id });
  assert.equal(a.decision, "needs-review");
  assert.equal(a.reason, "ambiguous-provider-response");
  assert.equal(fixture.state.review.length, 1);
  const b = await fixture.adapter.createOrderForAttempt({ attemptId: fixture.snapshot.id });
  assert.equal(b.decision, "not-created");
  assert.equal(count, 1);
});

test("wrong provider order amount or receipt cannot be bound", async () => {
  const f = setup(async () => ({
    status: 200, body: { entity: "order", id: orderId, receipt: "WRONG_RECEIPT",
      amount: 249900, currency: "INR", status: "created", amount_paid: 0 },
  }));
  assert.equal((await f.adapter.createOrderForAttempt({ attemptId: f.snapshot.id })).reason,
    "provider-order-mismatch");
  assert.equal(f.state.bound, null);
});

test("captured evidence requires an exact fetched order and payment, not a browser callback", async () => {
  const f = setup();
  const bound = { ...f.snapshot, orderId };
  const result = await f.adapter.fetchCapturedEvidence({ attempt: bound, paymentId });
  assert.equal(result.decision, "verified");
  assert.equal(result.evidence.merchantAccountId, DIGIPANTS_CORPORATE_RAZORPAY_ACCOUNT);
  assert.equal(result.evidence.order.amountPaise, 249900);
  assert.equal(result.evidence.payment.status, "captured");
  assert.equal(f.state.requests.length, 2);
  assert.equal(f.state.requests.every(x => x.method === "GET"), true);
  assert.equal((await f.adapter.fetchCapturedEvidence({ attempt: bound, paymentId: "INVALID" })).decision, "rejected");
});

test("uncaptured, wrong-order and wrong-amount responses never establish a captured payment", async () => {
  for (const replacement of [
    { entity: "payment", id: paymentId, order_id: "order_WRONG123", amount: 249900, currency: "INR", status: "captured", captured: true },
    { entity: "payment", id: paymentId, order_id: orderId, amount: 1, currency: "INR", status: "captured", captured: true },
    { entity: "payment", id: paymentId, order_id: orderId, amount: 249900, currency: "INR", status: "authorized", captured: false },
  ]) {
    const f = setup(async req => req.url.endsWith(orderId)
      ? { status: 200, body: { entity: "order", id: orderId, amount: 249900,
        amount_paid: 249900, currency: "INR", status: "paid" } }
      : { status: 200, body: replacement });
    const result = await f.adapter.fetchCapturedEvidence({
      attempt: { ...f.snapshot, orderId }, paymentId,
    });
    assert.equal(result.decision, "rejected");
  }
});

test("the experiment has no public application route, direct network calls or secret loading", async () => {
  const source = await readFile(new URL("../test-mode-adapter.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|https?\.request\s*\(|process\.env|NEXT_PUBLIC_/);
  assert.match(source, /acc_Tu75hN11NeaAqL/);
});
