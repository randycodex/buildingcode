import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise asynchronous PDF rendering while the user resizes or leaves the preview.
let width = 600, intersection, resize, timer, current = true, destroyed = 0;
const tasks = [], pages = [];
class Element {
  constructor() { this.children = []; this.dataset = {}; this.style = {}; this.attributes = {}; }
  get clientWidth() { return width; }
  append(child) { child.parent = this; this.children.push(child); }
  replaceChildren() { this.children = []; }
  replaceWith(child) { const parent = this.parent; parent.children[parent.children.indexOf(this)] = child; child.parent = parent; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getContext() { return {}; }
}
const pdf = {numPages: 2, async getPage() { return {
  getViewport: ({scale}) => ({width: 612 * scale, height: 792 * scale}),
  render({viewport}) {
    let resolve;
    const task = {viewport, promise: new Promise(done => {resolve = done;}),
      finish: () => resolve(), cancel() { this.cancelled = true; resolve(); }};
    tasks.push(task); return task;
  },
  getTextContent: async () => ({items: [{str: 'Original PDF page text'}]})
}; }, async destroy() {destroyed++;} };
const context = vm.createContext({
  document: {createElement: () => new Element()}, window: {devicePixelRatio: 2}, Uint8Array,
  loadPDF: async () => ({GlobalWorkerOptions: {}, getDocument: () => ({promise: Promise.resolve(pdf)})}),
  IntersectionObserver: class {
    constructor(callback) {intersection = this; this.callback = callback;}
    observe(page) {pages.push(page);}
    disconnect() {this.disconnected = true;}
  },
  ResizeObserver: class {
    constructor(callback) {resize = this; this.callback = callback;}
    observe() {}
    disconnect() {this.disconnected = true;}
  },
  setTimeout: callback => {timer = callback; return 1;}, clearTimeout: () => {timer = null;}
});
const source = (await readFile(new URL('../public/report-pdf-preview.js', import.meta.url), 'utf8'))
  .replace('export async function renderReportPDF', 'async function renderReportPDF')
  .replace("await import('/web/pdf-preview-assets/pdf.min.js')", 'await loadPDF()');
vm.runInContext(`${source}\nglobalThis.preview = renderReportPDF;`, context);
const flush = async () => {for (let i = 0; i < 12; i++) await Promise.resolve();};
const container = new Element();
const dispose = await context.preview(container, {arrayBuffer: async () => new ArrayBuffer(1)}, () => current);
assert.equal(pages.length, 2);
intersection.callback([{target: pages[0], isIntersecting: true}]);
assert.equal(tasks[0].viewport.width, 1200, 'Initial raster matches the displayed page width and device density');
tasks[0].finish(); await flush();
const firstCanvas = pages[0].children[0];
const text = pages[0].children[1];
assert.equal(text.textContent, 'Original PDF page text');
width = 1400; resize.callback(); timer();
assert.equal(tasks[1].viewport.width, 2800, 'A wider column requests a sharper raster');
assert.equal(pages[0].children[0], firstCanvas, 'Keep the current image visible during replacement rendering');
assert.equal(tasks.length, 2, 'Offscreen pages stay lazy');
width = 2000; resize.callback(); timer();
assert.equal(tasks.length, 2, 'Coalesce width changes while rendering a page');
tasks[1].finish(); await flush();
assert.ok(tasks[2].viewport.width > tasks[1].viewport.width, 'Refresh to the latest width after the pending render completes');
assert.ok(tasks[2].viewport.width * tasks[2].viewport.height <= 16000001, 'Large columns cannot create unbounded raster allocations');
tasks[2].finish(); await flush();
assert.equal(container.children[0], pages[0], 'Resizing keeps the page and scroll container mounted');
assert.equal(pages[0].children[1], text, 'Accessible PDF text is retained, not duplicated');
width = 600; resize.callback(); timer();
assert.equal(tasks.length, 3, 'A sharp existing raster remains useful when compacting');
intersection.callback([{target: pages[1], isIntersecting: true}]);
assert.equal(tasks.length, 4);
current = false; tasks[3].finish(); await flush();
assert.equal(pages[1].children.length, 0, 'A stale account/version cannot replace preview content');
dispose();
dispose();
assert.equal(intersection.disconnected, true);
assert.equal(resize.disconnected, true);
assert.equal(timer, null);
assert.equal(destroyed, 1);
console.log('PDF preview passed: responsive sharpness, lazy pages, coalesced replacements, retained page/text, bounded raster memory and stale-context cleanup.');

// Fail after one page has mounted and started rendering. Retry must not retain
// that attempt's observers, rendering task, or PDF worker.
current = true; destroyed = 0; pages.length = 0;
const originalGetPage = pdf.getPage;
let rejectPage;
pdf.getPage = number => number === 1 ? originalGetPage() : new Promise((resolve, reject) => { rejectPage = reject; });
const failedContainer = new Element();
const failed = context.preview(failedContainer, {arrayBuffer: async () => new ArrayBuffer(1)}, () => current);
await flush();
const failedIntersection = intersection, failedResize = resize;
assert.equal(pages.length, 1);
failedIntersection.callback([{target: pages[0], isIntersecting: true}]);
const abandonedRender = tasks.at(-1);
rejectPage(new Error('Page metadata unavailable'));
await assert.rejects(failed, /Page metadata unavailable/);
await flush();
assert.equal(failedIntersection.disconnected, true, 'A failed setup releases its intersection observer');
assert.equal(failedResize.disconnected, true, 'A failed setup releases its resize observer');
assert.equal(abandonedRender.cancelled, true, 'A failed setup cancels already-started page work');
assert.equal(destroyed, 1, 'A failed setup destroys its PDF exactly once');
assert.equal(pages[0].children.length, 0, 'Canceled work cannot publish after failure');
pdf.getPage = originalGetPage;
const beforeRetry = pages.length;
const retryDispose = await context.preview(failedContainer, {arrayBuffer: async () => new ArrayBuffer(1)}, () => current);
assert.equal(pages.length, beforeRetry + 2, 'A fresh attempt can mount all pages after failure');
retryDispose(); retryDispose();
assert.equal(destroyed, 2, 'Each attempt owns a single idempotent cleanup');

let loadingTaskDestroyed = 0;
context.loadPDF = async () => ({GlobalWorkerOptions: {}, getDocument: () => ({
  promise: Promise.reject(new Error('PDF parsing failed')),
  async destroy() { loadingTaskDestroyed++; }
})});
await assert.rejects(context.preview(new Element(), {arrayBuffer: async () => new ArrayBuffer(1)}, () => true), /PDF parsing failed/);
assert.equal(loadingTaskDestroyed, 1, 'A rejected document load releases its worker before a PDF proxy exists');
console.log('PDF failure recovery passed: page-setup rejection releases observers/rendering/worker, clean retry succeeds, repeated disposal is safe, and rejected parsing releases its loading task.');
