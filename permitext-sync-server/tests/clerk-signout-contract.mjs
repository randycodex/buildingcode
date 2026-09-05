import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function signOutCapturedClerkSession(");
const end = source.indexOf("\nasync function signInWithClerkWeb(", start);
assert.ok(start >= 0 && end > start);
const listenerStart = source.indexOf('  signOutButton.addEventListener("click",');
const listenerEnd = source.indexOf('  deleteAccountButton.addEventListener("click",', listenerStart);
assert.ok(listenerStart >= 0 && listenerEnd > listenerStart);
const A = { userID: "clerk:user_synthetic_a", authProvider: "clerk", sessionToken: "synthetic-a" };
const B = { userID: "clerk:user_synthetic_b", authProvider: "clerk", sessionToken: "synthetic-b" };
const abort = () => Object.assign(new Error("Account changed"), { name: "AbortError" });
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function fixture(options = {}) {
  let account = A, generation = 1, listener;
  const events = [], statuses = [];
  const clerk = {
    status: options.degraded ? "degraded" : "ready",
    isSignedIn: true, session: { id: "sess_synthetic_a" }, user: { id: "user_synthetic_a" },
    async signOut(callback, params) {
      events.push(["provider-sign-out", params.sessionId]);
      assert.equal(typeof callback, "function", "Suppress navigation until app cleanup completes");
      if (options.providerFailure) throw new Error("Synthetic provider unavailable");
      if (options.signOutGate) await options.signOutGate.promise;
      if (!options.incomplete) { this.isSignedIn = false; this.session = null; }
      await callback();
    }
  };
  if (options.noSession) { clerk.isSignedIn = false; clerk.session = null; clerk.user = null; }
  if (options.otherProviderAccount) clerk.user = { id: "user_synthetic_b" };
  const c = {
    // Intentionally no window.Clerk: this is the reloaded-workspace regression.
    window: {}, state: { syncOutbox: [], codeQuestionOutbox: [], syncConflicts: [], codeQuestionConflicts: [] },
    signOutButton: { disabled: false, addEventListener(_event, fn) { listener = fn; } },
    notebookMounts: new Map([["draft", { persistDraft: async () => events.push(["checkpoint"]) }]]),
    activeAccount: () => account,
    captureAccountRequest: () => generation,
    isCurrentAccountRequest: identity => identity === generation,
    requireCurrentAccountRequest(identity) { if (identity !== generation) throw abort(); },
    async clerkWebSignInConfig() {
      events.push(["configuration"]);
      if (options.configGate) await options.configGate.promise;
      return { available: !options.unavailable };
    },
    async loadClerkScript() {
      events.push(["load-provider"]);
      if (options.loadGate) await options.loadGate.promise;
      return clerk;
    },
    pendingNotebookDrafts: async () => [],
    async postJSON(path) { events.push(["backend-sign-out", path]); },
    persistCodeQuestionAccountState: owner => events.push(["preserve-owner", owner]),
    replaceActiveAccount(next) { events.push(["replace-account"]); account = next; generation += 1; },
    disableOfflineFeature: async () => {}, renderWorkspace: async () => {},
    setStatus: message => statuses.push(message),
    confirmWebWarning: async () => true
  };
  vm.createContext(c);
  vm.runInContext(source.slice(start, end) + "\n" + source.slice(listenerStart, listenerEnd), c);
  return { c, clerk, events, statuses, run: () => listener(), account: () => account,
    switchTo(next = B) { account = next; generation += 1; } };
}

const reloaded = fixture();
await reloaded.run();
assert.deepEqual(reloaded.events.map(e => e[0]), ["checkpoint", "configuration", "load-provider", "provider-sign-out", "backend-sign-out", "preserve-owner", "replace-account"]);
assert.deepEqual(reloaded.events.find(e => e[0] === "provider-sign-out"), ["provider-sign-out", "sess_synthetic_a"]);
assert.equal(reloaded.account(), null);
assert.deepEqual(reloaded.statuses, []);

const legacy = fixture();
legacy.switchTo({ userID: "apple:synthetic", authProvider: "apple", sessionToken: "synthetic-legacy" });
await legacy.run();
assert.equal(legacy.events.some(e => e[0] === "configuration"), false);
assert.equal(legacy.account(), null);

const expired = fixture({ noSession: true });
await expired.run();
assert.equal(expired.events.some(e => e[0] === "provider-sign-out"), false);
assert.equal(expired.account(), null);

for (const option of ["providerFailure", "unavailable", "degraded", "incomplete", "otherProviderAccount"]) {
  const h = fixture({ [option]: true });
  await h.run();
  assert.equal(h.account(), A, option + " must not claim a completed sign-out");
  assert.equal(h.events.some(e => e[0] === "backend-sign-out"), false);
  assert.match(h.statuses[0], /^Sign-out paused:/);
  assert.equal(h.c.signOutButton.disabled, false, "The user can retry");
  if (option === "otherProviderAccount") assert.equal(h.events.some(e => e[0] === "provider-sign-out"), false);
}

for (const stage of ["configGate", "loadGate", "signOutGate"]) {
  const gate = deferred(), h = fixture({ [stage]: gate });
  const pending = h.run();
  const event = stage === "configGate" ? "configuration" : stage === "loadGate" ? "load-provider" : "provider-sign-out";
  for (let i = 0; i < 20 && !h.events.some(e => e[0] === event); i += 1) await Promise.resolve();
  assert.ok(h.events.some(e => e[0] === event));
  h.switchTo();
  gate.resolve();
  await pending;
  assert.equal(h.account(), B, stage + " must preserve the replacement account");
  assert.equal(h.events.some(e => e[0] === "backend-sign-out" || e[0] === "replace-account"), false);
  if (stage !== "signOutGate") assert.equal(h.events.some(e => e[0] === "provider-sign-out"), false);
  assert.deepEqual(h.statuses, [], "An obsolete callback must not overwrite the new account's status");
}

console.log("Clerk sign-out passed: lazy initialization, exact session, expired/legacy sessions, visible failures and account changes at three async boundaries.");
