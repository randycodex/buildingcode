import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const privateSource = await readFile(new URL("../public/private-workspace-state.js", import.meta.url), "utf8");
assert.match(privateSource, /key.startsWith\(prefix\).*storage.removeItem\(key\)/, "Account cleanup removes every account-workspace child key");
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("const notebookReturnScrollPositions = new Map();");
const end = source.indexOf("\nconst notebookCardMenuOpenByProject", start);
assert.ok(start >= 0 && end > start);
const helpers = source.slice(start, end);
const storage = new Map();
const environment = () => ({ accountRuntimeGeneration: 1, activeAccount: () => ({userID: "owner-a"}),
  privateWorkspaceKeys: userID => ({baseWorkspaceKey: `private:${userID}`}),
  localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)} });
const c = vm.createContext(environment());
vm.runInContext(helpers + "\nglobalThis.positions = notebookReturnCardIDs;", c);
const identity = { userID: "owner-a", generation: 1, workspaceID: "a", projectID: "project" };
const cards = [{ id: "first" }, { id: "remembered" }];
c.rememberNotebookReturnCard(identity, "remembered");
assert.equal(c.readNotebookReturnCard(identity, cards), "remembered");
for (const other of [{ ...identity, workspaceID: "b" }, { ...identity, projectID: "other" }, { ...identity, generation: 2 }]) {
  assert.equal(c.readNotebookReturnCard(other, cards), "");
}
assert.equal(c.readNotebookReturnCard(identity, [{ id: "remembered", deletedAt: "2026-09-24" }]), "");
assert.equal(c.positions.size, 0, "Deleted remembered card is pruned");
c.rememberNotebookReturnCard(identity, "missing");
assert.equal(c.readNotebookReturnCard(identity, cards), "");
assert.equal(c.positions.size, 0, "Missing remembered card is pruned");
for (let index = 0; index < 101; index++) c.rememberNotebookReturnCard({ ...identity, projectID: String(index) }, "remembered");
assert.equal(c.positions.size, 100);
assert.equal(c.readNotebookReturnCard({ ...identity, projectID: "0" }, cards), "");
assert.ok([...c.positions.values()].every(value => typeof value === "string"));
c.accountRuntimeGeneration = 2;
c.rememberNotebookReturnCard(identity, "stale");
assert.equal(c.positions.size, 100);
assert.equal(c.readNotebookReturnCard({ ...identity, projectID: "100" }, cards), "");

const branchStart = source.indexOf("      const pendingCardID = pendingNotebookCardByProject.get(projectID);", source.indexOf("async function renderProjectNotebook("));
const branchEnd = source.indexOf("\n    } else {\n      await renderFocusedCard();", branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart);
const branch = source.slice(branchStart, branchEnd);
async function scenario({ status = null, explicit = false, stale = "", onlyRemembered = false } = {}) {
  const calls = [];
  const mountState = {};
  const error = Object.assign(new Error("Synthetic load failure"), { status });
  storage.clear();
  const f = vm.createContext({
    ...environment(), accountRuntimeGeneration: 1, returnScrollContext: identity, projectID: "project",
    cards: onlyRemembered ? [{ id: "remembered" }] : [...cards],
    pendingNotebookCardByProject: new Map(explicit ? [["project", "first"]] : []),
    disposed: false, requestIdentity: 1, isCurrentAccountRequest: () => true,
    activeWorkspaceID: "a", notebookMounts: new Map([["project", mountState]]), mountState,
    activeCard: { id: "remembered" },
    async loadCard(id) {
      calls.push(id);
      if (calls.length !== 1 || status === null) return;
      if (stale === "account") f.isCurrentAccountRequest = () => false;
      if (stale === "workspace") f.activeWorkspaceID = "b";
      if (stale === "mount") f.notebookMounts.set("project", {});
      if (stale === "disposed") f.disposed = true;
      throw error;
    },
    async renderFocusedCard() { calls.push("empty"); },
    scheduleIdleNotebookPrefetch() { calls.push("prefetch"); }
  });
  vm.runInContext(helpers, f);
  f.rememberNotebookReturnCard(identity, "remembered");
  const operation = vm.runInContext(`(async () => {${branch}\n})()`, f);
  const shouldFail = status !== null && (explicit || ![404, 410].includes(status) || stale);
  if (shouldFail) {
    await assert.rejects(operation, caught => caught === error);
    assert.deepEqual(calls, [explicit ? "first" : "remembered"]);
  } else {
    await operation;
    assert.deepEqual(calls, status === null ? [explicit ? "first" : "remembered", "prefetch"] : ["remembered", onlyRemembered ? "empty" : "first", "prefetch"]);
    if (status !== null) assert.equal(f.readNotebookReturnCard(identity, cards), "");
  }
  assert.equal(f.pendingNotebookCardByProject.size, 0, "Explicit navigation request is consumed");
}
await scenario();
await scenario({ explicit: true });
for (const status of [404, 410]) {
  await scenario({ status });
  await scenario({ status, onlyRemembered: true });
  await scenario({ status, explicit: true });
  for (const stale of ["account", "workspace", "mount", "disposed"]) await scenario({ status, stale });
}
for (const status of [0, 401, 403, 500, 503]) await scenario({ status });
console.log("Notebook return card passed: bounded identities, missing/deleted pruning, explicit priority,404/410 recovery and network/auth/stale-mount rejection.");

