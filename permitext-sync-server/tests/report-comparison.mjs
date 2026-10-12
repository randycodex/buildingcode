import assert from 'node:assert/strict';
import {reportComparisonLayout, createReportComparison, preserveReportReadingPosition, preservePDFReadingPosition, resetReportColumnWidths} from '../public/report-comparison.js';

const full = reportComparisonLayout(1920, {sources: 330, outline: 300, comparing: true, reportWidth: 900});
assert.equal(full.minimumWidth, 2434, 'Retain document minimums while their viewport owns overflow');
assert.equal(full.balancedDocumentWidth, 600);
assert.equal(full.template, '330px 1px minmax(0, 1fr) 1px 300px', 'Sources and Versions stay outside the scrolling document tracks');
assert.equal(full.documentTemplate, '300px 1px 900px 1px minmax(600px, 1fr)');
const focused = reportComparisonLayout(1920, {comparing: true, reportWidth: 4000});
assert.equal(focused.balancedDocumentWidth, 809);
assert.ok(focused.documentTemplate.includes('4000px 1px minmax(600px, 1fr)'));
const expandedPDF = reportComparisonLayout(1606, {outline: 300, comparing: true, reportWidth: 600, pdfWidth: 4000});
assert.ok(expandedPDF.documentTemplate.includes('600px 1px 4000px'));
assert.equal(expandedPDF.minimumWidth, 5203, 'PDF expansion has no viewport or page-width ceiling');
assert.ok(reportComparisonLayout(1606, {comparing: true, reportWidth: 10, pdfWidth: 20}).documentTemplate.includes('600px 1px 600px'));
assert.equal(reportComparisonLayout(1920, {comparing: false}).minimumWidth, 600);
assert.equal(reportComparisonLayout(1920, {comparing: true, versions: 48}).minimumWidth, 1250);
const versionsOnly = reportComparisonLayout(1920, {sources: 330, outline: 300, comparing: true,
  previewing: false, reportWidth: 600, pdfWidth: 4000});
assert.equal(versionsOnly.minimumWidth, 1533, 'Closing a PDF removes its entire column and divider, while Versions remains available');
assert.equal(versionsOnly.template, '330px 1px minmax(0, 1fr) 1px 300px');
assert.equal(versionsOnly.documentTemplate, '300px 1px minmax(600px, 1fr) 0px 0px');
assert.equal(reportComparisonLayout(1920, {comparing: false, previewing: true}).minimumWidth, 600,
  'The Versions toolbar still hides both PDF and Versions even with a retained selection');
const wideSidebars = reportComparisonLayout(1920, {sources: 720, versions: 720, comparing: true});
assert.equal(wideSidebars.sourcesWidth + wideSidebars.versionsWidth + 2, 1320,
  'Expanded sidebars fit the screen and leave a 600px central viewport');
const narrowSidebars = reportComparisonLayout(900, {sources: 720, versions: 720, comparing: true});
assert.equal(narrowSidebars.sourcesWidth, 280);
assert.equal(narrowSidebars.versionsWidth, 300);
assert.ok(narrowSidebars.sourcesWidth + narrowSidebars.versionsWidth + 2 < 900,
  'On smaller desktop viewports, sidebar minimums leave room for horizontally scrolling documents');
let changedWidth = false;
const positionContainer = {scrollTop: 731, getBoundingClientRect: () => ({top: 84}),
  querySelectorAll: () => [
    {offsetHeight: 40, getBoundingClientRect: () => ({top: -180})},
    {offsetHeight: 40, getBoundingClientRect: () => ({top: changedWidth ? 260 : 116})},
    {offsetHeight: 40, getBoundingClientRect: () => ({top: 880})},
    {offsetHeight: 0, getBoundingClientRect: () => ({top: 0})}
  ]};
preserveReportReadingPosition(positionContainer, () => { changedWidth = true; });
assert.equal(positionContainer.scrollTop, 875, 'Column changes preserve the current report item and its offset as earlier text reflows');
let pdfExpanded = false;
const pdfPosition = {scrollTop: 1300, getBoundingClientRect: () => ({top: 100}), querySelectorAll: () => [
  {getBoundingClientRect: () => ({top: pdfExpanded ? 20 : 60, bottom: 1100, height: pdfExpanded ? 1800 : 900})}
]};
preservePDFReadingPosition(pdfPosition, () => {pdfExpanded = true;});
assert.equal(pdfPosition.scrollTop, 1300, 'Keep the same point on the PDF page when its width and height scale');

