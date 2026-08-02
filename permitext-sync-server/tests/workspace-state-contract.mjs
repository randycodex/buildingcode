import assert from "node:assert/strict";

import {
  applyWorkspaceLayout,
  captureWorkspaceLayout,
  createWorkspace,
  deleteWorkspace,
  duplicateWorkspace,
  emptyWorkspaceLayout,
  normalizeWorkspaceLayout,
  normalizeWorkspaceRegistry,
  renameWorkspace,
  reorderWorkspace,
  workspaceLayoutHasVisiblePanes,
  workspaceRegistrySchemaVersion
} from "../public/workspace-state.js";

let id = 0;
const options = {
  makeID: () => `workspace-${++id}`,
  now: "2026-07-31T12:00:00.000Z"
};

assert.equal(workspaceRegistrySchemaVersion(), 2);

const blankRegistry = normalizeWorkspaceRegistry(null, options);
assert.equal(blankRegistry.workspaces.length, 1);
assert.equal(blankRegistry.workspaces[0].name, "Main");
assert.equal(blankRegistry.activeWorkspaceID, blankRegistry.workspaces[0].id);
assert.deepEqual(emptyWorkspaceLayout().readers, []);
assert.equal(workspaceLayoutHasVisiblePanes(emptyWorkspaceLayout()), false);

const legacyLayout = normalizeWorkspaceLayout({
  readers: [{ id: "reader-1", codePrefix: "BC" }, { id: "comparison", comparisonManaged: true }],
  utilityInstances: [{ id: "search-1", key: "search" }],
  utilities: { analysis: true },
  paneOrder: ["reader:reader-1", "section:detail:search-1", "utility:search:search-1"],
  paneWeights: {
    "reader:reader-1": 620,
    "section:detail:search-1": 400,
    invalid: 10
  },
  sectionDetails: { "search-1": { sectionID: "8779" } },
  coordinations: [{ id: "project-1", name: "Project 1" }],
  coordinationThreads: [{ id: "project-1", name: "Project 1", threadID: "thread-1" }],
  coordinationFilters: { "project-1": "waiting", invalid: "blocked" },
  trackScrollLeft: 220
});
assert.equal(legacyLayout.readers.length, 1);
assert.deepEqual(legacyLayout.paneOrder, ["reader:reader-1", "utility:search:search-1"]);
assert.deepEqual(legacyLayout.paneWeights, { "reader:reader-1": 620 });
assert.equal(legacyLayout.sectionDetails["search-1"].sectionID, "8779");
assert.equal(legacyLayout.coordinations[0].id, "project-1");
assert.equal(legacyLayout.coordinationThreads[0].threadID, "thread-1");
assert.deepEqual(legacyLayout.coordinationFilters, { "project-1": "waiting" });
assert.equal(workspaceLayoutHasVisiblePanes(legacyLayout), true);

let registry = blankRegistry;
const created = createWorkspace(registry, options);
registry = created.registry;
assert.equal(registry.workspaces.length, 2);
assert.equal(registry.activeWorkspaceID, created.workspace.id);
assert.equal(created.workspace.name, "Workspace 2");
assert.equal(workspaceLayoutHasVisiblePanes(created.layout), false);

registry = renameWorkspace(registry, created.workspace.id, "  Egress   Study  ", options);
assert.equal(registry.workspaces[1].name, "Egress Study");
registry = renameWorkspace(registry, registry.workspaces[0].id, "Egress Study", options);
assert.equal(registry.workspaces[0].name, "Egress Study 2");

const duplicated = duplicateWorkspace(registry, created.workspace.id, legacyLayout, options);
assert.ok(duplicated);
registry = duplicated.registry;
assert.equal(registry.activeWorkspaceID, duplicated.workspace.id);
assert.equal(duplicated.workspace.name, "Egress Study Copy");
assert.deepEqual(duplicated.layout, legacyLayout);
duplicated.layout.readers[0].codePrefix = "ZR";
assert.equal(legacyLayout.readers[0].codePrefix, "BC");

const firstID = registry.workspaces[0].id;
registry = reorderWorkspace(registry, duplicated.workspace.id, firstID, "before", options);
assert.equal(registry.workspaces[0].id, duplicated.workspace.id);
assert.equal(registry.activeWorkspaceID, duplicated.workspace.id);

const sourceState = {
  ...emptyWorkspaceLayout(),
  readers: [{ id: "reader-a", codePrefix: "FGC" }],
  paneOrder: ["reader:reader-a"],
  paneWeights: { "reader:reader-a": 520 },
  localProjects: [{ id: "global-project" }]
};
const captured = captureWorkspaceLayout(sourceState, { trackScrollLeft: 91 });
assert.equal(captured.trackScrollLeft, 91);
assert.equal("localProjects" in captured, false);
const destinationState = { localProjects: sourceState.localProjects };
applyWorkspaceLayout(destinationState, captured);
assert.deepEqual(destinationState.localProjects, sourceState.localProjects);
assert.deepEqual(destinationState.readers, sourceState.readers);

const activeBeforeDelete = registry.activeWorkspaceID;
const deletion = deleteWorkspace(registry, activeBeforeDelete, options);
assert.equal(deletion.deletedWorkspaceID, activeBeforeDelete);
assert.notEqual(deletion.registry.activeWorkspaceID, activeBeforeDelete);

const oneRegistry = normalizeWorkspaceRegistry({
  activeWorkspaceID: "only",
  workspaces: [{ id: "only", name: "Only" }]
}, options);
const lastDeletion = deleteWorkspace(oneRegistry, "only", options);
assert.equal(lastDeletion.deletedWorkspaceID, "");
assert.equal(lastDeletion.registry.workspaces.length, 1);
assert.equal(lastDeletion.registry.workspaces[0].name, "Main");
assert.equal(workspaceLayoutHasVisiblePanes(lastDeletion.replacementLayout), false);

console.log("workspace state contract tests passed");
