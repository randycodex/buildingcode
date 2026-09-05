const button = document.querySelector("#run");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const report = document.querySelector("#report");
let demoClient;
if (location.search === "?client") {
  document.querySelector("main").remove();
  await import("/client.js");
} else button.addEventListener("click", run);

async function client() {
  const frame = document.createElement("iframe");
  frame.title = "Independent draft client";
  const pending = new Map();
  let ready;
  const loaded = new Promise((resolve) => { ready = resolve; });
  const listener = (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.ready) { ready(); return; }
    const task = pending.get(event.data?.id);
    if (!task) return;
    pending.delete(event.data.id);
    clearTimeout(task.timeout);
    if (event.data.error) task.reject(Object.assign(new Error(event.data.error.message), { code: event.data.error.code }));
    else task.resolve(event.data.result);
  };
  addEventListener("message", listener);
  frame.src = "/?client";
  document.body.append(frame);
  await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error("Client did not initialize")), 10000))]);
  return {
    call(method, ...args) {
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10000);
        pending.set(id, { resolve, reject, timeout });
        frame.contentWindow.postMessage({ id, method, args }, location.origin);
      });
    },
    close() { frame.remove(); removeEventListener("message", listener); }
  };
}
function assert(value, message) { if (!value) throw new Error(message); }
async function run() {
  demoClient?.close();
  button.disabled = true;
  results.replaceChildren();
  status.textContent = "Running…";
  const evidence = { startedAt: new Date().toISOString(), engine: navigator.userAgent, cases: [] };
  const clients = [];
  try {
    const a = await client(); const b = await client(); clients.push(a, b);
    const owner = `fixture-${crypto.randomUUID()}`;
    const other = `fixture-${crypto.randomUUID()}`;
    const projectID = "synthetic-project";
    const draft = (cardID, text, extra = {}) => ({ accountUserID: owner, projectID, cardID, baseVersion: 1,
      title: text, document: { text }, evidenceLinks: [], ...extra });
    async function check(name, action) {
      const row = document.createElement("li");
      results.append(row);
      try { await action(); row.className = "pass"; row.textContent = `PASS — ${name}`; evidence.cases.push({ name, passed: true }); }
      catch (error) { row.className = "fail"; row.textContent = `FAIL — ${name}: ${error.message}`; evidence.cases.push({ name, passed: false, error: error.message }); }
    }
    await check("Stale offline editor preserves both authors' unsent text", async () => {
      const initial = await a.call("saveNotebookDraft", draft("same-card", "Original", { expectedRevision: null }));
      const stale = await b.call("loadNotebookDraft", owner, projectID, "same-card");
      await a.call("saveNotebookDraft", draft("same-card", "Independent newer A", { expectedRevision: initial.revision }));
      await b.call("saveNotebookDraft", draft("same-card", "Independent stale B", { expectedRevision: stale.revision }));
      const records = await a.call("pendingNotebookDrafts", owner);
      const serialized = JSON.stringify(records);
      assert(serialized.includes("Independent newer A") && serialized.includes("Independent stale B"), "One writer's unsent text was lost");
      const current = await b.call("loadNotebookDraft", owner, projectID, "same-card");
      let blocked = false;
      try { await a.call("beginNotebookDraftSave", owner, projectID, "same-card", current.revision); }
      catch (error) { blocked = error.code === "OFFLINE_DRAFT_RECOVERY_REQUIRED"; }
      assert(blocked, "Conflicting local drafts must pause automatic sync");
      let staleReviewRejected = false;
      try { await b.call("resolveNotebookDraftCopiesAfterReview", owner, projectID, "same-card", stale.revision); }
      catch (error) { staleReviewRejected = error.code === "OFFLINE_DRAFT_REVISION_CHANGED"; }
      assert(staleReviewRejected, "Stale review removed a newer device version");
      let serverReviewRejected = false;
      try { await a.call("rebaseNotebookDraftAfterReview", owner, projectID, "same-card", current.revision, { id: "same-card", version: 8 }); }
      catch (error) { serverReviewRejected = error.code === "OFFLINE_DRAFT_RECOVERY_REQUIRED"; }
      assert(serverReviewRejected, "Server review bypassed unreviewed local versions");
      const resolved = await a.call("resolveNotebookDraftCopiesAfterReview", owner, projectID, "same-card", current.revision);
      assert(resolved.document.text === "Independent stale B" && !resolved.recoveryConflict, "Explicit review did not retain the chosen version");
    });
    await check("Acknowledgement retains a newer edit from another context", async () => {
      const first = await a.call("saveNotebookDraft", draft("ack-card", "Submitted"));
      await a.call("beginNotebookDraftSave", owner, projectID, "ack-card", first.revision);
      await b.call("saveNotebookDraft", draft("ack-card", "Newer while request in flight", { expectedRevision: first.revision }));
      await a.call("acknowledgeNotebookDraft", owner, projectID, "ack-card", first.revision, { id: "ack-card", version: 2 });
      const current = await b.call("loadNotebookDraft", owner, projectID, "ack-card");
      assert(current.document.text === "Newer while request in flight" && current.baseVersion === 2, "Newer edit or acknowledged version lost");
    });
    await check("Concurrent first checkpoints preserve both drafts", async () => {
      await Promise.all([a.call("saveNotebookDraft", draft("new-shared", "First writer", { expectedRevision: null })),
        b.call("saveNotebookDraft", draft("new-shared", "Second writer", { expectedRevision: null }))]);
      const record = await a.call("loadNotebookDraft", owner, projectID, "new-shared");
      assert(JSON.stringify(record).includes("First writer") && JSON.stringify(record).includes("Second writer"), "Simultaneous first checkpoints lost a version");
    });
    await check("Creation acknowledgement cannot overwrite a different canonical-ID draft", async () => {
      const first = await a.call("saveNotebookDraft", draft("", "Submitted creation", { baseVersion: 0 }));
      await a.call("beginNotebookDraftSave", owner, projectID, "", first.revision);
      await a.call("saveNotebookDraft", draft("", "Newer creation", { baseVersion: 0, expectedRevision: first.revision }));
      await b.call("saveNotebookDraft", draft("canonical", "Other canonical draft"));
      const result = await a.call("acknowledgeNotebookDraft", owner, projectID, "", first.revision, { id: "canonical", version: 1 });
      assert(result.conflict && result.draft.document.text === "Newer creation", "The unsubmitted creation was lost");
      assert((await b.call("loadNotebookDraft", owner, projectID, "canonical")).document.text === "Other canonical draft", "The canonical-ID draft was overwritten");
    });
    await check("Concurrent card cache writes retain both cards", async () => {
      await a.call("saveNotebookProjectSnapshot", { accountUserID: owner, projectID, foundation: {}, cardPayload: { cards: [] } });
      await Promise.all([a.call("saveNotebookCardSnapshot", owner, projectID, { id: "cache-a", document: { text: "A" } }),
        b.call("saveNotebookCardSnapshot", owner, projectID, { id: "cache-b", document: { text: "B" } })]);
      const cached = await a.call("loadNotebookProjectSnapshot", owner, projectID);
      assert(cached.cardDocuments["cache-a"] && cached.cardDocuments["cache-b"], "One cached card was lost");
    });
    await check("Public library cleanup and client restart preserve drafts and image bytes", async () => {
      const record = await a.call("stageNotebookImage", { accountUserID: owner, projectID, cardID: "image-card",
        assetID: crypto.randomUUID(), blob: new Blob(["synthetic image bytes"], { type: "image/png" }), name: "fixture.png" });
      await b.call("removeOfflineLibrary");
      const fresh = await client(); clients.push(fresh);
      const snapshot = await fresh.call("offlineAccountRecoverySnapshot", owner);
      assert(snapshot.drafts.length >= 2, "Drafts missing after public cleanup");
      const image = snapshot.images.find((item) => item.localURL === record.localURL);
      assert(image && await image.blob.text() === "synthetic image bytes", "Queued image bytes missing after restart");
    });
    await check("Deletion persists across client restart and rejects stale writes without touching another account", async () => {
      await b.call("saveNotebookDraft", draft("other-card", "Other account", { accountUserID: other }));
      await a.call("deleteOfflineAccountData", owner);
      const fresh = await client(); clients.push(fresh);
      let rejected = false;
      try { await fresh.call("saveNotebookDraft", draft("late", "Must not reappear")); }
      catch (error) { rejected = error.code === "OFFLINE_ACCOUNT_DELETED"; }
      assert(rejected, "A restarted stale client recreated deleted private data");
      assert((await b.call("pendingNotebookDrafts", other)).length === 1, "Another account's draft was affected");
    });
    evidence.passed = evidence.cases.every((item) => item.passed);
    status.textContent = `${evidence.cases.filter((item) => item.passed).length}/${evidence.cases.length} checks passed`;
  } catch (error) { evidence.error = error.message; status.textContent = `Fixture failed: ${error.message}`; }
  finally {
    evidence.finishedAt = new Date().toISOString();
    report.textContent = JSON.stringify(evidence, null, 2);
    clients.forEach((item) => item.close());
    button.disabled = false;
  }
  await showReviewExample();
}

