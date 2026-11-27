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
  state, Number, String, notebookDraftSaveTitle, Event, window: new EventTarget(), notebookPendingDraftCount: 1,
  schedulePendingNotebookRetry() {},
  captureAccountRequest: () => identity,
  requireCurrentAccountRequest: value => {
    if (value.generation !== generation) throw new Error("Account context changed");
  },
  isCurrentAccountRequest: value => value.generation === generation,
  pendingNotebookDrafts: () => draftRead(),
  currentContentSummary: () => ({ projects: [{ id: "older-project", name: "Older project" }] }),
  projectRecordID: value => value.id,
  researchProjectID: value => value.id,
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
let now = Date.parse("2026-10-14T18:00:00Z"), scheduledAttention = null;
Object.assign(context, { projectUpdateAutoApplyReady:false, detachedProjectWindow:false, renderProjectUpdateBadge() {}, connectionStatus: badge, activeAccount: () => ({ userID: "owner" }),
  notebookPendingDraftCount: 0, notebookPendingDraftAttentionAt: Infinity, connectionStatusAttentionTimer: null,
  Date: { now: () => now, parse: Date.parse },
  window: Object.assign(context.window, {setTimeout(callback, delay) { scheduledAttention = { callback, delay }; return 1; }}),
  clearTimeout() { scheduledAttention = null; },
  navigator: { onLine: true }, serverReachable: true,
  workspaceProject: () => ({ id: "older-project" }), workspacePrivatePresentationAllowed: () => true,
  syncedContent: { workspacePresentationAccess: "verified" },
  syncFlushPromise: null, foregroundSyncPromise: null, updateReaderPlanControls() {} });
vm.runInContext(["pendingSyncAttentionAt", "updateConnectionStatus", "refreshNotebookPendingStatus"].map(actual).join("\n"), context);
state.syncOutbox = [];
context.updateConnectionStatus();
assert.equal(badge.dataset.state, "clean");
assert.equal(badge.attributes["aria-hidden"], "true", "A synced project keeps the toolbar quiet.");
assert.equal(label.textContent, "");
state.syncOutbox = structuredClone(before.state.syncOutbox);
context.updateConnectionStatus();
assert.equal(badge.attributes.role, "button");
assert.equal(label.textContent, "Saved on this device · 1 pending");
assert.match(badge.attributes['aria-label'], /Review pending changes/);
context.projectUpdateAutoApplyReady = true;
context.updateConnectionStatus();
assert.equal(badge.attributes['aria-hidden'], 'true', 'Sync uses the shared toolbar button for pending changes.');
assert.equal(badge.attributes.tabindex, undefined);
context.projectUpdateAutoApplyReady = false;
context.navigator.onLine = false;
context.updateConnectionStatus();
assert.equal(badge.attributes.role, "status", "The offline badge must not imply that review itself restores connectivity.");
assert.equal(badge.dataset.state, "offline");
assert.equal(badge.attributes["aria-hidden"], "false");
context.navigator.onLine = true;
state.syncOutbox = [{ accountUserID: "owner", queuedAt: new Date(now).toISOString() },
  { accountUserID: "other", lastError: "Foreign failure" }];
context.updateConnectionStatus();
assert.equal(badge.dataset.state, "clean", "A routine queued autosave stays quiet.");
assert.equal(badge.style.width, "0px");
assert.equal(badge.attributes["aria-hidden"], "true");
assert.equal(badge.attributes.role, "status");
assert.equal(badge.attributes.tabindex, undefined, "A quiet save must not leave a hidden keyboard target.");
assert.equal(scheduledAttention.delay, 60_000);
context.foregroundSyncPromise = {};
context.updateConnectionStatus();
assert.equal(badge.dataset.state, "clean", "Routine background sync stays quiet too.");
context.foregroundSyncPromise = null;
const delayedAttention = scheduledAttention;
now += 60_000;
delayedAttention.callback();
assert.equal(badge.dataset.state, "pending", "A stuck queue becomes visible without another user action.");
assert.equal(badge.attributes.role, "button");
state.syncOutbox = [];
context.updateConnectionStatus();
assert.equal(badge.dataset.state, "clean", "Acknowledgement clears the warning.");
assert.equal(scheduledAttention, null);
state.syncOutbox = [{ accountUserID: "owner", queuedAt: new Date(now).toISOString(), attemptCount: 1 }];
context.syncFlushPromise = {};
context.updateConnectionStatus();
assert.equal(badge.dataset.state, "pending", "A failed attempt stays visible during retry.");
assert.equal(label.textContent, "Saved on this device · 1 pending");
context.syncFlushPromise = null;
state.syncOutbox = [];
state.syncConflicts = [{accountUserID:"owner"}];
context.updateConnectionStatus();
assert.equal(badge.dataset.state,"conflict");
assert.equal(badge.attributes["aria-hidden"], "false");
state.syncConflicts = [];
draftRead = async () => [{accountUserID:"owner",scope:"notebook-card",projectID:"p",title:"Authored Note",baseVersion:0,updatedAt:new Date(now).toISOString()}];
await context.refreshNotebookPendingStatus();
assert.equal(badge.dataset.state,"clean","A fresh device draft stays quiet.");
assert.equal(scheduledAttention.delay,60_000);
draftRead = async () => [{accountUserID:"owner",scope:"collaboration-note",projectID:"p",baseVersion:0},
  {accountUserID:"other",scope:"notebook-card",baseVersion:0}];
