import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [appSource, stylesSource, indexSource, serverSource, entitlementSource, swiftModelSource, swiftStoreSource] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../entitlement-contract.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Models/CodeModels.swift", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Data/UserDataStore.swift", import.meta.url), "utf8")
]);

function functionSource(source, name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist.`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = source.indexOf("{", parametersEnd);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}.`);
}

const recentlyViewedPreviewHasEnactedText = new Function(
  `${functionSource(appSource, "escapeRegExp")};\n` +
  `${functionSource(appSource, "sectionDisplayTitle")};\n` +
  `${functionSource(appSource, "stripLeadingSectionNumber")};\n` +
  `${functionSource(appSource, "snippetWithoutDuplicateTitle")};\n` +
  `${functionSource(appSource, "recentlyViewedPreviewHasEnactedText")};\n` +
  "return recentlyViewedPreviewHasEnactedText;"
)();
assert.equal(
  recentlyViewedPreviewHasEnactedText({ sectionNumber: "101.4", title: "101.4 Referenced codes.", previewText: "Referenced codes." }),
  false,
  "A Recently Viewed preview that only repeats the title must be rehydrated from enacted text."
);
assert.equal(
  recentlyViewedPreviewHasEnactedText({ sectionNumber: "101.4", title: "101.4 Referenced codes.", previewText: "The other codes listed in Sections 101.4.1 through 101.4.6 apply." }),
  true,
  "A Recently Viewed preview containing enacted body text must not be fetched again."
);

const folderType = new Function(`${functionSource(appSource, "folderType")}; return folderType;`)();
assert.equal(folderType({}), "project", "Legacy folders must default to Project.");
assert.equal(folderType({ folderType: "reference" }), "reference");
assert.equal(folderType({ folderType: "invalid" }), "project");

const savedEvidenceKey = new Function(
  "syncCodeVersion",
  "defaultSyncCodeVersion",
  `${functionSource(appSource, "normalizeAnnotationBlockID")};\n${functionSource(appSource, "savedEvidenceKey")}; return savedEvidenceKey;`
)((value) => value || "default-library", "default-library");
assert.notEqual(
  savedEvidenceKey({ codeVersion: "library-a", sectionID: 101 }),
  savedEvidenceKey({ codeVersion: "library-b", sectionID: 101 }),
  "The same numeric section in two libraries must remain two canonical saved records."
);
assert.notEqual(
  savedEvidenceKey({ codeVersion: "library-a", sectionID: 101, blockID: "paragraph-1" }),
  savedEvidenceKey({ codeVersion: "library-a", sectionID: 101, blockID: "paragraph-2" }),
  "Two selected paragraphs in the same section must remain independent saved records."
);

const readerChapterSectionSource = functionSource(appSource, "renderReaderChapterSection");
assert.match(
  readerChapterSectionSource,
  /savedSectionRecord\(\{[\s\S]*?sectionID: target\.sectionID,[\s\S]*?codeVersion: target\.codeVersion,[\s\S]*?blockID: target\.blockID[\s\S]*?\}\)/,
  "Each Reader block must resolve its bookmark state using its own block identity."
);
assert.doesNotMatch(
  readerChapterSectionSource,
  /blocks\[0\].*block-1/,
  "A subsection-level bookmark must never be guessed to belong to the first paragraph."
);