const resetColumns = {scrollLeft: 1700}, removedStyles = [], controlsUpdated = [];
const resetPanel = {dataset: {libraryWidth: '640', outlineWidth: '640', versionsWidth: '640',
  reportComparisonWidth: '600', pdfComparisonWidth: '2400', libraryOpen: 'true', outlineHidden: 'false',
  comparisonOpen: 'true', versionsCollapsed: 'true'},
  style: {removeProperty: name => removedStyles.push(name)},
  querySelector: selector => selector === '.report-document-columns' ? resetColumns : pdfPosition,
  _reportSidebarControls: [ {update: () => controlsUpdated.push('sidebar')}, {update: () => controlsUpdated.push('comparison')} ]};
let layoutResets = 0;
resetReportColumnWidths(resetPanel, () => { layoutResets++; });
assert.deepEqual(resetPanel.dataset, {libraryOpen: 'true', outlineHidden: 'false', comparisonOpen: 'true', versionsCollapsed: 'true'},
  'Reset all widths without closing the Sources, Outline, selected PDF or collapsed Versions rail');
assert.equal(resetColumns.scrollLeft, 0);
assert.equal(layoutResets, 1, 'Reset the complete layout together without rebuilding the editor or PDF');
assert.deepEqual(removedStyles, ['--report-library-width', '--report-outline-width', '--report-versions-width']);
assert.deepEqual(controlsUpdated, ['sidebar', 'comparison']);

class Element {
  constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; this.scrollTop = 0; this.clientWidth = 1920; }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; delete this.content; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  querySelectorAll() { return this.buttons || []; }
  querySelector(selector) { return selector === '.report-export-content' ? this.content : selector === '.report-document' ? this.document : null; }
  getBoundingClientRect() { return {width: this.width || 809, top: 100}; }
  focus() {}
  setPointerCapture() {}
}
globalThis.document = {createElement: () => new Element()};
const panel = new Element(), host = new Element();
host.scrollLeft = 0; host.scrollWidth = 2134;
host.document = Object.assign(new Element(), {value: 'Unsubmitted draft text', scrollTop: 731});
let current = true, resized = 0, sidebarsAnchored = false;
const reviews = [];
const comparison = createReportComparison({panel, columns: () => host, isCurrent: () => current,
  availableWidth: () => 1920,
  onResize: () => {
    resized++;
    if (panel.dataset.reportComparisonWidth) host.document.width = Number(panel.dataset.reportComparisonWidth);
    if (panel.dataset.pdfComparisonWidth) comparison.preview.width = Number(panel.dataset.pdfComparisonWidth);
    if (panel.dataset.versionsWidth) comparison.versions.width = Number(panel.dataset.versionsWidth);
    if (sidebarsAnchored) {
      host.clientWidth = 1920 - comparison.versions.width - 1;
      host.scrollWidth = host.document.width + comparison.preview.width + 1;
    }
    if (panel.dataset.comparisonOpen !== 'true' && comparison.preview.content) {
      comparison.preview.content.scrollTop = 0;
      comparison.versionBody.scrollTop = 0;
    }
  }, renderReview: args => {
    const review = {args, disposed: false, dispose() { this.disposed = true; }};
    reviews.push(review); return review;
  }});
