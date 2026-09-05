import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const offline = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const begin = source.indexOf("function projectNoteEditor(");
const actualEditor = source.slice(begin, source.indexOf("\n}", begin) + 2);
assert.ok(actualEditor.includes("return container;"));
const storageFunctions = offline.slice(offline.indexOf("function notebookDraftKey("), offline.indexOf("function notebookProjectKey(")).replaceAll("export ", "");
const reviewUI = source.slice(source.indexOf("function notebookRecoveryPlainText("), source.indexOf("async function appendNotebookDeviceRecovery("));
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function reached(predicate, label) { for (let i = 0; i < 700; i += 1) { if (predicate()) return; await Promise.resolve(); } assert.fail(`Did not reach ${label}`); }
function node() { return { children: [], isConnected: true, style: {}, callbacks: {}, classList: { add() {}, remove() {} }, setAttribute() {}, append(...values) { this.children.push(...values); }, addEventListener(type, callback) { this.callbacks[type] = callback; }, getBoundingClientRect: () => ({ height: 300 }) }; }
const clone = (value) => value == null ? value : structuredClone(value);

function harness() {
  let records = new Map(), tail = Promise.resolve(), writeDelay, failWrite = false;
  const requests = [], mounts = [], elements = [], timers = new Map(); let timerID = 0;
  const identity = { userID: "synthetic-owner", generation: 1 };
  const sandbox = {
    structuredClone, crypto: webcrypto, Date, Map, Set, Promise, console,
    notebookDraftsStoreName: "drafts", requestResult: async (value) => clone(value),
    withOfflineStore(_store, mode, callback) {
      const operation = tail.then(async () => {
        const copy = new Map([...records].map(([key, value]) => [key, clone(value)]));
        const result = await callback({ get: (key) => clone(copy.get(key)), getAll: () => [...copy.values()].map(clone), put: (value) => copy.set(value.key, clone(value)), delete: (key) => copy.delete(key) });
        if (mode === "readwrite") records = copy;
        return result;
      });
      tail = operation.catch(() => {}); return operation;
    },
    document: { createElement() { const value = node(); elements.push(value); return value; } },
    window: { innerHeight: 900, addEventListener() {}, removeEventListener() {}, setTimeout(callback) { const id = ++timerID; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } },
    captureAccountRequest: () => identity, isCurrentAccountRequest: () => true, requireCurrentAccountRequest() {},
    projectDetailKey: () => "project", notebookDocumentFromPlainText: () => ({ text: "" }),
    notebookDocumentAssetURLs: () => [], reconcileNotebookDocumentAssets: async (document) => clone(document),
    finalizeNotebookImagesForDocument: async () => {}, refreshNotebookPendingStatus: async () => {},
    loadNotebookModule: async () => ({ mountPermitextNotebookEditor(_element, options) { mounts.push(options); return { replaceAssetURL() {} }; } }),
    postResearch(path, body) { const request = { path, body: clone(body), ...deferred() }; requests.push(request); return request.promise; },
    showWebNotice: async () => {}, confirmWebWarning: async () => true,
    async saveBoundary(input, actual) { if (writeDelay) { const delay = writeDelay; writeDelay = null; await delay.promise; } if (failWrite) { failWrite = false; throw new Error("Synthetic quota failure"); } return actual(input); }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${storageFunctions}
    const saveActual = saveNotebookDraft; saveNotebookDraft = (input) => saveBoundary(input, saveActual);
    ${reviewUI}
    ${actualEditor}; globalThis.openEditor = projectNoteEditor;`, context);
  return { requests, elements, records: () => [...records.values()].map(clone),
    holdWrite() { const value = deferred(); writeDelay = value; return value; }, failWrite() { failWrite = true; },
    async open(note = null) { const count = mounts.length; const container = context.openEditor({ id: "project" }, note); await reached(() => mounts.length > count, "editor mount"); const editor = mounts.at(-1); editor.onReady(); return { container, editor }; },
    async edit(editor, text) { editor.onChange({ text }); await reached(() => [...records.values()].some((record) => record.document.text === text), "durable editor checkpoint"); },
    runTimer() { const entry = [...timers.entries()].at(-1); assert.ok(entry, "Save/retry timer required"); timers.delete(entry[0]); return entry[1](); },
    reply(index, override = {}) { const request = requests[index]; request.resolve({ note: { id: "remote-project-note", version: request.body.expectedVersion + 1, title: request.body.title, document: request.body.document, body: request.body.document.text, ...override } }); }
  };
}

// Two mounted editors loaded no local draft. The second must preserve the
// first one's unsent work and stop before any HTTP write. Review must keep the
// actual current editor text and its original server base version.
{
  const test = harness();
  const a = await test.open({ version: 7 });
  const b = await test.open({ version: 3 });
  await test.edit(a.editor, "Unsent A");
  await test.edit(b.editor, "Unsent B");
  await test.runTimer();
  assert.equal(test.requests.length, 0);
  const draft = test.records()[0];
  assert.equal(draft.document.text, "Unsent B");
  assert.equal(draft.baseVersion, 3, "A stale editor cannot inherit another tab's newer server version");
  assert.equal(draft.recoveryCopies[0].document.text, "Unsent A");
  const keep = test.elements.findLast((element) => element.textContent === "Keep current editor version");
  await keep.callbacks.click();
  const saving = test.runTimer();
  await reached(() => test.requests.length === 1, "reviewed B HTTP");
  assert.equal(test.requests[0].body.document.text, "Unsent B");
  assert.equal(test.requests[0].body.expectedVersion, 3);
  test.reply(0); await saving;
  assert.equal(test.records().length, 0);
}

// A's submitted request returns after B creates a device conflict. The receipt
// cannot remove B, and A's comparison must show A as the editor version.
{
  const test = harness();
  const a = await test.open(); const b = await test.open();
  await test.edit(a.editor, "In-flight A"); const saving = test.runTimer();
  await reached(() => test.requests.length === 1, "in-flight A HTTP");
  await test.edit(b.editor, "Conflicting B");
  test.reply(0); await saving;
  const draft = test.records()[0];
  assert.equal(draft.document.text, "In-flight A");
  assert.ok(draft.recoveryCopies.some((copy) => copy.document.text === "Conflicting B"));
  assert.equal(draft.recoveryConflict, true);
  assert.equal(test.requests.length, 1);
}

// R2 is queued while R1 is in flight and the editor closes. The exact R1
// acknowledgement must rebase R2 at the same local sentinel, never delete it.
{
  const test = harness(); const first = await test.open();
  await test.edit(first.editor, "R1 bytes"); const saving = test.runTimer();
  await reached(() => test.requests.length === 1, "R1 HTTP");
  const held = test.holdWrite(); first.editor.onChange({ text: "R2 bytes" });
  first.container.isConnected = false; test.reply(0); held.resolve();
  await saving;
  assert.equal(test.requests[0].body.document.text, "R1 bytes");
  const retained = test.records()[0];
  assert.equal(retained.document.text, "R2 bytes");
  assert.equal(retained.cardID, "project-information");
  assert.equal(retained.baseVersion, 1);
  assert.equal(retained.pendingSave, undefined);
  const reopened = await test.open({ id: "remote-project-note", version: 1, document: { text: "R1 bytes" } });
  assert.equal(reopened.editor.document.text, "R2 bytes");
  const next = test.runTimer(); await reached(() => test.requests.length === 2, "reopened R2 HTTP");
  assert.equal(test.requests[1].body.expectedVersion, 1);
  assert.equal(test.requests[1].body.document.text, "R2 bytes");
  assert.notEqual(test.requests[1].body.clientMutationID, test.requests[0].body.clientMutationID);
  test.reply(1); await next; assert.equal(test.records().length, 0);
}

// Lost response followed by a newer edit/reopen retries the frozen original
// request, even when current foundation data already contains its server note.
{
  const test = harness(); const first = await test.open();
  await test.edit(first.editor, "Unconfirmed R1"); const saving = test.runTimer();
  await reached(() => test.requests.length === 1, "uncertain create");
  test.requests[0].reject(new Error("Synthetic lost response")); await saving;
  await test.edit(first.editor, "Newer R2"); first.container.isConnected = false;
  const reopened = await test.open({ id: "remote-project-note", version: 1, document: { text: "Unconfirmed R1" } });
  const retry = test.runTimer(); await reached(() => test.requests.length === 2, "journal replay");
  assert.deepEqual(test.requests[1].body, test.requests[0].body);
  test.reply(1, { version: 1 }); await retry;
  assert.equal(reopened.editor.document.text, "Newer R2");
  assert.equal(test.records()[0].document.text, "Newer R2");
  assert.equal(test.records()[0].baseVersion, 1);
}

// A newer remote version never silently changes the original expected version.
// Only the visible review action creates a fresh journal against the new base.
{
  const test = harness(); const opened = await test.open({ id: "remote-project-note", version: 1, document: { text: "Base" } });
  await test.edit(opened.editor, "Local draft"); const saving = test.runTimer();
  await reached(() => test.requests.length === 1, "conflicting save");
  const originalMutationID = test.requests[0].body.clientMutationID;
  test.requests[0].reject(Object.assign(new Error("Conflict"), { payload: { code: "PROJECT_NOTE_VERSION_CONFLICT", note: { id: "remote-project-note", version: 3, body: "Other editor's latest text", document: { text: "Remote" } } } }));
  await saving; assert.equal(test.records()[0].baseVersion, 1);
  assert.equal(test.records()[0].pendingSave.revision, originalMutationID);
  const review = test.elements.find((element) => element.textContent === "Review Project information conflict");
  assert.ok(review); await review.callbacks.click();
  const reviewed = test.runTimer(); await reached(() => test.requests.length === 2, "reviewed save");
  assert.equal(test.requests[1].body.expectedVersion, 3);
  assert.equal(test.requests[1].body.document.text, "Local draft");
  assert.notEqual(test.requests[1].body.clientMutationID, originalMutationID);
  test.reply(1); await reviewed;
}

// A failed device checkpoint must not submit an older stored document and then
// display it as synchronized while the visible editor contains unsaved bytes.
{
  const test = harness(); const opened = await test.open(); test.failWrite();
  opened.editor.onChange({ text: "Unstored bytes" });
  await test.runTimer();
  assert.equal(test.requests.length, 0);
  assert.ok(test.elements.some((element) => /Device save failed/.test(element.textContent || "")));
}

// An accepted older save is acknowledged even if a newer checkpoint fails,
// but that acknowledgement cannot replace the visible device-failure status.
{
  const test = harness(); const opened = await test.open();
  await test.edit(opened.editor, "Accepted R1"); const saving = test.runTimer();
  await reached(() => test.requests.length === 1, "R1 before failed R2 checkpoint");
  test.failWrite(); opened.editor.onChange({ text: "Unstored R2" });
  test.reply(0); await saving;
  assert.equal(test.records().length, 0, "The accepted R1 journal is acknowledged");
  assert.ok(test.elements.some((element) => /Device save failed/.test(element.textContent || "")));
  assert.ok(!test.elements.some((element) => element.textContent === "Synced"));
}
console.log("Project information durability contract passed: exact journal bodies, queued edits and close/reopen, lost-response replay, explicit base-version review, and device-write failure.");
