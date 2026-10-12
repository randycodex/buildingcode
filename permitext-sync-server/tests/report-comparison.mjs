import assert from 'node:assert/strict';
import {reportComparisonLayout, createReportComparison, preserveReportReadingPosition} from '../public/report-comparison.js';

const full = reportComparisonLayout(1920, {sources: 330, outline: 300, comparing: true, reportWidth: 900});
assert.equal(full.minimumWidth, 2134, 'Scroll the complete column row rather than squeezing either document below 600px');
assert.equal(full.maximumReportWidth, 600);
assert.equal(full.template, '330px 1px 300px 1px 600px 1px minmax(600px, 1fr) 1px 300px');
const focused = reportComparisonLayout(1920, {comparing: true, reportWidth: 4000});
assert.equal(focused.maximumReportWidth, 1018);
assert.ok(focused.template.includes('1018px 1px minmax(600px, 1fr)'));
assert.equal(reportComparisonLayout(1920, {comparing: false}).minimumWidth, 600);
assert.equal(reportComparisonLayout(1920, {comparing: true, versions: 48}).minimumWidth, 1250);
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

class Element {
  constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; this.scrollTop = 0; this.clientWidth = 1920; }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  querySelectorAll() { return this.buttons || []; }
  querySelector(selector) { return selector === '.report-export-content' ? this.content : selector === '.report-document' ? this.document : null; }
  getBoundingClientRect() { return {width: 809}; }
  focus() {}
  setPointerCapture() {}
}
globalThis.document = {createElement: () => new Element()};
const panel = new Element(), host = new Element();
host.scrollLeft = 0; host.scrollWidth = 2134;
host.document = Object.assign(new Element(), {value: 'Unsubmitted draft text', scrollTop: 731});
let current = true, resized = 0;
const reviews = [];
const comparison = createReportComparison({panel, columns: () => host, isCurrent: () => current,
  onResize: () => {
    resized++;
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
assert.equal(host.scrollLeft, 214, 'First opening reveals the right-hand Versions column without squeezing documents');
assert.equal(first.attributes['aria-pressed'], 'true');
assert.equal(reviews[0].args.mount, comparison.preview, 'The PDF owns a separate mount, never the draft');
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
comparison.select({id: 'first'}, prepare);
assert.equal(reviews.length, 1, 'Reopening the same version keeps its loaded PDF and page position');
assert.equal(comparison.preview.content.scrollTop, 942);
comparison.restorePosition(position);
assert.equal(comparison.versionBody.scrollTop, 127);
comparison.select({id: 'second'}, prepare);
assert.equal(reviews[0].disposed, true);
assert.equal(reviews[0].args.isCurrent(), false, 'A slow previous selection cannot paint over the new PDF');
assert.equal(second.attributes['aria-pressed'], 'true');
assert.equal(first.attributes['aria-pressed'], 'false');
reviews[1].args.onClose();
assert.equal(comparison.selectedID, null);
assert.equal(host.document.value, 'Unsubmitted draft text');
assert.equal(host.document.scrollTop, 731, 'Choosing, closing or hiding the PDF never changes draft scroll or text');
panel.dataset.outlineHidden = 'true';
comparison.divider.events.keydown({key: 'Home', preventDefault() {}});
assert.equal(panel.dataset.reportComparisonWidth, '600');
comparison.divider.events.pointerdown({button: 0, pointerId: 1, clientX: 800, preventDefault() {}});
comparison.divider.events.pointermove({pointerId: 1, clientX: 1000});
assert.equal(panel.dataset.reportComparisonWidth, '1009', 'Dragging right widens the Report and moves the divider during the drag');
comparison.divider.events.pointercancel();
comparison.divider.events.pointermove({pointerId: 1, clientX: 1100});
assert.equal(panel.dataset.reportComparisonWidth, '1009');
comparison.divider.events.dblclick();
assert.equal(panel.dataset.reportComparisonWidth, undefined);
current = false;
comparison.select({id: 'third'}, prepare);
assert.equal(reviews.length, 2, 'Changed account context cannot open a private PDF');
comparison.dispose();
assert.ok(resized > 0);
console.log('Report comparison passed: five-column order, document minimums, separate PDF mount, retained draft/page state, stale-selection fences, resizing and cleanup.');
