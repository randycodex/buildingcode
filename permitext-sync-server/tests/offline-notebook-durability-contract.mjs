import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import * as offline from "../public/offline-storage.js";

// A deliberately small IndexedDB boundary double: asynchronous requests,
// serialized transactions, isolated writes, abort rollback and cursor deletion.
// The application module and its transaction scopes execute unchanged.
class MemoryIndexedDB {
  stores = new Map();
  keyPaths = new Map();
  indexes = new Map();
  transactions = [];
  version = 0;
  tail = Promise.resolve();
  delayedOpen = null;
  failPut = null;
  holdNextOpen() {
    let release;
    this.delayedOpen = new Promise((resolve) => { release = resolve; });
    return release;
  }
  open(_name, version) {
    const request = {};
    const delay = this.delayedOpen;
    this.delayedOpen = null;
    Promise.resolve(delay).then(() => {
      request.result = this.connection();
      if (version > this.version) { this.version = version; request.onupgradeneeded?.(); }
      request.onsuccess?.();
    });
    return request;
  }
  connection() {
    const owner = this;
    return {
      objectStoreNames: { contains: (name) => owner.stores.has(name) },
      createObjectStore(name, { keyPath }) {
        owner.stores.set(name, new Map()); owner.keyPaths.set(name, keyPath); owner.indexes.set(name, new Map());
        return { createIndex: (index, field) => owner.indexes.get(name).set(index, field) };
      },
      transaction(names, mode) { return owner.transaction(Array.isArray(names) ? names : [names], mode); },
      close() {}
    };
  }
  transaction(names, mode) {
    const owner = this;
    const before = this.tail;
    let release;
    this.tail = new Promise((resolve) => { release = resolve; });
    let active = false;
    let finished = false;
    let pending = 0;
    const jobs = [];
    const staged = new Map();
    const transaction = {
      error: null,
      abort() {
        if (finished) throw new Error("Transaction is finished.");
        finished = true;
        queueMicrotask(() => { transaction.onabort?.(); release(); });
      },
      objectStore(name) {
        assert.ok(names.includes(name), `Object store ${name} must be included in the transaction scope.`);
        const request = (operation) => {
          if (finished) throw new Error("Transaction is finished.");
          const result = {};
          pending += 1;
          jobs.push(() => {
            if (finished) return;
            try { result.result = operation(); result.onsuccess?.(); }
            catch (error) {
              result.error = error; transaction.error = error; result.onerror?.();
              transaction.abort();
            }
            pending -= 1;
            queueMicrotask(pump);
          });
          if (active) queueMicrotask(pump);
          return result;
        };
        const store = {
          get: (key) => request(() => structuredClone(staged.get(name).get(key))),
          getAll: () => request(() => [...staged.get(name).values()].map((value) => structuredClone(value))),
          put(value) {
            const captured = structuredClone(value);
            return request(() => {
              assert.equal(mode, "readwrite");
              if (owner.failPut?.(name, captured)) throw new Error("Synthetic IndexedDB write failure");
              const key = captured[owner.keyPaths.get(name)];
              staged.get(name).set(key, captured); return key;
            });
          },
          delete: (key) => request(() => { assert.equal(mode, "readwrite"); staged.get(name).delete(key); }),
          clear: () => request(() => { assert.equal(mode, "readwrite"); staged.get(name).clear(); }),
          index(indexName) {
            const field = owner.indexes.get(name).get(indexName);
            assert.ok(field, `Missing index ${indexName}`);
            return { getAll: (value) => request(() => [...staged.get(name).values()].filter((record) => record[field] === value).map((record) => structuredClone(record))) };
          },
          openCursor() {
            let keys;
            let index = 0;
            const cursorRequest = {};
            const advance = () => {
              const next = request(() => {
                keys ||= [...staged.get(name).keys()];
                if (index >= keys.length) return null;
                const key = keys[index++];
                return { value: structuredClone(staged.get(name).get(key)), primaryKey: key,
                  delete: () => store.delete(key), continue: advance };
              });
              next.onsuccess = () => { cursorRequest.result = next.result; cursorRequest.onsuccess?.(); };
              next.onerror = () => { cursorRequest.error = next.error; cursorRequest.onerror?.(); };
            };
            advance();
            return cursorRequest;
          }
        };
        return store;
      }
    };
    function pump() {
      if (!active || finished) return;
      const job = jobs.shift();
      if (job) { job(); return; }
      if (pending) return;
      // Promise continuations from a successful request may enqueue more work.
      queueMicrotask(() => {
        if (finished || jobs.length || pending) return;
        finished = true;
        if (mode === "readwrite") for (const [name, data] of staged) owner.stores.set(name, data);
        transaction.oncomplete?.(); release();
      });
    }
    before.then(() => {
      for (const name of names) staged.set(name, new Map([...owner.stores.get(name)].map(([key, value]) => [key, structuredClone(value)])));
      active = true; pump();
    });
    this.transactions.push({ names, mode });
    return transaction;
  }
}

