import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function commitWorkspaceRename(");
const end = source.indexOf("\nfunction beginWorkspaceRename", start);
assert.ok(start >= 0 && end > start);
async function check({ stale = false, failed = false, declined = false, local = false } = {}) {
  let resolve, reject, generation = 1;
  const pending = new Promise((success, failure) => { resolve = success; reject = failure; });
  const calls = [];
  let projects = [{ id: "project-a", name: "Old", color: "orange" }];
  const context = vm.createContext({
    workspaceRegistry: { workspaces: [{ id: "workspace-a", ...(local ? {} : { projectID: "project-a" }) }] },
    activeFolderRecords: records => records, currentContentSummary: () => ({ projects }),
    projectRecordID: project => project.id,
    captureAccountRequest: () => generation, isCurrentAccountRequest: identity => identity === generation,
    updateProjectFolder(project, change) { calls.push(["update", project.id, change.name]); return pending; },
    refreshMountedProjectChrome(project) { calls.push(["chrome", project.name, project.color]); },
    presentWorkspaceIssue(message) { calls.push(["issue", message]); },
    renameWorkspace(registry, id, name) { calls.push(["rename", id, name]); return registry; },
    persistWorkspaceRegistry() { calls.push(["persist"]); },
    renderWorkspaceTabs() { calls.push(["tabs"]); }, focusActiveWorkspaceTab() { calls.push(["focus"]); }
    // Intentionally no renderWorkspace: a rename must preserve mounted editors.
  });
  vm.runInContext(source.slice(start, end), context);
  context.commitWorkspaceRename("workspace-a", "New");
  assert.equal(calls.some(call => call[0] === "chrome"), false);
  if (local) {
    assert.deepEqual(calls.map(call => call[0]), ["rename", "persist", "tabs", "focus"]);
    return;
  }
  projects = [{ id: "project-a", name: "Server canonical name", color: "blue" }];
  if (stale) generation++;
  if (failed) reject(new Error("Rename failed")); else resolve(!declined);
  await new Promise(done => setImmediate(done));
  const updates = calls.filter(call => ["chrome", "issue"].includes(call[0]));
  assert.deepEqual(updates, stale || declined ? [] : failed ? [["issue", "Rename failed"]] : [["chrome", "Server canonical name", "blue"]]);
}
await check();
await check({ stale: true });
await check({ failed: true });
await check({ failed: true, stale: true });
await check({ declined: true });
await check({ local: true });
console.log("Workspace rename passed: targeted latest Project/Saved chrome, preserved editors, local rename and stale/error guards.");
