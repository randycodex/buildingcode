import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
// Reference keeps the original per-comparison locale work and catalog reads.
function previousSort(items, mode) {
  return [...items].sort((left, right) => {
    if (mode === "recentlySaved") {
      const order = Date.parse(right.bookmarkedAt || right.createdAt || right.updatedAt || 0) - Date.parse(left.bookmarkedAt || left.createdAt || left.updatedAt || 0);
      if (Number.isFinite(order) && order) return order;
    } else if (mode === "codeBook") {
      const order = codeDisplayLabel(left.codePrefix || left.code || "BC").localeCompare(codeDisplayLabel(right.codePrefix || right.code || "BC"), undefined, { numeric: true, sensitivity: "base" });
      if (order) return order;
    } else if (mode === "title") {
      const order = savedItemTitle(left).localeCompare(savedItemTitle(right), undefined, { numeric: true, sensitivity: "base" });
      if (order) return order;
    }
    return compareSavedCodeOrder(left, right);
  });
}
let catalogReads = 0;
let prefixes = ["BC", "MC", "PC", "ZONING"];
const context = vm.createContext({
  searchCodeFilterOptions: () => { catalogReads++; return prefixes.map(prefix => ({ prefix })); },
  codeDisplayLabel: prefix => ({ BC: "Building", MC: "Mechanical", PC: "Plumbing", ZONING: "Zoning" })[prefix] || prefix,
  savedItemTitle: item => item.title || "Section"
});
vm.runInContext(["compareSavedCodeOrder", "sortSavedItems"].map(actual).join("\n") + previousSort.toString(), context);
const ids = rows => Array.from(rows, row => row.id);
const varied = [
  { id: "numeric-10", sectionNumber: "10.2", chapterNumber: "10", title: "Café 10" },
  { id: "numeric-2", sectionNumber: "2.2", chapterNumber: "2", title: "cafe 2" },
  { id: "historical", sectionNumber: "2.2", chapterNumber: "2", title: "CAFE 2", codeVersion: "2014", updatedAt: "invalid" },
  { id: "plumbing", sectionNumber: "10", chapterNumber: "2", title: "Álpha", codePrefix: "PC", updatedAt: "2026-10-01" },
  { id: "unknown", sectionID: 1234, codePrefix: "UNKNOWN", title: "alpha", createdAt: "2026-10-05" },
  { id: "fallback", sectionID: 234, chapterID: "chapter-2", code: "MC", bookmarkedAt: "2026-10-06" },
  { id: "empty" }
];
for (const mode of ["codeOrder", "recentlySaved", "codeBook", "title"]) {
  assert.deepEqual(ids(context.sortSavedItems(varied, mode)), ids(context.previousSort(varied, mode)), mode);
}
const original = structuredClone(varied);
context.sortSavedItems(varied, "codeOrder");
assert.deepEqual(varied, original, "Sorting must not mutate source identities");
prefixes = ["PC", "BC", "MC", "ZONING"];
assert.equal(context.sortSavedItems(varied, "codeOrder")[0].id, "plumbing", "Each sort uses a fresh active-source ordering");
for (const count of [1000, 5000]) {
  const records = Array.from({ length: count }, (_, index) => ({ id: index, codePrefix: prefixes[index % prefixes.length], chapterNumber: String(index % 33), sectionNumber: `${(index * 683) % count}.2`, title: `Section ${index}` }));
  catalogReads = 0;
  let start = performance.now();
  const expected = context.previousSort(records, "codeOrder");
  const beforeMS = performance.now() - start;
  const beforeReads = catalogReads;
  catalogReads = 0;
  start = performance.now();
  const actual = context.sortSavedItems(records, "codeOrder");
  const afterMS = performance.now() - start;
  assert.deepEqual(ids(actual), ids(expected));
  assert.equal(catalogReads, 1);
  assert.ok(beforeReads > count);
  console.log(JSON.stringify({ savedRows: count, beforeMS: +beforeMS.toFixed(2), afterMS: +afterMS.toFixed(2), beforeCatalogReads: beforeReads, afterCatalogReads: catalogReads }));
}
console.log("Saved sorting passed: numeric and accented labels, historical ties, missing metadata, recency, immutable records, live source ordering and exact previous-order parity.");
