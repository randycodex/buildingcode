import * as storage from "/offline-storage.js";
const allowed = new Set(["saveNotebookDraft", "loadNotebookDraft", "beginNotebookDraftSave", "acknowledgeNotebookDraft",
  "pendingNotebookDrafts", "saveNotebookProjectSnapshot", "saveNotebookCardSnapshot", "loadNotebookProjectSnapshot", "stageNotebookImage",
  "resolveNotebookDraftCopiesAfterReview", "rebaseNotebookDraftAfterReview",
  "markNotebookImageUploaded", "notebookImageRecord", "offlineAccountRecoverySnapshot", "deleteOfflineAccountData", "removeOfflineLibrary",
  "disableOfflineFeature", "fixtureFailedPublicCleanup"]);

// Fault injection exists only on this dedicated synthetic origin. The actual
// cleanup function and browser IndexedDB/CacheStorage implementations still run.
async function fixtureFailedPublicCleanup(kind) {
  if (kind === "database") {
    const clear = IDBObjectStore.prototype.clear;
    let injected = false;
    IDBObjectStore.prototype.clear = function () {
      const request = clear.call(this);
      if (this.name === "sections") { injected = true; this.transaction.abort(); }
      return request;
    };
    try { await storage.disableOfflineFeature(); }
    catch (error) { if (injected) return { injected, rejected: true, message: error.message }; throw error; }
    finally { IDBObjectStore.prototype.clear = clear; }
  } else if (kind === "cache") {
    const name = "permitext-pro-synthetic-cleanup";
    const cache = await caches.open(name);
    await cache.put("/synthetic-cleanup", new Response("disposable public cache"));
    const remove = CacheStorage.prototype.delete;
    let injected = false;
    CacheStorage.prototype.delete = function (key) {
      if (key === name) { injected = true; return Promise.reject(new Error("Synthetic CacheStorage cleanup failure")); }
      return remove.call(this, key);
    };
    try { await storage.disableOfflineFeature(); }
    catch (error) { if (injected) return { injected, rejected: true, message: error.message }; throw error; }
    finally { CacheStorage.prototype.delete = remove; }
  } else throw new Error("Unknown synthetic cleanup failure");
  throw new Error("Expected cleanup failure was not exercised");
}
addEventListener("message", async (event) => {
  if (event.origin !== location.origin || event.source !== parent || !allowed.has(event.data?.method)) return;
  const { id, method, args } = event.data;
  try {
    const result = await (method === "fixtureFailedPublicCleanup" ? fixtureFailedPublicCleanup : storage[method])(...args);
    parent.postMessage({ id, result }, location.origin);
  } catch (error) {
    parent.postMessage({ id, error: { message: error.message, code: error.code } }, location.origin);
  }
});
parent.postMessage({ ready: true }, location.origin);