const database = new MemoryIndexedDB();
// Start from the shipped v4 stores with existing data, rather than treating an
// empty database as evidence that the v5 upgrade preserves private work.
const legacyConnection = database.connection();
for (const [name, keyPath] of [
  ["metadata", "key"], ["chapters", "key"], ["sections", "key"], ["sync-snapshots", "userID"],
  ["notebook-images", "localURL"], ["notebook-drafts", "key"], ["notebook-projects", "key"]
]) legacyConnection.createObjectStore(name, { keyPath });
database.indexes.get("notebook-images").set("accountUserID", "accountUserID");
database.indexes.get("notebook-images").set("uploadState", "uploadState");
database.version = 4;
database.stores.get("notebook-drafts").set("upgrade-sentinel", { key: "upgrade-sentinel", accountUserID: "web:upgrade-synthetic", projectID: "legacy", cardID: "legacy", document: { text: "Preserve old work" } });
globalThis.indexedDB = database;
globalThis.crypto ||= webcrypto;
globalThis.window = {};
const accountA = "web:offline-synthetic-a";
const accountB = "web:offline-synthetic-b";
const projectID = "synthetic-project";
const document = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const input = (accountUserID, cardID = "") => ({ accountUserID, projectID, cardID, title: "Synthetic draft", document: document("Initial text"), evidenceLinks: [] });

const projectNote = await offline.saveNotebookDraft({ ...input(accountB, "project-information"), scope: "collaboration-note", baseVersion: 0 });
const projectNoteJournal = await offline.beginNotebookDraftSave(accountB, projectID, "project-information", projectNote.revision, { noteID: "", document: document("Submitted Project information") });
assert.equal(projectNoteJournal.noteID, "");
const projectNoteEdit = await offline.saveNotebookDraft({ ...input(accountB, "project-information"), document: document("New Project information") });
assert.deepEqual(await offline.beginNotebookDraftSave(accountB, projectID, "project-information", projectNoteEdit.revision, { noteID: "new-server-note-id" }), projectNoteJournal, "A retried Project note must keep its original create identity and body.");

