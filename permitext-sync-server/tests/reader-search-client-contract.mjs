import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { searchReaderTextSections } from "../public/reader-search-match.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const helpers = source.slice(source.indexOf("function cancelReaderInternalSearch("), source.indexOf("async function renderReaderInternalSearchResults("));
assert.ok(helpers.includes("async function fetchReaderChapterSearch("));
const reader = { chapterID: "chapter-33", codeVersion: "2022", codePrefix: "BC" };
const complete = () => ({ chapter: { id: reader.chapterID, codeVersion: reader.codeVersion, codePrefix: "BC", bodyRange: { start: 0, end: 2, total: 2, complete: true }, sections: [
  { id: "section-1", sectionNumber: "1", title: "Walls", blocks: [{ id: "paragraph-1", plainText: "Concrete and masonry walls." }] },
  { id: "section-2", sectionNumber: "2", title: "Remote section", blocks: [{ id: "paragraph-2", plainText: "Concrete at the chapter end." }] }
] } });
function harness({ fetchImpl = async () => { throw new Error("network failure"); }, offline = complete(), capable = true } = {}) {
  let offlineCalls = 0;
  const restored = [], scrollRestored = [], cleared = [], timers = new Map([["reader", 123]]);
  const context = vm.createContext({
    crypto: { randomUUID }, URLSearchParams, DOMException, searchReaderTextSections,
    readerSearchTimers: timers, clearTimeout: (timer) => cleared.push(timer),
    renderSectionContent: async (...args) => restored.push(args),
    paneIDForReader: () => "reader:pane", restoreReaderScrollPositions: (positions) => { assert.equal(restored.length, 1); scrollRestored.push(positions); },
    fetch: fetchImpl, hasCapability: () => capable,
    offlineAPI: async () => { offlineCalls++; return offline; },
    sectionDisplayTitle: (number, title) => `${number} ${title}`,
    annotatedBlocksForSection: (section) => section.blocks,
    normalizeAnnotationBlockID: (id) => id.trim(),
    plainTextForSearchBlock: (block) => block.plainText,
    syncCodeVersion: (value) => value, syncCodeVersionForPrefix: () => "2022"
  });
  vm.runInContext(helpers + "\nglobalThis.search = fetchReaderChapterSearch; globalThis.cancel = cancelReaderInternalSearch; globalThis.restore = restoreReaderAfterSearch;", context);
  return { context, timers, restored, scrollRestored, cleared, get offlineCalls() { return offlineCalls; }, search: (query = "concrete", signal = new AbortController().signal) => context.search(reader, query, signal) };
}
{
  const t = harness();
  const results = await t.search();
  assert.deepEqual(Array.from(results, (r) => r.sectionID), ["section-1", "section-2"], "offline search includes chapter end beyond visible rows");
  assert.deepEqual(Array.from(results, (r) => r.blockID), ["paragraph-1", "paragraph-2"]);
  assert.equal(t.offlineCalls, 1);
}
{
  const t = harness({ capable: false });
  await assert.rejects(t.search(), /network failure/);
  assert.equal(t.offlineCalls, 0);
}
{
  const controller = new AbortController(); controller.abort();
  const t = harness({ fetchImpl: async () => { throw new DOMException("aborted", "AbortError"); } });
  await assert.rejects(t.search("concrete", controller.signal), { name: "AbortError" });
  assert.equal(t.offlineCalls, 0, "cancellation never starts offline fallback");
}
for (const mutate of [
  (x) => { x.chapter.id = "another-chapter"; },
  (x) => { x.chapter.codeVersion = "2014"; },
  (x) => { delete x.chapter.bodyRange; },
  (x) => { x.chapter.bodyRange.start = 1; },
  (x) => { x.chapter.bodyRange.end = 1; },
  (x) => { x.chapter.bodyRange.total = 3; },
  (x) => { x.chapter.bodyRange.complete = false; },
  (x) => { delete x.chapter.sections[1].blocks; }
]) {
  const offline = complete(); mutate(offline);
  await assert.rejects(harness({ offline }).search(), "partial or wrong-edition offline data must reject");
}
function response(overrides = {}) {
  return { ok: true, json: async () => ({ readerSearch: { chapterID: reader.chapterID, codeVersion: "2022", corpusRevision: "a".repeat(64), query: "concrete", total: 0, results: [], ...overrides } }) };
}
{
  let url, signal;
  const t = harness({ fetchImpl: async (path, options) => { url = path; signal = options.signal; return response(); } });
  assert.equal((await t.search(" concrete ")).length, 0);
  assert.equal(new URL(url, "https://test.local").searchParams.get("readerSearch"), "concrete");
  assert.ok(signal instanceof AbortSignal);
  assert.equal(t.offlineCalls, 0);
}
for (const mismatch of [{ corpusRevision: undefined }, { corpusRevision: "invalid" }, { chapterID: "other" }, { codeVersion: "2014" }, { query: "walls" }, { total: 1 }, { results: null }]) {
  const t = harness({ fetchImpl: async () => response(mismatch) });
  await assert.rejects(t.search(), /identity mismatch/);
  assert.equal(t.offlineCalls, 0, "invalid response does not silently fall back");
}
{
  const t = harness(), controller = new AbortController();
  const position = { sectionID: "section-1", blockID: "paragraph-1", offset: 87 };
  const panel = { dataset: { readerId: "reader" }, _readerSearchAbort: controller, _readerSearchReturnPosition: position };
  t.context.cancel(panel);
  assert.equal(controller.signal.aborted, true);
  assert.equal(panel._readerSearchAbort, undefined);
  assert.equal(t.timers.size, 0);
  assert.deepEqual(t.cleared, [123]);
  assert.match(panel.dataset.readerSearchToken, /^cancelled:/);
  await t.context.restore(panel, reader);
  assert.equal(t.scrollRestored[0].get("reader:pane"), position, "pixel restoration follows content mounting");
  assert.equal(t.restored[0][2].scrollPosition, position, "closing Find restores original captured Reader position");
}
console.log("Reader search client passed: complete offline fallback, edition/identity checks, abort propagation, and Find position restoration.");

{
 const t = harness({ fetchImpl: async () => response({ total: 1, results: [{ sectionID: "section-1" }] }) });
 assert.equal((await t.search())[0].corpusRevision, "a".repeat(64), "revision follows each result to Reader opening");
}
