import { openReportExportReview } from './report-export-review.js?v=20261011-report-export-v8';

export function preserveReportReadingPosition(container, change) {
  const top = container.getBoundingClientRect().top + 33;
  const items = [...container.querySelectorAll('.report-draft-metadata, .report-draft-block')].filter(item => item.offsetHeight);
  const anchor = items.filter(item => item.getBoundingClientRect().top <= top).at(-1) || items[0];
  const before = anchor?.getBoundingClientRect().top;
  const scroll = container.scrollTop;
  change();
  container.scrollTop = anchor ? container.scrollTop + anchor.getBoundingClientRect().top - before : scroll;
}

export function reportComparisonLayout(available, { sources = 0, outline = 0, versions = 300,
  comparing = false, reportWidth = 0 } = {}) {
  const sidebars = sources + outline + (comparing ? versions : 0);
  const dividers = Number(sources > 0) + Number(outline > 0) + (comparing ? 2 : 0);
  const pairWidth = Math.max(1200, available - sidebars - dividers);
  const maximumReportWidth = pairWidth - 600;
  const chosen = reportWidth ? Math.max(600, Math.min(maximumReportWidth, reportWidth)) : 0;
  return {
    template: [sources ? `${sources}px` : '0px', sources ? '1px' : '0px',
      outline ? `${outline}px` : '0px', outline ? '1px' : '0px',
      comparing && chosen ? `${chosen}px` : 'minmax(600px, 1fr)',
      comparing ? '1px' : '0px', comparing ? 'minmax(600px, 1fr)' : '0px',
      comparing ? '1px' : '0px', comparing ? `${versions}px` : '0px'].join(' '),
    minimumWidth: sidebars + dividers + (comparing ? 1200 : 600), maximumReportWidth
  };
}

// The PDF has its own mount. Selecting or hiding a saved version never replaces
// the editable draft, its fields, or its scroll position.
export function createReportComparison({ panel, columns, isCurrent, onResize,
  renderReview = openReportExportReview }) {
  const preview = document.createElement('section');
  preview.className = 'report-pdf-preview-panel';
  preview.setAttribute('aria-label', 'Report PDF preview');
  const versions = document.createElement('aside');
  versions.className = 'report-versions-panel';
  versions.setAttribute('aria-label', 'Report versions');
  const versionBody = document.createElement('div');
  versionBody.className = 'report-history';
  versions.append(versionBody);
  let selectedID = null, review = null, generation = 0, disposed = false;
  let closedColumnsScroll = 0, openColumnsScroll = null;
  let closedPosition = null;
  const readPosition = () => ({versions: versionBody.scrollTop,
    pdf: preview.querySelector('.report-export-content')?.scrollTop || 0});
  const restorePosition = position => {
    if (!position) return;
    versionBody.scrollTop = position.versions;
    const content = preview.querySelector('.report-export-content');
    if (content) content.scrollTop = position.pdf;
  };
  const current = () => !disposed && isCurrent();
  const paintSelection = () => versions.querySelectorAll('[data-report-preview]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.reportPreview === selectedID));
  });
  const emptyPreview = () => {
    const header = document.createElement('header');
    header.className = 'report-comparison-header';
    const title = document.createElement('h2');
    title.textContent = 'PDF preview';
    header.append(title);
    const help = document.createElement('p');
    help.className = 'report-workflow-help';
    help.textContent = 'Choose a saved version on the right to compare its PDF with the current Report.';
    preview.replaceChildren(header, help);
  };
  emptyPreview();
  const setOpen = open => {
    const host = columns();
    const wasOpen = panel.dataset.comparisonOpen === 'true';
    if (open !== wasOpen && host) {
      if (open) closedColumnsScroll = host.scrollLeft;
      else openColumnsScroll = host.scrollLeft;
    }
    // Hidden PDF pages lose their layout height, which can clamp scrollTop.
    // Keep the visible position and restore it after the columns have reopened.
    if (!open && wasOpen) closedPosition = readPosition();
    panel.dataset.comparisonOpen = String(open);
    onResize();
    if (open && !wasOpen) {
      restorePosition(closedPosition);
      closedPosition = null;
    }
    if (open !== wasOpen && host) host.scrollLeft = open
      ? openColumnsScroll ?? Math.max(0, host.scrollWidth - host.clientWidth)
      : closedColumnsScroll;
  };
  const divider = document.createElement('div');
  divider.className = 'report-comparison-divider';
  divider.tabIndex = 0;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-label', 'Resize Report and PDF Preview');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.title = 'Drag to resize · Arrow keys to adjust · Double-click to balance';
  const maximumWidth = () => reportComparisonLayout(columns()?.clientWidth || 0, {
    sources: panel.dataset.libraryOpen === 'true' ? Number(panel.dataset.libraryWidth) || 330 : 0,
    outline: panel.dataset.outlineHidden === 'true' ? 0 : Number(panel.dataset.outlineWidth) || 300,
    versions: panel.dataset.versionsCollapsed === 'true' ? 48 : Number(panel.dataset.versionsWidth) || 300, comparing: true
  }).maximumReportWidth;
  const update = () => {
    const width = columns()?.querySelector('.report-document')?.getBoundingClientRect().width || 600;
    divider.setAttribute('aria-valuemin', '600');
    divider.setAttribute('aria-valuemax', String(maximumWidth()));
    divider.setAttribute('aria-valuenow', String(Math.round(width)));
    divider.setAttribute('aria-valuetext', `${Math.round(width)} pixels for the Report`);
    paintSelection();
  };
  const resize = value => {
    panel.dataset.reportComparisonWidth = String(Math.max(600, Math.min(maximumWidth(), value)));
    onResize(); update();
  };
  divider.addEventListener('dblclick', () => { delete panel.dataset.reportComparisonWidth; onResize(); update(); });
  divider.addEventListener('keydown', event => {
    const width = columns().querySelector('.report-document').getBoundingClientRect().width;
    const step = event.shiftKey ? 80 : 24;
    const sizes = {ArrowLeft: width - step, ArrowRight: width + step, Home: 600, End: maximumWidth()};
    if (!(event.key in sizes)) return;
    event.preventDefault(); resize(sizes[event.key]);
  });
  let drag = null;
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); divider.focus({preventScroll: true});
    drag = {id: event.pointerId, x: event.clientX, width: columns().querySelector('.report-document').getBoundingClientRect().width};
    divider.setPointerCapture(event.pointerId);
  });
  divider.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) resize(drag.width + event.clientX - drag.x);
  });
  const finish = () => { drag = null; };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(event, finish);
  return {
    preview, versions, versionBody, divider, update,
    capturePosition() { return closedPosition || readPosition(); },
    restorePosition(position) {
      if (!position) return;
      if (panel.dataset.comparisonOpen !== 'true') closedPosition = position;
      restorePosition(position);
    },
    get selectedID() { return selectedID; },
    toggle: () => setOpen(panel.dataset.comparisonOpen !== 'true'),
    select(report, prepare) {
      if (!current()) return;
      setOpen(true);
      if (selectedID === report.id && review) return;
      generation++;
      const request = generation;
      review?.dispose();
      selectedID = report.id;
      paintSelection();
      review = renderReview({ mount: preview, prepare,
        isCurrent: () => current() && request === generation,
        closeLabel: 'Close PDF preview',
        onClose: () => {
          if (request !== generation || !current()) return;
          review = null; selectedID = null;
          emptyPreview(); paintSelection();
        }
      });
    },
    dispose() { disposed = true; generation++; review?.dispose(); }
  };
}
