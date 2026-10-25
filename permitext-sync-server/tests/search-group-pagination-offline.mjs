import { initialSearchGroupLimit, searchSpellingSuggestions, searchVocabulary } from "../public/search-relevance.js";
import { finishLocalSearch } from "../public/downloaded-library-core.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const start = source.indexOf("async function offlineSearch(");
const fn = source.slice(start, source.indexOf("\n}", start) + 2);
const matches = [ ["BC", "2022", 8], ["BC", "2014", 6], ["MC", "2022", 3] ].flatMap(([codePrefix, codeVersion, count]) =>
  Array.from({ length: count }, (_, n) => ({ rank: 2, record: { codePrefix, codeVersion },
    result: { id: n + 1, codePrefix, sectionNumber: String(n + 1), title: "Concrete", chapterNumber: "1" } })));
let exactPattern;
const context = vm.createContext({initialSearchGroupLimit, searchSpellingSuggestions, searchVocabulary, offlineSourceScope: () => null, tokenizeSearchText: value => value.split(" "), syncCodeVersion: value => value,
  compareChapterNumbers: (left, right) => Number(left) - Number(right),
  matchingOfflineSearchResults: async (_install, options) => { exactPattern = options.exactPattern; return matches; },
  offlineSectionWithEdition: async record => record });
vm.runInContext(fn, context);
const get = params => context.offlineSearch({ installID: "offline" }, new URL(`https://local/code/search?${new URLSearchParams({ q: "concrete", version: "all", match: "exact", limit: "25", ...params })}`));
const initial = await get({ grouped: "true" });
assert.equal(initial.groups.length, 3); assert.equal(initial.results.length, 17);
assert.equal(exactPattern.test("Concrete structural walls"), true); assert.equal(exactPattern.test("concreted"), false);
for (const group of initial.groups) assert.equal(group.cursorKind, "offset");
const current = await get({ resultSource: JSON.stringify({ codePrefix: "BC", codeVersion: "2022" }), offset: "5", candidateOffset: "8" });
assert.equal(current.results.length, 3); assert.equal(current.totalResults, 8); assert.equal(current.hasMore, false);
assert.equal(current.nextOffset, 8); assert.equal(current.cursorKind, "offset");
assert(current.results.every(result => result.codePrefix === "BC" && result.codeVersion === "2022"));
assert.deepEqual(Array.from(current.results, result => result.id), [6, 7, 8]);
const historical = await get({ resultSource: JSON.stringify({ codePrefix: "BC", codeVersion: "2014" }), offset: "5" });
assert.equal(historical.results.length, 1); assert.equal(historical.results[0].codeVersion, "2014");
assert.equal(historical.results[0].id, 6); assert.equal(historical.hasMore, false);
await assert.rejects(get({ resultSource: "null" }), /Invalid search result source/);

// Broad searches must not shrink an edition's preview below five available
// matches in either offline storage path. Short editions stay exhausted.
matches.splice(0, matches.length, ...Array.from({ length: 22 }, (_, edition) =>
  Array.from({ length: edition === 21 ? 2 : 9 }, (_, n) => ({ rank: 2,
    record: { codePrefix: `C${edition}`, codeVersion: "2022" },
    result: { id: edition * 100 + n, codePrefix: `C${edition}`, codeVersion: "2022",
      sectionNumber: String(n + 1), chapterNumber: "1", title: "Concrete" }
  }))).flat());
for (const mode of ["exact", "words"]) {
  const params = { grouped: "true", match: mode };
  const stored = await get(params);
  const downloaded = finishLocalSearch(matches, new URL(`https://local/code/search?${new URLSearchParams(params)}`),
    { query: "concrete", resultSource: null });
  for (const page of [stored, downloaded]) {
    assert.equal(page.groups.length, 22);
    assert.equal(page.results.length, 107);
    for (const group of page.groups) {
      const exhausted = group.codePrefix === "C21";
      const expected = exhausted ? 2 : 5;
      assert.equal(page.results.filter(row => row.codePrefix === group.codePrefix).length, expected);
      assert.equal(group.nextOffset, expected);
      assert.equal(group.hasMore, !exhausted);
    }
  }
  assert.deepEqual(Array.from(stored.results, row => row.id), downloaded.results.map(row => row.id));
  const next = await get({ match: mode, resultSource: JSON.stringify({ codePrefix: "C0", codeVersion: "2022" }), offset: "5" });
  assert.deepEqual(Array.from(next.results, row => row.id), [5, 6, 7, 8]);
  assert.equal(next.hasMore, false);
}
console.log("Offline grouped Search passed: five-match previews in stored and downloaded libraries, exhausted short editions, independent pages, known totals, phrase boundaries, scoped offsets and malformed-source rejection.");