const first = await offline.saveNotebookDraft({ ...input(accountA), baseVersion: 0, cardType: "assumption" });
assert.equal(database.version, 5);
assert.equal(database.stores.has("deleted-accounts"), true);
assert.equal(database.stores.get("notebook-drafts").get("upgrade-sentinel").document.text, "Preserve old work", "The v5 upgrade must not wipe old private stores.");
assert.equal(first.scope, "notebook-card");
const preparedDocument = { type: "doc", content: [{ type: "image", attrs: { src: "permitext-notebook-asset:accepted-remote-image" } }] };
const submitted = await offline.beginNotebookDraftSave(accountA, projectID, "", first.revision, { document: preparedDocument });
assert.equal(submitted.revision, first.revision);
assert.deepEqual(submitted.document, preparedDocument);
const newer = await offline.saveNotebookDraft({ ...input(accountA), document: document("Text typed during save") });
assert.notEqual(newer.revision, first.revision);
assert.equal(newer.cardType, "assumption", "Omitted metadata must not reset the existing card type.");
assert.equal(newer.baseVersion, 0);
assert.deepEqual(newer.pendingSave, submitted);
assert.deepEqual(await offline.beginNotebookDraftSave(accountA, projectID, "", newer.revision, { document: document("Different retry-time asset mapping") }), submitted, "A lost creation response must retry the identical earlier body and mutation ID despite newer edits or asset remapping.");
const unrelatedAck = await offline.acknowledgeNotebookDraft(accountA, projectID, "", "other-journal", { id: "wrong-card", version: 2 });
assert.equal(unrelatedAck.stale, true);
assert.deepEqual((await offline.loadNotebookDraft(accountA, projectID, "")).pendingSave, submitted);
const acknowledgement = await offline.acknowledgeNotebookDraft(accountA, projectID, "", first.revision, { id: "server-card", version: 1 });
assert.equal(acknowledgement.acknowledged, false);
assert.equal(await offline.loadNotebookDraft(accountA, projectID, ""), null);
const retained = await offline.loadNotebookDraft(accountA, projectID, "server-card");
assert.deepEqual(retained.document, newer.document);
assert.equal(retained.revision, newer.revision, "Acknowledgement must not invent another local revision.");
assert.equal(retained.baseVersion, 1);
assert.equal(retained.cardType, "assumption");
assert.equal(retained.pendingSave, undefined, "Only the acknowledged journal is cleared.");
assert.equal(await offline.deleteNotebookDraft(accountA, projectID, "server-card", first.revision), false, "An obsolete cleanup cannot delete a newer checkpoint.");
const accepted = await offline.acknowledgeNotebookDraft(accountA, projectID, "server-card", retained.revision, { id: "server-card", version: 2 });
assert.equal(accepted.acknowledged, true);
assert.equal(await offline.loadNotebookDraft(accountA, projectID, "server-card"), null);
const separateNew = await offline.saveNotebookDraft(input(accountA));
assert.equal((await offline.acknowledgeNotebookDraft(accountA, projectID, "", first.revision, { id: "server-card", version: 1 })).stale, true);
assert.equal((await offline.loadNotebookDraft(accountA, projectID, "")).revision, separateNew.revision, "A duplicate old receipt cannot claim an unrelated new draft.");
await offline.deleteNotebookDraft(accountA, projectID, "", separateNew.revision);

const edit = await offline.saveNotebookDraft({ ...input(accountA, "existing-card"), baseVersion: 4, cardType: "decision", title: "Submitted title", evidenceLinks: [{ kind: "evidence", targetID: "synthetic-evidence" }] });
const editJournal = await offline.beginNotebookDraftSave(accountA, projectID, "existing-card", edit.revision);
const laterEdit = await offline.saveNotebookDraft({ ...input(accountA, "existing-card"), baseVersion: 4, cardType: "finding", title: "Later title", document: document("Later document") });
assert.deepEqual(await offline.beginNotebookDraftSave(accountA, projectID, "existing-card", laterEdit.revision), editJournal);
assert.equal(editJournal.title, "Submitted title");
assert.equal(editJournal.cardType, "decision");
assert.equal(editJournal.baseVersion, 4);
await offline.acknowledgeNotebookDraft(accountA, projectID, "existing-card", edit.revision, { id: "existing-card", version: 5 });
const rebasedEdit = await offline.loadNotebookDraft(accountA, projectID, "existing-card");
assert.equal(rebasedEdit.title, "Later title");
assert.equal(rebasedEdit.cardType, "finding");
assert.equal(rebasedEdit.baseVersion, 5);
assert.equal(rebasedEdit.revision, laterEdit.revision);
await assert.rejects(() => offline.beginNotebookDraftSave(accountA, projectID, "existing-card", edit.revision), (error) => error.code === "OFFLINE_DRAFT_REVISION_CHANGED");
await offline.beginNotebookDraftSave(accountA, projectID, "existing-card", rebasedEdit.revision);
await assert.rejects(() => offline.rebaseNotebookDraftAfterReview(accountA, projectID, "existing-card", edit.revision, { id: "existing-card", version: 8 }), (error) => error.code === "OFFLINE_DRAFT_REVISION_CHANGED");
assert.ok((await offline.loadNotebookDraft(accountA, projectID, "existing-card")).pendingSave, "A stale review cannot clear the existing journal.");
const reviewed = await offline.rebaseNotebookDraftAfterReview(accountA, projectID, "existing-card", rebasedEdit.revision, { id: "existing-card", version: 8 });
assert.equal(reviewed.baseVersion, 8);
assert.notEqual(reviewed.revision, rebasedEdit.revision);
assert.deepEqual(reviewed.document, rebasedEdit.document);
assert.equal(reviewed.title, rebasedEdit.title);
assert.deepEqual(reviewed.evidenceLinks, rebasedEdit.evidenceLinks);
assert.equal(reviewed.pendingSave, undefined);
assert.equal((await offline.beginNotebookDraftSave(accountA, projectID, "existing-card", reviewed.revision)).baseVersion, 8);

