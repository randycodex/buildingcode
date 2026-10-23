// Keep the chapter's section roots and scroll extent, but release passage DOM
// while its Reader is outside the workspace viewport. Source data, not detached
// DOM trees, recreates it when the column returns.
export function createReaderSectionVisibility({ panel, content, render, release, capturePosition, restorePosition, delay = 800 }) {
  // Template clones initially belong to an inert document without a Window.
  const doc = panel.ownerDocument.defaultView ? panel.ownerDocument : document, view = doc.defaultView;
  const records = new Map();
  let stopped = false, suspended = false, position = null, frame = 0, timer = 0;
  const visible = () => {
    if (!panel.isConnected || panel.classList.contains('is-workflow-hidden') || panel.classList.contains('is-collapsed')) return false;
    const bounds = panel.getBoundingClientRect();
    return bounds.width > 0 && bounds.right > -200 && bounds.left < view.innerWidth + 200;
  };
  const protectedContent = () => {
    const selection = doc.getSelection?.();
    return content.contains(doc.activeElement) || content.querySelector('[aria-expanded="true"]') ||
      selection && !selection.isCollapsed && (content.contains(selection.anchorNode) || content.contains(selection.focusNode));
  };
  const markers = root => [...root.querySelectorAll('.is-source-target[data-block-id], .is-navigation-target[data-block-id]')]
    .map(node => ({ id: node.dataset.blockId, classes: ['is-source-target', 'is-navigation-target'].filter(name => node.classList.contains(name)) }));
  const suspend = () => {
    timer = 0;
    if (stopped || visible() || protectedContent()) return;
    position = capturePosition() || position;
    suspended = true;
    for (const [root, record] of records) {
      if (!root.isConnected || !record.live) continue;
      record.markers = markers(root);
      record.heightStyle = root.style.height;
      root.style.height = `${Math.max(1, record.height || 600)}px`;
      release(root);
      root.replaceChildren();
      root.classList.add('is-reader-suspended');
      record.live = false;
    }
    content.dataset.readerSuspended = 'true';
  };
  const update = () => {
    frame = 0;
    if (stopped || !panel.isConnected) return;
    // Progressive alias consolidation may have removed a registered root.
    for (const root of records.keys()) if (!content.contains(root)) { resize.unobserve(root); records.delete(root); }
    if (!visible()) {
      if (!timer && [...records.values()].some(record => record.live)) timer = view.setTimeout(suspend, delay);
      return;
    }
    view.clearTimeout(timer); timer = 0;
    if (!suspended) { position = capturePosition() || position; return; }
    suspended = false;
    delete content.dataset.readerSuspended;
    for (const [root, record] of records) {
      if (record.live || !root.isConnected) continue;
      root.style.height = record.heightStyle;
      root.classList.remove('is-reader-suspended');
      render(root, record.data, position, record.markers);
      record.live = true;
    }
    restorePosition(position);
  };
  const schedule = () => { if (!stopped && !frame) frame = view.requestAnimationFrame(update); };
  const intersection = new IntersectionObserver(schedule, { rootMargin: '0px 200px' });
  intersection.observe(panel);
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) {
      const record = records.get(entry.target);
      const height = entry.borderBoxSize?.[0]?.blockSize;
      if (record?.live && height > 0) record.height = height;
    }
  });
  for (const event of ['scroll', 'focusout', 'selectionchange']) doc.addEventListener(event, schedule, { passive: true, capture: true });
  doc.addEventListener('permitext:workspace-layout-change', schedule);
  const controller = {
    add(root, data) { records.set(root, { data, live: true, height: 0, markers: [] }); resize.observe(root); schedule(); },
    get suspendedPosition() { return !stopped && suspended ? position : null; },
    dispose() {
      stopped = true; view.cancelAnimationFrame(frame); view.clearTimeout(timer);
      intersection.disconnect(); resize.disconnect(); records.clear(); position = null;
      for (const event of ['scroll', 'focusout', 'selectionchange']) doc.removeEventListener(event, schedule, true);
      doc.removeEventListener('permitext:workspace-layout-change', schedule);
      delete content.dataset.readerSuspended;
    }
  };
  schedule();
  return controller;
}
