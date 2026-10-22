import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { defaultSyncCodeVersion, historicalConstructionSyncCodeVersion, syncCodeVersion } from "../public/sync-identity.js";
import { annotationAfterBulkClears, bulkClearKey, bulkClearTimestamp, indexBulkClears, mergeNewestRecord, recordSurvivesBulkClear } from "../public/sync-state.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}

// The previous unindexed implementation is retained solely as a parity and
// matched-workload timing reference. Both paths execute the current merger.
function previousConsolidation(annotations = []) {
  const latestByTarget = new Map();
  annotations.forEach((annotation) => {
    if (!annotation || annotation.deletedAt || !annotation.sectionID) return;
    const blockID = normalizeAnnotationBlockID(annotation.blockID || annotation.anchorID || annotation.contentBlockID);
    const key = [syncCodeVersion(annotation.codeVersion), annotation.sectionID, blockID].map(String).join(":");
    const existing = latestByTarget.get(key);
    if (!existing || Date.parse(annotation.updatedAt || 0) >= Date.parse(existing.updatedAt || 0)) {
      latestByTarget.set(key, { ...annotation, blockID, codeVersion: syncCodeVersion(annotation.codeVersion) });
    }
  });
  return Array.from(latestByTarget.values()).flatMap((annotation) => {
    const merged = annotationForTarget(annotation);
    if (!annotationEvidenceIsVisible(merged)) return [];
    return [{ ...annotation, ...merged, blockID: annotation.blockID, codeVersion: annotation.codeVersion, savedColumnKind: "annotation" }];
  });
}

const state = { localAnnotations: [], localSavedItems: [], localProjectSections: [], localBulkClears: [], syncConflicts: [], syncOutbox: [] };
let annotations = [], clears = [], summaryReads = 0;
const context = vm.createContext({
  state, defaultSyncCodeVersion, syncCodeVersion,
  annotationAfterBulkClears, bulkClearKey, bulkClearTimestamp, indexBulkClears, mergeNewestRecord, recordSurvivesBulkClear,
  activeAccount: () => ({ userID: "synthetic-a" }),
  syncedContent: { userID: "synthetic-a", summary: {} },
  currentContentSummary() { summaryReads++; return { annotations }; },
  currentBulkClearRecords: () => clears
});
vm.runInContext([
  "normalizeAnnotationBlockID", "normalizeAnnotationTags", "annotationRecordsForTarget",
  "annotationForTarget", "annotationEvidenceIsVisible", "consolidatedSavedAnnotations",
  "savedEvidenceKey", "safeAnnotationIDPart"
].map(actual).join("\n") + "\n" + previousConsolidation.toString(), context);
const plain = value => JSON.parse(JSON.stringify(value));
const base = { sectionID: 101, codeVersion: defaultSyncCodeVersion, updatedAt: "2026-09-01T00:00:00Z" };
annotations = [
  { ...base, id: "server", noteBody: "Server tie", tags: ["SERVER"] },
  { ...base, id: "local", noteBody: "Local tie", tags: [" Local ", "local"] },
  { ...base, id: "historical", codeVersion: historicalConstructionSyncCodeVersion, noteBody: "Historical" },
  { ...base, id: "anchor", anchorID: " paragraph ", noteBody: "Anchor alias" },
  { ...base, id: "content-block", contentBlockID: "table", tags: ["Table"] },
  { ...base, id: "older-deleted", sectionID: 102, noteBody: "Older deleted note" },
  { ...base, id: "deleted", sectionID: 102, updatedAt: "2026-09-02", deletedAt: "2026-09-02" },
  { ...base, id: "older", sectionID: 103, noteBody: "Older" },
  { ...base, id: "newer", sectionID: 103, updatedAt: "2026-09-03", noteBody: "Newest" }
];
state.localAnnotations = [annotations[1]];
function parity(input = annotations) {
  const expected = plain(context.previousConsolidation(input));
  summaryReads = 0;
  const actual = plain(context.consolidatedSavedAnnotations(input));
  assert.deepEqual(actual, expected);
  assert.equal(summaryReads, input.length ? 1 : 0, "Each nonempty synchronous consolidation takes one fresh authoritative snapshot");
  return actual;
}
const rows = parity();
assert.equal(rows.find(row => row.id === "local").noteBody, "Local tie");
assert.equal(rows.find(row => row.id === "historical").noteBody, "Historical");
assert.equal(rows.find(row => row.id === "anchor").blockID, "paragraph");
assert.equal(rows.find(row => row.id === "content-block").blockID, "table");
assert.ok(!rows.some(row => row.sectionID === 102));
assert.equal(rows.find(row => row.sectionID === 103).noteBody, "Newest");
parity([annotations[0], { ...base, sectionID: 999, noteBody: "Untrusted input text" }]);
clears = ["notes", "tags"].map(scope => ({ codeVersion: defaultSyncCodeVersion, values: { scope }, updatedAt: "2026-09-04" }));
assert.deepEqual(parity().map(row => row.id), ["historical"]);
annotations = [{ ...base, id: "next-account", noteBody: "Next account" }];
state.localAnnotations = [];
clears = [];
assert.deepEqual(parity().map(row => row.noteBody), ["Next account"]);
parity([]);

// Benchmark the actual summary reconstruction as well as consolidation. Keep
// timings informational; deterministic work counts and output equality gate it.
vm.runInContext(actual("currentContentSummary").replace("function currentContentSummary(", "function buildSummary("), context);
let summaryBuilds = 0;
context.currentContentSummary = () => { summaryBuilds++; return context.buildSummary(); };
const count = 1000;
context.syncedContent.summary = {
  projects: [], projectSections: [], codeVersionClears: [],
  savedItems: Array.from({ length: count }, (_, index) => ({ ...base, id: `saved-${index}`, sectionID: index + 1 })),
  annotations: Array.from({ length: count }, (_, index) => ({ ...base, id: `note-${index}`, sectionID: index + 1, noteBody: `Synthetic note ${index}`, tags: ["fixture"] }))
};
state.localAnnotations = context.syncedContent.summary.annotations.slice(0, 100).map(row => ({ ...row, noteBody: `Local ${row.noteBody}`, updatedAt: "2026-09-02" }));
const input = context.buildSummary().annotations;
function measure(name) {
  summaryBuilds = 0;
  const started = performance.now();
  const rows = plain(context[name](input));
  return { rows, elapsedMS: performance.now() - started, summaryBuilds };
}
const before = measure("previousConsolidation");
const after = measure("consolidatedSavedAnnotations");
assert.deepEqual(after.rows, before.rows);
assert.equal(before.summaryBuilds, count);
assert.equal(after.summaryBuilds, 1);
const hydrationStart = source.indexOf("async function performSavedPanelHydration(");
const hydrationEnd = source.indexOf("\nfunction hydrateSavedPanel(", hydrationStart);
assert.equal((source.slice(hydrationStart, hydrationEnd).match(/consolidatedSavedAnnotations\(/g) || []).length, 1, "Saved hydration reuses consolidated annotations within its synchronous preparation");
console.log(JSON.stringify({ workload: "1,000 saved passages + 1,000 annotations + 100 local overlays", identicalRows: after.rows.length, beforeMS: +before.elapsedMS.toFixed(2), afterMS: +after.elapsedMS.toFixed(2), beforeSummaryBuilds: before.summaryBuilds, afterSummaryBuilds: after.summaryBuilds }));
console.log("Saved annotation consolidation passed: same-edition/block identity, newest/local ties, tombstones, bulk clears, fresh snapshots, authoritative subset resolution and matched-workload parity.");
