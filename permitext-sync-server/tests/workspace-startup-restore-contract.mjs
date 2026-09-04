import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import * as workspace from "../public/workspace-state.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function declaration(name, kind = "function") {
  const marker = `${kind} ${name}${kind === "function" ? "(" : " ="}`;
  const index = source.indexOf(marker);
  assert.ok(index >= 0, marker);
  const end = source.indexOf(kind === "function" ? "\n}" : ";\n", index);
  assert.ok(end > index, marker);
  return { index, text: source.slice(index, end + (kind === "function" ? 2 : 1)) };
}
const functions = ["loadWorkspaceState", "loadPersistedAccount", "normalizeUtilityInstances", "newUtilityInstance",
  "normalizeProjectIdentities", "projectIdentity", "projectStructuredFacts", "normalizeProjectStructuredFact",
  "projectColor", "folderType", "projectDetailMatches", "workboardProjectID", "projectDetailKey",
  "clampNumber", "normalizeReaderSettings", "normalizeSearchCodeFilters", "normalizeSearchHistorySplitRatio",
  "normalizeResearchEvidenceSplitRatio", "normalizeSearchHistory", "normalizeRecentSearchHistory",
  "normalizeSavedSortMode", "saveWorkspaceState", "persistWorkspaceRegistry"].map((name) => declaration(name));
const constants = ["projectColorOptions", "projectStructuredFactStatuses", "repeatableUtilityKeys", "savedSortModes",
  "sharedWorkspaceStateKeys", "globalWorkspaceStateKeys", "defaultReaderSettings", "recentSearchLimit", "recentViewLimit"]
  .map((name) => declaration(name, "const"));
const initialize = { index: source.indexOf("let state = loadWorkspaceState(initialPersistedAccount);"),
  text: "let state = loadWorkspaceState(initialPersistedAccount); globalThis.restored = state;" };
assert.ok(initialize.index > 0);
const layout = { ...workspace.emptyWorkspaceLayout(),
  utilityInstances: [{ id: "saved-pane", key: "saved", selectedFolderID: "project" }, { id: "search-pane", key: "search", query: "ramps" }],
  projectDetails: [{ id: "project", name: "Synthetic Project", structuredFacts: [{ key: "stories", label: "Stories", value: "3", status: "confirmed" }] }],
  notebooks: [{ id: "project", name: "Synthetic Project", structuredFacts: [{ key: "stories", label: "Stories", value: "3", status: "confirmed" }] }],
  paneOrder: ["saved:saved-pane", "notebook:project", "search:search-pane"] };
const registry = { version: 1, activeWorkspaceID: "workspace", workspaces: [{ id: "workspace", name: "Synthetic workspace", createdAt: "2026-09-04T00:00:00Z", updatedAt: "2026-09-04T00:00:00Z" }] };

function restore({ layoutJSON = JSON.stringify(layout), regressOrder = false, storedColor = false } = {}) {
  const logs = [];
  const storedLayout = storedColor ? JSON.stringify({ ...layout, notebooks: layout.notebooks.map((p) => ({ ...p, structuredFacts: [], color: "#6674c8" })), projectDetails: layout.projectDetails.map((p) => ({ ...p, structuredFacts: [] })) }) : layoutJSON;
  const records = new Map([["shared", JSON.stringify({ localProjects: [{ id: "project" }], syncOutbox: [{ accountUserID: "account", mutation: { id: "pending" } }] })], ["registry", JSON.stringify(registry)], ["layout:workspace", storedLayout]]);
  const initialRecords = JSON.stringify([...records]);
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: (key) => records.delete(key) };
  const context = vm.createContext({ ...workspace, crypto: webcrypto,
    console: { error: (...values) => logs.push(values) }, localStorage: storage,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    initialPersistedAccount: { userID: "account" }, detachedProjectWindow: false,
    baseWorkspaceKey: "shared", tabWorkspaceKey: "tab", workspaceKey: "shared", workspaceRegistryKey: "registry", workspaceStateKeyPrefix: "layout:", activeWorkspaceSessionKey: "active", accountSessionKey: "account",
    releaseSurfaceVisibility: { workboard: false, coordination: false }, genericWorkboardIdentity: { id: "retired" },
    emptyCodeQuestionWorkspaceState: () => ({}), workspaceLayoutWithoutCodeQuestionData: (value) => value,
    track: { scrollLeft: 0 }, persistCodeQuestionAccountState() {}, updateConnectionStatus() {}, workspaceSnapshotKey: (id) => `layout:${id}`
  });
  const ordered = [...functions, ...constants.map((item) => regressOrder && /const project(?:ColorOptions|StructuredFactStatuses) =/.test(item.text) ? { ...item, index: source.length } : item), initialize].sort((a, b) => a.index - b.index);
  vm.runInContext(`let workspaceRegistry = null; let activeWorkspaceID = ""; let workspaceRestoreError = null; ${ordered.map((item) => item.text).join("\n")}
    globalThis.restoreFailure = () => workspaceRestoreError; globalThis.save = saveWorkspaceState;`, context, { filename: "actual-workspace-declaration-order.js" });
  return { context, records, initialRecords, logs };
}

