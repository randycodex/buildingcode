import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { accountContextChangedError, accountRequestIdentity, accountRequestIsCurrent,
  accountLinkRecoverySources, confirmedAccountLinkRecovery, recordConfirmedAccountLinkRecovery,
  privateWorkspacePrefix, privateWorkspaceRecoverySnapshot } from "../public/private-workspace-state.js";

// Execute the real application entry points against deferred in-memory I/O.
// UI refresh, persistence and transport adapters are explicit synthetic stubs;
// no browser session, network, provider or production data is used.
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const match = new RegExp("^(?:async )?function " + name + "\\(", "m").exec(source);
  assert.ok(match, name);
  const next = /\n(?:async )?function [\w$]+\(/.exec(source.slice(match.index + match[0].length));
  assert.ok(next, name + " boundary");
  return source.slice(match.index, match.index + match[0].length + next.index);
}
const names = [
  "activeAccount", "captureAccountRequest", "isCurrentAccountRequest", "requireCurrentAccountRequest",
  "mutationKindAndRecord", "enqueueSyncMutation", "pushMutation", "pushMutationBatch",
  "persistProjectOrder", "persistSectionBookmark", "persistSectionInProject", "persistSectionFolderSelection",
  "removeSectionFromAllProjects", "removeSectionFromProject", "scheduleAnnotationPush",
  "archiveProjects", "restoreArchivedProject", "deleteArchivedProjects", "deleteArchivedProjectData",
  "completeClerkPermitextSignIn", "signInCurrentBrowser", "deleteCapturedAccount", "clearDeletedAccountBrowserData",
  "openSupplementalResearchConversation",
  "requirePrivateWorkspaceWritable", "releaseAccountLinkWriteFence", "withAccountLinkWriteFence", "requireAccountLinkWorkSaved",
  "linkedAccountRecoverySources", "linkedAccountRecoveryBundle", "accountLocalRecoveryBundle"
];
const A = { userID: "web:synthetic-a", sessionToken: "synthetic-token-a" };
const B = { userID: "web:synthetic-b", sessionToken: "synthetic-token-b" };
const project = { id: "project-a", userID: A.userID, name: "Synthetic A Project", description: "Synthetic private A facts" };
const section = { sectionID: "100", codeVersion: "synthetic-edition" };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const clone = (value) => JSON.parse(JSON.stringify(value));
function workspace(account) {
  return { account, localProjects: [], localSavedItems: [], localProjectSections: [], localAnnotations: [], syncOutbox: [], syncConflicts: [], archivedProjectIDs: [], utilities: {} };
}
function harness(overrides = {}) {
  const calls = [], saves = [], callbacks = [];
  const c = {
    state: workspace(A), accountRuntimeGeneration: 1, accountLinkWriteFence: null, accountContextChangedError, accountRequestIdentity, accountRequestIsCurrent,
    notebookMounts: new Map(), reportDraftMounts: new Map(), workspaceRestoreError: null, activeResearchProgress: new Map(), pendingNotebookDrafts: async () => [], pendingNotebookImages: async () => [],
    persistCodeQuestionAccountState() {}, sessionAccountLinkRecoveries: new Map(), accountLinkRecoverySources, privateWorkspaceRecoverySnapshot,
    crypto: { randomUUID: () => "synthetic-operation" }, Date, Set, Map,
    saveWorkspaceState: () => saves.push(clone(c.state)), markForegroundSyncActivity() {},
    syncMutationRecordID: (mutation) => Object.values(mutation)[0]?.id || "synthetic-record",
    projectRecordID: (record) => record.id, projectIdentity: (record) => record, workboardProjectID: (record) => record.id,
    projectMutationForRecord: (record, account) => ({ project: { ...record, userID: account.userID } }),
    deletedProjectMutationForRecord: (record) => ({ project: { ...record, userID: c.activeAccount().userID, deletedAt: "now" } }),
    projectSectionRecordForSection: (folder, item) => ({ id: folder.id + ":" + item.sectionID, folderClientID: folder.id, sectionID: item.sectionID, userID: c.activeAccount()?.userID || "local-web" }),
    projectSectionMutationForSection: (folder, item) => ({ projectSection: c.projectSectionRecordForSection(folder, item) }),
    deletedProjectSectionMutationForItem: (folder, item) => ({ projectSection: { ...c.projectSectionRecordForSection(folder, item), deletedAt: "now" } }),
    projectSectionBelongsToProject: (item, folder) => item.folderClientID === folder.id,
    savedEvidenceKey: (item) => String(item.sectionID), savedItemForSection: () => null,
    savedRecordForSection: (item, userID) => ({ ...item, userID, id: "saved:" + item.sectionID }),
    savedMutationForSection: (item) => ({ savedItem: c.savedRecordForSection(item, c.activeAccount()?.userID || "local-web") }),
    deletedSavedMutationForSection: (item) => ({ savedItem: { ...c.savedRecordForSection(item, c.activeAccount()?.userID || "local-web"), deletedAt: "now" } }),
    savedSectionRecord: () => null, isSectionSaved: () => false, isProAccount: () => true, hasCapability: () => true,
    folderIsProject: () => true, syncCodeVersion: (value) => value, defaultSyncCodeVersion: "synthetic-edition",
    setLocalSectionSaved() {}, normalizeAnnotationBlockID: (value) => value || "", syncReaderNoteBookmarkButtons() {},
    currentContentSummary: () => ({ projects: [project], projectSections: [] }),
    transitionWorkspace: async () => {}, refreshProjectMembershipPanes: async () => {}, refreshOpenSavedPanes: async () => {},
    refreshProjectSourceConsumers: async () => {}, refreshVisibleSyncedDerivedState: () => calls.push("derived"),
    isSessionAuthenticationError: (error) => error.status === 401, clearExpiredAccountSession: () => calls.push("clear-session"),
    flushSyncOutbox: async () => ({ acceptedMutationIDs: ["synthetic-record"], rejectedMutationIDs: [], payload: {} }),
    discardLocalMutationOverlay: () => calls.push("discard-overlay"),
    archivedProjectIDSet: () => new Set(c.state.archivedProjectIDs), closeProjectDetailForProject: () => calls.push("close-project"),
    detachedWorkboards: () => [], projectDetailMatches: (left, right) => left.id === right.id, track: { scrollLeft: 0 },
    projectOverviewRefreshPaneIDs: () => [], folderRecordCountLabel: () => "Projects", confirmWebWarning: async () => true,
    showWebNotice: async () => calls.push("notice"), deleteSyncedWorkboard: async () => calls.push("delete-server-workboard"),
    deleteLocalWorkboard: async () => calls.push("delete-local-workboard"),
    annotationMutationForRecord: (record) => ({ annotation: { ...record, userID: c.activeAccount().userID } }),
    annotationPushTimers: new Map(), clearTimeout() {}, window: { setTimeout: (callback) => { callbacks.push(callback); return callbacks.length; } },
    postJSON: async (_path, body) => { calls.push(body); return {}; }, storeSignedInAccount: () => calls.push("store-account"),
    clerkWebSignInConfig: async () => ({ available: true }), signInWithClerkWeb: () => calls.push("clerk-sign-in"),
    ...overrides
  };
  vm.createContext(c);
  vm.runInContext(names.map(extract).join("\n"), c);
  return { c, calls, saves, callbacks, switchTo(account = B) { c.state = workspace(account); c.accountRuntimeGeneration += 1; } };
}
const isAbort = (error) => error?.name === "AbortError";

