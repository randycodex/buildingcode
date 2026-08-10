import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  cacheRetryablePromise,
  clientValuesMatch,
  resolveNotebookVersionConflict,
  stableClientValue,
  shouldUseOfflineFallback
} from "../public/client-reliability.js";

const cache = new Map();
let attempts = 0;
await assert.rejects(() => cacheRetryablePromise(cache, "chapter", async () => {
  attempts += 1;
  throw new Error("temporary outage");
}));
assert.equal(cache.has("chapter"), false);
assert.equal(
  await cacheRetryablePromise(cache, "chapter", async () => {
    attempts += 1;
    return "recovered";
  }),
  "recovered"
);
assert.equal(attempts, 2);

const localDocument = { type: "doc", content: [{ type: "paragraph" }] };
const conflict = resolveNotebookVersionConflict(
  { id: "card-1", title: "Local title", version: 2 },
  localDocument,
  { id: "card-1", title: "Remote title", document: { type: "doc" }, version: 3 }
);
assert.equal(conflict.activeCard.version, 3);
assert.equal(conflict.activeCard.title, "Local title");
assert.equal(conflict.activeCard.document, localDocument);
assert.equal(conflict.dirty, true);

assert.equal(shouldUseOfflineFallback(503), true);
assert.equal(shouldUseOfflineFallback(429), false);
assert.equal(shouldUseOfflineFallback(404), false);

assert.deepEqual(stableClientValue({ z: 1, a: { y: 2, x: 3 } }), {
  a: { x: 3, y: 2 },
  z: 1
});
assert.equal(clientValuesMatch(
  { userID: "user-1", entitlement: { plan: "pro", addOns: { research: true } } },
  { entitlement: { addOns: { research: true }, plan: "pro" }, userID: "user-1" }
), true, "Equivalent account sessions must not trigger another render because object key order changed.");
assert.equal(clientValuesMatch(
  { userID: "user-1", sessionToken: "session-a" },
  { userID: "user-1", sessionToken: "session-b" }
), false, "A changed authenticated session must still propagate across browser contexts.");

const workspaceApp = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
assert(
  workspaceApp.includes("if (clientValuesMatch(JSON.parse(raw), account)) return false;") &&
    workspaceApp.includes("if (clientValuesMatch(state.account.entitlement || null, nextEntitlement))") &&
    workspaceApp.includes("if (clientValuesMatch(state.account || null, nextAccount)) return;"),
  "No-op account and entitlement writes must not restart sync or rebuild the entire workspace."
);

const functionSource = (name, nextName) => workspaceApp.slice(
  workspaceApp.indexOf(name),
  workspaceApp.indexOf(nextName, workspaceApp.indexOf(name) + name.length)
);
const workboardStyleLoader = functionSource(
  "function loadWorkboardStyles()",
  "function loadNotebookModule()"
);
assert(
  workboardStyleLoader.includes('link[href*="/web/workboard-assets/workboard.css"]') &&
    workboardStyleLoader.includes("let settled = false") &&
    workboardStyleLoader.indexOf('link.addEventListener("load", handleLoad)') <
      workboardStyleLoader.indexOf("if (link.sheet) settle(resolve)") &&
    workboardStyleLoader.includes('link.removeEventListener("load", handleLoad)') &&
    workboardStyleLoader.includes('link.removeEventListener("error", handleError)'),
  "The lazy Workboard stylesheet loader must reuse an existing link without missing its load event or settling twice."
);

const syncReconciliation = functionSource(
  "async function refreshSyncedWorkspaceInPlace(options = {})",
  "function canRunForegroundSync()"
);
assert(
  syncReconciliation.includes("const syncedProjects = currentContentSummary().projects || []") &&
    syncReconciliation.includes("const accessibleProjects = openProjectDetails().length") &&
    syncReconciliation.includes("? await projectsWithOrganizationAccess(syncedProjects)") &&
    syncReconciliation.includes("const projectReconciliation = reconcileOpenProjectIdentityAfterSync(accessibleProjects)") &&
    syncReconciliation.includes("renderCodeQuestionShellChrome()") &&
    syncReconciliation.includes("await renderUtilityWorkspace({") &&
    syncReconciliation.includes("skipDeletedProjectCleanup: true") &&
    syncReconciliation.includes("await refreshBlankSearchHistoryPanes()") &&
    syncReconciliation.includes("workspacePaneHasFocusedEditor(paneID)") &&
    syncReconciliation.includes("refreshSavedPanelInPlace(paneID, { reconcileProjectStudio: false })") &&
    syncReconciliation.includes("refreshMountedProjectChrome(projectReconciliation.detail)") &&
    syncReconciliation.includes("updateOpenProjectSyncWarning(projectReconciliation)"),
  "Foreground sync must reconcile safe surfaces without replacing mounted Project editors."
);

