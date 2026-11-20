import assert from 'node:assert/strict';
import {createReportPageLayout} from '../public/report-page-layout.js';

class Element {
  constructor() {this.children = []; this.attributes = {}; this.events = {}; this.className = ''; this.scrollTop = 0;}
  append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
  replaceChildren(...nodes) {this.children.forEach(node => {node.parent = null;}); this.children = []; this.append(...nodes);}
  remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null;}
  setAttribute(key, value) {this.attributes[key] = value;}
  addEventListener(name, callback) {this.events[name] = callback;}
  get classList() {return {remove: value => {this.className = this.className.split(' ').filter(name => name !== value).join(' ');}};}
  querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  querySelectorAll(selector) {return this.children.flatMap(node => [
    ...(node.className.split(' ').includes(selector.slice(1)) ? [node] : []), ...node.querySelectorAll(selector)]);}
}
globalThis.document = {createElement: () => new Element()};
const tick = () => new Promise(resolve => setImmediate(resolve));
const pending = [], rendering = [], disposed = [];
let owner = true;
let scheduled;
const host = new Element();
const controller = createReportPageLayout({host, isCurrent: () => owner,
  prepare: () => new Promise((resolve, reject) => pending.push({resolve, reject})),
  renderPDF: (staging, blob, current, options) => new Promise((resolve, reject) => {
    assert.equal(options.eagerFirstPage, true);
    const page = new Element(); page.className = 'report-pdf-page'; page.textContent = blob; staging.append(page);
    rendering.push({current, reject, finish: () => resolve(() => disposed.push(blob))});
  }), setTimer: callback => {scheduled = callback; return 1;}, clearTimer() {scheduled = null;}});
controller.invalidate(); assert.equal(pending.length, 0, 'Editing mode does not prepare PDFs.');
controller.setActive(true); assert.equal(pending.length, 1);
const newer = controller.refresh(); pending[1].resolve('Newer pages'); await tick(); rendering[0].finish();
assert.equal(await newer, true);
const pages = () => host.querySelectorAll('.report-pdf-page');
assert.equal(pages()[0].textContent, 'Newer pages');
assert.equal(host.children[0].textContent, '', 'The preview status clears when pages are ready.');
pending[0].resolve('Late old pages'); await tick();
assert.equal(pages()[0].textContent, 'Newer pages', 'A slower preview cannot replace newer content.');

controller.invalidate({showUpdating: false});
assert.equal(host.children[0].textContent, '', 'An Outline removal leaves the progress message empty.');
scheduled();
assert.equal(host.children[0].textContent, '', 'The scheduled preview stays quiet when it starts.');
assert.equal(pages()[0].textContent, 'Newer pages', 'Keep complete pages visible during preparation.');
pending[2].resolve('Updated pages'); await tick();
assert.equal(pages()[0].textContent, 'Newer pages', 'Keep complete pages visible during replacement rendering.');
rendering[1].finish(); await tick();
assert.equal(pages().length, 1); assert.equal(pages()[0].textContent, 'Updated pages');
assert.deepEqual(disposed, ['Newer pages']);
controller.restorePosition(731);
assert.equal(controller.capturePosition(),731,'Structural editing can retain the page scroll when its toolbar/model is rebuilt');

const failed = controller.refresh();
assert.equal(host.children[0].textContent, 'Updating pages…', 'Ordinary refreshes still show progress.');
pending[3].reject(new Error('Offline')); assert.equal(await failed, false);
assert.equal(pages()[0].textContent, 'Updated pages');
assert.match(host.children[0].textContent, /Pages need updating.*Offline/);
assert.equal(host.children[1].hidden, false);

const blockedBySave = controller.refresh(); pending[4].resolve(null);
assert.equal(await blockedBySave, false);
assert.equal(pages()[0].textContent, 'Updated pages', 'A save failure keeps the last complete pages visible.');
assert.equal(host.children[0].textContent, '', 'A save failure is reported by autosave only.');
assert.equal(host.children[1].hidden, true, 'Retry pages is reserved for page preparation errors.');

const changedOwner = controller.refresh(); pending[5].resolve('Other project'); await tick();
owner = false; rendering[2].finish(); assert.equal(await changedOwner, false);
assert.equal(pages()[0].textContent, 'Updated pages', 'Project/account changes never expose a stale in-flight preview.');
assert(disposed.includes('Other project'));
controller.setActive(false); controller.invalidate(); assert.equal(pending.length, 6);
controller.dispose(); assert.equal(host.children.length, 0); assert(disposed.includes('Updated pages'));
delete globalThis.document;
console.log('Live page layout client passed: on-demand rendering, stale-response/ownership fences, retained pages during refresh/error, eager first-page handoff, and resource cleanup.');