await context.refreshNotebookPendingStatus();
assert.equal(context.notebookPendingDraftCount,1);
assert.equal(badge.dataset.state,"pending","A draft skipped by automatic sync needs immediate attention.");
assert.equal(context.pendingSyncAttentionAt({scope:"notebook-card",title:"",baseVersion:0},true),Infinity,"An empty new editor is not a sync failure.");
assert.equal(context.pendingSyncAttentionAt({scope:"notebook-card",baseVersion:0,pendingSave:{baseVersion:0,title:""}},true),0,"A blocked retained receipt remains visible.");
assert.equal(context.pendingSyncAttentionAt({scope:"notebook-card",baseVersion:0,title:"Note",recoveryConflict:true},true),0);
assert.equal(context.pendingSyncAttentionAt({scope:"notebook-card",baseVersion:-1,title:"Note"},true),0);
draftRead = async () => [];
await context.refreshNotebookPendingStatus();
assert.equal(badge.dataset.state,"clean");
draftRead = () => new Promise(resolve => { releaseDrafts = resolve; });
notice = null;
const stale = context.openPendingSyncDetails();
generation = 2;
releaseDrafts(drafts);
await stale;
assert.equal(notice, null, "A delayed draft read must not expose the old account's data after an account switch.");
console.log("Pending sync details passed: exact Project/item/reason, owner isolation, immutable inspection, blocker classification and stale-account guard.");

// One account timer retries transient saves, backs off while the queue remains
// pending, and stops as soon as every remaining draft requires user action.
{
  let nextTimer = 0, attempts = 0;
  const timers = new Map(), eligible = {title:"Note", baseVersion:2, scope:"notebook-card"};
  let queue = [eligible];
  const retry = vm.createContext({
    notebookRetryTimer:null, notebookRetryDelay:3000, notebookDraftSaveTitle,
    canRunForegroundSync:()=>true, isProAccount:()=>true, isCurrentAccountRequest:id=>id===identity,
    setTimeout(fn, delay) { const id=++nextTimer; timers.set(id,{fn,delay}); return id; },
    clearTimeout:id=>timers.delete(id),
    flushPendingNotebookDrafts:async options=>{assert.equal(options.automatic,true); attempts++;},
    refreshNotebookPendingStatus:async id=>retry.schedulePendingNotebookRetry(queue,id)
  });
  vm.runInContext([actual("canRetryNotebookDraft"),actual("schedulePendingNotebookRetry")].join("\n"),retry);
  retry.schedulePendingNotebookRetry(queue,identity);
  retry.schedulePendingNotebookRetry(queue,identity);
  assert.equal(timers.size,1);
  async function fire(delay) {
    const [id,timer]=[...timers][0]; assert.equal(timer.delay,delay);
    timers.delete(id); await timer.fn();
  }
  await fire(3000);
  queue=[{...eligible,retryNeedsReview:true}];
  await fire(6000);
  assert.equal(attempts,2);
  assert.equal(timers.size,0);
}

// A browser reconnect starts the durable Note queue even if foreground sync is delayed.
{
  const window = new EventTarget();
  const attempts = [];
  const start = app.indexOf('  window.addEventListener("online", () => {');
  const end = app.indexOf('\n  });', start);
  assert.ok(start >= 0 && end > start, "Workspace online handler is registered.");
  vm.runInNewContext(app.slice(start, end + '\n  });'.length), {
    window, serverReachable: false,
    updateConnectionStatus() {},
    async flushPendingNotebookDrafts(options) { attempts.push(options.automatic); },
    startForegroundSyncLoop() {},
    scheduleVisibleEvidenceSync() {},
    flushCodeQuestionOutbox() {},
    flushPendingNotebookImages() {},
    refreshOpenProjectCalculations() {},
    refreshOpenSettingsTrash() {}
  });
  window.dispatchEvent(new Event("online"));
  assert.deepEqual(attempts, [true], "Reconnect retries eligible Notes immediately without waiting for foreground sync or backoff.");
}
