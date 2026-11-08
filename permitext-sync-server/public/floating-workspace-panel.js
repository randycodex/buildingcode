// Shared non-modal behavior for the Settings and Project context menus.
export function floatingWorkspacePanelBounds(anchor, width, viewportWidth, viewportHeight) {
  const gutter = 8;
  const top = Math.max(gutter, anchor.bottom + 8);
  return {
    left: Math.max(gutter, Math.min(anchor.right - width, viewportWidth - width - gutter)),
    top,
    maxHeight: Math.max(80, viewportHeight - top - 16)
  };
}

export function bindFloatingWorkspacePanel(panel, { anchor, dismiss, alignmentReference, isOpen = () => panel.isConnected, manageAnchor = false }) {
  const controller = new AbortController();
  const { signal } = controller;
  const position = () => {
    if (!isOpen() || !anchor?.isConnected) return;
    const anchorBounds = anchor.getBoundingClientRect();
    const reference = typeof alignmentReference === 'function' ? alignmentReference() : alignmentReference;
    const bounds = floatingWorkspacePanelBounds({ right: reference?.right ?? anchorBounds.right, bottom: reference?.bottom ?? anchorBounds.bottom }, panel.offsetWidth, window.innerWidth, window.innerHeight);
    panel.style.left = `${bounds.left}px`;
    panel.style.top = `${bounds.top}px`;
    panel.style.maxHeight = `${bounds.maxHeight}px`;
  };
  const nestedOverlay = target => target?.closest?.('dialog[open], .web-modal-backdrop, .custom-select-menu, .column-group-menu');
  const close = () => {
    if (panel.contains(document.activeElement)) document.activeElement?.blur?.();
    dismiss();
  };
  document.addEventListener('pointerdown', event => {
    if (!isOpen() || panel.contains(event.target) || anchor?.contains(event.target) || nestedOverlay(event.target)) return;
    close();
  }, { signal });
  document.addEventListener('keydown', event => {
    if (!isOpen() || event.defaultPrevented || event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    close();
    anchor?.focus({ preventScroll: true });
  }, { signal });
  window.addEventListener('resize', position, { signal });
  if (manageAnchor) anchor?.setAttribute('aria-expanded', 'true');
  position();
  return {
    position,
    dispose() {
      controller.abort();
      if (manageAnchor) anchor?.setAttribute('aria-expanded', 'false');
    }
  };
}

export function createFloatingWorkspaceTabs({ id, label, entries, selected = entries[0]?.id, onSelect = () => {} }) {
  const controller = new AbortController();
  const nav = document.createElement('nav');
  nav.className = 'floating-workspace-tabs';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', label);
  const tabs = entries.map(entry => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `${id}-tab-${entry.id}`;
    button.textContent = entry.label;
    button.setAttribute('role', 'tab');
    entry.panel.id = `${id}-panel-${entry.id}`;
    entry.panel.setAttribute('role', 'tabpanel');
    entry.panel.setAttribute('aria-labelledby', button.id);
    button.setAttribute('aria-controls', entry.panel.id);
    nav.append(button);
    return { ...entry, button };
  });
  const select = (key, { focus = false } = {}) => {
    const active = tabs.find(tab => tab.id === key) || tabs[0];
    if (!active) return;
    tabs.forEach(tab => {
      const visible = tab === active;
      tab.button.setAttribute('aria-selected', String(visible));
      tab.button.tabIndex = visible ? 0 : -1;
      tab.panel.hidden = !visible;
      tab.panel.inert = !visible;
    });
    onSelect(active.id);
    if (focus) active.button.focus({ preventScroll: true });
  };
  tabs.forEach((tab, index) => {
    tab.button.addEventListener('click', () => select(tab.id), { signal: controller.signal });
    tab.button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      select(tabs[next].id, { focus: true });
    }, { signal: controller.signal });
  });
  select(selected);
  return { element: nav, select, dispose: () => controller.abort() };
}
