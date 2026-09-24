import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("const notebookReturnScrollPositions = new Map();");
const end = source.indexOf("\nconst notebookCardMenuOpenByProject", start);
assert.ok(start >= 0 && end > start);
const helpers = source.slice(start, end);
const c = vm.createContext({ accountRuntimeGeneration: 1 });
vm.runInContext(helpers + "\nglobalThis.positions = notebookReturnCardIDs;", c);
const identity = { generation: 1, workspaceID: "a", projectID: "project" };
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
  const f = vm.createContext({
    accountRuntimeGeneration: 1, returnScrollContext: identity, projectID: "project",
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
