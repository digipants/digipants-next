import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const code = await readFile(new URL('../lib/client-workspace/access-policy.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { evaluateWorkspaceAccess: evaluate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const actor = { userId: 'user-1', authenticated: true, status: 'active' };
const resource = { tenantId: 'client-a', projectId: 'project-1', publication: 'published' };
const grant = (role, extra = {}) => ({userId:actor.userId,tenantId:resource.tenantId,projectId:resource.projectId,role,status:'active',...extra});
const check = (action, role = 'client_viewer', extra = {}) => evaluate({actor,resource,action,grants:[grant(role)],...extra});
const denied = result => assert.equal(result.allowed,false);

for (const [role,action] of [
  ['client_viewer','project.read_published'],
  ['client_contributor','brief.edit'],
  ['client_contributor','change.request'],
  ['client_approver','proposal.decide'],
  ['client_approver','milestone.accept'],
  ['client_signatory','contract.sign'],
  ['delivery_staff','delivery.edit'],
  ['delivery_lead','progress.publish'],
  ['delivery_lead','estimate.approve'],
  ['commercial_approver','proposal.approve_price'],
  ['commercial_approver','invoice.approve'],
  ['commercial_approver','payment.reconcile'],
  ['workspace_owner','proposal.release'],
  ['workspace_owner','project.activate'],
  ['workspace_owner','project.close'],
]) test(`${role} allowed ${action} only through project grant`,()=>assert.equal(check(action,role).allowed,true));

for (const [role,action] of [
  ['client_viewer','brief.edit'],
  ['client_viewer','proposal.decide'],
  ['client_contributor','proposal.decide'],
  ['client_signatory','proposal.decide'],
  ['client_approver','contract.sign'],
  ['client_approver','progress.publish'],
  ['delivery_staff','progress.publish'],
  ['delivery_lead','proposal.approve_price'],
  ['commercial_approver','milestone.verify'],
  ['workspace_owner','proposal.approve_price'],
  ['workspace_owner','contract.sign'],
  ['workspace_owner','payment.reconcile'],
]) test(`${role} denied ${action} without explicit role`,()=>denied(check(action,role)));

test('anonymous, disabled or invalid identity is always denied',()=>{
  for (const bad of [null,{}, {userId:'user-1',authenticated:false,status:'active'},
    {userId:'user-1',authenticated:true,status:'disabled'}, {userId:'',authenticated:true,status:'active'}]) {
    denied(check('project.read_published','client_viewer',{actor:bad}));
  }
});
test('empty, missing, revoked or other-user project grants deny',()=>{
  for(const grants of [[],null,[grant('client_viewer',{status:'revoked'})],[grant('client_viewer',{userId:'user-2'})],
    [grant('client_viewer',{projectId:'project-2'})],[grant('client_viewer',{tenantId:'client-b'})]]){
    denied(check('project.read_published','client_viewer',{grants}));
  }
});
test('same project id in another tenant does not grant access',()=>{
  denied(check('project.read_published','client_viewer',{resource:{...resource,tenantId:'client-b'}}));
});
test('unpublished project details and decisions never pass client-role checks',()=>{
  for (const action of ['project.read_published','proposal.read_published','invoice.read_published',
    'document.read_published','milestone.read_published','proposal.decide','milestone.accept','change.request','contract.sign']){
    denied(check(action,'client_approver',{resource:{...resource,publication:'unpublished'}}));
  }
  assert.equal(check('brief.edit','client_contributor',{resource:{...resource,publication:'unpublished'}}).allowed,true);
});
test('staff publication and staff edits require explicit project grants but not published status',()=>{
  assert.equal(check('progress.publish','delivery_lead',{resource:{...resource,publication:'unpublished'}}).allowed,true);
  denied(check('progress.publish','delivery_lead',{grants:[grant('delivery_lead',{projectId:'unassigned'})]}));
});
test('different explicitly granted roles combine without crossing projects',()=>{
  const grants=[grant('client_signatory'),grant('client_approver'),grant('workspace_owner',{projectId:'project-2'})];
  assert.equal(check('contract.sign','client_viewer',{grants}).allowed,true);
  assert.equal(check('proposal.decide','client_viewer',{grants}).allowed,true);
  denied(check('project.activate','client_viewer',{grants}));
});
test('unknown role, action, wildcard grants and spoofed metadata fail closed',()=>{
  for(const grants of [[grant('superadmin')],[grant('client_viewer',{projectId:'*'})],
    [grant('client_viewer',{role:'workspace_owner',status:'disabled'})]]){
    denied(check('project.read_published','client_viewer',{grants}));
  }
  for(const action of ['unknown.action','__proto__','project.read_published\n'])denied(check(action));
});
test('malformed contexts, identifiers and visibility fail closed',()=>{
  for(const bad of [null,{}, {actor}, {actor,resource,action:'project.read_published'},
    {actor,resource:{...resource,tenantId:'../other'},action:'project.read_published',grants:[grant('client_viewer')]},
    {actor,resource:{...resource,projectId:''},action:'project.read_published',grants:[grant('client_viewer')]},
    {actor,resource:{...resource,publication:'other'},action:'project.read_published',grants:[grant('client_viewer')]}])
    denied(evaluate(bad));
});
test('throwing accessors and proxies fail closed without escaping',()=>{
  const throwing={get userId(){throw new Error('untrusted actor accessor')}};
  denied(check('project.read_published','client_viewer',{actor:throwing}));
  const badGrant={...grant('client_viewer'),get role(){throw new Error('untrusted grant accessor')}};
  denied(check('project.read_published','client_viewer',{grants:[badGrant]}));
  const badResource={...resource,get publication(){throw new Error('untrusted resource accessor')}};
  denied(check('project.read_published','client_viewer',{resource:badResource}));
  const badProxy=new Proxy({}, { get(){throw new Error('untrusted proxy')} });
  denied(evaluate(badProxy));
  const revokedProxy=Proxy.revocable({},{});revokedProxy.revoke();
  denied(evaluate(revokedProxy.proxy));
});
test('changing action getter cannot switch from a validated action to an authorized one',()=>{
  let reads=0;
  const input={actor,resource,grants:[grant('workspace_owner')],get action(){
    reads+=1;
    return reads===1?'project.read_published':'project.activate';
  }};
  denied(evaluate(input));
  assert.equal(reads,1);
});
test('changing actor identity getter cannot switch to a granted user',()=>{
  let reads=0;
  const changingActor={get userId(){reads+=1;return reads===1?'user-2':'user-1'},authenticated:true,status:'active'};
  denied(evaluate({actor:changingActor,resource,action:'project.read_published',grants:[grant('client_viewer')]}));
  assert.equal(reads,1);
});
test('changing grant role getter cannot switch to a role allowed for the action',()=>{
  let reads=0;
  const changingGrant={...grant('delivery_staff'),get role(){reads+=1;return reads===1?'delivery_staff':'client_viewer'}};
  denied(evaluate({actor,resource,action:'project.read_published',grants:[changingGrant]}));
  assert.equal(reads,1);
});
test('changing actor, resource or grants references are captured only once',()=>{
  let actorReads=0;
  const changingActorInput={get actor(){actorReads+=1;return actorReads===1?{...actor,userId:'user-2'}:actor},
    resource,action:'project.read_published',grants:[grant('client_viewer')]};
  denied(evaluate(changingActorInput));
  assert.equal(actorReads,1);

  let resourceReads=0;
  const changingResourceInput={actor,get resource(){resourceReads+=1;return resourceReads===1?{...resource,tenantId:'client-b'}:resource},
    action:'project.read_published',grants:[grant('client_viewer')]};
  denied(evaluate(changingResourceInput));
  assert.equal(resourceReads,1);

  let grantsReads=0;
  const changingGrantsInput={actor,resource,action:'project.read_published',get grants(){
    grantsReads+=1;
    return grantsReads===1?[grant('client_viewer',{status:'revoked'})]:[grant('client_viewer')];
  }};
  denied(evaluate(changingGrantsInput));
  assert.equal(grantsReads,1);
});
test('changing resource and grant identity fields cannot switch to the granted project',()=>{
  let resourceTenantReads=0;
  const changingResource={...resource,get tenantId(){resourceTenantReads+=1;return resourceTenantReads===1?'client-b':'client-a'}};
  denied(evaluate({actor,resource:changingResource,action:'project.read_published',grants:[grant('client_viewer')]}));
  assert.equal(resourceTenantReads,1);

  let grantUserReads=0;
  const changingGrant={...grant('client_viewer'),get userId(){grantUserReads+=1;return grantUserReads===1?'user-2':'user-1'}};
  denied(evaluate({actor,resource,action:'project.read_published',grants:[changingGrant]}));
  assert.equal(grantUserReads,1);
});
test('policy returns no object data when denied',()=>{
  const decision=check('project.read_published','client_viewer',{resource:{...resource,tenantId:'another-org'}});
  assert.deepEqual(Object.keys(decision).sort(),['allowed','reason']);
});