// Account change during local UI hydration: A's durable overlay remains in A,
// while the operation never creates a request or touches B's current state.
for (const roundTrip of [false, true]) {
  for (const [name, args, adapter, localField] of [
    ["persistProjectOrder", [[project], "synthetic-pane"], "transitionWorkspace", "localProjects"],
    ["persistSectionBookmark", [section, true], "refreshOpenSavedPanes", "localSavedItems"],
    ["persistSectionInProject", [project, section], "refreshProjectMembershipPanes", "localProjectSections"],
    ["persistSectionFolderSelection", [section, [project], [project]], "refreshProjectMembershipPanes", "localProjectSections"],
    ["removeSectionFromProject", [project, { ...section, folderClientID: project.id }], "refreshProjectMembershipPanes", "localProjectSections"]
  ]) {
    const gate = deferred();
    const h = harness({ [adapter]: () => gate.promise });
    h.c.pushMutation = async (mutation) => h.calls.push(mutation);
    h.c.pushMutationBatch = async (mutations) => h.calls.push(mutations);
    const pending = h.c[name](...args);
    assert.ok(h.saves.at(-1)[localField].length, name + " saves A's work before waiting");
    h.switchTo();
    if (roundTrip) h.switchTo(A);
    const newState = clone(h.c.state);
    gate.resolve();
    await assert.rejects(pending, isAbort, name + " rejects an obsolete operation");
    assert.equal(h.calls.length, 0, name + " must not issue a later mutation");
    assert.deepEqual(clone(h.c.state), newState);
  }
}

