import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import {
  approveInvoiceSnapshot,
  inspectCheckoutCallback,
  openPaymentAttempt,
  receiveSignedWebhook,
  reconcileWebhookEvent,
} from "../payment-ledger.mjs";
import { assertDisposablePaymentsDatabaseUrl } from "../test-target.mjs";

const { Pool } = pg;
const enabled = process.env.RUN_PAYMENTS_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
const webhookSecret = "synthetic_only_webhook_secret_32_bytes";
const checkoutSecret = "synthetic_only_checkout_secret_32_bytes";
let pool;

function sign(secret, bytes) {
  return createHmac("sha256", secret).update(bytes).digest("hex");
}
function paymentBody(event, fields) {
  return Buffer.from(JSON.stringify({
    event,
    payload: { payment: { entity: fields } },
  }));
}
function refundBody(fields) {
  return Buffer.from(JSON.stringify({
    event: "refund.processed",
    payload: { refund: { entity: fields } },
  }));
}
async function receive(rawBody, eventId) {
  return receiveSignedWebhook(pool, {
    rawBody, eventId, signature: sign(webhookSecret, rawBody), webhookSecret,
  });
}
function providerEvidence(attempt, state, overrides = {}) {
  const orderState = state === "captured" ? "paid" : "attempted";
  const paid = state === "captured" ? Number(attempt.amount_paise) : 0;
  return {
    merchantId: "merchant_synthetic_digipants",
    environment: "test",
    order: {
      id: attempt.order_id, amountPaise: Number(attempt.amount_paise), currency: "INR",
      status: orderState, amountPaidPaise: paid,
    },
    payment: {
      id: attempt.payment_id, orderId: attempt.order_id,
      amountPaise: Number(attempt.amount_paise), currency: "INR", status: state,
    },
    ...overrides,
  };
}
async function fixture(amountPaise = 5000) {
  const value = {
    tenantId: randomUUID(), projectId: randomUUID(), approvedBy: randomUUID(), invoiceId: randomUUID(),
  };
  const invoice = await approveInvoiceSnapshot(pool, {
    ...value, revision: 1,
    lines: [{ description: "Synthetic implementation milestone", quantity: 1, unitAmountPaise: amountPaise, lineAmountPaise: amountPaise }],
  });
  assert.ok(invoice, "synthetic invoice snapshot should be approved");
  const opened = await openPaymentAttempt(pool, { ...value, requestKey: "request_" + randomUUID() });
  assert.ok(opened, "attempt should use the approved server snapshot");
  const attempt = { ...opened, payment_id: "pay_synthetic" + randomUUID().replaceAll("-", "") };
  return { ...value, invoice, attempt };
}
async function invoiceStatus(invoice) {
  const row = await pool.query("SELECT status FROM cw_payments.payment_invoices WHERE id=$1", [invoice.id]);
  return row.rows[0]?.status;
}
async function attemptStatus(attempt) {
  const row = await pool.query("SELECT status,payment_id,refunded_amount_paise::text FROM cw_payments.payment_attempts WHERE id=$1", [attempt.id]);
  return row.rows[0];
}
async function receivePaymentEvent(attempt, event, status, eventId = "evt_" + randomUUID().replaceAll("-", "")) {
  const raw = paymentBody(event, {
    id: attempt.payment_id, order_id: attempt.order_id, amount: Number(attempt.amount_paise),
    currency: "INR", status,
  });
  return { eventId, raw, receipt: await receive(raw, eventId) };
}

