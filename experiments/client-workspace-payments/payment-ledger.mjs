import { createHash, randomUUID } from "node:crypto";
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookRawBody,
} from "../client-workspace-razorpay/razorpay-contract.mjs";

export const SYNTHETIC_MERCHANT_ID = "merchant_synthetic_digipants";
export const PAYMENT_ENVIRONMENT = "test";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_ID = /^[A-Za-z0-9_-]{6,128}$/;
const ORDER_ID = /^order_[A-Za-z0-9]{4,80}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{4,80}$/;
const REFUND_ID = /^rfnd_[A-Za-z0-9]{4,80}$/;
const STATE_RANK = { pending: 0, authorized: 1, failed: 2, captured: 3, partially_refunded: 4, refunded: 5 };

const sql = (lines) => lines.join(" ");
const digest = (v) => createHash("sha256").update(v).digest("hex");
const safeInt = (v, min = 1) => Number.isSafeInteger(v) && v >= min;
const newOrderId = () => "order_" + randomUUID().replaceAll("-", "");

function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return "{" + Object.keys(value).sort()
    .map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}

async function serializable(pool, operation, limit = 4) {
  for (let n = 0; n < limit; n += 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const value = await operation(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (["40001", "40P01", "23505"].includes(error?.code) && n + 1 < limit) continue;
      throw error;
    } finally {
      client.release();
    }
  }
  throw new Error("serializable retry limit exhausted");
}

async function appendEvent(client, e) {
  await client.query(sql([
    "INSERT INTO cw_payments.payment_reconciliation_events",
    "(id,tenant_id,project_id,invoice_id,invoice_revision,payment_attempt_id,webhook_event_inbox_id,action,",
    "before_invoice_status,after_invoice_status,before_payment_status,after_payment_status,",
    "provider_evidence_sha256,idempotency_key) VALUES",
    "($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
  ]), [
    randomUUID(), e.tenantId, e.projectId, e.invoiceId, e.revision, e.attemptId ?? null,
    e.inboxId ?? null, e.action, e.beforeInvoice ?? null, e.afterInvoice ?? null,
    e.beforePayment ?? null, e.afterPayment ?? null, e.evidenceHash ?? null, e.key,
  ]);
}

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) return null;
  const normalized = [];
  let total = 0;
  for (const line of lines) {
    if (!line || typeof line.description !== "string" || line.description.length < 1 ||
        line.description.length > 160 || !safeInt(line.quantity) ||
        !safeInt(line.unitAmountPaise) || !safeInt(line.lineAmountPaise) ||
        line.quantity * line.unitAmountPaise !== line.lineAmountPaise) return null;
    total += line.lineAmountPaise;
    if (!Number.isSafeInteger(total)) return null;
    normalized.push({
      description: line.description, quantity: line.quantity,
      unitAmountPaise: line.unitAmountPaise, lineAmountPaise: line.lineAmountPaise,
    });
  }
  return { normalized, total };
}

/** Synthetic-only invoice approval; amounts and revision are server snapshots. */
export async function approveInvoiceSnapshot(pool, input) {
  let v;
  try {
    v = {
      tenant: input.tenantId, project: input.projectId, actor: input.approvedBy,
      invoice: input.invoiceId ?? randomUUID(), revision: input.revision ?? 1,
      lines: validateLines(input.lines),
    };
  } catch { return null; }
  if (![v.tenant, v.project, v.actor, v.invoice].every((x) => UUID.test(x)) ||
      !Number.isSafeInteger(v.revision) || v.revision < 1 || !v.lines) return null;

  const invoiceNumber = "INV-SYN-" + v.invoice.replaceAll("-", "").slice(0, 16).toUpperCase();
  const snapshot = {
    invoiceId: v.invoice, invoiceNumber, revision: v.revision, currency: "INR",
    amountPaise: v.lines.total, lineItems: v.lines.normalized,
  };
  const snapshotJson = canonical(snapshot);
  const snapshotHash = digest(snapshotJson);
  try {
    return await serializable(pool, async (c) => {
      await c.query(
        "INSERT INTO cw_payments.payment_invoices(id,tenant_id,project_id,invoice_number,current_approved_revision,status) VALUES($1,$2,$3,$4,$5,'approved')",
        [v.invoice, v.tenant, v.project, invoiceNumber, v.revision],
      );
      await c.query(
        "INSERT INTO cw_payments.approved_invoice_snapshots(id,tenant_id,project_id,invoice_id,revision,amount_paise,currency,snapshot_json,snapshot_sha256,approved_by) VALUES($1,$2,$3,$4,$5,$6,'INR',$7::jsonb,$8,$9)",
        [randomUUID(), v.tenant, v.project, v.invoice, v.revision, v.lines.total, snapshotJson, snapshotHash, v.actor],
      );
      await appendEvent(c, {
        tenantId: v.tenant, projectId: v.project, invoiceId: v.invoice, revision: v.revision,
        action: "invoice.snapshot_approved", afterInvoice: "approved",
        key: "invoice-approved:" + v.invoice + ":" + v.revision,
      });
      return { id: v.invoice, invoiceNumber, revision: v.revision, amountPaise: v.lines.total, currency: "INR", snapshotHash };
    });
  } catch { return null; }
}

