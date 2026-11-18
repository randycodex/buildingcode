// View membership is presentation state. Editors stay mounted and keep their
// canonical data; a linked destination may be visible in both working views.
export function normalizeWorkflowView(value) { return value === 'notebook' ? 'notebook' : 'research'; }
export const columnWorkflowViews = ['research', 'notebook', 'report', 'project-details'];
export function normalizeColumnWorkflowView(value) { return columnWorkflowViews.includes(value) ? value : 'research'; }
// Older releases automatically linked Notes to Research when saving an answer.
// Only an explicit open under this policy opts Notes into Research again.
const explicitNotesResearch = 'notes-research-explicit';
const isNotesPane = id => /^project:notebook:/.test(id);
export function normalizeWorkflowMembership(value) {
  return Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {})
    .filter(([id, views]) => id && Array.isArray(views))
    .map(([id, views]) => [id, [...new Set(views.filter(view => (columnWorkflowViews.includes(view) || view === explicitNotesResearch) &&
      !(isNotesPane(id) && view === 'research' && !views.includes(explicitNotesResearch))))]]));
}
export function workflowHome(paneID, anchors = {}) {
  if (/^(?:project:(?:notebook|notes-index):|utility:saved(?::|$))/.test(paneID)) return 'notebook';
  const anchor = anchors[paneID];
  if (anchor && anchor !== paneID && /^(?:project:notebook:|utility:saved(?::|$))/.test(anchor)) return 'notebook';
  return 'research';
}
export function paneBelongsToView(paneID, view, membership, anchors) {
  if (view === 'report') return false;
  const views = membership?.[paneID] || [];
  if (isNotesPane(paneID) && view === 'research' && !views.includes(explicitNotesResearch)) return false;
  // Retained Readers from older Report layouts remain available in Research.
  if (view === 'research' && /^reader:/.test(paneID) && views.includes('report')) return true;
  return views.length ? views.includes(view) : workflowHome(paneID, anchors) === view;
}
export function linkPaneToView(membership, paneID, view) {
  const home = /^(?:project:notebook:|utility:saved(?::|$))/.test(paneID) ? ['notebook'] : [];
  return {...membership, [paneID]: [...new Set([...home, ...(membership?.[paneID] || []), normalizeColumnWorkflowView(view),
    ...(isNotesPane(paneID) && view === 'research' ? [explicitNotesResearch] : [])])]};
}
export function referenceColumnsWidth(widths, availableWidth, documentWidth = 600, minimumWidths = []) {
  if (!widths.length) return 0;
  const dividersAndBorder = widths.length + 2;
  const requested = widths.reduce((sum, width) => sum + width, dividersAndBorder);
  const minimum = widths.reduce((sum, width, index) =>
    sum + (minimumWidths[index] ?? (width <= 48 ? width : 600)), dividersAndBorder);
  return Math.max(minimum, Math.min(requested, availableWidth - documentWidth));
}
// Share the desk as evenly as each column's own minimum allows. Assistant
// reserves its history/composer width before smaller columns share the rest.
// Otherwise retain preferred widths, with each column's own bounds.
export function researchColumnsLayout(widths, availableWidth, fixedWidth = 0, dividerWidth = 0, maximumWidths = [], minimumWidths = []) {
  const available = availableWidth - fixedWidth - dividerWidth;
  const minimums = widths.map((_, index) => minimumWidths[index] ?? 600);
  const fits = widths.length > 0 && minimums.reduce((sum, width) => sum + width, 0) <= available;
  if (!fits) return { fits, widths: widths.map((width, index) => Math.max(minimums[index], Math.min(maximumWidths[index] ?? 900, Number(width) || minimums[index]))) };
  const fitted = [...minimums], flexible = new Set(widths.map((_, index) => index));
  let remaining = available;
  while (flexible.size) {
    const share = remaining / flexible.size;
    const constrained = [...flexible].filter(index => minimums[index] > share);
    if (!constrained.length) { for (const index of flexible) fitted[index] = share; break; }
    for (const index of constrained) { remaining -= minimums[index]; flexible.delete(index); }
  }
  return { fits, widths: fitted };
}
// Optional references share one slot when their chosen widths would squeeze
// the writing page. Closing one is persistent; a wider desk never reopens it.
export function notebookReferenceVisibility({readerOpen, evidenceOpen, active = 'evidence',
  readerWidth = 630, evidenceWidth = 300, notesWidth = 300, availableWidth, dividerWidth = 1}) {
  const compact = availableWidth < 800 + notesWidth + readerWidth + evidenceWidth + dividerWidth * 5;
  if (compact && readerOpen && evidenceOpen) {
    readerOpen = active === 'reader';
    evidenceOpen = !readerOpen;
  }
  return {readerOpen, evidenceOpen, compact};
}
// The Notes list's extra width sits outside the writing and reference allocation.
export function notebookColumnsLayout(columns, availableWidth, dividerWidth = 0, sharedReferenceWidth = 0) {
  const notesExpansion = columns.some(column => column.kind === 'notes' && !column.collapsed) ? 220 : 0;
  const available = Math.max(0, availableWidth - dividerWidth) + notesExpansion;
  const shared = column => sharedReferenceWidth > 0 && ['reader', 'evidence'].includes(column.kind);
  const minimums = columns.map(column => column.collapsed ? (column.kind === 'notes' ? 80 : 48) :
    shared(column) ? 300 : ({reader:630, evidence:300, notes:300, editor:800}[column.kind] || 300));
  const editor = columns.findIndex(column => column.kind === 'editor' && !column.collapsed);
  const widths = columns.map((column, index) => column.collapsed || column.kind === 'editor' ? minimums[index] :
    Math.max(minimums[index], Math.min(shared(column) ? 600 : {reader:Infinity, evidence:600, notes:300}[column.kind] || 360,
      shared(column) ? sharedReferenceWidth : Number(column.preferredWidth) || {reader:630, evidence:300, notes:300}[column.kind] || 300)));
  let excess = widths.reduce((sum, width) => sum + width, 0) - available;
  columns.forEach((column, index) => {
    if (column.collapsed || !['reader', 'evidence'].includes(column.kind) || excess <= 0) return;
    const reduction = Math.min(excess, Math.max(0, widths[index] - 300));
    widths[index] -= reduction;
    excess -= reduction;
  });
  const requested = widths.reduce((sum, width) => sum + width, 0);
  const flexible = editor >= 0 ? editor : columns.findIndex(column => !column.collapsed && column.kind === 'reader');
  if (flexible >= 0) widths[flexible] += Math.max(0, available - requested);
  return widths;
}
// Sources reserve their chosen width beside the Report document.
// Hide the optional outline before shrinking the document.
export function reportColumnsLayout(availableWidth, libraryWidth = 0, requestedOutlineWidth = 300) {
  const sourceWidth = libraryWidth > 0 ? Math.max(280, Math.min(720, libraryWidth)) : 0;
  const minimumWidth = 600 + sourceWidth + (sourceWidth ? 1 : 0);
  const outlineWidth = requestedOutlineWidth > 0 ? Math.max(300, Math.min(720, requestedOutlineWidth)) : 0;
  return { minimumWidth, compact: availableWidth < minimumWidth + outlineWidth + (outlineWidth ? 1 : 0) };
}
// Keep scroll snapshots per DOM node, not indexes: asynchronous hydration may
// replace a loading shell while the other view is active.
// Capture scroll events without inspecting every source paragraph or forcing
// content-visibility layout. Weak ownership lets closed columns be collected.
const scrolledNodesByPane = new WeakMap();
if (typeof document !== 'undefined') document.addEventListener('scroll', event => {
  const node = event.target;
  const pane = node?.closest?.('.workspace-panel');
  if (!pane) return;
  let nodes = scrolledNodesByPane.get(pane);
  if (!nodes) { nodes = new Set(); scrolledNodesByPane.set(pane, nodes); }
  nodes.add(node);
}, {capture: true, passive: true});

export function capturePaneScrollPositions(pane) {
  const selector = '.reader-content, .search-results, .search-jump-list, .saved-column-scroll, .research-thread, .research-history-list, .notebook-shell, .notebook-focus, .bn-editor, .report-document, .report-history, .project-information-content, .project-details-column-body, .analysis-content, .research-messages, .assistant-messages, .calculator-column-content, .section-detail-content, .report-source-picker, textarea, .code-table';
  const tracked = scrolledNodesByPane.get(pane) || new Set();
  for (const node of tracked) if (!pane.contains(node)) tracked.delete(node);
  return [...new Set([pane, ...pane.querySelectorAll(selector), ...tracked])]
    .filter(node => node.scrollTop || node.scrollLeft)
    .map(node => ({node, top: node.scrollTop, left: node.scrollLeft}));
}
export function createWorkflowScrollStore() {
  const snapshots = new WeakMap();
  return {
    capture(panes) {
      for (const pane of panes) snapshots.set(pane,
        capturePaneScrollPositions(pane));
    },
    restore(panes) {
      for (const pane of panes) for (const {node, top, left} of snapshots.get(pane) || []) {
        if (node.isConnected) { node.scrollTop = top; node.scrollLeft = left; }
      }
    }
  };
}
