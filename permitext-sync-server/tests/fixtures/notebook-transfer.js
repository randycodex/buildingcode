import { stageNotebookImage, markNotebookImageUploaded, markNotebookImageUploadError, notebookImageRecord,
  saveNotebookDraft, beginNotebookDraftSave, offlineAccountRecoverySnapshot, acknowledgeNotebookDraft,
  saveNotebookCardSnapshot } from "/offline-storage.js";
const key = "synthetic-notebook-transfer", png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=";
let evidence = JSON.parse(localStorage.getItem(key) || "null");
const loadedPhase = evidence?.phase;
const status = document.querySelector("#status"), report = document.querySelector("#report");
function assert(value, message) { if (!value) throw new Error(message); }
function activeAccount() { return evidence?.account; }
function captureAccountRequest() { return { userID: activeAccount().userID, generation: 1 }; }
function requireCurrentAccountRequest(identity) { assert(identity.userID === activeAccount().userID, "Account changed"); }
function requirePrivateWorkspaceWritable() { assert(activeAccount(), "No synthetic account"); }
function accountContextChangedError() { return new Error("Synthetic account changed"); }
function responseErrorMessage(payload, fallback) { return payload.error || fallback; }
async function refreshNotebookPendingStatus() {}
async function postResearch(path, body) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json",
    authorization: `Bearer ${activeAccount().sessionToken}` }, body: JSON.stringify({ auth: { accountUserID: activeAccount().userID }, ...body }) });
  const payload = await response.json(); assert(response.ok, payload.error || "Note save failed"); return payload;
}
function display() {
  if (!evidence) { report.textContent = ""; return; }
  const { account, expectedDraft, ...safe } = evidence;
  report.textContent = JSON.stringify(safe, null, 2);
}
function record(name, phase) {
  evidence.cases.push(name); evidence.phase = phase; localStorage.setItem(key, JSON.stringify(evidence)); display();
}
async function retained() {
  const snapshot = await offlineAccountRecoverySnapshot(activeAccount().userID);
  assert(snapshot.drafts.length === 1 && snapshot.images.length === 1, "Draft/image missing");
  assert(JSON.stringify(snapshot.drafts[0]) === JSON.stringify(evidence.expectedDraft), "Pending draft changed before acknowledgment");
  const bytes = new Uint8Array(await snapshot.images[0].blob.arrayBuffer());
  assert(btoa(String.fromCharCode(...bytes)) === png, "Original PNG bytes changed");
  assert(snapshot.images[0].permanentURL === null, "Unacknowledged image marked uploaded");
  return snapshot;
}
async function rejectedUpload() {
  const image = await notebookImageRecord(evidence.localURL, activeAccount().userID);
  let rejected = false;
  try { await uploadPendingNotebookImage(image); } catch (error) {
    rejected = true; await markNotebookImageUploadError(image.localURL, error.message);
  }
  assert(rejected, "Expected actual transport failure");
  await retained();
  assert(await synchronizeNotebookDraft(evidence.expectedDraft) === null, "Note saved before image acknowledgment");
}
async function prepare() {
  assert(!evidence, "Clean up the existing fixture first");
  const response = await fetch("/fixture/setup", { method: "POST" }); assert(response.ok, "Setup failed");
  evidence = { ...await response.json(), startedAt: new Date().toISOString(), cases: [] };
  const blob = new Blob([Uint8Array.from(atob(png), char => char.charCodeAt(0))], { type: "image/png" });
  const image = await stageNotebookImage({ accountUserID: activeAccount().userID, projectID: evidence.projectID,
    cardID: "", assetID: crypto.randomUUID(), blob, name: "synthetic-transfer.png" });
  evidence.localURL = image.localURL;
  await saveNotebookDraft({ accountUserID: activeAccount().userID, projectID: evidence.projectID, cardID: "",
    title: "Synthetic interrupted-transfer Note", baseVersion: 0, document: { schema: "permitext-notebook-card", schemaVersion: 2,
      format: "blocknote-json", document: [
        { type: "paragraph", content: [{ type: "text", text: "Retain this Note until its image and card are both saved.", styles: {} }], children: [] },
        { type: "image", props: { url: image.localURL, name: "Synthetic pixel" }, children: [] }
      ] } });
  // The real synchronization handler creates its pending-save journal only
  // after local image references resolve. Do not manufacture an earlier journal.
  evidence.expectedDraft = (await offlineAccountRecoverySnapshot(activeAccount().userID)).drafts[0];
  await rejectedUpload();
  const server = await (await fetch("/fixture/state")).json();
  assert(server.transfers.length > 0 && server.transfers.every(item => item.mode === "cut-body" && item.receivedBytes === 32 && item.declaredBytes === 68 && item.aborted && !item.complete && item.handlerFinished), "Actual mid-body interruption not observed for every browser transport retry");
  assert(server.images === 0 && server.cards === 0, "Partial upload produced a committed artifact");
  evidence.partial = server; record("32 of 68 bytes reached the app before socket loss; exact draft/PNG retained and Note save withheld", "partial");
  status.textContent = "First interruption passed. Reload this page, then retry and lose the saved response.";
}
async function loseReply() {
  assert(loadedPhase === "partial", "Reload after the first interruption"); await retained();
  await fetch("/fixture/lost-reply", { method: "POST" }); await rejectedUpload();
  const server = await (await fetch("/fixture/state")).json();
  const savedAttempts = server.transfers.filter(item => item.mode === "lose-reply");
  assert(server.images === 1 && server.cards === 0 && savedAttempts.length > 0 && savedAttempts.every(item => item.replyDiscarded && item.receivedBytes === 68 && item.complete && item.handlerFinished && item.status === 200) && server.file.size === 68, "Lost saved response not observed for every browser transport retry");
  evidence.savedWithoutReceipt = server; record("After reload the server saves the full image, but a lost response leaves the original local image/draft pending", "lost-reply");
  status.textContent = "Lost-response check passed. Reload again, then recover and save the Note.";
}
async function recover() {
  assert(loadedPhase === "lost-reply", "Reload after the lost response"); await retained();
  await fetch("/fixture/retry", { method: "POST" });
  const asset = await uploadPendingNotebookImage(await notebookImageRecord(evidence.localURL, activeAccount().userID));
  const saved = await synchronizeNotebookDraft(evidence.expectedDraft); assert(saved?.card?.version === 1, "Note did not save once");
  const remaining = await offlineAccountRecoverySnapshot(activeAccount().userID);
  assert(remaining.drafts.length === 0, "Acknowledged draft remains pending");
  assert(JSON.stringify(saved.card).includes(asset.url) && !JSON.stringify(saved.card).includes("permitext-notebook-local:"), "Saved Note image reference is unresolved");
  const response = await fetch("/notebook/assets/read", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${activeAccount().sessionToken}` },
    body: JSON.stringify({ auth: { accountUserID: activeAccount().userID }, projectID: evidence.projectID, assetID: asset.assetID }) });
  assert(response.ok && btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer()))) === png, "Server image bytes differ");
  const server = await (await fetch("/fixture/state")).json();
  assert(server.images === 1 && server.cards === 1 && server.file.filesInDirectory === 1, "Retry duplicated image/card/file");
  assert(server.file.uploadedAt === evidence.savedWithoutReceipt.file.uploadedAt && server.file.sha256 === evidence.savedWithoutReceipt.file.sha256, "Retry replaced the already committed image");
  evidence.completedAt = new Date().toISOString(); evidence.final = server;
  record("Second reload and same-identity retry recover one original image and one Note, then acknowledge the draft; downloaded bytes match", "complete");
  status.textContent = "All three real-transport phases passed. No duplicate files or Notes; cleanup is ready.";
}
async function cleanup() {
  await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase("permitext-offline"); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
  localStorage.removeItem(key); evidence = null; display(); status.textContent = "Synthetic browser database and fixture checkpoint removed.";
}
for (const [id, action] of [["prepare", prepare], ["lost", loseReply], ["recover", recover], ["cleanup", cleanup]]) {
  document.querySelector("#" + id).addEventListener("click", async event => {
    event.target.disabled = true;
    try { await action(); } catch (error) { status.textContent = "FAIL — " + error.message; display(); }
    finally { event.target.disabled = false; }
  });
}
display();
