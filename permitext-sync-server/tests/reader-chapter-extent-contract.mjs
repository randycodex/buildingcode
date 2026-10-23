import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createReaderChapterExtent, readerExtentWindow } from "../public/reader-chapter-extent.js";

class Node {
  constructor(height = 0, sectionID = null) {
    this.height = height; this.style = {}; this.dataset = {}; this.parent = null; this.children = [];
    this.className = sectionID === null ? "" : "chapter-section";
    if (sectionID !== null) this.dataset.sectionId = String(sectionID);
  }
  get isConnected() { return Boolean(this.parent); }
  get size() { return parseFloat(this.style.height) || this.height; }
  setAttribute() {}
  append(node) { node.parent = this; this.children.push(node); }
  insertBefore(node, before) {
    const index = before ? this.children.indexOf(before) : this.children.length;
    const nodes = node.fragment ? node.children : [node];
    nodes.forEach(child => { child.parent = this; });
    this.children.splice(index, 0, ...nodes);
  }
  replaceWith(node) {
    const parent = this.parent, index = parent.children.indexOf(this);
    parent.children[index] = node; node.parent = parent; this.parent = null;
  }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
  querySelectorAll(selector) { return this.children.filter(node => node.className.includes(selector.slice(1))); }
  querySelector(selector) {
    const sectionID = /data-section-id="([^"]+)"/.exec(selector)?.[1];
    return sectionID ? this.children.find(node => node.dataset.sectionId === sectionID) || null
      : this.querySelectorAll(selector)[0] || null;
  }
  getBoundingClientRect() {
    if (!this.parent) return { top: 0, bottom: this.clientHeight, height: this.clientHeight };
    const top = this.parent.children.slice(0, this.parent.children.indexOf(this)).reduce((sum, node) => sum + node.size, 0) - this.parent.scrollTop;
    return { top, bottom: top + this.size, height: this.size };
  }
  get scrollHeight() { return this.children.reduce((sum, node) => sum + node.size, 0); }
  get firstChild() { return this.children[0]; }
}
const originalDocument = globalThis.document, originalStyle = globalThis.getComputedStyle;
globalThis.document = { createElement: () => new Node(), createDocumentFragment: () => Object.assign(new Node(), {fragment:true}) };
globalThis.getComputedStyle = content => ({ paddingLeft:"0", paddingRight:"0", fontFamily:"serif", fontSize:"16px",
  getPropertyValue: () => String(content.clientWidth) });
