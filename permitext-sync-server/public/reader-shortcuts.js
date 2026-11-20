let tooltipSerial = 0;

export function readerShortcutLabel({ prefix = '', edition = '' }) {
  const abbreviation = prefix === 'BC68' ? 'BC' : prefix || 'Reader';
  return /^\d{4}$/.test(edition)
    ? `${abbreviation}’${edition.slice(-2)}`
    : `${abbreviation} · ${edition || 'Current'}`;
}

function compactToolbarLabel(label) {
  return label.replace(/^Reader (\d+)$/, 'R$1')
    .replace(/\bReader(?=\s\d+$|$)/, 'R.')
    .replace(/^(Assistant|Calculator)(?=\s\d+$|$)/, word => word === 'Assistant' ? 'Asst.' : 'Calc.');
}

function createToolbarOverflow(toolbar, hideTooltip) {
  const more = toolbar?.querySelector('.workspace-tools-more');
  if (!more) return;
  const menu = toolbar.querySelector('.workspace-tools-overflow');
  const doc = toolbar.ownerDocument;
  const win = doc.defaultView;
  const events = new win.AbortController();
  let overflow = [];

  function positionMenu() {
    const bounds = more.getBoundingClientRect();
    const left = Math.max(8, Math.min(bounds.left, win.innerWidth - menu.offsetWidth - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${toolbar.getBoundingClientRect().bottom + 6}px`;
  }

  more.addEventListener('click', hideTooltip, {signal:events.signal});
  menu.addEventListener('beforetoggle', event => {
    if (event.newState !== 'open') return;
    const entries = overflow.map(button => {
      const entry = doc.createElement('button');
      entry.type = 'button';
      entry.textContent = button.querySelector('span').textContent;
      entry.disabled = button.disabled;
      if (button.dataset.readerPaneId) entry.dataset.readerPaneId = button.dataset.readerPaneId;
      entry.addEventListener('click', () => {
        menu.hidePopover();
        button.click();
      });
      return entry;
    });
    entries.find(entry => !entry.disabled)?.setAttribute('autofocus', '');
    menu.replaceChildren(...entries);
    positionMenu();
  }, {signal:events.signal});
  menu.addEventListener('toggle', positionMenu, {signal:events.signal});

  function fit() {
    if (events.signal.aborted || !toolbar.clientWidth) return;
    const focused = doc.activeElement;
    const bounds = toolbar.getBoundingClientRect();
    const fits = button => button.getBoundingClientRect().right <= bounds.right + 0.01;
    const buttons = [...toolbar.querySelectorAll('#add-reader, .reader-shortcut, [data-toolbar-tool]')];
    for (const button of buttons) button.removeAttribute('data-toolbar-overflow');
    toolbar.classList.remove('is-compact');
    const visible = buttons.filter(button => button.getClientRects().length);
    const last = visible.at(-1);
    const nextOverflow = [];
    if (last && !fits(last)) {
      toolbar.classList.add('is-compact');
      if (!fits(last)) {
        more.hidden = false;
        while (visible.length && !fits(more)) {
          const button = visible.pop();
          button.setAttribute('data-toolbar-overflow', '');
          nextOverflow.unshift(button);
        }
      }
    }
    const membershipChanged = nextOverflow.length !== overflow.length || nextOverflow.some((button, index) => button !== overflow[index]);
    if (membershipChanged) {
      hideTooltip();
      if (menu.matches(':popover-open')) menu.hidePopover();
    }
    const firstRestored = overflow[0];
    overflow = nextOverflow;
    more.hidden = !overflow.length;
    if (overflow.includes(focused)) more.focus({preventScroll:true});
    else if (more.hidden && focused === more) firstRestored?.focus({preventScroll:true});
    else if (menu.matches(':popover-open')) positionMenu();
  }

  const resizeObserver = new win.ResizeObserver(fit);
  resizeObserver.observe(toolbar);
  doc.fonts?.ready.then(fit);
  return {fit, dispose() {
    resizeObserver.disconnect();
    events.abort();
    if (menu.matches(':popover-open')) menu.hidePopover();
    for (const button of overflow) button.removeAttribute('data-toolbar-overflow');
    toolbar.classList.remove('is-compact');
    more.hidden = true;
  }};
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
    tooltip.textContent = button.dataset.description || button.getAttribute('aria-label');
    tooltip.hidden = false;
    button.setAttribute('aria-describedby', tooltip.id);
    const bounds = button.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(bounds.left, win.innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${bounds.bottom + 7}px`;
  }
  function bindTooltip(button, compactOnly = false) {
    const show = () => { if (!compactOnly || toolbar.classList.contains('is-compact')) showTooltip(button); };
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
    button => bindTooltip(button)
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
      gesture.slots = new Map([...buttons].filter(([, button]) => button.dataset.toolbarOverflow === undefined)
        .map(([id, button]) => [id, layoutBounds(button)]));
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
    const toolByPaneID = new Map(items.map(item => [item.id, item.toolKey]));
    const positioned = items.map(item => {
      const key = item.toolKey || toolByPaneID.get(item.ownerPaneID);
      return {key, rank:toolRank.get(key) || 0, button:buttons.get(item.id)};
    });
    for (const {key, button, after} of launchers) {
      if (items.some(item => item.toolKey === key)) continue;
      const rank = toolRank.get(key);
      const partner = after ? positioned.findLastIndex(item => item.key === after) : -1;
      // A later tool can be dragged to the front. Anchor closed tools to their
      // preceding tool so they do not follow the later tool across the toolbar.
      const precedingRank = Math.max(-1, ...positioned.filter(item => item.rank < rank).map(item => item.rank));
      const preceding = positioned.some(item => item.rank > rank)
        ? positioned.findLastIndex(item => item.rank === precedingRank)
        : positioned.length - 1;
      positioned.splice((partner !== -1 ? partner : preceding) + 1, 0, {key, rank, button});
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
      if (toolbarOverflow) {
        const text = doc.createElement('span');
        text.textContent = label;
        button.replaceChildren(text);
        setCompactLabel(button, label);
      } else button.textContent = label;
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
    if (!gesture?.active) toolbarOverflow?.fit();
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
    if (toolbarOverflow) {
      for (const element of toolbar.querySelectorAll('#add-reader, [data-toolbar-tool], [data-workflow-tools]')) {
        observer.observe(element, { attributes: true, attributeFilter: ['hidden'] });
      }
    }
    // Observe small column headers and visibility, never passage/editor DOM.
    for (const panel of track.querySelectorAll(':scope > :is(.workspace-panel, .shared-report-column)')) {
      observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
      const header = panel.querySelector(':scope > header');
      if (header) observer.observe(header, { childList: true, characterData: true, subtree: true });
    }
  }
  function setCompactLabel(button, label) {
    const compact = compactToolbarLabel(label);
    if (compact !== label) button.dataset.shortLabel = compact;
    else delete button.dataset.shortLabel;
  }
  const toolbarOverflow = createToolbarOverflow(toolbar, hideTooltip);
  const unbindCompactTooltips = [];
  if (toolbarOverflow) {
    const addReader = toolbar.querySelector('#add-reader');
    addReader.dataset.shortLabel = '';
    unbindCompactTooltips.push(bindTooltip(addReader, true));
    for (const {button} of launchers) {
      button.dataset.toolbarTool = '';
      setCompactLabel(button, button.textContent.trim());
      if (button.dataset.shortLabel) unbindCompactTooltips.push(bindTooltip(button, true));
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
      toolbarOverflow?.dispose();
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
      unbindCompactTooltips.forEach(unbind => unbind());
      tooltip.remove();
      restoreLaunchers();
      launchers.forEach(({home}) => home.remove());
      for (const {button} of tools) button?.classList.remove('has-open-column');
      buttons.forEach(button => button.remove());
      host.hidden = true;
    }
  };
}
