import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const clone = value => JSON.parse(JSON.stringify(value));
function method(name, adapter) {
  const start = source.indexOf(`    async ${name}(`, source.indexOf(adapter));
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n    },", start) + 6);
}
function actual(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}
const owner = "account-a";
const projects = [
  { project: { id: "a", archivedAt: "2026-10-01" } },
  { annotation: { id: "a", noteBody: "not a project" } },
  { project: { id: "b" } }
];
const conversation = {
  id: "selected", revision: 8, messages: [{ answer: { answerText: "Complete retained answer" } }],
  sources: [{ sourceID: "exact-source", selectedText: "Complete retained passage" }]
};
for (const kind of ["file", "postgres"]) {
  const queries = [];
  let fileReads = 0;
  const scope = vm.createContext({
    Set,
    ensureSchema: async () => {}, migrateLegacyStateIfNeeded: async () => {},
    safeJSON: value => typeof value === "string" ? JSON.parse(value) : value,
    sql: async (strings, ...values) => {
      const text = strings.join("?"); queries.push({ text, values });
      if (text.includes("permitext_projects")) {
        assert.match(text, /WHERE user_id = \? AND record_id = ANY\(\?\)/);
        assert.equal(values[0], owner);
        assert.deepEqual(Array.from(values[1]), ["a"]);
        return [{ mutation: JSON.stringify(projects[0]) }];
      }
      assert.match(text, /WHERE user_id = \? AND id = \?\s+LIMIT 1/);
      return values[0] === owner && values[1] === "selected"
        ? [{ conversation: JSON.stringify(conversation) }] : [];
    },
    researchConversationRevision: value => Number(value?.revision || 0),
    listStoredResearchConversations: () => { throw new Error("Full Research history read forbidden"); }
  });
  const start = kind === "file" ? "export function createFileStoreAdapter()" : "async function createPostgresStoreAdapter()";
  const adapter = vm.runInContext(`({${method("projectMutationsForRecordIDs", start)},${method("researchConversation", start)}})`, scope);
  adapter.read = async () => {
    fileReads++;
    return { mutationsByUserID: { [owner]: projects, other: [{ project: { id: "foreign" } }] },
      researchConversationsByUserID: { [owner]: [conversation], other: [{ id: "foreign" }] } };
  };
  scope.storeAdapter = async () => adapter;
  vm.runInContext(actual("storedResearchConversation"), scope);
  assert.deepEqual(clone(await adapter.projectMutationsForRecordIDs(owner, ["a", "a"])), [projects[0]]);
  const readsBeforeEmpty = fileReads + queries.length;
  assert.deepEqual(clone(await adapter.projectMutationsForRecordIDs(owner, [])), []);
  assert.equal(fileReads + queries.length, readsBeforeEmpty, "Empty IDs must not cause a read");
  assert.deepEqual(clone(await scope.storedResearchConversation(owner, "selected")), conversation);
  assert.equal(await scope.storedResearchConversation(owner, "missing"), null);
  assert.equal(await scope.storedResearchConversation("other", "selected"), null);
  const readsBeforeInvalidID = fileReads + queries.length;
  for (const id of [undefined, null, "", 123, {}]) {
    assert.equal(await scope.storedResearchConversation(owner, id), null);
  }
  assert.equal(fileReads + queries.length, readsBeforeInvalidID);
}

// Hidden histories stay available to explicit reads, but are not projected and
// transferred only to be discarded by the visible history endpoint.
for (const kind of ["file", "postgres"]) {
  const hidden = { ...conversation, id: "hidden", historyHiddenAt: "2026-10-08T12:00:00Z" };
  const scope = vm.createContext({
    ensureSchema: async () => {},
    safeJSON: value => value,
    projectResearchConversationForList: value => ({ id: value.id }),
    sql: async (strings, ...values) => {
      const text = strings.join("?");
      assert.match(text, /WHERE user_id = \?/);
      assert.match(text, /AND \(\? OR COALESCE\(conversation->>'historyHiddenAt', ''\) = ''\)/);
      assert.match(text, /SELECT jsonb_build_object\(/, "Retain compact list projection");
      assert.equal(values[0], owner);
      return (values.at(-1) ? [conversation, hidden] : [conversation]).map(value => ({ conversation: { id: value.id } }));
    }
  });
  const start = kind === "file" ? "export function createFileStoreAdapter()" : "async function createPostgresStoreAdapter()";
  const adapter = vm.runInContext(`({${method("listResearchConversations", start)}})`, scope);
  adapter.read = async () => ({ researchConversationsByUserID: { [owner]: [conversation, hidden] } });
  assert.deepEqual(clone(await adapter.listResearchConversations(owner, { summaryOnly: true, visibleOnly: true })), [{ id: "selected" }]);
  assert.deepEqual(clone(await adapter.listResearchConversations(owner, { summaryOnly: true })), [{ id: "selected" }, { id: "hidden" }]);
}

// Exercise the actual HTTP push handler: authentication precedes scoped reads,
// only submitted projects are loaded, and ordinary bookmark sync does not read them.
const reads = [], activity = [];
let allowed = true;
const scope = vm.createContext({
  readJSON: async request => request.body,
  maxSyncMutationsPerBatch: 100,
  validateMutations: () => ({ ok: true }),
  canonicalizeMutationBatch: async mutations => ({ mutations, aliasesByCanonicalID: {} }),
  mutationKindAndRecord: mutation => ({ kind: Object.keys(mutation)[0] }),
  normalizedMutationRecordID: mutation => Object.values(mutation)[0].id,
  syncBatchIncludesProjectMutation: mutations => mutations.some(mutation => mutation.project),
  storeAdapter: async () => ({
    projectMutationsForRecordIDs: async (userID, ids) => { reads.push({ userID, ids: Array.from(ids) }); return [projects[0]]; },
    pushUserContent: async (_userID, incoming) => ({ acceptedMutationIDs: incoming.map(item => Object.values(item)[0].id), rejectedMutationIDs: [], rejectionReasons: {}, latestEventID: 12 })
  }),
  authenticatedUserContext: async () => allowed ? {} : null,
  recordMeaningfulSyncActivity: async (...args) => activity.push(args),
  canonicalSectionIDs: async () => ({ schemaVersion: 1 }),
  includeSubmittedMutationIDAliases: values => values,
  includeSubmittedMutationReasonAliases: values => values,
  syncResponseContract: async () => ({}),
  sendJSON: (response, status, body) => Object.assign(response, { status, body }),
  readStore: () => { throw new Error("Global store read forbidden"); }
});
vm.runInContext(actual("handlePush"), scope);
const request = mutations => ({ body: { auth: { accountUserID: owner }, batch: { mutations } } });
const response = {};
await scope.handlePush(request([{ project: { id: "a" } }, { savedItem: { id: "saved" } }]), response);
assert.equal(response.status, 200);
assert.deepEqual(reads, [{ userID: owner, ids: ["a"] }]);
assert.deepEqual(activity[0][1], [projects[0]], "Archive activity retains previous state");
await scope.handlePush(request([{ savedItem: { id: "saved" } }]), {});
allowed = false;
await scope.handlePush(request([{ project: { id: "b" } }]), {});
assert.equal(reads.length, 1, "Bookmark-only and unauthorized pushes must not read projects");
console.log("Scoped sync/Research reads passed: owned submitted projects only, prior archive state retained, full selected Research content/revision preserved, missing/foreign IDs hidden, and no history/global store reads.");
