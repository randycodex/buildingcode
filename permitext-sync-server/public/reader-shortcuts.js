let tooltipSerial = 0;

export function readerShortcutLabel({ prefix = '', edition = '' }) {
  const abbreviation = prefix === 'BC68' ? 'BC' : prefix || 'Reader';
  return /^\d{4}$/.test(edition)
    ? `${abbreviation}’${edition.slice(-2)}`
    : `${abbreviation} · ${edition || 'Current'}`;
}

// The toolbar navigates columns. Code tabs and their reading sessions live in
// the Reader header rather than becoming additional toolbar shortcuts.
export function createReaderShortcuts({ host, track, readers, context, reveal, move, preview, cancelPreview, renderIcon, tools = [] }) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const buttons = new Map();
  const activeByContext = new Map();
  const readerByContext = new Map();
  let currentContext = '', activeID = '', scheduled = false, disposed = false;
  let gesture = null, suppressClickUntil = 0, currentItems = [];
  const animations = new Map();
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
  function activate(id) {
    if (!buttons.has(id)) return;
    activeID = id;
    activeByContext.set(currentContext, id);
    if (id.startsWith('reader:')) readerByContext.set(currentContext, id);
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
  }
  function stopAnimations() {
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
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
    stopAnimations();
    for (const button of buttons.values()) {
      button.classList.remove('is-dragging');
      button.style.order = '';
      button.style.transform = '';
    }
    host.classList.remove('is-reordering');
    cancelPreview?.();
    pointerSelection = null;
    suppressClickUntil = Date.now() + 250;
    if (commit && ended.context === context() && ended.target &&
        ended.order.some((id, index) => id !== currentItems[index]?.id)) {
      void move(ended.id, ended.target, ended.position);
    }
  }
  function startPointer(event, button, id) {
    if (!move || event.button !== 0 || event.isPrimary === false || !Number.isFinite(event.clientX)) return;
    finishPointer();
    const bounds = button.getBoundingClientRect();
    gesture = {id, button, pointerId:event.pointerId, context:currentContext, active:false,
      startX:event.clientX, startY:event.clientY, grabX:event.clientX - bounds.left,
      grabY:event.clientY - bounds.top, x:0, y:0, order:currentItems.map(item => item.id)};
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
    const hostBounds = host.getBoundingClientRect();
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
    const visibleOrder = nextOrder.filter(id => buttons.has(id));
    if (visibleOrder.every((id, index) => id === gesture.order[index])) return;
    stopAnimations();
    const previous = new Map([...buttons].map(([id, button]) => [id, layoutBounds(button)]));
    gesture.order = visibleOrder;
    visibleOrder.forEach((id, index) => { buttons.get(id).style.order = String(index); });
    gesture.slots = new Map([...buttons].map(([id, button]) => [id, layoutBounds(button)]));
    if (!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      for (const [id, button] of buttons) {
        if (id === gesture.id || !button.animate) continue;
        const before = previous.get(id), after = gesture.slots.get(id);
        animations.set(id, button.animate([
          {transform:`translate(${before.left - after.left}px, ${before.top - after.top}px)`},
          {transform:'none'}
        ], {duration:140, easing:'ease-out'}));
      }
    }
    followPointer(event);
  }
  function releasePointer(event) {
    if (gesture?.pointerId === event.pointerId) finishPointer(true);
  }
  function cancelPointer(event) {
    if (gesture?.pointerId === event.pointerId) finishPointer();
  }
  function resize() { finishPointer(); hideTooltip(); }
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
    items.forEach((item, index) => {
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
      if (gesture?.active && gesture.id === item.id) button.classList.add('is-dragging');
      button.textContent = label;
      if (item.iconName) renderIcon?.(button, item.iconName);
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
  function dismiss(event) { if (event.key === 'Escape') { finishPointer(); hideTooltip(); } }
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
  win.addEventListener('resize', resize, { passive: true });
  doc.addEventListener('pointermove', movePointer, { passive: false });
  doc.addEventListener('pointerup', releasePointer);
  doc.addEventListener('pointercancel', cancelPointer);
  doc.addEventListener('keydown', dismiss);
  refresh();
  return {
    refresh, activePaneID: () => activeID,
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
      win.removeEventListener('resize', resize);
      doc.removeEventListener('pointermove', movePointer);
      doc.removeEventListener('pointerup', releasePointer);
      doc.removeEventListener('pointercancel', cancelPointer);
      doc.removeEventListener('keydown', dismiss);
      tooltip.remove();
      for (const {button} of tools) button?.classList.remove('has-open-column');
      host.replaceChildren();
    }
  };
}
