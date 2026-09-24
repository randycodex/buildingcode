import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { defaultSyncCodeVersion, historicalConstructionSyncCodeVersion, syncCodeVersion } from "../public/sync-identity.js";
import { bulkClearTimestamp } from "../public/sync-state.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 2);
}
class Element {
  constructor() {
    this.children = [];
    this.classList = { add() {}, toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  setAttribute() {}
  addEventListener() {}
}
let annotations = [], clears = [], summaryReads = 0;
const state = { localAnnotations: [] };
const context = vm.createContext({
  state, defaultSyncCodeVersion, syncCodeVersion, bulkClearTimestamp,
  currentContentSummary() { summaryReads++; return { annotations }; },
  currentBulkClearRecords: () => clears,
  document: { createElement: () => new Element() },
  crypto: { randomUUID: () => "synthetic" },
  savedCodeGroupKey: item => item.codeVersion,
  codeTheme: () => "bc", codeDisplayLabel: () => "Building Code",
  wireProjectSectionMotion() {},
  sectionTitleWithoutNumber: item => item.title,
  savedEvidenceEdition: item => item.codeVersion
});
vm.runInContext([
  "normalizeAnnotationBlockID", "normalizeAnnotationTags", "annotationRecordsForTarget",
  "annotationForTarget", "renderSavedItemsByCode"
].map(actual).join("\n"), context);
const plain = value => JSON.parse(JSON.stringify(value));
const base = { sectionID: 1, codeVersion: defaultSyncCodeVersion, updatedAt: "2026-09-01T00:00:00Z" };
annotations = [
  { ...base, id: "server", noteBody: "Server tie", tags: ["server"] },
  { ...base, id: "local", noteBody: "Local tie", tags: [" Local ", "local"] },
  { ...base, id: "historical", codeVersion: historicalConstructionSyncCodeVersion, noteBody: "Historical" },
  { ...base, id: "anchor", anchorID: " paragraph ", noteBody: "Anchor alias" },
  { ...base, id: "block", sectionID: 2, contentBlockID: "paragraph", noteBody: "Block alias" },
  { ...base, id: "deleted", sectionID: 3, deletedAt: "2026-09-02", noteBody: "Must clear", tags: ["hidden"] },
  { ...base, id: "older", sectionID: 3, updatedAt: "2026-08-01", noteBody: "Older" },
  { ...base, id: "newer", sectionID: 4, updatedAt: "2026-09-03", noteBody: "Newest" },
  { ...base, id: "older4", sectionID: 4, noteBody: "Older" }
];
state.localAnnotations = [annotations[1]];
function snapshot() {
  return { annotations, localIDs: new Set(state.localAnnotations.map(item => item.id)), clearRecords: clears };
}
const targets = [base, { ...base, codeVersion: historicalConstructionSyncCodeVersion },
  { ...base, blockID: "paragraph" }, { ...base, sectionID: 2, blockID: "paragraph" },
  { ...base, sectionID: 3 }, { ...base, sectionID: 4 }];
for (const target of targets) {
  assert.deepEqual(plain(context.annotationForTarget(target, "", "", snapshot())), plain(context.annotationForTarget(target)));
}
assert.equal(context.annotationForTarget(base).noteBody, "Local tie");
assert.equal(context.annotationForTarget(targets[1]).noteBody, "Historical");
assert.equal(context.annotationForTarget(targets[2]).noteBody, "Anchor alias");
assert.equal(context.annotationForTarget(targets[3]).noteBody, "Block alias");
assert.equal(context.annotationForTarget(targets[4]).noteBody, "");
assert.equal(context.annotationForTarget(targets[5]).noteBody, "Newest");
clears = ["notes", "tags"].map(scope => ({ codeVersion: defaultSyncCodeVersion, values: { scope }, updatedAt: "2026-09-04T00:00:00Z" }));
assert.deepEqual(plain(context.annotationForTarget(base, "", "", snapshot())), { noteBody: "", tags: [] });
assert.deepEqual(plain(context.annotationForTarget(base)), { noteBody: "", tags: [] });

const items = Array.from({ length: 48 }, (_, index) => ({ ...base, id: `saved-${index}`, title: "Synthetic section", sectionNumber: "101.1" }));
summaryReads = 0;
for (const item of items) context.annotationForTarget(item);
assert.equal(summaryReads, 48, "Default independent lookups still consult current state");
summaryReads = 0;
context.renderSavedItemsByCode(new Element(), items);
assert.equal(summaryReads, 1, "One synchronous Saved render takes one summary snapshot for48rows");

// A second render must take a new snapshot, including another account's state.
annotations = [{ ...base, id: "account-b", noteBody: "Account B current note" }];
clears = [];
state.localAnnotations = [];
const nextContent = new Element();
context.renderSavedItemsByCode(nextContent, items);
assert.equal(summaryReads, 2);
function text(node) { return [node.textContent || "", ...node.children.map(text)].join("\n"); }
assert.equal((text(nextContent).match(/Account B current note/g) || []).length, 48);
assert.doesNotMatch(text(nextContent), /Local tie|Server tie/);
assert.match(actual("renderSavedItemsByCode"), /^function renderSavedItemsByCode/);
assert.match(actual("renderSavedItemsByCode"), /const annotationSnapshot =/);
console.log("Saved annotation render passed: snapshot/default parity, edition/block aliases, newest/local ties, deletion/bulk clears,48to1summary reads and fresh account state per render.");