const sectionDetailPayloadSource = functionSource(appSource, "makeSectionPayloadFromDetail");
assert.match(
  sectionDetailPayloadSource,
  /blockID: normalizeAnnotationBlockID\(detail\.blockID \|\| detail\.annotationBlockID \|\| detail\.contentBlockID\)/,
  "Source Detail must retain the saved paragraph identity."
);
const sectionDetailSource = functionSource(appSource, "renderSectionDetail");
assert.match(
  sectionDetailSource,
  /sectionTarget\.blockID && detailBlocks\.length > 1[\s\S]*?data-annotation-block-id[\s\S]*?markNotebookEvidenceRange/,
  "Source Detail must highlight the saved paragraph only when the subsection has multiple saveable blocks."
);
const projectEvidenceCountSource = functionSource(appSource, "projectEvidenceCount");
assert.match(
  projectEvidenceCountSource,
  /savedTargets[\s\S]*?savedEvidenceKey\(item\)[\s\S]*?savedTargets\.has\(key\)/,
  "Project counts must ignore stale subsection links that have no exact saved target."
);
const projectDetailSource = functionSource(appSource, "renderProjectDetail");
assert.match(
  projectDetailSource,
  /savedByTarget\.get\(savedEvidenceKey\(link\)\)[\s\S]*?if \(!savedItem\) return null/,
  "Project detail must not revive a stale subsection link when only paragraph saves exist."
);
const openSavedItemSource = functionSource(appSource, "openSavedItemInReader");
assert.match(
  openSavedItemSource,
  /openSourceInReader\([\s\S]*?sectionID[\s\S]*?savedPaneID/,
  "A saved passage must open its exact enacted source in Reader."
);

const normalizeAnnotationTags = new Function(
  `${functionSource(appSource, "normalizeAnnotationTags")}; return normalizeAnnotationTags;`
)();
assert.deepEqual(
  normalizeAnnotationTags(["  Fire   safety ", "fire safety", "Egress", ""]),
  ["Fire safety", "Egress"],
  "Tags must normalize Unicode whitespace and merge case-insensitive duplicates."
);

const normalizeProjectStructuredFact = new Function(
  "projectStructuredFactStatuses",
  `${functionSource(appSource, "normalizeProjectStructuredFact")}; return normalizeProjectStructuredFact;`
)(new Set(["stated", "confirmed", "unknown", "rejected"]));
const projectStructuredFacts = new Function(
  "normalizeProjectStructuredFact",
  `${functionSource(appSource, "projectStructuredFacts")}; return projectStructuredFacts;`
)(normalizeProjectStructuredFact);
const migratedProjectStructuredFacts = new Function(
  "projectStructuredFacts",
  "projectStructuredFactAliases",
  `${functionSource(appSource, "migratedProjectStructuredFacts")}; return migratedProjectStructuredFacts;`
)(projectStructuredFacts, new Map([
  ["stories", ["stories-above-grade", "Stories Above Grade"]],
  ["sprinkler-status", ["sprinkler-protection", "Sprinkler Protection"]],
  ["work-type", ["work-filing-type", "Work / Filing Type"]]
]));
assert.deepEqual(
  normalizeProjectStructuredFact({ key: "occupancy", label: "Occupancy", value: "Group R-2", source: "user" }),
  {
    id: "project-fact:occupancy",
    key: "occupancy",
    label: "Occupancy",
    value: "Group R-2",
    status: "stated",
    source: "user",
    sourceText: "",
    updatedAt: null
  },
  "Manually entered structured facts must normalize into the Project record."
);
const migratedFacts = migratedProjectStructuredFacts({
  structuredFacts: [
    { key: "stories", label: "Stories", value: "6", status: "stated" },
    { key: "travel-distance", label: "Travel Distance", value: "95 feet", status: "stated" },
    { key: "exit-separation", label: "Exit Separation", value: "112 feet", status: "stated" },
    { key: "dead-end-length", label: "Dead-End Length", value: "27 feet", status: "stated" },
    { key: "floor-affected", label: "Floor affected", value: "Third floor", status: "stated" }
  ]
});
assert.deepEqual(
  migratedFacts.map(({ key, label, value }) => [key, label, value]),
  [
    ["stories-above-grade", "Stories Above Grade", "6"],
    ["travel-distance", "Travel Distance", "95 feet"],
    ["exit-separation", "Exit Separation", "112 feet"],
    ["dead-end-length", "Dead-End Length", "27 feet"],
    ["floor-affected", "Floor affected", "Third floor"]
  ],
  "Legacy Structured Facts did not migrate without data loss."
);

assert.match(appSource, /function persistSectionFolderSelection\([\s\S]*?if \(!selectedByID\.size\) return/);
assert.match(appSource, /destinationList\.setAttribute\("aria-multiselectable", "true"\)/);
assert.match(appSource, /confirmButton\.disabled = selected\.length === 0/);
assert.match(appSource, /await persistSectionFolderSelection\(sectionPayload, selectedFolders, projects\)/);
assert.match(appSource, /function unlinkEvidenceFromFolder\([\s\S]*?title: "Remove final destination\?"[\s\S]*?removeBookmark: true/);
assert.match(appSource, /if \(options\.removeBookmark === true\)/);
assert.match(
  appSource,
  /async function clearSettingsBookmarks\(\)[\s\S]*?deletedSavedMutationForSection[\s\S]*?deletedProjectSectionMutationForItem[\s\S]*?operationGroupID[\s\S]*?enqueueSettingsBulkClear\("bookmarks", \{ operationGroupID \}\)/,
  "Clear All Bookmarks must tombstone both canonical saved records and every Project membership in one queued operation group."
);
assert.match(
  appSource,
  /function retryRejectedDeletionConflictsOnce\(account\)[\s\S]*?\["savedItem", "projectSection"\][\s\S]*?codeVersionClear[\s\S]*?SYNC_MUTATION_REJECTED[\s\S]*?enqueueSyncMutation/,
  "The web client must retry deletions rejected by the former Postgres acceptance defect."
);
assert.match(
  appSource,
  /async function persistSectionFolderSelection\([\s\S]*?saveWorkspaceState\(\);[\s\S]*?await refreshProjectMembershipPanes\([\s\S]*?await pushMutationBatch\(mutations\)/,
  "Saving evidence to a Project must update open Project columns before the network round-trip."
);
assert.match(appSource, /function renderUnassignedEvidenceNotice\([\s\S]*?These passages are saved safely without a Project\./);
assert(!appSource.includes("No archived folders."), "An empty archive should not render a redundant placeholder row.");
const savedFolderContextSource = functionSource(appSource, "renderSavedFolderContext");
assert.match(savedFolderContextSource, /projectsSection\.hidden = false/);
assert.match(savedFolderContextSource, /if \(!folder\) \{[\s\S]*?return null;/);
assert.match(savedFolderContextSource, /appendSavedProjectFactEditor\(summary, folder, identity\)/);
assert.match(savedFolderContextSource, /"Notebook"[\s\S]*?"Report"[\s\S]*?releaseSurfaceVisibility\.coordination[\s\S]*?"Coordination"/);
assert.doesNotMatch(savedFolderContextSource, /"Workboard"/);
assert.match(savedFolderContextSource, /context\.dataset\.projectId = projectDetailKey\(identity\)/);
assert.match(savedFolderContextSource, /"Notebook"[\s\S]*?"Report"[\s\S]*?releaseSurfaceVisibility\.coordination[\s\S]*?"Coordination"[\s\S]*?context\.append\(controls\)[\s\S]*?appendSavedProjectFactEditor\(summary, folder, identity\)[\s\S]*?context\.append\(summary\)[\s\S]*?populateSavedEvidenceSection/);
assert.doesNotMatch(savedFolderContextSource, /Blocknotes|appendProjectNotes|appendProjectResearchHistory|loadProjectCoordinationFoundation/);
assert.doesNotMatch(savedFolderContextSource, /appendProjectActivity|Recent Activities/);
const savedEvidenceHeadingSource = functionSource(appSource, "createSavedEvidenceHeading");
const savedEvidenceSectionSource = functionSource(appSource, "populateSavedEvidenceSection");
assert.match(savedEvidenceHeadingSource, /saved-evidence-section-toggle section-label[\s\S]*?project-section-toggle-chevron saved-evidence-collapse-toggle/);
assert.match(savedEvidenceSectionSource, /aria-controls[\s\S]*?collapsedEvidenceFolderIDs[\s\S]*?wireProjectSectionMotion[\s\S]*?onChange: recordExpandedState/);
assert.match(savedEvidenceSectionSource, /\[search, select\][\s\S]*?setExpanded\(true\)[\s\S]*?recordExpandedState\(true\)/);
assert.match(appSource, /instance\.collapsedEvidenceFolderIDs = Array\.from\(new Set/);
[
  "openProjectNotebook",
  "closeProjectNotebook",
  "openProjectReportDraft",
  "closeProjectReportDraft",
  "openProjectCoordination",
  "closeProjectCoordination"
].forEach((name) => {
  const source = functionSource(appSource, name);
  assert.doesNotMatch(
    source,
    /projectOverviewRefreshPaneIDs/,
    `${name} must keep Projects, Research, and Settings mounted.`
  );
  assert.match(source, /syncProjectToolButtonStates/);
  assert.match(source, /transitionWorkspace\("utility"/);
});
const deactivateProjectStudioSource = functionSource(appSource, "deactivateProjectStudio");
assert.ok(
  deactivateProjectStudioSource.indexOf("confirmNotebookDiscard") <
    deactivateProjectStudioSource.indexOf("closeProjectDetailForProject"),
  "Project deactivation must confirm Notebook edits before changing workspace state."
);
const activateProjectStudioSource = functionSource(appSource, "activateProjectStudio");
assert.doesNotMatch(activateProjectStudioSource, /confirmNotebookDiscard|confirmReportDraftDiscard/);
assert.match(activateProjectStudioSource, /\.\.\.openDetails\.filter\(\(detail\) => !projectDetailMatches\(identity, detail\)\)/);
assert.match(activateProjectStudioSource, /openNotebookRecords[\s\S]*?openReportRecords/);
assert.match(functionSource(appSource, "openProjectNotebook"), /openNotebooks\(\)\.filter/);
assert.match(functionSource(appSource, "openProjectReportDraft"), /openReportDrafts\(\)\.filter/);
assert.ok(
  deactivateProjectStudioSource.indexOf("confirmReportDraftDiscard") <
    deactivateProjectStudioSource.indexOf("closeProjectDetailForProject"),
  "Project deactivation must confirm Report edits before changing workspace state."
);
assert.match(functionSource(appSource, "transitionProjectSelection"), /refreshSavedPanelInPlace/);
assert.match(functionSource(appSource, "refreshSavedPanelInPlace"), /scrollTop[\s\S]*?hydrateSavedPanel[\s\S]*?scrollTop/);
const syncedRefreshSource = functionSource(appSource, "refreshSyncedWorkspaceInPlace");
assert.doesNotMatch(
  syncedRefreshSource,
  /transitionWorkspace|closeDeletedProjectDetails/,
  "Background sync must not run the Project-deletion cleanup that can unmount active editors."
);
assert.match(
  syncedRefreshSource,
  /renderUtilityWorkspace\(\{[\s\S]*?skipDeletedProjectCleanup: true[\s\S]*?deferStateSave: true/,
  "Background sync must selectively reconcile pane eligibility while preserving open Project editors."
);
assert.match(
  functionSource(appSource, "renderUtilityWorkspace"),
  /if \(!options\.skipDeletedProjectCleanup\) closeDeletedProjectDetails\(\)/,
  "Only the background-sync path may bypass deleted-Project cleanup."
);
assert.match(
  syncedRefreshSource,
  /refreshSavedPanelInPlace\(paneID, \{ reconcileProjectStudio: false \}\)/,
  "Background sync must hydrate Saved in place without steering or closing the active Project."
);
assert.match(
  functionSource(appSource, "refreshVisibleSyncedDerivedState"),
  /syncReaderNoteControls[\s\S]*?syncReaderNoteBookmarkButtons[\s\S]*?refreshOpenAnnotationProjectEditors/,
  "Background sync must update visible notes and bookmarks without rebuilding readers or editors."
);
assert.match(syncedRefreshSource, /refreshBlankSearchHistoryPanes\(\)/);
assert.match(syncedRefreshSource, /updateOpenProjectSyncWarning\(projectReconciliation\)/);
assert.match(functionSource(appSource, "updateOpenProjectSyncWarning"), /Project archived on another device/);
assert.match(functionSource(appSource, "handleForegroundSyncSignal"), /refreshSyncedWorkspaceInPlace/);
assert.match(functionSource(appSource, "flushPendingSyncAndRender"), /refreshSyncedWorkspaceInPlace/);
const foregroundSyncSource = functionSource(appSource, "performForegroundSync");
assert.match(foregroundSyncSource, /refreshSyncedWorkspaceInPlace\(\{ accountUserID \}\)/);
assert.equal(
  (foregroundSyncSource.match(/renderWorkspace\(\)/g) || []).length,
  2,
  "Foreground sync may fully render only in its two account-identity change guards."
);
assert.match(functionSource(appSource, "closeAllColumns"), /state\.coordinations = \[\][\s\S]*?state\.coordinationThreads = \[\][\s\S]*?state\.projectHostPaneID = ""/);
assert.doesNotMatch(functionSource(appSource, "closeAllColumns"), /state\.coordinationFilters = \{\}/);
assert.match(functionSource(appSource, "primarySavedPaneID"), /state\.projectHostPaneID/);
const pinnedWorkflowSource = functionSource(appSource, "pinCriticalWorkflowPanesToLeft");
assert.match(pinnedWorkflowSource, /new Set\(savedPaneIDs\(\)\)/);
assert.match(pinnedWorkflowSource, /openProjectDetails\(\)\.flatMap\(projectWorkspacePaneIDs\)/);
assert.match(pinnedWorkflowSource, /settingsPaneID = state\.utilities\.settings \? "utility:settings" : ""/);
assert.match(pinnedWorkflowSource, /return \[[\s\S]*?paneID === settingsPaneID[\s\S]*?projectsPaneIDs\.has\(paneID\)[\s\S]*?projectOwnedPaneIDs\.has\(paneID\)/, "Settings must be the only pane pinned to the left of Projects, followed by Project-owned work.");
assert.match(pinnedWorkflowSource, /paneID !== settingsPaneID[\s\S]*?!projectsPaneIDs\.has\(paneID\)[\s\S]*?!projectOwnedPaneIDs\.has\(paneID\)/, "Pinned panes must not be duplicated in the ordinary pane sequence.");
const pinCriticalWorkflowPanesToLeft = new Function(
  "state",
  "savedPaneIDs",
  "openProjectDetails",
  "projectWorkspacePaneIDs",
  `${pinnedWorkflowSource}; return pinCriticalWorkflowPanesToLeft;`
)(
  { utilities: { settings: true, analysis: true } },
  () => ["utility:saved:projects"],
  () => [{ id: "project-1" }],
  () => ["project:notebook:project-1"]
);
assert.deepEqual(
  pinCriticalWorkflowPanesToLeft([
    "reader:one",
    "utility:analysis",
    "project:notebook:project-1",
    "utility:saved:projects",
    "utility:settings",
    "utility:search:one"
  ]),
  [
    "utility:settings",
    "utility:saved:projects",
    "project:notebook:project-1",
    "reader:one",
    "utility:analysis",
    "utility:search:one"
  ],
  "Settings must remain left of Projects while every ordinary pane remains to the right."
);
const toggleUtilityPaneSource = functionSource(appSource, "toggleUtilityPane");
assert.match(
  toggleUtilityPaneSource,
  /repeatableUtilityKeys\.has\(key\)[\s\S]*?appendPaneIfMissing\(paneID\)[\s\S]*?scrollPaneIntoView\(paneID\)[\s\S]*?return;/
);
assert.match(toggleUtilityPaneSource, /key === "settings"[\s\S]*?movePaneToFront\(paneID\)/);
assert.match(toggleUtilityPaneSource, /key === "archive"[\s\S]*?placeArchiveAfterProjectsStack\(\)/);
assert.match(toggleUtilityPaneSource, /else \{[\s\S]*?appendPaneIfMissing\(paneID\)/);
assert.match(toggleUtilityPaneSource, /if \(willOpen\) \{[\s\S]*?scrollPaneIntoView\(paneID\)/);
const openResearchConversationSource = functionSource(appSource, "openResearchConversation");
assert.match(openResearchConversationSource, /researchSurfaceWasOpen/);
assert.match(openResearchConversationSource, /options\.anchorPaneID && !researchSurfaceWasOpen/);
assert.match(openResearchConversationSource, /placePaneAfter\(options\.anchorPaneID, "utility:analysis"\)/);
assert.match(functionSource(appSource, "researchSelectionFromWindow"), /originPaneID: panel\.dataset\.paneId/);
[
  "closeUtilityInstance",
  "closeResearchWorkspace",
  "closeResearchConversation",
  "closeProjectNotebook",
  "closeProjectReportDraft",
  "closeAllColumns"
].forEach((functionName) => {
  const closeSource = functionSource(appSource, functionName);
  assert.doesNotMatch(
    closeSource,
    /deleteResearchConversationFromList|deleteNotebookCard|removeSectionFromProject|removeSectionFromAllProjects|deleteArchivedProjectData/,
    `${functionName} must close presentation state without deleting user records.`
  );
});
assert.match(functionSource(appSource, "activePaneIDs"), /pinCriticalWorkflowPanesToLeft\(paired\)/);
assert.match(functionSource(appSource, "orderWithPaneMoved"), /pinCriticalWorkflowPanesToLeft\(order\)/);
assert.match(functionSource(appSource, "reconcileProjectStudioWithSavedFolders"), /projectHostSavedInstance/);
assert.match(savedFolderContextSource, /if \(!folder\)[\s\S]*?inlineFilters\.hidden = !savedInstance\.organizeUnassigned;[\s\S]*?savedContent\.hidden = !savedInstance\.organizeUnassigned;/);
assert.match(savedFolderContextSource, /inlineFilters\.hidden = false;[\s\S]*?savedContent\.hidden = false;/);
assert.match(functionSource(appSource, "performSavedPanelHydration"), /renderSavedProjects[\s\S]*?const showingUnassigned = !selectedFolder && savedInstance\.organizeUnassigned;[\s\S]*?if \(!selectedFolder && !showingUnassigned\) return;/);
assert.match(functionSource(appSource, "reconcileProjectStudioWithSavedFolders"), /outcome\.value === "cancelled"[\s\S]*?expectedHostPaneID[\s\S]*?expectedSelectedFolderID/);
assert.doesNotMatch(savedFolderContextSource, /loadProjectCoordinationFoundation/);
assert.match(savedFolderContextSource, /previousContext\.replaceWith\(context\)/);
assert.doesNotMatch(savedFolderContextSource, /previousContext\?\.remove\(\)[\s\S]*?const folder/);
assert.match(functionSource(appSource, "renderSavedProjects"), /addButton\.onclick[\s\S]*?projectsMenuToggle\.onclick[\s\S]*?archiveButton\.onclick/);
assert.match(indexSource, /saved-projects-add-button[\s\S]*?saved-projects-archive-button[\s\S]*?saved-projects-select-button/);
assert.match(functionSource(appSource, "renderSavedProjects"), /selectButton\.onclick = \(\) => setSelecting\(!selecting\)/);
const savedProjectsSource = functionSource(appSource, "renderSavedProjects");
assert.match(savedProjectsSource, /archiveSelectedButton\.onclick[\s\S]*?archiveProjects\(selectedProjects, \{ preserveSavedPanes: true \}\)/);
assert.match(savedProjectsSource, /selectionActions\.append\(cancelSelectionButton, archiveSelectedButton, deleteSelectedButton\)[\s\S]*?headingActions\.append\(selectionActions\)/);
assert.doesNotMatch(savedProjectsSource, /saved-projects-bulk-bar|section\.insertBefore\(bulkBar, list\)/);
assert.doesNotMatch(savedProjectsSource, /saved-projects-bulk-count|selectionCount/);
assert.doesNotMatch(savedProjectsSource, /selectAllButton|"Select all"|"Clear all"/);
assert.match(savedProjectsSource, /if \(showingArchived\) \{[\s\S]*?restoreArchivedProject\(project\)/);
assert.match(savedProjectsSource, /saved-project-tile-edit[\s\S]*?event\.stopPropagation\(\)[\s\S]*?showProjectCreateSheet\(panel, project\)/);
assert.doesNotMatch(savedProjectsSource, /editSelectedButton/);
assert.match(savedProjectsSource, /deleteSelectedButton\.onclick[\s\S]*?deleteArchivedProjects\(selectedProjects, \{ preserveSavedPanes: true \}\)/);
assert.match(savedProjectsSource, /const setSelecting = \(nextSelecting\) => \{[\s\S]*?selectedProjectIDs\.clear\(\);\n    updateSelectionControls\(\);\n  \};/);
assert.match(savedProjectsSource, /addButton\.hidden = showingArchived \|\| selecting;[\s\S]*?archiveButton\.hidden = selecting;/);
assert.match(stylesSource, /\.saved-projects-add-button\[hidden\],[\s\S]*?\.saved-projects-archive-button\[hidden\] \{[\s\S]*?visibility: hidden;[\s\S]*?pointer-events: none;/);
assert.match(functionSource(appSource, "refreshProjectOverviewPreservingSavedPanes"), /savedPaneIDs\(\)[\s\S]*?refreshSavedPanelInPlace[\s\S]*?failedSavedIDs[\s\S]*?transitionWorkspace/);
assert.match(functionSource(appSource, "renderSavedProjects"), /archiveSelectedButton\.innerHTML = showingArchived \? archiveRestoreIconSVG\(\) : archiveIconSVG\(\)/);
assert.match(stylesSource, /\.saved-project-tile-edit \{[\s\S]*?width: 22px;[\s\S]*?background: transparent;/);
assert.match(stylesSource, /\.saved-projects-selection-actions \{[\s\S]*?display: flex;[\s\S]*?gap: var\(--space-1\);/);
assert.match(stylesSource, /\.saved-projects-selection-cancel \{[\s\S]*?width: auto;[\s\S]*?font-size:/);
assert.match(stylesSource, /\.saved-projects-selection-action \{[\s\S]*?width: 24px;[\s\S]*?background: transparent;/);
assert.match(functionSource(appSource, "renderSavedProjects"), /project\.sharedOnly[\s\S]*?return/);
assert.match(savedFolderContextSource, /state\.projectHostPaneID = paneID[\s\S]*?await (?:closeTool|openTool)/);
assert.match(functionSource(appSource, "closeUtilityInstance"), /successorFolder[\s\S]*?activateProjectStudio\(successorFolder/);
assert.match(functionSource(appSource, "renderWorkspace"), /renderGeneration = \+\+workspaceRenderGeneration[\s\S]*?renderGeneration !== workspaceRenderGeneration[\s\S]*?appendPaneSequence/);
assert.match(functionSource(appSource, "renderUtilityWorkspace"), /renderGeneration = \+\+workspaceRenderGeneration[\s\S]*?renderGeneration !== workspaceRenderGeneration[\s\S]*?appendPaneSequence/);
assert.doesNotMatch(functionSource(appSource, "projectCollaborationRefresh"), /projectOverviewRefreshPaneIDs/);
assert.doesNotMatch(functionSource(appSource, "focusLinkedProjectRecord"), /projectOverviewRefreshPaneIDs/);
assert.doesNotMatch(functionSource(appSource, "refreshProjectMembershipPanes"), /transitionWorkspace/);
assert.match(
  functionSource(appSource, "refreshProjectMembershipPanes"),
  /await Promise\.all[\s\S]*?panel\.__refreshProjectMembership\(project\)/,
  "Project membership refreshes should await each narrow Saved-pane hydration."
);
assert.ok(
  functionSource(appSource, "performSavedPanelHydration").indexOf("renderSavedFolderContext") <
    functionSource(appSource, "performSavedPanelHydration").indexOf("renderSavedProjects"),
  "Saved tiles and context must swap in the same render turn after the Project foundation is ready."
);
const renderSavedSource = functionSource(appSource, "renderSaved");
assert.ok(
  renderSavedSource.indexOf("renderSavedProjects(") >= 0 &&
    renderSavedSource.indexOf("renderSavedProjects(") < renderSavedSource.indexOf("requestAnimationFrame("),
  "Projects should render from the cached content summary before deferred Saved hydration."
);
assert.match(
  functionSource(appSource, "renderSavedProjects"),
  /headingActions\.querySelector\("\.saved-projects-selection-actions"\)\?\.remove\(\)/,
  "Refreshing cached Projects should replace the existing bulk-selection controls instead of duplicating them."
);
[
  "detachProjectWorkboard",
  "reattachProjectWorkboard"
].forEach((name) => {
  const source = functionSource(appSource, name);
  assert.doesNotMatch(source, /projectOverviewRefreshPaneIDs/);
  assert.match(source, /syncProjectToolButtonStates/);
});
const savedHydrationSource = functionSource(appSource, "performSavedPanelHydration");
const savedEvidenceMatchesQuery = new Function(
  "codeDisplayLabel",
  "savedItemTags",
  `${functionSource(appSource, "savedEvidenceMatchesQuery")}; return savedEvidenceMatchesQuery;`
)((prefix) => prefix, (item) => item.tags || []);
const resolveSavedSearchPage = new Function(
  `${functionSource(appSource, "resolveSavedSearchPage")}; return resolveSavedSearchPage;`
)();
assert.match(
  savedHydrationSource,
  /if \(options\.reconcileProjectStudio !== false\) \{[\s\S]*?reconcileProjectStudioWithSavedFolders/,
  "Ordinary Saved hydration must keep Project reconciliation while background sync can explicitly bypass it."
);
assert.doesNotMatch(
  savedHydrationSource,
  /if \(!selectedFolder\) \{[\s\S]*?panel\.__applySavedView = null;[\s\S]*?return;/,
  "All Saved must not become an empty column merely because no Project or Reference is selected."
);
assert.match(
  savedHydrationSource,
  /const selectedFolderEvidenceKeys = selectedFolder[\s\S]*?projectSectionBelongsToProject\(link, selectedFolder\)[\s\S]*?const folderHydrationItems = selectedFolder && !savedInstance\.showAllSaved[\s\S]*?hydrateItems\(folderHydrationItems\)/,
  "Selected Projects should hydrate only their linked evidence instead of the full Saved corpus."
);
assert.match(
  savedHydrationSource,
  /panel\.__refreshProjectMembership = \(\) => refreshSavedPanelInPlace\(paneID, \{[\s\S]*?reconcileProjectStudio: false/,
  "Membership changes should rebuild the affected Saved pane so newly linked evidence is included."
);
assert.match(
  savedHydrationSource,
  /if \(!selectedFolder && searchActive\) \{[\s\S]*?resolveSavedSearchPage\(\{[\s\S]*?batchSize: savedItemsPageSize[\s\S]*?\} else \{[\s\S]*?rawCandidates\.slice\(0, allSavedLimit\)/,
  "Search must scan bounded hydrated batches while the non-search view remains lazily paginated."
);
assert.doesNotMatch(savedHydrationSource, /savedItems\.slice\(0, 48\)|annotatedItems\.slice\(0, 48\)/);
assert.doesNotMatch(savedHydrationSource, /allowUnhydrated|savedEvidenceNeedsHydrationForSearch/);
assert.match(savedHydrationSource, /button\.textContent = "Show more"[\s\S]*?allSavedLimit \+= savedItemsPageSize/);
assert.match(appSource, /collapsedCodePrefixes: searchActive \? \[\] : savedInstance\.collapsedCodePrefixes/);
assert.match(appSource, /collapsedCodePrefixes: pane\?\.collapsedCodePrefixes/);
assert.equal(
  savedEvidenceMatchesQuery({ savedContentComparisonText: "A remote cross-device clause" }, "cross-device"),
  true,
  "Saved search must match the full hydrated section comparison text."
);
assert.equal(
  savedEvidenceMatchesQuery({ previewText: "Hydrated smoke-control language" }, "smoke-control"),
  true,
  "Saved search must match hydrated preview text."
);
const crossDeviceCandidates = Array.from({ length: 60 }, (_, index) => ({
  id: `ios-bookmark-${index + 1}`,
  sectionID: index + 1
}));
const hydratedBatchSizes = [];
const crossDeviceSearchPage = await resolveSavedSearchPage({
  candidates: crossDeviceCandidates,
  limit: 48,
  batchSize: 48,
  hydrateItems: async (items) => {
    hydratedBatchSizes.push(items.length);
    return items.map((item) => item.sectionID === 60
      ? { ...item, savedContentComparisonText: "The obscure remote-only requirement applies." }
      : item);
  },
  matchesItem: (item) => savedEvidenceMatchesQuery(item, "remote-only"),
  normalizeMatches: (items) => items
});
assert.deepEqual(
  crossDeviceSearchPage.items.map((item) => item.sectionID),
  [60],
  "All Saved search stopped at the first 48 ID-only iOS bookmarks and missed a later match."
);
assert.deepEqual(hydratedBatchSizes, [48, 12], "Saved search hydration did not stay within bounded batches.");
assert.equal(crossDeviceSearchPage.exhausted, true);
assert.equal(crossDeviceSearchPage.hasMore, false);
const commonMatchBatchSizes = [];
const commonMatchSearchPage = await resolveSavedSearchPage({
  candidates: Array.from({ length: 120 }, (_, index) => ({ sectionID: index + 1 })),
  limit: 48,
  batchSize: 48,
  hydrateItems: async (items) => {
    commonMatchBatchSizes.push(items.length);
    return items.map((item) => ({ ...item, previewText: "common hydrated phrase" }));
  },
  matchesItem: (item) => savedEvidenceMatchesQuery(item, "common hydrated"),
  normalizeMatches: (items) => items
});
assert.equal(commonMatchSearchPage.items.length, 48);
assert.equal(commonMatchSearchPage.hasMore, true);
assert.equal(commonMatchSearchPage.exhausted, false);
assert.deepEqual(
  commonMatchBatchSizes,
  [48, 48],
  "Saved search should stop scanning once it has a visible page plus a has-more sentinel."
);
assert.doesNotMatch(appSource, /bookmarkIcon\.setAttribute\("aria-label", "Bookmarked"\)/);
assert.doesNotMatch(appSource, /className = "saved-section-status"/);
assert.match(appSource, /function projectLinkForAnnotationTarget[\s\S]*?normalizeAnnotationBlockID\(item\.blockID \|\| item\.anchorID \|\| item\.contentBlockID\) === targetBlockID/);
assert.match(appSource, /function projectSectionRecordForSection[\s\S]*?const blockID = normalizeAnnotationBlockID\(sectionPayload\.blockID\)/);
assert.match(appSource, /function savedEvidenceKey[\s\S]*?return `\$\{version\}:\$\{sectionID\}:\$\{blockID\}`/);
assert.doesNotMatch(appSource, /if \(saved && blockID && normalizeAnnotationBlockID\(savedRecord\?\.blockID\) !== blockID\)/);
assert.match(appSource, /item\.savedColumnKind === "bookmark" &&[\s\S]*?!normalizeAnnotationBlockID\(item\.blockID\)[\s\S]*?projectSavedScope: "section"/);
assert.match(appSource, /if \(searchActive\) return;[\s\S]*?savedInstance\.collapsedCodePrefixes/);
assert.match(appSource, /function createSavedEvidenceHeading\([\s\S]*?saved-evidence-search-toggle[\s\S]*?Search saved evidence/);
assert.match(indexSource, /class="saved-evidence-search"[\s\S]*?class="saved-evidence-search-input"[\s\S]*?class="saved-evidence-search-close"/);
assert.match(indexSource, /class="saved-projects-section[^>]*aria-label="Projects"/);
assert.match(indexSource, /class="code-filter-menu-toggle saved-projects-menu-toggle"[^>]*aria-label="Expand Projects"/);
assert.match(appSource, /heading\.textContent = showingArchived \? "Archived saved collections" : "Saved collections"/);
assert.match(appSource, /visibleRecords\.filter\(folderIsProject\)[\s\S]*?visibleRecords\.filter\(\(record\) => !folderIsProject\(record\)\)/);
assert.match(appSource, /folderType\(visibleProjects\[sourceIndex\]\) !== folderType\(visibleProjects\[targetIndex\]\)/);
assert.match(stylesSource, /\.saved-collections-section \{[\s\S]*?border-top: 1px solid var\(--border\);/);
assert.doesNotMatch(indexSource, /class="code-filter-menu saved-code-filter-menu"/);
assert.match(appSource, /control\.setAttribute\("aria-expanded", String\(nextExpanded\)\)/);
assert.match(appSource, /if \(!expanded\) body\.hidden = true/);
assert.match(appSource, /options\.onCodeGroupToggle\(normalizedPrefix, collapsed\)/);
assert.match(appSource, /wireProjectSectionMotion\([\s\S]*?codeGroup,[\s\S]*?codeBody,[\s\S]*?onChange: \(expanded\)/);
assert.match(stylesSource, /\.saved-code-group\.is-collapsed \.saved-code-toggle-chevron/);
assert.match(stylesSource, /\.project-section-motion > \.project-section-motion-body[\s\S]*?max-height 420ms cubic-bezier/);
const projectFactEditorSource = functionSource(appSource, "appendSavedProjectFactEditor");
const structuredFactGroupsSource = appSource.match(/const projectStructuredFactGroups = \[[\s\S]*?\n\];/)?.[0] || "";
assert.match(projectFactEditorSource, /toggle\.textContent = "Project context"/);
assert.match(projectFactEditorSource, /address\.setAttribute\("aria-label", "Project address"\)/);
assert.match(projectFactEditorSource, /description\.setAttribute\("aria-label", "Project context"\)/);
assert.match(projectFactEditorSource, /projectSectionExpanded\(identity, "projectFacts", false\)/);
assert.match(projectFactEditorSource, /structuredToggle\.textContent = "Structured facts"/);
assert.match(projectFactEditorSource, /projectSectionExpanded\(identity, "structuredFacts", false\)/);
assert.match(projectFactEditorSource, /projectStructuredFactGroups\.forEach/);
assert.doesNotMatch(projectFactEditorSource, /saved-project-structured-suggestion-menu|structuredSuggestionMenus/);
assert.doesNotMatch(projectFactEditorSource, /setAttribute\("role", "combobox"\)|aria-autocomplete|aria-haspopup/);
assert.doesNotMatch(projectFactEditorSource, /suggestions/);
assert.doesNotMatch(projectFactEditorSource, /createElement\("datalist"\)/);
assert.match(structuredFactGroupsSource, /label: "Building & code"[\s\S]*?Stories Above Grade[\s\S]*?Levels Below Grade[\s\S]*?Building Area/);
assert.match(structuredFactGroupsSource, /label: "Zoning"[\s\S]*?Tax Lot\(s\)[\s\S]*?Zoning Lot Composition[\s\S]*?Zoning District\(s\)[\s\S]*?Street Frontage\(s\)/);
assert.doesNotMatch(structuredFactGroupsSource, /Travel Distance|Exit Separation|Dead-End Length|Floor affected/);
assert.match(appSource, /\["stories", \["stories-above-grade", "Stories Above Grade"\]\]/);
assert.match(appSource, /\["sprinkler-status", \["sprinkler-protection", "Sprinkler Protection"\]\]/);
assert.match(appSource, /\["work-type", \["work-filing-type", "Work \/ Filing Type"\]\]/);
assert.match(projectFactEditorSource, /structuredFacts\.filter\(\(fact\) => fact\.key !== "floor-affected" && !fixedFactKeys\.has\(fact\.key\)\)/);
assert.match(projectFactEditorSource, /projectSectionExpanded\(identity, `structuredFacts:\$\{group\.key\}`, groupIndex === 0\)/);
assert.match(projectFactEditorSource, /addFact\.textContent = "Add another fact"/);
assert.doesNotMatch(appSource, /function extractedProjectStructuredFacts/);
assert.doesNotMatch(projectFactEditorSource, /Proposed from the narrative|saved-project-structured-fact-status/);
assert.doesNotMatch(projectFactEditorSource, /Research may use as user-provided context/);
assert.doesNotMatch(projectFactEditorSource, /value\.placeholder = "Add value"/);
assert.match(projectFactEditorSource, /address\.addEventListener\("blur", save\)/);
assert.match(projectFactEditorSource, /description\.addEventListener\("blur", save\)/);
assert.match(projectFactEditorSource, /updateProjectFolder\(folder,/);
assert.match(stylesSource, /\.saved-project-fact-input \{[^}]*background: transparent;[^}]*font: inherit;/);
assert.match(stylesSource, /\.saved-project-fact-input:focus-visible \{[\s\S]*?box-shadow: none;/);
assert.match(stylesSource, /\.saved-project-structured-fact-value,[\s\S]*?\.saved-project-structured-fact-label-input \{[^}]*background: transparent;/);
assert.match(stylesSource, /\.saved-project-structured-fact-value \{[^}]*text-align: right;/);
assert.match(stylesSource, /\.saved-project-structured-fact-value \{[^}]*min-width: 144px;[^}]*max-width: 100%;[^}]*justify-self: end;[^}]*field-sizing: content;/);
assert.match(stylesSource, /\.saved-project-structured-fact \+ \.saved-project-structured-fact \{[^}]*border-top: 1px solid var\(--border\);/);
assert.match(stylesSource, /\.saved-project-structured-fact\.is-custom \+ \.saved-project-structured-fact\.is-custom \{[^}]*border-top: 1px solid var\(--border\);/);
assert.match(stylesSource, /\.saved-project-structured-fact-value:focus-visible,[^}]*box-shadow: none;/);
assert.match(stylesSource, /\.saved-evidence-heading-actions button,[\s\S]*?button\[aria-pressed="true"\] \{[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/);
assert.match(stylesSource, /\.saved-project-list:has\(\.saved-project-tile\.is-selected\) \.saved-project-tile:not\(\.is-selected\) \{[\s\S]*?opacity: 0\.58;/);
assert.match(stylesSource, /\.saved-project-tile\.is-selected \{[\s\S]*?box-shadow: none;/);
assert.match(stylesSource, /\.saved-project-tile\.is-selected \.saved-project-count \{[\s\S]*?color: #ffffff;/);
assert.match(stylesSource, /\.saved-projects-section\.is-selecting \.saved-project-tile\[data-bulk-selectable="true"\] \{[\s\S]*?opacity: 0\.58;/);
assert.match(stylesSource, /\.saved-project-tile\.is-bulk-selected \{[\s\S]*?opacity: 1 !important;[\s\S]*?box-shadow: none;/);
assert.match(indexSource, /id="workspace-actions"[^>]*aria-label="Open workspace menu"/);
assert.doesNotMatch(indexSource, /id="add-workspace"/);
assert.match(stylesSource, /\.workspace-add-button,[\s\S]*?\.workspace-actions-button \{[\s\S]*?display: inline-flex;[\s\S]*?padding: 0 11px;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.project-notebook-button,[\s\S]*?\.project-report-draft-button \{[^}]*height: 40px;[^}]*min-height: 40px;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-facts-section > \.saved-project-facts-heading,[\s\S]*?\.saved-project-research-answers > \.project-studio-section-heading \{[^}]*height: 40px;[^}]*min-height: 40px;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-facts-section > \.saved-project-facts-heading[\s\S]*?\.saved-project-research-toggle \{[^}]*height: 40px;[^}]*min-height: 40px;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.project-section-motion >[^}]*\.project-section-toggle-chevron \{[^}]*width: 40px;[^}]*height: 40px;[^}]*flex-basis: 40px;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project > \.project-studio-section > \.project-studio-section-heading \{[^}]*min-height: 30px;/);
assert.doesNotMatch(stylesSource, /\.reader-chapter-select-menu \[role="treeitem"\]\[aria-selected="true"\]/);
assert.match(stylesSource, /\.reader-nav-chapter-row \{[^}]*background: transparent;[^}]*color: var\(--text-secondary\);/);
assert.match(stylesSource, /\.reader-nav-chapter-row:hover,[\s\S]*?\.reader-nav-section:hover \{[^}]*background: color-mix\(in srgb, var\(--code-accent\) 8%, transparent\);/);
assert.match(stylesSource, /\.reader-nav-section\[aria-selected="true"\] \{[^}]*background: transparent;/);
assert.match(stylesSource, /\.saved-panel \.saved-content\[hidden\] \{[\s\S]*?display: none;/, "Deactivating a Project must hide its Saved Evidence list.");
assert.match(stylesSource, /\.saved-project-fact-description \{[\s\S]*?height: 112px;[\s\S]*?max-height: min\(70vh, 760px\);[\s\S]*?overflow-y: auto;[\s\S]*?resize: none;/);
assert.match(appSource, /descriptionResizeHandle\.className = "saved-project-fact-resize-handle"[\s\S]*?descriptionResizeHandle\.setPointerCapture\(event\.pointerId\)[\s\S]*?event\.key !== "ArrowUp" && event\.key !== "ArrowDown"/);
assert.match(stylesSource, /\.saved-project-fact-resize-handle::after \{[\s\S]*?left: 50%;[\s\S]*?width: 36px;[\s\S]*?height: 2px;[\s\S]*?transform: translateX\(-50%\);/);
assert.match(appSource, /noteResizeHandle\.className = "section-detail-note-resize-handle"[\s\S]*?noteResizeHandle\.setPointerCapture\(event\.pointerId\)[\s\S]*?event\.key !== "ArrowUp" && event\.key !== "ArrowDown"/);
assert.match(stylesSource, /\.section-detail-note-box textarea \{[\s\S]*?max-height: min\(70vh, 760px\);[\s\S]*?resize: none;/);
assert.match(stylesSource, /\.section-detail-note-resize-handle::after \{[\s\S]*?left: 50%;[\s\S]*?width: 36px;[\s\S]*?height: 2px;[\s\S]*?transform: translateX\(-50%\);/);
assert.doesNotMatch(functionSource(appSource, "renderReaderChapterSection"), /reader-section-project-context|renderReaderSectionProjectContext/);
assert.doesNotMatch(appSource, /description\.addEventListener\("input", resizeDescription\)/);
assert.doesNotMatch(appSource, /saved-project-facts-status/);
assert.doesNotMatch(appSource.match(/function appendSavedProjectFactEditor[\s\S]*?async function appendSavedProjectResearchConversations/)?.[0] || "", /status\.textContent = "Saving…"|status\.textContent = "Saved"/);
assert.match(appSource, /showWebNotice\("Project context not saved", error\.message \|\| "Could not save Project context"\)/);
assert.match(stylesSource, /\.project-research-history-card strong \{[\s\S]*?font-weight: 400;/);
assert.match(stylesSource, /\.project-research-history-card:hover,[\s\S]*?\.project-research-history-card:focus-visible \{[\s\S]*?background: transparent;[\s\S]*?color: var\(--project-color\);/, "Project Research history hover should color the text without filling the row.");
assert.match(stylesSource, /\.project-research-history-card:hover :is\(strong, p, span\),[\s\S]*?color: inherit;/, "Project Research history child text does not follow the row hover color.");
assert.match(appSource, /function animateSavedMembershipUpdate\(content, previousHeight\)[\s\S]*?duration: 420,[\s\S]*?cubic-bezier\(0\.22, 1, 0\.36, 1\)/, "Saved Evidence membership updates do not animate their height with the standard disclosure motion.");
assert.match(appSource, /const preserveProjectChrome = options\.preserveProjectChrome === true;[\s\S]*?if \(preserveProjectChrome\) \{[\s\S]*?\.saved-project-count[\s\S]*?renderSavedProjects/, "Saved Evidence membership updates still rebuild the Project card instead of updating its count in place.");
assert.match(appSource, /panel\.__refreshProjectMembership = \(\) => refreshSavedPanelInPlace\(paneID, \{[\s\S]*?preserveProjectChrome: true,[\s\S]*?animateContentUpdate: true/, "Project-chip changes do not use the non-blinking Saved Evidence refresh path.");
const projectResearchSource = functionSource(appSource, "appendSavedProjectResearchConversations");
assert.match(projectResearchSource, /title\.className = "section-label saved-project-research-toggle"/);
assert.match(projectResearchSource, /body\.className = "project-studio-collapsible-body saved-project-research-body"/);
assert.doesNotMatch(projectResearchSource, /projectSectionCount\(conversations\.length/);
assert.match(projectResearchSource, /itemNumber\.className = "project-research-history-index"[\s\S]*?itemNumber\.textContent = String\(index \+ 1\)[\s\S]*?card\.append\(itemNumber, question\)/);
assert.match(appSource, /let savedSearchContentMinHeight = 0;[\s\S]*?const preservedScrollTop = scrollContainer\?\.scrollTop \|\| 0;[\s\S]*?content\.style\.minHeight = `\$\{savedSearchContentMinHeight\}px`;[\s\S]*?scrollContainer\.scrollTop = preservedScrollTop;/);
assert.match(projectResearchSource, /projectSectionExpanded\(identity, "research", false\)/);
assert.match(stylesSource, /\.project-studio-section-heading > \.saved-project-research-toggle \{[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;[\s\S]*?color: var\(--text-secondary\);/);
assert.match(stylesSource, /\.saved-project-structured-group \{[\s\S]*?gap: 0;[\s\S]*?\.saved-project-structured-group\.project-section-motion\.is-open > \.saved-project-structured-group-body \{[\s\S]*?padding-top: 2px;/);
assert.doesNotMatch(stylesSource, /\.saved-folder-context\.is-project \.saved-project-blocknote/);
assert.doesNotMatch(stylesSource, /\.saved-folder-context\.is-project \.project-studio-research/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-tool-controls \{[\s\S]*?display: grid;[\s\S]*?grid-auto-flow: column;[\s\S]*?grid-auto-columns: minmax\(0, 1fr\);[\s\S]*?width: 100%;/);
assert.doesNotMatch(appSource, /\["Research", "project-code-decisions-button", projectHasOpenCodeDecisions, openProjectCodeDecisions, closeProjectCodeDecisions\]/);
assert.match(appSource, /"toggle-analysis"/);
assert.match(appSource, /async function openProjectCodeDecisions[\s\S]*?await focusUtility\("analysis", "\.evidence-discovery textarea"\);/);
assert.match(appSource, /function projectHasOpenCodeDecisions[\s\S]*?return indexIsOpen && scopedResearchIsOpen;/);
assert.match(appSource, /function clearProjectSpecificResearch[\s\S]*?state\.researchConversationID = ""[\s\S]*?id\.startsWith\("research:conversation:"\)/);
assert.doesNotMatch(functionSource(appSource, "clearProjectSpecificResearch"), /state\.utilities\.analysis = false|id !== "utility:analysis"/, "Selecting a different Project folder still closes Research.");
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-tool-controls button \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?font-weight: 400;/);
assert.match(stylesSource, /\.saved-evidence-collapse-toggle\[aria-expanded="true"\] \.research-chevron-up,[\s\S]*?\.saved-evidence-collapse-toggle\[aria-expanded="false"\] \.research-chevron-down \{[\s\S]*?display: block;/);
const projectToolControlsRule = stylesSource.match(/\.saved-folder-context\.is-project \.saved-project-tool-controls \{([\s\S]*?)\n\}/)?.[1] || "";
const projectSectionRule = stylesSource.match(/\.saved-folder-context\.is-project > \.project-studio-section,\n\.saved-folder-context\.is-project > \.saved-project-overview-warning \{([\s\S]*?)\n\}/)?.[1] || "";
assert.doesNotMatch(projectToolControlsRule, /border-top/);
assert.doesNotMatch(projectSectionRule, /border-top/);
assert.match(stylesSource, /\.project-folder-type button \{[\s\S]*?background: var\(--menu-subtle-surface\);[\s\S]*?color: var\(--text-primary\);[\s\S]*?box-shadow: none;/);
assert.match(stylesSource, /\.project-folder-type button\[aria-pressed="true"\] \{[\s\S]*?background: var\(--surface-raised\);[\s\S]*?color: var\(--text-primary\);[\s\S]*?box-shadow: var\(--shadow-panel\);/);
assert.match(stylesSource, /\.saved-panel \.saved-code-toggle \{[\s\S]*?padding: var\(--space-1\) 0;/, "Saved Evidence code headers should keep the same compact height when expanded or collapsed.");
assert.doesNotMatch(stylesSource, /\.saved-panel \.saved-code-group\.is-collapsed \.saved-code-toggle/, "Saved Evidence code headers should not change spacing between collapsed and expanded states.");
assert.doesNotMatch(stylesSource, /\.saved-panel \.saved-code-group\.is-collapsed \+ \.saved-code-group\.is-collapsed/, "Collapsed Saved Evidence groups should not override the standard inter-group spacing.");
assert.match(stylesSource, /\.saved-panel \.saved-code-group \+ \.saved-code-group \{[\s\S]*?margin-top: var\(--space-2\);/, "Saved Evidence code-group spacing should remain stable in every expanded state.");
assert.match(stylesSource, /\.saved-row-actions button \{[\s\S]*?border-radius: 1000px;/, "Saved Evidence row actions must share the pill shape.");
assert.match(appSource, /typeGroup\.setAttribute\("aria-label", "Record type"\)/);
assert.match(appSource, /\["reference", "Saved collection", "Reusable research that is not attached to a job yet"\]/);
assert.match(appSource, /nameInput\.placeholder = selectedFolderType === "reference" \? "Saved collection name" : "Project Name"/);
assert.match(appSource, /addressLabel\.hidden = selectedFolderType === "reference"/);
assert.match(appSource, /sheet\.classList\.toggle\("is-reference-folder", selectedFolderType === "reference"\)/);
assert.match(appSource, /address: selectedFolderType === "reference" \? "" : addressInput\.value/);
assert.doesNotMatch(appSource, /colorGroup\.hidden = selectedFolderType === "reference"/);
assert.match(stylesSource, /\.project-sheet-field\[hidden\] \{[\s\S]*?display: none;/);
assert.match(stylesSource, /\.project-create-sheet\.is-reference-folder \.project-description-input \{[\s\S]*?min-height: calc\(126px \+ var\(--space-3\)\);[\s\S]*?max-height: 230px;/);
assert.doesNotMatch(appSource, /typeLegend\.textContent = "Folder type"/);
assert.match(appSource, /function activeProjectsIconSVG\(\)[\s\S]*?<rect x="3" y="3"[\s\S]*?<rect x="14" y="14"/);
assert.match(appSource, /instance\.projectsMenuOpen = overrides\.projectsMenuOpen === undefined[\s\S]*?\? true[\s\S]*?: Boolean\(overrides\.projectsMenuOpen\);/);
assert.match(appSource, /archiveButton\.innerHTML = showingArchived \? activeProjectsIconSVG\(\) : archiveIconSVG\(\)/);
assert.match(appSource, /const defaultNonReaderPaneWidth = 400;/);
assert.match(appSource, /const legacyCoordinationPaneWidth = 430;[\s\S]*?const defaultCoordinationPaneWidth = 600;/);
assert.match(appSource, /const legacyReaderPaneWidth = 520;[\s\S]*?const defaultReaderPaneWidth = 600;/);
assert.match(appSource, /const legacySourceLinkedReaderPaneWidth = 400;[\s\S]*?const defaultSourceLinkedReaderPaneWidth = 600;/);
assert.match(appSource, /const defaultResearchPaneWidth = 600;/);
assert.match(appSource, /const defaultCodeDecisionPaneWidth = 600;/);
assert.match(appSource, /const defaultSearchPaneWidth = 600;/);
assert.match(appSource, /paneID === "utility:search" \|\| paneID\.startsWith\("utility:search:"\)\) return defaultSearchPaneWidth;/);
assert.match(appSource, /return Math\.max\(defaultCodeDecisionPaneWidth, minimumWidthForPaneRole\(parsed\?\.paneRole\) \|\| 0\);/);
assert.match(appSource, /paneID === "utility:analysis" \|\| paneID\.startsWith\("research:conversation:"\)\) return defaultResearchPaneWidth;/);
assert.match(appSource, /paneID\?\.startsWith\("reader:"\)[\s\S]*?value === legacyReaderPaneWidth \|\| value === legacySourceLinkedReaderPaneWidth[\s\S]*?defaultPaneWidthForID\(paneID\) === defaultReaderPaneWidth[\s\S]*?return defaultReaderPaneWidth;/);
assert.match(appSource, /if \(isProjectCoordinationPaneID\(paneID\) && value === legacyCoordinationPaneWidth\) \{[\s\S]*?return defaultCoordinationPaneWidth;/);
assert.match(appSource, /projectsMenuToggle\.onclick = \(\) => \{[\s\S]*?if \(instance\.projectsMenuOpen \|\| !showingArchived\) return;[\s\S]*?instance\.projectsArchiveMode = false;/);
assert.match(functionSource(appSource, "defaultActivePaneIDs"), /projectHasOpenNotebook/);
assert.doesNotMatch(functionSource(appSource, "defaultActivePaneIDs"), /paneIDForProjectDetail/);
assert.doesNotMatch(functionSource(appSource, "renderWorkspace"), /renderProjectDetail/);
assert.doesNotMatch(functionSource(appSource, "renderUtilityWorkspace"), /renderProjectDetail/);
assert.match(appSource, /convert\.disabled = !hasCapability\("projects"\)/);
assert.match(
  appSource,
  /if \(projectIsArchived\(project\)\) \{[\s\S]*?archivedLabel\.className = "settings-project-archive-label";[\s\S]*?archivedLabel\.textContent = "Archived";/,
  "Settings must mark only archived folders when active and archived folders share a name."
);
assert.match(
  appSource,
  /function projectOverviewRefreshPaneIDs\([\s\S]*?state\.utilities\.settings \? "utility:settings" : ""/,
  "Open Settings must refresh immediately after a folder is archived, restored, or deleted elsewhere."
);
assert.match(
  appSource,
  /const settingsScrollTop = refreshPaneIDs\.has\("utility:settings"\)[\s\S]*?settingsPane\.scrollTop = Math\.min\(/,
  "Refreshing Settings must preserve its vertical scroll position."
);
assert.match(appSource, /function renameAnnotationTag\([\s\S]*?normalizeAnnotationTags/);
assert.match(appSource, /function wireCodeFilterMenu\([\s\S]*?"ArrowDown"[\s\S]*?"Home"[\s\S]*?"End"[\s\S]*?"Escape"/);
assert.match(stylesSource, /\.reader-notes-project-options \{[\s\S]*?max-height:[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/);
assert.match(stylesSource, /--reader-notes-comment-surface: rgba\(246, 244, 241, 0\.1\);/);
assert.match(stylesSource, /--reader-notes-comment-text: #ffffff;/);
assert.match(stylesSource, /\.reader-notes-input \{[\s\S]*?background: var\(--reader-notes-comment-surface\);[\s\S]*?color: var\(--reader-notes-comment-text\);/);
assert.match(stylesSource, /\.reader-notes-tags \.annotation-tag-input \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
assert.match(appSource, /function renderAnnotationProjectEditor[\s\S]*?const projectListLabel = selectedProjects\.length === 0[\s\S]*?chips\.inert = !open;[\s\S]*?projectListToggle\.textContent = projectListLabel/);
assert.match(appSource, /selectedProjects\.length === 1[\s\S]*?primarySelectedProjectName[\s\S]*?: "MULTIPLE PROJECTS";/, "Multi-project Reader notes should use a stable MULTIPLE PROJECTS disclosure label.");
assert.match(stylesSource, /\.annotation-project-list-toggle\[aria-expanded="true"\]::after \{[\s\S]*?transform: rotate\(90deg\);/);
assert.match(appSource, /container\.dataset\.projectListOpen = "true";[\s\S]*?renderAnnotationProjectEditor\(container, target, sectionPayload, options\);/);
assert.match(stylesSource, /\.annotation-project-list-motion \{[\s\S]*?grid-template-rows: 0fr;[\s\S]*?420ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
assert.match(stylesSource, /\.annotation-project-list-motion\.is-open \{[\s\S]*?grid-template-rows: 1fr;[\s\S]*?opacity: 1;/);
assert.match(stylesSource, /\.annotation-project-chip \+ \.annotation-project-chip \{[\s\S]*?border-top: 1px solid/);
assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.annotation-project-list-motion,[\s\S]*?\.annotation-project-list-toggle::after \{[\s\S]*?transition: none;/);
assert.match(stylesSource, /\.saved-projects-menu\.is-open \.saved-project-list \{[\s\S]*?max-height:[\s\S]*?overflow-y: auto;/);
assert.match(stylesSource, /\.settings-project-archive-label \{[\s\S]*?text-transform: none;/);

assert.match(serverSource, /folder_type TEXT NOT NULL DEFAULT 'project'/);
assert.match(serverSource, /referenceProjectIDs\.has\(projectID\)/);
assert.match(serverSource, /record\.folderType !== "reference"/);
assert.match(entitlementSource, /record\.folderType === "reference"/);
assert.match(swiftModelSource, /enum CodeFolderType: String, Codable/);
assert.match(swiftModelSource, /case reference/);
assert.match(swiftStoreSource, /folder_type/);

console.log("permitext evidence folder contract passed");
