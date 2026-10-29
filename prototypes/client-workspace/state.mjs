// Pure, in-memory fixture simulation; never live authorization.
export const NOW = Date.parse('2030-01-15T12:00:00Z');
export function initial(kind = 'current') {
  return { proposal: { version: kind === 'superseded' ? 2 : 3, currentVersion: 3,
    status: kind === 'superseded' ? 'superseded' : 'issued',
    expiresAt: kind === 'expired' ? '2030-01-01T12:00:00Z' : '2030-02-01T12:00:00Z',
    currency: 'GBP', totalMinor: 420000,
    milestones: [{ title: 'Scope & design', amountMinor: 120000 }, { title: 'Build & verification', amountMinor: 240000 }, { title: 'Review & handover', amountMinor: 60000 }] },
    project: 'Awaiting proposal decision', pending: null, history: [], error: '' };
}
export function unavailable(p, now = NOW) {
  if (p.version !== p.currentVersion || p.status === 'superseded') return 'Superseded — ask your owner for the current version.';
  if (Date.parse(p.expiresAt) <= now) return 'Expired — ask your owner for a revised proposal.';
  if (p.status !== 'issued') return 'A decision has already been recorded for this version.';
  if (!Number.isFinite(Date.parse(p.expiresAt)) || !Number.isSafeInteger(p.totalMinor) || p.totalMinor < 0 || p.milestones.some(m => !Number.isSafeInteger(m.amountMinor) || m.amountMinor < 0) || p.milestones.reduce((sum,m)=>sum+m.amountMinor,0) !== p.totalMinor) return 'Invalid proposal — your owner must correct it.';
  return '';
}
export function transition(state, event) {
  if (event.type === 'begin') {
    if (state.pending || state.history.length) return state;
    const error = unavailable(state.proposal, event.now ?? NOW);
    if (error) return { ...state, error };
    if (!['accept','request_changes','decline'].includes(event.decision)) return state;
    if (event.decision === 'request_changes' && !event.reason?.trim()) return { ...state, error: 'Describe the change you need.' };
    return { ...state, pending: { decision: event.decision, reason: event.reason?.trim() ?? '', version: state.proposal.version }, error: '' };
  }
  if (!state.pending) return state;
  if (event.type === 'fail') return { ...state, pending: null, error: 'Simulation failed. No decision recorded. Try again.' };
  if (event.type !== 'complete') return state;
  const error = unavailable(state.proposal, event.now ?? NOW);
  if (error || state.pending.version !== state.proposal.currentVersion) return { ...state, pending: null, error: error || 'Version changed. Review the latest proposal.' };
  const decision = state.pending.decision;
  return { ...state, pending: null, error: '', proposal: { ...state.proposal, status: { accept: 'accepted', request_changes: 'changes_requested', decline: 'declined' }[decision] },
    project: { accept: 'Awaiting kickoff checks', request_changes: 'Awaiting revised proposal', decline: 'Proposal declined' }[decision],
    history: [...state.history, { ...state.pending, at: '2030-01-15T12:00:00Z', actor: 'Alex Example · approver@example.test' }] };
}
