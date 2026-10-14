import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { notebookDraftSaveTitle } from "../public/offline-storage.js";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = app.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return app.slice(start, end + 2);
}
let generation = 1;
let releaseDrafts;
let draftRead = async () => structuredClone(drafts);
const identity = { userID: "owner", generation: 1 };
const drafts = [
  { accountUserID: "owner", projectID: "older-project", cardID: "project-information", scope: "collaboration-note", title: "Project information", baseVersion: 2 },
  { accountUserID: "other", projectID: "private-other", cardID: "foreign", scope: "notebook-card", title: "Other account's private title", baseVersion: 1 }
];
const state = { syncOutbox: [
  { accountUserID: "owner", recordID: "owned-project", mutation: { project: { name: "Owned project change", projectID: "older-project" } }, lastError: "Request timed out" },
  { accountUserID: "other", recordID: "foreign", mutation: { project: { name: "Foreign project" } } }
] };
const before = structuredClone({ drafts, state });
let notice;
function element(tag) {
  return { tag, dataset: {}, children: [], attributes: {},
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}
const context = vm.createContext({
  state, Number, String, notebookDraftSaveTitle,
  captureAccountRequest: () => identity,
  requireCurrentAccountRequest: value => {
    if (value.generation !== generation) throw new Error("Account context changed");
  },
  isCurrentAccountRequest: value => value.generation === generation,
  pendingNotebookDrafts: () => draftRead(),
  currentContentSummary: () => ({ projects: [{ id: "older-project", name: "Older project" }] }),
  projectRecordID: value => value.id,
  mutationKindAndRecord: mutation => ({ kind: Object.keys(mutation)[0], record: Object.values(mutation)[0] }),
  notebookDocumentAssetURLs: document => document?.localImage ? ["permitext-notebook-local:image"] : [],
  document: { createElement: element },
  showWebNotice: async (...args) => { notice = args; }
});
vm.runInContext(["pendingNotebookDraftReason", "pendingSyncItems", "openPendingSyncDetails"].map(actual).join("\n"), context);
const items = await context.pendingSyncItems();
assert.equal(items.length, 2, "Only this account's pending records may appear.");
assert.equal(items[0].reason, "Request timed out");
assert.equal(items[1].project, "Older project", "Resolve a draft's Project even when it is not the open Project.");
assert.match(items[1].reason, /skipping.*Project information/);
assert.equal(items[1].id, "project-information");
await context.openPendingSyncDetails();
assert.equal(notice[0], "Pending changes");
assert.equal(notice[2].content.children[1].dataset.pendingProjectId, "older-project");
assert.equal(notice[2].content.children[1].dataset.pendingDraftScope, "collaboration-note");
assert.equal(notice[2].content.children[1].children[0].textContent, "Project information");
assert.deepEqual({ drafts, state }, before, "Inspecting pending changes must not alter, delete, or replay saved work.");
const reason = draft => context.pendingNotebookDraftReason({ scope: "notebook-card", title: "Named Note", baseVersion: 0, ...draft });
assert.match(reason({ title: " " }), /title or content/);
assert.match(reason({ title: " ", document: { text: "Authored content" } }), /waiting to save/);
assert.match(reason({ pendingSave: { baseVersion: 0, title: "" } }), /retained save.*needs review/);
assert.match(reason({ baseVersion: undefined }), /saved version is missing/);
assert.match(reason({ document: { localImage: true } }), /image.*upload/);
assert.match(reason({ recoveryConflict: true }), /versions need review/);
assert.match(reason({ pendingSave: { baseVersion: 7, title: "Original receipt" } }), /acknowledgement/);
assert.match(reason({ scope: "unrecognized" }), /older draft format/);
const label = { textContent: "", scrollWidth: 120 };
const badge = { ...element("span"), style: {}, classList: { toggle() {} },
  querySelector: () => label, removeAttribute(name) { delete this.attributes[name]; },
  get textContent() { return label.textContent; }
};
Object.assign(context, { connectionStatus: badge, activeAccount: () => ({ userID: "owner" }),
  notebookPendingDraftCount: 0, navigator: { onLine: true }, serverReachable: true,
  syncFlushPromise: null, foregroundSyncPromise: null, updateTopbarPlanBadge() {} });
vm.runInContext(actual("updateConnectionStatus"), context);
context.updateConnectionStatus();
assert.equal(badge.attributes.role, "button");
assert.equal(label.textContent, "Changes pending · 1");
assert.match(badge.attributes['aria-label'], /Review pending changes/);
context.navigator.onLine = false;
context.updateConnectionStatus();
assert.equal(badge.attributes.role, "status", "The offline badge must not imply that review itself restores connectivity.");
context.navigator.onLine = true;
draftRead = () => new Promise(resolve => { releaseDrafts = resolve; });
notice = null;
const stale = context.openPendingSyncDetails();
generation = 2;
releaseDrafts(drafts);
await stale;
assert.equal(notice, null, "A delayed draft read must not expose the old account's data after an account switch.");
console.log("Pending sync details passed: exact Project/item/reason, owner isolation, immutable inspection, blocker classification and stale-account guard.");
