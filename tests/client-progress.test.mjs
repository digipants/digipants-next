import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const load = async name => {
  const source=await readFile(new URL(`../prototypes/client-progress/${name}`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const {projectClient}=await load('model.ts');
const {fixture,scenarios}=await load('fixtures.ts');
function project(scenario='active') { const v=projectClient(fixture(scenario));assert.equal(v.kind,'project');return v.project; }
test('published approved summary appears; internal fields never cross allowlist',()=>{
  const source=fixture('active');source.secret='UNEXPECTED_PRIVATE_FIELD';source.updates[0].review.secret='PRIVATE_REVIEW';
  const json=JSON.stringify(projectClient(source));
  assert.match(json,/customer journey/);assert.doesNotMatch(json,/INTERNAL_ONLY|UNEXPECTED_PRIVATE_FIELD|PRIVATE_REVIEW|repository|commit|pullRequest|logs|evidence|verifiedBy|approvedBy/);
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
  source.milestones[1].acceptance=null;assert.equal(projectClient(source).project.milestones[1].status,'awaiting_client');
  source.milestones[1].acceptance={clientApprover:'',at:'invalid'};assert.equal(projectClient(source).project.milestones[1].status,'awaiting_client');
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
  const source=fixture('unpublished');source.sync.state='disconnected';const before=projectClient(source).project;
  source.sync.state='connected';const after=projectClient(source).project;
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
