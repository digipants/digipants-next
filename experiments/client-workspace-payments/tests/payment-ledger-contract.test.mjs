import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertDisposablePaymentsDatabaseUrl } from "../test-target.mjs";

test("payment database guard accepts only the named loopback disposable database", () => {
  assert.equal(assertDisposablePaymentsDatabaseUrl("postgresql://test:local@127.0.0.1:5432/cw_payments_test").hostname, "127.0.0.1");
  assert.throws(() => assertDisposablePaymentsDatabaseUrl("postgresql://test:local@db.example.com/cw_payments_test"));
  assert.throws(() => assertDisposablePaymentsDatabaseUrl("postgresql://test:local@127.0.0.1/cw_payments_shadow"));
  assert.throws(() => assertDisposablePaymentsDatabaseUrl("postgresql://test:local@127.0.0.1/cw_payments_test?host=prod.example.com"));
});

test("the isolated ledger has no application route, real gateway client, or credentials", async () => {
  const moduleText = await readFile(new URL("../payment-ledger.mjs", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../../../.github/workflows/client-workspace-payments.yml", import.meta.url), "utf8").catch(() => "");
  assert.doesNotMatch(moduleText, /fetch\s*\(|https?:\/\//);
  assert.doesNotMatch(moduleText, /process\.env|NEXT_PUBLIC_/);
  assert.match(moduleText, /lookupProviderPayment/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.match(workflow, /Verify the slice remains isolated from application routes and production configuration/);
});
