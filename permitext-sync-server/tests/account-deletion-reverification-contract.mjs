import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { isReverificationHint } from "@clerk/shared/authorization-errors";
import * as core from "../src/account-verification-core.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const start = new RegExp(`^(?:async )?function ${name}\\(`, "m").exec(source);
  assert.ok(start, name);
  const next = /\n(?:async )?function [\w$]+\(/.exec(source.slice(start.index + start[0].length));
  assert.ok(next, name + " boundary");
  return source.slice(start.index, start.index + start[0].length + next.index);
}
const listenerStart = source.indexOf('  deleteAccountButton.addEventListener("click", async () => {');
const listenerEnd = source.indexOf('  checkoutButton.addEventListener("click",', listenerStart);
assert.ok(listenerStart > 0 && listenerEnd > listenerStart);
const A = { userID: "clerk:user_synthetic_a", authProvider: "clerk", sessionToken: "synthetic-a" };
const B = { userID: "clerk:user_synthetic_b", authProvider: "clerk", sessionToken: "synthetic-b" };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(options = {}) {
  const calls = [], stages = [], notices = [];
  let active = A, generation = 1, handler;
  let fresh = options.fresh ?? true;
  const clerk = {
    user: { id: "user_synthetic_a", deleteSelfEnabled: true,
      delete: async () => { calls.push("identity"); return options.deleteIdentity?.(); } },
    session: { id: "sess_synthetic_a", checkAuthorization: ({ reverification }) => {
      assert.equal(reverification, "strict"); return fresh;
    } }
  };
  const contextChanged = () => Object.assign(new Error("Account changed"), { name: "AbortError" });
  const verification = { ...core,
    runReverifiedClerkOperation: async ({ operation }) => {
      let result;
      try { result = await operation(); }
      catch (error) {
        if (error.code !== "session_reverification_required") throw error;
        result = { retryVerification: true };
      }
      if (isReverificationHint(result) || result?.retryVerification) {
        calls.push("verification");
        await options.verify?.();
        fresh = true;
        return operation();
      }
      return result;
    }
  };
  const progress = {
    setStage: (...args) => stages.push(args), finish: (value) => { progress.result = value; },
    withIdentityPrompt: async (operation) => operation(), close() {}
  };
  const c = {
    activeAccount: () => active,
    captureAccountRequest: () => ({ userID: active?.userID, generation }),
    isCurrentAccountRequest: (identity) => identity.generation === generation && identity.userID === active?.userID,
    requireCurrentAccountRequest: (identity) => {
      if (!c.isCurrentAccountRequest(identity)) throw contextChanged();
    },
    accountContextChangedError: contextChanged,
    clerkWebSignInConfig: async () => ({ publishableKey: "synthetic-publishable-key" }),
    loadClerkScript: async () => clerk,
    loadAccountVerification: async () => verification,
    settingsIdentity: { userID: A.userID, generation },
    deleteAccountButton: { disabled: false, addEventListener: (_event, fn) => { handler = fn; } },
    currentEntitlement: () => null, confirmAccountDeletion: async () => true,
    setStatus() {}, showWebNotice: async (...args) => notices.push(args),
    openAccountDeletionProgress: () => progress,
    deleteCapturedAccount: async () => {
      calls.push("server");
      await options.server?.();
      return { deletedPrivateAssetCount: 0 };
    },
    clearDeletedAccountBrowserData: async () => {
      calls.push("device"); active = null; generation += 1; return [];
    },
    renderWorkspace: async () => {}, reportClientError: () => calls.push("reported-error")
  };
  vm.createContext(c);
  vm.runInContext([extract("prepareAccountDeletionIdentity"), extract("removePreparedAccountDeletionIdentity"),
    source.slice(listenerStart, listenerEnd)].join("\n"), c);
  return { c, clerk, calls, stages, notices, progress, run: () => handler(),
    switchTo(account) { active = account; generation += 1; }, setFresh(value) { fresh = value; } };
}

// Run the actual click listener, including the irreversible request ordering.
{
  const h = harness({ fresh: false });
  await h.run();
  assert.deepEqual(h.calls, ["verification", "server", "device", "identity"]);
  assert.equal(h.progress.result.title, "Permitext account deleted");
}
{
  const h = harness({ fresh: false, verify: async () => {
    throw Object.assign(new Error("Canceled"), { code: "reverification_cancelled" });
  } });
  await h.run();
  assert.deepEqual(h.calls, ["verification"]);
  assert.equal(h.c.deleteAccountButton.disabled, false);
  assert.match(h.notices[0][1], /No account data was deleted/);
}
for (const roundTrip of [false, true]) {
  const waiting = deferred(), started = deferred();
  const h = harness({ fresh: false, verify: () => { started.resolve(); return waiting.promise; } });
  const pending = h.run();
  await started.promise;
  h.switchTo(B);
  if (roundTrip) h.switchTo(A);
  waiting.resolve();
  await pending;
  assert.deepEqual(h.calls, ["verification"], "Account changes during verification cannot delete data.");
}
{
  const waiting = deferred(), started = deferred();
  const h = harness({ fresh: false, verify: () => { started.resolve(); return waiting.promise; } });
  const pending = h.run();
  await started.promise;
  h.clerk.user = { ...h.clerk.user, id: "user_synthetic_b" };
  waiting.resolve();
  await pending;
  assert.deepEqual(h.calls, ["verification"], "Clerk's identity is checked again after its own modal.");
}
for (const unavailable of ["self-delete", "session", "verification-api"]) {
  const h = harness();
  if (unavailable === "self-delete") h.clerk.user.deleteSelfEnabled = false;
  if (unavailable === "session") h.clerk.session = null;
  if (unavailable === "verification-api") delete h.clerk.session.checkAuthorization;
  await h.run();
  assert.deepEqual(h.calls, [], unavailable + " must stop before the server request.");
}
{
  let attempts = 0;
  const h = harness({ deleteIdentity: async () => {
    if (++attempts === 1) throw Object.assign(new Error("Verify again"), { code: "session_reverification_required" });
  } });
  await h.run();
  assert.deepEqual(h.calls, ["server", "device", "identity", "verification", "identity"]);
  assert.equal(h.progress.result.title, "Permitext account deleted");
}
{
  let attempts = 0;
  const h = harness({ deleteIdentity: async () => {
    if (++attempts === 1) throw new Error("Synthetic provider unavailable");
  } });
  await h.run();
  assert.match(h.progress.result.title, /cleanup incomplete/);
  assert.equal(h.progress.result.retryLabel, "Retry cleanup");
  await h.progress.result.onRetry();
  assert.deepEqual(h.calls, ["server", "device", "identity", "reported-error", "identity"]);
  assert.equal(h.progress.result.title, "Permitext account deleted");
}
{
  const h = harness({ deleteIdentity: async () => { throw new Error("Synthetic provider unavailable"); } });
  await h.run();
  h.switchTo(B);
  h.clerk.user = { id: "user_synthetic_b", delete: async () => { throw new Error("Wrong user called"); } };
  await h.progress.result.onRetry();
  assert.equal(h.calls.filter((entry) => entry === "identity").length, 1);
  assert.match(h.progress.result.title, /cleanup incomplete/);
}

console.log("permitext account deletion reverification contract passed: actual listener preflight, cancellation, identity races, and cleanup-only retries");
