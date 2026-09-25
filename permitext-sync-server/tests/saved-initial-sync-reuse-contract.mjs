import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
function fixture() {
  let generation = 1;
  let account = { userID: "synthetic-a" };
  const calls = { loads: 0, summaries: 0, projects: 0 };
  const callbacks = [];
  const panel = {
    isConnected: true, classList: { add() {} },
    querySelector: () => ({ hidden: false })
  };
  const context = vm.createContext({
    syncedContent: { userID: account.userID, status: "connected", workspacePresentationAccess: "verified" },
    syncLoadPromise: null, navigator: { onLine: true }, serverReachable: true,
    activeAccount: () => account,
    captureAccountRequest: () => generation,
    isCurrentAccountRequest: identity => identity === generation,
    summarizeMutations: () => ({}),
    async loadSyncedContent() { calls.loads++; return context.syncedContent; },
    currentContentSummary() { calls.summaries++; return { projects: [], savedItems: [], annotations: [], projectSections: [] }; },
    async projectsWithOrganizationAccess(projects) { return projects; },
    async reconcileProjectStudioWithSavedFolders() {},
    async renderSavedFolderContext() { return null; },
    renderSavedProjects() { calls.projects++; },
    consolidatedSavedAnnotations: values => values,
    hasCapability: () => true,
    normalizeSavedInstance: value => value,
    scopeSavedInstanceToWorkspace: value => value,
    paneIDForUtilityInstance: () => "saved:synthetic",
    savedTemplate: {}, renderTemplate: () => panel,
    applyPaneWeight() {}, clear() {}, renderSavedPlanUsage() {},
    mergeProjectsWithOrganizationAccess: values => values,
    requestAnimationFrame: callback => callbacks.push(callback),
    hydrateSavedPanelWhenConnected(_panel, _instance, _paneID, _attempt, options) {
      context.initialOptions = options;
    }
  });
  vm.runInContext(["ensureSyncedContentForRender", "performSavedPanelHydration", "renderSaved"].map(actual).join("\n"), context);
  return { context, calls, panel, callbacks, switchAccount() { generation++; account = { userID: "synthetic-b" }; panel.isConnected = false; context.syncedContent = { userID: account.userID, status: "connected" }; } };
}
{
  const { context, calls, panel, callbacks } = fixture();
  const options = { preserveProjectChrome: false, customOption: "retained" };
  assert.equal(await context.renderSaved({ id: "synthetic" }, options), panel);
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.equal(context.initialOptions.reuseVerifiedSync, true);
  assert.equal(context.initialOptions.customOption, "retained");
  assert.equal(options.reuseVerifiedSync, undefined, "Initial-only policy must not mutate the caller's options");
  await context.performSavedPanelHydration(panel, {}, "saved:synthetic", context.initialOptions);
  assert.equal(calls.loads, 0, "Initial publication reuses the completed same-account sync");
  await context.performSavedPanelHydration(panel, {}, "saved:synthetic");
  assert.equal(calls.loads, 1, "Explicit/default refresh still requests fresh sync");
}
{
  const { context, calls, panel } = fixture();
  panel.isConnected = false;
  await context.performSavedPanelHydration(panel, {}, "saved:synthetic", { reuseVerifiedSync: true });
  assert.equal(calls.summaries, 0, "Disconnected panes do not read/render private summaries");
  assert.equal(calls.projects, 0);
}
{
  const { context, calls, panel, switchAccount } = fixture();
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  pending.accountIdentity = 1;
  context.syncLoadPromise = pending;
  const hydration = context.performSavedPanelHydration(panel, {}, "saved:synthetic", { reuseVerifiedSync: true });
  await Promise.resolve();
  assert.equal(calls.summaries, 0, "Initial hydration waits for an in-flight sync to finish");
  switchAccount();
  resolve({ userID: "synthetic-a", status: "connected" });
  await hydration;
  assert.equal(calls.loads, 0);
  assert.equal(calls.summaries, 0, "Old account completion cannot render its disconnected pane");
}
console.log("Saved initial sync reuse passed: real initial option wiring, verified reuse, explicit refresh freshness, pending synchronization and detached/account-change suppression.");
