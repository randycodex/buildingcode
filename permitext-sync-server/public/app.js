import {
  inlineCodeReferencePhrases,
  parseCodeJumpAnchor,
  rewriteStructuredCodeLinks
} from "./code-references.js?v=20260720-code-reference-links-v18";
import {
  defaultSyncCodeVersion,
  syncCodeVersion,
  syncProjectIdentity,
  syncMutationRecordID
} from "./sync-identity.js?v=20260720-sync-contract-v2";
import {
  annotationAfterBulkClears,
  bulkClearKey,
  bulkClearTimestamp,
  mergeNewestRecord,
  recordSurvivesBulkClear
} from "./sync-state.js?v=20260721-causal-clear-v4";
import {
  disableOfflineFeature,
  downloadOfflineLibrary,
  loadOfflineSyncSnapshot,
  offlineAPI,
  offlineFeatureMetadata,
  offlineLibraryStatus,
  reconcileOfflineFeatureAccess,
  saveOfflineSyncSnapshot
} from "./offline-storage.js?v=20260724-project-foundation-v5";

const permitextSyncSchemaVersion = 2;
const permitextClientCapabilities = Object.freeze([
  "saved-work",
  "notes",
  "projects",
  "notebook",
  "professional-exports",
  "offline-access",
  "research",
  "evidence-discovery",
  "collaboration",
  "organization-administration"
]);
const baseWorkspaceKey = "permitext:webWorkspace:v1";
const accountSessionKey = "permitext:webAccount:v1";
const tabWorkspaceKey = "permitext:webWorkspaceTab:v1";
const detachedWorkboardPath = "/detached-workboard";
const detachedWindowNamePrefix = "permitext-workboard-";
const detachedWindowSessionStorageKey = "permitext:detachedWorkboardSession:v1";
const internalSectionHistoryStateKey = "permitextInternalSectionNavigation";
const workboardClientVersion = "20260722-workboard-zoom-v16";
const notebookClientVersion = "20260724-project-notebook-v4";
const detachedWorkboardRoute = window.location.pathname === detachedWorkboardPath;
const legacyDetachedProjectParameter = new URLSearchParams(window.location.search).get("detachedWorkboard") || "";
const detachedProjectSession = detachedWorkboardRoute ? detachedProjectSessionFromWindow() : null;
const detachedProjectSessionID = String(detachedProjectSession?.id || "");
const detachedProjectWindow = Boolean(detachedProjectSession?.project);
const workspaceKey = detachedProjectWindow
  ? `${baseWorkspaceKey}:detached:${detachedProjectSessionID}`
  : baseWorkspaceKey;
const track = document.querySelector("#panel-track");
const addReaderButton = document.querySelector("#add-reader");
const toggleArchiveButton = document.querySelector("#toggle-archive");
const toggleSearchButton = document.querySelector("#toggle-search");
const toggleSavedButton = document.querySelector("#toggle-saved");
const toggleAnalysisButton = document.querySelector("#toggle-analysis");
const toggleSettingsButton = document.querySelector("#toggle-settings");
const fitColumnsButton = document.querySelector("#fit-columns");
const collapseReadersButton = document.querySelector("#collapse-readers");
const connectionStatus = document.querySelector("#connection-status");
const readerTemplate = document.querySelector("#reader-template");
const projectsTemplate = document.querySelector("#projects-template");
const searchTemplate = document.querySelector("#search-template");
const savedTemplate = document.querySelector("#saved-template");
const analysisTemplate = document.querySelector("#analysis-template");
const settingsTemplate = document.querySelector("#settings-template");
if (detachedWorkboardRoute) document.body.classList.add("is-detached-workboard-window");

const codeOptions = [
  { prefix: "BC", label: "Building Code", theme: "building" },
  { prefix: "AC", label: "General Administrative Code", theme: "administrative" },
  { prefix: "PC", label: "Plumbing Code", theme: "plumbing" },
  { prefix: "MC", label: "Mechanical Code", theme: "mechanical" },
  { prefix: "FGC", label: "Fuel Gas Code", theme: "fuel-gas" }
];

const codeThemeClasses = codeOptions.map((option) => `code-theme-${option.theme}`);
const defaultReaderPaneWidth = 520;
const defaultUtilityPaneWidth = 320;
const defaultDetailPaneWidth = 320;
const defaultWorkboardPaneWidth = 720;
const defaultNotebookPaneWidth = 760;
const defaultSettingsPaneWidth = 340;
const readerSearchFlashDurationMS = 2000;
const readerInternalSearchDelayMS = 180;
const maxRenderedSearchResults = 250;
const repeatableUtilityKeys = new Set(["search", "saved"]);
const savedSortModes = new Set(["codeOrder", "recentlySaved", "codeBook", "title", "tag"]);
const sharedWorkspaceStateKeys = [
  "localProjects",
  "localSavedItems",
  "localProjectSections",
  "localAnnotations",
  "localBulkClears",
  "syncOutbox",
  "syncConflicts",
  "archivedProjectIDs",
  "sectionNotes",
  "localSavedSectionIDs",
  "continuityAppliedAt"
];

const defaultReaderSettings = {
  fontFamily: "system"
};

let chapters = [];
let state = loadWorkspaceState();
if (absorbBulkClearConflicts()) saveWorkspaceState();
const detachedProject = detachedProjectFromSession();
if (detachedProjectWindow && detachedProject) initializeDetachedProjectState(detachedProject);
const searchTimers = new Map();
const readerSearchTimers = new Map();
let syncedContent = null;
let syncLoadPromise = null;
let syncFlushPromise = null;
let syncRetryTimer = null;
let foregroundSyncTimer = null;
let foregroundSyncPromise = null;
let serverReachable = navigator.onLine !== false;
const foregroundSyncIntervalMilliseconds = 30_000;
const foregroundSyncJitterMilliseconds = 3_000;
let continuityPushTimer = null;
let draggedPaneID = "";
let dragPreviewOrder = [];
let activeCustomSelect = null;
const chapterListCache = new Map();
const chapterCache = new Map();
const sectionSummaryCache = new Map();
const annotationPushTimers = new Map();
const savedFilterScrollPositions = new Map();
let appleWebConfigPromise = null;
let appleIDScriptPromise = null;
let workboardModulePromise = null;
let workboardPreloadHandle = null;
const workboardMounts = new Map();
let notebookModulePromise = null;
const notebookMounts = new Map();
let researchConversationList = [];
let activeResearchConversation = null;
let researchUsage = null;
let researchQuestionDraft = "";
let pendingResearchSelection = null;
let activeWebWarningClose = null;

applyReaderSettings();

function loadWorkspaceState() {
  try {
    const sharedState = JSON.parse(localStorage.getItem(baseWorkspaceKey) || "{}");
    const tabState = !detachedProjectWindow
      ? JSON.parse(sessionStorage.getItem(tabWorkspaceKey) || "null")
      : null;
    const detachedState = detachedProjectWindow
      ? JSON.parse(localStorage.getItem(workspaceKey) || "{}")
      : null;
    const saved = detachedState
      ? {
          ...sharedState,
          paneWeights: detachedState.paneWeights,
          paneOrder: detachedState.paneOrder
        }
      : tabState && typeof tabState === "object"
        ? { ...sharedState, ...tabState }
        : sharedState;
    if (!detachedState && tabState && typeof tabState === "object") {
      sharedWorkspaceStateKeys.forEach((key) => {
        if (sharedState[key] !== undefined) saved[key] = sharedState[key];
      });
    }
    const utilityInstances = normalizeUtilityInstances(saved);
    const projectDetails = Array.isArray(saved.projectDetails)
      ? saved.projectDetails.filter((detail) => detail && typeof detail === "object")
      : saved.projectDetail && typeof saved.projectDetail === "object" ? [saved.projectDetail] : [];
    const savedReaders = Array.isArray(saved.readers)
      ? saved.readers.filter((reader) => reader && typeof reader === "object" && !reader.comparisonManaged)
      : [];
    return {
      readers: savedReaders.length > 0 ? savedReaders : [newReaderState()],
      searchQuery: saved.searchQuery || "",
      searchCodeFilters: normalizeSearchCodeFilters(saved.searchCodeFilters ?? saved.searchCodeFilter),
      recentSearches: normalizeSearchHistory(saved.recentSearches, 10),
      recentActivityUpdatedAt: saved.recentActivityUpdatedAt || null,
      pinnedSearches: normalizeSearchHistory(saved.pinnedSearches),
      recentlyViewedSections: Array.isArray(saved.recentlyViewedSections)
        ? saved.recentlyViewedSections.filter((item) => item && Number(item.sectionID) > 0).slice(0, 20)
        : [],
      localProjects: Array.isArray(saved.localProjects) ? saved.localProjects.filter((project) => project && typeof project === "object") : [],
      localSavedItems: Array.isArray(saved.localSavedItems) ? saved.localSavedItems.filter((item) => item && typeof item === "object") : [],
      localProjectSections: Array.isArray(saved.localProjectSections) ? saved.localProjectSections.filter((item) => item && typeof item === "object") : [],
      localAnnotations: Array.isArray(saved.localAnnotations) ? saved.localAnnotations.filter((item) => item && typeof item === "object") : [],
      localBulkClears: Array.isArray(saved.localBulkClears) ? saved.localBulkClears.filter((item) => item && typeof item === "object") : [],
      syncOutbox: Array.isArray(saved.syncOutbox) ? saved.syncOutbox.filter((item) => item?.mutation && item?.accountUserID) : [],
      syncConflicts: Array.isArray(saved.syncConflicts) ? saved.syncConflicts.filter((item) => item?.mutation) : [],
      archivedProjectIDs: Array.isArray(saved.archivedProjectIDs) ? saved.archivedProjectIDs.map(String) : [],
      searchResultReader: null,
      sectionDetail: null,
      sectionDetails: {},
      sectionDetailAnchors: {},
      searchLinkedReaders: saved.searchLinkedReaders && typeof saved.searchLinkedReaders === "object" ? saved.searchLinkedReaders : {},
      projectDetail: projectDetails[0] || null,
      projectDetails,
      sectionNotes: saved.sectionNotes && typeof saved.sectionNotes === "object" ? saved.sectionNotes : {},
      localSavedSectionIDs: Array.isArray(saved.localSavedSectionIDs) ? saved.localSavedSectionIDs.map(String) : [],
      utilityInstances,
      utilities: {
        projects: Boolean(saved.utilities?.projects),
        archive: Boolean(saved.utilities?.archive),
        search: false,
        saved: false,
        analysis: Boolean(saved.utilities?.analysis || (saved.utilityInstances || []).some((item) => item?.key === "analysis")),
        settings: Boolean(saved.utilities?.settings)
      },
      account: loadPersistedAccount(saved.account),
      browserCredentialID: typeof saved.browserCredentialID === "string" ? saved.browserCredentialID : "",
      paneWeights: saved.paneWeights && typeof saved.paneWeights === "object" ? saved.paneWeights : {},
      paneOrder: Array.isArray(saved.paneOrder) ? saved.paneOrder.filter((id) => typeof id === "string") : [],
      recentChaptersByCode: saved.recentChaptersByCode && typeof saved.recentChaptersByCode === "object" ? saved.recentChaptersByCode : {},
      continuityAppliedAt: saved.continuityAppliedAt || null,
      readerSettings: normalizeReaderSettings(saved.readerSettings),
      settingsCodePrefix: typeof saved.settingsCodePrefix === "string" ? saved.settingsCodePrefix : "",
      savedTextSize: clampNumber(saved.savedTextSize, 10, 18, 10),
      researchConversationID: typeof saved.researchConversationID === "string" ? saved.researchConversationID : "",
      workboards: normalizeProjectIdentities(saved.workboards, saved.workboard),
      notebooks: normalizeProjectIdentities(saved.notebooks),
      detachedWorkboards: normalizeProjectIdentities(saved.detachedWorkboards)
    };
  } catch {
    return {
      readers: [newReaderState()],
      searchQuery: "",
      searchCodeFilters: [],
      recentSearches: [],
      recentActivityUpdatedAt: null,
      pinnedSearches: [],
      recentlyViewedSections: [],
      localProjects: [],
      localSavedItems: [],
      localProjectSections: [],
      localAnnotations: [],
      localBulkClears: [],
      syncOutbox: [],
      syncConflicts: [],
      archivedProjectIDs: [],
      searchResultReader: null,
      sectionDetail: null,
      sectionDetails: {},
      sectionDetailAnchors: {},
      searchLinkedReaders: {},
      projectDetail: null,
      projectDetails: [],
      sectionNotes: {},
      localSavedSectionIDs: [],
      utilityInstances: [],
      utilities: { projects: false, archive: false, search: false, saved: false, analysis: false, settings: false },
      account: null,
      browserCredentialID: "",
      paneWeights: {},
      paneOrder: [],
      recentChaptersByCode: {},
      continuityAppliedAt: null,
      readerSettings: { ...defaultReaderSettings },
      settingsCodePrefix: "",
      savedTextSize: 10,
      researchConversationID: "",
      workboards: [],
      notebooks: [],
      detachedWorkboards: []
    };
  }
}

function loadPersistedAccount(legacyAccount = null) {
  try {
    const account = JSON.parse(localStorage.getItem(accountSessionKey) || "null");
    if (account && typeof account === "object") return account;
  } catch {
    // Fall through to the legacy workspace account during migration.
  }
  if (legacyAccount && typeof legacyAccount === "object") {
    try {
      localStorage.setItem(accountSessionKey, JSON.stringify(legacyAccount));
    } catch {
      // The in-memory legacy account can still be used for this tab.
    }
    return legacyAccount;
  }
  return null;
}

function persistAccountSession(account = state?.account || null) {
  if (account && typeof account === "object") {
    localStorage.setItem(accountSessionKey, JSON.stringify(account));
    return;
  }
  localStorage.removeItem(accountSessionKey);
}

function newUtilityInstance(key, overrides = {}) {
  const instance = {
    id: overrides.id || crypto.randomUUID(),
    key
  };
  if (key === "search") {
    instance.query = typeof overrides.query === "string" ? overrides.query : "";
    instance.codeFilters = normalizeSearchCodeFilters(overrides.codeFilters);
  } else if (key === "saved") {
    instance.codeFilters = normalizeSearchCodeFilters(overrides.codeFilters);
    instance.tagFilter = typeof overrides.tagFilter === "string" ? overrides.tagFilter.trim() : "";
    instance.sortMode = normalizeSavedSortMode(overrides.sortMode);
  }
  return instance;
}

function normalizeUtilityInstances(saved = {}) {
  const source = Array.isArray(saved.utilityInstances) ? saved.utilityInstances : [];
  const instances = source
    .map((pane) => newUtilityInstance(String(pane?.key || "").trim().toLowerCase(), {
      id: String(pane?.id || crypto.randomUUID()),
      query: typeof pane?.query === "string" ? pane.query : "",
      codeFilters: pane?.codeFilters,
      tagFilter: pane?.tagFilter,
      sortMode: pane?.sortMode
    }))
    .filter((pane) => repeatableUtilityKeys.has(pane.key));

  if (source.length === 0) {
    repeatableUtilityKeys.forEach((key) => {
      if (saved.utilities?.[key]) instances.push(newUtilityInstance(key));
    });
  }

  return instances;
}

function saveWorkspaceState() {
  const persistableState = {
    ...state,
    searchResultReader: null,
    sectionDetail: null,
    sectionDetails: {},
    sectionDetailAnchors: {},
    paneOrder: (state.paneOrder || []).filter((paneID) => !paneID.startsWith("section:detail:")),
    paneWeights: Object.fromEntries(
      Object.entries(state.paneWeights || {}).filter(([paneID]) => !paneID.startsWith("section:detail:"))
    )
  };
  const { account: _account, ...persistableWorkspaceState } = persistableState;
  if (!detachedProjectWindow) {
    sessionStorage.setItem(tabWorkspaceKey, JSON.stringify(persistableWorkspaceState));
  }
  localStorage.setItem(workspaceKey, JSON.stringify(persistableWorkspaceState));
  updateConnectionStatus();
  if (!detachedProjectWindow) return;
  try {
    const shared = JSON.parse(localStorage.getItem(baseWorkspaceKey) || "{}");
    sharedWorkspaceStateKeys.forEach((key) => {
      shared[key] = state[key];
    });
    localStorage.setItem(baseWorkspaceKey, JSON.stringify(shared));
  } catch {
    // The detached board can keep working from its scoped state if the shared state is unavailable.
  }
}

function applySharedWorkspaceState(serializedState) {
  try {
    const shared = JSON.parse(serializedState || "{}");
    sharedWorkspaceStateKeys.forEach((key) => {
      if (shared[key] !== undefined) state[key] = shared[key];
    });
  } catch {
    // Ignore malformed cross-window state and keep the current in-memory data.
  }
}

function normalizeProjectIdentities(value, legacyWorkboard = null) {
  const source = Array.isArray(value)
    ? value
    : legacyWorkboard?.project && typeof legacyWorkboard.project === "object" ? [legacyWorkboard.project] : [];
  const unique = new Map();
  source.filter((project) => project && typeof project === "object").forEach((project) => {
    const identity = projectIdentity(project);
    const id = workboardProjectID(identity);
    if (id) unique.set(id, identity);
  });
  return Array.from(unique.values());
}

function workboardProjectID(project) {
  return String(project?.clientID || project?.id || project?.localFolderID || projectDetailKey(project) || "");
}

function detachedProjectSessionFromWindow() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(detachedWindowSessionStorageKey) || "null");
    if (stored?.project && typeof stored.project === "object") {
      return {
        id: String(stored.id || window.name || `${detachedWindowNamePrefix}session`),
        project: stored.project
      };
    }
  } catch {
    // Fall through to the legacy handoff used by already-open detached windows.
  }

  const legacyID = legacyDetachedProjectParameter || (
    window.name.startsWith(detachedWindowNamePrefix) ? window.name : ""
  );
  if (!legacyID) return null;
  try {
    const project = JSON.parse(localStorage.getItem(`permitext:detachedWorkboard:${legacyID}`) || "null");
    if (!project || typeof project !== "object") return null;
    const session = { id: legacyID, project };
    window.sessionStorage.setItem(detachedWindowSessionStorageKey, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

function detachedProjectFromSession() {
  const project = detachedProjectSession?.project;
  return project && typeof project === "object" ? projectIdentity(project) : null;
}

function initializeDetachedProjectState(project) {
  const identity = projectIdentity(project);
  document.body.dataset.detachedProjectId = workboardProjectID(identity);
  state.projectDetail = null;
  state.projectDetails = [];
  state.workboards = [identity];
  state.notebooks = [];
  state.detachedWorkboards = [];
  state.utilityInstances = [];
  state.utilities = { projects: false, archive: false, search: false, saved: false, analysis: false, settings: false };
  state.readers = [];
  const workboardID = paneIDForProjectWorkboard(identity);
  const savedWorkboardWidth = Number(state.paneWeights?.[workboardID]);
  state.paneOrder = [workboardID];
  state.paneWeights = {
    [workboardID]: Number.isFinite(savedWorkboardWidth) && savedWorkboardWidth > 40
      ? savedWorkboardWidth
      : defaultWorkboardPaneWidth
  };
  document.body.classList.add("is-detached-workboard-window");
  document.title = `${identity.name} Workboard`;
}

function openWorkboards() {
  state.workboards = normalizeProjectIdentities(state.workboards);
  return state.workboards;
}

function openNotebooks() {
  state.notebooks = normalizeProjectIdentities(state.notebooks);
  return state.notebooks;
}

function detachedWorkboards() {
  state.detachedWorkboards = normalizeProjectIdentities(state.detachedWorkboards);
  return state.detachedWorkboards;
}

function projectHasOpenWorkboard(project) {
  return openWorkboards().some((item) => projectDetailMatches(project, item));
}

function projectHasOpenNotebook(project) {
  return openNotebooks().some((item) => projectDetailMatches(project, item));
}

function projectHasDetachedWorkboard(project) {
  return detachedWorkboards().some((item) => projectDetailMatches(project, item));
}

function loadWorkboardModule() {
  if (!workboardModulePromise) {
    workboardModulePromise = import(`/web/workboard-assets/workboard.js?v=${workboardClientVersion}`)
      .catch((error) => {
        workboardModulePromise = null;
        throw error;
      });
  }
  return workboardModulePromise;
}

function loadNotebookModule() {
  if (!notebookModulePromise) {
    notebookModulePromise = import(`/web/notebook-assets/notebook.js?v=${notebookClientVersion}`)
      .catch((error) => {
        notebookModulePromise = null;
        throw error;
      });
  }
  return notebookModulePromise;
}

function scheduleWorkboardModulePreload() {
  if (workboardModulePromise || workboardPreloadHandle !== null) return;
  const preload = () => {
    workboardPreloadHandle = null;
    void loadWorkboardModule().catch(() => {});
  };
  if (typeof window.requestIdleCallback === "function") {
    workboardPreloadHandle = window.requestIdleCallback(preload);
  } else {
    workboardPreloadHandle = window.setTimeout(preload, 8_000);
  }
}

async function closeProjectWorkboard(project) {
  const workboardID = paneIDForProjectWorkboard(project);
  state.workboards = openWorkboards().filter((item) => !projectDetailMatches(project, item));
  delete state.paneWeights[workboardID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== workboardID);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(project)] });
}

async function openProjectWorkboard(project) {
  const identity = projectIdentity(project);
  if (!openProjectDetails().some((detail) => projectDetailMatches(identity, detail))) {
    setOpenProjectDetails([...openProjectDetails(), identity]);
  }
  if (!projectHasOpenWorkboard(identity)) state.workboards = [...openWorkboards(), identity];
  state.detachedWorkboards = detachedWorkboards().filter((item) => !projectDetailMatches(identity, item));
  const workboardID = paneIDForProjectWorkboard(identity);
  state.paneWeights[workboardID] ||= defaultWorkboardPaneWidth;
  placeProjectDetailAfterProjects(identity);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(identity)] });
  scrollPaneIntoView(workboardID);
}

async function closeProjectNotebook(project) {
  const notebookID = paneIDForProjectNotebook(project);
  state.notebooks = openNotebooks().filter((item) => !projectDetailMatches(project, item));
  delete state.paneWeights[notebookID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== notebookID);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(project)] });
}

async function openProjectNotebook(project) {
  const identity = projectIdentity(project);
  if (!openProjectDetails().some((detail) => projectDetailMatches(identity, detail))) {
    setOpenProjectDetails([...openProjectDetails(), identity]);
  }
  if (!projectHasOpenNotebook(identity)) state.notebooks = [...openNotebooks(), identity];
  const notebookID = paneIDForProjectNotebook(identity);
  state.paneWeights[notebookID] ||= defaultNotebookPaneWidth;
  placeProjectDetailAfterProjects(identity);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(identity)] });
  scrollPaneIntoView(notebookID);
}

async function mountPendingProjectWorkboard(mounted) {
  if (mounted.mountTask || mounted.disposed) return mounted.mountTask;
  mounted.mountTask = (async () => {
    window.EXCALIDRAW_ASSET_PATH = "/web/workboard-assets/";
    const module = await loadWorkboardModule();
    while (mounted.pendingMount && !mounted.disposed) {
      const pending = mounted.pendingMount;
      mounted.pendingMount = null;
      if (mounted.initialized && mounted.renderKey === pending.renderKey) continue;
      if (!mounted.initialized) mounted.root.replaceChildren();
      mounted.unmount = module.mountWorkboard(mounted.root, pending.options);
      mounted.renderKey = pending.renderKey;
      mounted.initialized = true;
    }
  })().catch((error) => {
    if (mounted.disposed) return;
    console.error("Could not load the project workboard.", error);
    mounted.root.textContent = "Could not load the project workboard.";
  }).finally(() => {
    mounted.mountTask = null;
    if (mounted.pendingMount && !mounted.disposed && mounted.mountFrame === null) {
      mounted.mountFrame = window.requestAnimationFrame(() => {
        mounted.mountFrame = null;
        void mountPendingProjectWorkboard(mounted);
      });
    }
  });
  return mounted.mountTask;
}

function scheduleProjectWorkboardMount(mounted, options, renderKey) {
  if (mounted.initialized && mounted.renderKey === renderKey) return;
  mounted.pendingMount = { options, renderKey };
  if (mounted.mountFrame !== null || mounted.mountTask) return;
  mounted.mountFrame = window.requestAnimationFrame(() => {
    mounted.mountFrame = null;
    void mountPendingProjectWorkboard(mounted);
  });
}

function renderProjectWorkboard(project) {
  const identity = projectIdentity(project);
  const projectID = workboardProjectID(identity);
  const paneID = paneIDForProjectWorkboard(identity);
  let mounted = workboardMounts.get(projectID);
  if (!mounted) {
    const panel = document.createElement("article");
    panel.className = "workspace-panel workboard-panel";
    panel.dataset.paneId = paneID;
    panel.style.setProperty("--project-color", identity.color || "#c96410");
    const root = document.createElement("div");
    root.className = "workboard-root";
    root.dataset.projectId = projectID;
    root.textContent = "Loading workboard…";
    panel.append(root);
    mounted = {
      panel,
      root,
      unmount: null,
      initialized: false,
      disposed: false,
      mountFrame: null,
      mountTask: null,
      pendingMount: null,
      renderKey: "",
      uploadAsset: (fileID, file) => uploadWorkboardAsset(projectID, fileID, file)
    };
    workboardMounts.set(projectID, mounted);
  }
  mounted.panel.dataset.paneId = paneID;
  mounted.panel.style.setProperty("--project-color", identity.color || "#c96410");
  applyPaneWeight(mounted.panel, paneID);
  const remoteRevision = syncedWorkboardForProject(projectID)?.updatedAt || "";
  const syncEnabled = Boolean(activeAccount());
  const projectName = identity.name || identity.title || "Project";
  const renderKey = JSON.stringify([projectID, projectName, syncEnabled, remoteRevision, detachedProjectWindow]);
  scheduleProjectWorkboardMount(mounted, {
    projectID,
    projectName,
    onClose: detachedProjectWindow ? () => window.close() : () => closeProjectWorkboard(identity),
    onDetach: detachedProjectWindow ? reattachDetachedProject : () => detachProjectWorkboard(identity),
    detachLabel: detachedProjectWindow ? "Reattach Workboard" : "Detach Workboard",
    syncEnabled,
    loadSyncedBoard: loadSyncedWorkboard,
    saveSyncedBoard: saveSyncedWorkboard,
    uploadAsset: mounted.uploadAsset,
    loadAsset: loadWorkboardAsset,
    remoteRevision
  }, renderKey);
  return mounted.panel;
}

function cleanupInactiveWorkboardMounts(panes) {
  const activeProjectIDs = new Set(panes
    .filter((pane) => pane.classList.contains("workboard-panel"))
    .map((pane) => pane.querySelector(".workboard-root")?.dataset.projectId)
    .filter(Boolean));
  workboardMounts.forEach((mounted, projectID) => {
    if (activeProjectIDs.has(projectID)) return;
    disposeProjectWorkboardMount(mounted);
    workboardMounts.delete(projectID);
  });
}

function cleanupInactiveNotebookMounts(panes) {
  const activeProjectIDs = new Set(panes
    .filter((pane) => pane.classList.contains("notebook-panel"))
    .map((pane) => pane.dataset.projectId)
    .filter(Boolean));
  notebookMounts.forEach((mounted, projectID) => {
    if (activeProjectIDs.has(projectID)) return;
    mounted.dispose?.();
    notebookMounts.delete(projectID);
  });
}

function disposeProjectWorkboardMount(mounted) {
  if (!mounted) return;
  mounted.disposed = true;
  if (mounted.mountFrame !== null) window.cancelAnimationFrame(mounted.mountFrame);
  mounted.mountFrame = null;
  mounted.pendingMount = null;
  mounted.unmount?.();
}

function detachedWindowName(project) {
  return `${detachedWindowNamePrefix}${workboardProjectID(project).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function detachedWindowURL() {
  return detachedWorkboardPath;
}

function openDetachedWindow(project) {
  const identity = projectIdentity(project);
  const windowName = detachedWindowName(identity);
  const popup = window.open(
    "",
    windowName,
    "popup=yes,width=1240,height=820,resizable=yes,scrollbars=yes"
  );
  if (!popup) return null;
  try {
    popup.sessionStorage.setItem(detachedWindowSessionStorageKey, JSON.stringify({
      id: windowName,
      project: identity
    }));
    const isReadyDetachedWindow = popup.location.pathname === detachedWindowURL()
      && popup.document.body?.dataset.detachedProjectId === workboardProjectID(identity);
    if (!isReadyDetachedWindow) popup.location.replace(detachedWindowURL());
    popup.focus();
  } catch (error) {
    console.error("Could not initialize the detached Workboard window.", error);
    popup.close();
    return null;
  }
  return popup;
}

async function detachProjectWorkboard(project) {
  if (detachedProjectWindow) return;
  const identity = projectIdentity(project);
  const popup = openDetachedWindow(identity);
  if (!popup) {
    await showWebNotice(
      "Workboard window blocked",
      "Allow pop-ups for permitext, then try opening the Workboard again."
    );
    return;
  }
  if (!projectHasDetachedWorkboard(identity)) {
    state.detachedWorkboards = [...detachedWorkboards(), identity];
  }
  state.workboards = openWorkboards().filter((item) => !projectDetailMatches(identity, item));
  const workboardID = paneIDForProjectWorkboard(identity);
  delete state.paneWeights[workboardID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== workboardID);
  saveWorkspaceState();
  await transitionWorkspace("utility", {
    refreshPaneIDs: projectOverviewRefreshPaneIDs(paneIDForProjectDetail(identity))
  });
}

function closeDetachedWorkboardWindow(detachedWindow) {
  try {
    if (detachedWindow && !detachedWindow.closed) detachedWindow.close();
  } catch (error) {
    console.error("Could not close the detached Workboard window.", error);
  }
}

function reattachDetachedProject() {
  if (!detachedProject) return;
  let notifiedOpener = false;
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "permitext:reattachWorkboard", project: detachedProject },
        window.location.origin
      );
      notifiedOpener = true;
    }
  } catch (error) {
    console.error("Could not notify the original Workboard window.", error);
  }
  if (!notifiedOpener) {
    localStorage.setItem("permitext:pendingWorkboardReattach", JSON.stringify(detachedProject));
  }
  closeDetachedWorkboardWindow(window);
}

async function reattachProjectWorkboard(project, detachedWindow = null) {
  closeDetachedWorkboardWindow(detachedWindow);
  const identity = projectIdentity(project);
  state.detachedWorkboards = detachedWorkboards().filter((item) => !projectDetailMatches(identity, item));
  if (!openProjectDetails().some((detail) => projectDetailMatches(identity, detail))) {
    setOpenProjectDetails([...openProjectDetails(), identity]);
  }
  if (!projectHasOpenWorkboard(identity)) state.workboards = [...openWorkboards(), identity];
  placeProjectDetailAfterProjects(identity);
  state.paneWeights[paneIDForProjectDetail(identity)] ||= defaultDetailPaneWidth;
  state.paneWeights[paneIDForProjectWorkboard(identity)] ||= defaultWorkboardPaneWidth;
  localStorage.removeItem("permitext:pendingWorkboardReattach");
  saveWorkspaceState();
  await transitionWorkspace("utility", {
    refreshPaneIDs: projectOverviewRefreshPaneIDs(paneIDForProjectDetail(identity))
  });
  scrollPaneIntoView(paneIDForProjectWorkboard(identity));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeReaderSettings(settings = {}) {
  const fontFamily = settings.fontFamily === "helvetica" ? "system" : String(settings.fontFamily || "system");
  return {
    fontFamily: ["system", "rounded", "serif", "monospaced"].includes(fontFamily) ? fontFamily : "system"
  };
}

function normalizeSearchCodeFilters(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)));
  }
  const prefix = typeof value === "string" ? value.trim().toUpperCase() : "";
  return prefix && prefix !== "ALL" ? [prefix] : [];
}

function normalizeSearchHistory(value, limit = Number.POSITIVE_INFINITY) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  value.forEach((item) => {
    const query = String(item || "").trim();
    const key = query.toLocaleLowerCase();
    if (!query || seen.has(key)) return;
    seen.add(key);
    normalized.push(query);
  });
  return normalized.slice(0, limit);
}

function normalizeSavedSortMode(value) {
  return savedSortModes.has(value) ? value : "codeOrder";
}

function normalizeSavedInstance(instance) {
  if (!instance || typeof instance !== "object") return { codeFilters: [], tagFilter: "", sortMode: "codeOrder" };
  instance.codeFilters = normalizeSearchCodeFilters(instance.codeFilters);
  instance.tagFilter = typeof instance.tagFilter === "string" ? instance.tagFilter.trim() : "";
  instance.sortMode = normalizeSavedSortMode(instance.sortMode);
  return instance;
}

function normalizeSearchInstance(instance) {
  if (!instance || typeof instance !== "object") return { query: "", codeFilters: [] };
  instance.query = typeof instance.query === "string" ? instance.query : "";
  instance.codeFilters = normalizeSearchCodeFilters(instance.codeFilters);
  return instance;
}

function readerFontFamilyValue() {
  if (state.readerSettings.fontFamily === "rounded") return "ui-rounded, -apple-system, BlinkMacSystemFont, sans-serif";
  if (state.readerSettings.fontFamily === "serif") return "New York, Iowan Old Style, Georgia, serif";
  if (state.readerSettings.fontFamily === "monospaced") return "SFMono-Regular, Menlo, Monaco, monospace";
  return "-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
}

function applyReaderSettings() {
  state.readerSettings = normalizeReaderSettings(state.readerSettings);
  document.documentElement.style.setProperty("--reader-font-family", readerFontFamilyValue());
}

function readerTextSizeValue(reader) {
  return clampNumber(reader?.textSize, 10, 26, 10);
}

function syncReaderTextSizeControls(panel, reader) {
  const size = readerTextSizeValue(reader);
  const decreaseButton = panel.querySelector(".reader-text-decrease");
  const increaseButton = panel.querySelector(".reader-text-increase");
  if (decreaseButton) {
    decreaseButton.disabled = size <= 10;
    decreaseButton.title = `Decrease Reader text size (${size} pt)`;
  }
  if (increaseButton) {
    increaseButton.disabled = size >= 26;
    increaseButton.title = `Increase Reader text size (${size} pt)`;
  }
}

function applyReaderTextSize(panel, reader) {
  if (Number.isFinite(Number(reader?.textSize))) {
    panel.style.setProperty("--reader-font-size", `${readerTextSizeValue(reader)}pt`);
  } else {
    panel.style.removeProperty("--reader-font-size");
  }
  syncReaderTextSizeControls(panel, reader);
}

function changeReaderTextSize(panel, reader, delta) {
  const nextSize = clampNumber(readerTextSizeValue(reader) + delta, 10, 26, 10);
  (state.readers || []).forEach((openReader) => {
    openReader.textSize = nextSize;
    const openPanel = track.querySelector(
      `.reader-panel[data-pane-id="${CSS.escape(paneIDForReader(openReader))}"]`
    );
    if (openPanel) applyReaderTextSize(openPanel, openReader);
  });
  saveWorkspaceState();
  requestAnimationFrame(() => {
    track.querySelectorAll(".reader-panel").forEach((openPanel) => {
      syncCommentBoxHeights(openPanel.querySelector(".reader-content"), openPanel.querySelector(".comments-list"));
      updateReaderScrollIndicator(openPanel);
    });
  });
}

function readerSpacingValue(reader) {
  return clampNumber(reader?.lineSpacing, 1, 1.8, 1.2);
}

function syncReaderSpacingControls(panel, reader) {
  const spacing = readerSpacingValue(reader);
  const decreaseButton = panel.querySelector(".reader-spacing-decrease");
  const increaseButton = panel.querySelector(".reader-spacing-increase");
  if (decreaseButton) {
    decreaseButton.disabled = spacing <= 1;
    decreaseButton.title = `Decrease Reader line spacing (${spacing.toFixed(1)})`;
  }
  if (increaseButton) {
    increaseButton.disabled = spacing >= 1.8;
    increaseButton.title = `Increase Reader line spacing (${spacing.toFixed(1)})`;
  }
}

function applyReaderSpacing(panel, reader) {
  if (Number.isFinite(Number(reader?.lineSpacing))) {
    panel.style.setProperty("--reader-line-height", readerSpacingValue(reader).toFixed(1));
  } else {
    panel.style.removeProperty("--reader-line-height");
  }
  syncReaderSpacingControls(panel, reader);
}

function changeReaderSpacing(panel, reader, delta) {
  const nextSpacing = Math.round((readerSpacingValue(reader) + delta) * 10) / 10;
  (state.readers || []).forEach((openReader) => {
    openReader.lineSpacing = nextSpacing;
    const openPanel = track.querySelector(
      `.reader-panel[data-pane-id="${CSS.escape(paneIDForReader(openReader))}"]`
    );
    if (openPanel) applyReaderSpacing(openPanel, openReader);
  });
  saveWorkspaceState();
}

function savedTextSizeValue() {
  return clampNumber(state.savedTextSize, 10, 18, 10);
}

function applySavedTextSize(panel) {
  const size = savedTextSizeValue();
  panel.style.setProperty("--saved-font-size", `${size}pt`);
  const decreaseButton = panel.querySelector(".saved-text-decrease");
  const increaseButton = panel.querySelector(".saved-text-increase");
  if (decreaseButton) {
    decreaseButton.disabled = size <= 10;
    decreaseButton.title = `Decrease Saved text size (${size} pt)`;
  }
  if (increaseButton) {
    increaseButton.disabled = size >= 18;
    increaseButton.title = `Increase Saved text size (${size} pt)`;
  }
}

function changeSavedTextSize(delta) {
  state.savedTextSize = clampNumber(savedTextSizeValue() + delta, 10, 18, 10);
  track.querySelectorAll(".saved-panel").forEach(applySavedTextSize);
  saveWorkspaceState();
}

function newReaderState(overrides = {}) {
  const codePrefix = overrides.codePrefix || "BC";
  return {
    id: crypto.randomUUID(),
    codePrefix,
    chapterID: overrides.chapterID || "",
    sectionID: "",
    sectionNumber: "",
    title: "Reader",
    commentsOpen: false,
    commentsWidth: 34,
    internalSearchQuery: "",
    activeNotesSectionID: "",
    shouldSmoothScrollToSection: false,
    ...overrides
  };
}

function sectionRouteIDFromLocation() {
  const match = window.location.pathname.match(/^\/open\/section\/(\d+)\/?$/);
  return match?.[1] || "";
}

function pageLoadedFromRefresh() {
  const navigationEntry = performance.getEntriesByType?.("navigation")?.[0];
  if (navigationEntry?.type) return navigationEntry.type === "reload";
  return performance.navigation?.type === 1;
}

function deepLinkedSectionIDFromLocation() {
  const sectionID = sectionRouteIDFromLocation();
  if (!sectionID || window.history.state?.[internalSectionHistoryStateKey] || pageLoadedFromRefresh()) return "";
  return sectionID;
}

function consumeBrowserSectionURL() {
  if (!sectionRouteIDFromLocation()) return;
  const url = new URL(window.location.href);
  url.pathname = "/";
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function updateBrowserSectionURL(sectionID) {
  const normalizedID = String(sectionID || "").trim();
  if (!/^\d+$/.test(normalizedID)) return;
  const nextPath = `/open/section/${normalizedID}`;
  const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
  window.history.replaceState({ ...currentState, [internalSectionHistoryStateKey]: true }, "", nextPath);
}

function sharedSectionURL(sectionID) {
  const normalizedID = String(sectionID || "").trim();
  if (!/^\d+$/.test(normalizedID)) return "";
  return `https://permitext-sync.vercel.app/open/section/${normalizedID}`;
}

function showShareButtonResult(button, message) {
  if (!button) return;
  const originalTitle = button.dataset.defaultTitle || button.title || "Share section";
  button.dataset.defaultTitle = originalTitle;
  button.title = message;
  button.setAttribute("aria-label", message);
  window.setTimeout(() => {
    if (!button.isConnected) return;
    button.title = originalTitle;
    button.setAttribute("aria-label", originalTitle);
  }, 1600);
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  return copied;
}

async function copyTextToClipboard(text) {
  if (typeof navigator.clipboard?.writeText === "function") {
    try {
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Clipboard timed out.")), 250);
        navigator.clipboard.writeText(text).then(
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          (error) => {
            window.clearTimeout(timeout);
            reject(error);
          }
        );
      });
      return true;
    } catch {
      // Some embedded browsers expose Clipboard API without granting a usable session.
    }
  }
  return copyTextFallback(text);
}

function officialSectionCitation(section) {
  const codeName = codeDisplayLabel(section?.codePrefix || "BC");
  const number = String(section?.sectionNumber || "").trim();
  const rawTitle = String(section?.title || "").trim();
  const title = number
    ? rawTitle.replace(new RegExp(`^(?:§\\s*)?${escapeRegExp(number)}(?:\\b|[\\s.:;-]+)`, "i"), "").trim()
    : rawTitle;
  const citation = [
    `New York City ${codeName}`,
    number ? `§ ${number}` : "",
    "(2022)"
  ].filter(Boolean).join(" ");
  return title ? `${citation} — ${title}` : citation;
}

function paneIDForReader(reader, options = {}) {
  return options.isSearchResult ? "reader:search-result" : `reader:${reader.id}`;
}

function paneIDForUtilityInstance(instance) {
  return `utility:${instance.key}:${instance.id}`;
}

function paneIDForResearchConversation(conversationID = state.researchConversationID) {
  return conversationID ? `research:conversation:${conversationID}` : "";
}

function paneIDForSectionDetail(searchID = "legacy") {
  return `section:detail:${searchID}`;
}

function projectDetailKey(detail) {
  if (!detail) return "legacy";
  return String(
    syncProjectIdentity(detail.clientID, detail.userID) ||
    syncProjectIdentity(detail.id, detail.userID) ||
    detail.localFolderID ||
    detail.name ||
    detail.title ||
    "legacy"
  );
}

function paneIDForProjectDetail(detail = null) {
  return `project:detail:${encodeURIComponent(projectDetailKey(detail))}`;
}

function isProjectDetailPaneID(paneID) {
  return String(paneID || "").startsWith("project:detail:");
}

function paneIDForProjectWorkboard(detail = null) {
  return `project:workboard:${encodeURIComponent(projectDetailKey(detail))}`;
}

function isProjectWorkboardPaneID(paneID) {
  return String(paneID || "").startsWith("project:workboard:");
}

function paneIDForProjectNotebook(detail = null) {
  return `project:notebook:${encodeURIComponent(projectDetailKey(detail))}`;
}

function isProjectNotebookPaneID(paneID) {
  return String(paneID || "").startsWith("project:notebook:");
}

function openProjectDetails() {
  if (Array.isArray(state.projectDetails)) return state.projectDetails;
  return state.projectDetail ? [state.projectDetail] : [];
}

function setOpenProjectDetails(details) {
  const uniqueDetails = new Map();
  (details || []).filter(Boolean).forEach((detail) => {
    uniqueDetails.set(projectDetailKey(detail), detail);
  });
  state.projectDetails = Array.from(uniqueDetails.values());
  state.projectDetail = state.projectDetails[0] || null;
}

function defaultPaneWidthForID(paneID) {
  if (!paneID) return defaultReaderPaneWidth;
  if (isProjectWorkboardPaneID(paneID)) return defaultWorkboardPaneWidth;
  if (isProjectNotebookPaneID(paneID)) return defaultNotebookPaneWidth;
  if (isProjectDetailPaneID(paneID) || paneID.startsWith("section:detail:")) return defaultDetailPaneWidth;
  if (paneID === "utility:settings" || paneID === "utility:analysis" || paneID.startsWith("research:conversation:")) return defaultSettingsPaneWidth;
  if (paneID.startsWith("utility:")) return defaultUtilityPaneWidth;
  if (paneID.startsWith("reader:")) return defaultReaderPaneWidth;
  return defaultReaderPaneWidth;
}

function isFixedWidthPaneID(paneID) {
  return paneID?.startsWith("utility:") ||
    isProjectDetailPaneID(paneID) ||
    isProjectWorkboardPaneID(paneID) ||
    isProjectNotebookPaneID(paneID) ||
    paneID?.startsWith("section:detail:");
}

function isFixedWidthReaderPaneID(paneID) {
  if (!paneID?.startsWith("reader:")) return false;
  if (activePaneIDs().length >= 4) return true;
  const readerCount = (state.readers || []).length;
  if (readerCount > 3) return true;
  const hasSideColumns = activePaneIDs().some((id) => !id.startsWith("reader:"));
  return readerCount >= 2 && hasSideColumns;
}

function linkedReaderPaneIDForSearch(searchID) {
  const readerID = searchLinkedReadersBySearch()[searchID];
  return readerID ? `reader:${readerID}` : "";
}

function searchIDForLinkedReaderPane(paneID) {
  if (!paneID?.startsWith("reader:")) return "";
  const readerID = paneID.replace("reader:", "");
  return Object.entries(searchLinkedReadersBySearch()).find(([, linkedReaderID]) => linkedReaderID === readerID)?.[0] || "";
}

function sectionDetailsBySearch() {
  state.sectionDetails = state.sectionDetails && typeof state.sectionDetails === "object" ? state.sectionDetails : {};
  state.sectionDetailAnchors = state.sectionDetailAnchors && typeof state.sectionDetailAnchors === "object" ? state.sectionDetailAnchors : {};
  if (state.sectionDetail) {
    const firstSearch = (state.utilityInstances || []).find((instance) => instance.key === "search");
    if (firstSearch && !state.sectionDetails[firstSearch.id]) {
      state.sectionDetails[firstSearch.id] = state.sectionDetail;
    }
    state.sectionDetail = null;
  }
  const activeSearchIDs = new Set((state.utilityInstances || []).filter((instance) => instance.key === "search").map((instance) => instance.id));
  Object.keys(state.sectionDetails).forEach((searchID) => {
    if (!activeSearchIDs.has(searchID)) delete state.sectionDetails[searchID];
  });
  Object.keys(state.sectionDetailAnchors).forEach((searchID) => {
    if (!activeSearchIDs.has(searchID) || !state.sectionDetails[searchID]) delete state.sectionDetailAnchors[searchID];
  });
  return state.sectionDetails;
}

function sectionDetailAnchorsBySearch() {
  sectionDetailsBySearch();
  state.sectionDetailAnchors = state.sectionDetailAnchors && typeof state.sectionDetailAnchors === "object" ? state.sectionDetailAnchors : {};
  return state.sectionDetailAnchors;
}

function searchLinkedReadersBySearch() {
  state.searchLinkedReaders = state.searchLinkedReaders && typeof state.searchLinkedReaders === "object" ? state.searchLinkedReaders : {};
  const activeSearchIDs = new Set((state.utilityInstances || []).filter((instance) => instance.key === "search").map((instance) => instance.id));
  const activeReaderIDs = new Set((state.readers || []).map((reader) => reader.id));
  Object.keys(state.searchLinkedReaders).forEach((searchID) => {
    if (!activeSearchIDs.has(searchID) || !activeReaderIDs.has(state.searchLinkedReaders[searchID])) {
      delete state.searchLinkedReaders[searchID];
    }
  });
  return state.searchLinkedReaders;
}

function readerFieldsForSectionDetail(detail, overrides = {}) {
  return {
    codePrefix: detail.codePrefix || "BC",
    chapterID: detail.chapterID || "",
    sectionID: detail.sectionID,
    sectionNumber: detail.sectionNumber || "",
    title: detail.title || "Section",
    shouldSmoothScrollToSection: true,
    ...overrides
  };
}

function defaultActivePaneIDs() {
  if (detachedProjectWindow && detachedProject) {
    return [paneIDForProjectWorkboard(detachedProject)];
  }
  const ids = [];
  openProjectDetails().forEach((detail) => {
    ids.push(paneIDForProjectDetail(detail));
    if (projectHasOpenNotebook(detail)) ids.push(paneIDForProjectNotebook(detail));
    if (projectHasOpenWorkboard(detail)) ids.push(paneIDForProjectWorkboard(detail));
  });
  if (state.utilities.archive) ids.push("utility:archive");
  (state.utilityInstances || []).forEach((instance) => {
    ids.push(paneIDForUtilityInstance(instance));
    if (instance.key === "search" && sectionDetailsBySearch()[instance.id]) {
      ids.push(paneIDForSectionDetail(instance.id));
    }
  });
  if (state.utilities.analysis) ids.push("utility:analysis");
  if (state.utilities.analysis && state.researchConversationID) ids.push(paneIDForResearchConversation());
  if (state.utilities.settings) ids.push("utility:settings");
  state.readers.forEach((reader) => ids.push(paneIDForReader(reader)));
  return ids;
}

function activePaneIDs() {
  const ids = defaultActivePaneIDs();
  const active = new Set(ids);
  const ordered = (state.paneOrder || []).filter((id) => active.has(id));
  ids.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const paired = ordered.filter((id) =>
    !id.startsWith("section:detail:") &&
    !isProjectDetailPaneID(id) &&
    !isProjectNotebookPaneID(id) &&
    !isProjectWorkboardPaneID(id)
  );
  if (openProjectDetails().length) {
    const savedIndex = paired.indexOf(primarySavedPaneID());
    const detailIDs = openProjectDetails().flatMap((detail) => [
      paneIDForProjectDetail(detail),
      ...(projectHasOpenNotebook(detail) ? [paneIDForProjectNotebook(detail)] : []),
      ...(projectHasOpenWorkboard(detail) ? [paneIDForProjectWorkboard(detail)] : [])
    ]);
    if (savedIndex === -1) {
      paired.push(...detailIDs);
    } else {
      paired.splice(savedIndex + 1, 0, ...detailIDs);
    }
  }
  (state.utilityInstances || []).forEach((instance) => {
    if (instance.key !== "search" || !sectionDetailsBySearch()[instance.id]) return;
    const searchID = paneIDForUtilityInstance(instance);
    const detailID = paneIDForSectionDetail(instance.id);
    const anchorPaneID = sectionDetailAnchorsBySearch()[instance.id] || searchID;
    const anchorIndex = paired.indexOf(anchorPaneID);
    if (anchorIndex === -1) {
      paired.push(detailID);
    } else if (!paired.includes(detailID)) {
      paired.splice(anchorIndex + 1, 0, detailID);
    }
  });
  state.paneOrder = paired;
  return paired;
}

function orderPanes(panes) {
  const orderedIDs = activePaneIDs();
  const indexFor = (pane) => {
    const index = orderedIDs.indexOf(pane.dataset.paneId);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return panes.slice().sort((a, b) => indexFor(a) - indexFor(b));
}

function movePaneToFront(paneID) {
  if (!paneID) return;
  const active = new Set(defaultActivePaneIDs());
  state.paneOrder = [paneID, ...(state.paneOrder || []).filter((id) => id !== paneID && active.has(id))];
}

function appendPaneIfMissing(paneID) {
  if (!paneID) return;
  const active = new Set(defaultActivePaneIDs());
  const ordered = (state.paneOrder || []).filter((id) => active.has(id));
  active.forEach((id) => {
    if (!ordered.includes(id) && id !== paneID) ordered.push(id);
  });
  if (!ordered.includes(paneID)) ordered.push(paneID);
  state.paneOrder = ordered;
}

function placeSectionDetailAfterSearch(searchID) {
  const searchPaneID = paneIDForUtilityInstance({ key: "search", id: searchID });
  placeSectionDetailAfterPane(searchID, searchPaneID);
}

function placeSectionDetailAfterPane(searchID, anchorPaneID) {
  const detailID = paneIDForSectionDetail(searchID);
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== detailID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== detailID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const anchorIndex = ordered.indexOf(anchorPaneID);
  const insertIndex = anchorIndex === -1 ? 0 : anchorIndex + 1;
  ordered.splice(insertIndex, 0, detailID);
  state.paneOrder = ordered;
}

function placeLinkedReaderAfterSectionDetail(searchID, readerID) {
  const readerPaneID = `reader:${readerID}`;
  const detailID = paneIDForSectionDetail(searchID);
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== readerPaneID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== readerPaneID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const detailIndex = ordered.indexOf(detailID);
  const insertIndex = detailIndex === -1 ? ordered.length : detailIndex + 1;
  ordered.splice(insertIndex, 0, readerPaneID);
  state.paneOrder = ordered;
}

function placePaneAfter(anchorPaneID, paneID) {
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== paneID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== paneID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const anchorIndex = ordered.indexOf(anchorPaneID);
  ordered.splice(anchorIndex === -1 ? ordered.length : anchorIndex + 1, 0, paneID);
  state.paneOrder = ordered;
}

function placePaneBefore(anchorPaneID, paneID) {
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== paneID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== paneID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const anchorIndex = ordered.indexOf(anchorPaneID);
  ordered.splice(anchorIndex === -1 ? 0 : anchorIndex, 0, paneID);
  state.paneOrder = ordered;
}

function updateLinkedReaderForSearch(searchID, detail, overrides = {}) {
  const linkedReaders = searchLinkedReadersBySearch();
  const readerID = linkedReaders[searchID];
  const reader = (state.readers || []).find((item) => item.id === readerID);
  if (!reader) return null;
  Object.assign(reader, readerFieldsForSectionDetail(detail, overrides));
  placeLinkedReaderAfterSectionDetail(searchID, reader.id);
  return reader;
}

function openOrUpdateLinkedReaderForSearch(searchID, detail, overrides = {}) {
  const existing = updateLinkedReaderForSearch(searchID, detail, overrides);
  if (existing) return existing;
  const reader = newReaderState(readerFieldsForSectionDetail(detail, overrides));
  state.readers.push(reader);
  searchLinkedReadersBySearch()[searchID] = reader.id;
  placeLinkedReaderAfterSectionDetail(searchID, reader.id);
  return reader;
}

function searchResultDetail(result) {
  return {
    codePrefix: result.codePrefix || "BC",
    chapterID: result.chapterID || "",
    chapterNumber: result.chapterNumber || "",
    sectionID: result.id || result.sectionID,
    sectionNumber: result.sectionNumber || "",
    title: result.title || result.headingLine || "Section",
    headerLine: result.headerLine || "",
    headingLine: result.headingLine || ""
  };
}

function savedPaneIDs() {
  return (state.utilityInstances || [])
    .filter((instance) => instance.key === "saved")
    .map((instance) => paneIDForUtilityInstance(instance));
}

function primarySavedPaneID() {
  return savedPaneIDs()[0] || "";
}

function projectOverviewRefreshPaneIDs(...additionalPaneIDs) {
  return Array.from(new Set([...savedPaneIDs(), ...additionalPaneIDs.filter(Boolean)]));
}

async function refreshProjectMembershipPanes(project) {
  const identity = projectIdentity(project);
  await transitionWorkspace("utility", {
    refreshPaneIDs: projectOverviewRefreshPaneIDs(paneIDForProjectDetail(identity))
  });
}

function placeProjectDetailAfterProjects(detail, sourcePaneID = primarySavedPaneID()) {
  const detailID = paneIDForProjectDetail(detail);
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== detailID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== detailID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const projectIndex = ordered.indexOf(sourcePaneID);
  const openDetailIDs = openProjectDetails().map((item) => paneIDForProjectDetail(item)).filter((id) => id !== detailID);
  const lastDetailIndex = Math.max(...openDetailIDs.map((id) => ordered.indexOf(id)).filter((index) => index !== -1), -1);
  const insertIndex = lastDetailIndex !== -1 ? lastDetailIndex + 1 : projectIndex === -1 ? 0 : projectIndex + 1;
  ordered.splice(insertIndex, 0, detailID);
  state.paneOrder = ordered;
}

function placeArchiveAfterProjectsStack() {
  const archiveID = "utility:archive";
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== archiveID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== archiveID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const projectIndex = ordered.indexOf(primarySavedPaneID());
  const projectStackIDs = openProjectDetails().flatMap((detail) => [
    paneIDForProjectDetail(detail),
    ...(projectHasOpenNotebook(detail) ? [paneIDForProjectNotebook(detail)] : []),
    ...(projectHasOpenWorkboard(detail) ? [paneIDForProjectWorkboard(detail)] : [])
  ]);
  const detailIndex = Math.max(...projectStackIDs.map((id) => ordered.indexOf(id)).filter((index) => index !== -1), -1);
  const insertIndex = detailIndex === -1
    ? projectIndex === -1 ? 0 : projectIndex + 1
    : detailIndex + 1;
  ordered.splice(insertIndex, 0, archiveID);
  state.paneOrder = ordered;
}

function restoreProjectsStackOrder() {
  const projectID = "utility:projects";
  const detailIDs = openProjectDetails().flatMap((detail) => [
    paneIDForProjectDetail(detail),
    ...(projectHasOpenNotebook(detail) ? [paneIDForProjectNotebook(detail)] : []),
    ...(projectHasOpenWorkboard(detail) ? [paneIDForProjectWorkboard(detail)] : [])
  ]);
  const archiveID = "utility:archive";
  const activeIDs = defaultActivePaneIDs();
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && !detailIDs.includes(id) && id !== archiveID);
  if (!ordered.includes(projectID)) ordered.unshift(projectID);
  const projectIndex = ordered.indexOf(projectID);
  let insertIndex = projectIndex + 1;
  detailIDs.forEach((detailID) => {
    if (!activeIDs.includes(detailID)) return;
    ordered.splice(insertIndex, 0, detailID);
    insertIndex += 1;
  });
  if (state.utilities.archive && activeIDs.includes(archiveID)) {
    ordered.splice(insertIndex, 0, archiveID);
  }
  state.paneOrder = ordered;
}

async function openArchiveAfterProjectsStack() {
  state.utilities.archive = true;
  state.paneWeights["utility:archive"] = defaultPaneWidthForID("utility:archive");
  placeArchiveAfterProjectsStack();
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });
  scrollPaneIntoView("utility:archive");
}

async function toggleArchiveAfterProjectsStack() {
  if (state.utilities.archive) {
    await closeArchiveColumn();
    return;
  }
  await openArchiveAfterProjectsStack();
}

async function closeArchiveColumn() {
  state.utilities.archive = false;
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== "utility:archive");
  delete state.paneWeights["utility:archive"];
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });
}

function normalizePaneWeights(ids) {
  const current = state.paneWeights || {};
  const hasManyColumns = ids.length >= 4;
  state.paneWeights = ids.reduce((weights, id) => {
    const value = Number(current[id]);
    const defaultWidth = defaultPaneWidthForID(id);
    weights[id] = Number.isFinite(value) && value > 40
      ? (hasManyColumns ? Math.max(value, defaultWidth) : value)
      : defaultWidth;
    return weights;
  }, {});
}

function applyPaneWeight(panel, paneID) {
  panel.dataset.paneId = paneID;
  const defaultWidth = defaultPaneWidthForID(paneID);
  const value = Number(state.paneWeights[paneID]);
  const hasManyColumns = activePaneIDs().length >= 4;
  const width = Number.isFinite(value) && value > 40
    ? (hasManyColumns ? Math.max(value, defaultWidth) : value)
    : defaultWidth;
  panel.style.setProperty("--pane-resized-min-width", `${width}px`);
  panel.style.setProperty("--pane-default-min-width", hasManyColumns ? `${defaultWidth}px` : "0px");
  if (detachedProjectWindow && isProjectWorkboardPaneID(paneID)) {
    panel.style.flex = `1 1 ${width}px`;
    return;
  }
  if (isFixedWidthPaneID(paneID) || isFixedWidthReaderPaneID(paneID)) {
    panel.style.flex = `0 0 ${width}px`;
    return;
  }
  if (paneID?.startsWith("reader:")) {
    panel.style.flex = `${Math.max(1, width)} 1 0`;
    return;
  }
  panel.style.flex = `1 1 ${width}px`;
}

function setUtilityButtonStates() {
  const activeRepeatableKeys = new Set((state.utilityInstances || []).map((instance) => instance.key));
  toggleArchiveButton?.setAttribute("aria-pressed", String(state.utilities.archive));
  toggleSearchButton.setAttribute("aria-pressed", String(activeRepeatableKeys.has("search")));
  toggleSavedButton.setAttribute("aria-pressed", String(activeRepeatableKeys.has("saved")));
  toggleAnalysisButton.setAttribute("aria-pressed", String(state.utilities.analysis));
  toggleSettingsButton.setAttribute("aria-pressed", String(state.utilities.settings));
}

function codeOptionFor(prefix = "BC") {
  return codeOptions.find((option) => option.prefix === prefix) || codeOptions[0];
}

function codeDisplayLabel(prefix = "BC") {
  return codeOptionFor(prefix).label;
}

function searchCodeFilterOptions() {
  const dynamicPrefixes = new Set(chapters.map((chapter) => chapter.codePrefix).filter(Boolean));
  const options = [{ prefix: "ALL", label: "All Sections" }];
  codeOptions.forEach((option) => {
    if (dynamicPrefixes.size === 0 || dynamicPrefixes.has(option.prefix)) {
      options.push(option);
      dynamicPrefixes.delete(option.prefix);
    }
  });
  dynamicPrefixes.forEach((prefix) => {
    options.push({ prefix, label: prefix });
  });
  return options;
}

async function api(path) {
  let response;
  try {
    response = await fetch(path);
    serverReachable = true;
    updateConnectionStatus();
  } catch (networkError) {
    serverReachable = false;
    updateConnectionStatus();
    if (isProAccount()) {
      const payload = await offlineAPI(path).catch(() => null);
      if (payload) return payload;
    }
    throw networkError;
  }
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function fetchChapterList(codePrefix = "BC") {
  const cacheKey = codePrefix || "BC";
  if (!chapterListCache.has(cacheKey)) {
    chapterListCache.set(
      cacheKey,
      api(`/code/chapters?code=${encodeURIComponent(cacheKey)}`).then((payload) => payload.chapters || [])
    );
  }
  return chapterListCache.get(cacheKey);
}

async function firstChapterIDForCode(codePrefix = "BC") {
  const chapterList = await fetchChapterList(codePrefix || "BC");
  return chapterList[0]?.id || "";
}

async function fetchChapter(chapterID, options = {}) {
  const cacheKey = `${chapterID}:${options.includeBody ? "body" : "summary"}`;
  const bodyCacheKey = `${chapterID}:body`;
  if (!options.includeBody && chapterCache.has(bodyCacheKey)) {
    return chapterCache.get(bodyCacheKey);
  }
  if (!chapterCache.has(cacheKey)) {
    const suffix = options.includeBody ? "?include=body" : "";
    chapterCache.set(cacheKey, api(`/code/chapters/${chapterID}${suffix}`).then((payload) => payload.chapter));
  }
  return chapterCache.get(cacheKey);
}

async function postJSON(path, body, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    serverReachable = true;
  } catch (error) {
    serverReachable = false;
    updateConnectionStatus();
    throw error;
  }
  updateConnectionStatus();
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function textNode(value) {
  return document.createTextNode(value ?? "");
}

function clear(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function openWebWarning({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", cancellable = true }) {
  activeWebWarningClose?.(false);
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const titleID = `web-warning-title-${crypto.randomUUID()}`;
  const messageID = `web-warning-message-${crypto.randomUUID()}`;
  const backdrop = document.createElement("div");
  backdrop.className = "web-warning-backdrop";
  const dialog = document.createElement("section");
  dialog.className = "web-warning-dialog";
  dialog.tabIndex = -1;
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleID);
  dialog.setAttribute("aria-describedby", messageID);
  const heading = document.createElement("h2");
  heading.className = "web-warning-title";
  heading.id = titleID;
  heading.textContent = title;
  const body = document.createElement("p");
  body.className = "web-warning-message";
  body.id = messageID;
  body.textContent = message;
  const actions = document.createElement("div");
  actions.className = "web-warning-actions";
  let cancelButton = null;
  if (cancellable) {
    cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "web-warning-button web-warning-cancel";
    cancelButton.textContent = cancelLabel;
    actions.append(cancelButton);
  }
  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "web-warning-button web-warning-confirm";
  confirmButton.textContent = confirmLabel;
  actions.append(confirmButton);
  dialog.append(heading, body, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);

  return new Promise((resolve) => {
    let settled = false;
    const close = (confirmed) => {
      if (settled) return;
      settled = true;
      backdrop.remove();
      if (activeWebWarningClose === close) activeWebWarningClose = null;
      previousFocus?.focus?.({ preventScroll: true });
      resolve(confirmed);
    };
    activeWebWarningClose = close;
    cancelButton?.addEventListener("click", () => close(false));
    confirmButton.addEventListener("click", () => close(true));
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (cancellable) close(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = cancelButton ? [cancelButton, confirmButton] : [confirmButton];
      const activeIndex = focusable.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
        : (activeIndex + 1) % focusable.length;
      event.preventDefault();
      focusable[nextIndex].focus();
    });
    dialog.focus({ preventScroll: true });
  });
}

function confirmWebWarning(title, message, options = {}) {
  return openWebWarning({ title, message, ...options, cancellable: true });
}

function showWebNotice(title, message, options = {}) {
  return openWebWarning({ title, message, ...options, confirmLabel: options.confirmLabel || "OK", cancellable: false });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionDisplayTitle(sectionNumber, title, fallback = "Section") {
  const number = String(sectionNumber || "").trim();
  const cleanTitle = String(title || "").trim();
  if (!number) {
    return cleanTitle || fallback;
  }
  if (cleanTitle) {
    if (/^appendix\b/i.test(cleanTitle) || /^section\b/i.test(cleanTitle)) {
      return cleanTitle;
    }
    const duplicatePattern = new RegExp(`^${escapeRegExp(number)}(?:\\b|[\\s.:;-]+)`, "i");
    if (duplicatePattern.test(cleanTitle)) {
      return cleanTitle;
    }
  }
  return `${number} ${cleanTitle || fallback}`.trim();
}

function setTitle(panel, reader) {
  const title = panel.querySelector(".panel-title");
  if (reader.sectionNumber) {
    title.textContent = sectionDisplayTitle(reader.sectionNumber, reader.title, "Reader");
    return;
  }
  title.textContent = reader.title || "Reader";
}

function appendHighlighted(container, text, query) {
  const value = text || "";
  const needle = (query || "").trim();
  if (!needle) {
    container.append(textNode(value));
    return;
  }
  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let cursor = 0;
  while (cursor < value.length) {
    const matchIndex = lowerValue.indexOf(lowerNeedle, cursor);
    if (matchIndex === -1) {
      container.append(textNode(value.slice(cursor)));
      break;
    }
    if (matchIndex > cursor) {
      container.append(textNode(value.slice(cursor, matchIndex)));
    }
    const mark = document.createElement("mark");
    mark.textContent = value.slice(matchIndex, matchIndex + needle.length);
    container.append(mark);
    cursor = matchIndex + needle.length;
  }
}

function shouldSkipSearchHighlightNode(node) {
  const parent = node?.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest("button, input, textarea, select, mark, .inline-comment"));
}

function scrollReaderContentToNode(content, target, behavior = "auto") {
  if (!content || !target) return;
  const contentRect = content.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const panel = content.closest(".reader-panel");
  const anchorRect = panel?.getBoundingClientRect() || contentRect;
  const headerOffset = panel ? Number.parseFloat(getComputedStyle(panel, "::before").height) : 0;
  const offset = Number.isFinite(headerOffset) ? headerOffset : 0;
  const targetTop = content.scrollTop + targetRect.top - anchorRect.top - offset;
  content.scrollTo({
    top: Math.max(0, targetTop),
    behavior
  });
}

function readerSectionTitleNode(section) {
  return section?.querySelector(".reader-section-title") || section;
}

function stabilizeReaderSectionAtHeader(content, section, behavior = "auto") {
  const title = readerSectionTitleNode(section);
  if (!content || !title) return;
  (content.__sectionAlignmentTimers || []).forEach((timer) => window.clearTimeout(timer));
  scrollReaderContentToNode(content, title, behavior);
  const delays = behavior === "smooth" ? [380, 620] : [0, 80, 220];
  content.__sectionAlignmentTimers = delays.map((delay) => window.setTimeout(() => {
    if (content.isConnected && title.isConnected) scrollReaderContentToNode(content, title, "auto");
  }, delay));
}

function flashSearchMatchInSection(content, sectionID, sectionNumber, query) {
  const needle = String(query || "").trim();
  if (!content || needle.length < 2) return;
  const idSelector = sectionID ? `[data-section-id="${CSS.escape(String(sectionID))}"]` : "";
  const numberSelector = sectionNumber ? `[data-section-number="${CSS.escape(String(sectionNumber))}"]` : "";
  const section = (idSelector ? content.querySelector(idSelector) : null) ||
    (numberSelector ? content.querySelector(numberSelector) : null);
  if (!section) return;

  const lowerNeedle = needle.toLowerCase();
  const walker = document.createTreeWalker(section, window.NodeFilter?.SHOW_TEXT || 4);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || "";
    const index = value.toLowerCase().indexOf(lowerNeedle);
    if (index >= 0 && !shouldSkipSearchHighlightNode(node)) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const mark = document.createElement("mark");
      mark.className = "reader-search-match reader-search-flash";
      mark.dataset.flashCreatedAt = String(Date.now());
      range.surroundContents(mark);

      window.setTimeout(() => {
        mark.replaceWith(textNode(mark.textContent || ""));
        section.normalize();
      }, readerSearchFlashDurationMS);
      return;
    }
    node = walker.nextNode();
  }
}

function stripLeadingSectionNumber(value, sectionNumber) {
  let text = String(value || "").trim();
  const number = String(sectionNumber || "").trim();
  if (!text || !number) return text;
  const numberPattern = new RegExp(`^(?:\\.\\.\\.\\s*)?(?:§\\s*)?${escapeRegExp(number)}(?:\\b|[\\s.:;-]+)`, "i");
  return text.replace(numberPattern, (match) => match.startsWith("...") ? "..." : "").trim();
}

function snippetWithoutDuplicateTitle(result) {
  let snippet = String(result?.snippet || "").trim();
  if (!snippet) return "";
  snippet = stripLeadingSectionNumber(snippet, result?.sectionNumber);
  const title = String(result?.title || result?.headingLine || "").trim();
  const displayedTitle = sectionDisplayTitle(result?.sectionNumber, title, "").trim();
  [displayedTitle, title].filter(Boolean).forEach((candidate) => {
    const pattern = new RegExp(`^(?:\\.\\.\\.\\s*)?${escapeRegExp(candidate)}(?:\\s+|$)`, "i");
    snippet = snippet.replace(pattern, (match) => match.startsWith("...") ? "..." : "").trim();
  });
  return snippet;
}

function searchResultMatchesExactQuery(result, query) {
  const needle = String(query || "").trim().replace(/\s+/g, " ");
  if (!needle) return false;
  const searchableText = [result?.sectionNumber, result?.title, result?.headingLine, result?.snippet]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
  const escapedNeedle = needle.split(" ").map(escapeRegExp).join("\\s+");
  const startsWithWord = /^[\p{L}\p{N}_]/u.test(needle);
  const endsWithWord = /[\p{L}\p{N}_]$/u.test(needle);
  return new RegExp(`${startsWithWord ? "(?<![\\p{L}\\p{N}_])" : ""}${escapedNeedle}${endsWithWord ? "(?![\\p{L}\\p{N}_])" : ""}`, "iu")
    .test(searchableText);
}

function emptyReader(content, title = "Choose a chapter", message = "Pick a chapter to load the full text. Section is optional and only jumps within the chapter.") {
  clear(content);
  const wrapper = document.createElement("section");
  wrapper.className = "reader-empty";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  wrapper.append(heading, paragraph);
  content.append(wrapper);
}

function blankReader(content) {
  clear(content);
  const wrapper = document.createElement("section");
  wrapper.className = "reader-empty reader-empty-blank";
  wrapper.setAttribute("aria-hidden", "true");
  content.append(wrapper);
}

function sectionTitleFromID(sectionID, chapter) {
  return chapter?.sections?.find((section) => String(section.id) === String(sectionID)) || null;
}

function sectionPlainText(section) {
  return (section?.blocks || [])
    .map((block) => block.plainText || block.text || "")
    .filter(Boolean)
    .join("\n\n")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function sectionTitleWithoutNumber(section) {
  const number = String(section?.sectionNumber || "").trim();
  const title = String(section?.title || "").trim();
  if (!number || !title) return title;
  return title.replace(new RegExp(`^${escapeRegExp(number)}(?:\\b|[\\s.:;-]+)`, "i"), "").trim() || title;
}

function codeLabel(prefix) {
  return codeOptions.find((option) => option.prefix === prefix)?.label || "Building Code";
}

function codeTheme(prefix) {
  return codeOptions.find((option) => option.prefix === prefix)?.theme || "building";
}

function resizeCodeSelect(codeSelect) {
  if (!codeSelect) return;
  const label = codeSelect.options[codeSelect.selectedIndex]?.textContent || codeLabel(codeSelect.value);
  const styles = window.getComputedStyle(codeSelect);
  const canvas = resizeCodeSelect.canvas || document.createElement("canvas");
  const context = canvas.getContext("2d");
  resizeCodeSelect.canvas = canvas;
  context.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  const letterSpacing = Number.parseFloat(styles.letterSpacing) || 0;
  const textWidth = context.measureText(label.toUpperCase()).width;
  const spacedWidth = textWidth + Math.max(label.length - 1, 0) * letterSpacing;
  codeSelect.style.setProperty("--code-select-width", `${Math.ceil(spacedWidth + 52)}px`);
}

function applyCodeTheme(panel, reader) {
  panel.classList.remove(...codeThemeClasses);
  panel.classList.add(`code-theme-${codeTheme(reader.codePrefix || "BC")}`);
}

function populateCodeSelect(panel, reader) {
  const codeSelect = panel.querySelector(".code-select");
  if (!codeSelect) return;
  clear(codeSelect);
  reader.codePrefix = reader.codePrefix || "BC";
  codeOptions.forEach((code) => {
    const option = document.createElement("option");
    option.value = code.prefix;
    option.textContent = code.label;
    codeSelect.append(option);
  });
  codeSelect.value = reader.codePrefix;
  codeSelect.setAttribute("aria-label", "Code section");
  codeSelect.title = codeLabel(reader.codePrefix);
  resizeCodeSelect(codeSelect);
}

function closeActiveCustomSelect() {
  if (!activeCustomSelect) return;
  activeCustomSelect.menu.hidden = true;
  activeCustomSelect.trigger.setAttribute("aria-expanded", "false");
  activeCustomSelect = null;
}

function repositionActiveCustomSelect() {
  activeCustomSelect?.positionMenu();
}

function enhanceSelect(select) {
  if (!select || select.dataset.customized === "true") return;
  select.dataset.customized = "true";
  select.classList.add("native-select-hidden");

  const custom = document.createElement("div");
  custom.className = "custom-select";
  const trigger = document.createElement("button");
  trigger.className = "custom-select-trigger";
  trigger.type = "button";
  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.dataset.floatingSelect = "true";
  menu.hidden = true;
  select._customSelectMenu = menu;

  const syncTrigger = () => {
    trigger.textContent = select.options[select.selectedIndex]?.textContent || "";
  };

  const closeMenu = () => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (activeCustomSelect?.menu === menu) activeCustomSelect = null;
  };

  const renderOptions = () => {
    clear(menu);
    Array.from(select.options).forEach((option) => {
      const item = document.createElement("button");
      item.className = "custom-select-option";
      item.type = "button";
      item.textContent = option.textContent;
      item.dataset.value = option.value;
      item.setAttribute("aria-selected", String(option.selected));
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncTrigger();
        closeMenu();
      });
      menu.append(item);
    });
  };

  const positionMenu = () => {
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const panelRect = trigger.closest(".workspace-panel")?.getBoundingClientRect();
    const boundaryLeft = Math.max(viewportPadding, panelRect?.left ?? viewportPadding);
    const boundaryRight = Math.min(window.innerWidth - viewportPadding, panelRect?.right ?? window.innerWidth - viewportPadding);
    const boundaryWidth = Math.max(rect.width, boundaryRight - boundaryLeft);
    const optionWidths = Array.from(menu.children).map((item) => item.scrollWidth);
    const naturalWidth = Math.max(rect.width, ...optionWidths);
    const menuWidth = Math.min(naturalWidth, boundaryWidth);
    const left = Math.max(boundaryLeft, Math.min(rect.left, boundaryRight - menuWidth));
    const availableBelow = Math.max(160, window.innerHeight - rect.bottom - viewportPadding);
    menu.style.setProperty("--select-menu-top", `${rect.bottom + 2}px`);
    menu.style.setProperty("--select-menu-left", `${left}px`);
    menu.style.setProperty("--select-menu-width", `${menuWidth}px`);
    menu.style.setProperty("--select-menu-max-height", `${availableBelow}px`);
  };

  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeActiveCustomSelect();
    renderOptions();
    if (willOpen) {
      activeCustomSelect = { custom, menu, trigger, positionMenu };
    }
    menu.hidden = !willOpen;
    if (willOpen) positionMenu();
    trigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) requestAnimationFrame(positionMenu);
  });

  select.addEventListener("change", () => {
    syncTrigger();
    renderOptions();
  });

  syncTrigger();
  renderOptions();
  custom.append(trigger);
  select.insertAdjacentElement("afterend", custom);
  document.body.append(menu);
}

function enhanceReaderSelects() {
  track.querySelectorAll(".reader-panel select").forEach(enhanceSelect);
}

function resetEnhancedSelects(scope) {
  scope.querySelectorAll("select.native-select-hidden").forEach((select) => {
    select._customSelectMenu?.remove();
    delete select._customSelectMenu;
    if (select.nextElementSibling?.classList.contains("custom-select")) {
      select.nextElementSibling.remove();
    }
    select.classList.remove("native-select-hidden");
    delete select.dataset.customized;
  });
}

function activeAccount() {
  const userID = state.account?.userID?.trim();
  const sessionToken = state.account?.sessionToken?.trim();
  return userID && sessionToken ? { userID, sessionToken } : null;
}

function updateConnectionStatus() {
  if (!connectionStatus) return;
  const account = activeAccount();
  const pending = account
    ? (state.syncOutbox || []).filter((item) => item.accountUserID === account.userID).length
    : 0;
  const conflicts = account
    ? (state.syncConflicts || []).filter((item) => item.accountUserID === account.userID).length
    : 0;
  const offline = navigator.onLine === false || !serverReachable;
  connectionStatus.classList.toggle("is-offline", offline);
  connectionStatus.classList.toggle("has-pending", pending > 0 || conflicts > 0);
  connectionStatus.hidden = false;
  connectionStatus.textContent = offline
    ? pending > 0 ? `Offline · ${pending} pending` : "Offline"
    : conflicts > 0 ? "Review sync"
      : syncFlushPromise ? "Syncing"
        : pending > 0 ? `${pending} pending`
          : account ? "Synced" : "Online";
}

function isSessionAuthenticationError(error) {
  return Number(error?.status) === 401;
}

function clearExpiredAccountSession() {
  if (!activeAccount()) return;
  state.account = null;
  persistAccountSession(null);
  syncedContent = { status: "disconnected", mutations: [], summary: summarizeMutations([]) };
  clearTimeout(syncRetryTimer);
  syncRetryTimer = null;
  stopForegroundSyncLoop();
  saveWorkspaceState();
  void disableOfflineFeature().catch(() => {});
}

function currentEntitlement() {
  return state.account?.entitlement || syncedContent?.entitlement || null;
}

function currentPlan() {
  const entitlement = currentEntitlement();
  if (entitlement?.plan !== "pro") return "free";
  const expiration = Date.parse(entitlement.expiresAt || "");
  return Number.isFinite(expiration) && expiration <= Date.now() ? "free" : "pro";
}

function isProAccount() {
  return currentPlan() === "pro";
}

const webFreePlanLimits = Object.freeze({ savedItems: 25, notes: 10 });
let planLimitNoticePromise = null;

function webFreePlanUsage() {
  const summary = currentContentSummary();
  const noteTargets = new Set(
    (summary.annotations || [])
      .filter((annotation) => !annotation.deletedAt && String(annotation.noteBody || "").trim())
      .map((annotation) => [
        annotation.codeVersion || defaultSyncCodeVersion,
        annotation.sectionID || "",
        normalizeAnnotationBlockID(annotation.blockID)
      ].join(":"))
  );
  return {
    savedItems: (summary.savedItems || []).filter((item) => !item.deletedAt).length,
    notes: noteTargets.size
  };
}

function presentPlanLimitNotice(title, message) {
  if (planLimitNoticePromise) return planLimitNoticePromise;
  planLimitNoticePromise = (async () => {
    await showWebNotice(title, message, { confirmLabel: "View Plans" });
    await focusUtility("settings");
  })().finally(() => {
    planLimitNoticePromise = null;
  });
  return planLimitNoticePromise;
}

function entitlementSourceLabel(entitlement = currentEntitlement()) {
  if (!entitlement) return "Free";
  if (entitlement.source === "webSubscription") return "Web subscription";
  if (entitlement.source === "appleSubscription") return "Apple subscription";
  if (entitlement.source === "lifetimeGrant") return "Lifetime Pro";
  return entitlement.source || "Pro";
}

function storeAccountEntitlement(entitlement) {
  if (!state.account) return;
  state.account = { ...state.account, entitlement: entitlement || null };
  persistAccountSession();
  saveWorkspaceState();
  void reconcileOfflineFeatureAccess(isProAccount()).catch(() => {});
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function refreshEntitlementAfterCheckoutReturn() {
  const searchParams = new URLSearchParams(window.location.search);
  const account = activeAccount();
  if (searchParams.get("checkout") !== "success" || !account) return;
  const sessionID = searchParams.get("session_id");
  if (sessionID && !isProAccount()) {
    try {
      const payload = await postJSON("/billing/stripe/restore", {
        auth: { accountUserID: account.userID },
        checkoutSessionID: sessionID
      }, { token: account.sessionToken });
      storeAccountEntitlement(payload.entitlement || null);
    } catch {
      // Fall through to webhook polling; Stripe may still deliver the entitlement.
    }
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await loadSyncedContent({ force: true });
    if (isProAccount()) {
      clearCheckoutReturnURL();
      await renderWorkspace();
      return;
    }
    await delay(1500);
  }
  await renderWorkspace();
}

function clearCheckoutReturnURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");
  url.searchParams.delete("appleSignIn");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next || "/");
}

function browserCredentialID() {
  const existing = typeof state.browserCredentialID === "string" ? state.browserCredentialID.trim() : "";
  if (existing) return existing;
  state.browserCredentialID = crypto.randomUUID();
  saveWorkspaceState();
  return state.browserCredentialID;
}

async function repairAppleBrowserAccountLink(account, entitlement) {
  const browserID = typeof state.browserCredentialID === "string" ? state.browserCredentialID.trim() : "";
  if (!account || account.authProvider !== "apple" || entitlement || !browserID) {
    return null;
  }
  const payload = await postJSON("/account/link-browser", {
    auth: { accountUserID: account.userID },
    browserCredentialID: browserID
  }, { token: account.sessionToken });
  if (payload.account || payload.entitlement) {
    storeAccountEntitlement(payload.entitlement || null);
  }
  return payload;
}

function decodeJWTPart(value) {
  try {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function appleDisplayName(user = {}) {
  const name = user.name || {};
  const parts = [name.firstName, name.lastName].map((part) => String(part || "").trim()).filter(Boolean);
  return parts.join(" ");
}

async function appleWebSignInConfig() {
  if (!appleWebConfigPromise) {
    appleWebConfigPromise = api("/account/apple-web-config").catch((error) => {
      appleWebConfigPromise = null;
      throw error;
    });
  }
  return appleWebConfigPromise;
}

function loadAppleIDScript() {
  if (window.AppleID?.auth) return Promise.resolve();
  if (appleIDScriptPromise) return appleIDScriptPromise;
  appleIDScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      appleIDScriptPromise = null;
      reject(new Error("Could not load Sign in with Apple."));
    };
    document.head.append(script);
  });
  return appleIDScriptPromise;
}

function accountDisplayName(account = state.account) {
  return account?.displayName || account?.userID || "this browser";
}

function retargetQueuedMutation(mutation, sourceUserID, targetUserID) {
  const kind = mutation && typeof mutation === "object" ? Object.keys(mutation)[0] : null;
  const record = kind ? mutation[kind] : null;
  if (!kind || !record || typeof record !== "object") return mutation;
  const sourcePrefix = `${sourceUserID}:`;
  const recordID = typeof record.id === "string" && record.id.startsWith(sourcePrefix)
    ? `${targetUserID}:${record.id.slice(sourcePrefix.length)}`
    : record.id;
  return { [kind]: { ...record, id: recordID, userID: targetUserID } };
}

function retargetSyncOutbox(sourceUserID, targetUserID) {
  if (!sourceUserID || sourceUserID === targetUserID) return;
  state.syncOutbox = (state.syncOutbox || []).map((item) => {
    if (item.accountUserID !== sourceUserID) return item;
    const mutation = retargetQueuedMutation(item.mutation, sourceUserID, targetUserID);
    const recordID = syncMutationRecordID(mutation);
    return {
      ...item,
      id: `${targetUserID}:${recordID}`,
      accountUserID: targetUserID,
      recordID,
      mutation,
      queuedAt: new Date().toISOString(),
      attemptCount: 0,
      lastError: null
    };
  });
}

function storeSignedInAccount(payload, fallbackDisplayName = "Web browser") {
  const account = payload.account;
  if (!account?.appUserID || !account?.backendSessionToken) {
    throw new Error("Sign in did not return a backend session.");
  }
  const previousUserID = state.account?.userID;
  if (payload.mergedAccount?.sourceUserID === previousUserID) {
    retargetSyncOutbox(previousUserID, account.appUserID);
  }
  state.account = {
    userID: account.appUserID,
    sessionToken: account.backendSessionToken,
    authProvider: account.authProvider || "web",
    displayName: account.displayName || fallbackDisplayName,
    publicUsername: account.publicUsername || null,
    entitlement: payload.entitlement || null
  };
  persistAccountSession();
  syncedContent = null;
  saveWorkspaceState();
  void reconcileOfflineFeatureAccess(isProAccount()).catch(() => {});
  loadSyncedContent({ force: true })
    .then(() => flushSyncOutbox({ refresh: true }))
    .then(() => renderWorkspace())
    .catch(() => renderWorkspace());
  return state.account;
}

async function signInWithAppleWeb(config) {
  const existingAccount = activeAccount();
  const linkFrom = existingAccount && state.account?.authProvider === "web"
    ? { accountUserID: existingAccount.userID, sessionToken: existingAccount.sessionToken }
    : undefined;
  const payload = await postJSON("/account/apple/start", {
    linkFrom,
    successURL: `${window.location.pathname}${window.location.search}`
  }, { token: existingAccount?.sessionToken });
  if (!payload.authorizationURL) {
    throw new Error("Apple sign-in did not return an authorization URL.");
  }
  window.location.href = payload.authorizationURL;
  return new Promise(() => {});
}

async function signInWithBrowserFallback() {
  const payload = await postJSON("/account/sign-in", {
    credential: {
      provider: "web",
      providerUserID: browserCredentialID(),
      displayName: "Web browser",
      signedInAt: new Date().toISOString()
    }
  });
  return storeSignedInAccount(payload, "Web browser");
}

async function signInCurrentBrowser() {
  const config = await appleWebSignInConfig();
  if (config.available) {
    return signInWithAppleWeb(config);
  }
  if (config.browserFallbackAllowed) {
    return signInWithBrowserFallback();
  }
  throw new Error("Apple web sign-in is not configured yet.");
}

function mutationKindAndRecord(mutation) {
  const [kind, record] = Object.entries(mutation || {})[0] || [];
  return { kind, record };
}

function mutationUpdatedAt(mutation) {
  const record = Object.values(mutation || {})[0] || {};
  const timestamp = Date.parse(record.updatedAt || 0);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function currentBulkClearRecords() {
  return [
    ...(syncedContent?.summary?.codeVersionClears || []),
    ...(state.localBulkClears || []),
    ...(state.syncConflicts || [])
      .map((entry) => mutationKindAndRecord(entry.mutation))
      .filter(({ kind }) => kind === "codeVersionClear")
      .map(({ record }) => record),
    ...(state.syncOutbox || [])
      .map((entry) => mutationKindAndRecord(entry.mutation))
      .filter(({ kind }) => kind === "codeVersionClear")
      .map(({ record }) => record)
  ].filter((record) => Boolean(bulkClearKey(record)));
}

function absorbBulkClearConflicts() {
  let changed = false;
  const latestLocalClears = new Map((state.localBulkClears || [])
    .map((record) => [bulkClearKey(record), record])
    .filter(([key]) => Boolean(key)));
  state.syncConflicts = (state.syncConflicts || []).filter((entry) => {
    const { kind, record } = mutationKindAndRecord(entry.mutation);
    if (kind !== "codeVersionClear") {
      return true;
    }
    const key = bulkClearKey(record);
    const existing = key ? latestLocalClears.get(key) : null;
    if (key && (!existing || Date.parse(record.updatedAt || 0) >= Date.parse(existing.updatedAt || 0))) {
      latestLocalClears.set(key, record);
    }
    changed = true;
    return false;
  });
  if (changed) state.localBulkClears = Array.from(latestLocalClears.values());
  return changed;
}

function summarizeMutations(mutations = []) {
  const sorted = [...mutations].sort((left, right) => mutationUpdatedAt(right) - mutationUpdatedAt(left));
  const latestByID = new Map();
  sorted.forEach((mutation) => {
    const id = syncMutationRecordID(mutation);
    if (id && !latestByID.has(id)) latestByID.set(id, mutation);
  });
  const projects = [];
  const savedItems = [];
  const annotations = [];
  const projectSections = [];
  const workboards = [];
  const codeVersionClears = new Map();
  let latestContinuity = null;

  latestByID.forEach((mutation) => {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (kind !== "codeVersionClear" || !record) return;
    const key = bulkClearKey(record);
    const existing = key ? codeVersionClears.get(key) : null;
    if (key && (!existing || Date.parse(record.updatedAt || 0) >= Date.parse(existing.updatedAt || 0))) {
      codeVersionClears.set(key, record);
    }
  });

  latestByID.forEach((mutation) => {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (!record || record.deletedAt) return;
    if (kind === "project" && recordSurvivesBulkClear(record, codeVersionClears, ["folders"])) projects.push(record);
    if (kind === "savedItem" && recordSurvivesBulkClear(record, codeVersionClears, ["bookmarks"])) savedItems.push(record);
    if (kind === "annotation") {
      const visibleAnnotation = annotationAfterBulkClears(record, codeVersionClears);
      if (visibleAnnotation) annotations.push(visibleAnnotation);
    }
    if (kind === "projectSection" && recordSurvivesBulkClear(record, codeVersionClears, ["bookmarks", "folders"])) projectSections.push(record);
    if (kind === "workboard") workboards.push(record);
    if (
      kind === "continuity" &&
      (!latestContinuity || mutationUpdatedAt(mutation) > Date.parse(latestContinuity.updatedAt || 0))
    ) {
      latestContinuity = record;
    }
  });

  return {
    projects,
    savedItems,
    annotations,
    projectSections,
    workboards,
    latestContinuity,
    codeVersionClears: Array.from(codeVersionClears.values())
  };
}

function currentContentSummary() {
  const summary = syncedContent?.summary || summarizeMutations([]);
  const clearRecords = currentBulkClearRecords();
  // Always apply every durable clear to the cached remote summary. Incremental
  // pulls can refresh one clear scope without rebuilding the other scopes, so
  // trusting the cached summary here could resurrect records cleared moments
  // earlier by this browser or another device.
  const summarySavedItems = (summary.savedItems || [])
    .filter((item) => recordSurvivesBulkClear(item, clearRecords, ["bookmarks"]));
  const summaryAnnotations = (summary.annotations || [])
    .map((item) => annotationAfterBulkClears(item, clearRecords))
    .filter(Boolean);
  const localProjectSavedItems = (state.localProjectSections || [])
    .filter((item) => item && item.sectionID && !item.deletedAt &&
      recordSurvivesBulkClear(item, clearRecords, ["bookmarks", "folders"]))
    .map((item) => ({
      id: `web-saved-${item.sectionID}`,
      userID: item.userID || "local-web",
      codeVersion: syncCodeVersion(item.codeVersion),
      codePrefix: item.codePrefix || "BC",
      chapterID: item.chapterID || "",
      chapterNumber: item.chapterNumber || "",
      sectionID: Number(item.sectionID),
      sectionNumber: item.sectionNumber || "",
      title: item.title || "Section",
      updatedAt: item.updatedAt || new Date().toISOString()
    }));
  const localSavedItems = [...(state.localSavedItems || []), ...localProjectSavedItems]
    .filter((item) => recordSurvivesBulkClear(item, clearRecords, ["bookmarks"]));
  const savedItemsBySection = new Map(
    summarySavedItems.map((item) => [String(item.sectionID || ""), item])
  );
  localSavedItems.forEach((item) => {
    if (item?.sectionID) mergeNewestRecord(savedItemsBySection, String(item.sectionID), item);
  });
  const annotationsByID = new Map(
    summaryAnnotations.map((item) => [String(item.id || ""), item])
  );
  (state.localAnnotations || []).forEach((item) => {
    const visibleAnnotation = annotationAfterBulkClears(item, clearRecords);
    if (visibleAnnotation?.id) {
      mergeNewestRecord(annotationsByID, String(visibleAnnotation.id), visibleAnnotation);
    }
  });
  const projectSectionIdentity = (item) => [
    item.folderClientID || item.projectID || item.localFolderID || "project",
    item.sectionID || item.savedSectionID || item.itemID || item.id || "section"
  ].map(String).join(":");
  const projectSectionsByID = new Map(
    (summary.projectSections || [])
      .filter((item) => recordSurvivesBulkClear(item, clearRecords, ["bookmarks", "folders"]))
      .map((item) => [projectSectionIdentity(item), item])
  );
  (state.localProjectSections || []).forEach((item) => {
    if (item && recordSurvivesBulkClear(item, clearRecords, ["bookmarks", "folders"])) {
      mergeNewestRecord(projectSectionsByID, projectSectionIdentity(item), item);
    }
  });
  return {
    ...summary,
    savedItems: Array.from(savedItemsBySection.values()).filter((item) => !item.deletedAt),
    annotations: Array.from(annotationsByID.values()).filter((item) => !item.deletedAt),
    projectSections: Array.from(projectSectionsByID.values()).filter((item) => !item.deletedAt)
  };
}

async function loadSyncedContent(options = {}) {
  const account = activeAccount();
  if (!account) {
    syncedContent = { status: "disconnected", mutations: [], summary: summarizeMutations([]) };
    return syncedContent;
  }
  if (syncLoadPromise && !options.force) {
    return syncLoadPromise;
  }
  const baseline = ["connected", "offline"].includes(syncedContent?.status) && syncedContent?.userID === account.userID
    ? syncedContent
    : null;
  const requestedEventID = Number.isSafeInteger(baseline?.latestEventID) ? baseline.latestEventID : null;
  syncLoadPromise = postJSON("/sync/pull", {
    auth: { accountUserID: account.userID },
    sinceEventID: requestedEventID,
    contentMapVersion: Number(baseline?.contentMapVersion || 2),
    syncSchemaVersion: permitextSyncSchemaVersion,
    clientCapabilities: permitextClientCapabilities
  }, { token: account.sessionToken })
    .then(async (payload) => {
      let entitlement = payload.entitlement || null;
      const repaired = await repairAppleBrowserAccountLink(account, entitlement);
      if (repaired?.entitlement) {
        entitlement = repaired.entitlement;
      }
      const contentMapVersion = Number(payload.contentMapVersion || 0);
      const canMergeIncrementally = baseline && requestedEventID !== null &&
        contentMapVersion === Number(baseline.contentMapVersion || 0);
      const mutations = canMergeIncrementally
        ? mergeSyncedMutations(baseline.mutations || [], payload.mutations || [])
        : payload.mutations || [];
      syncedContent = {
        status: "connected",
        userID: account.userID,
        pulledAt: payload.pulledAt,
        latestEventID: payload.latestEventID ?? payload.syncRevision ?? requestedEventID,
        contentMapVersion,
        syncSchemaVersion: Number(payload.syncSchemaVersion || permitextSyncSchemaVersion),
        capabilityContract: payload.capabilityContract || null,
        entitlement,
        mutations,
        summary: summarizeMutations(mutations)
      };
      await applyRemoteContinuityIfNewer();
      await saveOfflineSyncSnapshot(account.userID, syncedContent).catch(() => {});
      storeAccountEntitlement(entitlement);
      return syncedContent;
    })
    .catch(async (error) => {
      if (isSessionAuthenticationError(error)) {
        clearExpiredAccountSession();
        return syncedContent;
      }
      const snapshot = baseline || await loadOfflineSyncSnapshot(account.userID).catch(() => null);
      const mutations = snapshot?.mutations || [];
      syncedContent = {
        ...(snapshot || {}),
        status: "offline",
        userID: account.userID,
        error: error.message,
        mutations,
        summary: summarizeMutations(mutations)
      };
      return syncedContent;
    })
    .finally(() => {
      syncLoadPromise = null;
    });
  return syncLoadPromise;
}

function mergeSyncedMutations(existing, incoming) {
  const byRecordID = new Map();
  [...existing, ...incoming].forEach((mutation) => {
    const recordID = syncMutationRecordID(mutation);
    if (recordID) byRecordID.set(recordID, mutation);
  });
  return Array.from(byRecordID.values());
}

async function ensureSyncedContentForRender() {
  if (!activeAccount()) {
    if (syncedContent?.status !== "disconnected") {
      syncedContent = { status: "disconnected", mutations: [], summary: summarizeMutations([]) };
    }
    return syncedContent;
  }
  if (syncedContent?.status === "connected") return syncedContent;
  if (syncedContent?.status === "offline" && (navigator.onLine === false || !serverReachable)) {
    return syncedContent;
  }
  return loadSyncedContent();
}

function syncedWorkboardForProject(projectID) {
  return (syncedContent?.summary?.workboards || []).find((board) =>
    String(board.projectID || "") === String(projectID || "")
  ) || null;
}

async function loadSyncedWorkboard(projectID) {
  if (!activeAccount()) return null;
  await loadSyncedContent();
  return syncedWorkboardForProject(projectID);
}

async function saveSyncedWorkboard(board, options = {}) {
  const account = activeAccount();
  if (!account) throw new Error("Sign in to synchronize this Workboard.");
  if (!isProAccount()) {
    void presentPlanLimitNotice("Workboards require Pro", "Upgrade to Pro to create or edit Project Workboards.");
    throw new Error("Workboards require Pro.");
  }
  const projectID = String(board?.id || board?.projectID || "").trim();
  if (!projectID) throw new Error("This Workboard is missing its project ID.");
  const updatedAt = board.updatedAt || new Date().toISOString();
  const record = {
    id: `${account.userID}:workboard:${projectID}`,
    userID: account.userID,
    codeVersion: defaultSyncCodeVersion,
    projectID,
    projectName: board.projectName || "Project",
    elements: board.elements || [],
    appState: board.appState || {},
    files: board.files || {},
    assets: board.assets || {},
    baseUpdatedAt: options.baseUpdatedAt || null,
    updatedAt
  };
  await pushMutation({ workboard: record });
  return syncedWorkboardForProject(projectID) || record;
}

async function deleteSyncedWorkboard(projectID) {
  const account = activeAccount();
  if (!account) return;
  const board = syncedWorkboardForProject(projectID);
  if (!board) return;
  const now = new Date().toISOString();
  await pushMutation({
    workboard: {
      id: `${account.userID}:workboard:${projectID}`,
      userID: account.userID,
      codeVersion: defaultSyncCodeVersion,
      projectID,
      projectName: board?.projectName || "Project",
      updatedAt: now,
      deletedAt: now
    }
  });
  const pathnames = Object.values(board?.assets || {}).map((asset) => asset?.pathname).filter(Boolean);
  if (!pathnames.length) return;
  const response = await fetch("/workboards/assets/delete", {
    method: "POST",
    headers: {
      authorization: `Bearer ${account.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      auth: { accountUserID: account.userID },
      projectID,
      pathnames
    })
  });
  if (!response.ok && response.status !== 503) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(responseErrorMessage(payload, "Could not remove this Workboard's stored images."));
  }
}

async function replaceLocalWorkboard(projectID, board) {
  const module = await loadWorkboardModule();
  await module.replaceLocalWorkboard(projectID, board);
  const mounted = workboardMounts.get(projectID);
  disposeProjectWorkboardMount(mounted);
  workboardMounts.delete(projectID);
}

async function deleteLocalWorkboard(projectID) {
  const module = await loadWorkboardModule();
  await module.deleteLocalWorkboard(projectID);
  const mounted = workboardMounts.get(projectID);
  disposeProjectWorkboardMount(mounted);
  workboardMounts.delete(projectID);
}

function responseErrorMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || payload?.error || fallback;
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not optimize this Workboard image."));
    }, type, quality);
  });
}

async function optimizedWorkboardImageBlob(blob) {
  if (blob.type === "image/gif" || typeof createImageBitmap !== "function") return blob;
  const image = await createImageBitmap(blob);
  try {
    const maxDimension = 2048;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    if (scale === 1 && blob.size <= 1.5 * 1024 * 1024) return blob;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return blob;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasBlob(canvas, "image/webp", 0.84);
  } finally {
    image.close();
  }
}

async function uploadWorkboardAsset(projectID, fileID, file) {
  const account = activeAccount();
  if (!account) throw new Error("Sign in to synchronize Workboard images.");
  if (typeof file?.dataURL !== "string" || !file.dataURL.startsWith("data:")) {
    throw new Error("This Workboard image has no uploadable data.");
  }
  const sourceBlob = await fetch(file.dataURL).then((response) => response.blob());
  const blob = await optimizedWorkboardImageBlob(sourceBlob);
  const url = new URL("/workboards/assets/upload", window.location.origin);
  url.searchParams.set("projectID", projectID);
  url.searchParams.set("fileID", fileID);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${account.sessionToken}`,
      "content-type": blob.type || file.mimeType || "application/octet-stream",
      "x-permitext-user-id": account.userID
    },
    body: blob
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(responseErrorMessage(payload, "Could not upload this Workboard image."));
  return payload.asset;
}

function blobDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read this Workboard image."));
    reader.readAsDataURL(blob);
  });
}

async function loadWorkboardAsset(asset) {
  const account = activeAccount();
  if (!account) throw new Error("Sign in to load synchronized Workboard images.");
  const response = await fetch("/workboards/assets/read", {
    method: "POST",
    headers: {
      authorization: `Bearer ${account.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      auth: { accountUserID: account.userID },
      pathname: asset?.pathname,
      projectID: asset?.projectID
    })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(responseErrorMessage(payload, "Could not load this Workboard image."));
  }
  return blobDataURL(await response.blob());
}

function swiftReferenceDateSeconds(date = new Date()) {
  return (date.getTime() - Date.UTC(2001, 0, 1)) / 1000;
}

function continuityRecentEntries(values = {}) {
  try {
    const parsed = JSON.parse(values.recentlyViewedSectionsJSON || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function continuityRecentSearches(values = {}) {
  try {
    const parsed = JSON.parse(values.recentSearchesJSON || "[]");
    return normalizeSearchHistory(Array.isArray(parsed) ? parsed : [], 10);
  } catch {
    return [];
  }
}

function recordRecentlyViewedReader(reader) {
  const sectionID = Number(reader?.sectionID || 0);
  if (!Number.isSafeInteger(sectionID) || sectionID <= 0) return;
  const chapter = chapters.find((item) => String(item.id) === String(reader.chapterID || ""));
  const codeOption = codeOptions.find((item) => item.prefix === (reader.codePrefix || chapter?.codePrefix));
  const entry = {
    sectionID,
    sectionNumber: reader.sectionNumber || "",
    title: reader.title || "Section",
    chapterTitle: chapter?.fullTitle || chapter?.displayTitle || chapter?.title || "",
    codeSectionID: chapter?.codeSectionID || null,
    codeSectionName: codeOption?.label || reader.codePrefix || "",
    codePrefix: reader.codePrefix || chapter?.codePrefix || "BC",
    chapterID: reader.chapterID || chapter?.id || "",
    chapterNumber: chapter?.chapterNumber || "",
    previewText: "",
    viewedAt: swiftReferenceDateSeconds()
  };
  state.recentlyViewedSections = [
    entry,
    ...(state.recentlyViewedSections || []).filter((item) => Number(item?.sectionID) !== sectionID)
  ].slice(0, 20);
  state.recentActivityUpdatedAt = new Date().toISOString();
  saveWorkspaceState();
}

function continuityValuesForReader(reader) {
  const account = activeAccount();
  const pendingRecord = [...(state.syncOutbox || [])].reverse()
    .filter((entry) => !account || entry.accountUserID === account.userID)
    .map((entry) => mutationKindAndRecord(entry.mutation))
    .find(({ kind }) => kind === "continuity")?.record;
  const existing = pendingRecord?.values || syncedContent?.summary?.latestContinuity?.values || {};
  const chapter = chapters.find((item) => String(item.id) === String(reader.chapterID || ""));
  const sectionID = Number(reader.sectionID || 0);
  const syncedRecentEntries = continuityRecentEntries(existing);
  const recentEntries = [...(state.recentlyViewedSections || [])];
  syncedRecentEntries.forEach((entry) => {
    if (!recentEntries.some((candidate) => Number(candidate?.sectionID) === Number(entry?.sectionID))) recentEntries.push(entry);
  });
  if (Number.isSafeInteger(sectionID) && sectionID > 0) {
    const codeOption = codeOptions.find((item) => item.prefix === (reader.codePrefix || chapter?.codePrefix));
    const entry = {
      sectionID,
      sectionNumber: reader.sectionNumber || "",
      title: reader.title || "Section",
      chapterTitle: chapter?.fullTitle || chapter?.displayTitle || chapter?.title || "",
      codeSectionID: chapter?.codeSectionID || null,
      codeSectionName: codeOption?.label || reader.codePrefix || "",
      previewText: "",
      viewedAt: swiftReferenceDateSeconds()
    };
    recentEntries.splice(0, recentEntries.length, entry, ...recentEntries.filter((item) => Number(item?.sectionID) !== sectionID).slice(0, 19));
  }
  return {
    ...existing,
    selectedJurisdictionKey: "jurisdiction-1",
    selectedVersionFileName: defaultSyncCodeVersion,
    selectedCodeSectionID: state.settingsCodePrefix === "ALL"
      ? ""
      : chapter?.codeSectionID
        ? String(chapter.codeSectionID)
        : existing.selectedCodeSectionID || "",
    lastOpenedChapterID: reader.chapterID
      ? String(reader.chapterID)
      : existing.lastOpenedChapterID || "",
    recentlyViewedSectionsJSON: JSON.stringify(recentEntries),
    recentSearchesJSON: JSON.stringify(normalizeSearchHistory(state.recentSearches, 10))
  };
}

function scheduleContinuitySync(reader) {
  recordRecentlyViewedReader(reader);
  const account = activeAccount();
  if (!account || !reader?.chapterID) return;
  clearTimeout(continuityPushTimer);
  continuityPushTimer = window.setTimeout(() => {
    const updatedAt = new Date().toISOString();
    const mutation = {
      continuity: {
        userID: account.userID,
        codeVersion: defaultSyncCodeVersion,
        values: continuityValuesForReader(reader),
        updatedAt
      }
    };
    state.continuityAppliedAt = updatedAt;
    enqueueSyncMutation(mutation, account);
    flushSyncOutbox({ refresh: true }).catch(() => {});
  }, 500);
}

function scheduleRecentSearchContinuitySync() {
  const account = activeAccount();
  if (!account) return;
  clearTimeout(continuityPushTimer);
  continuityPushTimer = window.setTimeout(() => {
    const updatedAt = new Date().toISOString();
    const reader = state.readers[0] || {};
    state.continuityAppliedAt = updatedAt;
    enqueueSyncMutation({
      continuity: {
        userID: account.userID,
        codeVersion: defaultSyncCodeVersion,
        values: continuityValuesForReader(reader),
        updatedAt
      }
    }, account);
    flushSyncOutbox({ refresh: true }).catch(() => {});
  }, 500);
}

async function applyRemoteContinuityIfNewer() {
  const record = syncedContent?.summary?.latestContinuity;
  const remoteTimestamp = Date.parse(record?.updatedAt || 0);
  const appliedTimestamp = Date.parse(state.continuityAppliedAt || 0);
  const hasPendingContinuity = (state.syncOutbox || []).some((entry) =>
    mutationKindAndRecord(entry.mutation).kind === "continuity"
  );
  if (!record || !Number.isFinite(remoteTimestamp) || remoteTimestamp <= appliedTimestamp || hasPendingContinuity) return;

  state.continuityAppliedAt = record.updatedAt;
  const recentActivityTimestamp = Date.parse(state.recentActivityUpdatedAt || 0);
  if (!Number.isFinite(recentActivityTimestamp) || remoteTimestamp >= recentActivityTimestamp) {
    const remoteRecentEntries = continuityRecentEntries(record.values);
    state.recentlyViewedSections = remoteRecentEntries.slice(0, 20);
    if (record.values?.recentSearchesJSON !== undefined) {
      state.recentSearches = continuityRecentSearches(record.values);
    }
    state.recentActivityUpdatedAt = record.updatedAt;
  }
  // A device may share recents, but it must never steer another device's
  // active reader, selected code, open columns, or project. Those are local
  // workspace choices and changing them during a background pull caused the
  // reader to jump to whatever paragraph had just been saved on iOS.
  saveWorkspaceState();
}

function enqueueSyncMutation(mutation, account) {
  const recordID = syncMutationRecordID(mutation);
  if (!recordID) throw new Error("Could not queue a sync record without an ID.");
  const entry = {
    id: `${account.userID}:${recordID}`,
    accountUserID: account.userID,
    recordID,
    mutation,
    queuedAt: new Date().toISOString(),
    attemptCount: 0,
    lastError: null
  };
  state.syncOutbox = [
    ...(state.syncOutbox || []).filter((item) => item.id !== entry.id),
    entry
  ];
  state.syncConflicts = (state.syncConflicts || []).filter((item) => item.id !== entry.id);
  saveWorkspaceState();
  return entry;
}

function recoverQueuedWorkboardProjectID(record = {}) {
  const direct = String(record.projectID || "").trim();
  if (direct && direct.length <= 200) return direct;
  const recordID = String(record.id || "");
  const markerIndex = recordID.lastIndexOf(":workboard:");
  const embedded = markerIndex === -1 ? "" : recordID.slice(markerIndex + ":workboard:".length).trim();
  if (embedded && embedded.length <= 200) return embedded;
  const matchingProject = visibleProjectRecords(syncedContent?.summary?.projects || []).find((project) =>
    String(project.name || project.title || "").trim() === String(record.projectName || "").trim()
  );
  const matchedID = workboardProjectID(matchingProject);
  return matchedID && matchedID.length <= 200 ? matchedID : "";
}

function prepareSyncOutboxForFlush(account) {
  const repairedEntries = [];
  const quarantinedEntries = [];
  let changed = false;
  (state.syncOutbox || []).forEach((entry) => {
    if (entry.accountUserID !== account.userID) {
      repairedEntries.push(entry);
      return;
    }
    const { kind, record } = mutationKindAndRecord(entry.mutation);
    let mutation = entry.mutation;
    if (kind === "workboard") {
      const projectID = recoverQueuedWorkboardProjectID(record);
      if (!projectID) {
        changed = true;
        quarantinedEntries.push({
          ...entry,
          conflictedAt: new Date().toISOString(),
          lastError: "Workboard sync paused because its project identity is missing."
        });
        return;
      }
      const canonicalWorkboardID = `${account.userID}:workboard:${projectID}`;
      mutation = {
        workboard: {
          ...record,
          id: canonicalWorkboardID,
          userID: account.userID,
          projectID
        }
      };
    } else if (kind === "project") {
      mutation = {
        project: {
          ...record,
          clientID: syncProjectIdentity(record.clientID, account.userID) ||
            syncProjectIdentity(record.id, account.userID) ||
            record.localFolderID ||
            null
        }
      };
    } else if (kind === "projectSection") {
      mutation = {
        projectSection: {
          ...record,
          folderClientID: syncProjectIdentity(record.folderClientID, account.userID) || null
        }
      };
    }
    const canonicalID = syncMutationRecordID(mutation);
    if (!canonicalID) {
      changed = true;
      quarantinedEntries.push({
        ...entry,
        conflictedAt: new Date().toISOString(),
        lastError: "Sync paused because this record has no stable cross-device identity."
      });
      return;
    }
    const repaired = {
      ...entry,
      id: `${account.userID}:${canonicalID}`,
      recordID: canonicalID,
      mutation
    };
    if (
      repaired.id !== entry.id ||
      repaired.recordID !== entry.recordID ||
      repaired.mutation !== entry.mutation
    ) changed = true;
    repairedEntries.push(repaired);
  });
  if (!changed) return;
  state.syncOutbox = Array.from(new Map(repairedEntries.map((entry) => [entry.id, entry])).values());
  state.syncConflicts = [
    ...(state.syncConflicts || []).filter((entry) => !quarantinedEntries.some((invalid) => invalid.id === entry.id)),
    ...quarantinedEntries
  ];
  saveWorkspaceState();
}

function discardLocalMutationOverlay(mutation) {
  const { kind, record } = mutationKindAndRecord(mutation);
  const recordID = syncMutationRecordID(mutation);
  if (!recordID) return;
  if (kind === "savedItem") {
    state.localSavedItems = (state.localSavedItems || []).filter((item) =>
      String(item.id || "") !== String(record.id || "") &&
      String(item.sectionID || "") !== String(record.sectionID || "")
    );
    state.localSavedSectionIDs = (state.localSavedSectionIDs || [])
      .filter((sectionID) => String(sectionID) !== String(record.sectionID || ""));
  } else if (kind === "annotation") {
    state.localAnnotations = (state.localAnnotations || []).filter((item) =>
      String(item.id || "") !== String(record.id || "") &&
      !(
        String(item.sectionID || "") === String(record.sectionID || "") &&
        normalizeAnnotationBlockID(item.blockID) === normalizeAnnotationBlockID(record.blockID)
      )
    );
  } else if (kind === "project") {
    state.localProjects = (state.localProjects || []).filter((item) => !projectDetailMatches(item, record));
  } else if (kind === "projectSection") {
    const identity = [
      record.folderClientID || record.localFolderID || "",
      record.sectionID || "",
      record.scope || ""
    ].map(String).join(":");
    state.localProjectSections = (state.localProjectSections || []).filter((item) => [
      item.folderClientID || item.localFolderID || "",
      item.sectionID || "",
      item.scope || ""
    ].map(String).join(":") !== identity);
  } else if (kind === "continuity") {
    state.continuityAppliedAt = null;
  }
}

async function resolveSyncConflict(entry, keepLocal) {
  const account = activeAccount();
  if (!account || entry.accountUserID !== account.userID) return;
  if (keepLocal) {
    const { kind, record } = mutationKindAndRecord(entry.mutation);
    if (!kind || !record) return;
    enqueueSyncMutation({
      [kind]: { ...record, userID: account.userID, updatedAt: new Date().toISOString() }
    }, account);
    await flushSyncOutbox({ refresh: true });
  } else {
    const { kind, record } = mutationKindAndRecord(entry.mutation);
    if (kind !== "workboard") discardLocalMutationOverlay(entry.mutation);
    state.syncConflicts = (state.syncConflicts || []).filter((item) => item.id !== entry.id);
    saveWorkspaceState();
    await loadSyncedContent({ force: true });
    if (kind === "workboard") {
      const projectID = String(record?.projectID || "");
      await replaceLocalWorkboard(projectID, syncedWorkboardForProject(projectID));
    }
  }
  await renderWorkspace();
}

function scheduleSyncOutboxRetry(attemptCount = 1) {
  clearTimeout(syncRetryTimer);
  const exponent = Math.min(Math.max(Number(attemptCount) - 1, 0), 6);
  const delay = Math.min(5_000 * (2 ** exponent), 5 * 60_000);
  syncRetryTimer = window.setTimeout(() => {
    flushSyncOutbox({ refresh: true }).catch(() => {});
  }, delay);
}

async function flushSyncOutbox(options = {}) {
  const account = activeAccount();
  if (!account) return { acceptedMutationIDs: [], rejectedMutationIDs: [] };
  if (syncFlushPromise) {
    const inFlightResult = await syncFlushPromise;
    const stillActiveAccount = activeAccount();
    const hasPending = stillActiveAccount && (state.syncOutbox || [])
      .some((item) => item.accountUserID === stillActiveAccount.userID);
    if (!hasPending) return inFlightResult;
    const followUpResult = await flushSyncOutbox(options);
    return {
      ...followUpResult,
      acceptedMutationIDs: Array.from(new Set([
        ...(inFlightResult.acceptedMutationIDs || []),
        ...(followUpResult.acceptedMutationIDs || [])
      ])),
      rejectedMutationIDs: Array.from(new Set([
        ...(inFlightResult.rejectedMutationIDs || []),
        ...(followUpResult.rejectedMutationIDs || [])
      ]))
    };
  }

  syncFlushPromise = (async () => {
    prepareSyncOutboxForFlush(account);
    const acceptedMutationIDs = [];
    const rejectedMutationIDs = [];
    let latestPayload = null;
    while (true) {
      const entries = (state.syncOutbox || [])
        .filter((item) => item.accountUserID === account.userID)
        .slice(0, 100);
      if (!entries.length) break;

      try {
        const payload = await postJSON("/sync/push", {
          auth: { accountUserID: account.userID },
          syncSchemaVersion: permitextSyncSchemaVersion,
          clientCapabilities: permitextClientCapabilities,
          batch: {
            user: { id: account.userID },
            mutations: entries.map((item) => item.mutation)
          }
        }, { token: account.sessionToken });
        latestPayload = payload;
        const accepted = new Set(payload.acceptedMutationIDs || []);
        const rejected = new Set(payload.rejectedMutationIDs || []);
        acceptedMutationIDs.push(...accepted);
        rejectedMutationIDs.push(...rejected);
        const completedEntryIDs = new Set(entries
          .filter((item) => accepted.has(item.recordID) || rejected.has(item.recordID))
          .map((item) => item.id));
        const postedEntryVersions = new Map(entries.map((item) => [item.id, item.queuedAt]));
        const unknownEntries = entries.filter((item) =>
          !completedEntryIDs.has(item.id) &&
          (state.syncOutbox || []).some((current) => current.id === item.id && current.queuedAt === item.queuedAt)
        );
        const rejectedEntries = entries.filter((item) =>
          rejected.has(item.recordID) &&
          (state.syncOutbox || []).some((current) => current.id === item.id && current.queuedAt === item.queuedAt)
        );

        state.syncOutbox = (state.syncOutbox || [])
          .filter((item) =>
            (!completedEntryIDs.has(item.id) && !unknownEntries.some((entry) => entry.id === item.id)) ||
              postedEntryVersions.get(item.id) !== item.queuedAt
          );
        state.syncConflicts = [
          ...(state.syncConflicts || []).filter((item) =>
            !rejectedEntries.some((entry) => entry.id === item.id) &&
            !unknownEntries.some((entry) => entry.id === item.id)
          ),
          ...rejectedEntries.map((item) => ({
            ...item,
            conflictedAt: new Date().toISOString(),
            rejectionCode: payload.rejectionReasons?.[item.recordID]?.code || null,
            lastError: payload.rejectionReasons?.[item.recordID]?.message ||
              "Server has a newer version of this record."
          })),
          ...unknownEntries.map((item) => ({
            ...item,
            conflictedAt: new Date().toISOString(),
            lastError: "A legacy queued change could not be reconciled and was paused."
          }))
        ];
        absorbBulkClearConflicts();
        saveWorkspaceState();
        storeAccountEntitlement(payload.entitlement || null);
      } catch (error) {
        const entryVersions = new Map(entries.map((item) => [item.id, item.queuedAt]));
        let highestAttemptCount = 1;
        state.syncOutbox = (state.syncOutbox || []).map((item) => {
          if (entryVersions.get(item.id) !== item.queuedAt) return item;
          const attemptCount = Number(item.attemptCount || 0) + 1;
          highestAttemptCount = Math.max(highestAttemptCount, attemptCount);
          return { ...item, attemptCount, lastError: error.message || "Sync failed." };
        });
        saveWorkspaceState();
        scheduleSyncOutboxRetry(highestAttemptCount);
        throw error;
      }
    }

    clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
    if (options.refresh !== false && latestPayload) {
      await loadSyncedContent({ force: true, skipOutbox: true });
    }
    return { acceptedMutationIDs, rejectedMutationIDs, payload: latestPayload };
  })().finally(() => {
    syncFlushPromise = null;
    updateConnectionStatus();
  });
  updateConnectionStatus();
  return syncFlushPromise;
}

function syncResultChangesWorkspace(result) {
  return Boolean(
    result?.payload ||
    result?.acceptedMutationIDs?.length ||
    result?.rejectedMutationIDs?.length
  );
}

async function flushPendingSyncAndRender() {
  const result = await flushSyncOutbox({ refresh: true });
  if (syncResultChangesWorkspace(result)) await renderWorkspace();
}

function canRunForegroundSync() {
  return Boolean(
    !detachedProjectWindow &&
    activeAccount() &&
    navigator.onLine &&
    document.visibilityState === "visible"
  );
}

function stopForegroundSyncLoop() {
  clearTimeout(foregroundSyncTimer);
  foregroundSyncTimer = null;
}

async function performForegroundSync() {
  if (!canRunForegroundSync()) return null;
  if (foregroundSyncPromise) return foregroundSyncPromise;

  foregroundSyncPromise = (async () => {
    const accountUserID = activeAccount()?.userID || "";
    const previousStatus = syncedContent?.status || "";
    const previousEventID = Number(syncedContent?.latestEventID || 0);
    const pushResult = await flushSyncOutbox({ refresh: false });
    if (activeAccount()?.userID !== accountUserID) {
      await renderWorkspace();
      return null;
    }
    if (!canRunForegroundSync()) return null;

    if (syncLoadPromise) await syncLoadPromise;
    let content = await loadSyncedContent({ force: true, skipOutbox: true });
    if (activeAccount()?.userID !== accountUserID) {
      await renderWorkspace();
      return content;
    }
    if (!canRunForegroundSync() || content?.status === "error") return content;
    if (await migrateLegacyArchivedProjects()) {
      content = await loadSyncedContent({ force: true, skipOutbox: true });
    }

    const nextEventID = Number(content?.latestEventID || 0);
    if (
      syncResultChangesWorkspace(pushResult) ||
      content?.status !== previousStatus ||
      nextEventID !== previousEventID
    ) {
      await renderWorkspace();
    }
    return content;
  })().finally(() => {
    foregroundSyncPromise = null;
  });
  return foregroundSyncPromise;
}

function startForegroundSyncLoop(options = {}) {
  stopForegroundSyncLoop();
  if (!canRunForegroundSync()) return;
  foregroundSyncTimer = window.setTimeout(async () => {
    try {
      await performForegroundSync();
    } catch {
      // The durable outbox and its exponential retry retain pending local changes.
    } finally {
      startForegroundSyncLoop();
    }
  }, options.immediate ? 0 : Math.max(
    500,
    foregroundSyncIntervalMilliseconds +
      Math.round((Math.random() * 2 - 1) * foregroundSyncJitterMilliseconds)
  ));
}

async function pushMutation(mutation) {
  const account = activeAccount();
  if (!account) {
    throw new Error("Sign in from Settings before saving from the web.");
  }
  const entry = enqueueSyncMutation(mutation, account);
  let result = await flushSyncOutbox({ refresh: true });
  if ((state.syncOutbox || []).some((item) => item.id === entry.id && item.queuedAt === entry.queuedAt)) {
    const followUp = await flushSyncOutbox({ refresh: true });
    result = {
      ...followUp,
      acceptedMutationIDs: [...result.acceptedMutationIDs, ...followUp.acceptedMutationIDs],
      rejectedMutationIDs: [...result.rejectedMutationIDs, ...followUp.rejectedMutationIDs]
    };
  }
  if (result.rejectedMutationIDs.includes(entry.recordID)) {
    const reason = result.payload?.rejectionReasons?.[entry.recordID];
    throw new Error(reason?.message || "The server has a newer version of this record. Review the synced copy before retrying.");
  }
  if (!result.acceptedMutationIDs.includes(entry.recordID)) {
    throw new Error("This change remains queued for sync.");
  }
  return result.payload;
}

function savedMutationForReader(reader) {
  return savedMutationForSection({
    sectionID: reader.sectionID,
    sectionNumber: reader.sectionNumber,
    title: reader.title
  });
}

function savedMutationForSection(section) {
  const account = activeAccount();
  const now = new Date().toISOString();
  return {
    savedItem: savedRecordForSection(section, account?.userID || "local-web", now)
  };
}

function savedRecordForSection(section, userID = "local-web", updatedAt = new Date().toISOString()) {
  return {
    id: `web-saved-${section.sectionID}`,
    userID,
    codeVersion: defaultSyncCodeVersion,
    codePrefix: section.codePrefix || "BC",
    chapterID: section.chapterID || "",
    chapterNumber: section.chapterNumber || "",
    sectionID: Number(section.sectionID),
    sectionNumber: section.sectionNumber,
    title: section.title,
    updatedAt
  };
}

function projectSectionRecordForSection(project, sectionPayload) {
  const account = activeAccount();
  const now = new Date().toISOString();
  const sectionID = String(sectionPayload.sectionID || "");
  const folderClientID = project.clientID || project.id || project.localFolderID || "";
  return {
    id: `web-project-section-${folderClientID}-${sectionID}`,
    userID: account?.userID || "local-web",
    codeVersion: defaultSyncCodeVersion,
    codePrefix: sectionPayload.codePrefix || "BC",
    chapterID: sectionPayload.chapterID || "",
    chapterNumber: sectionPayload.chapterNumber || "",
    folderClientID,
    localFolderID: numericLocalFolderID(project) || null,
    sectionID: Number(sectionID),
    sectionNumber: sectionPayload.sectionNumber || "",
    title: sectionPayload.title || "Section",
    scope: "manual",
    updatedAt: now
  };
}

function projectSectionMutationForSection(project, sectionPayload) {
  const record = projectSectionRecordForSection(project, sectionPayload);
  return {
    projectSection: {
      id: record.id,
      userID: record.userID,
      codeVersion: record.codeVersion,
      folderClientID: record.folderClientID,
      localFolderID: record.localFolderID,
      sectionID: record.sectionID,
      scope: record.scope,
      updatedAt: record.updatedAt
    }
  };
}

function deletedProjectSectionMutationForItem(project, item) {
  const now = new Date().toISOString();
  const record = projectSectionRecordForSection(project, item);
  return {
    projectSection: {
      id: item.projectSectionID || item.id || record.id,
      userID: activeAccount()?.userID || item.userID || "local-web",
      codeVersion: syncCodeVersion(item.codeVersion),
      folderClientID: item.folderClientID || record.folderClientID,
      localFolderID: item.localFolderID || record.localFolderID,
      sectionID: Number(item.sectionID || item.savedSectionID || item.itemID),
      scope: item.scope || record.scope,
      updatedAt: now,
      deletedAt: now
    }
  };
}

function savedItemForSection(sectionID) {
  const sectionKey = String(sectionID || "");
  return [...(state.localSavedItems || []), ...(syncedContent?.summary?.savedItems || [])]
    .filter((item) => String(item?.sectionID || "") === sectionKey)
    .sort((left, right) => Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0))[0] || null;
}

function deletedSavedMutationForSection(section, existingRecord = null) {
  const account = activeAccount();
  const now = new Date().toISOString();
  const existing = existingRecord || savedItemForSection(section.sectionID) || {};
  return {
    savedItem: {
      id: existing.id || `web-saved-${section.sectionID}`,
      userID: account.userID,
      codeVersion: syncCodeVersion(existing.codeVersion || section.codeVersion),
      sectionID: Number(section.sectionID),
      sectionNumber: section.sectionNumber || existing.sectionNumber || "",
      title: section.title || existing.title || "Section",
      updatedAt: now,
      deletedAt: now
    }
  };
}

const projectColorOptions = [
  "#6674c8",
  "#5aaea4",
  "#f27a4f",
  "#a14fc0",
  "#879a6d",
  "#9b7d6f",
  "#d75f7a",
  "#2f8f4e",
  "#0891b2",
  "#c96410",
  "#3f6f9f",
  "#b58b2a",
  "#6f58c9",
  "#c84b7a",
  "#4f8f8b"
];

function projectColor(project) {
  // `colorHex` is the native iOS storage field and the canonical sync value.
  // Legacy web aliases remain as fallbacks for records created before sync.
  return project?.colorHex || project?.color || project?.tintColor || projectColorOptions[0];
}

function readableProjectName(project) {
  const name = String(project?.name || project?.title || "Project").trim() || "Project";
  if (name !== name.toLocaleUpperCase() || name === name.toLocaleLowerCase()) return name;
  return name.toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, (match) => match.toLocaleUpperCase());
}

function projectForegroundColor(color) {
  const match = String(color || "").trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return "#ffffff";
  const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  return luminance > 0.179 ? "#111111" : "#ffffff";
}

function numericLocalFolderID(project) {
  const value = Number(project?.localFolderID);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function projectMutationForRecord(project, accountOverride = null) {
  const account = accountOverride || activeAccount();
  const now = project.updatedAt || new Date().toISOString();
  const color = projectColor(project);
  return {
    project: {
      id: project.id,
      clientID: project.clientID || project.id,
      localFolderID: numericLocalFolderID(project),
      userID: account?.userID || "local-web",
      codeVersion: syncCodeVersion(project.codeVersion),
      name: project.name || "Project",
      title: project.title || project.name || "Project",
      address: project.address || "",
      description: project.description || "",
      color,
      colorHex: color,
      sortOrder: Number.isFinite(Number(project.sortOrder)) ? Number(project.sortOrder) : 0,
      sortMode: project.sortMode || "Code order",
      createdAt: project.createdAt || now,
      updatedAt: now,
      archivedAt: project.archivedAt || null
    }
  };
}

function deletedProjectMutationForRecord(project, accountOverride = null) {
  const account = accountOverride || activeAccount();
  const now = new Date().toISOString();
  return {
    project: {
      ...projectMutationForRecord(project, account).project,
      updatedAt: now,
      deletedAt: now
    }
  };
}

function projectRecordsFromMutations(mutations = []) {
  return summarizeMutations(mutations).projects;
}

function projectRecordID(project) {
  return String(project?.id || project?.clientID || project?.localFolderID || "");
}

function archivedProjectIDSet() {
  state.archivedProjectIDs = Array.isArray(state.archivedProjectIDs) ? state.archivedProjectIDs.map(String) : [];
  return new Set(state.archivedProjectIDs);
}

function projectIsArchived(project) {
  return Boolean(project?.archivedAt) || archivedProjectIDSet().has(projectRecordID(project));
}

async function migrateLegacyArchivedProjects() {
  const account = activeAccount();
  if (!account || syncedContent?.status !== "connected") return false;
  const legacyArchivedIDs = archivedProjectIDSet();
  const projects = visibleProjectRecords(syncedContent.summary?.projects || [])
    .filter((project) => legacyArchivedIDs.has(projectRecordID(project)) && !project.archivedAt);
  if (!projects.length) return false;

  for (const project of projects) {
    const archivedAt = new Date().toISOString();
    const archivedProject = { ...project, archivedAt, updatedAt: archivedAt };
    const id = projectRecordID(project);
    state.localProjects = [
      ...(state.localProjects || []).filter((item) => projectRecordID(item) !== id),
      archivedProject
    ];
    saveWorkspaceState();
    try {
      await pushMutation(projectMutationForRecord(archivedProject, account));
      state.localProjects = (state.localProjects || []).filter((item) => projectRecordID(item) !== id);
      saveWorkspaceState();
    } catch (error) {
      if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
      return false;
    }
  }
  return true;
}

function visibleProjectRecords(syncedProjects = []) {
  const byIdentity = new Map();
  syncedProjects.forEach((project) => {
    const identity = projectDetailKey(project);
    if (identity) byIdentity.set(identity, project);
  });
  const clearRecords = currentBulkClearRecords();
  (state.localProjects || [])
    .filter((project) => recordSurvivesBulkClear(project, clearRecords, ["folders"]))
    .forEach((project) => {
      const identity = projectDetailKey(project);
      // Keep offline edits visible only while they are actually newer. A
      // synced project wins ties and any legacy undated browser overlay, so
      // names and colors cannot drift after another device updates them.
      if (identity) mergeNewestRecord(byIdentity, identity, project);
    });
  return Array.from(byIdentity.values()).filter((project) => !project.deletedAt).sort((left, right) =>
    String(left.name || left.title || "").localeCompare(String(right.name || right.title || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function activeProjectRecords(syncedProjects = []) {
  return visibleProjectRecords(syncedProjects).filter((project) => !projectIsArchived(project));
}

function archivedProjectRecords(syncedProjects = []) {
  return visibleProjectRecords(syncedProjects).filter(projectIsArchived);
}

function nextProjectName() {
  const existing = visibleProjectRecords(projectRecordsFromMutations(syncedContent?.mutations || []));
  const usedNumbers = new Set();
  existing.forEach((project) => {
    const match = String(project.name || project.title || "").trim().match(/^P(\d+)$/i);
    if (match) usedNumbers.add(Number(match[1]));
  });
  let index = 1;
  while (usedNumbers.has(index)) index += 1;
  return `P${index}`;
}

async function createProjectFolder(details = {}) {
  if (!isProAccount()) {
    void presentPlanLimitNotice("Projects require Pro", "Upgrade to Pro to create Project workspaces and organize saved code by job.");
    return null;
  }
  const now = new Date().toISOString();
  const localFolderID = Date.now();
  const id = `web-project-${localFolderID.toString(36)}`;
  const fallbackName = nextProjectName();
  const name = String(details.name || "").trim() || fallbackName;
  const description = String(details.description || "").trim();
  const address = String(details.address || "").trim();
  const project = {
    id,
    clientID: id,
    localFolderID,
    codeVersion: defaultSyncCodeVersion,
    name,
    title: name,
    address,
    description,
    color: details.color || projectColorOptions[0],
    sortMode: "Code order",
    createdAt: now,
    updatedAt: now
  };
  state.localProjects = [...(state.localProjects || []), project];
  saveWorkspaceState();

  const account = activeAccount();
  if (!account) return project;

  try {
    await pushMutation(projectMutationForRecord(project, account));
    state.localProjects = (state.localProjects || []).filter((item) => item.id !== project.id);
    saveWorkspaceState();
  } catch (error) {
    if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
    // The local project and queued mutation remain available while sync recovers.
  }
  return project;
}

async function updateProjectFolder(project, details = {}) {
  const id = projectRecordID(project);
  if (!id) return;
  const now = new Date().toISOString();
  const name = String(details.name || "").trim() || project.name || project.title || "Project";
  const color = details.color || projectColor(project);
  const address = String(details.address || "").trim();
  const updated = {
    ...project,
    id: project.id || id,
    clientID: project.clientID || id,
    localFolderID: project.localFolderID || id,
    codeVersion: syncCodeVersion(project.codeVersion),
    name,
    title: name,
    address,
    description: String(details.description || "").trim(),
    color,
    colorHex: color,
    tintColor: color,
    updatedAt: now
  };
  const localProjects = state.localProjects || [];
  const localIndex = localProjects.findIndex((item) => projectRecordID(item) === id);
  const account = activeAccount();
  const nextProjects = [...localProjects];

  if (localIndex >= 0) {
    nextProjects[localIndex] = { ...nextProjects[localIndex], ...updated };
  } else {
    nextProjects.push(updated);
  }
  state.localProjects = nextProjects;
  setOpenProjectDetails(openProjectDetails().map((detail) => projectDetailMatches(project, detail) ? projectIdentity(updated) : detail));
  saveWorkspaceState();

  if (account) {
    try {
      await pushMutation(projectMutationForRecord(updated, account));
      state.localProjects = (state.localProjects || []).filter((item) => projectRecordID(item) !== id);
      saveWorkspaceState();
    } catch (error) {
      if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
      // Keep the local edit visible while the durable sync queue recovers.
    }
  }
}

function isSectionSaved(sectionID) {
  const sectionKey = String(sectionID);
  const localRecord = [...(state.localSavedItems || [])].reverse()
    .find((item) => String(item.sectionID || "") === sectionKey);
  if (localRecord) return !localRecord.deletedAt;
  if ((state.localSavedSectionIDs || []).map(String).includes(sectionKey)) return true;
  const savedItems = syncedContent?.summary?.savedItems || [];
  return savedItems.some((item) => String(item.sectionID) === sectionKey);
}

function setLocalSectionSaved(sectionID, saved) {
  const sectionKey = String(sectionID || "");
  if (!sectionKey) return;
  const current = new Set((state.localSavedSectionIDs || []).map(String));
  if (saved) current.add(sectionKey);
  else current.delete(sectionKey);
  state.localSavedSectionIDs = Array.from(current);
  saveWorkspaceState();
}

async function persistSectionBookmark(sectionPayload, saved, options = {}) {
  const existingRecord = savedItemForSection(sectionPayload.sectionID);
  if (
    saved &&
    !isSectionSaved(sectionPayload.sectionID) &&
    !isProAccount() &&
    webFreePlanUsage().savedItems >= webFreePlanLimits.savedItems
  ) {
    void presentPlanLimitNotice(
      "Free saved-section limit reached",
      `Free includes up to ${webFreePlanLimits.savedItems} saved sections. Upgrade to Pro to save more.`
    );
    return false;
  }
  if (!saved && options.removeProjectLinks !== false) {
    await removeSectionFromAllProjects(sectionPayload);
  }
  setLocalSectionSaved(sectionPayload.sectionID, saved);
  const sectionKey = String(sectionPayload.sectionID || "");
  const record = saved
    ? savedRecordForSection(sectionPayload, activeAccount()?.userID || "local-web")
    : {
        ...savedRecordForSection(sectionPayload, activeAccount()?.userID || "local-web"),
        ...(existingRecord || {}),
        updatedAt: new Date().toISOString()
      };
  const localRecord = saved ? record : { ...record, deletedAt: record.updatedAt };
  state.localSavedItems = [
    ...(state.localSavedItems || []).filter((item) => String(item.sectionID) !== sectionKey),
    localRecord
  ];
  saveWorkspaceState();
  if (options.refreshSavedPanes !== false) await refreshOpenSavedPanes();
  if (!activeAccount()) return;
  try {
    await pushMutation(saved
      ? savedMutationForSection(sectionPayload)
      : deletedSavedMutationForSection(sectionPayload, existingRecord));
    state.localSavedItems = (state.localSavedItems || []).filter((item) => String(item.sectionID) !== sectionKey);
    saveWorkspaceState();
  } catch (error) {
    if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
    // Keep the local record and queued mutation available while sync recovers.
  }
  return true;
}

async function persistSectionInProject(project, sectionPayload) {
  if (!isProAccount()) {
    void presentPlanLimitNotice("Project organization requires Pro", "Upgrade to Pro to add saved code to Projects.");
    return false;
  }
  const record = projectSectionRecordForSection(project, sectionPayload);
  const current = (state.localProjectSections || []).filter((item) => item.id !== record.id);
  state.localProjectSections = [...current, record];
  saveWorkspaceState();
  await refreshProjectMembershipPanes(project);
  if (!activeAccount()) return;
  try {
    await pushMutation(projectSectionMutationForSection(project, sectionPayload));
    state.localProjectSections = (state.localProjectSections || []).filter((item) => item.id !== record.id);
    saveWorkspaceState();
  } catch (error) {
    if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
    // Keep the local project link and queued mutation available while sync recovers.
  }
  return true;
}

async function removeSectionFromAllProjects(sectionPayload) {
  const sectionID = String(sectionPayload.sectionID || sectionPayload.savedSectionID || sectionPayload.itemID || "");
  if (!sectionID) return;
  const summary = currentContentSummary();
  const projects = summary.projects || [];
  const links = (summary.projectSections || []).filter((item) =>
    String(item.sectionID || item.savedSectionID || item.itemID || "") === sectionID
  );

  for (const link of links) {
    const project = projects.find((candidate) => projectSectionBelongsToProject(link, candidate)) || {
      clientID: link.folderClientID || "",
      localFolderID: link.localFolderID || ""
    };
    await removeSectionFromProject(project, link, { removeBookmark: false });
  }
}

async function removeSectionFromProject(project, item, options = {}) {
  const sectionID = String(item.sectionID || item.savedSectionID || item.itemID || "");
  const projectID = projectRecordID(project);
  if (!sectionID || !projectID) return;

  const matches = (candidate) =>
    String(candidate.id || "") === String(item.projectSectionID || item.id || "") ||
    (
      String(candidate.sectionID || candidate.savedSectionID || candidate.itemID || "") === sectionID &&
      projectSectionBelongsToProject(candidate, project)
    );

  const deletion = deletedProjectSectionMutationForItem(project, item);
  state.localProjectSections = [
    ...(state.localProjectSections || []).filter((candidate) => !matches(candidate)),
    deletion.projectSection
  ];
  saveWorkspaceState();
  await refreshProjectMembershipPanes(project);

  if (activeAccount()) {
    try {
      await pushMutation(deletion);
      state.localProjectSections = (state.localProjectSections || []).filter((candidate) => !matches(candidate));
      saveWorkspaceState();
    } catch (error) {
      if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
      // Keep the local project-membership tombstone while sync recovers.
    }
  }

  if (options.removeBookmark !== false) {
    await persistSectionBookmark(item, false, { refreshSavedPanes: false });
    syncReaderNoteBookmarkButtons(sectionID, false);
  }
}

function normalizeAnnotationBlockID(value) {
  return String(value || "").trim();
}

function safeAnnotationIDPart(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function annotationRecordID(target) {
  const codeVersion = syncCodeVersion(target.codeVersion);
  const sectionID = String(target.sectionID || "");
  const blockID = normalizeAnnotationBlockID(target.blockID);
  return `web-annotation-${codeVersion}-${sectionID}-${safeAnnotationIDPart(blockID)}`;
}

function normalizeAnnotationTags(tags = []) {
  const seen = new Set();
  return tags
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function annotationRecordsForTarget(sectionID, blockID = "") {
  const sectionKey = String(sectionID || "");
  const blockKey = normalizeAnnotationBlockID(blockID);
  const localIDs = new Set((state.localAnnotations || []).map((annotation) => String(annotation?.id || "")));
  return currentContentSummary().annotations
    .filter((annotation) =>
      String(annotation?.sectionID || "") === sectionKey &&
      normalizeAnnotationBlockID(annotation?.blockID || annotation?.anchorID || annotation?.contentBlockID) === blockKey
    )
    .sort((left, right) => {
      const timestampDifference = Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0);
      if (timestampDifference) return timestampDifference;
      const leftIsLocal = localIDs.has(String(left.id || ""));
      const rightIsLocal = localIDs.has(String(right.id || ""));
      return leftIsLocal === rightIsLocal ? 0 : leftIsLocal ? -1 : 1;
    });
}

function annotationForTarget(sectionID, blockID = "") {
  const records = annotationRecordsForTarget(sectionID, blockID);
  let noteBody = "";
  let tags = [];
  let noteResolved = false;
  let tagsResolved = false;
  const clearRecords = currentBulkClearRecords();

  for (const record of records) {
    const updatedAt = Date.parse(record.updatedAt || "");
    const noteClearTimestamp = bulkClearTimestamp(clearRecords, record.codeVersion, "notes");
    const tagsClearTimestamp = bulkClearTimestamp(clearRecords, record.codeVersion, "tags");
    const noteWasCleared = noteClearTimestamp > 0 &&
      (!Number.isFinite(updatedAt) || noteClearTimestamp >= updatedAt);
    const tagsWereCleared = tagsClearTimestamp > 0 &&
      (!Number.isFinite(updatedAt) || tagsClearTimestamp >= updatedAt);
    if (noteWasCleared && !noteResolved) {
      noteBody = "";
      noteResolved = true;
    }
    if (tagsWereCleared && !tagsResolved) {
      tags = [];
      tagsResolved = true;
    }
    if (record.deletedAt && !noteResolved) {
      noteBody = "";
      noteResolved = true;
    }
    if (!record.deletedAt && record.noteBody !== undefined && record.noteBody !== null && !noteResolved) {
      noteBody = String(record.noteBody);
      noteResolved = true;
    }
    if (!record.deletedAt && Array.isArray(record.tags) && !tagsResolved) {
      tags = normalizeAnnotationTags(record.tags);
      tagsResolved = true;
    }
  }

  return { noteBody, tags };
}

function noteValueForTarget(sectionID, blockID = "") {
  const blockKey = normalizeAnnotationBlockID(blockID);
  if (!blockKey) {
    const legacyNote = state.sectionNotes?.[sectionNoteKey(sectionID)];
    if (legacyNote !== undefined) return legacyNote;
  }
  return annotationForTarget(sectionID, blockKey).noteBody;
}

function tagsForTarget(sectionID, blockID = "") {
  return annotationForTarget(sectionID, blockID).tags;
}

function annotationRecordForTarget(target, values = {}) {
  const existing = annotationForTarget(target.sectionID, target.blockID);
  const now = values.updatedAt || new Date().toISOString();
  const blockID = normalizeAnnotationBlockID(target.blockID);
  const noteBody = values.noteBody !== undefined ? values.noteBody : existing.noteBody;
  const tags = values.tags !== undefined ? normalizeAnnotationTags(values.tags) : existing.tags;
  return {
    id: annotationRecordID(target),
    userID: activeAccount()?.userID || "local-web",
    codeVersion: syncCodeVersion(target.codeVersion),
    codePrefix: target.codePrefix || "BC",
    chapterID: target.chapterID || "",
    chapterNumber: target.chapterNumber || "",
    sectionID: Number(target.sectionID),
    sectionNumber: target.sectionNumber || "",
    title: target.title || "Section",
    blockID,
    blockLabel: target.blockLabel || "",
    noteBody,
    tags,
    syncFields: values.syncFields || ["noteBody", "tags"],
    updatedAt: now,
    deletedAt: values.deletedAt || null
  };
}

function upsertLocalAnnotation(record) {
  const annotations = (state.localAnnotations || []).filter((item) => String(item.id || "") !== String(record.id || ""));
  state.localAnnotations = [...annotations, record];
  if (!record.blockID) {
    state.sectionNotes = state.sectionNotes && typeof state.sectionNotes === "object" ? state.sectionNotes : {};
    delete state.sectionNotes[sectionNoteKey(record.sectionID)];
  }
  saveWorkspaceState();
}

function annotationMutationForRecord(record) {
  const account = activeAccount();
  const fields = new Set(Array.isArray(record.syncFields) ? record.syncFields : ["noteBody", "tags"]);
  const annotation = {
    id: record.id,
    userID: account?.userID || record.userID || "local-web",
    codeVersion: syncCodeVersion(record.codeVersion),
    sectionID: Number(record.sectionID),
    blockID: normalizeAnnotationBlockID(record.blockID) || null,
    updatedAt: record.updatedAt || new Date().toISOString(),
    deletedAt: record.deletedAt || null
  };
  if (fields.has("noteBody")) annotation.noteBody = record.deletedAt ? null : record.noteBody ?? "";
  if (fields.has("tags")) annotation.tags = record.deletedAt ? null : normalizeAnnotationTags(record.tags || []);
  return {
    annotation
  };
}

function scheduleAnnotationPush(record) {
  const account = activeAccount();
  if (!account) return;
  const mutation = annotationMutationForRecord(record);
  enqueueSyncMutation(mutation, account);
  const timerKey = String(record.id || "");
  clearTimeout(annotationPushTimers.get(timerKey));
  annotationPushTimers.set(timerKey, window.setTimeout(async () => {
    try {
      await pushMutation(mutation);
      state.localAnnotations = (state.localAnnotations || []).filter((item) =>
        String(item.id || "") !== timerKey || String(item.updatedAt || "") !== String(record.updatedAt || "")
      );
      saveWorkspaceState();
      if (state.utilities.saved) await renderWorkspace();
    } catch {
      // The local annotation and durable outbox entry remain available for retry.
    } finally {
      annotationPushTimers.delete(timerKey);
    }
  }, 650));
}

function setAnnotationNoteValue(target, value) {
  if (!target?.sectionID) return false;
  const currentNote = noteValueForTarget(target.sectionID, target.blockID);
  const nextNote = String(value || "");
  if (
    !isProAccount() &&
    !currentNote.trim() &&
    nextNote.trim() &&
    webFreePlanUsage().notes >= webFreePlanLimits.notes
  ) {
    void presentPlanLimitNotice(
      "Free note limit reached",
      `Free includes up to ${webFreePlanLimits.notes} notes. Upgrade to Pro to add more.`
    );
    return false;
  }
  const existingTags = tagsForTarget(target.sectionID, target.blockID);
  const record = annotationRecordForTarget(target, {
    noteBody: nextNote,
    tags: existingTags,
    syncFields: ["noteBody"]
  });
  upsertLocalAnnotation(record);
  scheduleAnnotationPush(record);
  return true;
}

function setAnnotationTags(target, tags) {
  if (!target?.sectionID) return false;
  const currentTags = tagsForTarget(target.sectionID, target.blockID);
  const nextTags = normalizeAnnotationTags(tags);
  const addsTag = nextTags.some((tag) =>
    !currentTags.some((current) => current.toLowerCase() === tag.toLowerCase())
  );
  if (!isProAccount() && addsTag) {
    void presentPlanLimitNotice("Tags require Pro", "Upgrade to Pro to add tags and use advanced organization.");
    return false;
  }
  const noteBody = noteValueForTarget(target.sectionID, target.blockID);
  const record = annotationRecordForTarget(target, {
    noteBody,
    tags: nextTags,
    syncFields: ["tags"]
  });
  upsertLocalAnnotation(record);
  refreshOpenSavedPanes().catch(() => {});
  scheduleAnnotationPush(record);
  return true;
}

function renderAnnotationTagEditor(container, target, options = {}) {
  if (!container || !target?.sectionID) return;
  clear(container);
  const tags = tagsForTarget(target.sectionID, target.blockID);
  const label = document.createElement("p");
  label.className = "annotation-tags-label";
  label.textContent = "Tags";

  const chips = document.createElement("div");
  chips.className = "annotation-tag-chips";
  if (tags.length) {
    tags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "annotation-tag-chip";
      chip.textContent = tag;
      chip.title = `Remove ${tag}`;
      chip.addEventListener("click", () => {
        if (!setAnnotationTags(target, tags.filter((item) => item.toLowerCase() !== tag.toLowerCase()))) return;
        renderAnnotationTagEditor(container, target, options);
        options.onChange?.();
      });
      chips.append(chip);
    });
  } else {
    const empty = document.createElement("span");
    empty.className = "annotation-tags-empty";
    empty.textContent = "No tags";
    chips.append(empty);
  }

  const input = document.createElement("input");
  input.className = "annotation-tag-input";
  input.type = "text";
  input.placeholder = isProAccount() ? "Add tag" : "Pro required";
  input.setAttribute("aria-label", "Add tag");
  input.disabled = !isProAccount();
  if (!isProAccount()) input.title = "Tags require Pro";
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    if (!setAnnotationTags(target, [...tags, value])) return;
    input.value = "";
    renderAnnotationTagEditor(container, target, options);
    options.onChange?.();
  });

  container.append(label, chips, input);
}

function annotationTargetForSection(section, reader = null, overrides = {}) {
  return {
    codeVersion: defaultSyncCodeVersion,
    codePrefix: reader?.codePrefix || section.codePrefix || "BC",
    chapterID: reader?.chapterID || section.chapterID || "",
    chapterNumber: reader?.chapterNumber || section.chapterNumber || "",
    sectionID: section.id || section.sectionID,
    sectionNumber: section.sectionNumber || "",
    title: section.title || "Section",
    blockID: normalizeAnnotationBlockID(overrides.blockID),
    blockLabel: overrides.blockLabel || ""
  };
}

function annotationTargetForBlock(section, block, reader = null, index = 0) {
  const blockID = normalizeAnnotationBlockID(block?.id || block?.tableID || block?.imageID || `block-${index + 1}`);
  return annotationTargetForSection(section, reader, {
    blockID,
    blockLabel: block?.caption || block?.plainText?.slice(0, 80) || `Paragraph ${index + 1}`
  });
}

function annotatedBlocksForSection(section) {
  const sourceBlocks = section.blocks?.length ? section.blocks : [{ id: `section-${section.id}`, plainText: section.title || "" }];
  return sourceBlocks.flatMap((block, blockIndex) => splitAnnotatedCodeBlock(block, blockIndex));
}

function splitAnnotatedCodeBlock(block, blockIndex = 0) {
  if (block?.kind !== "html" || !block.html || typeof document === "undefined") return [block];
  const wrapper = document.createElement("div");
  wrapper.innerHTML = rewriteCodeHTML(block.html);
  const paragraphBlocks = Array.from(wrapper.querySelectorAll(".Normal-Level[id]"))
    .filter((node) => String(node.textContent || "").trim());
  const noteBlocks = paragraphBlocks.length
    ? paragraphBlocks
    : Array.from(wrapper.querySelectorAll(".rbox[id]"))
      .filter((node) => String(node.textContent || "").trim());
  if (noteBlocks.length === 0) return [block];
  return noteBlocks.map((node, nodeIndex) => ({
    ...block,
    id: node.id || `${block.id || `block-${blockIndex + 1}`}-${nodeIndex + 1}`,
    html: node.outerHTML,
    plainText: String(node.textContent || "").replace(/\s+/g, " ").trim()
  }));
}

async function populateReaderSelectors(panel, reader) {
  const chapterSelect = panel.querySelector(".chapter-select");
  const sectionSelect = panel.querySelector(".section-select");
  clear(chapterSelect);
  clear(sectionSelect);
  reader.codePrefix = reader.codePrefix || "BC";

  const blankChapter = document.createElement("option");
  blankChapter.value = "";
  blankChapter.textContent = "Select a chapter";
  chapterSelect.append(blankChapter);
  const readerChapters = await fetchChapterList(reader.codePrefix);
  if (!reader.chapterID) {
    reader.chapterID = readerChapters[0]?.id || "";
  }
  readerChapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = chapter.fullTitle || chapter.displayTitle || `Chapter ${chapter.chapterNumber}`;
    option.title = option.textContent;
    chapterSelect.append(option);
  });
  chapterSelect.value = reader.chapterID || "";

  if (!reader.chapterID) {
    const blankSection = document.createElement("option");
    blankSection.value = "";
    blankSection.textContent = "Select a section";
    sectionSelect.append(blankSection);
    return;
  }

  const chapter = await fetchChapter(reader.chapterID);
  const blankSection = document.createElement("option");
  blankSection.value = "";
  blankSection.textContent = "Select a section";
  sectionSelect.append(blankSection);
  chapter.sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = sectionDisplayTitle(section.sectionNumber, section.title);
    sectionSelect.append(option);
  });
  sectionSelect.value = reader.sectionID || "";
}

async function renderSectionContent(panel, reader) {
  const content = panel.querySelector(".reader-content");
  const commentsList = panel.querySelector(".comments-list");
  content?.classList.remove("is-searching-reader");
  if (!reader.chapterID) {
    blankReader(content);
    clear(commentsList);
    return;
  }

  clear(content);
  const chapter = await fetchChapter(reader.chapterID, { includeBody: true });
  const sections = chapter.sections || [];
  const groupLabelsByFirstSection = groupLabelsForChapter(chapter);

  sections.forEach((section) => {
    const sectionWrapper = document.createElement("section");
    sectionWrapper.className = "chapter-section";
    sectionWrapper.dataset.sectionId = String(section.id);
    sectionWrapper.dataset.sectionNumber = String(section.sectionNumber || "");
    markResearchSelectable(sectionWrapper, {
      sectionID: section.id,
      sectionNumber: section.sectionNumber,
      title: section.title,
      codePrefix: reader.codePrefix,
      chapterID: reader.chapterID
    });

    const groupLabel = groupLabelsByFirstSection.get(String(section.id));
    if (groupLabel) {
      sectionWrapper.classList.add("starts-group");
      const groupHeading = document.createElement("div");
      groupHeading.className = "authored-section-label";
      groupHeading.textContent = groupLabel;
      sectionWrapper.append(groupHeading);
    }

    const sectionHeading = document.createElement("h3");
    sectionHeading.className = "reader-section-title";
    sectionHeading.textContent = sectionDisplayTitle(section.sectionNumber, section.title);
    sectionWrapper.append(sectionHeading);

    const blocks = annotatedBlocksForSection(section);
    const bookmarkedBlockIndex = isSectionSaved(section.id)
      ? Math.max(0, blocks.findIndex((block, blockIndex) => {
          const blockTarget = annotationTargetForBlock(section, block, reader, blockIndex);
          return Boolean(noteValueForTarget(blockTarget.sectionID, blockTarget.blockID).trim());
        }))
      : -1;
    blocks.forEach((block, index) => {
      const target = annotationTargetForBlock(section, block, reader, index);
      sectionWrapper.append(renderAnnotatedCodeBlock(block, section, reader, target, {
        showBookmark: index === bookmarkedBlockIndex
      }));
    });

    linkInlineCodeReferences(sectionWrapper, panel, reader);

    content.append(sectionWrapper);
  });
  // Notes now open from each block in the reader notes sheet. Do not build the
  // retired, permanently hidden sidebar editor for every block in the chapter.
  clear(commentsList);

  if (reader.sectionID) {
    requestAnimationFrame(() => {
      const behavior = reader.shouldSmoothScrollToSection ? "smooth" : "auto";
      scrollReaderContentToSection(content, reader.sectionID, behavior, reader.sectionNumber);
      const highlightQuery = reader.pendingSearchHighlightQuery || panel.dataset.pendingSearchHighlightQuery || "";
      if (highlightQuery) {
        reader.pendingSearchHighlightQuery = "";
        delete panel.dataset.pendingSearchHighlightQuery;
        window.setTimeout(() => {
          flashSearchMatchInSection(content, reader.sectionID, reader.sectionNumber, highlightQuery);
        }, behavior === "smooth" ? 520 : 0);
      }
      reader.shouldSmoothScrollToSection = false;
    });
  }
}

function scrollReaderContentToSection(content, sectionID, behavior = "auto", sectionNumber = "") {
  const idSelector = sectionID ? `[data-section-id="${CSS.escape(String(sectionID))}"]` : "";
  const numberSelector = sectionNumber ? `[data-section-number="${CSS.escape(String(sectionNumber))}"]` : "";
  const target = (idSelector ? content?.querySelector(idSelector) : null) || (numberSelector ? content?.querySelector(numberSelector) : null);
  if (!content || !target) return;
  stabilizeReaderSectionAtHeader(content, target, behavior);
}

function alignReaderSectionAfterLayout(reader) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const panel = track.querySelector(
        `.reader-panel[data-pane-id="${CSS.escape(paneIDForReader(reader))}"]`
      );
      const content = panel?.querySelector(".reader-content");
      if (!content) return;
      scrollReaderContentToSection(content, reader.sectionID, "auto", reader.sectionNumber);
    });
  });
}

async function navigateReaderToSection(panel, reader, behavior = "auto") {
  setTitle(panel, reader);
  const sectionSelect = panel.querySelector(".section-select");
  if (sectionSelect) sectionSelect.value = reader.sectionID || "";

  const content = panel.querySelector(".reader-content");
  const isSearchMode = content?.classList.contains("is-searching-reader");
  const hasRenderedTarget = reader.sectionID && (
    content?.querySelector(`[data-section-id="${CSS.escape(String(reader.sectionID))}"]`) ||
    (reader.sectionNumber
      ? content?.querySelector(`[data-section-number="${CSS.escape(String(reader.sectionNumber))}"]`)
      : null)
  );
  if (!content || isSearchMode || (reader.sectionID && !hasRenderedTarget)) {
    await renderSectionContent(panel, reader);
    return;
  }
  scrollReaderContentToSection(content, reader.sectionID, behavior, reader.sectionNumber);
}

function renderAnnotatedCodeBlock(block, section, reader, target, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "annotated-code-block";
  wrapper.dataset.sectionId = String(target.sectionID || "");
  wrapper.dataset.sectionNumber = target.sectionNumber || "";
  wrapper.dataset.sectionTitle = target.title || "";
  wrapper.dataset.blockId = target.blockID || "";
  wrapper.dataset.blockLabel = target.blockLabel || "";
  wrapper.append(renderCodeBlock(block), renderInlineCommentBox(section, reader, target, options));
  wrapper.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input, textarea, select")) return;
    if (window.getSelection && String(window.getSelection()).trim()) return;
    const panel = wrapper.closest(".reader-panel");
    openReaderNotesSheet(panel, section, reader, { target });
  });
  return wrapper;
}

function renderInlineCommentBox(section, _reader, target = annotationTargetForSection(section, _reader), options = {}) {
  const noteBody = noteValueForTarget(target.sectionID, target.blockID);
  const saved = Boolean(options.showBookmark);
  const wrapper = document.createElement("section");
  wrapper.className = "inline-comment";
  wrapper.classList.toggle("has-note", Boolean(noteBody.trim()));
  wrapper.classList.toggle("has-saved-section", saved);
  wrapper.dataset.commentSectionId = String(section.id);
  wrapper.dataset.commentBlockId = target.blockID || "";
  wrapper.dataset.researchSelectionExclude = "true";

  const button = document.createElement("span");
  button.className = "inline-comment-toggle";
  button.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>
    </svg>
    <span class="sr-only">Has note</span>
  `;
  button.setAttribute("aria-label", "Has note");
  button.setAttribute("aria-hidden", noteBody.trim() ? "false" : "true");
  button.hidden = !noteBody.trim();
  button.classList.toggle("has-comment", Boolean(noteBody.trim()));

  const bookmarkButton = document.createElement("span");
  bookmarkButton.className = "inline-bookmark-toggle";
  bookmarkButton.innerHTML = `${bookmarkIconSVG(true)}<span class="sr-only">Bookmarked</span>`;
  bookmarkButton.setAttribute("aria-label", "Bookmarked");
  bookmarkButton.setAttribute("aria-hidden", saved ? "false" : "true");
  bookmarkButton.hidden = !saved;
  bookmarkButton.classList.toggle("is-saved", saved);

  wrapper.append(button, bookmarkButton);
  return wrapper;
}

function sectionNoteKey(sectionID) {
  return String(sectionID || "");
}

function noteValueForSection(sectionID) {
  return noteValueForTarget(sectionID, "");
}

function setSectionNoteValue(sectionID, value) {
  return setAnnotationNoteValue({ sectionID, codeVersion: defaultSyncCodeVersion, blockID: "" }, value);
}

function syncReaderNoteControls(sectionID, blockID, value, options = {}) {
  const sectionKey = sectionNoteKey(sectionID);
  if (!sectionKey) return;
  const blockKey = normalizeAnnotationBlockID(blockID);
  const hasNote = Boolean(value.trim());
  const selector = `.inline-comment[data-comment-section-id="${CSS.escape(sectionKey)}"][data-comment-block-id="${CSS.escape(blockKey)}"]`;
  track.querySelectorAll(selector).forEach((wrapper) => {
    const button = wrapper.querySelector(".inline-comment-toggle");
    wrapper.classList.toggle("has-note", hasNote);
    button?.classList.toggle("has-comment", hasNote);
    if (button) {
      button.hidden = !hasNote;
      button.setAttribute("aria-hidden", hasNote ? "false" : "true");
    }
  });
  syncReaderNoteBookmarkButtons(sectionID, isSectionSaved(sectionID));
  track.querySelectorAll(`.reader-notes-sheet[data-section-id="${CSS.escape(sectionKey)}"][data-block-id="${CSS.escape(blockKey)}"]`).forEach((sheet) => {
    const input = sheet.querySelector(".reader-notes-input");
    if (input && input !== options.source) input.value = value;
  });
}

function ensureReaderNotesSheet(panel, reader) {
  let sheet = panel.querySelector(".reader-notes-sheet");
  if (sheet) return sheet;

  sheet = document.createElement("section");
  sheet.className = "reader-notes-sheet";
  sheet.hidden = true;

  const resizer = document.createElement("div");
  resizer.className = "reader-notes-resizer";
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-orientation", "horizontal");
  resizer.setAttribute("aria-label", "Resize note card");

  const header = document.createElement("header");
  header.className = "reader-notes-header";

  const bookmarkButton = document.createElement("button");
  bookmarkButton.className = "reader-notes-bookmark";
  bookmarkButton.type = "button";

  const doneButton = document.createElement("button");
  doneButton.className = "reader-notes-done";
  doneButton.type = "button";
  doneButton.textContent = "Done";
  doneButton.addEventListener("click", () => closeReaderNotesSheet(panel, reader));

  const actions = document.createElement("div");
  actions.className = "reader-notes-actions";
  actions.append(doneButton);

  header.append(bookmarkButton, actions);

  const input = document.createElement("textarea");
  input.className = "reader-notes-input";
  input.placeholder = "Add a note";
  input.addEventListener("input", () => {
    const sectionID = sheet.dataset.sectionId || "";
    const blockID = sheet.dataset.blockId || "";
    const target = sheet.__annotationTarget || { sectionID, blockID, codeVersion: defaultSyncCodeVersion };
    if (!setAnnotationNoteValue(target, input.value)) {
      input.value = noteValueForTarget(sectionID, blockID);
      return;
    }
    syncReaderNoteControls(sectionID, blockID, input.value, { source: input });
  });

  const tagsHost = document.createElement("section");
  tagsHost.className = "reader-notes-tags";

  bindReaderNotesResize(resizer, sheet, panel);
  sheet.append(resizer, header, input, tagsHost);
  panel.append(sheet);
  return sheet;
}

function removeReaderNotesProjectPicker(sheet) {
  sheet?.querySelector(".reader-notes-project-picker")?.remove();
}

async function openReaderNotesProjectPicker(sheet, sectionPayload) {
  if (!isProAccount()) {
    void presentPlanLimitNotice("Projects require Pro", "Upgrade to Pro to organize saved code in Project workspaces.");
    return;
  }
  if (!isSectionSaved(sectionPayload.sectionID)) {
    const saved = await persistSectionBookmark(sectionPayload, true);
    if (!saved) return;
    syncReaderNoteBookmarkButtons(sectionPayload.sectionID, true);
  }
  showReaderNotesProjectPicker(sheet, sectionPayload);
}

function showReaderNotesProjectPicker(sheet, sectionPayload) {
  removeReaderNotesProjectPicker(sheet);
  if (sheet.getBoundingClientRect().height < 440) {
    sheet.style.setProperty("--reader-notes-height", "440px");
  }
  const projects = activeProjectRecords(currentContentSummary().projects || []);
  const picker = document.createElement("section");
  picker.className = "reader-notes-project-picker";
  picker.setAttribute("aria-label", "Choose project folder");

  const pickerHeader = document.createElement("header");
  pickerHeader.className = "reader-notes-project-picker-header";
  const label = document.createElement("strong");
  label.textContent = "Save to project";
  const doneButton = document.createElement("button");
  doneButton.type = "button";
  doneButton.className = "reader-notes-project-done";
  doneButton.textContent = "Done";
  doneButton.addEventListener("click", () => removeReaderNotesProjectPicker(sheet));
  pickerHeader.append(label, doneButton);
  picker.append(pickerHeader);

  const projectLink = (project) => currentContentSummary().projectSections.find((item) =>
    String(item.sectionID || item.savedSectionID || item.itemID || "") === String(sectionPayload.sectionID || "") &&
    projectSectionBelongsToProject(item, project)
  );

  const setProjectButtonState = (button, selected) => {
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    const check = button.querySelector(".reader-notes-project-check");
    if (check) check.textContent = selected ? "✓" : "";
  };

  if (!projects.length) {
    const empty = document.createElement("p");
    empty.className = "reader-notes-project-empty";
    empty.textContent = "No projects yet.";
    picker.append(empty);
  }

  projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reader-notes-project-option";
    button.style.setProperty("--project-color", projectColor(project));
    const name = document.createElement("span");
    name.textContent = project.name || project.title || "Project";
    const check = document.createElement("span");
    check.className = "reader-notes-project-check";
    check.setAttribute("aria-hidden", "true");
    button.append(name, check);
    setProjectButtonState(button, Boolean(projectLink(project)));
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.classList.remove("has-error");
      const existingLink = projectLink(project);
      try {
        if (existingLink) {
          await removeSectionFromProject(project, existingLink, { removeBookmark: false });
          setProjectButtonState(button, false);
        } else {
          await persistSectionInProject(project, sectionPayload);
          setProjectButtonState(button, true);
        }
      } catch (error) {
        button.classList.add("has-error");
        button.title = error.message || "Could not update this project.";
      } finally {
        button.disabled = false;
      }
    });
    picker.append(button);
  });

  const newProjectButton = document.createElement("button");
  newProjectButton.type = "button";
  newProjectButton.className = "reader-notes-new-project";
  newProjectButton.textContent = "New project…";
  newProjectButton.addEventListener("click", () => {
    newProjectButton.hidden = true;
    const form = document.createElement("form");
    form.className = "reader-notes-new-project-form";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Project name";
    input.setAttribute("aria-label", "New project name");
    const createButton = document.createElement("button");
    createButton.type = "submit";
    createButton.textContent = "Create and save";
    form.append(input, createButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      createButton.disabled = true;
      try {
        const project = await createProjectFolder({ name: input.value.trim() });
        await persistSectionInProject(project, sectionPayload);
        showReaderNotesProjectPicker(sheet, sectionPayload);
      } catch (error) {
        createButton.disabled = false;
        createButton.title = error.message || "Could not create the project.";
      }
    });
    picker.append(form);
    input.focus();
  });
  picker.append(newProjectButton);

  const header = sheet.querySelector(".reader-notes-header");
  header?.insertAdjacentElement("afterend", picker);
}

function bindReaderNotesResize(resizer, sheet, panel) {
  resizer.addEventListener("pointerdown", (event) => {
    if (!sheet.classList.contains("is-open")) return;
    event.preventDefault();
    resizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-notes");
    sheet.classList.add("is-resizing");

    const panelBounds = panel.getBoundingClientRect();
    const sheetStyles = getComputedStyle(sheet);
    const minHeight = parseFloat(sheetStyles.getPropertyValue("--reader-notes-min-height")) || 320;
    const maxHeight = Math.max(minHeight, panelBounds.height - (parseFloat(getComputedStyle(panel).getPropertyValue("--reader-scrollbar-track-top")) || 0));

    const resize = (moveEvent) => {
      const height = panelBounds.bottom - moveEvent.clientY;
      const clampedHeight = Math.min(maxHeight, Math.max(minHeight, height));
      sheet.style.setProperty("--reader-notes-height", `${clampedHeight}px`);
    };

    const stopResize = () => {
      resizer.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-notes");
      sheet.classList.remove("is-resizing");
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    resize(event);
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  });
}

function toggleReaderNotesSheet(panel, section, reader) {
  if (!panel || !section) return;
  const sheet = panel.querySelector(".reader-notes-sheet.is-open");
  const sectionID = sectionNoteKey(section.id);
  if (sheet?.dataset.sectionId === sectionID && !sheet?.dataset.blockId) {
    closeReaderNotesSheet(panel, reader);
    return;
  }
  openReaderNotesSheet(panel, section, reader);
}

function setReaderNotesActiveTarget(panel, sectionID = "", blockID = "") {
  if (!panel) return;
  panel.querySelectorAll(".chapter-section.is-notes-active, .annotated-code-block.is-notes-active").forEach((element) => {
    element.classList.remove("is-notes-active");
  });
  const sectionKey = sectionNoteKey(sectionID);
  if (!sectionKey) return;
  const sectionElement = panel.querySelector(`.chapter-section[data-section-id="${CSS.escape(sectionKey)}"]`);
  sectionElement?.classList.add("is-notes-active");
  const blockKey = normalizeAnnotationBlockID(blockID);
  if (!blockKey) return;
  sectionElement
    ?.querySelector(`.annotated-code-block[data-block-id="${CSS.escape(blockKey)}"]`)
    ?.classList.add("is-notes-active");
}

function openReaderNotesSheet(panel, section, reader, options = {}) {
  if (!panel || !section) return;
  const sheet = ensureReaderNotesSheet(panel, reader);
  const wasOpen = sheet.classList.contains("is-open") && !sheet.hidden;
  const sectionID = sectionNoteKey(section.id);
  const target = options.target || annotationTargetForSection(section, reader);
  const blockID = normalizeAnnotationBlockID(target.blockID);
  setReaderNotesActiveTarget(panel, sectionID, blockID);

  const saved = isSectionSaved(section.id);
  const bookmarkButton = sheet.querySelector(".reader-notes-bookmark");
  const sectionPayload = {
    sectionID: section.id,
    sectionNumber: section.sectionNumber,
    title: section.title,
    codePrefix: reader?.codePrefix || "BC",
    chapterID: reader?.chapterID || "",
    chapterNumber: section.chapterNumber || ""
  };
  if (bookmarkButton) {
    bookmarkButton.innerHTML = `${bookmarkIconSVG(saved)}<span class="sr-only">${saved ? "Manage saved projects" : "Save bookmark"}</span>`;
    bookmarkButton.classList.toggle("is-saved", saved);
    bookmarkButton.setAttribute("aria-pressed", String(saved));
    bookmarkButton.setAttribute("aria-label", saved ? "Manage saved projects" : "Save bookmark");
    bookmarkButton.onclick = async () => {
      bookmarkButton.disabled = true;
      bookmarkButton.classList.remove("has-error");
      try {
        await openReaderNotesProjectPicker(sheet, sectionPayload);
        bookmarkButton.classList.add("is-saved");
        bookmarkButton.setAttribute("aria-pressed", "true");
        bookmarkButton.setAttribute("aria-label", "Manage saved projects");
        bookmarkButton.title = "Manage saved projects";
        bookmarkButton.innerHTML = `${bookmarkIconSVG(true)}<span class="sr-only">Manage saved projects</span>`;
      } catch (error) {
        bookmarkButton.title = error.message;
        bookmarkButton.classList.add("has-error");
      } finally {
        bookmarkButton.disabled = false;
      }
    };
  }

  const input = sheet.querySelector(".reader-notes-input");
  const tagsHost = sheet.querySelector(".reader-notes-tags");
  sheet.dataset.sectionId = sectionID;
  sheet.dataset.blockId = blockID;
  sheet.__annotationTarget = target;
  if (!wasOpen) sheet.style.setProperty("--reader-notes-height", "var(--reader-notes-default-height)");
  removeReaderNotesProjectPicker(sheet);
  input.value = noteValueForTarget(section.id, blockID);
  input.setAttribute("aria-label", `Note for ${sectionDisplayTitle(section.sectionNumber, section.title)}`);
  renderAnnotationTagEditor(tagsHost, target, {
    onChange: () => {
      if (state.utilities.saved) renderWorkspace();
    }
  });
  sheet.hidden = false;
  if (options.instant) {
    sheet.classList.add("is-restoring", "is-open");
    requestAnimationFrame(() => {
      sheet.classList.remove("is-restoring");
    });
    return;
  }
  requestAnimationFrame(() => {
    sheet.classList.add("is-open");
    input.focus();
  });
}

function closeReaderNotesSheet(panel, reader = null, options = {}) {
  const sheet = panel?.querySelector(".reader-notes-sheet");
  if (!sheet) return;
  sheet.classList.remove("is-open");
  setReaderNotesActiveTarget(panel);
  if (options.instant) {
    sheet.hidden = true;
    return;
  }
  window.setTimeout(() => {
    if (!sheet.classList.contains("is-open")) sheet.hidden = true;
  }, 220);
}

function syncReaderNoteBookmarkButtons(sectionID, saved) {
  const sectionKey = sectionNoteKey(sectionID);
  if (!sectionKey) return;
  const wrappers = Array.from(track.querySelectorAll(`.inline-comment[data-comment-section-id="${CSS.escape(sectionKey)}"]`));
  const bookmarkWrapper = wrappers.find((wrapper) => wrapper.classList.contains("has-note")) || wrappers[0] || null;
  wrappers.forEach((wrapper) => {
    const button = wrapper.querySelector(".inline-bookmark-toggle");
    const showBookmark = Boolean(saved && wrapper === bookmarkWrapper);
    wrapper.classList.toggle("has-saved-section", showBookmark);
    if (!button) return;
    button.classList.toggle("is-saved", showBookmark);
    button.hidden = !showBookmark;
    button.setAttribute("aria-hidden", showBookmark ? "false" : "true");
    button.setAttribute("aria-label", "Bookmarked");
    button.innerHTML = `${bookmarkIconSVG(true)}<span class="sr-only">Bookmarked</span>`;
  });
}

function sectionElementForInlineComment(commentWrapper) {
  return commentWrapper.closest(".chapter-section");
}

function syncCommentBoxHeights(content, commentsList) {
  if (!content || !commentsList) return;
  const boxes = Array.from(commentsList.querySelectorAll(".section-comment-box"));
  if (!boxes.length) return;
  const sections = Array.from(content.querySelectorAll(".chapter-section"));
  sections.forEach((section, index) => {
    const box = boxes[index];
    if (!box) return;
    box.style.minHeight = `${Math.ceil(section.getBoundingClientRect().height)}px`;
  });
}

function syncAllCommentBoxHeights() {
  requestAnimationFrame(() => {
    track.querySelectorAll(".reader-panel").forEach((panel) => {
      syncCommentBoxHeights(panel.querySelector(".reader-content"), panel.querySelector(".comments-list"));
    });
  });
}

function normalizeCommentsWidth(width) {
  const numeric = Number(width);
  if (!Number.isFinite(numeric)) return 34;
  return Math.min(58, Math.max(22, numeric));
}

function applyCommentsWidth(panel, reader) {
  const readerBody = panel.querySelector(".reader-body");
  if (!readerBody) return;
  reader.commentsWidth = normalizeCommentsWidth(reader.commentsWidth);
  readerBody.style.setProperty("--comments-width", `${reader.commentsWidth}%`);
}

function setReaderCommentsOpen(panel, reader, open) {
  const readerBody = panel.querySelector(".reader-body");
  const commentsPanel = panel.querySelector(".reader-comments");
  const commentsButton = panel.querySelector(".reader-comments-toggle");
  if (!readerBody || !commentsPanel || !commentsButton) return;

  reader.commentsOpen = Boolean(open);
  commentsButton.setAttribute("aria-pressed", String(reader.commentsOpen));
  commentsButton.title = reader.commentsOpen ? "Hide comments" : "Show comments";

  if (reader.commentsOpen) {
    commentsPanel.hidden = false;
    requestAnimationFrame(() => {
      readerBody.classList.add("comments-open");
      syncCommentBoxHeights(panel.querySelector(".reader-content"), panel.querySelector(".comments-list"));
    });
    return;
  }

  readerBody.classList.remove("comments-open");
  const hideComments = (event) => {
    if (event && event.target !== readerBody) return;
    if (!reader.commentsOpen) commentsPanel.hidden = true;
    readerBody.removeEventListener("transitionend", hideComments);
  };
  readerBody.addEventListener("transitionend", hideComments);
  window.setTimeout(hideComments, 500);
}

async function refreshReaderContent(panel, reader) {
  const saveButton = panel.querySelector(".reader-save");
  const commentsPanel = panel.querySelector(".reader-comments");
  applyCodeTheme(panel, reader);
  populateCodeSelect(panel, reader);
  resetEnhancedSelects(panel);
  await populateReaderSelectors(panel, reader);
  await renderSectionContent(panel, reader);
  applyCommentsWidth(panel, reader);
  reader.commentsOpen = false;
  panel.querySelector(".reader-body")?.classList.remove("comments-open");
  panel.querySelector(".reader-comments-toggle")?.setAttribute("hidden", "");
  panel.querySelectorAll("select").forEach(enhanceSelect);
  if (saveButton) {
    saveButton.hidden = !reader.sectionID;
    saveButton.disabled = !reader.sectionID;
  }
  if (commentsPanel) commentsPanel.hidden = true;
}

function bindCommentDividerDrag(panel, reader) {
  const readerBody = panel.querySelector(".reader-body");
  const resizer = panel.querySelector(".reader-comments-resizer");
  if (!readerBody || !resizer || panel.dataset.commentResizeBound === "true") return;
  panel.dataset.commentResizeBound = "true";

  function resize(event) {
    const bounds = readerBody.getBoundingClientRect();
    if (!bounds.width) return;
    const width = ((bounds.right - event.clientX) / bounds.width) * 100;
    reader.commentsWidth = normalizeCommentsWidth(width);
    readerBody.style.setProperty("--comments-width", `${reader.commentsWidth}%`);
    syncCommentBoxHeights(panel.querySelector(".reader-content"), panel.querySelector(".comments-list"));
  }

  const endDrag = () => {
    resizer.classList.remove("is-dragging");
    document.body.classList.remove("is-resizing-comments");
    saveWorkspaceState();
    window.removeEventListener("pointermove", resize);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  };

  resizer.addEventListener("pointerdown", (event) => {
    if (!reader.commentsOpen) return;
    event.preventDefault();
    resizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-comments");
    resize(event);
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  });
}

function bindReaderCommentScroll(panel) {
  const content = panel.querySelector(".reader-content");
  const comments = panel.querySelector(".reader-comments");
  if (!content || !comments || panel.dataset.commentScrollBound === "true") return;
  panel.dataset.commentScrollBound = "true";
  let syncing = false;

  const syncScroll = (source, target) => {
    if (syncing) return;
    syncing = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => {
      syncing = false;
    });
  };

  content.addEventListener("scroll", () => syncScroll(content, comments), { passive: true });
  comments.addEventListener("scroll", () => syncScroll(comments, content), { passive: true });
}

function updateReaderScrollIndicator(panel) {
  if (!readerPanelIntersectsTrack(panel)) {
    panel?.classList.remove("is-scrolling");
    return;
  }
  const content = panel.querySelector(".reader-content");
  const indicator = panel.querySelector(".reader-scroll-indicator");
  const thumb = panel.querySelector(".reader-scroll-thumb");
  if (!content || !indicator || !thumb) return;
  const scrollable = Math.max(0, content.scrollHeight - content.clientHeight);
  const trackHeight = indicator.clientHeight;
  if (scrollable <= 1 || trackHeight <= 0) {
    thumb.hidden = true;
    panel.classList.remove("is-scrolling");
    return;
  }
  thumb.hidden = false;
  const thumbHeight = Math.max(24, Math.round((content.clientHeight / content.scrollHeight) * trackHeight));
  const maxTop = Math.max(0, trackHeight - thumbHeight);
  const top = Math.round((content.scrollTop / scrollable) * maxTop);
  thumb.style.height = `${thumbHeight}px`;
  thumb.style.setProperty("--reader-scroll-thumb-top", `${top}px`);
}

function bindReaderScrollIndicator(panel) {
  const content = panel.querySelector(".reader-content");
  if (!content || panel.dataset.scrollIndicatorBound === "true") return;
  panel.dataset.scrollIndicatorBound = "true";
  let hideTimer = null;
  const update = () => updateReaderScrollIndicator(panel);
  const reveal = () => {
    panel.classList.add("is-scrolling");
    update();
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => panel.classList.remove("is-scrolling"), 700);
  };
  content.addEventListener("scroll", reveal, { passive: true });
  requestAnimationFrame(update);
}

function readerPanelIntersectsTrack(panel) {
  if (!panel?.isConnected) return false;
  const panelBounds = panel.getBoundingClientRect();
  const trackBounds = track.getBoundingClientRect();
  return panelBounds.width > 0
    && panelBounds.right > trackBounds.left
    && panelBounds.left < trackBounds.right;
}

let visibleReaderMetricsFrame = null;

function scheduleVisibleReaderScrollIndicatorUpdates() {
  if (visibleReaderMetricsFrame !== null) return;
  visibleReaderMetricsFrame = requestAnimationFrame(() => {
    visibleReaderMetricsFrame = null;
    track.querySelectorAll(".reader-panel").forEach(updateReaderScrollIndicator);
  });
}

function bindAllReaderCommentScroll() {
  track.querySelectorAll(".reader-panel").forEach((panel) => {
    bindReaderCommentScroll(panel);
    bindReaderScrollIndicator(panel);
    updateReaderScrollIndicator(panel);
  });
}

function renderSectionComments(commentsList, targets) {
  if (!commentsList) return;
  clear(commentsList);
  if (!targets.length) {
    const empty = document.createElement("p");
    empty.className = "comments-empty";
    empty.textContent = "";
    commentsList.append(empty);
    return;
  }

  targets.forEach((target) => {
    const item = document.createElement("article");
    item.className = "section-comment-box";
    item.dataset.sectionId = String(target.sectionID);
    item.dataset.blockId = target.blockID || "";

    const inputLabel = document.createElement("label");
    inputLabel.className = "comment-composer";
    const textarea = document.createElement("textarea");
    textarea.className = "comment-input";
    textarea.rows = 4;
    textarea.value = noteValueForTarget(target.sectionID, target.blockID);
    textarea.placeholder = "Add a note";
    textarea.setAttribute("aria-label", `Note for ${sectionDisplayTitle(target.sectionNumber, target.title)}`);
    textarea.addEventListener("input", () => {
      if (!setAnnotationNoteValue(target, textarea.value)) {
        textarea.value = noteValueForTarget(target.sectionID, target.blockID);
        return;
      }
      syncReaderNoteControls(target.sectionID, target.blockID, textarea.value, { source: textarea });
    });

    inputLabel.append(textarea);
    item.append(inputLabel);
    commentsList.append(item);
  });
}

function rewriteCodeHTML(html) {
  return rewriteStructuredCodeLinks(html)
    .replace(/src=(["'])(?:\.\.\/)+assets\/([^"']+)\1/gi, (_match, quote, fileName) => {
      return `src=${quote}/code/assets/${encodeURIComponent(fileName)}?v=${offlineFeatureMetadata.assetVersion}${quote}`;
    })
    .replace(/<\s*\/?\s*(annotationdrawer|codeoptions)\b[^>]*>/gi, "");
}

function renderCodeBlock(block) {
  if (block.kind === "image") {
    const figure = document.createElement("figure");
    figure.className = "code-media code-image";
    if (block.html) {
      figure.innerHTML = rewriteCodeHTML(block.html);
    } else if (block.imageID) {
      const image = document.createElement("img");
      image.src = `/code/assets/${encodeURIComponent(block.imageID)}?v=${offlineFeatureMetadata.assetVersion}`;
      figure.append(image);
    }
    decorateCodeHTML(figure);
    return figure;
  }

  if (block.kind === "table" || /<table\b/i.test(block.html || "")) {
    const wrapper = document.createElement("div");
    wrapper.className = "code-table";
    wrapper.innerHTML = rewriteCodeHTML(block.html || "");
    decorateCodeHTML(wrapper);
    return wrapper;
  }

  if (block.kind === "html" && block.html) {
    const wrapper = document.createElement("div");
    wrapper.className = "section-block section-html";
    wrapper.innerHTML = rewriteCodeHTML(block.html);
    decorateCodeHTML(wrapper);
    if (!wrapper.textContent.trim() && !wrapper.querySelector("img, table")) {
      wrapper.textContent = block.plainText || "";
    }
    return wrapper;
  }

  const paragraph = document.createElement("p");
  paragraph.className = "section-block";
  paragraph.textContent = block.plainText || "";
  promoteAuthoredSectionLabels(paragraph);
  return paragraph;
}

function markResearchSelectable(element, source = {}) {
  if (!element || !source.sectionID) return element;
  element.classList.add("research-selectable-text");
  element.dataset.researchSectionId = String(source.sectionID);
  element.dataset.researchSectionNumber = String(source.sectionNumber || "");
  element.dataset.researchSectionTitle = String(source.title || "Section");
  element.dataset.researchCodePrefix = String(source.codePrefix || "BC");
  element.dataset.researchChapterId = String(source.chapterID || "");
  if (source.researchSavedItemID) {
    element.dataset.researchSavedItemId = String(source.researchSavedItemID);
  }
  return element;
}

function linkInlineCodeReferences(root, panel, reader) {
  if (!root || root.dataset.inlineReferencesLinked === "true") return;
  root.dataset.inlineReferencesLinked = "true";

  root.querySelectorAll("[data-code-jump-anchor]").forEach((reference) => {
    if (reference.dataset.codeJumpBound === "true") return;
    reference.dataset.codeJumpBound = "true";
    reference.addEventListener("click", () => {
      openStructuredCodeReference(reader, reference.dataset.codeJumpAnchor, reference);
    });
  });

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim() || inlineCodeReferencePhrases(node.nodeValue).length === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      if (node.parentElement?.closest("a, button, input, textarea, select, script, style, .reader-note-control")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue || "";
    const phrases = inlineCodeReferencePhrases(text);
    if (!phrases.length) return;
    let cursor = 0;
    const fragment = document.createDocumentFragment();
    phrases.forEach((phrase) => {
      if (phrase.start > cursor) fragment.append(document.createTextNode(text.slice(cursor, phrase.start)));
      let phraseCursor = phrase.start;
      const codePrefix = phrase.codePrefix || reader.codePrefix || "BC";
      phrase.references.forEach((target) => {
        if (target.start > phraseCursor) {
          fragment.append(document.createTextNode(text.slice(phraseCursor, target.start)));
        }
        const reference = document.createElement("button");
        reference.type = "button";
        reference.className = "inline-code-reference";
        reference.textContent = text.slice(target.start, target.end);
        reference.setAttribute("aria-label", `Open ${codePrefix} Section ${target.sectionNumber}`);
        reference.addEventListener("click", () => {
          openInlineCodeReference(reader, codePrefix, target.sectionNumber, reference);
        });
        fragment.append(reference);
        phraseCursor = target.end;
      });
      if (phraseCursor < phrase.end) {
        fragment.append(document.createTextNode(text.slice(phraseCursor, phrase.end)));
      }
      cursor = phrase.end;
    });
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    textNode.replaceWith(fragment);
  });
}

function normalizedInlineSectionNumber(value) {
  return String(value || "").replace(/^Section\s+/i, "").replace(/\([^)]+\)/g, "").trim().toLowerCase();
}

function inlineReferenceSearchResult(results, codePrefix, sectionNumber) {
  const targetNumber = normalizedInlineSectionNumber(sectionNumber);
  const codeResults = (results || []).filter((item) =>
    String(item.codePrefix || "BC").toUpperCase() === codePrefix
  );
  const exact = codeResults.find((item) => normalizedInlineSectionNumber(item.sectionNumber) === targetNumber);
  if (exact) return exact;
  return codeResults
    .filter((item) => normalizedInlineSectionNumber(item.sectionNumber).startsWith(`${targetNumber}.`))
    .sort((left, right) =>
      normalizedInlineSectionNumber(left.sectionNumber).length - normalizedInlineSectionNumber(right.sectionNumber).length ||
      String(left.sectionNumber).localeCompare(String(right.sectionNumber), undefined, { numeric: true, sensitivity: "base" })
    )[0] || null;
}

async function resolveInlineCodeSection(codePrefix, sectionNumber) {
  const payload = await api(`/code/search?q=${encodeURIComponent(sectionNumber)}&code=${encodeURIComponent(codePrefix)}&limit=25`);
  return inlineReferenceSearchResult(payload.results, codePrefix, sectionNumber);
}

async function openReferenceInAdjacentReader(sourceReader, detail) {
  const targetReader = newReaderState(readerFieldsForSectionDetail(detail));
  state.readers.push(targetReader);
  placePaneAfter(paneIDForReader(sourceReader), paneIDForReader(targetReader));
  if (targetReader.sectionID) updateBrowserSectionURL(targetReader.sectionID);
  scheduleContinuitySync(targetReader);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForReader(targetReader)] });
  if (targetReader.sectionID) alignReaderSectionAfterLayout(targetReader);
  scrollPaneIntoView(paneIDForReader(targetReader));
}

async function openInlineCodeReference(reader, codePrefix, sectionNumber, trigger) {
  if (!sectionNumber || !trigger) return;
  const normalizedPrefix = String(codePrefix || reader.codePrefix || "BC").toUpperCase();
  trigger.disabled = true;
  trigger.setAttribute("aria-busy", "true");
  try {
    const result = await resolveInlineCodeSection(normalizedPrefix, sectionNumber);
    if (!result) {
      trigger.title = `Section ${sectionNumber} was not found in ${normalizedPrefix}.`;
      return;
    }
    await openReferenceInAdjacentReader(reader, searchResultDetail(result));
  } finally {
    if (trigger.isConnected) {
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
    }
  }
}

async function openStructuredCodeReference(reader, anchor, trigger) {
  const target = parseCodeJumpAnchor(anchor);
  if (!target || !trigger) return;
  if (target.kind === "section") {
    await openInlineCodeReference(reader, target.codePrefix, target.sectionNumber, trigger);
    return;
  }

  trigger.disabled = true;
  trigger.setAttribute("aria-busy", "true");
  try {
    const chapter = chapters.find((item) =>
      String(item.codePrefix || "").toUpperCase() === target.codePrefix &&
      String(item.chapterNumber || "").trim().toUpperCase() === target.chapterNumber
    );
    if (!chapter) {
      trigger.title = `${codeDisplayLabel(target.codePrefix)} ${target.targetKind === "appendix" ? "Appendix" : "Chapter"} ${target.chapterNumber} was not found.`;
      return;
    }
    await openReferenceInAdjacentReader(reader, {
      codePrefix: target.codePrefix,
      chapterID: chapter.id,
      chapterNumber: chapter.chapterNumber,
      sectionID: "",
      sectionNumber: "",
      title: chapter.fullTitle || chapter.displayTitle || chapter.title || "Reader"
    });
  } finally {
    if (trigger.isConnected) {
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
    }
  }
}

function plainTextFromHTML(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = rewriteCodeHTML(html || "");
  return wrapper.textContent || "";
}

function plainTextForSearchBlock(block) {
  if (block?.plainText) return block.plainText;
  if (block?.html) return plainTextFromHTML(block.html);
  return "";
}

function snippetForMatch(value, query) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const needle = query.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(needle);
  if (index === -1) return text.slice(0, 220);
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + needle.length + 150);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

async function renderReaderInternalSearchResults(panel, reader, query) {
  const content = panel.querySelector(".reader-content");
  if (!content) return;
  clear(content);
  content.classList.add("is-searching-reader");
  content.scrollTop = 0;

  const needle = query.trim().toLowerCase();
  const searchToken = `${Date.now()}:${query}`;
  panel.dataset.readerSearchToken = searchToken;
  if (needle.length < 2 || !reader.chapterID) return;

  const chapter = await fetchChapter(reader.chapterID, { includeBody: true });
  if (!panel.isConnected || panel.dataset.readerSearchToken !== searchToken) return;

  const results = document.createElement("section");
  results.className = "reader-internal-results";
  const matches = [];
  (chapter.sections || []).forEach((section) => {
    const title = sectionDisplayTitle(section.sectionNumber, section.title);
    const body = (section.blocks || []).map(plainTextForSearchBlock).join(" ");
    if (`${title} ${body}`.toLowerCase().includes(needle)) {
      matches.push({ section, title, body });
    }
  });

  matches.forEach(({ section, title, body }) => {
    const row = document.createElement("button");
    row.className = "reader-internal-result";
    row.type = "button";

    const heading = document.createElement("strong");
    appendHighlighted(heading, title, query);

    const snippet = document.createElement("p");
    appendHighlighted(snippet, snippetForMatch(body || section.title, query), query);

    row.append(heading, snippet);
    row.addEventListener("click", async () => {
      const searchBox = panel.querySelector(".reader-internal-search");
      const searchInput = panel.querySelector(".reader-internal-search-input");
      const searchButton = panel.querySelector(".reader-internal-search-toggle");
      panel.dataset.readerSearchToken = `selected:${Date.now()}`;
      reader.sectionID = section.id;
      reader.sectionNumber = section.sectionNumber || "";
      reader.title = section.title || "Reader";
      reader.internalSearchQuery = query;
      reader.pendingSearchHighlightQuery = query;
      panel.dataset.pendingSearchHighlightQuery = query;
      reader.shouldSmoothScrollToSection = true;
      updateBrowserSectionURL(reader.sectionID);
      scheduleContinuitySync(reader);
      if (searchBox) searchBox.hidden = true;
      searchButton?.setAttribute("aria-pressed", "false");
      saveWorkspaceState();
      await renderSectionContent(panel, reader);
    });
    results.append(row);
  });

  content.append(results);
}

function decorateCodeHTML(root) {
  root.querySelectorAll("script, style, annotationdrawer, codeoptions").forEach((node) => node.remove());
  normalizeCodeTables(root);
  promoteAuthoredSectionLabels(root);
  root.querySelectorAll("img").forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = image.alt || "";
  });
  root.querySelectorAll("br").forEach((breakElement) => {
    if (breakElement.textContent) {
      breakElement.textContent = "";
    }
  });
}

function groupLabelsForChapter(chapter) {
  const labels = new Map();
  (chapter.groups || []).forEach((group) => {
    const firstSection = (group.sections || [])[0];
    if (!firstSection?.id || !group.headerLine) return;
    const label = [group.headerLine, group.headingLine].filter(Boolean).join(": ");
    labels.set(String(firstSection.id), label.toUpperCase());
  });
  return labels;
}

function promoteAuthoredSectionLabels(root) {
  const labelPattern = /(^|\n)\s*((?:section)\s+(?:BC|AC|PC|MC|FGC)\s+\d+[A-Z]?(?::\s*[^\n]+)?)/gi;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (labelPattern.test(currentNode.nodeValue || "")) {
      textNodes.push(currentNode);
    }
    labelPattern.lastIndex = 0;
    currentNode = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue || "";
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(labelPattern, (match, lineBreak, label, offset) => {
      if (offset > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, offset)));
      }
      if (lineBreak) {
        fragment.append(document.createTextNode(lineBreak));
      }
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.replaceWith(fragment);
  });
}

function normalizeCodeTables(root) {
  root.querySelectorAll("scrolltable").forEach((scrollTable) => {
    const bodyTable =
      scrollTable.querySelector(".xsl-table--body table") ||
      scrollTable.querySelector(".xsl-table:not(.xsl-table--header) table") ||
      Array.from(scrollTable.querySelectorAll("table")).at(-1);

    if (bodyTable) {
      scrollTable.replaceWith(bodyTable);
    } else {
      scrollTable.replaceWith(...Array.from(scrollTable.childNodes));
    }
  });

  root.querySelectorAll(".xsl-table--header").forEach((headerTable) => headerTable.remove());
  root.querySelectorAll(".xsl-table--body, .xsl-table").forEach((tableShell) => {
    const nestedTable = tableShell.matches("table") ? tableShell : tableShell.querySelector(":scope > table");
    if (nestedTable) {
      tableShell.replaceWith(nestedTable);
    } else if (!tableShell.textContent.trim()) {
      tableShell.remove();
    }
  });

  root.querySelectorAll("table").forEach((table) => {
    removeEmptyTableFooters(table);
    removeRepeatedLeadingRows(table);
  });
}

function removeEmptyTableFooters(table) {
  Array.from(table.tFoot?.rows || []).forEach((row) => {
    const hasContent = Array.from(row.cells || []).some((cell) => normalizeTableCellText(cell.textContent));
    if (!hasContent) {
      row.remove();
    }
  });
  if (table.tFoot && !table.tFoot.rows.length) {
    table.tFoot.remove();
  }
}

function removeRepeatedLeadingRows(table) {
  const rows = Array.from(table.rows || []);
  if (rows.length < 2) return;

  for (let groupSize = Math.min(6, Math.floor(rows.length / 2)); groupSize >= 1; groupSize -= 1) {
    const firstGroup = rows.slice(0, groupSize);
    const secondGroup = rows.slice(groupSize, groupSize * 2);
    if (!firstGroup.length || !secondGroup.length) continue;
    if (!firstGroup.some(isHeaderLikeTableRow)) continue;

    const firstSignature = firstGroup.map(tableRowSignature).join("||");
    const secondSignature = secondGroup.map(tableRowSignature).join("||");
    if (firstSignature !== secondSignature) continue;

    firstGroup.forEach((row) => row.remove());
    return;
  }
}

function tableRowSignature(row) {
  return Array.from(row.cells || [])
    .map((cell) => {
      const text = normalizeTableCellText(cell.textContent);
      return `${cell.tagName}:${cell.colSpan || 1}:${cell.rowSpan || 1}:${text}`;
    })
    .join("|");
}

function normalizeTableCellText(text) {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isHeaderLikeTableRow(row) {
  const cells = Array.from(row.cells || []);
  if (!cells.length) return false;
  if (cells.some((cell) => cell.tagName === "TH")) return true;
  return cells.every((cell) => {
    const text = normalizeTableCellText(cell.textContent);
    return text && text.length <= 90 && !/^\d+(?:\.\d+)*\b/.test(text);
  });
}

async function renderReader(reader, options = {}) {
  const panel = readerTemplate.content.firstElementChild.cloneNode(true);
  const selector = panel.querySelector(".selector-stack");
  const closeButton = panel.querySelector(".reader-close");
  const commentsButton = panel.querySelector(".reader-comments-toggle");
  const decreaseTextButton = panel.querySelector(".reader-text-decrease");
  const increaseTextButton = panel.querySelector(".reader-text-increase");
  const decreaseSpacingButton = panel.querySelector(".reader-spacing-decrease");
  const increaseSpacingButton = panel.querySelector(".reader-spacing-increase");
  const typographyToggle = panel.querySelector(".reader-typography-toggle");
  const typographyTools = panel.querySelector(".reader-typography-tools");
  const internalSearchButton = panel.querySelector(".reader-internal-search-toggle");
  const internalSearchBox = panel.querySelector(".reader-internal-search");
  const internalSearchInput = panel.querySelector(".reader-internal-search-input");
  const internalSearchClearButton = panel.querySelector(".reader-internal-search-clear");
  const readerBody = panel.querySelector(".reader-body");
  const commentsPanel = panel.querySelector(".reader-comments");
  const codeSelect = panel.querySelector(".code-select");
  const chapterSelect = panel.querySelector(".chapter-select");
  const sectionSelect = panel.querySelector(".section-select");

  panel.dataset.readerId = reader.id;
  reader.codePrefix = reader.codePrefix || "BC";
  applyCodeTheme(panel, reader);
  applyPaneWeight(panel, paneIDForReader(reader, options));
  applyReaderTextSize(panel, reader);
  applyReaderSpacing(panel, reader);
  selector.hidden = false;
  setTitle(panel, reader);
  reader.commentsOpen = false;
  applyCommentsWidth(panel, reader);
  readerBody.classList.remove("comments-open");
  commentsPanel.hidden = true;
  commentsButton.hidden = true;
  internalSearchBox.hidden = true;
  internalSearchInput.value = reader.internalSearchQuery || "";
  internalSearchClearButton.hidden = !internalSearchInput.value.trim();
  if (options.isSearchResult) {
    closeButton.hidden = false;
  } else {
    closeButton.hidden = state.readers.length <= 1;
  }

  populateCodeSelect(panel, reader);
  decreaseTextButton?.addEventListener("click", () => changeReaderTextSize(panel, reader, -1));
  increaseTextButton?.addEventListener("click", () => changeReaderTextSize(panel, reader, 1));
  decreaseSpacingButton?.addEventListener("click", () => changeReaderSpacing(panel, reader, -0.1));
  increaseSpacingButton?.addEventListener("click", () => changeReaderSpacing(panel, reader, 0.1));
  typographyToggle?.addEventListener("click", () => {
    const willOpen = typographyTools.hidden;
    typographyTools.hidden = !willOpen;
    typographyToggle.setAttribute("aria-expanded", String(willOpen));
    typographyToggle.title = willOpen ? "Hide text and spacing controls" : "Show text and spacing controls";
    typographyToggle.setAttribute("aria-label", typographyToggle.title);
  });
  codeSelect.addEventListener("change", async () => {
    closeReaderNotesSheet(panel, reader, { instant: true });
    reader.codePrefix = codeSelect.value || "BC";
    applyCodeTheme(panel, reader);
    reader.chapterID = await firstChapterIDForCode(reader.codePrefix);
    reader.sectionID = "";
    reader.sectionNumber = "";
    reader.title = "Reader";
    saveWorkspaceState();
    scheduleContinuitySync(reader);
    await refreshReaderContent(panel, reader);
  });

  internalSearchButton.addEventListener("click", async () => {
    const willOpen = internalSearchBox.hidden;
    internalSearchBox.hidden = !willOpen;
    internalSearchButton.setAttribute("aria-pressed", String(willOpen));
    if (willOpen) {
      internalSearchInput.value = reader.internalSearchQuery || "";
      internalSearchClearButton.hidden = !internalSearchInput.value.trim();
      internalSearchInput.focus();
      await renderReaderInternalSearchResults(panel, reader, internalSearchInput.value);
      return;
    }
    await renderSectionContent(panel, reader);
  });

  internalSearchInput.addEventListener("input", () => {
    reader.internalSearchQuery = internalSearchInput.value;
    internalSearchClearButton.hidden = !internalSearchInput.value.trim();
    saveWorkspaceState();
    clearTimeout(readerSearchTimers.get(reader.id));
    readerSearchTimers.set(reader.id, window.setTimeout(() => {
      renderReaderInternalSearchResults(panel, reader, internalSearchInput.value);
    }, readerInternalSearchDelayMS));
  });

  internalSearchClearButton.addEventListener("click", () => {
    reader.internalSearchQuery = "";
    internalSearchInput.value = "";
    internalSearchClearButton.hidden = true;
    saveWorkspaceState();
    void renderReaderInternalSearchResults(panel, reader, "");
    internalSearchInput.focus();
  });

  closeButton.addEventListener("click", () => {
    if (options.isSearchResult) {
      state.searchResultReader = null;
      state.sectionDetail = null;
      state.sectionDetails = {};
    } else {
      state.readers = state.readers.filter((item) => item.id !== reader.id);
      Object.keys(searchLinkedReadersBySearch()).forEach((searchID) => {
        if (state.searchLinkedReaders[searchID] === reader.id) delete state.searchLinkedReaders[searchID];
      });
      if (state.readers.length === 0) {
        state.readers = [newReaderState()];
      }
    }
    saveWorkspaceState();
    void transitionWorkspace("utility");
  });

  chapterSelect.addEventListener("change", async () => {
    closeReaderNotesSheet(panel, reader, { instant: true });
    reader.chapterID = chapterSelect.value;
    state.recentChaptersByCode = state.recentChaptersByCode || {};
    if (reader.chapterID) {
      state.recentChaptersByCode[reader.codePrefix || "BC"] = reader.chapterID;
    }
    reader.sectionID = "";
    reader.sectionNumber = "";
    reader.title = "Reader";
    saveWorkspaceState();
    scheduleContinuitySync(reader);
    await refreshReaderContent(panel, reader);
  });

  sectionSelect.addEventListener("change", async () => {
    reader.sectionID = sectionSelect.value;
    if (reader.sectionID) {
      const chapter = await fetchChapter(reader.chapterID);
      const summary = sectionTitleFromID(reader.sectionID, chapter);
      reader.sectionNumber = summary?.sectionNumber || "";
      reader.title = summary?.title || "Reader";
      updateBrowserSectionURL(reader.sectionID);
    }
    saveWorkspaceState();
    scheduleContinuitySync(reader);
    await navigateReaderToSection(panel, reader);
  });

  if (options.isSearchResult && !reader.sectionID) {
    blankReader(panel.querySelector(".reader-content"));
  } else {
    await populateReaderSelectors(panel, reader);
    await renderSectionContent(panel, reader);
  }

  return panel;
}

function renderSearchPlaceholder(results, message) {
  clear(results);
  const wrapper = document.createElement("section");
  wrapper.className = "reader-empty";
  const heading = document.createElement("h3");
  heading.textContent = message.title;
  const paragraph = document.createElement("p");
  paragraph.textContent = message.body;
  wrapper.append(heading, paragraph);
  results.append(wrapper);
}

function recordRecentSearch(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return;
  state.recentSearches = normalizeSearchHistory([
    trimmed,
    ...(state.recentSearches || []).filter((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0)
  ], 10);
  state.recentActivityUpdatedAt = new Date().toISOString();
  saveWorkspaceState();
  scheduleRecentSearchContinuitySync();
}

function isSearchPinned(query) {
  const trimmed = String(query || "").trim();
  return Boolean(trimmed) && (state.pinnedSearches || []).some((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) === 0);
}

function pinSearch(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed || isSearchPinned(trimmed)) return;
  state.pinnedSearches = normalizeSearchHistory([trimmed, ...(state.pinnedSearches || [])]);
  saveWorkspaceState();
}

function unpinSearch(query) {
  const trimmed = String(query || "").trim();
  state.pinnedSearches = (state.pinnedSearches || []).filter((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0);
  saveWorkspaceState();
}

function removeRecentSearch(query) {
  const trimmed = String(query || "").trim();
  state.recentSearches = (state.recentSearches || []).filter((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0);
  state.recentActivityUpdatedAt = new Date().toISOString();
  saveWorkspaceState();
  scheduleRecentSearchContinuitySync();
}

function searchRecentlyViewedEntries() {
  const account = activeAccount();
  const pendingRecord = [...(state.syncOutbox || [])].reverse()
    .filter((entry) => !account || entry.accountUserID === account.userID)
    .map((entry) => mutationKindAndRecord(entry.mutation))
    .find(({ kind }) => kind === "continuity")?.record;
  const syncedEntries = continuityRecentEntries(pendingRecord?.values || syncedContent?.summary?.latestContinuity?.values || {});
  const entries = [...(state.recentlyViewedSections || [])];
  syncedEntries.forEach((entry) => {
    if (!entries.some((candidate) => Number(candidate?.sectionID) === Number(entry?.sectionID))) entries.push(entry);
  });
  return entries.filter((entry) => Number(entry?.sectionID) > 0).slice(0, 20);
}

function searchHistoryIconSVG(kind) {
  if (kind === "pin") {
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3 21 10l-3 1-4 4-1 6-2-2 1-5-5-5-4 1 7-7 4 0Z"></path></svg>`;
  }
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l3 2"></path></svg>`;
}

function updateSearchDock(panel, instance, resultCount = null) {
  const query = String(instance?.query || "").trim();
  const selectedPrefixes = normalizeSearchCodeFilters(instance?.codeFilters);
  const filterRail = panel.querySelector(".search-code-filter");
  const summary = panel.querySelector(".search-result-summary");
  const summaryCopy = panel.querySelector(".search-result-summary-copy");
  const allCodesButton = panel.querySelector(".search-all-codes");
  const clearButton = panel.querySelector(".search-clear-button");
  filterRail.hidden = !query;
  clearButton.hidden = !query;
  summary.hidden = !query || resultCount === null;
  allCodesButton.hidden = selectedPrefixes.length === 0;
  if (resultCount !== null) {
    const scope = selectedPrefixes.length === 0
      ? "All Codes"
      : selectedPrefixes.length === 1
        ? codeDisplayLabel(selectedPrefixes[0])
        : `${selectedPrefixes.length} code books`;
    summaryCopy.textContent = `${resultCount.toLocaleString()} ${resultCount === 1 ? "result" : "results"} in ${scope}`;
  }
}

function renderSearchHistory(panel, instance) {
  const results = panel.querySelector(".search-results");
  clear(results);
  results.classList.add("is-history");
  const recentSections = searchRecentlyViewedEntries();
  const pinned = normalizeSearchHistory(state.pinnedSearches);
  const recentQueries = normalizeSearchHistory(state.recentSearches, 10).filter((query) => !isSearchPinned(query));

  if (recentSections.length) {
    const section = document.createElement("section");
    section.className = "search-history-section search-jump-section";
    const label = document.createElement("p");
    label.className = "section-label search-history-label";
    label.textContent = "Jump Back In";
    const pages = document.createElement("div");
    pages.className = "search-jump-pages";
    const pageCount = Math.ceil(recentSections.length / 4);
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = document.createElement("div");
      page.className = "search-jump-page";
      recentSections.slice(pageIndex * 4, pageIndex * 4 + 4).forEach((entry) => {
        const tile = document.createElement("article");
        tile.className = `search-jump-tile code-theme-${codeTheme(entry.codePrefix || "BC")}`;
        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "search-jump-open";
        const number = document.createElement("span");
        number.className = "search-jump-number";
        number.textContent = entry.sectionNumber || "Section";
        const title = document.createElement("strong");
        title.textContent = entry.title || "Section";
        const preview = document.createElement("span");
        preview.textContent = entry.previewText || entry.chapterTitle || "";
        if (entry.previewText) markResearchSelectable(preview, entry);
        const code = document.createElement("small");
        code.textContent = entry.codeSectionName || codeDisplayLabel(entry.codePrefix || "BC");
        openButton.append(number, title, preview, code);
        openButton.addEventListener("click", () => {
          if (window.getSelection && String(window.getSelection()).trim()) return;
          openSectionDetail(instance.id, entry);
        });
        const bookmarkButton = document.createElement("button");
        bookmarkButton.type = "button";
        bookmarkButton.className = "search-jump-bookmark";
        const syncBookmarkButton = () => {
          const saved = isSectionSaved(entry.sectionID);
          bookmarkButton.classList.toggle("is-saved", saved);
          bookmarkButton.setAttribute("aria-pressed", String(saved));
          bookmarkButton.setAttribute("aria-label", saved ? "Remove bookmark" : "Bookmark section");
          bookmarkButton.innerHTML = bookmarkIconSVG(saved);
        };
        syncBookmarkButton();
        bookmarkButton.addEventListener("click", async () => {
          bookmarkButton.disabled = true;
          await persistSectionBookmark(entry, !isSectionSaved(entry.sectionID));
          syncBookmarkButton();
          bookmarkButton.disabled = false;
        });
        tile.append(openButton, bookmarkButton);
        page.append(tile);
      });
      pages.append(page);
    }
    section.append(label, pages);
    if (pageCount > 1) {
      const dots = document.createElement("div");
      dots.className = "search-jump-dots";
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "search-jump-dot";
        dot.setAttribute("aria-label", `Show recent sections page ${pageIndex + 1}`);
        dot.setAttribute("aria-pressed", String(pageIndex === 0));
        dot.addEventListener("click", () => pages.scrollTo({ left: pageIndex * pages.clientWidth, behavior: "smooth" }));
        dots.append(dot);
      }
      pages.addEventListener("scroll", () => {
        const activeIndex = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
        dots.querySelectorAll(".search-jump-dot").forEach((dot, index) => dot.setAttribute("aria-pressed", String(index === activeIndex)));
      }, { passive: true });
      section.append(dots);
    }
    results.append(section);
  }

  const appendHistorySection = (title, queries, pinnedSection) => {
    if (!queries.length) return;
    const section = document.createElement("section");
    section.className = "search-history-section";
    section.classList.toggle("is-pinned", pinnedSection);
    const label = document.createElement("p");
    label.className = "section-label search-history-label";
    label.textContent = title;
    section.append(label);
    queries.forEach((query) => {
      const row = document.createElement("article");
      row.className = "search-history-row";
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className = "search-history-apply";
      applyButton.innerHTML = `${searchHistoryIconSVG(pinnedSection ? "pin" : "recent")}<span></span>`;
      applyButton.querySelector("span").textContent = query;
      applyButton.addEventListener("click", () => {
        instance.query = query;
        panel.querySelector(".search-input").value = query;
        saveWorkspaceState();
        updateSearchDock(panel, instance);
        renderSearchResults(panel, instance);
      });
      const pinButton = document.createElement("button");
      pinButton.type = "button";
      pinButton.className = `search-history-action${pinnedSection ? " is-active" : ""}`;
      pinButton.setAttribute("aria-label", pinnedSection ? "Unpin search" : "Pin search");
      pinButton.innerHTML = searchHistoryIconSVG("pin");
      pinButton.addEventListener("click", () => {
        if (pinnedSection) unpinSearch(query);
        else pinSearch(query);
        renderSearchHistory(panel, instance);
      });
      row.append(applyButton, pinButton);
      if (!pinnedSection) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "search-history-action";
        removeButton.setAttribute("aria-label", "Remove recent search");
        removeButton.innerHTML = circleXIconSVG();
        removeButton.addEventListener("click", () => {
          removeRecentSearch(query);
          renderSearchHistory(panel, instance);
        });
        row.append(removeButton);
      }
      section.append(row);
    });
    results.append(section);
  };

  appendHistorySection("Pinned", pinned, true);
  appendHistorySection("Recent Searches", recentQueries, false);
}

function bindHorizontalWheelScroll(element) {
  if (!element || element.dataset.horizontalWheelBound === "true") return;
  element.dataset.horizontalWheelBound = "true";
  element.addEventListener(
    "wheel",
    (event) => {
      const canScroll = element.scrollWidth > element.clientWidth;
      if (!canScroll) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      const nextLeft = element.scrollLeft + delta;
      const maxLeft = element.scrollWidth - element.clientWidth;
      const isAtStart = element.scrollLeft <= 0;
      const isAtEnd = element.scrollLeft >= maxLeft - 1;
      if ((delta < 0 && isAtStart) || (delta > 0 && isAtEnd)) return;
      event.preventDefault();
      element.scrollLeft = Math.max(0, Math.min(maxLeft, nextLeft));
    },
    { passive: false }
  );
}

async function renderSearch(instance) {
  const searchInstance = normalizeSearchInstance(instance);
  const paneID = paneIDForUtilityInstance(searchInstance);
  const panel = searchTemplate.content.firstElementChild.cloneNode(true);
  const input = panel.querySelector(".search-input");
  const clearButton = panel.querySelector(".search-clear-button");
  const allCodesButton = panel.querySelector(".search-all-codes");
  const filterRail = panel.querySelector(".search-code-filter");
  applyPaneWeight(panel, paneID);
  input.value = searchInstance.query || "";
  renderSearchCodeFilter(filterRail, panel, searchInstance);
  bindHorizontalWheelScroll(filterRail);
  updateSearchDock(panel, searchInstance);

  input.addEventListener("input", () => {
    searchInstance.query = input.value;
    const details = sectionDetailsBySearch();
    if (!searchInstance.query.trim() && details[searchInstance.id]) {
      delete details[searchInstance.id];
      void transitionWorkspace("utility");
    }
    saveWorkspaceState();
    clearTimeout(searchTimers.get(paneID));
    searchTimers.set(paneID, setTimeout(() => {
      renderSearchResults(panel, searchInstance);
    }, 250));
    updateSearchDock(panel, searchInstance);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") recordRecentSearch(searchInstance.query);
  });

  clearButton.addEventListener("click", () => {
    searchInstance.query = "";
    input.value = "";
    saveWorkspaceState();
    updateSearchDock(panel, searchInstance);
    renderSearchHistory(panel, searchInstance);
    input.focus();
  });

  allCodesButton.addEventListener("click", () => {
    searchInstance.codeFilters = [];
    saveWorkspaceState();
    updateSearchCodeFilterStates(filterRail, searchInstance);
    renderSearchResults(panel, searchInstance);
  });

  await loadSyncedContent();
  await renderSearchResults(panel, searchInstance);
  return panel;
}

function renderSearchCodeFilter(filterRail, panel, instance, renderOptions = {}) {
  const searchInstance = normalizeSearchInstance(instance);
  const previousLeft = renderOptions.preserveScroll ? filterRail.scrollLeft : 0;
  clear(filterRail);
  const options = searchCodeFilterOptions();
  const validPrefixes = new Set(options.map((option) => option.prefix));
  const normalizedFilters = normalizeSearchCodeFilters(searchInstance.codeFilters);
  searchInstance.codeFilters = normalizedFilters.filter((prefix) => validPrefixes.has(prefix));
  if (searchInstance.codeFilters.length !== normalizedFilters.length) {
    saveWorkspaceState();
  }
  options.forEach((option) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "search-filter-chip";
    chip.textContent = option.label;
    chip.dataset.prefix = option.prefix;
    if (option.prefix !== "ALL") {
      chip.classList.add(`code-theme-${codeTheme(option.prefix)}`);
    }
    const isAll = option.prefix === "ALL";
    const isSelected = isAll ? searchInstance.codeFilters.length === 0 : searchInstance.codeFilters.includes(option.prefix);
    chip.setAttribute("aria-pressed", String(isSelected));
    chip.addEventListener("click", () => {
      if (isAll) {
        searchInstance.codeFilters = [];
      } else {
        const selected = new Set(normalizeSearchCodeFilters(searchInstance.codeFilters));
        if (selected.has(option.prefix)) {
          selected.delete(option.prefix);
        } else {
          selected.add(option.prefix);
        }
        searchInstance.codeFilters = Array.from(selected);
      }
      saveWorkspaceState();
      updateSearchCodeFilterStates(filterRail, searchInstance);
      updateSearchDock(panel, searchInstance);
      renderSearchResults(panel, searchInstance);
    });
    filterRail.append(chip);
  });
  if (renderOptions.preserveScroll) {
    const restoredLeft = Math.min(previousLeft, filterRail.scrollWidth - filterRail.clientWidth);
    filterRail.scrollLeft = restoredLeft;
    requestAnimationFrame(() => {
      filterRail.scrollLeft = restoredLeft;
    });
  }
}

function updateSearchCodeFilterStates(filterRail, instance) {
  const selectedFilters = normalizeSearchCodeFilters(instance?.codeFilters);
  filterRail.querySelectorAll(".search-filter-chip").forEach((chip) => {
    const prefix = chip.dataset.prefix || "ALL";
    const isSelected = prefix === "ALL" ? selectedFilters.length === 0 : selectedFilters.includes(prefix);
    chip.setAttribute("aria-pressed", String(isSelected));
  });
}

async function renderSearchResults(panel, instance) {
  const searchInstance = normalizeSearchInstance(instance);
  const results = panel.querySelector(".search-results");
  const query = searchInstance.query.trim();
  const selectedPrefixes = normalizeSearchCodeFilters(searchInstance.codeFilters);
  results.classList.remove("is-history");
  updateSearchDock(panel, searchInstance);
  if (query.length < 2) {
    if (!query) renderSearchHistory(panel, searchInstance);
    else renderSearchPlaceholder(results, { title: "Keep typing", body: "Enter at least two characters to search the code text." });
    return;
  }

  renderSearchPlaceholder(results, { title: "Searching", body: "Checking section titles and code text." });
  const codeQuery = selectedPrefixes.length ? `&code=${encodeURIComponent(selectedPrefixes.join(","))}` : "";
  const payload = await api(
    `/code/search?q=${encodeURIComponent(query)}${codeQuery}&limit=${encodeURIComponent(String(maxRenderedSearchResults))}`
  );
  if (
    searchInstance.query.trim() !== query ||
    normalizeSearchCodeFilters(searchInstance.codeFilters).join(",") !== selectedPrefixes.join(",")
  ) {
    return;
  }
  clear(results);

  const filteredResults = (payload.results || []).filter((result) =>
    (selectedPrefixes.length === 0 || selectedPrefixes.includes(result.codePrefix || "BC")) &&
    searchResultMatchesExactQuery(result, query)
  );

  if (filteredResults.length === 0) {
    updateSearchDock(panel, searchInstance, 0);
    const scope = selectedPrefixes.length ? selectedPrefixes.join(", ") : "all codes";
    renderSearchPlaceholder(results, { title: "No results", body: `Nothing matched in ${scope}. Try a shorter phrase or an exact section number.` });
    if (selectedPrefixes.length) {
      const showAllButton = document.createElement("button");
      showAllButton.type = "button";
      showAllButton.className = "ghost-button search-empty-action";
      showAllButton.textContent = "Search all codes";
      showAllButton.addEventListener("click", () => {
        searchInstance.codeFilters = [];
        saveWorkspaceState();
        updateSearchCodeFilterStates(panel.querySelector(".search-code-filter"), searchInstance);
        updateSearchDock(panel, searchInstance);
        renderSearchResults(panel, searchInstance);
      });
      results.querySelector(".reader-empty")?.append(showAllButton);
    }
    return;
  }

  const reportedTotal = Number(payload.totalResults);
  const resultCount = Number.isFinite(reportedTotal) ? reportedTotal : filteredResults.length;
  updateSearchDock(panel, searchInstance, resultCount);

  const groups = new Map();
  filteredResults.forEach((result) => {
    const prefix = result.codePrefix || "BC";
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(result);
  });

  Array.from(groups.entries()).forEach(([prefix, groupResults]) => {
    const group = document.createElement("section");
    group.className = "search-result-group";
    group.classList.add(`code-theme-${codeTheme(prefix)}`);
    const label = document.createElement("p");
    label.className = "section-label search-group-label";
    label.textContent = codeDisplayLabel(prefix);
    group.append(label);
    groupResults.forEach((result) => {
      const detail = searchResultDetail(result);
      const row = document.createElement("article");
      row.className = "result-row";
      const mainButton = document.createElement("button");
      mainButton.className = "result-row-main";
      mainButton.type = "button";
      const heading = document.createElement("strong");
      heading.className = "result-heading";
      const number = document.createElement("span");
      number.className = "result-number";
      number.textContent = result.sectionNumber || "";
      const title = document.createElement("span");
      title.className = "result-title";
      appendHighlighted(title, stripLeadingSectionNumber(result.title || result.headingLine || "", result.sectionNumber), query);
      heading.append(number, title);
      const snippetText = snippetWithoutDuplicateTitle(result);
      const snippet = document.createElement("p");
      appendHighlighted(snippet, snippetText, query);
      markResearchSelectable(snippet, detail);
      mainButton.append(heading);
      if (snippetText) mainButton.append(snippet);
      mainButton.addEventListener("click", () => {
        if (window.getSelection && String(window.getSelection()).trim()) return;
        recordRecentSearch(query);
        openSectionDetail(searchInstance.id, detail);
      });

      row.append(mainButton);
      group.append(row);
    });
    results.append(group);
  });
}

async function openSectionDetail(searchID, section, options = {}) {
  const sectionID = String(section.sectionID || section.id || "");
  if (!sectionID) return;
  const details = sectionDetailsBySearch();
  const anchors = sectionDetailAnchorsBySearch();
  details[searchID] = {
    codePrefix: section.codePrefix || "BC",
    chapterID: section.chapterID || "",
    chapterNumber: section.chapterNumber || "",
    sectionID,
    sectionNumber: section.sectionNumber || "",
    title: section.title || "Section",
    headerLine: section.headerLine || "",
    headingLine: section.headingLine || ""
  };
  if (options.anchorPaneID) {
    anchors[searchID] = options.anchorPaneID;
  } else {
    delete anchors[searchID];
  }
  state.searchResultReader = null;
  if (options.updateURL !== false) {
    updateBrowserSectionURL(sectionID);
  }
  scheduleContinuitySync(newReaderState(readerFieldsForSectionDetail(details[searchID])));
  placeSectionDetailAfterPane(searchID, anchors[searchID] || paneIDForUtilityInstance({ key: "search", id: searchID }));
  const linkedReader = updateLinkedReaderForSearch(searchID, details[searchID]);
  saveWorkspaceState();
  await transitionWorkspace("utility", {
    refreshPaneIDs: [
      paneIDForSectionDetail(searchID),
      ...(linkedReader ? [paneIDForReader(linkedReader)] : [])
    ]
  });
  if (linkedReader) alignReaderSectionAfterLayout(linkedReader);
}

function annotationForSection(sectionID) {
  return annotationForTarget(sectionID, "");
}

async function resolveSectionDetail(detail) {
  let chapter = null;
  let section = null;
  if (detail.chapterID) {
    try {
      chapter = await fetchChapter(detail.chapterID, { includeBody: true });
      section = sectionTitleFromID(detail.sectionID, chapter);
    } catch {
      chapter = null;
    }
  }
  if (!section && detail.sectionID) {
    try {
      const payload = await api(`/code/sections/${encodeURIComponent(detail.sectionID)}`);
      const resolvedSection = payload.section;
      if (resolvedSection) {
        detail.chapterID = resolvedSection.chapterID || detail.chapterID || "";
        detail.codePrefix = resolvedSection.codePrefix || detail.codePrefix || "BC";
        detail.chapterNumber = resolvedSection.chapterNumber || detail.chapterNumber || "";
        detail.sectionNumber = resolvedSection.sectionNumber || detail.sectionNumber || "";
        detail.title = resolvedSection.title || detail.title || "Section";
        if (detail.chapterID) {
          chapter = await fetchChapter(detail.chapterID, { includeBody: true });
        }
        section = sectionTitleFromID(detail.sectionID, chapter) || {
          ...resolvedSection,
          id: resolvedSection.id || resolvedSection.sectionID || Number(detail.sectionID)
        };
      }
    } catch {
      // Fall through to text search for legacy records that are not addressable by ID.
    }
  }
  if (!section) {
    const search = await api(`/code/search?q=${encodeURIComponent(detail.sectionNumber || detail.sectionID)}`);
    const result = (search.results || []).find((item) => String(item.id) === String(detail.sectionID)) || search.results?.[0];
    if (result?.chapterID) {
      detail.chapterID = result.chapterID;
      detail.codePrefix = result.codePrefix || detail.codePrefix || "BC";
      detail.chapterNumber = result.chapterNumber || detail.chapterNumber || "";
      detail.sectionNumber = result.sectionNumber || detail.sectionNumber || "";
      detail.title = result.title || detail.title || "Section";
      detail.headerLine = result.headerLine || detail.headerLine || "";
      detail.headingLine = result.headingLine || detail.headingLine || "";
      chapter = await fetchChapter(result.chapterID, { includeBody: true });
      section = sectionTitleFromID(detail.sectionID, chapter);
    }
  }
  return { chapter, section };
}

function appendDetailIconButton(container, options) {
  const button = document.createElement("button");
  button.className = options.className || "section-detail-icon";
  button.type = "button";
  button.title = options.title;
  button.setAttribute("aria-label", options.label || options.title);
  button.innerHTML = options.svg;
  container.append(button);
  return button;
}

function backIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m15 18-6-6 6-6"></path>
    </svg>
  `;
}

function circleXIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="m15 9-6 6"></path>
      <path d="m9 9 6 6"></path>
    </svg>
  `;
}

function selectionModeIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"></rect>
      <path d="m8 12 3 3 5-6"></path>
    </svg>
  `;
}

function selectionIndicatorIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"></circle>
      <path class="project-selection-checkmark" d="m8 12 3 3 5-6"></path>
    </svg>
  `;
}

function bookmarkIconSVG(saved) {
  return saved
    ? `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"></path></svg>`
    : `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>`;
}

function jumpIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 3h6v6"></path>
      <path d="M10 14 21 3"></path>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    </svg>
  `;
}

function archiveIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="5" x="2" y="3" rx="1"></rect>
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
      <path d="M10 12h4"></path>
    </svg>
  `;
}

function archiveRestoreIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="5" x="2" y="3" rx="1"></rect>
      <path d="M4 8v11a2 2 0 0 0 2 2h2"></path>
      <path d="M20 8v5"></path>
      <path d="m9 15 3-3 3 3"></path>
      <path d="M12 12v9"></path>
      <path d="M10 12h4"></path>
    </svg>
  `;
}

function trashIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"></path>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
}

function pencilIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.2 6.8 17.2 2.8a2 2 0 0 0-2.8 0L3 14.2V21h6.8L21.2 9.6a2 2 0 0 0 0-2.8z"></path>
      <path d="m14 5 5 5"></path>
    </svg>
  `;
}

function makeSectionPayloadFromDetail(detail, section) {
  return {
    sectionID: detail.sectionID,
    sectionNumber: section?.sectionNumber || detail.sectionNumber || "",
    title: section?.title || detail.title || "Section"
  };
}

async function renderSectionDetail(searchID, detail) {
  const panel = document.createElement("article");
  panel.className = "workspace-panel section-detail-panel";
  panel.dataset.paneId = paneIDForSectionDetail(searchID);
  panel.classList.add(`code-theme-${codeTheme(detail.codePrefix || "BC")}`);
  applyPaneWeight(panel, paneIDForSectionDetail(searchID));

  const { chapter, section } = await resolveSectionDetail(detail);
  const sectionPayload = makeSectionPayloadFromDetail(detail, section);
  sectionPayload.codePrefix = detail.codePrefix || "BC";
  sectionPayload.chapterID = detail.chapterID || chapter?.id || "";
  sectionPayload.chapterNumber = detail.chapterNumber || chapter?.chapterNumber || "";
  const sectionTarget = {
    ...sectionPayload,
    codeVersion: defaultSyncCodeVersion,
    blockID: ""
  };
  const saved = isSectionSaved(detail.sectionID);
  const noteBody = noteValueForTarget(sectionTarget.sectionID, "");
  const bodyText = sectionPlainText(section);

  const chrome = document.createElement("header");
  chrome.className = "section-detail-chrome";
  const backButton = appendDetailIconButton(chrome, {
    title: "Close",
    label: "Close saved item",
    svg: circleXIconSVG()
  });
  const saveButton = appendDetailIconButton(chrome, {
    title: saved ? "Remove bookmark" : "Save bookmark",
    label: saved ? "Remove bookmark" : "Save bookmark",
    className: `section-detail-icon section-detail-save${saved ? " is-saved" : ""}`,
    svg: bookmarkIconSVG(saved)
  });
  saveButton.setAttribute("aria-pressed", String(saved));
  chrome.append(saveButton, backButton);

  const content = document.createElement("section");
  content.className = "section-detail-content";

  const codeLabelElement = document.createElement("p");
  codeLabelElement.className = "section-detail-code-label";
  codeLabelElement.textContent = codeDisplayLabel(detail.codePrefix || "BC").replace(/\s+Code$/i, " Provisions").toUpperCase();

  const chapterLabel = document.createElement("p");
  chapterLabel.className = "section-detail-code-label";
  chapterLabel.textContent = detail.headerLine ? detail.headerLine.toUpperCase() : "";

  const heading = document.createElement("button");
  heading.className = "section-detail-heading";
  heading.type = "button";
  const number = document.createElement("span");
  number.className = "section-detail-number";
  number.textContent = section?.sectionNumber || detail.sectionNumber || "";
  const headingText = document.createElement("span");
  headingText.textContent = sectionTitleWithoutNumber(section) || detail.title || "Section";
  const jumpIcon = document.createElement("span");
  jumpIcon.className = "section-detail-jump";
  jumpIcon.innerHTML = jumpIconSVG();
  heading.append(number, headingText, jumpIcon);

  const chapterTitle = document.createElement("p");
  chapterTitle.className = "section-detail-chapter";
  chapterTitle.textContent = detail.headingLine || "";

  const body = document.createElement("section");
  body.className = "section-detail-body";
  markResearchSelectable(body, {
    sectionID: sectionPayload.sectionID,
    sectionNumber: sectionPayload.sectionNumber,
    title: sectionPayload.title,
    codePrefix: sectionPayload.codePrefix,
    chapterID: sectionPayload.chapterID
  });
  if (section?.blocks?.length) {
    section.blocks.forEach((block) => body.append(renderCodeBlock(block)));
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = bodyText || section?.title || detail.title || "";
    body.append(paragraph);
  }

  const notes = document.createElement("section");
  notes.className = "section-detail-notes";
  const notesHeader = document.createElement("div");
  notesHeader.className = "section-detail-notes-header";
  const saveState = document.createElement("span");
  saveState.className = "section-detail-note-state";
  notesHeader.append(saveState);
  const textareaWrap = document.createElement("label");
  textareaWrap.className = "section-detail-note-box";
  const textarea = document.createElement("textarea");
  textarea.value = noteBody;
  textarea.placeholder = "Add a note";
  textarea.setAttribute("aria-label", `Note for ${sectionDisplayTitle(sectionPayload.sectionNumber, sectionPayload.title)}`);
  textareaWrap.append(textarea);
  const tagsHost = document.createElement("section");
  tagsHost.className = "section-detail-tags";
  renderAnnotationTagEditor(tagsHost, sectionTarget, {
    onChange: () => {
      saveState.textContent = "Saved locally";
    }
  });
  notes.append(notesHeader, textareaWrap, tagsHost);

  backButton.addEventListener("click", () => {
    delete sectionDetailsBySearch()[searchID];
    delete sectionDetailAnchorsBySearch()[searchID];
    saveWorkspaceState();
    void transitionWorkspace("utility");
  });

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.classList.remove("has-error");
    const shouldRemove = saveButton.classList.contains("is-saved");
    saveButton.classList.toggle("is-saved", !shouldRemove);
    saveButton.setAttribute("aria-pressed", String(!shouldRemove));
    saveButton.title = shouldRemove ? "Save bookmark" : "Remove bookmark";
    saveButton.setAttribute("aria-label", saveButton.title);
    saveButton.innerHTML = bookmarkIconSVG(!shouldRemove);
    try {
      await persistSectionBookmark(sectionPayload, !shouldRemove);
      await renderWorkspace();
    } catch (error) {
      saveButton.classList.toggle("is-saved", shouldRemove);
      saveButton.setAttribute("aria-pressed", String(shouldRemove));
      saveButton.innerHTML = bookmarkIconSVG(shouldRemove);
      saveButton.classList.add("has-error");
      saveButton.title = error.message;
      saveButton.setAttribute("aria-label", error.message);
    } finally {
      saveButton.disabled = false;
    }
  });

  heading.addEventListener("click", async () => {
    const reader = openOrUpdateLinkedReaderForSearch(searchID, detail, {
      chapterID: detail.chapterID || chapter?.id || "",
      sectionNumber: sectionPayload.sectionNumber,
      title: sectionPayload.title,
      shouldSmoothScrollToSection: false
    });
    saveWorkspaceState();
    await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForReader(reader)] });
    alignReaderSectionAfterLayout(reader);
  });

  let noteTimer = null;
  textarea.addEventListener("input", () => {
    if (!setAnnotationNoteValue(sectionTarget, textarea.value)) {
      textarea.value = noteValueForTarget(sectionTarget.sectionID, "");
      saveState.textContent = "";
      return;
    }
    syncReaderNoteControls(sectionTarget.sectionID, "", textarea.value, { source: textarea });
    saveState.textContent = "Saving...";
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => {
      saveState.textContent = textarea.value.trim() ? "Saved locally" : "";
    }, 250);
  });

  content.append(codeLabelElement, chapterLabel, heading, chapterTitle, body, notes);
  panel.append(chrome, content);
  return panel;
}

function renderTemplate(template) {
  return template.content.firstElementChild.cloneNode(true);
}

function renderUtility(template, paneID) {
  const panel = renderTemplate(template);
  applyPaneWeight(panel, paneID);
  return panel;
}

function closeUtilityInstance(instance) {
  const paneID = paneIDForUtilityInstance(instance);
  const detailID = instance.key === "search" ? paneIDForSectionDetail(instance.id) : "";
  state.utilityInstances = (state.utilityInstances || []).filter((pane) => pane.id !== instance.id);
  if (instance.key === "search") {
    delete sectionDetailsBySearch()[instance.id];
    delete sectionDetailAnchorsBySearch()[instance.id];
    delete searchLinkedReadersBySearch()[instance.id];
  }
  delete state.paneWeights[paneID];
  if (detailID) delete state.paneWeights[detailID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== paneID && id !== detailID);
  saveWorkspaceState();
  transitionWorkspace("utility");
}

function wireUtilityInstanceActions(panel, instance) {
  const closeButton = panel?.querySelector(".utility-close");
  if (!closeButton || closeButton.dataset.utilityCloseBound === instance.id) return;
  closeButton.dataset.utilityCloseBound = instance.id;
  closeButton.addEventListener("click", () => closeUtilityInstance(instance));
}

function appendResearchList(container, title, items) {
  if (!items?.length) return;
  const heading = document.createElement("strong");
  heading.className = "research-result-subheading";
  heading.textContent = title;
  const list = document.createElement("ul");
  list.className = "research-result-list";
  items.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item;
    list.append(row);
  });
  container.append(heading, list);
}

function renderResearchFeedback(container, message, conversationID) {
  if (!message?.id || !conversationID) return;
  const form = document.createElement("form");
  form.className = "research-feedback";
  const heading = document.createElement("strong");
  heading.textContent = "Was this answer useful?";
  const choices = document.createElement("div");
  choices.className = "research-feedback-choices";
  const categories = [
    ["helpful", "Helpful"],
    ["incorrect_misleading", "Incorrect or misleading"],
    ["missing_information", "Missing information"],
    ["citation_problem", "Citation problem"],
    ["other", "Other feedback"]
  ];
  let selectedCategory = message.feedback?.category || "";
  categories.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "research-feedback-choice";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(selectedCategory === value));
    button.addEventListener("click", () => {
      selectedCategory = value;
      choices.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      submit.disabled = false;
    });
    choices.append(button);
  });
  const comment = document.createElement("textarea");
  comment.rows = 2;
  comment.maxLength = 2000;
  comment.placeholder = "What should be corrected? (optional)";
  comment.value = message.feedback?.userComment || "";
  const optionalContext = document.createElement("details");
  optionalContext.className = "research-feedback-context";
  optionalContext.open = Boolean(
    comment.value ||
    message.feedback?.professionalRole ||
    message.feedback?.supportingReference
  );
  const optionalSummary = document.createElement("summary");
  optionalSummary.textContent = "Add supporting context (optional)";
  const professionalRole = document.createElement("select");
  professionalRole.setAttribute("aria-label", "Professional role");
  [
    ["", "Professional role (optional)"],
    ["architect_designer", "Architect or designer"],
    ["engineer", "Engineer"],
    ["code_zoning_consultant", "Code or zoning consultant"],
    ["expeditor_filing_representative", "Expeditor or filing representative"],
    ["contractor", "Contractor"],
    ["owner_operator", "Owner or operator"],
    ["student", "Student"],
    ["other", "Other"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    professionalRole.append(option);
  });
  professionalRole.value = message.feedback?.professionalRole || "";
  const supportingReference = document.createElement("input");
  supportingReference.type = "text";
  supportingReference.maxLength = 500;
  supportingReference.placeholder = "Code section or official source supporting your feedback";
  supportingReference.setAttribute("aria-label", "Supporting code section or official source");
  supportingReference.value = message.feedback?.supportingReference || "";
  optionalContext.append(optionalSummary, professionalRole, supportingReference, comment);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "ghost-button";
  submit.textContent = message.feedback ? "Update feedback" : "Send feedback";
  submit.disabled = !selectedCategory;
  const status = document.createElement("p");
  status.className = "research-feedback-status";
  if (message.feedback) status.textContent = "Saved as a review candidate.";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedCategory) return;
    submit.disabled = true;
    status.textContent = "Saving…";
    try {
      const payload = await postResearch("/research/feedback", {
        conversationID,
        answerID: message.id,
        category: selectedCategory,
        comment: comment.value,
        professionalRole: professionalRole.value,
        supportingReference: supportingReference.value
      });
      message.feedback = payload.feedback;
      submit.textContent = "Update feedback";
      status.textContent = "Saved as a review candidate.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = !selectedCategory;
    }
  });
  form.append(heading, choices, optionalContext, submit, status);
  container.append(form);
}

function renderResearchInterpretation(container, result, options = {}) {
  clear(container);
  if (!result) return;

  const card = document.createElement("article");
  card.className = "analysis-card research-result-card";
  const label = document.createElement("p");
  label.className = "section-label";
  label.textContent = result.mode === "mock" ? "Prototype response" : "Supported by selected evidence";
  const heading = document.createElement("h3");
  heading.textContent = result.conclusion;
  const explanation = document.createElement("p");
  explanation.textContent = result.explanation;
  card.append(label, heading, explanation);
  appendResearchList(card, "Assumptions", result.assumptions);
  appendResearchList(card, "Missing project facts", result.missingFacts);
  appendResearchList(card, "Limits of the selected evidence", result.evidenceLimitations);
  appendResearchList(card, "Additional evidence needed", result.additionalEvidenceNeeded);

  const citationsHeading = document.createElement("strong");
  citationsHeading.className = "research-result-subheading";
  citationsHeading.textContent = "Cited code sections";
  card.append(citationsHeading);
  result.citations.forEach((citation) => {
    const citationRow = document.createElement("div");
    citationRow.className = "research-result-citation";
    const citationText = document.createElement("span");
    citationText.textContent = officialSectionCitation(citation);
    const relevance = document.createElement("p");
    relevance.textContent = citation.relevance;
    const passageDetails = document.createElement("details");
    passageDetails.className = "research-citation-passages";
    const passageSummary = document.createElement("summary");
    passageSummary.textContent = "Show supporting selected passage";
    passageDetails.append(passageSummary);
    (citation.supportingPassages || []).forEach((passage) => {
      const quote = document.createElement("blockquote");
      quote.textContent = passage.selectedText;
      passageDetails.append(quote);
    });
    const openButton = document.createElement("button");
    openButton.className = "ghost-button";
    openButton.type = "button";
    openButton.textContent = "Open cited section";
    openButton.addEventListener("click", () => openSectionDetailForExistingSearch(citation));
    citationRow.append(citationText, relevance, passageDetails, openButton);
    card.append(citationRow);
  });
  const disclaimer = document.createElement("p");
  disclaimer.className = "research-disclaimer";
  disclaimer.textContent = result.disclaimer;
  card.append(disclaimer);
  if (options.message) renderResearchFeedback(card, options.message, options.conversationID);
  container.append(card);
}

async function renderUtilityInstance(instance) {
  const paneID = paneIDForUtilityInstance(instance);
  let panel = null;
  if (instance.key === "search") {
    panel = await renderSearch(instance);
  } else if (instance.key === "saved") {
    panel = await renderSaved(instance);
  } else if (instance.key === "analysis") {
    panel = await renderResearch(paneID);
  }
  wireUtilityInstanceActions(panel, instance);
  return panel;
}

function researchRequestBody(values = {}) {
  const account = activeAccount();
  return {
    auth: { accountUserID: account?.userID || "" },
    ...values
  };
}

async function postResearch(path, values = {}) {
  const account = activeAccount();
  if (!account) throw new Error("Sign in from Settings to use private research conversations.");
  return postJSON(path, researchRequestBody(values), { token: account.sessionToken });
}

async function refreshResearchConversationList() {
  if (!activeAccount()) {
    researchConversationList = [];
    activeResearchConversation = null;
    researchUsage = null;
    return [];
  }
  const [payload, usagePayload] = await Promise.all([
    postResearch("/research/conversations/list"),
    postResearch("/research/usage")
  ]);
  researchConversationList = payload.conversations || [];
  researchUsage = usagePayload.usage || null;
  return researchConversationList;
}

async function closeResearchWorkspace() {
  state.utilities.analysis = false;
  state.researchConversationID = "";
  activeResearchConversation = null;
  delete state.paneWeights["utility:analysis"];
  Object.keys(state.paneWeights).filter((id) => id.startsWith("research:conversation:")).forEach((id) => delete state.paneWeights[id]);
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== "utility:analysis" && !id.startsWith("research:conversation:"));
  saveWorkspaceState();
  await transitionWorkspace("utility");
}

async function closeResearchConversation() {
  const paneID = paneIDForResearchConversation();
  state.researchConversationID = "";
  activeResearchConversation = null;
  if (paneID) delete state.paneWeights[paneID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== paneID);
  saveWorkspaceState();
  await transitionWorkspace("utility");
}

async function openResearchConversation(conversationID, options = {}) {
  state.utilities.analysis = true;
  state.researchConversationID = conversationID;
  const paneID = paneIDForResearchConversation(conversationID);
  state.paneWeights["utility:analysis"] ||= defaultPaneWidthForID("utility:analysis");
  state.paneWeights[paneID] ||= defaultPaneWidthForID(paneID);
  placePaneAfter("utility:analysis", paneID);
  saveWorkspaceState();
  await transitionWorkspace("utility", {
    refreshPaneIDs: options.refreshList ? ["utility:analysis", paneID] : [paneID]
  });
  scrollPaneIntoView(paneID);
}

function researchRelativeDate(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function researchProjects() {
  return activeProjectRecords(currentContentSummary().projects || []);
}

function researchProjectID(project) {
  return project ? projectDetailKey(project) : "";
}

function researchProjectName(projectID) {
  const project = visibleProjectRecords(currentContentSummary().projects || [])
    .find((item) => researchProjectID(item) === String(projectID || ""));
  return project ? readableProjectName(project) : "Unassigned";
}

function preferredResearchProjectID(conversation = activeResearchConversation) {
  if (conversation?.primaryProjectID) return conversation.primaryProjectID;
  const projects = researchProjects();
  const openProjectIDs = openProjectDetails().map((detail) => projectDetailKey(detail));
  return openProjectIDs.find((projectID) =>
    projects.some((project) => researchProjectID(project) === projectID)
  ) || "";
}

function createResearchProjectSelect({
  value = "",
  includeUnassigned = true,
  unassignedLabel = "No Project",
  ariaLabel = "Project"
} = {}) {
  const select = document.createElement("select");
  select.className = "research-project-select";
  select.setAttribute("aria-label", ariaLabel);
  if (includeUnassigned) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = unassignedLabel;
    select.append(option);
  }
  researchProjects().forEach((project) => {
    const option = document.createElement("option");
    option.value = researchProjectID(project);
    option.textContent = readableProjectName(project);
    select.append(option);
  });
  if (value && ![...select.options].some((option) => option.value === value)) {
    const historicalProject = visibleProjectRecords(currentContentSummary().projects || [])
      .find((project) => researchProjectID(project) === value);
    if (historicalProject) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${readableProjectName(historicalProject)} (Archived)`;
      select.append(option);
    }
  }
  select.value = value && [...select.options].some((option) => option.value === value)
    ? value
    : "";
  return select;
}

async function deleteResearchConversationFromList(conversation, button) {
  const confirmed = await confirmWebWarning(
    "Delete research conversation?",
    `“${conversation.title}” and its private message history will be permanently deleted.`,
    { confirmLabel: "Delete" }
  );
  if (!confirmed) return;
  button.disabled = true;
  try {
    await postResearch("/research/conversations/delete", { conversationID: conversation.id });
    if (state.researchConversationID === conversation.id) {
      state.researchConversationID = "";
      activeResearchConversation = null;
    }
    await refreshResearchConversationList();
    saveWorkspaceState();
    await transitionWorkspace("utility", { refreshPaneIDs: ["utility:analysis"] });
  } catch (error) {
    button.disabled = false;
    await showWebNotice("Conversation not deleted", error.message);
  }
}

async function renderResearch(paneID = "utility:analysis") {
  const panel = renderUtility(analysisTemplate, paneID);
  panel.classList.add("analysis-panel", "research-list-panel");
  panel.querySelector(".utility-close")?.addEventListener("click", closeResearchWorkspace);
  const content = panel.querySelector(".analysis-content");

  const trustBanner = document.createElement("aside");
  trustBanner.className = "research-trust-banner";
  trustBanner.setAttribute("role", "note");
  const trustHeading = document.createElement("strong");
  trustHeading.textContent = "AI-assisted research — not an official interpretation";
  const trustCopy = document.createElement("p");
  trustCopy.textContent = "Select enacted text, then choose Analyze. Questions are answered only from the attached code sources; private notes are excluded.";
  trustBanner.append(trustHeading, trustCopy);
  content.append(trustBanner);

  if (!activeAccount()) {
    const empty = document.createElement("article");
    empty.className = "analysis-card research-empty-state";
    const heading = document.createElement("h3");
    heading.textContent = "Sign in to keep private research history";
    const copy = document.createElement("p");
    copy.textContent = "Research conversations are stored with your Permitext account and stay separate from official code content.";
    const button = document.createElement("button");
    button.className = "ghost-button";
    button.type = "button";
    button.textContent = "Open Settings";
    button.addEventListener("click", () => focusUtility("settings"));
    empty.append(heading, copy, button);
    content.append(empty);
    return panel;
  }

  try {
    await refreshResearchConversationList();
  } catch (error) {
    const status = document.createElement("p");
    status.className = "research-list-status is-error";
    status.textContent = error.message;
    content.append(status);
    return panel;
  }

  const listHeader = document.createElement("div");
  listHeader.className = "research-list-header";
  const heading = document.createElement("h3");
  heading.textContent = "Conversations";
  const instruction = document.createElement("p");
  instruction.textContent = "Highlight enacted text in any Reader, search detail, or project section to begin.";
  listHeader.append(heading, instruction);
  content.append(listHeader);

  if (researchQuestionDraft) {
    const carriedDraft = document.createElement("article");
    carriedDraft.className = "analysis-card notebook-research-draft";
    const draftHeading = document.createElement("strong");
    draftHeading.textContent = "Question ready from Notebook";
    const draftText = document.createElement("p");
    draftText.textContent = researchQuestionDraft;
    const draftInstruction = document.createElement("small");
    draftInstruction.textContent = "Now highlight the enacted code text you want Permitext to use. The Notebook card is context, not cited authority.";
    carriedDraft.append(draftHeading, draftText, draftInstruction);
    content.append(carriedDraft);
  }

  if (researchUsage) {
    const usage = document.createElement("section");
    usage.className = "research-usage";
    const primary = document.createElement("strong");
    primary.textContent = `${researchUsage.requestsUsed} of ${researchUsage.requestLimit} AI requests used this month`;
    const reset = document.createElement("p");
    reset.textContent = `Allowance resets ${researchRelativeDate(researchUsage.resetDate)}.`;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Technical usage details";
    const tokens = document.createElement("p");
    tokens.textContent = `${Number(researchUsage.tokens?.totalTokens || 0).toLocaleString()} tokens used.`;
    details.append(summary, tokens);
    if (Number.isFinite(researchUsage.estimatedCostUSD)) {
      const cost = document.createElement("p");
      cost.textContent = `Estimated usage cost: $${researchUsage.estimatedCostUSD.toFixed(4)}.`;
      details.append(cost);
    }
    usage.append(primary, reset, details);
    content.append(usage);
  }

  if (!researchConversationList.length) {
    const empty = document.createElement("div");
    empty.className = "research-conversation-empty";
    empty.textContent = "No research conversations yet.";
    content.append(empty);
    return panel;
  }

  const list = document.createElement("section");
  list.className = "research-conversation-list";
  researchConversationList.forEach((conversation) => {
    const row = document.createElement("article");
    row.className = "research-conversation-row";
    row.classList.toggle("is-active", state.researchConversationID === conversation.id);
    const openButton = document.createElement("button");
    openButton.className = "research-conversation-open";
    openButton.type = "button";
    const title = document.createElement("strong");
    title.textContent = conversation.title;
    const meta = document.createElement("span");
    const projectLabel = conversation.primaryProjectID
      ? `${researchProjectName(conversation.primaryProjectID)} · `
      : "";
    meta.textContent = `${projectLabel}${conversation.messageCount / 2 || 0} ${conversation.messageCount === 2 ? "exchange" : "exchanges"} · ${conversation.sourceCount} ${conversation.sourceCount === 1 ? "passage" : "passages"} · ${researchRelativeDate(conversation.updatedAt)}`;
    openButton.append(title, meta);
    openButton.addEventListener("click", () => openResearchConversation(conversation.id));
    const deleteButton = document.createElement("button");
    deleteButton.className = "research-conversation-delete";
    deleteButton.type = "button";
    deleteButton.title = "Delete conversation";
    deleteButton.setAttribute("aria-label", `Delete ${conversation.title}`);
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteResearchConversationFromList(conversation, deleteButton));
    row.append(openButton, deleteButton);
    list.append(row);
  });
  content.append(list);
  return panel;
}

function renderResearchSource(source) {
  const card = document.createElement("article");
  card.className = `research-source-card is-${source.kind || "related"}`;
  const label = document.createElement("p");
  label.className = "section-label";
  label.textContent = source.kind === "selection" ? "Selected passage" : "Related enacted section";
  const citation = document.createElement("strong");
  citation.textContent = officialSectionCitation(source);
  const relationship = document.createElement("p");
  relationship.textContent = source.relationship || "Included as disclosed context";
  card.append(label, citation, relationship);
  if (source.selectedText) {
    const quote = document.createElement("blockquote");
    quote.textContent = source.selectedText;
    card.append(quote);
  }
  const openButton = document.createElement("button");
  openButton.className = "ghost-button";
  openButton.type = "button";
  openButton.textContent = "Open enacted section";
  openButton.addEventListener("click", () => openSectionDetailForExistingSearch(source));
  card.append(openButton);
  return card;
}

function appendHistoricalResearchList(container, title, items = []) {
  if (!items.length) return;
  const heading = document.createElement("strong");
  heading.textContent = title;
  const list = document.createElement("ul");
  items.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item;
    list.append(row);
  });
  container.append(heading, list);
}

function renderHistoricalResearchRecord(container, answerRecord) {
  clear(container);
  const record = document.createElement("article");
  record.className = "research-historical-record";
  const heading = document.createElement("div");
  heading.className = "research-historical-heading";
  const title = document.createElement("strong");
  title.textContent = "Immutable Research record";
  const meta = document.createElement("span");
  meta.textContent = [
    researchRelativeDate(answerRecord.createdAt),
    answerRecord.projectID ? researchProjectName(answerRecord.projectID) : "No Project at answer time",
    answerRecord.model
  ].filter(Boolean).join(" · ");
  heading.append(title, meta);

  const questionLabel = document.createElement("strong");
  questionLabel.textContent = "Exact stored question";
  const question = document.createElement("p");
  question.className = "research-historical-question";
  question.textContent = answerRecord.question;

  const exactAnswer = document.createElement("section");
  exactAnswer.className = "research-historical-answer";
  renderResearchInterpretation(exactAnswer, answerRecord.answer);

  const evidenceHeading = document.createElement("strong");
  evidenceHeading.textContent = "Approved evidence snapshots";
  const evidenceList = document.createElement("section");
  evidenceList.className = "research-historical-evidence";
  (answerRecord.evidence || []).forEach((evidence) => {
    const evidenceCard = document.createElement("article");
    const citation = document.createElement("strong");
    citation.textContent = `${evidence.codeBook} § ${evidence.sectionNumber}`;
    const evidenceMeta = document.createElement("span");
    evidenceMeta.textContent = `${evidence.codeEdition} · Library ${evidence.sourceLibraryVersion}`;
    const quote = document.createElement("blockquote");
    quote.textContent = evidence.passageText;
    const hash = document.createElement("code");
    hash.textContent = `SHA-256 ${evidence.passageTextHash}`;
    evidenceCard.append(citation, evidenceMeta, quote, hash);
    evidenceList.append(evidenceCard);
  });

  const evidenceBySnapshotID = new Map(
    (answerRecord.evidence || []).map((evidence) => [evidence.id, evidence])
  );
  const mapping = (answerRecord.passageToCitationMapping || []).map((item) => {
    const snapshotCount = item.evidenceSnapshotIDs?.length || 0;
    const sourceLabels = Array.from(new Set(
      (item.evidenceSnapshotIDs || []).map((snapshotID) => {
        const evidence = evidenceBySnapshotID.get(snapshotID);
        return evidence
          ? `${evidence.codeBook} § ${evidence.sectionNumber}`
          : `Source ${snapshotID}`;
      })
    ));
    return `${sourceLabels.join(", ")}: ${snapshotCount} approved ${snapshotCount === 1 ? "snapshot" : "snapshots"} — ${item.relevance || "Cited support"}`;
  });
  const mappingWrap = document.createElement("section");
  mappingWrap.className = "research-historical-mapping";
  appendHistoricalResearchList(mappingWrap, "Passage-to-citation mapping", mapping);

  const reuse = document.createElement("section");
  reuse.className = "research-historical-reuse";
  const reuseHeading = document.createElement("strong");
  reuseHeading.textContent = "Start fresh from this approved evidence";
  const reuseCopy = document.createElement("p");
  reuseCopy.textContent = "This creates a new, empty Research conversation. It rechecks the passage against the current enacted library and does not copy the old question, answer, assumptions, or Project facts.";
  const reuseControls = document.createElement("div");
  reuseControls.className = "research-historical-reuse-controls";
  const projectSelect = createResearchProjectSelect({
    value: preferredResearchProjectID(),
    includeUnassigned: false,
    ariaLabel: "Project for reused evidence"
  });
  const reuseButton = document.createElement("button");
  reuseButton.className = "ghost-button";
  reuseButton.type = "button";
  reuseButton.textContent = "Start new Research";
  reuseButton.disabled = !projectSelect.value;
  const reuseStatus = document.createElement("p");
  reuseStatus.className = "research-historical-status";
  projectSelect.addEventListener("change", () => {
    reuseButton.disabled = !projectSelect.value;
  });
  reuseButton.addEventListener("click", async () => {
    if (!projectSelect.value) return;
    reuseButton.disabled = true;
    projectSelect.disabled = true;
    reuseStatus.textContent = "Rechecking the approved evidence…";
    try {
      const payload = await postResearch("/research/conversations/reuse-evidence", {
        answerID: answerRecord.id,
        projectID: projectSelect.value
      });
      await refreshResearchConversationList();
      await openResearchConversation(payload.conversation.id, { refreshList: true });
    } catch (error) {
      reuseStatus.textContent = error.message;
      projectSelect.disabled = false;
      reuseButton.disabled = !projectSelect.value;
    }
  });
  reuseControls.append(projectSelect, reuseButton);
  reuse.append(reuseHeading, reuseCopy, reuseControls, reuseStatus);

  record.append(
    heading,
    questionLabel,
    question,
    exactAnswer,
    evidenceHeading,
    evidenceList,
    mappingWrap,
    reuse
  );
  container.append(record);
}

function renderHistoricalResearchControl(container, message) {
  if (!message?.id) return;
  const details = document.createElement("details");
  details.className = "research-historical-details";
  const summary = document.createElement("summary");
  summary.textContent = "Open exact historical record";
  const body = document.createElement("section");
  body.className = "research-historical-body";
  let loaded = false;
  details.addEventListener("toggle", async () => {
    if (!details.open || loaded) return;
    loaded = true;
    body.textContent = "Loading the immutable record…";
    try {
      const payload = await postResearch("/research/answers/get", { answerID: message.id });
      renderHistoricalResearchRecord(body, payload.answer);
    } catch (error) {
      loaded = false;
      body.textContent = error.message;
    }
  });
  details.append(summary, body);
  container.append(details);
}

function renderResearchProjectContext(container, conversation) {
  const section = document.createElement("section");
  section.className = "research-project-context";
  const heading = document.createElement("div");
  heading.className = "research-project-context-heading";
  const titleWrap = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Project context";
  const copy = document.createElement("p");
  copy.textContent = "Project facts are user-provided context only. They are never treated as code authority or cited evidence.";
  titleWrap.append(title, copy);
  const projectSelect = createResearchProjectSelect({
    value: conversation.primaryProjectID || "",
    unassignedLabel: "Unassigned",
    ariaLabel: "Assign Research conversation to Project"
  });
  heading.append(titleWrap, projectSelect);
  section.append(heading);

  const status = document.createElement("p");
  status.className = "research-project-context-status";
  projectSelect.addEventListener("change", async () => {
    const previousProjectID = conversation.primaryProjectID || "";
    const targetProjectID = projectSelect.value;
    projectSelect.disabled = true;
    status.textContent = "Updating Project assignment…";
    try {
      let payload;
      try {
        payload = await postResearch("/research/conversations/assign-project", {
          conversationID: conversation.id,
          projectID: targetProjectID
        });
      } catch (error) {
        if (error.payload?.code !== "RESEARCH_PROJECT_REVIEW_REQUIRED") throw error;
        const confirmed = await confirmWebWarning(
          targetProjectID ? "Move Research to this Project?" : "Unassign this Research?",
          targetProjectID
            ? "Existing answers remain immutable in their original Project history. Project facts will be cleared, and you must review the new context before asking another question."
            : "Existing answers remain immutable in their original Project history. The conversation will no longer contribute new activity to a Project.",
          { confirmLabel: targetProjectID ? "Move and review" : "Unassign" }
        );
        if (!confirmed) {
          projectSelect.value = previousProjectID;
          status.textContent = "";
          return;
        }
        payload = await postResearch("/research/conversations/assign-project", {
          conversationID: conversation.id,
          projectID: targetProjectID,
          confirmMove: true
        });
      }
      activeResearchConversation = payload.conversation;
      await refreshResearchConversationList();
      await openResearchConversation(conversation.id, { refreshList: true });
    } catch (error) {
      projectSelect.value = previousProjectID;
      status.textContent = error.message;
    } finally {
      projectSelect.disabled = false;
    }
  });

  if (conversation.primaryProjectID) {
    if (conversation.projectContextReviewRequired) {
      const warning = document.createElement("aside");
      warning.className = "research-project-context-warning";
      const warningTitle = document.createElement("strong");
      warningTitle.textContent = "Context review required";
      const warningCopy = document.createElement("p");
      warningCopy.textContent = "Review or replace the Project facts below before generating another answer.";
      warning.append(warningTitle, warningCopy);
      section.append(warning);
    }
    const form = document.createElement("form");
    form.className = "research-project-context-form";
    const label = document.createElement("label");
    label.textContent = "Project facts — one per line";
    const facts = document.createElement("textarea");
    facts.rows = 4;
    facts.maxLength = 10_000;
    facts.placeholder = "Example: Existing building is Type I-B construction";
    facts.value = (conversation.projectContext?.facts || []).join("\n");
    label.append(facts);
    const saveButton = document.createElement("button");
    saveButton.className = "ghost-button";
    saveButton.type = "submit";
    saveButton.textContent = conversation.projectContextReviewRequired ? "Confirm reviewed context" : "Save Project context";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const normalizedFacts = facts.value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (normalizedFacts.length > 20 || normalizedFacts.some((item) => item.length > 500)) {
        status.textContent = "Use no more than 20 facts and 500 characters per fact.";
        return;
      }
      facts.disabled = true;
      saveButton.disabled = true;
      status.textContent = "Saving reviewed Project context…";
      try {
        const payload = await postResearch("/research/conversations/project-context", {
          conversationID: conversation.id,
          projectID: conversation.primaryProjectID,
          facts: normalizedFacts
        });
        activeResearchConversation = payload.conversation;
        await refreshResearchConversationList();
        await openResearchConversation(conversation.id, { refreshList: true });
      } catch (error) {
        status.textContent = error.message;
        facts.disabled = false;
        saveButton.disabled = false;
      }
    });
    form.append(label, saveButton);
    section.append(form);
  } else {
    const unassigned = document.createElement("p");
    unassigned.className = "research-project-context-unassigned";
    unassigned.textContent = "Assign this conversation when its research belongs to a specific Project.";
    section.append(unassigned);
  }
  section.append(status);
  container.append(section);
}

async function renderResearchConversation(conversationID) {
  const paneID = paneIDForResearchConversation(conversationID);
  const panel = document.createElement("article");
  panel.className = "workspace-panel utility-panel research-conversation-panel";
  applyPaneWeight(panel, paneID);
  const header = document.createElement("header");
  header.className = "panel-header";
  const headingWrap = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow panel-kind";
  eyebrow.textContent = "Research conversation";
  const panelTitle = document.createElement("h2");
  panelTitle.className = "panel-title";
  panelTitle.textContent = "Loading…";
  headingWrap.append(eyebrow, panelTitle);
  const closeButton = document.createElement("button");
  closeButton.className = "icon-button utility-close";
  closeButton.type = "button";
  closeButton.title = "Close conversation";
  closeButton.setAttribute("aria-label", "Close conversation");
  closeButton.innerHTML = circleXIconSVG();
  closeButton.addEventListener("click", closeResearchConversation);
  const actions = document.createElement("div");
  actions.className = "panel-actions";
  actions.append(closeButton);
  header.append(headingWrap, actions);
  const content = document.createElement("section");
  content.className = "research-conversation-content";
  panel.append(header, content);

  try {
    const payload = await postResearch("/research/conversations/get", { conversationID });
    activeResearchConversation = payload.conversation;
  } catch (error) {
    const status = document.createElement("p");
    status.className = "research-list-status is-error";
    status.textContent = error.message;
    content.append(status);
    return panel;
  }

  const conversation = activeResearchConversation;
  panelTitle.textContent = conversation.title;
  renderResearchProjectContext(content, conversation);
  const sources = document.createElement("details");
  sources.className = "research-sources";
  sources.open = conversation.messages.length === 0 || conversation.sourceStatus === "changed";
  const sourceSummary = document.createElement("summary");
  const selectedCount = conversation.sources.filter((source) => source.kind === "selection").length;
  const relatedCount = conversation.sources.length - selectedCount;
  sourceSummary.textContent = `${selectedCount} selected ${selectedCount === 1 ? "passage" : "passages"}${relatedCount ? ` + ${relatedCount} related ${relatedCount === 1 ? "section" : "sections"}` : ""}`;
  const sourceList = document.createElement("section");
  sourceList.className = "research-source-list";
  conversation.sources.forEach((source) => sourceList.append(renderResearchSource(source)));
  sources.append(sourceSummary, sourceList);
  content.append(sources);

  if (conversation.sourceStatus === "changed") {
    const warning = document.createElement("aside");
    warning.className = "research-source-warning";
    const warningText = document.createElement("p");
    warningText.textContent = "The enacted source changed after this conversation began. Existing answers remain visible as historical research, but new analysis is paused.";
    const refreshButton = document.createElement("button");
    refreshButton.className = "ghost-button";
    refreshButton.type = "button";
    refreshButton.textContent = "Refresh sources";
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      try {
        const result = await postResearch("/research/conversations/refresh", { conversationID });
        activeResearchConversation = result.conversation;
        await openResearchConversation(conversationID, { refreshList: true });
      } catch (error) {
        warningText.textContent = error.message;
        refreshButton.disabled = false;
      }
    });
    warning.append(warningText, refreshButton);
    content.append(warning);
  }

  const thread = document.createElement("section");
  thread.className = "research-message-thread";
  if (!conversation.messages.length) {
    const prompt = document.createElement("p");
    prompt.className = "research-conversation-prompt";
    prompt.textContent = "The passage is attached. Ask a question when you are ready—opening this conversation has not called an AI model.";
    thread.append(prompt);
  }
  conversation.messages.forEach((message) => {
    if (message.role === "user") {
      const bubble = document.createElement("article");
      bubble.className = "research-message is-user";
      bubble.textContent = message.question;
      thread.append(bubble);
      return;
    }
    const bubble = document.createElement("article");
    bubble.className = "research-message is-assistant";
    renderResearchInterpretation(bubble, message.answer, { message, conversationID });
    renderHistoricalResearchControl(bubble, message);
    thread.append(bubble);
  });
  content.append(thread);

  const composer = document.createElement("form");
  composer.className = "research-composer";
  const input = document.createElement("textarea");
  input.className = "research-question-input";
  input.rows = 3;
  input.maxLength = 2000;
  input.placeholder = "Ask about the attached enacted text…";
  input.value = researchQuestionDraft;
  const sendButton = document.createElement("button");
  sendButton.className = "ghost-button research-send-button";
  sendButton.type = "submit";
  sendButton.textContent = "Analyze";
  const projectContextBlocked = Boolean(conversation.projectContextReviewRequired);
  sendButton.disabled = conversation.sourceStatus === "changed" || projectContextBlocked || input.value.trim().length < 3;
  if (projectContextBlocked) {
    input.disabled = true;
    input.placeholder = "Review the Project context above before continuing…";
  }
  const status = document.createElement("p");
  status.className = "research-composer-status";
  input.addEventListener("input", () => {
    researchQuestionDraft = input.value;
    sendButton.disabled = conversation.sourceStatus === "changed" || projectContextBlocked || input.value.trim().length < 3;
  });
  composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (question.length < 3 || sendButton.disabled) return;
    input.disabled = true;
    sendButton.disabled = true;
    status.textContent = "Reviewing the attached enacted text…";
    try {
      const result = await postResearch("/research/conversations/message", { conversationID, question });
      activeResearchConversation = result.conversation;
      researchQuestionDraft = "";
      await refreshResearchConversationList();
      await openResearchConversation(conversationID, { refreshList: true });
    } catch (error) {
      if (error.payload?.conversation) activeResearchConversation = error.payload.conversation;
      status.textContent = error.message;
      input.disabled = false;
      sendButton.disabled = false;
      if (error.status === 409) {
        await openResearchConversation(conversationID, { refreshList: true });
      }
    }
  });
  composer.append(input, sendButton, status);
  content.append(composer);
  requestAnimationFrame(() => {
    content.scrollTop = content.scrollHeight;
  });
  return panel;
}

function closeResearchSelectionMenu() {
  document.querySelector(".research-selection-menu")?.remove();
  pendingResearchSelection = null;
}

function researchSelectionTextFromRange(selection, range) {
  const fragment = range.cloneContents();
  const container = document.createElement("div");
  container.append(fragment);
  container.querySelectorAll('[data-research-selection-exclude="true"]').forEach((element) => element.remove());
  container.querySelectorAll([
    "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt",
    "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table",
    "tbody", "td", "tfoot", "th", "thead", "tr", "ul"
  ].join(",")).forEach((element) => element.append(document.createTextNode(" ")));
  return String(container.textContent || selection)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4_000);
}

function researchSelectionFromWindow() {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  const end = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
  const source = start?.closest?.(".research-selectable-text");
  if (!source || source !== end?.closest?.(".research-selectable-text")) return null;
  if (source.closest(".research-conversation-panel")) return null;
  const selectedText = researchSelectionTextFromRange(selection, range);
  if (selectedText.length < 2) return null;
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    sectionID: source.dataset.researchSectionId,
    sectionNumber: source.dataset.researchSectionNumber,
    title: source.dataset.researchSectionTitle,
    codePrefix: source.dataset.researchCodePrefix,
    savedItemID: source.dataset.researchSavedItemId || "",
    selectedText,
    rect
  };
}

async function saveResearchSelection(mode, button, status) {
  const selection = pendingResearchSelection;
  if (!selection) return;
  if (!activeAccount()) {
    closeResearchSelectionMenu();
    await focusUtility("settings");
    return;
  }
  button.disabled = true;
  status.textContent = mode === "current" ? "Adding passage…" : "Starting research…";
  try {
    const payload = mode === "current"
      ? await postResearch("/research/conversations/evidence", {
          conversationID: state.researchConversationID,
          sectionID: selection.sectionID,
          selectedText: selection.selectedText
        })
      : await postResearch("/research/conversations/create", {
          sectionID: selection.sectionID,
          selectedText: selection.selectedText,
          projectID: selection.projectID || "",
          savedItemID: selection.savedItemID || ""
        });
    activeResearchConversation = payload.conversation;
    closeResearchSelectionMenu();
    window.getSelection?.().removeAllRanges();
    await refreshResearchConversationList();
    await openResearchConversation(payload.conversation.id, { refreshList: true });
  } catch (error) {
    button.disabled = false;
    status.textContent = error.message;
  }
}

function showResearchSelectionMenu() {
  const captured = researchSelectionFromWindow();
  if (!captured) {
    closeResearchSelectionMenu();
    return;
  }
  closeResearchSelectionMenu();
  pendingResearchSelection = captured;
  const menu = document.createElement("div");
  menu.className = "research-selection-menu";
  menu.setAttribute("role", "toolbar");
  menu.setAttribute("aria-label", "Analyze selected enacted text");
  menu.addEventListener("pointerdown", (event) => event.preventDefault());
  const actions = document.createElement("div");
  actions.className = "research-selection-actions";
  const status = document.createElement("span");
  status.className = "research-selection-status";
  const projects = researchProjects();
  if (activeAccount() && projects.length) {
    const projectSelect = createResearchProjectSelect({
      value: preferredResearchProjectID(),
      unassignedLabel: "No Project",
      ariaLabel: "Project for new Research"
    });
    projectSelect.classList.add("research-selection-project");
    pendingResearchSelection.projectID = projectSelect.value;
    projectSelect.addEventListener("change", () => {
      if (pendingResearchSelection) pendingResearchSelection.projectID = projectSelect.value;
    });
    menu.append(projectSelect);
  }
  if (state.researchConversationID && activeAccount()) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "Add to current research";
    addButton.addEventListener("click", () => saveResearchSelection("current", addButton, status));
    actions.append(addButton);
  }
  const analyzeButton = document.createElement("button");
  analyzeButton.type = "button";
  analyzeButton.textContent = state.researchConversationID ? "Analyze in new research" : "Analyze";
  analyzeButton.addEventListener("click", () => saveResearchSelection("new", analyzeButton, status));
  actions.append(analyzeButton);
  menu.append(actions, status);
  document.body.append(menu);
  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(
    window.innerWidth - menuRect.width - 12,
    Math.max(12, captured.rect.left + captured.rect.width / 2 - menuRect.width / 2)
  );
  const top = Math.max(12, captured.rect.top - menuRect.height - 10);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function bindResearchTextSelection() {
  document.addEventListener("pointerup", (event) => {
    if (event.target.closest?.(".research-selection-menu")) return;
    window.setTimeout(showResearchSelectionMenu, 0);
  });
  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key === "Shift") window.setTimeout(showResearchSelectionMenu, 0);
  });
  document.addEventListener("selectionchange", () => {
    if (window.getSelection?.().isCollapsed) closeResearchSelectionMenu();
  });
  window.addEventListener("scroll", closeResearchSelectionMenu, true);
  window.addEventListener("resize", closeResearchSelectionMenu);
}

function createProjectBulkSelectionController(panel, projects, mode) {
  const records = projects.slice(0, 24).filter((project) => projectRecordID(project));
  const recordByID = new Map(records.map((project) => [projectRecordID(project), project]));
  const orderedIDs = [...recordByID.keys()];
  const selectedIDs = new Set();
  const cards = new Map();
  let active = false;
  let busy = false;
  let lastSelectedIndex = -1;

  const selectButton = document.createElement("button");
  selectButton.className = "icon-button projects-select-button";
  selectButton.type = "button";
  selectButton.title = "Select projects";
  selectButton.setAttribute("aria-label", "Select projects");
  selectButton.setAttribute("aria-pressed", "false");
  selectButton.innerHTML = selectionModeIconSVG();
  panel.querySelector(".panel-actions")?.prepend(selectButton);

  const bulkBar = document.createElement("section");
  bulkBar.className = "project-bulk-bar";
  bulkBar.hidden = true;
  bulkBar.setAttribute("aria-label", mode === "archive" ? "Archived project selection" : "Project selection");
  const countLabel = document.createElement("span");
  countLabel.className = "project-bulk-count";
  const selectAllButton = document.createElement("button");
  selectAllButton.className = "project-bulk-link";
  selectAllButton.type = "button";
  const actionButton = document.createElement("button");
  actionButton.className = `project-bulk-action ${mode === "archive" ? "is-delete" : "is-archive"}`;
  actionButton.type = "button";
  const deleteButton = mode === "projects" ? document.createElement("button") : null;
  if (deleteButton) {
    deleteButton.className = "project-bulk-action is-delete";
    deleteButton.type = "button";
  }
  const cancelButton = document.createElement("button");
  cancelButton.className = "project-bulk-link";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  bulkBar.append(countLabel, selectAllButton, actionButton);
  if (deleteButton) bulkBar.append(deleteButton);
  bulkBar.append(cancelButton);
  panel.append(bulkBar);

  function update() {
    panel.classList.toggle("is-project-selecting", active);
    selectButton.setAttribute("aria-pressed", String(active));
    selectButton.title = active ? "Cancel project selection" : "Select projects";
    selectButton.setAttribute("aria-label", selectButton.title);
    bulkBar.hidden = !active;
    const selectedCount = selectedIDs.size;
    countLabel.textContent = `${selectedCount} selected`;
    const allSelected = orderedIDs.length > 0 && selectedCount === orderedIDs.length;
    selectAllButton.textContent = allSelected ? "Clear all" : "Select all";
    actionButton.textContent = `${mode === "archive" ? "Delete" : "Archive"} ${selectedCount}`;
    actionButton.disabled = selectedCount === 0 || busy;
    if (deleteButton) {
      deleteButton.textContent = `Delete ${selectedCount}`;
      deleteButton.disabled = selectedCount === 0 || busy;
    }
    selectAllButton.disabled = busy;
    cancelButton.disabled = busy;
    selectButton.disabled = busy;
    cards.forEach((card, id) => {
      const selected = selectedIDs.has(id);
      card.classList.toggle("is-selected", selected);
      if (active) card.setAttribute("aria-pressed", String(selected));
      else card.removeAttribute("aria-pressed");
      card.setAttribute(
        "aria-label",
        active ? `${selected ? "Deselect" : "Select"} ${card.dataset.projectName || "project"}` : card.dataset.defaultAriaLabel
      );
    });
  }

  function setActive(nextActive) {
    active = nextActive;
    selectedIDs.clear();
    lastSelectedIndex = -1;
    update();
  }

  const controller = {
    isActive: () => active,
    register(card, project) {
      const id = projectRecordID(project);
      if (!id || !recordByID.has(id)) return;
      cards.set(id, card);
      card.dataset.projectRecordId = id;
      card.dataset.projectName = project.name || project.title || "project";
      card.dataset.defaultAriaLabel = card.getAttribute("aria-label") || "Open project";
      const indicator = document.createElement("span");
      indicator.className = "project-selection-check";
      indicator.setAttribute("aria-hidden", "true");
      indicator.innerHTML = selectionIndicatorIconSVG();
      card.prepend(indicator);
      update();
    },
    toggle(project, event = null) {
      const id = projectRecordID(project);
      const index = orderedIDs.indexOf(id);
      if (!active || index < 0 || busy) return;
      const shouldSelect = !selectedIDs.has(id);
      if (event?.shiftKey && lastSelectedIndex >= 0) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        orderedIDs.slice(start, end + 1).forEach((rangeID) => {
          if (shouldSelect) selectedIDs.add(rangeID);
          else selectedIDs.delete(rangeID);
        });
      } else if (shouldSelect) {
        selectedIDs.add(id);
      } else {
        selectedIDs.delete(id);
      }
      lastSelectedIndex = index;
      update();
    }
  };

  selectButton.addEventListener("click", () => setActive(!active));
  selectAllButton.addEventListener("click", () => {
    if (selectedIDs.size === orderedIDs.length) selectedIDs.clear();
    else orderedIDs.forEach((id) => selectedIDs.add(id));
    lastSelectedIndex = -1;
    update();
  });
  cancelButton.addEventListener("click", () => setActive(false));
  actionButton.addEventListener("click", async () => {
    const selectedProjects = orderedIDs.filter((id) => selectedIDs.has(id)).map((id) => recordByID.get(id));
    if (!selectedProjects.length) return;
    busy = true;
    update();
    const completed = mode === "projects"
      ? await archiveProjects(selectedProjects)
      : await deleteArchivedProjects(selectedProjects);
    if (!completed) {
      busy = false;
      update();
    }
  });
  deleteButton?.addEventListener("click", async () => {
    const selectedProjects = orderedIDs.filter((id) => selectedIDs.has(id)).map((id) => recordByID.get(id));
    if (!selectedProjects.length) return;
    busy = true;
    update();
    const completed = await deleteArchivedProjects(selectedProjects);
    if (!completed) {
      busy = false;
      update();
    }
  });
  update();
  return controller;
}

function appendWorkspaceColumnIntro(content, text) {
  const intro = document.createElement("p");
  intro.className = "workspace-column-intro";
  intro.textContent = text;
  content.append(intro);
}

async function renderProjects() {
  const panel = renderTemplate(projectsTemplate);
  applyPaneWeight(panel, "utility:projects");
  const content = panel.querySelector(".projects-content");
  const addButton = panel.querySelector(".projects-add-button");
  const archiveButton = panel.querySelector(".projects-archive-button");
  clear(content);
  appendWorkspaceColumnIntro(content, "Projects organize saved sections, notes, and Workboards around a specific job or research topic.");
  addButton?.addEventListener("click", () => showProjectCreateSheet(panel));
  archiveButton?.setAttribute("aria-pressed", String(state.utilities.archive));
  archiveButton?.addEventListener("click", toggleArchiveAfterProjectsStack);
  const data = await loadSyncedContent();

  if (data.status === "disconnected") {
    const projects = activeProjectRecords([]);
    if (projects.length === 0) {
      appendProjectEmptyCard(content, "No projects", "Use the add button to create a project folder.");
    } else {
      const selectionController = createProjectBulkSelectionController(panel, projects, "projects");
      renderProjectRows(content, projects, currentContentSummary().projectSections, { mode: "projects", selectionController });
    }
    return panel;
  }
  if (data.status === "error") {
    appendProjectEmptyCard(content, "Sync error", data.error || "Could not load projects.");
    return panel;
  }

  const { projects, projectSections } = currentContentSummary();
  const visibleProjects = activeProjectRecords(projects);
  if (visibleProjects.length === 0) {
    appendProjectEmptyCard(content, "No projects", "Use the add button to create a project folder.");
  } else {
    const selectionController = createProjectBulkSelectionController(panel, visibleProjects, "projects");
    renderProjectRows(content, visibleProjects, projectSections, { mode: "projects", selectionController });
  }

  return panel;
}

async function renderArchive() {
  const panel = renderTemplate(projectsTemplate);
  panel.classList.remove("projects-panel");
  panel.classList.add("archive-panel");
  panel.dataset.paneId = "utility:archive";
  applyPaneWeight(panel, "utility:archive");
  const kind = panel.querySelector(".panel-kind");
  const title = panel.querySelector(".panel-title");
  const addButton = panel.querySelector(".projects-add-button");
  const archiveButton = panel.querySelector(".projects-archive-button");
  const actions = panel.querySelector(".panel-actions");
  const content = panel.querySelector(".projects-content");
  if (kind) kind.textContent = "Archive";
  if (title) title.textContent = "Archive";
  addButton?.remove();
  archiveButton?.remove();
  const closeButton = document.createElement("button");
  closeButton.className = "icon-button archive-close-button";
  closeButton.type = "button";
  closeButton.title = "Close archive";
  closeButton.setAttribute("aria-label", "Close archive");
  closeButton.innerHTML = circleXIconSVG();
  closeButton.addEventListener("click", closeArchiveColumn);
  actions?.prepend(closeButton);
  clear(content);
  const data = await loadSyncedContent();
  const sourceProjects = ["connected", "offline"].includes(data.status) ? data.summary.projects : [];
  const projects = archivedProjectRecords(sourceProjects);
  if (data.status === "error") {
    appendProjectEmptyCard(content, "Sync error", data.error || "Could not load archived projects.");
    return panel;
  }
  if (projects.length === 0) {
    appendProjectEmptyCard(content, "No archived projects", "Archived project folders will appear here.");
  } else {
    const selectionController = createProjectBulkSelectionController(panel, projects, "archive");
    renderProjectRows(content, projects, currentContentSummary().projectSections || [], { mode: "archive", selectionController });
  }
  return panel;
}

function projectIdentity(project) {
  return {
    id: project.id || "",
    clientID: project.clientID || "",
    localFolderID: project.localFolderID || "",
    name: project.name || project.title || "Project",
    title: project.title || project.name || "Project",
    address: project.address || "",
    description: project.description || "",
    color: projectColor(project)
  };
}

function projectSectionBelongsToProject(item, project) {
  const itemIDs = [item?.folderClientID, item?.localFolderID, item?.folderID]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String);
  const projectIDs = [project?.clientID, project?.id, project?.localFolderID]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String);
  return itemIDs.some((id) => projectIDs.includes(id));
}

async function openProjectDetail(project, options = {}) {
  if (!detachedProjectWindow && projectHasDetachedWorkboard(project)) {
    openDetachedWindow(project);
    return;
  }
  const identity = projectIdentity(project);
  const detailID = paneIDForProjectDetail(identity);
  const details = openProjectDetails();
  if (details.some((detail) => projectDetailMatches(project, detail))) {
    closeProjectDetailForProject(identity);
  } else {
    setOpenProjectDetails([...details, identity]);
    if (options.sourcePaneID === "utility:archive") {
      placePaneBefore("utility:archive", detailID);
      placeArchiveAfterProjectsStack();
    } else {
      placeProjectDetailAfterProjects(identity, options.sourcePaneID);
    }
  }
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });
}

function projectDetailMatches(project, detail) {
  if (!project || !detail) return false;
  const ids = [project.id, project.clientID, project.localFolderID].filter(Boolean).map(String);
  const detailIDs = [detail.id, detail.clientID, detail.localFolderID].filter(Boolean).map(String);
  if (detailIDs.some((id) => ids.includes(id))) return true;
  return Boolean(!ids.length && !detailIDs.length && projectDetailKey(project) === projectDetailKey(detail));
}

function emptyNotebookDocument() {
  return {
    schema: "permitext-notebook-card",
    schemaVersion: 1,
    format: "tiptap-json",
    document: { type: "doc", content: [{ type: "paragraph" }] }
  };
}

function notebookCardTypeLabel(cardType) {
  return {
    question: "Question",
    finding: "Finding",
    assumption: "Assumption",
    "missing-information": "Missing information",
    decision: "Decision",
    "coordination-item": "Coordination item",
    "review-task": "Review task"
  }[cardType] || "Note";
}

function notebookReferenceCandidates(projectID, foundation, cards) {
  const activeLinks = (foundation.links || []).filter((link) =>
    !link.deletedAt && link.projectID === projectID
  );
  const savedItems = currentContentSummary().savedItems || [];
  const references = [];
  activeLinks.filter((link) => link.targetKind === "canonicalSection").forEach((link) => {
    const savedItem = savedItems.find((item) => String(item.sectionID) === String(link.targetID));
    const citation = savedItem?.sectionNumber
      ? `${savedItem.codePrefix || "BC"} § ${savedItem.sectionNumber}`
      : `Code section ${link.targetID}`;
    references.push({
      referenceKind: "canonicalSection",
      referenceID: String(link.targetID),
      label: citation
    });
  });
  (foundation.researchAnswers || []).forEach((answer) => {
    references.push({
      referenceKind: "researchAnswer",
      referenceID: answer.id,
      label: `Research: ${answer.question || answer.conclusion || "Historical answer"}`
    });
  });
  cards.forEach((card) => {
    references.push({
      referenceKind: "notebookCard",
      referenceID: card.id,
      label: `Notebook: ${card.title}`
    });
  });
  activeLinks.filter((link) => link.targetKind === "workboard").forEach((link) => {
    references.push({
      referenceKind: "workboard",
      referenceID: String(link.targetID),
      label: "Project Workboard"
    });
  });
  return references.filter((reference, index, all) =>
    all.findIndex((candidate) =>
      candidate.referenceKind === reference.referenceKind &&
      candidate.referenceID === reference.referenceID
    ) === index
  );
}

async function openNotebookReference(project, foundation, reference, selectCard) {
  if (reference.referenceKind === "canonicalSection") {
    const savedItem = (currentContentSummary().savedItems || [])
      .find((item) => String(item.sectionID) === String(reference.referenceID));
    await openSectionDetailForExistingSearch({
      sectionID: reference.referenceID,
      codePrefix: savedItem?.codePrefix || "BC",
      chapterID: savedItem?.chapterID || "",
      chapterNumber: savedItem?.chapterNumber || "",
      sectionNumber: savedItem?.sectionNumber || "",
      title: savedItem?.title || reference.label
    });
    return;
  }
  if (reference.referenceKind === "researchAnswer") {
    const answer = (foundation.researchAnswers || [])
      .find((candidate) => candidate.id === reference.referenceID);
    if (answer?.conversationID) await openResearchConversation(answer.conversationID);
    return;
  }
  if (reference.referenceKind === "notebookCard") {
    await selectCard(reference.referenceID);
    return;
  }
  if (reference.referenceKind === "workboard") {
    await openProjectWorkboard(project);
    return;
  }
  await showWebNotice(
    "Linked Project item",
    "This item is preserved in the Notebook card and will open in its dedicated Project Studio view when that view is available."
  );
}

async function renderProjectNotebook(project) {
  const identity = projectIdentity(project);
  const projectID = projectDetailKey(identity);
  const paneID = paneIDForProjectNotebook(identity);
  notebookMounts.get(projectID)?.dispose?.();

  const panel = document.createElement("article");
  panel.className = "workspace-panel notebook-panel";
  panel.dataset.paneId = paneID;
  panel.dataset.projectId = projectID;
  panel.style.setProperty("--project-color", identity.color || "#c96410");
  applyPaneWeight(panel, paneID);

  const header = document.createElement("header");
  header.className = "notebook-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "notebook-eyebrow";
  eyebrow.textContent = identity.name;
  const title = document.createElement("h2");
  title.textContent = "Notebook";
  heading.append(eyebrow, title);
  const closeButton = document.createElement("button");
  closeButton.className = "notebook-close";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => closeProjectNotebook(identity));
  header.append(heading, closeButton);

  const shell = document.createElement("div");
  shell.className = "notebook-shell";
  const status = document.createElement("p");
  status.className = "notebook-status";
  status.setAttribute("role", "status");
  status.textContent = "Loading Project Notebook…";
  shell.append(status);
  panel.append(header, shell);

  let editorMount = null;
  let editorRenderSequence = 0;
  let cards = [];
  let foundation = { links: [], researchAnswers: [] };
  let activeCard = null;
  let draftDocument = emptyNotebookDocument();
  let dirty = false;
  let disposed = false;

  const mountState = {
    panel,
    dispose() {
      disposed = true;
      editorRenderSequence += 1;
      editorMount?.destroy?.();
      editorMount = null;
    }
  };
  notebookMounts.set(projectID, mountState);

  if (!activeAccount()) {
    status.textContent = "Sign in from Settings to use the private Project Notebook.";
    return panel;
  }

  try {
    const [foundationPayload, cardPayload] = await Promise.all([
      postResearch("/projects/foundation/state", { projectID }),
      postResearch("/notebook/cards/list", { projectID })
    ]);
    if (disposed) return panel;
    foundation = foundationPayload;
    cards = cardPayload.cards || [];
    shell.replaceChildren();

    const rail = document.createElement("aside");
    rail.className = "notebook-card-rail";
    const railHeader = document.createElement("div");
    railHeader.className = "notebook-card-rail-header";
    const railTitle = document.createElement("h3");
    railTitle.textContent = "Project notes";
    const newButton = document.createElement("button");
    newButton.className = "notebook-primary-action";
    newButton.type = "button";
    newButton.textContent = "New card";
    railHeader.append(railTitle, newButton);
    const cardList = document.createElement("div");
    cardList.className = "notebook-card-list";
    rail.append(railHeader, cardList);

    const focus = document.createElement("section");
    focus.className = "notebook-focus";
    shell.append(rail, focus);

    async function loadCard(cardID) {
      if (dirty && activeCard) {
        const confirmed = await confirmWebWarning(
          "Discard unsaved Notebook changes?",
          "Your edits to the focused card have not been saved.",
          { confirmLabel: "Discard changes" }
        );
        if (!confirmed) return;
      }
      const payload = await postResearch("/notebook/cards/get", { cardID });
      activeCard = payload.card;
      draftDocument = activeCard.document;
      dirty = false;
      renderCardList();
      await renderFocusedCard();
    }

    function renderCardList() {
      cardList.replaceChildren();
      if (!cards.length) {
        const empty = document.createElement("p");
        empty.className = "notebook-card-list-empty";
        empty.textContent = "Create a card for a question, finding, decision, or coordination item.";
        cardList.append(empty);
        return;
      }
      cards.forEach((card) => {
        const button = document.createElement("button");
        button.className = "notebook-card-tile";
        button.type = "button";
        button.setAttribute("aria-pressed", String(activeCard?.id === card.id));
        const type = document.createElement("span");
        type.textContent = notebookCardTypeLabel(card.cardType);
        const cardTitle = document.createElement("strong");
        cardTitle.textContent = card.title;
        const preview = document.createElement("p");
        preview.textContent = card.plainText || "Empty card";
        const meta = document.createElement("small");
        meta.textContent = `${card.referenceCount || 0} linked · ${researchRelativeDate(card.updatedAt)}`;
        button.append(type, cardTitle, preview, meta);
        button.addEventListener("click", () => {
          void loadCard(card.id).catch((error) => showWebNotice("Card not opened", error.message));
        });
        cardList.append(button);
      });
    }

    async function renderFocusedCard() {
      editorRenderSequence += 1;
      const renderSequence = editorRenderSequence;
      editorMount?.destroy?.();
      editorMount = null;
      focus.replaceChildren();

      if (!activeCard) {
        const welcome = document.createElement("div");
        welcome.className = "notebook-welcome";
        const welcomeTitle = document.createElement("h3");
        welcomeTitle.textContent = "A focused workspace for Project thinking";
        const welcomeCopy = document.createElement("p");
        welcomeCopy.textContent = "Keep structured notes here, link them to enacted code or historical Research, and reuse them later in a professional report.";
        const welcomeAction = document.createElement("button");
        welcomeAction.className = "notebook-primary-action";
        welcomeAction.type = "button";
        welcomeAction.textContent = "Create first card";
        welcomeAction.addEventListener("click", () => newButton.click());
        welcome.append(welcomeTitle, welcomeCopy, welcomeAction);
        focus.append(welcome);
        return;
      }

      const fields = document.createElement("div");
      fields.className = "notebook-card-fields";
      const typeSelect = document.createElement("select");
      typeSelect.className = "notebook-card-type";
      typeSelect.setAttribute("aria-label", "Notebook card type");
      [
        "question",
        "finding",
        "assumption",
        "missing-information",
        "decision",
        "coordination-item",
        "review-task"
      ].forEach((cardType) => {
        const option = document.createElement("option");
        option.value = cardType;
        option.textContent = notebookCardTypeLabel(cardType);
        typeSelect.append(option);
      });
      typeSelect.value = activeCard.cardType;
      const titleInput = document.createElement("input");
      titleInput.className = "notebook-card-title";
      titleInput.type = "text";
      titleInput.maxLength = 300;
      titleInput.placeholder = "Card title";
      titleInput.setAttribute("aria-label", "Notebook card title");
      titleInput.value = activeCard.title;
      fields.append(typeSelect, titleInput);

      const toolbar = document.createElement("div");
      toolbar.className = "notebook-toolbar";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", "Notebook formatting and references");
      const boldButton = document.createElement("button");
      boldButton.type = "button";
      boldButton.textContent = "Bold";
      const italicButton = document.createElement("button");
      italicButton.type = "button";
      italicButton.textContent = "Italic";
      const undoButton = document.createElement("button");
      undoButton.type = "button";
      undoButton.textContent = "Undo";
      const redoButton = document.createElement("button");
      redoButton.type = "button";
      redoButton.textContent = "Redo";
      const referenceSelect = document.createElement("select");
      referenceSelect.setAttribute("aria-label", "Project item to link");
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Link Project item…";
      referenceSelect.append(placeholder);
      const candidates = notebookReferenceCandidates(projectID, foundation, cards)
        .filter((reference) =>
          reference.referenceKind !== "notebookCard" ||
          reference.referenceID !== activeCard.id
        );
      candidates.forEach((reference, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = reference.label;
        referenceSelect.append(option);
      });
      const addReferenceButton = document.createElement("button");
      addReferenceButton.type = "button";
      addReferenceButton.textContent = "Add link";
      addReferenceButton.disabled = true;
      referenceSelect.addEventListener("change", () => {
        addReferenceButton.disabled = referenceSelect.value === "";
      });
      toolbar.append(
        boldButton,
        italicButton,
        undoButton,
        redoButton,
        referenceSelect,
        addReferenceButton
      );

      const editorElement = document.createElement("div");
      editorElement.className = "notebook-editor-surface";
      const activateFocusedReference = (referenceElement) => {
        void openNotebookReference(identity, foundation, {
          referenceKind: referenceElement.dataset.referenceKind,
          referenceID: referenceElement.dataset.referenceId,
          label: referenceElement.dataset.referenceLabel || referenceElement.textContent || "Linked item"
        }, loadCard).catch((error) => showWebNotice("Linked item not opened", error.message));
      };
      editorElement.addEventListener("click", (event) => {
        const referenceElement = event.target.closest?.("[data-permitext-reference]");
        if (!referenceElement) return;
        event.preventDefault();
        event.stopPropagation();
        activateFocusedReference(referenceElement);
      }, true);
      editorElement.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const referenceElement = event.target.closest?.("[data-permitext-reference]");
        if (!referenceElement) return;
        event.preventDefault();
        event.stopPropagation();
        activateFocusedReference(referenceElement);
      }, true);
      const footer = document.createElement("div");
      footer.className = "notebook-card-footer";
      const saveStatus = document.createElement("span");
      saveStatus.textContent = activeCard.id ? `Version ${activeCard.version}` : "New card";
      const footerActions = document.createElement("div");
      const researchButton = document.createElement("button");
      researchButton.className = "notebook-secondary-action";
      researchButton.type = "button";
      researchButton.textContent = "Start Research";
      researchButton.title = "Use this card as the starting point for a new evidence-selected Research question";
      const deleteButton = document.createElement("button");
      deleteButton.className = "notebook-danger-action";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.hidden = !activeCard.id;
      const saveButton = document.createElement("button");
      saveButton.className = "notebook-primary-action";
      saveButton.type = "button";
      saveButton.textContent = "Save card";
      footerActions.append(researchButton, deleteButton, saveButton);
      footer.append(saveStatus, footerActions);
      focus.append(fields, toolbar, editorElement, footer);

      typeSelect.addEventListener("change", () => {
        activeCard.cardType = typeSelect.value;
        dirty = true;
        saveStatus.textContent = "Unsaved changes";
      });
      titleInput.addEventListener("input", () => {
        activeCard.title = titleInput.value;
        dirty = true;
        saveStatus.textContent = "Unsaved changes";
      });

      const module = await loadNotebookModule();
      if (disposed || renderSequence !== editorRenderSequence) return;
      editorMount = module.mountPermitextNotebookEditor(editorElement, {
        document: draftDocument,
        autofocus: !activeCard.id,
        onChange(document) {
          draftDocument = document;
          dirty = true;
          saveStatus.textContent = "Unsaved changes";
        },
        onSelectionChange(selection) {
          boldButton.setAttribute("aria-pressed", String(selection.bold));
          italicButton.setAttribute("aria-pressed", String(selection.italic));
        },
        onOpenReference: null
      });
      boldButton.addEventListener("click", () => editorMount?.toggleBold());
      italicButton.addEventListener("click", () => editorMount?.toggleItalic());
      undoButton.addEventListener("click", () => editorMount?.undo());
      redoButton.addEventListener("click", () => editorMount?.redo());
      addReferenceButton.addEventListener("click", () => {
        const reference = candidates[Number(referenceSelect.value)];
        if (!reference) return;
        editorMount?.insertReference(reference);
        referenceSelect.value = "";
        addReferenceButton.disabled = true;
      });

      saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        try {
          const payload = await postResearch("/notebook/cards/save", {
            projectID,
            cardID: activeCard.id || undefined,
            expectedVersion: activeCard.version || 0,
            cardType: typeSelect.value,
            title: titleInput.value,
            document: editorMount.getDocument()
          });
          activeCard = payload.card;
          draftDocument = activeCard.document;
          dirty = false;
          const summary = {
            id: activeCard.id,
            version: activeCard.version,
            cardType: activeCard.cardType,
            title: activeCard.title,
            plainText: activeCard.plainText,
            referenceCount: activeCard.references?.length || 0,
            createdAt: activeCard.createdAt,
            updatedAt: activeCard.updatedAt
          };
          cards = [summary, ...cards.filter((card) => card.id !== summary.id)];
          foundation.artifacts = [
            ...(foundation.artifacts || []).filter((artifact) => artifact.envelope?.id !== activeCard.id),
            { envelope: { id: activeCard.id, type: "notebookCard" }, payload: activeCard }
          ];
          renderCardList();
          await renderFocusedCard();
        } catch (error) {
          if (error.payload?.code === "NOTEBOOK_VERSION_CONFLICT" && error.payload.card) {
            activeCard = error.payload.card;
            draftDocument = activeCard.document;
            dirty = false;
            await renderFocusedCard();
            await showWebNotice(
              "Newer Notebook version loaded",
              "Another edit was saved first. Permitext loaded the current version so you can review it before editing again."
            );
          } else {
            await showWebNotice("Card not saved", error.message);
          }
        } finally {
          saveButton.disabled = false;
        }
      });

      deleteButton.addEventListener("click", async () => {
        const confirmed = await confirmWebWarning(
          "Delete Notebook card?",
          `“${activeCard.title}” will be removed from its linked Projects. Its tombstone remains in sync history.`,
          { confirmLabel: "Delete card" }
        );
        if (!confirmed) return;
        deleteButton.disabled = true;
        try {
          await postResearch("/notebook/cards/delete", {
            cardID: activeCard.id,
            expectedVersion: activeCard.version
          });
          cards = cards.filter((card) => card.id !== activeCard.id);
          activeCard = null;
          draftDocument = emptyNotebookDocument();
          dirty = false;
          renderCardList();
          await renderFocusedCard();
        } catch (error) {
          deleteButton.disabled = false;
          await showWebNotice("Card not deleted", error.message);
        }
      });

      researchButton.addEventListener("click", async () => {
        const bodyText = String(editorElement.innerText || activeCard.plainText || "").trim();
        researchQuestionDraft = bodyText || activeCard.title;
        const researchWasOpen = Boolean(state.utilities.analysis);
        await focusUtility("analysis");
        if (researchWasOpen) {
          await transitionWorkspace("utility", { refreshPaneIDs: ["utility:analysis"] });
          scrollPaneIntoView("utility:analysis");
        }
      });
    }

    newButton.addEventListener("click", async () => {
      if (dirty && activeCard) {
        const confirmed = await confirmWebWarning(
          "Discard unsaved Notebook changes?",
          "Your edits to the focused card have not been saved.",
          { confirmLabel: "Discard changes" }
        );
        if (!confirmed) return;
      }
      activeCard = {
        id: "",
        version: 0,
        cardType: "finding",
        title: "",
        plainText: "",
        references: []
      };
      draftDocument = emptyNotebookDocument();
      dirty = false;
      renderCardList();
      await renderFocusedCard();
    });

    renderCardList();
    if (cards[0]) {
      await loadCard(cards[0].id);
    } else {
      await renderFocusedCard();
    }
  } catch (error) {
    status.textContent = error.payload?.code === "PRO_REQUIRED_NOTEBOOK"
      ? "The Project Notebook is included with Permitext Pro."
      : `Notebook unavailable: ${error.message}`;
  }
  return panel;
}

function closeProjectDetailForProject(project) {
  const matchingDetails = openProjectDetails().filter((detail) => projectDetailMatches(project, detail));
  if (!matchingDetails.length) return;
  setOpenProjectDetails(openProjectDetails().filter((detail) => !projectDetailMatches(project, detail)));
  matchingDetails.forEach((detail) => {
    const detailID = paneIDForProjectDetail(detail);
    const workboardID = paneIDForProjectWorkboard(detail);
    const notebookID = paneIDForProjectNotebook(detail);
    delete state.paneWeights[detailID];
    delete state.paneWeights[workboardID];
    delete state.paneWeights[notebookID];
    state.paneOrder = (state.paneOrder || [])
      .filter((id) => id !== detailID && id !== workboardID && id !== notebookID);
  });
  state.workboards = openWorkboards().filter((item) => !projectDetailMatches(project, item));
  state.notebooks = openNotebooks().filter((item) => !projectDetailMatches(project, item));
}

function closeDeletedProjectDetails() {
  if (syncedContent?.status !== "connected") return false;
  const visibleProjects = visibleProjectRecords(syncedContent.summary?.projects || []);
  const deletedDetails = openProjectDetails().filter((detail) =>
    !visibleProjects.some((project) => projectDetailMatches(project, detail))
  );
  deletedDetails.forEach((detail) => closeProjectDetailForProject(detail));
  return deletedDetails.length > 0;
}

async function archiveProject(project) {
  return archiveProjects([project]);
}

async function archiveProjects(projects) {
  const archived = archivedProjectIDSet();
  const eligibleProjects = projects.filter((project) => projectRecordID(project));
  if (!eligibleProjects.length) return false;
  const archivedAt = new Date().toISOString();
  eligibleProjects.forEach((project) => archived.add(projectRecordID(project)));
  state.archivedProjectIDs = Array.from(archived);
  const archivedProjects = eligibleProjects.map((project) => ({
    ...project,
    archivedAt,
    updatedAt: archivedAt
  }));
  const archivedIDs = new Set(archivedProjects.map(projectRecordID));
  state.localProjects = [
    ...(state.localProjects || []).filter((project) => !archivedIDs.has(projectRecordID(project))),
    ...archivedProjects
  ];
  eligibleProjects.forEach((project) => closeProjectDetailForProject(project));
  state.detachedWorkboards = detachedWorkboards().filter((item) =>
    !eligibleProjects.some((project) => projectDetailMatches(project, item))
  );
  const currentLeft = track.scrollLeft;
  saveWorkspaceState();
  const account = activeAccount();
  if (account) {
    for (const project of archivedProjects) {
      try {
        await pushMutation(projectMutationForRecord(project, account));
        state.localProjects = (state.localProjects || [])
          .filter((item) => projectRecordID(item) !== projectRecordID(project));
      } catch (error) {
        if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
        // Keep the local archived overlay while the durable sync queue recovers.
      }
    }
    saveWorkspaceState();
  }
  await transitionWorkspace("utility", {
    refreshPaneIDs: projectOverviewRefreshPaneIDs(...(state.utilities.archive ? ["utility:archive"] : []))
  });
  track.scrollLeft = currentLeft;
  return true;
}

async function restoreArchivedProject(project) {
  const id = projectRecordID(project);
  if (!id) return;
  const restoredAt = new Date().toISOString();
  const restoredProject = {
    ...project,
    archivedAt: null,
    updatedAt: restoredAt
  };
  state.archivedProjectIDs = Array.from(archivedProjectIDSet()).filter((projectID) => projectID !== id);
  state.localProjects = [
    ...(state.localProjects || []).filter((item) => projectRecordID(item) !== id),
    restoredProject
  ];
  const currentLeft = track.scrollLeft;
  saveWorkspaceState();
  const account = activeAccount();
  if (account) {
    try {
      await pushMutation(projectMutationForRecord(restoredProject, account));
      state.localProjects = (state.localProjects || []).filter((item) => projectRecordID(item) !== id);
      saveWorkspaceState();
    } catch (error) {
      if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
      // Keep the local restored overlay while the durable sync queue recovers.
    }
  }
  await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs("utility:archive") });
  track.scrollLeft = currentLeft;
}

async function deleteArchivedProject(project) {
  const id = projectRecordID(project);
  if (!id) return;
  const name = project.name || project.title || "this project";
  const confirmed = await confirmWebWarning(
    "Delete project",
    `This will permanently delete ${name}. This cannot be undone.`,
    { confirmLabel: "Delete" }
  );
  if (!confirmed) return;
  const currentLeft = track.scrollLeft;
  try {
    await deleteArchivedProjectData(project);
  } catch (error) {
    await showWebNotice("Could not delete project", error.message || "The project could not be deleted.");
    return;
  }
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs("utility:archive") });
  track.scrollLeft = currentLeft;
}

async function deleteArchivedProjects(projects) {
  const eligibleProjects = projects.filter((project) => projectRecordID(project));
  if (!eligibleProjects.length) return false;
  const count = eligibleProjects.length;
  const confirmed = await confirmWebWarning(
    `Delete ${count === 1 ? "project" : "projects"}`,
    `This will permanently delete ${count} ${count === 1 ? "project" : "projects"}. This cannot be undone.`,
    { confirmLabel: "Delete" }
  );
  if (!confirmed) return false;
  const currentLeft = track.scrollLeft;
  let deletedCount = 0;
  const deletedIDs = new Set();
  for (const project of eligibleProjects) {
    try {
      await deleteArchivedProjectData(project);
      deletedCount += 1;
      deletedIDs.add(projectRecordID(project));
    } catch (error) {
      const progress = deletedCount > 0 ? ` Deleted ${deletedCount} of ${count}.` : "";
      await showWebNotice(
        "Could not delete projects",
        `${error.message || "The selected projects could not be deleted."}${progress}`
      );
      break;
    }
  }
  state.localProjects = (state.localProjects || []).filter((item) => !deletedIDs.has(projectRecordID(item)));
  state.archivedProjectIDs = Array.from(archivedProjectIDSet()).filter((id) => !deletedIDs.has(id));
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs("utility:archive") });
  track.scrollLeft = currentLeft;
  return deletedCount > 0;
}

async function deleteArchivedProjectData(project) {
  const id = projectRecordID(project);
  if (!id) return;
  const workboardID = workboardProjectID(projectIdentity(project));
  const deletedAt = new Date().toISOString();
  const linkedSections = (currentContentSummary().projectSections || [])
    .filter((item) => projectSectionBelongsToProject(item, project));
  const membershipTombstones = linkedSections.map((item) =>
    deletedProjectSectionMutationForItem(project, item).projectSection
  );
  state.localProjects = [
    ...(state.localProjects || []).filter((item) => projectRecordID(item) !== id),
    { ...project, updatedAt: deletedAt, deletedAt }
  ];
  state.archivedProjectIDs = Array.from(archivedProjectIDSet()).filter((projectID) => projectID !== id);
  state.localProjectSections = [
    ...(state.localProjectSections || []).filter((item) => !projectSectionBelongsToProject(item, project)),
    ...membershipTombstones
  ];
  saveWorkspaceState();
  if (activeAccount()) {
    try {
      const account = activeAccount();
      membershipTombstones.forEach((record) => enqueueSyncMutation({ projectSection: record }, account));
      enqueueSyncMutation(deletedProjectMutationForRecord(project), account);
      await flushSyncOutbox({ refresh: true });
    } catch (error) {
      if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
      // Keep the local deletion tombstone while sync recovers.
    }
  }
  if (activeAccount()) {
    try {
      await deleteSyncedWorkboard(workboardID);
    } catch {
      // The project deletion must survive a missing or stale Workboard record.
    }
  }
  await deleteLocalWorkboard(workboardID);
  closeProjectDetailForProject(project);
  state.detachedWorkboards = detachedWorkboards().filter((item) => !projectDetailMatches(project, item));
}

function createProjectSectionSelectionController(panel, actions, content, project, items) {
  const recordByID = new Map(items.map((item) => [savedItemSelectionID(item), item]));
  const orderedIDs = [...recordByID.keys()];
  const selectedIDs = new Set();
  const rows = new Map();
  let active = false;
  let busy = false;

  const selectButton = document.createElement("button");
  selectButton.className = "project-detail-select";
  selectButton.type = "button";
  selectButton.title = "Select saved project items";
  selectButton.setAttribute("aria-label", selectButton.title);
  selectButton.setAttribute("aria-pressed", "false");
  selectButton.innerHTML = selectionModeIconSVG();
  actions.prepend(selectButton);

  const bulkBar = document.createElement("section");
  bulkBar.className = "project-bulk-bar project-section-bulk-bar";
  bulkBar.hidden = true;
  const countLabel = document.createElement("span");
  countLabel.className = "project-bulk-count";
  const selectAllButton = document.createElement("button");
  selectAllButton.className = "project-bulk-link";
  selectAllButton.type = "button";
  const removeButton = document.createElement("button");
  removeButton.className = "project-bulk-action is-delete";
  removeButton.type = "button";
  const cancelButton = document.createElement("button");
  cancelButton.className = "project-bulk-link";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  bulkBar.append(countLabel, selectAllButton, removeButton, cancelButton);
  content.prepend(bulkBar);

  const update = () => {
    panel.classList.toggle("is-project-section-selecting", active);
    selectButton.setAttribute("aria-pressed", String(active));
    bulkBar.hidden = !active;
    const count = selectedIDs.size;
    countLabel.textContent = `${count} selected`;
    selectAllButton.textContent = count === orderedIDs.length ? "Clear all" : "Select all";
    removeButton.textContent = `Remove ${count}`;
    removeButton.disabled = count === 0 || busy;
    selectAllButton.disabled = busy;
    cancelButton.disabled = busy;
    selectButton.disabled = busy;
    rows.forEach((row, id) => {
      const selected = selectedIDs.has(id);
      row.classList.toggle("is-selected", selected);
      row.setAttribute("aria-selected", String(active && selected));
    });
  };
  const setActive = (nextActive) => {
    active = nextActive;
    selectedIDs.clear();
    update();
  };
  const controller = {
    isActive: () => active,
    register(row, item) {
      const id = savedItemSelectionID(item);
      rows.set(id, row);
      const indicator = document.createElement("span");
      indicator.className = "saved-selection-check";
      indicator.setAttribute("aria-hidden", "true");
      indicator.innerHTML = selectionIndicatorIconSVG();
      row.prepend(indicator);
      update();
    },
    toggle(item) {
      if (!active || busy) return;
      const id = savedItemSelectionID(item);
      if (selectedIDs.has(id)) selectedIDs.delete(id);
      else selectedIDs.add(id);
      update();
    }
  };
  selectButton.addEventListener("click", () => setActive(!active));
  selectAllButton.addEventListener("click", () => {
    if (selectedIDs.size === orderedIDs.length) selectedIDs.clear();
    else orderedIDs.forEach((id) => selectedIDs.add(id));
    update();
  });
  cancelButton.addEventListener("click", () => setActive(false));
  removeButton.addEventListener("click", async () => {
    const selectedItems = orderedIDs.filter((id) => selectedIDs.has(id)).map((id) => recordByID.get(id));
    const count = selectedItems.length;
    if (!count) return;
    const confirmed = await confirmWebWarning(
      "Remove saved items",
      `This will remove ${count} saved ${count === 1 ? "item" : "items"} from ${project.name}. Are you sure?`,
      { confirmLabel: "Remove" }
    );
    if (!confirmed) return;
    busy = true;
    update();
    let removedCount = 0;
    try {
      for (const item of selectedItems) {
        await removeSectionFromProject(project, item);
        removedCount += 1;
      }
      await showWebNotice(
        "Saved items removed",
        `${removedCount} ${removedCount === 1 ? "item was" : "items were"} removed from ${project.name}.`
      );
      await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(project)] });
    } catch (error) {
      await showWebNotice(
        "Could not remove saved items",
        `${error.message || "The selected project items could not be removed."} Removed ${removedCount} of ${count}.`
      );
      busy = false;
      update();
    }
  });
  update();
  return controller;
}

async function renderProjectDetail(detail) {
  const data = await loadSyncedContent();
  const projects = visibleProjectRecords(data.summary?.projects || []);
  const project = projects.find((item) => projectDetailMatches(item, detail)) || detail;
  const identity = projectIdentity(project);
  const summary = currentContentSummary();
  const projectSections = summary.projectSections || [];
  const savedItems = summary.savedItems || [];
  const sectionLinks = projectSections.filter((item) => projectSectionBelongsToProject(item, identity));
  const savedBySectionID = new Map(savedItems.map((item) => [String(item.sectionID || item.id || ""), item]));
  const linkedSavedItems = sectionLinks
    .map((link) => {
      const savedItem = savedBySectionID.get(String(link.sectionID || link.savedSectionID || link.itemID || "")) || {};
      return {
        ...link,
        ...savedItem,
        id: link.id,
        projectSectionID: link.id,
        folderClientID: link.folderClientID,
        localFolderID: link.localFolderID
      };
    })
    .filter(Boolean);
  const previewItems = await Promise.all(linkedSavedItems.map(async (item) => {
    const resolvedDetail = {
      codePrefix: item.codePrefix || "BC",
      chapterID: item.chapterID || "",
      chapterNumber: item.chapterNumber || "",
      sectionID: String(item.sectionID || item.savedSectionID || item.itemID || ""),
      sectionNumber: item.sectionNumber || "",
      title: item.title || "Section"
    };
    try {
      const { chapter, section } = await resolveSectionDetail(resolvedDetail);
      return {
        ...item,
        ...resolvedDetail,
        chapterID: resolvedDetail.chapterID || chapter?.id || "",
        sectionNumber: section?.sectionNumber || resolvedDetail.sectionNumber,
        title: section?.title || resolvedDetail.title,
        previewText: sectionPlainText(section).replace(/\s+/g, " ").trim().slice(0, 260)
      };
    } catch {
      return { ...item, ...resolvedDetail, previewText: "" };
    }
  }));

  const panel = document.createElement("article");
  panel.className = "workspace-panel project-detail-panel";
  panel.dataset.paneId = paneIDForProjectDetail(identity);
  panel.style.setProperty("--project-color", identity.color);
  applyPaneWeight(panel, paneIDForProjectDetail(identity));

  const chrome = document.createElement("header");
  chrome.className = "project-detail-chrome";
  const actions = document.createElement("div");
  actions.className = "project-detail-actions";
  const notebookButton = document.createElement("button");
  notebookButton.className = "project-notebook-button";
  notebookButton.type = "button";
  notebookButton.textContent = "Notebook";
  notebookButton.setAttribute("aria-pressed", String(projectHasOpenNotebook(identity)));
  notebookButton.hidden = detachedProjectWindow;
  notebookButton.addEventListener("pointerenter", () => {
    void loadNotebookModule().catch(() => {});
  }, { once: true });
  notebookButton.addEventListener("focus", () => {
    void loadNotebookModule().catch(() => {});
  }, { once: true });
  notebookButton.addEventListener("click", () => {
    if (projectHasOpenNotebook(identity)) {
      void closeProjectNotebook(identity);
      notebookButton.setAttribute("aria-pressed", "false");
    } else {
      void openProjectNotebook(identity);
      notebookButton.setAttribute("aria-pressed", "true");
    }
  });
  const workboardButton = document.createElement("button");
  workboardButton.className = "project-workboard-button";
  workboardButton.type = "button";
  workboardButton.textContent = "Workboard";
  workboardButton.setAttribute("aria-pressed", String(projectHasOpenWorkboard(identity)));
  workboardButton.hidden = detachedProjectWindow;
  const preloadWorkboard = () => {
    void loadWorkboardModule().catch(() => {});
  };
  workboardButton.addEventListener("pointerenter", preloadWorkboard, { once: true });
  workboardButton.addEventListener("focus", preloadWorkboard, { once: true });
  workboardButton.addEventListener("click", () => {
    if (projectHasOpenWorkboard(identity)) {
      void closeProjectWorkboard(identity);
      workboardButton.setAttribute("aria-pressed", "false");
    } else {
      void openProjectWorkboard(identity);
      workboardButton.setAttribute("aria-pressed", "true");
    }
  });
  const backButton = appendDetailIconButton(actions, {
    title: "Back",
    label: "Back to projects",
    className: "project-detail-back",
    svg: circleXIconSVG()
  });
  actions.prepend(notebookButton, workboardButton);
  const headingGroup = document.createElement("div");
  headingGroup.className = "project-detail-heading";
  const title = document.createElement("h2");
  title.textContent = identity.name;
  headingGroup.append(title);
  const addressText = String(project.address || identity.address || "").trim();
  if (addressText) {
    const address = document.createElement("p");
    address.textContent = addressText;
    headingGroup.append(address);
  }
  const descriptionText = String(project.description || identity.description || "").trim();
  if (descriptionText) {
    const description = document.createElement("p");
    description.textContent = descriptionText;
    headingGroup.append(description);
  }
  chrome.append(headingGroup, actions);

  const content = document.createElement("section");
  content.className = "project-detail-content";

  if (detail.selectedSection) {
    await renderProjectSectionText(content, identity, detail.selectedSection);
    backButton.addEventListener("click", () => {
      setOpenProjectDetails(openProjectDetails().map((item) =>
        projectDetailMatches(identity, item) ? { ...item, selectedSection: null } : item
      ));
      state.paneOrder = state.paneOrder || [];
      saveWorkspaceState();
      void transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(identity)] });
    });
    panel.append(chrome, content);
    return panel;
  }

  const savedSection = document.createElement("section");
  savedSection.className = "project-detail-section";
  const selectionController = previewItems.length
    ? createProjectSectionSelectionController(panel, actions, content, identity, previewItems)
    : null;
  const codeGroups = new Map();
  previewItems.forEach((item) => {
    const prefix = item.codePrefix || "BC";
    if (!codeGroups.has(prefix)) codeGroups.set(prefix, []);
    codeGroups.get(prefix).push(item);
  });

  codeGroups.forEach((items, prefix) => {
    const codeGroup = document.createElement("section");
    codeGroup.className = `project-saved-code-group code-theme-${codeTheme(prefix)}`;
    const codeLabel = document.createElement("p");
    codeLabel.className = "section-label saved-code-label";
    codeLabel.textContent = codeDisplayLabel(prefix);
    codeGroup.append(codeLabel);
    const orderedItems = [...items].sort((left, right) =>
      String(left.sectionNumber || left.sectionID || "").localeCompare(
        String(right.sectionNumber || right.sectionID || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      )
    );
    orderedItems.forEach((item) => {
      const row = document.createElement("article");
      row.className = "saved-row project-detail-saved-row";
      const openButton = document.createElement("button");
      openButton.className = "project-detail-section-open";
      openButton.type = "button";
      const sectionNumber = String(item.sectionNumber || item.sectionID || "").trim();
      const heading = document.createElement("span");
      heading.className = "project-detail-section-heading";
      const rowNumber = document.createElement("span");
      rowNumber.className = "project-detail-section-number";
      rowNumber.textContent = sectionNumber;
      const rowTitle = document.createElement("strong");
      rowTitle.className = "project-detail-section-title";
      rowTitle.textContent = sectionTitleWithoutNumber({
        sectionNumber,
        title: item.title || "Saved section"
      }) || "Saved section";
      heading.append(rowNumber, rowTitle);
      openButton.append(heading);
      if (item.previewText) {
        const preview = document.createElement("p");
        preview.className = "project-detail-section-preview";
        preview.textContent = item.previewText;
        openButton.append(preview);
      }
      openButton.addEventListener("click", () => {
        if (selectionController?.isActive()) selectionController.toggle(item);
        else void openProjectSavedSection(identity, item);
      });
      const removeButton = document.createElement("button");
      removeButton.className = "project-detail-section-remove";
      removeButton.type = "button";
      removeButton.title = "Remove from project";
      removeButton.setAttribute("aria-label", `Remove ${sectionDisplayTitle(sectionNumber, item.title || rowTitle.textContent)} from ${identity.name}`);
      removeButton.innerHTML = trashIconSVG();
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        try {
          await removeSectionFromProject(identity, item);
          await renderWorkspace();
        } catch (error) {
          removeButton.disabled = false;
          await showWebNotice("Could not remove section", error.message || "The section could not be removed.");
        }
      });
      row.append(openButton, removeButton);
      selectionController?.register(row, item);
      codeGroup.append(row);
    });
    savedSection.append(codeGroup);
  });

  backButton.addEventListener("click", () => {
    if (detachedProjectWindow) {
      window.close();
      return;
    }
    closeProjectDetailForProject(identity);
    saveWorkspaceState();
    void transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });
  });

  content.append(savedSection);
  panel.append(chrome, content);
  return panel;
}

async function renderProjectSectionText(content, project, item) {
  const detail = {
    codePrefix: item.codePrefix || "BC",
    chapterID: item.chapterID || "",
    chapterNumber: item.chapterNumber || "",
    sectionID: String(item.sectionID || item.savedSectionID || item.itemID || ""),
    sectionNumber: item.sectionNumber || "",
    title: item.title || "Section",
    headerLine: item.headerLine || "",
    headingLine: item.headingLine || ""
  };
  const { section } = await resolveSectionDetail(detail);
  const wrapper = document.createElement("section");
  wrapper.className = "project-section-reader";
  wrapper.classList.add(`code-theme-${codeTheme(detail.codePrefix)}`);

  const codeLabel = document.createElement("p");
  codeLabel.className = "section-label";
  codeLabel.textContent = codeDisplayLabel(detail.codePrefix);

  const chapterLabel = document.createElement("p");
  chapterLabel.className = "project-section-chapter";
  chapterLabel.textContent = detail.chapterNumber ? `Chapter ${detail.chapterNumber}` : "";

  const title = document.createElement("h3");
  title.textContent = sectionDisplayTitle(section?.sectionNumber || detail.sectionNumber, section?.title || detail.title);

  const body = document.createElement("section");
  body.className = "project-section-body";
  markResearchSelectable(body, detail);
  if (section?.blocks?.length) {
    section.blocks.forEach((block) => body.append(renderCodeBlock(block)));
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = sectionPlainText(section) || detail.title;
    body.append(paragraph);
  }

  wrapper.append(codeLabel);
  if (chapterLabel.textContent) wrapper.append(chapterLabel);
  wrapper.append(title, body);
  content.append(wrapper);
}

async function openProjectSavedSection(project, item) {
  const detail = { ...item };
  const { chapter, section } = await resolveSectionDetail(detail);
  const projectKey = projectDetailKey(project);
  const readerFields = {
    codePrefix: detail.codePrefix || "BC",
    chapterID: detail.chapterID || chapter?.id || "",
    sectionID: String(detail.sectionID || detail.savedSectionID || detail.itemID || ""),
    sectionNumber: section?.sectionNumber || detail.sectionNumber || "",
    title: section?.title || detail.title || "Section",
    shouldSmoothScrollToSection: false,
    projectSavedSourceKey: projectKey
  };
  let reader = (state.readers || []).find((candidate) => candidate.projectSavedSourceKey === projectKey);
  if (reader) {
    Object.assign(reader, readerFields);
  } else {
    reader = newReaderState(readerFields);
    state.readers.push(reader);
  }
  placePaneAfter(paneIDForProjectDetail(project), paneIDForReader(reader));
  updateBrowserSectionURL(reader.sectionID);
  scheduleContinuitySync(reader);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForReader(reader)] });
  scrollPaneIntoView(paneIDForReader(reader));
  alignReaderSectionAfterLayout(reader);
}

function showProjectCreateSheet(panel, project = null) {
  panel.querySelector(".project-sheet-overlay")?.remove();
  const isEditing = Boolean(project);
  const identity = isEditing ? projectIdentity(project) : null;
  const overlay = document.createElement("section");
  overlay.className = "project-sheet-overlay";
  overlay.setAttribute("aria-label", isEditing ? "Edit project" : "New project");

  const sheet = document.createElement("form");
  sheet.className = "project-create-sheet";

  const header = document.createElement("header");
  header.className = "project-sheet-header project-sheet-header-compact";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Save";
  saveButton.disabled = !isEditing;
  header.append(cancelButton, saveButton);

  const nameLabel = document.createElement("label");
  nameLabel.className = "project-sheet-field";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "project-name-input";
  nameInput.placeholder = "Project Name";
  nameInput.autocomplete = "off";
  if (identity) nameInput.value = identity.name;
  nameLabel.append(nameInput);

  const addressLabel = document.createElement("label");
  addressLabel.className = "project-sheet-field";
  const addressInput = document.createElement("input");
  addressInput.type = "text";
  addressInput.className = "project-address-input";
  addressInput.placeholder = "Project Address";
  addressInput.autocomplete = "street-address";
  if (identity) addressInput.value = identity.address;
  addressLabel.append(addressInput);

  const colorGroup = document.createElement("fieldset");
  colorGroup.className = "project-sheet-colors";
  const colorRail = document.createElement("div");
  colorRail.className = "project-color-rail";
  let selectedColor = identity?.color && projectColorOptions.includes(identity.color) ? identity.color : projectColorOptions[0];
  projectColorOptions.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-color-swatch";
    button.style.setProperty("--project-swatch", color);
    button.setAttribute("aria-label", `Project color ${index + 1}`);
    button.setAttribute("aria-pressed", String(color === selectedColor || (!identity && index === 0)));
    button.addEventListener("click", () => {
      selectedColor = color;
      colorRail.querySelectorAll(".project-color-swatch").forEach((swatch) => {
        swatch.setAttribute("aria-pressed", String(swatch === button));
      });
    });
    colorRail.append(button);
  });
  colorGroup.append(colorRail);

  const descriptionLabel = document.createElement("label");
  descriptionLabel.className = "project-sheet-field";
  const descriptionInput = document.createElement("textarea");
  descriptionInput.className = "project-description-input";
  descriptionInput.placeholder = "Description";
  descriptionInput.autocomplete = "off";
  descriptionInput.rows = 3;
  if (identity) descriptionInput.value = identity.description;
  descriptionLabel.append(descriptionInput);

  nameInput.addEventListener("input", () => {
    saveButton.disabled = !nameInput.value.trim();
  });
  cancelButton.addEventListener("click", () => overlay.remove());
  sheet.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!nameInput.value.trim()) return;
    saveButton.disabled = true;
    try {
      const details = {
        name: nameInput.value,
        address: addressInput.value,
        color: selectedColor,
        description: descriptionInput.value
      };
      if (isEditing) {
        await updateProjectFolder(project, details);
      } else {
        await createProjectFolder(details);
      }
      overlay.remove();
      await renderWorkspace();
    } catch (error) {
      saveButton.disabled = false;
      const content = panel.querySelector(".projects-content, .saved-project-pages");
      if (content) appendMutedRow(content, "Project not synced", error.message || "Could not save the project folder.");
    }
  });

  sheet.append(header, nameLabel, addressLabel, descriptionLabel, colorGroup);
  overlay.append(sheet);
  panel.append(overlay);
  nameInput.focus();
}

function appendProjectEmptyCard(content, title, message) {
  const card = document.createElement("article");
  card.className = "project-card project-empty-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = message;
  card.append(heading, body);
  content.append(card);
}

function renderProjectRows(content, projects, projectSections, options = {}) {
  const mode = options.mode || "projects";
  const selectionController = options.selectionController || null;
  projects.slice(0, 24).forEach((project) => {
    const count = projectSections.filter((item) =>
      item.folderClientID === project.clientID ||
      item.folderClientID === project.id ||
      item.localFolderID === project.localFolderID
    ).length;
    const card = document.createElement("article");
    card.className = "project-card project-row";
    const isOpenProject = openProjectDetails().some((detail) => projectDetailMatches(project, detail));
    const isDetachedProject = projectHasDetachedWorkboard(project);
    if (isOpenProject) {
      card.classList.add("is-open");
      card.setAttribute("aria-current", "true");
    }
    if (isDetachedProject) card.classList.add("is-detached");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      `${isDetachedProject ? "Focus detached" : "Open"} ${project.name || project.title || "project"}`
    );
    card.style.setProperty("--project-color", projectColor(project));
    const actionGroup = document.createElement("div");
    actionGroup.className = "project-card-actions";
    const countBadge = document.createElement("span");
    countBadge.className = "project-count-badge";
    countBadge.textContent = String(count);
    countBadge.setAttribute("aria-label", count === 1 ? "1 saved" : `${count} saved`);
    const primaryActionButton = document.createElement("button");
    primaryActionButton.className = `project-card-action ${mode === "archive" ? "is-restore" : "is-edit"}`;
    primaryActionButton.type = "button";
    primaryActionButton.title = mode === "archive" ? "Restore project" : "Edit project";
    primaryActionButton.setAttribute("aria-label", `${primaryActionButton.title}: ${project.name || project.title || "project"}`);
    primaryActionButton.innerHTML = mode === "archive" ? archiveRestoreIconSVG() : pencilIconSVG();
    primaryActionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (mode === "archive") {
        restoreArchivedProject(project);
      } else {
        showProjectCreateSheet(content.closest(".workspace-panel"), project);
      }
    });
    primaryActionButton.addEventListener("keydown", (event) => event.stopPropagation());

    const lifecycleButton = document.createElement("button");
    lifecycleButton.className = `project-card-action ${mode === "archive" ? "is-delete" : "is-archive"}`;
    lifecycleButton.type = "button";
    lifecycleButton.title = mode === "archive" ? "Delete project" : "Archive project";
    lifecycleButton.setAttribute("aria-label", `${lifecycleButton.title}: ${project.name || project.title || "project"}`);
    lifecycleButton.innerHTML = mode === "archive" ? trashIconSVG() : archiveIconSVG();
    lifecycleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (mode === "archive") {
        deleteArchivedProject(project);
      } else {
        archiveProject(project);
      }
    });
    lifecycleButton.addEventListener("keydown", (event) => event.stopPropagation());
    actionGroup.append(countBadge, primaryActionButton, lifecycleButton);
    const body = document.createElement("div");
    body.className = "project-card-body";
    const heading = document.createElement("h3");
    heading.textContent = project.name || project.title || "Project";
    body.append(heading);
    if (isDetachedProject) {
      const detachedLabel = document.createElement("span");
      detachedLabel.className = "project-detached-label";
      detachedLabel.textContent = "Detached";
      body.append(detachedLabel);
    }
    const addressText = String(project.address || "").trim();
    if (addressText) {
      const address = document.createElement("p");
      address.textContent = addressText;
      body.append(address);
    }
    const descriptionText = String(project.description || "").trim();
    if (descriptionText) {
      const description = document.createElement("p");
      description.textContent = descriptionText;
      body.append(description);
    }
    card.append(actionGroup, body);
    selectionController?.register(card, project);
    card.addEventListener("click", (event) => {
      if (selectionController?.isActive()) selectionController.toggle(project, event);
      else openProjectDetail(project, { sourcePaneID: mode === "archive" ? "utility:archive" : "utility:projects" });
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (selectionController?.isActive()) selectionController.toggle(project, event);
      else openProjectDetail(project, { sourcePaneID: mode === "archive" ? "utility:archive" : "utility:projects" });
    });
    content.append(card);
  });
}

function savedItemTags(item) {
  const annotation = annotationForTarget(item.sectionID, item.blockID || "");
  return normalizeAnnotationTags([...(Array.isArray(item.tags) ? item.tags : []), ...(annotation.tags || [])]);
}

function savedItemTitle(item) {
  const sectionNumber = String(item.sectionNumber || item.sectionID || "").trim();
  return sectionTitleWithoutNumber({ sectionNumber, title: item.title || "Section" }) || "Section";
}

function compareSavedCodeOrder(left, right) {
  const prefixOrder = new Map(searchCodeFilterOptions().map((option, index) => [option.prefix, index]));
  const leftPrefix = left.codePrefix || left.code || "BC";
  const rightPrefix = right.codePrefix || right.code || "BC";
  const codeOrder = (prefixOrder.get(leftPrefix) ?? 999) - (prefixOrder.get(rightPrefix) ?? 999);
  if (codeOrder) return codeOrder;
  const chapterOrder = String(left.chapterNumber || left.chapterID || "").localeCompare(
    String(right.chapterNumber || right.chapterID || ""),
    undefined,
    { numeric: true, sensitivity: "base" }
  );
  if (chapterOrder) return chapterOrder;
  return String(left.sectionNumber || left.sectionID || "").localeCompare(
    String(right.sectionNumber || right.sectionID || ""),
    undefined,
    { numeric: true, sensitivity: "base" }
  );
}

function sortSavedItems(items, mode) {
  return [...items].sort((left, right) => {
    if (mode === "recentlySaved") {
      const recentOrder = Date.parse(right.bookmarkedAt || right.createdAt || right.updatedAt || 0) - Date.parse(left.bookmarkedAt || left.createdAt || left.updatedAt || 0);
      if (Number.isFinite(recentOrder) && recentOrder) return recentOrder;
    } else if (mode === "codeBook") {
      const codeOrder = codeDisplayLabel(left.codePrefix || left.code || "BC").localeCompare(
        codeDisplayLabel(right.codePrefix || right.code || "BC"),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (codeOrder) return codeOrder;
    } else if (mode === "title") {
      const titleOrder = savedItemTitle(left).localeCompare(savedItemTitle(right), undefined, { numeric: true, sensitivity: "base" });
      if (titleOrder) return titleOrder;
    } else if (mode === "tag") {
      const leftTag = savedItemTags(left)[0] || "";
      const rightTag = savedItemTags(right)[0] || "";
      if (leftTag !== rightTag) {
        if (!leftTag) return 1;
        if (!rightTag) return -1;
        return leftTag.localeCompare(rightTag, undefined, { numeric: true, sensitivity: "base" });
      }
    }
    return compareSavedCodeOrder(left, right);
  });
}

function closeSavedActionMenus(panel) {
  panel.querySelectorAll(".saved-action-menu").forEach((menu) => menu.remove());
  panel.querySelectorAll(".saved-sort-button, .saved-export-button").forEach((button) => button.setAttribute("aria-expanded", "false"));
}

function openSavedActionMenu(panel, anchor, items) {
  const wasExpanded = anchor.getAttribute("aria-expanded") === "true";
  closeSavedActionMenus(panel);
  if (wasExpanded) return;
  const menu = document.createElement("div");
  menu.className = "saved-action-menu";
  menu.setAttribute("role", "menu");
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = item.label;
    if (item.selected) button.classList.add("is-selected");
    button.addEventListener("click", () => {
      closeSavedActionMenus(panel);
      item.action();
    });
    menu.append(button);
  });
  anchor.closest(".panel-actions")?.append(menu);
  anchor.setAttribute("aria-expanded", "true");
  menu.querySelector("button")?.focus({ preventScroll: true });
}

function printSavedItemsAsPDF(items, scopeLabel) {
  if (!isProAccount()) {
    void presentPlanLimitNotice("PDF export requires Pro", "Upgrade to Pro to export saved code, notes, and tags as a PDF.");
    return;
  }
  const frame = document.createElement("iframe");
  frame.className = "saved-print-frame";
  frame.title = "Saved sections PDF export";
  frame.srcdoc = "<!doctype html><html><head><title>permitext Saved</title></head><body></body></html>";
  frame.addEventListener("load", () => {
    const documentRoot = frame.contentDocument;
    if (!documentRoot) return;
    const style = documentRoot.createElement("style");
    style.textContent = "body{margin:40px;color:#111;font:14px/1.45 -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif}h1{font-size:26px;margin:0 0 4px}h2{margin:28px 0 8px;padding-bottom:6px;border-bottom:1px solid #ccc;font-size:15px;text-transform:uppercase}article{padding:12px 0;border-bottom:1px solid #ddd;break-inside:avoid}strong,span{display:block}.meta{color:#8a4a10;font-weight:700}.preview{margin-top:4px;color:#555}.note{margin-top:6px;color:#8a4a10}.tags{margin-top:6px;font-size:12px;color:#666}@page{margin:0.6in}";
    documentRoot.head.append(style);
    const heading = documentRoot.createElement("h1");
    heading.textContent = "permitext Saved";
    const scope = documentRoot.createElement("p");
    scope.textContent = `${scopeLabel} · ${items.length} ${items.length === 1 ? "item" : "items"}`;
    documentRoot.body.append(heading, scope);
    let currentCode = "";
    items.forEach((item) => {
      const code = codeDisplayLabel(item.codePrefix || item.code || "BC");
      if (code !== currentCode) {
        currentCode = code;
        const codeHeading = documentRoot.createElement("h2");
        codeHeading.textContent = code;
        documentRoot.body.append(codeHeading);
      }
      const row = documentRoot.createElement("article");
      const meta = documentRoot.createElement("span");
      meta.className = "meta";
      meta.textContent = [item.chapterNumber ? `Chapter ${item.chapterNumber}` : "", item.sectionNumber || ""].filter(Boolean).join(" · ");
      const title = documentRoot.createElement("strong");
      title.textContent = savedItemTitle(item);
      row.append(meta, title);
      if (item.previewText) {
        const preview = documentRoot.createElement("span");
        preview.className = "preview";
        preview.textContent = item.previewText;
        row.append(preview);
      }
      const noteText = String(item.noteBody || annotationForTarget(item.sectionID, item.blockID || "").noteBody || "").trim();
      if (noteText) {
        const note = documentRoot.createElement("span");
        note.className = "note";
        note.textContent = noteText;
        row.append(note);
      }
      const tags = savedItemTags(item);
      if (tags.length) {
        const tagLine = documentRoot.createElement("span");
        tagLine.className = "tags";
        tagLine.textContent = tags.map((tag) => `#${tag}`).join("  ");
        row.append(tagLine);
      }
      documentRoot.body.append(row);
    });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, { once: true });
  document.body.append(frame);
}

function renderSavedFilters(panel, instance, allItems, onChange) {
  const wrapper = panel.querySelector(".saved-inline-filters");
  const codeRail = panel.querySelector(".saved-code-filter");
  const tagRail = panel.querySelector(".saved-tag-filter");
  const tagCounts = new Map();
  allItems.forEach((item) => {
    new Set(savedItemTags(item)).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });
  const availableTags = [...tagCounts.entries()]
    .sort(([leftTag, leftCount], [rightTag, rightCount]) =>
      rightCount - leftCount || leftTag.localeCompare(rightTag, undefined, { sensitivity: "base" }))
    .map(([tag]) => tag);
  clear(codeRail);
  clear(tagRail);
  searchCodeFilterOptions().forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-filter-chip saved-filter-chip";
    button.textContent = option.label;
    button.dataset.prefix = option.prefix;
    if (option.prefix !== "ALL") button.classList.add(`code-theme-${codeTheme(option.prefix)}`);
    const selected = option.prefix === "ALL" ? instance.codeFilters.length === 0 : instance.codeFilters.includes(option.prefix);
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      savedFilterScrollPositions.set(instance.id, {
        code: codeRail.scrollLeft,
        tag: tagRail.scrollLeft
      });
      if (option.prefix === "ALL") instance.codeFilters = [];
      else {
        const selectedPrefixes = new Set(instance.codeFilters);
        if (selectedPrefixes.has(option.prefix)) selectedPrefixes.delete(option.prefix);
        else selectedPrefixes.add(option.prefix);
        instance.codeFilters = [...selectedPrefixes];
      }
      saveWorkspaceState();
      onChange();
    });
    codeRail.append(button);
  });
  if (availableTags.length) {
    ["", ...availableTags].forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "saved-tag-filter-chip";
      button.textContent = tag || "All Tags";
      button.setAttribute("aria-pressed", String(instance.tagFilter === tag));
      button.addEventListener("click", () => {
        savedFilterScrollPositions.set(instance.id, {
          code: codeRail.scrollLeft,
          tag: tagRail.scrollLeft
        });
        instance.tagFilter = instance.tagFilter === tag && tag ? "" : tag;
        saveWorkspaceState();
        onChange();
      });
      tagRail.append(button);
    });
  }
  tagRail.hidden = availableTags.length === 0;
  wrapper.hidden = allItems.length === 0;
  bindHorizontalWheelScroll(codeRail);
  bindHorizontalWheelScroll(tagRail);
}

async function renderSaved(instance) {
  const savedInstance = normalizeSavedInstance(instance);
  const paneID = paneIDForUtilityInstance(savedInstance);
  const panel = renderTemplate(savedTemplate);
  panel.classList.add("saved-panel");
  applyPaneWeight(panel, paneID);
  const content = panel.querySelector(".saved-content");
  const sortButton = panel.querySelector(".saved-sort-button");
  const exportButton = panel.querySelector(".saved-export-button");
  const refreshSavedPanel = () => transitionWorkspace("utility", { refreshPaneIDs: [paneID] });
  const sortOptions = [
    ["codeOrder", "Code Order"],
    ["recentlySaved", "Recent"],
    ["codeBook", "Code Book"],
    ["title", "Title"],
    ["tag", "Tag"]
  ];
  sortButton.addEventListener("click", () => openSavedActionMenu(panel, sortButton, sortOptions.map(([value, label]) => ({
    label,
    selected: savedInstance.sortMode === value,
    action: () => {
      savedInstance.sortMode = value;
      saveWorkspaceState();
      refreshSavedPanel();
    }
  }))));
  clear(content);
  const data = await loadSyncedContent();
  const summary = currentContentSummary();
  renderSavedProjects(panel, paneID, summary.projects || [], summary.projectSections || []);

  if (data.status === "disconnected" && summary.savedItems.length === 0 && summary.annotations.length === 0) {
    appendEmptySaved(content, "Sign in to sync", "Open Settings and sign in to show synced bookmarks, tags, and notes.");
    exportButton.disabled = true;
    return panel;
  }
  if (data.status === "error" && summary.savedItems.length === 0 && summary.annotations.length === 0) {
    appendEmptySaved(content, "Sync error", data.error || "Could not load saved content.");
    exportButton.disabled = true;
    return panel;
  }

  const { savedItems, annotations } = summary;
  const annotatedItems = consolidatedSavedAnnotations(annotations || []);
  const visibleSavedItems = savedItems.slice(0, 48);
  const combinedItems = mergeSavedColumnItems(visibleSavedItems, annotatedItems.slice(0, 48));
  const resolvedItems = await hydrateSavedColumnItems(combinedItems);
  renderSavedFilters(panel, savedInstance, resolvedItems, refreshSavedPanel);
  const savedFilterScroll = savedFilterScrollPositions.get(savedInstance.id);
  if (savedFilterScroll) {
    const codeRail = panel.querySelector(".saved-code-filter");
    const tagRail = panel.querySelector(".saved-tag-filter");
    const restoreFilterScroll = () => {
      codeRail.scrollLeft = Math.min(savedFilterScroll.code, Math.max(0, codeRail.scrollWidth - codeRail.clientWidth));
      tagRail.scrollLeft = Math.min(savedFilterScroll.tag, Math.max(0, tagRail.scrollWidth - tagRail.clientWidth));
    };
    restoreFilterScroll();
    requestAnimationFrame(restoreFilterScroll);
    savedFilterScrollPositions.delete(savedInstance.id);
  }
  const filteredItems = resolvedItems.filter((item) => {
    const prefixMatches = savedInstance.codeFilters.length === 0 || savedInstance.codeFilters.includes(item.codePrefix || item.code || "BC");
    const tagMatches = !savedInstance.tagFilter || savedItemTags(item).some((tag) => tag.localeCompare(savedInstance.tagFilter, undefined, { sensitivity: "accent" }) === 0);
    return prefixMatches && tagMatches;
  });
  const orderedItems = sortSavedItems(filteredItems, savedInstance.sortMode);

  exportButton.disabled = resolvedItems.length === 0;
  exportButton.addEventListener("click", () => {
    const options = [];
    if (filteredItems.length > 0 && filteredItems.length < resolvedItems.length) {
      options.push({ label: `Export current filter (${filteredItems.length})`, action: () => printSavedItemsAsPDF(orderedItems, "Current filter") });
    }
    options.push({ label: `Export all saved (${resolvedItems.length})`, action: () => printSavedItemsAsPDF(sortSavedItems(resolvedItems, savedInstance.sortMode), "All saved sections") });
    openSavedActionMenu(panel, exportButton, options);
  });

  if (orderedItems.length > 0) {
    renderSavedItemsByCode(content, orderedItems, paneID, { showChapterHeaders: true, preserveOrder: true });
  } else if (resolvedItems.length > 0) {
    appendEmptySaved(content, "No saved items match", "Try another code book or tag filter.");
  } else {
    appendMutedRow(content, "No saved sections", "Bookmarks, paragraph notes, and tags will appear here.");
  }

  return panel;
}

function renderSavedProjects(panel, paneID, projects, projectSections) {
  const pages = panel.querySelector(".saved-project-pages");
  const dots = panel.querySelector(".saved-project-page-dots");
  const addButton = panel.querySelector(".saved-projects-add-button");
  const archiveButton = panel.querySelector(".saved-projects-archive-button");
  const visibleProjects = activeProjectRecords(projects);
  clear(pages);
  clear(dots);
  addButton.addEventListener("click", () => showProjectCreateSheet(panel));
  archiveButton.setAttribute("aria-pressed", String(state.utilities.archive));
  archiveButton.addEventListener("click", toggleArchiveAfterProjectsStack);

  if (!visibleProjects.length) {
    const empty = document.createElement("p");
    empty.className = "saved-projects-empty";
    empty.textContent = "No projects yet. Use + to create one.";
    pages.append(empty);
    return;
  }

  const projectPages = [];
  for (let index = 0; index < visibleProjects.length; index += 4) {
    projectPages.push(visibleProjects.slice(index, index + 4));
  }
  projectPages.forEach((pageProjects, pageIndex) => {
    const page = document.createElement("div");
    page.className = "saved-project-page";
    page.setAttribute("aria-label", `Projects page ${pageIndex + 1} of ${projectPages.length}`);
    pageProjects.forEach((project) => {
      const tile = document.createElement("article");
      tile.className = "saved-project-tile";
      const tileColor = projectColor(project);
      tile.style.setProperty("--project-color", tileColor);
      tile.style.setProperty("--project-on-color", projectForegroundColor(tileColor));
      tile.tabIndex = 0;
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-label", `Open ${project.name || project.title || "project"}`);
      const heading = document.createElement("strong");
      heading.textContent = project.name || project.title || "Project";
      const count = projectSections.filter((item) => projectSectionBelongsToProject(item, project)).length;
      const countLabel = document.createElement("span");
      countLabel.textContent = count === 1 ? "1 saved" : `${count} saved`;
      const folderIcon = document.createElement("span");
      folderIcon.className = "saved-project-folder-icon";
      folderIcon.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>`;
      const actions = document.createElement("div");
      actions.className = "saved-project-tile-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.title = "Edit project";
      editButton.setAttribute("aria-label", `Edit ${heading.textContent}`);
      editButton.innerHTML = pencilIconSVG();
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        showProjectCreateSheet(panel, project);
      });
      const archiveProjectButton = document.createElement("button");
      archiveProjectButton.type = "button";
      archiveProjectButton.title = "Archive project";
      archiveProjectButton.setAttribute("aria-label", `Archive ${heading.textContent}`);
      archiveProjectButton.innerHTML = archiveIconSVG();
      archiveProjectButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void archiveProject(project);
      });
      actions.append(editButton, archiveProjectButton);
      tile.append(heading, countLabel, folderIcon, actions);
      const open = () => openProjectDetail(project, { sourcePaneID: paneID });
      tile.addEventListener("click", open);
      tile.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      });
      page.append(tile);
    });
    pages.append(page);
    if (projectPages.length > 1) {
      const dot = document.createElement("span");
      dot.className = "saved-project-page-dot";
      if (pageIndex === 0) dot.classList.add("is-active");
      dots.append(dot);
    }
  });
  if (projectPages.length > 1) {
    pages.addEventListener("scroll", () => {
      const pageIndex = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
      dots.querySelectorAll(".saved-project-page-dot").forEach((dot, index) => {
        dot.classList.toggle("is-active", index === pageIndex);
      });
    }, { passive: true });
  }
}

function consolidatedSavedAnnotations(annotations = []) {
  const latestByTarget = new Map();
  annotations.forEach((annotation) => {
    if (!annotation || annotation.deletedAt || !annotation.sectionID) return;
    const blockID = normalizeAnnotationBlockID(annotation.blockID || annotation.anchorID || annotation.contentBlockID);
    const key = [syncCodeVersion(annotation.codeVersion), annotation.sectionID, blockID].map(String).join(":");
    const existing = latestByTarget.get(key);
    if (!existing || Date.parse(annotation.updatedAt || 0) >= Date.parse(existing.updatedAt || 0)) {
      latestByTarget.set(key, { ...annotation, blockID });
    }
  });
  return Array.from(latestByTarget.values()).flatMap((annotation) => {
    const merged = annotationForTarget(annotation.sectionID, annotation.blockID);
    if (!String(merged.noteBody || "").trim() && merged.tags.length === 0) return [];
    return [{ ...annotation, ...merged, savedColumnKind: "annotation" }];
  });
}

function mergeSavedColumnItems(savedItems = [], annotatedItems = []) {
  const sectionAnnotations = new Map(
    annotatedItems
      .filter((item) => !normalizeAnnotationBlockID(item.blockID))
      .map((item) => [String(item.sectionID || ""), item])
  );
  const bookmarkedSectionIDs = new Set(savedItems.map((item) => String(item.sectionID || "")));
  const bookmarks = savedItems.map((item) => {
    const annotation = sectionAnnotations.get(String(item.sectionID || ""));
    return {
      ...item,
      ...(annotation ? { noteBody: annotation.noteBody, tags: annotation.tags } : {}),
      savedColumnKind: "bookmark"
    };
  });
  const annotations = annotatedItems.filter((item) =>
    normalizeAnnotationBlockID(item.blockID) || !bookmarkedSectionIDs.has(String(item.sectionID || ""))
  );
  return [...bookmarks, ...annotations];
}

async function hydrateSavedColumnItems(items = []) {
  const sectionPromises = new Map();
  const resolveItemSection = (item) => {
    const sectionID = String(item.sectionID || item.savedSectionID || item.itemID || "");
    const key = [syncCodeVersion(item.codeVersion), sectionID].join(":");
    if (!sectionPromises.has(key)) {
      const detail = {
        codePrefix: item.codePrefix || "BC",
        chapterID: item.chapterID || "",
        chapterNumber: item.chapterNumber || "",
        sectionID,
        sectionNumber: item.sectionNumber || "",
        title: item.title || "Section"
      };
      sectionPromises.set(key, resolveSectionDetail(detail).then(({ chapter, section }) => ({ chapter, section, detail })));
    }
    return sectionPromises.get(key);
  };

  return Promise.all(items.map(async (item) => {
    try {
      const { chapter, section, detail } = await resolveItemSection(item);
      const blockID = normalizeAnnotationBlockID(item.blockID || item.anchorID || item.contentBlockID);
      const annotatedBlocks = section ? annotatedBlocksForSection(section) : [];
      const block = blockID
        ? annotatedBlocks.find((candidate) =>
            normalizeAnnotationBlockID(candidate?.id || candidate?.tableID || candidate?.imageID) === blockID
          )
        : null;
      const rawPreview = block?.plainText || block?.text || sectionPlainText(section) || item.previewText || "";
      const codePrefix = detail.codePrefix || chapter?.codePrefix || item.codePrefix || "BC";
      const chapterID = detail.chapterID || chapter?.id || item.chapterID || "";
      const chapterNumber = detail.chapterNumber || chapter?.chapterNumber || item.chapterNumber || "";
      return {
        ...item,
        blockID,
        codePrefix,
        chapterID,
        chapterNumber,
        chapterTitle: chapter?.fullTitle || chapter?.displayTitle || chapter?.title || item.chapterTitle || "",
        sectionNumber: section?.sectionNumber || detail.sectionNumber || item.sectionNumber || "",
        title: section?.title || detail.title || item.title || "Section",
        previewText: String(rawPreview).replace(/\s+/g, " ").trim().slice(0, 240)
      };
    } catch {
      return { ...item, previewText: String(item.previewText || "").replace(/\s+/g, " ").trim().slice(0, 240) };
    }
  }));
}

async function refreshOpenSavedPanes() {
  const paneIDs = (state.utilityInstances || [])
    .filter((instance) => instance.key === "saved")
    .map((instance) => paneIDForUtilityInstance(instance));
  if (!paneIDs.length) return;
  await transitionWorkspace("utility", { refreshPaneIDs: paneIDs });
}

function removeIconSVG() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M19 6l-1 14H6L5 6"></path>
      <path d="M10 11v5"></path>
      <path d="M14 11v5"></path>
    </svg>
  `;
}

function savedItemSelectionID(item) {
  return String(item?.id || `${item?.sectionID || "section"}:${item?.blockID || ""}`);
}

function createSavedBulkSelectionController(panel, savedItems) {
  const records = savedItems.filter((item) => item?.sectionID);
  const recordByID = new Map(records.map((item) => [savedItemSelectionID(item), item]));
  const orderedIDs = [...recordByID.keys()];
  const selectedIDs = new Set();
  const rows = new Map();
  let active = false;
  let busy = false;

  const selectButton = document.createElement("button");
  selectButton.className = "icon-button saved-select-button";
  selectButton.type = "button";
  selectButton.title = "Select saved items";
  selectButton.setAttribute("aria-label", selectButton.title);
  selectButton.setAttribute("aria-pressed", "false");
  selectButton.innerHTML = selectionModeIconSVG();
  panel.querySelector(".panel-actions")?.prepend(selectButton);

  const bulkBar = document.createElement("section");
  bulkBar.className = "project-bulk-bar saved-bulk-bar";
  bulkBar.hidden = true;
  const countLabel = document.createElement("span");
  countLabel.className = "project-bulk-count";
  const selectAllButton = document.createElement("button");
  selectAllButton.className = "project-bulk-link";
  selectAllButton.type = "button";
  const removeButton = document.createElement("button");
  removeButton.className = "project-bulk-action is-delete";
  removeButton.type = "button";
  const cancelButton = document.createElement("button");
  cancelButton.className = "project-bulk-link";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  bulkBar.append(countLabel, selectAllButton, removeButton, cancelButton);
  panel.append(bulkBar);

  const update = () => {
    panel.classList.toggle("is-saved-selecting", active);
    selectButton.setAttribute("aria-pressed", String(active));
    bulkBar.hidden = !active;
    const selectedCount = selectedIDs.size;
    countLabel.textContent = `${selectedCount} selected`;
    selectAllButton.textContent = selectedCount === orderedIDs.length ? "Clear all" : "Select all";
    removeButton.textContent = `Remove ${selectedCount}`;
    removeButton.disabled = selectedCount === 0 || busy;
    selectAllButton.disabled = busy;
    cancelButton.disabled = busy;
    selectButton.disabled = busy;
    rows.forEach((row, id) => {
      const selected = selectedIDs.has(id);
      row.classList.toggle("is-selected", selected);
      row.setAttribute("aria-selected", String(active && selected));
    });
  };

  const setActive = (nextActive) => {
    active = nextActive;
    selectedIDs.clear();
    update();
  };
  const controller = {
    isActive: () => active,
    register(row, item) {
      const id = savedItemSelectionID(item);
      rows.set(id, row);
      const indicator = document.createElement("span");
      indicator.className = "saved-selection-check";
      indicator.setAttribute("aria-hidden", "true");
      indicator.innerHTML = selectionIndicatorIconSVG();
      row.prepend(indicator);
      update();
    },
    toggle(item) {
      if (!active || busy) return;
      const id = savedItemSelectionID(item);
      if (selectedIDs.has(id)) selectedIDs.delete(id);
      else selectedIDs.add(id);
      update();
    }
  };

  selectButton.addEventListener("click", () => setActive(!active));
  selectAllButton.addEventListener("click", () => {
    if (selectedIDs.size === orderedIDs.length) selectedIDs.clear();
    else orderedIDs.forEach((id) => selectedIDs.add(id));
    update();
  });
  cancelButton.addEventListener("click", () => setActive(false));
  removeButton.addEventListener("click", async () => {
    const selectedItems = orderedIDs.filter((id) => selectedIDs.has(id)).map((id) => recordByID.get(id));
    const count = selectedItems.length;
    if (!count) return;
    const confirmed = await confirmWebWarning(
      "Remove saved items",
      `This will remove the save from ${count} ${count === 1 ? "item" : "items"}. Are you sure?`,
      { confirmLabel: "Remove" }
    );
    if (!confirmed) return;
    busy = true;
    update();
    let removedCount = 0;
    try {
      for (const item of selectedItems) {
        await persistSectionBookmark(item, false, { refreshSavedPanes: false });
        removedCount += 1;
      }
      await showWebNotice(
        "Saved items removed",
        `${removedCount} saved ${removedCount === 1 ? "item was" : "items were"} removed.`
      );
      await renderWorkspace();
    } catch (error) {
      await showWebNotice(
        "Could not remove saved items",
        `${error.message || "The selected saved items could not be removed."} Removed ${removedCount} of ${count}.`
      );
      busy = false;
      update();
    }
  });
  update();
  return controller;
}

function renderSavedItemsByCode(content, savedItems, paneID = "utility:saved", options = {}) {
  const codeGroups = new Map();
  savedItems.forEach((item) => {
    const prefix = item.codePrefix || item.code || "BC";
    if (!codeGroups.has(prefix)) codeGroups.set(prefix, []);
    codeGroups.get(prefix).push(item);
  });

  Array.from(codeGroups.entries()).forEach(([prefix, items]) => {
    const codeGroup = document.createElement("section");
    codeGroup.className = "saved-code-group";
    codeGroup.classList.add(`code-theme-${codeTheme(prefix)}`);
    const codeLabel = document.createElement("p");
    codeLabel.className = "section-label saved-code-label";
    codeLabel.textContent = codeDisplayLabel(prefix);
    codeGroup.append(codeLabel);

    const orderedItems = options.preserveOrder ? [...items] : [...items].sort((left, right) => {
      const chapterOrder = String(left.chapterNumber || left.chapterID || "").localeCompare(
        String(right.chapterNumber || right.chapterID || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (chapterOrder) return chapterOrder;
      const sectionOrder = String(left.sectionNumber || left.sectionID || "").localeCompare(
        String(right.sectionNumber || right.sectionID || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (sectionOrder) return sectionOrder;
      const leftIsParagraph = Boolean(normalizeAnnotationBlockID(left.blockID));
      const rightIsParagraph = Boolean(normalizeAnnotationBlockID(right.blockID));
      if (leftIsParagraph !== rightIsParagraph) return leftIsParagraph ? 1 : -1;
      return String(left.blockID || left.id || "").localeCompare(String(right.blockID || right.id || ""));
    });
    const renderEntries = [];
    if (options.showChapterHeaders) {
      const chapterGroups = new Map();
      orderedItems.forEach((item) => {
        const chapterKey = String(item.chapterNumber || item.chapterID || "");
        if (!chapterGroups.has(chapterKey)) chapterGroups.set(chapterKey, []);
        chapterGroups.get(chapterKey).push(item);
      });
      chapterGroups.forEach((chapterItems, chapterKey) => {
        renderEntries.push({ kind: "chapter", chapterKey, item: chapterItems[0] });
        chapterItems.forEach((item) => renderEntries.push({ kind: "item", item }));
      });
    } else {
      orderedItems.forEach((item) => renderEntries.push({ kind: "item", item }));
    }
    renderEntries.forEach((entry) => {
      if (entry.kind === "chapter") {
        const chapterHeader = document.createElement("div");
        chapterHeader.className = "saved-chapter-header";
        const chapterNumber = document.createElement("strong");
        chapterNumber.textContent = entry.chapterKey ? `Chapter ${entry.chapterKey}` : "Chapter";
        const chapterTitle = document.createElement("span");
        const normalizedChapterTitle = String(entry.item.chapterTitle || "")
          .replace(/^\s*chapter\s+\S+\s*[:—-]?\s*/i, "")
          .trim();
        chapterTitle.textContent = normalizedChapterTitle;
        chapterHeader.append(chapterNumber);
        if (normalizedChapterTitle) chapterHeader.append(chapterTitle);
        codeGroup.append(chapterHeader);
        return;
      }
      const item = entry.item;
      const row = document.createElement("article");
      row.className = "saved-row saved-section-row";
      const removableSavedItem = typeof options.removableSavedItems === "function"
          ? options.removableSavedItems(item)
          : Boolean(options.removableSavedItems);
        const selectableSavedItem = removableSavedItem && Boolean(options.selectionController);
        if (removableSavedItem) {
          row.classList.add("has-remove-action");
        }
        const openButton = document.createElement("button");
        openButton.className = "saved-row-button saved-section-open";
        openButton.type = "button";
        const sectionNumber = String(item.sectionNumber || item.sectionID || "").trim();
        const titleText = sectionTitleWithoutNumber({ sectionNumber, title: item.title || "Section" }) || "Section";
        const heading = document.createElement("span");
        heading.className = "saved-section-heading";
        const meta = document.createElement("span");
        meta.className = "saved-section-meta";
        meta.textContent = normalizeAnnotationBlockID(item.blockID)
          ? ["Paragraph", sectionNumber].filter(Boolean).join(" · ")
          : item.kind === "textBlock"
            ? ["Text Block", sectionNumber].filter(Boolean).join(" · ")
          : sectionNumber;
        const status = document.createElement("span");
        status.className = "saved-section-status";
        const annotation = annotationForTarget(item.sectionID, item.blockID || "");
        const notePreview = String(item.noteBody || annotation.noteBody || "").trim();
        if (notePreview) {
          const noteIcon = document.createElement("span");
          noteIcon.setAttribute("aria-label", "Has note");
          noteIcon.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"></path><path d="M8 9h8M8 13h6"></path></svg>`;
          status.append(noteIcon);
        }
        if (item.savedColumnKind === "bookmark") {
          const bookmarkIcon = document.createElement("span");
          bookmarkIcon.setAttribute("aria-label", "Bookmarked");
          bookmarkIcon.innerHTML = bookmarkIconSVG(true);
          status.append(bookmarkIcon);
        }
        const title = document.createElement("strong");
        title.className = "saved-section-title";
        title.textContent = titleText;
        const metaLine = document.createElement("span");
        metaLine.className = "saved-section-meta-line";
        metaLine.append(meta, status);
        heading.append(metaLine, title);
        openButton.append(heading);
        if (item.previewText) {
          const preview = document.createElement("span");
          preview.className = "saved-paragraph-preview";
          preview.textContent = item.previewText;
          markResearchSelectable(preview, {
            ...item,
            researchSavedItemID: item.savedColumnKind === "bookmark" ? item.id : ""
          });
          openButton.append(preview);
        }
        if (notePreview) {
          const note = document.createElement("span");
          note.className = "saved-note-preview";
          note.textContent = notePreview;
          openButton.append(note);
        }
        const itemTags = savedItemTags(item);
        if (itemTags.length) {
          const tags = document.createElement("span");
          tags.className = "saved-row-tags";
          itemTags.forEach((tag) => {
            const chip = document.createElement("span");
            chip.className = "saved-row-tag";
            chip.textContent = tag;
            tags.append(chip);
          });
          openButton.append(tags);
        }
        openButton.addEventListener("click", () => {
          if (window.getSelection && String(window.getSelection()).trim()) return;
          if (options.selectionController?.isActive()) {
            if (selectableSavedItem) options.selectionController.toggle(item);
          } else {
            openSectionDetailForExistingSearch(item, { anchorPaneID: paneID });
          }
        });
        row.append(openButton);
        if (selectableSavedItem) options.selectionController.register(row, item);
        if (removableSavedItem) {
          const removeButton = document.createElement("button");
          removeButton.className = "saved-row-remove";
          removeButton.type = "button";
          removeButton.title = "Remove saved section";
          removeButton.setAttribute("aria-label", `Remove ${sectionDisplayTitle(item.sectionNumber || item.sectionID || "", item.title || "saved section")}`);
          removeButton.innerHTML = `${removeIconSVG()}<span class="sr-only">Remove saved section</span>`;
          removeButton.addEventListener("click", async () => {
            removeButton.disabled = true;
            removeButton.classList.remove("has-error");
            row.classList.add("is-removing");
            try {
              await persistSectionBookmark(item, false);
              await renderWorkspace();
            } catch (error) {
              removeButton.title = error.message || "Could not remove saved section";
              removeButton.classList.add("has-error");
              row.classList.remove("is-removing");
            } finally {
              removeButton.disabled = false;
            }
          });
          row.append(removeButton);
        }
        codeGroup.append(row);
    });

    content.append(codeGroup);
  });
}

function appendSectionLabel(container, label) {
  const element = document.createElement("p");
  element.className = "section-label";
  element.textContent = label;
  container.append(element);
}

function appendMutedRow(container, title, message) {
  const row = document.createElement("article");
  row.className = "saved-row";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const body = document.createElement("span");
  body.textContent = message;
  row.append(heading, body);
  container.append(row);
}

function appendEmptySaved(container, title, message) {
  const wrapper = document.createElement("section");
  wrapper.className = "reader-empty";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  wrapper.append(heading, paragraph);
  container.append(wrapper);
}

async function openSectionDetailForExistingSearch(item, options = {}) {
  let searchInstance = (state.utilityInstances || []).find((instance) => instance.key === "search");
  if (!searchInstance) {
    searchInstance = newUtilityInstance("search");
    state.utilityInstances = [...(state.utilityInstances || []), searchInstance];
  }
  await openSectionDetail(searchInstance.id, item, options);
}

function settingsCodeSectionOptions() {
  return searchCodeFilterOptions();
}

function selectedSettingsCodePrefix() {
  const available = new Set(settingsCodeSectionOptions().map((option) => option.prefix));
  if (available.has(state.settingsCodePrefix)) return state.settingsCodePrefix;
  return state.readers?.[0]?.codePrefix || "ALL";
}

async function updateSettingsCodeSection(prefix) {
  state.settingsCodePrefix = settingsCodeSectionOptions().some((option) => option.prefix === prefix) ? prefix : "ALL";
  const primaryReader = state.readers?.[0];
  if (primaryReader && state.settingsCodePrefix !== "ALL" && primaryReader.codePrefix !== state.settingsCodePrefix) {
    primaryReader.codePrefix = state.settingsCodePrefix;
    primaryReader.chapterID = await firstChapterIDForCode(primaryReader.codePrefix);
    primaryReader.sectionID = "";
    primaryReader.sectionNumber = "";
    primaryReader.title = "Reader";
  }
  saveWorkspaceState();
  if (primaryReader?.chapterID) scheduleContinuitySync(primaryReader);
  await renderWorkspace();
}

function normalizedPublicUsername(value) {
  const trimmed = String(value || "").trim().replace(/^@/, "").toLowerCase();
  return trimmed || null;
}

function publicUsernameValidationMessage(value) {
  const username = normalizedPublicUsername(value);
  if (!username) return "";
  if (username.length < 3) return "Use at least 3 characters.";
  if (username.length > 30) return "Use 30 characters or fewer.";
  if (!/^[a-z0-9_-]+$/.test(username)) return "Use letters, numbers, hyphens, or underscores.";
  return "";
}

function bookmarkRecordsForSettings() {
  return (currentContentSummary().savedItems || [])
    .filter((item) => item?.sectionID && !item.deletedAt);
}

function enqueueSettingsBulkClear(scope) {
  const account = activeAccount();
  if (!account) return null;
  const mutation = {
    codeVersionClear: {
      userID: account.userID,
      codeVersion: defaultSyncCodeVersion,
      values: { scope },
      updatedAt: new Date().toISOString()
    }
  };
  const record = mutation.codeVersionClear;
  const key = bulkClearKey(record);
  state.localBulkClears = [
    ...(state.localBulkClears || []).filter((item) => bulkClearKey(item) !== key),
    record
  ];
  enqueueSyncMutation(mutation, account);
  return mutation;
}

async function clearSettingsBookmarks() {
  const records = bookmarkRecordsForSettings();
  const account = activeAccount();
  state.localSavedItems = [];
  state.localSavedSectionIDs = [];
  state.localProjectSections = [];
  enqueueSettingsBulkClear("bookmarks");
  saveWorkspaceState();
  if (account) void flushPendingSyncAndRender().catch(() => {});
  return records.length;
}

async function clearSettingsAnnotations(field) {
  const records = currentContentSummary().annotations || [];
  const uniqueTargets = new Map();
  records.forEach((record) => {
    const key = `${record.sectionID || ""}:${normalizeAnnotationBlockID(record.blockID)}`;
    if (!uniqueTargets.has(key)) uniqueTargets.set(key, record);
  });
  uniqueTargets.forEach((record) => {
    const localRecord = (state.localAnnotations || []).find((item) => String(item.id || "") === String(record.id || ""));
    if (!localRecord) return;
    if (field === "noteBody") localRecord.noteBody = "";
    else localRecord.tags = [];
  });
  if (field === "noteBody") state.sectionNotes = {};
  enqueueSettingsBulkClear(field === "noteBody" ? "notes" : "tags");
  saveWorkspaceState();
  if (activeAccount()) void flushPendingSyncAndRender().catch(() => {});
  return uniqueTargets.size;
}

async function performSettingsClearAction(action) {
  if (action === "searches") {
    state.recentSearches = [];
    state.recentlyViewedSections = [];
    state.recentActivityUpdatedAt = new Date().toISOString();
    const account = activeAccount();
    if (account) {
      const pendingRecord = [...(state.syncOutbox || [])].reverse()
        .filter((entry) => entry.accountUserID === account.userID)
        .map((entry) => mutationKindAndRecord(entry.mutation))
        .find(({ kind }) => kind === "continuity")?.record;
      const existing = pendingRecord?.values || syncedContent?.summary?.latestContinuity?.values || {};
      const updatedAt = new Date().toISOString();
      enqueueSyncMutation({
        continuity: {
          userID: account.userID,
          codeVersion: defaultSyncCodeVersion,
          values: { ...existing, recentlyViewedSectionsJSON: "[]", recentSearchesJSON: "[]" },
          updatedAt
        }
      }, account);
      state.continuityAppliedAt = updatedAt;
      if (syncedContent?.summary?.latestContinuity) {
        syncedContent.summary.latestContinuity = {
          ...syncedContent.summary.latestContinuity,
          values: { ...existing, recentlyViewedSectionsJSON: "[]", recentSearchesJSON: "[]" },
          updatedAt
        };
      }
    }
    saveWorkspaceState();
    if (account) void flushPendingSyncAndRender().catch(() => {});
    return 0;
  }
  if (action === "bookmarks") return clearSettingsBookmarks();
  if (action === "notes") return clearSettingsAnnotations("noteBody");
  if (action === "tags") return clearSettingsAnnotations("tags");
  return 0;
}

function renderSettings() {
  const panel = renderTemplate(settingsTemplate);
  applyPaneWeight(panel, "utility:settings");
  wireReaderFontFamilyControl(panel);

  const jurisdictionSelect = panel.querySelector(".settings-jurisdiction-select");
  const versionSelect = panel.querySelector(".settings-version-select");
  const codeSectionSelect = panel.querySelector(".settings-code-section-select");
  const accountCopy = panel.querySelector(".account-status-copy");
  const planDetail = panel.querySelector(".account-plan-detail");
  const planRows = Array.from(panel.querySelectorAll("[data-plan-option]"));
  const signInButton = panel.querySelector(".account-sign-in");
  const signOutButton = panel.querySelector(".account-clear");
  const checkoutButton = panel.querySelector(".account-checkout");
  const planSecondaryButton = panel.querySelector(".account-plan-secondary");
  const syncTitle = panel.querySelector(".account-sync-title");
  const syncIcon = panel.querySelector(".account-sync-icon");
  const syncButton = panel.querySelector(".account-sync-now");
  const syncConflicts = panel.querySelector(".account-sync-conflicts");
  const offlineCopy = panel.querySelector(".settings-offline-copy");
  const offlineStatus = panel.querySelector(".settings-offline-status");
  const offlineProgress = panel.querySelector(".settings-offline-progress");
  const offlineDownload = panel.querySelector(".settings-offline-download");
  const offlineRemove = panel.querySelector(".settings-offline-remove");
  const projectList = panel.querySelector(".settings-project-list");
  const projectEmpty = panel.querySelector(".settings-projects-empty");
  const projectSelectAll = panel.querySelector(".settings-project-select-all");
  const projectDelete = panel.querySelector(".settings-project-delete");
  const status = panel.querySelector(".settings-status-message");

  const setStatus = (message, isError = false) => {
    status.textContent = message || "";
    status.classList.toggle("has-error", isError);
  };

  const settingsProjects = visibleProjectRecords(currentContentSummary().projects || []);
  const selectedProjectIDs = new Set();
  const projectCheckboxes = new Map();
  const updateProjectSelection = () => {
    const count = selectedProjectIDs.size;
    projectSelectAll.textContent = count === settingsProjects.length && count > 0 ? "Clear All" : "Select All";
    projectSelectAll.disabled = settingsProjects.length === 0;
    projectDelete.disabled = count === 0;
    projectDelete.textContent = count > 0 ? `Delete ${count} Selected` : "Delete Selected";
    projectCheckboxes.forEach((checkbox, id) => {
      checkbox.checked = selectedProjectIDs.has(id);
    });
  };
  projectEmpty.hidden = settingsProjects.length > 0;
  settingsProjects.forEach((project) => {
    const id = projectRecordID(project);
    const row = document.createElement("label");
    row.className = "settings-project-row";
    row.style.setProperty("--project-color", projectColor(project));
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", `Select ${project.name || project.title || "project"}`);
    const copy = document.createElement("span");
    copy.className = "settings-project-copy";
    const name = document.createElement("strong");
    name.textContent = readableProjectName(project);
    copy.append(name);
    row.append(checkbox, copy);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedProjectIDs.add(id);
      else selectedProjectIDs.delete(id);
      updateProjectSelection();
    });
    projectCheckboxes.set(id, checkbox);
    projectList.append(row);
  });
  projectSelectAll.addEventListener("click", () => {
    if (selectedProjectIDs.size === settingsProjects.length) selectedProjectIDs.clear();
    else settingsProjects.forEach((project) => selectedProjectIDs.add(projectRecordID(project)));
    updateProjectSelection();
  });
  projectDelete.addEventListener("click", async () => {
    const selectedProjects = settingsProjects.filter((project) => selectedProjectIDs.has(projectRecordID(project)));
    const count = selectedProjects.length;
    if (!count) return;
    const confirmed = await confirmWebWarning(
      count === 1 ? "Delete project" : "Delete projects",
      `This will permanently delete ${count} ${count === 1 ? "project" : "projects"} from every synced device. Saved items will keep their bookmarks. This cannot be undone.`,
      { confirmLabel: "Delete" }
    );
    if (!confirmed) return;
    projectDelete.disabled = true;
    try {
      for (const project of selectedProjects) {
        await deleteArchivedProjectData(project);
      }
      setStatus(`${count} ${count === 1 ? "project" : "projects"} deleted.`);
      await renderWorkspace();
    } catch (error) {
      setStatus(error.message || "Could not delete the selected projects.", true);
      projectDelete.disabled = false;
    }
  });
  updateProjectSelection();

  jurisdictionSelect.value = "jurisdiction-1";
  versionSelect.value = defaultSyncCodeVersion;
  settingsCodeSectionOptions().forEach((option) => {
    const element = document.createElement("option");
    element.value = option.prefix;
    element.textContent = option.label;
    codeSectionSelect.append(element);
  });
  codeSectionSelect.value = selectedSettingsCodePrefix();
  codeSectionSelect.addEventListener("change", () => updateSettingsCodeSection(codeSectionSelect.value));

  const renderSyncState = () => {
    const account = activeAccount();
    const pending = account ? (state.syncOutbox || []).filter((item) => item.accountUserID === account.userID) : [];
    const conflicts = account ? (state.syncConflicts || []).filter((item) => item.accountUserID === account.userID) : [];
    const offline = navigator.onLine === false || !serverReachable;
    syncButton.disabled = !account || offline;
    syncIcon.textContent = !account ? "!" : offline ? "○" : conflicts.length || pending.length ? "↻" : "✓";
    syncTitle.textContent = !account
      ? "Not signed in"
      : offline ? pending.length ? `${pending.length} changes waiting for internet` : "Offline · saved on this device"
        : conflicts.length ? "Review needed"
          : pending.length ? "Changes waiting"
            : "Up to date";
    clear(syncConflicts);
    conflicts.slice(0, 5).forEach((entry) => {
      const { kind, record } = mutationKindAndRecord(entry.mutation);
      const row = document.createElement("article");
      row.className = "settings-conflict-row";
      const heading = document.createElement("strong");
      heading.textContent = record?.title || record?.name || kind || "Saved change";
      const message = document.createElement("span");
      message.textContent = "The server has a newer copy.";
      const actions = document.createElement("div");
      actions.className = "connector-actions";
      [
        ["Use server", false],
        ["Keep mine", true]
      ].forEach(([label, keepLocal]) => {
        const button = document.createElement("button");
        button.className = "settings-mini-button";
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await resolveSyncConflict(entry, keepLocal);
          } catch (error) {
            setStatus(error.message || "Could not resolve this sync conflict.", true);
            button.disabled = false;
          }
        });
        actions.append(button);
      });
      row.append(heading, message, actions);
      syncConflicts.append(row);
    });
  };

  const renderOfflineState = async () => {
    const pro = isProAccount();
    const account = activeAccount();
    const library = await offlineLibraryStatus().catch(() => ({ available: false, supported: false }));
    offlineProgress.hidden = true;
    offlineDownload.disabled = false;
    offlineRemove.hidden = !library.available;
    if (!pro) {
      offlineCopy.textContent = `Offline reading is a Pro feature. The complete searchable code library is about ${offlineFeatureMetadata.estimatedDownload}.`;
      offlineStatus.textContent = account ? "Upgrade to Pro to download." : "Sign in and upgrade to Pro to download.";
      offlineDownload.textContent = account ? "Upgrade to Pro" : "Sign In to Continue";
      return;
    }
    offlineCopy.textContent = `Keep the app and complete searchable 2022 Construction Codes on this device. Estimated download: ${offlineFeatureMetadata.estimatedDownload}.`;
    if (!library.supported) {
      offlineStatus.textContent = "This browser does not provide the storage required for offline codes.";
      offlineDownload.textContent = "Offline Storage Unavailable";
      offlineDownload.disabled = true;
      return;
    }
    if (!library.available) {
      offlineStatus.textContent = navigator.onLine ? "Not downloaded on this device." : "Connect to the internet to download.";
      offlineDownload.textContent = "Download for Offline Use";
      offlineDownload.disabled = navigator.onLine === false;
      return;
    }
    if (library.assetVersion !== offlineFeatureMetadata.assetVersion) {
      offlineStatus.textContent = navigator.onLine
        ? "An updated offline code package is available."
        : "Your offline package works, but must be updated when you reconnect.";
      offlineDownload.textContent = "Update Offline Codes";
      offlineDownload.disabled = navigator.onLine === false;
      return;
    }
    const downloaded = new Date(library.downloadedAt);
    const dateLabel = Number.isNaN(downloaded.getTime())
      ? "downloaded"
      : `downloaded ${downloaded.toLocaleDateString()}`;
    offlineStatus.textContent = `${library.chapterCount || 0} chapters available offline · ${dateLabel}.`;
    offlineDownload.textContent = "Update Offline Codes";
    offlineDownload.disabled = navigator.onLine === false;
  };

  const syncAccountState = () => {
    const account = activeAccount();
    const pro = isProAccount();
    const source = currentEntitlement()?.source;
    const canLinkApple = Boolean(account && state.account?.authProvider === "web");
    const activePlan = pro ? "pro" : "free";
    planRows.forEach((row) => {
      const active = row.dataset.planOption === activePlan;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-current", active ? "true" : "false");
      const indicator = row.querySelector(".settings-feature-icon");
      if (indicator) indicator.textContent = active ? "✓" : "";
    });
    planDetail.textContent = pro
      ? source === "lifetimeGrant"
        ? "Lifetime Pro is active. This account has gifted access and does not need a subscription."
        : "Pro is active. Unlimited saved work, projects, tags, PDF export, and web offline downloads are unlocked."
      : "Free includes continuity and cross-device sync. Pro unlocks unlimited saved work, projects, organization, and exports.";
    checkoutButton.disabled = !account || (pro && source === "lifetimeGrant");
    checkoutButton.textContent = pro
      ? source === "lifetimeGrant" ? "Pro Active" : "Manage Subscription"
      : "Upgrade to Pro";
    planSecondaryButton.hidden = !account || pro || source === "lifetimeGrant";
    planSecondaryButton.textContent = "Restore Purchases";
    accountCopy.hidden = Boolean(account);
    signOutButton.hidden = !account;
    signInButton.hidden = Boolean(account) && !canLinkApple;
    signInButton.textContent = canLinkApple ? "Link Apple" : "Sign in";
    accountCopy.textContent = "Sign in to attach local saved work to your account and use cross-device sync.";
    renderSyncState();
    void renderOfflineState();
  };

  syncAccountState();
  appleWebSignInConfig().then((config) => {
    const account = activeAccount();
    if (account && state.account?.authProvider === "web") {
      signInButton.hidden = !config.available;
      signInButton.disabled = !config.available;
      signInButton.textContent = "Link Apple";
      return;
    }
    if (account) return;
    signInButton.textContent = config.available ? "Sign in with Apple" : "Sign in";
    signInButton.disabled = !config.available && !config.browserFallbackAllowed;
    if (!config.available && !config.browserFallbackAllowed) accountCopy.textContent = "Apple web sign-in is not configured yet.";
  }).catch(() => {
    if (!activeAccount()) accountCopy.textContent = "Could not check sign-in configuration.";
  });

  signInButton.addEventListener("click", async () => {
    signInButton.disabled = true;
    setStatus("Signing in...");
    try {
      await signInCurrentBrowser();
      await renderWorkspace();
      startForegroundSyncLoop({ immediate: true });
    } catch (error) {
      setStatus(error.message || "Could not sign in.", true);
      signInButton.disabled = false;
      syncAccountState();
    }
  });
  signOutButton.addEventListener("click", async () => {
    const account = activeAccount();
    signOutButton.disabled = true;
    try {
      if (account) {
        await postJSON("/account/sign-out", { auth: { accountUserID: account.userID } }, { token: account.sessionToken });
      }
    } catch {
      // Clear the local session even if the network is unavailable.
    } finally {
      await disableOfflineFeature().catch(() => {});
      state.account = null;
      persistAccountSession(null);
      syncedContent = null;
      stopForegroundSyncLoop();
      saveWorkspaceState();
      await renderWorkspace();
    }
  });
  checkoutButton.addEventListener("click", async () => {
    const account = activeAccount();
    if (!account) return;
    if (isProAccount()) {
      if (currentEntitlement()?.source === "lifetimeGrant") return;
      if (currentEntitlement()?.source === "appleSubscription") {
        window.location.href = "https://apps.apple.com/account/subscriptions";
        return;
      }
      checkoutButton.disabled = true;
      setStatus("Opening subscription management...");
      try {
        const payload = await postJSON("/billing/web/portal", { auth: { accountUserID: account.userID } }, { token: account.sessionToken });
        if (!payload.url) throw new Error("Subscription management did not return a URL.");
        window.location.href = payload.url;
      } catch (error) {
        setStatus(error.message || "Could not open subscription management.", true);
        checkoutButton.disabled = false;
      }
      return;
    }
    checkoutButton.disabled = true;
    setStatus("Opening checkout...");
    try {
      const payload = await postJSON("/billing/web/checkout", { auth: { accountUserID: account.userID } }, { token: account.sessionToken });
      if (!payload.url) throw new Error("Checkout did not return a URL.");
      window.location.href = payload.url;
    } catch (error) {
      setStatus(error.message || "Could not open checkout.", true);
      checkoutButton.disabled = false;
    }
  });
  planSecondaryButton.addEventListener("click", async () => {
    const account = activeAccount();
    if (!account || isProAccount()) return;
    const restoreID = window.prompt("Enter the Stripe checkout session or subscription ID from your purchase receipt.");
    if (!restoreID) return;
    planSecondaryButton.disabled = true;
    try {
      const payload = await postJSON("/billing/stripe/restore", {
        auth: { accountUserID: account.userID },
        restoreID
      }, { token: account.sessionToken });
      storeAccountEntitlement(payload.entitlement || null);
      await renderWorkspace();
    } catch (error) {
      setStatus(error.message || "Could not restore this purchase.", true);
      planSecondaryButton.disabled = false;
    }
  });
  syncButton.addEventListener("click", async () => {
    syncButton.disabled = true;
    syncButton.textContent = "Syncing...";
    try {
      await flushSyncOutbox({ refresh: true });
      await loadSyncedContent({ force: true });
      await renderWorkspace();
    } catch (error) {
      setStatus(error.message || "Sync failed.", true);
      syncButton.disabled = false;
      syncButton.textContent = "Sync Now";
    }
  });
  offlineDownload.addEventListener("click", async () => {
    const account = activeAccount();
    if (!account) {
      signInButton.click();
      return;
    }
    if (!isProAccount()) {
      checkoutButton.click();
      return;
    }
    offlineDownload.disabled = true;
    offlineRemove.hidden = true;
    offlineProgress.hidden = false;
    offlineProgress.value = 0;
    offlineStatus.textContent = "Confirming Pro access…";
    try {
      await loadSyncedContent({ force: true });
      if (!isProAccount()) {
        await disableOfflineFeature();
        throw new Error("An active Pro plan is required for offline access.");
      }
      await downloadOfflineLibrary({
        codeVersion: defaultSyncCodeVersion,
        onProgress(progress) {
          offlineProgress.value = progress.percent || 0;
          offlineStatus.textContent = progress.total > 1
            ? `${progress.phase} · ${progress.completed} of ${progress.total} ${progress.unit || "items"}`
            : progress.phase;
        }
      });
      if (syncedContent?.status === "connected" && account.userID === syncedContent.userID) {
        await saveOfflineSyncSnapshot(account.userID, syncedContent);
      }
      offlineStatus.textContent = "Offline access is ready.";
      await renderOfflineState();
    } catch (error) {
      const message = error.message || "Could not download offline codes.";
      offlineProgress.hidden = true;
      await renderOfflineState();
      offlineStatus.textContent = message;
    }
  });
  offlineRemove.addEventListener("click", async () => {
    offlineRemove.disabled = true;
    offlineStatus.textContent = "Removing offline download…";
    try {
      await disableOfflineFeature();
      offlineStatus.textContent = "Offline download removed.";
      await renderOfflineState();
    } catch (error) {
      offlineStatus.textContent = error.message || "Could not remove the offline download.";
      offlineRemove.disabled = false;
    }
  });

  const clearActionCopy = {
    searches: ["Clear recent searches", "This will remove recent search history and Jump Back In from this browser. Pinned searches will remain. Are you sure?"],
    bookmarks: ["Clear all bookmarks", "This will remove every bookmark saved for the current code version. Are you sure?"],
    notes: ["Clear all notes", "This will remove every note saved for the current code version. Are you sure?"],
    tags: ["Clear all tags", "This will remove every tag from saved sections. Bookmarks and notes will not be affected. Are you sure?"]
  };
  panel.querySelectorAll("[data-clear-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.clearAction;
      const [title, message] = clearActionCopy[action];
      const confirmed = await confirmWebWarning(title, message, { confirmLabel: "Confirm" });
      if (!confirmed) return;
      button.disabled = true;
      try {
        const count = await performSettingsClearAction(action);
        setStatus(action === "searches" ? "Recent searches cleared." : `${count} ${action} cleared.`);
        await renderWorkspace();
      } catch (error) {
        setStatus(error.message || `Could not clear ${action}.`, true);
        button.disabled = false;
      }
    });
  });
  return panel;
}

function wireReaderFontFamilyControl(panel) {
  const fontSelect = panel.querySelector(".preview-font-family-select");

  const syncControl = () => {
    state.readerSettings = normalizeReaderSettings(state.readerSettings);
    if (fontSelect) fontSelect.value = state.readerSettings.fontFamily;
    applyReaderSettings();
  };

  syncControl();

  fontSelect?.addEventListener("change", () => {
    state.readerSettings.fontFamily = fontSelect.value;
    syncControl();
    saveWorkspaceState();
  });
}

function createDivider(previousPaneID, nextPaneID) {
  const divider = document.createElement("div");
  divider.className = "pane-divider";
  divider.dataset.previousPaneId = previousPaneID;
  divider.dataset.nextPaneId = nextPaneID;
  divider.role = "separator";
  divider.tabIndex = 0;
  divider.setAttribute("aria-orientation", "vertical");
  divider.addEventListener("pointerdown", (event) => startPaneResize(event, previousPaneID, nextPaneID));
  divider.addEventListener("dblclick", () => resetDividerPanes(previousPaneID, nextPaneID));
  return divider;
}

function resetDividerPanes(previousPaneID, nextPaneID) {
  const currentLeft = track.scrollLeft;
  [previousPaneID, nextPaneID].forEach((paneID) => {
    if (!paneID) return;
    state.paneWeights[paneID] = defaultPaneWidthForID(paneID);
    const pane = track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`);
    if (pane) applyPaneWeight(pane, paneID);
  });
  saveWorkspaceState();
  requestAnimationFrame(() => {
    track.scrollLeft = Math.min(currentLeft, Math.max(0, track.scrollWidth - track.clientWidth));
  });
}

function paneGroupForMove(paneID, orderedIDs = activePaneIDs()) {
  if (!paneID) return [];
  const active = new Set(orderedIDs);
  if (
    paneID === primarySavedPaneID() ||
    isProjectDetailPaneID(paneID) ||
    isProjectNotebookPaneID(paneID) ||
    isProjectWorkboardPaneID(paneID)
  ) {
    return [
      primarySavedPaneID(),
      ...openProjectDetails().flatMap((detail) => [
        paneIDForProjectDetail(detail),
        ...(projectHasOpenNotebook(detail) ? [paneIDForProjectNotebook(detail)] : []),
        ...(projectHasOpenWorkboard(detail) ? [paneIDForProjectWorkboard(detail)] : [])
      ]),
      "utility:archive"
    ].filter((id) => active.has(id));
  }
  if (paneID.startsWith("utility:search:")) {
    const searchID = paneID.replace("utility:search:", "");
    return [paneID, paneIDForSectionDetail(searchID), linkedReaderPaneIDForSearch(searchID)].filter((id) => active.has(id));
  }
  if (paneID.startsWith("section:detail:")) {
    const searchID = paneID.replace("section:detail:", "");
    return [paneIDForUtilityInstance({ key: "search", id: searchID }), paneID, linkedReaderPaneIDForSearch(searchID)].filter((id) => active.has(id));
  }
  const linkedSearchID = searchIDForLinkedReaderPane(paneID);
  if (linkedSearchID) {
    return [paneIDForUtilityInstance({ key: "search", id: linkedSearchID }), paneIDForSectionDetail(linkedSearchID), paneID].filter((id) => active.has(id));
  }
  return active.has(paneID) ? [paneID] : [];
}

function orderWithPaneMoved(draggedPaneID, targetPaneID, position) {
  if (!draggedPaneID || !targetPaneID || draggedPaneID === targetPaneID) return null;
  const currentOrder = activePaneIDs();
  const draggedGroup = paneGroupForMove(draggedPaneID, currentOrder);
  const targetGroup = paneGroupForMove(targetPaneID, currentOrder);
  if (!draggedGroup.length || !targetGroup.length) return null;
  if (draggedGroup.some((id) => targetGroup.includes(id))) return null;
  const order = currentOrder.filter((id) => !draggedGroup.includes(id));
  const targetIndexes = targetGroup.map((id) => order.indexOf(id)).filter((index) => index !== -1);
  if (!targetIndexes.length) return null;
  const targetIndex = position === "after" ? Math.max(...targetIndexes) + 1 : Math.min(...targetIndexes);
  if (targetIndex === -1) return null;
  order.splice(targetIndex, 0, ...draggedGroup);
  return order;
}

function applyDragPreviewOrder(order) {
  if (!Array.isArray(order) || !order.length) return;
  const previousRects = new Map(
    Array.from(track.querySelectorAll(".workspace-panel")).map((pane) => [pane.dataset.paneId, pane.getBoundingClientRect()])
  );
  dragPreviewOrder = order;
  const paneIndex = new Map(order.map((id, index) => [id, index]));
  track.querySelectorAll(".workspace-panel").forEach((pane) => {
    const index = paneIndex.get(pane.dataset.paneId);
    if (index !== undefined) pane.style.order = String(index * 2);
  });
  track.querySelectorAll(".pane-divider").forEach((divider) => {
    const previousIndex = paneIndex.get(divider.dataset.previousPaneId);
    const nextIndex = paneIndex.get(divider.dataset.nextPaneId);
    const index = Math.min(previousIndex ?? Number.MAX_SAFE_INTEGER, nextIndex ?? Number.MAX_SAFE_INTEGER);
    divider.style.order = String(index * 2 + 1);
  });
  track.querySelectorAll(".workspace-panel").forEach((pane) => {
    const previousRect = previousRects.get(pane.dataset.paneId);
    if (!previousRect) return;
    const nextRect = pane.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    if (Math.abs(deltaX) < 1) return;
    pane.style.willChange = "transform";
    pane.style.transition = "none";
    pane.style.transform = `translateX(${deltaX}px)`;
    requestAnimationFrame(() => {
      pane.style.transition = "";
      pane.style.transform = "";
      pane.style.willChange = "";
    });
  });
}

function clearDragPreviewOrder() {
  dragPreviewOrder = [];
  track.querySelectorAll(".workspace-panel, .pane-divider").forEach((node) => {
    node.style.order = "";
  });
}

function bindPaneDragging(panes) {
  panes.forEach((pane) => {
    const handle = pane.querySelector(".pane-drag-handle");
    if (!handle || pane.dataset.dragBound === "true") return;
    pane.dataset.dragBound = "true";
    handle.draggable = true;

    handle.addEventListener("dragstart", (event) => {
      pane.classList.add("is-dragging");
      draggedPaneID = pane.dataset.paneId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedPaneID);
    });

    handle.addEventListener("dragend", () => {
      const finalOrder = dragPreviewOrder.length ? dragPreviewOrder.slice() : null;
      draggedPaneID = "";
      pane.classList.remove("is-dragging");
      track.querySelectorAll(".workspace-panel.is-drop-before, .workspace-panel.is-drop-after").forEach((panel) => {
        panel.classList.remove("is-drop-before", "is-drop-after");
      });
      if (finalOrder?.length) {
        state.paneOrder = finalOrder;
        saveWorkspaceState();
        clearDragPreviewOrder();
        void transitionWorkspace("utility");
      } else {
        clearDragPreviewOrder();
      }
    });

    pane.addEventListener("dragover", (event) => {
      const activeDraggedPaneID = draggedPaneID || event.dataTransfer.getData("text/plain");
      if (!activeDraggedPaneID || activeDraggedPaneID === pane.dataset.paneId) return;
      event.preventDefault();
      const rect = pane.getBoundingClientRect();
      const position = event.clientX > rect.left + rect.width / 2 ? "after" : "before";
      const previewOrder = orderWithPaneMoved(activeDraggedPaneID, pane.dataset.paneId, position);
      if (previewOrder && previewOrder.join("|") !== dragPreviewOrder.join("|")) {
        applyDragPreviewOrder(previewOrder);
      }
      pane.classList.toggle("is-drop-before", position === "before");
      pane.classList.toggle("is-drop-after", position === "after");
    });

    pane.addEventListener("dragleave", () => {
      pane.classList.remove("is-drop-before", "is-drop-after");
    });

    pane.addEventListener("drop", (event) => {
      const activeDraggedPaneID = draggedPaneID || event.dataTransfer.getData("text/plain");
      if (!activeDraggedPaneID || activeDraggedPaneID === pane.dataset.paneId) return;
      event.preventDefault();
      const rect = pane.getBoundingClientRect();
      const position = event.clientX > rect.left + rect.width / 2 ? "after" : "before";
      const nextOrder = dragPreviewOrder.length
        ? dragPreviewOrder.slice()
        : orderWithPaneMoved(activeDraggedPaneID, pane.dataset.paneId, position);
      draggedPaneID = "";
      if (nextOrder?.length) {
        state.paneOrder = nextOrder;
        saveWorkspaceState();
        clearDragPreviewOrder();
        void transitionWorkspace("utility");
      } else {
        clearDragPreviewOrder();
      }
    });
  });
}

function startPaneResize(event, previousPaneID, nextPaneID) {
  const panes = Array.from(track.querySelectorAll(".workspace-panel"));
  const previousPane = panes.find((pane) => pane.dataset.paneId === previousPaneID);
  const nextPane = panes.find((pane) => pane.dataset.paneId === nextPaneID);
  if (!previousPane || !nextPane) return;

  event.preventDefault();
  const resizeHandle = event.currentTarget;
  resizeHandle?.setPointerCapture?.(event.pointerId);
  track.classList.add("is-resizing");
  const startX = event.clientX;
  const startScrollLeft = track.scrollLeft;
  const paneData = panes.map((pane) => ({
    id: pane.dataset.paneId,
    pane,
    startWidth: pane.getBoundingClientRect().width,
    minWidth: defaultPaneWidthForID(pane.dataset.paneId)
  }));
  const previousIndex = paneData.findIndex((pane) => pane.id === previousPaneID);
  const nextIndex = paneData.findIndex((pane) => pane.id === nextPaneID);
  if (previousIndex === -1 || nextIndex === -1) {
    track.classList.remove("is-resizing");
    return;
  }
  const lastAppliedWidths = paneData.map((pane) => pane.startWidth);
  let pendingClientX = startX;
  let resizeFrame = null;

  const applyResizeAt = (clientX) => {
    const delta = clientX - startX;
    const widths = paneData.map((pane) => pane.startWidth);
    widths[previousIndex] = Math.max(
      paneData[previousIndex].minWidth,
      paneData[previousIndex].startWidth + delta
    );
    widths[nextIndex] = Math.max(
      paneData[nextIndex].minWidth,
      paneData[nextIndex].startWidth - delta
    );
    [previousIndex, nextIndex].forEach((index) => {
      if (Math.abs(widths[index] - lastAppliedWidths[index]) < 0.25) return;
      const pane = paneData[index];
      state.paneWeights[pane.id] = widths[index];
      applyPaneWeight(pane.pane, pane.id);
      lastAppliedWidths[index] = widths[index];
    });
    const appliedPreviousDelta = widths[previousIndex] - paneData[previousIndex].startWidth;
    const pushedScrollDelta = appliedPreviousDelta - delta;
    track.scrollLeft = Math.max(0, startScrollLeft + pushedScrollDelta);
  };

  const applyPendingResize = () => {
    resizeFrame = null;
    applyResizeAt(pendingClientX);
  };

  const onMove = (moveEvent) => {
    pendingClientX = moveEvent.clientX;
    if (resizeFrame === null) resizeFrame = window.requestAnimationFrame(applyPendingResize);
  };

  const onUp = (upEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    pendingClientX = Number.isFinite(upEvent.clientX) ? upEvent.clientX : pendingClientX;
    applyResizeAt(pendingClientX);
    if (resizeHandle?.hasPointerCapture?.(upEvent.pointerId)) {
      resizeHandle.releasePointerCapture(upEvent.pointerId);
    }
    track.classList.remove("is-resizing");
    notifyWorkspaceLayoutChange();
    saveWorkspaceState();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
  window.addEventListener("pointercancel", onUp, { once: true });
}

function notifyWorkspaceLayoutChange() {
  track.dispatchEvent(new Event("permitext:workspace-layout-change"));
}

function appendPaneSequence(panes) {
  closeActiveCustomSelect();
  const orderedPanes = orderPanes(panes);
  const previousScrollLeft = track.scrollLeft;
  const nodes = [];
  const dividerKey = (previousPaneID, nextPaneID) => `${previousPaneID}\u0000${nextPaneID}`;
  const existingDividers = new Map(
    Array.from(track.querySelectorAll(":scope > .pane-divider")).map((divider) => [
      dividerKey(divider.dataset.previousPaneId, divider.dataset.nextPaneId),
      divider
    ])
  );
  cleanupInactiveWorkboardMounts(orderedPanes);
  cleanupInactiveNotebookMounts(orderedPanes);
  bindPaneDragging(orderedPanes);
  orderedPanes.forEach((pane, index) => {
    if (index > 0) {
      const previousPaneID = orderedPanes[index - 1].dataset.paneId;
      const nextPaneID = pane.dataset.paneId;
      nodes.push(existingDividers.get(dividerKey(previousPaneID, nextPaneID)) || createDivider(previousPaneID, nextPaneID));
    }
    nodes.push(pane);
  });
  const desiredNodes = new Set(nodes);
  Array.from(track.children).forEach((node) => {
    if (!desiredNodes.has(node)) node.remove();
  });
  nodes.forEach((node, index) => {
    const currentNode = track.children[index] || null;
    if (currentNode !== node) track.insertBefore(node, currentNode);
  });
  const activeSelectMenus = new Set(
    Array.from(track.querySelectorAll("select.native-select-hidden"))
      .map((select) => select._customSelectMenu)
      .filter(Boolean)
  );
  document.querySelectorAll(".custom-select-menu[data-floating-select='true']").forEach((menu) => {
    if (!activeSelectMenus.has(menu)) menu.remove();
  });
  track.scrollLeft = Math.min(previousScrollLeft, Math.max(0, track.scrollWidth - track.clientWidth));
  notifyWorkspaceLayoutChange();
}

function scrollPaneIntoView(paneID, behavior = "smooth") {
  const pane = track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`);
  if (!pane) return;
  const paneRect = pane.getBoundingClientRect();
  const trackRect = track.getBoundingClientRect();
  const visibleRight = trackRect.right;
  const paneRight = paneRect.right - visibleRight;
  const paneLeft = paneRect.left - trackRect.left;
  if (paneRight > 0) {
    track.scrollTo({
      left: Math.min(track.scrollLeft + paneRight, Math.max(0, track.scrollWidth - track.clientWidth)),
      behavior
    });
  } else if (paneLeft < 0) {
    track.scrollTo({
      left: Math.max(0, track.scrollLeft + paneLeft),
      behavior
    });
  }
}

async function renderWorkspace() {
  await ensureSyncedContentForRender();
  closeDeletedProjectDetails();
  const paneIDs = activePaneIDs();
  normalizePaneWeights(paneIDs);
  setUtilityButtonStates();

  const panes = [];
  if (detachedProjectWindow && detachedProject) {
    panes.push(await renderProjectWorkboard(detachedProject));
    appendPaneSequence(panes);
    syncAllCommentBoxHeights();
    bindAllReaderCommentScroll();
    saveWorkspaceState();
    return;
  }
  for (const detail of openProjectDetails()) {
    panes.push(await renderProjectDetail(detail));
    if (projectHasOpenNotebook(detail)) panes.push(await renderProjectNotebook(detail));
    if (projectHasOpenWorkboard(detail)) panes.push(await renderProjectWorkboard(detail));
  }
  if (state.utilities.archive) {
    panes.push(await renderArchive());
  }
  for (const instance of state.utilityInstances || []) {
    const pane = await renderUtilityInstance(instance);
    if (pane) panes.push(pane);
    if (instance.key === "search") {
      const detail = sectionDetailsBySearch()[instance.id];
      if (detail) panes.push(await renderSectionDetail(instance.id, detail));
    }
  }
  if (state.utilities.analysis) {
    panes.push(await renderResearch());
    if (state.researchConversationID) panes.push(await renderResearchConversation(state.researchConversationID));
  }
  if (state.utilities.settings) {
    panes.push(renderSettings());
  }
  for (const reader of state.readers) {
    panes.push(await renderReader(reader));
  }
  appendPaneSequence(panes);
  syncAllCommentBoxHeights();
  bindAllReaderCommentScroll();
  enhanceReaderSelects();
  saveWorkspaceState();
}

async function renderUtilityWorkspace(options = {}) {
  closeDeletedProjectDetails();
  const existingPanesByID = new Map(
    Array.from(track.querySelectorAll(".workspace-panel"))
      .filter((pane) => pane.dataset.paneId)
      .map((pane) => [pane.dataset.paneId, pane])
  );
  const refreshPaneIDs = new Set(options.refreshPaneIDs || []);
  const reuseOrRenderPane = async (paneID, renderPane) => {
    const existingPane = refreshPaneIDs.has(paneID) ? null : existingPanesByID.get(paneID);
    const pane = existingPane || await renderPane();
    if (pane) applyPaneWeight(pane, paneID);
    return pane;
  };
  const paneIDs = activePaneIDs();
  normalizePaneWeights(paneIDs);
  setUtilityButtonStates();

  const panes = [];
  for (const detail of openProjectDetails()) {
    const detailID = paneIDForProjectDetail(detail);
    panes.push(await reuseOrRenderPane(detailID, () => renderProjectDetail(detail)));
    if (projectHasOpenNotebook(detail)) {
      const notebookID = paneIDForProjectNotebook(detail);
      panes.push(await reuseOrRenderPane(notebookID, () => renderProjectNotebook(detail)));
    }
    if (projectHasOpenWorkboard(detail)) {
      const workboardID = paneIDForProjectWorkboard(detail);
      panes.push(await reuseOrRenderPane(workboardID, () => renderProjectWorkboard(detail)));
    }
  }
  if (state.utilities.archive) {
    panes.push(await reuseOrRenderPane("utility:archive", renderArchive));
  }
  for (const instance of state.utilityInstances || []) {
    const paneID = paneIDForUtilityInstance(instance);
    const pane = await reuseOrRenderPane(paneID, () => renderUtilityInstance(instance));
    wireUtilityInstanceActions(pane, instance);
    if (pane) panes.push(pane);
    if (instance.key === "search") {
      const detailID = paneIDForSectionDetail(instance.id);
      const detailState = sectionDetailsBySearch()[instance.id];
      if (detailState) {
        const detailPane = await reuseOrRenderPane(detailID, () => renderSectionDetail(instance.id, detailState));
        panes.push(detailPane);
      }
    }
  }
  if (state.utilities.analysis) {
    panes.push(await reuseOrRenderPane("utility:analysis", renderResearch));
    if (state.researchConversationID) {
      const conversationPaneID = paneIDForResearchConversation();
      panes.push(await reuseOrRenderPane(conversationPaneID, () => renderResearchConversation(state.researchConversationID)));
    }
  }
  if (state.utilities.settings) {
    panes.push(await reuseOrRenderPane("utility:settings", renderSettings));
  }

  for (const reader of state.readers) {
    const paneID = paneIDForReader(reader);
    const pane = await reuseOrRenderPane(paneID, () => renderReader(reader));
    const closeButton = pane?.querySelector(".reader-close");
    if (closeButton) closeButton.hidden = state.readers.length <= 1;
    if (pane) panes.push(pane);
  }

  appendPaneSequence(panes);
  syncAllCommentBoxHeights();
  bindAllReaderCommentScroll();
  enhanceReaderSelects();
  saveWorkspaceState();
}

async function transitionWorkspace(mode = "default", options = {}) {
  if (mode === "utility") {
    await renderUtilityWorkspace(options);
    return;
  }
  await renderWorkspace();
}

async function toggleUtilityPane(key) {
  if (repeatableUtilityKeys.has(key)) {
    const instance = newUtilityInstance(key);
    const paneID = paneIDForUtilityInstance(instance);
    state.utilityInstances = [...(state.utilityInstances || []), instance];
    state.utilities[key] = false;
    state.paneWeights[paneID] = defaultPaneWidthForID(paneID);
    movePaneToFront(paneID);
    saveWorkspaceState();
    await transitionWorkspace("utility");
    track.scrollTo({ left: 0, behavior: "smooth" });
    return;
  }

  const paneID = `utility:${key}`;
  const willOpen = !state.utilities[key];
  state.utilities[key] = willOpen;
  if (willOpen) {
    state.paneWeights[paneID] = defaultPaneWidthForID(paneID);
    if (key === "projects") {
      restoreProjectsStackOrder();
    } else {
      movePaneToFront(paneID);
    }
  } else if (key === "projects") {
    delete state.paneWeights[paneID];
    openProjectDetails().forEach((detail) => {
      delete state.paneWeights[paneIDForProjectDetail(detail)];
      delete state.paneWeights[paneIDForProjectWorkboard(detail)];
      delete state.paneWeights[paneIDForProjectNotebook(detail)];
    });
    delete state.paneWeights["utility:archive"];
    state.paneOrder = (state.paneOrder || []).filter((id) =>
      id !== paneID &&
      !isProjectDetailPaneID(id) &&
      !isProjectNotebookPaneID(id) &&
      !isProjectWorkboardPaneID(id) &&
      id !== "utility:archive"
    );
  } else if (key === "archive") {
    state.paneOrder = (state.paneOrder || []).filter((id) => id !== "utility:archive");
  } else if (key === "analysis" && !willOpen) {
    state.researchConversationID = "";
    activeResearchConversation = null;
    state.paneOrder = (state.paneOrder || []).filter((id) => id !== paneID && !id.startsWith("research:conversation:"));
    Object.keys(state.paneWeights).filter((id) => id.startsWith("research:conversation:")).forEach((id) => delete state.paneWeights[id]);
  }
  saveWorkspaceState();
  await transitionWorkspace("utility", {
    refreshPaneIDs: key === "archive" ? projectOverviewRefreshPaneIDs() : []
  });
  if (willOpen) {
    track.scrollTo({ left: 0, behavior: "smooth" });
  }
}

async function fitVisibleColumns() {
  const paneIDs = activePaneIDs();
  state.paneWeights = paneIDs.reduce((weights, paneID) => {
    weights[paneID] = defaultPaneWidthForID(paneID);
    return weights;
  }, {});
  saveWorkspaceState();
  track.querySelectorAll(".workspace-panel").forEach((pane) => {
    if (pane.dataset.paneId) {
      applyPaneWeight(pane, pane.dataset.paneId);
    }
  });
  track.scrollTo({ left: 0, behavior: "smooth" });
}

async function collapseToOneReader() {
  const reader = state.readers[0] || newReaderState();
  state.readers = [reader];
  state.searchResultReader = null;
  state.sectionDetail = null;
  state.sectionDetails = {};
  state.searchLinkedReaders = {};
  setOpenProjectDetails([]);
  state.workboards = [];
  state.notebooks = [];
  Object.keys(state.utilities).forEach((key) => {
    state.utilities[key] = false;
  });
  state.utilityInstances = [];
  state.researchConversationID = "";
  activeResearchConversation = null;
  const readerPaneID = paneIDForReader(reader);
  state.paneOrder = [readerPaneID];
  state.paneWeights = { [readerPaneID]: defaultPaneWidthForID(readerPaneID) };
  saveWorkspaceState();
  await transitionWorkspace("utility");
  track.scrollTo({ left: 0, behavior: "smooth" });
}

async function focusUtility(key, selector = "") {
  let paneID = "";
  if (repeatableUtilityKeys.has(key)) {
    let instance = (state.utilityInstances || []).find((item) => item.key === key);
    if (!instance) {
      await toggleUtilityPane(key);
      instance = (state.utilityInstances || []).find((item) => item.key === key);
    }
    paneID = instance ? paneIDForUtilityInstance(instance) : "";
  } else {
    if (!state.utilities[key]) await toggleUtilityPane(key);
    paneID = `utility:${key}`;
  }
  if (!paneID) return;
  scrollPaneIntoView(paneID);
  requestAnimationFrame(() => {
    const pane = track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`);
    const focusTarget = selector ? pane?.querySelector(selector) : pane?.querySelector("button, input, select, textarea");
    focusTarget?.focus({ preventScroll: true });
  });
}

function workspaceCommandDefinitions() {
  return [
    { label: "Open Search", hint: "Find sections across all codes", run: () => focusUtility("search", ".search-input") },
    { label: "Add Reader", hint: "Open another code column", run: () => addReaderButton.click() },
    { label: "Open Saved and Projects", hint: "Review saved work and organize projects", run: () => focusUtility("saved") },
    { label: "Open AI-assisted Research", hint: "Analyze the active official sections", run: () => focusUtility("analysis") },
    { label: "Open Settings", hint: "Code library, account, sync, and privacy", run: () => focusUtility("settings") },
    { label: "Reset Column Widths", hint: "Fit the current workspace", run: () => fitVisibleColumns() },
    { label: "Keep One Reader", hint: "Close every other workspace column", run: () => collapseToOneReader() }
  ];
}

function openWorkspaceCommandPalette() {
  document.querySelector(".command-palette-backdrop")?.remove();
  const commands = workspaceCommandDefinitions();
  const backdrop = document.createElement("div");
  backdrop.className = "command-palette-backdrop";
  const dialog = document.createElement("section");
  dialog.className = "command-palette";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Workspace commands");
  const input = document.createElement("input");
  input.type = "search";
  input.className = "command-palette-input";
  input.placeholder = "Type a command";
  input.setAttribute("aria-label", "Filter workspace commands");
  const list = document.createElement("div");
  list.className = "command-palette-list";
  let visibleCommands = commands;
  let selectedIndex = 0;

  const closePalette = () => backdrop.remove();
  const executeCommand = (command) => {
    closePalette();
    void Promise.resolve(command.run());
  };
  const renderCommands = () => {
    clear(list);
    const needle = input.value.trim().toLowerCase();
    visibleCommands = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(needle));
    selectedIndex = Math.min(selectedIndex, Math.max(0, visibleCommands.length - 1));
    visibleCommands.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-palette-item";
      button.classList.toggle("is-selected", index === selectedIndex);
      const label = document.createElement("strong");
      label.textContent = command.label;
      const hint = document.createElement("span");
      hint.textContent = command.hint;
      button.append(label, hint);
      button.addEventListener("click", () => executeCommand(command));
      list.append(button);
    });
  };
  input.addEventListener("input", () => {
    selectedIndex = 0;
    renderCommands();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    } else if (event.key === "ArrowDown" && visibleCommands.length) {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % visibleCommands.length;
      renderCommands();
    } else if (event.key === "ArrowUp" && visibleCommands.length) {
      event.preventDefault();
      selectedIndex = (selectedIndex - 1 + visibleCommands.length) % visibleCommands.length;
      renderCommands();
    } else if (event.key === "Enter" && visibleCommands[selectedIndex]) {
      event.preventDefault();
      executeCommand(visibleCommands[selectedIndex]);
    }
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) closePalette();
  });
  dialog.append(input, list);
  backdrop.append(dialog);
  document.body.append(backdrop);
  renderCommands();
  input.focus();
}

function bindWorkspaceKeyboardNavigation() {
  document.addEventListener("keydown", (event) => {
    const commandModifier = event.metaKey || event.ctrlKey;
    if (commandModifier && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openWorkspaceCommandPalette();
      return;
    }
    if (commandModifier && event.key.toLowerCase() === "f" && !event.target.closest("input, textarea, [contenteditable='true']")) {
      const readerPanel = track.querySelector(".reader-panel");
      const searchToggle = readerPanel?.querySelector(".reader-internal-search-toggle");
      if (searchToggle) {
        event.preventDefault();
        if (searchToggle.getAttribute("aria-pressed") !== "true") searchToggle.click();
        requestAnimationFrame(() => readerPanel.querySelector(".reader-internal-search-input")?.focus());
      }
      return;
    }
    if (commandModifier && /^[1-5]$/.test(event.key)) {
      const pane = track.querySelectorAll(":scope > .workspace-panel")[Number(event.key) - 1];
      if (pane?.dataset.paneId) {
        event.preventDefault();
        scrollPaneIntoView(pane.dataset.paneId);
        pane.querySelector("button, input, select, textarea")?.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key === "Escape" && !document.querySelector(".command-palette-backdrop")) {
      const focusedPanel = document.activeElement?.closest?.(".workspace-panel");
      focusedPanel?.querySelector(".utility-close")?.click();
    }
  });
}

async function start() {
  if (detachedWorkboardRoute && !detachedProjectWindow) {
    throw new Error("This detached Workboard session expired. Close this window and detach the Workboard again.");
  }
  if (!detachedProjectWindow) {
    const payload = await api("/code/chapters");
    chapters = payload.chapters || [];
  }
  updateConnectionStatus();
  void reconcileOfflineFeatureAccess(isProAccount()).catch(() => {});
  document.addEventListener("click", (event) => {
    if (
      activeCustomSelect &&
      !activeCustomSelect.custom.contains(event.target) &&
      !activeCustomSelect.menu.contains(event.target)
    ) {
      closeActiveCustomSelect();
    }
  });
  window.addEventListener("resize", repositionActiveCustomSelect);
  window.addEventListener("resize", scheduleVisibleReaderScrollIndicatorUpdates, { passive: true });
  bindWorkspaceKeyboardNavigation();
  bindResearchTextSelection();
  window.addEventListener("storage", (event) => {
    if (event.key === accountSessionKey) {
      try {
        state.account = event.newValue ? JSON.parse(event.newValue) : null;
      } catch {
        state.account = null;
      }
      syncedContent = null;
      if (activeAccount()) {
        startForegroundSyncLoop({ immediate: true });
      } else {
        stopForegroundSyncLoop();
      }
      void renderWorkspace();
      return;
    }
    if (event.key === baseWorkspaceKey) applySharedWorkspaceState(event.newValue);
    if (!detachedProjectWindow && event.key === "permitext:pendingWorkboardReattach" && event.newValue) {
      try {
        void reattachProjectWorkboard(JSON.parse(event.newValue));
      } catch {
        localStorage.removeItem("permitext:pendingWorkboardReattach");
      }
    }
  });
  window.addEventListener("online", () => {
    serverReachable = true;
    updateConnectionStatus();
    startForegroundSyncLoop({ immediate: true });
  });
  window.addEventListener("offline", () => {
    serverReachable = false;
    updateConnectionStatus();
    stopForegroundSyncLoop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      startForegroundSyncLoop({ immediate: true });
    } else {
      stopForegroundSyncLoop();
    }
  });
  track.addEventListener("scroll", repositionActiveCustomSelect, { passive: true });
  track.addEventListener("scroll", scheduleVisibleReaderScrollIndicatorUpdates, { passive: true });
  if (detachedProjectWindow) {
    if (!detachedProject) throw new Error("This detached Workboard no longer has a project session.");
    window.addEventListener("pagehide", () => {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: "permitext:detachedWorkboardClosed", project: detachedProject },
          window.location.origin
        );
      }
    }, { once: true });
    await renderWorkspace();
    void flushPendingSyncAndRender().catch(() => {});
    return;
  }
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "permitext:reattachWorkboard") {
      void reattachProjectWorkboard(event.data.project, event.source);
      return;
    }
    if (event.data?.type === "permitext:detachedWorkboardClosed") {
      state.detachedWorkboards = detachedWorkboards().filter((item) => !projectDetailMatches(event.data.project, item));
      saveWorkspaceState();
      void transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });
    }
  });
  try {
    const pendingReattach = JSON.parse(localStorage.getItem("permitext:pendingWorkboardReattach") || "null");
    if (pendingReattach) await reattachProjectWorkboard(pendingReattach);
  } catch {
    localStorage.removeItem("permitext:pendingWorkboardReattach");
  }
  addReaderButton.addEventListener("click", async () => {
    const reader = newReaderState({ chapterID: await firstChapterIDForCode("BC") });
    state.readers.push(reader);
    saveWorkspaceState();
    await transitionWorkspace("utility");
    scrollPaneIntoView(paneIDForReader(reader));
  });
  toggleArchiveButton?.addEventListener("click", () => {
    toggleUtilityPane("archive");
  });
  toggleSearchButton.addEventListener("click", () => {
    toggleUtilityPane("search");
  });
  toggleSavedButton.addEventListener("click", () => {
    toggleUtilityPane("saved");
  });
  toggleAnalysisButton.addEventListener("click", () => {
    toggleUtilityPane("analysis");
  });
  toggleSettingsButton.addEventListener("click", () => {
    toggleUtilityPane("settings");
  });
  fitColumnsButton.addEventListener("click", () => {
    fitVisibleColumns();
  });
  collapseReadersButton.addEventListener("click", () => {
    collapseToOneReader();
  });
  const deepLinkedSectionID = deepLinkedSectionIDFromLocation();
  consumeBrowserSectionURL();
  await renderWorkspace();
  scheduleWorkboardModulePreload();
  if (deepLinkedSectionID) {
    try {
      const payload = await api(`/code/sections/${deepLinkedSectionID}`);
      await openSectionDetailForExistingSearch(payload.section, { updateURL: false });
    } catch (error) {
      console.warn("Could not open shared section link.", error);
      window.history.replaceState({}, "", "/");
    }
  }
  void flushPendingSyncAndRender().catch(() => {});
  startForegroundSyncLoop();
  refreshEntitlementAfterCheckoutReturn();
}

start().catch((error) => {
  console.error(error);
  clear(track);
  if (detachedWorkboardRoute) {
    const panel = document.createElement("article");
    panel.className = "workspace-panel detached-workboard-error";
    const title = document.createElement("h1");
    title.textContent = "Workboard unavailable";
    const message = document.createElement("p");
    message.textContent = error.message;
    panel.append(title, message);
    track.append(panel);
    return;
  }
  const panel = renderTemplate(settingsTemplate);
  panel.querySelector(".panel-title").textContent = "Load error";
  const list = panel.querySelector(".settings-list");
  clear(list);
  const item = document.createElement("div");
  item.append(textNode("Could not load the web workspace."), textNode(error.message));
  list.append(item);
  track.append(panel);
});