/** Only reads an approved snapshot and generates the unique order identity server-side. */
export async function openPaymentAttempt(pool, input) {
  let v;
  try { v = { tenant: input.tenantId, project: input.projectId, invoice: input.invoiceId, requestKey: input.requestKey }; }
  catch { return null; }
  if (![v.tenant, v.project, v.invoice].every((x) => UUID.test(x)) ||
      typeof v.requestKey !== "string" || v.requestKey.length < 1 || v.requestKey.length > 128) return null;
  try {
    return await serializable(pool, async (c) => {
      const requested = await c.query(sql([
        "SELECT id::text,tenant_id::text,project_id::text,invoice_id::text,invoice_revision,order_id,payment_id,amount_paise::text,currency,status",
        "FROM cw_payments.payment_attempts WHERE tenant_id=$1 AND project_id=$2 AND invoice_id=$3 AND request_key=$4 FOR UPDATE",
      ]), [v.tenant, v.project, v.invoice, v.requestKey]);
      if (requested.rowCount) return { ...requested.rows[0], reused: true };
      const inv = await c.query(sql([
        "SELECT i.id::text AS invoice_id,i.tenant_id::text,i.project_id::text,i.current_approved_revision,",
        "i.status AS invoice_status,s.amount_paise::text,s.currency",
        "FROM cw_payments.payment_invoices i JOIN cw_payments.approved_invoice_snapshots s",
        "ON s.tenant_id=i.tenant_id AND s.project_id=i.project_id AND s.invoice_id=i.id AND s.revision=i.current_approved_revision",
        "WHERE i.tenant_id=$1 AND i.project_id=$2 AND i.id=$3 FOR UPDATE OF i",
      ]), [v.tenant, v.project, v.invoice]);
      if (!inv.rowCount || !["approved", "due"].includes(inv.rows[0].invoice_status)) return null;
      const invoice = inv.rows[0];
      const active = await c.query(sql([
        "SELECT id::text,tenant_id::text,project_id::text,invoice_id::text,invoice_revision,order_id,payment_id,amount_paise::text,currency,status",
        "FROM cw_payments.payment_attempts WHERE tenant_id=$1 AND project_id=$2 AND invoice_id=$3",
        "AND invoice_revision=$4 AND status IN ('pending','authorized') FOR UPDATE",
      ]), [v.tenant, v.project, v.invoice, invoice.current_approved_revision]);
      if (active.rowCount) return { ...active.rows[0], reused: true };
      if (invoice.invoice_status === "approved") {
        await c.query("UPDATE cw_payments.payment_invoices SET status='due',updated_at=statement_timestamp() WHERE tenant_id=$1 AND project_id=$2 AND id=$3", [v.tenant, v.project, v.invoice]);
      }
      const id = randomUUID();
      const created = await c.query(sql([
        "INSERT INTO cw_payments.payment_attempts",
        "(id,tenant_id,project_id,invoice_id,invoice_revision,merchant_id,environment,request_key,order_id,amount_paise,currency,status)",
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')",
        "RETURNING id::text,tenant_id::text,project_id::text,invoice_id::text,invoice_revision,order_id,payment_id,amount_paise::text,currency,status",
      ]), [
        id, v.tenant, v.project, v.invoice, invoice.current_approved_revision,
        SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, v.requestKey, newOrderId(),
        invoice.amount_paise, invoice.currency,
      ]);
      await appendEvent(c, {
        tenantId: v.tenant, projectId: v.project, invoiceId: v.invoice,
        revision: invoice.current_approved_revision, attemptId: id, action: "payment_attempt.created",
        beforeInvoice: invoice.invoice_status,
        afterInvoice: invoice.invoice_status === "approved" ? "due" : invoice.invoice_status,
        afterPayment: "pending",
        key: "payment-attempt:" + v.invoice + ":" + invoice.current_approved_revision + ":" + v.requestKey,
      });
      return { ...created.rows[0], reused: false };
    });
  } catch { return null; }
}

