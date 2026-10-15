import { createPublicCodeRevisionController } from "../public/public-code-revision.js";
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
function harness({ fetchImpl = async () => { throw new Error("network failure"); }, offline = complete(), offlineImpl, capable = true } = {}) {
  let offlineCalls = 0;
  const restored = [], scrollRestored = [], cleared = [], timers = new Map([["reader", 123]]);
  const context = vm.createContext({
    publicCodeRevision: createPublicCodeRevisionController({fetchRevision:async()=>{throw Error("offline");},onInvalidate(){}}),
    crypto: { randomUUID }, URLSearchParams, DOMException, searchReaderTextSections,
    readerSearchTimers: timers, clearTimeout: (timer) => cleared.push(timer),
    renderSectionContent: async (...args) => restored.push(args),
    paneIDForReader: () => "reader:pane", restoreReaderScrollPositions: (positions) => { assert.equal(restored.length, 1); scrollRestored.push(positions); },
    fetch: fetchImpl, hasCapability: () => capable,
    offlineAPI: async path => { offlineCalls++; return offlineImpl ? offlineImpl(path) : offline; },
    sectionDisplayTitle: (number, title) => `${number} ${title}`,
    annotatedBlocksForSection: (section) => section.blocks,
    normalizeAnnotationBlockID: (id) => id.trim(),
    plainTextForSearchBlock: (block) => block.plainText,
    syncCodeVersion: (value) => value, syncCodeVersionForPrefix: () => "2022"
  });
  vm.runInContext(helpers + "\nglobalThis.search = fetchReaderChapterSearch; globalThis.cancel = cancelReaderInternalSearch; globalThis.restore = restoreReaderAfterSearch;", context);
  return { context, timers, restored, scrollRestored, cleared, get offlineCalls() { return offlineCalls; }, search: (query = "concrete", signal = new AbortController().signal, options) => context.search(reader, query, signal, options) };
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
  const offline = complete();
  offline.chapter.corpusRevision = "b".repeat(64);
  const results = await harness({ offline }).search();
  assert.ok(results.length);
  assert.ok(results.every(result => result.corpusRevision === offline.chapter.corpusRevision), "offline matches retain their installed revision when reopened online");
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

for (const status of [400,401,403,404,409]) {
 const t=harness({fetchImpl:async()=>({ok:false,status})});
 await assert.rejects(t.search());assert.equal(t.offlineCalls,0,`HTTP ${status} is not an offline availability fallback`);
}
{
 const t=harness({fetchImpl:async()=>{const error=Error('obsolete');error.code='PUBLIC_CORPUS_CHANGED';throw error;}});
 await assert.rejects(t.search(),{code:'PUBLIC_CORPUS_CHANGED'});assert.equal(t.offlineCalls,0);
}

{
 const t=harness({fetchImpl:async()=>({ok:true,json:async()=>{throw new SyntaxError('invalid response');}})});
 await assert.rejects(t.search(),/invalid response/);assert.equal(t.offlineCalls,0,'malformed online representation is not an availability fallback');
}

function codeResponse(mutate = () => {}) {
  const chapters = [
    {chapterID: reader.chapterID, chapterTitle: "Chapter 33", corpusRevision: "a".repeat(64), total: 1},
    {chapterID: "chapter-34", chapterTitle: "Chapter 34", corpusRevision: "b".repeat(64), total: 1}
  ];
  const result = {scope: "code", codePrefix: "BC", chapterID: reader.chapterID, codeVersion: "2022", corpusRevision: "a".repeat(64), query: "concrete", chapters, total: 2,
    results: chapters.map((chapter, i) => ({...chapter, sectionID: `section-${i+1}`, heading: "Concrete"}))};
  mutate(result);
  return {ok: true, json: async () => ({readerSearch: result})};
}
{
  let url;
  const results = await harness({fetchImpl: async path => {url=path; return codeResponse();}}).search("concrete", undefined, {scope: "code"});
  assert.equal(new URL(url,"https://test.local").searchParams.get("readerScope"),"code");
  assert.deepEqual(Array.from(results, item => item.chapterID),[reader.chapterID,"chapter-34"]);
  assert.equal(results[1].corpusRevision,"b".repeat(64),"each chapter keeps its own opening revision");
}
for (const mutate of [
  x=>{delete x.scope;}, x=>{x.codePrefix="PC";}, x=>{x.chapters[1].corpusRevision="invalid";},
  x=>{x.results[1].chapterID="unlisted";}, x=>{x.results[1].corpusRevision=x.corpusRevision;},
  x=>{x.chapters[1].total=3;}, x=>{x.chapters.push(x.chapters[0]);}
]) {
  await assert.rejects(harness({fetchImpl: async()=>codeResponse(mutate)}).search("concrete",undefined,{scope:"code"}),/identity mismatch/);
}
{
  const current=complete().chapter;
  Object.assign(current,{fullTitle:"Chapter 33"});
  const other={...complete().chapter,id:"chapter-34",fullTitle:"Chapter 34",corpusRevision:"b".repeat(64)};
  const historical={...other,id:"historical-34",codeVersion:"2014"};
  const chapters=[current,other,historical];
  const t=harness({offlineImpl: path=>path.startsWith("/code/chapters?") ? {chapters} : {chapter: chapters.find(x=>path.startsWith(`/code/chapters/${x.id}`))}});
  const results=await t.search("concrete",undefined,{scope:"code"});
  assert.deepEqual([...new Set(Array.from(results,x=>x.chapterID))],[reader.chapterID,"chapter-34"]);
  other.bodyRange={...other.bodyRange,complete:false};
  await assert.rejects(t.search("concrete",undefined,{scope:"code"}),/network failure/,"an incomplete sibling cannot masquerade as a full code search");
}
console.log("Reader code search client passed: chapter grouping identities, exact revisions, and complete offline code scope.");
