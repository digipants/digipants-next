export type MilestoneStatus = 'planned' | 'in_progress' | 'in_review' | 'QA' | 'awaiting_client' | 'accepted' | 'blocked' | 'paused';
export type Scenario = 'active' | 'in-review' | 'qa' | 'changes-requested' | 'awaiting-client' | 'blocked-delayed' | 'paused' | 'no-activity' | 'unpublished' | 'mismatched' | 'disconnected' | 'stale' | 'accepted' | 'loading' | 'error' | 'access-denied';
export interface InternalEvidence {
  repository: string; commit: string; issue: string; pullRequest: string; logs: string;
  notes: string; projectId: string; milestoneId: string; merged: boolean; ci: 'passed' | 'failed';
}
export interface Review {
  verifiedBy: string | null; verifiedAt: string | null;
  approvedBy: string | null; publishedAt: string | null;
  approvedRevision: string | null;
}
export interface Milestone {
  id: string; title: string; owner: string; approvedDate: string; dependencies: string[];
  status: MilestoneStatus; review: Review; explanation: string;
  acceptance: { clientApprover: string; at: string } | null;
}
export interface InternalProject {
  id: string; name: string; client: string; owner: string; status: string; nextAction: string;
  review: Review;
  milestones: Milestone[];
  updates: { id: string; projectId: string; milestoneId: string; safeSummary: string; review: Review; evidence: InternalEvidence }[];
  deliverables: { title: string; milestoneId: string; artifact: 'design' | 'review'; state: string; reviewerNote: string; review: Review }[];
  sync: { state: 'connected' | 'disconnected' | 'stale'; at: string };
}
export interface ClientProject {
  name: string; client: string; owner: string; status: string; nextAction: string;
  milestones: { id: string; title: string; owner: string; approvedDate: string; dependencies: string[]; status: MilestoneStatus; explanation: string }[];
  updates: { summary: string; verifiedAt: string; publishedAt: string }[];
  deliverables: { title: string; artifact: 'design' | 'review'; state: string; reviewerNote: string }[];
  lastPublished: string | null; lastEngineeringSync: string; sourceState: 'connected' | 'disconnected' | 'stale';
}
export type ClientView = { kind: 'access-denied' | 'loading' | 'error' } | { kind: 'project'; project: ClientProject };
// Canonical, domain-separated exact-content tokens, not cryptographic signatures.
// Every client-visible value and mapping context is bound to its review.
function reviewIdentity(review: Review): (string | null)[] {
  return [review.verifiedBy, review.verifiedAt, review.approvedBy, review.publishedAt];
}
function overviewRevision(source: InternalProject): string {
  return JSON.stringify(['overview-v1', source.id, source.name, source.client, source.owner,
    source.status, source.nextAction, source.sync.state, source.sync.at, reviewIdentity(source.review)]);
}
function milestoneRevision(projectId: string, m: Milestone): string {
  return JSON.stringify(['milestone-v1', projectId, m.id, m.title, m.owner, m.approvedDate,
    m.dependencies, m.status, m.explanation,
    m.acceptance ? [m.acceptance.clientApprover, m.acceptance.at] : null, reviewIdentity(m.review)]);
}
function updateRevision(u: InternalProject['updates'][number]): string {
  return JSON.stringify(['update-v1', u.id, u.projectId, u.milestoneId, u.safeSummary,
    u.evidence.projectId, u.evidence.milestoneId, reviewIdentity(u.review)]);
}
function deliverableRevision(projectId: string, d: InternalProject['deliverables'][number]): string {
  return JSON.stringify(['deliverable-v1', projectId, d.milestoneId, d.title, d.artifact, d.state, d.reviewerNote, reviewIdentity(d.review)]);
}
// Explicit fixture-author approval step; never called by projection or reconnect.
// Retains approval actors/times, including nulls; it cannot publish an unreviewed draft.
export function approveFixtureRevisions(source: InternalProject): InternalProject {
  return {
    ...source, review: { ...source.review, approvedRevision: overviewRevision(source) },
    milestones: source.milestones.map(m => ({ ...m, review: { ...m.review, approvedRevision: milestoneRevision(source.id, m) } })),
    updates: source.updates.map(u => ({ ...u, review: { ...u.review, approvedRevision: updateRevision(u) } })),
    deliverables: source.deliverables.map(d => ({ ...d, review: { ...d.review, approvedRevision: deliverableRevision(source.id, d) } })),
  };
}
function approved(review: Review, revision: string): boolean {
  const verified = Date.parse(review.verifiedAt ?? '');
  const published = Date.parse(review.publishedAt ?? '');
  return review.approvedRevision === revision && Boolean(review.verifiedBy && review.approvedBy && Number.isFinite(verified) && Number.isFinite(published) && verified <= published);
}
// Explicit field construction. Never spread internal objects into a client payload.
export function projectClient(source: InternalProject, view: 'project' | 'access-denied' | 'loading' | 'error' = 'project'): ClientView {
  if (view !== 'project') return { kind: view };
  if (!approved(source.review, overviewRevision(source))) return { kind: 'error' };
  const visible = source.milestones.filter(m => approved(m.review, milestoneRevision(source.id, m)));
  const ids = new Set(visible.map(m => m.id));
  const updates = source.updates.filter(u => u.projectId === source.id && ids.has(u.milestoneId) &&
    u.evidence.projectId === source.id && u.evidence.milestoneId === u.milestoneId && approved(u.review, updateRevision(u)))
    .map(u => ({ summary: u.safeSummary, verifiedAt: u.review.verifiedAt!, publishedAt: u.review.publishedAt! }))
    .sort((a,b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return { kind: 'project', project: {
    name: source.name, client: source.client, owner: source.owner, status: source.status, nextAction: source.nextAction,
    milestones: visible.map(m => ({ id: m.id, title: m.title, owner: m.owner, approvedDate: m.approvedDate,
      dependencies: m.dependencies.map(id => ids.has(id) ? id : 'owner-confirmation'),
      status: m.status === 'accepted' && !(m.acceptance?.clientApprover && Number.isFinite(Date.parse(m.acceptance.at))) ? 'awaiting_client' : m.status,
      explanation: m.explanation })),
    updates, deliverables: source.deliverables.filter(d => ids.has(d.milestoneId) && ['design','review'].includes(d.artifact) && approved(d.review, deliverableRevision(source.id, d)))
      .map(d => ({ title: d.title, artifact: d.artifact, state: d.state, reviewerNote: d.reviewerNote })),
    lastPublished: updates[0]?.publishedAt ?? null, lastEngineeringSync: source.sync.at, sourceState: source.sync.state,
  } };
}
