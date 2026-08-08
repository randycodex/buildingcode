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
assert.match(savedFolderContextSource, /"Address"[\s\S]*?"Description"/);
assert.match(savedFolderContextSource, /"Notebook"[\s\S]*?"Report Draft"[\s\S]*?"Coordination"/);
assert.doesNotMatch(savedFolderContextSource, /"Workboard"/);
assert.match(savedFolderContextSource, /context\.dataset\.projectId = projectDetailKey\(identity\)/);
assert.match(savedFolderContextSource, /title: "Blocknotes"[\s\S]*?createSavedEvidenceHeading\(\)[\s\S]*?appendProjectResearchHistory[\s\S]*?title: "Recent Activities"/);
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
assert.match(functionSource(appSource, "closeAllColumns"), /state\.coordinations = \[\][\s\S]*?state\.coordinationThreads = \[\][\s\S]*?state\.projectHostPaneID = ""/);
assert.doesNotMatch(functionSource(appSource, "closeAllColumns"), /state\.coordinationFilters = \{\}/);
assert.match(functionSource(appSource, "primarySavedPaneID"), /state\.projectHostPaneID/);
assert.match(functionSource(appSource, "reconcileProjectStudioWithSavedFolders"), /projectHostSavedInstance/);
assert.match(functionSource(appSource, "reconcileProjectStudioWithSavedFolders"), /outcome\.value === "cancelled"[\s\S]*?expectedHostPaneID[\s\S]*?expectedSelectedFolderID/);
assert.match(savedFolderContextSource, /await loadProjectCoordinationFoundation[\s\S]*?previousContext\.replaceWith\(context\)/);
assert.doesNotMatch(savedFolderContextSource, /previousContext\?\.remove\(\)[\s\S]*?const folder/);
assert.match(functionSource(appSource, "renderSavedProjects"), /addButton\.onclick[\s\S]*?projectsMenuToggle\.onclick[\s\S]*?archiveButton\.onclick/);
assert.match(savedFolderContextSource, /state\.projectHostPaneID = paneID[\s\S]*?await (?:closeTool|openTool)/);
assert.match(functionSource(appSource, "closeUtilityInstance"), /successorFolder[\s\S]*?activateProjectStudio\(successorFolder/);
assert.match(functionSource(appSource, "renderWorkspace"), /renderGeneration = \+\+workspaceRenderGeneration[\s\S]*?renderGeneration !== workspaceRenderGeneration[\s\S]*?appendPaneSequence/);
assert.match(functionSource(appSource, "renderUtilityWorkspace"), /renderGeneration = \+\+workspaceRenderGeneration[\s\S]*?renderGeneration !== workspaceRenderGeneration[\s\S]*?appendPaneSequence/);
assert.doesNotMatch(functionSource(appSource, "projectCollaborationRefresh"), /projectOverviewRefreshPaneIDs/);
assert.doesNotMatch(functionSource(appSource, "focusLinkedProjectRecord"), /projectOverviewRefreshPaneIDs/);
assert.doesNotMatch(functionSource(appSource, "refreshProjectMembershipPanes"), /transitionWorkspace/);
assert.ok(
  functionSource(appSource, "performSavedPanelHydration").indexOf("renderSavedFolderContext") <
    functionSource(appSource, "performSavedPanelHydration").indexOf("renderSavedProjects"),
  "Saved tiles and context must swap in the same render turn after the Project foundation is ready."
);
[
  "detachProjectWorkboard",
  "reattachProjectWorkboard"
].forEach((name) => {
  const source = functionSource(appSource, name);
  assert.doesNotMatch(source, /projectOverviewRefreshPaneIDs/);
  assert.match(source, /syncProjectToolButtonStates/);
});
assert.match(appSource, /if \(!selectedFolder\) \{[\s\S]*?clear\(content\);[\s\S]*?return;/);
assert.match(appSource, /collapsedCodePrefixes: searchActive \? \[\] : savedInstance\.collapsedCodePrefixes/);
assert.match(appSource, /collapsedCodePrefixes: pane\?\.collapsedCodePrefixes/);
assert.match(appSource, /function savedEvidenceMatchesQuery\([\s\S]*?codeDisplayLabel\(prefix\)[\s\S]*?item\.chapterTitle[\s\S]*?item\.noteBody/);
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
assert.match(stylesSource, /\.saved-project-summary-field > \.section-label \{[\s\S]*?text-transform: none;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-blocknote \.section-label \{[\s\S]*?font-weight: 500;[\s\S]*?letter-spacing: 0\.12em;[\s\S]*?text-transform: uppercase;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.project-studio-research \.project-section-toggle-label \{[\s\S]*?font-size: inherit !important;[\s\S]*?font-weight: 500;[\s\S]*?letter-spacing: 0\.12em;[\s\S]*?text-transform: uppercase;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-tool-controls \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);[\s\S]*?width: 100%;/);
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-tool-controls button \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
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
assert.match(appSource, /const legacyCoordinationPaneWidth = 430;[\s\S]*?const defaultCoordinationPaneWidth = 600;/);
assert.match(appSource, /const legacyReaderPaneWidth = 520;[\s\S]*?const defaultReaderPaneWidth = 600;/);
assert.match(appSource, /const legacySourceLinkedReaderPaneWidth = 400;[\s\S]*?const defaultSourceLinkedReaderPaneWidth = 600;/);
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
