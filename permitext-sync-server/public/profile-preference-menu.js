// A compact, single-choice menu for an Account preference row.
export function profilePreferenceMenuBounds(anchor, width, height, viewportWidth, viewportHeight) {
  const gap = 8;
  return {
    left: Math.max(gap, Math.min(anchor.right - width, viewportWidth - width - gap)),
    top: Math.max(gap, anchor.bottom + gap + height <= viewportHeight - gap
      ? anchor.bottom + gap : anchor.top - height - gap)
  };
}

export function openProfilePreferenceMenu({ trigger, anchor = trigger, label, value, options, className = '', onSelect, onDismiss, onTab }) {
  const controller = new AbortController();
  const { signal } = controller;
  const menu = document.createElement('div');
  menu.className = `custom-select-menu profile-preference-menu ${className}`.trim();
  menu.id = `profile-preference-${crypto.randomUUID()}`;
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', `${label} options`);
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', menu.id);
  let closed = false;
  const destroy = ({ restoreFocus = false } = {}) => {
    if (closed) return;
    closed = true;
    controller.abort();
    menu.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const dismiss = ({ restoreFocus = false } = {}) => {
    if (closed) return;
    destroy({ restoreFocus });
    onDismiss?.();
  };
  const items = options.map(option => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'custom-select-option';
    item.textContent = option.label;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(option.value === value));
    item.tabIndex = option.value === value ? 0 : -1;
    item.addEventListener('click', () => {
      destroy({ restoreFocus: true });
      onSelect(option.value);
    }, { signal });
    menu.append(item);
    return item;
  });
  const position = () => {
    const anchorBounds = anchor.getBoundingClientRect();
    const rowBounds = trigger.getBoundingClientRect();
    const bounds = profilePreferenceMenuBounds({ right: anchorBounds.right, top: rowBounds.top, bottom: rowBounds.bottom }, menu.offsetWidth, menu.offsetHeight, window.innerWidth, window.innerHeight);
    menu.style.left = `${bounds.left}px`;
    menu.style.top = `${bounds.top}px`;
  };
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss({ restoreFocus: true });
    } else if (event.key === 'Tab') {
      event.preventDefault();
      dismiss();
      onTab?.(event.shiftKey);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((item, index) => { item.tabIndex = index === next ? 0 : -1; });
      items[next]?.focus({ preventScroll: true });
    }
  }, { signal });
  document.addEventListener('pointerdown', event => {
    if (!trigger.contains(event.target) && !menu.contains(event.target)) dismiss();
  }, { signal });
  document.addEventListener('scroll', () => dismiss(), { capture: true, signal });
  window.addEventListener('resize', position, { signal });
  document.body.append(menu);
  position();
  (items.find(item => item.getAttribute('aria-selected') === 'true') || items[0])?.focus({ preventScroll: true });
  return { destroy, dismiss };
}