integration("payment ledger PostgreSQL adversarial and state-transition tests", async (t) => {
  const target = assertDisposablePaymentsDatabaseUrl(process.env.PAYMENTS_DATABASE_URL);
  pool = new Pool({ connectionString: target.toString(), max: 12 });
  try {
    await pool.query("SELECT 1 FROM cw_payments.payment_invoices LIMIT 0");
  } catch (error) {
    await pool.end();
    throw new Error("Apply the isolated Prisma payment migration before integration tests: " + error.message);
  }
  t.after(async () => pool.end());

  await t.test("approved invoice snapshot and browser callback cannot settle a payment", async () => {
    const f = await fixture();
    assert.equal(f.invoice.amountPaise, 5000);
    assert.match(f.invoice.snapshotHash, /^[a-f0-9]{64}$/);
    assert.match(f.attempt.order_id, /^order_[A-Za-z0-9]{4,80}$/);
    assert.equal(Number(f.attempt.amount_paise), 5000);
    const replay = await openPaymentAttempt(pool, {
      ...f, requestKey: (await pool.query("SELECT request_key FROM cw_payments.payment_attempts WHERE id=$1", [f.attempt.id])).rows[0].request_key,
    });
    assert.equal(replay.order_id, f.attempt.order_id);
    assert.equal(replay.reused, true);

    const callbackSignature = sign(checkoutSecret, Buffer.from(f.attempt.order_id + "|" + f.attempt.payment_id));
    assert.equal((await inspectCheckoutCallback(pool, {
      orderId: f.attempt.order_id, paymentId: f.attempt.payment_id, signature: callbackSignature, keySecret: checkoutSecret,
    })).decision, "candidate-only");
    assert.equal((await inspectCheckoutCallback(pool, {
      orderId: f.attempt.order_id, paymentId: f.attempt.payment_id, signature: callbackSignature, keySecret: webhookSecret,
    })).decision, "rejected");
    assert.equal(await invoiceStatus(f.invoice), "due");
    assert.equal((await attemptStatus(f.attempt)).status, "pending");

    const captured = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    assert.equal(captured.receipt.decision, "accepted");
    assert.equal(await invoiceStatus(f.invoice), "due", "signed webhook is only a reconciliation candidate");
    assert.equal((await attemptStatus(f.attempt)).status, "pending");
    assert.equal((await receive(captured.raw, captured.eventId)).decision, "duplicate");
    const collision = paymentBody("payment.failed", {
      id: f.attempt.payment_id, order_id: f.attempt.order_id, amount: 5000, currency: "INR", status: "failed",
    });
    assert.equal((await receive(collision, captured.eventId)).reason, "event-id-collision");

    const tampered = Buffer.from(captured.raw);
    tampered[tampered.length - 2] ^= 1;
    assert.equal((await receiveSignedWebhook(pool, {
      rawBody: tampered, eventId: "evt_tampered01", signature: sign(webhookSecret, captured.raw), webhookSecret,
    })).decision, "rejected");
  });

  await t.test("only exact independent provider evidence settles the matching order", async () => {
    const f = await fixture();
    const mismatch = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    const wrongOrder = providerEvidence(f.attempt, "captured", {
      order: { ...providerEvidence(f.attempt, "captured").order, id: "order_other0001" },
    });
    assert.equal((await reconcileWebhookEvent(pool, { eventId: mismatch.eventId, lookupProviderPayment: async () => wrongOrder })).decision, "rejected");
    assert.equal(await invoiceStatus(f.invoice), "due");
    assert.equal((await attemptStatus(f.attempt)).status, "pending");

    const wrongAmount = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: wrongAmount.eventId,
      lookupProviderPayment: async () => providerEvidence(f.attempt, "captured", {
        payment: { ...providerEvidence(f.attempt, "captured").payment, amountPaise: 4999 },
      }),
    })).decision, "rejected");

    const wrongCurrencyRaw = paymentBody("payment.captured", {
      id: f.attempt.payment_id, order_id: f.attempt.order_id, amount: 5000, currency: "USD", status: "captured",
    });
    assert.equal((await receive(wrongCurrencyRaw, "evt_currency_" + randomUUID().replaceAll("-", ""))).reason,
      "event-shape");

    const wrongPayment = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: wrongPayment.eventId,
      lookupProviderPayment: async () => providerEvidence(f.attempt, "captured", {
        payment: { ...providerEvidence(f.attempt, "captured").payment, id: "pay_wrongpayment01" },
      }),
    })).decision, "rejected");

    const providerCurrency = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: providerCurrency.eventId,
      lookupProviderPayment: async () => providerEvidence(f.attempt, "captured", {
        order: { ...providerEvidence(f.attempt, "captured").order, currency: "USD" },
      }),
    })).decision, "rejected");

    const wrongMerchant = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: wrongMerchant.eventId,
      lookupProviderPayment: async () => providerEvidence(f.attempt, "captured", { merchantId: "merchant_other" }),
    })).decision, "rejected");

    const verified = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    await pool.query("CREATE FUNCTION cw_payments.test_reject_capture_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='payment.captured' THEN RAISE EXCEPTION 'synthetic audit write failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$");
    await pool.query("CREATE TRIGGER test_reject_capture_audit BEFORE INSERT ON cw_payments.payment_reconciliation_events FOR EACH ROW EXECUTE FUNCTION cw_payments.test_reject_capture_audit()");
    let rolledBack;
    try {
      rolledBack = await reconcileWebhookEvent(pool, {
        eventId: verified.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "captured"),
      });
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS test_reject_capture_audit ON cw_payments.payment_reconciliation_events");
      await pool.query("DROP FUNCTION IF EXISTS cw_payments.test_reject_capture_audit()");
    }
    assert.equal(rolledBack.decision, "pending");
    assert.equal(await invoiceStatus(f.invoice), "due", "failed audit insert rolls back invoice state");
    assert.equal((await attemptStatus(f.attempt)).status, "pending");
    const pendingInbox = await pool.query("SELECT state FROM cw_payments.webhook_event_inbox WHERE provider_event_id=$1", [verified.eventId]);
    assert.equal(pendingInbox.rows[0].state, "pending");

    const result = await reconcileWebhookEvent(pool, {
      eventId: verified.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "captured"),
    });
    assert.equal(result.decision, "reconciled");
    assert.equal(result.paymentStatus, "captured");
    assert.equal(result.invoiceStatus, "paid");
    assert.equal(await invoiceStatus(f.invoice), "paid");
    await assert.rejects(
      pool.query("UPDATE cw_payments.payment_invoices SET status='due' WHERE id=$1", [f.invoice.id]),
      (error) => error.code === "23514",
    );
    const audit = await pool.query(
      "SELECT action,provider_evidence_sha256 FROM cw_payments.payment_reconciliation_events WHERE invoice_id=$1 ORDER BY occurred_at,id",
      [f.invoice.id],
    );
    assert.ok(audit.rows.some((row) => row.action === "payment.captured" && /^[a-f0-9]{64}$/.test(row.provider_evidence_sha256)));
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: verified.eventId, lookupProviderPayment: async () => { throw new Error("must not repeat"); },
    })).decision, "duplicate");
  });

  await t.test("authorization, failure, capture and delayed events cannot regress state", async () => {
    const f = await fixture();
    const authorized = await receivePaymentEvent(f.attempt, "payment.authorized", "authorized");
    assert.equal(authorized.receipt.decision, "accepted");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: authorized.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "authorized"),
    })).paymentStatus, "authorized");
    assert.equal((await attemptStatus(f.attempt)).status, "authorized");
    assert.equal(await invoiceStatus(f.invoice), "due");

    const failed = await receivePaymentEvent(f.attempt, "payment.failed", "failed");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: failed.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "failed"),
    })).paymentStatus, "failed");
    assert.equal((await attemptStatus(f.attempt)).status, "failed");
    assert.equal(await invoiceStatus(f.invoice), "due");

    const captured = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: captured.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "captured"),
    })).paymentStatus, "captured");
    assert.equal(await invoiceStatus(f.invoice), "paid");

    const delayed = await receivePaymentEvent(f.attempt, "payment.authorized", "authorized");
    const delayedResult = await reconcileWebhookEvent(pool, {
      eventId: delayed.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "captured"),
    });
    assert.equal(delayedResult.paymentStatus, "captured");
    assert.equal(await invoiceStatus(f.invoice), "paid");
    await assert.rejects(
      pool.query("UPDATE cw_payments.payment_attempts SET status='authorized' WHERE id=$1", [f.attempt.id]),
      (error) => error.code === "23514",
    );
  });

  await t.test("provider timeout is retryable; refunds require provider evidence and reconcile atomically", async () => {
    const f = await fixture();
    const captured = await receivePaymentEvent(f.attempt, "payment.captured", "captured");
    const timeout = await reconcileWebhookEvent(pool, {
      eventId: captured.eventId, lookupProviderPayment: async () => { throw new Error("synthetic timeout"); },
    });
    assert.equal(timeout.decision, "pending");
    assert.equal(timeout.attemptCount, 1);
    assert.equal(await invoiceStatus(f.invoice), "due");
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: captured.eventId, lookupProviderPayment: async () => { throw new Error("backoff should avoid provider call"); },
    })).reason, "backoff-active");
    await pool.query("UPDATE cw_payments.webhook_event_inbox SET next_retry_at=statement_timestamp()-interval '1 second' WHERE provider_event_id=$1", [captured.eventId]);
    assert.equal((await reconcileWebhookEvent(pool, {
      eventId: captured.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "captured"),
    })).invoiceStatus, "paid");

    const refundEvent = async (refundId, amount) => {
      const raw = refundBody({ id: refundId, payment_id: f.attempt.payment_id, amount, currency: "INR", status: "processed" });
      const eventId = "evt_" + randomUUID().replaceAll("-", "");
      const receipt = await receive(raw, eventId);
      assert.equal(receipt.decision, "accepted", JSON.stringify(receipt));
      return eventId;
    };
    const lookupRefund = (refundId, amount) => async () => ({
      ...providerEvidence(f.attempt, "captured"),
      refund: { id: refundId, paymentId: f.attempt.payment_id, amountPaise: amount, currency: "INR", status: "processed" },
    });
    const partialId = "rfnd_" + randomUUID().replaceAll("-", "");
    const partialEvent = await refundEvent(partialId, 1200);
    const partial = await reconcileWebhookEvent(pool, {
      eventId: partialEvent, lookupProviderRefund: lookupRefund(partialId, 1200),
    });
    assert.equal(partial.paymentStatus, "partially_refunded");
    assert.equal(await invoiceStatus(f.invoice), "partially_refunded");

    const finalId = "rfnd_" + randomUUID().replaceAll("-", "");
    const finalEvent = await refundEvent(finalId, 3800);
    const final = await reconcileWebhookEvent(pool, {
      eventId: finalEvent, lookupProviderRefund: lookupRefund(finalId, 3800),
    });
    assert.equal(final.paymentStatus, "refunded");
    assert.equal(await invoiceStatus(f.invoice), "refunded");
    assert.equal((await attemptStatus(f.attempt)).refunded_amount_paise, "5000");
  });

  await t.test("concurrent duplicate delivery is idempotent and scoped foreign keys reject cross-tenant rows", async () => {
    const shared = {
      tenantId: randomUUID(), projectId: randomUUID(), invoiceId: randomUUID(), approvedBy: randomUUID(),
    };
    assert.ok(await approveInvoiceSnapshot(pool, {
      ...shared, lines: [{ description: "Synthetic concurrent order", quantity: 1, unitAmountPaise: 5000, lineAmountPaise: 5000 }],
    }));
    const requestKey = "request_shared_" + randomUUID();
    const [openA, openB] = await Promise.all([
      openPaymentAttempt(pool, { ...shared, requestKey }),
      openPaymentAttempt(pool, { ...shared, requestKey }),
    ]);
    assert.ok(openA && openB);
    assert.equal(openA.order_id, openB.order_id);
    const attemptCount = await pool.query("SELECT count(*)::int AS count FROM cw_payments.payment_attempts WHERE invoice_id=$1", [shared.invoiceId]);
    assert.equal(attemptCount.rows[0].count, 1, "concurrent idempotent opens create one order");

    const f = await fixture();
    const eventId = "evt_" + randomUUID().replaceAll("-", "");
    const event = {
      eventId,
      raw: paymentBody("payment.authorized", {
        id: f.attempt.payment_id, order_id: f.attempt.order_id,
        amount: Number(f.attempt.amount_paise), currency: "INR", status: "authorized",
      }),
    };
    const [first, second] = await Promise.all([receive(event.raw, event.eventId), receive(event.raw, event.eventId)]);
    assert.deepEqual([first.decision, second.decision].sort(), ["accepted", "duplicate"]);
    const [one, two] = await Promise.all([
      reconcileWebhookEvent(pool, { eventId: event.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "authorized") }),
      reconcileWebhookEvent(pool, { eventId: event.eventId, lookupProviderPayment: async () => providerEvidence(f.attempt, "authorized") }),
    ]);
    assert.deepEqual([one.decision, two.decision].sort(), ["duplicate", "reconciled"]);
    const eventCount = await pool.query("SELECT count(*)::int AS count FROM cw_payments.webhook_event_inbox WHERE provider_event_id=$1", [event.eventId]);
    assert.equal(eventCount.rows[0].count, 1);
    const auditCount = await pool.query("SELECT count(*)::int AS count FROM cw_payments.payment_reconciliation_events WHERE webhook_event_inbox_id=(SELECT id FROM cw_payments.webhook_event_inbox WHERE provider_event_id=$1)", [event.eventId]);
    assert.equal(auditCount.rows[0].count, 2, "one received event and one reconciliation record");

    const collisionFixture = await fixture();
    const collisionId = "evt_" + randomUUID().replaceAll("-", "");
    const authorizedBody = paymentBody("payment.authorized", {
      id: collisionFixture.attempt.payment_id, order_id: collisionFixture.attempt.order_id,
      amount: Number(collisionFixture.attempt.amount_paise), currency: "INR", status: "authorized",
    });
    const failedBody = paymentBody("payment.failed", {
      id: collisionFixture.attempt.payment_id, order_id: collisionFixture.attempt.order_id,
      amount: Number(collisionFixture.attempt.amount_paise), currency: "INR", status: "failed",
    });
    const racedCollision = await Promise.all([receive(authorizedBody, collisionId), receive(failedBody, collisionId)]);
    assert.deepEqual(racedCollision.map((row) => row.decision).sort(), ["accepted", "rejected"]);
    assert.ok(racedCollision.some((row) => row.reason === "event-id-collision"));
    assert.equal(await invoiceStatus(collisionFixture.invoice), "due");

    await assert.rejects(pool.query(
      "INSERT INTO cw_payments.payment_attempts (id,tenant_id,project_id,invoice_id,invoice_revision,merchant_id,environment,request_key,order_id,amount_paise,currency) VALUES($1,$2,$3,$4,1,'merchant_synthetic_digipants','test',$5,$6,5000,'INR')",
      [randomUUID(), randomUUID(), randomUUID(), f.invoice.id, "cross_" + randomUUID(), "order_cross" + randomUUID().replaceAll("-", "")],
    ), (error) => error.code === "23503");

    await assert.rejects(pool.query(
      "UPDATE cw_payments.payment_invoices SET current_approved_revision=2 WHERE id=$1",
      [f.invoice.id],
    ), (error) => error.code === "23503");

    const secondFixture = await fixture();
    await assert.rejects(pool.query(
      "INSERT INTO cw_payments.payment_attempts (id,tenant_id,project_id,invoice_id,invoice_revision,merchant_id,environment,request_key,order_id,amount_paise,currency) VALUES($1,$2,$3,$4,1,'merchant_synthetic_digipants','test',$5,$6,5000,'INR')",
      [randomUUID(), secondFixture.tenantId, secondFixture.projectId, secondFixture.invoice.id, "request_order_unique_" + randomUUID(), f.attempt.order_id],
    ), (error) => error.code === "23505");

    await assert.rejects(pool.query("UPDATE cw_payments.approved_invoice_snapshots SET amount_paise=1 WHERE invoice_id=$1", [f.invoice.id]), (error) => error.code === "23514");
    const audit = await pool.query("SELECT id FROM cw_payments.payment_reconciliation_events WHERE invoice_id=$1 LIMIT 1", [f.invoice.id]);
    await assert.rejects(pool.query("DELETE FROM cw_payments.payment_reconciliation_events WHERE id=$1", [audit.rows[0].id]), (error) => error.code === "23514");
  });
});
