import {calculationDraftContent} from './calculation-drafts.js?v=4';

// The durable local store is the outbox. Requests are serialized per project;
// acknowledgements never erase edits made while a save was in flight.
export function calculationProjectSync({store, projectID, request, isCurrent, visible = () => false,
  onChange = () => {}, debounceMs = 500, pollMs = 15000}) {
  let flight = null, debounce = null, poll = null, rerun = false, stopped = false;
  let state = 'pending', error = '';
  const notify = () => onChange({state, error});
  const schedulePoll = () => {
    clearTimeout(poll);
    if (!stopped && isCurrent() && visible()) poll = setTimeout(() => {poll = null; void refresh();}, pollMs);
  };
  async function run(pull) {
    if (stopped || !isCurrent()) return;
    if (flight) {rerun = true; return flight;}
    const current = () => !stopped && isCurrent();
    flight = (async () => {
      state = store.pending(projectID).length ? 'saving' : 'saved'; error = ''; notify();
      if (pull) {
        const result = await request('/projects/calculations/list', {projectID});
        if (!current()) return;
        store.merge(projectID, result.calculations || []); notify();
      }
      for (const sent of store.pending(projectID)) {
        if (!current()) return;
        try {
          const result = await request('/projects/calculations/save', {projectID, calculationID: sent.id,
            expectedVersion: sent.serverVersion || 0, ...calculationDraftContent(sent)});
          if (!current()) return;
          store.acknowledge(sent, result.calculation);
        } catch (failure) {
          if (!current()) return;
          if (failure.status === 409 && failure.payload?.calculation) {
            store.merge(projectID, [failure.payload.calculation]); rerun = true;
          } else throw failure;
        }
        notify();
      }
      state = store.pending(projectID).length ? 'pending' : 'saved'; notify();
    })().catch(failure => {
      if (!current()) return;
      state = 'error'; error = failure.message || 'Calculation sync is unavailable.'; notify();
    }).finally(() => {
      flight = null;
      if (rerun && current()) {rerun = false; schedule();}
      schedulePoll();
    });
    return flight;
  }
  function schedule() {
    clearTimeout(debounce);
    if (stopped || !isCurrent()) return;
    state = store.pending(projectID).length ? 'pending' : 'saved'; error = ''; notify();
    debounce = setTimeout(() => {debounce = null; void run(false);}, debounceMs);
  }
  function refresh() {clearTimeout(debounce); debounce = null; return run(true);}
  return {schedule, refresh, flush: () => run(false),
    status: () => ({state, error}),
    dispose() {stopped = true; clearTimeout(debounce); clearTimeout(poll);}};
}
