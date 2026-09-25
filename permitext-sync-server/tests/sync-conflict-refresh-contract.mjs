import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function resolveSyncConflict(");
const end = source.indexOf("\nfunction scheduleSyncOutboxRetry", start);
assert.ok(start >= 0 && end > start);
async function check(keepLocal, kind, switchAccount = false) {
  const calls = [];
  let generation = 1;
  const account = { userID: "account-a" };
  const record = { id: "record-a", projectID: "project-a", noteBody: "Remote note" };
  const entry = { id: "conflict-a", accountUserID: account.userID, mutation: { kind, record } };
  const changed = new Error("Account changed");
  const c = vm.createContext({
    Date, state: { syncConflicts: [entry] },
    captureAccountRequest: () => ({ userID: account.userID, generation }),
    activeAccount: () => account,
    requireCurrentAccountRequest(identity) { if (identity.generation !== generation) throw changed; },
    mutationKindAndRecord: mutation => mutation,
    detailNoteValueForTarget: () => "Current local note",
    enqueueSyncMutation(mutation) { calls.push(["enqueue", mutation]); },
    async flushSyncOutbox(options) { calls.push(["flush", options]); if (switchAccount) generation++; },
    discardLocalMutationOverlay(mutation) { calls.push(["discard", mutation]); },
    saveWorkspaceState() { calls.push(["persist"]); },
    async loadSyncedContent(options) { calls.push(["pull", options]); if (switchAccount) generation++; },
    syncedWorkboardForProject: id => ({ id, server: true }),
    async replaceLocalWorkboard(id, board) { calls.push(["workboard", id, board]); },
    async refreshSyncedWorkspaceInPlace(options) { calls.push(["refresh", options]); }
  });
  vm.runInContext(source.slice(start, end), c);
  if (switchAccount) await assert.rejects(c.resolveSyncConflict(entry, keepLocal), error => error === changed);
  else await c.resolveSyncConflict(entry, keepLocal);
  const names = calls.map(call => call[0]);
  if (keepLocal) {
    assert.deepEqual(names, switchAccount ? ["enqueue", "flush"] : ["enqueue", "flush", "refresh"]);
    assert.equal(calls[0][1][kind].noteBody, "Current local note");
    assert.equal(calls[0][1][kind].userID, account.userID);
  } else {
    assert.equal(c.state.syncConflicts.length, 0);
    const expected = kind === "workboard" ? ["persist", "pull"] : ["discard", "persist", "pull"];
    if (!switchAccount && kind === "workboard") expected.push("workboard");
    if (!switchAccount) expected.push("refresh");
    assert.deepEqual(names, expected);
  }
  if (!switchAccount) assert.equal(calls.at(-1)[1].accountUserID, "account-a");
}
await check(true, "annotation");
await check(false, "annotation");
await check(false, "workboard");
await check(true, "annotation", true);
await check(false, "annotation", true);
await check(false, "workboard", true);
console.log("Sync conflict refresh passed: local/server resolution, workboard replacement, targeted account refresh and stale-account suppression.");