// Current-account control: the exact source operation still syncs its owner.
{
  const h = harness();
  h.c.pushMutation = async (mutation) => h.calls.push(mutation);
  await h.c.persistProjectOrder([project], "synthetic-pane");
  assert.equal(h.calls[0].project.userID, A.userID);
  assert.equal(h.calls[0].project.description, project.description);
  assert.equal(h.c.state.localProjects.length, 0);
}

// A successful or unauthorized old response must neither remove B overlays nor
// continue a multi-record batch, nor invoke the global expired-session handler.
for (const failure of [false, true]) {
  for (const name of ["persistProjectOrder", "archiveProjects", "restoreArchivedProject", "persistSectionBookmark", "persistSectionInProject"]) {
    const gate = deferred(), started = deferred();
    const h = harness();
    h.c.pushMutation = async (mutation) => { h.calls.push(mutation); started.resolve(); return gate.promise; };
    const args = name === "persistSectionBookmark" ? [section, true] : name === "persistSectionInProject" ? [project, section]
      : name === "restoreArchivedProject" ? [project] : [[project, { ...project, id: "second-project" }], "synthetic-pane"];
    const pending = h.c[name](...args);
    await started.promise;
    h.switchTo();
    h.c.state.localProjects = [{ ...project, userID: B.userID, name: "B version" }];
    const newState = clone(h.c.state);
    if (failure) gate.reject(Object.assign(new Error("synthetic expired A"), { status: 401 }));
    else gate.resolve({});
    await assert.rejects(pending, isAbort);
    assert.equal(h.calls.filter((call) => typeof call === "object").length, 1, name + " must stop the obsolete batch");
    assert.equal(h.calls.includes("clear-session"), false, name + " cannot expire B's session");
    assert.deepEqual(clone(h.c.state), newState);
  }
}

// The shared durable queue independently rejects wrong-owner and stale-token
// inputs, including a mutation submitted through the ordinary push entry point.
{
  const h = harness();
  const mutation = { project };
  h.switchTo();
  assert.throws(() => h.c.enqueueSyncMutation(mutation, A), isAbort);
  assert.throws(() => h.c.enqueueSyncMutation(mutation, B), isAbort);
  assert.throws(() => h.c.enqueueSyncMutation({ project: { ...project, userID: B.userID } }, { ...B, sessionToken: "obsolete" }), isAbort);
  await assert.rejects(h.c.pushMutation(mutation), isAbort);
  assert.equal(h.c.state.syncOutbox.length, 0);
  assert.equal(h.saves.length, 0);
}
for (const name of ["pushMutation", "pushMutationBatch"]) {
  const gate = deferred();
  const h = harness({ flushSyncOutbox: () => gate.promise });
  const pending = h.c[name](name === "pushMutation" ? { project } : [{ project }]);
  assert.equal(h.saves.at(-1).syncOutbox[0].accountUserID, A.userID);
  h.switchTo();
  h.c.state.syncOutbox = [{ id: "B-request" }];
  const newState = clone(h.c.state);
  gate.resolve({ acceptedMutationIDs: [project.id], rejectedMutationIDs: [], payload: {} });
  await assert.rejects(pending, isAbort);
  assert.deepEqual(clone(h.c.state), newState);
  assert.equal(h.calls.includes("discard-overlay"), false);
}
for (const name of ["pushMutation", "pushMutationBatch"]) {
  const h = harness();
  h.c.flushSyncOutbox = async () => {
    const acceptedMutationIDs = h.c.state.syncOutbox.map((entry) => entry.recordID);
    h.c.state.syncOutbox = [];
    return { acceptedMutationIDs, rejectedMutationIDs: [], payload: { accepted: true } };
  };
  const result = await h.c[name](name === "pushMutation" ? { project } : [{ project }]);
  assert.equal(result.accepted, true, "Current-owner mutations still complete through the actual queue boundary.");
  assert.equal(h.saves[0].syncOutbox[0].mutation.project.userID, A.userID);
}

