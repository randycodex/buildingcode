import { openReportExportReview } from './report-export-review.js?v=20261012-report-export-v13';

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
  comparing = false, previewing = comparing, reportWidth = 0, pdfWidth = 0 } = {}) {
  const showPDF = comparing && previewing;
  const minimumSources = sources ? 300 : 0;
  sources = Math.max(minimumSources, sources);
  const minimumVersions = comparing ? Math.min(300, versions) : 0;
  const sidebarBudget = Math.max(minimumSources + minimumVersions,
    available - 600 - Number(sources > 0) - Number(comparing));
  const requestedVersions = comparing ? versions : 0;
  if (sources + requestedVersions > sidebarBudget) {
    const extra = sidebarBudget - minimumSources - minimumVersions;
    const requestedExtra = sources + requestedVersions - minimumSources - minimumVersions;
    sources = minimumSources + Math.floor(extra * (sources - minimumSources) / requestedExtra);
    versions = Math.min(requestedVersions, sidebarBudget - sources);
  }
  const sidebars = sources + outline + (comparing ? versions : 0);
  const dividers = Number(sources > 0) + Number(outline > 0) + Number(comparing) + Number(showPDF);
  const pairWidth = Math.max(1200, available - sidebars - dividers);
  const chosenReport = reportWidth ? Math.max(600, reportWidth) : 0;
  const chosenPDF = pdfWidth ? Math.max(600, pdfWidth) : 0;
  return {
    sourcesWidth: sources, versionsWidth: comparing ? versions : 0,
    template: [sources ? `${sources}px` : '0px', sources ? '1px' : '0px',
      'minmax(0, 1fr)', comparing ? '1px' : '0px', comparing ? `${versions}px` : '0px'].join(' '),
    documentTemplate: [outline ? `${outline}px` : '0px', outline ? '1px' : '0px',
      showPDF && chosenReport ? `${chosenReport}px` : 'minmax(600px, 1fr)',
      showPDF ? '1px' : '0px', showPDF ? chosenPDF ? `${chosenPDF}px` : 'minmax(600px, 1fr)' : '0px'].join(' '),
    minimumWidth: sidebars + dividers + (showPDF ? (chosenReport || 600) + (chosenPDF || 600) : 600),
    balancedDocumentWidth: pairWidth / 2
  };
}

export function preservePDFReadingPosition(container, change) {
  if (!container) { change(); return; }
  const top = container.getBoundingClientRect().top;
  const pages = [...container.querySelectorAll('.report-pdf-page')];
  const anchor = pages.find(page => page.getBoundingClientRect().bottom > top) || pages.at(-1);
  const before = anchor?.getBoundingClientRect();
  const fraction = before?.height ? (top - before.top) / before.height : 0;
  const scroll = container.scrollTop;
  change();
  const after = anchor?.getBoundingClientRect();
  container.scrollTop = after ? container.scrollTop + after.top - top + fraction * after.height : scroll;
}

export function resetReportColumnWidths(panel, onResize) {
  preservePDFReadingPosition(panel.querySelector('.report-export-content'), () => {
    for (const key of ['libraryWidth', 'outlineWidth', 'versionsWidth', 'reportComparisonWidth', 'pdfComparisonWidth']) {
      delete panel.dataset[key];
    }
    for (const kind of ['library', 'outline', 'versions']) panel.style.removeProperty(`--report-${kind}-width`);
    onResize();
  });
  panel._reportSidebarControls?.forEach(control => control.update());
  panel.querySelector('.report-document-columns').scrollLeft = 0;
}

