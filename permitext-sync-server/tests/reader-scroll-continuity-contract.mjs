import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
const frames = [], windows = [], panels = [];
const sections = Array.from({ length: 60 }, (_, index) => ({ id: `s${index}`, readerAliasSectionIDs: [], blocks: [] }));
function panel(id, reader, scrollTop = 0) {
  const events = new EventTarget();
  const content = { children: [], dataset: {}, scrollTop, clientHeight: 600,
    addEventListener: (...args) => events.addEventListener(...args),
    dispatchEvent: event => events.dispatchEvent(event),
    classList: { remove() {}, contains: () => false },
    get scrollHeight() { return this.children.reduce((height, node) => height + node.height, 0); },
    getBoundingClientRect: () => ({ top: 0, bottom: 600 }),
    querySelectorAll: () => content.children,
    querySelector(selector) { return this.children.find(child => selector.includes(`"${child.dataset.sectionId}"`)) || null; },
    append(child) { this.children.push(child); } };
  const p = { isConnected: true, dataset: { paneId: id }, querySelector: () => content, content, reader };
  return p;
}
function sectionNode(content, section) {
  const node = { style: {}, dataset: { sectionId: section.id }, querySelectorAll: () => [], querySelector: () => null,
    // Match Chrome's initially skipped text: 600px intrinsic placeholder,
    // replaced by its real 200px layout when the repair makes it measurable.
    get height() { return node.style.contentVisibility === "visible" ? 200 : 600; },
    getBoundingClientRect() {
      const top = content.children.slice(0, content.children.indexOf(node))
        .reduce((height, child) => height + child.height, 0) - content.scrollTop;
      return { top, bottom: top + node.height };
    } };
  return node;
}
const context = vm.createContext({
  Map, AbortController, CSS: { escape: value => value }, crypto: { randomUUID },
  track: { querySelectorAll: () => panels, querySelector: selector => panels.find(p => selector.includes(`"${p.dataset.paneId}"`)) },
  requestAnimationFrame: callback => frames.push(callback), updateReaderScrollIndicator() {},
  clear: content => { content.children = []; content.scrollTop = 0; }, stopReaderProgressiveHydration() {},
  emptyReader() {}, blankReader() {}, fetchChapter: async () => ({ sections }),
  readerSectionsWithoutRepeatedCatalogAliases: value => value,
  readerTargetSectionIndex: (value, reader) => value.findIndex(s => s.id === reader.sectionID),
  readerInitialSectionWindowSize: 5,
  fetchChapterBodyWindow: async (id, start, count) => { windows.push({ id, start, count }); return { sections: sections.slice(start, start + count) }; },
  groupLabelsForChapter: () => new Map(), readerSectionWithWindowBody: section => section,
  renderReaderChapterSection: (p, _reader, section) => sectionNode(p.content, section),
  cacheRecentlyViewedReaderPreview() {}, collapseRepeatedReaderCatalogAliases() {}, progressivelyRenderReaderChapter() {},
  scrollReaderContentToSection: () => { throw new Error("A stale requested-section alignment overrode the captured viewport"); }
});
const names = ["readerContentScrollKey", "captureReaderScrollPositions", "restoreReaderScrollPositions", "renderSectionContent",
  "cancelReaderScrollRestore", "applyReaderScrollPosition", "restorePendingReaderScrollPosition"];
if (source.includes("function readerScrollPositionFor(")) names.push("readerScrollPositionFor");
vm.runInContext(names.map(actual).join("\n"), context);