// An old timer and an already-running timer both leave B's replacement timer,
// annotations and derived UI alone. A's queue is persisted before timer dispatch.
for (const alreadyRunning of [false, true]) {
  const gate = deferred();
  const h = harness();
  h.c.pushMutation = async () => { h.calls.push("push-annotation"); return gate.promise; };
  h.c.scheduleAnnotationPush({ id: "annotation", userID: A.userID, noteBody: "Synthetic A note", syncFields: ["noteBody"] });
  assert.equal(h.saves.at(-1).syncOutbox[0].accountUserID, A.userID);
  const pending = alreadyRunning ? h.callbacks[0]() : null;
  h.switchTo();
  h.c.state.localAnnotations = [{ id: "annotation", noteBody: "Synthetic B note" }];
  h.c.annotationPushTimers.set("annotation", "B-timer");
  gate.resolve();
  await (pending || h.callbacks[0]());
  assert.equal(h.c.annotationPushTimers.get("annotation"), "B-timer");
  assert.equal(h.c.state.localAnnotations[0].noteBody, "Synthetic B note");
  assert.deepEqual(h.calls, alreadyRunning ? ["push-annotation"] : []);
}

// Account change during confirmation or deletion flush cannot continue into a
// second deletion, invoke Workboard cleanup, or close B's Project UI.
for (const stage of ["confirmation", "flush"]) {
  const gate = deferred();
  const h = harness(stage === "confirmation" ? { confirmWebWarning: () => gate.promise } : { flushSyncOutbox: () => gate.promise });
  const pending = stage === "confirmation" ? h.c.deleteArchivedProjects([project]) : h.c.deleteArchivedProjectData(project);
  h.switchTo();
  gate.resolve(true);
  await assert.rejects(pending, isAbort);
  assert.deepEqual(h.calls, []);
  assert.equal(h.c.state.localProjects.length, 0);
}

// SDK loading and token creation retain the original browser and Clerk identity.
for (const stage of ["sdk", "token", "configuration"]) {
  const gate = deferred(), tokenStarted = deferred();
  const clerk = { isSignedIn: true, user: { id: "synthetic-clerk-a" }, session: { getToken: () => { tokenStarted.resolve(); return stage === "token" ? gate.promise : "synthetic-clerk-token"; } } };
  const h = harness({ loadClerkScript: () => stage === "sdk" ? gate.promise : clerk,
    clerkWebSignInConfig: () => stage === "configuration" ? gate.promise : { available: true } });
  const pending = stage === "configuration" ? h.c.signInCurrentBrowser() : h.c.completeClerkPermitextSignIn({});
  if (stage === "token") await tokenStarted.promise;
  h.switchTo();
  gate.resolve(stage === "sdk" ? clerk : stage === "token" ? "synthetic-clerk-token" : { available: true });
  await assert.rejects(pending, isAbort);
  assert.deepEqual(h.calls, []);
}
{
  const gate = deferred(), tokenStarted = deferred();
  const clerk = { isSignedIn: true, user: { id: "synthetic-clerk-a" }, session: { getToken: () => { tokenStarted.resolve(); return gate.promise; } } };
  const h = harness({ loadClerkScript: async () => clerk });
  const pending = h.c.completeClerkPermitextSignIn({});
  await tokenStarted.promise;
  clerk.user = { id: "synthetic-clerk-b" };
  gate.resolve("synthetic-clerk-token");
  await assert.rejects(pending, isAbort);
  assert.deepEqual(h.calls, []);
}
{
  const clerk = { isSignedIn: true, user: { id: "synthetic-clerk-a" }, session: { getToken: async () => "synthetic-clerk-token" } };
  const h = harness({ loadClerkScript: async () => clerk });
  await h.c.completeClerkPermitextSignIn({});
  assert.equal(h.calls[0].linkFrom.accountUserID, A.userID);
  assert.equal(h.calls[0].credential.providerUserID, clerk.user.id);
  assert.equal(h.calls.at(-1), "store-account");
}

