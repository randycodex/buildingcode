// Presentation defaults never replace an intentional saved arrangement.
export function normalizeVisitedWorkflowViews(source = {}) {
  if (Array.isArray(source.workflowVisitedViews)) {
    return [...new Set(source.workflowVisitedViews.filter(view => ['research', 'notebook'].includes(view)))];
  }
  // Older saved layouts cannot tell us whether Notes was deliberately closed.
  return Object.hasOwn(source, 'workflowView') ? ['research', 'notebook'] : [];
}

export function shouldOpenNotebookByDefault(view, visited) {
  return view === 'notebook' && !visited.includes('notebook');
}

export function initialReportOutlineHidden(blocks = []) {
  return blocks.filter(block => block.kind === 'heading').length < 2 && blocks.length < 4;
}

// These fields establish the scope of ordinary code research. Other missing
// facts remain reachable through All facts; recorded/unknown facts stay visible.
const coreFactKeys = new Set(['address', 'occupancy', 'construction-type', 'work-filing-type', 'code-basis']);
export function showProjectFact(field, fact, {all = false, address = ''} = {}) {
  return all || coreFactKeys.has(field.key) || Boolean(fact) || Boolean(field.projectAddress && address);
}
