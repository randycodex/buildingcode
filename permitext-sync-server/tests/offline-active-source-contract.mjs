import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { validatedOfflineCodeSources, offlineSourceIdentity, offlineSourceScope, offlineSectionMetadata } from "../public/offline-storage.js";
const edition = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const historical = "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1";
const a = { canonicalEdition: edition, jurisdictionID: 1, codeID: 1, categoryID: 1, codePrefix: "BC" };
const b = { ...a, canonicalEdition: historical, categoryID: 2 };
const c = { ...a, categoryID: 4, codePrefix: "FGC" };
const metadata = { installID: "kept", codeSources: [a, b, c] };
const record = { id: 10, chapterID: 2, codeVersion: edition, codeSectionID: 1, codePrefix: "BC", title: "Concrete" };
const url = sources => new URL("https://local/code/search?q=concrete&sourceScope=" + encodeURIComponent(JSON.stringify({ version: 1, enabledSources: sources })));
const scope = offlineSourceScope(metadata, url([b]));
assert.equal(scope.permits(record), false);
assert.equal(scope.permits({ ...record, codeVersion: historical, codeSectionID: 2 }), true);
assert.throws(() => scope.permits({ ...record, codeVersion: historical }), /identity/);
assert.throws(() => scope.permits({ ...record, codeVersion: "" }), /identity/);
assert.equal(offlineSourceIdentity({ ...record, codeVersion: "" }, metadata.codeSources), null);
assert.equal(offlineSourceScope({}, new URL("https://local/code/search")), null);
assert.equal(offlineSourceScope({}, url([])).isEmpty, true);
assert.throws(() => offlineSourceScope({ codeSources: [] }, url([a])), /metadata/);
assert.throws(() => validatedOfflineCodeSources([a, a]), /invalid/);
assert.throws(() => validatedOfflineCodeSources([{ ...a, categoryID: "1" }]));
assert.throws(() => offlineSourceScope(metadata, url([{ ...a, categoryID: 999 }])));
assert.equal(offlineSourceScope(metadata, url([])).isEmpty, true);
const protectedRecord = { ...record };
for (const key of ["blocks", "plainText", "searchText"]) Object.defineProperty(protectedRecord, key, { get() { throw new Error("Body read"); } });
assert.deepEqual(Object.keys(offlineSectionMetadata(protectedRecord, metadata)).sort(),
  ["id", "sectionID", "webSectionID", "chapterID", "codePrefix", "codeVersion", "codeSectionID", "chapterNumber", "sectionNumber", "title", "codeSource"].sort());
assert.throws(() => offlineSectionMetadata(protectedRecord, metadata, [historical]), /requested code edition/);
for (const versions of [[""], [" "], [edition, edition], ["2022"]]) assert.throws(() => offlineSectionMetadata(protectedRecord, metadata, versions));
assert.equal(offlineSectionMetadata(protectedRecord, metadata, [edition]).codeSource.canonicalEdition, edition);
const ambiguous = { codeSources: [a, { ...a, jurisdictionID: 2 }] };
assert.throws(() => offlineSourceScope(ambiguous, url([a])).permits(record), /identity/);
assert.equal(metadata.installID, "kept");
// Execute the actual IndexedDB cursor matcher with a disabled record whose text
// fields throw. Cursor deserialization itself is outside this contract.
const text = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const start = text.indexOf("async function matchingOfflineSearchResults(");
const end = text.indexOf("\nasync function sectionByIdentity", start);
const request = {};
let closed = false;
const context = vm.createContext({
  sectionsStoreName: "sections",
  openDatabase: async () => ({ transaction: () => ({ objectStore: () => ({ index: () => ({ openCursor: () => {
    queueMicrotask(() => { request.result = { value: protectedRecord, continue() { request.result = null; request.onsuccess(); } }; request.onsuccess(); });
    return request;
  } }) }) }), close() { closed = true; } }),
  IDBKeyRange: { only: value => value }, searchSnippet() { throw new Error("Disabled snippet read"); }
});
vm.runInContext(text.slice(start, end) + "\nthis.match = matchingOfflineSearchResults;", context);
assert.equal((await context.match("kept", { codeFilter: new Set(), normalizedQuery: "concrete", query: "concrete", tokens: ["concrete"], sourceScope: scope })).length, 0);
assert.equal(closed, true);
const searchStart = text.indexOf("async function offlineSearch(metadata, url)");
const searchEnd = text.indexOf("\nexport async function offlineAPI", searchStart);
const emptyContext = vm.createContext({ offlineSourceScope,
  matchingOfflineSearchResults() { throw new Error("Empty scope opened cursor"); } });
vm.runInContext(text.slice(searchStart, searchEnd) + "\nthis.search = offlineSearch;", emptyContext);
assert.equal((await emptyContext.search(metadata, url([]))).results.length, 0);
assert.equal((await emptyContext.search({ installID: "legacy" }, url([]))).results.length, 0);
console.log("Offline active sources passed: legacy unscoped preserved, explicit missing/corrupt fails closed, exact edition/category match, no disabled text access, metadata body whitelist.");
