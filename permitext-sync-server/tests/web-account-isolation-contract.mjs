import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  accountContextChangedError,
  accountRequestIdentity,
  accountRequestIsCurrent,
  migrateLegacyPrivateWorkspace,
  privateWorkspaceKeys,
  privateWorkspaceMigrationStatus,
  privateWorkspacePrefix,
  removePrivateWorkspace
} from "../public/private-workspace-state.js";

// Browser Storage exposes saved keys as enumerable own properties. All test
// storage, HTTP and UI effects below are in memory; no browser/session is used.
class MemoryStorage {
  #operations = [];
  #failKey = null;
  constructor(entries = {}) {
    for (const [key, value] of Object.entries(entries)) this[key] = String(value);
  }
  get operations() { return this.#operations; }
  failWritesTo(key) { this.#failKey = key; }
  getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; }
  setItem(key, value) {
    this.#operations.push({ type: "set", key });
    if (key === this.#failKey) throw Object.assign(new Error("Synthetic quota failure"), { name: "QuotaExceededError" });
    this[key] = String(value);
  }
  removeItem(key) { this.#operations.push({ type: "remove", key }); delete this[key]; }
}

const accountA = { userID: "web:synthetic-a", sessionToken: "synthetic-session-a" };
const accountB = { userID: "web:synthetic-b", sessionToken: "synthetic-session-b" };
const keysA = privateWorkspaceKeys(accountA.userID, "detached-a");
const keysB = privateWorkspaceKeys(accountB.userID, "detached-a");
const guestKeys = privateWorkspaceKeys();
for (const key of Object.keys(keysA)) {
  assert.notEqual(keysA[key], keysB[key], `Account workspace key ${key} must be scoped.`);
  assert.notEqual(keysA[key], guestKeys[key], `Guest workspace key ${key} must be distinct.`);
}
assert.ok(keysA.workspaceKey.startsWith(keysA.baseWorkspaceKey));
assert.notEqual(privateWorkspacePrefix("web:a:b"), privateWorkspacePrefix("web:a%3Ab"), "Encoded account IDs cannot collide.");
assert.notEqual(privateWorkspacePrefix("guest"), privateWorkspacePrefix(""), "An account literally named guest cannot share anonymous work.");

const legacyEntries = {
  "permitext:webWorkspace:v1": JSON.stringify({ account: accountA, localProjects: [{ userID: accountA.userID, name: "Synthetic A project" }] }),
  "permitext:webWorkspaces:v2": JSON.stringify({ workspaces: [{ id: "legacy-workspace" }] }),
  "permitext:webWorkspace:v2:layout-1": JSON.stringify({ paneOrder: ["synthetic-pane"] }),
  "permitext:webWorkspace:v1:detached:detached-1": JSON.stringify({ project: { userID: accountA.userID, id: "synthetic-project" } })
};
const migration = new MemoryStorage({ ...legacyEntries, unrelated: "retain" });
assert.equal(migrateLegacyPrivateWorkspace(migration, accountA.userID), true);
for (const [key, value] of Object.entries(legacyEntries)) {
  assert.equal(migration.getItem(`${privateWorkspacePrefix(accountA.userID)}${key}`), value);
  assert.equal(migration.getItem(key), null);
}
const firstRemoval = migration.operations.findIndex((operation) => operation.type === "remove");
assert.equal(firstRemoval, Object.keys(legacyEntries).length + 1, "All copies and the migration marker must be durable before any legacy removal.");
assert.equal(migration.getItem("unrelated"), "retain");
assert.equal(migration.getItem("permitext:privateWorkspaceMigration:v1").includes(accountA.userID), false, "The migration marker must not retain a deleted account identity.");
assert.equal(migrateLegacyPrivateWorkspace(migration, accountB.userID), false, "Migration binds legacy state once, not once per account.");
assert.equal(migration.getItem(keysB.baseWorkspaceKey), null);

for (const failedKey of [
  `${privateWorkspacePrefix(accountA.userID)}permitext:webWorkspaces:v2`,
  "permitext:privateWorkspaceMigration:v1"
]) {
  const storage = new MemoryStorage(legacyEntries);
  storage.failWritesTo(failedKey);
  assert.throws(() => migrateLegacyPrivateWorkspace(storage, accountA.userID), { name: "QuotaExceededError" });
  for (const [key, value] of Object.entries(legacyEntries)) assert.equal(storage.getItem(key), value, "A failed migration must preserve every legacy entry.");
  assert.equal(storage.operations.some((operation) => operation.type === "remove"), false);
  storage.failWritesTo(null);
  assert.equal(migrateLegacyPrivateWorkspace(storage, accountA.userID), true, "A partial copy must be safely retryable.");
}
const existing = new MemoryStorage({ ...legacyEntries, [keysA.baseWorkspaceKey]: "newer account workspace" });
assert.equal(migrateLegacyPrivateWorkspace(existing, accountA.userID), false);
assert.equal(existing.getItem(keysA.baseWorkspaceKey), "newer account workspace", "Legacy migration cannot overwrite a newer account namespace.");
assert.deepEqual(privateWorkspaceMigrationStatus(existing), { status: "quarantined", reason: "destination-conflict" });
for (const [key, value] of Object.entries(legacyEntries)) assert.equal(existing.getItem(key), value,
  "A distinct destination must retain every original legacy byte instead of deleting uncopied work.");

// Discover a conflict at the final destination before copying even the first
// legacy entry. A partial namespace must not silently become the active merge.
const lateConflictKey = `${privateWorkspacePrefix(accountA.userID)}permitext:webWorkspace:v1:detached:detached-1`;
const lateConflict = new MemoryStorage({ ...legacyEntries, [lateConflictKey]: "distinct retained layout" });
assert.equal(migrateLegacyPrivateWorkspace(lateConflict, accountA.userID), false);
assert.deepEqual(lateConflict.operations, [{ type: "set", key: "permitext:privateWorkspaceMigration:v1" }]);
assert.equal(lateConflict.getItem(keysA.baseWorkspaceKey), null);
assert.equal(lateConflict.getItem(lateConflictKey), "distinct retained layout");
for (const [key, value] of Object.entries(legacyEntries)) assert.equal(lateConflict.getItem(key), value);

const interrupted = new MemoryStorage(legacyEntries);
interrupted.failWritesTo(`${privateWorkspacePrefix(accountA.userID)}permitext:webWorkspaces:v2`);
assert.throws(() => migrateLegacyPrivateWorkspace(interrupted, accountA.userID), { name: "QuotaExceededError" });
interrupted.failWritesTo(null);
const changedScopedBytes = JSON.stringify({ account: accountA, localSavedSectionIDs: [202] });
interrupted.setItem(keysA.baseWorkspaceKey, changedScopedBytes);
assert.equal(migrateLegacyPrivateWorkspace(interrupted, accountA.userID), false,
  "A retry after new scoped work must quarantine, not erase its distinct legacy source.");
assert.equal(interrupted.getItem(keysA.baseWorkspaceKey), changedScopedBytes);
for (const [key, value] of Object.entries(legacyEntries)) assert.equal(interrupted.getItem(key), value);
assert.equal(interrupted.operations.some((operation) => operation.type === "remove"), false);

const identical = new MemoryStorage({ ...legacyEntries,
  ...Object.fromEntries(Object.entries(legacyEntries).map(([key, value]) => [`${privateWorkspacePrefix(accountA.userID)}${key}`, value])) });
assert.equal(migrateLegacyPrivateWorkspace(identical, accountA.userID), true,
  "A byte-identical partial migration remains safe to finish.");
for (const [key, value] of Object.entries(legacyEntries)) {
  assert.equal(identical.getItem(key), null);
  assert.equal(identical.getItem(`${privateWorkspacePrefix(accountA.userID)}${key}`), value);
}

for (const [accountUserID, entries, expectedReason] of [
  ["", legacyEntries, "owner-unverified"],
  [accountB.userID, legacyEntries, "ownership-mismatch"],
  [accountA.userID, { ...legacyEntries, "permitext:webWorkspace:v2:layout-1": JSON.stringify({ notes: [{ accountUserID: accountB.userID, text: "Synthetic B private note" }] }) }, "ownership-mismatch"],
  [accountA.userID, { ...legacyEntries, "permitext:webWorkspace:v1": JSON.stringify({ localProjects: [{ userID: accountA.userID, id: "synthetic" }] }) }, "workspace-owner-unverified"],
  [accountA.userID, { ...legacyEntries, "permitext:webWorkspace:v2:layout-1": "unreadable exact bytes" }, "unreadable-legacy-data"]
]) {
  const storage = new MemoryStorage(entries);
  assert.equal(migrateLegacyPrivateWorkspace(storage, accountUserID), false);
  assert.deepEqual(privateWorkspaceMigrationStatus(storage), { status: "quarantined", reason: expectedReason });
  for (const [key, value] of Object.entries(entries)) assert.equal(storage.getItem(key), value, "Quarantine retains the original bytes.");
  assert.equal(storage.getItem(privateWorkspaceKeys(accountUserID).baseWorkspaceKey), null, "Unattributed work is never made active under guest or the current account.");
  assert.equal(migrateLegacyPrivateWorkspace(storage, accountA.userID), false, "Later sign-in is not authorization to recover ambiguous data.");
  removePrivateWorkspace(storage, accountA.userID);
  for (const [key, value] of Object.entries(entries)) assert.equal(storage.getItem(key), value, "Account deletion cannot erase ambiguously owned legacy work.");
  assert.equal(privateWorkspaceMigrationStatus(storage).status, "quarantined");
}

const scopedRemoval = new MemoryStorage({
  ...Object.fromEntries(Object.values(keysA).map((key) => [key, "A"])),
  ...Object.fromEntries(Object.values(keysB).map((key) => [key, "B"])),
  ...Object.fromEntries(Object.values(guestKeys).map((key) => [key, "guest"])),
  unrelated: "retain"
});
removePrivateWorkspace(scopedRemoval, accountA.userID);
for (const key of Object.values(keysA)) assert.equal(scopedRemoval.getItem(key), null);
for (const key of Object.values(keysB)) assert.equal(scopedRemoval.getItem(key), "B");
for (const key of Object.values(guestKeys)) assert.equal(scopedRemoval.getItem(key), "guest");
assert.equal(scopedRemoval.getItem("unrelated"), "retain");
assert.throws(() => removePrivateWorkspace(scopedRemoval, ""), /account is required/i);
const oldMarker = new MemoryStorage({
  "permitext:privateWorkspaceMigration:v1": JSON.stringify({ accountUserID: accountA.userID, version: 1 }),
  [keysA.baseWorkspaceKey]: "A", [keysB.baseWorkspaceKey]: "B"
});
removePrivateWorkspace(oldMarker, accountA.userID);
assert.deepEqual(JSON.parse(oldMarker.getItem("permitext:privateWorkspaceMigration:v1")), { version: 1 });
assert.equal(migrateLegacyPrivateWorkspace(oldMarker, accountB.userID), false, "Deleting marker identity must not reopen migration.");

const identity = accountRequestIdentity(accountA, 1);
assert.equal(accountRequestIsCurrent(identity, accountA, 1), true);
assert.equal(accountRequestIsCurrent(identity, accountB, 1), false);
assert.equal(accountRequestIsCurrent(identity, accountA, 3), false, "A → B → A must invalidate the original A request even with the same token.");
assert.equal(accountRequestIsCurrent(identity, { ...accountA, sessionToken: "replacement-session" }, 1), false);
assert.equal(accountRequestIsCurrent(identity, null, 1), false);

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function functionSource(name) {
  const declaration = new RegExp(`^(?:async )?function ${name}\\(`, "m").exec(appSource);
  assert.ok(declaration, `Missing application function ${name}.`);
  const nextDeclaration = /\n(?:async )?function [A-Za-z_$][\w$]*\(/.exec(appSource.slice(declaration.index + declaration[0].length));
  assert.ok(nextDeclaration, `Missing boundary after application function ${name}.`);
  return appSource.slice(declaration.index, declaration.index + declaration[0].length + nextDeclaration.index);
}
const applicationFunctions = [
  "activeAccount", "captureAccountRequest", "isCurrentAccountRequest", "requireCurrentAccountRequest",
  "postJSON", "loadSyncedContent", "requirePrivateWorkspaceWritable"
].map(functionSource).join("\n");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function reached(predicate, label) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(`Deferred application stage was not reached: ${label}`);
}

function harness(overrides = {}) {
  const requests = [];
  const effects = { connectionUpdates: 0, expired: 0, saved: [], entitlements: [], broadcasts: [], repairs: [], offlineLoads: [], continuity: 0 };
  const state = { account: { ...accountA } };
  const sandbox = {
    state, accountRequestIdentity, accountRequestIsCurrent, accountContextChangedError,
    permitextSyncSchemaVersion: 1, permitextClientCapabilities: {},
    fetch(path, options) {
      const request = { path, options, ...deferred() };
      requests.push(request);
      return request.promise;
    },
    updateConnectionStatus() { effects.connectionUpdates += 1; },
    summarizeMutations(mutations) { return { projects: mutations.map((mutation) => mutation.project).filter(Boolean) }; },
    mergeSyncedMutations(existingMutations, incoming) { return [...existingMutations, ...incoming]; },
    async repairAppleBrowserAccountLink(account, entitlement) {
      effects.repairs.push(account.userID);
      return overrides.repair ? overrides.repair(account, entitlement) : null;
    },
    async convergeServerNewerSyncConflicts(account) { return overrides.converge?.(account); },
    async applyRemoteContinuityIfNewer() { effects.continuity += 1; },
    async saveOfflineSyncSnapshot(userID, content) { effects.saved.push({ userID, content: structuredClone(content) }); },
    async loadOfflineSyncSnapshot(userID) { effects.offlineLoads.push(userID); return overrides.offline?.(userID) || null; },
    broadcastForegroundSyncSignal(type, payload) { effects.broadcasts.push({ type, payload }); },
    storeAccountEntitlement(entitlement) { effects.entitlements.push({ userID: state.account?.userID, entitlement }); },
    isSessionAuthenticationError(error) { return error.status === 401; },
    clearExpiredAccountSession() { effects.expired += 1; state.account = null; }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`
    let accountRuntimeGeneration = 0;
    let accountLinkWriteFence = null;
    let serverReachable = true;
    let syncLoadPromise = null;
    let syncedContent = null;
    let foregroundSyncLastFullPullAt = 0;
    ${applicationFunctions}
    globalThis.testAPI = {
      post: postJSON,
      load: loadSyncedContent,
      content: () => syncedContent,
      request: () => syncLoadPromise,
      reachable: () => serverReachable,
      generation: () => accountRuntimeGeneration,
      switchAccount(account) {
        state.account = account;
        accountRuntimeGeneration += 1;
        syncedContent = { status: account ? "connected" : "disconnected", userID: account?.userID,
          latestEventID: 4, contentMapVersion: 2, mutations: [], summary: { projects: [{ id: "current-account-project" }] } };
        // Deliberately keep the old promise: its own identity guards must work
        // even when it overlaps a new request for the next account.
        return syncedContent;
      }
    };
  `, context, { filename: "extracted-web-account-functions.js" });
  function respond(index, payload, status = 200, body = null) {
    requests[index].resolve({ ok: status >= 200 && status < 300, status, json: () => body?.promise || Promise.resolve(payload) });
  }
  return { api: context.testAPI, state, requests, effects, respond };
}
const payloadFor = (account) => ({
  mutations: [{ project: { id: `${account.userID}:project` } }], latestEventID: 9,
  contentMapVersion: 2, entitlement: { plan: account.userID }, pulledAt: "2026-09-04T12:00:00.000Z"
});
function assertNoStaleSideEffects(test, currentContent) {
  assert.equal(test.api.content(), currentContent);
  assert.equal(test.state.account?.userID, accountB.userID);
  assert.equal(test.effects.expired, 0);
  assert.equal(test.effects.saved.length, 0);
  assert.equal(test.effects.entitlements.length, 0);
  assert.equal(test.effects.broadcasts.length, 0);
}

for (const completion of ["success", "401", "network-failure"]) {
  const test = harness();
  const oldLoad = test.api.load();
  const currentContent = test.api.switchAccount({ ...accountB });
  const currentLoad = test.api.load();
  const currentRequest = test.api.request();
  if (completion === "network-failure") test.requests[0].reject(new Error("Synthetic network failure"));
  else test.respond(0, completion === "401" ? { error: "Synthetic expired session" } : payloadFor(accountA), completion === "401" ? 401 : 200);
  await oldLoad;
  assertNoStaleSideEffects(test, currentContent);
  assert.equal(test.api.request(), currentRequest, "The obsolete request finally block cannot clear B's in-flight request.");
  assert.equal(test.api.reachable(), true, "An obsolete fetch cannot change the current connection state.");
  assert.equal(test.effects.connectionUpdates, 0);
  test.respond(1, payloadFor(accountB));
  await currentLoad;
  assert.equal(test.api.content().userID, accountB.userID);
  assert.equal(test.effects.saved[0]?.userID, accountB.userID);
  assert.equal(test.effects.entitlements[0]?.userID, accountB.userID);
  assert.equal(test.api.request(), null);
}

// A response can cross the account boundary while its JSON body is still read.
{
  const test = harness();
  const body = deferred();
  const oldLoad = test.api.load();
  test.respond(0, null, 200, body);
  await reached(() => test.effects.connectionUpdates === 1, "response headers before JSON");
  const currentContent = test.api.switchAccount({ ...accountB });
  body.resolve(payloadFor(accountA));
  await oldLoad;
  assertNoStaleSideEffects(test, currentContent);
}

// The postJSON guard is insufficient on its own: account changes can happen
// during later async repair and offline fallback reads in loadSyncedContent.
{
  const repair = deferred();
  const test = harness({ repair: () => repair.promise });
  const oldLoad = test.api.load();
  test.respond(0, payloadFor(accountA));
  await reached(() => test.effects.repairs.length === 1, "Apple account repair");
  const currentContent = test.api.switchAccount({ ...accountB });
  repair.resolve({ entitlement: { plan: "obsolete-a-plan" } });
  await oldLoad;
  assertNoStaleSideEffects(test, currentContent);
}
{
  const snapshot = deferred();
  const test = harness({ offline: () => snapshot.promise });
  const oldLoad = test.api.load();
  test.requests[0].reject(new Error("Synthetic offline fetch"));
  await reached(() => test.effects.offlineLoads.length === 1, "offline snapshot read");
  const currentContent = test.api.switchAccount({ ...accountB });
  const currentLoad = test.api.load();
  const currentRequest = test.api.request();
  snapshot.resolve({ userID: accountA.userID, mutations: payloadFor(accountA).mutations });
  await oldLoad;
  assertNoStaleSideEffects(test, currentContent);
  assert.equal(test.api.request(), currentRequest);
  test.respond(1, payloadFor(accountB));
  await currentLoad;
}

// A → B → A with the same credentials must still reject A's earlier request.
{
  const test = harness();
  const request = test.api.post("/synthetic", { auth: { accountUserID: accountA.userID } }, { token: accountA.sessionToken });
  test.api.switchAccount({ ...accountB });
  test.api.switchAccount({ ...accountA });
  test.respond(0, payloadFor(accountA));
  await assert.rejects(request, (error) => error.code === "ACCOUNT_CONTEXT_CHANGED" && error.name === "AbortError");
  assert.equal(test.effects.connectionUpdates, 0);
}
{
  const test = harness();
  await assert.rejects(() => test.api.post("/synthetic", { auth: { accountUserID: accountB.userID } }, { token: accountB.sessionToken }), (error) => error.code === "ACCOUNT_CONTEXT_CHANGED");
  assert.equal(test.requests.length, 0, "A mismatched authenticated request must be rejected before sending.");
  const current = test.api.load();
  test.respond(0, { error: "Synthetic expired current session" }, 401);
  await current;
  assert.equal(test.effects.expired, 1, "Current-account authentication failures must still expire the session.");
  assert.equal(test.state.account, null);
}

console.log("Permitext web account isolation contract passed (in-memory storage and deferred extracted application functions).");