// Deletion is exceptional: an issued A deletion must retain its success receipt
// after A→B so A's tombstone and cleanup still run. It must never sign out B.
for (const returnToA of [false, true]) {
  const gate = deferred(), events = [];
  const h = harness({ fetch: async (path, options) => { events.push([path, JSON.parse(options.body).auth.accountUserID]); return gate.promise; },
    deleteOfflineAccountData: async (owner) => events.push(["offline-purge", owner]),
    clearResearchRequestRecoveries: (_storage, { accountUserID }) => events.push(["research-purge", accountUserID]),
    removeCodeQuestionAccountState: (_storage, owner) => events.push(["code-question-purge", owner]),
    removePrivateWorkspace: (_storage, owner) => events.push(["workspace-purge", owner]),
    foregroundSyncLeaseKey: (owner) => "lease:" + owner,
    researchDisclosureAcknowledgmentKeyPrefix: "disclosure:", researchDisclosureAcknowledgedAccounts: new Set(),
    localStorage: { removeItem: (key) => events.push(["key-purge", key.slice("lease:".length)]) }, sessionStorage: {} });
  h.c.replaceActiveAccount = () => { events.push(["sign-out", h.c.activeAccount().userID]); h.switchTo(null); };
  const identity = h.c.captureAccountRequest();
  const pending = h.c.deleteCapturedAccount(A, identity);
  h.switchTo();
  if (returnToA) h.switchTo({ ...A, sessionToken: "replacement-A-token" });
  gate.resolve({ ok: true, json: async () => ({ deleted: true }) });
  assert.equal((await pending).deleted, true);
  assert.equal((await h.c.clearDeletedAccountBrowserData(A, identity)).length, 0);
  assert.ok(events.every((event) => event[1] === A.userID), "Every cleanup stage must retain the deleted owner.");
  assert.equal(h.c.activeAccount()?.userID || null, returnToA ? null : B.userID);
  assert.equal(events.some(([kind]) => kind === "sign-out"), returnToA);
}
{
  const h = harness({ fetch: () => { throw new Error("must not dispatch"); } });
  const identity = h.c.captureAccountRequest();
  h.switchTo();
  await assert.rejects(h.c.deleteCapturedAccount(A, identity), isAbort, "An unissued obsolete deletion must never dispatch.");
}
for (const fails of [false, true]) {
  const gate = deferred();
  const h = harness({ fetchAuthoritativeResearchConversation: () => gate.promise,
    supplementalResearchConversations: new Map(), supplementalResearchConversationIDs: [] });
  const pending = h.c.openSupplementalResearchConversation("synthetic-conversation-a");
  h.switchTo();
  if (fails) gate.reject(new Error("synthetic fetch failed"));
  else gate.resolve({ id: "synthetic-conversation-a", messages: [{ text: "Synthetic A text" }] });
  assert.equal(await pending, null);
  assert.equal(h.c.supplementalResearchConversations.size, 0);
  assert.equal(h.saves.length, 0);
  assert.deepEqual(h.calls, []);
}
// Linking checkpoints open editors before checking owner-scoped drafts/images.
// Quota or read failure must prevent a merge; counts never silently discard work.
for (const mode of ["drafts", "images", "checkpoint-failure", "quota", "read-failure", "outbox", "conflict", "overlay", "report", "workspace-recovery"]) {
  const events = [];
  const h = harness({
    notebookMounts: new Map([["synthetic-project", { persistDraft: async () => {
      events.push("checkpoint");
      if (mode === "checkpoint-failure") throw new Error("Synthetic quota at draft write");
    } }]]),
    pendingNotebookDrafts: async (owner) => { assert.equal(owner, A.userID); events.push("draft-read"); return mode === "drafts" ? [{ accountUserID: owner }] : []; },
    pendingNotebookImages: async (owner) => { assert.equal(owner, A.userID); events.push("image-read");
      if (mode === "read-failure") throw new Error("Synthetic IndexedDB unavailable");
      return mode === "images" ? [{ accountUserID: owner }, { accountUserID: owner }] : [];
    }
  });
  if (mode === "quota") h.c.saveWorkspaceState = () => { throw new Error("Synthetic localStorage quota"); };
  if (mode === "outbox") h.c.state.syncOutbox = [{ accountUserID: A.userID, mutation: { project } }];
  if (mode === "conflict") h.c.state.syncConflicts = [{ accountUserID: A.userID }];
  if (mode === "overlay") h.c.state.localProjects = [project];
  if (mode === "report") h.c.reportDraftMounts.set("synthetic-report", { hasUnsavedChanges: () => true });
  if (mode === "workspace-recovery") h.c.workspaceRestoreError = new Error("Synthetic unreadable workspace");
  const before = clone(h.c.state);
  const clerk = { isSignedIn: true, user: { id: "synthetic-target" }, session: { getToken: async () => "synthetic-token" } };
  h.c.loadClerkScript = async () => clerk;
  await assert.rejects(h.c.completeClerkPermitextSignIn({}), (error) => {
    assert.equal(error.code, ["checkpoint-failure", "quota", "read-failure", "workspace-recovery"].includes(mode) ? "ACCOUNT_LINK_STORAGE_UNAVAILABLE" : "ACCOUNT_LINK_PENDING_WORK");
    if (mode === "drafts") assert.equal(error.counts.notebookDrafts, 1);
    if (mode === "images") assert.equal(error.counts.notebookImages, 2);
    return true;
  });
  if (mode !== "workspace-recovery") assert.equal(events[0], "checkpoint");
  assert.deepEqual(h.calls, [], "No merge or target account store may occur on failed preflight.");
  assert.deepEqual(clone(h.c.state), before);
  assert.equal(h.c.track.inert, false);
  assert.equal(h.c.accountLinkWriteFence, null);
}
{
  const gate = deferred(), issued = deferred();
  const h = harness({ loadClerkScript: async () => ({ isSignedIn: true, user: { id: "synthetic-target" }, session: { getToken: async () => "synthetic-token" } }) });
  h.c.postJSON = async () => { issued.resolve(); return gate.promise; };
  const pending = h.c.completeClerkPermitextSignIn({});
  await issued.promise;
  assert.equal(h.c.track.inert, true, "The browser must prevent editing during the merge request.");
  await assert.rejects(h.c.persistProjectOrder([project], "pane"), (error) => error.code === "ACCOUNT_LINK_IN_PROGRESS");
  assert.throws(() => h.c.enqueueSyncMutation({ project }, A), (error) => error.code === "ACCOUNT_LINK_IN_PROGRESS");
  assert.equal(h.c.state.localProjects.length, 0);
  assert.equal(h.c.state.syncOutbox.length, 0);
  gate.reject(new Error("Synthetic merge request failed"));
  await assert.rejects(pending, /merge request failed/);
  assert.equal(h.c.track.inert, false);
  assert.equal(h.c.accountLinkWriteFence, null);
}