const first = Object.assign(new Element(), {dataset: {reportPreview: 'first'}});
const second = Object.assign(new Element(), {dataset: {reportPreview: 'second'}});
comparison.versions.buttons = [first, second];
const prepare = async () => ({pdfBlob: 'Frozen version bytes'});
comparison.select({id: 'first'}, prepare);
assert.equal(panel.dataset.comparisonOpen, 'true');
assert.equal(host.scrollLeft, 214, 'First opening reveals the PDF in the document viewport');
assert.equal(first.attributes['aria-pressed'], 'true');
assert.equal(reviews[0].args.mount, comparison.preview, 'The PDF owns a separate mount, never the draft');
assert.equal(reviews[0].args.showClose, false, 'The Report comparison omits the dedicated Close PDF preview button');
comparison.preview.content = Object.assign(new Element(), {scrollTop: 942});
comparison.versionBody.scrollTop = 127;
const position = comparison.capturePosition();
host.scrollLeft = 180;
comparison.toggle();
assert.equal(host.scrollLeft, 0, 'Closing comparison restores the previous Sources/Outline position');
assert.deepEqual(comparison.capturePosition(), position, 'Hidden-page layout clamping must not overwrite the retained PDF position');
comparison.toggle();
assert.equal(host.scrollLeft, 180, 'Reopening comparison keeps its horizontal position');
assert.equal(comparison.preview.content.scrollTop, 942, 'Reopening restores the PDF position after hidden pages clamp their scroll');
assert.equal(comparison.versionBody.scrollTop, 127, 'Reopening restores the version-list position too');
assert.equal(reviews.length, 1, 'Reopening the same version keeps its loaded PDF and page position');
assert.equal(comparison.preview.content.scrollTop, 942);
comparison.restorePosition(position);
assert.equal(comparison.versionBody.scrollTop, 127);
comparison.select({id: 'first'}, prepare);
assert.equal(comparison.selectedID, 'first', 'Programmatic selection keeps an existing export preview open');
assert.equal(reviews.length, 1);
assert.equal(comparison.preview.content.scrollTop, 942);
comparison.select({id: 'first'}, prepare, {toggle: true});
assert.equal(comparison.selectedID, null, 'Clicking the selected title a second time closes the PDF');
assert.equal(panel.dataset.comparisonOpen, 'true', 'Keep the Versions list open when its selected PDF closes');
assert.equal(reviews[0].disposed, true);
assert.equal(reviews[0].args.isCurrent(), false, 'Closing also invalidates a pending PDF response');
assert.equal(first.attributes['aria-pressed'], 'false');
assert.equal(comparison.preview.children.length, 0, 'No empty PDF placeholder remains');
assert.equal(comparison.versionBody.scrollTop, 127);
comparison.select({id: 'first'}, prepare);
assert.equal(reviews.length, 2, 'Clicking the closed title opens its PDF again');
assert.equal(first.attributes['aria-pressed'], 'true');
assert.equal(host.scrollLeft, 214, 'Opening a PDF reveals its document while the version title stays in its separate sidebar');
comparison.select({id: 'second'}, prepare);
assert.equal(reviews[1].disposed, true);
assert.equal(reviews[1].args.isCurrent(), false, 'A slow previous selection cannot paint over the new PDF');
assert.equal(second.attributes['aria-pressed'], 'true');
assert.equal(first.attributes['aria-pressed'], 'false');
reviews[2].args.onClose();
assert.equal(comparison.selectedID, null);
assert.equal(panel.dataset.comparisonOpen, 'true', 'Escape closes only the preview, leaving Versions usable');
assert.equal(host.document.value, 'Unsubmitted draft text');
assert.equal(host.document.scrollTop, 731, 'Choosing, closing or hiding the PDF never changes draft scroll or text');
comparison.select({id: 'second'}, prepare);
panel.dataset.outlineHidden = 'true';
comparison.divider.events.keydown({key: 'Home', preventDefault() {}});
assert.equal(panel.dataset.reportComparisonWidth, '600');
assert.equal(panel.dataset.pdfComparisonWidth, '1018');
comparison.divider.events.pointerdown({button: 0, pointerId: 1, clientX: 800, preventDefault() {}});
comparison.divider.events.pointermove({pointerId: 1, clientX: 1000});
assert.equal(panel.dataset.reportComparisonWidth, '800', 'Dragging right widens the Report and moves the divider during the drag');
assert.equal(panel.dataset.pdfComparisonWidth, '818');
comparison.divider.events.pointercancel();
comparison.divider.events.pointermove({pointerId: 1, clientX: 1100});
assert.equal(panel.dataset.reportComparisonWidth, '800');
host.scrollLeft = 180;
comparison.divider.events.pointerdown({button: 0, pointerId: 2, clientX: 800, preventDefault() {}});
comparison.divider.events.pointermove({pointerId: 2, clientX: -2400});
assert.equal(panel.dataset.reportComparisonWidth, '600');
assert.equal(panel.dataset.pdfComparisonWidth, '4018', 'Dragging left keeps expanding the PDF after the Report reaches 600px');
assert.equal(host.scrollLeft, 3180, 'The whole row scrolls so the boundary follows the pointer instead of sticking at the Report minimum');
comparison.divider.events.pointerup();
comparison.divider.events.keydown({key: 'ArrowLeft', shiftKey: true, preventDefault() {}});
assert.equal(panel.dataset.pdfComparisonWidth, '4098', 'Keyboard expansion has no maximum either');
assert.equal(host.scrollLeft, 3260);
assert.equal(comparison.divider.attributes['aria-valuetext'], 'Report 600 pixels; PDF preview 4098 pixels');
assert.equal(comparison.divider.attributes['aria-valuenow'], '13', 'Expose a valid proportional separator range while announcing the actual document widths');
assert.equal(comparison.divider.attributes['aria-valuemax'], '100');
comparison.divider.events.keydown({key: 'End', preventDefault() {}});
assert.equal(panel.dataset.reportComparisonWidth, '809');
assert.equal(panel.dataset.pdfComparisonWidth, '809', 'End restores balanced documents');
comparison.divider.events.dblclick();
assert.equal(panel.dataset.reportComparisonWidth, undefined);
assert.equal(panel.dataset.pdfComparisonWidth, undefined);

