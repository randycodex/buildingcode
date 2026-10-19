export function adjacentColumnWidths(left, right, delta, leftMin, rightMin, leftMax = Infinity, rightMax = Infinity,
  { expandLeft = false, expandRight = false } = {}) {
  // Readers can add workspace width after their neighbor reaches its minimum.
  // Other columns keep transferring only the space available in the pair.
  const lower = Math.max(expandRight ? -Infinity : leftMin - left, right - rightMax);
  const upper = Math.min(expandLeft ? Infinity : right - rightMin, leftMax - left);
  const change = Math.max(lower, Math.min(upper, delta));
  return [Math.max(leftMin, left + change), Math.max(rightMin, right - change)];
}

// Presentation-only expansion: live editors and their saved widths stay mounted.
export function createColumnExpansion({ host, columns, label, key = node => node.dataset.paneId,
  context = () => '', minimumWidth = () => 600, menu = true, capturePosition = () => null, restorePosition = () => {} }) {
  let expanded = null;
  let contextKey = context();
  let active = null;
  let scheduled = false;
  let disposed = false;
  let savedScrollLeft = 0;
  const rails = new Map();
  const scrollPositions = new Map();
  let layoutSignature = "";
  const tabs = document.createElement('div');
  tabs.className = 'workspace-column-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Workspace columns');
  host.before(tabs);
  const visible = () => columns().filter(node => !node.hidden && !node.classList.contains('is-workflow-hidden') && !node.classList.contains('is-group-hidden'));
  const restore = () => { if (!expanded) return; expanded = null; render(true); host.scrollLeft = savedScrollLeft; };
  function render(animate = false) {
    if (disposed) return;
    const nextContext = context();
    if (nextContext !== contextKey) { expanded = active = null; contextKey = nextContext; }
    const current = columns();
    for (const [node, rail] of rails) if (!current.includes(node)) { rail.remove(); rails.delete(node); scrollPositions.delete(node); }
    const panes = visible();
    if (!panes.includes(expanded)) expanded = null;
    if (!panes.includes(active)) active = panes.find(node => !node.classList.contains('is-collapsed')) || panes[0];
    const narrow = host.clientWidth > 0 && host.clientWidth < Math.min(960, panes.reduce((sum, node) => sum + minimumWidth(node), 0));
    const target = narrow ? (expanded || active) : expanded;
    const nextLayout = `${contextKey}:${narrow}:${key(target || host)}:${panes.map(key).join('|')}`;
    const changed = nextLayout !== layoutSignature;
    const position = changed ? capturePosition() : null;
    if (changed) for (const node of columns()) {
      if (!node.classList.contains('is-column-strip') && !node.classList.contains('is-column-tab-hidden')) {
        scrollPositions.set(node, [node, ...node.querySelectorAll('*')].filter(child => child.scrollTop || child.scrollLeft)
          .map(child => ({ child, top: child.scrollTop, left: child.scrollLeft })));
      }
    }
    layoutSignature = nextLayout;
    host.classList.toggle('has-expanded-column', Boolean(target));
    host.classList.toggle('has-column-tabs', narrow && panes.length > 1);
    tabs.hidden = !narrow || panes.length < 2;

    for (const node of columns()) {
      const aside = Boolean(target && node !== target && panes.includes(node));
      node.classList.toggle('is-column-strip', aside && !narrow);
      node.classList.toggle('is-column-tab-hidden', aside && narrow);
      node.classList.toggle('is-column-expanded', node === target);
      let rail = rails.get(node);
      if (!rail) {
        rail = document.createElement('button');
        rail.type = 'button';
        rail.className = 'column-restore-strip';
        rail.addEventListener('click', () => { active = node; restore(); });
        node.append(rail);
        rails.set(node, rail);
      }
      if (rail.parentElement !== node) node.append(rail);
      rail.textContent = label(node);
      rail.setAttribute('aria-label', `Restore ${label(node)} column`);
      rail.hidden = !aside || narrow;
    }
    const signature = panes.map(node => `${key(node)}:${label(node)}:${node === target}`).join('|');
    if (tabs.dataset.signature !== signature) {
      tabs.dataset.signature = signature;
      tabs.replaceChildren(...panes.map(node => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.textContent = label(node);
        button.setAttribute('aria-selected', String(node === target));
        button.tabIndex = node === target ? 0 : -1;
        button.addEventListener('click', () => { active = node; expanded = null; render(); tabs.querySelector('[aria-selected="true"]')?.focus(); });
        return button;
      }));
    }
    if (menu) prepareMenus();
    if (changed) {
      for (const node of panes) if (!target || node === target) {
        for (const { child, top, left } of scrollPositions.get(node) || []) { child.scrollTop = top; child.scrollLeft = left; }
      }
      restorePosition(position);
    }
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const node of panes) {
        node._columnExpansionAnimation?.cancel();
        node._columnExpansionAnimation = node.animate([
          { opacity: 0.55 }, { opacity: 1 }
        ], { duration: 180, easing: 'ease-out' });
      }
    }
  }
  const schedule = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  };
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...tabs.children];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault(); buttons[next]?.click();
  });
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type === 'childList' && (record.target === host || menu && columns().includes(record.target)) || record.type === 'attributes' && ['hidden', 'class'].includes(record.attributeName) && columns().includes(record.target))) schedule();
  });
  observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  const resize = new ResizeObserver(schedule);
  resize.observe(host);
  const api = { refresh: schedule, restore,
    reveal(node) { if (!node) return; expanded = null; active = node; render(); },
    isExpanded: node => expanded === node,
    expand(node) { if (!expanded) savedScrollLeft = host.scrollLeft; active = expanded = node; render(true); host.scrollLeft = 0; },
    dispose() { disposed = true; observer.disconnect(); resize.disconnect(); tabs.remove(); } };
  // Nested report columns have their own header menus; ordinary workspace panes
  // use the shared column menu in app.js.
  function prepareMenus() { for (const node of columns()) {
    if (node.querySelector('.column-expansion-options')) continue;
    let header = node.querySelector(':scope > header, :scope > .report-draft-picker');
    if (!header) { header = document.createElement('header'); header.className = 'column-expansion-header'; node.prepend(header); }
    const options = document.createElement('details');
    options.className = 'column-expansion-options';
    const trigger = document.createElement('summary');
    trigger.textContent = '⋯'; trigger.setAttribute('aria-label', `${label(node)} column options`);
    const action = document.createElement('button'); action.type = 'button';
    options.addEventListener('toggle', () => { action.textContent = api.isExpanded(node) ? 'Restore width' : 'Expand'; });
    action.addEventListener('click', () => { options.open = false; api.isExpanded(node) ? restore() : api.expand(node); });
    options.append(trigger, action); header.append(options);
  }
  }
  render();
  return api;
}
