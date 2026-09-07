import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import * as identity from "../public/sync-identity.js";

const source = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
function between(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Source boundary: ${start}`);
  return source.slice(first, last).replace(/^export /gm, "");
}
const functions = [
  between("function offlineSectionCodeVersion(", "function chapterSectionRecord("),
  between("const offlineChapterBodyLimit", "function normalizedOfflineAssetName("),
  between("export async function downloadOfflineLibrary(", "export async function offlineLibraryStatus(")
].join("\n");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const current = (id, count = 1) => ({
  id, codePrefix: "BC", codeVersion: identity.defaultSyncCodeVersion,
  sections: Array.from({ length: count }, (_, index) => ({
    id: id * 1000 + index, sectionNumber: `${id}.${index}`, title: `Section ${index}`,
    blocks: [{ plainText: `Exact body ${id}/${index}` }]
  }))
});
const historical = { ...current(40000010), codeVersion: identity.historicalConstructionSyncCodeVersion,
  sections: [{ id: 41000010, sectionNumber: "1010.2", title: "Slope", blocks: [{ plainText: "Historical slope text" }] }] };
function harness(chapters, overrides = {}) {
  const progress = [], requests = [], writes = [], cleaned = [];
  let active = { installID: "previous-good-library" };
  const rows = new Map([[active.installID, ["retained chapter"]]]);
  let requestHook = null, writeHook = null;
  const libraries = [
    { id: "nyc-2022-construction-codes", syncCodeVersion: identity.defaultSyncCodeVersion },
    { id: "nyc-2014-construction-codes", syncCodeVersion: identity.historicalConstructionSyncCodeVersion }
  ];
  const summary = chapter => ({ ...chapter, sections: undefined, sectionCount: chapter.sections.length });
  const context = vm.createContext({
    ...identity, defaultCodeVersion: identity.defaultSyncCodeVersion,
    indexedDB: {}, crypto: webcrypto, AbortController, Response, setTimeout, clearTimeout,
    offlineLibrarySchemaVersion: 3, offlineAssetVersion: "fixture",
    navigator: { storage: { persist: async () => {} } },
    prepareOfflineShell: async () => {},
    fetch: async (path, options) => {
      const url = new URL(path, "http://offline.test");
      requests.push(url);
      if (url.pathname === "/code/libraries") return Response.json({ libraries });
      if (url.pathname === "/code/chapters") {
        const old = url.searchParams.get("version") === identity.historicalConstructionSyncCodeVersion;
        return Response.json({ chapters: chapters.filter(chapter =>
          (chapter.codeVersion === identity.historicalConstructionSyncCodeVersion) === old).map(summary) });
      }
      const rawID = url.pathname.split("/").at(-1);
      const id = /^\d+$/.test(rawID) ? Number(rawID) : rawID;
      const chapter = chapters.find(value => value.id === id);
      assert.ok(chapter, "Only synthetic chapter requests are allowed");
      const start = Number(url.searchParams.get("bodyStart"));
      const limit = Number(url.searchParams.get("bodyLimit"));
      assert.ok(limit > 0 && limit <= 25, "No unbounded full-chapter body request");
      const end = Math.min(chapter.sections.length, start + limit);
      const payload = { chapter: { ...chapter, sections: chapter.sections.map((section, index) =>
        index >= start && index < end ? { ...section } : { ...section, blocks: undefined }),
      bodyRange: { start, end, total: chapter.sections.length, complete: start === 0 && end === chapter.sections.length } } };
      return await requestHook?.({ id, start, payload, signal: options.signal }) || Response.json(payload);
    },
    offlineAssetNamesForChapter: () => [], cacheOfflineAssets: async () => 0,
    writeDownloadedChapter: async (installID, chapter) => {
      await writeHook?.(installID, chapter);
      writes.push(chapter);
      const existing = rows.get(installID) || [];
      rows.set(installID, [...existing, chapter]);
    },
    activateInstall: async record => { active = record; },
    offlineLibraryStatus: async () => ({ ...active, available: true }),
    deleteInstall: async id => { cleaned.push(id); rows.delete(id); },
    ...overrides
  });
  vm.runInContext(functions, context);
  return { context, progress, requests, writes, cleaned, rows,
    run: options => context.downloadOfflineLibrary({ onProgress: event => progress.push(event), ...options }),
    hook: value => { requestHook = value; }, writeHook: value => { writeHook = value; },
    get active() { return active; } };
}

// Real pagination and historical index selection: no summarized section is
// activated before every page has supplied that section's complete body.
{
  const grouped = { ...current(88), id: "enacted-30000095-group-001",
    codePrefix: "FC", codeVersion: identity.enactedAdministrativeSyncCodeVersion };
  const t = harness([current(33, 63), current(99, 0), historical, grouped]);
  const result = await t.run();
  assert.equal(result.chapterCount, 4); assert.equal(result.sectionCount, 65);
  assert.deepEqual(Array.from(t.writes.find(chapter => chapter.id === 33).sections, section => section.blocks[0].plainText),
    current(33, 63).sections.map(section => section.blocks[0].plainText));
  assert.equal(t.writes.find(chapter => chapter.id === historical.id).codeVersion, identity.historicalConstructionSyncCodeVersion);
  assert.equal(t.progress.at(-1).completed, 4);
  assert.equal(t.writes.find(chapter => chapter.id === grouped.id).codeVersion, identity.enactedAdministrativeSyncCodeVersion);
  assert.ok(t.progress.some(value => value.detail?.includes("25 of 63 sections")), "Large chapters report page progress before completion");
  assert.deepEqual(t.requests.filter(url => url.pathname.endsWith("/33")).map(url => Number(url.searchParams.get("bodyStart"))), [0, 25, 50]);
}

// One failure used to leave the other workers running until they overwrote the
// error with 466/467 progress. Cleanup must wait for any already-started write.
{
  const t = harness(Array.from({ length: 467 }, (_, index) => current(index + 1)));
  const writing = deferred(), releaseWrite = deferred(), failFetch = deferred();
  t.writeHook(async (_id, chapter) => { if (chapter.id === 1) { writing.resolve(); await releaseWrite.promise; } });
  t.hook(async ({ id, signal }) => {
    if (id === 2) { await failFetch.promise; return new Response("Unavailable", { status: 500 }); }
    if (id > 2) return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  });
  let settled = false;
  const pending = assert.rejects(t.run(), /500/).then(() => { settled = true; });
  await writing.promise; failFetch.resolve(); await tick();
  assert.equal(settled, false); assert.equal(t.cleaned.length, 0);
  releaseWrite.resolve(); await pending;
  assert.equal(t.requests.filter(url => /\/chapters\/\d+$/.test(url.pathname)).length, 4);
  assert.equal(t.active.installID, "previous-good-library");
  assert.equal(t.rows.size, 1, "No writes may recreate an install after cleanup");
  const count = t.progress.length; await tick(); assert.equal(t.progress.length, count);
  assert.equal(t.progress.at(-1).completed, 0, "Failure cannot be overwritten with misleading progress");
}

for (const invalid of ["missing-body", "wrong-range", "changed-order", "changed-edition"]) {
  const t = harness([current(33, 30)]);
  t.hook(({ start, payload }) => {
    if (start !== 25) return;
    if (invalid === "missing-body") delete payload.chapter.sections[start].blocks;
    if (invalid === "wrong-range") payload.chapter.bodyRange.start = 0;
    if (invalid === "changed-order") payload.chapter.sections.reverse();
    if (invalid === "changed-edition") payload.chapter.codeVersion = identity.historicalConstructionSyncCodeVersion;
  });
  await assert.rejects(t.run(), /incomplete|changed during download/);
  assert.equal(t.active.installID, "previous-good-library");
  assert.equal(t.rows.size, 1);
  assert.equal(t.writes.length, 0, "Partial chapter bodies are never committed");
  t.hook(null);
  const recovered = await t.run();
  assert.equal(recovered.sectionCount, 30, "A fresh download recovers after the failure");
}

// The deadline applies while reading a response body, not just until headers.
{
  let expire;
  const t = harness([], { setTimeout: callback => { expire = callback; return 1; }, clearTimeout() {} });
  t.context.fetch = async (_path, { signal }) => ({ ok: true,
    json: () => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })) });
  const pending = assert.rejects(t.context.fetchJSON("/fixture"), /timed out/);
  await tick(); expire(); await pending;
}
{
  const controller = new AbortController(); controller.abort(new Error("Owner canceled"));
  const t = harness([current(1)]);
  await assert.rejects(t.run({ signal: controller.signal }), /Owner canceled/);
  assert.equal(t.requests.length, 0); assert.equal(t.active.installID, "previous-good-library");
}
console.log("Offline installer recovery passed: bounded complete bodies, historical catalog, aborted peers, drained writes, durable errors, retry and response-body timeout.");