const collaboration = await offline.saveNotebookDraft({ ...input(accountA, "project-information"), scope: "collaboration-note", baseVersion: 7 });
const collaborationUpdate = await offline.saveNotebookDraft({ ...input(accountA, "project-information"), document: document("Updated collaboration") });
assert.equal(collaborationUpdate.scope, "collaboration-note");
assert.equal(collaborationUpdate.baseVersion, 7);
assert.equal((await offline.saveNotebookDraft({ ...input(accountA, "project-information"), baseVersion: null })).baseVersion, 7, "Unknown incoming metadata cannot erase a known save base.");
const legacyKey = `${accountA}:${projectID}:legacy-card`;
database.stores.get("notebook-drafts").set(legacyKey, { ...input(accountA, "legacy-card"), key: legacyKey, revision: "legacy-revision" });
assert.equal((await offline.pendingNotebookDrafts(accountA)).find((draft) => draft.cardID === "legacy-card").scope, "notebook-card");
const legacyCollaborationKey = `${accountA}:${projectID}:project-information`;
database.stores.get("notebook-drafts").set(legacyCollaborationKey, { ...collaboration, scope: undefined });
assert.equal((await offline.loadNotebookDraft(accountA, projectID, "project-information")).scope, "collaboration-note");

// A failed rekey rolls back both removal and replacement, keeping the draft.
const beforeFailure = await offline.saveNotebookDraft(input(accountA));
await offline.beginNotebookDraftSave(accountA, projectID, "", beforeFailure.revision);
const failureRevision = await offline.saveNotebookDraft({ ...input(accountA), document: document("Keep this after quota failure") });
database.failPut = (name, value) => name === "notebook-drafts" && value.cardID === "failed-rekey";
await assert.rejects(() => offline.acknowledgeNotebookDraft(accountA, projectID, "", beforeFailure.revision, { id: "failed-rekey", version: 1 }), /Synthetic IndexedDB write failure/);
database.failPut = null;
assert.equal((await offline.loadNotebookDraft(accountA, projectID, "")).revision, failureRevision.revision);