const utilityReconciliation = functionSource(
  "async function renderUtilityWorkspace(options = {})",
  "async function transitionWorkspace("
);
assert(
    utilityReconciliation.includes("enforceReaderPlanLimit()") &&
    utilityReconciliation.includes("if (!options.skipDeletedProjectCleanup) closeDeletedProjectDetails()") &&
    utilityReconciliation.includes("openCodeQuestionPaneIDs()") &&
    utilityReconciliation.includes("const existingPane = refreshPaneIDs.has(paneID) ? null : existingPanesByID.get(paneID)") &&
    utilityReconciliation.includes("if (genericWorkboardIsOpen())") &&
    utilityReconciliation.includes("reuseOrRenderPane(workboardID, () => renderProjectWorkboard(genericWorkboardIdentity))"),
  "Selective sync rendering must enforce current entitlements while retaining mounted Workboard and editor panes."
);

const projectIdentityReconciliation = functionSource(
  "function reconcileOpenProjectIdentityAfterSync(projects = currentContentSummary().projects || [])",
  "function refreshMountedProjectChrome(project)"
);
assert(
  projectIdentityReconciliation.includes("const syncedProject = visibleProjectRecords(projects)") &&
  projectIdentityReconciliation.includes('return { detail: previous, status: "unavailable" }') &&
    projectIdentityReconciliation.includes("state.workboards = replaceIdentity(openWorkboards())") &&
    projectIdentityReconciliation.includes("state.notebooks = replaceIdentity(openNotebooks())") &&
    projectIdentityReconciliation.includes("state.reportDrafts = replaceIdentity(openReportDrafts())") &&
    projectIdentityReconciliation.includes("state.coordinations = replaceIdentity(openCoordinations())") &&
    !projectIdentityReconciliation.includes("closeProjectDetailForProject"),
  "Remote Project archival or deletion must retain mounted Project tools while updating current identity chrome."
);

const staleProjectWarning = functionSource(
  "function updateOpenProjectSyncWarning(reconciliation)",
  "async function refreshBlankSearchHistoryPanes()"
);
assert(
  staleProjectWarning.includes("Project archived on another device") &&
    staleProjectWarning.includes("Project no longer available after sync") &&
    staleProjectWarning.includes("state.projectHostPaneID") &&
    staleProjectWarning.includes('warning.setAttribute("aria-live", "polite")'),
  "A remotely archived, deleted, or inaccessible open Project must remain visible with an explicit sync warning."
);

const workspaceStyles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
assert.match(
  workspaceStyles,
  /\.project-sync-stale-warning \{[\s\S]*?display: grid;[\s\S]*?gap: var\(--space-1\);[\s\S]*?\.workspace-panel\.has-stale-project-sync:not\(\.workboard-panel\) \{[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\);[\s\S]*?\.project-sync-stale-warning p \{[\s\S]*?margin: 0;/,
  "The cross-device stale Project warning must stay compact without paragraph default margins."
);
const workspacePanelRule = workspaceStyles.slice(
  workspaceStyles.indexOf(".workspace-panel {"),
  workspaceStyles.indexOf(".settings-panel,")
);
assert.match(workspacePanelRule, /height:\s*100%;/);
assert.doesNotMatch(
  workspacePanelRule,
  /height:\s*calc\(100%\s*\+\s*var\(--space-3\)\)/,
  "Columns and their vertical dividers must terminate at the same track edge, including empty states."
);
assert.doesNotMatch(
  workspaceStyles,
  /body\.code-question-workspace-enabled \.panel-track/,
  "Code Decision mode must use the standard two-row shell without reserving space for a removed context bar."
);

const offlineStorage = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const searchCursorImplementation = offlineStorage.slice(
  offlineStorage.indexOf("async function matchingOfflineSearchResults"),
  offlineStorage.indexOf("async function sectionByIdentity")
);
assert(searchCursorImplementation.includes("openCursor"));
assert(!searchCursorImplementation.includes("getAll"));

console.log("permitext web client reliability contract passed");