host.document.width = comparison.preview.width = 809;
comparison.preview.content = Object.assign(new Element(), {scrollTop: 942});
comparison.versions.width = 300;
sidebarsAnchored = true;
host.clientWidth = host.scrollWidth = 1619;
host.scrollLeft = 0;
comparison.versions.getBoundingClientRect = () => ({width: comparison.versions.width, right: 1920});
const versionsRight = comparison.versions.getBoundingClientRect().right;
const versionsGesture = {};
panel.dataset.versionsWidth = '420';
comparison.resizeVersions(versionsGesture);
assert.equal(panel.dataset.reportComparisonWidth, '809', 'Resizing Versions leaves the Report width in place');
assert.equal(panel.dataset.pdfComparisonWidth, '689', 'Versions grows into the adjacent PDF instead of beyond the right edge');
assert.equal(comparison.versions.getBoundingClientRect().right, versionsRight);
assert.equal(host.scrollLeft, 0, 'No workspace scrolling is needed while the PDF has space to yield');
assert.equal(comparison.preview.content.scrollTop, 942, 'Versions resizing keeps the current PDF reading position');
panel.dataset.versionsWidth = '720';
comparison.resizeVersions(versionsGesture);
assert.equal(panel.dataset.pdfComparisonWidth, '600', 'The PDF keeps its readable minimum');
assert.equal(host.scrollWidth - host.clientWidth, 211, 'At the minimum, excess document width stays in the central viewport');
assert.equal(host.scrollLeft, 0, 'Resizing a sidebar no longer scrolls Sources or Versions');
assert.equal(comparison.versions.getBoundingClientRect().right, versionsRight);
panel.dataset.versionsWidth = '300';
comparison.resizeVersions(versionsGesture);
assert.equal(panel.dataset.pdfComparisonWidth, '809', 'Reversing the same drag restores the starting PDF width even after reaching its minimum');
assert.equal(host.scrollLeft, 0);
assert.equal(comparison.versions.getBoundingClientRect().right, versionsRight);
panel.dataset.versionsWidth = '324';
comparison.resizeVersions();
assert.equal(panel.dataset.pdfComparisonWidth, '785', 'A keyboard adjustment starts from the current document widths');
assert.equal(comparison.versions.getBoundingClientRect().right, versionsRight);
comparison.divider.events.keydown({key: 'End', preventDefault() {}});
assert.equal(panel.dataset.reportComparisonWidth, '797', 'Balancing uses the full workspace width, without subtracting anchored sidebars twice');
assert.equal(panel.dataset.pdfComparisonWidth, '797');
current = false;
comparison.select({id: 'third'}, prepare);
assert.equal(reviews.length, 4, 'Changed account context cannot open a private PDF');
comparison.dispose();
assert.ok(resized > 0);
console.log('Report comparison passed: five-column order, document minimums, separate PDF mount, retained draft/page state, stale-selection fences, resizing and cleanup.');
