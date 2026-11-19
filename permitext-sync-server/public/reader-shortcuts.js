let tooltipSerial = 0;

export function readerShortcutLabel({ prefix = '', edition = '' }) {
  const abbreviation = prefix === 'BC68' ? 'BC' : prefix || 'Reader';
  return /^\d{4}$/.test(edition)
    ? `${abbreviation}’${edition.slice(-2)}`
    : `${abbreviation} · ${edition || 'Current'}`;
}

// The toolbar navigates columns. Code tabs and their reading sessions live in
// the Reader header rather than becoming additional toolbar shortcuts.
export function createReaderShortcuts({ host, track, readers, context, reveal, move, preview, cancelPreview, renderIcon, columnOrder, tools = [] }) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const toolbar = host.closest('.workflow-toolbar');
  const buttons = new Map();
  const activeByContext = new Map();
  const readerByContext = new Map();
  const launchers = tools.filter(({button}) => button?.parentNode).map(tool => {
    const home = doc.createElement('template');
    tool.button.parentNode.insertBefore(home, tool.button);
    return {...tool, home};
  });
  const toolRank = new Map(tools.map(({key}, index) => [key, index + 1]));
  let currentContext = '', activeID = '', scheduled = false, disposed = false;
  let gesture = null, suppressClickUntil = 0, currentItems = [];
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
    if (gesture?.active) return;
    hideTooltip();
    tooltipButton = button;
    tooltip.textContent = button.dataset.description;
    tooltip.hidden = false;
    button.setAttribute('aria-describedby', tooltip.id);
    const bounds = button.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(bounds.left, win.innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${bounds.bottom + 7}px`;
  }
  function bindTooltip(button) {
    const show = () => showTooltip(button);
    const hide = () => { if (tooltipButton === button) hideTooltip(); };
    const listeners = [
      ['pointerenter', show],
      ['pointerleave', () => { if (doc.activeElement !== button) hide(); }],
      ['focus', show],
      ['blur', hide]
    ];
    for (const [event, listener] of listeners) button.addEventListener(event, listener);
    return () => {
      for (const [event, listener] of listeners) button.removeEventListener(event, listener);
    };
  }
  const unbindLayoutTooltips = Array.from(
    doc.body.querySelector('.workflow-layout-actions')?.querySelectorAll('button') || [],
    bindTooltip
  );
  function activate(id) {
    if (!buttons.has(id)) return;
    activeID = id;
    activeByContext.set(currentContext, id);
    if (id.startsWith('reader:')) readerByContext.set(currentContext, id);
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
  }
  function layoutBounds(button) {
    const bounds = button.getBoundingClientRect();
    const x = gesture?.button === button ? gesture.x : 0;
    const y = gesture?.button === button ? gesture.y : 0;
    return {left:bounds.left - x, top:bounds.top - y, width:bounds.width, height:bounds.height};
  }
  function followPointer(event) {
    const bounds = layoutBounds(gesture.button);
    gesture.x = event.clientX - gesture.grabX - bounds.left;
    gesture.y = event.clientY - gesture.grabY - bounds.top;
    gesture.button.style.transform = `translate3d(${gesture.x}px, ${gesture.y}px, 0)`;
  }
  function finishPointer(commit = false) {
    const ended = gesture;
    if (!ended) return;
    gesture = null;
    if (ended.button.hasPointerCapture?.(ended.pointerId)) ended.button.releasePointerCapture(ended.pointerId);
    if (!ended.active) return;
    for (const button of buttons.values()) {
      button.classList.remove('is-dragging');
      button.style.transform = '';
    }
    host.classList.remove('is-reordering');
    pointerSelection = null;
    suppressClickUntil = Date.now() + 250;
    if (commit && ended.context === context() && ended.target &&
        ended.changed) {
      if (move(ended.id, ended.target, ended.position)) {
        previewOrder([]);
        return;
      }
    }
    cancelPreview?.();
    previewOrder([]);
  }
  function startPointer(event, button, id) {
    if (!move || event.button !== 0 || event.isPrimary === false || !Number.isFinite(event.clientX)) return;
    finishPointer();
    const bounds = button.getBoundingClientRect();
    gesture = {id, button, pointerId:event.pointerId, context:currentContext, active:false,
      startX:event.clientX, startY:event.clientY, grabX:event.clientX - bounds.left,
      grabY:event.clientY - bounds.top, x:0, y:0, originalOrder:columnOrder?.() || currentItems.map(item => item.id)};
  }
  function movePointer(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (gesture.context !== context()) { finishPointer(); return; }
    if (!gesture.active) {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 5) return;
      gesture.active = true;
      hideTooltip();
      gesture.button.setPointerCapture?.(gesture.pointerId);
      gesture.button.classList.add('is-dragging');
      host.classList.add('is-reordering');
      gesture.slots = new Map([...buttons].map(([id, button]) => [id, layoutBounds(button)]));
    }
    event.preventDefault();
    followPointer(event);
    const hostBounds = (toolbar || host).getBoundingClientRect();
    if (event.clientY < hostBounds.top - 16 || event.clientY > hostBounds.bottom + 16) return;
    // Use destination slots rather than animated rectangles for stable hit testing.
    const candidates = [...gesture.slots].filter(([id]) => id !== gesture.id);
    const distance = bounds => {
      const rowDistance = Math.max(bounds.top - event.clientY, event.clientY - bounds.top - bounds.height, 0);
      return rowDistance * 1000 + Math.abs(event.clientX - bounds.left - bounds.width / 2);
    };
    candidates.sort((a, b) => distance(a[1]) - distance(b[1]));
    const [target, bounds] = candidates[0] || [];
    if (!target) return;
    const position = event.clientX > bounds.left + bounds.width / 2 ? 'after' : 'before';
    if (gesture.target === target && gesture.position === position) return;
    const nextOrder = preview?.(gesture.id, target, position);
    if (!nextOrder) return;
    gesture.target = target; gesture.position = position;
    gesture.changed = nextOrder.some((id, index) => id !== gesture.originalOrder[index]);
    previewOrder(nextOrder);
    followPointer(event);
  }
  function releasePointer(event) {
    if (gesture?.pointerId === event.pointerId) finishPointer(true);
  }
  function cancelPointer(event) {
    if (gesture?.pointerId === event.pointerId) finishPointer();
  }
  function resize() { finishPointer(); hideTooltip(); }
  function toolbarNodes(items) {
    const positioned = items.map(item => ({key:item.toolKey, rank:toolRank.get(item.toolKey) || 0, button:buttons.get(item.id)}));
    for (const {key, button, after} of launchers) {
      if (items.some(item => item.toolKey === key)) continue;
      const rank = toolRank.get(key);
      const partner = after ? positioned.findLastIndex(item => item.key === after) : -1;
      const next = partner !== -1 ? partner + 1 : positioned.findIndex(item => item.rank > rank);
      positioned.splice(next === -1 ? positioned.length : next, 0, {key, rank, button});
    }
    return positioned.map(item => item.button);
  }
  function previewOrder(ids) {
    for (const button of [...buttons.values(), ...launchers.map(item => item.button)]) button.style.order = '';
    if (!ids.length) return;
    const byID = new Map(currentItems.map(item => [item.id, item]));
    toolbarNodes(ids.map(id => byID.get(id)).filter(Boolean)).forEach((button, index) => {
      button.style.order = String(index);
    });
  }
  function placeButton(parent, button, reference) {
    if (button === reference) return;
    if (parent.moveBefore && button.isConnected) parent.moveBefore(button, reference || null);
    else {
      const focused = doc.activeElement === button;
      parent.insertBefore(button, reference || null);
      if (focused) button.focus({preventScroll:true});
    }
  }
  function restoreLaunchers(items = []) {
    for (const {button, home, key} of launchers) {
      if (items.length && !items.some(item => item.toolKey === key)) continue;
      const parent = home.parentNode;
      const children = [...parent.children];
      placeButton(parent, button, children[children.indexOf(home) + 1]);
    }
  }
  function refresh() {
    if (disposed) return;
    const nextContext = context();
    const contextChanged = nextContext !== currentContext;
    const previousIDs = new Set(buttons.keys());
    if (contextChanged) {
      finishPointer();
      currentContext = nextContext;
      activeID = activeByContext.get(currentContext) || '';
      hideTooltip();
    }
    const items = readers();
    if (gesture && (items.length !== currentItems.length || items.some((item, index) => item.id !== currentItems[index]?.id))) finishPointer();
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
    items.forEach(item => {
      let button = buttons.get(item.id);
      if (!button) {
        button = doc.createElement('button');
        button.type = 'button';
        button.dataset.readerPaneId = item.id;
        // Preserve text selection when using a mouse; keyboard focus still
        // reaches every shortcut normally; dragging supports mouse, pen and touch.
        button.addEventListener('pointerdown', event => {
          pointerSelection = null;
          startPointer(event, button, item.id);
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
        // Pointer dragging moves the real bubble; native HTML drag images are disabled.
        button.draggable = false;
        button.dataset.reorderable = String(Boolean(move));
        button.addEventListener('dragstart', event => event.preventDefault());
        button.addEventListener('lostpointercapture', cancelPointer);
        if (move) {
          button.setAttribute('aria-keyshortcuts', 'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight');
          button.addEventListener('keydown', event => {
            if (!event.altKey || !event.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault(); hideTooltip();
            if (context() !== currentContext || gesture?.active) return;
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            const order = (columnOrder?.() || currentItems.map(entry => entry.id)).filter(id => buttons.has(id));
            const target = order[order.indexOf(item.id) + direction];
            if (target) { void move(item.id, target, direction < 0 ? 'before' : 'after'); button.focus({preventScroll:true}); }
          });
        }
        bindTooltip(button);
        buttons.set(item.id, button);
      }
      const label = item.label || readerShortcutLabel(item);
      const occurrence = (occurrences.get(label) || 0) + 1;
      occurrences.set(label, occurrence);
      const name = item.column || item.name.includes(item.edition) || !item.edition ? item.name : `${item.name} (${item.edition})`;
      const duplicate = counts.get(label) > 1 ? `Reader ${occurrence} of ${counts.get(label)}` : '';
      const description = [name, item.location || (item.column ? '' : 'Code contents'), duplicate].filter(Boolean).join(' · ');
      button.className = `reader-shortcut code-theme-${item.theme}${item.column ? ' reader-column-shortcut' : ''}`;
      if (gesture?.active && gesture.id === item.id) button.classList.add('is-dragging');
      button.textContent = label;
      if (item.iconName) renderIcon?.(button, item.iconName);
      button.dataset.description = description;
      button.setAttribute('aria-label', `Show ${name}${item.column ? '' : ' Reader'}${item.location ? ` · ${item.location}` : ''}${duplicate ? ` · ${duplicate}` : ''}`);
      if (tooltipButton === button) showTooltip(button);
    });
    restoreLaunchers(items);
    if (items.length) {
      toolbarNodes(items).forEach((button, index) => placeButton(host, button, host.children[index]));
    }
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
    const panel = event.target.closest?.('.workspace-panel, .shared-report-column');
    if (panel && track.contains(panel)) activate(panel.dataset.paneId);
  }
  function dismiss(event) { if (event.key === 'Escape') { finishPointer(); hideTooltip(); } }
  function observe() {
    observer.disconnect();
    observer.observe(track, { childList: true });
    // Observe small column headers and visibility, never passage/editor DOM.
    for (const panel of track.querySelectorAll(':scope > :is(.workspace-panel, .shared-report-column)')) {
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
  toolbar?.addEventListener('scroll', hideTooltip, { passive: true });
  win.addEventListener('resize', resize, { passive: true });
  doc.addEventListener('pointermove', movePointer, { passive: false });
  doc.addEventListener('pointerup', releasePointer);
  doc.addEventListener('pointercancel', cancelPointer);
  doc.addEventListener('keydown', dismiss);
  refresh();
  return {
    refresh, previewOrder, activePaneID: () => activeID,
    activeReaderPaneID: () => buttons.has(readerByContext.get(currentContext)) ? readerByContext.get(currentContext) : '',
    dispose() {
      finishPointer();
      disposed = true;
      observer.disconnect();
      track.removeEventListener('permitext:workspace-layout-change', schedule);
      track.removeEventListener('pointerdown', remember);
      track.removeEventListener('focusin', remember);
      track.removeEventListener('wheel', remember);
      track.removeEventListener('scroll', hideTooltip);
      toolbar?.removeEventListener('scroll', hideTooltip);
      win.removeEventListener('resize', resize);
      doc.removeEventListener('pointermove', movePointer);
      doc.removeEventListener('pointerup', releasePointer);
      doc.removeEventListener('pointercancel', cancelPointer);
      doc.removeEventListener('keydown', dismiss);
      hideTooltip();
      unbindLayoutTooltips.forEach(unbind => unbind());
      tooltip.remove();
      restoreLaunchers();
      launchers.forEach(({home}) => home.remove());
      for (const {button} of tools) button?.classList.remove('has-open-column');
      buttons.forEach(button => button.remove());
      host.hidden = true;
    }
  };
}
