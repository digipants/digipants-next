import type { ClientView, MilestoneStatus } from './model.js';
const get = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error('Preview element unavailable');
  return element as T;
};
const view = JSON.parse(get('client-data').textContent ?? '{}') as ClientView;
const main = get('main');
const escape = (text: string): string => text.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
const date = (value: string): string => new Intl.DateTimeFormat('en-GB', {dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));
const time = (value: string): string => `${new Intl.DateTimeFormat('en-GB', {dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))} UTC`;
const labels: Record<MilestoneStatus,string> = {planned:'Planned',in_progress:'In progress',in_review:'Internal review',QA:'Quality assurance',awaiting_client:'Awaiting your review',accepted:'Client accepted',blocked:'Blocked',paused:'Paused'};
const select = get<HTMLSelectElement>('scenario');
select.value = new URLSearchParams(location.search).get('scenario') ?? 'active';
select.onchange = () => { location.href = `/?${new URLSearchParams({scenario:select.value}).toString()}`; };
get<HTMLInputElement>('dark').onchange = event => document.body.classList.toggle('dark', (event.target as HTMLInputElement).checked);
if (view.kind !== 'project') {
  const messages = {loading:['Preparing your project view','Loading illustration only. Choose another preview scenario to continue.'],error:['Project updates are unavailable','Your last published project record has not been changed. Try the active fixture again.'], 'access-denied':['Project access unavailable','Ask your DigiPants contact to check your access. No project information is included in this view.']};
  main.innerHTML = `<section class="card" ${view.kind==='loading'?'aria-busy="true"':''}><p class="eyebrow">CLIENT WORKSPACE</p><h1>${messages[view.kind][0]}</h1><p ${view.kind==='error'?'role="alert"':''}>${messages[view.kind][1]}</p>${view.kind==='error'?'<a href="/?scenario=active">Retry project preview</a>':''}</section>`;
} else {
  const p = view.project;
  main.innerHTML = `<p class="eyebrow">YOUR DELIVERY WORKSPACE</p><div class="overview"><div><h1>${escape(p.name)}</h1><p>${escape(p.client)}</p></div><span class="status">${escape(p.status)}</span></div>
  <div class="layout"><div><section class="next" aria-labelledby="next-title"><h2 id="next-title">Your next step</h2><p>${escape(p.nextAction)}</p><small>Project owner: ${escape(p.owner)}</small></section>
  <h2 class="section-title">The path to delivery</h2><p>Approved example targets stay visible. Revised dates require a separate human approval.</p><ol class="milestones">${p.milestones.map((m,i)=>`<li class="card"><span class="milestone-number">MILESTONE ${String(i+1).padStart(2,'0')}</span><h3>${escape(m.title)}</h3><span class="status" data-state="${m.status}">${labels[m.status]}</span><p>${escape(m.explanation)}</p><dl><dt>Owner</dt><dd>${escape(m.owner)}</dd><dt>Approved target · illustrative</dt><dd><time datetime="${escape(m.approvedDate)}">${date(m.approvedDate)}</time></dd><dt>Depends on</dt><dd>${escape(m.dependencies.map(id=>p.milestones.find(item=>item.id===id)?.title ?? 'Owner confirmation').join(', ') || 'No prior milestone')}</dd></dl></li>`).join('')}</ol>
  <section class="card" aria-labelledby="updates-title"><p class="eyebrow">VERIFIED & PUBLISHED</p><h2 id="updates-title">Progress, in plain language</h2>${p.updates.length?`<ol class="feed">${p.updates.map(u=>`<li><time datetime="${escape(u.publishedAt)}">Published ${time(u.publishedAt)}</time><p>${escape(u.summary)}</p><small>Staff verified: ${time(u.verifiedAt)}</small></li>`).join('')}</ol>`:'<p>No published updates yet. Internal activity does not appear here until separately reviewed and published.</p>'}</section></div>
  <aside><section class="card"><p class="eyebrow">LATEST CONFIRMED RECORD</p><h2>Clarity you can rely on</h2><p>Last published<br><strong>${p.lastPublished?time(p.lastPublished):'No published update yet'}</strong></p><p>Last engineering sync<br><strong>${time(p.lastEngineeringSync)}</strong></p><p class="${p.sourceState==='connected'?'':'warning'}">${p.sourceState==='connected'?'Source snapshot available. This preview is not live.':p.sourceState==='disconnected'?'Engineering source disconnected. Published records remain available; this does not mean work has stopped or finished.':'Engineering source is stale. Status is the last staff-published record, not a new progress claim.'}</p></section>
  <section class="card"><p class="eyebrow">SHARED WITH YOU</p><h2>Deliverables & review</h2>${p.deliverables.length?p.deliverables.map(d=>`<article><h3>${escape(d.title)}</h3><p><strong>${escape(d.state)}</strong></p><p>${escape(d.reviewerNote)}</p><button class="primary artifact-button" data-artifact="${d.artifact}">View approved mock artifact</button></article>`).join(''):'<p>No approved deliverables are shared yet. Your owner will publish them after review.</p>'}<p class="meta">Read-only preview. No client acceptance is submitted or inferred.</p></section>
  <section class="card billing"><p class="read-only">FUTURE MODULE · ILLUSTRATION</p><h2>Billing overview</h2><p>Approved invoice information may appear here in a future workspace. No invoice, amount due or payment action is available in this preview.</p></section></aside></div>`;
  document.querySelectorAll<HTMLButtonElement>('.artifact-button').forEach(button=>button.onclick=()=>{
    get<HTMLDialogElement>('artifact').showModal();get('close-artifact').focus();
  });
}
const dialog = get<HTMLDialogElement>('artifact');
get('close-artifact').onclick=()=>{dialog.close();get('feedback').textContent='Mock artifact closed. No review decision was recorded.';};
dialog.onkeydown=event=>{if(event.key==='Tab'){event.preventDefault();get('close-artifact').focus();}};