// Fresh JS realm models a full reload; selection survives without sharing any
// document content or relying on the old in-memory map/runtime generation.
storage.clear();
const beforeReload = vm.createContext(environment());
vm.runInContext(helpers, beforeReload);
beforeReload.rememberNotebookReturnCard(identity, "remembered");
const afterReload = vm.createContext({...environment(), accountRuntimeGeneration: 9});
vm.runInContext(helpers, afterReload);
const newIdentity = {...identity, generation: 9};
assert.equal(afterReload.readNotebookReturnCard(newIdentity, cards), "remembered");
assert.equal(afterReload.readNotebookReturnCard({...newIdentity, userID: "owner-b"}, cards), "");
afterReload.activeAccount = () => ({userID: "owner-b"});
assert.equal(afterReload.readNotebookReturnCard(newIdentity, cards), "");
afterReload.rememberNotebookReturnCard(newIdentity, "stale-account");
afterReload.activeAccount = () => ({userID: "owner-a"});
assert.equal(afterReload.readNotebookReturnCard(newIdentity, cards), "remembered");
assert.equal(afterReload.readNotebookReturnCard(newIdentity, [{id: "remembered", archivedAt: "now"}]), "");
assert.equal(afterReload.readNotebookReturnCard(newIdentity, cards), "", "Archived selection is durably pruned");
storage.set('private:owner-a:notebook-return-cards:v1', '{bad-json');
assert.equal(afterReload.readNotebookReturnCard(newIdentity, cards), "");
afterReload.localStorage.setItem = () => { throw new Error('Quota'); };
assert.doesNotThrow(() => afterReload.rememberNotebookReturnCard(newIdentity, "remembered"));
assert.equal(afterReload.readNotebookReturnCard(newIdentity, cards), "remembered");
assert.match(source, /async function renderFocusedCard\(\) \{[\s\S]{0,350}rememberNotebookReturnCard/,
  "Selection must persist as the selected card renders, without waiting for disposal");
console.log("Notebook reload selection passed: fresh runtime, private account/workspace/project scope, archive pruning and storage failure tolerance.");

afterReload.localStorage.getItem = () => { throw new Error('Storage denied'); };
assert.doesNotThrow(() => afterReload.readNotebookReturnCard({...newIdentity, projectID: 'other'}, cards));
assert.match(branch, /cards.find\(card => !card.deletedAt && !card.archivedAt\)/, 'Initial fallback excludes archived and deleted cards');
