import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
let modelUrl;
const load = async name => {
  const source=await readFile(new URL(`../prototypes/client-progress/${name}`,import.meta.url),'utf8');
  let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
  if (name === 'fixtures.ts') js=js.replace(/(['"])\.\/model\.js\1/g, JSON.stringify(modelUrl));
  const url=`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  if (name === 'model.ts') modelUrl=url;
  return import(url);
};
const {projectClient,approveFixtureRevisions}=await load('model.ts');
const {fixture,scenarios}=await load('fixtures.ts');
function project(scenario='active') { const v=projectClient(fixture(scenario));assert.equal(v.kind,'project');return v.project; }
test('published approved summary appears; internal fields never cross allowlist',()=>{
  const source=fixture('active');source.secret='UNEXPECTED_PRIVATE_FIELD';source.updates[0].review.secret='PRIVATE_REVIEW';
  const json=JSON.stringify(projectClient(source));
  assert.match(json,/customer journey/);assert.doesNotMatch(json,/INTERNAL_ONLY|UNEXPECTED_PRIVATE_FIELD|PRIVATE_REVIEW|repository|commit|pullRequest|logs|evidence|verifiedBy|approvedBy|approvedRevision/);
  assert.deepEqual(Object.keys(project().updates[0]).sort(),['publishedAt','summary','verifiedAt']);
});
for (const name of ['unpublished','mismatched']) test(`${name} evidence does not become client update`,()=>assert.equal(project(name).updates.length,0));
for (const field of ['verifiedBy','verifiedAt','approvedBy','publishedAt']) test(`missing ${field} denies publication`,()=>{
  const source=fixture('active');source.updates[0].review[field]=null;
  assert.equal(projectClient(source).project.updates.length,0);
});
test('publication before verification is rejected',()=>{
  const source=fixture('active');source.updates[0].review.verifiedAt='2031-01-01T00:00:00Z';
  assert.equal(projectClient(source).project.updates.length,0);
});
test('merged PR without verification never completes milestone',()=>{
  const source=fixture('active');source.updates[0].review.verifiedBy=null;
  const p=projectClient(source).project;assert.equal(p.updates.length,0);assert.equal(p.milestones[1].status,'in_progress');
});
test('successful or failed CI does not accept a milestone',()=>{
  for(const ci of ['passed','failed']){const source=fixture('active');source.updates[0].evidence.ci=ci;
    assert.equal(projectClient(source).project.milestones[1].status,'in_progress');}
});
test('accepted state needs separate valid client acceptance record',()=>{
  const source=fixture('accepted');assert.equal(projectClient(source).project.milestones[1].status,'accepted');
  source.milestones[1].acceptance=null;assert.equal(projectClient(approveFixtureRevisions(source)).project.milestones[1].status,'awaiting_client');
  source.milestones[1].acceptance={clientApprover:'',at:'invalid'};assert.equal(projectClient(approveFixtureRevisions(source)).project.milestones[1].status,'awaiting_client');
});
test('unpublished milestones, dependencies and deliverables are excluded',()=>{
  const source=fixture('active');source.milestones[1].review.publishedAt=null;
  const p=projectClient(source).project;assert(!p.milestones.some(m=>m.id==='design'));assert.deepEqual(p.milestones.find(m=>m.id==='build').dependencies,['owner-confirmation']);assert.equal(p.deliverables.length,0);assert.equal(p.updates.length,0);
});
test('unpublished deliverables never appear',()=>assert.equal(project('unpublished').deliverables.length,0));
for (const mode of ['access-denied','loading','error']) test(`${mode} contains no project payload`,()=>{
  assert.deepEqual(projectClient(fixture('active'),mode),{kind:mode});
});
test('reconnect does not publish draft updates or change published milestones',()=>{
  let source=fixture('unpublished');source.sync.state='disconnected';source=approveFixtureRevisions(source);const before=projectClient(source).project;
  source.sync.state='connected';assert.deepEqual(projectClient(source),{kind:'error'});const after=projectClient(approveFixtureRevisions(source)).project;
  assert.deepEqual(after.updates,before.updates);assert.deepEqual(after.milestones,before.milestones);
});
test('stale/disconnected preserve publication and distinguish source time',()=>{
  for(const kind of ['stale','disconnected']) {const p=project(kind);assert.equal(p.sourceState,kind);assert.equal(p.updates.length,1);assert.notEqual(p.lastPublished,p.lastEngineeringSync);assert.equal(p.milestones[1].status,'in_progress');}
});
test('delayed targets retain the approved baseline without guessing a revision',()=>{
  const p=project('blocked-delayed');assert.equal(p.milestones[1].approvedDate,project().milestones[1].approvedDate);assert.match(p.milestones[1].explanation,/revised date awaits human approval/);
});
for(const [scenario,status] of [['active','in_progress'],['in-review','in_review'],['qa','QA'],['awaiting-client','awaiting_client'],['blocked-delayed','blocked'],['paused','paused'],['accepted','accepted'],['no-activity','planned']]) test(`${scenario} milestone state`,()=>assert.equal(project(scenario).milestones[1].status,status));
test('empty project has honest empty updates and no deliverables',()=>{const p=project('no-activity');assert.equal(p.lastPublished,null);assert.equal(p.updates.length,0);assert.equal(p.deliverables.length,0);});
test('change request is visible without implied date or scope approval',()=>{const p=project('changes-requested');assert.equal(p.deliverables[0].state,'Changes requested');assert.match(p.nextAction,/No new date or scope/);});
test('every fixture projection leaves source unchanged',()=>{for(const name of scenarios){const source=fixture(name);const before=JSON.stringify(source);projectClient(source);assert.equal(JSON.stringify(source),before);}});

test('unknown event milestone and mismatched evidence milestone stay internal',()=>{
  for(const mismatch of ['unmapped','wrong-evidence']) { const s=fixture('active');
    if(mismatch==='unmapped')s.updates[0].milestoneId='INTERNAL_ONLY_UNKNOWN';else s.updates[0].evidence.milestoneId='INTERNAL_ONLY_UNKNOWN';
    const json=JSON.stringify(projectClient(s));assert.equal(projectClient(s).project.updates.length,0);assert.doesNotMatch(json,/INTERNAL_ONLY/);
  }
});
test('unapproved arbitrary artifact destination is not shared',()=>{const s=fixture('active');s.deliverables[0].artifact='https://private.example.test/secret';assert.equal(projectClient(s).project.deliverables.length,0);});

// Publication integrity regression: existing approval metadata cannot authorize edits.
for (const field of ['name','client','owner','status','nextAction']) test(`post-publication overview ${field} edit is denied`,()=>{
  const source=fixture('active');source[field]=field==='status'?'Active':'INTERNAL_ONLY_UNREVIEWED';
  assert.deepEqual(projectClient(source),{kind:'error'});
});
for (const field of ['title','owner','approvedDate','status','explanation']) test(`post-publication milestone ${field} edit is hidden`,()=>{
  const source=fixture('active');source.milestones[1][field]=field==='status'?'accepted':'INTERNAL_ONLY_UNREVIEWED';
  const p=projectClient(source).project;
  assert(!p.milestones.some(m=>m.id==='design'));assert.equal(p.updates.length,0);assert.equal(p.deliverables.length,0);
  assert.doesNotMatch(JSON.stringify(p),/INTERNAL_ONLY/);
});
for (const field of ['title','state','reviewerNote','artifact']) test(`post-publication deliverable ${field} edit is hidden`,()=>{
  const source=fixture('active');source.deliverables[0][field]=field==='state'?'Accepted by Alex Example':'INTERNAL_ONLY_UNREVIEWED';
  assert.equal(projectClient(source).project.deliverables.length,0);
  assert.doesNotMatch(JSON.stringify(projectClient(source)),/INTERNAL_ONLY/);
});
test('post-publication update summary and publication timestamp edits are hidden',()=>{
  for(const edit of [s=>{s.updates[0].safeSummary='INTERNAL_ONLY_UNREVIEWED';},s=>{s.updates[0].review.publishedAt='2030-01-16T11:00:00Z';}]){
    const source=fixture('active');edit(source);const p=projectClient(source).project;
    assert.equal(p.updates.length,0);assert.equal(p.lastPublished,null);assert.doesNotMatch(JSON.stringify(p),/INTERNAL_ONLY/);
  }
});
test('post-publication dependency and acceptance mutations cannot pass old approvals',()=>{
  const source=fixture('active');source.milestones[1].dependencies.push('INTERNAL_ONLY_DEPENDENCY');
  assert(!projectClient(source).project.milestones.some(m=>m.id==='design'));
  const accepted=fixture('accepted');accepted.milestones[1].acceptance.clientApprover='INTERNAL_ONLY_APPROVER';
  assert(!projectClient(accepted).project.milestones.some(m=>m.id==='design'));
});
test('review tokens are required and cannot be reused across objects or projects',()=>{
  const source=fixture('active');source.review.approvedRevision=null;
  assert.deepEqual(projectClient(source),{kind:'error'});
  const other=fixture('active');other.milestones[1].review.approvedRevision=other.milestones[0].review.approvedRevision;
  assert(!projectClient(other).project.milestones.some(m=>m.id==='design'));
  const moved=fixture('active');moved.id='another-project';assert.deepEqual(projectClient(moved),{kind:'error'});
});
test('only explicit approval of the exact new revision reveals edited content',()=>{
  const source=fixture('active');const oldRevision=source.review.approvedRevision;
  source.nextAction='Review the revised journey';source.status='Awaiting your review';
  source.milestones[1].explanation='Approved design revision is ready';source.milestones[1].status='awaiting_client';
  source.updates[0].safeSummary='The revised journey is ready for review.';
  source.deliverables[0].reviewerNote='Please review the revised journey';source.deliverables[0].state='Awaiting client review';
  assert.deepEqual(projectClient(source),{kind:'error'});
  const approved=approveFixtureRevisions(source);const p=projectClient(approved).project;
  assert.notEqual(approved.review.approvedRevision,oldRevision);
  assert.equal(p.nextAction,source.nextAction);assert.equal(p.status,source.status);
  assert.equal(p.milestones[1].explanation,source.milestones[1].explanation);assert.equal(p.milestones[1].status,'awaiting_client');
  assert.equal(p.updates[0].summary,source.updates[0].safeSummary);
  assert.equal(p.deliverables[0].reviewerNote,source.deliverables[0].reviewerNote);assert.equal(p.deliverables[0].state,'Awaiting client review');
  approved.nextAction='Another unapproved edit';assert.deepEqual(projectClient(approved),{kind:'error'});
});
test('revision approval helper neither mutates its input nor invents publication authority',()=>{
  const source=fixture('unpublished');const before=JSON.stringify(source);const renewed=approveFixtureRevisions(source);
  assert.equal(JSON.stringify(source),before);assert.equal(projectClient(renewed).project.updates.length,0);
  renewed.review.approvedBy=null;assert.deepEqual(projectClient(approveFixtureRevisions(renewed)),{kind:'error'});
});
