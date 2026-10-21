export const projectDetailsMinimumWidth = 400;

export function normalizeProjectDetailsWidths(value) {
  return Array.isArray(value) && value.length >= 2 && value.length <= 3 &&
    value.every(width => Number.isFinite(Number(width)) && Number(width) >= projectDetailsMinimumWidth)
    ? value.map(Number) : null;
}

export function resizeProjectDetailsPair(widths, index, delta) {
  const next = widths.map(width => Math.max(projectDetailsMinimumWidth, width));
  const total = next[index] + next[index + 1];
  next[index] = Math.max(projectDetailsMinimumWidth, Math.min(total - projectDetailsMinimumWidth, next[index] + delta));
  next[index + 1] = total - next[index];
  return next;
}

export function createProjectDetailsColumnResizers(columns, panels, onResize = () => {}) {
  let lastWidths = panels.map(() => projectDetailsMinimumWidth);
  let drag = null;
  const dividers = [];
  const widths = () => {
    const measured = panels.map(panel => panel.getBoundingClientRect().width);
    if (measured.every(width => width > 0)) lastWidths = measured.map(width => Math.max(projectDetailsMinimumWidth, width));
    return [...lastWidths];
  };
  const update = () => {
    const current = widths();
    dividers.forEach((divider, index) => {
      divider.setAttribute('aria-valuemin', String(projectDetailsMinimumWidth));
      divider.setAttribute('aria-valuemax', String(Math.round(current[index] + current[index + 1] - projectDetailsMinimumWidth)));
      divider.setAttribute('aria-valuenow', String(Math.round(current[index])));
      divider.setAttribute('aria-valuetext', `${Math.round(current[index])} and ${Math.round(current[index + 1])} pixels wide`);
    });
  };
  const apply = value => {
    const normalized = normalizeProjectDetailsWidths(value)?.slice(0, panels.length);
    if (normalized) {
      lastWidths = normalized;
      columns.style.gridTemplateColumns = normalized.map(width => `minmax(400px, ${width}fr)`).join(' 1px ');
    } else columns.style.removeProperty('grid-template-columns');
    update();
  };
  const finish = () => {
    const previous = drag;
    drag = null;
    columns.classList.remove('is-resizing');
    if (previous?.divider.hasPointerCapture?.(previous.pointerID)) previous.divider.releasePointerCapture(previous.pointerID);
  };
  for (let index = 0; index < panels.length - 1; index += 1) {
    const divider = columns.ownerDocument.createElement('div');
    divider.className = 'project-details-divider';
    divider.tabIndex = 0;
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-orientation', 'vertical');
    divider.setAttribute('aria-label', 'Resize Context and Facts');
    divider.title = 'Drag to resize · Arrow keys to adjust · Double-click to balance columns';
    divider.addEventListener('focus', update);
    divider.addEventListener('dblclick', () => { apply(null); onResize(); });
    divider.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = widths();
      const step = event.shiftKey ? 80 : 24;
      const delta = event.key === 'Home' ? projectDetailsMinimumWidth - current[index] :
        event.key === 'End' ? current[index + 1] - projectDetailsMinimumWidth :
        event.key === 'ArrowLeft' ? -step : step;
      apply(resizeProjectDetailsPair(current, index, delta));
      onResize();
    });
    divider.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      divider.focus({preventScroll: true});
      drag = {divider, pointerID: event.pointerId, x: event.clientX, widths: widths()};
      divider.setPointerCapture(event.pointerId);
      columns.classList.add('is-resizing');
    });
    divider.addEventListener('pointermove', event => {
      if (drag?.divider !== divider || drag.pointerID !== event.pointerId) return;
      apply(resizeProjectDetailsPair(drag.widths, index, event.clientX - drag.x));
    });
    const finishPointer = event => {
      if (drag?.divider !== divider || drag.pointerID !== event.pointerId) return;
      finish();
      onResize();
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(event, finishPointer);
    columns.insertBefore(divider, panels[index + 1]);
    dividers.push(divider);
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
  observer?.observe(columns);
  update();
  return {getWidths: widths, setWidths: apply, cancel: finish,
    dispose() { finish(); observer?.disconnect(); }};
}
