const maximumSidebarWidth = 720;

function createReportSidebarControls({ panel, shell, element, kind, label, defaultWidth, minimumWidth,
  availableWidth = () => shell.clientWidth, reservedWidth = () => 0, onResize = () => {}, resizeDirection = 1 }) {
  const header = document.createElement('header');
  header.className = `report-${kind}-header`;
  const title = document.createElement('h2');
  title.textContent = label;
  header.append(title);

  const divider = document.createElement('div');
  divider.className = `report-${kind}-divider`;
  divider.tabIndex = 0;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.setAttribute('aria-label', `Resize ${label}`);
  divider.title = 'Drag to resize · Arrow keys to adjust · Double-click to reset';

  const maximumWidth = () => {
    const available = availableWidth();
    if (!available) return maximumSidebarWidth;
    return Math.max(minimumWidth, Math.min(maximumSidebarWidth, available - reservedWidth() - 601));
  };
  const currentWidth = () => Number(panel.dataset[`${kind}Width`]) || defaultWidth;
  const updateControls = () => {
    const width = Math.min(currentWidth(), maximumWidth());
    divider.setAttribute('aria-valuemin', String(minimumWidth));
    divider.setAttribute('aria-valuemax', String(maximumWidth()));
    divider.setAttribute('aria-valuenow', String(Math.round(width)));
    divider.setAttribute('aria-valuetext', `${Math.round(width)} pixels wide`);
  };
  const resize = requested => {
    const width = Math.max(minimumWidth, Math.min(maximumWidth(), requested));
    panel.dataset[`${kind}Width`] = String(width);
    panel.style.setProperty(`--report-${kind}-width`, `${width}px`);
    onResize();
    updateControls();
  };
  divider.addEventListener('focus', updateControls);
  divider.addEventListener('dblclick', () => resize(defaultWidth));
  divider.addEventListener('keydown', event => {
    const step = event.shiftKey ? 80 : 24;
    const requests = {
      ArrowLeft: currentWidth() - resizeDirection * step,
      ArrowRight: currentWidth() + resizeDirection * step,
      Home: minimumWidth,
      End: maximumWidth()
    };
    if (!(event.key in requests)) return;
    event.preventDefault();
    resize(requests[event.key]);
  });
  let drag = null;
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    divider.focus();
    drag = { pointerID: event.pointerId, x: event.clientX, width: element.getBoundingClientRect().width };
    divider.setPointerCapture(event.pointerId);
    shell.classList.add(`is-${kind}-resizing`);
  });
  divider.addEventListener('pointermove', event => {
    if (drag?.pointerID === event.pointerId) resize(drag.width + resizeDirection * (event.clientX - drag.x));
  });
  const finishDrag = event => {
    if (drag?.pointerID !== event.pointerId) return;
    drag = null;
    shell.classList.remove(`is-${kind}-resizing`);
    if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
  };
  divider.addEventListener('pointerup', finishDrag);
  divider.addEventListener('pointercancel', finishDrag);
  divider.addEventListener('lostpointercapture', finishDrag);
  shell.classList.remove(`is-${kind}-resizing`);
  updateControls();
  return { header, divider, update: updateControls };
}

export function createReportLibraryControls(options) {
  return createReportSidebarControls({ ...options, element: options.library, kind: 'library',
    label: 'Sources', defaultWidth: 330, minimumWidth: 280 });
}

export function createReportOutlineControls(options) {
  return createReportSidebarControls({ ...options, element: options.outline, kind: 'outline',
    label: 'Outline', defaultWidth: 300, minimumWidth: 300 });
}

export function createReportVersionsControls(options) {
  return createReportSidebarControls({ ...options, element: options.versions, kind: 'versions',
    label: 'Versions', defaultWidth: 300, minimumWidth: 300, resizeDirection: -1 });
}
