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

const folderType = new Function(`${functionSource(appSource, "folderType")}; return folderType;`)();
assert.equal(folderType({}), "project", "Legacy folders must default to Project.");
assert.equal(folderType({ folderType: "reference" }), "reference");
assert.equal(folderType({ folderType: "invalid" }), "project");

const savedEvidenceKey = new Function(
  "syncCodeVersion",
  "defaultSyncCodeVersion",
  `${functionSource(appSource, "savedEvidenceKey")}; return savedEvidenceKey;`
)((value) => value || "default-library", "default-library");
assert.notEqual(
  savedEvidenceKey({ codeVersion: "library-a", sectionID: 101 }),
  savedEvidenceKey({ codeVersion: "library-b", sectionID: 101 }),
  "The same numeric section in two libraries must remain two canonical saved records."
);

const normalizeAnnotationTags = new Function(
  `${functionSource(appSource, "normalizeAnnotationTags")}; return normalizeAnnotationTags;`
)();
assert.deepEqual(
  normalizeAnnotationTags(["  Fire   safety ", "fire safety", "Egress", ""]),
  ["Fire safety", "Egress"],
  "Tags must normalize Unicode whitespace and merge case-insensitive duplicates."
);

assert.match(appSource, /function persistSectionFolderSelection\([\s\S]*?if \(!selectedByID\.size\) return/);
assert.match(appSource, /destinationList\.setAttribute\("aria-multiselectable", "true"\)/);
assert.match(appSource, /confirmButton\.disabled = selected\.length === 0/);
assert.match(appSource, /await persistSectionFolderSelection\(sectionPayload, selectedFolders, projects\)/);
assert.match(appSource, /function unlinkEvidenceFromFolder\([\s\S]*?title: "Remove final folder\?"[\s\S]*?removeBookmark: true/);
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
assert.match(appSource, /function renderUnassignedEvidenceNotice\([\s\S]*?Nothing is moved or deleted automatically\./);
assert(!appSource.includes("No archived folders."), "An empty archive should not render a redundant placeholder row.");
const savedFolderContextSource = functionSource(appSource, "renderSavedFolderContext");
assert.match(savedFolderContextSource, /projectsSection\.hidden = false/);
assert.match(savedFolderContextSource, /if \(!folder\) \{[\s\S]*?return null;/);
assert.match(savedFolderContextSource, /appendSavedProjectFactEditor\(summary, folder, identity\)/);
assert.match(savedFolderContextSource, /"Notebook"[\s\S]*?"Report Draft"[\s\S]*?"Coordination"/);
assert.doesNotMatch(savedFolderContextSource, /"Workboard"/);
assert.match(savedFolderContextSource, /context\.dataset\.projectId = projectDetailKey\(identity\)/);
assert.match(savedFolderContextSource, /appendSavedProjectFactEditor\(summary, folder, identity\)[\s\S]*?"Notebook"[\s\S]*?"Report Draft"[\s\S]*?"Coordination"[\s\S]*?context\.append\(controls\)[\s\S]*?populateSavedEvidenceSection/);
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
assert.ok(
  deactivateProjectStudioSource.indexOf("confirmReportDraftDiscard") <
    deactivateProjectStudioSource.indexOf("closeProjectDetailForProject"),
  "Project deactivation must confirm Report Draft edits before changing workspace state."
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
assert.match(functionSource(appSource, "reconcileProjectStudioWithSavedFolders"), /projectHostSavedInstance/);
assert.match(functionSource(appSource, "reconcileProjectStudioWithSavedFolders"), /outcome\.value === "cancelled"[\s\S]*?expectedHostPaneID[\s\S]*?expectedSelectedFolderID/);
assert.doesNotMatch(savedFolderContextSource, /loadProjectCoordinationFoundation/);
assert.match(savedFolderContextSource, /previousContext\.replaceWith\(context\)/);
assert.doesNotMatch(savedFolderContextSource, /previousContext\?\.remove\(\)[\s\S]*?const folder/);
assert.match(functionSource(appSource, "renderSavedProjects"), /addButton\.onclick[\s\S]*?projectsMenuToggle\.onclick[\s\S]*?archiveButton\.onclick/);
assert.match(indexSource, /saved-projects-add-button[\s\S]*?saved-projects-archive-button[\s\S]*?saved-projects-select-button/);
assert.match(functionSource(appSource, "renderSavedProjects"), /selectButton\.onclick = \(\) => setSelecting\(!selecting\)/);
const savedProjectsSource = functionSource(appSource, "renderSavedProjects");
assert.match(savedProjectsSource, /archiveSelectedButton\.onclick[\s\S]*?archiveProjects\(selectedProjects, \{ preserveSavedPanes: true \}\)/);
assert.match(savedProjectsSource, /selectionActions\.append\(archiveSelectedButton, editSelectedButton, deleteSelectedButton\)[\s\S]*?bulkBar\.append\(cancelSelectionButton, selectionActions\)[\s\S]*?section\.insertBefore\(bulkBar, list\)/);
assert.doesNotMatch(savedProjectsSource, /saved-projects-bulk-count|selectionCount/);
assert.doesNotMatch(savedProjectsSource, /selectAllButton|"Select all"|"Clear all"/);
assert.match(savedProjectsSource, /if \(showingArchived\) \{[\s\S]*?restoreArchivedProject\(project\)/);
assert.match(savedProjectsSource, /editSelectedButton\.onclick[\s\S]*?selectedProjects\.length !== 1[\s\S]*?showProjectCreateSheet\(panel, selectedProjects\[0\]\)/);
assert.match(savedProjectsSource, /deleteSelectedButton\.onclick[\s\S]*?deleteArchivedProjects\(selectedProjects, \{ preserveSavedPanes: true \}\)/);
assert.match(savedProjectsSource, /const setSelecting = \(nextSelecting\) => \{[\s\S]*?selectedProjectIDs\.clear\(\);\n    updateSelectionControls\(\);\n  \};/);
assert.match(savedProjectsSource, /addButton\.hidden = showingArchived \|\| selecting;[\s\S]*?archiveButton\.hidden = selecting;/);
assert.match(stylesSource, /\.saved-projects-add-button\[hidden\],[\s\S]*?\.saved-projects-archive-button\[hidden\] \{[\s\S]*?visibility: hidden;[\s\S]*?pointer-events: none;/);
assert.match(functionSource(appSource, "refreshProjectOverviewPreservingSavedPanes"), /savedPaneIDs\(\)[\s\S]*?refreshSavedPanelInPlace[\s\S]*?failedSavedIDs[\s\S]*?transitionWorkspace/);
assert.match(functionSource(appSource, "renderSavedProjects"), /archiveSelectedButton\.innerHTML = showingArchived \? archiveRestoreIconSVG\(\) : archiveIconSVG\(\)/);
assert.doesNotMatch(stylesSource, /\.saved-project-tile-actions/);
assert.doesNotMatch(functionSource(appSource, "renderSavedProjects"), /saved-project-tile-actions/);
assert.match(stylesSource, /\.saved-projects-selection-actions \{[\s\S]*?display: flex;[\s\S]*?justify-self: end;[\s\S]*?gap: var\(--space-1\);/);
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
  /section\.querySelector\("\.saved-projects-bulk-bar"\)\?\.remove\(\)/,
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
assert.match(appSource, /if \(status\.childElementCount\) metaLine\.append\(status\)/);
assert.match(appSource, /if \(searchActive\) return;[\s\S]*?savedInstance\.collapsedCodePrefixes/);
assert.match(appSource, /function createSavedEvidenceHeading\([\s\S]*?saved-evidence-search-toggle[\s\S]*?Search saved evidence/);
assert.match(indexSource, /class="saved-evidence-search"[\s\S]*?class="saved-evidence-search-input"[\s\S]*?class="saved-evidence-search-close"/);
assert.doesNotMatch(indexSource, /class="code-filter-menu saved-code-filter-menu"/);
assert.match(appSource, /control\.setAttribute\("aria-expanded", String\(nextExpanded\)\)/);
assert.match(appSource, /if \(!expanded\) body\.hidden = true/);
assert.match(appSource, /options\.onCodeGroupToggle\(normalizedPrefix, collapsed\)/);
assert.match(appSource, /wireProjectSectionMotion\([\s\S]*?codeGroup,[\s\S]*?codeBody,[\s\S]*?onChange: \(expanded\)/);
assert.match(stylesSource, /\.saved-code-group\.is-collapsed \.saved-code-toggle-chevron/);
assert.match(stylesSource, /\.project-section-motion > \.project-section-motion-body[\s\S]*?max-height 420ms cubic-bezier/);
assert.match(appSource, /function appendSavedProjectFactEditor\(container, folder, identity\)[\s\S]*?toggle\.textContent = "Project facts"[\s\S]*?address\.setAttribute\("aria-label", "Project address"\)[\s\S]*?description\.setAttribute\("aria-label", "Project description and facts"\)[\s\S]*?wireProjectSectionMotion\(container, body, \[toggle, chevron\], "Project facts", false\)/);
assert.match(appSource, /address\.addEventListener\("blur", save\)[\s\S]*?description\.addEventListener\("blur", save\)[\s\S]*?updateProjectFolder\(folder,/);
assert.match(stylesSource, /\.saved-project-fact-input \{[\s\S]*?background: transparent;[\s\S]*?font: inherit;/);
assert.match(stylesSource, /\.saved-project-fact-input:focus-visible \{[\s\S]*?box-shadow: inset 0 -1px 0 var\(--project-color, var\(--accent\)\);/);
assert.match(stylesSource, /\.saved-project-fact-description \{[\s\S]*?height: 112px !important;[\s\S]*?overflow-y: auto;[\s\S]*?resize: vertical;/);
assert.match(stylesSource, /\.project-research-history-card strong \{[\s\S]*?font-weight: 400;/);
assert.doesNotMatch(stylesSource, /\.saved-folder-context\.is-project \.saved-project-blocknote/);
assert.doesNotMatch(stylesSource, /\.saved-folder-context\.is-project \.project-studio-research/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-tool-controls \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?width: 100%;/);
assert.doesNotMatch(appSource, /\["Research", "project-code-decisions-button", projectHasOpenCodeDecisions, openProjectCodeDecisions, closeProjectCodeDecisions\]/);
assert.match(appSource, /"toggle-analysis"/);
assert.match(appSource, /async function openProjectCodeDecisions[\s\S]*?await focusUtility\("analysis", "\.evidence-discovery textarea"\);/);
assert.match(appSource, /function projectHasOpenCodeDecisions[\s\S]*?return indexIsOpen && scopedResearchIsOpen;/);
assert.match(appSource, /function clearProjectSpecificResearch[\s\S]*?state\.utilities\.analysis = false;[\s\S]*?id !== "utility:analysis"/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-tool-controls button \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?font-weight: 400;/);
assert.match(stylesSource, /\.saved-evidence-collapse-toggle\[aria-expanded="true"\] \.research-chevron-up,[\s\S]*?\.saved-evidence-collapse-toggle\[aria-expanded="false"\] \.research-chevron-down \{[\s\S]*?display: block;/);
const projectToolControlsRule = stylesSource.match(/\.saved-folder-context\.is-project \.saved-project-tool-controls \{([\s\S]*?)\n\}/)?.[1] || "";
const projectSectionRule = stylesSource.match(/\.saved-folder-context\.is-project > \.project-studio-section,\n\.saved-folder-context\.is-project > \.saved-project-overview-warning \{([\s\S]*?)\n\}/)?.[1] || "";
assert.doesNotMatch(projectToolControlsRule, /border-top/);
assert.doesNotMatch(projectSectionRule, /border-top/);
assert.match(stylesSource, /\.project-folder-type button \{[\s\S]*?background: var\(--menu-subtle-surface\);[\s\S]*?color: var\(--text-primary\);[\s\S]*?box-shadow: none;/);
assert.match(stylesSource, /\.project-folder-type button\[aria-pressed="true"\] \{[\s\S]*?background: var\(--surface-raised\);[\s\S]*?color: var\(--text-primary\);[\s\S]*?box-shadow: var\(--shadow-panel\);/);
assert.match(stylesSource, /\.saved-panel \.saved-code-group\.is-collapsed \.saved-code-toggle \{[\s\S]*?padding-block: var\(--space-1\);/);
assert.match(stylesSource, /\.saved-panel \.saved-code-group\.is-collapsed \+ \.saved-code-group\.is-collapsed \{[\s\S]*?margin-top: 0;/);
assert.match(appSource, /typeGroup\.setAttribute\("aria-label", "Folder type"\)/);
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
