const keys = ['account', 'library', 'recovery'];
const titles = ['Account', 'Library & offline', 'Data & recovery'];
const minimums = [360, 480, 360];
const defaultWeights = [1, 1.5, 1];

export function normalizeSettingsColumnWidths(value) {
  return Array.isArray(value) && value.length === 3 &&
    value.every((width, index) => Number.isFinite(Number(width)) && Number(width) >= minimums[index])
    ? value.map(Number) : null;
}

export function resizeSettingsColumnPair(widths, index, delta) {
  const next = [...widths];
  const total = next[index] + next[index + 1];
  next[index] = Math.max(minimums[index], Math.min(total - minimums[index + 1], next[index] + delta));
  next[index + 1] = total - next[index];
  return next;
}

export function createSettingsColumnResizers(columns, panels, savedWidths, onResize = () => {}) {
  let preferred = normalizeSettingsColumnWidths(savedWidths);
  let drag = null;
  const dividers = [];
  const collapsed = index => panels[index].classList.contains('is-collapsed');
  const measured = () => panels.map((panel, index) => collapsed(index)
    ? (preferred?.[index] || minimums[index]) : Math.max(minimums[index], panel.getBoundingClientRect().width));
  const enabled = index => !collapsed(index) && !collapsed(index + 1);
  const update = () => {
    const bounds = columns.getBoundingClientRect();
    const current = measured();
    dividers.forEach((divider, index) => {
      divider.style.left = `${panels[index].getBoundingClientRect().right - bounds.left - 1}px`;
      divider.tabIndex = enabled(index) ? 0 : -1;
      divider.setAttribute('aria-disabled', String(!enabled(index)));
      divider.setAttribute('aria-valuemin', String(minimums[index]));
      divider.setAttribute('aria-valuemax', String(Math.round(current[index] + current[index + 1] - minimums[index + 1])));
      divider.setAttribute('aria-valuenow', String(Math.round(current[index])));
      divider.setAttribute('aria-valuetext', `${Math.round(current[index])} and ${Math.round(current[index + 1])} pixels wide`);
    });
  };
  const paint = () => {
    keys.forEach((key, index) => columns.style.setProperty(`--settings-${key}-width`, collapsed(index)
      ? '48px' : `minmax(${minimums[index]}px, ${preferred?.[index] || defaultWeights[index]}fr)`));
    update();
  };
  const apply = widths => { preferred = normalizeSettingsColumnWidths(widths); paint(); };
  const finish = () => {
    const previous = drag;
    drag = null;
    columns.classList.remove('is-resizing');
    if (previous?.divider.hasPointerCapture?.(previous.pointerID)) previous.divider.releasePointerCapture(previous.pointerID);
  };
  for (let index = 0; index < 2; index += 1) {
    const divider = columns.ownerDocument.createElement('div');
    divider.className = 'settings-column-divider';
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-orientation', 'vertical');
    divider.setAttribute('aria-label', `Resize ${titles[index]} and ${titles[index + 1]}`);
    divider.title = 'Drag to resize · Arrow keys to adjust · Double-click to reset widths';
    divider.addEventListener('focus', update);
    divider.addEventListener('dblclick', () => {
      if (!enabled(index)) return;
      finish(); apply(null); onResize(null);
    });
    divider.addEventListener('keydown', event => {
      if (!enabled(index) || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = measured();
      const step = event.shiftKey ? 80 : 24;
      const delta = event.key === 'Home' ? minimums[index] - current[index] :
        event.key === 'End' ? current[index + 1] - minimums[index + 1] :
        event.key === 'ArrowLeft' ? -step : step;
      apply(resizeSettingsColumnPair(current, index, delta));
      onResize([...preferred]);
    });
    divider.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !enabled(index)) return;
      event.preventDefault();
      divider.focus({preventScroll: true});
      drag = {divider, pointerID: event.pointerId, x: event.clientX, widths: measured()};
      divider.setPointerCapture(event.pointerId);
      columns.classList.add('is-resizing');
    });
    divider.addEventListener('pointermove', event => {
      if (drag?.divider !== divider || drag.pointerID !== event.pointerId) return;
      apply(resizeSettingsColumnPair(drag.widths, index, event.clientX - drag.x));
    });
    const finishPointer = event => {
      if (drag?.divider !== divider || drag.pointerID !== event.pointerId) return;
      finish();
      if (preferred) onResize([...preferred]);
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(event, finishPointer);
    columns.append(divider);
    dividers.push(divider);
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
  observer?.observe(columns);
  panels.forEach(panel => observer?.observe(panel));
  paint();
  return {
    refresh() { finish(); paint(); },
    dispose() { finish(); observer?.disconnect(); }
  };
}