function parseEvent(raw) {
  let e;
  try { e = JSON.parse(Buffer.from(raw).toString("utf8")); } catch { return null; }
  if (!e || typeof e !== "object") return null;
  if (e.event === "refund.processed") {
    const r = e.payload?.refund?.entity;
    if (!r || !REFUND_ID.test(r.id ?? "") || !PAYMENT_ID.test(r.payment_id ?? "") ||
        !safeInt(r.amount) || r.currency !== "INR" || r.status !== "processed") return null;
    return { type: e.event, orderId: null, paymentId: r.payment_id, refundId: r.id, amount: r.amount, currency: r.currency, status: r.status };
  }
  const p = e.payload?.payment?.entity;
  const expected = { "payment.authorized": "authorized", "payment.captured": "captured", "payment.failed": "failed" }[e.event];
  if (!expected || !p || !ORDER_ID.test(p.order_id ?? "") || !PAYMENT_ID.test(p.id ?? "") ||
      !safeInt(p.amount) || p.currency !== "INR" || p.status !== expected) return null;
  return { type: e.event, orderId: p.order_id, paymentId: p.id, refundId: null, amount: p.amount, currency: p.currency, status: p.status };
}

/** Persist a signed event's digest and candidate fields; raw bytes never persist. */
export async function receiveSignedWebhook(pool, input) {
  let v;
  try { v = { raw: input.rawBody, signature: input.signature, eventId: input.eventId, secret: input.webhookSecret }; }
  catch { return { decision: "rejected", reason: "input" }; }
  if (!(Buffer.isBuffer(v.raw) || v.raw instanceof Uint8Array) || !EVENT_ID.test(v.eventId ?? "") ||
      !verifyRazorpayWebhookRawBody({ rawBody: v.raw, signature: v.signature, webhookSecret: v.secret })) {
    return { decision: "rejected", reason: "signature-or-id" };
  }
  const event = parseEvent(v.raw);
  if (!event) return { decision: "rejected", reason: "event-shape" };
  const bodyHash = digest(Buffer.from(v.raw));
  try {
    return await serializable(pool, async (c) => {
      const prior = await c.query(
        "SELECT id::text,raw_body_sha256 FROM cw_payments.webhook_event_inbox WHERE merchant_id=$1 AND environment=$2 AND provider_event_id=$3",
        [SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, v.eventId],
      );
      if (prior.rowCount) return prior.rows[0].raw_body_sha256 === bodyHash
        ? { decision: "duplicate", inboxId: prior.rows[0].id }
        : { decision: "rejected", reason: "event-id-collision" };
      const attempt = event.orderId
        ? await c.query(sql([
          "SELECT a.*,s.amount_paise::text AS snapshot_amount_paise,s.currency AS snapshot_currency",
          "FROM cw_payments.payment_attempts a JOIN cw_payments.approved_invoice_snapshots s",
          "ON s.tenant_id=a.tenant_id AND s.project_id=a.project_id AND s.invoice_id=a.invoice_id AND s.revision=a.invoice_revision",
          "WHERE a.merchant_id=$1 AND a.environment=$2 AND a.order_id=$3 FOR UPDATE OF a",
        ]), [SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, event.orderId])
        : await c.query(sql([
          "SELECT a.*,s.amount_paise::text AS snapshot_amount_paise,s.currency AS snapshot_currency",
          "FROM cw_payments.payment_attempts a JOIN cw_payments.approved_invoice_snapshots s",
          "ON s.tenant_id=a.tenant_id AND s.project_id=a.project_id AND s.invoice_id=a.invoice_id AND s.revision=a.invoice_revision",
          "WHERE a.merchant_id=$1 AND a.environment=$2 AND a.payment_id=$3 FOR UPDATE OF a",
        ]), [SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, event.paymentId]);
      if (!attempt.rowCount) return { decision: "rejected", reason: "unknown-order-or-payment" };
      const a = attempt.rows[0];
      if (event.currency !== a.snapshot_currency ||
          (event.type !== "refund.processed" && event.amount !== Number(a.snapshot_amount_paise))) {
        return { decision: "rejected", reason: "snapshot-amount-or-currency-mismatch" };
      }
      if (a.payment_id && a.payment_id !== event.paymentId) return { decision: "rejected", reason: "payment-id-mismatch" };
      const id = randomUUID();
      const row = await c.query(sql([
        "INSERT INTO cw_payments.webhook_event_inbox",
        "(id,tenant_id,project_id,invoice_id,invoice_revision,payment_attempt_id,merchant_id,environment,provider_event_id,event_type,order_id,payment_id,refund_id,raw_body_sha256,payload_amount_paise,payload_currency,payload_status)",
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
        "ON CONFLICT (merchant_id,environment,provider_event_id) DO NOTHING RETURNING id::text",
      ]), [
        id, a.tenant_id, a.project_id, a.invoice_id, a.invoice_revision, a.id,
        SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, v.eventId, event.type, a.order_id,
        event.paymentId, event.refundId, bodyHash, event.amount, event.currency, event.status,
      ]);
      if (!row.rowCount) {
        const raced = await c.query(
          "SELECT raw_body_sha256 FROM cw_payments.webhook_event_inbox WHERE merchant_id=$1 AND environment=$2 AND provider_event_id=$3",
          [SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, v.eventId],
        );
        return raced.rows[0]?.raw_body_sha256 === bodyHash
          ? { decision: "duplicate", eventId: v.eventId }
          : { decision: "rejected", reason: "event-id-collision" };
      }
      await appendEvent(c, {
        tenantId: a.tenant_id, projectId: a.project_id, invoiceId: a.invoice_id,
        revision: a.invoice_revision, attemptId: a.id, inboxId: id, action: "event.received",
        beforePayment: a.status, afterPayment: a.status, key: "event-received:" + v.eventId,
      });
      return { decision: "accepted", inboxId: id, eventId: v.eventId };
    });
  } catch { return { decision: "rejected", reason: "persistence" }; }
}