const a = { id: "a", codePrefix: "BC", codeVersion: "2022", chapterID: "2", sectionID: "s0" };
const b = { ...a, id: "b", chapterID: "1", sectionID: "" };
const originalReaders = JSON.stringify([a, b]);
for (const [reader, top] of [[a, 4025], [b, 8070]]) {
  const p = panel(`reader:${reader.id}`, reader, top);
  p.dataset.readerContentKey = context.readerContentScrollKey(reader);
  p.content.children = sections.map(section => sectionNode(p.content, section));
  p.content.children.forEach(node => { node.style.contentVisibility = "visible"; });
  panels.push(p);
}
const positions = context.captureReaderScrollPositions();
// A full workspace render starts each progressive Reader from a small window.
// It must choose that window from the captured visible section, rather than
// clamping an old document-wide pixel offset into the chapter's first 5 rows.
panels.splice(0, panels.length, panel("reader:a", a), panel("reader:b", b));
for (const p of panels) {
  await context.renderSectionContent(p, p.reader, { scrollPosition: positions.get(p.dataset.paneId) });
  p.dataset.readerContentKey = context.readerContentScrollKey(p.reader);
}
assert.deepEqual(windows.map(w => w.start), [18, 38], "Each progressive Reader must start around its own visible section");
context.restoreReaderScrollPositions(positions);
for (const callback of frames.splice(0)) callback();
for (const p of panels) {
  assert.ok(p.content._readerPendingScrollPosition, "Short initial windows keep a recoverable anchor until nearby content arrives");
  const last = Number(p.content.children.at(-1).dataset.sectionId.slice(1));
  p.content.append(sectionNode(p.content, sections[last + 1]));
  context.restorePendingReaderScrollPosition(p);
  assert.equal(p.content._readerPendingScrollPosition, undefined);
}
const restored = context.captureReaderScrollPositions();
for (const id of ["reader:a", "reader:b"]) {
  assert.equal(restored.get(id).sectionID, positions.get(id).sectionID);
  assert.equal(restored.get(id).anchorOffset, positions.get(id).anchorOffset, "The visible passage offset must survive a reduced DOM window");
}
assert.equal(JSON.stringify([a, b]), originalReaders, "Viewport restoration cannot change requested citations or persist new navigation");

// A late hydration callback cannot reposition a newly navigated chapter/edition.
context.restoreReaderScrollPositions(positions);
panels[0].dataset.readerContentKey = "new-navigation";
panels[0].content.scrollTop = 11;
for (const callback of frames.splice(0)) callback();
assert.equal(panels[0].content.scrollTop, 11);

// Input before the next frame and another render of the same citation also
// invalidate restoration, even when the content key itself has not changed.
context.restoreReaderScrollPositions(positions);
panels[1].content.dispatchEvent(new Event("wheel"));
panels[1].content.scrollTop = 13;
for (const callback of frames.splice(0)) callback();
assert.equal(panels[1].content.scrollTop, 13);
context.restoreReaderScrollPositions(positions);
panels[1].dataset.readerRenderToken = "new-render";
for (const callback of frames.splice(0)) callback();
assert.equal(panels[1].content.scrollTop, 13);
panels[1].isConnected = false;
context.applyReaderScrollPosition(panels[1], positions.get("reader:b"));
assert.equal(panels[1].content.scrollTop, 13);
panels[1].isConnected = true;

// User input takes precedence over deferred hydration restoration.
const pending = panels[1];
pending.content.children.pop();
context.applyReaderScrollPosition(pending, positions.get("reader:b"));
assert.ok(pending.content._readerPendingScrollPosition);
pending.content.dispatchEvent(new Event("wheel"));
pending.content.scrollTop = 12;
context.restorePendingReaderScrollPosition(pending);
assert.equal(pending.content.scrollTop, 12);

const changedEdition = { ...a, codeVersion: "2014" };
assert.notEqual(context.readerContentScrollKey(a), context.readerContentScrollKey(changedEdition), "Edition belongs in viewport identity");
windows.length = 0;
const changed = panel("reader:a", changedEdition);
await context.renderSectionContent(changed, changedEdition, { scrollPosition: positions.get("reader:a") });
assert.equal(windows[0].start, 0, "Another edition must ignore the old viewport");
assert.equal(changed.dataset.readerContentKey, context.readerContentScrollKey(changedEdition), "In-place navigation updates the displayed-content key");
frames.length = 0;

const missing = { ...positions.get("reader:a"), sectionID: "removed-source-section" };
windows.length = 0;
await context.renderSectionContent(changed, a, { scrollPosition: missing });
assert.equal(windows[0].start, 0, "Missing source anchors fall back to requested navigation, not unrelated text");
frames.length = 0;
panels[0].dataset.readerContentKey = "";
assert.equal(context.captureReaderScrollPositions().has("reader:a"), false, "Loading content cannot become a recovery anchor");

assert.match(actual("renderWorkspace"), /renderReader\(reader,\s*\{\s*scrollPosition: readerScrollPositions\.get\(paneIDForReader\(reader\)\)/);
assert.match(actual("renderReader"), /refreshReaderContent\(panel, reader,\s*\{\s*scrollPosition: options\.scrollPosition/);
assert.match(actual("refreshReaderContent"), /renderSectionContent\(panel, reader, options\)/);
assert.match(actual("beginReaderNavigation"), /delete panel\.dataset\.readerContentKey/);
assert.match(actual("navigateReaderToSection"), /panel\.dataset\.readerContentKey = readerContentScrollKey\(reader\)/);
console.log("Reader scroll continuity passed: independent progressive anchors, unchanged citations, edition/navigation guards and real render wiring.");