const sections = Array.from({length:100}, (_, id) => ({id}));
function fixture(start = 0, end = 5, id = "chapter", revision = "a") {
  const content = new Node();
  content.clientWidth = 600; content.clientHeight = 600; content.scrollTop = 0;
  content.events = {};
  content.addEventListener = (name, action) => { content.events[name] = action; };
  content.removeEventListener = name => { delete content.events[name]; };
  for (let i = start; i < end; i++) content.append(new Node(200, i));
  return { content, extent: createReaderChapterExtent(content, sections, start, end, {id,corpusRevision:revision,codeVersion:"2022"}) };
}
try {
  const {content, extent} = fixture();
  assert.equal(content.scrollHeight, 20000, "The native scroll extent covers all 100 sections with only five bodies loaded");
  assert.equal(content.querySelectorAll(".chapter-section").length, 5);
  assert.equal(content.querySelectorAll(".reader-section-placeholder").length, 95);
  assert.ok(content.querySelectorAll(".reader-section-placeholder").every(node => !node.dataset.sectionId), "Reserved space is never presented as source text or a navigable loaded passage");
  content.scrollTop = 14050;
  const pendingPosition = extent.unloadedScrollPosition("current-chapter");
  assert.equal(pendingPosition.sectionID,"70");
  assert.equal(pendingPosition.estimatedFraction,0.25,"A workspace refresh while loading retains the intended destination, not an unrelated loaded section");
  const jumped = extent.nextWindow(12, 320);
  assert.ok(jumped.start <= 70 && jumped.end > 70);
  assert.equal(jumped.end - jumped.start, 12, "A thumb jump loads a bounded window near the destination");
  assert.ok(jumped.start > 5, "Intermediate sections are not fetched just to reach the destination");
  extent.replace(jumped.start, sections.slice(jumped.start, jumped.end).map(section => new Node(300, section.id)), () => {});
  const target = content.children.find(node => node.dataset.sectionId === "70");
  assert.equal(target.getBoundingClientRect().top, -75, "Landing within estimated space retains its proportional position when text arrives");
  const anchorBefore = target.getBoundingClientRect().top;
  extent.replace(5, sections.slice(5, 17).map(section => new Node(400, section.id)), () => {});
  assert.equal(target.getBoundingClientRect().top, anchorBefore, "Hydrating text above the visible passage does not move it");
  content.clientWidth = 400;
  const topBeforeResize = target.getBoundingClientRect().top;
  extent.nextWindow(12, 320);
  assert.equal(target.getBoundingClientRect().top, topBeforeResize, "A new column width re-estimates unloaded text without losing the passage anchor");
  content.scrollTop = content.scrollHeight - content.clientHeight;
  const last = extent.nextWindow(12, 320);
  assert.ok(last.end <= 100 && last.end > 97, "End-of-chapter jumps load the final missing window");
  extent.replace(last.start, sections.slice(last.start, last.end).map(section => new Node(350, section.id)), () => {});
  assert.equal(content.scrollTop, content.scrollHeight - content.clientHeight, "Loading at the chapter end keeps the scrollbar at the real end");
  const middle = fixture(48, 53, "middle");
  assert.equal(middle.content.children.find(node => node.dataset.sectionId === "48").getBoundingClientRect().top, 0,
    "Adding space before a deep-linked initial window preserves its visible text");
  assert.equal(middle.extent.loadedCount, 5);
  assert.equal(readerExtentWindow([true,true,false,false,false,true], 3, 12).start, 2);
  assert.equal(readerExtentWindow([true,true,false,false,false,true], 3, 12).end, 5);
  assert.equal(readerExtentWindow([true], 0, 12), null);
  const measured = fixture(0, 5, "cache");
  for (let start = 5; start < 100; start += 12) {
    measured.extent.replace(start, sections.slice(start, start + 12).map(section => new Node(400, section.id)), () => {});
  }
  assert.equal(measured.extent.loadedCount, 100);
  assert.equal(measured.content.scrollHeight, 39000);
  assert.equal(fixture(0, 5, "cache").content.scrollHeight, 39000,
    "Reopening reuses measured heights without downloading the old body windows");
  assert.equal(fixture(0, 5, "cache", "changed").content.scrollHeight, 20000,
    "Another corpus revision must not reuse old measured extents");

  // Exercise the actual asynchronous hydration function with a suspended fetch.
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const restoreStart = source.indexOf("function applyReaderScrollPosition("), restoreEnd = source.indexOf("\n}",restoreStart) + 2;
  const restoration = vm.createContext({CSS:{escape:value=>value},cancelReaderScrollRestore(){},updateReaderScrollIndicator(){}});
  vm.runInContext(source.slice(restoreStart,restoreEnd),restoration);
  content.scrollTop = 0;
  restoration.applyReaderScrollPosition({isConnected:true,classList:{contains:()=>false},dataset:{readerContentKey:pendingPosition.contentKey},querySelector:()=>content},pendingPosition);
  assert.equal(target.getBoundingClientRect().top,-75,"Actual viewport restoration resolves an unloaded estimated position against the measured source section");
  const start = source.indexOf("async function progressivelyRenderReaderChapter("), end = source.indexOf("\n}", start) + 2;
  for (const mode of ["current", "new-navigation", "stopped", "closed", "failed"]) {
    let finish, reject, replaced = 0, disconnects = 0;
    const request = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
    const status = new Node(); status.parent = new Node();
    const scroller = {clientWidth:600,clientHeight:600,append(){},addEventListener(){},removeEventListener(){}};
    const panel = {classList:{contains:()=>false},isConnected:true,dataset:{readerRenderToken:"initial"}};
    const frames = [];
    let next = {start:60,end:72};
    const calls = [];
    const context = vm.createContext({AbortController,readerPanelIntersectsTrack:()=>true,document:{createElement:()=>status},
      ResizeObserver:class {observe(){} disconnect(){disconnects++;}},
      window:{setTimeout,clearTimeout},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},
      createReaderChapterExtent:()=>({loadedCount:5,nextWindow:()=>next,replace(){replaced++;next=null;}}),
      readerProgressiveSectionBatchSize:12,fetchChapterBodyWindow:(_chapter,start,count,_manifest,{signal})=>{calls.push({start,count,signal});return request;},
      renderReaderChapterSection:()=>new Node(),readerSectionWithWindowBody:section=>section,
      collapseRepeatedReaderCatalogAliases(){},restorePendingReaderScrollPosition(){},updateReaderScrollIndicator(){},console:{warn(){}}
    });
    vm.runInContext(source.slice(start, end), context);
    await context.progressivelyRenderReaderChapter(panel, {}, scroller, sections, new Map(), 0, 5, "initial", {});
    assert.deepEqual(calls.map(({start,count})=>({start,count})), [{start:60,count:12}]);
    if (mode === "new-navigation") panel.dataset.readerRenderToken = "newer";
    if (mode === "closed") panel.isConnected = false;
    if (mode === "stopped") { scroller._readerProgressiveCleanup(); assert.equal(calls[0].signal.aborted,true); assert.equal(disconnects,1); }
    if (mode === "failed") reject(Error("offline")); else finish({sections:[]});
    for (let i = 0; i < 12; i++) await Promise.resolve();
    assert.equal(replaced, mode === "current" ? 1 : 0, "Late or failed bodies must not replace a newer, stopped or closed Reader");
    if (mode === "failed") { assert.equal(status.hidden,false); assert.match(status.textContent,/Scroll again to retry/); }
    scroller._readerProgressiveCleanup();
  }
  console.log("Reader chapter extent passed: full reserved range, bounded thumb jumps, passage anchoring, resize, deep links, cancellation and retry.");
} finally {
  globalThis.document = originalDocument; globalThis.getComputedStyle = originalStyle;
}