const collisionTarget = await offline.saveNotebookDraft({ ...input(accountA, "collision-card"), document: document("Independent target draft") });
const collision = await offline.acknowledgeNotebookDraft(accountA, projectID, "", beforeFailure.revision, { id: "collision-card", version: 1 });
assert.equal(collision.conflict, true);
const collisionSource = await offline.loadNotebookDraft(accountA, projectID, "");
assert.equal(collisionSource.recoveryConflict, true);
assert.equal(collisionSource.cardID, "", "The retained key and draft ID must remain consistent for recovery.");
assert.equal(collisionSource.acceptedCardID, "collision-card");
assert.equal(collisionSource.pendingSave, undefined);
assert.deepEqual((await offline.loadNotebookDraft(accountA, projectID, "collision-card")).document, collisionTarget.document);
await assert.rejects(() => offline.beginNotebookDraftSave(accountA, projectID, "", collisionSource.revision), (error) => error.code === "OFFLINE_DRAFT_RECOVERY_REQUIRED");
await assert.rejects(() => offline.rebaseNotebookDraftAfterReview(accountA, projectID, "", collisionSource.revision, { id: "collision-card", version: 2 }), (error) => error.code === "OFFLINE_DRAFT_REKEY_CONFLICT");
assert.equal((await offline.loadNotebookDraft(accountA, projectID, "")).revision, collisionSource.revision);
assert.equal((await offline.loadNotebookDraft(accountA, projectID, "collision-card")).revision, collisionTarget.revision);
const recovered = await offline.rebaseNotebookDraftAfterReview(accountA, projectID, "", collisionSource.revision, { id: "reviewed-recovery-card", version: 2 });
assert.equal(recovered.recoveryConflict, undefined);
assert.equal(recovered.acceptedCardID, undefined);
assert.equal(recovered.cardID, "reviewed-recovery-card");
assert.equal(await offline.loadNotebookDraft(accountA, projectID, ""), null);
assert.deepEqual(recovered.document, collisionSource.document);

for (const account of [accountA, accountB]) {
  await offline.saveNotebookDraft(input(account, "keep-card"));
  await offline.stageNotebookImage({ accountUserID: account, projectID, cardID: "keep-card", assetID: `${account}-image`, blob: new Blob(["synthetic image"], { type: "image/png" }) });
  await offline.saveNotebookProjectSnapshot({ accountUserID: account, projectID, foundation: { label: account }, cardPayload: { cards: [] } });
  await Promise.all([
    offline.saveNotebookCardSnapshot(account, projectID, { id: "one", document: document("One") }),
    offline.saveNotebookCardSnapshot(account, projectID, { id: "two", document: document("Two") })
  ]);
  assert.deepEqual(Object.keys((await offline.loadNotebookProjectSnapshot(account, projectID)).cardDocuments), ["one", "two"], "Concurrent local cache updates must retain both cards.");
}
database.stores.get("metadata").set("active-library", { key: "active-library", installID: "synthetic-install" });
database.stores.get("chapters").set("synthetic-chapter", { key: "synthetic-chapter" });
database.stores.get("sections").set("synthetic-section", { key: "synthetic-section" });
await offline.saveOfflineSyncSnapshot(accountA, { mutations: [{ synthetic: "A" }] });
await offline.saveOfflineSyncSnapshot(accountB, { mutations: [{ synthetic: "B" }] });
const privateStoreNames = ["sync-snapshots", "notebook-images", "notebook-drafts", "notebook-projects"];
const recoveryA = await offline.offlineAccountRecoverySnapshot(accountA);
assert.equal(recoveryA.accountUserID, accountA);
assert.ok(recoveryA.drafts.length > 0);
assert.ok(recoveryA.images.length > 0);
for (const records of [recoveryA.drafts, recoveryA.images, recoveryA.projects]) {
  assert.ok(records.every((record) => record.accountUserID === accountA), "Account recovery must exclude every other owner's record.");
}
assert.ok(recoveryA.images.every((record) => record.blob instanceof Blob), "Recovery must retain original image blobs for export.");
const beforeRemoval = Object.fromEntries(privateStoreNames.map((name) => [name, structuredClone([...database.stores.get(name)])]));
await offline.removeOfflineLibrary();
for (const name of privateStoreNames) assert.deepEqual([...database.stores.get(name)], beforeRemoval[name], `Removing downloaded codes must preserve ${name}.`);
for (const name of ["metadata", "chapters", "sections"]) assert.equal(database.stores.get(name).size, 0);