/** A valid browser callback is a candidate only; order id comes from the ledger. */
export async function inspectCheckoutCallback(pool, input) {
  let v;
  try { v = { order: input.orderId, payment: input.paymentId, signature: input.signature, keySecret: input.keySecret }; }
  catch { return { decision: "rejected", reason: "input" }; }
  if (!ORDER_ID.test(v.order ?? "") || !PAYMENT_ID.test(v.payment ?? "")) return { decision: "rejected", reason: "identity" };
  try {
    const rows = await pool.query(
      "SELECT order_id FROM cw_payments.payment_attempts WHERE merchant_id=$1 AND environment=$2 AND order_id=$3",
      [SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, v.order],
    );
    if (!rows.rowCount) return { decision: "rejected", reason: "unknown-order" };
    if (!verifyRazorpayCheckoutSignature({
      expectedOrderId: rows.rows[0].order_id, paymentId: v.payment, signature: v.signature, keySecret: v.keySecret,
    })) return { decision: "rejected", reason: "checkout-signature" };
    return { decision: "candidate-only", orderId: rows.rows[0].order_id, paymentId: v.payment };
  } catch { return { decision: "rejected", reason: "persistence" }; }
}

async function appendRetry(pool, inbox, errorCode) {
  return serializable(pool, async (c) => {
    const rows = await c.query("SELECT * FROM cw_payments.webhook_event_inbox WHERE id=$1 AND state='pending' FOR UPDATE", [inbox.id]);
    if (!rows.rowCount) return { decision: "duplicate" };
    const row = rows.rows[0];
    const count = Math.min(100, row.attempt_count + 1);
    const delay = Math.min(900, 15 * (2 ** Math.min(6, Math.max(0, count - 1))));
    await c.query(
      "UPDATE cw_payments.webhook_event_inbox SET attempt_count=$2,last_error_code=$3,next_retry_at=statement_timestamp()+($4*interval '1 second'),updated_at=statement_timestamp() WHERE id=$1",
      [row.id, count, errorCode, delay],
    );
    await appendEvent(c, {
      tenantId: row.tenant_id, projectId: row.project_id, invoiceId: row.invoice_id,
      revision: row.invoice_revision, attemptId: row.payment_attempt_id, inboxId: row.id,
      action: "event.provider_timeout", key: "provider-timeout:" + row.provider_event_id + ":" + count,
    });
    return { decision: "pending", attemptCount: count, retryAfterSeconds: delay };
  });
}

