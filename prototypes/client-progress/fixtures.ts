import { approveFixtureRevisions } from './model.js';
import type { InternalProject, Review, Scenario } from './model.js';
export const scenarios: Scenario[] = ['active','in-review','qa','changes-requested','awaiting-client','blocked-delayed','paused','no-activity','unpublished','mismatched','disconnected','stale','accepted','loading','error','access-denied'];
const published: Review = { approvedRevision: null, verifiedBy: 'delivery-lead', verifiedAt: '2030-01-15T10:00:00Z', approvedBy: 'publication-owner', publishedAt: '2030-01-15T11:00:00Z' };
export function fixture(scenario: Scenario): InternalProject {
  const source: InternalProject = {
    review: {...published},
    id: 'example-project', name: 'A better customer experience', client: 'Example Studio · studio@example.test',
    owner: 'Morgan Example · owner@example.test', status: 'In progress', nextAction: 'DigiPants is preparing the next design review. No action needed from you today.',
    milestones: [
      { id: 'scope', title: 'Direction & discovery', owner: 'Morgan Example', approvedDate: '2030-01-10', dependencies: [], status: 'accepted', review: {...published}, explanation: 'Scope and success criteria agreed.', acceptance: {clientApprover:'Alex Example',at:'2030-01-12T10:00:00Z'} },
      { id: 'design', title: 'Customer journey & design', owner: 'Taylor Example', approvedDate: '2030-01-22', dependencies: ['scope'], status: 'in_progress', review: {...published}, explanation: 'Design refinement underway; review is the next step.', acceptance: null },
      { id: 'build', title: 'Build & quality review', owner: 'Jordan Example', approvedDate: '2030-02-05', dependencies: ['design'], status: 'planned', review: {...published}, explanation: 'Begins after the design review.', acceptance: null },
      { id: 'handover', title: 'Client review & handover', owner: 'Morgan Example', approvedDate: '2030-02-12', dependencies: ['build'], status: 'planned', review: {...published}, explanation: 'Client acceptance is a separate review.', acceptance: null },
    ],
    updates: [{id:'update-1',projectId:'example-project',milestoneId:'design',safeSummary:'The customer journey has been reviewed by DigiPants. Design refinement is underway before your next review.',review:{...published},evidence:{repository:'INTERNAL_ONLY_REPOSITORY',commit:'INTERNAL_ONLY_COMMIT',issue:'INTERNAL_ONLY_ISSUE',pullRequest:'INTERNAL_ONLY_PR',logs:'INTERNAL_ONLY_LOG',notes:'INTERNAL_ONLY_NOTE',projectId:'example-project',milestoneId:'design',merged:true,ci:'passed'}}],
    deliverables: [{title:'Customer journey outline',milestoneId:'design',artifact:'design',state:'Published for reference',reviewerNote:'Reviewed by Morgan Example. Design review will follow.',review:{...published}}],
    sync: {state:'connected',at:'2030-01-15T09:00:00Z'},
  };
  const design = source.milestones[1];
  if (scenario === 'in-review') design.status='in_review';
  if (scenario === 'qa') { design.status='QA'; design.explanation='Quality review is underway. Passing technical checks does not record client acceptance.'; }
  if (scenario === 'changes-requested') { design.status='in_review'; source.status='Reviewing your feedback'; source.nextAction='Morgan is assessing your requested changes. No new date or scope is committed.'; source.deliverables[0].state='Changes requested'; source.deliverables[0].reviewerNote='Client asked to clarify the enquiry journey. Impact review pending.'; }
  if (scenario === 'awaiting-client') { design.status='awaiting_client'; source.status='Awaiting your review'; source.nextAction='Review the customer journey and share your feedback with Morgan.'; source.deliverables[0].state='Awaiting client review'; source.deliverables[0].reviewerNote='Please confirm the journey or describe the changes needed. No acceptance is recorded here.'; }
  if (scenario === 'blocked-delayed') { design.status='blocked'; source.status='Delayed · awaiting assets'; source.nextAction='Please supply approved brand assets to Morgan.'; design.explanation='Blocked by missing brand assets. Original approved target retained; revised date awaits human approval.'; }
  if (scenario === 'paused') { design.status='paused'; source.status='Paused'; source.nextAction='Morgan will confirm the restart plan with you.'; design.explanation='Paused by agreement while scope is reviewed. No revised date is approved.'; }
  if (scenario === 'accepted') { design.status='accepted'; design.acceptance={clientApprover:'Alex Example',at:'2030-01-15T10:30:00Z'}; design.explanation='Client acceptance recorded separately after review.'; source.deliverables[0].state='Accepted by Alex Example'; }
  if (scenario === 'no-activity') { source.updates=[];source.deliverables=[];source.status='Planned';source.nextAction='Morgan will publish a verified update when available.';source.milestones.forEach(m=>{m.status='planned';m.acceptance=null;}); }
  if (scenario === 'unpublished') { source.updates[0].review.publishedAt=null;source.deliverables[0].review.publishedAt=null; }
  if (scenario === 'mismatched') { source.updates[0].evidence.projectId='another-project';source.deliverables=[]; }
  if (scenario === 'disconnected' || scenario === 'stale') source.sync={state:scenario,at:'2030-01-08T09:00:00Z'};
  return approveFixtureRevisions(source);
}
