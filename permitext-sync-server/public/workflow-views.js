// View membership is presentation state. Editors stay mounted and keep their
// canonical data; a linked destination may be visible in both working views.
export function normalizeWorkflowView(value) { return value === 'notebook' ? 'notebook' : 'research'; }
export function normalizeWorkflowMembership(value) {
  return Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {})
    .filter(([id, views]) => id && Array.isArray(views))
    .map(([id, views]) => [id, [...new Set(views.filter(view => ['research', 'notebook'].includes(view)))]]));
}
export function workflowHome(paneID, anchors = {}) {
  if (/^(?:project:notebook:|utility:saved(?::|$))/.test(paneID)) return 'notebook';
  const anchor = anchors[paneID];
  if (anchor && anchor !== paneID && /^(?:project:notebook:|utility:saved(?::|$))/.test(anchor)) return 'notebook';
  return 'research';
}
export function paneBelongsToView(paneID, view, membership, anchors) {
  return membership?.[paneID]?.length ? membership[paneID].includes(view) : workflowHome(paneID, anchors) === view;
}
export function linkPaneToView(membership, paneID, view) {
  const home = /^(?:project:notebook:|utility:saved(?::|$))/.test(paneID) ? ['notebook'] : [];
  return {...membership, [paneID]: [...new Set([...home, ...(membership?.[paneID] || []), normalizeWorkflowView(view)])]};
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
