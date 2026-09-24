import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReaderSearchIndex } from "../reader-search-index.mjs";

const root = await mkdtemp(join(tmpdir(), "permitext-reader-search-"));
const chapter = { id: "bc-33", codeVersion: "2022", corpusRevision: "revision-one", sections: [{ id: "s1" }, { id: "s2" }] };
const fixture = () => ({ schemaVersion: 1, chapterID: chapter.id, codeVersion: chapter.codeVersion,
  corpusRevision: chapter.corpusRevision, projectionRevision: "a".repeat(64), sections: [
    { id: "s1", sectionNumber: "1", title: "Walls", displayTitle: "1 Walls", blocks: [{ blockID: "p1", text: "Concrete and masonry walls." }] },
    { id: "s2", sectionNumber: "2", title: "Materials", displayTitle: "2 Materials", blocks: [{ blockID: "p2", text: "HAZARDOUS MATERIALS. The definition." }] }
  ] });
const save = (value, id = chapter.id) => writeFile(join(root, `${id}.json.gz`), gzipSync(typeof value === "string" ? value : JSON.stringify(value)));
const expectCode = (operation, code) => assert.rejects(operation, (error) => error.code === code);
try {
  await save(fixture());
  let reads = 0;
  const loader = createReaderSearchIndex({ readIndex: async (...args) => { reads++; return readFile(...args); } });
  const search = (query) => loader.searchIndexedReaderChapter(chapter, query, { root });
  const [exact, fuzzy] = await Promise.all([search(" concrete "), search("harzadous materials")]);
  assert.equal(reads, 1, "concurrent reads coalesce");
  assert.equal(exact.query, "concrete");
  assert.equal(exact.total, 1);
  assert.equal(exact.results[0].blockID, "p1");
  assert.equal(exact.results[0].sectionID, "s1");
  assert.equal(fuzzy.results[0].blockID, "p2");
  assert.equal((await search("zzzzzzzzzz")).total, 0);
  assert.equal((await search("x")).total, 0);
  assert.equal(reads, 1, "warm query reuses index");
  for (const [mutate, code] of [
    [(x) => { x.chapterID = "wrong"; }, "READER_SEARCH_INDEX_STALE"],
    [(x) => { x.codeVersion = "2014"; }, "READER_SEARCH_INDEX_STALE"],
    [(x) => { x.corpusRevision = "old"; }, "READER_SEARCH_INDEX_STALE"],
    [(x) => { x.sections.reverse(); }, "READER_SEARCH_INDEX_INVALID"],
    [(x) => { x.sections.pop(); }, "READER_SEARCH_INDEX_INVALID"],
    [(x) => { x.sections[0].blocks[0].text = 1; }, "READER_SEARCH_INDEX_INVALID"],
    [(x) => { x.sections[0].blocks[0].blockID = ""; }, "READER_SEARCH_INDEX_INVALID"],
    [(x) => { x.projectionRevision = ""; }, "READER_SEARCH_INDEX_INVALID"],
    [(x) => { x.schemaVersion = 2; }, "READER_SEARCH_INDEX_INVALID"]
  ]) {
    const bad = fixture(); mutate(bad); await save(bad);
    const isolated = createReaderSearchIndex();
    await expectCode(() => isolated.searchIndexedReaderChapter(chapter, "concrete", { root }), code);
    assert.equal(isolated.cacheStats().entries, 0, "failed validation evicts");
    await save(fixture());
    assert.equal((await isolated.searchIndexedReaderChapter(chapter, "concrete", { root })).total, 1, "repaired file retries");
  }
  await writeFile(join(root, `${chapter.id}.json.gz`), "not gzip");
  await expectCode(() => createReaderSearchIndex().searchIndexedReaderChapter(chapter, "concrete", { root }), "READER_SEARCH_INDEX_INVALID");
  await save("{");
  await expectCode(() => createReaderSearchIndex().searchIndexedReaderChapter(chapter, "concrete", { root }), "READER_SEARCH_INDEX_INVALID");
  await expectCode(() => loader.searchIndexedReaderChapter({ ...chapter, id: "../escape" }, "concrete", { root }), "READER_SEARCH_INDEX_INVALID");
  await expectCode(() => loader.searchIndexedReaderChapter({ ...chapter, id: "missing" }, "concrete", { root }), "READER_SEARCH_INDEX_MISSING");
  await save(fixture());
  await save({ ...fixture(), chapterID: 33 }, "33");
  assert.equal((await loader.searchIndexedReaderChapter({ ...chapter, id: 33 }, "concrete", { root })).total, 1);
  assert.equal((await loader.searchIndexedReaderChapter({ ...chapter, id: "33" }, "concrete", { root })).total, 1);
  const tiny = createReaderSearchIndex({ maxBytes: 1 });
  assert.equal((await tiny.searchIndexedReaderChapter(chapter, "concrete", { root })).total, 1);
  assert.equal(tiny.cacheStats().entries, 0, "oversized indexes are not retained");
  const lru = createReaderSearchIndex({ maxEntries: 1 });
  await lru.searchIndexedReaderChapter(chapter, "concrete", { root });
  await save({ ...fixture(), chapterID: "bc-34" }, "bc-34");
  await lru.searchIndexedReaderChapter({ ...chapter, id: "bc-34" }, "concrete", { root });
  assert.equal(lru.cacheStats().entries, 1);
  assert.ok(lru.cacheStats().estimatedBytes <= 16 * 1024 * 1024);
  assert.equal(lru.cacheStats().inflight, 0);
  console.log("Reader search index contract passed: matching, identity, completeness, failure recovery, coalescing, and bounded cache.");
} finally { await rm(root, { recursive: true, force: true }); }
