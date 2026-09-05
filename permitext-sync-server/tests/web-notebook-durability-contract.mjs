import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const offlineSource = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
function sliceBetween(source, start, end) {
  const a = source.indexOf(start); const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Could not extract application boundary ${start}`);
  return source.slice(a, b);
}
const draftFunctions = sliceBetween(offlineSource, "function notebookDraftKey(", "function notebookProjectKey(").replaceAll("export ", "");
const syncFunctions = sliceBetween(appSource, "async function synchronizeNotebookDraft(", "async function flushPendingNotebookDrafts(");
const editor = appSource.slice(appSource.indexOf("async function renderProjectNotebook("));
const persistence = sliceBetween(editor, "  let editorMount = null;", "  const notebookImageUploaded =");
const reviewUI = sliceBetween(appSource, "function notebookRecoveryPlainText(", "async function appendNotebookDeviceRecovery(");
const recoveryBundle = sliceBetween(appSource, "async function notebookDeviceRecoveryBundle(", "function notebookRecoveryPlainText(");
const saveActive = sliceBetween(editor, "    async function saveActiveNotebookCard()", "    flushNotebookAutosave =");
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function reached(predicate, label) { for (let i = 0; i < 250; i += 1) { if (predicate()) return; await Promise.resolve(); } assert.fail(`Did not reach ${label}`); }
const clone = (value) => value == null ? value : structuredClone(value);

function harness() {
  let records = new Map();
  let storeTail = Promise.resolve();
  let generation = 1;
  let writeDelay = null;
  let writeFailure = null;
  let snapshotDelay = null;
  let documentTransform = null;
  const requests = [];
  const scheduled = [];
  const snapshots = [];
  const elements = [];
  const downloads = [];
  const addToReport = { disabled: true };
  let pendingStatusRefreshes = 0;
  const pendingStatusSamples = [];
  const createElement = () => { const element = { textContent: "", style: {}, callbacks: new Map(), setAttribute() {}, append() {}, addEventListener(name, action) { this.callbacks.set(name, action); } }; elements.push(element); return element; };
  let confirmed = false;
  const identity = { userID: "synthetic-a", generation: 1 };
  const sandbox = {
    structuredClone, crypto: webcrypto, console, Date, Promise, Map, Set, Blob,
    accountUserID: identity.userID, requestIdentity: identity, projectID: "project",
    notebookDraftsStoreName: "drafts", requestResult: async (value) => clone(value),
    withOfflineStore(_name, _mode, callback) {
      const operation = storeTail.then(async () => {
        const copy = new Map([...records].map(([key, value]) => [key, clone(value)]));
        const result = await callback({ get: (key) => clone(copy.get(key)), getAll: () => [...copy.values()].map(clone), put: (value) => copy.set(value.key, clone(value)), delete: (key) => copy.delete(key) });
        records = copy;
        return result;
      });
      storeTail = operation.catch(() => {});
      return operation;
    },
    captureAccountRequest: () => identity,
    isCurrentAccountRequest: (candidate) => candidate.generation === generation,
    requireCurrentAccountRequest(candidate) { if (candidate.generation !== generation) throw Object.assign(new Error("Account changed"), { code: "ACCOUNT_CONTEXT_CHANGED" }); },
    accountContextChangedError: () => Object.assign(new Error("Account changed"), { code: "ACCOUNT_CONTEXT_CHANGED" }),
    document: { createElement }, header: { after() {} }, panel: { querySelector: () => addToReport }, navigator: { onLine: true },
    emptyNotebookDocument: () => ({ text: "" }),
    async reconcileNotebookDocumentAssets(document) { return documentTransform ? documentTransform(clone(document)) : clone(document); },
    notebookDocumentAssetURLs: () => [],
    async refreshNotebookPendingStatus() { pendingStatusRefreshes += 1; pendingStatusSamples.push(records.size); },
    async saveNotebookCardSnapshot(_account, _project, card) { snapshots.push(clone(card)); if (snapshotDelay) { const delay = snapshotDelay; snapshotDelay = null; await delay.promise; } },
    async saveNotebookProjectSnapshot(snapshot) { snapshots.push(clone(snapshot)); },
    postResearch(path, body) { const request = { path, body: clone(body), ...deferred() }; requests.push(request); return request.promise; },
    notebookSummaryForCard: (card) => clone(card), renderCardList() {},
    scheduleNotebookAutosave(delay) { scheduled.push(delay); },
    reportDraftMounts: new Map(), confirmWebWarning: async () => confirmed,
    downloadCodeMemoBlob: (blob, filename) => downloads.push({ blob, filename }),
    async offlineAccountRecoverySnapshot() { return { drafts: [...records.values()].map(clone), images: [{ accountUserID: identity.userID, projectID: "project", blob: new Blob(["synthetic image"]) }] }; },
    async blobDataURL(blob) { return `data:image/png;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`; },
    async saveDraftBoundary(input, actual) { if (writeDelay) { const delay = writeDelay; writeDelay = null; await delay.promise; } if (writeFailure) { const failure = writeFailure; writeFailure = null; throw failure; } return actual(input); }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`
    ${draftFunctions}
    ${reviewUI}
    ${recoveryBundle}
    const actualSaveNotebookDraft = saveNotebookDraft;
    saveNotebookDraft = (input) => saveDraftBoundary(input, actualSaveNotebookDraft);
    ${syncFunctions}
    ${persistence}
    let notebookAutosaveTask = null;
    ${saveActive}
    activeCard = { id: "", version: 0, cardType: "finding", title: "First draft", evidenceLinks: [] };
    draftDocument = { text: "First bytes" }; dirty = true; notebookRevision = 1;
    globalThis.api = {
      persist: persistFocusedDraft, save: saveActiveNotebookCard,
      sync: synchronizeNotebookDraft,
      edit(title, text) { activeCard.title = title; draftDocument = { text }; dirty = true; notebookRevision += 1; return persistFocusedDraft(); },
      dispose() { disposed = true; },
      focusOther() { activeCard = { id: "different-card", version: 9, title: "Other focused Note" }; draftDocument = { text: "Other Note bytes" }; dirty = false; },
      state: () => ({ activeCard, draftDocument, dirty, persistedDraft, notebookRevision, persistedRevision, saveConflict }),
      recover: showNotebookRecoveryConflict,
      drafts: pendingNotebookDrafts,
      load: loadNotebookDraft,
      directSave: saveNotebookDraft
    };
  `, context, { filename: "actual-notebook-persistence-and-save-functions.js" });
  return {
    api: context.api, requests, scheduled, elements, snapshots, addToReport, pendingStatusSamples, downloads,
    pendingStatusRefreshes: () => pendingStatusRefreshes,
    confirmReview() { confirmed = true; },
    records: () => [...records.values()].map(clone),
    holdNextWrite() { const value = deferred(); writeDelay = value; return value; },
    holdNextSnapshot() { const value = deferred(); snapshotDelay = value; return value; },
    transformDocument(transform) { documentTransform = transform; },
    failNextWrite() { writeFailure = new Error("Synthetic device quota failure"); },
    switchAccount() { generation += 1; },
    respond(index, card = {}) {
      const request = requests[index];
      request.resolve({ card: { id: request.body.cardID || "saved-card", version: request.body.expectedVersion + 1,
        title: request.body.title, document: request.body.document, evidenceLinks: request.body.evidenceLinks,
        cardType: request.body.cardType, ...card } });
    }
  };
}

// A successful mounted creation reconciles both local and global save status,
// and the now-addressable clean Note can be added to a Report without reopening.
{
  const test = harness();
  const save = test.api.save();
  await reached(() => test.requests.length === 1, "new Note creation");
  test.respond(0);
  assert.equal(await save, true);
  assert.equal(test.api.state().dirty, false);
  assert.equal(test.records().length, 0);
  assert.ok(test.pendingStatusRefreshes() >= 1);
  assert.equal(test.pendingStatusSamples.at(-1), 0, "The global pending count refresh must run after acknowledgement removes the accepted draft.");
  assert.equal(test.addToReport.disabled, false);
}

// Multiple calls for the same unedited local checkpoint retain its mutation
// identity. A failed device write is retried without losing the newer bytes.
{
  const test = harness();
  const first = await test.api.persist();
  assert.equal((await test.api.persist()).revision, first.revision);
  test.failNextWrite();
  await assert.rejects(test.api.edit("New title", "New bytes"), /quota/);
  const recovered = await test.api.persist();
  assert.equal(recovered.title, "New title");
  assert.equal(recovered.document.text, "New bytes");
  assert.notEqual(recovered.revision, first.revision);
  assert.equal(recovered.baseVersion, 0);
}

// A second tab can already own a different draft under the accepted creation
// ID. Acknowledgement must retain both and leave this editor attached to its
// original checkpoint, including edits made after the conflict is shown.
{
  const test = harness();
  const save = test.api.save();
  await reached(() => test.requests.length === 1, "creation before rekey collision");
  await test.api.edit("Local newer title", "Local newer bytes");
  await test.api.directSave({ accountUserID: "synthetic-a", projectID: "project", cardID: "saved-card", baseVersion: 1,
    title: "Other tab draft", document: { text: "Other tab bytes" }, evidenceLinks: [] });
  test.respond(0);
  assert.equal(await save, false);
  assert.equal(test.api.state().saveConflict, true);
  assert.equal(test.api.state().activeCard.id, "");
  assert.equal(test.records().length, 2);
  const protectedTarget = test.records().find((draft) => draft.cardID === "saved-card");
  const retained = test.records().find((draft) => draft.cardID === "");
  assert.equal(retained.recoveryConflict, true);
  assert.equal(retained.acceptedCardID, "saved-card");
  assert.equal(test.api.state().persistedDraft.key, retained.key);
  await test.api.edit("Retained editor title", "Retained editor bytes");
  assert.deepEqual(test.records().find((draft) => draft.cardID === "saved-card"), protectedTarget);
  assert.equal(await test.api.save(), false);
  assert.equal(test.requests.length, 1, "Conflict drafts must not keep attempting automatic HTTP writes.");
  const download = test.elements.findLast((element) => element.className === "notebook-recovery-download");
  assert.ok(download, "Reopened/colliding drafts expose an explicit recovery action.");
  await download.callbacks.get("click")();
  const exported = JSON.parse(await test.downloads[0].blob.text());
  assert.equal(exported.document.text, "Retained editor bytes");
  assert.equal(exported.title, "Retained editor title");
  assert.equal(exported.acceptedCardID, "saved-card");
  assert.equal(test.records().length, 2, "Exporting must not delete either checkpoint.");
}

// An independent tab updates the same draft after this mounted editor read it.
// Both byte sets survive; downloading and rejecting stale review are harmless.
{
  const test = harness();
  const initial = await test.api.persist();
  await test.api.directSave({ ...initial, title: "Other tab", document: { text: "Other tab unsent bytes" }, expectedRevision: initial.revision });
  await test.api.edit("This editor", "This editor unsent bytes");
  assert.equal(test.api.state().saveConflict, true);
  assert.equal(await test.api.save(), false);
  assert.equal(test.requests.length, 0);
  const retained = test.records()[0];
  assert.equal(retained.document.text, "This editor unsent bytes");
  assert.equal(retained.recoveryCopies[0].document.text, "Other tab unsent bytes");
  const download = test.elements.findLast((element) => element.className === "notebook-recovery-download");
  await download.callbacks.get("click")();
  const exported = JSON.parse(await test.downloads[0].blob.text());
  assert.equal(exported.document.text, "This editor unsent bytes");
  assert.equal(exported.recoveryCopies[0].document.text, "Other tab unsent bytes");
  assert.ok(exported.deviceRecovery.images[0].dataURL.startsWith("data:image/png;base64,"));
  assert.equal(exported.deviceRecovery.drafts[0].recoveryCopies[0].document.text, "Other tab unsent bytes");
  const staleReview = test.elements.findLast((element) => element.textContent === "Keep current editor version");
  await test.api.edit("This editor", "Edited during review");
  test.confirmReview();
  await staleReview.callbacks.get("click")();
  assert.equal(test.records()[0].recoveryCopies.length, 1);
  assert.ok(test.elements.some((element) => /changed during review/.test(element.textContent)));
  // A stale dialog must not poison the checkpoint queue or prevent a fresh review.
  const freshReview = test.elements.findLast((element) => element.textContent === "Keep current editor version");
  await freshReview.callbacks.get("click")();
  assert.equal(test.api.state().saveConflict, false);
  assert.equal(test.records()[0].document.text, "Edited during review");
  assert.equal(test.records()[0].recoveryCopies, undefined);
}

// Closing the pane while a save and a newer local write overlap must bind the
// newer draft to the acknowledged card. It must never become a second new Note.
{
  const test = harness();
  const save = test.api.save();
  await reached(() => test.requests.length === 1, "first save request");
  const delayedWrite = test.holdNextWrite();
  const newer = test.api.edit("Newer title", "Newer bytes");
  test.api.dispose();
  test.respond(0);
  for (let i = 0; i < 25; i += 1) await Promise.resolve();
  delayedWrite.resolve();
  await newer;
  await save;
  const records = test.records();
  assert.equal(records.length, 1);
  assert.equal(records[0].cardID, "saved-card", "Disposing cannot skip acknowledgement/rekey of an accepted new Note.");
  assert.equal(records[0].baseVersion, 1);
  assert.equal(records[0].title, "Newer title");
  assert.equal(records[0].document.text, "Newer bytes");
}

// If creation succeeded but its response was lost, an intervening local edit
// must not change the retry identity/body or be replaced by the recovered R1.
{
  const test = harness();
  const firstSave = test.api.save();
  await reached(() => test.requests.length === 1, "request before lost response");
  const originalBody = test.requests[0].body;
  test.requests[0].reject(new Error("Synthetic response lost"));
  await firstSave;
  await test.api.edit("Edited after response loss", "Keep these newer bytes");
  const retry = test.api.save();
  await reached(() => test.requests.length === 2, "retry of recorded submitted request");
  assert.deepEqual(test.requests[1].body, originalBody, "Reconciliation must replay the exact recorded mutation before sending newer edits.");
  test.respond(1);
  await retry;
  const current = test.api.state();
  assert.equal(current.activeCard.title, "Edited after response loss");
  assert.equal(current.draftDocument.text, "Keep these newer bytes");
  assert.equal(current.dirty, true);
  const pending = test.records();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].cardID, "saved-card");
  assert.equal(pending[0].baseVersion, 1);
  assert.equal(pending[0].title, "Edited after response loss");
}

// The journal freezes the final document sent over HTTP. A later image URL
// reconciliation cannot change the body under an already submitted mutation ID.
{
  const test = harness();
  let resolution = 0;
  test.transformDocument((document) => ({ ...document, resolvedAsset: `permanent-${++resolution}` }));
  const draft = await test.api.persist();
  const first = test.api.sync(draft);
  await reached(() => test.requests.length === 1, "prepared document submission");
  const firstBody = test.requests[0].body;
  test.requests[0].reject(new Error("Lost image-bearing response"));
  await assert.rejects(first, /Lost image-bearing response/);
  const retained = await test.api.load("synthetic-a", "project", "");
  const retry = test.api.sync(retained);
  await reached(() => test.requests.length === 2, "frozen image document retry");
  assert.deepEqual(test.requests[1].body, firstBody);
  test.respond(1);
  await retry;
}

// Reviewing an explicit server conflict abandons only its rejected request
// journal and uses a new mutation ID against the reviewed version.
{
  const test = harness();
  const first = test.api.save();
  await reached(() => test.requests.length === 1, "save before explicit conflict");
  const failedMutation = test.requests[0].body.clientMutationID;
  test.requests[0].reject(Object.assign(new Error("Another editor saved first"), { payload: { code: "NOTEBOOK_VERSION_CONFLICT", card: { id: "saved-card", version: 3, title: "Server title", plainText: "Server bytes" } } }));
  await first;
  await test.api.edit("Reviewed local title", "Reviewed local bytes");
  const review = test.elements.find((element) => element.textContent === "Review save conflict");
  assert.ok(review);
  test.confirmReview();
  await review.callbacks.get("click")();
  const retry = test.api.save();
  await reached(() => test.requests.length === 2, "explicitly reviewed revision");
  assert.equal(test.requests[1].body.expectedVersion, 3);
  assert.equal(test.requests[1].body.cardID, "saved-card");
  assert.equal(test.requests[1].body.title, "Reviewed local title");
  assert.notEqual(test.requests[1].body.clientMutationID, failedMutation);
  test.respond(1);
  await retry;
}

// Edits after this writer's own acknowledgement must use its rekeyed local
// revision immediately, even while the slower cache update is still pending.
{
  const test = harness();
  const delayedSnapshot = test.holdNextSnapshot();
  const saving = test.api.save();
  await reached(() => test.requests.length === 1, "creation before queued edit");
  await test.api.edit("Second", "Before receipt");
  test.respond(0);
  await reached(() => test.snapshots.length === 1, "receipt before slow cache");
  await test.api.edit("Third", "After own receipt");
  assert.equal(test.api.state().saveConflict, false, "This writer's own rekey is not a second tab conflict");
  assert.equal(test.records()[0].document.text, "After own receipt");
  delayedSnapshot.resolve(); await saving;
}

// A save acknowledgement may finish while another Note has loaded. Its durable
// writes remain valid, but its result must never replace the newly focused Note.
{
  const test = harness();
  const delayedSnapshot = test.holdNextSnapshot();
  const save = test.api.save();
  await reached(() => test.requests.length === 1, "save before another Note loads");
  test.respond(0);
  await reached(() => test.snapshots.length === 1, "snapshot after acknowledgement");
  test.api.focusOther();
  delayedSnapshot.resolve();
  await save;
  assert.equal(test.api.state().activeCard.id, "different-card");
  assert.equal(test.api.state().draftDocument.text, "Other Note bytes");
}

// Account changes before sending or while a result is pending cannot paint a
// stale editor or save a card snapshot into another account's private cache.
{
  const test = harness();
  const save = test.api.save();
  await reached(() => test.requests.length === 1, "request before account change");
  test.switchAccount();
  test.respond(0);
  await save;
  assert.equal(test.snapshots.length, 0);
  assert.equal(test.api.state().activeCard.id, "");
  assert.equal(test.records()[0].title, "First draft");
}

console.log("Web Notebook durability contract passed using actual draft, submission and editor-save functions; all storage/network effects are synthetic.");
