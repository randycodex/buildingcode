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
assert.equal(emptyWorkspaceLayout().projectHostPaneID, "");
assert.equal(emptyWorkspaceLayout().paneWidthDefaultsVersion, 4);
assert.equal(workspaceLayoutHasVisiblePanes(emptyWorkspaceLayout()), false);

const migratedQuestionIndexWidth = normalizeWorkspaceLayout({
  paneWeights: {
    "cq:project-1:_:question-index": 600,
    "cq:project-1:question-1:decision-record": 720
  },
  codeQuestionWorkspace: {
    activeQuestionID: "question-1",
    questionIndexOpen: true,
    openPanes: [
      {
        projectID: "project-1",
        questionID: "_",
        paneRole: "question-index",
        paneID: "cq:project-1:_:question-index"
      },
      {
        projectID: "project-1",
        questionID: "question-1",
        paneRole: "decision-record",
        paneID: "cq:project-1:question-1:decision-record"
      }
    ]
  },
  projectDetails: [{ id: "project-1", name: "Project 1" }]
});
assert.equal(migratedQuestionIndexWidth.paneWeights["cq:project-1:_:question-index"], 300);
assert.equal(migratedQuestionIndexWidth.paneWeights["cq:project-1:question-1:decision-record"], 720);
assert.equal(migratedQuestionIndexWidth.paneWidthDefaultsVersion, 4);
const migratedSettingsWidth = normalizeWorkspaceLayout({
  paneWidthDefaultsVersion: 3,
  paneWeights: { "utility:settings": 400 }
});
assert.equal(migratedSettingsWidth.paneWeights["utility:settings"], 600);
const preservedSettingsWidth = normalizeWorkspaceLayout({
  paneWidthDefaultsVersion: 4,
  paneWeights: { "utility:settings": 480 }
});
assert.equal(preservedSettingsWidth.paneWeights["utility:settings"], 480);
const preservedResizedQuestionIndex = normalizeWorkspaceLayout({
  ...migratedQuestionIndexWidth,
  paneWeights: {
    ...migratedQuestionIndexWidth.paneWeights,
    "cq:project-1:_:question-index": 440
  }
});
assert.equal(preservedResizedQuestionIndex.paneWeights["cq:project-1:_:question-index"], 440);

const legacyLayout = normalizeWorkspaceLayout({
  readers: [{ id: "reader-1", codePrefix: "BC" }, { id: "comparison", comparisonManaged: true }],
  projectDetail: { id: "project-1", name: "Project 1", color: "#2f8f4e" },
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

const restoredResearchLayout = normalizeWorkspaceLayout({
  utilities: { analysis: true },
  researchConversationID: "research-1",
  paneOrder: ["utility:analysis", "research:conversation:research-1"],
  paneWeights: {
    "research:conversation:research-1": 742
  }
});
assert.equal(restoredResearchLayout.utilities.analysis, true);
assert.equal(restoredResearchLayout.researchConversationID, "");
assert.deepEqual(restoredResearchLayout.paneOrder, ["utility:analysis"]);
assert.deepEqual(restoredResearchLayout.paneWeights, { "utility:analysis": 742 });

const capturedResearchLayout = captureWorkspaceLayout({
  ...emptyWorkspaceLayout(),
  utilities: { analysis: true },
  researchConversationID: "research-2",
  paneOrder: ["utility:analysis", "research:conversation:research-2"],
  paneWeights: {
    "utility:analysis": 600,
    "research:conversation:research-2": 640
  }
});
assert.equal(capturedResearchLayout.researchConversationID, "");
assert.deepEqual(capturedResearchLayout.paneOrder, ["utility:analysis"]);
assert.deepEqual(capturedResearchLayout.paneWeights, { "utility:analysis": 600 });

const hostedProjectLayout = normalizeWorkspaceLayout({
  utilityInstances: [{ id: "saved-1", key: "saved" }, { id: "saved-2", key: "saved" }],
  projectHostPaneID: "utility:saved:saved-2"
});
assert.equal(hostedProjectLayout.projectHostPaneID, "utility:saved:saved-2");
assert.equal(normalizeWorkspaceLayout({
  utilityInstances: [{ id: "saved-1", key: "saved" }],
  projectHostPaneID: "utility:saved:missing"
}).projectHostPaneID, "");

const orphanProjectTools = normalizeWorkspaceLayout({
  notebooks: [{ id: "project-1", name: "Project 1" }],
  workboards: [{ id: "project-1", name: "Project 1" }],
  reportDrafts: [{ id: "project-1", name: "Project 1" }],
  coordinations: [{ id: "project-1", name: "Project 1" }],
  coordinationThreads: [{ id: "project-1", name: "Project 1", threadID: "thread-1" }]
});
assert.deepEqual(orphanProjectTools.notebooks, []);
assert.deepEqual(orphanProjectTools.workboards, []);
assert.deepEqual(orphanProjectTools.reportDrafts, []);
assert.deepEqual(orphanProjectTools.coordinations, []);
assert.deepEqual(orphanProjectTools.coordinationThreads, []);
assert.equal(workspaceLayoutHasVisiblePanes(orphanProjectTools), false);

const genericWorkboard = normalizeWorkspaceLayout({
  workboards: [{ id: "permitext-generic-workboard", name: "Workboard" }],
  paneOrder: ["project:workboard:permitext-generic-workboard"],
  paneWeights: { "project:workboard:permitext-generic-workboard": 750 }
});
assert.equal(genericWorkboard.workboards[0].id, "permitext-generic-workboard");
assert.equal(workspaceLayoutHasVisiblePanes(genericWorkboard), true);

const conflictingProjectTools = normalizeWorkspaceLayout({
  projectDetails: [{ id: "project-2", name: "Project 2", color: "#3f6f9f" }],
  notebooks: [{ id: "project-1", name: "Project 1" }],
  workboards: [{ id: "project-2", name: "Stale Project 2 label" }],
  coordinations: [{ id: "project-2", name: "Project 2" }],
  coordinationThreads: [{ id: "project-1", name: "Project 1", threadID: "thread-1" }]
});
assert.deepEqual(conflictingProjectTools.notebooks, []);
assert.deepEqual(conflictingProjectTools.workboards, []);
assert.equal(conflictingProjectTools.coordinations[0].id, "project-2");
assert.deepEqual(conflictingProjectTools.coordinationThreads, []);

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

const hostedSourceState = {
  ...emptyWorkspaceLayout(),
  utilityInstances: [{ id: "saved-1", key: "saved" }, { id: "saved-2", key: "saved" }],
  projectHostPaneID: "utility:saved:saved-2"
};
const capturedHostedLayout = captureWorkspaceLayout(hostedSourceState);
assert.equal(capturedHostedLayout.projectHostPaneID, "utility:saved:saved-2");
const hostedDestinationState = {};
applyWorkspaceLayout(hostedDestinationState, capturedHostedLayout);
assert.equal(hostedDestinationState.projectHostPaneID, "utility:saved:saved-2");
const duplicatedHosted = duplicateWorkspace(registry, created.workspace.id, capturedHostedLayout, options);
assert.equal(duplicatedHosted.layout.projectHostPaneID, "utility:saved:saved-2");

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