class RecoveryStorage {
  getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; }
  setItem(key, value) { this[key] = String(value); }
  removeItem(key) { delete this[key]; }
}
{
  const storage = new RecoveryStorage();
  const receipt = { sourceUserID: A.userID, targetUserID: B.userID };
  for (const invalid of [null, { ...receipt, sourceUserID: "unrelated" }, { ...receipt, targetUserID: "unrelated" }]) {
    assert.throws(() => recordConfirmedAccountLinkRecovery(storage, invalid, A.userID, B.userID), /does not match/);
  }
  assert.equal(Object.keys(storage).length, 0);
  recordConfirmedAccountLinkRecovery(storage, receipt, A.userID, B.userID);
  assert.equal(accountLinkRecoverySources(storage, A.userID).length, 0);
  assert.equal(accountLinkRecoverySources(storage, B.userID)[0].sourceUserID, A.userID);
  const key = privateWorkspacePrefix(A.userID) + "permitext:webWorkspace:v1";
  storage.setItem(key, JSON.stringify({ account: { userID: A.userID, sessionToken: "do-not-export" }, localProjects: [project] }));
  storage.setItem("permitext:webWorkspace:v1", "unattributed legacy bytes");
  const image = { localURL: "permitext-notebook-local:synthetic-a", accountUserID: A.userID, blob: new Blob(["synthetic image"]) };
  const h = harness({ localStorage: storage, sessionStorage: new RecoveryStorage(),
    offlineAccountRecoverySnapshot: async (owner) => ({ accountUserID: owner, drafts: [{ accountUserID: owner, title: "Synthetic late draft" }], images: [image], projects: [], syncSnapshot: null }),
    blobDataURL: async () => "data:image/png;base64,c3ludGhldGlj", readCodeQuestionAccountState: (_storage, owner) => ({ accountUserID: owner, outbox: [] }) });
  h.switchTo();
  // A cross-tab edit arriving after the receipt remains visible to a later export.
  storage.setItem(privateWorkspacePrefix(A.userID) + "permitext:webWorkspace:v2:late", JSON.stringify({ note: "Synthetic late A work" }));
  const before = clone(storage);
  const bundle = await h.c.accountLocalRecoveryBundle(A.userID);
  assert.equal(bundle.offline.drafts[0].title, "Synthetic late draft");
  assert.equal(bundle.offline.images[0].dataURL, "data:image/png;base64,c3ludGhldGlj");
  assert.equal(bundle.workspaces.local["permitext:webWorkspace:v2:late"].note, "Synthetic late A work");
  assert.equal(bundle.workspaces.local["permitext:webWorkspace:v1"].account.sessionToken, undefined);
  assert.equal(JSON.stringify(bundle).includes("unattributed legacy bytes"), false);
  assert.equal(bundle.access, "export-only");
  assert.deepEqual(clone(storage), before, "Recovery reads cannot remove, retarget, or replay source work.");
  assert.equal(h.c.state.syncOutbox.length, 0);
  h.switchTo({ userID: "web:synthetic-c", sessionToken: "synthetic-c-token" });
  await assert.rejects(h.c.accountLocalRecoveryBundle(A.userID), /no confirmed link/);
  // Current owners can recover retained private bytes without paid access.
  const own = await h.c.accountLocalRecoveryBundle(h.c.activeAccount().userID);
  assert.equal(own.sourceUserID, "web:synthetic-c");
}
for (const indexWriteFails of [false, true]) {
  const storage = new RecoveryStorage();
  const h = harness({ localStorage: storage, confirmedAccountLinkRecovery, recordConfirmedAccountLinkRecovery,
    refreshNotebookPendingStatus: async () => {}, reconcileOfflineFeatureAccess: async () => {},
    loadSyncedContent: async () => {}, flushCodeQuestionOutbox: async () => {}, renderWorkspace: async () => {} });
  vm.runInContext(extract("storeSignedInAccount"), h.c);
  h.c.state.syncOutbox = [{ accountUserID: A.userID, mutation: { project }, id: "late-A-mutation" }];
  h.c.replaceActiveAccount = (next) => { h.saves.push(clone(h.c.state)); h.switchTo(next); };
  if (indexWriteFails) storage.setItem = () => { throw new Error("Synthetic recovery-index quota"); };
  h.c.storeSignedInAccount({ account: { appUserID: B.userID, backendSessionToken: B.sessionToken },
    mergedAccount: { sourceUserID: A.userID, targetUserID: B.userID } });
  assert.equal(h.saves[0].account.userID, A.userID);
  assert.equal(h.saves[0].syncOutbox[0].mutation.project.userID, A.userID, "A late source mutation must not be rewritten before its namespace is saved.");
  assert.equal(h.c.state.account.userID, B.userID);
  assert.equal(h.c.state.syncOutbox.length, 0, "Retained source work must not automatically replay in the destination.");
  const recoveries = h.c.linkedAccountRecoverySources();
  assert.equal(recoveries.length, 1);
  assert.equal(recoveries[0].sourceUserID, A.userID);
  assert.equal(Boolean(recoveries[0].storageWarning), indexWriteFails, "An index quota failure must leave an immediate export route from the in-memory confirmed receipt.");
}
console.log("Web account mutation isolation contract passed (real entry points; deferred synthetic adapters).");
