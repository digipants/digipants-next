import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initial, transition, unavailable, NOW } from '../prototypes/client-workspace/state.mjs';
const begin = (s, decision='accept', extra={}) => transition(s, {type:'begin', decision, ...extra});
const complete = s => transition(s, {type:'complete'});
for (const [decision,status,project] of [['accept','accepted','Awaiting kickoff checks'],['request_changes','changes_requested','Awaiting revised proposal'],['decline','declined','Proposal declined']]) {
  test(`current ${decision} requires begin then completes with safe project state`,()=>{
    const s=begin(initial(),decision,{reason:'Please revise the scope'});
    assert.equal(s.history.length,0);
    const result=complete(s);
    assert.equal(result.proposal.status,status); assert.equal(result.project,project);
    assert.notEqual(result.project,'Active'); assert.equal(result.history.length,1);
    assert.equal(result.history[0].version,3);
  });
}
for (const kind of ['expired','superseded']) for (const decision of ['accept','request_changes','decline']) {
  test(`${kind} ${decision} cannot record a decision`,()=>{
    const s=complete(begin(initial(kind),decision,{reason:'Change'}));
    assert.equal(s.pending,null); assert.equal(s.history.length,0); assert.match(s.error,/Expired|Superseded/);
  });
}
test('duplicate begin and completion produce one decision',()=>{
  const pending=begin(initial()); assert.strictEqual(begin(pending),pending);
  const done=complete(pending); assert.strictEqual(complete(done),done); assert.strictEqual(begin(done),done);
  assert.equal(done.history.length,1);
});
test('stale version during confirmation prevents completion',()=>{
  const s=begin(initial()); s.proposal={...s.proposal,currentVersion:4};
  const result=complete(s); assert.equal(result.history.length,0); assert.match(result.error,/Superseded/);
});
test('expiry during confirmation prevents completion, including exact boundary',()=>{
  const s=begin(initial()); const result=transition(s,{type:'complete',now:Date.parse(s.proposal.expiresAt)});
  assert.equal(result.history.length,0); assert.match(result.error,/Expired/);
});
test('request changes requires nonblank reason',()=>{
  assert.match(begin(initial(),'request_changes',{reason:'  '}).error,/Describe/);
});
test('failed simulation leaves decision available for retry',()=>{
  const failed=transition(begin(initial()),{type:'fail'}); assert.equal(failed.history.length,0);
  assert.match(failed.error,/No decision/); assert.equal(complete(begin(failed)).project,'Awaiting kickoff checks');
});
test('minor-unit milestone amounts sum exactly to total',()=>{
  const p=initial().proposal; assert.equal(p.milestones.reduce((sum,m)=>sum+m.amountMinor,0),p.totalMinor);
  assert.equal(unavailable(p,NOW),'');
  for(const total of [420001,NaN,-1,1.5]) assert.match(unavailable({...p,totalMinor:total}),/Invalid/);
  assert.match(unavailable({...p,expiresAt:'invalid'}),/Invalid/);
});
test('unsupported events cannot activate or publish anything',()=>{
  const s=initial(); assert.strictEqual(transition(s,{type:'activate'}),s);
  assert.strictEqual(begin(s,'activate'),s);
});
