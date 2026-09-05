import * as storage from "/offline-storage.js";
const allowed = new Set(["saveNotebookDraft", "loadNotebookDraft", "beginNotebookDraftSave", "acknowledgeNotebookDraft",
  "pendingNotebookDrafts", "saveNotebookProjectSnapshot", "saveNotebookCardSnapshot", "loadNotebookProjectSnapshot", "stageNotebookImage",
  "resolveNotebookDraftCopiesAfterReview", "rebaseNotebookDraftAfterReview",
  "markNotebookImageUploaded", "notebookImageRecord", "offlineAccountRecoverySnapshot", "deleteOfflineAccountData", "removeOfflineLibrary"]);
addEventListener("message", async (event) => {
  if (event.origin !== location.origin || event.source !== parent || !allowed.has(event.data?.method)) return;
  const { id, method, args } = event.data;
  try {
    const result = await storage[method](...args);
    parent.postMessage({ id, result }, location.origin);
  } catch (error) {
    parent.postMessage({ id, error: { message: error.message, code: error.code } }, location.origin);
  }
});
parent.postMessage({ ready: true }, location.origin);