function matchesProvider(inbox, attempt, snapshotAmount, evidence) {
  let amount;
  let orderAmount;
  let paymentAmount;
  try {
    amount = BigInt(snapshotAmount);
    orderAmount = BigInt(evidence?.order?.amountPaise);
    paymentAmount = BigInt(evidence?.payment?.amountPaise);
  } catch { return false; }
  return evidence?.merchantId === SYNTHETIC_MERCHANT_ID &&
    evidence?.environment === PAYMENT_ENVIRONMENT &&
    evidence?.order?.id === attempt.order_id &&
    orderAmount === amount && evidence.order.currency === "INR" &&
    evidence?.payment?.id === inbox.payment_id &&
    evidence.payment.orderId === attempt.order_id && evidence.payment.currency === "INR" &&
    paymentAmount === amount &&
    (!attempt.payment_id || attempt.payment_id === evidence.payment.id);
}

async function rejectEvent(pool, inbox, code, reason, evidence = null) {
  try {
    await serializable(pool, async (c) => {
      const rows = await c.query("SELECT * FROM cw_payments.webhook_event_inbox WHERE id=$1 FOR UPDATE", [inbox.id]);
      if (!rows.rowCount || rows.rows[0].state !== "pending") return;
      await c.query(
        "UPDATE cw_payments.webhook_event_inbox SET state='rejected',last_error_code=$2,next_retry_at=NULL,updated_at=statement_timestamp() WHERE id=$1",
        [inbox.id, code],
      );
      await appendEvent(c, {
        tenantId: inbox.tenant_id, projectId: inbox.project_id, invoiceId: inbox.invoice_id,
        revision: inbox.invoice_revision, attemptId: inbox.payment_attempt_id, inboxId: inbox.id,
        action: "event.rejected", beforeInvoice: inbox.invoice_status, afterInvoice: inbox.invoice_status,
        beforePayment: inbox.attempt_status, afterPayment: inbox.attempt_status,
        evidenceHash: evidence ? digest(canonical(evidence)) : null,
        key: "event-rejected:" + inbox.provider_event_id,
      });
    });
    return { decision: "rejected", reason };
  } catch { return { decision: "pending", reason: "rejection-write-failed" }; }
}

