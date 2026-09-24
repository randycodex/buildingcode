import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const slice = (start, end) => { const a = source.indexOf(start), b = source.indexOf(end, a); assert.ok(a >= 0 && b > a); return source.slice(a, b); };
const functions = slice("async function loadSyncedContent(", "\nfunction mergeSyncedMutations") + slice("async function ensureSyncedContentForRender(", "\nfunction syncedWorkboardForProject");
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function fixture({ snapshot = null, baseline = null } = {}) {
  const network = deferred(), chain = deferred();
  let generation = 1;
  const c = vm.createContext({
    syncedContent: baseline, syncLoadPromise: null, foregroundSyncLastFullPullAt: 0,
    Date, navigator: { onLine: true }, serverReachable: true,
    permitextSyncSchemaVersion: 1, permitextClientCapabilities: [],
    activeAccount: () => ({ userID: "a", sessionToken: "token" }),
    captureAccountRequest: () => ({ generation }),
    isCurrentAccountRequest: identity => identity?.generation === generation,
    postJSON: () => network.promise,
    repairAppleBrowserAccountLink: async () => null,
    summarizeMutations: mutations => ({ mutations }), mergeSyncedMutations: (a,b) => [...a,...b],
    convergeServerNewerSyncConflicts: () => chain.promise,
    reconcileSharedWorkspaceCatalog() {}, applyRemoteContinuityIfNewer: async () => {},
    recoverVerifiedLegacyWorkspace() {}, saveOfflineSyncSnapshot: async () => {},
    broadcastForegroundSyncSignal() {}, storeAccountEntitlement() {},
    isSessionAuthenticationError: error => error.status === 401,
    clearExpiredAccountSession() { c.syncedContent = { status: "disconnected" }; generation++; },
    loadOfflineSyncSnapshot: async () => snapshot,
    privateCacheFallbackAllowed: error => !["ACCOUNT_CONTEXT_CHANGED", "OFFLINE_ACCOUNT_DELETED"].includes(error.code) && (!Number(error.status) || error.status >= 500)
  });
  vm.runInContext(functions, c);
  return { c, network, chain };
}
const snapshot = { userID: "a", mutations: [], pulledAt: "2026-09-23T00:00:00Z" };
for (const [status, saved, baseline, expected] of [
  [0, snapshot, null, "permitted-offline"],
  [503, snapshot, null, "permitted-offline"],
  [403, snapshot, null, "unavailable"],
  [0, null, null, "unavailable"],
  [0, { ...snapshot, userID: "b" }, null, "unavailable"],
  [0, null, { ...snapshot, status: "offline" }, "unavailable"],
  [0, null, { ...snapshot, status: "offline", workspacePresentationAccess: "unavailable" }, "unavailable"],
  [0, null, { ...snapshot, status: "offline", workspacePresentationAccess: "permitted-offline" }, "permitted-offline"],
  [0, null, { ...snapshot, status: "connected", workspacePresentationAccess: "verified" }, "permitted-offline"]
]) {
  const { c, network } = fixture({ snapshot: saved, baseline });
  const request = c.loadSyncedContent();
  network.reject(Object.assign(new Error("Synthetic failure"), { status }));
  assert.equal((await request).workspacePresentationAccess, expected);
}
{
  const { c, network, chain } = fixture();
  const request = c.loadSyncedContent();
  network.resolve({ mutations: [], contentMapVersion: 2 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.syncedContent.status, "connected");
  assert.notEqual(c.syncedContent.workspacePresentationAccess, "verified", "Early connected assignment is not presentation authorization");
  let settled = false;
  const render = c.ensureSyncedContentForRender().then(result => { settled = true; return result; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, "Render must await the active post-pull chain");
  chain.resolve();
  assert.equal((await request).workspacePresentationAccess, "verified");
  assert.equal((await render).workspacePresentationAccess, "verified");
}
{
  const { c, network, chain } = fixture();
  const request = c.loadSyncedContent();
  network.resolve({ mutations: [], contentMapVersion: 2 });
  chain.reject(Object.assign(new Error("Follow-up forbidden"), { status: 403 }));
  assert.equal((await request).workspacePresentationAccess, "unavailable");
}
console.log("Workspace sync access passed: full-chain verification, pending sync barrier, snapshot identity, fallback classification and no unverified baseline promotion.");
{
  const { c } = fixture();
  const networkA = deferred(), networkB = deferred(), chainB = deferred();
  let requestCount = 0;
  c.postJSON = () => (++requestCount === 1 ? networkA.promise : networkB.promise);
  c.convergeServerNewerSyncConflicts = () => chainB.promise;
  let settled = false;
  const render = c.ensureSyncedContentForRender().then(result => { settled = true; return result; });
  const replacement = c.loadSyncedContent({ force: true });
  networkB.resolve({ mutations: [], contentMapVersion: 2 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.syncedContent.status, "connected");
  assert.notEqual(c.syncedContent.workspacePresentationAccess, "verified");
  networkA.resolve({ mutations: [], contentMapVersion: 2 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, "Superseded A must not release rendering while B's connected result is incomplete");
  chainB.resolve();
  await replacement;
  assert.equal((await render).workspacePresentationAccess, "verified");
  assert.equal(requestCount, 2, "Following supersession must not initiate another pull");
}
console.log("Workspace sync supersession passed: render follows replacement pull through completed verification.");
