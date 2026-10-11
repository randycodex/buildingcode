const defaultWidth = 330;
const expandedWidth = 640;
const minimumWidth = 280;

export function createReportLibraryControls({ panel, shell, library }) {
  const header = document.createElement('header');
  header.className = 'report-library-header';
  const title = document.createElement('h2');
  title.textContent = 'Sources & versions';
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'report-library-expand';
  header.append(title, expand);

  const divider = document.createElement('div');
  divider.className = 'report-library-divider';
  divider.tabIndex = 0;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.setAttribute('aria-label', 'Resize Sources & versions');
  divider.title = 'Drag to resize · Arrow keys to adjust · Double-click to reset';

  const maximumWidth = () => {
    const available = shell.clientWidth;
    if (!available) return 720;
    return Math.max(minimumWidth, Math.min(720, available - (available > 1100 ? 850 : 420)));
  };
  const currentWidth = () => Number(panel.dataset.libraryWidth) || defaultWidth;
  const updateControls = () => {
    const width = Math.min(currentWidth(), maximumWidth());
    const expanded = width > defaultWidth;
    expand.textContent = expanded ? 'Compact' : 'Expand';
    expand.setAttribute('aria-label', `${expanded ? 'Compact' : 'Expand'} Sources & versions`);
    expand.setAttribute('aria-pressed', String(expanded));
    divider.setAttribute('aria-valuemin', String(minimumWidth));
    divider.setAttribute('aria-valuemax', String(maximumWidth()));
    divider.setAttribute('aria-valuenow', String(Math.round(width)));
    divider.setAttribute('aria-valuetext', `${Math.round(width)} pixels wide`);
  };
  const resize = requested => {
    const width = Math.max(minimumWidth, Math.min(maximumWidth(), requested));
    panel.dataset.libraryWidth = String(width);
    panel.style.setProperty('--report-library-width', `${width}px`);
    updateControls();
  };
  expand.addEventListener('click', () => resize(currentWidth() > defaultWidth ? defaultWidth : expandedWidth));
  divider.addEventListener('focus', updateControls);
  divider.addEventListener('dblclick', () => resize(defaultWidth));
  divider.addEventListener('keydown', event => {
    const step = event.shiftKey ? 80 : 24;
    const requests = {
      ArrowLeft: currentWidth() - step,
      ArrowRight: currentWidth() + step,
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
    drag = { pointerID: event.pointerId, x: event.clientX, width: library.getBoundingClientRect().width };
    divider.setPointerCapture(event.pointerId);
    shell.classList.add('is-library-resizing');
  });
  divider.addEventListener('pointermove', event => {
    if (drag?.pointerID === event.pointerId) resize(drag.width + event.clientX - drag.x);
  });
  const finishDrag = event => {
    if (drag?.pointerID !== event.pointerId) return;
    drag = null;
    shell.classList.remove('is-library-resizing');
    if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
  };
  divider.addEventListener('pointerup', finishDrag);
  divider.addEventListener('pointercancel', finishDrag);
  divider.addEventListener('lostpointercapture', finishDrag);
  shell.classList.remove('is-library-resizing');
  updateControls();
  return { header, divider };
}
