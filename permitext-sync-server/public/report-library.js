const maximumSidebarWidth = 720;

function createReportSidebarControls({ panel, shell, element, kind, label, defaultWidth, minimumWidth,
  availableWidth = () => shell.clientWidth, reservedWidth = () => 0, documentMinimumWidth = () => 600,
  onResize = () => {}, resizeDirection = 1 }) {
  const header = document.createElement('header');
  header.className = `report-${kind}-header`;
  const title = document.createElement('h2');
  title.textContent = label;
  header.append(title);

  const maximumWidth = () => {
    const available = availableWidth();
    if (!available) return maximumSidebarWidth;
    return Math.max(minimumWidth, Math.min(maximumSidebarWidth, available - reservedWidth() - documentMinimumWidth() - 1));
  };
  const currentWidth = () => Number(panel.dataset[`${kind}Width`]) || defaultWidth;
  const resize = createReportResizeDivider({
    shell, element, kind, label, defaultWidth: () => defaultWidth, minimumWidth: () => minimumWidth, maximumWidth,
    currentWidth, resizeDirection,
    onResize(width, drag) {
      panel.dataset[`${kind}Width`] = String(width);
      panel.style.setProperty(`--report-${kind}-width`, `${width}px`);
      onResize(drag);
    }
  });
  return {header, ...resize};
}

export function reportWorkspaceMinimumWidth({libraryOpen, outlineHidden, reportsHidden} = {}) {
  const openSidebars = Number(libraryOpen === 'true') + Number(outlineHidden === 'false') + Number(reportsHidden === 'false');
  return 1160 + openSidebars * 210;
}

export function createReportResizeDivider({shell, element, kind, label, defaultWidth,
  minimumWidth, maximumWidth, currentWidth, resizeDirection = 1, onResize, onCommit = () => {}, onReset}) {
  const divider = document.createElement('div');
  divider.className = `report-${kind}-divider`;
  divider.tabIndex = 0;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.setAttribute('aria-label', `Resize ${label}`);
  divider.title = 'Drag to resize · Arrow keys to adjust · Double-click to reset';

  const direction = typeof resizeDirection === 'function' ? resizeDirection : () => resizeDirection;
  const clampWidth = width => Math.max(minimumWidth(), Math.min(maximumWidth(), width));
  const updateControls = () => {
    const width = clampWidth(currentWidth());
    divider.setAttribute('aria-valuemin', String(minimumWidth()));
    const maximum = maximumWidth();
    if (Number.isFinite(maximum)) divider.setAttribute('aria-valuemax', String(maximum));
    else divider.removeAttribute('aria-valuemax');
    divider.setAttribute('aria-valuenow', String(Math.round(width)));
    divider.setAttribute('aria-valuetext', `${Math.round(width)} pixels wide`);
  };
  const resize = requested => {
    onResize(clampWidth(requested), drag);
    updateControls();
    if (!drag) onCommit();
  };
  divider.addEventListener('focus', updateControls);
  divider.addEventListener('dblclick', () => {
    if (!onReset) { resize(defaultWidth()); return; }
    onReset();
    updateControls();
    onCommit();
  });
  divider.addEventListener('keydown', event => {
    const step = event.shiftKey ? 80 : 24;
    const signedStep = direction() * step;
    const requests = {
      ArrowLeft: currentWidth() - signedStep,
      ArrowRight: currentWidth() + signedStep,
      Home: minimumWidth(),
      End: maximumWidth()
    };
    if (!Number.isFinite(requests[event.key])) return;
    event.preventDefault();
    resize(requests[event.key]);
  });
  let drag = null, frame = null, pointerX = null;
  const flushDrag = () => {
    frame = null;
    if (drag && pointerX !== null) resize(drag.width + drag.direction * (pointerX - drag.x));
    pointerX = null;
  };
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    divider.focus({preventScroll: true});
    drag = { pointerID: event.pointerId, x: event.clientX, width: element.getBoundingClientRect().width, direction: direction() };
    divider.setPointerCapture(event.pointerId);
    shell.classList.add(`is-${kind}-resizing`);
  });
  divider.addEventListener('pointermove', event => {
    if (drag?.pointerID !== event.pointerId) return;
    pointerX = event.clientX;
    if (frame === null) frame = requestAnimationFrame(flushDrag);
  });
  const finishDrag = event => {
    if (drag?.pointerID !== event.pointerId) return;
    if (frame !== null) cancelAnimationFrame(frame);
    if (event.type === 'pointerup' && Number.isFinite(event.clientX) && (pointerX !== null || event.clientX !== drag.x)) {
      pointerX = event.clientX;
    }
    flushDrag();
    drag = null;
    shell.classList.remove(`is-${kind}-resizing`);
    if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
    onCommit();
  };
  divider.addEventListener('pointerup', finishDrag);
  divider.addEventListener('pointercancel', finishDrag);
  divider.addEventListener('lostpointercapture', finishDrag);
  shell.classList.remove(`is-${kind}-resizing`);
  updateControls();
  return { divider, update: updateControls };
}

export function createReportOutlineControls(options) {
  return createReportSidebarControls({ ...options, element: options.outline, kind: 'outline',
    label: 'Outline', defaultWidth: 300, minimumWidth: 300 });
}

export function createReportVersionsControls(options) {
  return createReportSidebarControls({ ...options, element: options.versions, kind: 'versions',
    label: 'Versions', defaultWidth: 300, minimumWidth: 300, resizeDirection: -1 });
}
