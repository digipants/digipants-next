import type { WorkspaceAction } from "../../../lib/client-workspace/access-policy.ts";

// Experimental policy limits, not production-approved session durations.
// A verified second factor is necessary but not sufficient: each protected
// action needs an assurance timestamp recent enough for its consequence.
// All unknown actions are denied; no default permissive age is returned.
const READ_ACTIONS: ReadonlySet<WorkspaceAction> = new Set([
  "project.read_published",
  "proposal.read_published",
  "milestone.read_published",
  "invoice.read_published",
  "document.read_published",
  "project.read_internal",
]);

const ROUTINE_ACTIONS: ReadonlySet<WorkspaceAction> = new Set([
  "brief.edit",
  "change.request",
  "brief.review",
  "delivery.edit",
]);

const HIGH_IMPACT_ACTIONS: ReadonlySet<WorkspaceAction> = new Set([
  "proposal.decide",
  "milestone.accept",
  "contract.sign",
  "estimate.approve",
  "milestone.verify",
  "progress.publish",
  "proposal.approve_price",
  "invoice.approve",
  "payment.reconcile",
  "proposal.release",
  "project.activate",
  "project.close",
]);

export function maxMfaAgeSecondsForAction(action: unknown): number | null {
  if (typeof action !== "string") return null;
  if (HIGH_IMPACT_ACTIONS.has(action as WorkspaceAction)) return 5 * 60;
  if (ROUTINE_ACTIONS.has(action as WorkspaceAction)) return 15 * 60;
  if (READ_ACTIONS.has(action as WorkspaceAction)) return 12 * 60 * 60;
  return null;
}
