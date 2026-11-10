import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function loadClerkComponentScript(config, path)");
const loader = source.slice(start, source.indexOf("\nasync function completeClerkPermitextSignIn", start));
assert.ok(start >= 0 && loader.includes("function loadClerkScript(config)"));
const config = { frontendAPIURL: "https://synthetic.clerk.invalid", publishableKey: "pk_test_synthetic" };

function fixture({ failUI = false, missingUI = false, failSDK = false, failLoad = false, existingHeadless = false } = {}) {
  const scripts = [], loads = [], timers = new Set();
  const UI = function SyntheticUI() {};
  const clerk = {
    loaded: existingHeadless,
    async load(options) {
      loads.push(options);
      assert.equal(options.ui.ClerkUI, UI, "SDK initialization receives the UI constructor");
      if (failLoad) { failLoad = false; throw new Error("synthetic initialization failure"); }
      this.loaded = true;
      this.uiVersion = "synthetic";
    }
  };
  const window = {
    setTimeout(callback) { timers.add(callback); return callback; },
    clearTimeout(id) { timers.delete(id); },
    ...(existingHeadless ? { Clerk: clerk } : {})
  };
  const document = {
    createElement() { return { dataset: {}, remove() { this.removed = true; } }; },
    head: { append(script) {
      scripts.push(script);
      queueMicrotask(() => {
        if (script.src.includes("/ui@1/")) {
          if (failUI) { failUI = false; script.onerror(); return; }
          if (!missingUI) window.__internal_ClerkUICtor = UI;
        } else {
          assert.equal(window.__internal_ClerkUICtor, UI, "UI loads before ClerkJS");
          if (failSDK) { failSDK = false; script.onerror(); return; }
          window.Clerk = clerk;
        }
        script.onload();
      });
    } }
  };
  const context = vm.createContext({ window, document });
  vm.runInContext("let clerkScriptPromise = null;\n" + loader + "\nglobalThis.run = loadClerkScript;", context);
  return { run: () => context.run(config), scripts, loads, timers, clerk };
}

const first = fixture();
const pair = await Promise.all([first.run(), first.run()]);
assert.ok(pair.every(value => value === first.clerk));
assert.equal(first.scripts.length, 2, "Concurrent callers share UI and SDK loads");
assert.equal(first.loads.length, 1, "Initialize the shared SDK once");
await first.run();
assert.equal(first.scripts.length, 2, "Later callers reuse the initialized instance");
assert.equal(first.timers.size, 0);
for (const option of ["failUI", "failSDK", "failLoad"]) {
  const retry = fixture({ [option]: true });
  await assert.rejects(retry.run());
  assert.equal(await retry.run(), retry.clerk, `${option} can retry without a new identity`);
  assert.equal(retry.timers.size, 0);
  if (option !== "failLoad") assert.ok(retry.scripts.some(s => s.removed), "Failed script is removed");
}
const missing = fixture({ missingUI: true });
await assert.rejects(missing.run(), /UI did not initialize/);
assert.equal(missing.loads.length, 0, "Missing UI must not initialize a headless SDK");
const headless = fixture({ existingHeadless: true });
await assert.rejects(headless.run(), /needs to reload/);
assert.equal(headless.loads.length, 0, "An already-loaded headless instance cannot claim UI readiness");
console.log("Clerk loader passed: ordered UI initialization, shared callers, three retry paths, missing UI and headless guard.");

// On a newly migrated origin, authentication can finish before the first
// private pull. Startup must wait for that pull and remain account-fenced.
const returnStart = source.indexOf("async function resumeClerkSignInReturn()");
const returnSource = source.slice(returnStart, source.indexOf("\nfunction loadAppleIDScript", returnStart));
assert.ok(returnStart >= 0 && returnSource.includes("return account;"));
function returnFixture() {
  const events = [];
  let resolveSync, generation = 1;
  const sync = new Promise(resolve => { resolveSync = resolve; });
  const account = {userID: "synthetic-existing-owner"};
  const context = vm.createContext({
    URL, state: {utilities: {}}, console: {warn() {}},
    window: {location: {href: "https://per.codes/workspace?clerk_return=1"}, history: {replaceState() {}}},
    saveWorkspaceState() {},
    clerkWebSignInConfig: async () => ({available: true}),
    completeClerkPermitextSignIn: async () => { events.push("authenticated"); return account; },
    captureAccountRequest: () => generation,
    ensureSyncedContentForRender: () => { events.push("pull"); return sync; },
    requireCurrentAccountRequest: captured => { if (captured !== generation) throw new Error("ACCOUNT_CONTEXT_CHANGED"); }
  });
  vm.runInContext(`let clerkSignInReturnNotice = null; ${returnSource}; globalThis.run = resumeClerkSignInReturn;
    globalThis.notice = () => clerkSignInReturnNotice;`, context);
  return {context, account, events, resolveSync, changeAccount: () => { generation += 1; }};
}
for (const accountChanges of [false, true]) {
  const restore = returnFixture();
  let settled = false;
  const pending = restore.context.run().then(value => { settled = true; return value; });
  await new Promise(setImmediate);
  assert.deepEqual(restore.events, ["authenticated", "pull"]);
  assert.equal(settled, false, "The Clerk return must not finish while private restoration is pending.");
  if (accountChanges) restore.changeAccount();
  restore.resolveSync();
  const result = await pending;
  assert.equal(result, accountChanges ? null : restore.account);
  assert.equal(restore.context.notice()?.isError || false, accountChanges,
    "A switched account cannot complete the previous owner's sign-in return.");
}
console.log("Clerk return passed: private restoration completes before startup, with account-switch fencing.");
