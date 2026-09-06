import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, `Missing actual ${name}`);
  return source.slice(start, end + 2);
}
function node() {
  return { children: [], dataset: {}, callbacks: {}, classList: { remove() {} },
    append(...children) { this.children.push(...children); },
    querySelector(selector) { return this.children.find(child => `.${child.className}` === selector); },
    addEventListener(name, callback) { this.callbacks[name] = callback; } };
}
function deferred(key) {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { key, promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const chapter = id => ({ sections: [{ id: `${id}:s1`, codePrefix: id.split("-")[0], blocks: [] }] });
function harness({ delayChapters = false } = {}) {
  const content = node(), chapterSelect = node(), sectionSelect = node(), save = node();
  content.children = ["Previously displayed enacted text"];
  const nodes = { ".reader-content": content, ".chapter-select": chapterSelect, ".section-select": sectionSelect, ".reader-save": save };
  const panel = { dataset: {}, querySelector: key => nodes[key], querySelectorAll: () => [chapterSelect, sectionSelect] };
  const reader = { codePrefix: "BC", codeVersion: "2014", chapterID: "BC-2014-old", sectionID: "" };
  const lists = [], chapters = [], bodies = [], persisted = [], frames = [];
  const context = vm.createContext({
    crypto: { randomUUID }, document: { createElement: node },
    clear: element => { element.children = []; },
    blankReader: element => { element.children = ["Select a chapter"]; },
    stopReaderProgressiveHydration() {}, applyCodeTheme() {}, renderReaderTrust() {},
    populateCodeSelect() {}, resetEnhancedSelects() {}, enhanceSelect() {},
    codeOptionVersion: option => option.version,
    fetchChapterList(prefix, version) { const r = deferred(`${prefix}-${version}`); lists.push(r); return r.promise; },
    fetchChapter(id) {
      if (!delayChapters) return Promise.resolve(chapter(id));
      const r = deferred(id); chapters.push(r); return r.promise;
    },
    fetchChapterBodyWindow(id) { const r = deferred(id); bodies.push(r); return r.promise; },
    readerNavigationSections: value => value.sections,
    sectionDisplayTitle: (_number, title) => title,
    readerSectionsWithoutRepeatedCatalogAliases: sections => sections,
    readerTargetSectionIndex: () => 0, readerInitialSectionWindowSize: 6,
    groupLabelsForChapter: () => ({}), readerSectionWithWindowBody: section => section,
    renderReaderChapterSection: (_panel, current, section) => `${current.codePrefix}-${current.codeVersion}|${section.id}`,
    cacheRecentlyViewedReaderPreview() {}, collapseRepeatedReaderCatalogAliases() {},
    progressivelyRenderReaderChapter() {}, requestAnimationFrame: callback => frames.push(callback),
    setTitle: (_panel, current) => { panel.title = `${current.codePrefix}-${current.codeVersion}`; },
    saveWorkspaceState: () => persisted.push({ ...reader }), scheduleContinuitySync() {},
    closeActiveCustomSelect() {}, state: {}, readerCodeSelectionKey: value => `${value.codePrefix}-${value.codeVersion}`,
    sectionTitleFromID: (_id, value) => ({ sectionNumber: value.sections[0].id, title: value.sections[0].id }),
    updateBrowserSectionURL() {}, navigateReaderToSection() {}
  });
  vm.runInContext([
    "emptyReader", "resolveReaderNavigationChapterID", "beginReaderNavigation", "changeReaderCode", "refreshReaderContent",
    "populateReaderSelectors", "renderSectionContent", "selectReaderNavigation"
  ].map(actual).join("\n"), context);
  return { panel, reader, content, chapterSelect, sectionSelect, lists, chapters, bodies, persisted,
    run: (prefix, version) => context.changeReaderCode(panel, reader, { prefix, version }),
    select: selection => context.selectReaderNavigation(panel, reader, selection),
    refresh: () => context.refreshReaderContent(panel, reader),
    invalidate: () => context.beginReaderNavigation(panel),
    resolveChapter: list => context.resolveReaderNavigationChapterID(reader, list) };
}
async function complete(t, request = t.lists.at(-1)) {
  request.resolve([{ id: `${request.key}-chapter` }]);
  await tick();
  const body = t.bodies.at(-1);
  body.resolve(chapter(body.key));
  await tick();
}
function assertCurrent(t, key) {
  assert.equal(t.reader.chapterID, `${key}-chapter`);
  assert.equal(t.panel.title, key);
  assert.deepEqual(t.content.children, [`${key}|${key}-chapter:s1`]);
  assert.equal(t.chapterSelect.children[0].value, `${key}-chapter`);
}

// Switching editions removes the previous text before any catalog request completes.
// A-B-A must distinguish requests even when the final edition equals the first.
{
  const t = harness();
  const old = t.run("BC", "2014");
  assert.equal(t.content.querySelector(".reader-empty").children[0].textContent, "Loading chapter");
  const middle = t.run("FGC", "2022");
  const latest = t.run("BC", "2014");
  await complete(t); await latest;
  t.lists[0].resolve([{ id: "BC-2014-obsolete" }]);
  t.lists[1].resolve([{ id: "FGC-2022-obsolete" }]);
  await Promise.all([old, middle]);
  assertCurrent(t, "BC-2014");
  assert.equal(t.persisted.length, 1, "Only the accepted navigation may publish continuity state.");
}

// A previously requested body or failure cannot replace a newer code's text.
for (const obsoleteResult of ["body", "failure"]) {
  const t = harness();
  const old = t.run("BC", "2014");
  t.lists[0].resolve([{ id: "BC-2014-chapter" }]);
  await tick();
  const oldBody = t.bodies[0];
  const latest = t.run("FGC", "2022");
  await complete(t); await latest;
  if (obsoleteResult === "failure") oldBody.reject(new Error("Synthetic obsolete body failure"));
  else oldBody.resolve(chapter(oldBody.key));
  await old;
  assertCurrent(t, "FGC-2022");
}

// Catalog failure has a working retry and retains no text from another code.
{
  const t = harness(); const pending = t.run("FGC", "2022");
  t.lists[0].reject(new Error("Synthetic catalog failure")); await pending;
  assert.equal(t.content.children.length, 1, "Retry must remain inside the visible error panel.");
  const errorPanel = t.content.querySelector(".reader-empty");
  assert.equal(errorPanel.children[0].textContent, "Couldn’t open this chapter");
  const retry = errorPanel.children.at(-1);
  assert.equal(retry.textContent, "Try again");
  retry.callbacks.click(); await complete(t);
  assertCurrent(t, "FGC-2022");
  assert.equal(t.persisted.length, 1, "Successful retry must persist the selected code and chapter.");
}

// Chapter detail and section metadata are also checked after asynchronous work.
{
  const t = harness({ delayChapters: true });
  const old = t.run("BC", "2014");
  t.lists[0].resolve([{ id: "BC-2014-chapter" }]); await tick();
  const latest = t.run("FGC", "2022");
  t.chapters[0].resolve(chapter("BC-2014-chapter")); await old;
  assert.equal(t.reader.chapterID, "");
  assert.equal(t.sectionSelect.children.length, 0);
  t.lists[1].resolve([]); await latest;
  const selected = t.select({ chapterID: "FGC-2022-chapter", sectionID: "FGC-2022-chapter:s1" });
  const next = t.run("BC", "2014");
  t.chapters[1].resolve(chapter("FGC-2022-chapter")); await selected;
  assert.equal(t.reader.sectionNumber, "");
  assert.equal(t.reader.title, "Reader");
  t.lists[2].resolve([]); await next;
}

// Removed readers and stale chapter IDs cannot resurrect old edition content.
{
  const t = harness(); const pending = t.run("FGC", "2022");
  t.invalidate(); t.lists[0].resolve([{ id: "FGC-2022-chapter" }]); await pending;
  assert.equal(t.bodies.length, 0);
  t.reader.chapterID = "BC-2014-stale";
  assert.equal(t.resolveChapter([{ id: "FGC-2022-chapter" }]), "FGC-2022-chapter");
  assert.equal(t.resolveChapter([]), "");
}
console.log("Reader navigation recovery passed: immediate clearing, A-B-A selection, delayed catalog/detail/body, stale failure, retry, section metadata and removal.");
