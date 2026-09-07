import { accountContextChangedError, accountRequestIdentity, accountRequestIsCurrent, accountLinkRecoverySources,
  confirmedAccountLinkRecovery, recordConfirmedAccountLinkRecovery, privateWorkspacePrefix, privateWorkspaceRecoverySnapshot } from "/private-workspace-state.js";
import { readCodeQuestionAccountState } from "/code-question-client-state.js";
import { offlineAccountRecoverySnapshot, saveNotebookDraft, beginNotebookDraftSave, stageNotebookImage } from "/offline-storage.js";

// Only view hydration/background sync are adapters. Actual account guards,
// confirmed-ancestry handling, storage reads, Blob conversion and download UI
// above are extracted directly from app.js each time the fixture server starts.
let state = { account: null, syncOutbox: [] }, accountRuntimeGeneration = 1, codeQuestionUnauthorizedAccountUserID = "";
const sessionAccountLinkRecoveries = new Map();
function persistCodeQuestionAccountState() {}
function replaceActiveAccount(account) { state = { account, syncOutbox: [] }; accountRuntimeGeneration += 1; }
function saveWorkspaceState() {}
async function refreshNotebookPendingStatus() {}
async function reconcileOfflineFeatureAccess() {}
function hasCapability() { return false; }
async function loadSyncedContent() {}
async function flushSyncOutbox() { assert(state.syncOutbox.length === 0, "Source work was queued in the destination"); }
async function flushCodeQuestionOutbox() {}
function renderWorkspace() {}
function assert(value, message) { if (!value) throw new Error(message); }
const fixtureKey = "synthetic-link-recovery-fixture";
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=";
const sourceText = "Synthetic source draft retained after a lost account-link response.";
const sourceLateText = "Synthetic later source edit remains export-only.";
const prefixKey = "permitext:webWorkspace:v1";
const status = document.querySelector("#status"), checks = document.querySelector("#checks"), report = document.querySelector("#report");
let evidence = JSON.parse(localStorage.getItem(fixtureKey) || "null");
function record(name) {
  evidence.cases.push(name);
  const row = document.createElement("li"); row.className = "pass"; row.textContent = "PASS — " + name; checks.append(row);
  report.textContent = JSON.stringify(evidence, null, 2);
  localStorage.setItem(fixtureKey, JSON.stringify(evidence));
}
async function signIn(provider, providerUserID, linkFrom, credentialExtra = {}) {
  const response = await fetch("/account/sign-in", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential: { provider, providerUserID, ...credentialExtra }, linkFrom }) });
  const payload = await response.json();
  assert(response.ok, payload.error || "Synthetic sign-in failed");
  return payload;
}
async function writeLateSource(owner) {
  const image = await stageNotebookImage({ accountUserID: owner, projectID: "synthetic-source-project", cardID: "synthetic-source-card",
    assetID: crypto.randomUUID(), blob: new Blob([Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0))], { type: "image/png" }), name: "synthetic-pixel.png" });
  const draft = await saveNotebookDraft({ accountUserID: owner, projectID: image.projectID, cardID: image.cardID,
    title: "Synthetic retained source Note", document: { text: sourceText, imageURL: image.localURL }, baseVersion: 3 });
  await beginNotebookDraftSave(owner, image.projectID, image.cardID, draft.revision);
  localStorage.setItem(privateWorkspacePrefix(owner) + prefixKey, JSON.stringify({ account: { userID: owner,
    sessionToken: "synthetic-do-not-export", nested: { authorization: "synthetic-do-not-export" } },
    syncOutbox: [{ id: "synthetic-source-outbox", ownerUserID: owner, text: sourceText }] }));
  localStorage.setItem("permitext:webWorkspace:v1", JSON.stringify({ text: "synthetic-unattributed-legacy" }));
  return { draft: (await offlineAccountRecoverySnapshot(owner)).drafts[0], imageURL: image.localURL,
    workspaceRaw: localStorage.getItem(privateWorkspacePrefix(owner) + prefixKey) };
}
if (location.search === "?cleanup") {
  await cleanup();
} else if (location.search === "?writer") {
  document.querySelector("main").remove();
  addEventListener("message", async (event) => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.method !== "write-late-source") return;
    try { parent.postMessage({ result: await writeLateSource(event.data.owner) }, location.origin); }
    catch (error) { parent.postMessage({ error: error.message }, location.origin); }
  });
  parent.postMessage({ ready: true }, location.origin);
} else {
  document.querySelector("#recover").disabled = !evidence?.prepared;
  if (evidence) report.textContent = JSON.stringify(evidence, null, 2);
  for (const [id, action] of [["prepare", prepare], ["recover", recover], ["verify", verify], ["cleanup", cleanup]]) {
    document.querySelector("#" + id).addEventListener("click", async (event) => {
      event.target.disabled = true;
      try { await action(); } catch (error) { status.textContent = "FAIL — " + error.message; report.textContent += "\n" + error.stack; }
      finally { event.target.disabled = false; }
    });
  }
}
async function prepare() {
  assert(!evidence, "Clean up the prior fixture before starting another run");
  const runID = crypto.randomUUID();
  evidence = { runID, startedAt: new Date().toISOString(), engine: navigator.userAgent, cases: [] };
  const source = await signIn("web", "synthetic-source-" + runID);
  storeSignedInAccount(source);
  evidence.sourceUserID = source.account.appUserID;
  evidence.targetProviderID = "synthetic-target-" + runID;
  // The successful response is deliberately never handed to the application's
  // storeSignedInAccount. Late bytes arrive from an independent stale context
  // after the merge; this does not bypass or weaken the normal link preflight.
  await signIn("apple", evidence.targetProviderID, { accountUserID: source.account.appUserID, sessionToken: source.account.backendSessionToken });
  assert(sessionAccountLinkRecoveries.size === 0, "Lost receipt accidentally reached the client");
  record("Actual local HTTP link succeeds while its client receipt is discarded");
  const frame = document.createElement("iframe"); frame.title = "Independent late source writer";
  evidence.expected = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { removeEventListener("message", listener); reject(new Error("Late writer timed out")); }, 10000);
    const listener = (event) => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.ready) frame.contentWindow.postMessage({ method: "write-late-source", owner: evidence.sourceUserID }, location.origin);
      else if (event.data?.result || event.data?.error) {
        clearTimeout(timeout); removeEventListener("message", listener);
        if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result);
      }
    };
    addEventListener("message", listener); frame.src = "/?writer"; document.body.append(frame);
  });
  frame.remove();
  record("Independent source context retains a real draft, pending-save journal and PNG bytes after the link");
  const unrelated = await signIn("web", "synthetic-unrelated-" + runID, undefined, { mergedAccountIDs: [evidence.sourceUserID] });
  storeSignedInAccount(unrelated);
  assert(unrelated.confirmedLinkedAccountIDs.length === 0, "Untrusted credential metadata created ancestry");
  assert(linkedAccountRecoverySources().length === 0, "Unrelated account received a recovery control");
  let denied = false;
  try { await linkedAccountRecoveryBundle(evidence.sourceUserID); } catch (error) { denied = /no confirmed link/.test(error.message); }
  assert(denied, "Unrelated account could read source work");
  record("Unrelated authenticated account and forged credential ancestry cannot export source work");
  evidence.prepared = true; localStorage.setItem(fixtureKey, JSON.stringify(evidence));
  status.textContent = "Prepared. Reload this page to discard all in-memory account and link state, then choose Recover after reload.";
  document.querySelector("#recover").disabled = false;
}
async function recover() {
  assert(!state.account && sessionAccountLinkRecoveries.size === 0, "Reload the page before recovering");
  const target = await signIn("apple", evidence.targetProviderID);
  assert(target.mergedAccount === null, "Fresh sign-in unexpectedly performed another merge");
  assert(JSON.stringify(target.confirmedLinkedAccountIDs) === JSON.stringify([evidence.sourceUserID]), "Server checkpoint did not restore exact source ancestry");
  assert(accountLinkRecoverySources(localStorage, target.account.appUserID).length === 0, "Target had a saved client receipt before recovery");
  storeSignedInAccount(target);
  evidence.targetUserID = target.account.appUserID;
  assert(linkedAccountRecoverySources().length === 1, "Actual sign-in handler did not restore recovery");
  record("Fresh sign-in after reload reconstructs exact source access from the server checkpoint alone");
  localStorage.setItem(privateWorkspacePrefix(evidence.sourceUserID) + "late-after-recovery", JSON.stringify({ text: sourceLateText }));
  document.querySelector("#recovery").replaceChildren();
  appendLinkedAccountRecoveryControls(document.querySelector("#recovery"));
  status.textContent = "Use the application's Export retained source work button, then Verify export and isolation.";
  document.querySelector("#verify").disabled = false;
}
async function verify() {
  assert(document.querySelector("#recovery").textContent.includes("Recovery file downloaded."), "Click the actual export button first");
  const bundle = await linkedAccountRecoveryBundle(evidence.sourceUserID);
  assert(bundle.access === "export-only" && bundle.confirmedDestinationUserID === evidence.targetUserID, "Recovery owner mismatch");
  assert(JSON.stringify(bundle.offline.drafts[0]) === JSON.stringify(evidence.expected.draft), "Draft or exact pending-save journal changed");
  assert(bundle.offline.images[0].dataURL === "data:image/png;base64," + pngBase64, "PNG bytes changed");
  assert(bundle.workspaces.local["late-after-recovery"].text === sourceLateText, "Later source arrival missing");
  const serialized = JSON.stringify(bundle);
  assert(!serialized.includes("synthetic-do-not-export") && !serialized.includes("synthetic-unattributed-legacy"), "Credential or unowned legacy data exported");
  record("Export contains the exact retained draft/journal, original PNG bytes and later source edit; excludes credentials and ambiguous legacy data");
  const source = await offlineAccountRecoverySnapshot(evidence.sourceUserID);
  const destination = await offlineAccountRecoverySnapshot(evidence.targetUserID);
  assert(JSON.stringify(source.drafts[0]) === JSON.stringify(evidence.expected.draft), "Export changed source draft");
  assert(localStorage.getItem(privateWorkspacePrefix(evidence.sourceUserID) + prefixKey) === evidence.expected.workspaceRaw, "Export rewrote source workspace");
  assert(destination.drafts.length === 0 && destination.images.length === 0 && state.syncOutbox.length === 0, "Export moved work into the destination");
  const requests = await (await fetch("/fixture-requests")).json();
  assert(requests.length === 4 && requests.every((entry) => entry.path === "/account/sign-in"), "Unexpected request or automatic replay");
  evidence.requests = requests; evidence.completedAt = new Date().toISOString();
  record("Source namespaces remain intact; destination has no drafts/images/outbox and server saw only four sign-in requests");
  status.textContent = "All 6 checks passed. Inspect the downloaded JSON as the independent file receipt, then clean up this fixture.";
}
async function cleanup() {
  await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase("permitext-offline"); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
  localStorage.clear(); sessionStorage.clear();
  evidence = null; state = { account: null, syncOutbox: [] }; sessionAccountLinkRecoveries.clear();
  document.querySelector("#recovery").replaceChildren();
  status.textContent = "Synthetic fixture database, local storage and session storage removed.";
}
