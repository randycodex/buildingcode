import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}
function method(name, kind) {
  const root = kind === "file" ? "export function createFileStoreAdapter()" : "async function createPostgresStoreAdapter()";
  const start = source.indexOf(`    async ${name}(`, source.indexOf(root));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n    },", start) + 6);
}
const clone = value => JSON.parse(JSON.stringify(value));
const owner = "synthetic-owner";
const migrationRecords = [
  { project: { id: "p", folderType: "reference" } },
  { projectSection: { id: "s", sectionID: 99, codeVersion: "historical-edition", folderClientID: "p" } },
  { workboard: { id: "w", projectID: "p" } },
  { projectSection: { id: "deleted", deletedAt: "2026-10-12" } }
];
const excludedRecords = Array.from({ length: 5000 }, (_, index) => ({ savedItem: { id: `saved-${index}` } }));
excludedRecords.push({ annotation: { id: "note" } }, { continuity: { id: "session" } }, { codeVersionClear: { id: "clear" } });
const allRecords = [...migrationRecords, ...excludedRecords];
const artifacts = Array.from({ length: 60 }, (_, index) => ({
  envelope: { id: `note-${index}`, type: "notebookCard", version: 2, createdAt: "2026-10-11", updatedAt: "2026-10-12", archivedAt: index ? null : "2026-10-12" },
  payload: {
    cardType: "finding", title: `Synthetic ${index}`, plainText: "Exact list text ".repeat(100),
    references: [{ referenceID: "historic-source", referenceKind: "canonicalSection" }], sourceClassification: "user-authored",
    document: { blocks: Array.from({ length: 100 }, (_, block) => ({ id: `block-${block}`, type: "paragraph", content: "Synthetic full editable body ".repeat(30) })) },
    evidenceLinks: [{ id: "passage", selectedText: "Exact immutable selection ".repeat(200) }],
    imageAssets: ["image-1"], _saveReceipt: { fingerprint: "private-idempotence-receipt" }
  }
}));
artifacts.push({ envelope: { id: "null-legacy", type: "notebookCard", updatedAt: "2026-10-10" }, payload: { title: null, plainText: null, references: null, document: null } });
const projectLinks = artifacts.map(item => ({ projectID: "project", targetKind: "notebookCard", targetID: item.envelope.id }));
const serializedBefore = JSON.stringify(artifacts);
let projectionBytes = 0;
for (const kind of ["file", "postgres"]) {
  const queries = [];
  const sandbox = vm.createContext({
    Map, Set, Object,
    ensureSchema: async () => {}, migrateLegacyStateIfNeeded: async () => {},
    safeJSON: value => value,
    sql: async (strings, ...values) => {
      const sql = strings.join("?"); queries.push({ sql, values });
      if (sql.includes("AS foundation_content")) {
        assert.doesNotMatch(sql, /permitext_saved_items|permitext_annotations|continuity|codeVersionClear/);
        assert.match(sql, /permitext_projects WHERE user_id = \?/);
        assert.match(sql, /permitext_project_items WHERE user_id = \?/);
        assert.match(sql, /WHERE user_id = \? AND entity_kind = 'workboard'/);
        assert.ok(values.every(value => value === owner || value === "foreign"));
        return values[0] === owner ? migrationRecords.map(mutation => ({ mutation })) : [];
      }
      assert.match(sql, /WHERE user_id = \?/);
      const ids = values.find(Array.isArray);
      const rows = values[0] === owner ? artifacts.filter(item => !ids || ids.includes(item.envelope.id)) : [];
      if (sql.includes("payload - ARRAY")) {
        assert.match(sql, /ARRAY\['document', 'evidenceLinks', 'imageAssets', '_saveReceipt'\]::text\[\]/);
        assert.match(sql, /OR id = ANY\(\?\)/);
        return rows.map(item => sandbox.notebookListArtifact(item));
      }
      return rows;
    }
  });
  vm.runInContext(actual("notebookListArtifact"), sandbox);
  const adapter = vm.runInContext(`({${method("listFoundationMigrationMutations", kind)},${method("listFoundationArtifacts", kind)}})`, sandbox);
  adapter.read = async () => ({ mutationsByUserID: { [owner]: allRecords, foreign: [] }, foundationArtifactsByUserID: { [owner]: artifacts } });
  assert.deepEqual(clone(await adapter.listFoundationMigrationMutations(owner)), migrationRecords,
    "Migration must preserve reference Projects, historical section IDs, workboards and tombstones for the existing handler");
  assert.deepEqual(clone(await adapter.listFoundationMigrationMutations("foreign")), []);
  const ids = artifacts.map(item => item.envelope.id);
  const full = await adapter.listFoundationArtifacts(owner, { ids });
  const projected = await adapter.listFoundationArtifacts(owner, { ids, notebookSummaryOnly: true });
  assert.deepEqual(clone(full), artifacts, "Ordinary get/edit requests must retain complete documents and evidence");
  assert.deepEqual(clone(projected), artifacts.map(item => {
    const { document, evidenceLinks, imageAssets, _saveReceipt, ...payload } = item.payload;
    return { ...item, payload };
  }));
  assert.deepEqual(clone(await adapter.listFoundationArtifacts("foreign", { ids, notebookSummaryOnly: true })), []);
  const priorQueries = queries.length;
  assert.deepEqual(clone(await adapter.listFoundationArtifacts(owner, { ids: [], notebookSummaryOnly: true })), []);
  assert.equal(queries.length, priorQueries, "Empty IDs must never expand to an all-owner SQL read");
  sandbox.listStoredProjectLinks = async () => projectLinks;
  sandbox.listStoredFoundationArtifacts = (_userID, options) => adapter.listFoundationArtifacts(owner, options);
  vm.runInContext(actual("notebookCardSummariesForProject"), sandbox);
  const projectedSummary = await sandbox.notebookCardSummariesForProject(owner, "project");
  sandbox.listStoredFoundationArtifacts = () => full;
  assert.deepEqual(clone(projectedSummary), clone(await sandbox.notebookCardSummariesForProject(owner, "project")),
    "List response fields, null/missing values, reference counts, archive state and order must remain identical");
  projectionBytes = Buffer.byteLength(JSON.stringify(projected));
}
assert.equal(JSON.stringify(artifacts), serializedBefore, "Summary projection must not mutate stored editable artifacts");
assert.ok(projectionBytes < Buffer.byteLength(serializedBefore) / 10);
console.log(JSON.stringify({ syntheticNotebookCards: artifacts.length, fullArtifactBytes: Buffer.byteLength(serializedBefore), summaryArtifactBytes: projectionBytes,
  unchangedClientSummary: true, migrationRecordsBefore: allRecords.length, migrationRecordsAfter: migrationRecords.length }, null, 2));
console.log("Authenticated adapter projections passed: scoped PostgreSQL query shape, equivalent file behavior, owner filtering, empty IDs, full edit content retention, and exact Notebook list parity.");