/** Provider lookup is injected for synthetic tests; no HTTP client or credentials exist here. */
export async function reconcileWebhookEvent(pool, input) {
  let v;
  try { v = { eventId: input.eventId, lookupPayment: input.lookupProviderPayment, lookupRefund: input.lookupProviderRefund }; }
  catch { return { decision: "rejected", reason: "input" }; }
  if (!EVENT_ID.test(v.eventId ?? "")) return { decision: "rejected", reason: "event-id" };
  const result = await pool.query(sql([
    "SELECT w.*,a.order_id AS attempt_order_id,a.payment_id AS attempt_payment_id,a.status AS attempt_status,",
    "a.refunded_amount_paise::text AS refunded_amount_paise,s.amount_paise::text AS snapshot_amount_paise,",
    "i.current_approved_revision,i.status AS invoice_status",
    "FROM cw_payments.webhook_event_inbox w",
    "JOIN cw_payments.payment_attempts a ON a.id=w.payment_attempt_id",
    "JOIN cw_payments.approved_invoice_snapshots s ON s.tenant_id=a.tenant_id AND s.project_id=a.project_id AND s.invoice_id=a.invoice_id AND s.revision=a.invoice_revision",
    "JOIN cw_payments.payment_invoices i ON i.tenant_id=a.tenant_id AND i.project_id=a.project_id AND i.id=a.invoice_id",
    "WHERE w.merchant_id=$1 AND w.environment=$2 AND w.provider_event_id=$3",
  ]), [SYNTHETIC_MERCHANT_ID, PAYMENT_ENVIRONMENT, v.eventId]);
  if (!result.rowCount) return { decision: "rejected", reason: "unknown-event" };
  const inbox = result.rows[0];
  if (inbox.state !== "pending") return { decision: "duplicate", state: inbox.state };
  if (inbox.next_retry_at && new Date(inbox.next_retry_at).getTime() > Date.now()) return { decision: "pending", reason: "backoff-active" };
  if (inbox.current_approved_revision !== inbox.invoice_revision) return rejectEvent(pool, inbox, "invoice_revision_changed", "invoice-revision-changed");

  let evidence;
  try {
    const args = { merchantId: SYNTHETIC_MERCHANT_ID, orderId: inbox.attempt_order_id, paymentId: inbox.payment_id };
    if (inbox.event_type === "refund.processed") {
      if (typeof v.lookupRefund !== "function") return { decision: "pending", reason: "refund-lookup-required" };
      evidence = await v.lookupRefund({ ...args, refundId: inbox.refund_id });
    } else {
      if (typeof v.lookupPayment !== "function") return { decision: "pending", reason: "payment-lookup-required" };
      evidence = await v.lookupPayment(args);
    }
  } catch { return appendRetry(pool, inbox, "provider_timeout"); }

  const attempt = { order_id: inbox.attempt_order_id, payment_id: inbox.attempt_payment_id };
  if (!matchesProvider(inbox, attempt, inbox.snapshot_amount_paise, evidence)) {
    return rejectEvent(pool, inbox, "provider_mismatch", "provider-identity-or-amount-mismatch", evidence);
  }
  if (inbox.event_type === "refund.processed") {
    const r = evidence.refund;
    const remaining = Number(inbox.snapshot_amount_paise) - Number(inbox.refunded_amount_paise);
    if (!r || r.id !== inbox.refund_id || r.paymentId !== inbox.payment_id ||
        r.status !== "processed" || r.currency !== "INR" ||
        !safeInt(r.amountPaise) || r.amountPaise !== Number(inbox.payload_amount_paise) ||
        r.amountPaise > remaining || evidence.order.status !== "paid" ||
        BigInt(evidence.order.amountPaidPaise) !== BigInt(inbox.snapshot_amount_paise) ||
        !["captured", "refunded"].includes(evidence.payment.status)) {
      return rejectEvent(pool, inbox, "provider_mismatch", "provider-refund-mismatch", evidence);
    }
    return commitProviderState(pool, inbox, evidence, "refund");
  }
  const state = evidence?.payment?.status;
  if (!["authorized", "failed", "captured"].includes(state)) return appendRetry(pool, inbox, "unsupported_status");
  const settled = state === "captured";
  if (evidence.order.status !== (settled ? "paid" : "attempted") ||
      BigInt(evidence.order.amountPaidPaise) !== (settled ? BigInt(inbox.snapshot_amount_paise) : 0n)) {
    return settled ? appendRetry(pool, inbox, "provider_timeout")
      : rejectEvent(pool, inbox, "provider_mismatch", "provider-order-state-mismatch", evidence);
  }
  return commitProviderState(pool, inbox, evidence, state);
}