async function showReviewExample() {
  const host = document.querySelector("#review");
  host.replaceChildren();
  demoClient = await client();
  const owner = `fixture-review-${crypto.randomUUID()}`;
  const noteDocument = (text) => ({ format: "blocknote-json", document: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  const base = { accountUserID: owner, projectID: "review-example", cardID: "note", title: "Site visit notes", baseVersion: 1 };
  await demoClient.call("saveNotebookDraft", { ...base, document: noteDocument("First tab: confirm the cellar ceiling height."), expectedRevision: null });
  const current = await demoClient.call("saveNotebookDraft", { ...base, document: noteDocument("Current editor: check the stair width on level two."), expectedRevision: null });
  globalThis.isCurrentAccountRequest = () => true;
  globalThis.confirmWebWarning = (title, text, options) => new Promise((resolve) => {
    const dialog = window.document.querySelector("#confirmation");
    window.document.querySelector("#confirmation-title").textContent = title;
    window.document.querySelector("#confirmation-body").textContent = text;
    const accept = window.document.querySelector("#confirm");
    accept.textContent = options.confirmLabel;
    accept.onclick = () => { dialog.close(); resolve(true); };
    window.document.querySelector("#cancel").onclick = () => { dialog.close(); resolve(false); };
    dialog.oncancel = () => resolve(false);
    dialog.showModal();
  });
  appendNotebookDraftCopyReview(host, current, { userID: owner }, async (revision) => {
    const resolved = await demoClient.call("resolveNotebookDraftCopiesAfterReview", owner, base.projectID, base.cardID, revision);
    assert(!resolved.recoveryCopies && resolved.document.document[0].content[0].text.includes("Current editor:"), "Review selected the wrong version");
    host.textContent = "Reviewed: current editor version retained. Server version still requires checking before sync.";
  });
}
import { appendNotebookDraftCopyReview } from "/review-ui.js";
