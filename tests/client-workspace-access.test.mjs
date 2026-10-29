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
test('policy returns no object data when denied',()=>{
  const decision=check('project.read_published','client_viewer',{resource:{...resource,tenantId:'another-org'}});
  assert.deepEqual(Object.keys(decision).sort(),['allowed','reason']);
});