// Reproduce each former early-restore dependency failure in the actual declaration order.
for (const storedColor of [false, true]) {
  const before = restore({ regressOrder: true, storedColor });
  assert.equal(before.context.restoreFailure()?.name, "ReferenceError");
  assert.equal(before.context.restored.utilityInstances.length, 0);
  before.context.save();
  assert.equal(JSON.stringify([...before.records]), before.initialRecords, "Even a runtime restore failure must retain the original registry, layout, private records and outbox.");
}
const after = restore();
assert.equal(after.context.restoreFailure(), null);
assert.deepEqual(Array.from(after.context.restored.utilityInstances, (item) => item.key), ["saved", "search"]);
assert.equal(after.context.restored.notebooks.length, 1);
assert.equal(after.context.restored.notebooks[0].color, "#6674c8");
assert.equal(after.context.restored.notebooks[0].structuredFacts[0].status, "confirmed");
assert.deepEqual(Array.from(after.context.restored.paneOrder), layout.paneOrder);
assert.equal(after.context.restored.syncOutbox.length, 1);
assert.equal(after.logs.length, 0);

// Corrupt persisted JSON must be visible and protected from later automatic saves.
const corrupt = restore({ layoutJSON: '{"privateSyntheticMarker":' });
assert.equal(corrupt.context.restoreFailure()?.name, "SyntaxError");
corrupt.context.save();
assert.equal(JSON.stringify([...corrupt.records]), corrupt.initialRecords);
assert.equal(corrupt.logs.length, 1);
assert.ok(!JSON.stringify(corrupt.logs).includes("privateSyntheticMarker"), "Console diagnostics must omit private JSON parser excerpts.");
console.log("Workspace startup restore contract passed: actual declaration-order Project/Notebook/Saved/Search restore, legacy defaults, and failure preservation.");

// A corrupt secondary layout cannot become the active empty workspace, be
// copied as an empty layout, or destroy the current workspace during deletion.
for (const operation of ["switchWorkspace", "duplicateNamedWorkspace", "removeNamedWorkspace"]) {
  const test = restore();
  const context = test.context;
  const issues = [];
  context.captureAccountRequest = () => ({ generation: 1 });
  context.isCurrentAccountRequest = () => true;
  context.confirmWorkspaceTransition = async () => true;
  context.confirmWebWarning = async () => true;
  context.presentWorkspaceIssue = (message) => issues.push(message);
  context.renderWorkspaceTabs = () => {};
  context.focusActiveWorkspaceTab = () => {};
  const snapshot = declaration("loadWorkspaceSnapshot").text;
  const marker = `async function ${operation}(`;
  const start = source.indexOf(marker), end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(`${snapshot}\n${source.slice(start, end + 2)}
    workspaceRegistry = {...workspaceRegistry, workspaces: [...workspaceRegistry.workspaces, {id:"corrupt", name:"Corrupt"}]};
    globalThis.transitionTest = ${operation}; globalThis.currentWorkspace = () => activeWorkspaceID;`, context);
  test.records.set("layout:corrupt", '{"privateSecondaryMarker":');
  const before = JSON.stringify([...test.records]);
  await context.transitionTest(operation === "removeNamedWorkspace" ? "workspace" : "corrupt");
  assert.equal(context.currentWorkspace(), "workspace");
  assert.equal(JSON.stringify([...test.records]), before, `${operation} must not write or delete any stored layout after the target fails to load.`);
  assert.equal(issues.length, 1);
  assert.ok(!JSON.stringify(test.logs).includes("privateSecondaryMarker"));
}
console.log("Secondary workspace restore contract passed: switch, duplicate and delete preserve corrupt and current layouts with a nonblocking recovery notice.");
