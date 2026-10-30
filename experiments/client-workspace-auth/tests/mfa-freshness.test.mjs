import assert from "node:assert/strict";
import test from "node:test";
import { maxMfaAgeSecondsForAction } from "../src/mfa-freshness.ts";

test("read-only actions require assurance no older than 12 hours", () => {
  for (const action of [
    "project.read_published", "proposal.read_published", "milestone.read_published",
    "invoice.read_published", "document.read_published", "project.read_internal",
  ]) {
    assert.equal(maxMfaAgeSecondsForAction(action), 43_200, action);
  }
});

test("routine changes require assurance no older than 15 minutes", () => {
  for (const action of ["brief.edit", "change.request", "brief.review", "delivery.edit"]) {
    assert.equal(maxMfaAgeSecondsForAction(action), 900, action);
  }
});

test("high-impact and financial decisions require assurance no older than 5 minutes", () => {
  for (const action of [
    "proposal.decide", "milestone.accept", "contract.sign", "estimate.approve",
    "milestone.verify", "progress.publish", "proposal.approve_price",
    "invoice.approve", "payment.reconcile", "proposal.release",
    "project.activate", "project.close",
  ]) {
    assert.equal(maxMfaAgeSecondsForAction(action), 300, action);
  }
});

test("unknown, malformed or newly introduced actions fail closed", () => {
  for (const action of [undefined, null, "", "project.read_all", "session.forge", 123, {}, []]) {
    assert.equal(maxMfaAgeSecondsForAction(action), null);
  }
});
