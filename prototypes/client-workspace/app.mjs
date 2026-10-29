import { initial, transition, unavailable } from './state.mjs';
let state = initial();
let selected = 'accept';
let generation = 0;
const $ = id => document.getElementById(id);
const labels = { accept: 'Accept proposal', request_changes: 'Request changes', decline: 'Decline proposal' };
const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value / 100);
function render() {
  const mode = $('scenario').value;
  $('errors').textContent = state.error;
  if (['loading','empty','invalid','access-denied'].includes(mode)) {
    const messages = { loading: ['Loading proposal…','Illustration only. Choose Current to finish loading.'], empty: ['No proposal yet','Your DigiPants owner will share a reviewed proposal when it is ready.'], invalid: ['Proposal cannot be displayed','Its totals or required details are invalid. Ask your owner for a corrected version.'], 'access-denied': ['Access unavailable','This is a denial illustration, not authentication. Ask your owner to check project access.'] };
    $('main').innerHTML = `<section class="card" ${mode === 'loading' ? 'aria-busy="true"' : ''}><p class="eyebrow">CLIENT WORKSPACE</p><h1>${messages[mode][0]}</h1><p>${messages[mode][1]}</p></section>`;
    return;
  }
  const p = state.proposal;
  const blocked = unavailable(p);
  const next = state.history.length ? state.project : blocked ? 'Contact your DigiPants owner' : `Review proposal v${p.currentVersion} and choose your response`;
  $('main').innerHTML = `<p class="eyebrow">EXAMPLE STUDIO · PROJECT OVERVIEW</p><h1>A clearer home for your project.</h1><p>Example Studio website · studio@example.test</p><span class="status">${state.project}</span>
  <div class="layout"><div><section class="next"><strong>Next action</strong><p>${next}</p><small>Owner: Morgan Example · owner@example.test · Current version: v${p.currentVersion}</small></section>
  <section class="card"><p class="eyebrow">PROPOSAL v${p.version} · ${p.status.replaceAll('_',' ').toUpperCase()}</p><h2>A focused website refresh</h2><p>Help visitors understand the offer and find the right next step.</p><h3>Deliverables</h3><ul><li>Responsive home, service and contact page designs</li><li>Accessible interface implementation and browser verification</li><li>Review session and handover guide</li></ul><h3>Excluded</h3><p>Brand identity, content writing, commerce and ongoing hosting.</p><h3>Assumptions & responsibilities</h3><p>The client supplies approved copy and assets, a named approver and timely review. Existing infrastructure is suitable; new requirements need a reviewed proposal version.</p><h3>Illustrative timeline</h3><p>4–6 weeks after authorized kickoff, subject to capacity, discovery and client approvals. No start date or deadline is committed in this simulation.</p></section>
  <section class="card"><h2>Decision history</h2><p class="muted">Synthetic events · fixed example clock: 15 Jan 2030, 12:00 UTC</p><ol id="history"><li><strong>Proposal v${p.version} issued</strong><br><span class="muted">Morgan Example · 15 Dec 2029 · fictional internal reviews recorded.</span></li></ol></section></div>
  <aside><section class="card"><p class="eyebrow">ILLUSTRATIVE GBP TOTAL</p><div class="amount">${money(p.totalMinor)}</div><p>Fake example amounts, not a rate card or quote.</p>${p.milestones.map(m=>`<div class="row"><span>${m.title}</span><strong>${money(m.amountMinor)}</strong></div>`).join('')}<h3>Conditions</h3><p>Tax treatment, contract, signatory authority and deposit/payment terms require human review. No tax or FX calculation is made.</p><p>Example expiry: ${p.expiresAt.startsWith('2030-01') ? '1 Jan' : '1 Feb'} 2030, 12:00 UTC.</p><p>Accepting does not start delivery. Contract, signatory, payment conditions and internal activation must be checked separately.</p><p id="availability">${state.history.length ? 'Decision recorded for this version. Reset to explore another outcome.' : blocked || 'Choose a response. You will confirm before anything changes.'}</p><div class="actions">${Object.entries(labels).map(([key,label])=>`<button ${blocked || state.pending ? 'disabled' : ''} data-decision="${key}" class="${key==='accept'?'primary':''}">${label}</button>`).join('')}</div>${state.pending?'<p role="status">Recording simulated decision…</p>':''}</section></aside></div>`;
  for (const entry of state.history) {
    const li = document.createElement('li');
    li.textContent = `${labels[entry.decision]} · v${entry.version} · ${entry.actor} · ${entry.at}${entry.reason ? ' · ' + entry.reason : ''}`;
    $('history').append(li);
  }
  document.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.decision;
    $('confirm-title').textContent = `${labels[selected]} · v${p.version}?`;
    $('reason').value = ''; $('reason-error').textContent = ''; $('reason').removeAttribute('aria-invalid');
    $('reason').hidden = $('reason-label').hidden = selected !== 'request_changes';
    $('confirmation').showModal(); $('cancel').focus();
  }));
}
// Keep keyboard focus within the confirmation, including browser edge cases.
$('confirmation').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [$('reason'), $('cancel'), $('confirm')].filter(el => !el.hidden && !el.disabled);
  const first = controls[0]; const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
$('cancel').onclick = () => $('confirmation').close();
$('decision-form').onsubmit = event => {
  event.preventDefault();
  if (state.pending) return;
  if (selected === 'request_changes' && !$('reason').value.trim()) {
    $('reason-error').textContent = 'Describe the change you need.';
    $('reason').setAttribute('aria-invalid','true'); $('reason').focus(); return;
  }
  state = transition(state, { type: 'begin', decision: selected, reason: $('reason').value });
  if (!state.pending) { render(); return; }
  const run = generation;
  const fail = $('fail').checked; const stale = $('stale').checked;
  $('fail').checked = false; $('stale').checked = false;
  $('confirmation').close(); render(); $('main').focus();
  setTimeout(() => {
    if (run !== generation) return;
    if (stale) state = { ...state, proposal: { ...state.proposal, currentVersion: 4 } };
    state = transition(state, { type: fail ? 'fail' : 'complete' });
    render(); $('feedback').textContent = state.error ? '' : `Simulation complete: ${state.project}. No live decision was made.`;
    $('main').focus();
  }, 600);
};
function reset() { generation++; state = initial($('scenario').value); $('feedback').textContent = ''; render(); }
$('scenario').onchange = reset; $('reset').onclick = reset;
$('dark').onchange = () => document.body.classList.toggle('dark', $('dark').checked);
render();
