import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { cacheRetryablePromise } from "../public/client-reliability.js";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
const manifest = {
  id: "chapter-a", codePrefix: "BC", codeVersion: "2022", bodyContract: 2, corpusRevision: "revision-a",
  sections: Array.from({length: 12}, (_, id) => ({id, title: `Section ${id}`}))
};
function windowFor(chapter, start = 4, limit = 3) {
  const end = Math.min(chapter.sections.length, start + limit);
  return { ...chapter, groups: undefined, bodyRange: {start, end, total: chapter.sections.length},
    sections: chapter.sections.slice(start, end).map(section => ({id: section.id, blocks: [{id: `b${section.id}`, text: "Enacted text"}]})) };
}
let responses = [], calls = [];
const chapterCache = new Map();
const context = vm.createContext({ URLSearchParams, chapterCache, cacheRetryablePromise, readerProgressiveSectionBatchSize: 5,
  api: async url => { calls.push(url); const response = responses.shift(); if (response instanceof Error) throw response; return { chapter: response }; } });
vm.runInContext(["validateChapterBodyWindow", "fetchChapterBodyWindow", "readerSectionWithWindowBody"].map(actual).join("\n"), context);
const valid = windowFor(manifest);
assert.equal(context.validateChapterBodyWindow(manifest, valid, 4, 3), valid);
const merged = context.readerSectionWithWindowBody(manifest.sections[4], valid);
assert.equal(merged.title, "Section 4");
assert.equal(merged.blocks[0].id, "b4");
for (const mutation of [
  value => { value.codeVersion = "2014"; }, value => { value.corpusRevision = "revision-b"; },
  value => { value.id = "chapter-b"; }, value => { value.codePrefix = "MC"; },
  value => { value.bodyRange.start = 3; }, value => { value.bodyRange.total = 13; },
  value => { value.sections.reverse(); }, value => { value.sections.pop(); },
  value => { delete value.sections[0].blocks; }, value => { value.bodyContract = 1; }
]) {
  const invalid = structuredClone(valid); mutation(invalid);
  assert.throws(() => context.validateChapterBodyWindow(manifest, invalid, 4, 3), /Chapter changed/);
}
// Zero-body headings are valid, but a missing section cannot silently render blank text.
const heading = structuredClone(valid); heading.sections[0].blocks = [];
assert.equal(context.validateChapterBodyWindow(manifest, heading, 4, 3), heading);
// Legacy servers remain supported only with a legacy manifest.
const legacy = { id: manifest.id, sections: manifest.sections };
assert.equal(context.validateChapterBodyWindow(legacy, legacy, 4, 3), legacy);
assert.throws(() => context.validateChapterBodyWindow(manifest, legacy, 4, 3));
assert.throws(() => context.validateChapterBodyWindow(legacy, valid, 4, 3));
responses = [valid];
await context.fetchChapterBodyWindow(manifest.id, 4, 3, manifest);
await context.fetchChapterBodyWindow(manifest.id, 4, 3, manifest);
assert.equal(calls.length, 1, "Identical current-revision request shares cached result");
assert.match(calls[0], /bodyContract=2/);
const updated = {...manifest, corpusRevision: "revision-b"};
responses = [windowFor(updated)];
await context.fetchChapterBodyWindow(updated.id, 4, 3, updated);
assert.equal(calls.length, 2, "New corpus revision cannot reuse old body cache");
// A mismatch invalidates the cached manifest and windows, but unrelated chapters survive.
chapterCache.set("chapter-a:summary", Promise.resolve(manifest));
chapterCache.set("chapter-other:summary", Promise.resolve({id:"chapter-other"}));
responses = [windowFor(updated, 0, 3)];
await assert.rejects(context.fetchChapterBodyWindow(manifest.id, 0, 3, manifest), /Chapter changed/);
assert.equal(chapterCache.has("chapter-a:summary"), false);
assert.equal(chapterCache.has("chapter-other:summary"), true);
responses = [new Error("offline"), valid];
await assert.rejects(context.fetchChapterBodyWindow(manifest.id, 4, 3, manifest), /offline/);
await context.fetchChapterBodyWindow(manifest.id, 4, 3, manifest);
assert.equal(responses.length, 0, "Network failure remains retryable");
// Returning from full-chapter search uses already complete bodies without transport.
const complete = { ...manifest, bodyRange: {start:0, end:12, total:12, complete:true},
  sections: manifest.sections.map(section => ({...section, blocks: [{id:`full-${section.id}`,text:"Complete body"}]})) };
const beforeCalls = calls.length;
const localWindow = await context.fetchChapterBodyWindow(manifest.id, 4, 3, complete);
assert.equal(calls.length, beforeCalls);
assert.equal(localWindow.sections[0].blocks[0].id, "full-4");
assert.deepEqual(Array.from(localWindow.sections, section => section.id), [4,5,6]);
console.log("Chapter body client contract passed: edition/revision/range/order validation, cache isolation, retry, legacy fallback and body merge.");
