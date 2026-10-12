// View membership is presentation state. Editors stay mounted and keep their
// canonical data; a linked destination may be visible in both working views.
export function normalizeWorkflowView(value) { return value === 'notebook' ? 'notebook' : 'research'; }
export const columnWorkflowViews = ['research', 'notebook', 'report', 'project-details'];
export function normalizeColumnWorkflowView(value) { return columnWorkflowViews.includes(value) ? value : 'research'; }
export function normalizeWorkflowMembership(value) {
  return Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {})
    .filter(([id, views]) => id && Array.isArray(views))
    .map(([id, views]) => [id, [...new Set(views.filter(view => columnWorkflowViews.includes(view)))]]));
}
export function workflowHome(paneID, anchors = {}) {
  if (/^(?:project:notebook:|utility:saved(?::|$))/.test(paneID)) return 'notebook';
  const anchor = anchors[paneID];
  if (anchor && anchor !== paneID && /^(?:project:notebook:|utility:saved(?::|$))/.test(anchor)) return 'notebook';
  return 'research';
}
export function paneBelongsToView(paneID, view, membership, anchors) {
  if (view === 'report') return false;
  const views = membership?.[paneID] || [];
  // Retained Readers from older Report layouts remain available in Research.
  if (view === 'research' && /^reader:/.test(paneID) && views.includes('report')) return true;
  return views.length ? views.includes(view) : workflowHome(paneID, anchors) === view;
}
export function linkPaneToView(membership, paneID, view) {
  const home = /^(?:project:notebook:|utility:saved(?::|$))/.test(paneID) ? ['notebook'] : [];
  return {...membership, [paneID]: [...new Set([...home, ...(membership?.[paneID] || []), normalizeColumnWorkflowView(view)])]};
}
export function referenceColumnsWidth(widths, availableWidth, documentWidth = 600) {
  if (!widths.length) return 0;
  const requested = widths.reduce((sum, width) => sum + width, widths.length + 1);
  return Math.min(requested, Math.max(Math.max(...widths) + 2, availableWidth - documentWidth));
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
export function createWorkflowScrollStore() {
  const snapshots = new WeakMap();
  return {
    capture(panes) {
      for (const pane of panes) snapshots.set(pane,
        [pane, ...pane.querySelectorAll('*')].filter(node => node.scrollTop || node.scrollLeft)
          .map(node => ({node, top: node.scrollTop, left: node.scrollLeft})));
    },
    restore(panes) {
      for (const pane of panes) for (const {node, top, left} of snapshots.get(pane) || []) {
        if (node.isConnected) { node.scrollTop = top; node.scrollLeft = left; }
      }
    }
  };
}