// A writer that started earlier but reaches IndexedDB after confirmed deletion
// must see the durable tombstone. This also represents an old tab reopening DB.
const releaseOldWriter = database.holdNextOpen();
const oldWriter = offline.saveNotebookDraft({ ...input(accountA, "late-card"), document: document("Late A completion") });
const oldWriterRejected = assert.rejects(oldWriter, (error) => error.code === "OFFLINE_ACCOUNT_DELETED");
await offline.deleteOfflineAccountData(accountA);
releaseOldWriter();
await oldWriterRejected;
assert.ok(database.stores.get("deleted-accounts").has(accountA));
for (const name of privateStoreNames) {
  assert.ok([...database.stores.get(name).values()].every((record) => (record.accountUserID || record.userID) !== accountA));
  assert.ok([...database.stores.get(name).values()].some((record) => (record.accountUserID || record.userID) === accountB), `Deleting A must preserve B's ${name}.`);
}
for (const operation of [
  () => offline.offlineAccountRecoverySnapshot(accountA),
  () => offline.saveNotebookDraft(input(accountA)),
  () => offline.loadNotebookDraft(accountA, projectID, "keep-card"),
  () => offline.pendingNotebookDrafts(accountA),
  () => offline.pendingNotebookImages(accountA),
  () => offline.notebookImagesForProject(accountA, projectID, "keep-card"),
  () => offline.stageNotebookImage({ accountUserID: accountA, projectID, assetID: "late-image", blob: new Blob(["late"]) }),
  () => offline.saveNotebookProjectSnapshot({ accountUserID: accountA, projectID, foundation: {}, cardPayload: {} }),
  () => offline.saveNotebookCardSnapshot(accountA, projectID, { id: "late-card" }),
  () => offline.loadNotebookProjectSnapshot(accountA, projectID),
  () => offline.notebookImageRecord(`permitext-notebook-local:${accountA}-image`, accountA),
  () => offline.markNotebookImageUploaded(`permitext-notebook-local:${accountA}-image`, { url: "synthetic" }, accountA)
]) await assert.rejects(operation, (error) => error.code === "OFFLINE_ACCOUNT_DELETED");
assert.equal(await offline.markNotebookImageUploaded(`permitext-notebook-local:${accountA}-image`, { url: "synthetic" }), null, "An obsolete upload completion cannot recreate a deleted record.");
assert.ok((await offline.pendingNotebookDrafts(accountB)).length);
assert.ok((await offline.pendingNotebookImages(accountB)).length);
await offline.removeOfflineLibrary();
assert.ok(database.stores.get("deleted-accounts").has(accountA), "Public download cleanup cannot remove account deletion tombstones.");
database.stores.get("metadata").set("active-library", { key: "active-library", installID: "replacement-install" });
await assert.rejects(() => offline.saveOfflineSyncSnapshot(accountA, { mutations: [] }), (error) => error.code === "OFFLINE_ACCOUNT_DELETED");
await assert.rejects(() => offline.loadOfflineSyncSnapshot(accountA), (error) => error.code === "OFFLINE_ACCOUNT_DELETED");
assert.ok(await offline.loadOfflineSyncSnapshot(accountB));
const rollbackAccount = "web:rollback-synthetic";
await offline.saveNotebookDraft(input(rollbackAccount));
database.failPut = (name, record) => name === "deleted-accounts" && record.accountUserID === rollbackAccount;
await assert.rejects(() => offline.deleteOfflineAccountData(rollbackAccount), /Synthetic IndexedDB write failure/);
database.failPut = null;
assert.equal(database.stores.get("deleted-accounts").has(rollbackAccount), false);
assert.ok(await offline.loadNotebookDraft(rollbackAccount, projectID, ""), "Failed account cleanup must roll back data removal and its tombstone together.");
assert.ok(database.transactions.filter((transaction) => transaction.names.some((name) => privateStoreNames.includes(name))).every((transaction) => transaction.names.includes("deleted-accounts")), "Every private data transaction must include the tombstone store.");

console.log("Permitext offline Notebook durability contract passed (transactional in-memory IndexedDB boundary).");