// The PDF has its own mount. Selecting or hiding a saved version never replaces
// the editable draft, its fields, or its scroll position.
export function createReportComparison({ panel, columns, isCurrent, onResize,
  availableWidth = () => columns()?.clientWidth || 0,
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
    const selected = button.dataset.reportPreview === selectedID;
    button.setAttribute('aria-pressed', String(selected));
    button.title = selected ? 'Click again to close PDF preview' : 'Open PDF preview';
  });
  const closePreview = () => {
    generation++;
    review?.dispose();
    review = null; selectedID = null; closedPosition = null;
    preview.replaceChildren();
    onResize(); paintSelection();
  };
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
  const balancedWidth = () => reportComparisonLayout(availableWidth(), {
    sources: panel.dataset.libraryOpen === 'true' ? Number(panel.dataset.libraryWidth) || 330 : 0,
    outline: panel.dataset.outlineHidden === 'true' ? 0 : Number(panel.dataset.outlineWidth) || 300,
    versions: panel.dataset.versionsCollapsed === 'true' ? 48 : Number(panel.dataset.versionsWidth) || 300, comparing: true
  }).balancedDocumentWidth;
  const widths = () => ({
    report: columns()?.querySelector('.report-document')?.getBoundingClientRect().width || 600,
    pdf: preview.getBoundingClientRect().width || 600
  });
  const update = () => {
    const { report, pdf } = widths();
    divider.setAttribute('aria-valuemin', '0');
    divider.setAttribute('aria-valuemax', '100');
    divider.setAttribute('aria-valuenow', String(Math.round(100 * report / (report + pdf))));
    divider.setAttribute('aria-valuetext', `Report ${Math.round(report)} pixels; PDF preview ${Math.round(pdf)} pixels`);
    paintSelection();
  };
  const resize = (report, pdf) => {
    panel.dataset.reportComparisonWidth = String(Math.max(600, report));
    panel.dataset.pdfComparisonWidth = String(Math.max(600, pdf));
    preservePDFReadingPosition(preview.querySelector('.report-export-content'), onResize);
    update();
  };
  divider.addEventListener('dblclick', () => {
    delete panel.dataset.reportComparisonWidth;
    delete panel.dataset.pdfComparisonWidth;
    preservePDFReadingPosition(preview.querySelector('.report-export-content'), onResize);
    update();
  });
  divider.addEventListener('keydown', event => {
    const { report, pdf } = widths();
    const step = event.shiftKey ? 80 : 24;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step :
      event.key === 'Home' ? 600 - report : 0;
    if (event.key === 'End') resize(balancedWidth(), balancedWidth());
    else {
      const scroll = columns().scrollLeft;
      resize(report + delta, pdf - delta);
      columns().scrollLeft = scroll + Math.max(600, report + delta) - report - delta;
    }
  });
  let drag = null, versionsResize = null;
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); divider.focus({preventScroll: true});
    drag = {id: event.pointerId, x: event.clientX, ...widths(), scroll: columns().scrollLeft};
    divider.setPointerCapture(event.pointerId);
  });
  divider.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const delta = event.clientX - drag.x;
    resize(drag.report + delta, drag.pdf - delta);
    // Once the Report reaches its minimum, keep the boundary under the pointer
    // by scrolling the documents while the PDF continues growing to the left.
    columns().scrollLeft = drag.scroll + Math.max(600, drag.report + delta) - drag.report - delta;
  });
  const finish = () => { drag = null; };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(event, finish);
  return {
    preview, versions, versionBody, divider, update,
    resizeVersions(gesture) {
      const host = columns();
      if (!host) { onResize(); return; }
      if (!gesture || versionsResize?.gesture !== gesture) {
        const rect = versions.getBoundingClientRect();
        versionsResize = {gesture, width: rect.width, right: rect.right, ...widths()};
      }
      const origin = versionsResize;
      if (selectedID && panel.dataset.comparisonOpen === 'true') {
        const delta = (Number(panel.dataset.versionsWidth) || 300) - origin.width;
        panel.dataset.reportComparisonWidth = String(Math.max(600, origin.report));
        panel.dataset.pdfComparisonWidth = String(Math.max(600, origin.pdf - delta));
      }
      preservePDFReadingPosition(preview.querySelector('.report-export-content'), onResize);
      // Keep Versions' right edge fixed. Once the adjacent document reaches its
      // minimum, any overflow stays inside the document viewport.
      host.scrollLeft += versions.getBoundingClientRect().right - origin.right;
      update();
    },
    capturePosition() { return closedPosition || readPosition(); },
    restorePosition(position) {
      if (!position) return;
      if (panel.dataset.comparisonOpen !== 'true') closedPosition = position;
      restorePosition(position);
      const selectedReview = review, request = generation;
      void Promise.resolve(selectedReview?.ready).then(() => {
        if (current() && review === selectedReview && generation === request && panel.dataset.comparisonOpen === 'true') {
          restorePosition(position);
        }
      });
    },
    get selectedID() { return selectedID; },
    removeVersion(manifestID) {
      if (!current() || selectedID !== manifestID) return false;
      closePreview();
      return true;
    },
    toggle: () => setOpen(panel.dataset.comparisonOpen !== 'true'),
    select(report, prepare, {toggle = false} = {}) {
      if (!current()) return;
      if (selectedID === report.id && review) {
        // The Versions toolbar restores a retained comparison; the selected
        // version title itself toggles the PDF column off while the list stays.
        if (toggle && panel.dataset.comparisonOpen === 'true') closePreview();
        else setOpen(true);
        return;
      }
      const position = closedPosition || readPosition();
      const hadPreview = selectedID !== null;
      generation++;
      const request = generation;
      review?.dispose();
      selectedID = report.id;
      closedPosition = panel.dataset.comparisonOpen !== 'true' ? {...position, pdf: 0} : null;
      setOpen(true);
      if (!hadPreview && columns()) columns().scrollLeft = Math.max(0, columns().scrollWidth - columns().clientWidth);
      paintSelection();
      review = renderReview({ mount: preview, prepare,
        isCurrent: () => current() && request === generation,
        showClose: false,
        onClose: () => {
          if (request !== generation || !current()) return;
          closePreview();
        }
      });
    },
    dispose() { disposed = true; generation++; review?.dispose(); }
  };
}