async function commitProviderState(pool, inbox, evidence, providerState) {
  try {
    return await serializable(pool, async (c) => {
      const locked = await c.query(sql([
        "SELECT w.*,a.status AS attempt_status,a.payment_id AS attempt_payment_id,a.refunded_amount_paise::text,",
        "i.status AS invoice_status,i.current_approved_revision,s.amount_paise::text AS snapshot_amount_paise",
        "FROM cw_payments.webhook_event_inbox w JOIN cw_payments.payment_attempts a ON a.id=w.payment_attempt_id",
        "JOIN cw_payments.payment_invoices i ON i.tenant_id=a.tenant_id AND i.project_id=a.project_id AND i.id=a.invoice_id",
        "JOIN cw_payments.approved_invoice_snapshots s ON s.tenant_id=a.tenant_id AND s.project_id=a.project_id AND s.invoice_id=a.invoice_id AND s.revision=a.invoice_revision",
        "WHERE w.id=$1 FOR UPDATE OF w,a,i",
      ]), [inbox.id]);
      if (!locked.rowCount || locked.rows[0].state !== "pending") return { decision: "duplicate" };
      const row = locked.rows[0];
      if (row.current_approved_revision !== row.invoice_revision) throw new Error("invoice revision changed");
      const beforePayment = row.attempt_status;
      const beforeInvoice = row.invoice_status;
      let nextPayment = providerState;
      let nextInvoice = beforeInvoice;
      let refundedTotal = Number(row.refunded_amount_paise);
      let action = providerState === "refund" ? "payment.refunded" : "payment." + providerState;

      if (providerState === "refund") {
        refundedTotal += Number(evidence.refund.amountPaise);
        if (refundedTotal > Number(row.snapshot_amount_paise)) throw new Error("refund exceeds invoice");
        nextPayment = refundedTotal === Number(row.snapshot_amount_paise) ? "refunded" : "partially_refunded";
        nextInvoice = nextPayment;
        action = nextPayment === "refunded" ? "payment.refunded" : "payment.partial_refund";
      }
      const oldRank = STATE_RANK[beforePayment];
      const newRank = STATE_RANK[nextPayment];
      if (newRank < oldRank || (newRank === oldRank && nextPayment !== beforePayment)) {
        nextPayment = beforePayment;
        nextInvoice = beforeInvoice;
        refundedTotal = Number(row.refunded_amount_paise);
        action = "event.stale_ignored";
      } else if (nextPayment === "captured") {
        if (beforeInvoice === "due") nextInvoice = "paid";
        else if (beforeInvoice !== "paid") throw new Error("invoice not payable");
      } else if (nextPayment === "refunded" || nextPayment === "partially_refunded") {
        if (!["paid", "partially_refunded", "refunded"].includes(beforeInvoice)) throw new Error("refund without paid invoice");
      }

      await c.query(
        "UPDATE cw_payments.payment_attempts SET status=$2,payment_id=COALESCE(payment_id,$3),refunded_amount_paise=$4,updated_at=statement_timestamp() WHERE id=$1",
        [row.payment_attempt_id, nextPayment, row.payment_id, refundedTotal],
      );
      if (nextInvoice !== beforeInvoice) {
        await c.query(
          "UPDATE cw_payments.payment_invoices SET status=$1,updated_at=statement_timestamp() WHERE tenant_id=$2 AND project_id=$3 AND id=$4 AND status=$5",
          [nextInvoice, row.tenant_id, row.project_id, row.invoice_id, beforeInvoice],
        );
      }
      await c.query(
        "UPDATE cw_payments.webhook_event_inbox SET state='reconciled',attempt_count=attempt_count+1,last_error_code=NULL,next_retry_at=NULL,updated_at=statement_timestamp() WHERE id=$1 AND state='pending'",
        [row.id],
      );
      await appendEvent(c, {
        tenantId: row.tenant_id, projectId: row.project_id, invoiceId: row.invoice_id,
        revision: row.invoice_revision, attemptId: row.payment_attempt_id, inboxId: row.id,
        action, beforeInvoice, afterInvoice: nextInvoice, beforePayment, afterPayment: nextPayment,
        evidenceHash: digest(canonical(evidence)), key: "event-reconciled:" + row.provider_event_id,
      });
      return { decision: "reconciled", action, paymentStatus: nextPayment, invoiceStatus: nextInvoice };
    });
  } catch (error) {
    if (error?.message === "invoice revision changed") return rejectEvent(pool, inbox, "invoice_revision_changed", "invoice-revision-changed", evidence);
    return { decision: "pending", reason: "transaction-failed" };
  }
}
