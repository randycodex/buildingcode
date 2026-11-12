let tooltipSerial = 0;

export function readerShortcutLabel({ prefix = '', edition = '' }) {
  const abbreviation = prefix === 'BC68' ? 'BC' : prefix || 'Reader';
  return /^\d{4}$/.test(edition)
    ? `${abbreviation}’${edition.slice(-2)}`
    : `${abbreviation} · ${edition || 'Current'}`;
}

// The toolbar navigates columns. Code tabs and their reading sessions live in
// the Reader header rather than becoming additional toolbar shortcuts.
export function createReaderShortcuts({ host, track, readers, context, reveal, move, tools = [] }) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const buttons = new Map();
  const activeByContext = new Map();
  const readerByContext = new Map();
  let currentContext = '', activeID = '', scheduled = false, disposed = false;
  let draggedID = '', dragContext = '', suppressClickUntil = 0, currentItems = [];
  let pointerSelection = null;
  let tooltipButton = null;
  const tooltip = doc.createElement('div');
  tooltip.className = 'reader-shortcut-tooltip';
  tooltip.id = `reader-shortcut-tooltip-${++tooltipSerial}`;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  doc.body.append(tooltip);

  function hideTooltip() {
    tooltipButton?.removeAttribute('aria-describedby');
    tooltipButton = null;
    tooltip.hidden = true;
  }
  function showTooltip(button) {
    if (draggedID) return;
    hideTooltip();
    tooltipButton = button;
    tooltip.textContent = button.dataset.description;
    tooltip.hidden = false;
    button.setAttribute('aria-describedby', tooltip.id);
    const bounds = button.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(bounds.left, win.innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${bounds.bottom + 7}px`;
  }
  function activate(id) {
    if (!buttons.has(id)) return;
    activeID = id;
    activeByContext.set(currentContext, id);
    if (id.startsWith('reader:')) readerByContext.set(currentContext, id);
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
  }
  function clearDropMarkers() {
    for (const button of buttons.values()) button.classList.remove('is-drop-before', 'is-drop-after');
  }
  function endDrag() {
    clearDropMarkers();
    for (const button of buttons.values()) button.classList.remove('is-dragging');
    draggedID = ''; dragContext = '';
    pointerSelection = null;
    suppressClickUntil = Date.now() + 250;
  }
  function dropPosition(event, button) {
    const bounds = button.getBoundingClientRect();
    return event.clientX > bounds.left + bounds.width / 2 ? 'after' : 'before';
  }
  function canDrop(id) {
    return Boolean(move && draggedID && draggedID !== id && dragContext === context() && buttons.has(draggedID));
  }
  function refresh() {
    if (disposed) return;
    const nextContext = context();
    const contextChanged = nextContext !== currentContext;
    const previousIDs = new Set(buttons.keys());
    if (contextChanged) {
      if (draggedID) endDrag();
      currentContext = nextContext;
      activeID = activeByContext.get(currentContext) || '';
      hideTooltip();
    }
    const items = readers();
    currentItems = items;
    for (const {button, key} of tools) button?.classList.toggle('has-open-column', items.some(item => item.toolKey === key));
    const wanted = new Set(items.map(item => item.id));
    for (const [id, button] of buttons) if (!wanted.has(id)) {
      if (tooltipButton === button) hideTooltip();
      button.remove();
      buttons.delete(id);
    }
    const counts = new Map(), occurrences = new Map();
    for (const item of items) {
      const label = item.label || readerShortcutLabel(item);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    items.forEach((item, index) => {
      let button = buttons.get(item.id);
      if (!button) {
        button = doc.createElement('button');
        button.type = 'button';
        button.dataset.readerPaneId = item.id;
        // Preserve text selection when using a mouse; keyboard focus still
        // reaches every shortcut normally, and touch keeps its native behavior.
        button.addEventListener('pointerdown', event => {
          pointerSelection = null;
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          if (!move) event.preventDefault();
          else {
            const selection = doc.getSelection?.();
            if (selection?.rangeCount && !selection.isCollapsed && track.contains(selection.anchorNode)) pointerSelection = selection.getRangeAt(0).cloneRange();
          }
        });
        button.addEventListener('click', event => {
          if (Date.now() < suppressClickUntil) return;
          if (event.detail !== 0 && pointerSelection?.commonAncestorContainer?.isConnected) {
            const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(pointerSelection);
          }
          pointerSelection = null;
          activate(item.id); void reveal(item.id);
        });
        button.draggable = Boolean(move);
        if (move) {
          button.setAttribute('aria-keyshortcuts', 'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight');
          button.addEventListener('dragstart', event => {
            draggedID = item.id; dragContext = currentContext; hideTooltip();
            button.classList.add('is-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
          });
          button.addEventListener('dragover', event => {
            if (!canDrop(item.id)) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move'; clearDropMarkers();
            button.classList.add(`is-drop-${dropPosition(event, button)}`);
          });
          button.addEventListener('dragleave', clearDropMarkers);
          button.addEventListener('drop', event => {
            if (!canDrop(item.id)) return;
            event.preventDefault(); const source = draggedID, position = dropPosition(event, button);
            endDrag(); void move(source, item.id, position);
          });
          button.addEventListener('dragend', endDrag);
          button.addEventListener('keydown', event => {
            if (!event.altKey || !event.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault(); hideTooltip();
            if (context() !== currentContext) return;
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            const target = currentItems[currentItems.findIndex(entry => entry.id === item.id) + direction];
            if (target) { void move(item.id, target.id, direction < 0 ? 'before' : 'after'); button.focus({preventScroll:true}); }
          });
        }
        button.addEventListener('pointerenter', () => showTooltip(button));
        button.addEventListener('pointerleave', () => { if (doc.activeElement !== button) hideTooltip(); });
        button.addEventListener('focus', () => showTooltip(button));
        button.addEventListener('blur', hideTooltip);
        buttons.set(item.id, button);
      }
      const label = item.label || readerShortcutLabel(item);
      const occurrence = (occurrences.get(label) || 0) + 1;
      occurrences.set(label, occurrence);
      const name = item.column || item.name.includes(item.edition) || !item.edition ? item.name : `${item.name} (${item.edition})`;
      const duplicate = counts.get(label) > 1 ? `Reader ${occurrence} of ${counts.get(label)}` : '';
      const description = [name, item.location || (item.column ? '' : 'Code contents'), duplicate].filter(Boolean).join(' · ');
      button.className = `reader-shortcut code-theme-${item.theme}${item.column ? ' reader-column-shortcut' : ''}`;
      button.textContent = label;
      button.dataset.description = description;
      button.setAttribute('aria-label', `Show ${name}${item.column ? '' : ' Reader'}${item.location ? ` · ${item.location}` : ''}${duplicate ? ` · ${duplicate}` : ''}`);
      // Moving only out-of-order nodes preserves a focused shortcut on updates.
      if (host.children[index] !== button) host.insertBefore(button, host.children[index] || null);
      if (tooltipButton === button) showTooltip(button);
    });
    host.hidden = items.length === 0;
    const added = !contextChanged && previousIDs.size ? items.filter(item => !previousIDs.has(item.id)).at(-1) : null;
    if (added) activeID = added.id;
    if (!wanted.has(activeID)) activeID = items[0]?.id || '';
    if (activeID) activate(activeID);
    observe();
  }
  function schedule() {
    if (scheduled || disposed) return;
    scheduled = true;
    win.requestAnimationFrame(() => { scheduled = false; refresh(); });
  }
  function remember(event) {
    const panel = event.target.closest?.('.workspace-panel');
    if (panel && track.contains(panel)) activate(panel.dataset.paneId);
  }
  function dismiss(event) { if (event.key === 'Escape') hideTooltip(); }
  function observe() {
    observer.disconnect();
    observer.observe(track, { childList: true });
    // Observe small column headers and visibility, never passage/editor DOM.
    for (const panel of track.querySelectorAll(':scope > .workspace-panel')) {
      observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
      const header = panel.querySelector(':scope > header');
      if (header) observer.observe(header, { childList: true, characterData: true, subtree: true });
    }
  }
  const observer = new win.MutationObserver(schedule);
  track.addEventListener('permitext:workspace-layout-change', schedule);
  track.addEventListener('pointerdown', remember, { passive: true });
  track.addEventListener('focusin', remember);
  track.addEventListener('wheel', remember, { passive: true });
  track.addEventListener('scroll', hideTooltip, { passive: true });
  win.addEventListener('resize', hideTooltip, { passive: true });
  doc.addEventListener('keydown', dismiss);
  refresh();
  return {
    refresh, activePaneID: () => activeID,
    activeReaderPaneID: () => buttons.has(readerByContext.get(currentContext)) ? readerByContext.get(currentContext) : '',
    dispose() {
      disposed = true;
      observer.disconnect();
      track.removeEventListener('permitext:workspace-layout-change', schedule);
      track.removeEventListener('pointerdown', remember);
      track.removeEventListener('focusin', remember);
      track.removeEventListener('wheel', remember);
      track.removeEventListener('scroll', hideTooltip);
      win.removeEventListener('resize', hideTooltip);
      doc.removeEventListener('keydown', dismiss);
      tooltip.remove();
      for (const {button} of tools) button?.classList.remove('has-open-column');
      host.replaceChildren();
    }
  };
}
