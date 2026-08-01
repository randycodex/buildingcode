import {
  inlineCodeReferencePhrases,
  parseCodeJumpAnchor,
  rewriteStructuredCodeLinks
} from "./code-references.js?v=20260720-code-reference-links-v18";
import {
  defaultSyncCodeVersion,
  syncCodeVersion,
  syncCodeVersionForPrefix,
  syncProjectIdentity,
  syncMutationRecordID
} from "./sync-identity.js?v=20260728-enacted-code-expansion-v6";
import {
  annotationAfterBulkClears,
  bulkClearKey,
  bulkClearTimestamp,
  mergeNewestRecord,
  recordSurvivesBulkClear
} from "./sync-state.js?v=20260721-causal-clear-v4";
import {
  disableOfflineFeature,
  deleteNotebookCardSnapshot,
  deleteLocalNotebookImage,
  deleteNotebookDraft,
  downloadOfflineLibrary,
  finalizeNotebookImagesForDocument,
  loadNotebookDraft,
  loadNotebookProjectSnapshot,
  loadOfflineSyncSnapshot,
  markNotebookImageUploaded,
  markNotebookImageUploadError,
  notebookImageRecord,
  notebookImagesForProject,
  offlineAPI,
  offlineFeatureMetadata,
  offlineLibraryStatus,
  reconcileOfflineFeatureAccess,
  pendingNotebookImages,
  saveNotebookDraft,
  saveNotebookCardSnapshot,
  saveNotebookProjectSnapshot,
  saveOfflineSyncSnapshot,
  stageNotebookImage
} from "./offline-storage.js?v=20260801-project-evidence-select-v375";
import {
  cacheRetryablePromise,
  resolveNotebookVersionConflict,
  shouldUseOfflineFallback
} from "./client-reliability.js?v=20260731-debug-audit-v1";
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
  workspaceLayoutHasVisiblePanes
} from "./workspace-state.js?v=20260731-multi-workspace-v1";

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
const workspaceRegistryKey = "permitext:webWorkspaces:v2";
const toolbarOrderKey = "permitext:webToolbarOrder:v1";
const defaultToolbarButtonIDs = Object.freeze([
  "add-reader",
  "add-zoning-reader",
  "toggle-search",
  "toggle-saved",
  "toggle-analysis",
  "toggle-settings",
  "fit-columns",
  "collapse-readers"
]);
const workspaceStateKeyPrefix = "permitext:webWorkspace:v2:";
const activeWorkspaceSessionKey = "permitext:webWorkspaceActive:v2";
const detachedWorkboardPath = "/detached-workboard";
const detachedWindowNamePrefix = "permitext-workboard-";
const detachedWindowSessionStorageKey = "permitext:detachedWorkboardSession:v1";
const internalSectionHistoryStateKey = "permitextInternalSectionNavigation";
const workboardClientVersion = "20260801-workboard-control-align-v31";
const notebookClientVersion = "20260801-notebook-toolbar-order-v11";
const detachedWorkboardRoute = window.location.pathname === detachedWorkboardPath;
const legacyDetachedProjectParameter = new URLSearchParams(window.location.search).get("detachedWorkboard") || "";
const detachedProjectSession = detachedWorkboardRoute ? detachedProjectSessionFromWindow() : null;
const detachedProjectSessionID = String(detachedProjectSession?.id || "");
const detachedProjectWindow = Boolean(detachedProjectSession?.project);
const workspaceKey = detachedProjectWindow
  ? `${baseWorkspaceKey}:detached:${detachedProjectSessionID}`
  : baseWorkspaceKey;
const track = document.querySelector("#panel-track");
const topbarActions = document.querySelector(".topbar-actions");
const addReaderButton = document.querySelector("#add-reader");
const addZoningReaderButton = document.querySelector("#add-zoning-reader");
const toggleArchiveButton = document.querySelector("#toggle-archive");
const toggleSearchButton = document.querySelector("#toggle-search");
const toggleSavedButton = document.querySelector("#toggle-saved");
const toggleAnalysisButton = document.querySelector("#toggle-analysis");
const toggleSettingsButton = document.querySelector("#toggle-settings");
const fitColumnsButton = document.querySelector("#fit-columns");
const collapseReadersButton = document.querySelector("#collapse-readers");
const workspaceTabs = document.querySelector("#workspace-tabs");
const addWorkspaceButton = document.querySelector("#add-workspace");
const workspaceActionsButton = document.querySelector("#workspace-actions");
const connectionStatus = document.querySelector("#connection-status");
const workspaceIssue = document.querySelector("#workspace-issue");
const workspaceIssueCopy = workspaceIssue?.querySelector(".workspace-issue-copy");
const workspaceIssueAction = workspaceIssue?.querySelector(".workspace-issue-action");
const workspaceIssueDismiss = workspaceIssue?.querySelector(".workspace-issue-dismiss");
const topbarBrand = document.querySelector(".topbar-brand");
const topbarBrandPlan = document.querySelector(".topbar-brand-plan");
const readerTemplate = document.querySelector("#reader-template");
const projectsTemplate = document.querySelector("#projects-template");
const searchTemplate = document.querySelector("#search-template");
const savedTemplate = document.querySelector("#saved-template");
const analysisTemplate = document.querySelector("#analysis-template");
const settingsTemplate = document.querySelector("#settings-template");
if (detachedWorkboardRoute) document.body.classList.add("is-detached-workboard-window");

const codeOptions = [
  { prefix: "BC", label: "Building Code", theme: "building", group: "Construction Codes" },
  { prefix: "AC", label: "General Administrative Code (2022 edition)", theme: "administrative", group: "Construction Codes" },
  { prefix: "PC", label: "Plumbing Code", theme: "plumbing", group: "Construction Codes" },
  { prefix: "MC", label: "Mechanical Code", theme: "mechanical", group: "Construction Codes" },
  { prefix: "FGC", label: "Fuel Gas Code", theme: "fuel-gas", group: "Construction Codes" },
  { prefix: "ECC", label: "Energy Conservation Code (2025)", theme: "energy", group: "Construction Codes" },
  { prefix: "EC", label: "Electrical Code — NYC amendments (2025)", theme: "electrical", group: "Construction Codes" },
  {
    prefix: "EBC",
    label: "Existing Building Code (effective July 17, 2027)",
    theme: "existing-building",
    group: "Construction Codes"
  },
  { prefix: "FC", label: "Fire Code", theme: "fire", group: "Construction Codes" },
  { prefix: "BC68", label: "1968 Building Code (historical)", theme: "historical", group: "Historical and Housing Codes" },
  { prefix: "HMC", label: "Housing Maintenance Code", theme: "housing", group: "Historical and Housing Codes" },
  { prefix: "T24", label: "Administrative Code Title 24 — Environmental Protection", theme: "environmental", group: "Administrative Code Titles" },
  { prefix: "T25", label: "Administrative Code Title 25 — Land Use", theme: "land-use", group: "Administrative Code Titles" },
  { prefix: "T26", label: "Administrative Code Title 26 — Housing and Buildings", theme: "housing-buildings", group: "Administrative Code Titles" },
  { prefix: "T28", label: "Administrative Code Title 28 — Current Consolidation", theme: "current-consolidation", group: "Administrative Code Titles" },
  { prefix: "LL", label: "Construction-Related Local Laws", theme: "local-law", group: "Local Laws and Transitions" },
  { prefix: "ZR", label: "Zoning Resolution", theme: "zoning", group: "Land Use" }
];
const zoningCodePrefix = "ZR";
const existingBuildingCodePrefix = "EBC";
const zoningSyncCodeVersion = "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1";

const codeThemeClasses = codeOptions.map((option) => `code-theme-${option.theme}`);
const defaultReaderPaneWidth = 520;
const defaultSourceLinkedReaderPaneWidth = 400;
const defaultNonReaderPaneWidth = 400;
const defaultUtilityPaneWidth = defaultNonReaderPaneWidth;
const defaultSavedPaneWidth = 600;
const defaultDetailPaneWidth = 600;
const defaultWorkboardPaneWidth = 750;
const defaultNotebookPaneWidth = 600;
const defaultReportDraftPaneWidth = defaultNonReaderPaneWidth;
const defaultSettingsPaneWidth = defaultNonReaderPaneWidth;
const readerSearchFlashDurationMS = 2000;
const readerInternalSearchDelayMS = 180;
const readerInitialSectionWindowSize = 5;
const readerProgressiveSectionBatchSize = 12;
const searchResultPageSize = 25;
const recentViewLimit = 50;
const recentSearchLimit = 50;
const repeatableUtilityKeys = new Set(["search", "saved"]);
const savedSortModes = new Set(["codeOrder", "recentlySaved", "codeBook", "title", "tag"]);
const collapsedSettingsCardIDs = new Set();
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
const globalWorkspaceStateKeys = [
  ...sharedWorkspaceStateKeys,
  "recentSearches",
  "recentSearchHistory",
  "recentActivityUpdatedAt",
  "pinnedSearches",
  "recentlyViewedSections",
  "browserCredentialID",
  "recentChaptersByCode",
  "readerSettings",
  "savedTextSize",
  "researchEvidenceSplitRatios",
  "detachedWorkboards"
];

const defaultReaderSettings = {
  fontFamily: "system"
};

let chapters = [];
let codeTrustProfiles = [];
let workspaceRegistry = null;
let activeWorkspaceID = "";
let suppressReaderScrollRestore = false;
let draggedWorkspaceID = "";
let draggedToolbarButtonID = "";
let workspaceContextMenu = null;
let workspaceLongPressTimer = null;
let state = loadWorkspaceState();
if (absorbBulkClearConflicts()) saveWorkspaceState();
const detachedProject = detachedProjectFromSession();
if (detachedProjectWindow && detachedProject) initializeDetachedProjectState(detachedProject);
const searchTimers = new Map();
const readerSearchTimers = new Map();
let syncedContent = null;
let syncLoadPromise = null;
let organizationWorkspace = null;
let organizationLoadPromise = null;
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
let appleWebConfigPromise = null;
let appleIDScriptPromise = null;
let workboardModulePromise = null;
let workboardStylesPromise = null;
const workboardMounts = new Map();
let notebookModulePromise = null;
let notebookStylesPromise = null;
const notebookMounts = new Map();
const notebookCardMenuOpenByProject = new Map();
const reportDraftMounts = new Map();
let researchConversationList = [];
let activeResearchConversation = null;
let researchUsage = null;
let researchQuestionDraft = "";
let activeEvidenceDiscovery = null;
let pendingResearchSelection = null;
let researchSelectionMenuInteracting = false;
let researchSelectionMenuPinned = false;
let activeWebWarningClose = null;
let activeWorkspaceIssueAction = null;

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
    const legacySaved = detachedState
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
        if (sharedState[key] !== undefined) legacySaved[key] = sharedState[key];
      });
    }
    let saved = legacySaved;
    if (!detachedProjectWindow) {
      const storedRegistry = JSON.parse(localStorage.getItem(workspaceRegistryKey) || "null");
      const requestedWorkspaceID = sessionStorage.getItem(activeWorkspaceSessionKey) || storedRegistry?.activeWorkspaceID || "";
      workspaceRegistry = normalizeWorkspaceRegistry(storedRegistry, { activeWorkspaceID: requestedWorkspaceID });
      activeWorkspaceID = workspaceRegistry.activeWorkspaceID;
      let storedLayout = null;
      try {
        storedLayout = JSON.parse(localStorage.getItem(`${workspaceStateKeyPrefix}${activeWorkspaceID}`) || "null");
      } catch {
        storedLayout = null;
      }
      if (!storedRegistry) {
        storedLayout = workspaceLayoutHasVisiblePanes(legacySaved)
          ? captureWorkspaceLayout(legacySaved)
          : emptyWorkspaceLayout();
        localStorage.setItem(workspaceRegistryKey, JSON.stringify(workspaceRegistry));
        localStorage.setItem(`${workspaceStateKeyPrefix}${activeWorkspaceID}`, JSON.stringify(storedLayout));
      }
      const activeLayout = normalizeWorkspaceLayout(storedLayout || emptyWorkspaceLayout());
      saved = { ...sharedState, ...activeLayout };
      sharedWorkspaceStateKeys.forEach((key) => {
        if (sharedState[key] !== undefined) saved[key] = sharedState[key];
      });
      sessionStorage.setItem(activeWorkspaceSessionKey, activeWorkspaceID);
    }
    const utilityInstances = normalizeUtilityInstances(saved);
    const projectDetails = (Array.isArray(saved.projectDetails)
      ? saved.projectDetails.filter((detail) => detail && typeof detail === "object")
      : saved.projectDetail && typeof saved.projectDetail === "object" ? [saved.projectDetail] : [])
      .slice(0, 1);
    const activeProjectDetail = projectDetails[0] || null;
    const savedWorkboards = normalizeProjectIdentities(saved.workboards, saved.workboard);
    const savedNotebooks = normalizeProjectIdentities(saved.notebooks);
    const savedReportDrafts = normalizeProjectIdentities(saved.reportDrafts);
    const savedReaders = Array.isArray(saved.readers)
      ? saved.readers.filter((reader) => reader && typeof reader === "object" && !reader.comparisonManaged)
      : [];
    return {
      readers: savedReaders,
      searchQuery: saved.searchQuery || "",
      searchCodeFilters: normalizeSearchCodeFilters(saved.searchCodeFilters ?? saved.searchCodeFilter),
      recentSearches: normalizeSearchHistory(saved.recentSearches, recentSearchLimit),
      recentSearchHistory: normalizeRecentSearchHistory(saved.recentSearchHistory, recentSearchLimit),
      recentActivityUpdatedAt: saved.recentActivityUpdatedAt || null,
      pinnedSearches: normalizeSearchHistory(saved.pinnedSearches),
      recentlyViewedSections: Array.isArray(saved.recentlyViewedSections)
        ? saved.recentlyViewedSections
          .filter((item) => item && Number(item.sectionID) > 0)
          .slice(0, recentViewLimit)
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
      sectionDetails: saved.sectionDetails && typeof saved.sectionDetails === "object" ? saved.sectionDetails : {},
      sectionDetailAnchors: saved.sectionDetailAnchors && typeof saved.sectionDetailAnchors === "object" ? saved.sectionDetailAnchors : {},
      searchLinkedReaders: saved.searchLinkedReaders && typeof saved.searchLinkedReaders === "object" ? saved.searchLinkedReaders : {},
      projectDetail: activeProjectDetail,
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
      savedTextSize: clampNumber(saved.savedTextSize, 10, 18, 10),
      researchConversationID: typeof saved.researchConversationID === "string" ? saved.researchConversationID : "",
      researchEvidenceSplitRatios: saved.researchEvidenceSplitRatios && typeof saved.researchEvidenceSplitRatios === "object"
        ? Object.fromEntries(
            Object.entries(saved.researchEvidenceSplitRatios)
              .filter(([conversationID]) => typeof conversationID === "string" && conversationID)
              .map(([conversationID, ratio]) => [conversationID, normalizeResearchEvidenceSplitRatio(ratio)])
          )
        : {},
      workboards: activeProjectDetail && savedWorkboards.some((item) => projectDetailMatches(activeProjectDetail, item))
        ? [projectIdentity(activeProjectDetail)]
        : [],
      notebooks: activeProjectDetail && savedNotebooks.some((item) => projectDetailMatches(activeProjectDetail, item))
        ? [projectIdentity(activeProjectDetail)]
        : [],
      reportDrafts: activeProjectDetail && savedReportDrafts.some((item) => projectDetailMatches(activeProjectDetail, item))
        ? [projectIdentity(activeProjectDetail)]
        : [],
      detachedWorkboards: normalizeProjectIdentities(saved.detachedWorkboards),
      trackScrollLeft: Number.isFinite(Number(saved.trackScrollLeft)) ? Math.max(0, Number(saved.trackScrollLeft)) : 0
    };
  } catch {
    if (!detachedProjectWindow) {
      workspaceRegistry = normalizeWorkspaceRegistry(null);
      activeWorkspaceID = workspaceRegistry.activeWorkspaceID;
      try {
        localStorage.setItem(workspaceRegistryKey, JSON.stringify(workspaceRegistry));
        localStorage.setItem(`${workspaceStateKeyPrefix}${activeWorkspaceID}`, JSON.stringify(emptyWorkspaceLayout()));
        sessionStorage.setItem(activeWorkspaceSessionKey, activeWorkspaceID);
      } catch {
        // The in-memory blank workspace remains usable if storage is unavailable.
      }
    }
    return {
      readers: [],
      searchQuery: "",
      searchCodeFilters: [],
      recentSearches: [],
      recentSearchHistory: [],
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
      savedTextSize: 10,
      researchConversationID: "",
      researchEvidenceSplitRatios: {},
      workboards: [],
      notebooks: [],
      reportDrafts: [],
      detachedWorkboards: [],
      trackScrollLeft: 0
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
    instance.historySplitRatio = normalizeSearchHistorySplitRatio(overrides.historySplitRatio);
  } else if (key === "saved") {
    instance.codeFilters = normalizeSearchCodeFilters(overrides.codeFilters);
    instance.tagFilter = typeof overrides.tagFilter === "string" ? overrides.tagFilter.trim() : "";
    instance.sortMode = normalizeSavedSortMode(overrides.sortMode);
    instance.projectsMenuOpen = Boolean(overrides.projectsMenuOpen);
    instance.projectsArchiveMode = Boolean(overrides.projectsArchiveMode);
    instance.codeFilterMenuOpen = Boolean(overrides.codeFilterMenuOpen);
    instance.tagsMenuOpen = Boolean(overrides.tagsMenuOpen);
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
      historySplitRatio: pane?.historySplitRatio,
      tagFilter: pane?.tagFilter,
      sortMode: pane?.sortMode,
      projectsMenuOpen: pane?.projectsMenuOpen,
      projectsArchiveMode: pane?.projectsArchiveMode,
      codeFilterMenuOpen: pane?.codeFilterMenuOpen,
      tagsMenuOpen: pane?.tagsMenuOpen
    }))
    .filter((pane) => repeatableUtilityKeys.has(pane.key));

  if (source.length === 0) {
    repeatableUtilityKeys.forEach((key) => {
      if (saved.utilities?.[key]) instances.push(newUtilityInstance(key));
    });
  }

  return instances;
}

function workspaceSnapshotKey(workspaceID) {
  return `${workspaceStateKeyPrefix}${workspaceID}`;
}

function activeWorkspaceRecord() {
  return workspaceRegistry?.workspaces?.find((workspace) => workspace.id === activeWorkspaceID) || null;
}

function persistWorkspaceRegistry() {
  if (detachedProjectWindow || !workspaceRegistry) return;
  workspaceRegistry = normalizeWorkspaceRegistry(workspaceRegistry, { activeWorkspaceID });
  activeWorkspaceID = workspaceRegistry.activeWorkspaceID;
  localStorage.setItem(workspaceRegistryKey, JSON.stringify(workspaceRegistry));
  sessionStorage.setItem(activeWorkspaceSessionKey, activeWorkspaceID);
}

function loadWorkspaceSnapshot(workspaceID) {
  try {
    return normalizeWorkspaceLayout(
      JSON.parse(localStorage.getItem(workspaceSnapshotKey(workspaceID)) || "null") || emptyWorkspaceLayout()
    );
  } catch {
    return emptyWorkspaceLayout();
  }
}

function saveWorkspaceState() {
  if (!detachedProjectWindow) {
    const layout = captureWorkspaceLayout(state, {
      trackScrollLeft: track?.scrollLeft ?? state.trackScrollLeft ?? 0
    });
    state.trackScrollLeft = layout.trackScrollLeft;
    localStorage.setItem(workspaceSnapshotKey(activeWorkspaceID), JSON.stringify(layout));
    if (workspaceRegistry) {
      const now = new Date().toISOString();
      workspaceRegistry = {
        ...workspaceRegistry,
        activeWorkspaceID,
        workspaces: workspaceRegistry.workspaces.map((workspace) => workspace.id === activeWorkspaceID
          ? { ...workspace, updatedAt: now }
          : workspace)
      };
      persistWorkspaceRegistry();
    }
    const globalState = Object.fromEntries(globalWorkspaceStateKeys.map((key) => [key, state[key]]));
    localStorage.setItem(baseWorkspaceKey, JSON.stringify(globalState));
    sessionStorage.removeItem(tabWorkspaceKey);
    updateConnectionStatus();
    return;
  }

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
  localStorage.setItem(workspaceKey, JSON.stringify(persistableWorkspaceState));
  updateConnectionStatus();
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

let workspaceStateSaveAfterPaintScheduled = false;

function scheduleWorkspaceStateSaveAfterPaint() {
  if (workspaceStateSaveAfterPaintScheduled) return;
  workspaceStateSaveAfterPaintScheduled = true;
  requestAnimationFrame(() => {
    setTimeout(() => {
      workspaceStateSaveAfterPaintScheduled = false;
      saveWorkspaceState();
    }, 0);
  });
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

function clearWorkspaceTransientRuntime() {
  searchTimers.forEach((timer) => clearTimeout(timer));
  readerSearchTimers.forEach((timer) => clearTimeout(timer));
  searchTimers.clear();
  readerSearchTimers.clear();
  activeResearchConversation = null;
  researchQuestionDraft = "";
  activeEvidenceDiscovery = null;
  pendingResearchSelection = null;
  researchSelectionMenuInteracting = false;
  researchSelectionMenuPinned = false;
  closeActiveCustomSelect();
}

async function confirmWorkspaceTransition() {
  for (const project of openProjectDetails()) {
    if (projectHasOpenNotebook(project) && !(await confirmNotebookDiscard(project))) return false;
    if (projectHasOpenReportDraft(project) && !(await confirmReportDraftDiscard(project))) return false;
  }
  return true;
}

function workspaceTransitionPaneLabel(paneID) {
  if (paneID.startsWith("reader:")) return "Reader";
  if (paneID.startsWith("utility:search:")) return "Search";
  if (paneID.startsWith("utility:saved:")) return "Saved";
  if (paneID === "utility:archive") return "Saved archive";
  if (paneID === "utility:analysis") return "Research";
  if (paneID === "utility:settings") return "Settings";
  if (paneID.startsWith("research:conversation:")) return "Research conversation";
  if (paneID.startsWith("section:detail:")) return "Code section";
  if (paneID.startsWith("project:notebook:")) return "Notebook";
  if (paneID.startsWith("project:report-draft:")) return "Report draft";
  if (paneID.startsWith("project:workboard:")) return "Workboard";
  if (paneID.startsWith("project:detail:")) return "Project";
  return "Workspace";
}

function renderWorkspaceTransitionState(workspaceName = "workspace") {
  renderWorkspaceTabs();
  closeDeletedProjectDetails();
  const paneIDs = activePaneIDs();
  normalizePaneWeights(paneIDs);
  setUtilityButtonStates();
  track.setAttribute("aria-busy", "true");
  const panes = paneIDs.map((paneID) => {
    const panel = document.createElement("article");
    const label = workspaceTransitionPaneLabel(paneID);
    panel.className = "workspace-panel workspace-switch-placeholder";
    panel.dataset.paneId = paneID;
    panel.setAttribute("aria-label", `Opening ${label}`);
    const header = document.createElement("div");
    header.className = "workspace-switch-placeholder-header";
    header.textContent = label;
    const status = document.createElement("div");
    status.className = "workspace-switch-placeholder-status";
    status.textContent = `Opening ${workspaceName}...`;
    panel.append(header, status);
    applyPaneWeight(panel, paneID);
    return panel;
  });
  appendPaneSequence(panes);
}

function waitForWorkspaceTransitionPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function applyStoredWorkspaceLayout(layout) {
  applyWorkspaceLayout(state, layout);
  state.utilityInstances = normalizeUtilityInstances(state);
  setOpenProjectDetails(state.projectDetails);
  state.workboards = normalizeProjectIdentities(state.workboards);
  state.notebooks = normalizeProjectIdentities(state.notebooks);
  state.reportDrafts = normalizeProjectIdentities(state.reportDrafts);
  clearWorkspaceTransientRuntime();
}

async function switchWorkspace(workspaceID, options = {}) {
  const target = workspaceRegistry?.workspaces?.find((workspace) => workspace.id === workspaceID);
  if (!target) return false;
  if (workspaceID === activeWorkspaceID) {
    renderWorkspaceTabs();
    if (options.focus !== false) focusActiveWorkspaceTab();
    return true;
  }
  if (!(await confirmWorkspaceTransition())) {
    renderWorkspaceTabs();
    return false;
  }
  saveWorkspaceState();
  activeWorkspaceID = workspaceID;
  workspaceRegistry = { ...workspaceRegistry, activeWorkspaceID };
  applyStoredWorkspaceLayout(loadWorkspaceSnapshot(workspaceID));
  persistWorkspaceRegistry();
  renderWorkspaceTransitionState(target.name);
  if (options.focus !== false) focusActiveWorkspaceTab();
  await waitForWorkspaceTransitionPaint();
  suppressReaderScrollRestore = true;
  try {
    await renderWorkspace();
  } finally {
    suppressReaderScrollRestore = false;
    track.removeAttribute("aria-busy");
  }
  const scrollLeft = Number(state.trackScrollLeft) || 0;
  track.scrollLeft = Math.min(scrollLeft, Math.max(0, track.scrollWidth - track.clientWidth));
  return true;
}

async function createNewWorkspace() {
  if (!(await confirmWorkspaceTransition())) return;
  saveWorkspaceState();
  const creation = createWorkspace(workspaceRegistry);
  workspaceRegistry = creation.registry;
  activeWorkspaceID = creation.workspace.id;
  localStorage.setItem(workspaceSnapshotKey(activeWorkspaceID), JSON.stringify(creation.layout));
  applyStoredWorkspaceLayout(creation.layout);
  persistWorkspaceRegistry();
  suppressReaderScrollRestore = true;
  try {
    await renderWorkspace();
  } finally {
    suppressReaderScrollRestore = false;
  }
  beginWorkspaceRename(activeWorkspaceID);
}

function commitWorkspaceRename(workspaceID, name) {
  workspaceRegistry = renameWorkspace(workspaceRegistry, workspaceID, name);
  persistWorkspaceRegistry();
  renderWorkspaceTabs();
  focusActiveWorkspaceTab();
}

function beginWorkspaceRename(workspaceID) {
  closeWorkspaceContextMenu();
  const tab = workspaceTabs?.querySelector(`[data-workspace-id="${CSS.escape(workspaceID)}"]`);
  const workspace = workspaceRegistry?.workspaces?.find((item) => item.id === workspaceID);
  if (!tab || !workspace) return;
  const input = document.createElement("input");
  input.className = "workspace-name-input";
  input.value = workspace.name;
  input.maxLength = 40;
  input.setAttribute("aria-label", `Rename ${workspace.name}`);
  tab.replaceWith(input);
  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    if (commit) commitWorkspaceRename(workspaceID, input.value);
    else renderWorkspaceTabs();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true), { once: true });
  input.focus();
  input.select();
}

async function duplicateNamedWorkspace(workspaceID) {
  if (!(await confirmWorkspaceTransition())) return;
  if (workspaceID === activeWorkspaceID) saveWorkspaceState();
  const duplication = duplicateWorkspace(
    workspaceRegistry,
    workspaceID,
    loadWorkspaceSnapshot(workspaceID)
  );
  if (!duplication) return;
  workspaceRegistry = duplication.registry;
  activeWorkspaceID = duplication.workspace.id;
  localStorage.setItem(workspaceSnapshotKey(activeWorkspaceID), JSON.stringify(duplication.layout));
  applyStoredWorkspaceLayout(duplication.layout);
  persistWorkspaceRegistry();
  suppressReaderScrollRestore = true;
  try {
    await renderWorkspace();
  } finally {
    suppressReaderScrollRestore = false;
  }
  beginWorkspaceRename(activeWorkspaceID);
}

async function removeNamedWorkspace(workspaceID) {
  const workspace = workspaceRegistry?.workspaces?.find((item) => item.id === workspaceID);
  if (!workspace) return;
  const confirmed = await confirmWebWarning(
    `Delete “${workspace.name}”?`,
    "This removes its column arrangement only. Projects, notes, saved evidence, and Research will not be deleted.",
    { confirmLabel: "Delete Workspace" }
  );
  if (!confirmed) return;
  const deletingActiveWorkspace = workspaceID === activeWorkspaceID;
  if (deletingActiveWorkspace && !(await confirmWorkspaceTransition())) return;
  if (deletingActiveWorkspace) saveWorkspaceState();
  const removal = deleteWorkspace(workspaceRegistry, workspaceID);
  workspaceRegistry = removal.registry;
  if (removal.deletedWorkspaceID) {
    localStorage.removeItem(workspaceSnapshotKey(removal.deletedWorkspaceID));
  }
  if (!deletingActiveWorkspace) {
    persistWorkspaceRegistry();
    renderWorkspaceTabs();
    return;
  }
  activeWorkspaceID = workspaceRegistry.activeWorkspaceID;
  const nextLayout = removal.replacementLayout || loadWorkspaceSnapshot(activeWorkspaceID);
  if (removal.replacementLayout) {
    localStorage.setItem(workspaceSnapshotKey(activeWorkspaceID), JSON.stringify(nextLayout));
  }
  applyStoredWorkspaceLayout(nextLayout);
  persistWorkspaceRegistry();
  suppressReaderScrollRestore = true;
  try {
    await renderWorkspace();
  } finally {
    suppressReaderScrollRestore = false;
  }
  focusActiveWorkspaceTab();
}

function moveNamedWorkspace(workspaceID, direction) {
  const workspaces = workspaceRegistry?.workspaces || [];
  const index = workspaces.findIndex((workspace) => workspace.id === workspaceID);
  const target = workspaces[index + direction];
  if (index === -1 || !target) return;
  workspaceRegistry = reorderWorkspace(
    workspaceRegistry,
    workspaceID,
    target.id,
    direction < 0 ? "before" : "after"
  );
  persistWorkspaceRegistry();
  renderWorkspaceTabs();
  focusActiveWorkspaceTab();
}

function closeWorkspaceContextMenu() {
  workspaceContextMenu?.remove();
  workspaceContextMenu = null;
  workspaceActionsButton?.setAttribute("aria-expanded", "false");
}

function openWorkspaceContextMenu(workspaceID, anchor) {
  closeWorkspaceContextMenu();
  const workspace = workspaceRegistry?.workspaces?.find((item) => item.id === workspaceID);
  if (!workspace) return;
  const workspaces = workspaceRegistry.workspaces;
  const index = workspaces.findIndex((item) => item.id === workspaceID);
  const menu = document.createElement("div");
  menu.className = "workspace-context-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", `${workspace.name} actions`);
  const actions = [
    { label: "Rename", run: () => beginWorkspaceRename(workspaceID) },
    { label: "Duplicate", run: () => void duplicateNamedWorkspace(workspaceID) },
    { label: "Move left", disabled: index <= 0, run: () => moveNamedWorkspace(workspaceID, -1) },
    { label: "Move right", disabled: index >= workspaces.length - 1, run: () => moveNamedWorkspace(workspaceID, 1) },
    { label: "Delete", danger: true, run: () => void removeNamedWorkspace(workspaceID) }
  ];
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = action.label;
    button.disabled = Boolean(action.disabled);
    button.classList.toggle("is-danger", Boolean(action.danger));
    button.addEventListener("click", () => {
      closeWorkspaceContextMenu();
      action.run();
    });
    menu.append(button);
  });
  document.body.append(menu);
  workspaceContextMenu = menu;
  workspaceActionsButton?.setAttribute("aria-expanded", "true");
  const rect = anchor?.getBoundingClientRect?.() || workspaceActionsButton?.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, (rect?.right || window.innerWidth) - menuRect.width),
    window.innerWidth - menuRect.width - 8
  );
  const top = Math.min((rect?.bottom || 0) + 6, window.innerHeight - menuRect.height - 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  menu.querySelector("button:not(:disabled)")?.focus();
}

function focusActiveWorkspaceTab() {
  requestAnimationFrame(() => {
    const tab = workspaceTabs?.querySelector(`[data-workspace-id="${CSS.escape(activeWorkspaceID)}"]`);
    tab?.scrollIntoView({ inline: "nearest", block: "nearest" });
    tab?.focus({ preventScroll: true });
  });
}

function normalizedToolbarOrder(value) {
  const requested = Array.isArray(value) ? value.map(String) : [];
  const valid = new Set(defaultToolbarButtonIDs);
  const ordered = requested.filter((id, index) => valid.has(id) && requested.indexOf(id) === index);
  defaultToolbarButtonIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  return ordered;
}

function storedToolbarOrder() {
  try {
    return normalizedToolbarOrder(JSON.parse(localStorage.getItem(toolbarOrderKey) || "null"));
  } catch {
    return normalizedToolbarOrder([]);
  }
}

function applyToolbarOrder(order) {
  if (!topbarActions) return;
  normalizedToolbarOrder(order).forEach((id) => {
    const button = document.getElementById(id);
    if (button) topbarActions.append(button);
  });
}

function persistToolbarOrder() {
  if (!topbarActions) return;
  const order = Array.from(topbarActions.querySelectorAll(":scope > .toolbar-button"))
    .map((button) => button.id)
    .filter(Boolean);
  localStorage.setItem(toolbarOrderKey, JSON.stringify(normalizedToolbarOrder(order)));
}

function clearToolbarDropIndicators() {
  topbarActions?.querySelectorAll(".toolbar-button").forEach((button) => {
    button.classList.remove("is-drop-before", "is-drop-after");
  });
}

function reorderToolbarButton(sourceID, targetID, position = "before") {
  if (!topbarActions || sourceID === targetID) return false;
  const source = document.getElementById(sourceID);
  const target = document.getElementById(targetID);
  if (!source?.classList.contains("toolbar-button") || !target?.classList.contains("toolbar-button")) return false;
  target.insertAdjacentElement(position === "after" ? "afterend" : "beforebegin", source);
  persistToolbarOrder();
  return true;
}

function bindToolbarReordering() {
  if (!topbarActions || topbarActions.dataset.reorderBound === "true") return;
  topbarActions.dataset.reorderBound = "true";
  applyToolbarOrder(storedToolbarOrder());
  const buttons = Array.from(topbarActions.querySelectorAll(":scope > .toolbar-button"));
  buttons.forEach((button) => {
    button.draggable = true;
    button.setAttribute("aria-keyshortcuts", "Alt+ArrowLeft Alt+ArrowRight");
    button.title = `${button.title || button.textContent.trim()}. Drag to reorder.`;
    button.addEventListener("dragstart", (event) => {
      draggedToolbarButtonID = button.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-permitext-toolbar", button.id);
      event.dataTransfer.setData("text/plain", button.id);
      button.classList.add("is-dragging");
    });
    button.addEventListener("dragend", () => {
      draggedToolbarButtonID = "";
      button.classList.remove("is-dragging");
      clearToolbarDropIndicators();
    });
    button.addEventListener("dragover", (event) => {
      if (!draggedToolbarButtonID || draggedToolbarButtonID === button.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = button.getBoundingClientRect();
      const position = event.clientX > rect.left + rect.width / 2 ? "after" : "before";
      clearToolbarDropIndicators();
      button.classList.add(position === "after" ? "is-drop-after" : "is-drop-before");
    });
    button.addEventListener("dragleave", () => clearToolbarDropIndicators());
    button.addEventListener("drop", (event) => {
      const sourceID = draggedToolbarButtonID || event.dataTransfer.getData("application/x-permitext-toolbar");
      if (!sourceID || sourceID === button.id) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = button.getBoundingClientRect();
      const position = event.clientX > rect.left + rect.width / 2 ? "after" : "before";
      reorderToolbarButton(sourceID, button.id, position);
      clearToolbarDropIndicators();
      document.getElementById(sourceID)?.focus({ preventScroll: true });
    });
    button.addEventListener("keydown", (event) => {
      if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const orderedButtons = Array.from(topbarActions.querySelectorAll(":scope > .toolbar-button:not([hidden])"));
      const index = orderedButtons.indexOf(button);
      const target = orderedButtons[index + (event.key === "ArrowLeft" ? -1 : 1)];
      if (!target) return;
      event.preventDefault();
      reorderToolbarButton(button.id, target.id, event.key === "ArrowLeft" ? "before" : "after");
      button.focus({ preventScroll: true });
    });
  });
  topbarActions.addEventListener("dragover", (event) => {
    if (!draggedToolbarButtonID || event.target.closest(".toolbar-button")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  topbarActions.addEventListener("drop", (event) => {
    if (!draggedToolbarButtonID || event.target.closest(".toolbar-button")) return;
    event.preventDefault();
    const source = document.getElementById(draggedToolbarButtonID);
    if (source) topbarActions.append(source);
    persistToolbarOrder();
    clearToolbarDropIndicators();
  });
}

function renderWorkspaceTabs() {
  const container = workspaceTabs?.closest(".topbar-workspaces");
  if (!workspaceTabs || !container) return;
  container.hidden = detachedProjectWindow;
  if (detachedProjectWindow) return;
  clear(workspaceTabs);
  (workspaceRegistry?.workspaces || []).forEach((workspace) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "workspace-tab";
    tab.dataset.workspaceId = workspace.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(workspace.id === activeWorkspaceID));
    tab.tabIndex = workspace.id === activeWorkspaceID ? 0 : -1;
    tab.title = `${workspace.name}. Double-click to rename; right-click for actions.`;
    const label = document.createElement("span");
    label.textContent = workspace.name;
    tab.append(label);
    tab.draggable = true;
    tab.addEventListener("click", () => void switchWorkspace(workspace.id));
    tab.addEventListener("dblclick", (event) => {
      event.preventDefault();
      beginWorkspaceRename(workspace.id);
    });
    tab.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openWorkspaceContextMenu(workspace.id, tab);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        beginWorkspaceRename(workspace.id);
      } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        openWorkspaceContextMenu(workspace.id, tab);
      } else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        const tabs = Array.from(workspaceTabs.querySelectorAll(".workspace-tab"));
        const currentIndex = tabs.indexOf(tab);
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const next = tabs[(currentIndex + direction + tabs.length) % tabs.length];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }
    });
    tab.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      clearTimeout(workspaceLongPressTimer);
      workspaceLongPressTimer = window.setTimeout(() => openWorkspaceContextMenu(workspace.id, tab), 520);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      tab.addEventListener(eventName, () => clearTimeout(workspaceLongPressTimer));
    });
    tab.addEventListener("dragstart", (event) => {
      draggedWorkspaceID = workspace.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", workspace.id);
      tab.classList.add("is-dragging");
    });
    tab.addEventListener("dragend", () => {
      draggedWorkspaceID = "";
      tab.classList.remove("is-dragging");
    });
    tab.addEventListener("dragover", (event) => {
      if (!draggedWorkspaceID || draggedWorkspaceID === workspace.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tab.addEventListener("drop", (event) => {
      const sourceID = draggedWorkspaceID || event.dataTransfer.getData("text/plain");
      if (!sourceID || sourceID === workspace.id) return;
      event.preventDefault();
      const rect = tab.getBoundingClientRect();
      const position = event.clientX > rect.left + rect.width / 2 ? "after" : "before";
      workspaceRegistry = reorderWorkspace(workspaceRegistry, sourceID, workspace.id, position);
      persistWorkspaceRegistry();
      renderWorkspaceTabs();
      focusActiveWorkspaceTab();
    });
    workspaceTabs.append(tab);
  });
  workspaceActionsButton.disabled = !activeWorkspaceRecord();
}

function updateWorkspaceLayoutControls() {
  const hasColumns = defaultActivePaneIDs().length > 0;
  fitColumnsButton.hidden = !hasColumns;
  collapseReadersButton.hidden = !hasColumns;
  fitColumnsButton.disabled = !hasColumns;
  collapseReadersButton.disabled = !hasColumns;
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
  state.reportDrafts = [];
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

function openReportDrafts() {
  state.reportDrafts = normalizeProjectIdentities(state.reportDrafts);
  return state.reportDrafts;
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

function projectHasOpenReportDraft(project) {
  return openReportDrafts().some((item) => projectDetailMatches(project, item));
}

function projectHasDetachedWorkboard(project) {
  return detachedWorkboards().some((item) => projectDetailMatches(project, item));
}

function loadWorkboardModule() {
  if (!workboardModulePromise) {
    workboardModulePromise = Promise.all([
      loadWorkboardStyles(),
      import(`/web/workboard-assets/workboard.js?v=${workboardClientVersion}`)
    ])
      .then(([, module]) => module)
      .catch((error) => {
        workboardModulePromise = null;
        throw error;
      });
  }
  return workboardModulePromise;
}

function loadWorkboardStyles() {
  if (workboardStylesPromise) return workboardStylesPromise;
  workboardStylesPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('link[data-permitext-workboard-styles="true"]');
    if (existing?.sheet) {
      resolve();
      return;
    }
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/web/workboard-assets/workboard.css?v=20260801-workboard-control-align-v68";
    link.dataset.permitextWorkboardStyles = "true";
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => {
      workboardStylesPromise = null;
      reject(new Error("Could not load Workboard styles."));
    }, { once: true });
    if (!existing) document.head.append(link);
  });
  return workboardStylesPromise;
}

function loadNotebookModule() {
  if (!notebookModulePromise) {
    notebookModulePromise = Promise.all([
      loadNotebookStyles(),
      import(`/web/notebook-assets/notebook.js?v=${notebookClientVersion}`)
    ])
      .then(([, module]) => module)
      .catch((error) => {
        notebookModulePromise = null;
        throw error;
      });
  }
  return notebookModulePromise;
}

function loadNotebookStyles() {
  if (notebookStylesPromise) return notebookStylesPromise;
  notebookStylesPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('link[data-permitext-notebook-styles="true"]');
    if (existing?.sheet) {
      resolve();
      return;
    }
    const link = existing || document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/web/notebook-assets/notebook.css?v=${notebookClientVersion}`;
    link.dataset.permitextNotebookStyles = "true";
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => {
      notebookStylesPromise = null;
      reject(new Error("Could not load Notebook styles."));
    }, { once: true });
    if (!existing) document.head.append(link);
  });
  return notebookStylesPromise;
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
    const activated = await activateProjectStudio(identity);
    if (!activated) return false;
  }
  state.workboards = [identity];
  state.detachedWorkboards = detachedWorkboards().filter((item) => !projectDetailMatches(identity, item));
  const workboardID = paneIDForProjectWorkboard(identity);
  state.paneWeights[workboardID] ||= defaultWorkboardPaneWidth;
  placeProjectDetailAfterProjects(identity);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(identity)] });
  scrollPaneIntoView(workboardID);
  return true;
}

async function closeProjectNotebook(project) {
  if (!(await confirmNotebookDiscard(project))) return false;
  const notebookID = paneIDForProjectNotebook(project);
  state.notebooks = openNotebooks().filter((item) => !projectDetailMatches(project, item));
  delete state.paneWeights[notebookID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== notebookID);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(project)] });
  return true;
}

async function openProjectNotebook(project) {
  const identity = projectIdentity(project);
  if (!openProjectDetails().some((detail) => projectDetailMatches(identity, detail))) {
    const activated = await activateProjectStudio(identity);
    if (!activated) return false;
  }
  state.notebooks = [identity];
  const notebookID = paneIDForProjectNotebook(identity);
  state.paneWeights[notebookID] ||= defaultNotebookPaneWidth;
  placeProjectDetailAfterProjects(identity);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(identity)] });
  scrollPaneIntoView(notebookID);
  return true;
}

async function closeProjectReportDraft(project) {
  if (!(await confirmReportDraftDiscard(project))) return false;
  const reportDraftID = paneIDForProjectReportDraft(project);
  state.reportDrafts = openReportDrafts().filter((item) => !projectDetailMatches(project, item));
  delete state.paneWeights[reportDraftID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== reportDraftID);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(project)] });
  return true;
}

async function openProjectReportDraft(project) {
  const identity = projectIdentity(project);
  if (!openProjectDetails().some((detail) => projectDetailMatches(identity, detail))) {
    const activated = await activateProjectStudio(identity);
    if (!activated) return false;
  }
  state.reportDrafts = [identity];
  const reportDraftID = paneIDForProjectReportDraft(identity);
  state.paneWeights[reportDraftID] ||= defaultReportDraftPaneWidth;
  placeProjectDetailAfterProjects(identity);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneIDForProjectDetail(identity)] });
  scrollPaneIntoView(reportDraftID);
  return true;
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
    savePreview: (blob, metadata) => saveWorkboardPreview(projectID, blob, metadata),
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

function cleanupInactiveReportDraftMounts(panes) {
  const activeProjectIDs = new Set(panes
    .filter((pane) => pane.classList.contains("report-draft-panel"))
    .map((pane) => pane.dataset.projectId)
    .filter(Boolean));
  reportDraftMounts.forEach((mounted, projectID) => {
    if (activeProjectIDs.has(projectID)) return;
    mounted.dispose?.();
    reportDraftMounts.delete(projectID);
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
  const identity = projectIdentity(project);
  if (!openProjectDetails().some((detail) => projectDetailMatches(identity, detail))) {
    const activated = await activateProjectStudio(identity, { openWorkboard: true });
    if (!activated) return false;
  }
  closeDetachedWorkboardWindow(detachedWindow);
  state.detachedWorkboards = detachedWorkboards().filter((item) => !projectDetailMatches(identity, item));
  state.workboards = [identity];
  placeProjectDetailAfterProjects(identity);
  state.paneWeights[paneIDForProjectDetail(identity)] ||= defaultDetailPaneWidth;
  state.paneWeights[paneIDForProjectWorkboard(identity)] ||= defaultWorkboardPaneWidth;
  localStorage.removeItem("permitext:pendingWorkboardReattach");
  saveWorkspaceState();
  await transitionWorkspace("utility", {
    refreshPaneIDs: projectOverviewRefreshPaneIDs(paneIDForProjectDetail(identity))
  });
  scrollPaneIntoView(paneIDForProjectWorkboard(identity));
  return true;
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

function normalizeSearchHistorySplitRatio(value) {
  return clampNumber(value, 0.2, 0.8, 0.56);
}

function normalizeResearchEvidenceSplitRatio(value) {
  return clampNumber(value, 0.2, 0.7, 0.36);
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

function normalizeRecentSearchHistory(value, limit = Number.POSITIVE_INFINITY) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  value.forEach((item) => {
    const query = String(item?.query || "").trim();
    const searchedAt = Number(item?.searchedAt);
    const key = query.normalize("NFKC").toLocaleLowerCase("en-US");
    if (!query || !Number.isFinite(searchedAt) || seen.has(key)) return;
    seen.add(key);
    normalized.push({ query, searchedAt });
  });
  return normalized.slice(0, limit);
}

function normalizeSavedSortMode(value) {
  return savedSortModes.has(value) ? value : "codeOrder";
}

function normalizeSavedInstance(instance) {
  if (!instance || typeof instance !== "object") {
    return {
      codeFilters: [],
      tagFilter: "",
      sortMode: "codeOrder",
      projectsMenuOpen: false,
      codeFilterMenuOpen: false,
      tagsMenuOpen: false
    };
  }
  instance.codeFilters = normalizeSearchCodeFilters(instance.codeFilters);
  instance.tagFilter = typeof instance.tagFilter === "string" ? instance.tagFilter.trim() : "";
  instance.sortMode = normalizeSavedSortMode(instance.sortMode);
  instance.projectsMenuOpen = Boolean(instance.projectsMenuOpen);
  instance.codeFilterMenuOpen = Boolean(instance.codeFilterMenuOpen);
  instance.tagsMenuOpen = Boolean(instance.tagsMenuOpen);
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
    codeVersion: syncCodeVersion(overrides.codeVersion || syncCodeVersionForPrefix(codePrefix)),
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
  return `https://permitext.com/open/section/${normalizedID}`;
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

function researchHierarchyLabel(value) {
  const label = String(value || "").replace(/\s+/g, " ").trim();
  if (!label || label !== label.toUpperCase()) return label;
  const sentenceCase = label.toLocaleLowerCase("en-US");
  return sentenceCase.charAt(0).toLocaleUpperCase("en-US") + sentenceCase.slice(1);
}

function researchSourceCitation(source) {
  const edition = [
    String(source?.codeEdition || ""),
    String(source?.codeVersion || "")
  ].find((value) => /\b(?:19|20)\d{2}\b/.test(value)) || "";
  const year = edition.match(/\b((?:19|20)\d{2})\b/)?.[1] || "2022";
  const codePrefix = String(source?.codePrefix || "BC").trim().toUpperCase();
  const chapterNumber = String(source?.chapterNumber || "").trim();
  const chapterTitle = String(source?.chapterTitle || "")
    .replace(/^(?:Chapter|Appendix)\s+\S+\s*:?\s*/i, "")
    .replace(/[.\s]+$/, "")
    .trim();
  const sectionNumber = String(source?.sectionNumber || "").trim();
  const sectionTitle = String(source?.title || "")
    .replace(
      sectionNumber
        ? new RegExp(`^(?:§\\s*)?${escapeRegExp(sectionNumber)}(?:\\b|[\\s.:;-]+)`, "i")
        : /$^/,
      ""
    )
    .replace(/[.\s]+$/, "")
    .trim();
  const groupNumber = String(source?.sectionGroupLabel || "")
    .match(/\b(?:SECTION\s+)?(?:[A-Z]+\s+)?([A-Z]?\d+[A-Z]?)\b/i)?.[1] ||
    sectionNumber.match(/^([A-Z]?\d{3}[A-Z]?)/i)?.[1] ||
    "";
  const groupTitle = String(source?.sectionGroupTitle || "")
    .replace(/[.\s]+$/, "")
    .trim();
  const chapter = chapterNumber
    ? `C.${chapterNumber}${chapterTitle ? `: ${researchHierarchyLabel(chapterTitle)}` : ""}`
    : "";
  const sectionGroup = groupNumber
    ? `${codePrefix} ${groupNumber}${groupTitle ? `: ${researchHierarchyLabel(groupTitle)}` : ""}`
    : "";
  const subsection = [sectionNumber, sectionTitle].filter(Boolean).join(" ");
  return [
    `NYC ${year}`,
    codePrefix,
    chapter,
    [sectionGroup, subsection].filter(Boolean).join(", ")
  ].filter(Boolean).join(" / ");
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

function paneIDForProjectReportDraft(detail = null) {
  return `project:report-draft:${encodeURIComponent(projectDetailKey(detail))}`;
}

function isProjectReportDraftPaneID(paneID) {
  return String(paneID || "").startsWith("project:report-draft:");
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
  state.projectDetails = Array.from(uniqueDetails.values()).slice(0, 1);
  state.projectDetail = state.projectDetails[0] || null;
}

async function confirmNotebookDiscard(project) {
  const projectID = projectDetailKey(project);
  const mounted = notebookMounts.get(projectID);
  return mounted?.confirmDiscardIfNeeded
    ? mounted.confirmDiscardIfNeeded()
    : true;
}

async function confirmReportDraftDiscard(project) {
  const projectID = projectDetailKey(project);
  const mounted = reportDraftMounts.get(projectID);
  return mounted?.confirmDiscardIfNeeded
    ? mounted.confirmDiscardIfNeeded()
    : true;
}

function clearProjectSpecificReaders(project) {
  const projectKey = projectDetailKey(project);
  state.readers = (state.readers || []).filter((reader) =>
    reader.projectSavedSourceKey !== projectKey
  );
}

function clearProjectSpecificResearch(project) {
  if (activeResearchConversation?.primaryProjectID !== projectDetailKey(project)) return;
  const conversationPaneID = paneIDForResearchConversation();
  state.researchConversationID = "";
  activeResearchConversation = null;
  if (conversationPaneID) {
    delete state.paneWeights[conversationPaneID];
    state.paneOrder = (state.paneOrder || []).filter((id) => id !== conversationPaneID);
  }
}

async function activateProjectStudio(project, options = {}) {
  const identity = projectIdentity(project);
  const current = openProjectDetails()[0] || null;
  if (current && projectDetailMatches(current, identity)) {
    scrollPaneIntoView(paneIDForProjectDetail(current));
    return true;
  }
  if (current && !(await confirmNotebookDiscard(current))) return false;
  if (current && !(await confirmReportDraftDiscard(current))) return false;

  const keepNotebookOpen = current ? projectHasOpenNotebook(current) : Boolean(options.openNotebook);
  const keepWorkboardOpen = current ? projectHasOpenWorkboard(current) : Boolean(options.openWorkboard);
  const keepReportDraftOpen = current
    ? projectHasOpenReportDraft(current)
    : Boolean(options.openReportDraft);
  const currentDetailID = current ? paneIDForProjectDetail(current) : "";
  const currentNotebookID = current ? paneIDForProjectNotebook(current) : "";
  const currentWorkboardID = current ? paneIDForProjectWorkboard(current) : "";
  const currentReportDraftID = current ? paneIDForProjectReportDraft(current) : "";
  const detailWidth = currentDetailID ? state.paneWeights[currentDetailID] : null;
  const notebookWidth = currentNotebookID ? state.paneWeights[currentNotebookID] : null;
  const workboardWidth = currentWorkboardID ? state.paneWeights[currentWorkboardID] : null;
  const reportDraftWidth = currentReportDraftID ? state.paneWeights[currentReportDraftID] : null;

  if (current) {
    clearProjectSpecificReaders(current);
    clearProjectSpecificResearch(current);
    [currentDetailID, currentNotebookID, currentWorkboardID, currentReportDraftID].forEach((paneID) => {
      delete state.paneWeights[paneID];
    });
    state.paneOrder = (state.paneOrder || []).filter((paneID) =>
      paneID !== currentDetailID &&
      paneID !== currentNotebookID &&
      paneID !== currentWorkboardID &&
      paneID !== currentReportDraftID
    );
  }

  setOpenProjectDetails([identity]);
  state.notebooks = keepNotebookOpen ? [identity] : [];
  state.workboards = keepWorkboardOpen ? [identity] : [];
  state.reportDrafts = keepReportDraftOpen ? [identity] : [];
  const detailID = paneIDForProjectDetail(identity);
  const notebookID = paneIDForProjectNotebook(identity);
  const workboardID = paneIDForProjectWorkboard(identity);
  const reportDraftID = paneIDForProjectReportDraft(identity);
  state.paneWeights[detailID] = Number(detailWidth) > 40 ? detailWidth : defaultDetailPaneWidth;
  if (keepNotebookOpen) {
    state.paneWeights[notebookID] = Number(notebookWidth) > 40 ? notebookWidth : defaultNotebookPaneWidth;
  }
  if (keepWorkboardOpen) {
    state.paneWeights[workboardID] = Number(workboardWidth) > 40 ? workboardWidth : defaultWorkboardPaneWidth;
  }
  if (keepReportDraftOpen) {
    state.paneWeights[reportDraftID] = Number(reportDraftWidth) > 40
      ? reportDraftWidth
      : defaultReportDraftPaneWidth;
  }
  placeProjectDetailAfterProjects(identity, options.sourcePaneID);
  restoreProjectsStackOrder(options.sourcePaneID);
  saveWorkspaceState();
  mountProjectOpeningPane(identity, {
    sourcePaneID: options.sourcePaneID,
    replacingPaneID: currentDetailID
  });
  await transitionWorkspace("utility", { refreshPaneIDs: [detailID] });
  scrollPaneIntoView(detailID);
  return true;
}

function defaultPaneWidthForID(paneID) {
  if (!paneID) return defaultReaderPaneWidth;
  if (isProjectWorkboardPaneID(paneID)) return defaultWorkboardPaneWidth;
  if (isProjectNotebookPaneID(paneID)) return defaultNotebookPaneWidth;
  if (isProjectReportDraftPaneID(paneID)) return defaultReportDraftPaneWidth;
  if (isProjectDetailPaneID(paneID) || paneID.startsWith("section:detail:")) return defaultDetailPaneWidth;
  if (paneID === "utility:saved" || paneID.startsWith("utility:saved:")) return defaultSavedPaneWidth;
  if (paneID === "utility:settings" || paneID === "utility:analysis" || paneID.startsWith("research:conversation:")) return defaultSettingsPaneWidth;
  if (paneID.startsWith("utility:")) return defaultUtilityPaneWidth;
  if (paneID.startsWith("reader:")) {
    const readerID = paneID.replace("reader:", "");
    const reader = (state.readers || []).find((candidate) => candidate.id === readerID);
    return reader?.savedSourcePaneID ? defaultSourceLinkedReaderPaneWidth : defaultReaderPaneWidth;
  }
  return defaultNonReaderPaneWidth;
}

function migrateLegacyPaneWidth(paneID, value) {
  if ((paneID === "utility:saved" || paneID.startsWith("utility:saved:")) && value === defaultUtilityPaneWidth) {
    return defaultSavedPaneWidth;
  }
  return value;
}

function isFixedWidthPaneID(paneID) {
  return paneID?.startsWith("utility:") ||
    isProjectDetailPaneID(paneID) ||
    isProjectWorkboardPaneID(paneID) ||
    isProjectNotebookPaneID(paneID) ||
    isProjectReportDraftPaneID(paneID) ||
    paneID?.startsWith("section:detail:");
}

function isFlexibleReaderPaneID(paneID) {
  if (!paneID?.startsWith("reader:")) return false;
  if (isProAccount()) return true;
  return (state.readers || []).length === 2;
}

function isFixedWidthReaderPaneID(paneID) {
  if (!paneID?.startsWith("reader:")) return false;
  if (isFlexibleReaderPaneID(paneID)) return false;
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
  const codePrefix = detail.codePrefix || "BC";
  return {
    codePrefix,
    codeVersion: syncCodeVersion(detail.codeVersion || syncCodeVersionForPrefix(codePrefix)),
    chapterID: detail.chapterID || "",
    sectionID: detail.sectionID,
    sectionNumber: detail.sectionNumber || "",
    title: detail.title || "Section",
    shouldSmoothScrollToSection: true,
    recentlyViewedSourceSearchID: "",
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
    if (projectHasOpenReportDraft(detail)) ids.push(paneIDForProjectReportDraft(detail));
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

function projectWorkspacePaneIDs(detail) {
  return [
    paneIDForProjectDetail(detail),
    ...(projectHasOpenNotebook(detail) ? [paneIDForProjectNotebook(detail)] : []),
    ...(projectHasOpenReportDraft(detail) ? [paneIDForProjectReportDraft(detail)] : []),
    ...(projectHasOpenWorkboard(detail) ? [paneIDForProjectWorkboard(detail)] : [])
  ];
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
    !isProjectReportDraftPaneID(id) &&
    !isProjectWorkboardPaneID(id)
  );
  if (openProjectDetails().length) {
    const detailIDs = openProjectDetails().flatMap(projectWorkspacePaneIDs);
    const firstDetailIndex = ordered.findIndex((id) => detailIDs.includes(id));
    const orderedAnchorID = firstDetailIndex > 0 ? ordered[firstDetailIndex - 1] : "";
    const projectAnchorID = paired.includes(orderedAnchorID)
      ? orderedAnchorID
      : primarySavedPaneID();
    const projectAnchorIndex = paired.indexOf(projectAnchorID);
    if (projectAnchorIndex === -1) {
      paired.push(...detailIDs);
    } else {
      paired.splice(projectAnchorIndex + 1, 0, ...detailIDs);
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
  if (!isProAccount() && state.readers.length >= 2) {
    const reader = state.readers[1];
    Object.assign(reader, readerFieldsForSectionDetail(detail, overrides));
    searchLinkedReadersBySearch()[searchID] = reader.id;
    placeLinkedReaderAfterSectionDetail(searchID, reader.id);
    return reader;
  }
  const reader = newReaderState(readerFieldsForSectionDetail(detail, overrides));
  state.readers.push(reader);
  searchLinkedReadersBySearch()[searchID] = reader.id;
  placeLinkedReaderAfterSectionDetail(searchID, reader.id);
  return reader;
}

function closeLinkedReaderForSearch(searchID) {
  state.searchLinkedReaders = state.searchLinkedReaders && typeof state.searchLinkedReaders === "object"
    ? state.searchLinkedReaders
    : {};
  const readerID = state.searchLinkedReaders[searchID];
  if (!readerID) return;
  const readerPaneID = `reader:${readerID}`;
  delete state.searchLinkedReaders[searchID];
  state.readers = (state.readers || []).filter((reader) => reader.id !== readerID);
  delete state.paneWeights[readerPaneID];
  state.paneOrder = (state.paneOrder || []).filter((paneID) => paneID !== readerPaneID);
}

function closeLinkedReaderForSavedPane(savedPaneID) {
  const linkedReaderIDs = new Set(
    (state.readers || [])
      .filter((reader) => reader.savedSourcePaneID === savedPaneID)
      .map((reader) => reader.id)
  );
  if (!linkedReaderIDs.size) return;
  state.readers = (state.readers || []).filter((reader) => !linkedReaderIDs.has(reader.id));
  Object.entries(searchLinkedReadersBySearch()).forEach(([searchID, readerID]) => {
    if (linkedReaderIDs.has(readerID)) delete state.searchLinkedReaders[searchID];
  });
  linkedReaderIDs.forEach((readerID) => {
    const readerPaneID = `reader:${readerID}`;
    delete state.paneWeights[readerPaneID];
    state.paneOrder = (state.paneOrder || []).filter((paneID) => paneID !== readerPaneID);
  });
}

function searchResultDetail(result) {
  const codePrefix = result.codePrefix || "BC";
  return {
    codePrefix,
    codeVersion: syncCodeVersion(result.codeVersion || syncCodeVersionForPrefix(codePrefix)),
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
  const researchPaneIDs = [
    state.utilities.analysis ? "utility:analysis" : "",
    paneIDForResearchConversation()
  ].filter(Boolean);
  return Array.from(new Set([
    ...savedPaneIDs(),
    ...researchPaneIDs,
    ...additionalPaneIDs.filter(Boolean)
  ]));
}

function refreshOpenProjectPaneTheme(project) {
  const identity = projectIdentity(project);
  const color = identity.color || projectColorOptions[0];
  [
    paneIDForProjectDetail(identity),
    paneIDForProjectNotebook(identity),
    paneIDForProjectReportDraft(identity),
    paneIDForProjectWorkboard(identity)
  ].forEach((paneID) => {
    track
      .querySelectorAll(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`)
      .forEach((panel) => panel.style.setProperty("--project-color", color));
  });
  track
    .querySelectorAll(`.workspace-panel[data-project-id="${CSS.escape(projectDetailKey(identity))}"]`)
    .forEach((panel) => panel.style.setProperty("--project-color", color));
}

function syncSavedArchiveButtonStates() {
  track.querySelectorAll(".saved-projects-archive-button, .projects-archive-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.utilities.archive));
  });
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
    ...(projectHasOpenReportDraft(detail) ? [paneIDForProjectReportDraft(detail)] : []),
    ...(projectHasOpenWorkboard(detail) ? [paneIDForProjectWorkboard(detail)] : [])
  ]);
  const detailIndex = Math.max(...projectStackIDs.map((id) => ordered.indexOf(id)).filter((index) => index !== -1), -1);
  const insertIndex = detailIndex === -1
    ? projectIndex === -1 ? 0 : projectIndex + 1
    : detailIndex + 1;
  ordered.splice(insertIndex, 0, archiveID);
  state.paneOrder = ordered;
}

function restoreProjectsStackOrder(sourcePaneID = "") {
  const detailIDs = openProjectDetails().flatMap((detail) => [
    paneIDForProjectDetail(detail),
    ...(projectHasOpenNotebook(detail) ? [paneIDForProjectNotebook(detail)] : []),
    ...(projectHasOpenReportDraft(detail) ? [paneIDForProjectReportDraft(detail)] : []),
    ...(projectHasOpenWorkboard(detail) ? [paneIDForProjectWorkboard(detail)] : [])
  ]);
  const archiveID = "utility:archive";
  const activeIDs = defaultActivePaneIDs();
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && !detailIDs.includes(id) && id !== archiveID);
  const savedIDs = savedPaneIDs();
  const sourceIsProjectAnchor = sourcePaneID === "utility:projects" || savedIDs.includes(sourcePaneID);
  const projectID = sourceIsProjectAnchor && activeIDs.includes(sourcePaneID)
    ? sourcePaneID
    : state.utilities.projects && activeIDs.includes("utility:projects")
      ? "utility:projects"
      : savedIDs.find((id) => activeIDs.includes(id)) || "";
  if (!projectID) {
    state.paneOrder = ordered;
    return;
  }
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
  syncSavedArchiveButtonStates();
  saveWorkspaceState();
  await transitionWorkspace("utility");
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
  syncSavedArchiveButtonStates();
  saveWorkspaceState();
  await transitionWorkspace("utility");
}

function normalizePaneWeights(ids) {
  const current = state.paneWeights || {};
  const hasManyColumns = ids.length >= 4;
  state.paneWeights = ids.reduce((weights, id) => {
    const value = migrateLegacyPaneWidth(id, Number(current[id]));
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
  const storedValue = Number(state.paneWeights[paneID]);
  const value = migrateLegacyPaneWidth(paneID, storedValue);
  if (value !== storedValue) state.paneWeights[paneID] = value;
  const hasManyColumns = activePaneIDs().length >= 4;
  const flexibleReader = isFlexibleReaderPaneID(paneID);
  const sourceLinkedReader = paneID?.startsWith("reader:") &&
    (state.readers || []).some((reader) => `reader:${reader.id}` === paneID && reader.savedSourcePaneID);
  const explicitlyResizedReader = flexibleReader &&
    Number.isFinite(value) &&
    value > defaultWidth + 0.5;
  const width = Number.isFinite(value) && value > 40
    ? (hasManyColumns ? Math.max(value, defaultWidth) : value)
    : defaultWidth;
  panel.style.setProperty(
    "--pane-resized-min-width",
    `${flexibleReader && !explicitlyResizedReader ? defaultWidth : width}px`
  );
  panel.style.setProperty("--pane-default-min-width", hasManyColumns ? `${defaultWidth}px` : "0px");
  if (detachedProjectWindow && isProjectWorkboardPaneID(paneID)) {
    panel.style.flex = `1 1 ${width}px`;
    return;
  }
  if (sourceLinkedReader) {
    panel.style.flex = `0 0 ${width}px`;
    return;
  }
  if (isFixedWidthPaneID(paneID) || isFixedWidthReaderPaneID(paneID)) {
    panel.style.flex = `0 0 ${width}px`;
    return;
  }
  if (paneID?.startsWith("reader:")) {
    if (flexibleReader && !explicitlyResizedReader) {
      panel.style.flex = `1 1 ${width}px`;
      return;
    }
    panel.style.flex = `0 0 ${width}px`;
    return;
  }
  panel.style.flex = `1 1 ${width}px`;
}

function setUtilityButtonStates() {
  const activeRepeatableKeys = new Set((state.utilityInstances || []).map((instance) => instance.key));
  toggleArchiveButton?.setAttribute("aria-pressed", String(state.utilities.archive));
  toggleSearchButton.setAttribute("aria-pressed", String(activeRepeatableKeys.has("search")));
  addZoningReaderButton?.setAttribute(
    "aria-pressed",
    String((state.readers || []).some((reader) => reader.codePrefix === zoningCodePrefix))
  );
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

function codeTrustProfile(prefix = "BC") {
  const normalizedPrefix = String(prefix || "BC").toUpperCase();
  return codeTrustProfiles.find((profile) => profile.codePrefix === normalizedPrefix) || null;
}

function formatCodeTrustDate(value) {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(`${normalized}T12:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function codeTrustCurrencyLabel(profile) {
  if (!profile) return "";
  if (profile.statusKind === "future-effective" && profile.effectiveDate) {
    return `Effective ${formatCodeTrustDate(profile.effectiveDate)}`;
  }
  if (profile.currentThrough) return profile.currentThrough;
  if (profile.effectiveDate) return `Effective ${formatCodeTrustDate(profile.effectiveDate)}`;
  if (profile.enactedDate) return `Enacted ${formatCodeTrustDate(profile.enactedDate)}`;
  return "";
}

function renderReaderTrust(panel, reader) {
  const trust = panel.querySelector(".reader-trust");
  const profile = codeTrustProfile(reader.codePrefix);
  if (!trust || !profile) {
    if (trust) trust.hidden = true;
    return;
  }
  trust.hidden = false;
  trust.dataset.statusKind = profile.statusKind;
  trust.querySelector(".reader-trust-status").textContent = profile.statusLabel;
  trust.querySelector(".reader-trust-currency").textContent = codeTrustCurrencyLabel(profile);
  trust.querySelector(".reader-trust-edition").textContent = profile.editionLabel;
  trust.querySelector(".reader-trust-authority").textContent = profile.authority;
  const basisRow = trust.querySelector(".reader-trust-basis-row");
  const basis = String(profile.basis || "").trim();
  basisRow.hidden = !basis;
  trust.querySelector(".reader-trust-basis").textContent = basis;
  trust.querySelector(".reader-trust-verified").textContent = [
    profile.verificationLabel,
    formatCodeTrustDate(profile.verifiedOn)
  ].filter(Boolean).join(" · ");
  trust.querySelector(".reader-trust-boundary").textContent = profile.boundary;
  const source = trust.querySelector(".reader-trust-source");
  source.href = profile.sourceURL;
  source.textContent = `Open ${profile.sourceLabel}`;
  if (trust.dataset.interactionBound !== "true") {
    trust.dataset.interactionBound = "true";
    trust.addEventListener("toggle", () => {
      if (!trust.open) return;
      document.querySelectorAll(".reader-trust[open]").forEach((otherTrust) => {
        if (otherTrust !== trust) otherTrust.open = false;
      });
    });
  }
}

function codeFilterLabel(option) {
  return option.prefix === "AC" ? "Gen Administrative Code" : option.label;
}

function searchCodeFilterOptions() {
  const dynamicPrefixes = new Set(chapters.map((chapter) => chapter.codePrefix).filter(Boolean));
  const options = [{ prefix: "ALL", label: "All Sections" }];
  codeOptions.forEach((option) => {
    if (dynamicPrefixes.size === 0 || dynamicPrefixes.has(option.prefix)) {
      options.push({ ...option, label: codeFilterLabel(option) });
      dynamicPrefixes.delete(option.prefix);
    }
  });
  dynamicPrefixes.forEach((prefix) => {
    options.push({ prefix, label: prefix });
  });
  return options;
}

function codeFilterMenuLabel(prefixes = []) {
  const selectedPrefixes = normalizeSearchCodeFilters(prefixes);
  if (selectedPrefixes.length === 0) return "All Sections";
  if (selectedPrefixes.length === 1) {
    return searchCodeFilterOptions().find((option) => option.prefix === selectedPrefixes[0])?.label || selectedPrefixes[0];
  }
  return `${selectedPrefixes.length} Sections`;
}

function savedCodeFilterMenuLabel(instance) {
  const selectedPrefixes = normalizeSearchCodeFilters(instance?.codeFilters);
  if (selectedPrefixes.length < 2) return codeFilterMenuLabel(selectedPrefixes);
  const optionsByPrefix = new Map(
    searchCodeFilterOptions().map((option) => [option.prefix, option.label])
  );
  return selectedPrefixes.map((prefix) => {
    const label = String(optionsByPrefix.get(prefix) || prefix)
      .replace(/\([^)]*\)/g, " ")
      .replace(/[—–-].*$/, " ");
    const initials = (label.match(/[A-Za-z]+/g) || [])
      .map((word) => word[0].toUpperCase())
      .join("");
    return initials || prefix;
  }).join(", ");
}

function updateCodeFilterMenu(filterRail, instance, options = {}) {
  const menu = filterRail.closest(".code-filter-menu");
  const toggle = menu?.querySelector(".code-filter-menu-toggle");
  const label = toggle?.querySelector(".code-filter-menu-label");
  if (!menu || !toggle || !label) return;
  const stateKey = options.stateKey || "codeFilterMenuOpen";
  const menuName = options.menuName || "code section filters";
  const menuLabel = typeof options.label === "function"
    ? options.label(instance)
    : options.label || codeFilterMenuLabel(instance?.codeFilters);
  const open = Boolean(instance?.[stateKey]);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", `${open ? "Collapse" : "Expand"} ${menuName}`);
  label.textContent = menuLabel;

  if (open) {
    filterRail.hidden = false;
    const applyExpandedHeight = () => {
      const filterStyles = getComputedStyle(filterRail);
      const filterGap = Number.parseFloat(filterStyles.getPropertyValue("--space-2")) || 0;
      const savedCodeBottomGap = Number.parseFloat(filterStyles.getPropertyValue("--space-4")) || filterGap;
      const notebookReferenceBottomGap = Number.parseFloat(filterStyles.getPropertyValue("--space-3")) || filterGap;
      const openingPadding = menu.closest(".saved-inline-filters")
        ? filterGap + (
            filterRail.classList.contains("saved-code-filter") || filterRail.classList.contains("saved-tag-filter")
              ? savedCodeBottomGap
              : filterGap
          )
        : filterRail.classList.contains("research-conversation-project-options")
          ? filterGap + savedCodeBottomGap
          : filterRail.classList.contains("saved-project-list")
            ? filterGap * 2
          : filterRail.classList.contains("notebook-reference-list")
            ? filterGap + notebookReferenceBottomGap
            : filterGap;
      const expandedHeight = filterRail.scrollHeight +
        (menu.classList.contains("is-open") ? 0 : openingPadding);
      const nextHeight = `${expandedHeight}px`;
      if (menu.style.getPropertyValue("--code-filter-menu-height") !== nextHeight) {
        menu.style.setProperty("--code-filter-menu-height", nextHeight);
      }
    };
    if (options.instant && !menu.classList.contains("is-open")) {
      menu.classList.add("is-restoring");
      applyExpandedHeight();
      menu.classList.add("is-open");
      void filterRail.offsetHeight;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => menu.classList.remove("is-restoring"));
      });
      return;
    }
    if (!menu.classList.contains("is-open")) {
      requestAnimationFrame(() => {
        if (instance?.[stateKey]) {
          applyExpandedHeight();
          menu.classList.add("is-open");
        }
      });
    } else {
      applyExpandedHeight();
    }
    return;
  }

  if (!menu.classList.contains("is-open")) {
    filterRail.hidden = true;
    return;
  }

  menu.classList.remove("is-open");
  const hideFilterRail = (event) => {
    if (event && event.target !== filterRail) return;
    if (event && event.propertyName !== "max-height") return;
    if (!instance?.[stateKey]) filterRail.hidden = true;
    filterRail.removeEventListener("transitionend", hideFilterRail);
  };
  filterRail.addEventListener("transitionend", hideFilterRail);
  window.setTimeout(hideFilterRail, 500);
}

function wireCodeFilterMenu(filterRail, instance, options = {}) {
  const toggle = filterRail.closest(".code-filter-menu")?.querySelector(".code-filter-menu-toggle");
  if (!toggle || toggle.dataset.filterMenuReady === "true") {
    updateCodeFilterMenu(filterRail, instance, options);
    return;
  }
  const stateKey = options.stateKey || "codeFilterMenuOpen";
  toggle.dataset.filterMenuReady = "true";
  if ("ResizeObserver" in window) {
    let observedMenuWidth = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width || 0;
      if (Math.abs(nextWidth - observedMenuWidth) < 0.5) return;
      observedMenuWidth = nextWidth;
      if (instance[stateKey] && toggle.closest(".code-filter-menu")?.classList.contains("is-open")) {
        updateCodeFilterMenu(filterRail, instance, options);
      }
    });
    resizeObserver.observe(toggle.closest(".code-filter-menu"));
  }
  toggle.addEventListener("click", () => {
    instance[stateKey] = !instance[stateKey];
    saveWorkspaceState();
    updateCodeFilterMenu(filterRail, instance, options);
  });
  const initialOptions = instance[stateKey] ? { ...options, instant: true } : options;
  updateCodeFilterMenu(filterRail, instance, initialOptions);
}

function wireProjectSectionMotion(section, body, controls, label, initialExpanded = false) {
  const toggles = controls.filter(Boolean);
  section.classList.add("project-section-motion");
  body.classList.add("project-section-motion-body");
  let expanded = false;
  let hideTimer = null;

  const updateControls = (nextExpanded) => {
    toggles.forEach((control) => {
      control.setAttribute("aria-expanded", String(nextExpanded));
      if (control.classList.contains("project-section-toggle-chevron") ||
          control.classList.contains("project-notes-toggle-chevron")) {
        control.setAttribute("aria-label", `${nextExpanded ? "Collapse" : "Expand"} ${label}`);
      }
    });
  };
  const applyExpandedHeight = () => {
    section.style.setProperty("--project-section-body-height", `${body.scrollHeight}px`);
  };
  const settleExpandedBody = () => {
    if (expanded && section.classList.contains("is-open")) {
      section.classList.add("is-settled");
    }
  };
  const settleAfterTransition = () => {
    const settle = (event) => {
      if (event && (event.target !== body || event.propertyName !== "max-height")) return;
      body.removeEventListener("transitionend", settle);
      settleExpandedBody();
    };
    body.addEventListener("transitionend", settle);
    hideTimer = window.setTimeout(() => settle(), 500);
  };
  const setExpanded = (nextExpanded, options = {}) => {
    expanded = Boolean(nextExpanded);
    window.clearTimeout(hideTimer);
    updateControls(expanded);
    if (expanded) {
      body.hidden = false;
      if (options.instant) {
        section.classList.add("is-restoring", "is-open", "is-settled");
        requestAnimationFrame(() => requestAnimationFrame(() => section.classList.remove("is-restoring")));
      } else if (!section.classList.contains("is-open")) {
        section.classList.remove("is-settled");
        applyExpandedHeight();
        requestAnimationFrame(() => {
          if (!expanded) return;
          section.classList.add("is-open");
          settleAfterTransition();
        });
      } else {
        settleExpandedBody();
      }
      return;
    }
    if (!section.classList.contains("is-open")) {
      body.hidden = true;
      return;
    }
    applyExpandedHeight();
    section.classList.remove("is-settled");
    void body.offsetHeight;
    section.classList.remove("is-open");
    const hideBody = (event) => {
      if (event && (event.target !== body || event.propertyName !== "max-height")) return;
      if (!expanded) body.hidden = true;
      body.removeEventListener("transitionend", hideBody);
    };
    body.addEventListener("transitionend", hideBody);
    hideTimer = window.setTimeout(hideBody, 500);
  };

  toggles.forEach((control) => control.addEventListener("click", () => setExpanded(!expanded)));
  const bodyResizeObserver = new ResizeObserver(() => {
    if (!section.isConnected) {
      bodyResizeObserver.disconnect();
      return;
    }
    if (expanded && section.classList.contains("is-open") && !section.classList.contains("is-settled")) {
      applyExpandedHeight();
    }
  });
  bodyResizeObserver.observe(body);
  Array.from(body.children).forEach((child) => bodyResizeObserver.observe(child));
  setExpanded(initialExpanded, { instant: true });
  return setExpanded;
}

async function api(path) {
  let response;
  try {
    response = await fetch(path);
  } catch (networkError) {
    serverReachable = false;
    updateConnectionStatus();
    if (hasCapability("offline-access")) {
      const payload = await offlineAPI(path).catch(() => null);
      if (payload) return payload;
    }
    throw networkError;
  }
  if (!response.ok) {
    if (shouldUseOfflineFallback(response.status) && hasCapability("offline-access")) {
      serverReachable = false;
      updateConnectionStatus();
      const payload = await offlineAPI(path).catch(() => null);
      if (payload) return payload;
    }
    serverReachable = response.status < 500;
    updateConnectionStatus();
    throw new Error(`Request failed: ${response.status}`);
  }
  serverReachable = true;
  updateConnectionStatus();
  return response.json();
}

async function fetchChapterList(codePrefix = "BC") {
  const cacheKey = codePrefix || "BC";
  return cacheRetryablePromise(
    chapterListCache,
    cacheKey,
    () => api(`/code/chapters?code=${encodeURIComponent(cacheKey)}`).then((payload) => payload.chapters || [])
  );
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
  const suffix = options.includeBody ? "?include=body" : "";
  return cacheRetryablePromise(
    chapterCache,
    cacheKey,
    () => api(`/code/chapters/${chapterID}${suffix}`).then((payload) => payload.chapter)
  );
}

async function fetchChapterBodyWindow(chapterID, start, limit) {
  const normalizedStart = Math.max(0, Number(start) || 0);
  const normalizedLimit = Math.max(1, Number(limit) || readerProgressiveSectionBatchSize);
  const cacheKey = `${chapterID}:body:${normalizedStart}:${normalizedLimit}`;
  return cacheRetryablePromise(chapterCache, cacheKey, () => {
    const params = new URLSearchParams({
      include: "body",
      bodyStart: String(normalizedStart),
      bodyLimit: String(normalizedLimit)
    });
    return api(`/code/chapters/${chapterID}?${params}`).then((payload) => payload.chapter);
  });
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

function resolveWebWarningContainer(container, previousFocus = document.activeElement) {
  const explicitContainer = container instanceof HTMLElement ? container : null;
  return explicitContainer?.closest(".workspace-panel") ||
    explicitContainer ||
    (previousFocus instanceof HTMLElement ? previousFocus.closest(".workspace-panel") : null);
}

function mountWebWarningBackdrop(backdrop, container, previousFocus) {
  const warningContainer = resolveWebWarningContainer(container, previousFocus);
  backdrop.classList.toggle("is-column-scoped", Boolean(warningContainer));
  warningContainer?.classList.add("has-web-warning");
  (warningContainer || document.body).append(backdrop);
  return warningContainer;
}

function unmountWebWarningBackdrop(backdrop, warningContainer) {
  backdrop.remove();
  if (!warningContainer?.querySelector(".web-warning-backdrop.is-column-scoped")) {
    warningContainer?.classList.remove("has-web-warning");
  }
}

function openWebWarning({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  cancellable = true,
  container = null
}) {
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
  const warningContainer = mountWebWarningBackdrop(backdrop, container, previousFocus);

  return new Promise((resolve) => {
    let settled = false;
    const close = (confirmed) => {
      if (settled) return;
      settled = true;
      unmountWebWarningBackdrop(backdrop, warningContainer);
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

function stripeRestoreIDError(value) {
  const restoreID = String(value || "").trim();
  if (!restoreID) return "Enter the Stripe ID from your Permitext receipt.";
  if (!/^(?:cs_|sub_)[A-Za-z0-9_]+$/.test(restoreID)) {
    return "Use a Stripe checkout session ID beginning with cs_ or a subscription ID beginning with sub_.";
  }
  return "";
}

function openStripeRestoreDialog(onSubmit) {
  activeWebWarningClose?.(false);
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const titleID = `stripe-restore-title-${crypto.randomUUID()}`;
  const messageID = `stripe-restore-message-${crypto.randomUUID()}`;
  const inputID = `stripe-restore-input-${crypto.randomUUID()}`;
  const backdrop = document.createElement("div");
  backdrop.className = "web-warning-backdrop";
  const dialog = document.createElement("form");
  dialog.className = "web-warning-dialog web-warning-form";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleID);
  dialog.setAttribute("aria-describedby", messageID);
  const heading = document.createElement("h2");
  heading.className = "web-warning-title";
  heading.id = titleID;
  heading.textContent = "Restore a Stripe purchase";
  const body = document.createElement("p");
  body.className = "web-warning-message";
  body.id = messageID;
  body.textContent = "Copy the checkout session or subscription ID from your Permitext Stripe receipt.";
  const label = document.createElement("label");
  label.className = "web-warning-field";
  label.htmlFor = inputID;
  label.textContent = "Stripe purchase ID";
  const input = document.createElement("input");
  input.id = inputID;
  input.type = "text";
  input.autocomplete = "off";
  input.autocapitalize = "none";
  input.spellcheck = false;
  input.placeholder = "cs_… or sub_…";
  input.required = true;
  const error = document.createElement("p");
  error.className = "web-warning-form-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const actions = document.createElement("div");
  actions.className = "web-warning-actions";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "web-warning-button web-warning-cancel";
  cancelButton.textContent = "Cancel";
  const restoreButton = document.createElement("button");
  restoreButton.type = "submit";
  restoreButton.className = "web-warning-button web-warning-confirm";
  restoreButton.textContent = "Restore";
  actions.append(cancelButton, restoreButton);
  label.append(input);
  dialog.append(heading, body, label, error, actions);
  backdrop.append(dialog);
  const warningContainer = mountWebWarningBackdrop(backdrop, null, previousFocus);

  return new Promise((resolve) => {
    let settled = false;
    const close = (restored) => {
      if (settled) return;
      settled = true;
      unmountWebWarningBackdrop(backdrop, warningContainer);
      if (activeWebWarningClose === close) activeWebWarningClose = null;
      previousFocus?.focus?.({ preventScroll: true });
      resolve(restored);
    };
    const showError = (message) => {
      error.textContent = message;
      error.hidden = false;
    };
    activeWebWarningClose = close;
    cancelButton.addEventListener("click", () => close(false));
    dialog.addEventListener("submit", async (event) => {
      event.preventDefault();
      const restoreID = input.value.trim();
      const validationError = stripeRestoreIDError(restoreID);
      if (validationError) {
        showError(validationError);
        input.focus();
        return;
      }
      error.hidden = true;
      input.disabled = true;
      cancelButton.disabled = true;
      restoreButton.disabled = true;
      restoreButton.textContent = "Restoring…";
      try {
        await onSubmit(restoreID);
        close(true);
      } catch (submitError) {
        showError(submitError.message || "Could not restore this purchase.");
        input.disabled = false;
        cancelButton.disabled = false;
        restoreButton.disabled = false;
        restoreButton.textContent = "Restore";
        input.focus();
        input.select();
      }
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!restoreButton.disabled) close(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [input, cancelButton, restoreButton].filter((element) => !element.disabled);
      const activeIndex = focusable.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
        : (activeIndex + 1) % focusable.length;
      event.preventDefault();
      focusable[nextIndex].focus();
    });
    input.focus({ preventScroll: true });
  });
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
    const duplicatePattern = new RegExp(`^(?:§\\s*)?${escapeRegExp(number)}(?:\\b|[\\s.:;-]+)`, "i");
    if (duplicatePattern.test(cleanTitle)) {
      return cleanTitle.replace(/^§\s*/i, "").trim();
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
  const aliasSelector = sectionID ? `[data-section-aliases~="${CSS.escape(String(sectionID))}"]` : "";
  const numberSelector = sectionNumber ? `[data-section-number="${CSS.escape(String(sectionNumber))}"]` : "";
  const section = (idSelector ? content.querySelector(idSelector) : null) ||
    (aliasSelector ? content.querySelector(aliasSelector) : null) ||
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
  return stripLeadingSectionNumber(title, number) || title;
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
  const zoningReader = reader.codePrefix === zoningCodePrefix;
  codeSelect.disabled = zoningReader;
  if (zoningReader) {
    const zoningOption = document.createElement("option");
    zoningOption.value = zoningCodePrefix;
    zoningOption.textContent = "Zoning Resolution";
    codeSelect.append(zoningOption);
  } else {
    const optionsByGroup = new Map();
    codeOptions.filter((code) => code.prefix !== zoningCodePrefix).forEach((code) => {
      const group = code.group || "Other Enacted Codes";
      if (!optionsByGroup.has(group)) optionsByGroup.set(group, []);
      optionsByGroup.get(group).push(code);
    });
    optionsByGroup.forEach((codes, groupLabel) => {
      const group = document.createElement("optgroup");
      group.label = groupLabel;
      codes.forEach((code) => {
        const option = document.createElement("option");
        option.value = code.prefix;
        option.textContent = code.label;
        group.append(option);
      });
      codeSelect.append(group);
    });
  }
  codeSelect.value = reader.codePrefix;
  codeSelect.setAttribute("aria-label", "Code section");
  codeSelect.title = codeLabel(reader.codePrefix);
  resizeCodeSelect(codeSelect);
}

function closeActiveCustomSelect() {
  if (!activeCustomSelect) return;
  activeCustomSelect.menu.hidden = true;
  activeCustomSelect.trigger.setAttribute("aria-expanded", "false");
  activeCustomSelect.panel?.classList.remove("has-open-reader-menu");
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
  const readerCodeMenu = select.classList.contains("code-select");
  const readerChapterMenu = select.classList.contains("chapter-select");
  const readerTopMenu = readerCodeMenu || readerChapterMenu;
  const selectPanel = select.closest(".workspace-panel");
  menu.classList.toggle("reader-code-select-menu", readerCodeMenu);
  menu.classList.toggle("reader-chapter-select-menu", readerChapterMenu);
  menu.dataset.floatingSelect = "true";
  menu.hidden = true;
  select._customSelectMenu = menu;
  const staticSelect = select.disabled;
  trigger.classList.toggle("is-static", staticSelect);
  if (staticSelect) {
    trigger.setAttribute("aria-disabled", "true");
    trigger.tabIndex = -1;
  }

  const syncTrigger = () => {
    trigger.textContent = select.options[select.selectedIndex]?.textContent || "";
  };

  const closeMenu = () => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    selectPanel?.classList.remove("has-open-reader-menu");
    if (activeCustomSelect?.menu === menu) activeCustomSelect = null;
  };

  const renderOptions = () => {
    clear(menu);
    const appendOption = (option, { indented = false } = {}) => {
      const item = document.createElement("button");
      item.className = "custom-select-option";
      item.classList.toggle("is-indented", indented);
      item.classList.toggle("is-group-action", option.dataset.sectionHeader === "true");
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
    };
    Array.from(select.children).forEach((child) => {
      if (child instanceof HTMLOptGroupElement) {
        const header = document.createElement("div");
        header.className = "custom-select-group-label";
        header.textContent = child.label;
        menu.append(header);
        Array.from(child.children).forEach((option) => appendOption(option, { indented: true }));
        return;
      }
      if (child instanceof HTMLOptionElement) appendOption(child);
    });
  };

  const positionMenu = () => {
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const panel = trigger.closest(".workspace-panel");
    const panelRect = panel?.getBoundingClientRect();
    const panelInset = panel?.classList.contains("reader-panel")
      ? Number.parseFloat(getComputedStyle(panel).paddingLeft) || 0
      : 0;
    const boundaryLeft = Math.max(viewportPadding, (panelRect?.left ?? viewportPadding) + panelInset);
    const boundaryRight = Math.min(
      window.innerWidth - viewportPadding,
      (panelRect?.right ?? window.innerWidth - viewportPadding) - panelInset
    );
    const boundaryWidth = Math.max(rect.width, boundaryRight - boundaryLeft);
    const optionWidths = Array.from(menu.children).map((item) => item.scrollWidth);
    const naturalWidth = Math.max(rect.width, ...optionWidths);
    const menuWidth = readerTopMenu ? boundaryWidth : Math.min(naturalWidth, boundaryWidth);
    const left = readerTopMenu
      ? boundaryLeft
      : Math.max(boundaryLeft, Math.min(rect.left, boundaryRight - menuWidth));
    const menuOffset = readerTopMenu ? 12 : 2;
    const chapterTrigger = readerCodeMenu
      ? selectPanel?.querySelector(".chapter-select + .custom-select .custom-select-trigger")
      : null;
    const verticalAnchorRect = chapterTrigger?.getBoundingClientRect() || rect;
    const menuTop = verticalAnchorRect.bottom + menuOffset;
    const menuBottomGap = readerChapterMenu ? menuTop : viewportPadding;
    const availableBelow = Math.max(0, window.innerHeight - menuTop - menuBottomGap);
    menu.style.setProperty("--select-menu-top", `${menuTop}px`);
    menu.style.setProperty("--select-menu-left", `${left}px`);
    menu.style.setProperty("--select-menu-width", `${menuWidth}px`);
    menu.style.setProperty("--select-menu-max-height", `${availableBelow}px`);
  };

  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (staticSelect) return;
    const willOpen = menu.hidden;
    closeActiveCustomSelect();
    renderOptions();
    if (willOpen) {
      selectPanel?.classList.toggle("has-open-reader-menu", readerTopMenu);
      activeCustomSelect = { custom, menu, trigger, positionMenu, panel: selectPanel };
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
  const conflictLabel = conflicts === 1 ? "1 sync conflict" : `${conflicts} sync conflicts`;
  const pendingLabel = pending === 1 ? "1 pending" : `${pending} pending`;
  const statusKind = conflicts > 0
    ? "conflict"
    : offline
      ? "offline"
      : pending > 0
        ? "pending"
        : syncFlushPromise
          ? "syncing"
          : "clean";
  connectionStatus.classList.toggle("is-offline", offline);
  connectionStatus.classList.toggle("has-pending", pending > 0 || conflicts > 0);
  connectionStatus.dataset.state = statusKind;
  connectionStatus.hidden = false;
  connectionStatus.textContent = offline
    ? conflicts > 0 ? `Offline · ${conflictLabel}`
      : pending > 0 ? `Offline · ${pendingLabel}`
        : "Offline"
    : conflicts > 0 ? conflictLabel
      : syncFlushPromise ? "Syncing"
        : pending > 0 ? pendingLabel
          : account ? "Synced" : "Online";
  const conflictActionAvailable = statusKind === "conflict";
  connectionStatus.classList.toggle("is-actionable", conflictActionAvailable);
  connectionStatus.setAttribute("role", conflictActionAvailable ? "button" : "status");
  if (conflictActionAvailable) {
    connectionStatus.tabIndex = 0;
    connectionStatus.title = "Review sync conflicts in Settings";
    connectionStatus.setAttribute("aria-label", `${connectionStatus.textContent}. Review sync conflicts in Settings.`);
  } else {
    connectionStatus.removeAttribute("tabindex");
    connectionStatus.removeAttribute("title");
    connectionStatus.setAttribute("aria-label", `Sync status: ${connectionStatus.textContent}`);
  }
  updateTopbarPlanBadge();
}

function openConnectionStatusConflictReview() {
  if (connectionStatus?.dataset.state !== "conflict") return;
  void focusUtility("settings");
}

connectionStatus?.addEventListener("click", openConnectionStatusConflictReview);
connectionStatus?.addEventListener("keydown", (event) => {
  if (connectionStatus.dataset.state !== "conflict" || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  openConnectionStatusConflictReview();
});

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

function updateTopbarPlanBadge() {
  if (!topbarBrand || !topbarBrandPlan) return;
  const pro = currentPlan() === "pro";
  topbarBrandPlan.hidden = !pro;
  topbarBrandPlan.textContent = pro ? "Pro" : "";
  topbarBrand.setAttribute("aria-label", pro ? "permitext Pro plan" : "permitext");
  updateReaderPlanControls();
}

function isProAccount() {
  return currentPlan() === "pro";
}

function updateReaderPlanControls() {
  addReaderButton.hidden = !isProAccount() && state.readers.length >= 2;
  if (addZoningReaderButton) addZoningReaderButton.hidden = false;
  collapseReadersButton.hidden = false;
  updateWorkspaceLayoutControls();
}

function enforceReaderPlanLimit() {
  if (isProAccount() || state.readers.length <= 2) return false;
  const reader = state.readers[0] || newReaderState();
  const secondReader = state.readers[1] || newReaderState();
  const removedReaderIDs = new Set(state.readers.slice(2).map((item) => item.id));
  state.readers = [reader, secondReader];
  Object.entries(searchLinkedReadersBySearch()).forEach(([searchID, readerID]) => {
    if (removedReaderIDs.has(readerID)) delete state.searchLinkedReaders[searchID];
  });
  removedReaderIDs.forEach((readerID) => {
    const paneID = paneIDForReader({ id: readerID });
    delete state.paneWeights[paneID];
    state.paneOrder = state.paneOrder.filter((item) => item !== paneID);
  });
  return true;
}

function currentCapabilityContract() {
  const account = activeAccount();
  if (!account || syncedContent?.userID !== account.userID) return null;
  return syncedContent?.capabilityContract || null;
}

function entitlementResearchEnabled(entitlement = currentEntitlement()) {
  if (!isProAccount()) return false;
  const addOn = entitlement?.addOns?.research;
  const addOnExpiration = Date.parse(addOn?.expiresAt || "");
  if (
    addOn &&
    addOn.enabled !== false &&
    (!Number.isFinite(addOnExpiration) || addOnExpiration > Date.now())
  ) {
    return true;
  }
  if (["lifetimeGrant", "debugOverride"].includes(entitlement?.source)) return true;
  if (entitlement?.legacyResearchIncluded === true) return true;
  return !String(entitlement?.packageID || entitlement?.provider?.permitextPackage || "").trim();
}

function hasCapability(capabilityID) {
  const contractValue = currentCapabilityContract()?.capabilities?.[capabilityID]?.enabled;
  if (typeof contractValue === "boolean") return contractValue;
  if (["saved-work", "notes"].includes(capabilityID)) return true;
  if (capabilityID === "research") return entitlementResearchEnabled();
  if ([
    "projects",
    "notebook",
    "professional-exports",
    "offline-access"
  ].includes(capabilityID)) {
    return isProAccount();
  }
  return false;
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

function planUsageRows() {
  const usage = webFreePlanUsage();
  const rows = isProAccount()
    ? [
        { label: "Saved sections", value: "Unlimited" },
        { label: "Notes", value: "Unlimited" }
      ]
    : [
        {
          label: "Saved sections",
          value: `${usage.savedItems.toLocaleString()} of ${webFreePlanLimits.savedItems}`
        },
        {
          label: "Notes",
          value: `${usage.notes.toLocaleString()} of ${webFreePlanLimits.notes}`
        }
      ];
  if (hasCapability("research")) {
    const used = Number(researchUsage?.requestsUsed);
    const limit = Number(researchUsage?.requestLimit);
    rows.push({
      label: "Research",
      value: Number.isFinite(used) && Number.isFinite(limit)
        ? `${Math.max(0, limit - used).toLocaleString()} of ${limit.toLocaleString()} remaining`
        : "Checking allowance…"
    });
  } else if (isProAccount()) {
    rows.push({ label: "Research", value: "Add-on not active" });
  }
  return rows;
}

function renderPlanUsageRows(container) {
  if (!container) return;
  clear(container);
  planUsageRows().forEach((row) => {
    const item = document.createElement("p");
    const label = document.createElement("span");
    label.textContent = row.label;
    const value = document.createElement("strong");
    value.textContent = row.value;
    item.append(label, value);
    container.append(item);
  });
}

function renderSavedPlanUsage(container) {
  if (!container) return;
  if (isProAccount()) {
    container.hidden = true;
    return;
  }
  const usage = webFreePlanUsage();
  container.textContent =
    `${usage.savedItems.toLocaleString()} of ${webFreePlanLimits.savedItems} saved sections · ` +
    `${usage.notes.toLocaleString()} of ${webFreePlanLimits.notes} notes`;
  container.hidden = false;
}

function refreshVisiblePlanUsage() {
  document.querySelectorAll(".settings-plan-usage").forEach(renderPlanUsageRows);
  document.querySelectorAll(".saved-plan-usage").forEach(renderSavedPlanUsage);
}

function presentWorkspaceIssue(message, options = {}) {
  if (!workspaceIssue || !workspaceIssueCopy || !message) return;
  workspaceIssueCopy.textContent = message;
  activeWorkspaceIssueAction = typeof options.onAction === "function" ? options.onAction : null;
  if (workspaceIssueAction) {
    workspaceIssueAction.hidden = !activeWorkspaceIssueAction;
    workspaceIssueAction.textContent = options.actionLabel || "Review";
  }
  workspaceIssue.hidden = false;
}

function dismissWorkspaceIssue() {
  if (!workspaceIssue) return;
  workspaceIssue.hidden = true;
  activeWorkspaceIssueAction = null;
}

workspaceIssueAction?.addEventListener("click", () => {
  activeWorkspaceIssueAction?.();
  dismissWorkspaceIssue();
});
workspaceIssueDismiss?.addEventListener("click", dismissWorkspaceIssue);

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
  if (syncedContent && syncedContent.userID === state.account.userID) {
    syncedContent = {
      ...syncedContent,
      entitlement: entitlement || null,
      capabilityContract: null
    };
  }
  persistAccountSession();
  saveWorkspaceState();
  void reconcileOfflineFeatureAccess(hasCapability("offline-access")).catch(() => {});
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
  const checkoutPackage = searchParams.get("package") === "research" ? "research" : "pro";
  const checkoutActive = () => checkoutPackage === "research"
    ? hasCapability("research")
    : isProAccount();
  if (sessionID && !checkoutActive()) {
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
    if (checkoutActive()) {
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
  url.searchParams.delete("package");
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
  void reconcileOfflineFeatureAccess(hasCapability("offline-access")).catch(() => {});
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
    item.sectionID || item.savedSectionID || item.itemID || item.id || "section",
    normalizeAnnotationBlockID(item.blockID)
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
  if (!hasCapability("projects")) {
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

const notebookImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maximumNotebookImageBytes = 8 * 1024 * 1024;

async function notebookImageDimensions(blob) {
  try {
    const image = await createImageBitmap(blob);
    try {
      return { width: image.width, height: image.height };
    } finally {
      image.close();
    }
  } catch {
    return { width: null, height: null };
  }
}

async function uploadPendingNotebookImage(record) {
  const account = activeAccount();
  if (!account || account.userID !== record.accountUserID) return null;
  const dimensions = await notebookImageDimensions(record.blob);
  const url = new URL("/notebook/assets/upload", window.location.origin);
  url.searchParams.set("projectID", record.projectID);
  url.searchParams.set("assetID", record.assetID);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${account.sessionToken}`,
        "content-type": record.contentType,
        "x-permitext-user-id": account.userID,
        ...(dimensions.width ? { "x-permitext-image-width": String(dimensions.width) } : {}),
        ...(dimensions.height ? { "x-permitext-image-height": String(dimensions.height) } : {})
      },
      body: record.blob
    });
  } catch (error) {
    throw new Error(navigator.onLine === false
      ? "Upload is waiting for network connectivity."
      : `Notebook image upload failed: ${error.message}`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(responseErrorMessage(payload, "Could not upload this Notebook image."));
  await markNotebookImageUploaded(record.localURL, payload.asset);
  window.dispatchEvent(new CustomEvent("permitext:notebook-image-uploaded", {
    detail: { projectID: record.projectID, localURL: record.localURL, permanentURL: payload.asset.url }
  }));
  return payload.asset;
}

async function flushPendingNotebookImages() {
  const account = activeAccount();
  if (!account || navigator.onLine === false) return [];
  const pending = await pendingNotebookImages(account.userID).catch(() => []);
  const uploaded = [];
  let firstError = null;
  for (const record of pending) {
    try {
      const asset = await uploadPendingNotebookImage(record);
      if (asset) uploaded.push(asset);
    } catch (error) {
      await markNotebookImageUploadError(record.localURL, error.message).catch(() => {});
      firstError ||= error;
      if (navigator.onLine === false) break;
    }
  }
  if (firstError && navigator.onLine !== false) {
    void showWebNotice("Notebook image not synchronized", firstError.message);
  }
  return uploaded;
}

function notebookDocumentAssetURLs(document, prefix) {
  const urls = [];
  const visit = (block) => {
    if (block?.type === "image" && String(block.props?.url || "").startsWith(prefix)) {
      urls.push(block.props.url);
    }
    (block?.children || []).forEach(visit);
  };
  (document?.document || []).forEach(visit);
  return Array.from(new Set(urls));
}

function replaceNotebookDocumentAssetURL(document, fromURL, toURL) {
  const replace = (block) => ({
    ...block,
    ...(block?.type === "image" && block.props?.url === fromURL
      ? { props: { ...block.props, url: toURL } }
      : {}),
    children: (block?.children || []).map(replace)
  });
  return { ...document, document: (document?.document || []).map(replace) };
}

async function pruneUnusedPendingNotebookImages(accountUserID, projectID, cardID, document) {
  const used = new Set(notebookDocumentAssetURLs(document, "permitext-notebook-local:"));
  const localImages = await notebookImagesForProject(accountUserID, projectID, cardID).catch(() => []);
  await Promise.all(localImages.filter((record) => !used.has(record.localURL)).map(async (record) => {
    if (record.uploadState === "uploaded" && record.remoteAsset?.assetID) {
      try {
        await postResearch("/notebook/assets/delete", {
          projectID,
          assetID: record.remoteAsset.assetID
        });
      } catch (error) {
        if (error.payload?.code === "NOTEBOOK_IMAGE_IN_USE") return;
        throw error;
      }
    }
    await deleteLocalNotebookImage(record.localURL);
  })).catch((error) => {
    void showWebNotice("Notebook image cleanup delayed", error.message);
  });
}

async function reconcileNotebookDocumentAssets(document) {
  let reconciled = document;
  for (const localURL of notebookDocumentAssetURLs(document, "permitext-notebook-local:")) {
    const record = await notebookImageRecord(localURL).catch(() => null);
    if (record?.permanentURL) {
      reconciled = replaceNotebookDocumentAssetURL(reconciled, localURL, record.permanentURL);
    }
  }
  return reconciled;
}

async function uploadNotebookAsset(projectID, file, cardID = "") {
  const account = activeAccount();
  if (!account) throw new Error("Sign in to upload Notebook images.");
  if (!(file instanceof File) || !notebookImageTypes.has(file.type)) {
    throw new Error("The Notebook accepts PNG, JPEG, WebP, and GIF images.");
  }
  if (file.size > maximumNotebookImageBytes) {
    throw new Error("Notebook images must be 8 MB or smaller.");
  }
  const blob = await optimizedWorkboardImageBlob(file);
  const record = await stageNotebookImage({
    accountUserID: account.userID,
    projectID,
    cardID,
    assetID: crypto.randomUUID(),
    blob,
    name: file.name
  });
  if (navigator.onLine !== false) {
    try {
      return (await uploadPendingNotebookImage(record)).url;
    } catch (error) {
      await markNotebookImageUploadError(record.localURL, error.message).catch(() => {});
      if (!/network|connectivity|failed to fetch/i.test(error.message)) throw error;
    }
  }
  return record.localURL;
}

async function resolveNotebookAsset(projectID, assetURL) {
  const value = String(assetURL || "");
  if (value.startsWith("permitext-notebook-local:")) {
    const local = await notebookImageRecord(value);
    if (!local?.blob) throw new Error("This offline Notebook image is no longer available on this device.");
    return URL.createObjectURL(local.blob);
  }
  if (!value.startsWith("permitext-notebook-asset:")) return value;
  const account = activeAccount();
  if (!account) throw new Error("Sign in to load this Notebook image.");
  const identity = value.slice("permitext-notebook-asset:".length);
  let decodedIdentity = identity;
  try { decodedIdentity = decodeURIComponent(identity); } catch { /* use literal identity */ }
  const legacyPathname = decodedIdentity.startsWith("project-assets/") ? decodedIdentity : "";
  const response = await fetch("/notebook/assets/read", {
    method: "POST",
    headers: {
      authorization: `Bearer ${account.sessionToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      auth: { accountUserID: account.userID },
      projectID,
      ...(legacyPathname ? { pathname: legacyPathname } : { assetID: identity })
    })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(responseErrorMessage(payload, "Could not load this Notebook image."));
  }
  return URL.createObjectURL(await response.blob());
}

async function saveWorkboardPreview(projectID, blob, metadata = {}) {
  const account = activeAccount();
  if (!account) throw new Error("Sign in to synchronize Workboard previews.");
  if (!blob) {
    return postJSON("/workboards/previews/clear", {
      auth: { accountUserID: account.userID },
      projectID
    }, { token: account.sessionToken });
  }
  const url = new URL("/workboards/previews/upload", window.location.origin);
  url.searchParams.set("projectID", projectID);
  url.searchParams.set("workboardUpdatedAt", metadata.updatedAt || new Date().toISOString());
  url.searchParams.set("elementCount", String(metadata.elementCount || 0));
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${account.sessionToken}`,
      "content-type": "image/png",
      "x-permitext-user-id": account.userID
    },
    body: blob
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseErrorMessage(payload, "Could not save the Workboard preview."));
  }
  return payload.preview;
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

function recentViewCodePrefix(entry) {
  const explicitPrefix = String(entry?.codePrefix || "").trim().toUpperCase();
  if (codeOptions.some((option) => option.prefix === explicitPrefix)) return explicitPrefix;
  const codeSectionID = String(entry?.codeSectionID || "").trim();
  const chapter = codeSectionID
    ? chapters.find((item) => String(item.codeSectionID || "") === codeSectionID)
    : null;
  if (chapter?.codePrefix) return chapter.codePrefix;
  const codeSectionName = String(entry?.codeSectionName || "").trim();
  return codeOptions.find((option) => option.label === codeSectionName)?.prefix || "BC";
}

function recentViewIdentity(entry) {
  const sectionID = Number(entry?.sectionID);
  if (!Number.isSafeInteger(sectionID) || sectionID <= 0) return "";
  return `${recentViewCodePrefix(entry)}:${sectionID}`;
}

function recentViewEntryForReader(reader, chapter = null) {
  const sectionID = Number(reader?.sectionID || 0);
  if (!Number.isSafeInteger(sectionID) || sectionID <= 0) return null;
  const resolvedChapter = chapter || chapters.find((item) => String(item.id) === String(reader.chapterID || ""));
  const codeOption = codeOptions.find((item) => item.prefix === (reader.codePrefix || resolvedChapter?.codePrefix));
  const entry = {
    sectionID,
    sectionNumber: reader.sectionNumber || "",
    title: reader.title || "Section",
    chapterTitle: resolvedChapter?.fullTitle || resolvedChapter?.displayTitle || resolvedChapter?.title || "",
    codeSectionID: resolvedChapter?.codeSectionID || null,
    codeSectionName: codeOption?.label || reader.codePrefix || "",
    codePrefix: reader.codePrefix || resolvedChapter?.codePrefix || "BC",
    chapterID: reader.chapterID || resolvedChapter?.id || "",
    chapterNumber: resolvedChapter?.chapterNumber || "",
    previewText: "",
    viewedAt: swiftReferenceDateSeconds()
  };
  const identity = recentViewIdentity(entry);
  const previous = (state.recentlyViewedSections || []).find((item) => recentViewIdentity(item) === identity);
  if (previous?.previewText) entry.previewText = previous.previewText;
  return entry;
}

function mergeRecentlyViewedDetails(entries, options = {}) {
  const detailsByIdentity = new Map(
    (entries || [])
      .filter((entry) => recentViewIdentity(entry) && String(entry.previewText || "").trim())
      .map((entry) => [recentViewIdentity(entry), entry])
  );
  if (!detailsByIdentity.size) return false;
  let changed = false;
  state.recentlyViewedSections = (state.recentlyViewedSections || []).map((entry) => {
    const details = detailsByIdentity.get(recentViewIdentity(entry));
    if (!details || String(entry.previewText || "").trim() === String(details.previewText || "").trim()) return entry;
    changed = true;
    return {
      ...entry,
      ...details,
      viewedAt: entry.viewedAt || details.viewedAt
    };
  });
  if (changed && options.persist !== false) saveWorkspaceState();
  return changed;
}

function cacheRecentlyViewedReaderPreview(reader, section) {
  if (!reader?.sectionID || !section) return;
  const entry = recentViewEntryForReader(reader);
  if (!entry) return;
  const sectionNumber = section.sectionNumber || entry.sectionNumber || "";
  const sectionTitle = section.title || entry.title || "Section";
  const rawPreview = sectionPlainText(section);
  const titleWithoutNumber = stripLeadingSectionNumber(sectionTitle, sectionNumber);
  const previewSource = rawPreview || titleWithoutNumber;
  const previewText = snippetWithoutDuplicateTitle({
    sectionNumber,
    title: sectionTitle,
    snippet: previewSource
  }).replace(/\s+/g, " ").trim().slice(0, 360);
  if (!previewText) return;
  mergeRecentlyViewedDetails([{
    ...entry,
    sectionNumber,
    title: sectionTitle,
    previewText
  }]);
}

function continuityRecentSearches(values = {}) {
  try {
    const parsed = JSON.parse(values.recentSearchesJSON || "[]");
    return normalizeSearchHistory(Array.isArray(parsed) ? parsed : [], recentSearchLimit);
  } catch {
    return [];
  }
}

function continuityRecentSearchHistory(values = {}, fallbackTimestamp = 0) {
  try {
    const parsed = JSON.parse(values.recentSearchHistoryJSON || "[]");
    const explicit = normalizeRecentSearchHistory(parsed, recentSearchLimit);
    if (explicit.length) return explicit;
  } catch {
    // Fall through to the ordered legacy search list.
  }
  return continuityRecentSearches(values).map((query, index) => ({
    query,
    searchedAt: Math.max(0, fallbackTimestamp - index)
  }));
}

function outgoingRecentSearchHistory(existingValues, recentSearches) {
  const candidates = [
    ...normalizeRecentSearchHistory(state.recentSearchHistory, recentSearchLimit),
    ...continuityRecentSearchHistory(existingValues)
  ];
  const byQuery = new Map();
  candidates.forEach((entry) => {
    const key = entry.query.normalize("NFKC").toLocaleLowerCase("en-US");
    const current = byQuery.get(key);
    if (!current || entry.searchedAt > current.searchedAt) byQuery.set(key, entry);
  });
  const fallbackTimestamp = Date.now();
  return recentSearches.map((query, index) => {
    const key = query.normalize("NFKC").toLocaleLowerCase("en-US");
    return byQuery.get(key) || { query, searchedAt: fallbackTimestamp - index };
  });
}

function recordRecentlyViewedReader(reader) {
  const chapter = chapters.find((item) => String(item.id) === String(reader.chapterID || ""));
  const entry = recentViewEntryForReader(reader, chapter);
  if (!entry) return;
  const identity = recentViewIdentity(entry);
  state.recentlyViewedSections = [
    entry,
    ...(state.recentlyViewedSections || []).filter((item) => recentViewIdentity(item) !== identity)
  ].slice(0, recentViewLimit);
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
    if (!recentEntries.some((candidate) => recentViewIdentity(candidate) === recentViewIdentity(entry))) recentEntries.push(entry);
  });
  if (Number.isSafeInteger(sectionID) && sectionID > 0) {
    const entry = recentViewEntryForReader(reader, chapter);
    const identity = recentViewIdentity(entry);
    recentEntries.splice(
      0,
      recentEntries.length,
      entry,
      ...recentEntries
        .filter((item) => recentViewIdentity(item) !== identity)
        .slice(0, recentViewLimit - 1)
    );
  }
  const recentSearches = normalizeSearchHistory(state.recentSearches, recentSearchLimit);
  const recentSearchHistory = outgoingRecentSearchHistory(existing, recentSearches);
  return {
    ...existing,
    selectedJurisdictionKey: "jurisdiction-1",
    selectedVersionFileName: defaultSyncCodeVersion,
    selectedCodeSectionID: chapter?.codeSectionID
      ? String(chapter.codeSectionID)
      : existing.selectedCodeSectionID || "",
    lastOpenedChapterID: reader.chapterID
      ? String(reader.chapterID)
      : existing.lastOpenedChapterID || "",
    recentlyViewedSectionsJSON: JSON.stringify(recentEntries.slice(0, recentViewLimit)),
    recentSearchesJSON: JSON.stringify(recentSearches),
    recentSearchHistoryJSON: JSON.stringify(recentSearchHistory)
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
    const localDetails = new Map(
      (state.recentlyViewedSections || [])
        .filter((entry) => String(entry.previewText || "").trim())
        .map((entry) => [recentViewIdentity(entry), entry])
    );
    state.recentlyViewedSections = remoteRecentEntries.slice(0, recentViewLimit).map((entry) => {
      const local = localDetails.get(recentViewIdentity(entry));
      return !entry.previewText && local?.previewText
        ? { ...entry, previewText: local.previewText }
        : entry;
    });
    if (record.values?.recentSearchesJSON !== undefined) {
      state.recentSearches = continuityRecentSearches(record.values);
      state.recentSearchHistory = continuityRecentSearchHistory(record.values, remoteTimestamp);
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
    await flushPendingNotebookImages();
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
    codeVersion: reader.codeVersion || syncCodeVersionForPrefix(reader.codePrefix),
    codePrefix: reader.codePrefix || "BC",
    chapterID: reader.chapterID || "",
    chapterNumber: reader.chapterNumber || "",
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
  const codePrefix = section.codePrefix || "BC";
  return {
    id: `web-saved-${section.sectionID}`,
    userID,
    codeVersion: syncCodeVersion(section.codeVersion || syncCodeVersionForPrefix(codePrefix)),
    codePrefix,
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
  const blockID = normalizeAnnotationBlockID(sectionPayload.blockID);
  const folderClientID = project.clientID || project.id || project.localFolderID || "";
  return {
    id: `web-project-section-${folderClientID}-${sectionID}${blockID ? `-${safeAnnotationIDPart(blockID)}` : ""}`,
    userID: account?.userID || "local-web",
    codeVersion: syncCodeVersion(
      sectionPayload.codeVersion || syncCodeVersionForPrefix(sectionPayload.codePrefix)
    ),
    codePrefix: sectionPayload.codePrefix || "BC",
    chapterID: sectionPayload.chapterID || "",
    chapterNumber: sectionPayload.chapterNumber || "",
    folderClientID,
    localFolderID: numericLocalFolderID(project) || null,
    sectionID: Number(sectionID),
    blockID,
    blockLabel: sectionPayload.blockLabel || "",
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
      blockID: record.blockID || null,
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
      blockID: normalizeAnnotationBlockID(item.blockID) || null,
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

function projectSortOrder(project) {
  const value = Number(project?.sortOrder);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function compareProjectOrder(left, right) {
  const orderDifference = projectSortOrder(left) - projectSortOrder(right);
  if (orderDifference) return orderDifference;
  const createdDifference = Date.parse(left?.createdAt || 0) - Date.parse(right?.createdAt || 0);
  if (Number.isFinite(createdDifference) && createdDifference) return createdDifference;
  return String(left?.name || left?.title || "").localeCompare(
    String(right?.name || right?.title || ""),
    undefined,
    { numeric: true, sensitivity: "base" }
  );
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
  return Array.from(byIdentity.values())
    .filter((project) => !project.deletedAt)
    .sort(compareProjectOrder);
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

function nextProjectSortOrder() {
  const projects = activeProjectRecords(currentContentSummary().projects || []);
  return projects.reduce((maximum, project) => Math.max(maximum, projectSortOrder(project)), -1) + 1;
}

async function createProjectFolder(details = {}) {
  if (!hasCapability("projects")) {
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
    sortOrder: nextProjectSortOrder(),
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

async function persistProjectOrder(projects, paneID) {
  const now = Date.now();
  const updates = projects.map((project, index) => ({
    ...project,
    sortOrder: index,
    updatedAt: new Date(now + index).toISOString()
  }));
  const updateIDs = new Set(updates.map(projectRecordID));
  state.localProjects = [
    ...(state.localProjects || []).filter((project) => !updateIDs.has(projectRecordID(project))),
    ...updates
  ];
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneID] });

  const account = activeAccount();
  if (!account) return;
  const syncedIDs = new Set();
  for (const project of updates) {
    if (project.sharedOnly) continue;
    try {
      await pushMutation(projectMutationForRecord(project, account));
      syncedIDs.add(projectRecordID(project));
    } catch (error) {
      if (isSessionAuthenticationError(error)) clearExpiredAccountSession();
    }
  }
  if (!syncedIDs.size) return;
  state.localProjects = (state.localProjects || []).filter(
    (project) => !syncedIDs.has(projectRecordID(project))
  );
  saveWorkspaceState();
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
  refreshOpenProjectPaneTheme(updated);

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
  if (!hasCapability("projects")) {
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
  const blockID = normalizeAnnotationBlockID(item.blockID);
  const projectID = projectRecordID(project);
  if (!sectionID || !projectID) return;

  const matches = (candidate) =>
    String(candidate.id || "") === String(item.projectSectionID || item.id || "") ||
    (
      String(candidate.sectionID || candidate.savedSectionID || candidate.itemID || "") === sectionID &&
      normalizeAnnotationBlockID(candidate.blockID) === blockID &&
      projectSectionBelongsToProject(candidate, project)
    );

  const deletion = deletedProjectSectionMutationForItem(project, item);
  state.localProjectSections = [
    ...(state.localProjectSections || []).filter((candidate) => !matches(candidate)),
    deletion.projectSection
  ];
  saveWorkspaceState();
  if (options.refreshPanes !== false) await refreshProjectMembershipPanes(project);

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
  refreshVisiblePlanUsage();
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

  container.append(label);
  if (tags.length) container.append(chips);
  container.append(input);
}

function projectLinkForAnnotationTarget(project, target) {
  const sectionID = String(target.sectionID || "");
  const blockID = normalizeAnnotationBlockID(target.blockID);
  return currentContentSummary().projectSections.find((item) =>
    String(item.sectionID || item.savedSectionID || item.itemID || "") === sectionID &&
    normalizeAnnotationBlockID(item.blockID) === blockID &&
    projectSectionBelongsToProject(item, project)
  );
}

function renderAnnotationProjectEditor(container, target, sectionPayload, options = {}) {
  if (!container || !target?.sectionID) return;
  clear(container);

  const label = document.createElement("p");
  label.className = "annotation-tags-label";
  label.textContent = "Projects";
  const header = document.createElement("div");
  header.className = "annotation-projects-header";
  header.append(label);

  const chips = document.createElement("div");
  chips.className = "annotation-project-chips";
  const canUseProjects = hasCapability("projects");
  const projects = canUseProjects
    ? activeProjectRecords(currentContentSummary().projects || [])
    : [];

  if (canUseProjects && container.classList.contains("section-detail-projects")) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "annotation-project-add";
    addButton.title = "Create project";
    addButton.setAttribute("aria-label", "Create project");
    addButton.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      </svg>
    `;
    addButton.addEventListener("click", () => {
      const panel = container.closest(".workspace-panel");
      if (!panel) return;
      showProjectCreateSheet(panel, null, {
        onCreated: async (project) => {
          if (!isSectionSaved(sectionPayload.sectionID)) {
            const saved = await persistSectionBookmark(sectionPayload, true, { refreshSavedPanes: false });
            if (!saved) return;
            syncReaderNoteBookmarkButtons(sectionPayload.sectionID, true);
          }
          await persistSectionInProject(project, { ...sectionPayload, ...target });
          options.onChange?.();
        }
      });
    });
    header.append(addButton);
  }

  if (!canUseProjects) {
    const unavailable = document.createElement("span");
    unavailable.className = "annotation-projects-empty";
    unavailable.textContent = "Pro required";
    chips.append(unavailable);
  } else if (!projects.length) {
    const empty = document.createElement("span");
    empty.className = "annotation-projects-empty";
    empty.textContent = "No projects";
    chips.append(empty);
  } else {
    projects.forEach((project) => {
      const existingLink = projectLinkForAnnotationTarget(project, target);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "annotation-project-chip";
      button.classList.toggle("is-selected", Boolean(existingLink));
      button.style.setProperty("--project-color", projectColor(project));
      button.setAttribute("aria-pressed", String(Boolean(existingLink)));
      button.setAttribute(
        "aria-label",
        `${existingLink ? "Remove from" : "Add to"} ${project.name || project.title || "project"}`
      );
      button.textContent = project.name || project.title || "Project";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const currentLink = projectLinkForAnnotationTarget(project, target);
          if (currentLink) {
            await removeSectionFromProject(project, currentLink, { removeBookmark: false });
          } else {
            if (!isSectionSaved(sectionPayload.sectionID)) {
              const saved = await persistSectionBookmark(sectionPayload, true, { refreshSavedPanes: false });
              if (!saved) return;
              syncReaderNoteBookmarkButtons(sectionPayload.sectionID, true);
            }
            await persistSectionInProject(project, { ...sectionPayload, ...target });
          }
          renderAnnotationProjectEditor(container, target, sectionPayload, options);
          options.onChange?.();
        } finally {
          button.disabled = false;
        }
      });
      chips.append(button);
    });
  }

  container.append(header, chips);
}

function refreshOpenAnnotationProjectEditors() {
  track.querySelectorAll(".reader-notes-sheet.is-open:not([hidden])").forEach((sheet) => {
    const target = sheet.__annotationTarget;
    const container = sheet.querySelector(".reader-notes-projects");
    if (!target?.sectionID || !container) return;
    renderAnnotationProjectEditor(container, target, target, {
      onChange: () => {
        if (state.utilities.saved) renderWorkspace();
      }
    });
  });
  track.querySelectorAll(".section-detail-panel").forEach((panel) => {
    const target = panel.__annotationTarget;
    const sectionPayload = panel.__sectionPayload;
    const container = panel.querySelector(".section-detail-projects");
    if (!target?.sectionID || !sectionPayload?.sectionID || !container) return;
    renderAnnotationProjectEditor(container, target, sectionPayload);
  });
}

function annotationTargetForSection(section, reader = null, overrides = {}) {
  const codePrefix = reader?.codePrefix || section.codePrefix || "BC";
  return {
    codeVersion: syncCodeVersion(
      reader?.codeVersion || section.codeVersion || syncCodeVersionForPrefix(codePrefix)
    ),
    codePrefix,
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
  const sourceBlocks = Array.isArray(section.blocks) ? section.blocks : [];
  const organizedBlocks = organizedSpecialtyProvisionBlocks(section, sourceBlocks);
  const blocks = organizedBlocks.flatMap((block, blockIndex) => splitAnnotatedCodeBlock(block, blockIndex));
  const isZoningSection =
    String(section?.codePrefix || "").toUpperCase() === zoningCodePrefix ||
    Boolean(section?.zoning) ||
    sourceBlocks.some((block) => String(block?.id || "").startsWith("zr-"));
  return isZoningSection ? blocks.filter(codeBlockHasVisibleContent) : blocks;
}

function normalizedSpecialtySectionRoot(sectionNumber) {
  const value = String(sectionNumber || "")
    .replace(/^§\s*/i, "")
    .replace(/\.$/, "")
    .trim()
    .toUpperCase();
  if (/^ARTICLE-\d+$/.test(value)) return `28-${value.slice("ARTICLE-".length)}`;
  if (/^ASHRAE-\d+$/.test(value)) return value.slice("ASHRAE-".length);
  return value;
}

function specialtyProvisionMarker(line, sectionRoot, allowSubdivisions) {
  const value = String(line || "").replace(/\s+/g, " ").trim();
  const numbered = value.match(
    /^(§\s*)?([A-Z]?\d+(?:-\d+)?(?:\.\d+)+(?:\([A-Za-z0-9]+\))*)\s+([A-Z][\s\S]*)$/
  );
  if (numbered) {
    const number = numbered[2].toUpperCase();
    const belongsToSection =
      number === sectionRoot ||
      number.startsWith(`${sectionRoot}.`) ||
      number.startsWith(`${sectionRoot}(`);
    if (belongsToSection) {
      return {
        displayNumber: `${numbered[1] || ""}${numbered[2]}`.trim(),
        bodyStart: numbered[3]
      };
    }
  }
  if (allowSubdivisions) {
    const subdivision = value.match(/^(\([A-Z]\))\s+([A-Z][\s\S]*)$/);
    if (subdivision) {
      return {
        displayNumber: subdivision[1],
        bodyStart: subdivision[2]
      };
    }
  }
  return null;
}

function specialtyProvisionHeading(segmentText, marker) {
  const normalized = String(segmentText || "").replace(/\s+/g, " ").trim();
  const markerPattern = new RegExp(
    `^(?:§\\s*)?${escapeRegExp(marker.displayNumber.replace(/^§\\s*/i, ""))}\\s+`,
    "i"
  );
  const remainder = normalized.replace(markerPattern, "");
  const titleMatch = remainder.match(/^(.{1,160}?\.)($|\s+)([\s\S]*)$/);
  if (!titleMatch) return null;
  return {
    heading: `${marker.displayNumber} ${titleMatch[1]}`.trim(),
    body: String(titleMatch[3] || "").trim()
  };
}

function specialtyProvisionHTML(heading, body) {
  const paragraph = document.createElement("p");
  paragraph.className = "specialty-provision";
  const strong = document.createElement("strong");
  strong.className = "specialty-provision-heading";
  strong.textContent = heading;
  paragraph.append(strong);
  if (body) paragraph.append(document.createTextNode(` ${body}`));
  return paragraph.outerHTML;
}

function organizedSpecialtyProvisionBlocks(section, sourceBlocks) {
  const codePrefix = String(section?.codePrefix || "").toUpperCase();
  if (!["ECC", "EC"].includes(codePrefix) || sourceBlocks.length !== 1) return sourceBlocks;
  const source = sourceBlocks[0];
  if (source.kind !== "html" || !String(source.plainText || "").trim()) return sourceBlocks;

  const sectionRoot = normalizedSpecialtySectionRoot(section.sectionNumber);
  if (!sectionRoot || sectionRoot.includes("APPENDIX")) return sourceBlocks;
  const lines = String(source.plainText).split(/\r?\n/);
  const starts = [];
  lines.forEach((line, index) => {
    const marker = specialtyProvisionMarker(line, sectionRoot, codePrefix === "EC");
    if (marker) starts.push({ index, marker });
  });
  if (!starts.length) return sourceBlocks;

  const blocks = [];
  const appendPlainBlock = (text, suffix) => {
    const plainText = String(text || "").replace(/\s+/g, " ").trim();
    if (!plainText) return;
    const paragraph = document.createElement("p");
    paragraph.textContent = plainText;
    blocks.push({
      ...source,
      id: `${source.id || `specialty-${section.id}`}-${suffix}`,
      html: paragraph.outerHTML,
      plainText
    });
  };

  if (starts[0].index > 0) {
    appendPlainBlock(lines.slice(0, starts[0].index).join("\n"), "preamble");
  }
  starts.forEach((entry, markerIndex) => {
    const end = starts[markerIndex + 1]?.index ?? lines.length;
    const segmentText = lines.slice(entry.index, end).join("\n");
    const provision = specialtyProvisionHeading(segmentText, entry.marker);
    if (!provision) {
      appendPlainBlock(segmentText, `provision-${markerIndex + 1}`);
      return;
    }
    blocks.push({
      ...source,
      id: `${source.id || `specialty-${section.id}`}-provision-${markerIndex + 1}`,
      html: specialtyProvisionHTML(provision.heading, provision.body),
      plainText: String(segmentText).replace(/\s+/g, " ").trim()
    });
  });
  return blocks.length ? blocks : sourceBlocks;
}

function normalizedReaderProvisionText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readerSectionsWithoutRepeatedCatalogAliases(sections) {
  const rendered = [];
  let latestBodySection = null;
  let latestBodyText = "";

  for (const section of sections || []) {
    const blocks = annotatedBlocksForSection(section);
    if (blocks.length > 0) {
      const renderedSection = {
        ...section,
        readerAliasSectionIDs: []
      };
      rendered.push(renderedSection);
      latestBodySection = renderedSection;
      latestBodyText = normalizedReaderProvisionText(sectionPlainText(section));
      continue;
    }

    const catalogTitle = normalizedReaderProvisionText(section.title);
    if (catalogTitle && latestBodySection && latestBodyText.includes(catalogTitle)) {
      latestBodySection.readerAliasSectionIDs.push(String(section.id));
      continue;
    }

    rendered.push({
      ...section,
      readerAliasSectionIDs: []
    });
    latestBodySection = null;
    latestBodyText = "";
  }

  return rendered;
}

function codeBlockHasVisibleContent(block) {
  if (!block) return false;
  if (block.kind === "image" || block.kind === "table") return true;
  if (String(block.plainText || block.text || "").replace(/\u00a0/g, " ").trim()) return true;
  if (!block.html) return false;
  if (typeof document === "undefined") return /<(?:img|table)\b/i.test(block.html);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = rewriteCodeHTML(block.html);
  return Boolean(
    String(wrapper.textContent || "").replace(/\u00a0/g, " ").trim() ||
    wrapper.querySelector("img, table")
  );
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

function readerTargetSectionIndex(sections, reader) {
  const sectionID = String(reader.sectionID || "");
  const sectionNumber = String(reader.sectionNumber || "");
  return sections.findIndex((section) =>
    (sectionID && String(section.id) === sectionID) ||
    (sectionID && section.readerAliasSectionIDs.includes(sectionID)) ||
    (sectionNumber && String(section.sectionNumber || "") === sectionNumber)
  );
}

function readerSectionWithWindowBody(section, windowChapter) {
  const bodySection = (windowChapter.sections || []).find((candidate) =>
    String(candidate.id) === String(section.id)
  );
  return bodySection && Array.isArray(bodySection.blocks)
    ? { ...section, blocks: bodySection.blocks }
    : section;
}

function readerSectionPayload(section, reader, blockID = "") {
  const target = annotationTargetForSection(section, reader);
  return {
    codeVersion: target.codeVersion,
    sectionID: section.id,
    sectionNumber: section.sectionNumber,
    title: section.title,
    codePrefix: reader?.codePrefix || "BC",
    chapterID: reader?.chapterID || "",
    chapterNumber: section.chapterNumber || "",
    blockID: normalizeAnnotationBlockID(blockID),
    blockLabel: ""
  };
}

function readerSectionIdentityValues(section) {
  return new Set([
    section?.id,
    section?.sectionID,
    ...(section?.readerAliasSectionIDs || [])
  ].filter(Boolean).map(String));
}

function readerProjectsForSection(section) {
  const sectionIDs = readerSectionIdentityValues(section);
  const summary = currentContentSummary();
  const links = (summary.projectSections || []).filter((item) =>
    sectionIDs.has(String(item.sectionID || item.savedSectionID || item.itemID || ""))
  );
  const seen = new Set();
  return visibleProjectRecords(summary.projects || []).filter((project) => {
    const key = projectDetailKey(project);
    if (!key || seen.has(key) || !links.some((link) => projectSectionBelongsToProject(link, project))) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function readerSectionHasNote(section) {
  const sectionIDs = readerSectionIdentityValues(section);
  if ([...sectionIDs].some((sectionID) => noteValueForSection(sectionID).trim())) return true;
  return (currentContentSummary().annotations || []).some((annotation) =>
    sectionIDs.has(String(annotation.sectionID || "")) &&
    String(annotation.noteBody || "").trim()
  );
}

function renderReaderSectionProjectContext(host, section, reader, panel) {
  if (!host) return;
  clear(host);
  const selectedSectionID = String(reader?.sectionID || "");
  if (!selectedSectionID || !readerSectionIdentityValues(section).has(selectedSectionID)) {
    host.hidden = true;
    return;
  }
  const projects = readerProjectsForSection(section);
  const saved = [...readerSectionIdentityValues(section)].some(isSectionSaved);
  if (!saved && projects.length === 0) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const label = document.createElement("span");
  label.className = "reader-section-project-context-label";
  label.textContent = "Project record";
  host.append(label);
  const hasNote = readerSectionHasNote(section);
  if (!projects.length) {
    const status = document.createElement("span");
    status.className = "reader-section-project-context-status";
    status.textContent = hasNote ? "Saved evidence · Note" : "Saved evidence · Not linked to a Project";
    host.append(status);
    return;
  }
  projects.forEach((project) => {
    const projectButton = document.createElement("button");
    projectButton.type = "button";
    projectButton.className = "reader-section-project-chip";
    projectButton.style.setProperty("--project-color", projectColor(project));
    const archived = projectIsArchived(project);
    projectButton.textContent = `${project.name || project.title || "Project"}${archived ? " · Archived" : ""}`;
    projectButton.title = "Open Project record";
    projectButton.addEventListener("click", () => {
      void openProjectDetail(project, { sourcePaneID: paneIDForReader(reader) });
    });
    host.append(projectButton);
  });
  const status = document.createElement("span");
  status.className = "reader-section-project-context-status";
  status.textContent = hasNote ? "Saved evidence · Note" : "Saved evidence";
  host.append(status);
}

function refreshReaderSectionProjectContexts(sectionID = "") {
  const sectionKey = String(sectionID || "");
  track.querySelectorAll(".reader-section-project-context").forEach((host) => {
    const context = host.__readerProjectContext;
    if (!context || (sectionKey && !readerSectionIdentityValues(context.section).has(sectionKey))) return;
    renderReaderSectionProjectContext(host, context.section, context.reader, context.panel);
  });
}

function selectReaderSectionForResearch(sectionWrapper) {
  const selection = window.getSelection?.();
  if (!selection || !sectionWrapper) return;
  const range = document.createRange();
  range.selectNodeContents(sectionWrapper);
  selection.removeAllRanges();
  selection.addRange(range);
  const selectedText = researchSelectionTextFromRange(selection, range);
  if (!selectedText) return;
  const rect = sectionWrapper.querySelector(".reader-section-title")?.getBoundingClientRect() ||
    sectionWrapper.getBoundingClientRect();
  const passage = {
    sectionID: sectionWrapper.dataset.researchSectionId,
    sectionNumber: sectionWrapper.dataset.researchSectionNumber,
    title: sectionWrapper.dataset.researchSectionTitle,
    codePrefix: sectionWrapper.dataset.researchCodePrefix,
    savedItemID: sectionWrapper.dataset.researchSavedItemId || "",
    selectedText
  };
  showResearchSelectionMenu({ ...passage, passages: [passage], rect }, { pinned: true });
}

function renderReaderChapterSection(panel, reader, section, groupLabelsByFirstSection) {
  const sectionWrapper = document.createElement("section");
  sectionWrapper.className = "chapter-section";
  sectionWrapper.dataset.sectionId = String(section.id);
  sectionWrapper.dataset.sectionNumber = String(section.sectionNumber || "");
  if (section.readerAliasSectionIDs.length > 0) {
    sectionWrapper.dataset.sectionAliases = section.readerAliasSectionIDs.join(" ");
  }
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
    groupHeading.dataset.researchSelectionExclude = "true";
    groupHeading.textContent = groupLabel;
    sectionWrapper.append(groupHeading);
  }

  const sectionHeading = document.createElement("h3");
  sectionHeading.className = "reader-section-title";
  sectionHeading.dataset.researchSelectionExclude = "true";
  sectionHeading.textContent = sectionDisplayTitle(section.sectionNumber, section.title);
  const headingRow = document.createElement("div");
  headingRow.className = "reader-section-heading-row";
  headingRow.dataset.researchSelectionExclude = "true";
  headingRow.append(sectionHeading);
  sectionWrapper.append(headingRow);

  const projectContext = document.createElement("div");
  projectContext.className = "reader-section-project-context";
  projectContext.dataset.researchSelectionExclude = "true";
  projectContext.__readerProjectContext = { section, reader, panel };
  renderReaderSectionProjectContext(projectContext, section, reader, panel);
  sectionWrapper.append(projectContext);

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
  return sectionWrapper;
}

function collapseRepeatedReaderCatalogAliases(content) {
  let latestBodySection = null;
  let latestBodyText = "";
  content.querySelectorAll(".chapter-section").forEach((section) => {
    const blocks = section.querySelectorAll(".annotated-code-block");
    if (blocks.length > 0) {
      latestBodySection = section;
      latestBodyText = normalizedReaderProvisionText(
        Array.from(blocks).map((block) => block.textContent || "").join(" ")
      );
      return;
    }
    const title = normalizedReaderProvisionText(
      section.querySelector(".reader-section-title")?.textContent || ""
    );
    if (!title || !latestBodySection || !latestBodyText.includes(title)) {
      latestBodySection = null;
      latestBodyText = "";
      return;
    }
    const aliasID = String(section.dataset.sectionId || "").trim();
    const aliases = new Set(
      String(latestBodySection.dataset.sectionAliases || "").split(/\s+/).filter(Boolean)
    );
    if (aliasID) aliases.add(aliasID);
    if (aliases.size > 0) {
      latestBodySection.dataset.sectionAliases = Array.from(aliases).join(" ");
    }
    section.remove();
  });
}

function nextReaderProgressiveFrame() {
  return new Promise((resolve) => window.setTimeout(resolve, 16));
}

async function progressivelyRenderReaderChapter(
  panel,
  reader,
  content,
  sections,
  groupLabelsByFirstSection,
  initialStart,
  initialEnd,
  renderToken
) {
  let beforeCursor = initialStart;
  let afterCursor = initialEnd;
  let loadAfter = true;
  let retryCount = 0;
  const status = document.createElement("p");
  status.className = "reader-progressive-status";
  status.dataset.researchSelectionExclude = "true";
  status.setAttribute("role", "status");
  status.textContent = "Loading the rest of this chapter…";
  content.append(status);

  while (beforeCursor > 0 || afterCursor < sections.length) {
    await nextReaderProgressiveFrame();
    if (!panel.isConnected || panel.dataset.readerRenderToken !== renderToken) {
      status.remove();
      return;
    }
    const canLoadAfter = afterCursor < sections.length;
    const canLoadBefore = beforeCursor > 0;
    const shouldLoadAfter = (loadAfter && canLoadAfter) || !canLoadBefore;
    const start = shouldLoadAfter
      ? afterCursor
      : Math.max(0, beforeCursor - readerProgressiveSectionBatchSize);
    const end = shouldLoadAfter
      ? Math.min(sections.length, start + readerProgressiveSectionBatchSize)
      : beforeCursor;
    let windowChapter;
    try {
      windowChapter = await fetchChapterBodyWindow(reader.chapterID, start, end - start);
      retryCount = 0;
    } catch (error) {
      if (!panel.isConnected || panel.dataset.readerRenderToken !== renderToken) {
        status.remove();
        return;
      }
      retryCount += 1;
      status.textContent = "Loading the rest of this chapter…";
      console.warn("Reader chapter hydration will retry.", error);
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(4000, 250 * (2 ** retryCount))));
      continue;
    }
    if (!panel.isConnected || panel.dataset.readerRenderToken !== renderToken) {
      status.remove();
      return;
    }
    try {
      const fragment = document.createDocumentFragment();
      sections.slice(start, end).forEach((section) => {
        fragment.append(
          renderReaderChapterSection(
            panel,
            reader,
            readerSectionWithWindowBody(section, windowChapter),
            groupLabelsByFirstSection
          )
        );
      });
      if (shouldLoadAfter) {
        content.insertBefore(fragment, status);
        afterCursor = end;
      } else {
        const previousHeight = content.scrollHeight;
        const previousTop = content.scrollTop;
        content.insertBefore(fragment, content.querySelector(".chapter-section") || status);
        content.scrollTop = previousTop + (content.scrollHeight - previousHeight);
        beforeCursor = start;
      }
      collapseRepeatedReaderCatalogAliases(content);
      status.textContent = `${afterCursor - beforeCursor} of ${sections.length} sections loaded`;
      loadAfter = !shouldLoadAfter;
      requestAnimationFrame(() => updateReaderScrollIndicator(panel));
    } catch (error) {
      console.error("Reader chapter hydration could not render a section batch.", error);
      status.remove();
      return;
    }
  }
  status.remove();
  content.dataset.chapterFullyLoaded = "true";
  requestAnimationFrame(() => updateReaderScrollIndicator(panel));
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

  const renderToken = `${reader.chapterID}:${reader.sectionID || "start"}:${Date.now()}`;
  panel.dataset.readerRenderToken = renderToken;
  clear(content);
  emptyReader(content, "Loading section", "Opening the selected code text first.");
  const chapter = await fetchChapter(reader.chapterID);
  if (panel.dataset.readerRenderToken !== renderToken) return;
  const sections = readerSectionsWithoutRepeatedCatalogAliases(
    (chapter.sections || []).map((section) => ({
      ...section,
      codePrefix: section.codePrefix || chapter.codePrefix
    }))
  );
  if (!sections.length) {
    emptyReader(content, "No sections", "This chapter does not contain readable sections.");
    clear(commentsList);
    return;
  }
  const targetIndex = Math.max(0, readerTargetSectionIndex(sections, reader));
  const maximumInitialStart = Math.max(0, sections.length - readerInitialSectionWindowSize);
  const initialStart = Math.min(
    Math.max(0, targetIndex - Math.floor(readerInitialSectionWindowSize / 2)),
    maximumInitialStart
  );
  const initialEnd = Math.min(sections.length, initialStart + readerInitialSectionWindowSize);
  const initialChapter = await fetchChapterBodyWindow(
    reader.chapterID,
    initialStart,
    initialEnd - initialStart
  );
  if (panel.dataset.readerRenderToken !== renderToken) return;
  const groupLabelsByFirstSection = groupLabelsForChapter(chapter);
  clear(content);
  const initialSections = sections.slice(initialStart, initialEnd).map((section) =>
    readerSectionWithWindowBody(section, initialChapter)
  );
  initialSections.forEach((section) => {
    content.append(
      renderReaderChapterSection(
        panel,
        reader,
        section,
        groupLabelsByFirstSection
      )
    );
  });
  cacheRecentlyViewedReaderPreview(reader, initialSections[targetIndex - initialStart]);
  collapseRepeatedReaderCatalogAliases(content);
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
  void progressivelyRenderReaderChapter(
    panel,
    reader,
    content,
    sections,
    groupLabelsByFirstSection,
    initialStart,
    initialEnd,
    renderToken
  );
}

function scrollReaderContentToSection(content, sectionID, behavior = "auto", sectionNumber = "") {
  const idSelector = sectionID ? `[data-section-id="${CSS.escape(String(sectionID))}"]` : "";
  const aliasSelector = sectionID ? `[data-section-aliases~="${CSS.escape(String(sectionID))}"]` : "";
  const numberSelector = sectionNumber ? `[data-section-number="${CSS.escape(String(sectionNumber))}"]` : "";
  const target = (idSelector ? content?.querySelector(idSelector) : null) ||
    (aliasSelector ? content?.querySelector(aliasSelector) : null) ||
    (numberSelector ? content?.querySelector(numberSelector) : null);
  if (!content || !target) return;
  stabilizeReaderSectionAtHeader(content, target, behavior);
}

function savedReaderTarget(content, item) {
  if (!content || !item) return null;
  const sectionID = String(item.sectionID || item.id || "").trim();
  const sectionNumber = String(item.sectionNumber || "").trim();
  const blockID = normalizeAnnotationBlockID(item.blockID || item.annotationBlockID);
  const idSelector = sectionID
    ? `.chapter-section[data-section-id="${CSS.escape(sectionID)}"]`
    : "";
  const aliasSelector = sectionID
    ? `.chapter-section[data-section-aliases~="${CSS.escape(sectionID)}"]`
    : "";
  const numberSelector = sectionNumber
    ? `.chapter-section[data-section-number="${CSS.escape(sectionNumber)}"]`
    : "";
  const sectionTarget = (idSelector ? content.querySelector(idSelector) : null) ||
    (aliasSelector ? content.querySelector(aliasSelector) : null) ||
    (numberSelector ? content.querySelector(numberSelector) : null);
  const savedTitle = String(item.title || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const sectionTitle = String(
    readerSectionTitleNode(sectionTarget)?.textContent || sectionTarget?.dataset.sectionTitle || ""
  ).replace(/\s+/g, " ").trim().toLocaleLowerCase();
  if (
    sectionTarget &&
    savedTitle.length >= 12 &&
    sectionTitle.length >= 12 &&
    (sectionTitle.includes(savedTitle) || savedTitle.includes(sectionTitle))
  ) {
    return readerSectionTitleNode(sectionTarget);
  }
  if (blockID) {
    const sectionBlockSelector = sectionID
      ? `.annotated-code-block[data-section-id="${CSS.escape(sectionID)}"][data-block-id="${CSS.escape(blockID)}"]`
      : "";
    const blockSelector = `.annotated-code-block[data-block-id="${CSS.escape(blockID)}"]`;
    const blockTarget = (sectionBlockSelector ? content.querySelector(sectionBlockSelector) : null) ||
      content.querySelector(blockSelector);
    if (blockTarget) return blockTarget;
  }
  if (savedTitle.length >= 12) {
    const exactTextBlock = Array.from(
      (sectionTarget || content).querySelectorAll(".annotated-code-block")
    ).find((candidate) => {
      const codeBody = candidate.querySelector(
        ":scope > .section-block, :scope > .section-html, :scope > .code-table, :scope > .code-media"
      ) || candidate;
      const candidateText = String(codeBody.textContent || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
      return candidateText.length >= 12 &&
        (candidateText.includes(savedTitle) || savedTitle.includes(candidateText));
    });
    if (exactTextBlock) return exactTextBlock;
  }
  return sectionTarget;
}

function alignSavedReaderTargetAtTop(reader, item) {
  const paneID = paneIDForReader(reader);
  [0, 80, 220].forEach((delay) => {
    window.setTimeout(() => {
      const panel = track.querySelector(
        `.reader-panel[data-pane-id="${CSS.escape(paneID)}"]`
      );
      const content = panel?.querySelector(".reader-content");
      const target = savedReaderTarget(content, item);
      if (!content || !target) return;
      scrollReaderContentToNode(content, target, "auto");
    }, delay);
  });
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
    content?.querySelector(`[data-section-aliases~="${CSS.escape(String(reader.sectionID))}"]`) ||
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
    toggleReaderNotesSheet(panel, section, reader, { target });
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

  const projectButton = document.createElement("button");
  projectButton.className = "reader-notes-card-action reader-notes-project-action";
  projectButton.type = "button";
  projectButton.textContent = "Project";

  const linkButton = document.createElement("button");
  linkButton.className = "reader-notes-card-action reader-notes-link-action";
  linkButton.type = "button";
  linkButton.textContent = "Copy link";

  const researchButton = document.createElement("button");
  researchButton.className = "reader-notes-card-action reader-notes-research-action";
  researchButton.type = "button";
  researchButton.textContent = "Research";

  const leadingActions = document.createElement("div");
  leadingActions.className = "reader-notes-leading-actions";
  leadingActions.setAttribute("role", "toolbar");
  leadingActions.setAttribute("aria-label", "Section actions");
  leadingActions.append(bookmarkButton, projectButton, linkButton, researchButton);

  const doneButton = document.createElement("button");
  doneButton.className = "reader-notes-done";
  doneButton.type = "button";
  doneButton.textContent = "Done";
  doneButton.addEventListener("click", () => closeReaderNotesSheet(panel, reader));

  const actions = document.createElement("div");
  actions.className = "reader-notes-actions";
  actions.append(doneButton);

  header.append(leadingActions, actions);

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

  const commentsLabel = document.createElement("p");
  commentsLabel.className = "annotation-tags-label reader-notes-comments-label";
  commentsLabel.textContent = "Comments";

  const projectsHost = document.createElement("section");
  projectsHost.className = "reader-notes-projects";

  const tagsHost = document.createElement("section");
  tagsHost.className = "reader-notes-tags";

  bindReaderNotesResize(resizer, sheet, panel);
  sheet.append(resizer, header, commentsLabel, input, projectsHost, tagsHost);
  panel.append(sheet);
  return sheet;
}

function removeReaderNotesProjectPicker(sheet) {
  sheet?.querySelector(".reader-notes-project-picker")?.remove();
}

async function openReaderNotesProjectPicker(sheet, sectionPayload) {
  const wasAlreadySaved = isSectionSaved(sectionPayload.sectionID);
  if (!wasAlreadySaved) {
    const saved = await persistSectionBookmark(sectionPayload, true);
    if (!saved) return false;
    syncReaderNoteBookmarkButtons(sectionPayload.sectionID, true);
  }
  if (!hasCapability("projects")) {
    if (wasAlreadySaved) {
      void presentPlanLimitNotice(
        "Projects require Pro",
        "Upgrade to Pro to organize saved code in Project workspaces."
      );
    }
    return true;
  }
  showReaderNotesProjectPicker(sheet, sectionPayload);
  return true;
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
  pickerHeader.append(label);
  picker.append(pickerHeader);

  const projectLink = (project) => projectLinkForAnnotationTarget(project, sectionPayload);

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
        refreshReaderSectionProjectContexts(sectionPayload.sectionID);
      } catch (error) {
        const message = error.message || "Could not update this project.";
        button.classList.add("has-error");
        button.title = message;
        presentWorkspaceIssue(message);
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
        refreshOpenAnnotationProjectEditors();
        refreshReaderSectionProjectContexts(sectionPayload.sectionID);
      } catch (error) {
        const message = error.message || "Could not create the project.";
        createButton.disabled = false;
        createButton.title = message;
        presentWorkspaceIssue(message);
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
    const input = sheet.querySelector(".reader-notes-input");
    if (!input) return;
    event.preventDefault();
    resizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-notes");
    sheet.classList.add("is-resizing");

    const panelBounds = panel.getBoundingClientRect();
    const sheetBounds = sheet.getBoundingClientRect();
    const sheetStyles = getComputedStyle(sheet);
    const inputBounds = input.getBoundingClientRect();
    const cssMinHeight = parseFloat(sheetStyles.getPropertyValue("--reader-notes-min-height")) || 320;
    const minInputHeight = parseFloat(sheetStyles.getPropertyValue("--reader-notes-input-min-height")) || 64;
    const maxHeight = Math.max(cssMinHeight, panelBounds.height - (parseFloat(getComputedStyle(panel).getPropertyValue("--reader-scrollbar-track-top")) || 0));
    const nonInputContentHeight = Math.max(0, sheet.scrollHeight - input.offsetHeight);
    const minHeight = Math.min(maxHeight, Math.max(cssMinHeight, nonInputContentHeight + minInputHeight));

    const resize = (moveEvent) => {
      const height = panelBounds.bottom - moveEvent.clientY;
      const clampedHeight = Math.min(maxHeight, Math.max(minHeight, height));
      const inputHeight = Math.max(minInputHeight, inputBounds.height + clampedHeight - sheetBounds.height);
      sheet.style.setProperty("--reader-notes-height", `${clampedHeight}px`);
      sheet.style.setProperty("--reader-notes-input-height", `${inputHeight}px`);
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

function toggleReaderNotesSheet(panel, section, reader, options = {}) {
  if (!panel || !section) return;
  const sheet = panel.querySelector(".reader-notes-sheet.is-open");
  const sectionID = sectionNoteKey(section.id);
  const target = options.target || annotationTargetForSection(section, reader);
  const blockID = normalizeAnnotationBlockID(target.blockID);
  if (
    sheet?.dataset.sectionId === sectionID &&
    normalizeAnnotationBlockID(sheet?.dataset.blockId) === blockID
  ) {
    closeReaderNotesSheet(panel, reader);
    return;
  }
  openReaderNotesSheet(panel, section, reader, { ...options, target });
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
  const projectButton = sheet.querySelector(".reader-notes-project-action");
  const linkButton = sheet.querySelector(".reader-notes-link-action");
  const researchButton = sheet.querySelector(".reader-notes-research-action");
  const sectionWrapper = panel.querySelector(`.chapter-section[data-section-id="${CSS.escape(sectionID)}"]`);
  const sectionPayload = {
    codeVersion: target.codeVersion,
    sectionID: section.id,
    sectionNumber: section.sectionNumber,
    title: section.title,
    codePrefix: reader?.codePrefix || "BC",
    chapterID: reader?.chapterID || "",
    chapterNumber: section.chapterNumber || "",
    blockID,
    blockLabel: target.blockLabel || ""
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
        const opened = await openReaderNotesProjectPicker(sheet, sectionPayload);
        if (!opened) return;
        bookmarkButton.classList.add("is-saved");
        bookmarkButton.setAttribute("aria-pressed", "true");
        bookmarkButton.setAttribute("aria-label", "Manage saved projects");
        bookmarkButton.title = "Manage saved projects";
        bookmarkButton.innerHTML = `${bookmarkIconSVG(true)}<span class="sr-only">Manage saved projects</span>`;
      } catch (error) {
        const message = error.message || "Could not update this saved section.";
        bookmarkButton.title = message;
        bookmarkButton.classList.add("has-error");
        presentWorkspaceIssue(message);
      } finally {
        bookmarkButton.disabled = false;
      }
    };
  }
  if (projectButton) {
    projectButton.disabled = false;
    projectButton.title = "Add section to a Project";
    projectButton.onclick = async () => {
      projectButton.disabled = true;
      try {
        if (!hasCapability("projects")) {
          await presentPlanLimitNotice(
            "Projects require Pro",
            "Upgrade to Pro to organize saved code in Project workspaces."
          );
          return;
        }
        await openReaderNotesProjectPicker(sheet, sectionPayload);
        refreshReaderSectionProjectContexts(section.id);
      } catch (error) {
        presentWorkspaceIssue(error.message || "Could not open Projects.");
      } finally {
        projectButton.disabled = false;
      }
    };
  }
  if (linkButton) {
    const sectionURL = sharedSectionURL(section.id);
    linkButton.textContent = "Copy link";
    linkButton.disabled = !sectionURL;
    linkButton.title = sectionURL ? "Copy shareable section link" : "No shareable link is available for this section";
    linkButton.onclick = async () => {
      if (!sectionURL) return;
      linkButton.disabled = true;
      const copied = await copyTextToClipboard(sectionURL).catch(() => false);
      linkButton.textContent = copied ? "Copied" : "Copy failed";
      linkButton.title = copied ? "Section link copied" : "Could not copy section link";
      window.setTimeout(() => {
        if (!linkButton.isConnected || sheet.dataset.sectionId !== sectionID) return;
        linkButton.textContent = "Copy link";
        linkButton.title = "Copy shareable section link";
        linkButton.disabled = false;
      }, 1600);
    };
  }
  if (researchButton) {
    researchButton.disabled = !sectionWrapper ||
      String(reader?.codePrefix || "").toUpperCase() === zoningCodePrefix;
    researchButton.title = researchButton.disabled
      ? "Research requires enacted code text with stable section identifiers"
      : "Start Research with this section as selected evidence";
    researchButton.onclick = () => selectReaderSectionForResearch(sectionWrapper);
  }

  const input = sheet.querySelector(".reader-notes-input");
  const projectsHost = sheet.querySelector(".reader-notes-projects");
  const tagsHost = sheet.querySelector(".reader-notes-tags");
  sheet.dataset.sectionId = sectionID;
  sheet.dataset.blockId = blockID;
  sheet.__annotationTarget = target;
  if (!wasOpen) {
    sheet.style.setProperty("--reader-notes-height", "var(--reader-notes-default-height)");
    sheet.style.setProperty("--reader-notes-input-height", "120px");
  }
  removeReaderNotesProjectPicker(sheet);
  input.value = noteValueForTarget(section.id, blockID);
  input.setAttribute("aria-label", `Note for ${sectionDisplayTitle(section.sectionNumber, section.title)}`);
  renderAnnotationProjectEditor(projectsHost, target, sectionPayload, {
    onChange: () => {
      if (state.utilities.saved) renderWorkspace();
    }
  });
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
  renderReaderTrust(panel, reader);
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
    const offscreenToTopButton = panel?.querySelector(".reader-to-top");
    offscreenToTopButton?.classList.remove("is-visible");
    offscreenToTopButton?.setAttribute("aria-hidden", "true");
    if (offscreenToTopButton) offscreenToTopButton.tabIndex = -1;
    return;
  }
  const content = panel.querySelector(".reader-content");
  const indicator = panel.querySelector(".reader-scroll-indicator");
  const thumb = panel.querySelector(".reader-scroll-thumb");
  const progress = panel.querySelector(".reader-reading-progress");
  const progressValue = panel.querySelector(".reader-reading-progress-value");
  const toTopButton = panel.querySelector(".reader-to-top");
  if (!content) return;
  const scrollable = Math.max(0, content.scrollHeight - content.clientHeight);
  const scrollProgress = scrollable > 1
    ? Math.min(Math.max(content.scrollTop / scrollable, 0), 1)
    : 0;
  progressValue?.style.setProperty("--reader-reading-progress", String(scrollProgress));
  progress?.setAttribute("aria-valuenow", String(Math.round(scrollProgress * 100)));
  const showToTop = scrollable > 1 &&
    content.scrollTop > Math.min(240, Math.max(120, content.clientHeight * 0.25));
  if (toTopButton) {
    toTopButton.classList.toggle("is-visible", showToTop);
    toTopButton.setAttribute("aria-hidden", String(!showToTop));
    toTopButton.tabIndex = showToTop ? 0 : -1;
  }
  if (!indicator || !thumb) return;
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
  const toTopButton = panel.querySelector(".reader-to-top");
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
  toTopButton?.addEventListener("click", () => {
    content.scrollTo({ top: 0, behavior: "smooth" });
  });
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
  if (!element || !source.sectionID || String(source.codePrefix || "").toUpperCase() === "ZR") {
    return element;
  }
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
  let targetReader = state.readers.find((reader) =>
    reader.id !== sourceReader.id &&
    reader.referenceSourceReaderID === sourceReader.id
  );
  const canAddReader = isProAccount() || state.readers.length < 2;
  if (!targetReader && canAddReader) {
    targetReader = newReaderState({
      ...readerFieldsForSectionDetail(detail),
      referenceSourceReaderID: sourceReader.id
    });
    state.readers.push(targetReader);
  } else {
    targetReader = targetReader ||
      state.readers.find((reader) => reader.id !== sourceReader.id) ||
      sourceReader;
    Object.assign(targetReader, readerFieldsForSectionDetail(detail), {
      referenceSourceReaderID: sourceReader.id,
      savedSourcePaneID: "",
      projectSavedSourceKey: ""
    });
    Object.keys(searchLinkedReadersBySearch()).forEach((searchID) => {
      if (state.searchLinkedReaders[searchID] === targetReader.id) {
        delete state.searchLinkedReaders[searchID];
      }
    });
  }
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
  const dragHandle = panel.querySelector(".pane-drag-handle");
  const referenceSourceButton = panel.querySelector(".reader-reference-source");
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
  const recentlyViewedSearchID = String(reader.recentlyViewedSourceSearchID || "").trim();
  const isRecentlyViewedLinkedReader = Boolean(
    recentlyViewedSearchID &&
    searchLinkedReadersBySearch()[recentlyViewedSearchID] === reader.id
  );
  const referenceSourceReader = state.readers.find((item) => item.id === reader.referenceSourceReaderID);

  panel.dataset.readerId = reader.id;
  panel.classList.toggle("is-recently-viewed-linked-reader", isRecentlyViewedLinkedReader);
  reader.codePrefix = reader.codePrefix || "BC";
  applyCodeTheme(panel, reader);
  renderReaderTrust(panel, reader);
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
  referenceSourceButton.hidden = !referenceSourceReader;
  if (referenceSourceReader) {
    referenceSourceButton.title = "Return to source Reader";
    referenceSourceButton.addEventListener("click", () => {
      const sourcePaneID = paneIDForReader(referenceSourceReader);
      scrollPaneIntoView(sourcePaneID);
      track
        .querySelector(`.workspace-panel[data-pane-id="${CSS.escape(sourcePaneID)}"] .code-select`)
        ?.focus({ preventScroll: true });
    });
  }
  typographyToggle.closest(".reader-typography-menu").hidden = isRecentlyViewedLinkedReader;
  internalSearchButton.hidden = isRecentlyViewedLinkedReader;
  dragHandle.hidden = isRecentlyViewedLinkedReader;
  internalSearchBox.hidden = true;
  internalSearchInput.value = reader.internalSearchQuery || "";
  internalSearchClearButton.hidden = !internalSearchInput.value.trim();
  if (options.isSearchResult) {
    closeButton.hidden = false;
  } else {
    closeButton.hidden = false;
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
    reader.codeVersion = syncCodeVersionForPrefix(reader.codePrefix);
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
      state.readers.forEach((item) => {
        if (item.referenceSourceReaderID === reader.id) item.referenceSourceReaderID = "";
      });
      Object.keys(searchLinkedReadersBySearch()).forEach((searchID) => {
        if (state.searchLinkedReaders[searchID] === reader.id) delete state.searchLinkedReaders[searchID];
      });
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
  panel.dataset.readerContentKey = readerContentScrollKey(reader);

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
  const searchedAt = Date.now();
  state.recentSearches = normalizeSearchHistory([
    trimmed,
    ...(state.recentSearches || []).filter((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0)
  ], recentSearchLimit);
  state.recentSearchHistory = normalizeRecentSearchHistory([
    { query: trimmed, searchedAt },
    ...(state.recentSearchHistory || []).filter((item) =>
      item.query.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0
    )
  ], recentSearchLimit);
  state.recentActivityUpdatedAt = new Date().toISOString();
  saveWorkspaceState();
  scheduleRecentSearchContinuitySync();
}

function isSearchPinned(query) {
  const trimmed = String(query || "").trim();
  return Boolean(trimmed) && (state.pinnedSearches || []).some((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) === 0);
}

function unpinSearch(query) {
  const trimmed = String(query || "").trim();
  state.pinnedSearches = (state.pinnedSearches || []).filter((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0);
  saveWorkspaceState();
}

function removeRecentSearch(query) {
  const trimmed = String(query || "").trim();
  state.recentSearches = (state.recentSearches || []).filter((item) => item.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0);
  state.recentSearchHistory = (state.recentSearchHistory || []).filter((item) =>
    item.query.localeCompare(trimmed, undefined, { sensitivity: "accent" }) !== 0
  );
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
    if (!entries.some((candidate) => recentViewIdentity(candidate) === recentViewIdentity(entry))) entries.push(entry);
  });
  return entries
    .filter((entry) => Number(entry?.sectionID) > 0)
    .map((entry) => ({ ...entry, codePrefix: recentViewCodePrefix(entry) }))
    .slice(0, recentViewLimit);
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
  const filterMenu = filterRail.closest(".code-filter-menu");
  const summary = panel.querySelector(".search-result-summary");
  const summaryCopy = panel.querySelector(".search-result-summary-copy");
  const clearButton = panel.querySelector(".search-clear-button");
  filterMenu.hidden = !query;
  updateCodeFilterMenu(filterRail, instance);
  clearButton.hidden = !query;
  summary.hidden = !query;
  const scope = selectedPrefixes.length === 0
    ? "All Codes"
    : selectedPrefixes.length === 1
      ? codeDisplayLabel(selectedPrefixes[0])
      : `${selectedPrefixes.length} code books`;
  if (resultCount === null) {
    summaryCopy.textContent = `Searching in ${scope}`;
    return;
  }
  const countLabel = `${resultCount.toLocaleString()} ${resultCount === 1 ? "result" : "results"} in ${scope}`;
  summaryCopy.textContent = countLabel;
}

async function hydrateSearchRecentlyViewedEntries(entries, options = {}) {
  const hydratedEntries = await Promise.all(entries.map(async (entry) => {
    if (String(entry?.previewText || "").trim()) return entry;
    try {
      const detail = { ...entry };
      const { chapter, section } = await resolveSectionDetail(detail);
      const rawPreview = sectionPlainText(section);
      const sectionNumber = section?.sectionNumber || detail.sectionNumber || entry.sectionNumber || "";
      const sectionTitle = section?.title || detail.title || entry.title || "";
      const titleWithoutNumber = stripLeadingSectionNumber(sectionTitle, sectionNumber);
      const isNestedListParagraph = !rawPreview && Boolean(titleWithoutNumber);
      const previewSource = rawPreview || (
        isNestedListParagraph
          ? titleWithoutNumber
          : entry.previewText || ""
      );
      const hydratedEntry = {
        ...entry,
        codePrefix: detail.codePrefix || chapter?.codePrefix || entry.codePrefix || "BC",
        chapterID: detail.chapterID || chapter?.id || entry.chapterID || "",
        chapterNumber: detail.chapterNumber || chapter?.chapterNumber || entry.chapterNumber || "",
        sectionNumber,
        title: sectionTitle || "Section",
        isNestedListParagraph,
        previewText: snippetWithoutDuplicateTitle({
          sectionNumber,
          title: sectionTitle,
          snippet: previewSource
        }).replace(/\s+/g, " ").trim().slice(0, 360)
      };
      options.onEntry?.(hydratedEntry);
      return hydratedEntry;
    } catch {
      return entry;
    }
  }));
  mergeRecentlyViewedDetails(hydratedEntries);
  return hydratedEntries;
}

function updateVisibleSearchHistoryEntry(panel, entry) {
  const identity = recentViewIdentity(entry);
  if (!identity) return;
  const tile = panel.querySelector(
    `.search-jump-tile[data-recent-view-identity="${CSS.escape(identity)}"]`
  );
  const preview = tile?.querySelector(".search-jump-preview");
  if (!preview || !entry.previewText) return;
  preview.textContent = entry.previewText;
  markResearchSelectable(preview, entry);
}

async function renderSearchHistory(panel, instance, options = {}) {
  const results = panel.querySelector(".search-results");
  const recentEntries = searchRecentlyViewedEntries();
  const recentSections = options.hydrate === false
    ? recentEntries
    : await hydrateSearchRecentlyViewedEntries(recentEntries, {
      onEntry: (entry) => updateVisibleSearchHistoryEntry(panel, entry)
    });
  if (String(instance?.query || "").trim()) return;
  const pinned = normalizeSearchHistory(state.pinnedSearches);
  const recentQueries = normalizeSearchHistory(state.recentSearches, recentSearchLimit)
    .filter((query) => !isSearchPinned(query));
  clear(results);
  results.classList.add("is-history");

  let jumpSection = null;
  if (recentSections.length) {
    const section = document.createElement("section");
    section.className = "search-history-section search-jump-section";
    section.id = `search-jump-${instance.id}`;
    const label = document.createElement("p");
    label.className = "section-label search-history-label";
    label.textContent = "Recently Viewed";
    const list = document.createElement("div");
    list.className = "search-history-list search-history-scroll-list search-jump-list";
    recentSections.forEach((entry) => {
      const tile = document.createElement("article");
      tile.className = `search-jump-tile code-theme-${codeTheme(entry.codePrefix || "BC")}`;
      tile.dataset.recentViewIdentity = recentViewIdentity(entry);
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "search-jump-open";
      const code = document.createElement("span");
      code.className = "search-jump-code";
      code.textContent = entry.codeSectionName || codeDisplayLabel(entry.codePrefix || "BC");
      const title = document.createElement("strong");
      title.textContent = entry.isNestedListParagraph
        ? String(entry.sectionNumber || "Paragraph").trim()
        : sectionDisplayTitle(entry.sectionNumber, entry.title, "Section");
      const preview = document.createElement("span");
      preview.className = "search-jump-preview";
      preview.textContent = entry.previewText || "";
      if (entry.previewText) markResearchSelectable(preview, entry);
      openButton.append(code, title, preview);
      openButton.addEventListener("click", () => {
        if (window.getSelection && String(window.getSelection()).trim()) return;
        void openSavedItemInReader(entry, paneIDForUtilityInstance(instance), {
          recentlyViewedSearchID: instance.id
        });
      });
      tile.append(openButton);
      list.append(tile);
    });
    section.append(label, list);
    jumpSection = section;
  }

  const createHistorySection = (title, queries, pinnedSection) => {
    if (!queries.length) return null;
    const section = document.createElement("section");
    section.className = "search-history-section";
    section.classList.toggle("is-pinned", pinnedSection);
    section.classList.toggle("is-recent", !pinnedSection);
    if (!pinnedSection) section.id = `search-recent-${instance.id}`;
    const label = document.createElement("p");
    label.className = "section-label search-history-label";
    label.textContent = title;
    const list = document.createElement("div");
    list.className = "search-history-list";
    if (!pinnedSection) list.classList.add("search-history-scroll-list");
    section.append(label, list);
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
      row.append(applyButton);
      if (pinnedSection) {
        const unpinButton = document.createElement("button");
        unpinButton.type = "button";
        unpinButton.className = "search-history-action is-active";
        unpinButton.setAttribute("aria-label", "Unpin search");
        unpinButton.innerHTML = searchHistoryIconSVG("pin");
        unpinButton.addEventListener("click", () => {
          unpinSearch(query);
          renderSearchHistory(panel, instance);
        });
        row.append(unpinButton);
      } else {
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
      list.append(row);
    });
    return section;
  };

  const pinnedSection = createHistorySection("Pinned", pinned, true);
  const recentSection = createHistorySection("Recent Searches", recentQueries, false);
  if (jumpSection && recentSection) {
    results.classList.add("is-split");
    const upperPane = document.createElement("div");
    upperPane.className = "search-history-pane search-history-upper";
    upperPane.append(jumpSection);
    if (pinnedSection) upperPane.append(pinnedSection);
    const divider = document.createElement("div");
    divider.className = "search-history-divider";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-label", "Resize Recently Viewed and Recent Searches");
    divider.setAttribute("aria-orientation", "horizontal");
    divider.setAttribute("aria-controls", `${jumpSection.id} ${recentSection.id}`);
    divider.tabIndex = 0;
    const lowerPane = document.createElement("div");
    lowerPane.className = "search-history-pane search-history-lower";
    lowerPane.append(recentSection);
    results.append(upperPane, divider, lowerPane);
    bindSearchHistoryDivider(results, divider, instance);
  } else {
    if (jumpSection) results.append(jumpSection);
    if (pinnedSection) results.append(pinnedSection);
    if (recentSection) results.append(recentSection);
  }
}

function hydrateSearchPanelWhenConnected(panel, searchInstance, attempt = 0) {
  if (!panel.isConnected) {
    if (attempt < 120) {
      requestAnimationFrame(() => hydrateSearchPanelWhenConnected(panel, searchInstance, attempt + 1));
    }
    return;
  }
  void (async () => {
    const hasQuery = Boolean(String(searchInstance?.query || "").trim());
    const syncPromise = loadSyncedContent();
    await renderSearchResults(panel, searchInstance);
    if (!panel.isConnected) return;
    await syncPromise;
    if (!panel.isConnected || hasQuery) return;
    await renderSearchResults(panel, searchInstance);
  })();
}

function bindSearchHistoryDivider(results, divider, instance) {
  const applyRatio = (value) => {
    const ratio = normalizeSearchHistorySplitRatio(value);
    instance.historySplitRatio = ratio;
    results.style.setProperty("--search-history-upper-size", `${ratio * 100}%`);
    divider.setAttribute("aria-valuemin", "20");
    divider.setAttribute("aria-valuemax", "80");
    divider.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  };
  applyRatio(instance.historySplitRatio);

  const resize = (event) => {
    const bounds = results.getBoundingClientRect();
    if (!bounds.height) return;
    applyRatio((event.clientY - bounds.top) / bounds.height);
  };
  const endResize = (event) => {
    divider.classList.remove("is-dragging");
    document.body.classList.remove("is-resizing-search-history");
    divider.releasePointerCapture?.(event.pointerId);
    saveWorkspaceState();
    window.removeEventListener("pointermove", resize);
    window.removeEventListener("pointerup", endResize);
    window.removeEventListener("pointercancel", endResize);
  };

  divider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    divider.setPointerCapture?.(event.pointerId);
    divider.classList.add("is-dragging");
    document.body.classList.add("is-resizing-search-history");
    resize(event);
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  });
  divider.addEventListener("keydown", (event) => {
    const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const ratio = event.key === "Home"
      ? 0.2
      : event.key === "End"
        ? 0.8
        : normalizeSearchHistorySplitRatio(instance.historySplitRatio) + direction * 0.04;
    applyRatio(ratio);
    saveWorkspaceState();
  });
}

function bindHorizontalWheelScroll(element) {
  if (!element || element.dataset.horizontalWheelBound === "true") return;
  element.dataset.horizontalWheelBound = "true";
  element.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      const canScroll = element.scrollWidth > element.clientWidth;
      if (!canScroll) return;
      const delta = event.deltaX;
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
  const filterRail = panel.querySelector(".search-code-filter");
  applyPaneWeight(panel, paneID);
  input.value = searchInstance.query || "";
  renderSearchCodeFilter(filterRail, panel, searchInstance);
  wireCodeFilterMenu(filterRail, searchInstance);
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

  if (String(searchInstance.query || "").trim()) {
    renderSearchPlaceholder(panel.querySelector(".search-results"), {
      title: "Searching",
      body: "Checking section titles and code text."
    });
  } else {
    await renderSearchHistory(panel, searchInstance, { hydrate: false });
  }
  requestAnimationFrame(() => hydrateSearchPanelWhenConnected(panel, searchInstance));
  return panel;
}

function renderSearchCodeFilter(filterRail, panel, instance) {
  const searchInstance = normalizeSearchInstance(instance);
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
      updateCodeFilterMenu(filterRail, searchInstance);
      updateSearchDock(panel, searchInstance);
      renderSearchResults(panel, searchInstance);
    });
    filterRail.append(chip);
  });
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
    if (!query) await renderSearchHistory(panel, searchInstance);
    else renderSearchPlaceholder(results, { title: "Keep typing", body: "Enter at least two characters to search the code text." });
    return;
  }

  renderSearchPlaceholder(results, { title: "Searching", body: "Checking section titles and code text." });
  const codeQuery = selectedPrefixes.length ? `&code=${encodeURIComponent(selectedPrefixes.join(","))}` : "";
  const payload = await api(
    `/code/search?q=${encodeURIComponent(query)}${codeQuery}&limit=${searchResultPageSize}&offset=0`
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

  const resultCount = filteredResults.length;
  const totalResults = Number(payload.totalResults) || resultCount;
  updateSearchDock(panel, searchInstance, resultCount);
  appendSearchResultGroups(results, filteredResults, query, searchInstance);
  appendSearchLoadMore(results, {
    query,
    selectedPrefixes,
    nextOffset: Number(payload.nextOffset) || (payload.results || []).length,
    totalResults,
    hasMore: Boolean(payload.hasMore),
    searchInstance,
    panel
  });
}

function appendSearchResultGroups(results, searchResults, query, searchInstance) {
  const groups = new Map();
  searchResults.forEach((result) => {
    const prefix = result.codePrefix || "BC";
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(result);
  });

  Array.from(groups.entries()).forEach(([prefix, groupResults]) => {
    let group = results.querySelector(
      `.search-result-group[data-code-prefix="${CSS.escape(prefix)}"]`
    );
    if (!group) {
      group = document.createElement("section");
      group.className = "search-result-group";
      group.classList.add(`code-theme-${codeTheme(prefix)}`);
      group.dataset.codePrefix = prefix;
      const label = document.createElement("p");
      label.className = "section-label search-group-label";
      label.textContent = codeDisplayLabel(prefix);
      group.append(label);
      results.append(group);
    }
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
  });
}

function appendSearchLoadMore(results, options) {
  results.querySelector(".search-load-more")?.remove();
  if (!options.hasMore) return;
  const footer = document.createElement("section");
  footer.className = "search-load-more";
  const status = document.createElement("p");
  const visibleCount = results.querySelectorAll(".result-row").length;
  status.textContent = `${visibleCount.toLocaleString()} shown`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-load-more-button";
  button.textContent = "Show more";
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Loading…";
    const codeQuery = options.selectedPrefixes.length
      ? `&code=${encodeURIComponent(options.selectedPrefixes.join(","))}`
      : "";
    try {
      const payload = await api(
        `/code/search?q=${encodeURIComponent(options.query)}${codeQuery}` +
        `&limit=${searchResultPageSize}&offset=${encodeURIComponent(String(options.nextOffset))}`
      );
      if (
        options.searchInstance.query.trim() !== options.query ||
        normalizeSearchCodeFilters(options.searchInstance.codeFilters).join(",") !== options.selectedPrefixes.join(",")
      ) {
        return;
      }
      const nextResults = (payload.results || []).filter((result) =>
        (options.selectedPrefixes.length === 0 || options.selectedPrefixes.includes(result.codePrefix || "BC")) &&
        searchResultMatchesExactQuery(result, options.query)
      );
      footer.remove();
      appendSearchResultGroups(results, nextResults, options.query, options.searchInstance);
      const nextVisibleCount = results.querySelectorAll(".result-row").length;
      const totalResults = Number(payload.totalResults) || options.totalResults;
      updateSearchDock(options.panel, options.searchInstance, nextVisibleCount);
      appendSearchLoadMore(results, {
        ...options,
        nextOffset: Number(payload.nextOffset) || (options.nextOffset + (payload.results || []).length),
        totalResults,
        hasMore: Boolean(payload.hasMore)
      });
    } catch {
      button.disabled = false;
      button.textContent = "Try again";
      status.textContent = "More results could not be loaded.";
    }
  });
  footer.append(status, button);
  results.append(footer);
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
  if (detail.sectionID) {
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
          chapter = await fetchChapter(detail.chapterID);
        }
        section = {
          ...resolvedSection,
          id: resolvedSection.id || resolvedSection.sectionID || Number(detail.sectionID)
        };
      }
    } catch {
      // Fall through to text search for legacy records that are not addressable by ID.
    }
  }
  if (!section && detail.chapterID) {
    try {
      chapter = await fetchChapter(detail.chapterID, { includeBody: true });
      section = sectionTitleFromID(detail.sectionID, chapter);
    } catch {
      chapter = null;
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
  const codePrefix = detail.codePrefix || section?.codePrefix || "BC";
  return {
    codeVersion: syncCodeVersion(
      detail.codeVersion || section?.codeVersion || syncCodeVersionForPrefix(codePrefix)
    ),
    codePrefix,
    chapterID: detail.chapterID || section?.chapterID || "",
    chapterNumber: detail.chapterNumber || section?.chapterNumber || "",
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
  sectionPayload.chapterID ||= chapter?.id || "";
  sectionPayload.chapterNumber ||= chapter?.chapterNumber || "";
  const sectionTarget = {
    ...sectionPayload,
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
  } else if (bodyText) {
    const normalizedBodyText = bodyText.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const normalizedTitles = [section?.title, detail.title]
      .map((value) => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase())
      .filter(Boolean);
    if (!normalizedTitles.includes(normalizedBodyText)) {
      const paragraph = document.createElement("p");
      paragraph.textContent = bodyText;
      body.append(paragraph);
    }
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
  const projectsHost = document.createElement("section");
  projectsHost.className = "section-detail-projects";
  renderAnnotationProjectEditor(projectsHost, sectionTarget, sectionPayload, {
    onChange: () => {
      saveState.textContent = "Saved locally";
    }
  });
  const tagsHost = document.createElement("section");
  tagsHost.className = "section-detail-tags";
  renderAnnotationTagEditor(tagsHost, sectionTarget, {
    onChange: () => {
      saveState.textContent = "Saved locally";
    }
  });
  notes.append(notesHeader, textareaWrap, projectsHost, tagsHost);
  panel.__annotationTarget = sectionTarget;
  panel.__sectionPayload = sectionPayload;

  backButton.addEventListener("click", () => {
    closeLinkedReaderForSearch(searchID);
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
      const persisted = await persistSectionBookmark(sectionPayload, !shouldRemove);
      if (persisted === false) {
        saveButton.classList.toggle("is-saved", shouldRemove);
        saveButton.setAttribute("aria-pressed", String(shouldRemove));
        saveButton.title = shouldRemove ? "Remove bookmark" : "Save bookmark";
        saveButton.setAttribute("aria-label", saveButton.title);
        saveButton.innerHTML = bookmarkIconSVG(shouldRemove);
        return;
      }
      await renderWorkspace();
    } catch (error) {
      saveButton.classList.toggle("is-saved", shouldRemove);
      saveButton.setAttribute("aria-pressed", String(shouldRemove));
      saveButton.innerHTML = bookmarkIconSVG(shouldRemove);
      saveButton.classList.add("has-error");
      const message = error.message || "Could not update this saved section.";
      saveButton.title = message;
      saveButton.setAttribute("aria-label", message);
      presentWorkspaceIssue(message);
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
  if (instance.key === "search") closeLinkedReaderForSearch(instance.id);
  if (instance.key === "saved") closeLinkedReaderForSavedPane(paneID);
  state.utilityInstances = (state.utilityInstances || []).filter((pane) => pane.id !== instance.id);
  if (instance.key === "search") {
    delete sectionDetailsBySearch()[instance.id];
    delete sectionDetailAnchorsBySearch()[instance.id];
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
    row.textContent = researchDisplayText(item);
    list.append(row);
  });
  container.append(heading, list);
}

function researchDisplayText(value) {
  return String(value || "")
    .replace(/\s*[\[(][^)\]]*\b(?:SECTION_ID|PASSAGE_IDS?)\b[^)\]]*[\])]/gi, "")
    .replace(/\s*(?:[;,]\s*)?\b(?:SECTION_ID|PASSAGE_IDS?)\s*:?\s*[A-Za-z0-9._:-]+(?:\s*,\s*[A-Za-z0-9._:-]+)*/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[;,]\s*$/, "")
    .trim();
}

function researchDisplayList(values) {
  return (values || []).map(researchDisplayText).filter(Boolean);
}

function appendResearchSupportedPoints(container, points) {
  if (!points?.length) return;
  const heading = document.createElement("strong");
  heading.className = "research-result-subheading";
  heading.textContent = "What the selected evidence establishes";
  const list = document.createElement("ol");
  list.className = "research-supported-points";
  points.forEach((point) => {
    const row = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = researchDisplayText(point.heading);
    const explanation = document.createElement("p");
    explanation.textContent = researchDisplayText(point.explanation);
    row.append(title, explanation);
    list.append(row);
  });
  container.append(heading, list);
}

function appendResearchUnresolved(container, result) {
  const groups = [
    ["Project facts to verify", result.missingFacts],
    ["Limits of this answer", result.evidenceLimitations]
  ].filter(([, items]) => items?.length);
  if (!groups.length) return;

  const heading = document.createElement("strong");
  heading.className = "research-result-subheading";
  heading.textContent = "What remains unresolved";
  const section = document.createElement("section");
  section.className = "research-unresolved";
  groups.forEach(([title, items]) => {
    const group = document.createElement("div");
    const groupHeading = document.createElement("strong");
    groupHeading.textContent = title;
    const list = document.createElement("ul");
    list.className = "research-result-list";
    items.forEach((item) => {
      const row = document.createElement("li");
      row.textContent = researchDisplayText(item);
      list.append(row);
    });
    group.append(groupHeading, list);
    section.append(group);
  });
  container.append(heading, section);
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
  const answerHeading = document.createElement("strong");
  answerHeading.className = "research-result-subheading";
  answerHeading.textContent = "Answer";
  const answer = document.createElement("p");
  answer.className = "research-result-answer";
  answer.textContent = researchDisplayText(result.conclusion);
  const explanation = document.createElement("p");
  explanation.className = "research-result-application";
  explanation.textContent = researchDisplayText(result.explanation);
  card.append(answerHeading, answer);
  appendResearchSupportedPoints(card, result.supportedPoints);
  const explanationHeading = document.createElement("strong");
  explanationHeading.className = "research-result-subheading";
  explanationHeading.textContent = result.supportedPoints?.length
    ? "Practical application"
    : "Explanation";
  card.append(explanationHeading, explanation);
  appendResearchList(card, "Assumptions used", result.assumptions);
  appendResearchUnresolved(card, result);
  appendResearchList(card, "Related evidence to add", result.additionalEvidenceNeeded);

  const disclaimer = document.createElement("p");
  disclaimer.className = "research-disclaimer";
  disclaimer.textContent = result.disclaimer;
  card.append(disclaimer);
  container.append(card);
  if (options.message) renderResearchFeedback(container, options.message, options.conversationID);
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

async function loadOrganizationWorkspace(options = {}) {
  const account = activeAccount();
  if (!account) {
    organizationWorkspace = { organizations: [] };
    return organizationWorkspace;
  }
  if (options.force) {
    organizationWorkspace = null;
    organizationLoadPromise = null;
  }
  if (organizationWorkspace) return organizationWorkspace;
  if (!organizationLoadPromise) {
    organizationLoadPromise = postResearch("/organizations/list")
      .then((payload) => {
        organizationWorkspace = {
          organizations: Array.isArray(payload.organizations) ? payload.organizations : []
        };
        return organizationWorkspace;
      })
      .catch((error) => {
        organizationWorkspace = { organizations: [], error: error.message };
        return organizationWorkspace;
      })
      .finally(() => {
        organizationLoadPromise = null;
      });
  }
  return organizationLoadPromise;
}

function sharedProjectsFromOrganizations(workspace = organizationWorkspace) {
  return (workspace?.organizations || []).flatMap((organization) =>
    (organization.projects || []).map((project) => ({
      ...project,
      id: project.id,
      clientID: project.id,
      sharedOrganizationID: organization.id,
      sharedOrganizationName: organization.name,
      sharedRole: project.role || organization.role,
      sharedPermissions: project.permissions || organization.permissions || [],
      sharedOnly: true
    }))
  );
}

async function projectsWithOrganizationAccess(projects = []) {
  const workspace = await loadOrganizationWorkspace();
  const sharedProjects = sharedProjectsFromOrganizations(workspace);
  const sharedByID = new Map(sharedProjects.map((project) => [String(project.id), project]));
  const localIDs = new Set();
  const combined = projects.map((project) => {
    const identity = projectDetailKey(project);
    localIDs.add(identity);
    const shared = sharedByID.get(identity);
    return shared ? { ...project, ...shared, sharedOnly: false } : project;
  });
  sharedProjects.forEach((project) => {
    if (!localIDs.has(projectDetailKey(project))) combined.push(project);
  });
  return combined;
}

async function downloadProjectReportFile(projectID, file, title = "Permitext Project Report") {
  const account = activeAccount();
  if (!account) throw new Error("Sign in from Settings to download private Project Reports.");
  const response = await fetch("/reports/files/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${account.sessionToken}`
    },
    body: JSON.stringify({
      auth: { accountUserID: account.userID },
      projectID,
      generatedReportID: file.generatedReportID
    })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "The Report PDF could not be downloaded.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeTitle = String(title || "Permitext Project Report")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "Permitext-Project-Report";
  anchor.href = url;
  anchor.download = `${safeTitle}-${file.format || "report"}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
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
  researchConversationList = (payload.conversations || []).slice().sort((left, right) =>
    String(right.createdAt || "").localeCompare(String(left.createdAt || "")) ||
    String(left.id || "").localeCompare(String(right.id || ""))
  );
  researchUsage = usagePayload.usage || null;
  return researchConversationList;
}

async function closeResearchWorkspace() {
  const projectPaneIDs = openProjectDetails().map((detail) => paneIDForProjectDetail(detail));
  state.utilities.analysis = false;
  state.researchConversationID = "";
  activeResearchConversation = null;
  delete state.paneWeights["utility:analysis"];
  Object.keys(state.paneWeights).filter((id) => id.startsWith("research:conversation:")).forEach((id) => delete state.paneWeights[id]);
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== "utility:analysis" && !id.startsWith("research:conversation:"));
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: projectPaneIDs });
}

async function closeResearchConversation() {
  const paneID = paneIDForResearchConversation();
  const projectPaneIDs = openProjectDetails().map((detail) => paneIDForProjectDetail(detail));
  state.researchConversationID = "";
  activeResearchConversation = null;
  if (paneID) delete state.paneWeights[paneID];
  state.paneOrder = (state.paneOrder || []).filter((id) => id !== paneID);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: projectPaneIDs });
}

async function openResearchConversation(conversationID, options = {}) {
  state.utilities.analysis = true;
  state.researchConversationID = conversationID;
  const paneID = paneIDForResearchConversation(conversationID);
  state.paneWeights["utility:analysis"] ||= defaultPaneWidthForID("utility:analysis");
  state.paneWeights[paneID] ||= defaultPaneWidthForID(paneID);
  placePaneAfter("utility:analysis", paneID);
  saveWorkspaceState();
  const projectPaneIDs = openProjectDetails().map((detail) => paneIDForProjectDetail(detail));
  await transitionWorkspace("utility", {
    refreshPaneIDs: options.refreshList
      ? ["utility:analysis", paneID, ...projectPaneIDs]
      : [paneID, ...projectPaneIDs]
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

function applyProjectDerivedPaneTheme(panel, projectID) {
  const normalizedProjectID = String(projectID || "");
  if (!normalizedProjectID) return false;
  const project = visibleProjectRecords(currentContentSummary().projects || [])
    .find((item) => researchProjectID(item) === normalizedProjectID);
  if (!project) return false;
  panel.classList.add("project-derived-panel");
  panel.dataset.projectId = normalizedProjectID;
  panel.style.setProperty("--project-color", projectColor(project));
  return true;
}

function preferredResearchProjectID(conversation = activeResearchConversation) {
  if (conversation?.primaryProjectID) return conversation.primaryProjectID;
  const projects = researchProjects();
  const openProjectIDs = openProjectDetails().map((detail) => projectDetailKey(detail));
  return openProjectIDs.find((projectID) =>
    projects.some((project) => researchProjectID(project) === projectID)
  ) || "";
}

function researchProjectChoices({
  value = "",
  includeUnassigned = true,
  unassignedLabel = "Unassigned — no Project context"
} = {}) {
  const choices = [];
  if (includeUnassigned) {
    choices.push({ value: "", label: unassignedLabel });
  }
  researchProjects().forEach((project) => {
    choices.push({
      value: researchProjectID(project),
      label: readableProjectName(project)
    });
  });
  if (value && !choices.some((choice) => choice.value === value)) {
    const historicalProject = visibleProjectRecords(currentContentSummary().projects || [])
      .find((project) => researchProjectID(project) === value);
    if (historicalProject) {
      choices.push({
        value,
        label: `${readableProjectName(historicalProject)} (Archived)`
      });
    }
  }
  return choices;
}

function createResearchProjectSelect({
  value = "",
  includeUnassigned = true,
  unassignedLabel = "Unassigned — no Project context",
  ariaLabel = "Project"
} = {}) {
  const select = document.createElement("select");
  select.className = "research-project-select";
  select.setAttribute("aria-label", ariaLabel);
  const choices = researchProjectChoices({ value, includeUnassigned, unassignedLabel });
  choices.forEach((choice) => {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    select.append(option);
  });
  select.value = value && choices.some((choice) => choice.value === value) ? value : "";
  return select;
}

async function assignResearchConversationProject(conversation, targetProjectID, options = {}) {
  try {
    return await postResearch("/research/conversations/assign-project", {
      conversationID: conversation.id,
      projectID: targetProjectID
    });
  } catch (error) {
    if (error.payload?.code !== "RESEARCH_PROJECT_REVIEW_REQUIRED") throw error;
    const confirmed = await confirmWebWarning(
      targetProjectID ? "Move Research to this Project?" : "Unassign this Research?",
      targetProjectID
        ? "Existing answers remain immutable in their original Project history. Additional Research facts will be cleared, and you must review the new Project context before asking another question."
        : "Existing answers remain immutable in their original Project history. The conversation will no longer contribute new activity to a Project.",
      {
        confirmLabel: targetProjectID ? "Move and review" : "Unassign",
        container: options.warningContainer
      }
    );
    if (!confirmed) return null;
    return postResearch("/research/conversations/assign-project", {
      conversationID: conversation.id,
      projectID: targetProjectID,
      confirmMove: true
    });
  }
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
    if (state.researchEvidenceSplitRatios) {
      delete state.researchEvidenceSplitRatios[conversation.id];
    }
    await refreshResearchConversationList();
    saveWorkspaceState();
    await transitionWorkspace("utility", { refreshPaneIDs: ["utility:analysis"] });
  } catch (error) {
    button.disabled = false;
    await showWebNotice("Conversation not deleted", error.message);
  }
}

function evidenceCandidateCitation(candidate) {
  return `${candidate.codePrefix || "BC"} § ${candidate.sectionNumber || candidate.sectionID}`;
}

function formattedByteLength(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "size unavailable";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000).toLocaleString()} KB`;
  return `${bytes.toLocaleString()} bytes`;
}

function evidenceCandidateVisualRequirement(candidate) {
  return candidate.sourceReviewRequirements?.find((item) => item.kind === "visual-source") || null;
}

function evidenceCandidatePreparationReady(candidate) {
  const requirements = candidate.sourceReviewRequirements || [];
  if (requirements.some((item) => item.kind !== "visual-source")) return false;
  const visualRequirement = evidenceCandidateVisualRequirement(candidate);
  if (!visualRequirement) return candidate.preparationEligible !== false;
  const selected = Array.isArray(candidate.selectedVisualSourceIDs)
    ? candidate.selectedVisualSourceIDs
    : [];
  const maximumSelections = Number(visualRequirement.maximumSelections || 4);
  return (
    selected.length >= 1 &&
    selected.length <= maximumSelections &&
    candidate.visualReviewConfirmed === true
  );
}

function renderEvidenceDiscovery(container) {
  if (
    !hasCapability("evidence-discovery") &&
    researchUsage?.evidenceDiscoveryEnabled !== true
  ) return;
  if (
    activeEvidenceDiscovery &&
    activeEvidenceDiscovery.accountUserID !== activeAccount()?.userID
  ) {
    activeEvidenceDiscovery = null;
  }

  const section = document.createElement("section");
  section.className = "evidence-discovery";
  const header = document.createElement("header");
  header.className = "evidence-discovery-header";
  const eyebrow = document.createElement("p");
  eyebrow.className = "section-label";
  eyebrow.textContent = "Private beta · candidate retrieval";
  const heading = document.createElement("h3");
  heading.textContent = "Find Relevant Evidence";
  const copy = document.createElement("p");
  copy.textContent = "Describe the project question. Permitext searches the enacted library and proposes passages for your review; it does not generate an answer or approve evidence.";
  header.append(eyebrow, heading, copy);

  const form = document.createElement("form");
  form.className = "evidence-discovery-form";
  const questionLabel = document.createElement("label");
  const questionLabelText = document.createElement("span");
  questionLabelText.textContent = "Project question";
  const question = document.createElement("textarea");
  question.rows = 4;
  question.maxLength = 2_000;
  question.placeholder = "Example: Can a six-story R-2 building use one exit stair?";
  question.value = activeEvidenceDiscovery?.question || researchQuestionDraft;
  questionLabel.append(questionLabelText, question);
  const controls = document.createElement("div");
  controls.className = "evidence-discovery-form-controls";
  const projectSelect = createResearchProjectSelect({
    value: activeEvidenceDiscovery?.projectID || preferredResearchProjectID(),
    unassignedLabel: "Unassigned — no Project context",
    ariaLabel: "Project for candidate evidence"
  });
  const findButton = document.createElement("button");
  findButton.className = "evidence-discovery-find";
  findButton.type = "submit";
  findButton.textContent = "Find Candidate Evidence";
  findButton.disabled = question.value.trim().length < 3;
  controls.append(projectSelect, findButton);
  projectSelect.addEventListener("change", () => {
    if (activeEvidenceDiscovery) {
      activeEvidenceDiscovery.projectID = projectSelect.value;
    }
  });
  const formStatus = document.createElement("p");
  formStatus.className = "evidence-discovery-status";
  question.addEventListener("input", () => {
    findButton.disabled = question.value.trim().length < 3;
  });
  form.append(questionLabel, controls, formStatus);

  const results = document.createElement("section");
  results.className = "evidence-discovery-results";

  const renderResults = () => {
    clear(results);
    const discovery = activeEvidenceDiscovery;
    if (!discovery?.response) return;
    const response = discovery.response;
    const candidates = response.candidates || [];
    const approved = candidates.filter((candidate) =>
      candidate.reviewState === "approved" &&
      evidenceCandidatePreparationReady(candidate)
    );
    const summary = document.createElement("div");
    summary.className = "evidence-discovery-summary";
    const summaryText = document.createElement("strong");
    summaryText.textContent = `${candidates.length} unapproved ${candidates.length === 1 ? "candidate" : "candidates"}`;
    const searched = document.createElement("span");
    searched.textContent = `${Number(response.searchedSectionCount || 0).toLocaleString()} enacted sections searched`;
    summary.append(summaryText, searched);
    results.append(summary);

    if (response.coverageLimitations?.length) {
      const limitations = document.createElement("aside");
      limitations.className = "evidence-discovery-limitations";
      const limitationsHeading = document.createElement("strong");
      limitationsHeading.textContent = "Review boundary";
      const list = document.createElement("ul");
      response.coverageLimitations.forEach((limitation) => {
        const item = document.createElement("li");
        item.textContent = limitation.text;
        list.append(item);
      });
      limitations.append(limitationsHeading, list);
      results.append(limitations);
    }

    if (response.outsideCurrentLibrary?.length) {
      const outside = document.createElement("aside");
      outside.className = "evidence-discovery-outside";
      const outsideHeading = document.createElement("strong");
      outsideHeading.textContent = "Outside Construction Code Research";
      const outsideList = document.createElement("ul");
      response.outsideCurrentLibrary.forEach((outsideItem) => {
        const item = document.createElement("li");
        const copy = document.createElement("span");
        copy.textContent = outsideItem.text;
        item.append(copy);
        if (outsideItem.sourceURL) {
          const link = document.createElement("a");
          link.href = outsideItem.sourceURL;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = `Open ${outsideItem.sourceName || outsideItem.label || "official source"}`;
          item.append(link);
        }
        outsideList.append(item);
      });
      outside.append(outsideHeading, outsideList);
      results.append(outside);
    }

    const tray = document.createElement("section");
    tray.className = "evidence-candidate-tray";
    candidates.forEach((candidate) => {
      const reviewState = candidate.reviewState || "candidate";
      const card = document.createElement("article");
      card.className = `evidence-candidate-card is-${reviewState}`;
      const cardHeader = document.createElement("div");
      cardHeader.className = "evidence-candidate-heading";
      const citationWrap = document.createElement("div");
      const rank = document.createElement("span");
      rank.className = "evidence-candidate-rank";
      rank.textContent = `#${candidate.rank}`;
      const citation = document.createElement("strong");
      citation.textContent = evidenceCandidateCitation(candidate);
      const title = document.createElement("p");
      title.textContent = candidate.title || "Enacted section";
      citationWrap.append(citation, title);
      const stateBadge = document.createElement("span");
      stateBadge.className = "evidence-candidate-state";
      const visualRequirement = evidenceCandidateVisualRequirement(candidate);
      const preparationReady = evidenceCandidatePreparationReady(candidate);
      stateBadge.textContent = visualRequirement && preparationReady
        ? reviewState === "approved"
          ? "Visual evidence reviewed · approved"
          : "Visual evidence reviewed · ready for approval"
        : visualRequirement
          ? "Select and confirm applicable visual evidence"
          : candidate.preparationEligible === false
            ? "Additional source review required"
            : reviewState === "approved"
              ? "Approved for this Research"
              : reviewState === "rejected"
                ? "Rejected"
                : "Candidate · not approved";
      cardHeader.append(rank, citationWrap, stateBadge);
      const why = document.createElement("p");
      why.className = "evidence-candidate-why";
      why.textContent = candidate.whyRelevant;
      const quote = document.createElement("blockquote");
      quote.textContent = candidate.selectedText;
      const sourceRequirements = document.createElement("div");
      sourceRequirements.className = "evidence-candidate-source-requirements";
      if (candidate.sourceReviewRequirements?.length) {
        const sourceRequirementsHeading = document.createElement("strong");
        sourceRequirementsHeading.textContent = "Cannot prepare from text alone";
        const sourceRequirementsList = document.createElement("ul");
        candidate.sourceReviewRequirements.forEach((requirement) => {
          const item = document.createElement("li");
          item.textContent = requirement.text;
          sourceRequirementsList.append(item);
        });
        sourceRequirements.append(sourceRequirementsHeading, sourceRequirementsList);
      }
      const structuredSources = document.createElement("div");
      structuredSources.className = "evidence-candidate-structured-sources";
      if (candidate.richSources?.length) {
        const structuredSourcesHeading = document.createElement("strong");
        structuredSourcesHeading.textContent = "Complete structured source included";
        const structuredSourcesList = document.createElement("ul");
        candidate.richSources.forEach((source) => {
          const item = document.createElement("li");
          item.textContent = `${source.reference} · ${Number(source.rowCount || 0).toLocaleString()} structured rows · integrity ${String(source.contentHash || "").slice(0, 12)}`;
          structuredSourcesList.append(item);
        });
        structuredSources.append(structuredSourcesHeading, structuredSourcesList);
      }
      const visualSources = document.createElement("div");
      visualSources.className = "evidence-candidate-visual-sources";
      if (candidate.visualSources?.length) {
        const visualSourcesHeading = document.createElement("strong");
        visualSourcesHeading.textContent = "Review official visual evidence";
        const visualRequirementCount = visualRequirement?.count;
        const maximumSelections = Number(visualRequirement?.maximumSelections || 4);
        const selectedVisualSourceIDs = new Set(candidate.selectedVisualSourceIDs || []);
        const visualSourcesSummary = document.createElement("p");
        visualSourcesSummary.textContent = `${candidate.visualSources.length}${visualRequirementCount ? ` of ${visualRequirementCount}` : ""} official assets verified by content hash. Select only the applicable image${maximumSelections === 1 ? "" : "s"} (up to ${maximumSelections}); Permitext will preserve the selected bytes with the Research record.`;
        const visualSourcesDetails = document.createElement("details");
        visualSourcesDetails.open = candidate.visualReviewOpen === true;
        visualSourcesDetails.addEventListener("toggle", () => {
          candidate.visualReviewOpen = visualSourcesDetails.open;
        });
        const visualSourcesToggle = document.createElement("summary");
        visualSourcesToggle.textContent = `Review and select official images · ${selectedVisualSourceIDs.size} selected`;
        const visualSourcesGallery = document.createElement("div");
        visualSourcesGallery.className = "evidence-visual-source-gallery";
        candidate.visualSources.forEach((source, sourceIndex) => {
          const item = document.createElement("label");
          item.className = "evidence-visual-source-option";
          item.classList.toggle("is-selected", selectedVisualSourceIDs.has(source.id));
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = selectedVisualSourceIDs.has(source.id);
          checkbox.disabled = !checkbox.checked && selectedVisualSourceIDs.size >= maximumSelections;
          checkbox.setAttribute(
            "aria-label",
            `Select official visual source ${source.assetName}`
          );
          checkbox.addEventListener("change", () => {
            const nextSelection = new Set(candidate.selectedVisualSourceIDs || []);
            if (checkbox.checked) {
              if (nextSelection.size >= maximumSelections) return;
              nextSelection.add(source.id);
            } else {
              nextSelection.delete(source.id);
            }
            candidate.selectedVisualSourceIDs = Array.from(nextSelection);
            candidate.visualReviewConfirmed = false;
            candidate.visualReviewOpen = true;
            if (candidate.reviewState === "approved") candidate.reviewState = "candidate";
            renderResults();
          });
          const image = document.createElement("img");
          image.src = source.assetURL;
          image.alt = `Official visual source ${sourceIndex + 1}: ${source.assetName}`;
          image.loading = "lazy";
          image.decoding = "async";
          const itemCopy = document.createElement("span");
          itemCopy.className = "evidence-visual-source-copy";
          const itemName = document.createElement("strong");
          itemName.textContent = `Official image ${sourceIndex + 1}`;
          const metadata = document.createElement("span");
          metadata.textContent = `${source.assetName} · ${formattedByteLength(source.byteLength)} · integrity ${String(source.contentHash || "").slice(0, 12)}`;
          const link = document.createElement("a");
          link.href = source.assetURL;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Open full-size official image";
          link.addEventListener("click", (event) => event.stopPropagation());
          itemCopy.append(itemName, metadata, link);
          item.append(checkbox, image, itemCopy);
          visualSourcesGallery.append(item);
        });
        const visualReviewConfirmation = document.createElement("label");
        visualReviewConfirmation.className = "evidence-visual-review-confirmation";
        const visualReviewCheckbox = document.createElement("input");
        visualReviewCheckbox.type = "checkbox";
        visualReviewCheckbox.checked = candidate.visualReviewConfirmed === true;
        visualReviewCheckbox.disabled = selectedVisualSourceIDs.size === 0;
        const visualReviewCopy = document.createElement("span");
        visualReviewCopy.textContent = selectedVisualSourceIDs.size
          ? `I reviewed the ${selectedVisualSourceIDs.size} selected official ${selectedVisualSourceIDs.size === 1 ? "image" : "images"} and want ${selectedVisualSourceIDs.size === 1 ? "it" : "them"} attached as evidence.`
          : "Select at least one applicable official image before confirming review.";
        visualReviewCheckbox.addEventListener("change", () => {
          candidate.visualReviewConfirmed = visualReviewCheckbox.checked;
          candidate.visualReviewOpen = true;
          if (candidate.reviewState === "approved") candidate.reviewState = "candidate";
          renderResults();
        });
        visualReviewConfirmation.append(visualReviewCheckbox, visualReviewCopy);
        visualSourcesDetails.append(
          visualSourcesToggle,
          visualSourcesGallery,
          visualReviewConfirmation
        );
        visualSources.append(
          visualSourcesHeading,
          visualSourcesSummary,
          visualSourcesDetails
        );
      }
      const signals = document.createElement("p");
      signals.className = "evidence-candidate-signals";
      const signalParts = [
        candidate.relevance ? `${candidate.relevance} lexical relevance` : "",
        candidate.signals?.topicRoutes?.length ? "curated topic route" : "",
        candidate.signals?.containsVisualSource ? "map or visual present" : "",
        candidate.signals?.includesStructuredTable ? "complete structured table included" : "",
        candidate.signals?.referencesTable && !candidate.signals?.includesStructuredTable
          ? "complete table needed"
          : "",
        candidate.signals?.containsException ? "exception language" : "",
        candidate.signals?.containsCrossReference ? "cross-reference present" : ""
      ].filter(Boolean);
      signals.textContent = signalParts.join(" · ");
      const actions = document.createElement("div");
      actions.className = "evidence-candidate-actions";
      const approveButton = document.createElement("button");
      approveButton.type = "button";
      approveButton.className = "evidence-candidate-approve";
      approveButton.textContent = reviewState === "approved" ? "Approved" : "Approve";
      approveButton.setAttribute("aria-pressed", String(reviewState === "approved"));
      approveButton.disabled = !preparationReady;
      if (!preparationReady) {
        approveButton.title = visualRequirement
          ? "Select the applicable official visual evidence and confirm your review first."
          : "Open the source and review its complete supporting material before using it as evidence.";
      }
      approveButton.addEventListener("click", () => {
        if (!evidenceCandidatePreparationReady(candidate)) return;
        candidate.reviewState = reviewState === "approved" ? "candidate" : "approved";
        renderResults();
      });
      const rejectButton = document.createElement("button");
      rejectButton.type = "button";
      rejectButton.className = "evidence-candidate-reject";
      rejectButton.textContent = reviewState === "rejected" ? "Rejected" : "Reject";
      rejectButton.setAttribute("aria-pressed", String(reviewState === "rejected"));
      rejectButton.addEventListener("click", () => {
        candidate.reviewState = reviewState === "rejected" ? "candidate" : "rejected";
        renderResults();
      });
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "evidence-candidate-open";
      openButton.textContent = "Open source";
      openButton.addEventListener("click", () => openSectionDetailForExistingSearch(candidate, {
        anchorPaneID: "utility:analysis"
      }));
      actions.append(approveButton, rejectButton, openButton);
      card.append(cardHeader, why, quote);
      if (candidate.sourceReviewRequirements?.length) {
        card.append(sourceRequirements);
      }
      if (candidate.richSources?.length) {
        card.append(structuredSources);
      }
      if (candidate.visualSources?.length) {
        card.append(visualSources);
      }
      card.append(signals, actions);
      tray.append(card);
    });
    results.append(tray);

    const prepare = document.createElement("section");
    prepare.className = "evidence-discovery-prepare";
    const prepareCopy = document.createElement("p");
    prepareCopy.textContent = approved.length
      ? `${approved.length} approved ${approved.length === 1 ? "passage is" : "passages are"} ready to attach. Preparing evidence creates an empty Research conversation; Analyze remains a separate action.`
      : "Approve at least one passage to prepare a Research conversation.";
    const prepareButton = document.createElement("button");
    prepareButton.type = "button";
    prepareButton.className = "evidence-discovery-prepare-button";
    prepareButton.textContent = `Prepare Approved Evidence${approved.length ? ` (${approved.length})` : ""}`;
    prepareButton.disabled = approved.length === 0;
    const prepareStatus = document.createElement("p");
    prepareStatus.className = "evidence-discovery-status";
    prepareButton.addEventListener("click", async () => {
      if (!approved.length) return;
      prepareButton.disabled = true;
      prepareStatus.textContent = "Attaching only the passages you approved…";
      let payload = null;
      try {
        for (const [index, candidate] of approved.entries()) {
          payload = index === 0
            ? await postResearch("/research/conversations/create", {
                sectionID: candidate.sectionID,
                selectedText: candidate.selectedText,
                richSourceIDs: candidate.richSourceIDs || [],
                visualSourceIDs: candidate.selectedVisualSourceIDs || [],
                visualReviewConfirmed: candidate.visualReviewConfirmed === true,
                projectID: discovery.projectID || ""
              })
            : await postResearch("/research/conversations/evidence", {
                conversationID: payload.conversation.id,
                sectionID: candidate.sectionID,
                selectedText: candidate.selectedText,
                richSourceIDs: candidate.richSourceIDs || [],
                visualSourceIDs: candidate.selectedVisualSourceIDs || [],
                visualReviewConfirmed: candidate.visualReviewConfirmed === true
              });
        }
        activeResearchConversation = payload.conversation;
        researchQuestionDraft = discovery.question;
        activeEvidenceDiscovery = null;
        await refreshResearchConversationList();
        await openResearchConversation(payload.conversation.id, { refreshList: true });
      } catch (error) {
        prepareStatus.textContent = error.message;
        prepareButton.disabled = false;
      }
    });
    prepare.append(prepareCopy, prepareButton, prepareStatus);
    results.append(prepare);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalizedQuestion = question.value.replace(/\s+/g, " ").trim();
    if (normalizedQuestion.length < 3) return;
    question.disabled = true;
    projectSelect.disabled = true;
    findButton.disabled = true;
    formStatus.textContent = "Searching the enacted library for review candidates…";
    try {
      const response = await postResearch("/research/evidence/discover", {
        question: normalizedQuestion,
        projectID: projectSelect.value,
        limit: 12
      });
      activeEvidenceDiscovery = {
        accountUserID: activeAccount()?.userID || "",
        question: normalizedQuestion,
        projectID: projectSelect.value,
        response: {
          ...response,
          candidates: (response.candidates || []).map((candidate) => ({
            ...candidate,
            reviewState: "candidate"
          }))
        }
      };
      formStatus.textContent = response.candidates?.length
        ? "Candidates found. Review each passage before approval."
        : "No candidates were found. Refine the question or identify a code section.";
      renderResults();
    } catch (error) {
      formStatus.textContent = error.message;
    } finally {
      question.disabled = false;
      projectSelect.disabled = false;
      findButton.disabled = question.value.trim().length < 3;
    }
  });

  section.append(header, form, results);
  container.append(section);
  renderResults();
}

async function renderResearch(paneID = "utility:analysis") {
  const panel = renderUtility(analysisTemplate, paneID);
  panel.classList.add("analysis-panel", "research-list-panel");
  applyProjectDerivedPaneTheme(panel, preferredResearchProjectID());
  panel.querySelector(".utility-close")?.addEventListener("click", closeResearchWorkspace);
  const content = panel.querySelector(".analysis-content");

  const trustNotice = document.createElement("aside");
  trustNotice.className = "research-trust-notice";
  trustNotice.setAttribute("role", "note");
  const trustHeading = document.createElement("strong");
  trustHeading.textContent = "AI-assisted research — not an official interpretation";
  const trustCopy = document.createElement("p");
  trustCopy.textContent = "Select enacted text, then choose Start Research. No AI request is made until you ask a question and choose Analyze; private notes are excluded.";
  trustNotice.append(trustHeading, trustCopy);
  const appendTrustNotice = () => content.append(trustNotice);

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
    appendTrustNotice();
    return panel;
  }

  try {
    await refreshResearchConversationList();
  } catch (error) {
    const status = document.createElement("p");
    status.className = "research-list-status is-error";
    status.textContent = error.message;
    content.append(status);
    appendTrustNotice();
    return panel;
  }

  const researchEnabled = hasCapability("research");
  if (!researchEnabled) {
    const upgrade = document.createElement("article");
    upgrade.className = "analysis-card research-empty-state";
    const upgradeHeading = document.createElement("h3");
    upgradeHeading.textContent = isProAccount()
      ? "Research Add-On required"
      : "Pro and Research required";
    const upgradeCopy = document.createElement("p");
    upgradeCopy.textContent = "Your saved Research history remains readable. Add Research to start conversations, attach evidence, or generate new answers.";
    const upgradeButton = document.createElement("button");
    upgradeButton.className = "ghost-button";
    upgradeButton.type = "button";
    upgradeButton.textContent = "View Plans";
    upgradeButton.addEventListener("click", () => focusUtility("settings"));
    upgrade.append(upgradeHeading, upgradeCopy, upgradeButton);
    content.append(upgrade);
  }

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

  if (researchUsage && researchEnabled) {
    const usage = document.createElement("section");
    usage.className = "research-usage";
    const primary = document.createElement("strong");
    primary.textContent = `${researchUsage.requestsUsed} of ${researchUsage.requestLimit} AI requests used this month`;
    const reset = document.createElement("p");
    reset.textContent = `Allowance resets ${researchRelativeDate(researchUsage.resetDate)}.`;
    usage.append(primary, reset);
    content.append(usage);
  }

  renderEvidenceDiscovery(content);

  if (!researchConversationList.length) {
    const empty = document.createElement("div");
    empty.className = "research-conversation-empty";
    empty.textContent = "No research conversations yet.";
    content.append(empty);
    appendTrustNotice();
    return panel;
  }

  const list = document.createElement("section");
  list.className = "research-conversation-list";
  researchConversationList.forEach((initialConversation) => {
    let conversation = initialConversation;
    const row = document.createElement("article");
    row.className = "research-conversation-row";
    const renderRow = () => {
      clear(row);
      row.classList.toggle("is-active", state.researchConversationID === conversation.id);
      const openButton = document.createElement("button");
      openButton.className = "research-conversation-open";
      openButton.type = "button";
      const title = document.createElement("strong");
      title.textContent = conversation.title;
      const meta = document.createElement("span");
      meta.textContent = `${conversation.messageCount / 2 || 0} ${conversation.messageCount === 2 ? "exchange" : "exchanges"} · ${conversation.sourceCount} ${conversation.sourceCount === 1 ? "passage" : "passages"} · ${researchRelativeDate(conversation.updatedAt)}`;
      openButton.append(title, meta);
      openButton.addEventListener("click", () => openResearchConversation(conversation.id));

      const actions = document.createElement("div");
      actions.className = "research-conversation-row-actions";
      const projectChoices = researchProjectChoices({
        value: conversation.primaryProjectID || "",
        unassignedLabel: "Unassigned"
      });
      const projectSelectWrap = document.createElement("div");
      projectSelectWrap.className = "code-filter-menu research-conversation-project-picker";
      const projectToggle = document.createElement("button");
      projectToggle.className = "code-filter-menu-toggle research-conversation-project-toggle";
      projectToggle.type = "button";
      const projectLabel = document.createElement("span");
      projectLabel.className = "code-filter-menu-label";
      projectLabel.textContent = researchProjectName(conversation.primaryProjectID || "");
      const projectMenuIcon = document.createElement("span");
      projectMenuIcon.className = "code-filter-menu-icon";
      projectMenuIcon.setAttribute("aria-hidden", "true");
      projectMenuIcon.innerHTML = `
        <svg class="code-filter-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"></path></svg>
        <svg class="code-filter-chevron-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 14 4-4 4 4"></path></svg>
      `;
      projectToggle.append(projectLabel, projectMenuIcon);
      projectToggle.title = conversation.primaryProjectID
        ? `Assigned to ${researchProjectName(conversation.primaryProjectID)}`
        : "Assign conversation to a Project";
      projectToggle.disabled = !researchEnabled;
      const projectOptions = document.createElement("div");
      projectOptions.className = "research-conversation-project-options";
      projectOptions.setAttribute("aria-label", `Project for ${conversation.title}`);
      projectOptions.hidden = true;
      const projectMenuState = { projectMenuOpen: false };
      const setProjectMenuEnabled = (enabled) => {
        projectToggle.disabled = !enabled;
        projectOptions.querySelectorAll("button").forEach((button) => {
          button.disabled = !enabled;
        });
      };
      projectChoices.forEach((choice) => {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "research-conversation-project-option";
        optionButton.textContent = choice.label;
        optionButton.dataset.projectId = choice.value;
        optionButton.setAttribute("aria-pressed", String(choice.value === (conversation.primaryProjectID || "")));
        optionButton.addEventListener("click", async () => {
          const previousProjectID = conversation.primaryProjectID || "";
          const targetProjectID = choice.value;
          if (targetProjectID === previousProjectID) {
            projectMenuState.projectMenuOpen = false;
            updateCodeFilterMenu(projectOptions, projectMenuState, {
              stateKey: "projectMenuOpen",
              menuName: `Projects for ${conversation.title}`,
              label: () => researchProjectName(previousProjectID)
            });
            return;
          }
          projectMenuState.projectMenuOpen = false;
          updateCodeFilterMenu(projectOptions, projectMenuState, {
            stateKey: "projectMenuOpen",
            menuName: `Projects for ${conversation.title}`,
            label: () => researchProjectName(previousProjectID)
          });
          setProjectMenuEnabled(false);
          projectSelectWrap.setAttribute("aria-busy", "true");
          try {
            const payload = await assignResearchConversationProject(conversation, targetProjectID, {
              warningContainer: projectSelectWrap.closest(".workspace-panel")
            });
            if (!payload) {
              return;
            }
            conversation = { ...conversation, ...payload.conversation };
            researchConversationList = researchConversationList.map((item) =>
              item.id === conversation.id ? { ...item, ...conversation } : item
            );
            if (state.researchConversationID === conversation.id) {
              activeResearchConversation = {
                ...(activeResearchConversation || {}),
                ...payload.conversation
              };
            }
            const projectPaneIDs = openProjectDetails().map((detail) => paneIDForProjectDetail(detail));
            await transitionWorkspace("utility", {
              refreshPaneIDs: [
                "utility:analysis",
                ...(state.researchConversationID === conversation.id
                  ? [paneIDForResearchConversation(conversation.id)]
                  : []),
                ...projectPaneIDs
              ]
            });
          } catch (error) {
            await showWebNotice("Project not changed", error.message);
          } finally {
            setProjectMenuEnabled(researchEnabled);
            projectSelectWrap.removeAttribute("aria-busy");
          }
        });
        projectOptions.append(optionButton);
      });
      projectSelectWrap.append(projectToggle, projectOptions);
      wireCodeFilterMenu(projectOptions, projectMenuState, {
        stateKey: "projectMenuOpen",
        menuName: `Projects for ${conversation.title}`,
        label: () => researchProjectName(conversation.primaryProjectID || "")
      });
      if (researchEnabled) {
        const renameButton = document.createElement("button");
        renameButton.className = "research-conversation-rename";
        renameButton.type = "button";
        renameButton.title = "Rename conversation";
        renameButton.setAttribute("aria-label", `Rename ${conversation.title}`);
        renameButton.innerHTML = pencilIconSVG();
        renameButton.addEventListener("click", () => {
          clear(row);
          row.classList.add("is-renaming");
          const form = document.createElement("form");
          form.className = "research-conversation-rename-form";
          const input = document.createElement("input");
          input.className = "research-conversation-rename-input";
          input.type = "text";
          input.maxLength = 120;
          input.value = conversation.title;
          input.setAttribute("aria-label", "Research conversation name");
          const saveButton = document.createElement("button");
          saveButton.type = "submit";
          saveButton.textContent = "Save";
          const cancelButton = document.createElement("button");
          cancelButton.type = "button";
          cancelButton.textContent = "Cancel";
          const status = document.createElement("span");
          status.className = "research-conversation-rename-status";
          const cancel = () => {
            row.classList.remove("is-renaming");
            renderRow();
          };
          cancelButton.addEventListener("click", cancel);
          input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          });
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const nextTitle = input.value.replace(/\s+/g, " ").trim();
            if (!nextTitle) {
              status.textContent = "Enter a conversation name.";
              input.focus();
              return;
            }
            input.disabled = true;
            saveButton.disabled = true;
            cancelButton.disabled = true;
            status.textContent = "Saving…";
            try {
              const payload = await postResearch("/research/conversations/rename", {
                conversationID: conversation.id,
                title: nextTitle
              });
              conversation = { ...conversation, ...payload.conversation };
              researchConversationList = researchConversationList.map((item) =>
                item.id === conversation.id ? { ...item, ...conversation } : item
              );
              if (state.researchConversationID === conversation.id) {
                activeResearchConversation = {
                  ...(activeResearchConversation || {}),
                  ...payload.conversation
                };
                track.querySelector(
                  `.research-conversation-panel[data-pane-id="${CSS.escape(paneIDForResearchConversation(conversation.id))}"] .panel-title`
                )?.replaceChildren(document.createTextNode(conversation.title));
              }
              row.classList.remove("is-renaming");
              renderRow();
            } catch (error) {
              status.textContent = error.message;
              input.disabled = false;
              saveButton.disabled = false;
              cancelButton.disabled = false;
              input.focus();
            }
          });
          form.append(input, saveButton, cancelButton, status);
          row.append(form);
          requestAnimationFrame(() => {
            input.focus();
            input.select();
          });
        });
        actions.append(renameButton);
      }
      const deleteButton = document.createElement("button");
      deleteButton.className = "research-conversation-delete";
      deleteButton.type = "button";
      deleteButton.title = "Delete conversation";
      deleteButton.setAttribute("aria-label", `Delete ${conversation.title}`);
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteResearchConversationFromList(conversation, deleteButton));
      actions.append(deleteButton);
      row.append(openButton, actions, projectSelectWrap);
    };
    renderRow();
    list.append(row);
  });
  content.append(list);
  appendTrustNotice();
  return panel;
}

function visualEvidenceDataURL(source) {
  return source?.dataBase64 && source?.mediaType
    ? `data:${source.mediaType};base64,${source.dataBase64}`
    : source?.assetURL || "";
}

function renderResearchVisualEvidence(sources, options = {}) {
  const visualSources = Array.isArray(sources) ? sources : [];
  if (!visualSources.length) return null;
  const wrap = document.createElement("section");
  wrap.className = "research-visual-evidence";
  const heading = document.createElement("strong");
  heading.textContent = options.immutable
    ? "Immutable official visual evidence"
    : "Reviewed official visual evidence";
  const gallery = document.createElement("div");
  gallery.className = "research-visual-evidence-gallery";
  visualSources.forEach((source, index) => {
    const card = document.createElement("article");
    const image = document.createElement("img");
    image.src = visualEvidenceDataURL(source);
    image.alt = `Official visual evidence ${index + 1}: ${source.assetName || "image"}`;
    image.loading = "lazy";
    image.decoding = "async";
    const name = document.createElement("strong");
    name.textContent = source.assetName || `Official image ${index + 1}`;
    const metadata = document.createElement("span");
    metadata.textContent = `${formattedByteLength(source.byteLength)} · SHA-256 ${source.contentHash}`;
    const link = document.createElement("a");
    link.href = visualEvidenceDataURL(source);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open preserved image";
    card.append(image, name, metadata, link);
    gallery.append(card);
  });
  wrap.append(heading, gallery);
  return wrap;
}

function researchChevronIconsSVG() {
  return `
    <svg class="research-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"></path></svg>
    <svg class="research-chevron-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 14 4-4 4 4"></path></svg>
  `;
}

function setResearchSourceCardExpanded(card, expanded, options = {}) {
  const toggle = card.querySelector(".research-source-toggle");
  const body = card.querySelector(".research-source-body");
  if (!toggle || !body) return;
  toggle.setAttribute("aria-expanded", String(expanded));
  if (expanded) {
    body.hidden = false;
    const applyExpandedHeight = () => {
      card.style.setProperty("--research-source-body-height", `${body.scrollHeight}px`);
    };
    if (options.instant && !card.classList.contains("is-open")) {
      card.classList.add("is-restoring", "is-open");
      card.style.setProperty("--research-source-body-height", "10000px");
      const restoreWhenMounted = (remainingFrames = 60) => {
        if (toggle.getAttribute("aria-expanded") !== "true") {
          card.classList.remove("is-restoring");
          return;
        }
        if ((!body.isConnected || body.offsetWidth === 0) && remainingFrames > 0) {
          requestAnimationFrame(() => restoreWhenMounted(remainingFrames - 1));
          return;
        }
        if (body.isConnected && body.offsetWidth > 0) applyExpandedHeight();
        void body.offsetHeight;
        requestAnimationFrame(() => card.classList.remove("is-restoring"));
      };
      requestAnimationFrame(() => restoreWhenMounted());
      return;
    }
    if (!card.classList.contains("is-open")) {
      requestAnimationFrame(() => {
        if (toggle.getAttribute("aria-expanded") === "true") {
          applyExpandedHeight();
          card.classList.add("is-open");
        }
      });
    } else {
      applyExpandedHeight();
    }
    return;
  }
  if (!card.classList.contains("is-open")) {
    body.hidden = true;
    return;
  }
  card.style.setProperty("--research-source-body-height", `${body.scrollHeight}px`);
  card.classList.remove("is-open");
  const hideBody = (event) => {
    if (event && event.target !== body) return;
    if (event && event.propertyName !== "max-height") return;
    if (toggle.getAttribute("aria-expanded") !== "true") body.hidden = true;
    body.removeEventListener("transitionend", hideBody);
  };
  body.addEventListener("transitionend", hideBody);
  window.setTimeout(hideBody, 500);
}

function renderResearchSource(source) {
  const card = document.createElement("article");
  card.className = `research-source-card is-${source.kind || "related"} code-theme-${codeTheme(source.codePrefix || "BC")}`;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "research-source-toggle";
  toggle.setAttribute("aria-expanded", "true");
  const citation = document.createElement("strong");
  citation.textContent = researchSourceCitation(source);
  const disclosure = document.createElement("span");
  disclosure.className = "research-source-disclosure";
  disclosure.setAttribute("aria-hidden", "true");
  disclosure.innerHTML = researchChevronIconsSVG();
  const body = document.createElement("div");
  body.className = "research-source-body";
  toggle.append(citation, disclosure);
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    setResearchSourceCardExpanded(card, !expanded);
  });
  if (source.kind !== "selection") {
    const label = document.createElement("p");
    label.className = "section-label";
    label.textContent = "Suggested related section — not included in analysis";
    const relationship = document.createElement("p");
    relationship.textContent = "Suggested because it is explicitly referenced by this enacted section. Open it and select the relevant passage to include it in analysis.";
    body.append(label, relationship);
  }
  if (source.selectedText) {
    const quote = document.createElement("blockquote");
    quote.textContent = source.selectedText;
    body.append(quote);
  }
  const visualEvidence = renderResearchVisualEvidence(source.visualSources);
  if (visualEvidence) body.append(visualEvidence);
  card.append(toggle, body);
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
    const visualEvidence = renderResearchVisualEvidence(
      evidence.visualSources,
      { immutable: true }
    );
    if (visualEvidence) evidenceCard.append(visualEvidence);
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
  reuseCopy.textContent = "This creates a new, empty Research conversation. It rechecks the passage against the current enacted library and does not copy the old question, answer, assumptions, or additional Research facts.";
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
  reuseButton.disabled = !hasCapability("research");
  if (reuseButton.disabled) reuseButton.title = "Research Add-On required";
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

  if (conversation.primaryProjectID) {
    const projectInformation = conversation.projectInformation || {};
    const automaticFacts = Array.isArray(projectInformation.facts)
      ? projectInformation.facts
      : [];
    if (automaticFacts.length) {
      const projectInfo = document.createElement("section");
      projectInfo.className = "research-project-information";
      const projectInfoHeading = document.createElement("strong");
      projectInfoHeading.textContent = "From the Project folder";
      const projectInfoList = document.createElement("ul");
      automaticFacts.forEach((fact) => {
        const row = document.createElement("li");
        row.textContent = fact;
        projectInfoList.append(row);
      });
      const projectInfoCopy = document.createElement("p");
      projectInfoCopy.textContent = "Permitext uses this current Project information automatically. Edit the Project folder to change it.";
      projectInfo.append(projectInfoHeading, projectInfoList, projectInfoCopy);
      section.append(projectInfo);
    }
  }
  container.append(section);
  return section;
}

function researchEvidenceSplitRatio(conversationID) {
  return normalizeResearchEvidenceSplitRatio(state.researchEvidenceSplitRatios?.[conversationID]);
}

function bindResearchEvidenceDivider(layout, divider, conversationID) {
  const applyRatio = (value) => {
    const desiredRatio = normalizeResearchEvidenceSplitRatio(value);
    state.researchEvidenceSplitRatios ||= {};
    state.researchEvidenceSplitRatios[conversationID] = desiredRatio;
    const bounds = layout.getBoundingClientRect();
    const dividerHeight = divider.offsetHeight || 17;
    const availableHeight = Math.max(0, bounds.height - dividerHeight);
    const composerHeight = layout.querySelector(".research-composer")?.offsetHeight || 0;
    const minimumEvidenceHeight = Math.min(96, Math.max(56, availableHeight * 0.2));
    const minimumDialogueHeight = Math.min(
      Math.max(140, composerHeight + 40),
      Math.max(100, availableHeight - minimumEvidenceHeight)
    );
    const minimumRatio = bounds.height
      ? Math.min(0.45, Math.max(0.12, minimumEvidenceHeight / bounds.height))
      : 0.2;
    const maximumRatio = bounds.height
      ? Math.min(0.7, Math.max(minimumRatio + 0.02, (availableHeight - minimumDialogueHeight) / bounds.height))
      : 0.7;
    const displayedRatio = clampNumber(desiredRatio, minimumRatio, maximumRatio, 0.36);
    layout.style.setProperty("--research-evidence-size", `${displayedRatio * 100}%`);
    divider.setAttribute("aria-valuemin", String(Math.round(minimumRatio * 100)));
    divider.setAttribute("aria-valuemax", String(Math.round(maximumRatio * 100)));
    divider.setAttribute("aria-valuenow", String(Math.round(displayedRatio * 100)));
  };
  applyRatio(researchEvidenceSplitRatio(conversationID));
  requestAnimationFrame(() => applyRatio(researchEvidenceSplitRatio(conversationID)));

  const resize = (event) => {
    const bounds = layout.getBoundingClientRect();
    if (!bounds.height) return;
    applyRatio((event.clientY - bounds.top) / bounds.height);
  };
  const endResize = (event) => {
    divider.classList.remove("is-dragging");
    document.body.classList.remove("is-resizing-research-evidence");
    if (divider.hasPointerCapture?.(event.pointerId)) {
      divider.releasePointerCapture(event.pointerId);
    }
    saveWorkspaceState();
    window.removeEventListener("pointermove", resize);
    window.removeEventListener("pointerup", endResize);
    window.removeEventListener("pointercancel", endResize);
  };

  divider.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    event.preventDefault();
    divider.setPointerCapture?.(event.pointerId);
    divider.classList.add("is-dragging");
    document.body.classList.add("is-resizing-research-evidence");
    resize(event);
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  });
  divider.addEventListener("dblclick", () => {
    applyRatio(0.36);
    saveWorkspaceState();
  });
  divider.addEventListener("keydown", (event) => {
    const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const ratio = event.key === "Home"
      ? 0.2
      : event.key === "End"
        ? 0.7
        : researchEvidenceSplitRatio(conversationID) + direction * 0.04;
    applyRatio(ratio);
    saveWorkspaceState();
  });
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
  applyProjectDerivedPaneTheme(panel, conversation.primaryProjectID);
  panelTitle.textContent = conversation.title;
  const selectedSources = conversation.sources.filter((source) => source.kind === "selection");
  const evidencePane = document.createElement("section");
  evidencePane.className = "research-evidence-pane";
  const evidenceScroll = document.createElement("section");
  evidenceScroll.className = "research-evidence-scroll";
  evidenceScroll.id = `research-evidence-${conversation.id}`;
  evidencePane.append(evidenceScroll);

  const divider = document.createElement("div");
  divider.className = "research-evidence-divider";
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-label", "Resize context and evidence above the conversation");
  divider.setAttribute("aria-orientation", "horizontal");
  divider.tabIndex = 0;

  const dialoguePane = document.createElement("section");
  dialoguePane.className = "research-dialogue-pane";
  content.append(evidencePane, divider, dialoguePane);

  const projectContextSection = renderResearchProjectContext(evidenceScroll, conversation);
  const sources = document.createElement("section");
  sources.className = "research-sources";
  const sourceToggle = document.createElement("button");
  sourceToggle.type = "button";
  sourceToggle.className = "research-sources-toggle";
  sourceToggle.setAttribute("aria-expanded", "true");
  const sourceDisclosure = document.createElement("span");
  sourceDisclosure.className = "research-source-disclosure";
  sourceDisclosure.setAttribute("aria-hidden", "true");
  sourceDisclosure.innerHTML = researchChevronIconsSVG();
  sourceToggle.append(sourceDisclosure);
  const sourceList = document.createElement("section");
  sourceList.className = "research-source-list";
  selectedSources.forEach((source) => sourceList.append(renderResearchSource(source)));
  sources.append(sourceToggle, sourceList);
  projectContextSection.prepend(sources);
  sourceList.querySelectorAll(".research-source-card").forEach((card) =>
    setResearchSourceCardExpanded(card, true, { instant: true })
  );
  const updateSourceToggle = () => {
    const passageToggles = Array.from(sourceList.querySelectorAll(".research-source-toggle"));
    const anyExpanded = passageToggles.some((toggle) => toggle.getAttribute("aria-expanded") === "true");
    sourceToggle.setAttribute("aria-expanded", String(anyExpanded));
    sourceToggle.setAttribute("aria-label", anyExpanded ? "Collapse all passages" : "Expand all passages");
    sourceToggle.title = anyExpanded ? "Collapse all passages" : "Expand all passages";
  };
  sourceToggle.addEventListener("click", () => {
    const expandAll = sourceToggle.getAttribute("aria-expanded") !== "true";
    sourceList.querySelectorAll(".research-source-card").forEach((card) =>
      setResearchSourceCardExpanded(card, expandAll)
    );
    updateSourceToggle();
  });
  sourceList.addEventListener("click", (event) => {
    if (event.target.closest(".research-source-toggle")) requestAnimationFrame(updateSourceToggle);
  });
  updateSourceToggle();

  if (conversation.sourceStatus === "changed") {
    const warning = document.createElement("aside");
    warning.className = "research-source-warning";
    const warningText = document.createElement("p");
    warningText.textContent = "The enacted source changed after this conversation began. Rechecking updates the source metadata only when the exact selected words still exist. If the selected words changed or disappeared, start a new selection from the current Reader.";
    const refreshButton = document.createElement("button");
    refreshButton.className = "ghost-button";
    refreshButton.type = "button";
    refreshButton.textContent = "Refresh sources";
    refreshButton.disabled = !hasCapability("research");
    if (refreshButton.disabled) refreshButton.title = "Research Add-On required";
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
    evidenceScroll.append(warning);
  }

  const thread = document.createElement("section");
  thread.className = "research-message-thread";
  thread.id = `research-dialogue-${conversation.id}`;
  divider.setAttribute("aria-controls", `${evidenceScroll.id} ${thread.id}`);
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
    thread.append(bubble);
  });
  dialoguePane.append(thread);

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
  const composerBox = document.createElement("div");
  composerBox.className = "research-composer-box";
  const projectContextBlocked = Boolean(conversation.projectContextReviewRequired);
  const researchEnabled = hasCapability("research");
  sendButton.disabled = !researchEnabled ||
    conversation.sourceStatus === "changed" ||
    projectContextBlocked ||
    input.value.trim().length < 3;
  if (!researchEnabled) {
    input.disabled = true;
    input.placeholder = "Research Add-On required to continue this conversation…";
  }
  const status = document.createElement("p");
  status.className = "research-composer-status";
  if (projectContextBlocked) {
    status.textContent = "Review the Project context in the Project column before analyzing.";
  }
  input.addEventListener("input", () => {
    researchQuestionDraft = input.value;
    sendButton.disabled = !researchEnabled ||
      conversation.sourceStatus === "changed" ||
      projectContextBlocked ||
      input.value.trim().length < 3;
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
  composerBox.append(input, sendButton);
  composer.append(composerBox, status);
  dialoguePane.append(composer);
  bindResearchEvidenceDivider(content, divider, conversation.id);
  requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
  });
  return panel;
}

function closeResearchSelectionMenu() {
  document.querySelector(".research-selection-menu")?.remove();
  pendingResearchSelection = null;
  researchSelectionMenuInteracting = false;
  researchSelectionMenuPinned = false;
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
  ].join(",")).forEach((element) => element.append(document.createTextNode("\n")));
  return String(container.textContent || selection)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function researchSelectionFromWindow() {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  const end = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
  const startSource = start?.closest?.(".research-selectable-text");
  const endSource = end?.closest?.(".research-selectable-text");
  const panel = startSource?.closest?.(".workspace-panel");
  if (!startSource || !endSource || !panel || panel !== endSource.closest(".workspace-panel")) return null;
  if (panel.closest(".research-conversation-panel")) return null;
  const sources = Array.from(panel.querySelectorAll(".research-selectable-text"))
    .filter((source) => {
      try {
        return range.intersectsNode(source);
      } catch {
        return false;
      }
    })
    .filter((source) => !source.parentElement?.closest(".research-selectable-text"));
  if (!sources.length || sources.length > 24) return null;
  const passages = sources.map((source) => {
    const sourceRange = document.createRange();
    sourceRange.selectNodeContents(source);
    if (source.contains(range.startContainer)) {
      sourceRange.setStart(range.startContainer, range.startOffset);
    }
    if (source.contains(range.endContainer)) {
      sourceRange.setEnd(range.endContainer, range.endOffset);
    }
    const selectedText = researchSelectionTextFromRange(selection, sourceRange);
    return {
      sectionID: source.dataset.researchSectionId,
      sectionNumber: source.dataset.researchSectionNumber,
      title: source.dataset.researchSectionTitle,
      codePrefix: source.dataset.researchCodePrefix,
      savedItemID: source.dataset.researchSavedItemId || "",
      selectedText
    };
  }).filter((passage) => passage.sectionID && passage.selectedText.length >= 2);
  if (!passages.length) return null;
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    ...passages[0],
    passages,
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
  if (!hasCapability("research")) {
    closeResearchSelectionMenu();
    await presentPlanLimitNotice(
      "Research Add-On required",
      isProAccount()
        ? "Add Research to start conversations and analyze selected enacted text."
        : "Upgrade to Pro first, then add Research to analyze selected enacted text."
    );
    return;
  }
  button.disabled = true;
  const passages = selection.passages || [selection];
  status.textContent = mode === "current"
    ? `Adding ${passages.length === 1 ? "supporting passage" : `${passages.length} supporting passages`}…`
    : "Starting research…";
  try {
    const payload = mode === "current"
      ? await postResearch("/research/conversations/evidence", {
          conversationID: state.researchConversationID,
          selections: passages.map(({ sectionID, selectedText, savedItemID }) => ({
            sectionID,
            selectedText,
            savedItemID
          }))
        })
      : await postResearch("/research/conversations/create", {
          selections: passages.map(({ sectionID, selectedText, savedItemID }) => ({
            sectionID,
            selectedText,
            savedItemID
          })),
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

function showResearchSelectionMenu(selectionOverride = null, options = {}) {
  const captured = selectionOverride || researchSelectionFromWindow();
  if (!captured) {
    closeResearchSelectionMenu();
    return;
  }
  closeResearchSelectionMenu();
  pendingResearchSelection = captured;
  researchSelectionMenuPinned = options.pinned === true;
  const menu = document.createElement("div");
  menu.className = "research-selection-menu";
  menu.setAttribute("role", "toolbar");
  menu.setAttribute("aria-label", "Start Research with selected enacted text");
  menu.addEventListener("pointerdown", (event) => {
    if (event.target.closest?.("select, option")) {
      researchSelectionMenuInteracting = true;
      return;
    }
    event.preventDefault();
  });
  const actions = document.createElement("div");
  actions.className = "research-selection-actions";
  const status = document.createElement("span");
  status.className = "research-selection-status";
  const projects = researchProjects();
  if (activeAccount() && projects.length) {
    const projectSelect = createResearchProjectSelect({
      value: preferredResearchProjectID(),
      unassignedLabel: "Unassigned — no Project context",
      ariaLabel: "Project for new Research"
    });
    projectSelect.classList.add("research-selection-project");
    pendingResearchSelection.projectID = projectSelect.value;
    projectSelect.addEventListener("change", () => {
      if (pendingResearchSelection) pendingResearchSelection.projectID = projectSelect.value;
      window.setTimeout(() => {
        researchSelectionMenuInteracting = false;
      }, 0);
    });
    projectSelect.addEventListener("blur", () => {
      window.setTimeout(() => {
        researchSelectionMenuInteracting = false;
      }, 0);
    });
    menu.append(projectSelect);
  }
  if (state.researchConversationID && activeAccount()) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "Add as supporting evidence";
    addButton.addEventListener("click", () => saveResearchSelection("current", addButton, status));
    actions.append(addButton);
  }
  const analyzeButton = document.createElement("button");
  analyzeButton.type = "button";
  analyzeButton.textContent = state.researchConversationID ? "Start new Research" : "Start Research";
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
    if (
      event.target.closest?.(".research-selection-menu") ||
      event.target.closest?.(".reader-notes-card-action")
    ) return;
    window.setTimeout(showResearchSelectionMenu, 0);
  });
  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key === "Shift") window.setTimeout(showResearchSelectionMenu, 0);
  });
  document.addEventListener("selectionchange", () => {
    if (
      window.getSelection?.().isCollapsed &&
      !researchSelectionMenuInteracting &&
      !researchSelectionMenuPinned
    ) {
      closeResearchSelectionMenu();
    }
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
  bulkBar.classList.toggle("is-archive", mode === "archive");
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
  if (mode === "archive") {
    bulkBar.append(actionButton, cancelButton);
  } else {
    bulkBar.append(countLabel, selectAllButton, actionButton);
    if (deleteButton) bulkBar.append(deleteButton);
    bulkBar.append(cancelButton);
  }
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
    actionButton.textContent = mode === "archive" ? "Delete" : `Archive ${selectedCount}`;
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
    color: projectColor(project),
    ...(project.sharedOrganizationID ? {
      sharedOrganizationID: project.sharedOrganizationID,
      sharedOrganizationName: project.sharedOrganizationName || "",
      sharedRole: project.sharedRole || "viewer",
      sharedPermissions: Array.isArray(project.sharedPermissions)
        ? project.sharedPermissions
        : [],
      sharedOnly: project.sharedOnly === true
    } : {})
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

function mountProjectOpeningPane(project, options = {}) {
  const identity = projectIdentity(project);
  const paneID = paneIDForProjectDetail(identity);
  const panel = document.createElement("article");
  panel.className = "workspace-panel project-detail-panel project-detail-loading";
  panel.dataset.paneId = paneID;
  panel.style.setProperty("--project-color", identity.color);
  panel.setAttribute("aria-busy", "true");
  applyPaneWeight(panel, paneID);

  const chrome = document.createElement("header");
  chrome.className = "project-detail-chrome";
  const heading = document.createElement("div");
  heading.className = "project-detail-heading";
  const title = document.createElement("h2");
  title.textContent = identity.name;
  const status = document.createElement("p");
  status.textContent = "Opening Project…";
  heading.append(title, status);
  chrome.append(heading);

  const content = document.createElement("section");
  content.className = "project-detail-content";
  const loading = document.createElement("p");
  loading.className = "project-detail-loading-status";
  loading.textContent = "Loading saved evidence, notes, and research history…";
  content.append(loading);
  panel.append(chrome, content);

  const replacingPane = options.replacingPaneID
    ? track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(options.replacingPaneID)}"]`)
    : null;
  const sourcePane = options.sourcePaneID
    ? track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(options.sourcePaneID)}"]`)
    : null;
  if (replacingPane) replacingPane.replaceWith(panel);
  else if (sourcePane) sourcePane.after(panel);
  else track.prepend(panel);
  requestAnimationFrame(() => scrollPaneIntoView(paneID));
}

async function openProjectDetail(project, options = {}) {
  if (!detachedProjectWindow && projectHasDetachedWorkboard(project)) {
    openDetachedWindow(project);
    return;
  }
  const identity = projectIdentity(project);
  const detailID = paneIDForProjectDetail(identity);
  if (openProjectDetails().some((detail) => projectDetailMatches(project, detail))) {
    scrollPaneIntoView(detailID);
    return;
  }
  const activated = await activateProjectStudio(identity, options);
  if (!activated) return;
  if (options.sourcePaneID === "utility:archive") {
    placePaneBefore("utility:archive", detailID);
    placeArchiveAfterProjectsStack();
    saveWorkspaceState();
    await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });
  }
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
    schemaVersion: 2,
    format: "blocknote-json",
    document: [{ type: "paragraph", content: [] }]
  };
}

function notebookDocumentFromPlainText(value) {
  const blocks = String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph, styles: {} }]
    }));
  return {
    ...emptyNotebookDocument(),
    document: blocks.length ? blocks : emptyNotebookDocument().document
  };
}

function notebookReferenceCodeTitle(codePrefix = "BC") {
  return codeDisplayLabel(codePrefix)
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+[—–-].*$/, "")
    .trim();
}

function notebookCanonicalReferenceLabel(savedItem, chapter) {
  const codePrefix = savedItem?.codePrefix || chapter?.codePrefix || "BC";
  const chapterNumber = String(savedItem?.chapterNumber || chapter?.chapterNumber || "").trim();
  const sectionNumber = String(savedItem?.sectionNumber || "").trim();
  const section = (chapter?.sections || []).find((candidate) =>
    String(candidate.id) === String(savedItem?.sectionID) ||
    (sectionNumber && String(candidate.sectionNumber || "") === sectionNumber)
  );
  const headerLine = String(section?.headerLine || "").trim();
  const groupNumber = headerLine.match(/(?:SECTION\s+)?(?:[A-Z]+\s+)?([A-Z]?\d+[A-Z]?)\s*$/i)?.[1] ||
    sectionNumber.match(/^([A-Z]?\d{3}[A-Z]?)/i)?.[1] || "";
  const groupTitle = researchHierarchyLabel(section?.headingLine || "");
  const provisionTitle = sectionTitleWithoutNumber({
    sectionNumber,
    title: section?.title || savedItem?.title || ""
  }).replace(/[.\s]+$/, "");
  const sectionGroup = groupNumber
    ? `Section ${groupNumber}${groupTitle ? `: ${groupTitle}` : ""}`
    : "";
  const provision = [sectionNumber, provisionTitle].filter(Boolean).join(" ");
  return [
    chapterNumber ? `Chapter ${chapterNumber}` : "",
    [sectionGroup, provision].filter(Boolean).join(", ")
  ].filter(Boolean).join(" / ");
}

function compareNotebookReferences(left, right) {
  const kindOrder = {
    canonicalSection: 0,
    researchAnswer: 1,
    notebookCard: 2,
    workboard: 3
  };
  const kindDifference = (kindOrder[left.referenceKind] ?? 99) -
    (kindOrder[right.referenceKind] ?? 99);
  if (kindDifference) return kindDifference;
  if (left.referenceKind === "canonicalSection") {
    const codeDifference = codeOptions.findIndex((option) => option.prefix === left.codePrefix) -
      codeOptions.findIndex((option) => option.prefix === right.codePrefix);
    if (codeDifference) return codeDifference;
    const hierarchyDifference = [left.chapterNumber, left.sectionNumber]
      .map((part) => String(part || ""))
      .join(".")
      .localeCompare(
        [right.chapterNumber, right.sectionNumber]
          .map((part) => String(part || ""))
          .join("."),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
    if (hierarchyDifference) return hierarchyDifference;
  }
  return String(left.label || "").localeCompare(String(right.label || ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

async function notebookReferenceCandidates(projectID, foundation, cards) {
  const activeLinks = (foundation.links || []).filter((link) =>
    !link.deletedAt && link.projectID === projectID
  );
  const savedItems = currentContentSummary().savedItems || [];
  const references = [];
  const canonicalReferences = await Promise.all(
    activeLinks.filter((link) => link.targetKind === "canonicalSection").map(async (link) => {
      const savedItem = savedItems.find((item) => String(item.sectionID) === String(link.targetID));
      const chapter = savedItem?.chapterID
        ? await fetchChapter(savedItem.chapterID).catch(() => null)
        : null;
      const citation = savedItem
        ? notebookCanonicalReferenceLabel(savedItem, chapter)
        : `Code section ${link.targetID}`;
      return {
        referenceKind: "canonicalSection",
        referenceID: String(link.targetID),
        label: citation,
        codePrefix: savedItem?.codePrefix || chapter?.codePrefix || "BC",
        chapterNumber: savedItem?.chapterNumber || chapter?.chapterNumber || "",
        sectionNumber: savedItem?.sectionNumber || ""
      };
    })
  );
  references.push(...canonicalReferences);
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
  return references
    .filter((reference, index, all) =>
      all.findIndex((candidate) =>
        candidate.referenceKind === reference.referenceKind &&
        candidate.referenceID === reference.referenceID
      ) === index
    )
    .sort(compareNotebookReferences);
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
  const closeButton = document.createElement("button");
  closeButton.className = "icon-button utility-close notebook-close";
  closeButton.type = "button";
  closeButton.title = "Close notebook";
  closeButton.setAttribute("aria-label", "Close notebook");
  closeButton.innerHTML = circleXIconSVG();
  closeButton.addEventListener("click", () => {
    void closeProjectNotebook(identity);
  });
  header.append(closeButton);

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
  let notebookReadOnly = false;
  let disposed = false;
  const notebookObjectURLs = new Set();
  let notebookAutosaveTimer = null;
  let flushNotebookAutosave = async () => !dirty;
  const notebookImageUploaded = (event) => {
    if (event.detail?.projectID !== projectID) return;
    editorMount?.replaceAssetURL?.(event.detail.localURL, event.detail.permanentURL);
  };
  window.addEventListener("permitext:notebook-image-uploaded", notebookImageUploaded);

  const mountState = {
    panel,
    async confirmDiscardIfNeeded() {
      if (!dirty || !activeCard) return true;
      if (await flushNotebookAutosave()) return true;
      return confirmWebWarning(
        "Discard unsaved Notebook changes?",
        `Your edits to “${activeCard.title || "Untitled card"}” have not been saved.`,
        { confirmLabel: "Discard changes" }
      );
    },
    dispose() {
      disposed = true;
      window.clearTimeout(notebookAutosaveTimer);
      editorRenderSequence += 1;
      editorMount?.destroy?.();
      editorMount = null;
      notebookObjectURLs.forEach((url) => URL.revokeObjectURL(url));
      notebookObjectURLs.clear();
      window.removeEventListener("permitext:notebook-image-uploaded", notebookImageUploaded);
    }
  };
  notebookMounts.set(projectID, mountState);

  if (!activeAccount()) {
    status.textContent = "Sign in from Settings to use the private Project Notebook.";
    return panel;
  }

  try {
    let foundationPayload;
    let cardPayload;
    try {
      [foundationPayload, cardPayload] = await Promise.all([
        identity.sharedOrganizationID
          ? postResearch("/organizations/projects/snapshot", { projectID })
              .then((payload) => payload.project)
          : postResearch("/projects/foundation/state", { projectID }),
        postResearch("/notebook/cards/list", { projectID })
      ]);
      await saveNotebookProjectSnapshot({
        accountUserID: activeAccount().userID,
        projectID,
        foundation: foundationPayload,
        cardPayload
      }).catch(() => {});
    } catch (networkError) {
      const cached = await loadNotebookProjectSnapshot(
        activeAccount().userID,
        projectID
      ).catch(() => null);
      if (!cached?.foundation || !cached?.cardPayload) throw networkError;
      foundationPayload = cached.foundation;
      cardPayload = cached.cardPayload;
      status.textContent = "Offline Notebook · changes will synchronize when connectivity returns.";
    }
    if (disposed) return panel;
    foundation = foundationPayload;
    cards = cardPayload.cards || [];
    notebookReadOnly = cardPayload.access?.readOnly === true;
    if (navigator.onLine !== false) {
      void Promise.allSettled(cards.map(async (card) => {
        const payload = await postResearch("/notebook/cards/get", { projectID, cardID: card.id });
        await saveNotebookCardSnapshot(activeAccount().userID, projectID, payload.card);
      }));
    }
    shell.replaceChildren();
    if (identity.sharedOrganizationID) {
      const accessNote = document.createElement("p");
      accessNote.className = "notebook-access-note";
      accessNote.textContent = notebookReadOnly
        ? `${identity.sharedOrganizationName || "Firm"} · ${identity.sharedRole || "viewer"} access · view only`
        : `${identity.sharedOrganizationName || "Firm"} · ${identity.sharedRole || "editor"} access · edits are attributed to your account`;
      shell.append(accessNote);
    }

    const rail = document.createElement("aside");
    rail.className = "notebook-card-rail code-filter-menu notebook-card-menu";
    const railHeader = document.createElement("div");
    railHeader.className = "notebook-card-rail-header";
    const railToggle = document.createElement("button");
    railToggle.className = "code-filter-menu-toggle notebook-card-menu-toggle";
    railToggle.type = "button";
    const railLabel = document.createElement("span");
    railLabel.className = "code-filter-menu-label";
    railLabel.textContent = "Project notes";
    const railIcon = document.createElement("span");
    railIcon.className = "code-filter-menu-icon";
    railIcon.setAttribute("aria-hidden", "true");
    railIcon.innerHTML = `
      <svg class="code-filter-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"></path></svg>
      <svg class="code-filter-chevron-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 14 4-4 4 4"></path></svg>
    `;
    railToggle.append(railLabel, railIcon);
    const newButton = document.createElement("button");
    newButton.className = "notebook-card-add-action";
    newButton.type = "button";
    newButton.title = "New card";
    newButton.setAttribute("aria-label", "New card");
    newButton.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      </svg>
    `;
    newButton.disabled = notebookReadOnly;
    railHeader.append(railToggle, newButton);
    const cardList = document.createElement("div");
    cardList.className = "notebook-card-list";
    rail.append(railHeader, cardList);
    const cardMenuState = {
      cardsMenuOpen: notebookCardMenuOpenByProject.get(projectID) !== false
    };
    const cardMenuOptions = {
      stateKey: "cardsMenuOpen",
      menuName: "Project notes",
      label: "Project notes"
    };
    wireCodeFilterMenu(cardList, cardMenuState, cardMenuOptions);
    railToggle.addEventListener("click", () => {
      notebookCardMenuOpenByProject.set(projectID, cardMenuState.cardsMenuOpen);
    });

    const focus = document.createElement("section");
    focus.className = "notebook-focus";
    shell.append(rail, focus);

    let notebookAutosaveTask = null;
    let notebookRevision = 0;

    const notebookSummaryForCard = (card, savedCard = card) => ({
      id: card.id,
      version: card.version,
      cardType: card.cardType,
      title: card.title,
      plainText: savedCard.plainText,
      referenceCount: savedCard.references?.length || 0,
      createdAt: savedCard.createdAt,
      updatedAt: savedCard.updatedAt
    });

    function scheduleNotebookAutosave(delay = 700) {
      window.clearTimeout(notebookAutosaveTimer);
      if (notebookReadOnly || disposed || !dirty || !activeCard) return;
      if (!String(activeCard.title || "").trim()) return;
      notebookAutosaveTimer = window.setTimeout(() => {
        notebookAutosaveTimer = null;
        void saveActiveNotebookCard();
      }, delay);
    }

    function markNotebookDirty() {
      dirty = true;
      notebookRevision += 1;
      scheduleNotebookAutosave();
    }

    async function saveActiveNotebookCard() {
      if (notebookAutosaveTask) return notebookAutosaveTask;
      if (notebookReadOnly || disposed || !dirty || !activeCard) return true;
      const title = String(activeCard.title || "").trim();
      if (!title) return false;
      const revisionAtStart = notebookRevision;
      const documentAtStart = editorMount?.getDocument?.() || draftDocument;
      const cardAtStart = activeCard;
      if (notebookDocumentAssetURLs(documentAtStart, "permitext-notebook-local:").length) {
        await saveNotebookDraft({
          accountUserID: activeAccount().userID,
          projectID,
          cardID: cardAtStart.id,
          title,
          document: documentAtStart
        });
        dirty = false;
        return true;
      }
      const saveTask = (async () => {
        try {
          const payload = await postResearch("/notebook/cards/save", {
            projectID,
            cardID: cardAtStart.id || undefined,
            expectedVersion: cardAtStart.version || 0,
            cardType: cardAtStart.cardType,
            title,
            document: documentAtStart
          });
          if (disposed || activeCard !== cardAtStart) return true;
          const changedDuringSave = notebookRevision !== revisionAtStart;
          const localTitle = activeCard.title;
          const localDocument = draftDocument;
          activeCard = changedDuringSave
            ? { ...payload.card, title: localTitle, document: localDocument }
            : payload.card;
          draftDocument = changedDuringSave ? localDocument : payload.card.document;
          dirty = changedDuringSave;
          const summary = notebookSummaryForCard(activeCard, payload.card);
          cards = [summary, ...cards.filter((card) => card.id !== summary.id)];
          foundation.artifacts = [
            ...(foundation.artifacts || []).filter((artifact) => artifact.envelope?.id !== payload.card.id),
            { envelope: { id: payload.card.id, type: "notebookCard" }, payload: payload.card }
          ];
          await Promise.all([
            deleteNotebookDraft(activeAccount().userID, projectID, cardAtStart.id).catch(() => {}),
            cardAtStart.id ? Promise.resolve() : deleteNotebookDraft(activeAccount().userID, projectID, "").catch(() => {}),
            finalizeNotebookImagesForDocument(
              activeAccount().userID,
              projectID,
              cardAtStart.id,
              notebookDocumentAssetURLs(documentAtStart, "permitext-notebook-asset:")
            ).catch(() => {})
          ]);
          await saveNotebookProjectSnapshot({
            accountUserID: activeAccount().userID,
            projectID,
            foundation,
            cardPayload: { cards, access: { readOnly: notebookReadOnly } }
          }).catch(() => {});
          await saveNotebookCardSnapshot(
            activeAccount().userID,
            projectID,
            payload.card
          ).catch(() => {});
          renderCardList();
          if (changedDuringSave) {
            scheduleNotebookAutosave(180);
          }
          return true;
        } catch (error) {
          if (error.payload?.code === "NOTEBOOK_VERSION_CONFLICT" && error.payload.card) {
            const resolution = resolveNotebookVersionConflict(activeCard, draftDocument, error.payload.card);
            activeCard = resolution.activeCard;
            draftDocument = resolution.draftDocument;
            dirty = resolution.dirty;
            await renderFocusedCard();
            await showWebNotice(
              "Notebook save conflict",
              "Another edit was saved first. Your local draft is preserved; review it before retrying the save."
            );
          } else {
            await showWebNotice("Card not saved", error.message);
          }
          return false;
        }
      })();
      notebookAutosaveTask = saveTask.finally(() => {
        notebookAutosaveTask = null;
      });
      return notebookAutosaveTask;
    }

    flushNotebookAutosave = async () => {
      window.clearTimeout(notebookAutosaveTimer);
      notebookAutosaveTimer = null;
      while (dirty) {
        if (!(await saveActiveNotebookCard())) return false;
        window.clearTimeout(notebookAutosaveTimer);
        notebookAutosaveTimer = null;
      }
      return true;
    };

    async function loadCard(cardID) {
      if (dirty && activeCard && !(await flushNotebookAutosave())) {
        const confirmed = await confirmWebWarning(
          "Discard unsaved Notebook changes?",
          "Your edits to the focused card have not been saved.",
          { confirmLabel: "Discard changes" }
        );
        if (!confirmed) return;
      }
      let payload;
      try {
        payload = await postResearch("/notebook/cards/get", { projectID, cardID });
        await saveNotebookCardSnapshot(
          activeAccount().userID,
          projectID,
          payload.card
        ).catch(() => {});
      } catch (networkError) {
        const cached = await loadNotebookProjectSnapshot(
          activeAccount().userID,
          projectID
        ).catch(() => null);
        const cachedCard = cached?.cardDocuments?.[cardID];
        if (!cachedCard) throw networkError;
        payload = { card: cachedCard };
      }
      activeCard = payload.card;
      const localDraft = await loadNotebookDraft(activeAccount().userID, projectID, cardID).catch(() => null);
      const useLocalDraft = localDraft && String(localDraft.updatedAt) > String(activeCard.updatedAt || "");
      draftDocument = await reconcileNotebookDocumentAssets(useLocalDraft ? localDraft.document : activeCard.document);
      if (useLocalDraft && localDraft.title) activeCard.title = localDraft.title;
      dirty = useLocalDraft;
      renderCardList();
      await renderFocusedCard();
    }

    async function deleteNotebookCard(card, trigger) {
      let target = card;
      if (activeCard?.id === card.id) {
        if (dirty && !(await flushNotebookAutosave())) return;
        target = activeCard;
      }
      const confirmed = await confirmWebWarning(
        "Delete Notebook card?",
        `“${target.title}” will be removed from its linked Projects. Its tombstone remains in sync history.`,
        { confirmLabel: "Delete card" }
      );
      if (!confirmed) return;
      trigger.disabled = true;
      try {
        await postResearch("/notebook/cards/delete", {
          projectID,
          cardID: target.id,
          expectedVersion: target.version
        });
        cards = cards.filter((candidate) => candidate.id !== target.id);
        foundation.artifacts = (foundation.artifacts || []).filter(
          (artifact) => artifact.envelope?.id !== target.id
        );
        await Promise.all([
          deleteNotebookDraft(activeAccount().userID, projectID, target.id).catch(() => {}),
          deleteNotebookCardSnapshot(activeAccount().userID, projectID, target.id).catch(() => {}),
          ...((target.imageAssets || []).map((assetID) =>
            deleteLocalNotebookImage(`permitext-notebook-local:${assetID}`).catch(() => {})
          ))
        ]);
        if (activeCard?.id === target.id) {
          activeCard = null;
          draftDocument = emptyNotebookDocument();
          dirty = false;
          renderCardList();
          await renderFocusedCard();
        } else {
          renderCardList();
        }
      } catch (error) {
        trigger.disabled = false;
        await showWebNotice("Card not deleted", error.message);
      }
    }

    function renderCardList() {
      cardList.replaceChildren();
      if (!cards.length) {
        const empty = document.createElement("p");
        empty.className = "notebook-card-list-empty";
        empty.textContent = "Create a card for a question, finding, decision, or coordination item.";
        cardList.append(empty);
        updateCodeFilterMenu(cardList, cardMenuState, cardMenuOptions);
        return;
      }
      cards.forEach((card) => {
        const row = document.createElement("article");
        row.className = "notebook-card-row";
        const button = document.createElement("button");
        button.className = "notebook-card-tile";
        button.type = "button";
        button.setAttribute("aria-pressed", String(activeCard?.id === card.id));
        const cardTitle = document.createElement("strong");
        cardTitle.textContent = card.title;
        const meta = document.createElement("small");
        meta.textContent = `${card.referenceCount || 0} linked · ${researchRelativeDate(card.updatedAt)}`;
        button.append(cardTitle, meta);
        button.addEventListener("click", () => {
          void loadCard(card.id).catch((error) => showWebNotice("Card not opened", error.message));
        });
        row.append(button);
        if (!notebookReadOnly) {
          const deleteButton = document.createElement("button");
          deleteButton.className = "notebook-card-delete";
          deleteButton.type = "button";
          deleteButton.title = "Delete card";
          deleteButton.setAttribute("aria-label", `Delete ${card.title}`);
          deleteButton.innerHTML = trashIconSVG();
          deleteButton.addEventListener("click", () => {
            void deleteNotebookCard(card, deleteButton);
          });
          row.append(deleteButton);
        }
        cardList.append(row);
      });
      updateCodeFilterMenu(cardList, cardMenuState, cardMenuOptions);
    }

    async function renderFocusedCard() {
      editorRenderSequence += 1;
      const renderSequence = editorRenderSequence;
      editorMount?.destroy?.();
      editorMount = null;
      notebookObjectURLs.forEach((url) => URL.revokeObjectURL(url));
      notebookObjectURLs.clear();
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
      const titleInput = document.createElement("input");
      titleInput.className = "notebook-card-title";
      titleInput.type = "text";
      titleInput.maxLength = 300;
      titleInput.placeholder = "Card title";
      titleInput.setAttribute("aria-label", "Notebook card title");
      titleInput.value = activeCard.title;
      titleInput.disabled = notebookReadOnly;
      fields.append(titleInput);

      const toolbar = document.createElement("div");
      toolbar.className = "notebook-toolbar code-filter-menu notebook-reference-menu";
      toolbar.setAttribute("aria-label", "Notebook references");
      const referenceToggle = document.createElement("button");
      referenceToggle.className = "code-filter-menu-toggle notebook-reference-menu-toggle";
      referenceToggle.type = "button";
      const referenceLabel = document.createElement("span");
      referenceLabel.className = "code-filter-menu-label";
      referenceLabel.textContent = "Insert reference";
      const referenceIcon = document.createElement("span");
      referenceIcon.className = "code-filter-menu-icon";
      referenceIcon.setAttribute("aria-hidden", "true");
      referenceIcon.innerHTML = `
        <svg class="code-filter-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 10 4 4 4-4"></path></svg>
        <svg class="code-filter-chevron-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 14 4-4 4 4"></path></svg>
      `;
      referenceToggle.append(referenceLabel, referenceIcon);
      const referenceList = document.createElement("div");
      referenceList.className = "notebook-reference-list";
      const candidates = (await notebookReferenceCandidates(projectID, foundation, cards))
        .filter((reference) =>
          reference.referenceKind !== "notebookCard" ||
          reference.referenceID !== activeCard.id
        );
      let activeCodeGroup = "";
      candidates.forEach((reference, index) => {
        if (reference.referenceKind === "canonicalSection" && reference.codePrefix !== activeCodeGroup) {
          activeCodeGroup = reference.codePrefix;
          const groupTitle = document.createElement("h4");
          groupTitle.className = `notebook-reference-group-title code-theme-${codeTheme(reference.codePrefix)}`;
          groupTitle.textContent = notebookReferenceCodeTitle(reference.codePrefix);
          referenceList.append(groupTitle);
        }
        const option = document.createElement("button");
        option.className = "notebook-reference-option";
        option.type = "button";
        option.dataset.referenceIndex = String(index);
        option.textContent = reference.label;
        referenceList.append(option);
      });
      if (!candidates.length) {
        const empty = document.createElement("p");
        empty.className = "notebook-reference-empty";
        empty.textContent = "No Project references are available yet.";
        referenceList.append(empty);
      }
      toolbar.append(referenceToggle, referenceList);
      const referenceMenuState = { referenceMenuOpen: false };
      const referenceMenuOptions = {
        stateKey: "referenceMenuOpen",
        menuName: "Notebook references",
        label: "Insert reference"
      };
      wireCodeFilterMenu(referenceList, referenceMenuState, referenceMenuOptions);
      referenceToggle.disabled = notebookReadOnly || !candidates.length;
      if (notebookReadOnly) {
        toolbar.querySelectorAll("button").forEach((control) => {
          control.disabled = true;
        });
      }

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
      const footerActions = document.createElement("div");
      const researchButton = document.createElement("button");
      researchButton.className = "notebook-secondary-action";
      researchButton.type = "button";
      researchButton.textContent = "Start Research";
      researchButton.title = "Use this card as the starting point for a new evidence-selected Research question";
      researchButton.hidden = notebookReadOnly;
      footerActions.append(researchButton);
      footer.append(footerActions);
      focus.append(fields, toolbar, editorElement, footer);

      titleInput.addEventListener("input", () => {
        activeCard.title = titleInput.value;
        markNotebookDirty();
      });

      const module = await loadNotebookModule();
      if (disposed || renderSequence !== editorRenderSequence) return;
      editorMount = module.mountPermitextNotebookEditor(editorElement, {
        document: draftDocument,
        autofocus: !notebookReadOnly && !activeCard.id,
        editable: !notebookReadOnly,
        uploadFile: (file) => uploadNotebookAsset(projectID, file, activeCard.id).catch((error) => {
          void showWebNotice("Image not added", error.message);
          throw error;
        }),
        async resolveFileUrl(url) {
          const resolved = await resolveNotebookAsset(projectID, url);
          if (resolved.startsWith("blob:")) notebookObjectURLs.add(resolved);
          return resolved;
        },
        onChange(document) {
          if (notebookReadOnly) return;
          draftDocument = document;
          void saveNotebookDraft({
            accountUserID: activeAccount().userID,
            projectID,
            cardID: activeCard.id,
            title: activeCard.title,
            document
          }).catch(() => {});
          void pruneUnusedPendingNotebookImages(
            activeAccount().userID,
            projectID,
            activeCard.id,
            document
          );
          markNotebookDirty();
        },
        onOpenReference: null
      });
      referenceList.querySelectorAll(".notebook-reference-option").forEach((option) => {
        option.addEventListener("click", () => {
          const reference = candidates[Number(option.dataset.referenceIndex)];
          if (!reference) return;
          editorMount?.insertReference(reference);
          referenceMenuState.referenceMenuOpen = false;
          updateCodeFilterMenu(referenceList, referenceMenuState, referenceMenuOptions);
        });
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
      if (dirty && activeCard && !(await flushNotebookAutosave())) {
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
    const unsavedDraft = notebookReadOnly
      ? null
      : await loadNotebookDraft(activeAccount().userID, projectID, "").catch(() => null);
    if (unsavedDraft?.document) {
      activeCard = {
        id: "",
        version: 0,
        cardType: "finding",
        title: unsavedDraft.title || "",
        plainText: "",
        references: []
      };
      draftDocument = await reconcileNotebookDocumentAssets(unsavedDraft.document);
      dirty = true;
      renderCardList();
      await renderFocusedCard();
    } else if (cards[0]) {
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

function emptyProjectReportDraft(project) {
  return {
    id: "",
    version: 0,
    title: `${project.name || "Project"} Code Research Report`,
    reportDate: new Date().toISOString(),
    introduction: "",
    blocks: []
  };
}

function reportSourceClassificationLabel(value) {
  return {
    "published-code": "Published code",
    "user-authored": "User-authored",
    "ai-assisted": "AI-assisted Research",
    "project-material": "Project material"
  }[value] || "Project content";
}

function reportBlockTitle(block) {
  if (block.kind === "heading") return block.text || "Heading";
  if (block.kind === "paragraph") return (block.text || "Paragraph").slice(0, 80);
  if (block.kind === "list") return `${block.items?.length || 0} list items`;
  return block.label || block.title || block.kind;
}

function appendReportPDFList(documentRoot, parent, title, items) {
  const normalized = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!normalized.length) return;
  const heading = documentRoot.createElement("h4");
  heading.textContent = title;
  const list = documentRoot.createElement("ul");
  normalized.forEach((item) => {
    const row = documentRoot.createElement("li");
    row.textContent = String(item);
    list.append(row);
  });
  parent.append(heading, list);
}

function printReportManifestAsPDF(manifest) {
  if (!hasCapability("professional-exports")) {
    void presentPlanLimitNotice(
      "Professional reports require Pro",
      "Upgrade to Pro to render a Project Report Manifest as PDF."
    );
    return;
  }
  const frame = document.createElement("iframe");
  frame.className = "saved-print-frame";
  frame.title = `${manifest.title || "Project Report"} PDF export`;
  frame.srcdoc = "<!doctype html><html><head><title>Permitext Project Report</title></head><body></body></html>";
  frame.addEventListener("load", () => {
    const documentRoot = frame.contentDocument;
    if (!documentRoot) return;
    const presentation = manifest.presentation || {};
    const accentCandidate = String(presentation.branding?.accentColorHex || "").toLowerCase();
    const accent = /^#[0-9a-f]{6}$/.test(accentCandidate) ? accentCandidate : "#9a4f12";
    const style = documentRoot.createElement("style");
    style.textContent = `
      body{margin:0;color:#161616;font:10.5pt/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
      main{max-width:7.2in;margin:0 auto;padding:.55in .5in .7in}
      .cover{min-height:7.4in;display:flex;flex-direction:column;justify-content:center;break-after:page}
      .eyebrow,.classification{font-size:8pt;font-weight:750;letter-spacing:.09em;text-transform:uppercase}
      .eyebrow{color:${accent}}.classification{display:inline-block;margin-bottom:8px;padding:4px 7px;border-radius:999px;background:#f1ece7;color:#5a4a3d}
      h1{margin:8px 0 14px;font-size:30pt;line-height:1.08}h2{margin:28px 0 10px;font-size:17pt}h3{margin:0 0 8px;font-size:13pt}h4{margin:12px 0 4px;font-size:9pt;text-transform:uppercase;letter-spacing:.06em}
      p{margin:0 0 10px}.meta{color:#555}.legend{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:28px}
      article{margin:0 0 18px;padding:16px;border-radius:10px;background:#f7f5f2;break-inside:avoid}
      article.published-code{background:#f5eee6}article.ai-assisted{background:#eef1f8}article.user-authored{background:#f4f1f8}
      blockquote{margin:10px 0 0;padding-left:14px;border-left:3px solid ${accent};color:#333}
      ul{margin:4px 0 10px;padding-left:20px}.disclaimers{margin-top:32px;padding-top:16px;border-top:1px solid #bbb;color:#555;font-size:8.5pt}
      .hash{margin-top:14px;overflow-wrap:anywhere;font:7pt/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#777}
      @page{margin:.35in}
    `;
    documentRoot.head.append(style);
    const main = documentRoot.createElement("main");
    const cover = documentRoot.createElement("section");
    cover.className = "cover";
    const eyebrow = documentRoot.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = presentation.template?.coverLabel || "Permitext Project Report";
    const brand = documentRoot.createElement("p");
    brand.className = "meta";
    brand.textContent = [
      presentation.branding?.displayName,
      presentation.branding?.website
    ].filter(Boolean).join(" · ");
    const title = documentRoot.createElement("h1");
    title.textContent = manifest.title;
    const projectName = documentRoot.createElement("h2");
    projectName.textContent = manifest.project?.name || "Project";
    const metadata = documentRoot.createElement("p");
    metadata.className = "meta";
    metadata.textContent = [
      manifest.project?.address,
      new Date(manifest.reportDate).toLocaleDateString(),
      manifest.author?.displayName,
      `Report version ${manifest.reportVersion}`,
      manifest.codeEdition
    ].filter(Boolean).join(" · ");
    const legend = documentRoot.createElement("div");
    legend.className = "legend";
    ["Published code", "User-authored", "AI-assisted Research", "Project material"].forEach((label) => {
      const item = documentRoot.createElement("span");
      item.className = "classification";
      item.textContent = label;
      legend.append(item);
    });
    cover.append(eyebrow);
    if (brand.textContent) cover.append(brand);
    cover.append(title, projectName, metadata, legend);
    main.append(cover);

    (manifest.items || []).forEach((item) => {
      if (item.kind === "heading") {
        const heading = documentRoot.createElement("h2");
        heading.textContent = item.text;
        main.append(heading);
        return;
      }
      if (item.kind === "paragraph") {
        const paragraph = documentRoot.createElement("p");
        paragraph.textContent = item.text;
        main.append(paragraph);
        return;
      }
      if (item.kind === "list") {
        const list = documentRoot.createElement("ul");
        (item.items || []).forEach((value) => {
          const row = documentRoot.createElement("li");
          row.textContent = value;
          list.append(row);
        });
        main.append(list);
        return;
      }
      const article = documentRoot.createElement("article");
      article.className = item.sourceClassification || "";
      const classification = documentRoot.createElement("span");
      classification.className = "classification";
      classification.textContent = reportSourceClassificationLabel(item.sourceClassification);
      article.append(classification);
      if (item.kind === "evidence") {
        const heading = documentRoot.createElement("h3");
        heading.textContent = `${item.codeBook} ${item.sectionNumber}: ${item.title}`;
        const passage = documentRoot.createElement("blockquote");
        passage.textContent = item.passageText;
        article.append(heading, passage);
      } else if (item.kind === "notebookCard") {
        const heading = documentRoot.createElement("h3");
        heading.textContent = item.title;
        const body = documentRoot.createElement("p");
        body.textContent = item.plainText;
        article.append(heading, body);
      } else if (item.kind === "researchAnswer") {
        const heading = documentRoot.createElement("h3");
        heading.textContent = item.question;
        const conclusion = documentRoot.createElement("p");
        const conclusionLabel = documentRoot.createElement("strong");
        conclusionLabel.textContent = "Supported conclusion: ";
        conclusion.append(conclusionLabel, documentRoot.createTextNode(researchDisplayText(item.conclusion)));
        article.append(heading, conclusion);
        appendReportPDFList(
          documentRoot,
          article,
          "What the selected evidence establishes",
          (item.supportedPoints || []).map((point) =>
            [researchDisplayText(point.heading), researchDisplayText(point.explanation)]
              .filter(Boolean)
              .join(": ")
          )
        );
        if (item.explanation) {
          const explanation = documentRoot.createElement("p");
          const explanationLabel = documentRoot.createElement("strong");
          explanationLabel.textContent = item.supportedPoints?.length
            ? "Practical application: "
            : "Explanation: ";
          explanation.append(
            explanationLabel,
            documentRoot.createTextNode(researchDisplayText(item.explanation))
          );
          article.append(explanation);
        }
        appendReportPDFList(documentRoot, article, "Assumptions", researchDisplayList(item.assumptions));
        appendReportPDFList(
          documentRoot,
          article,
          "Project facts to verify",
          researchDisplayList(item.missingFacts)
        );
        appendReportPDFList(
          documentRoot,
          article,
          "Limits of this answer",
          researchDisplayList(item.limitations)
        );
        appendReportPDFList(
          documentRoot,
          article,
          "Related evidence to add",
          researchDisplayList(item.additionalEvidenceNeeded)
        );
        appendReportPDFList(
          documentRoot,
          article,
          "Citations",
          (item.citations || []).map((citation) =>
            [citation.sectionID, ...(citation.sourceIDs || [])].filter(Boolean).join(" · ")
          )
        );
      } else {
        const heading = documentRoot.createElement("h3");
        heading.textContent = item.title || "Project material";
        const detail = documentRoot.createElement("p");
        detail.textContent = item.contentType || "Included Project material";
        article.append(heading, detail);
      }
      main.append(article);
    });

    const disclaimers = documentRoot.createElement("section");
    disclaimers.className = "disclaimers";
    const disclaimerHeading = documentRoot.createElement("h3");
    disclaimerHeading.textContent = "Professional-use notice";
    disclaimers.append(disclaimerHeading);
    (manifest.disclaimers || []).forEach((value) => {
      const paragraph = documentRoot.createElement("p");
      paragraph.textContent = value;
      disclaimers.append(paragraph);
    });
    const hash = documentRoot.createElement("p");
    hash.className = "hash";
    hash.textContent = `Manifest ${manifest.id} · ${manifest.generatorVersion} · SHA-256 ${manifest.contentHash}`;
    disclaimers.append(hash);
    main.append(disclaimers);
    documentRoot.body.append(main);
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, { once: true });
  document.body.append(frame);
}

async function renderProjectReportDraft(project) {
  const identity = projectIdentity(project);
  const projectID = projectDetailKey(identity);
  const paneID = paneIDForProjectReportDraft(identity);
  reportDraftMounts.get(projectID)?.dispose?.();

  const panel = document.createElement("article");
  panel.className = "workspace-panel report-draft-panel";
  panel.dataset.paneId = paneID;
  panel.dataset.projectId = projectID;
  panel.style.setProperty("--project-color", identity.color || "#c96410");
  applyPaneWeight(panel, paneID);

  const header = document.createElement("header");
  header.className = "report-draft-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "report-draft-eyebrow";
  eyebrow.textContent = identity.name;
  const title = document.createElement("h2");
  title.textContent = "Report Draft";
  heading.append(eyebrow, title);
  const closeButton = document.createElement("button");
  closeButton.className = "report-draft-close";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => {
    void closeProjectReportDraft(identity);
  });
  header.append(heading, closeButton);

  const shell = document.createElement("div");
  shell.className = "report-draft-shell";
  const status = document.createElement("p");
  status.className = "report-draft-status";
  status.setAttribute("role", "status");
  status.textContent = "Loading Report Draft…";
  shell.append(status);
  panel.append(header, shell);

  let drafts = [];
  let sources = [];
  let history = [];
  let reportOptions = {
    templates: [],
    defaultReportTemplateID: "permitext-standard",
    branding: { displayName: "Permitext", accentColorHex: "#a65318" },
    tags: []
  };
  let selectedReportTemplateID = "permitext-standard";
  let activeDraft = emptyProjectReportDraft(identity);
  let dirty = false;
  let disposed = false;

  const mountState = {
    panel,
    async confirmDiscardIfNeeded() {
      if (!dirty) return true;
      return confirmWebWarning(
        "Discard unsaved Report Draft changes?",
        `Your edits to “${activeDraft.title || "Untitled report"}” have not been saved.`,
        { confirmLabel: "Discard changes" }
      );
    },
    dispose() {
      disposed = true;
    }
  };
  reportDraftMounts.set(projectID, mountState);

  if (!activeAccount()) {
    status.textContent = "Sign in from Settings to use private Project Reports.";
    return panel;
  }

  const setDirty = () => {
    dirty = true;
    status.textContent = "Unsaved changes";
  };

  const saveDraft = async () => {
    status.textContent = "Saving Report Draft…";
    try {
      const payload = await postResearch("/reports/drafts/save", {
        projectID,
        draftID: activeDraft.id,
        expectedVersion: activeDraft.version || 0,
        title: activeDraft.title,
        reportDate: activeDraft.reportDate,
        introduction: activeDraft.introduction,
        blocks: activeDraft.blocks
      });
      activeDraft = structuredClone(payload.draft);
      const index = drafts.findIndex((draft) => draft.id === activeDraft.id);
      if (index === -1) drafts.unshift(structuredClone(activeDraft));
      else drafts[index] = structuredClone(activeDraft);
      dirty = false;
      status.textContent = `Saved revision ${activeDraft.version}`;
      renderWorkspaceContent();
      return true;
    } catch (error) {
      status.textContent = error.message || "The Report Draft could not be saved.";
      return false;
    }
  };

  const openHistoricalReport = async (manifestID) => {
    status.textContent = "Loading immutable Report…";
    try {
      const payload = await postResearch("/reports/manifests/get", { manifestID });
      status.textContent = `Opened Report version ${payload.manifest.reportVersion}`;
      printReportManifestAsPDF(payload.manifest);
    } catch (error) {
      status.textContent = error.message || "The historical Report could not be opened.";
    }
  };

  const generateReport = async () => {
    if ((dirty || !activeDraft.id) && !(await saveDraft())) return;
    if (!activeDraft.blocks.length && !activeDraft.introduction) {
      status.textContent = "Add at least one Report item before generating a PDF.";
      return;
    }
    status.textContent = "Creating immutable Report Manifest…";
    try {
      const payload = await postResearch("/reports/generate", {
        projectID,
        draftID: activeDraft.id,
        reportTemplateID: selectedReportTemplateID
      });
      const historyPayload = await postResearch("/reports/history/list", { projectID });
      history = historyPayload.reports || [];
      status.textContent = `Generated immutable Report version ${payload.manifest.reportVersion}`;
      renderWorkspaceContent();
      printReportManifestAsPDF(payload.manifest);
      await transitionWorkspace("utility", {
        refreshPaneIDs: [paneIDForProjectDetail(identity)]
      });
    } catch (error) {
      status.textContent = error.message || "The Report could not be generated.";
    }
  };

  function renderBlockEditor(container) {
    if (!activeDraft.blocks.length) {
      const empty = document.createElement("p");
      empty.className = "report-draft-empty";
      empty.textContent = "Add a paragraph, heading, list, or Project source to begin the professional narrative.";
      container.append(empty);
      return;
    }
    activeDraft.blocks.forEach((block, index) => {
      const row = document.createElement("article");
      row.className = `report-draft-block report-draft-block-${block.kind}`;
      const top = document.createElement("div");
      top.className = "report-draft-block-top";
      const label = document.createElement("span");
      label.className = "report-draft-classification";
      label.textContent = reportSourceClassificationLabel(
        block.sourceClassification ||
        (["heading", "paragraph", "list"].includes(block.kind) ? "user-authored" : sources.find((source) =>
          source.id === block.sourceID && source.kind === block.kind
        )?.sourceClassification)
      );
      const actions = document.createElement("div");
      actions.className = "report-draft-block-actions";
      [
        { label: "Move up", text: "↑", disabled: index === 0, action: () => index - 1 },
        {
          label: "Move down",
          text: "↓",
          disabled: index === activeDraft.blocks.length - 1,
          action: () => index + 1
        }
      ].forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action.text;
        button.title = action.label;
        button.setAttribute("aria-label", action.label);
        button.disabled = action.disabled;
        button.addEventListener("click", () => {
          const target = action.action();
          const [moved] = activeDraft.blocks.splice(index, 1);
          activeDraft.blocks.splice(target, 0, moved);
          setDirty();
          renderWorkspaceContent();
        });
        actions.append(button);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        activeDraft.blocks.splice(index, 1);
        setDirty();
        renderWorkspaceContent();
      });
      actions.append(remove);
      top.append(label, actions);
      row.append(top);

      if (block.kind === "heading") {
        const input = document.createElement("input");
        input.type = "text";
        input.value = block.text || "";
        input.placeholder = "Report heading";
        input.setAttribute("aria-label", "Report heading");
        input.addEventListener("input", () => {
          block.text = input.value;
          setDirty();
        });
        row.append(input);
      } else if (block.kind === "paragraph") {
        const textarea = document.createElement("textarea");
        textarea.value = block.text || "";
        textarea.placeholder = "Professional narrative paragraph";
        textarea.setAttribute("aria-label", "Report paragraph");
        textarea.addEventListener("input", () => {
          block.text = textarea.value;
          setDirty();
        });
        row.append(textarea);
      } else if (block.kind === "list") {
        const textarea = document.createElement("textarea");
        textarea.value = (block.items || []).join("\n");
        textarea.placeholder = "One list item per line";
        textarea.setAttribute("aria-label", "Report list items");
        textarea.addEventListener("input", () => {
          block.items = textarea.value.split("\n").map((value) => value.trim()).filter(Boolean);
          setDirty();
        });
        row.append(textarea);
      } else {
        const sourceTitle = document.createElement("strong");
        sourceTitle.textContent = reportBlockTitle(block);
        const source = sources.find((item) => item.kind === block.kind && item.id === block.sourceID);
        if (source?.summary) {
          const summary = document.createElement("p");
          summary.textContent = source.summary;
          row.append(sourceTitle, summary);
        } else {
          row.append(sourceTitle);
        }
      }
      container.append(row);
    });
  }

  function renderSourcePalette(container) {
    const title = document.createElement("p");
    title.className = "section-label";
    title.textContent = "Project sources";
    container.append(title);
    if (!sources.length) {
      const empty = document.createElement("p");
      empty.className = "report-draft-empty";
      empty.textContent = "Link evidence, Notebook cards, or supported Research to this Project before inserting it.";
      container.append(empty);
      return;
    }
    sources.forEach((source) => {
      const row = document.createElement("article");
      row.className = "report-source-card";
      const copy = document.createElement("div");
      const label = document.createElement("span");
      label.className = "report-draft-classification";
      label.textContent = reportSourceClassificationLabel(source.sourceClassification);
      const heading = document.createElement("strong");
      heading.textContent = source.label;
      const summary = document.createElement("p");
      summary.textContent = source.summary || "Project source";
      copy.append(label, heading, summary);
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "Add";
      add.disabled = activeDraft.blocks.some((block) =>
        block.kind === source.kind && block.sourceID === source.id
      );
      add.addEventListener("click", () => {
        activeDraft.blocks.push({
          id: crypto.randomUUID(),
          kind: source.kind,
          sourceID: source.id,
          label: source.label,
          sourceClassification: source.sourceClassification
        });
        setDirty();
        renderWorkspaceContent();
      });
      row.append(copy, add);
      container.append(row);
    });
  }

  function renderHistory(container) {
    const title = document.createElement("p");
    title.className = "section-label";
    title.textContent = "Immutable Report history";
    container.append(title);
    if (!history.length) {
      const empty = document.createElement("p");
      empty.className = "report-draft-empty";
      empty.textContent = "Generated reports will appear here as dated, immutable versions.";
      container.append(empty);
      return;
    }
    history.forEach((report) => {
      const entry = document.createElement("article");
      entry.className = "report-history-entry";
      const button = document.createElement("button");
      button.className = "report-history-card";
      button.type = "button";
      const heading = document.createElement("strong");
      heading.textContent = `Version ${report.reportVersion} · ${report.title}`;
      const meta = document.createElement("span");
      meta.textContent = [
        new Date(report.createdAt).toLocaleDateString(),
        `${report.itemCount} ${report.itemCount === 1 ? "item" : "items"}`,
        report.presentation?.template?.name,
        report.author?.displayName
      ].filter(Boolean).join(" · ");
      button.append(heading, meta);
      button.addEventListener("click", () => {
        void openHistoricalReport(report.id);
      });
      entry.append(button);
      const files = Array.isArray(report.files) ? report.files : [];
      if (files.length) {
        const fileActions = document.createElement("div");
        fileActions.className = "report-history-files";
        files.forEach((file) => {
          const download = document.createElement("button");
          download.type = "button";
          download.textContent = file.format === "ios-pdf"
            ? "Download iOS PDF"
            : "Download Web PDF";
          download.addEventListener("click", async () => {
            download.disabled = true;
            status.textContent = "Downloading private Report PDF…";
            try {
              await downloadProjectReportFile(projectID, file, report.title);
              status.textContent = `Downloaded Report version ${report.reportVersion}`;
            } catch (error) {
              status.textContent = error.message || "The Report PDF could not be downloaded.";
            } finally {
              download.disabled = false;
            }
          });
          fileActions.append(download);
        });
        entry.append(fileActions);
      }
      container.append(entry);
    });
  }

  function renderWorkspaceContent() {
    if (disposed) return;
    shell.querySelectorAll(":scope > :not(.report-draft-status)").forEach((element) => element.remove());

    const draftPicker = document.createElement("div");
    draftPicker.className = "report-draft-picker";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Report Draft");
    const currentOption = document.createElement("option");
    currentOption.value = activeDraft.id || "";
    currentOption.textContent = activeDraft.id
      ? `${activeDraft.title} · revision ${activeDraft.version}`
      : "New Report Draft";
    select.append(currentOption);
    drafts.filter((draft) => draft.id !== activeDraft.id).forEach((draft) => {
      const option = document.createElement("option");
      option.value = draft.id;
      option.textContent = `${draft.title} · revision ${draft.version}`;
      select.append(option);
    });
    const newOption = document.createElement("option");
    newOption.value = "__new__";
    newOption.textContent = "New Report Draft…";
    select.append(newOption);
    select.addEventListener("change", async () => {
      if (dirty && !(await mountState.confirmDiscardIfNeeded())) {
        select.value = activeDraft.id || "";
        return;
      }
      activeDraft = select.value === "__new__"
        ? emptyProjectReportDraft(identity)
        : structuredClone(
            drafts.find((draft) => draft.id === select.value) || emptyProjectReportDraft(identity)
          );
      dirty = false;
      status.textContent = activeDraft.id ? `Loaded revision ${activeDraft.version}` : "New Report Draft";
      renderWorkspaceContent();
    });
    draftPicker.append(select);
    const templateSelect = document.createElement("select");
    templateSelect.setAttribute("aria-label", "Firm Report template");
    (reportOptions.templates || []).forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = `${template.name} · ${template.coverLabel}`;
      templateSelect.append(option);
    });
    templateSelect.value = selectedReportTemplateID;
    templateSelect.addEventListener("change", () => {
      selectedReportTemplateID = templateSelect.value;
      renderWorkspaceContent();
    });
    draftPicker.append(templateSelect);
    if (reportOptions.tags?.length) {
      const tags = document.createElement("p");
      tags.className = "report-draft-empty";
      tags.textContent = `Firm tags: ${reportOptions.tags.map((tag) => tag.name).join(", ")}`;
      draftPicker.append(tags);
    }

    const metadata = document.createElement("div");
    metadata.className = "report-draft-metadata";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = activeDraft.title || "";
    titleInput.placeholder = "Report title";
    titleInput.setAttribute("aria-label", "Report title");
    titleInput.addEventListener("input", () => {
      activeDraft.title = titleInput.value;
      setDirty();
    });
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = String(activeDraft.reportDate || new Date().toISOString()).slice(0, 10);
    dateInput.setAttribute("aria-label", "Report date");
    dateInput.addEventListener("input", () => {
      activeDraft.reportDate = `${dateInput.value}T12:00:00.000Z`;
      setDirty();
    });
    const introduction = document.createElement("textarea");
    introduction.value = activeDraft.introduction || "";
    introduction.placeholder = "Optional report introduction";
    introduction.setAttribute("aria-label", "Report introduction");
    introduction.addEventListener("input", () => {
      activeDraft.introduction = introduction.value;
      setDirty();
    });
    metadata.append(titleInput, dateInput, introduction);

    const addControls = document.createElement("div");
    addControls.className = "report-draft-add-controls";
    [
      { kind: "heading", label: "Add heading", value: { text: "Report section" } },
      { kind: "paragraph", label: "Add paragraph", value: { text: "" } },
      { kind: "list", label: "Add list", value: { items: [""] } }
    ].forEach((control) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = control.label;
      button.addEventListener("click", () => {
        activeDraft.blocks.push({
          id: crypto.randomUUID(),
          kind: control.kind,
          sourceClassification: "user-authored",
          ...structuredClone(control.value)
        });
        setDirty();
        renderWorkspaceContent();
      });
      addControls.append(button);
    });

    const blocks = document.createElement("section");
    blocks.className = "report-draft-blocks";
    renderBlockEditor(blocks);
    const sourcePalette = document.createElement("section");
    sourcePalette.className = "report-source-palette";
    renderSourcePalette(sourcePalette);

    const primaryActions = document.createElement("div");
    primaryActions.className = "report-draft-primary-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = activeDraft.id ? "Save revision" : "Save draft";
    save.addEventListener("click", () => {
      void saveDraft();
    });
    const generate = document.createElement("button");
    generate.type = "button";
    generate.textContent = "Generate Report PDF";
    generate.addEventListener("click", () => {
      void generateReport();
    });
    primaryActions.append(save, generate);

    const preview = document.createElement("section");
    preview.className = "report-draft-preview";
    const previewTitle = document.createElement("p");
    previewTitle.className = "section-label";
    const selectedTemplate = (reportOptions.templates || []).find((template) =>
      template.id === selectedReportTemplateID
    );
    previewTitle.textContent = selectedTemplate?.coverLabel || "Report preview";
    const previewHeading = document.createElement("h3");
    previewHeading.textContent = activeDraft.title || "Untitled Report";
    const previewMeta = document.createElement("p");
    previewMeta.textContent = `${identity.name} · ${new Date(activeDraft.reportDate).toLocaleDateString()}`;
    preview.append(previewTitle, previewHeading, previewMeta);
    if (activeDraft.introduction) {
      const paragraph = document.createElement("p");
      paragraph.textContent = activeDraft.introduction;
      preview.append(paragraph);
    }
    activeDraft.blocks.slice(0, 12).forEach((block) => {
      const row = document.createElement(block.kind === "heading" ? "h4" : "p");
      row.textContent = reportBlockTitle(block);
      row.className = `report-preview-${block.kind}`;
      preview.append(row);
    });

    const historySection = document.createElement("section");
    historySection.className = "report-history";
    renderHistory(historySection);
    shell.append(
      draftPicker,
      metadata,
      addControls,
      blocks,
      sourcePalette,
      primaryActions,
      preview,
      historySection
    );
  }

  try {
    const [draftPayload, sourcePayload, historyPayload, optionsPayload] = await Promise.all([
      postResearch("/reports/drafts/list", { projectID }),
      postResearch("/reports/sources/list", { projectID }),
      postResearch("/reports/history/list", { projectID }),
      postResearch("/reports/options", { projectID })
    ]);
    if (disposed) return panel;
    drafts = draftPayload.drafts || [];
    sources = sourcePayload.sources || [];
    history = historyPayload.reports || [];
    reportOptions = optionsPayload;
    selectedReportTemplateID = optionsPayload.defaultReportTemplateID ||
      optionsPayload.templates?.[0]?.id ||
      "permitext-standard";
    activeDraft = drafts[0] ? structuredClone(drafts[0]) : emptyProjectReportDraft(identity);
    status.textContent = activeDraft.id ? `Loaded revision ${activeDraft.version}` : "New Report Draft";
    renderWorkspaceContent();
  } catch (error) {
    status.textContent = error.payload?.code === "PRO_REQUIRED_EXPORTS"
      ? "Professional Project Reports are included with Permitext Pro."
      : `Report Draft unavailable: ${error.message}`;
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
    const reportDraftID = paneIDForProjectReportDraft(detail);
    delete state.paneWeights[detailID];
    delete state.paneWeights[workboardID];
    delete state.paneWeights[notebookID];
    delete state.paneWeights[reportDraftID];
    state.paneOrder = (state.paneOrder || [])
      .filter((id) =>
        id !== detailID &&
        id !== workboardID &&
        id !== notebookID &&
        id !== reportDraftID
      );
  });
  state.workboards = openWorkboards().filter((item) => !projectDetailMatches(project, item));
  state.notebooks = openNotebooks().filter((item) => !projectDetailMatches(project, item));
  state.reportDrafts = openReportDrafts().filter((item) => !projectDetailMatches(project, item));
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

function projectActivityLabel(event) {
  return {
    "item.linked": "Project item linked",
    "item.unlinked": "Project item removed",
    "note.created": "Note created",
    "note.revision.saved": "Note revision saved",
    "notebook-card.created": "Notebook card created",
    "notebook-card.revision.saved": "Notebook revision saved",
    "evidence.approved": "Evidence approved",
    "evidence.removed": "Evidence removed",
    "research.question.submitted": "Research question submitted",
    "research.answer.generated": "Research answer generated",
    "research.project-context.reviewed": "Project context reviewed",
    "review-status.changed": "Review status changed",
    "report.generated": "Report generated",
    "report.export.saved": "Report export saved",
    "project.transferred": "Project transferred to firm",
    "project.archived": "Project archived",
    "project.restored": "Project restored"
  }[event?.action] || String(event?.action || "Project updated").replaceAll(".", " ");
}

async function focusProjectResearch(project) {
  const projectID = projectDetailKey(project);
  const foundation = activeAccount()
    ? await postResearch("/projects/foundation/state", { projectID }).catch(() => null)
    : null;
  const conversation = (foundation?.researchConversations || [])[0];
  if (conversation) {
    await openResearchConversation(conversation.id);
    return;
  }
  const wasOpen = Boolean(state.utilities.analysis);
  await focusUtility("analysis");
  if (wasOpen) {
    await transitionWorkspace("utility", { refreshPaneIDs: ["utility:analysis"] });
    scrollPaneIntoView("utility:analysis");
  }
}

function projectSectionCount(value, label) {
  const count = document.createElement("span");
  count.className = "project-section-count";
  count.textContent = String(value);
  count.setAttribute("aria-label", `${value} ${label}`);
  return count;
}

function appendProjectResearchContextEditor(content, identity, initialConversation) {
  if (
    !initialConversation?.id ||
    initialConversation.primaryProjectID !== projectDetailKey(identity)
  ) {
    return;
  }
  let conversation = initialConversation;
  const section = document.createElement("section");
  section.className = "project-studio-section project-research-context-editor";
  const heading = document.createElement("div");
  heading.className = "project-studio-section-heading";
  const title = document.createElement("p");
  title.className = "section-label";
  title.textContent = "Additional research facts";
  const conversationLabel = document.createElement("span");
  conversationLabel.className = "project-research-context-conversation";
  conversationLabel.textContent = conversation.title || "Active Research conversation";
  heading.append(title, conversationLabel);
  const copy = document.createElement("p");
  copy.className = "project-studio-copy";
  copy.textContent = "One fact per line. These facts are context only and are never treated as code authority or cited evidence.";
  const warning = document.createElement("aside");
  warning.className = "research-project-context-warning";
  const warningTitle = document.createElement("strong");
  warningTitle.textContent = "Context review required";
  const warningCopy = document.createElement("p");
  warningCopy.textContent = "Review or replace these additional Research facts before generating another answer.";
  warning.append(warningTitle, warningCopy);
  warning.hidden = !conversation.projectContextReviewRequired;
  const form = document.createElement("section");
  form.className = "research-project-context-form";
  const label = document.createElement("label");
  label.textContent = "Additional research facts — one per line";
  const facts = document.createElement("textarea");
  facts.rows = 4;
  facts.maxLength = 10_000;
  facts.placeholder = "Example: Existing building is Type I-B construction";
  facts.value = (conversation.projectContext?.facts || []).join("\n");
  label.append(facts);
  const status = document.createElement("p");
  status.className = "research-project-context-status";
  let autosaveTimer = 0;
  let saveSequence = 0;
  let lastSavedFacts = JSON.stringify(conversation.projectContext?.facts || []);
  const saveProjectContextAutomatically = async () => {
    window.clearTimeout(autosaveTimer);
    const normalizedFacts = facts.value
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (normalizedFacts.length > 20 || normalizedFacts.some((item) => item.length > 500)) {
      status.textContent = "Use no more than 20 facts and 500 characters per fact.";
      return;
    }
    const serializedFacts = JSON.stringify(normalizedFacts);
    if (serializedFacts === lastSavedFacts && !conversation.projectContextReviewRequired) return;
    const requestedSave = ++saveSequence;
    status.textContent = "Saving Project context…";
    try {
      const payload = await postResearch("/research/conversations/project-context", {
        conversationID: conversation.id,
        projectID: conversation.primaryProjectID,
        facts: normalizedFacts
      });
      if (requestedSave !== saveSequence) return;
      conversation = payload.conversation;
      if (activeResearchConversation?.id === conversation.id) {
        activeResearchConversation = conversation;
      }
      lastSavedFacts = serializedFacts;
      warning.hidden = true;
      status.textContent = "Project context saved";
      if (state.researchConversationID === conversation.id) {
        await transitionWorkspace("utility", {
          refreshPaneIDs: [paneIDForResearchConversation(conversation.id)]
        });
      }
      window.setTimeout(() => {
        if (status.textContent === "Project context saved") status.textContent = "";
      }, 1400);
    } catch (error) {
      if (requestedSave !== saveSequence) return;
      status.textContent = error.message;
    }
  };
  facts.addEventListener("input", () => {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(saveProjectContextAutomatically, 650);
  });
  facts.addEventListener("blur", saveProjectContextAutomatically);
  const readOnly = identity.sharedOnly || !hasCapability("research");
  facts.disabled = readOnly;
  if (readOnly) {
    status.textContent = identity.sharedOnly
      ? "Read-only Project access."
      : "Research Add-On required to change Project context.";
  }
  form.append(label);
  section.append(heading, copy, warning, form, status);
  content.append(section);
}

function appendProjectResearchHistory(content, identity, foundation) {
  const section = document.createElement("section");
  section.className = "project-studio-section project-studio-research";
  const heading = document.createElement("div");
  heading.className = "project-studio-section-heading project-collapsible-heading";
  const title = document.createElement("button");
  title.className = "project-section-toggle-label section-label";
  title.type = "button";
  title.textContent = "Research history";
  title.setAttribute("aria-expanded", "false");
  const headingActions = document.createElement("div");
  headingActions.className = "project-section-heading-actions";
  headingActions.append(projectSectionCount(
    foundation?.researchAnswers?.length || 0,
    "Research answers"
  ));
  const openResearch = document.createElement("button");
  openResearch.type = "button";
  openResearch.textContent = identity.sharedOnly ? "Read-only history" : "Open Research";
  openResearch.disabled = identity.sharedOnly;
  if (!identity.sharedOnly) {
    openResearch.addEventListener("click", () => {
      void focusProjectResearch(identity);
    });
  }
  const toggle = document.createElement("button");
  toggle.className = "project-section-toggle-chevron";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Expand Research history");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = researchChevronIconsSVG();
  headingActions.append(openResearch, toggle);
  heading.append(title, headingActions);
  const body = document.createElement("div");
  body.className = "project-studio-collapsible-body project-research-history-body";
  section.append(heading, body);

  const answers = [...(foundation?.researchAnswers || [])]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  if (answers.length) {
    answers.slice(0, 8).forEach((answer) => {
      const card = document.createElement(identity.sharedOnly ? "article" : "button");
      card.className = "project-research-history-card";
      if (!identity.sharedOnly) card.type = "button";
      const question = document.createElement("strong");
      question.textContent = answer.question || "Research answer";
      const conclusion = document.createElement("p");
      conclusion.textContent = answer.conclusion || "Open the historical record to review its conclusion.";
      const meta = document.createElement("span");
      meta.textContent = [
        `${answer.evidenceCount || 0} approved ${answer.evidenceCount === 1 ? "source" : "sources"}`,
        researchRelativeDate(answer.createdAt),
        answer.reviewStatus
      ].filter(Boolean).join(" · ");
      card.append(question, conclusion, meta);
      if (!identity.sharedOnly) {
        card.addEventListener("click", () => {
          if (answer.conversationID) void openResearchConversation(answer.conversationID);
        });
      }
      body.append(card);
    });
  }
  wireProjectSectionMotion(section, body, [title, toggle], "Research history", false);
  content.append(section);
}

function projectEvidenceReviews(foundation) {
  return (foundation?.artifacts || [])
    .filter((artifact) =>
      artifact.envelope?.type === "evidenceReview" &&
      !artifact.envelope?.deletedAt
    )
    .map((artifact) => ({
      id: artifact.envelope.id,
      version: artifact.envelope.version,
      updatedAt: artifact.envelope.updatedAt,
      ...artifact.payload
    }))
    .sort((left, right) =>
      String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
    );
}

function evidenceReviewStatusLabel(status) {
  return {
    proposed: "Proposed",
    approved: "Approved",
    "changes-requested": "Changes requested"
  }[status] || "Not reviewed";
}

function appendProjectEvidenceReviews(content, identity, foundation) {
  if (!identity.sharedOrganizationID) return;
  const answers = foundation?.researchAnswers || [];
  const reviews = projectEvidenceReviews(foundation);
  const canPropose = identity.sharedPermissions?.includes("evidence.propose");
  const canReview = identity.sharedPermissions?.includes("evidence.review");
  if (!answers.length && !reviews.length) return;

  const reviewsByAnswerID = new Map(reviews.map((review) => [review.answerID, review]));
  const section = document.createElement("section");
  section.className = "project-studio-section project-evidence-reviews";
  const heading = document.createElement("div");
  heading.className = "project-studio-section-heading";
  const title = document.createElement("p");
  title.className = "section-label";
  title.textContent = "Evidence review";
  const scope = document.createElement("span");
  scope.className = "project-review-scope";
  scope.textContent = "Immutable Research evidence";
  const headingMeta = document.createElement("div");
  headingMeta.className = "project-section-heading-actions";
  headingMeta.append(scope, projectSectionCount(answers.length, "Evidence reviews"));
  heading.append(title, headingMeta);
  section.append(heading);

  answers.slice(0, 8).forEach((answer) => {
    const review = reviewsByAnswerID.get(answer.id);
    const row = document.createElement("article");
    row.className = "project-evidence-review";
    const copy = document.createElement("div");
    const question = document.createElement("strong");
    question.textContent = answer.question || "Research answer";
    const meta = document.createElement("span");
    meta.textContent = [
      evidenceReviewStatusLabel(review?.status),
      review?.updatedAt ? researchRelativeDate(review.updatedAt) : "",
      `${answer.evidenceCount || 0} ${answer.evidenceCount === 1 ? "source" : "sources"}`
    ].filter(Boolean).join(" · ");
    copy.append(question, meta);
    if (review?.note) {
      const note = document.createElement("p");
      note.textContent = review.note;
      copy.append(note);
    }
    row.append(copy);

    const actions = document.createElement("div");
    actions.className = "project-evidence-review-actions";
    const submit = async (status, note) => {
      actions.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
      });
      try {
        await postResearch("/organizations/evidence/reviews/save", {
          projectID: projectDetailKey(identity),
          answerID: answer.id,
          reviewID: review?.id || undefined,
          expectedVersion: review?.version || 0,
          status,
          note
        });
        await transitionWorkspace("utility", {
          refreshPaneIDs: [paneIDForProjectDetail(identity)]
        });
      } catch (error) {
        actions.querySelectorAll("button").forEach((button) => {
          button.disabled = false;
        });
        await showWebNotice("Evidence review not saved", error.message);
      }
    };

    if (canPropose && (!review || review.status === "changes-requested")) {
      const propose = document.createElement("button");
      propose.type = "button";
      propose.textContent = review ? "Resubmit" : "Propose";
      propose.addEventListener("click", () => {
        void submit(
          "proposed",
          review ? "Evidence resubmitted after requested changes." : "Evidence submitted for professional review."
        );
      });
      actions.append(propose);
    }
    if (canReview && review) {
      if (review.status !== "approved") {
        const approve = document.createElement("button");
        approve.type = "button";
        approve.textContent = "Approve";
        approve.addEventListener("click", () => {
          void submit("approved", "Evidence set approved for the Project record.");
        });
        actions.append(approve);
      }
      if (review.status !== "changes-requested") {
        const requestChanges = document.createElement("button");
        requestChanges.type = "button";
        requestChanges.textContent = "Request changes";
        requestChanges.addEventListener("click", async () => {
          const confirmed = await confirmWebWarning(
            "Request evidence changes?",
            "This preserves the Research answer and evidence snapshots. It changes only the separate professional review record.",
            { confirmLabel: "Request Changes" }
          );
          if (confirmed) {
            await submit("changes-requested", "Reviewer requested changes to the selected evidence set.");
          }
        });
        actions.append(requestChanges);
      }
    }
    if (actions.childElementCount) row.append(actions);
    section.append(row);
  });
  content.append(section);
}

function projectCollaborationArtifacts(foundation, type) {
  return (foundation?.artifacts || [])
    .filter((artifact) =>
      artifact.envelope?.type === type &&
      !artifact.envelope?.deletedAt
    )
    .map((artifact) => ({
      id: artifact.envelope.id,
      version: artifact.envelope.version,
      createdAt: artifact.envelope.createdAt,
      updatedAt: artifact.envelope.updatedAt,
      ...artifact.payload
    }))
    .sort((left, right) =>
      String(right.updatedAt || right.createdAt || "").localeCompare(
        String(left.updatedAt || left.createdAt || "")
      )
    );
}

function projectCollaborationActor(item, prefix = "createdBy") {
  const displayName = String(item?.[`${prefix}DisplayName`] || "").trim();
  const userID = String(item?.[`${prefix}UserID`] || "").trim();
  return displayName || (userID === activeAccount()?.userID ? "You" : userID) || "Permitext professional";
}

function projectCollaborationAccess(identity, permission) {
  return identity.sharedOrganizationID
    ? identity.sharedPermissions?.includes(permission)
    : true;
}

function projectCollaborationRefresh(identity) {
  return transitionWorkspace("utility", {
    refreshPaneIDs: [paneIDForProjectDetail(identity)]
  });
}

function projectNoteEditor(identity, note, options = {}) {
  const editable = options.editable !== false;
  const container = document.createElement("div");
  container.className = "project-note-block-editor";
  const editorElement = document.createElement("div");
  editorElement.className = "notebook-editor-surface project-note-editor-surface";
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "project-note-resize-handle";
  resizeHandle.setAttribute("role", "separator");
  resizeHandle.setAttribute("aria-label", "Resize Project information");
  resizeHandle.setAttribute("aria-orientation", "horizontal");
  resizeHandle.tabIndex = 0;
  const resizeTo = (height) => {
    const maximumHeight = Math.min(window.innerHeight * 0.7, 760);
    container.style.height = `${Math.max(220, Math.min(maximumHeight, height))}px`;
  };
  resizeHandle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = container.getBoundingClientRect().height;
    resizeHandle.setPointerCapture(event.pointerId);
    container.classList.add("is-resizing");
    const resize = (moveEvent) => resizeTo(startHeight + moveEvent.clientY - startY);
    const finish = () => {
      container.classList.remove("is-resizing");
      resizeHandle.removeEventListener("pointermove", resize);
      resizeHandle.removeEventListener("pointerup", finish);
      resizeHandle.removeEventListener("pointercancel", finish);
    };
    resizeHandle.addEventListener("pointermove", resize);
    resizeHandle.addEventListener("pointerup", finish);
    resizeHandle.addEventListener("pointercancel", finish);
  });
  resizeHandle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    resizeTo(container.getBoundingClientRect().height + direction * (event.shiftKey ? 40 : 16));
  });
  container.append(editorElement, resizeHandle);

  let currentNote = note || null;
  let draftDocument = currentNote?.document || notebookDocumentFromPlainText(options.plainText || currentNote?.body || "");
  let editorMount = null;
  let editorReady = false;
  let saveTimer = null;
  let saveInFlight = false;
  let saveQueued = false;
  const projectID = projectDetailKey(identity);
  const localScopeID = "project-information";
  const objectURLs = new Set();

  const imageUploaded = (event) => {
    if (!container.isConnected) {
      window.removeEventListener("permitext:notebook-image-uploaded", imageUploaded);
      objectURLs.forEach((url) => URL.revokeObjectURL(url));
      objectURLs.clear();
      return;
    }
    if (event.detail?.projectID !== projectID) return;
    editorMount?.replaceAssetURL?.(event.detail.localURL, event.detail.permanentURL);
  };
  window.addEventListener("permitext:notebook-image-uploaded", imageUploaded);

  const saveDraft = async () => {
    if (!editable || !editorMount) return;
    if (saveInFlight) {
      saveQueued = true;
      return;
    }
    saveInFlight = true;
    const documentToSave = draftDocument;
    if (notebookDocumentAssetURLs(documentToSave, "permitext-notebook-local:").length) {
      saveInFlight = false;
      return;
    }
    try {
      const payload = await postResearch("/projects/collaboration/notes/save", {
        projectID,
        noteID: currentNote?.id || undefined,
        expectedVersion: currentNote?.version || 0,
        title: "Project information",
        document: documentToSave
      });
      currentNote = payload.note;
      await Promise.all([
        deleteNotebookDraft(activeAccount().userID, projectID, localScopeID).catch(() => {}),
        finalizeNotebookImagesForDocument(
          activeAccount().userID,
          projectID,
          localScopeID,
          notebookDocumentAssetURLs(documentToSave, "permitext-notebook-asset:")
        ).catch(() => {})
      ]);
    } catch (error) {
      await showWebNotice("Project note not saved", error.message);
    } finally {
      saveInFlight = false;
      if (saveQueued || draftDocument !== documentToSave) {
        saveQueued = false;
        saveTimer = window.setTimeout(saveDraft, 100);
      }
    }
  };

  void Promise.all([
    loadNotebookModule(),
    loadNotebookDraft(activeAccount().userID, projectID, localScopeID).catch(() => null)
  ])
    .then(async ([module, localDraft]) => {
      if (localDraft && String(localDraft.updatedAt) > String(currentNote?.updatedAt || "")) {
        draftDocument = localDraft.document;
      }
      draftDocument = await reconcileNotebookDocumentAssets(draftDocument);
      editorMount = module.mountPermitextNotebookEditor(editorElement, {
        document: draftDocument,
        editable,
        autofocus: false,
        ariaLabel: "Project information",
        uploadFile: (file) => uploadNotebookAsset(projectID, file, localScopeID).catch((error) => {
          void showWebNotice("Image not added", error.message);
          throw error;
        }),
        async resolveFileUrl(url) {
          const resolved = await resolveNotebookAsset(projectID, url);
          if (resolved.startsWith("blob:")) objectURLs.add(resolved);
          return resolved;
        },
        onReady() {
          editorReady = true;
        },
        onChange(document) {
          draftDocument = document;
          if (!editable || !editorReady) return;
          void saveNotebookDraft({
            accountUserID: activeAccount().userID,
            projectID,
            cardID: localScopeID,
            title: "Project information",
            document
          }).catch(() => {});
          void pruneUnusedPendingNotebookImages(
            activeAccount().userID,
            projectID,
            localScopeID,
            document
          );
          window.clearTimeout(saveTimer);
          saveTimer = window.setTimeout(saveDraft, 800);
        }
      });
    })
    .catch((error) => {
      editorElement.textContent = `Project information unavailable: ${error.message}`;
    });
  return container;
}

function appendProjectNotes(content, identity, foundation) {
  const notes = projectCollaborationArtifacts(foundation, "projectNote");
  const canEdit = projectCollaborationAccess(identity, "project.note.edit");
  if (!notes.length && !canEdit) return;
  const section = document.createElement("section");
  section.className = "project-studio-section project-collaboration-notes";
  const heading = document.createElement("div");
  heading.className = "project-studio-section-heading project-notes-heading";
  const title = document.createElement("button");
  title.className = "project-notes-toggle-label section-label";
  title.type = "button";
  title.textContent = "Project information";
  title.setAttribute("aria-expanded", "true");
  heading.append(title);
  const headingActions = document.createElement("div");
  headingActions.className = "project-notes-heading-actions";
  const toggle = document.createElement("button");
  toggle.className = "project-notes-toggle-chevron";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Collapse Project information");
  toggle.setAttribute("aria-expanded", "true");
  toggle.innerHTML = researchChevronIconsSVG();
  headingActions.append(toggle);
  heading.append(headingActions);
  const body = document.createElement("div");
  body.className = "project-collaboration-notes-body";
  const primaryNote = notes[0] || null;
  const legacyPlainText = primaryNote?.document
    ? ""
    : notes.map((item) => String(item.body || "").trim()).filter(Boolean).join("\n\n");
  body.append(projectNoteEditor(identity, primaryNote, {
    editable: canEdit,
    plainText: legacyPlainText
  }));
  section.append(heading, body);
  wireProjectSectionMotion(section, body, [title, toggle], "Project information", true);
  content.append(section);
}

function projectReviewKindLabel(kind) {
  return {
    "general-review": "General review",
    "revision-request": "Revision request",
    "missing-project-fact": "Missing Project fact"
  }[kind] || "Project review";
}

function projectReviewStatusLabel(status) {
  return {
    open: "Open",
    resolved: "Resolved",
    dismissed: "Dismissed"
  }[status] || "Open";
}

function projectReviewTargets(identity, foundation) {
  const targets = [{
    kind: "project",
    id: projectDetailKey(identity),
    label: "Entire Project"
  }];
  (foundation?.researchAnswers || []).forEach((answer) => {
    targets.push({
      kind: "researchAnswer",
      id: answer.id,
      label: `Research: ${answer.question || "answer"}`
    });
  });
  [
    ["evidenceReview", "Evidence review"],
    ["notebookCard", "Notebook"],
    ["reportDraft", "Report Draft"]
  ].forEach(([type, label]) => {
    projectCollaborationArtifacts(foundation, type).forEach((artifact) => {
      targets.push({
        kind: type,
        id: artifact.id,
        label: `${label}: ${artifact.title || artifact.note || artifact.id}`
      });
    });
  });
  return targets;
}

function projectReviewThreadEditor(identity, foundation, kind, onCancel) {
  const form = document.createElement("form");
  form.className = "project-collaboration-editor project-review-editor";
  const title = document.createElement("input");
  title.type = "text";
  title.maxLength = 200;
  title.required = true;
  title.placeholder = kind === "missing-project-fact"
    ? "What Project fact is missing?"
    : "What needs revision?";
  title.setAttribute("aria-label", "Review request title");
  const body = document.createElement("textarea");
  body.maxLength = 20000;
  body.rows = 4;
  body.placeholder = "Explain what is needed and why.";
  body.setAttribute("aria-label", "Review request details");
  const target = document.createElement("select");
  target.setAttribute("aria-label", "Project item to review");
  projectReviewTargets(identity, foundation).forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.dataset.targetKind = item.kind;
    option.textContent = item.label;
    target.append(option);
  });
  const actions = document.createElement("div");
  actions.className = "project-collaboration-editor-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", onCancel);
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Open request";
  actions.append(cancel, save);
  form.append(target, title, body, actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selected = target.selectedOptions[0];
    form.querySelectorAll("button, input, textarea, select").forEach((control) => {
      control.disabled = true;
    });
    try {
      await postResearch("/projects/collaboration/threads/save", {
        projectID: projectDetailKey(identity),
        expectedVersion: 0,
        kind,
        status: "open",
        targetKind: selected?.dataset.targetKind || "project",
        targetID: selected?.value || projectDetailKey(identity),
        title: title.value,
        body: body.value
      });
      await projectCollaborationRefresh(identity);
    } catch (error) {
      form.querySelectorAll("button, input, textarea, select").forEach((control) => {
        control.disabled = false;
      });
      await showWebNotice("Review request not saved", error.message);
    }
  });
  return form;
}

function appendProjectReviewThreads(content, identity, foundation) {
  const threads = projectCollaborationArtifacts(foundation, "reviewThread");
  const comments = projectCollaborationArtifacts(foundation, "reviewComment");
  const commentsByThreadID = new Map();
  comments.reverse().forEach((comment) => {
    const items = commentsByThreadID.get(comment.threadID) || [];
    items.push(comment);
    commentsByThreadID.set(comment.threadID, items);
  });
  const canRequest = projectCollaborationAccess(identity, "project.review.request");
  const canComment = projectCollaborationAccess(identity, "project.review.comment");
  const canResolve = projectCollaborationAccess(identity, "project.review.resolve");
  let setReviewExpanded = () => {};
  if (!threads.length && !canRequest) return;

  const section = document.createElement("section");
  section.className = "project-studio-section project-review-threads";
  const heading = document.createElement("div");
  heading.className = "project-studio-section-heading project-review-thread-heading project-collapsible-heading";
  const title = document.createElement("button");
  title.className = "project-section-toggle-label section-label";
  title.type = "button";
  title.textContent = "Review & coordination";
  title.setAttribute("aria-expanded", "false");
  const requestActions = document.createElement("div");
  requestActions.className = "project-review-request-actions project-section-heading-actions";
  requestActions.append(projectSectionCount(threads.length, "Review and coordination items"));
  const editorSlot = document.createElement("div");
  editorSlot.className = "project-collaboration-editor-slot";
  if (canRequest) {
    [
      ["revision-request", "Request revision"],
      ["missing-project-fact", "Ask for information"]
    ].forEach(([kind, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        setReviewExpanded(true);
        requestActions.querySelectorAll("button").forEach((control) => {
          control.disabled = true;
        });
        editorSlot.replaceChildren(projectReviewThreadEditor(
          identity,
          foundation,
          kind,
          () => {
            editorSlot.replaceChildren();
            requestActions.querySelectorAll("button").forEach((control) => {
              control.disabled = false;
            });
          }
        ));
        editorSlot.querySelector("input")?.focus();
      });
      requestActions.append(button);
    });
  }
  const toggle = document.createElement("button");
  toggle.className = "project-section-toggle-chevron";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Expand Review & coordination");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = researchChevronIconsSVG();
  requestActions.append(toggle);
  heading.append(title, requestActions);
  const body = document.createElement("div");
  body.className = "project-studio-collapsible-body project-review-threads-body";
  body.append(editorSlot);
  section.append(heading, body);
  threads.forEach((thread) => {
    const card = document.createElement("article");
    card.className = `project-collaboration-card project-review-thread is-${thread.status}`;
    const cardHeading = document.createElement("div");
    const copy = document.createElement("div");
    const threadTitle = document.createElement("strong");
    threadTitle.textContent = thread.title;
    const meta = document.createElement("span");
    meta.textContent = [
      projectReviewKindLabel(thread.kind),
      projectReviewStatusLabel(thread.status),
      String(thread.targetKind || "project").replaceAll(/([a-z])([A-Z])/g, "$1 $2"),
      `By ${projectCollaborationActor(thread)}`,
      researchRelativeDate(thread.updatedAt)
    ].filter(Boolean).join(" · ");
    copy.append(threadTitle, meta);
    cardHeading.append(copy);
    if (canResolve) {
      const statusButton = document.createElement("button");
      statusButton.type = "button";
      statusButton.textContent = thread.status === "open" ? "Resolve" : "Reopen";
      statusButton.addEventListener("click", async () => {
        statusButton.disabled = true;
        try {
          await postResearch("/projects/collaboration/threads/save", {
            projectID: projectDetailKey(identity),
            threadID: thread.id,
            expectedVersion: thread.version,
            status: thread.status === "open" ? "resolved" : "open"
          });
          await projectCollaborationRefresh(identity);
        } catch (error) {
          statusButton.disabled = false;
          await showWebNotice("Review status not saved", error.message);
        }
      });
      cardHeading.append(statusButton);
    }
    card.append(cardHeading);
    if (thread.body) {
      const body = document.createElement("p");
      body.textContent = thread.body;
      card.append(body);
    }
    const threadComments = commentsByThreadID.get(thread.id) || [];
    if (threadComments.length) {
      const list = document.createElement("ol");
      list.className = "project-review-comments";
      threadComments.forEach((comment) => {
        const row = document.createElement("li");
        const commentBody = document.createElement("p");
        commentBody.textContent = comment.body;
        const commentMeta = document.createElement("span");
        commentMeta.textContent = [
          projectCollaborationActor(comment),
          researchRelativeDate(comment.createdAt)
        ].join(" · ");
        row.append(commentBody, commentMeta);
        list.append(row);
      });
      card.append(list);
    }
    if (canComment && thread.status === "open") {
      const form = document.createElement("form");
      form.className = "project-review-comment-form";
      const input = document.createElement("textarea");
      input.rows = 2;
      input.maxLength = 10000;
      input.required = true;
      input.placeholder = thread.kind === "missing-project-fact"
        ? "Provide the requested Project fact…"
        : "Add a response…";
      input.setAttribute("aria-label", `Respond to ${thread.title}`);
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = "Post response";
      form.append(input, submit);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        input.disabled = true;
        submit.disabled = true;
        try {
          await postResearch("/projects/collaboration/comments/save", {
            projectID: projectDetailKey(identity),
            threadID: thread.id,
            body: input.value
          });
          await projectCollaborationRefresh(identity);
        } catch (error) {
          input.disabled = false;
          submit.disabled = false;
          await showWebNotice("Response not saved", error.message);
        }
      });
      card.append(form);
    }
    body.append(card);
  });
  setReviewExpanded = wireProjectSectionMotion(
    section,
    body,
    [title, toggle],
    "Review & coordination",
    false
  );
  content.append(section);
}

function appendProjectReportExports(content, identity, foundation) {
  const reports = (foundation?.artifacts || [])
    .filter((artifact) =>
      artifact.envelope?.type === "generatedReport" &&
      !artifact.envelope?.deletedAt &&
      artifact.payload?.file
    )
    .sort((left, right) =>
      String(right.envelope.updatedAt || right.payload?.createdAt || "").localeCompare(
        String(left.envelope.updatedAt || left.payload?.createdAt || "")
      )
    );
  if (!reports.length) return;

  const section = document.createElement("section");
  section.className = "project-studio-section project-report-exports";
  const heading = document.createElement("div");
  heading.className = "project-studio-section-heading";
  const title = document.createElement("p");
  title.className = "section-label";
  title.textContent = "Report exports";
  heading.append(title, projectSectionCount(reports.length, "Report exports"));
  section.append(heading);
  reports.slice(0, 8).forEach((artifact) => {
    const row = document.createElement("article");
    row.className = "project-report-export";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = artifact.payload.title || "Permitext Project Report";
    const meta = document.createElement("span");
    meta.textContent = [
      artifact.payload.reportVersion ? `Version ${artifact.payload.reportVersion}` : "",
      String(artifact.payload.file.format || "PDF").replaceAll("-", " "),
      researchRelativeDate(artifact.payload.createdAt || artifact.envelope.updatedAt)
    ].filter(Boolean).join(" · ");
    copy.append(name, meta);
    const download = document.createElement("button");
    download.type = "button";
    download.textContent = "Download PDF";
    download.addEventListener("click", async () => {
      download.disabled = true;
      try {
        await downloadProjectReportFile(
          projectDetailKey(identity),
          {
            ...artifact.payload.file,
            generatedReportID: artifact.envelope.id
          },
          artifact.payload.title
        );
      } catch (error) {
        await showWebNotice("Report could not be downloaded", error.message);
      } finally {
        download.disabled = false;
      }
    });
    row.append(copy, download);
    section.append(row);
  });
  content.append(section);
}

function appendProjectActivity(content, foundation) {
  const events = [...(foundation?.activity || [])]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  if (!events.length) return;
  const section = document.createElement("section");
  section.className = "project-studio-section project-studio-activity";
  const toggle = document.createElement("button");
  toggle.className = "project-studio-activity-toggle section-label";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  const title = document.createElement("span");
  title.textContent = "Recent activity";
  const actions = document.createElement("span");
  actions.className = "project-activity-heading-actions";
  actions.append(projectSectionCount(events.length, "Recent activity items"));
  const chevron = document.createElement("span");
  chevron.className = "project-studio-activity-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = researchChevronIconsSVG();
  actions.append(chevron);
  toggle.append(title, actions);
  const list = document.createElement("ol");
  events.slice(0, 10).forEach((event) => {
    const row = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = projectActivityLabel(event);
    const meta = document.createElement("span");
    meta.textContent = [
      event.objectKind,
      researchRelativeDate(event.createdAt)
    ].filter(Boolean).join(" · ");
    row.append(label, meta);
    list.append(row);
  });
  section.append(toggle, list);
  wireProjectSectionMotion(section, list, [toggle], "Recent activity", false);
  content.append(section);
}

function appendProjectContextNotice(content) {
  const notice = document.createElement("aside");
  notice.className = "project-context-notice";
  notice.setAttribute("role", "note");
  const heading = document.createElement("strong");
  heading.textContent = "Project context";
  const copy = document.createElement("p");
  copy.textContent = "Project information and additional facts are context only. They are never treated as code authority or cited evidence.";
  notice.append(heading, copy);
  content.append(notice);
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
  let previewItems = await Promise.all(linkedSavedItems.map(async (item) => {
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
      const blockID = normalizeAnnotationBlockID(item.blockID);
      const block = blockID
        ? annotatedBlocksForSection(section).find((candidate) =>
            normalizeAnnotationBlockID(candidate?.id || candidate?.tableID || candidate?.imageID) === blockID
          )
        : null;
      return {
        ...item,
        ...resolvedDetail,
        blockID,
        chapterID: resolvedDetail.chapterID || chapter?.id || "",
        sectionNumber: section?.sectionNumber || resolvedDetail.sectionNumber,
        title: section?.title || resolvedDetail.title,
        previewText: (block?.plainText || block?.text || sectionPlainText(section))
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 260)
      };
    } catch {
      return { ...item, ...resolvedDetail, previewText: "" };
    }
  }));
  let foundation = null;
  let foundationError = "";
  if (activeAccount()) {
    try {
      if (identity.sharedOrganizationID) {
        const payload = await postResearch("/organizations/projects/snapshot", {
          projectID: projectDetailKey(identity)
        });
        foundation = payload.project;
        identity.sharedRole = payload.access?.role || identity.sharedRole;
        identity.sharedPermissions = payload.access?.permissions || identity.sharedPermissions;
      } else {
        foundation = await postResearch("/projects/foundation/state", {
          projectID: projectDetailKey(identity)
        });
      }
    } catch (error) {
      foundationError = error.message || "Project history is temporarily unavailable.";
    }
  }
  let projectResearchConversation = null;
  const activeProjectConversation = (foundation?.researchConversations || [])
    .find((conversation) => conversation.id === state.researchConversationID);
  if (activeProjectConversation) {
    if (activeResearchConversation?.id === activeProjectConversation.id) {
      projectResearchConversation = activeResearchConversation;
    } else {
      try {
        const payload = await postResearch("/research/conversations/get", {
          conversationID: activeProjectConversation.id
        });
        projectResearchConversation = payload.conversation;
      } catch {
        projectResearchConversation = null;
      }
    }
  }
  if (identity.sharedOrganizationID && foundation) {
    const existingSectionIDs = new Set(
      previewItems.map((item) => String(item.sectionID || item.savedSectionID || item.itemID || ""))
    );
    const linkedSectionIDs = Array.from(new Set(
      (foundation.links || [])
        .filter((link) =>
          !link.deletedAt &&
          link.targetKind === "canonicalSection" &&
          !existingSectionIDs.has(String(link.targetID || ""))
        )
        .map((link) => String(link.targetID || ""))
        .filter(Boolean)
    ));
    const sharedItems = await Promise.all(linkedSectionIDs.map(async (sectionID) => {
      try {
        const { chapter, section } = await resolveSectionDetail({
          codePrefix: "BC",
          sectionID,
          title: "Linked code section"
        });
        return {
          id: `shared-section-${sectionID}`,
          sectionID,
          codePrefix: section?.codePrefix || chapter?.codePrefix || "BC",
          chapterID: section?.chapterID || chapter?.id || "",
          chapterNumber: section?.chapterNumber || chapter?.chapterNumber || "",
          sectionNumber: section?.sectionNumber || sectionID,
          title: section?.title || "Linked code section",
          previewText: sectionPlainText(section).replace(/\s+/g, " ").trim().slice(0, 260)
        };
      } catch {
        return null;
      }
    }));
    previewItems = [...previewItems, ...sharedItems.filter(Boolean)];
  }

  const panel = document.createElement("article");
  panel.className = "workspace-panel project-detail-panel";
  panel.dataset.paneId = paneIDForProjectDetail(identity);
  panel.style.setProperty("--project-color", identity.color);
  applyPaneWeight(panel, paneIDForProjectDetail(identity));

  const chrome = document.createElement("header");
  chrome.className = "project-detail-chrome";
  const headerActions = document.createElement("div");
  headerActions.className = "panel-actions project-detail-header-actions";
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
  notebookButton.addEventListener("click", async () => {
    if (projectHasOpenNotebook(identity)) {
      const closed = await closeProjectNotebook(identity);
      if (closed) notebookButton.setAttribute("aria-pressed", "false");
    } else {
      const opened = await openProjectNotebook(identity);
      if (opened) notebookButton.setAttribute("aria-pressed", "true");
    }
  });
  const reportDraftButton = document.createElement("button");
  reportDraftButton.className = "project-report-draft-button";
  reportDraftButton.type = "button";
  reportDraftButton.textContent = "Report Draft";
  reportDraftButton.setAttribute("aria-pressed", String(projectHasOpenReportDraft(identity)));
  reportDraftButton.hidden = detachedProjectWindow;
  if (identity.sharedOnly) {
    reportDraftButton.disabled = true;
    reportDraftButton.title = "Shared Report Draft editing will follow the collaboration foundation.";
  }
  reportDraftButton.addEventListener("click", async () => {
    if (projectHasOpenReportDraft(identity)) {
      const closed = await closeProjectReportDraft(identity);
      if (closed) reportDraftButton.setAttribute("aria-pressed", "false");
    } else {
      const opened = await openProjectReportDraft(identity);
      if (opened) reportDraftButton.setAttribute("aria-pressed", "true");
    }
  });
  const workboardButton = document.createElement("button");
  workboardButton.className = "project-workboard-button";
  workboardButton.type = "button";
  workboardButton.textContent = "Workboard";
  workboardButton.setAttribute("aria-pressed", String(projectHasOpenWorkboard(identity)));
  workboardButton.hidden = detachedProjectWindow;
  if (identity.sharedOnly) {
    workboardButton.disabled = true;
    workboardButton.title = "Shared Workboard editing is intentionally scheduled after authored collaboration.";
  }
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
  const backButton = appendDetailIconButton(headerActions, {
    title: "Back",
    label: "Back to projects",
    className: "project-detail-back",
    svg: circleXIconSVG()
  });
  actions.prepend(notebookButton, reportDraftButton, workboardButton);
  const headingGroup = document.createElement("div");
  headingGroup.className = "project-detail-heading";
  const title = document.createElement("h2");
  title.textContent = identity.name;
  headingGroup.append(title);
  if (identity.sharedOrganizationID) {
    const sharedBadge = document.createElement("span");
    sharedBadge.className = "project-shared-role";
    sharedBadge.textContent = `${identity.sharedOrganizationName || "Firm"} · ${identity.sharedRole || "viewer"}`;
    headingGroup.append(sharedBadge);
  }
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
  chrome.append(headingGroup, headerActions, actions);

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
  savedSection.className = "project-detail-section project-studio-section";
  const savedHeading = document.createElement("div");
  savedHeading.className = "project-studio-section-heading project-collapsible-heading";
  const savedTitle = document.createElement("button");
  savedTitle.className = "project-section-toggle-label section-label";
  savedTitle.type = "button";
  savedTitle.textContent = "Saved evidence";
  savedTitle.setAttribute("aria-expanded", "true");
  const savedHeadingActions = document.createElement("div");
  savedHeadingActions.className = "project-section-heading-actions";
  const savedSelectButton = document.createElement("button");
  savedSelectButton.className = "project-section-toggle-chevron project-evidence-select-button";
  savedSelectButton.type = "button";
  savedSelectButton.title = "Select saved evidence";
  savedSelectButton.setAttribute("aria-label", savedSelectButton.title);
  savedSelectButton.setAttribute("aria-pressed", "false");
  savedSelectButton.innerHTML = selectionModeIconSVG();
  savedSelectButton.hidden = identity.sharedOnly || previewItems.length === 0;
  savedHeadingActions.append(savedSelectButton);
  const savedToggle = document.createElement("button");
  savedToggle.className = "project-section-toggle-chevron";
  savedToggle.type = "button";
  savedToggle.setAttribute("aria-label", "Collapse Saved evidence");
  savedToggle.setAttribute("aria-expanded", "true");
  savedToggle.innerHTML = researchChevronIconsSVG();
  savedHeadingActions.append(savedToggle);
  savedHeading.append(savedTitle, savedHeadingActions);
  const savedBody = document.createElement("div");
  savedBody.className = "project-studio-collapsible-body project-saved-evidence-body";
  const savedBulkBar = document.createElement("section");
  savedBulkBar.className = "project-bulk-bar project-evidence-bulk-bar";
  savedBulkBar.hidden = true;
  const savedBulkCount = document.createElement("span");
  savedBulkCount.className = "project-bulk-count";
  const savedSelectAll = document.createElement("button");
  savedSelectAll.className = "project-bulk-link";
  savedSelectAll.type = "button";
  const savedRemoveSelected = document.createElement("button");
  savedRemoveSelected.className = "project-bulk-action is-delete";
  savedRemoveSelected.type = "button";
  const savedCancelSelection = document.createElement("button");
  savedCancelSelection.className = "project-bulk-link";
  savedCancelSelection.type = "button";
  savedCancelSelection.textContent = "Cancel";
  savedBulkBar.append(savedBulkCount, savedSelectAll, savedRemoveSelected, savedCancelSelection);
  savedBody.append(savedBulkBar);
  const savedEvidenceItemsByID = new Map();
  const savedEvidenceRows = new Map();
  const selectedSavedEvidenceIDs = new Set();
  let selectingSavedEvidence = false;
  let removingSavedEvidence = false;
  const savedEvidenceItemID = (item) => String(
    item.projectSectionID || item.id || `${item.sectionID || item.savedSectionID || item.itemID}:${item.blockID || ""}`
  );
  previewItems.forEach((item) => savedEvidenceItemsByID.set(savedEvidenceItemID(item), item));
  const updateSavedEvidenceSelection = () => {
    savedBody.classList.toggle("is-selecting", selectingSavedEvidence);
    savedSelectButton.setAttribute("aria-pressed", String(selectingSavedEvidence));
    savedBulkBar.hidden = !selectingSavedEvidence;
    const selectedCount = selectedSavedEvidenceIDs.size;
    savedBulkCount.textContent = `${selectedCount} selected`;
    savedSelectAll.textContent = selectedCount === savedEvidenceItemsByID.size ? "Clear all" : "Select all";
    savedRemoveSelected.textContent = selectedCount ? `Remove ${selectedCount}` : "Remove";
    savedRemoveSelected.disabled = selectedCount === 0 || removingSavedEvidence;
    savedSelectAll.disabled = removingSavedEvidence;
    savedCancelSelection.disabled = removingSavedEvidence;
    savedSelectButton.disabled = removingSavedEvidence;
    savedEvidenceRows.forEach((row, id) => {
      const selected = selectedSavedEvidenceIDs.has(id);
      row.classList.toggle("is-selected", selected);
      const rowButton = row.querySelector(".project-detail-section-open");
      if (selectingSavedEvidence) rowButton?.setAttribute("aria-pressed", String(selected));
      else rowButton?.removeAttribute("aria-pressed");
    });
  };
  const setSavedEvidenceSelection = (active) => {
    selectingSavedEvidence = Boolean(active);
    selectedSavedEvidenceIDs.clear();
    updateSavedEvidenceSelection();
  };
  const toggleSavedEvidenceItem = (item) => {
    if (!selectingSavedEvidence || removingSavedEvidence) return;
    const id = savedEvidenceItemID(item);
    if (selectedSavedEvidenceIDs.has(id)) selectedSavedEvidenceIDs.delete(id);
    else selectedSavedEvidenceIDs.add(id);
    updateSavedEvidenceSelection();
  };
  savedSection.append(savedHeading, savedBody);
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
      if (identity.sharedOnly) row.classList.add("is-read-only");
      const selectionIndicator = document.createElement("span");
      selectionIndicator.className = "project-evidence-selection-check";
      selectionIndicator.setAttribute("aria-hidden", "true");
      selectionIndicator.innerHTML = selectionIndicatorIconSVG();
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
        if (selectingSavedEvidence) {
          toggleSavedEvidenceItem(item);
          return;
        }
        void openProjectSavedSection(identity, item);
      });
      row.append(openButton, selectionIndicator);
      savedEvidenceRows.set(savedEvidenceItemID(item), row);
      codeGroup.append(row);
    });
    savedBody.append(codeGroup);
  });
  savedSelectButton.addEventListener("click", () => setSavedEvidenceSelection(!selectingSavedEvidence));
  savedSelectAll.addEventListener("click", () => {
    if (selectedSavedEvidenceIDs.size === savedEvidenceItemsByID.size) selectedSavedEvidenceIDs.clear();
    else savedEvidenceItemsByID.forEach((_item, id) => selectedSavedEvidenceIDs.add(id));
    updateSavedEvidenceSelection();
  });
  savedCancelSelection.addEventListener("click", () => setSavedEvidenceSelection(false));
  savedRemoveSelected.addEventListener("click", async () => {
    const selectedItems = Array.from(selectedSavedEvidenceIDs, (id) => savedEvidenceItemsByID.get(id)).filter(Boolean);
    if (!selectedItems.length) return;
    const confirmed = await confirmWebWarning(
      "Remove saved evidence",
      `Remove ${selectedItems.length} selected ${selectedItems.length === 1 ? "item" : "items"} from ${identity.name}?`,
      { confirmLabel: "Remove" }
    );
    if (!confirmed) return;
    removingSavedEvidence = true;
    updateSavedEvidenceSelection();
    try {
      for (const item of selectedItems) {
        await removeSectionFromProject(identity, item, { refreshPanes: false });
      }
      await refreshProjectMembershipPanes(identity);
    } catch (error) {
      removingSavedEvidence = false;
      updateSavedEvidenceSelection();
      await showWebNotice("Could not remove saved evidence", error.message || "The selected items could not be removed.");
    }
  });
  updateSavedEvidenceSelection();
  backButton.addEventListener("click", async () => {
    if (detachedProjectWindow) {
      window.close();
      return;
    }
    if (!(await confirmNotebookDiscard(identity))) return;
    if (!(await confirmReportDraftDiscard(identity))) return;
    closeProjectDetailForProject(identity);
    saveWorkspaceState();
    void transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });
  });

  appendProjectResearchContextEditor(content, identity, projectResearchConversation);
  if (foundationError) {
    const warning = document.createElement("p");
    warning.className = "project-studio-warning";
    warning.textContent = foundationError;
    content.append(warning);
  }
  appendProjectNotes(content, identity, foundation);
  wireProjectSectionMotion(savedSection, savedBody, [savedTitle, savedToggle], "Saved evidence", true);
  content.append(savedSection);
  appendProjectResearchHistory(content, identity, foundation);
  appendProjectEvidenceReviews(content, identity, foundation);
  appendProjectReviewThreads(content, identity, foundation);
  appendProjectReportExports(content, identity, foundation);
  appendProjectActivity(content, foundation);
  if (projectResearchConversation) appendProjectContextNotice(content);
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

function showProjectCreateSheet(panel, project = null, options = {}) {
  if (!project && !hasCapability("projects")) {
    const account = activeAccount();
    void presentPlanLimitNotice(
      "Projects require Pro",
      account
        ? "Upgrade to Pro before creating a Project workspace."
        : "Sign in and upgrade to Pro before creating a Project workspace."
    );
    return;
  }
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
  descriptionInput.placeholder = "Project description, occupancy, construction type, height, existing conditions, proposed work, and relevant dates";
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
        const createdProject = await createProjectFolder(details);
        if (!createdProject) return;
        await options.onCreated?.(createdProject);
      }
      overlay.remove();
      await transitionWorkspace("utility", {
        refreshPaneIDs: projectOverviewRefreshPaneIDs(
          isEditing ? paneIDForProjectDetail(identity) : ""
        )
      });
      refreshOpenAnnotationProjectEditors();
    } catch (error) {
      saveButton.disabled = false;
      const content = panel.querySelector(".projects-content, .saved-project-list");
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
  if (!hasCapability("professional-exports")) {
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
  const codeClearButton = panel.querySelector(".saved-code-filter-clear");
  const tagRail = panel.querySelector(".saved-tag-filter");
  const tagMenu = panel.querySelector(".saved-tag-filter-menu");
  const tagClearButton = panel.querySelector(".saved-tag-filter-clear");
  const tagCounts = new Map();
  allItems.forEach((item) => {
    new Set(savedItemTags(item)).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  });
  const availableTags = [...tagCounts.entries()]
    .sort(([leftTag, leftCount], [rightTag, rightCount]) =>
      rightCount - leftCount || leftTag.localeCompare(rightTag, undefined, { sensitivity: "base" }))
    .map(([tag]) => tag);
  const availableCodePrefixes = new Set(
    allItems.map((item) => item.codePrefix || item.code || "BC")
  );
  instance.codeFilters = instance.codeFilters.filter((prefix) => availableCodePrefixes.has(prefix));
  clear(codeRail);
  clear(tagRail);
  searchCodeFilterOptions()
    .filter((option) => option.prefix !== "ALL" && availableCodePrefixes.has(option.prefix))
    .forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-filter-chip saved-filter-chip";
      button.textContent = option.label;
      button.dataset.prefix = option.prefix;
      if (option.prefix !== "ALL") button.classList.add(`code-theme-${codeTheme(option.prefix)}`);
      const selected = instance.codeFilters.includes(option.prefix);
      button.setAttribute("aria-pressed", String(selected));
      button.addEventListener("click", () => {
        const selectedPrefixes = new Set(instance.codeFilters);
        if (selectedPrefixes.has(option.prefix)) selectedPrefixes.delete(option.prefix);
        else selectedPrefixes.add(option.prefix);
        instance.codeFilters = [...selectedPrefixes];
        codeRail.querySelectorAll(".saved-filter-chip").forEach((chip) => {
          const prefix = chip.dataset.prefix || "";
          const isSelected = instance.codeFilters.includes(prefix);
          chip.setAttribute("aria-pressed", String(isSelected));
        });
        codeClearButton.disabled = instance.codeFilters.length === 0;
        updateCodeFilterMenu(codeRail, instance, {
          label: savedCodeFilterMenuLabel
        });
        onChange();
        saveWorkspaceState();
      });
      codeRail.append(button);
    });
  codeClearButton.disabled = instance.codeFilters.length === 0;
  codeClearButton.addEventListener("click", () => {
    instance.codeFilters = [];
    codeRail.querySelectorAll(".saved-filter-chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", "false");
    });
    codeClearButton.disabled = true;
    updateCodeFilterMenu(codeRail, instance, {
      label: savedCodeFilterMenuLabel
    });
    onChange();
    saveWorkspaceState();
  });
  wireCodeFilterMenu(codeRail, instance, {
    label: savedCodeFilterMenuLabel
  });
  if (availableTags.length) {
    availableTags.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "saved-tag-filter-chip";
      button.textContent = tag || "All Tags";
      button.setAttribute("aria-pressed", String(instance.tagFilter === tag));
      button.addEventListener("click", () => {
        instance.tagFilter = instance.tagFilter === tag && tag ? "" : tag;
        tagRail.querySelectorAll(".saved-tag-filter-chip").forEach((chip) => {
          chip.setAttribute("aria-pressed", String(chip.textContent === (instance.tagFilter || "All Tags")));
        });
        tagClearButton.disabled = !instance.tagFilter;
        updateCodeFilterMenu(tagRail, instance, {
          stateKey: "tagsMenuOpen",
          menuName: "tag filters",
          label: (savedInstance) => savedInstance?.tagFilter || "All Tags"
        });
        onChange();
        saveWorkspaceState();
      });
      tagRail.append(button);
    });
    tagClearButton.disabled = !instance.tagFilter;
    tagClearButton.addEventListener("click", () => {
      instance.tagFilter = "";
      tagRail.querySelectorAll(".saved-tag-filter-chip").forEach((chip) => {
        chip.setAttribute("aria-pressed", "false");
      });
      tagClearButton.disabled = true;
      updateCodeFilterMenu(tagRail, instance, {
        stateKey: "tagsMenuOpen",
        menuName: "tag filters",
        label: (savedInstance) => savedInstance?.tagFilter || "All Tags"
      });
      onChange();
      saveWorkspaceState();
    });
  }
  tagMenu.hidden = availableTags.length === 0;
  if (availableTags.length) {
    wireCodeFilterMenu(tagRail, instance, {
      stateKey: "tagsMenuOpen",
      menuName: "tag filters",
      label: (savedInstance) => savedInstance?.tagFilter || "All Tags"
    });
  }
  wrapper.hidden = allItems.length === 0;
}

async function hydrateSavedPanel(panel, savedInstance, paneID) {
  const content = panel.querySelector(".saved-content");
  const data = await loadSyncedContent();
  if (!panel.isConnected) return;
  const summary = currentContentSummary();
  const workspaceProjects = await projectsWithOrganizationAccess(summary.projects || []);
  if (!panel.isConnected) return;
  renderSavedProjects(panel, savedInstance, paneID, workspaceProjects, summary.projectSections || []);

  if (data.status === "disconnected" && summary.savedItems.length === 0 && summary.annotations.length === 0) {
    clear(content);
    appendEmptySaved(content, "Sign in to sync", "Open Settings and sign in to show synced bookmarks, tags, and notes.");
    return;
  }
  if (data.status === "error" && summary.savedItems.length === 0 && summary.annotations.length === 0) {
    clear(content);
    appendEmptySaved(content, "Sync error", data.error || "Could not load saved content.");
    return;
  }

  const { savedItems, annotations } = summary;
  const annotatedItems = consolidatedSavedAnnotations(annotations || []);
  const visibleSavedItems = savedItems.slice(0, 48);
  const combinedItems = mergeSavedColumnItems(visibleSavedItems, annotatedItems.slice(0, 48));
  const resolvedItems = mergeEquivalentSavedColumnRows(await hydrateSavedColumnItems(combinedItems));
  if (!panel.isConnected) return;
  const applySavedView = () => {
    const filteredItems = resolvedItems.filter((item) => {
      const prefixMatches = savedInstance.codeFilters.length === 0 || savedInstance.codeFilters.includes(item.codePrefix || item.code || "BC");
      const tagMatches = !savedInstance.tagFilter || savedItemTags(item).some((tag) => tag.localeCompare(savedInstance.tagFilter, undefined, { sensitivity: "accent" }) === 0);
      return prefixMatches && tagMatches;
    });
    const orderedItems = sortSavedItems(filteredItems, "codeOrder");
    clear(content);
    if (orderedItems.length > 0) {
      renderSavedItemsByCode(content, orderedItems, paneID, { showChapterHeaders: true, preserveOrder: true });
    } else if (resolvedItems.length > 0) {
      appendEmptySaved(content, "No saved items match", "Try another code book or tag filter.");
    } else {
      appendMutedRow(content, "No saved sections", "Bookmarks, paragraph notes, and tags will appear here.");
    }
  };
  renderSavedFilters(panel, savedInstance, resolvedItems, applySavedView);
  applySavedView();
}

function hydrateSavedPanelWhenConnected(panel, savedInstance, paneID, attempt = 0) {
  if (!panel.isConnected) {
    if (attempt < 120) {
      requestAnimationFrame(() => hydrateSavedPanelWhenConnected(panel, savedInstance, paneID, attempt + 1));
    }
    return;
  }
  void hydrateSavedPanel(panel, savedInstance, paneID);
}

async function renderSaved(instance) {
  const savedInstance = normalizeSavedInstance(instance);
  const paneID = paneIDForUtilityInstance(savedInstance);
  const panel = renderTemplate(savedTemplate);
  panel.classList.add("saved-panel");
  applyPaneWeight(panel, paneID);
  const content = panel.querySelector(".saved-content");
  clear(content);
  appendMutedRow(content, "Loading saved content", "Projects, bookmarks, notes, and tags will appear here.");
  renderSavedPlanUsage(panel.querySelector(".saved-plan-usage"));
  requestAnimationFrame(() => hydrateSavedPanelWhenConnected(panel, savedInstance, paneID));

  return panel;
}

function renderSavedProjects(panel, instance, paneID, projects, projectSections) {
  const list = panel.querySelector(".saved-project-list");
  const addButton = panel.querySelector(".saved-projects-add-button");
  const archiveButton = panel.querySelector(".saved-projects-archive-button");
  let showingArchived = Boolean(instance.projectsArchiveMode);
  let switchCleanupTimer = null;
  addButton.addEventListener("click", () => showProjectCreateSheet(panel));
  wireCodeFilterMenu(list, instance, {
    stateKey: "projectsMenuOpen",
    menuName: "projects",
    label: (savedInstance) => savedInstance.projectsArchiveMode ? "Archived Projects" : "Projects"
  });

  const syncProjectModeControls = () => {
    archiveButton.setAttribute("aria-pressed", String(showingArchived));
    archiveButton.title = showingArchived ? "Show active projects" : "Show archived projects";
    archiveButton.setAttribute("aria-label", archiveButton.title);
    addButton.hidden = showingArchived;
    addButton.disabled = showingArchived;
  };

  const renderProjectCards = () => {
    const visibleProjects = showingArchived
      ? archivedProjectRecords(projects)
      : activeProjectRecords(projects);
    clear(list);
    list.classList.toggle("is-showing-archive", showingArchived);
    if (!visibleProjects.length) {
      const empty = document.createElement("p");
      empty.className = "saved-projects-empty";
      empty.textContent = showingArchived
        ? "No archived projects."
        : "No projects yet. Use + to create one.";
      list.append(empty);
      updateCodeFilterMenu(list, instance, {
        stateKey: "projectsMenuOpen",
        menuName: "projects",
        label: (savedInstance) => savedInstance.projectsArchiveMode ? "Archived Projects" : "Projects"
      });
      return;
    }

    let draggedProjectID = "";
    const clearDropIndicators = () => {
      list.querySelectorAll(".saved-project-tile").forEach((tile) => {
        tile.classList.remove("is-drop-before", "is-drop-after");
      });
    };
    const reorderProject = async (sourceID, targetID, placeAfter) => {
      if (showingArchived) return;
      const sourceIndex = visibleProjects.findIndex((project) => projectRecordID(project) === sourceID);
      const targetIndex = visibleProjects.findIndex((project) => projectRecordID(project) === targetID);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;
      const reordered = [...visibleProjects];
      const [movedProject] = reordered.splice(sourceIndex, 1);
      let insertionIndex = targetIndex - (sourceIndex < targetIndex ? 1 : 0);
      if (placeAfter) insertionIndex += 1;
      reordered.splice(insertionIndex, 0, movedProject);
      await persistProjectOrder(reordered, paneID);
    };

    visibleProjects.forEach((project) => {
      const tile = document.createElement("article");
      tile.className = "saved-project-tile";
      if (showingArchived) tile.classList.add("is-archived");
      if (project.sharedOrganizationID) tile.classList.add("is-shared");
      const tileColor = projectColor(project);
      tile.style.setProperty("--project-color", tileColor);
      tile.style.setProperty("--project-on-color", projectForegroundColor(tileColor));
      tile.tabIndex = 0;
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-label", `Open ${project.name || project.title || "project"}`);
      tile.dataset.projectId = projectRecordID(project);
      if (!showingArchived && !project.sharedOnly) {
        tile.dataset.draggable = "true";
        tile.draggable = true;
        tile.title = "Drag to reorder · Alt+Arrow keys also move this Project";
        tile.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
      }
      const heading = document.createElement("strong");
      heading.textContent = project.name || project.title || "Project";
      const count = projectSections.filter((item) => projectSectionBelongsToProject(item, project)).length;
      const countLabel = document.createElement("span");
      countLabel.className = "saved-project-count";
      countLabel.textContent = String(count);
      countLabel.title = count === 1 ? "1 saved section" : `${count} saved sections`;
      countLabel.setAttribute("aria-label", countLabel.title);
      const actions = document.createElement("div");
      actions.className = "saved-project-tile-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.title = showingArchived ? "Restore project" : "Edit project";
      editButton.setAttribute("aria-label", `${editButton.title}: ${heading.textContent}`);
      editButton.innerHTML = showingArchived ? archiveRestoreIconSVG() : pencilIconSVG();
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (showingArchived) restoreArchivedProject(project);
        else showProjectCreateSheet(panel, project);
      });
      const archiveProjectButton = document.createElement("button");
      archiveProjectButton.type = "button";
      archiveProjectButton.title = showingArchived ? "Delete project" : "Archive project";
      archiveProjectButton.setAttribute("aria-label", `${archiveProjectButton.title}: ${heading.textContent}`);
      archiveProjectButton.innerHTML = showingArchived ? trashIconSVG() : archiveIconSVG();
      archiveProjectButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (showingArchived) void deleteArchivedProject(project);
        else void archiveProject(project);
      });
      if (!project.sharedOnly) actions.append(editButton, archiveProjectButton);
      tile.append(heading, countLabel, actions);
      const open = () => {
        if (tile.dataset.opening === "true") return;
        tile.dataset.opening = "true";
        tile.classList.add("is-opening");
        tile.setAttribute("aria-busy", "true");
        void openProjectDetail(project, { sourcePaneID: paneID }).finally(() => {
          tile.classList.remove("is-opening");
          tile.removeAttribute("aria-busy");
          delete tile.dataset.opening;
        });
      };
      tile.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
        tile.dataset.pointerFocus = "true";
      });
      tile.addEventListener("pointercancel", () => {
        delete tile.dataset.pointerFocus;
      });
      tile.addEventListener("click", (event) => {
        if (tile.dataset.justDragged === "true") return;
        if (event.detail > 0) {
          tile.blur();
          delete tile.dataset.pointerFocus;
        }
        open();
      });
      tile.addEventListener("keydown", (event) => {
        if (
          !showingArchived &&
          !project.sharedOnly &&
          event.altKey &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          event.preventDefault();
          const currentIndex = visibleProjects.findIndex(
            (candidate) => projectRecordID(candidate) === projectRecordID(project)
          );
          const nextIndex = currentIndex + (event.key === "ArrowUp" ? -1 : 1);
          const target = visibleProjects[nextIndex];
          if (target) {
            void reorderProject(
              projectRecordID(project),
              projectRecordID(target),
              event.key === "ArrowDown"
            );
          }
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      });
      tile.addEventListener("dragstart", (event) => {
        if (showingArchived || project.sharedOnly || event.target.closest(".saved-project-tile-actions")) {
          event.preventDefault();
          return;
        }
        draggedProjectID = projectRecordID(project);
        tile.dataset.justDragged = "true";
        clearDropIndicators();
        list.querySelectorAll(".saved-project-tile.is-dragging").forEach((candidate) => {
          candidate.classList.remove("is-dragging");
        });
        tile.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedProjectID);
      });
      tile.addEventListener("dragover", (event) => {
        const sourceID = draggedProjectID || event.dataTransfer.getData("text/plain");
        if (!sourceID || sourceID === tile.dataset.projectId || tile.dataset.draggable !== "true") return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const bounds = tile.getBoundingClientRect();
        const horizontalDistance = Math.abs(event.clientX - (bounds.left + (bounds.width / 2)));
        const verticalDistance = Math.abs(event.clientY - (bounds.top + (bounds.height / 2)));
        const placeAfter = horizontalDistance >= verticalDistance
          ? event.clientX >= bounds.left + (bounds.width / 2)
          : event.clientY >= bounds.top + (bounds.height / 2);
        clearDropIndicators();
        tile.classList.add(placeAfter ? "is-drop-after" : "is-drop-before");
      });
      tile.addEventListener("drop", (event) => {
        const sourceID = draggedProjectID || event.dataTransfer.getData("text/plain");
        if (!sourceID || sourceID === tile.dataset.projectId) return;
        event.preventDefault();
        const placeAfter = tile.classList.contains("is-drop-after");
        const targetID = tile.dataset.projectId || "";
        clearDropIndicators();
        if (targetID) void reorderProject(sourceID, targetID, placeAfter);
      });
      tile.addEventListener("dragend", () => {
        draggedProjectID = "";
        delete tile.dataset.pointerFocus;
        tile.classList.remove("is-dragging");
        clearDropIndicators();
        requestAnimationFrame(() => {
          tile.dataset.justDragged = "false";
        });
      });
      list.append(tile);
    });
    updateCodeFilterMenu(list, instance, {
      stateKey: "projectsMenuOpen",
      menuName: "projects",
      label: (savedInstance) => savedInstance.projectsArchiveMode ? "Archived Projects" : "Projects"
    });
  };

  archiveButton.addEventListener("click", () => {
    if (switchCleanupTimer !== null) return;
    const previousHeight = list.getBoundingClientRect().height;
    archiveButton.disabled = true;
    showingArchived = !showingArchived;
    instance.projectsArchiveMode = showingArchived;
    syncProjectModeControls();
    renderProjectCards();
    saveWorkspaceState();

    const finishSwitch = () => {
      if (switchCleanupTimer !== null) window.clearTimeout(switchCleanupTimer);
      list.classList.remove("is-mode-switching");
      list.style.removeProperty("--saved-project-list-from-height");
      list.style.removeProperty("--saved-project-list-to-height");
      list.style.removeProperty("--saved-project-list-entry-offset");
      archiveButton.disabled = false;
      switchCleanupTimer = null;
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishSwitch();
      return;
    }

    const nextHeight = list.getBoundingClientRect().height;
    const entryOffset = showingArchived ? "6px" : "-6px";
    list.style.setProperty("--saved-project-list-from-height", `${previousHeight}px`);
    list.style.setProperty("--saved-project-list-to-height", `${nextHeight}px`);
    list.style.setProperty("--saved-project-list-entry-offset", entryOffset);
    list.classList.add("is-mode-switching");
    list.addEventListener("animationend", finishSwitch, { once: true });
    switchCleanupTimer = window.setTimeout(finishSwitch, 240);
  });

  syncProjectModeControls();
  renderProjectCards();
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

function savedSectionIsNestedListParagraph(chapter, section) {
  const sectionID = String(section?.id || "");
  const sectionNumber = String(section?.sectionNumber || "").trim().replace(/\.$/, "");
  if (!sectionID || !/^\d+(?:\.\d+)*$/.test(sectionNumber)) return false;

  const parentGroup = (chapter?.groups || []).find((group) =>
    (group?.sections || []).some((candidate) =>
      String(candidate?.id ?? candidate) === sectionID
    )
  );
  const parentNumber = String(parentGroup?.headerLine || parentGroup?.headingLine || "")
    .match(/\b(\d+(?:\.\d+)*)\b/)?.[1];
  if (!parentNumber) return false;

  return sectionNumber !== parentNumber && !sectionNumber.startsWith(`${parentNumber}.`);
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
      const savedContentComparisonText = String(rawPreview).replace(/\s+/g, " ").trim();
      return {
        ...item,
        blockID,
        codePrefix,
        chapterID,
        chapterNumber,
        chapterTitle: chapter?.fullTitle || chapter?.displayTitle || chapter?.title || item.chapterTitle || "",
        sectionNumber: section?.sectionNumber || detail.sectionNumber || item.sectionNumber || "",
        title: section?.title || detail.title || item.title || "Section",
        isNestedListParagraph: savedSectionIsNestedListParagraph(chapter, section),
        savedContentComparisonText,
        previewText: savedContentComparisonText.slice(0, 240)
      };
    } catch {
      return { ...item, previewText: String(item.previewText || "").replace(/\s+/g, " ").trim().slice(0, 240) };
    }
  }));
}

function mergeEquivalentSavedColumnRows(items = []) {
  const normalizedPreview = (item) => String(item?.savedContentComparisonText || item?.previewText || "")
    .replace(/\s+/g, " ")
    .replace(/(["“‘])\s+/g, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  const targetKey = (item) => [
    syncCodeVersion(item?.codeVersion),
    String(item?.sectionID || "")
  ].join(":");
  const bookmarksByTarget = new Map(
    items
      .filter((item) => item?.savedColumnKind === "bookmark")
      .map((item) => [targetKey(item), item])
  );
  const mergedAnnotations = new Set();

  items.forEach((item) => {
    const blockID = normalizeAnnotationBlockID(item?.blockID);
    if (!blockID || item?.savedColumnKind !== "annotation") return;
    const bookmark = bookmarksByTarget.get(targetKey(item));
    const bookmarkPreview = normalizedPreview(bookmark);
    if (!bookmark || !bookmarkPreview || bookmarkPreview !== normalizedPreview(item)) return;
    bookmark.annotationBlockID = blockID;
    bookmark.noteBody = String(item.noteBody || bookmark.noteBody || "").trim();
    bookmark.tags = normalizeAnnotationTags([
      ...savedItemTags(bookmark),
      ...savedItemTags(item)
    ]);
    mergedAnnotations.add(item);
  });

  return items.filter((item) => !mergedAnnotations.has(item));
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
      if (item.isNestedListParagraph) {
        row.classList.add("is-list-paragraph");
      }
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
        meta.textContent = normalizeAnnotationBlockID(item.blockID) || item.isNestedListParagraph
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
        const title = document.createElement(item.isNestedListParagraph ? "span" : "strong");
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
            const openItem = item.annotationBlockID
              ? { ...item, blockID: item.annotationBlockID }
              : item;
            void openSavedItemInReader(openItem, paneID);
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
              const message = error.message || "Could not remove saved section";
              removeButton.title = message;
              removeButton.classList.add("has-error");
              row.classList.remove("is-removing");
              presentWorkspaceIssue(message);
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

async function openDeepLinkedSectionInReader(item) {
  const detail = searchResultDetail(item);
  let reader = (state.readers || []).find((candidate) => candidate.codePrefix === detail.codePrefix);
  if (!reader) {
    reader = newReaderState(readerFieldsForSectionDetail(detail, {
      shouldSmoothScrollToSection: false
    }));
    state.readers.push(reader);
  } else {
    Object.assign(reader, readerFieldsForSectionDetail(detail, {
      shouldSmoothScrollToSection: false
    }));
  }
  const paneID = paneIDForReader(reader);
  state.paneWeights[paneID] ||= defaultPaneWidthForID(paneID);
  appendPaneIfMissing(paneID);
  scheduleContinuitySync(reader);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [paneID] });
  alignReaderSectionAfterLayout(reader);
  scrollPaneIntoView(paneID);
}

function closeSavedItemDetailsForPane(savedPaneID) {
  const details = sectionDetailsBySearch();
  const anchors = sectionDetailAnchorsBySearch();
  Object.entries(anchors).forEach(([searchID, anchorPaneID]) => {
    if (anchorPaneID !== savedPaneID || !details[searchID]) return;
    const detailPaneID = paneIDForSectionDetail(searchID);
    closeLinkedReaderForSearch(searchID);
    delete details[searchID];
    delete anchors[searchID];
    delete state.paneWeights[detailPaneID];
    state.paneOrder = (state.paneOrder || []).filter((paneID) => paneID !== detailPaneID);
  });
}

async function openSavedItemInReader(item, savedPaneID, options = {}) {
  const sectionID = String(item?.sectionID || item?.id || "").trim();
  if (!sectionID) return;
  const recentlyViewedSearchID = String(options.recentlyViewedSearchID || "").trim();
  const detail = {
    codePrefix: item.codePrefix || "BC",
    codeVersion: item.codeVersion || syncCodeVersionForPrefix(item.codePrefix || "BC"),
    chapterID: item.chapterID || "",
    chapterNumber: item.chapterNumber || "",
    sectionID,
    sectionNumber: item.sectionNumber || "",
    title: item.title || "Section"
  };
  closeSavedItemDetailsForPane(savedPaneID);
  const readerFields = readerFieldsForSectionDetail(detail, {
    shouldSmoothScrollToSection: false,
    savedSourcePaneID: savedPaneID,
    recentlyViewedSourceSearchID: recentlyViewedSearchID
  });
  const canAddReader = isProAccount() || state.readers.length < 2;
  let reader = (state.readers || []).find((candidate) => candidate.savedSourcePaneID === savedPaneID);
  if (reader) {
    Object.assign(reader, readerFields);
  } else if (canAddReader) {
    reader = newReaderState(readerFields);
    state.readers.push(reader);
  } else {
    reader = state.readers[1] || state.readers[0];
    Object.entries(searchLinkedReadersBySearch()).forEach(([searchID, readerID]) => {
      if (readerID === reader.id) delete state.searchLinkedReaders[searchID];
    });
    delete reader.projectSavedSourceKey;
    Object.assign(reader, readerFields);
  }
  const readerPaneID = paneIDForReader(reader);
  if (!reader.sourceLinkedDefaultWidthApplied) {
    state.paneWeights[readerPaneID] = defaultSourceLinkedReaderPaneWidth;
    reader.sourceLinkedDefaultWidthApplied = true;
  }
  if (recentlyViewedSearchID) {
    Object.entries(searchLinkedReadersBySearch()).forEach(([searchID, readerID]) => {
      if (readerID === reader.id && searchID !== recentlyViewedSearchID) {
        delete state.searchLinkedReaders[searchID];
      }
    });
    state.searchLinkedReaders[recentlyViewedSearchID] = reader.id;
  }
  placePaneAfter(savedPaneID, readerPaneID);
  updateBrowserSectionURL(sectionID);
  scheduleContinuitySync(reader);
  saveWorkspaceState();
  await transitionWorkspace("utility", { refreshPaneIDs: [readerPaneID] });
  scrollPaneIntoView(readerPaneID);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => alignSavedReaderTargetAtTop(reader, item));
  });
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
  if (account) await flushSyncOutbox({ refresh: true }).catch(() => {});
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
  if (activeAccount()) await flushSyncOutbox({ refresh: true }).catch(() => {});
  return uniqueTargets.size;
}

async function performSettingsClearAction(action) {
  if (action === "searches") {
    state.recentSearches = [];
    state.recentSearchHistory = [];
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
          values: {
            ...existing,
            recentlyViewedSectionsJSON: "[]",
            recentSearchesJSON: "[]",
            recentSearchHistoryJSON: "[]"
          },
          updatedAt
        }
      }, account);
      state.continuityAppliedAt = updatedAt;
      if (syncedContent?.summary?.latestContinuity) {
        syncedContent.summary.latestContinuity = {
          ...syncedContent.summary.latestContinuity,
          values: {
            ...existing,
            recentlyViewedSectionsJSON: "[]",
            recentSearchesJSON: "[]",
            recentSearchHistoryJSON: "[]"
          },
          updatedAt
        };
      }
    }
    saveWorkspaceState();
    if (account) await flushSyncOutbox({ refresh: true }).catch(() => {});
    return 0;
  }
  if (action === "bookmarks") return clearSettingsBookmarks();
  if (action === "notes") return clearSettingsAnnotations("noteBody");
  if (action === "tags") return clearSettingsAnnotations("tags");
  return 0;
}

function organizationInvitationTokenFromURL() {
  return new URLSearchParams(window.location.search).get("organizationInvite") || "";
}

function clearOrganizationInvitationURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete("organizationInvite");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}` || "/");
}

function firmControlLabel(text, control) {
  const label = document.createElement("label");
  label.className = "settings-firm-field";
  const caption = document.createElement("span");
  caption.textContent = text;
  label.append(caption, control);
  return label;
}

async function refreshOrganizationWorkspaceUI() {
  await loadOrganizationWorkspace({ force: true });
  const refreshPaneIDs = activePaneIDs().filter((paneID) =>
    paneID === "utility:settings" ||
    paneID.startsWith("utility:saved:") ||
    isProjectDetailPaneID(paneID) ||
    isProjectNotebookPaneID(paneID)
  );
  await transitionWorkspace("utility", { refreshPaneIDs });
}

async function renderFirmMemberManager(container, organization, setFirmStatus) {
  container.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "settings-firm-muted";
  loading.textContent = "Loading members…";
  container.append(loading);
  try {
    const payload = await postResearch("/organizations/members/list", {
      organizationID: organization.id
    });
    container.replaceChildren();
    const members = [
      ...(payload.members || []).map((membership) => ({ ...membership, scope: "Firm" })),
      ...(payload.projectMembers || []).map((membership) => ({
        ...membership,
        scope: (organization.projects || []).find((project) => project.id === membership.projectID)?.name ||
          "Project"
      }))
    ];
    const unique = new Map();
    members.forEach((membership) => {
      const key = `${membership.projectID || "firm"}:${membership.userID}`;
      unique.set(key, membership);
    });
    if (!unique.size) {
      const empty = document.createElement("p");
      empty.className = "settings-firm-muted";
      empty.textContent = "No members yet.";
      container.append(empty);
    }
    unique.forEach((membership) => {
      const row = document.createElement("article");
      row.className = "settings-firm-member";
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = membership.account?.displayName ||
        membership.account?.email ||
        membership.userID;
      const meta = document.createElement("span");
      meta.textContent = `${membership.scope} · ${membership.status}`;
      copy.append(name, meta);
      row.append(copy);
      if (membership.role === "owner") {
        const role = document.createElement("span");
        role.className = "settings-firm-role";
        role.textContent = "Owner";
        row.append(role);
      } else {
        const roleSelect = document.createElement("select");
        roleSelect.setAttribute("aria-label", `Role for ${name.textContent}`);
        ["editor", "reviewer", "viewer"].forEach((role) => {
          const option = document.createElement("option");
          option.value = role;
          option.textContent = role[0].toUpperCase() + role.slice(1);
          roleSelect.append(option);
        });
        roleSelect.value = membership.role;
        const statusButton = document.createElement("button");
        statusButton.className = "settings-mini-button";
        statusButton.type = "button";
        statusButton.textContent = membership.status === "active" ? "Remove" : "Restore";
        const updateMembership = async (values) => {
          roleSelect.disabled = true;
          statusButton.disabled = true;
          try {
            await postResearch("/organizations/members/update", {
              organizationID: organization.id,
              projectID: membership.projectID || undefined,
              userID: membership.userID,
              ...values
            });
            setFirmStatus("Member access updated.");
            await refreshOrganizationWorkspaceUI();
          } catch (error) {
            setFirmStatus(error.message || "Member access could not be updated.", true);
            roleSelect.disabled = false;
            statusButton.disabled = false;
          }
        };
        roleSelect.addEventListener("change", () => {
          void updateMembership({ role: roleSelect.value });
        });
        statusButton.addEventListener("click", () => {
          void updateMembership({
            status: membership.status === "active" ? "deactivated" : "active"
          });
        });
        const actions = document.createElement("div");
        actions.className = "settings-firm-member-actions";
        actions.append(roleSelect, statusButton);
        row.append(actions);
      }
      container.append(row);
    });
    (payload.invitations || []).filter((invitation) => invitation.state === "pending")
      .forEach((invitation) => {
        const row = document.createElement("article");
        row.className = "settings-firm-member is-pending";
        const copy = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = invitation.invitedEmail || invitation.invitedUserID || "Pending invitation";
        const meta = document.createElement("span");
        const scope = invitation.projectID
          ? (organization.projects || []).find((project) => project.id === invitation.projectID)?.name || "Project"
          : "Firm";
        meta.textContent = `${scope} · ${invitation.role} · pending`;
        copy.append(name, meta);
        const revoke = document.createElement("button");
        revoke.className = "settings-mini-button";
        revoke.type = "button";
        revoke.textContent = "Revoke";
        revoke.addEventListener("click", async () => {
          revoke.disabled = true;
          try {
            await postResearch("/organizations/invitations/revoke", {
              organizationID: organization.id,
              invitationID: invitation.id
            });
            setFirmStatus("Invitation revoked.");
            await refreshOrganizationWorkspaceUI();
          } catch (error) {
            setFirmStatus(error.message || "Invitation could not be revoked.", true);
            revoke.disabled = false;
          }
        });
        row.append(copy, revoke);
        container.append(row);
      });
  } catch (error) {
    loading.textContent = error.message || "Members could not be loaded.";
  }
}

function renderFirmStandardsEditor(organization, setFirmStatus) {
  const details = document.createElement("details");
  details.className = "settings-firm-standards";
  const summary = document.createElement("summary");
  summary.textContent = "Firm standards, tags & Report templates";
  const editor = document.createElement("div");
  details.append(summary, editor);
  let controls = structuredClone(organization.firmControls || {});
  const lines = (value) => String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const render = () => {
    editor.replaceChildren();
    const intro = document.createElement("p");
    intro.className = "settings-firm-muted";
    intro.textContent = `Revision ${controls.version || 1}. New Reports snapshot these settings; older Reports never change.`;
    editor.append(intro);

    const branding = document.createElement("section");
    branding.className = "settings-firm-standard-section";
    const brandingTitle = document.createElement("strong");
    brandingTitle.textContent = "Report branding";
    const displayName = document.createElement("input");
    displayName.value = controls.branding?.displayName || organization.name;
    displayName.maxLength = 160;
    displayName.addEventListener("input", () => {
      controls.branding.displayName = displayName.value;
    });
    const accent = document.createElement("input");
    accent.type = "color";
    accent.value = controls.branding?.accentColorHex || "#a65318";
    accent.addEventListener("input", () => {
      controls.branding.accentColorHex = accent.value;
    });
    const website = document.createElement("input");
    website.type = "url";
    website.value = controls.branding?.website || "";
    website.placeholder = "https://firm.example";
    website.addEventListener("input", () => {
      controls.branding.website = website.value;
    });
    const footer = document.createElement("input");
    footer.value = controls.branding?.footerText || "";
    footer.maxLength = 500;
    footer.placeholder = "Optional PDF footer";
    footer.addEventListener("input", () => {
      controls.branding.footerText = footer.value;
    });
    const requiredDisclaimers = document.createElement("textarea");
    requiredDisclaimers.value = (controls.requiredDisclaimers || []).join("\n");
    requiredDisclaimers.placeholder = "One required firm disclaimer per line";
    requiredDisclaimers.addEventListener("input", () => {
      controls.requiredDisclaimers = lines(requiredDisclaimers.value);
    });
    branding.append(
      brandingTitle,
      firmControlLabel("Firm display name", displayName),
      firmControlLabel("Accent color", accent),
      firmControlLabel("Website", website),
      firmControlLabel("PDF footer", footer),
      firmControlLabel("Required disclaimers", requiredDisclaimers)
    );
    editor.append(branding);

    const tagsSection = document.createElement("section");
    tagsSection.className = "settings-firm-standard-section";
    const tagsHeading = document.createElement("div");
    tagsHeading.className = "settings-firm-standard-heading";
    const tagsTitle = document.createElement("strong");
    tagsTitle.textContent = "Project tags";
    const addTag = document.createElement("button");
    addTag.className = "settings-secondary-button";
    addTag.type = "button";
    addTag.textContent = "Add tag";
    addTag.addEventListener("click", () => {
      const now = new Date().toISOString();
      controls.tags ||= [];
      controls.tags.push({
        id: crypto.randomUUID(),
        name: "New tag",
        colorHex: "#6b7280",
        status: "active",
        createdAt: now,
        updatedAt: now,
        order: controls.tags.length
      });
      render();
    });
    tagsHeading.append(tagsTitle, addTag);
    tagsSection.append(tagsHeading);
    (controls.tags || []).forEach((tag) => {
      const row = document.createElement("div");
      row.className = "settings-firm-standard-row";
      const name = document.createElement("input");
      name.value = tag.name || "";
      name.maxLength = 80;
      name.setAttribute("aria-label", "Firm tag name");
      name.addEventListener("input", () => {
        tag.name = name.value;
      });
      const color = document.createElement("input");
      color.type = "color";
      color.value = tag.colorHex || "#6b7280";
      color.setAttribute("aria-label", `${tag.name || "Firm tag"} color`);
      color.addEventListener("input", () => {
        tag.colorHex = color.value;
      });
      const status = document.createElement("select");
      status.setAttribute("aria-label", `${tag.name || "Firm tag"} status`);
      [["active", "Active"], ["archived", "Archived"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        status.append(option);
      });
      status.value = tag.status || "active";
      status.addEventListener("change", () => {
        tag.status = status.value;
      });
      row.append(name, color, status);
      tagsSection.append(row);
    });
    const activeTags = (controls.tags || []).filter((tag) => tag.status === "active");
    if (activeTags.length && organization.projects?.length) {
      const assignmentsTitle = document.createElement("span");
      assignmentsTitle.className = "settings-firm-subheading";
      assignmentsTitle.textContent = "Assignments";
      tagsSection.append(assignmentsTitle);
      (organization.projects || []).forEach((project) => {
        const assignment = document.createElement("fieldset");
        assignment.className = "settings-firm-tag-assignment";
        const legend = document.createElement("legend");
        legend.textContent = project.name || "Untitled Project";
        assignment.append(legend);
        activeTags.forEach((tag) => {
          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = (controls.projectTagAssignments?.[project.id] || [])
            .includes(tag.id);
          checkbox.addEventListener("change", () => {
            controls.projectTagAssignments ||= {};
            const assigned = new Set(controls.projectTagAssignments[project.id] || []);
            if (checkbox.checked) assigned.add(tag.id);
            else assigned.delete(tag.id);
            if (assigned.size) controls.projectTagAssignments[project.id] = Array.from(assigned);
            else delete controls.projectTagAssignments[project.id];
          });
          const swatch = document.createElement("span");
          swatch.className = "settings-firm-tag-swatch";
          swatch.style.setProperty("--firm-tag-color", tag.colorHex);
          label.append(checkbox, swatch, document.createTextNode(tag.name));
          assignment.append(label);
        });
        tagsSection.append(assignment);
      });
    }
    editor.append(tagsSection);

    const templatesSection = document.createElement("section");
    templatesSection.className = "settings-firm-standard-section";
    const templatesHeading = document.createElement("div");
    templatesHeading.className = "settings-firm-standard-heading";
    const templatesTitle = document.createElement("strong");
    templatesTitle.textContent = "Report templates";
    const addTemplate = document.createElement("button");
    addTemplate.className = "settings-secondary-button";
    addTemplate.type = "button";
    addTemplate.textContent = "Add template";
    addTemplate.addEventListener("click", () => {
      const now = new Date().toISOString();
      const templateID = crypto.randomUUID();
      controls.reportTemplates ||= [];
      controls.reportTemplates.push({
        id: templateID,
        name: "New template",
        description: "",
        coverLabel: "Project Code Report",
        disclaimers: [],
        status: "active",
        createdAt: now,
        updatedAt: now,
        order: controls.reportTemplates.length
      });
      const currentDefaultIsActive = controls.reportTemplates.some((template) =>
        template.id === controls.defaultReportTemplateID && template.status === "active"
      );
      if (!currentDefaultIsActive) controls.defaultReportTemplateID = templateID;
      render();
    });
    templatesHeading.append(templatesTitle, addTemplate);
    templatesSection.append(templatesHeading);
    (controls.reportTemplates || []).forEach((template) => {
      const card = document.createElement("article");
      card.className = "settings-firm-template";
      const name = document.createElement("input");
      name.value = template.name || "";
      name.maxLength = 120;
      name.addEventListener("input", () => {
        template.name = name.value;
      });
      const coverLabel = document.createElement("input");
      coverLabel.value = template.coverLabel || "";
      coverLabel.maxLength = 160;
      coverLabel.addEventListener("input", () => {
        template.coverLabel = coverLabel.value;
      });
      const description = document.createElement("textarea");
      description.value = template.description || "";
      description.placeholder = "Internal description";
      description.addEventListener("input", () => {
        template.description = description.value;
      });
      const disclaimers = document.createElement("textarea");
      disclaimers.value = (template.disclaimers || []).join("\n");
      disclaimers.placeholder = "One template disclaimer per line";
      disclaimers.addEventListener("input", () => {
        template.disclaimers = lines(disclaimers.value);
      });
      const status = document.createElement("select");
      [["active", "Active"], ["archived", "Archived"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        status.append(option);
      });
      status.value = template.status || "active";
      status.addEventListener("change", () => {
        template.status = status.value;
        if (
          template.status === "archived" &&
          controls.defaultReportTemplateID === template.id
        ) {
          controls.defaultReportTemplateID = controls.reportTemplates.find((candidate) =>
            candidate.id !== template.id && candidate.status === "active"
          )?.id || "";
        }
        render();
      });
      const defaultTemplate = document.createElement("input");
      defaultTemplate.type = "radio";
      defaultTemplate.name = `default-report-template-${organization.id}`;
      defaultTemplate.checked = controls.defaultReportTemplateID === template.id;
      defaultTemplate.disabled = template.status !== "active";
      defaultTemplate.addEventListener("change", () => {
        if (defaultTemplate.checked) controls.defaultReportTemplateID = template.id;
      });
      const defaultLabel = document.createElement("label");
      defaultLabel.className = "settings-firm-default-template";
      defaultLabel.append(defaultTemplate, document.createTextNode("Default for new Reports"));
      card.append(
        firmControlLabel("Template name", name),
        firmControlLabel("Cover label", coverLabel),
        firmControlLabel("Description", description),
        firmControlLabel("Template disclaimers", disclaimers),
        firmControlLabel("Status", status),
        defaultLabel
      );
      templatesSection.append(card);
    });
    editor.append(templatesSection);

    const policy = document.createElement("section");
    policy.className = "settings-firm-standard-section";
    const policyTitle = document.createElement("strong");
    policyTitle.textContent = "Operating policies";
    const allowanceMode = document.createElement("select");
    [["pooled", "Pooled firm allowance"], ["per-seat", "Per-seat allowance"]]
      .forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        allowanceMode.append(option);
      });
    allowanceMode.value = controls.researchAllowance?.mode || "pooled";
    allowanceMode.addEventListener("change", () => {
      controls.researchAllowance.mode = allowanceMode.value;
    });
    const monthlyUnits = document.createElement("input");
    monthlyUnits.type = "number";
    monthlyUnits.min = "1";
    monthlyUnits.max = "100000";
    monthlyUnits.value = String(controls.researchAllowance?.monthlyUnits || 100);
    monthlyUnits.addEventListener("input", () => {
      controls.researchAllowance.monthlyUnits = Number(monthlyUnits.value);
    });
    const retentionDays = document.createElement("input");
    retentionDays.type = "number";
    retentionDays.min = "1";
    retentionDays.max = "36500";
    retentionDays.value = String(controls.retentionPolicy?.retentionDays || 2555);
    retentionDays.addEventListener("input", () => {
      controls.retentionPolicy.retentionDays = Number(retentionDays.value);
    });
    const usage = document.createElement("p");
    usage.className = "settings-firm-muted";
    usage.textContent = organization.researchUsage
      ? `${organization.researchUsage.requestsUsed}/${organization.researchUsage.requestLimit} Research requests recorded this period · resets ${new Date(organization.researchUsage.resetDate).toLocaleDateString()}.`
      : "Research usage will appear after this workspace refreshes.";
    const retentionNotice = document.createElement("p");
    retentionNotice.className = "settings-firm-muted";
    retentionNotice.textContent = "Retention is policy metadata only. Permitext will not automatically delete Project data.";
    const billingNotice = document.createElement("p");
    billingNotice.className = "settings-firm-muted";
    billingNotice.textContent = `${organization.billingIdentity.status} billing state · ${organization.billingIdentity.seatLimit} seats. Billing identifiers and subscription operations remain server-only.`;
    policy.append(
      policyTitle,
      firmControlLabel("Research allowance", allowanceMode),
      firmControlLabel("Monthly request units", monthlyUnits),
      usage,
      firmControlLabel("Retention period (days)", retentionDays),
      retentionNotice,
      billingNotice
    );
    editor.append(policy);

    const save = document.createElement("button");
    save.className = "settings-primary-button";
    save.type = "button";
    save.textContent = "Save Firm Standards";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        const payload = await postResearch("/organizations/controls/save", {
          organizationID: organization.id,
          expectedVersion: controls.version,
          controls
        });
        controls = structuredClone(payload.organization.firmControls);
        setFirmStatus(`Firm standards saved as revision ${controls.version}.`);
        await refreshOrganizationWorkspaceUI();
      } catch (error) {
        if (error.payload?.controls) controls = structuredClone(error.payload.controls);
        setFirmStatus(error.message || "Firm standards could not be saved.", true);
        save.disabled = false;
      }
    });
    editor.append(save);
  };
  details.addEventListener("toggle", () => {
    if (details.open && !editor.childElementCount) render();
  });
  return details;
}

async function renderFirmWorkspaceSettings(panel, settingsProjects, setStatus) {
  const container = panel.querySelector(".settings-firm-content");
  if (!container) return;
  container.replaceChildren();
  const setFirmStatus = (message, isError = false) => {
    setStatus(message, isError);
    const inline = container.querySelector(".settings-firm-status");
    if (inline) {
      inline.textContent = message || "";
      inline.classList.toggle("has-error", isError);
    }
  };
  const account = activeAccount();
  if (!account) {
    const message = document.createElement("p");
    message.className = "settings-firm-muted";
    message.textContent = organizationInvitationTokenFromURL()
      ? "Sign in to review and accept this firm invitation."
      : "Sign in to create a firm workspace or open Projects shared with you.";
    container.append(message);
    return;
  }

  const pendingInvitationToken = organizationInvitationTokenFromURL();
  if (pendingInvitationToken) {
    const invitation = document.createElement("section");
    invitation.className = "settings-firm-invitation";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Firm invitation";
    const detail = document.createElement("span");
    detail.textContent = "Accept only if you recognize the firm or Project that shared this link.";
    copy.append(title, detail);
    const accept = document.createElement("button");
    accept.className = "settings-primary-button";
    accept.type = "button";
    accept.textContent = "Accept Invitation";
    accept.addEventListener("click", async () => {
      accept.disabled = true;
      try {
        const payload = await postResearch("/organizations/invitations/accept", {
          invitationToken: pendingInvitationToken
        });
        clearOrganizationInvitationURL();
        setFirmStatus(`Access added to ${payload.organization.name}.`);
        await refreshOrganizationWorkspaceUI();
      } catch (error) {
        setFirmStatus(error.message || "The invitation could not be accepted.", true);
        accept.disabled = false;
      }
    });
    invitation.append(copy, accept);
    container.append(invitation);
  }

  const workspace = await loadOrganizationWorkspace();
  const organizations = workspace.organizations || [];
  if (workspace.error) {
    const error = document.createElement("p");
    error.className = "settings-firm-muted has-error";
    error.textContent = workspace.error;
    container.append(error);
  }

  const creationForm = document.createElement("form");
  creationForm.className = "settings-firm-create";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.maxLength = 160;
  nameInput.placeholder = "Firm or team name";
  nameInput.setAttribute("aria-label", "Firm or team name");
  const createButton = document.createElement("button");
  createButton.className = "settings-primary-button";
  createButton.type = "submit";
  createButton.textContent = "Create Firm Workspace";
  createButton.disabled = !isProAccount();
  creationForm.append(nameInput, createButton);
  if (!isProAccount()) {
    const note = document.createElement("p");
    note.className = "settings-firm-muted";
    note.textContent = "Pro is required to create a firm workspace. Invited members can participate without buying a separate personal plan.";
    creationForm.append(note);
  }
  creationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!nameInput.value.trim() || createButton.disabled) return;
    createButton.disabled = true;
    try {
      const payload = await postResearch("/organizations/create", {
        name: nameInput.value.trim()
      });
      setFirmStatus(`${payload.organization.name} created with five private-beta seats.`);
      await refreshOrganizationWorkspaceUI();
    } catch (error) {
      setFirmStatus(error.message || "The firm workspace could not be created.", true);
      createButton.disabled = false;
    }
  });
  container.append(creationForm);

  if (!organizations.length) {
    const empty = document.createElement("p");
    empty.className = "settings-firm-muted";
    empty.textContent = "No firm workspaces yet.";
    container.append(empty);
  }

  for (const organization of organizations) {
    const card = document.createElement("article");
    card.className = "settings-firm-workspace";
    const heading = document.createElement("div");
    heading.className = "settings-firm-workspace-heading";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = organization.name;
    const meta = document.createElement("span");
    meta.textContent = [
      organization.role,
      organization.accessScope === "project" ? "Project access" : "Firm access",
      organization.seats ? `${organization.seats.used}/${organization.billingIdentity.seatLimit} seats` : ""
    ].filter(Boolean).join(" · ");
    copy.append(name, meta);
    const role = document.createElement("span");
    role.className = "settings-firm-role";
    role.textContent = organization.role || "member";
    heading.append(copy, role);
    card.append(heading);

    const projectList = document.createElement("div");
    projectList.className = "settings-firm-projects";
    (organization.projects || []).forEach((project) => {
      const button = document.createElement("button");
      button.className = "settings-firm-project";
      button.type = "button";
      const projectName = document.createElement("strong");
      projectName.textContent = project.name || "Untitled Project";
      const projectMeta = document.createElement("span");
      projectMeta.textContent = `${project.role || organization.role} · Open Project Studio`;
      button.append(projectName, projectMeta);
      button.addEventListener("click", () => {
        void openProjectDetail({
          ...project,
          clientID: project.id,
          sharedOrganizationID: organization.id,
          sharedOrganizationName: organization.name,
          sharedRole: project.role || organization.role,
          sharedPermissions: project.permissions || organization.permissions || [],
          sharedOnly: !settingsProjects.some((candidate) =>
            projectDetailKey(candidate) === String(project.id)
          )
        }, { sourcePaneID: "utility:settings" });
      });
      projectList.append(button);
    });
    if (!organization.projects?.length) {
      const empty = document.createElement("p");
      empty.className = "settings-firm-muted";
      empty.textContent = "No Projects are shared in this workspace yet.";
      projectList.append(empty);
    }
    card.append(projectList);

    if (organization.permissions?.includes("project.transfer")) {
      const ownerTools = document.createElement("section");
      ownerTools.className = "settings-firm-owner-tools";
      const transferSelect = document.createElement("select");
      transferSelect.setAttribute("aria-label", "Personal Project to transfer");
      const transferPlaceholder = document.createElement("option");
      transferPlaceholder.value = "";
      transferPlaceholder.textContent = "Choose a personal Project…";
      transferSelect.append(transferPlaceholder);
      const organizationProjectIDs = new Set(
        organizations.flatMap((entry) => entry.projects || []).map((project) => String(project.id))
      );
      settingsProjects.filter((project) =>
        !organizationProjectIDs.has(projectDetailKey(project))
      ).forEach((project) => {
        const option = document.createElement("option");
        option.value = projectDetailKey(project);
        option.textContent = readableProjectName(project);
        transferSelect.append(option);
      });
      const transferButton = document.createElement("button");
      transferButton.className = "settings-secondary-button";
      transferButton.type = "button";
      transferButton.textContent = "Transfer to Firm";
      transferButton.disabled = true;
      transferSelect.addEventListener("change", () => {
        transferButton.disabled = !transferSelect.value;
      });
      transferButton.addEventListener("click", async () => {
        if (!transferSelect.value) return;
        const confirmed = await confirmWebWarning(
          "Transfer Project to firm?",
          "The Project keeps its stable identity and original-owner attribution. Firm roles will control future shared access.",
          { confirmLabel: "Transfer Project" }
        );
        if (!confirmed) return;
        transferButton.disabled = true;
        try {
          await postResearch("/organizations/projects/transfer", {
            organizationID: organization.id,
            projectID: transferSelect.value
          });
          setFirmStatus("Project transferred. Existing files and history were preserved.");
          await refreshOrganizationWorkspaceUI();
        } catch (error) {
          setFirmStatus(error.message || "The Project could not be transferred.", true);
          transferButton.disabled = false;
        }
      });

      const inviteForm = document.createElement("form");
      inviteForm.className = "settings-firm-invite";
      const email = document.createElement("input");
      email.type = "email";
      email.autocomplete = "email";
      email.placeholder = "teammate@example.com";
      email.required = true;
      const inviteRole = document.createElement("select");
      inviteRole.setAttribute("aria-label", "Invitation role");
      [
        ["viewer", "Viewer"],
        ["editor", "Editor"],
        ["reviewer", "Reviewer"]
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        inviteRole.append(option);
      });
      const inviteScope = document.createElement("select");
      inviteScope.setAttribute("aria-label", "Invitation scope");
      const allProjects = document.createElement("option");
      allProjects.value = "";
      allProjects.textContent = "Entire firm workspace";
      inviteScope.append(allProjects);
      (organization.projects || []).forEach((project) => {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = `Only ${project.name}`;
        inviteScope.append(option);
      });
      const inviteButton = document.createElement("button");
      inviteButton.className = "settings-primary-button";
      inviteButton.type = "submit";
      inviteButton.textContent = "Create Invitation Link";
      const invitationResult = document.createElement("div");
      invitationResult.className = "settings-firm-invite-result";
      inviteForm.append(
        firmControlLabel("Email", email),
        firmControlLabel("Role", inviteRole),
        firmControlLabel("Scope", inviteScope),
        inviteButton,
        invitationResult
      );
      inviteForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        inviteButton.disabled = true;
        invitationResult.replaceChildren();
        try {
          const payload = await postResearch("/organizations/members/invite", {
            organizationID: organization.id,
            projectID: inviteScope.value || undefined,
            email: email.value,
            role: inviteRole.value
          });
          const invitationURL = `${window.location.origin}${payload.acceptPath}`;
          const link = document.createElement("input");
          link.readOnly = true;
          link.value = invitationURL;
          link.setAttribute("aria-label", "Invitation link");
          const copyButton = document.createElement("button");
          copyButton.className = "settings-secondary-button";
          copyButton.type = "button";
          copyButton.textContent = "Copy Link";
          copyButton.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(invitationURL);
              copyButton.textContent = "Copied";
            } catch {
              link.focus();
              link.select();
              setFirmStatus("Invitation link selected. Copy it with your browser or keyboard.");
            }
          });
          invitationResult.append(link, copyButton);
          setFirmStatus("Invitation created. Permitext does not email it yet; send the private link directly.");
        } catch (error) {
          setFirmStatus(error.message || "The invitation could not be created.", true);
          inviteButton.disabled = false;
        }
      });

      const members = document.createElement("details");
      members.className = "settings-firm-members";
      const summary = document.createElement("summary");
      summary.textContent = "Members & pending invitations";
      const memberList = document.createElement("div");
      members.append(summary, memberList);
      members.addEventListener("toggle", () => {
        if (members.open && !memberList.childElementCount) {
          void renderFirmMemberManager(memberList, organization, setFirmStatus);
        }
      });
      const deleteFirmButton = document.createElement("button");
      deleteFirmButton.className =
        "settings-secondary-button settings-destructive-secondary settings-firm-delete";
      deleteFirmButton.type = "button";
      deleteFirmButton.textContent = "Delete Firm Workspace";
      deleteFirmButton.addEventListener("click", async () => {
        const projectCount = organization.projects?.length || 0;
        const projectMessage = projectCount
          ? `${projectCount} firm ${projectCount === 1 ? "Project" : "Projects"} will return to their original owners. `
          : "";
        const confirmed = await confirmWebWarning(
          `Delete ${organization.name}?`,
          `${projectMessage}Members and pending invitations will lose access, and the firm's standards will be deleted. Personal accounts and Project content will remain. This cannot be undone.`,
          { confirmLabel: "Delete Firm" }
        );
        if (!confirmed) return;
        deleteFirmButton.disabled = true;
        try {
          const payload = await postResearch("/organizations/delete", {
            organizationID: organization.id,
            confirmation: "delete"
          });
          const restoredCount = payload.restoredProjectIDs?.length || 0;
          setFirmStatus(
            restoredCount
              ? `${organization.name} deleted. ${restoredCount} ${restoredCount === 1 ? "Project was" : "Projects were"} returned to personal ownership.`
              : `${organization.name} deleted.`
          );
          await refreshOrganizationWorkspaceUI();
        } catch (error) {
          setFirmStatus(error.message || "The firm workspace could not be deleted.", true);
          deleteFirmButton.disabled = false;
        }
      });
      ownerTools.append(
        renderFirmStandardsEditor(organization, setFirmStatus),
        firmControlLabel("Project ownership", transferSelect),
        transferButton,
        inviteForm,
        members,
        deleteFirmButton
      );
      card.append(ownerTools);
    }
    container.append(card);
  }
  const firmStatus = document.createElement("p");
  firmStatus.className = "settings-firm-status";
  firmStatus.setAttribute("role", "status");
  container.append(firmStatus);
}

async function refreshWorkspaceAfterSettingsClear(settingsScrollTop, workspaceScrollLeft) {
  const refreshPaneIDs = activePaneIDs().filter((paneID) => paneID !== "utility:settings");
  await transitionWorkspace("utility", { refreshPaneIDs });
  const settingsPanel = track.querySelector('.workspace-panel[data-pane-id="utility:settings"]');
  if (settingsPanel) settingsPanel.scrollTop = Math.min(
    settingsScrollTop,
    Math.max(0, settingsPanel.scrollHeight - settingsPanel.clientHeight)
  );
  track.scrollLeft = Math.min(
    workspaceScrollLeft,
    Math.max(0, track.scrollWidth - track.clientWidth)
  );
}

function wireSettingsCardCollapsing(panel) {
  panel.querySelectorAll(":scope > .settings-card").forEach((card, index) => {
    const title = card.querySelector(
      ":scope > .settings-section-title, :scope > .settings-card-heading > .settings-section-title"
    );
    if (!title) return;
    const heading = title.closest(".settings-card-heading") || title;
    const cardID = title.id || `settings-card-${index + 1}`;
    const titleText = title.textContent.trim();
    const toggle = document.createElement("button");
    const content = document.createElement("div");
    toggle.className = "settings-card-toggle";
    content.className = "settings-card-content";
    toggle.type = "button";
    const label = document.createElement("span");
    label.textContent = titleText;
    toggle.append(label);
    title.replaceChildren(toggle);
    Array.from(card.children).forEach((child) => {
      if (child !== heading) content.append(child);
    });
    card.append(content);
    card.dataset.settingsCardId = cardID;

    const measureContent = () => {
      if (!card.isConnected) {
        card.style.removeProperty("--settings-card-content-height");
        return;
      }
      card.style.removeProperty("--settings-card-content-height");
      card.style.setProperty("--settings-card-content-height", `${content.scrollHeight}px`);
    };
    const update = ({ animate = true } = {}) => {
      const collapsed = collapsedSettingsCardIDs.has(cardID);
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${titleText}`);
      content.toggleAttribute("inert", collapsed);
      content.setAttribute("aria-hidden", String(collapsed));
      measureContent();
      if (!animate) {
        card.classList.toggle("is-collapsed", collapsed);
        return;
      }
      requestAnimationFrame(() => {
        measureContent();
        card.classList.toggle("is-collapsed", collapsed);
      });
    };
    toggle.addEventListener("click", () => {
      if (collapsedSettingsCardIDs.has(cardID)) collapsedSettingsCardIDs.delete(cardID);
      else collapsedSettingsCardIDs.add(cardID);
      update();
    });
    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(() => {
        if (!collapsedSettingsCardIDs.has(cardID)) measureContent();
      });
      Array.from(content.children).forEach((child) => resizeObserver.observe(child));
    }
    update({ animate: false });
  });
}

function renderSettings() {
  const panel = renderTemplate(settingsTemplate);
  applyPaneWeight(panel, "utility:settings");
  panel.querySelector(".settings-close-button")?.addEventListener("click", () => toggleUtilityPane("settings"));
  wireSettingsSelectControl(panel, ".settings-jurisdiction-select", "Jurisdiction");
  wireSettingsSelectControl(panel, ".settings-version-select", "Version");
  wireReaderFontFamilyControl(panel);

  const jurisdictionSelect = panel.querySelector(".settings-jurisdiction-select");
  const versionSelect = panel.querySelector(".settings-version-select");
  const accountCopy = panel.querySelector(".account-status-copy");
  const planRows = Array.from(panel.querySelectorAll("[data-plan-option]"));
  const planUsage = panel.querySelector(".settings-plan-usage");
  const signInButton = panel.querySelector(".account-sign-in");
  const signOutButton = panel.querySelector(".account-clear");
  const deleteAccountButton = panel.querySelector(".account-delete");
  const checkoutButton = panel.querySelector(".account-checkout");
  const researchCheckoutButton = panel.querySelector(".account-research-checkout");
  const planSecondaryButton = panel.querySelector(".account-plan-secondary");
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
  void renderFirmWorkspaceSettings(panel, settingsProjects, setStatus);

  jurisdictionSelect.value = "jurisdiction-1";
  versionSelect.value = zoningSyncCodeVersion;
  const renderOfflineState = async () => {
    const pro = hasCapability("offline-access");
    const account = activeAccount();
    const library = await offlineLibraryStatus().catch(() => ({ available: false, supported: false }));
    offlineProgress.hidden = true;
    offlineDownload.disabled = false;
    offlineRemove.hidden = !library.available;
    if (!pro) {
      offlineCopy.textContent = `Offline reading is a Pro feature. The complete searchable code library is ${offlineFeatureMetadata.estimatedDownload}.`;
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
    if (
      library.librarySchemaVersion !== offlineFeatureMetadata.librarySchemaVersion ||
      library.assetVersion !== offlineFeatureMetadata.assetVersion
    ) {
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
    const research = hasCapability("research");
    const researchAddOn = currentEntitlement()?.addOns?.research || null;
    const source = currentEntitlement()?.source;
    const canLinkApple = Boolean(account && state.account?.authProvider === "web");
    planRows.forEach((row) => {
      const active = row.dataset.planOption === "free"
        ? !pro
        : pro;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-current", active ? "true" : "false");
      const indicator = row.querySelector(".settings-feature-icon");
      if (indicator) indicator.textContent = active ? "✓" : "";
    });
    checkoutButton.disabled = !account || (pro && source === "lifetimeGrant");
    checkoutButton.classList.toggle("is-pro-active", pro);
    checkoutButton.textContent = pro
      ? source === "lifetimeGrant" ? "Pro Active" : "Manage Subscription"
      : "Upgrade to Pro";
    researchCheckoutButton.hidden = research && !researchAddOn;
    researchCheckoutButton.disabled = !account || !pro;
    researchCheckoutButton.textContent = !pro
      ? "Pro Required for Research"
      : research
        ? researchAddOn ? "Manage Research Add-On" : ""
        : "Add Research";
    planSecondaryButton.hidden = !account || source === "lifetimeGrant";
    planSecondaryButton.textContent = "Restore Purchases";
    accountCopy.hidden = Boolean(account);
    signOutButton.hidden = !account;
    deleteAccountButton.hidden = !account;
    signInButton.hidden = Boolean(account) && !canLinkApple;
    signInButton.textContent = canLinkApple ? "Link Apple" : "Sign in";
    accountCopy.textContent = "Sign in to sync saved sections, notes, and Projects across your devices.";
    renderPlanUsageRows(planUsage);
    void renderOfflineState();
  };

  syncAccountState();
  wireSettingsCardCollapsing(panel);
  if (activeAccount() && hasCapability("research") && !researchUsage) {
    void postResearch("/research/usage")
      .then((payload) => {
        researchUsage = payload.usage || null;
        if (panel.isConnected) renderPlanUsageRows(planUsage);
      })
      .catch(() => {
        if (!panel.isConnected || !planUsage) return;
        const researchRow = Array.from(planUsage.querySelectorAll("p"))
          .find((row) => row.querySelector("span")?.textContent === "Research");
        if (researchRow?.querySelector("strong")) {
          researchRow.querySelector("strong").textContent = "Allowance unavailable";
        }
      });
  }
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
      organizationWorkspace = null;
      organizationLoadPromise = null;
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
    if (account) {
      const pending = (state.syncOutbox || []).filter((item) => item.accountUserID === account.userID).length;
      const conflicts = (state.syncConflicts || []).filter((item) => item.accountUserID === account.userID).length;
      if (pending > 0 || conflicts > 0) {
        const details = [
          pending > 0 ? `${pending} ${pending === 1 ? "change is" : "changes are"} waiting to sync` : "",
          conflicts > 0 ? `${conflicts} sync ${conflicts === 1 ? "conflict needs" : "conflicts need"} review` : ""
        ].filter(Boolean).join(", and ");
        const confirmed = await confirmWebWarning(
          "Sign out with unfinished sync?",
          `${details}. This work will remain on this device and can resume when you sign back in to this account.`,
          { confirmLabel: "Sign Out" }
        );
        if (!confirmed) return;
      }
    }
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
      organizationWorkspace = null;
      organizationLoadPromise = null;
      persistAccountSession(null);
      syncedContent = null;
      stopForegroundSyncLoop();
      saveWorkspaceState();
      await renderWorkspace();
    }
  });
  deleteAccountButton.addEventListener("click", async () => {
    const account = activeAccount();
    if (!account) return;
    const entitlement = currentEntitlement();
    const appleManaged = [
      entitlement?.source,
      ...Object.values(entitlement?.addOns || {}).map((addOn) => addOn?.source)
    ].some((source) => ["appleSubscription", "subscription"].includes(source));
    const stripeManaged = [
      entitlement?.source,
      ...Object.values(entitlement?.addOns || {}).map((addOn) => addOn?.source)
    ].some((source) => source === "webSubscription");
    const lifetimeGrant = entitlement?.source === "lifetimeGrant";
    const billingMessage = appleManaged && stripeManaged
      ? "Permitext will cancel your Stripe subscription first. Apple billing cannot be canceled by Permitext, so manage your Apple subscription before deleting or Apple may continue charging you."
      : appleManaged
        ? "Apple billing cannot be canceled by Permitext. Manage your Apple subscription before deleting, or Apple may continue charging you."
      : stripeManaged
        ? "Permitext will cancel your Stripe subscription before deleting anything. If Stripe cannot confirm cancellation, your account and data will not be deleted."
        : lifetimeGrant
          ? "This account has a lifetime grant and no recurring Permitext subscription. Deleting it permanently removes the grant."
          : "No recurring Permitext subscription is linked to this account.";
    const confirmed = await confirmWebWarning(
      "Delete Permitext account?",
      `${billingMessage} This permanently deletes your Permitext account, synced saved work, Research history, private Workboard images and reports, and any firm workspace you own. This cannot be undone.`,
      { confirmLabel: "Delete Account" }
    );
    if (!confirmed) return;

    deleteAccountButton.disabled = true;
    setStatus("Deleting your account and synced data...");
    try {
      await postJSON(
        "/account/delete",
        {
          auth: { accountUserID: account.userID },
          confirmation: "DELETE"
        },
        { token: account.sessionToken }
      );

      const localProjectIDs = new Set([
        ...(currentContentSummary().projects || []).map((project) => workboardProjectID(projectIdentity(project))),
        ...(state.localProjects || []).map((project) => workboardProjectID(projectIdentity(project)))
      ].filter(Boolean));
      for (const projectID of localProjectIDs) {
        await deleteLocalWorkboard(projectID).catch(() => {});
      }
      await disableOfflineFeature().catch(() => {});
      state.account = null;
      state.localProjects = [];
      state.localSavedItems = [];
      state.localProjectSections = [];
      state.localAnnotations = [];
      state.localBulkClears = [];
      state.syncOutbox = [];
      state.syncConflicts = [];
      state.archivedProjectIDs = [];
      state.sectionNotes = {};
      state.localSavedSectionIDs = [];
      state.recentSearches = [];
      state.recentSearchHistory = [];
      state.pinnedSearches = [];
      state.recentlyViewedSections = [];
      state.continuityAppliedAt = null;
      setOpenProjectDetails([]);
      state.workboards = [];
      state.notebooks = [];
      state.reportDrafts = [];
      syncedContent = null;
      organizationWorkspace = null;
      organizationLoadPromise = null;
      researchConversationList = [];
      activeResearchConversation = null;
      researchUsage = null;
      persistAccountSession(null);
      stopForegroundSyncLoop();
      Object.keys(localStorage)
        .filter((key) =>
          key.startsWith(`${baseWorkspaceKey}:detached:`) ||
          key.startsWith(workspaceStateKeyPrefix)
        )
        .forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem(workspaceRegistryKey);
      sessionStorage.removeItem(tabWorkspaceKey);
      sessionStorage.removeItem(activeWorkspaceSessionKey);
      workspaceRegistry = normalizeWorkspaceRegistry(null);
      activeWorkspaceID = workspaceRegistry.activeWorkspaceID;
      applyStoredWorkspaceLayout(emptyWorkspaceLayout());
      saveWorkspaceState();
      await renderWorkspace();
    } catch (error) {
      setStatus(error.message || "Could not delete this account.", true);
      deleteAccountButton.disabled = false;
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
      const payload = await postJSON(
        "/billing/web/checkout",
        {
          auth: { accountUserID: account.userID },
          packageID: "pro"
        },
        { token: account.sessionToken }
      );
      if (!payload.url) throw new Error("Checkout did not return a URL.");
      window.location.href = payload.url;
    } catch (error) {
      setStatus(error.message || "Could not open checkout.", true);
      checkoutButton.disabled = false;
    }
  });
  researchCheckoutButton.addEventListener("click", async () => {
    const account = activeAccount();
    if (!account) return;
    if (!isProAccount()) {
      void presentPlanLimitNotice(
        "Research requires Pro",
        "Upgrade to Pro first, then add selected-evidence Research."
      );
      return;
    }
    const researchAddOn = currentEntitlement()?.addOns?.research || null;
    if (hasCapability("research")) {
      if (!researchAddOn) return;
      const source = researchAddOn.source;
      if (source === "appleSubscription") {
        window.location.href = "https://apps.apple.com/account/subscriptions";
        return;
      }
      researchCheckoutButton.disabled = true;
      setStatus("Opening Research subscription management...");
      try {
        const payload = await postJSON(
          "/billing/web/portal",
          { auth: { accountUserID: account.userID } },
          { token: account.sessionToken }
        );
        if (!payload.url) throw new Error("Subscription management did not return a URL.");
        window.location.href = payload.url;
      } catch (error) {
        setStatus(error.message || "Could not open subscription management.", true);
        researchCheckoutButton.disabled = false;
      }
      return;
    }
    researchCheckoutButton.disabled = true;
    setStatus("Opening Research checkout...");
    try {
      const payload = await postJSON(
        "/billing/web/checkout",
        {
          auth: { accountUserID: account.userID },
          packageID: "research"
        },
        { token: account.sessionToken }
      );
      if (!payload.url) throw new Error("Checkout did not return a URL.");
      window.location.href = payload.url;
    } catch (error) {
      setStatus(error.message || "Could not open Research checkout.", true);
      researchCheckoutButton.disabled = false;
    }
  });
  planSecondaryButton.addEventListener("click", async () => {
    const account = activeAccount();
    if (!account) return;
    planSecondaryButton.disabled = true;
    const restored = await openStripeRestoreDialog(async (restoreID) => {
      const payload = await postJSON(
        "/billing/stripe/restore",
        {
          auth: { accountUserID: account.userID },
          restoreID
        },
        { token: account.sessionToken }
      );
      storeAccountEntitlement(payload.entitlement || null);
    });
    if (restored) {
      await renderWorkspace();
      return;
    }
    planSecondaryButton.disabled = false;
  });
  offlineDownload.addEventListener("click", async () => {
    const account = activeAccount();
    if (!account) {
      signInButton.click();
      return;
    }
    if (!hasCapability("offline-access")) {
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
      if (!hasCapability("offline-access")) {
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
    searches: ["Clear recent searches", "This will remove recent search history and Recently Viewed sections from this browser. Pinned searches will remain. Are you sure?"],
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
      const settingsScrollTop = panel.scrollTop;
      const workspaceScrollLeft = track.scrollLeft;
      button.disabled = true;
      try {
        const count = await performSettingsClearAction(action);
        setStatus(action === "searches" ? "Recent searches cleared." : `${count} ${action} cleared.`);
        await refreshWorkspaceAfterSettingsClear(settingsScrollTop, workspaceScrollLeft);
      } catch (error) {
        setStatus(error.message || `Could not clear ${action}.`, true);
        button.disabled = false;
      }
    });
  });
  return panel;
}

function setSettingsInlineControlOpen(toggle, options, open, label) {
  const optionsInner = options.querySelector(".settings-inline-select-options-inner");
  if (optionsInner) {
    options.style.setProperty("--settings-inline-options-height", `${optionsInner.scrollHeight}px`);
  }
  options.classList.toggle("is-open", open);
  options.setAttribute("aria-hidden", String(!open));
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", `${open ? "Collapse" : "Expand"} ${label}`);
  options.querySelectorAll('button[role="option"]').forEach((button) => {
    button.tabIndex = open ? 0 : -1;
  });
}

function wireSettingsSelectControl(panel, selector, label) {
  const select = panel.querySelector(selector);
  const control = select?.closest(".settings-inline-select-control");
  const toggle = control?.querySelector(".settings-inline-select-toggle");
  const valueLabel = control?.querySelector(".settings-inline-select-value");
  const options = control?.querySelector(".settings-inline-select-options");
  const optionsInner = options?.querySelector(".settings-inline-select-options-inner");
  if (!select || !toggle || !valueLabel || !options || !optionsInner) return;

  const close = () => setSettingsInlineControlOpen(toggle, options, false, label);
  const syncControl = () => {
    const selectedOption = select.options[select.selectedIndex];
    valueLabel.textContent = selectedOption?.textContent || "";
    optionsInner.querySelectorAll('button[role="option"]').forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.value === select.value));
    });
  };
  const renderOptions = () => {
    optionsInner.replaceChildren();
    Array.from(select.options).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.dataset.value = option.value;
      button.textContent = option.textContent;
      button.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncControl();
        close();
        toggle.focus();
      });
      optionsInner.append(button);
    });
    syncControl();
    close();
  };

  toggle.addEventListener("click", () => {
    setSettingsInlineControlOpen(toggle, options, !options.classList.contains("is-open"), label);
  });
  select.addEventListener("change", syncControl);
  renderOptions();
}

function wireReaderFontFamilyControl(panel) {
  const toggle = panel.querySelector(".settings-font-family-toggle");
  const valueLabel = panel.querySelector(".settings-font-family-value");
  const options = panel.querySelector(".settings-font-family-options");
  const optionButtons = Array.from(panel.querySelectorAll("[data-reader-font-family]"));

  const syncControl = () => {
    state.readerSettings = normalizeReaderSettings(state.readerSettings);
    const selectedButton = optionButtons.find(
      (button) => button.dataset.readerFontFamily === state.readerSettings.fontFamily
    );
    if (valueLabel) valueLabel.textContent = selectedButton?.textContent || "System";
    optionButtons.forEach((button) => {
      button.setAttribute(
        "aria-selected",
        String(button.dataset.readerFontFamily === state.readerSettings.fontFamily)
      );
    });
    applyReaderSettings();
  };

  syncControl();
  setSettingsInlineControlOpen(toggle, options, false, "Reader Font");

  toggle?.addEventListener("click", () => {
    setSettingsInlineControlOpen(
      toggle,
      options,
      !options.classList.contains("is-open"),
      "Reader Font"
    );
  });

  optionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.readerSettings.fontFamily = button.dataset.readerFontFamily || "system";
      syncControl();
      saveWorkspaceState();
      setSettingsInlineControlOpen(toggle, options, false, "Reader Font");
      toggle?.focus();
    });
  });
}

function createDivider(previousPaneID, nextPaneID) {
  const isLeftEdge = !previousPaneID && Boolean(nextPaneID);
  const isRightEdge = Boolean(previousPaneID) && !nextPaneID;
  const edgePaneID = isLeftEdge ? nextPaneID : previousPaneID;
  const divider = document.createElement("div");
  divider.className = "pane-divider";
  if (isLeftEdge || isRightEdge) {
    divider.classList.add(
      "pane-edge-resizer",
      isLeftEdge ? "pane-left-edge-resizer" : "pane-right-edge-resizer"
    );
  }
  divider.dataset.previousPaneId = previousPaneID || "";
  divider.dataset.nextPaneId = nextPaneID || "";
  divider.role = "separator";
  divider.tabIndex = 0;
  divider.setAttribute("aria-orientation", "vertical");
  divider.setAttribute(
    "aria-label",
    isLeftEdge
      ? "Resize left edge of first column"
      : isRightEdge
        ? "Resize right edge of last column"
        : "Resize adjacent columns"
  );
  if (isLeftEdge || isRightEdge) {
    divider.setAttribute("aria-valuemin", String(Math.round(defaultPaneWidthForID(edgePaneID))));
    divider.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const step = event.shiftKey ? 80 : 24;
      const growsPane = isLeftEdge ? event.key === "ArrowLeft" : event.key === "ArrowRight";
      resizePaneEdgeBy(edgePaneID, growsPane ? step : -step, divider);
    });
  }
  divider.addEventListener("pointerdown", (event) => {
    if (previousPaneID && nextPaneID) startPaneResize(event, previousPaneID, nextPaneID);
    else startPaneEdgeResize(event, edgePaneID, isLeftEdge ? "left" : "right");
  });
  divider.addEventListener("dblclick", () => {
    if (isLeftEdge || isRightEdge) resetDividerPanes(edgePaneID, null);
    else resetDividerPanes(previousPaneID, nextPaneID);
  });
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
  if (paneID === "utility:analysis" || paneID.startsWith("research:conversation:")) {
    return ["utility:analysis", paneIDForResearchConversation()].filter((id) => active.has(id));
  }
  if (
    paneID === primarySavedPaneID() ||
    isProjectDetailPaneID(paneID) ||
    isProjectNotebookPaneID(paneID) ||
    isProjectReportDraftPaneID(paneID) ||
    isProjectWorkboardPaneID(paneID)
  ) {
    return [
      primarySavedPaneID(),
      ...openProjectDetails().flatMap(projectWorkspacePaneIDs),
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
    scheduleVisibleReaderScrollIndicatorUpdates();
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

function resizePaneEdgeBy(paneID, delta, resizeHandle = null) {
  const pane = track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`);
  if (!pane) return;
  const minWidth = defaultPaneWidthForID(paneID);
  const currentWidth = pane.getBoundingClientRect().width;
  const nextWidth = Math.max(minWidth, currentWidth + delta);
  state.paneWeights[paneID] = nextWidth;
  applyPaneWeight(pane, paneID);
  resizeHandle?.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
  notifyWorkspaceLayoutChange();
  saveWorkspaceState();
}

function startPaneEdgeResize(event, paneID, edgeSide = "right") {
  const pane = track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`);
  if (!pane) return;

  event.preventDefault();
  const resizeHandle = event.currentTarget;
  resizeHandle?.setPointerCapture?.(event.pointerId);
  track.classList.add("is-resizing");
  const startX = event.clientX;
  const startWidth = pane.getBoundingClientRect().width;
  const minWidth = defaultPaneWidthForID(paneID);
  const edgeAutoResizeThreshold = 32;
  const edgeAutoResizeMaxSpeed = 640;
  let pointerClientX = startX;
  let virtualClientX = startX;
  let resizeFrame = null;
  let previousFrameTime = null;
  let lastAppliedWidth = startWidth;
  let isDragging = true;

  const applyResizeAt = (clientX) => {
    const direction = edgeSide === "left" ? -1 : 1;
    const nextWidth = Math.max(minWidth, startWidth + direction * (clientX - startX));
    if (Math.abs(nextWidth - lastAppliedWidth) < 0.25) return;
    state.paneWeights[paneID] = nextWidth;
    applyPaneWeight(pane, paneID);
    resizeHandle?.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
    lastAppliedWidth = nextWidth;
    if (edgeSide === "right") {
      const handleRect = resizeHandle.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      const overflow = handleRect.right - trackRect.right;
      if (overflow > 0) track.scrollLeft = Math.min(track.scrollLeft + overflow, track.scrollWidth - track.clientWidth);
    }
    scheduleVisibleReaderScrollIndicatorUpdates();
  };

  const edgeResizeVelocity = () => {
    const trackRect = track.getBoundingClientRect();
    if (edgeSide === "left") {
      const visibleLeft = Math.max(trackRect.left, 0) + 1;
      const edgeEnd = visibleLeft + edgeAutoResizeThreshold;
      if (pointerClientX >= edgeEnd) return 0;
      const proximity = Math.min(1, Math.max(0, (edgeEnd - pointerClientX) / edgeAutoResizeThreshold));
      return -edgeAutoResizeMaxSpeed * proximity;
    }
    const visibleRight = Math.min(trackRect.right, window.innerWidth) - 1;
    const edgeStart = visibleRight - edgeAutoResizeThreshold;
    if (pointerClientX <= edgeStart) return 0;
    const proximity = Math.min(1, Math.max(0, (pointerClientX - edgeStart) / edgeAutoResizeThreshold));
    return edgeAutoResizeMaxSpeed * proximity;
  };

  const applyPendingResize = (frameTime) => {
    resizeFrame = null;
    if (!isDragging) return;
    const elapsed = previousFrameTime === null
      ? 0
      : Math.min(32, Math.max(0, frameTime - previousFrameTime));
    previousFrameTime = frameTime;
    const velocity = edgeResizeVelocity();
    if (velocity !== 0 && elapsed > 0) {
      virtualClientX += velocity * elapsed / 1000;
    }
    applyResizeAt(virtualClientX);
    if (velocity !== 0) resizeFrame = window.requestAnimationFrame(applyPendingResize);
  };

  const onMove = (moveEvent) => {
    const nextPointerClientX = moveEvent.clientX;
    virtualClientX += nextPointerClientX - pointerClientX;
    pointerClientX = nextPointerClientX;
    if (resizeFrame === null) resizeFrame = window.requestAnimationFrame(applyPendingResize);
  };

  const onUp = (upEvent) => {
    isDragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    if (Number.isFinite(upEvent.clientX)) {
      virtualClientX += upEvent.clientX - pointerClientX;
      pointerClientX = upEvent.clientX;
    }
    applyResizeAt(virtualClientX);
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
  cleanupInactiveReportDraftMounts(orderedPanes);
  bindPaneDragging(orderedPanes);
  if (orderedPanes.length) {
    const firstPaneID = orderedPanes[0].dataset.paneId;
    nodes.push(existingDividers.get(dividerKey("", firstPaneID)) || createDivider("", firstPaneID));
  }
  orderedPanes.forEach((pane, index) => {
    if (index > 0) {
      const previousPaneID = orderedPanes[index - 1].dataset.paneId;
      const nextPaneID = pane.dataset.paneId;
      nodes.push(existingDividers.get(dividerKey(previousPaneID, nextPaneID)) || createDivider(previousPaneID, nextPaneID));
    }
    nodes.push(pane);
  });
  if (orderedPanes.length) {
    const lastPaneID = orderedPanes.at(-1).dataset.paneId;
    const edgeResizer = existingDividers.get(dividerKey(lastPaneID, "")) || createDivider(lastPaneID, "");
    nodes.push(edgeResizer);
  }
  if (!orderedPanes.length && !detachedProjectWindow) {
    const emptyState = track.querySelector(":scope > .workspace-empty-state") || document.createElement("section");
    emptyState.className = "workspace-empty-state";
    emptyState.setAttribute("aria-label", "Empty workspace");
    if (!emptyState.firstElementChild) {
      const message = document.createElement("p");
      message.textContent = "Open a Reader, Search, Saved, or a Project to begin.";
      emptyState.append(message);
    }
    nodes.push(emptyState);
  }
  const desiredNodes = new Set(nodes);
  Array.from(track.children).forEach((node) => {
    if (!desiredNodes.has(node)) node.remove();
  });
  nodes.forEach((node, index) => {
    const currentNode = track.children[index] || null;
    if (currentNode !== node) track.insertBefore(node, currentNode);
  });
  const leftEdgeResizer = track.querySelector(":scope > .pane-left-edge-resizer");
  const rightEdgeResizer = track.querySelector(":scope > .pane-right-edge-resizer");
  const firstPane = orderedPanes[0];
  const lastPane = orderedPanes.at(-1);
  if (leftEdgeResizer && firstPane) {
    leftEdgeResizer.setAttribute("aria-valuenow", String(Math.round(firstPane.getBoundingClientRect().width)));
  }
  if (rightEdgeResizer && lastPane) {
    rightEdgeResizer.setAttribute("aria-valuenow", String(Math.round(lastPane.getBoundingClientRect().width)));
  }
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

function readerContentScrollKey(reader) {
  return [
    reader?.codePrefix || "BC",
    reader?.chapterID || "",
    reader?.sectionID || ""
  ].join(":");
}

function captureReaderScrollPositions() {
  const positions = new Map();
  track.querySelectorAll('.workspace-panel[data-pane-id^="reader:"]').forEach((panel) => {
    const content = panel.querySelector(".reader-content");
    const contentKey = panel.dataset.readerContentKey || "";
    if (!content || !contentKey) return;
    positions.set(panel.dataset.paneId, {
      contentKey,
      scrollTop: content.scrollTop
    });
  });
  return positions;
}

function restoreReaderScrollPositions(positions) {
  if (!positions?.size) return;
  const restore = () => {
    positions.forEach((position, paneID) => {
      const panel = track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`);
      const content = panel?.querySelector(".reader-content");
      if (
        !content ||
        panel.dataset.readerContentKey !== position.contentKey
      ) {
        return;
      }
      const scrollTop = Math.min(
        position.scrollTop,
        Math.max(0, content.scrollHeight - content.clientHeight)
      );
      content.scrollTop = scrollTop;
      const comments = panel.querySelector(".reader-comments");
      if (comments) comments.scrollTop = scrollTop;
      updateReaderScrollIndicator(panel);
    });
  };
  restore();
  requestAnimationFrame(restore);
}

async function renderWorkspace() {
  const readerScrollPositions = suppressReaderScrollRestore ? new Map() : captureReaderScrollPositions();
  await ensureSyncedContentForRender();
  enforceReaderPlanLimit();
  updateReaderPlanControls();
  renderWorkspaceTabs();
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
    if (projectHasOpenReportDraft(detail)) panes.push(await renderProjectReportDraft(detail));
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
  restoreReaderScrollPositions(readerScrollPositions);
  syncAllCommentBoxHeights();
  bindAllReaderCommentScroll();
  enhanceReaderSelects();
  saveWorkspaceState();
}

async function renderUtilityWorkspace(options = {}) {
  enforceReaderPlanLimit();
  updateReaderPlanControls();
  renderWorkspaceTabs();
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
    if (projectHasOpenReportDraft(detail)) {
      const reportDraftID = paneIDForProjectReportDraft(detail);
      panes.push(await reuseOrRenderPane(reportDraftID, () => renderProjectReportDraft(detail)));
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
    if (closeButton) closeButton.hidden = false;
    if (pane) panes.push(pane);
  }

  appendPaneSequence(panes);
  syncAllCommentBoxHeights();
  bindAllReaderCommentScroll();
  enhanceReaderSelects();
  if (options.deferStateSave) {
    scheduleWorkspaceStateSaveAfterPaint();
  } else {
    saveWorkspaceState();
  }
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
    if (key === "search") {
      await transitionWorkspace("utility", { deferStateSave: true });
    } else {
      saveWorkspaceState();
      await transitionWorkspace("utility");
    }
    track.scrollTo({ left: 0, behavior: key === "search" ? "auto" : "smooth" });
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
      delete state.paneWeights[paneIDForProjectReportDraft(detail)];
    });
    delete state.paneWeights["utility:archive"];
    state.paneOrder = (state.paneOrder || []).filter((id) =>
      id !== paneID &&
      !isProjectDetailPaneID(id) &&
      !isProjectNotebookPaneID(id) &&
      !isProjectReportDraftPaneID(id) &&
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
  if (key === "archive") syncSavedArchiveButtonStates();
  saveWorkspaceState();
  await transitionWorkspace("utility");
  if (willOpen) {
    track.scrollTo({ left: 0, behavior: "smooth" });
  }
}

async function fitVisibleColumns() {
  state.paneOrder = [];
  const paneIDs = activePaneIDs();
  state.paneWeights = paneIDs.reduce((weights, paneID) => {
    weights[paneID] = defaultPaneWidthForID(paneID);
    return weights;
  }, {});
  saveWorkspaceState();
  await transitionWorkspace("utility");
  track.scrollTo({ left: 0, behavior: "smooth" });
}

async function closeAllColumns() {
  if (!(await confirmWorkspaceTransition())) return false;
  state.readers = [];
  state.searchResultReader = null;
  state.sectionDetail = null;
  state.sectionDetails = {};
  state.sectionDetailAnchors = {};
  state.searchLinkedReaders = {};
  setOpenProjectDetails([]);
  state.workboards = [];
  state.notebooks = [];
  state.reportDrafts = [];
  Object.keys(state.utilities).forEach((key) => {
    state.utilities[key] = false;
  });
  state.utilityInstances = [];
  state.researchConversationID = "";
  activeResearchConversation = null;
  state.paneOrder = [];
  state.paneWeights = {};
  state.trackScrollLeft = 0;
  saveWorkspaceState();
  await transitionWorkspace("utility");
  track.scrollTo({ left: 0, behavior: "smooth" });
  return true;
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
    ...(isProAccount() || state.readers.length < 2
      ? [{ label: "Add Reader", hint: "Open another code column", run: () => addReaderButton.click() }]
      : []),
    { label: "Open ZR Reader", hint: "Open the dedicated Zoning Resolution column", run: () => addZoningReaderButton.click() },
    { label: "Open Saved and Projects", hint: "Review saved work and organize projects", run: () => focusUtility("saved") },
    { label: "Open AI-assisted Research", hint: "Analyze the active official sections", run: () => focusUtility("analysis") },
    { label: "Open Settings", hint: "Code library, account, sync, and privacy", run: () => focusUtility("settings") },
    { label: "Reset Columns", hint: "Restore the current workspace order and widths", run: () => fitVisibleColumns() },
    ...(defaultActivePaneIDs().length
      ? [{ label: "Close All", hint: "Close every column in the current workspace", run: () => closeAllColumns() }]
      : [])
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
    if (event.key === "Escape") {
      if (workspaceContextMenu) {
        event.preventDefault();
        closeWorkspaceContextMenu();
        workspaceActionsButton?.focus();
        return;
      }
      const openTrust = document.querySelector(".reader-trust[open]");
      if (openTrust) {
        event.preventDefault();
        openTrust.open = false;
        openTrust.querySelector("summary")?.focus();
        return;
      }
    }
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
  });
}

function bindImmediateUtilityControls() {
  if (toggleSearchButton.dataset.coldStartBound !== "true") {
    toggleSearchButton.dataset.coldStartBound = "true";
    toggleSearchButton.addEventListener("click", () => {
      void focusUtility("search", ".search-input");
    });
  }
  if (toggleSavedButton.dataset.coldStartBound === "true") return;
  toggleSavedButton.dataset.coldStartBound = "true";
  toggleSavedButton.addEventListener("click", () => {
    void focusUtility("saved");
  });
}

async function start() {
  if (detachedWorkboardRoute && !detachedProjectWindow) {
    throw new Error("This detached Workboard session expired. Close this window and detach the Workboard again.");
  }
  if (!detachedProjectWindow) {
    bindToolbarReordering();
    bindImmediateUtilityControls();
    const [chapterPayload, libraryPayload] = await Promise.all([
      api("/code/chapters"),
      api("/code/libraries")
    ]);
    chapters = chapterPayload.chapters || [];
    codeTrustProfiles = libraryPayload.codeTrustProfiles || [];
  }
  updateConnectionStatus();
  document.addEventListener("click", (event) => {
    if (
      activeCustomSelect &&
      !activeCustomSelect.custom.contains(event.target) &&
      !activeCustomSelect.menu.contains(event.target)
    ) {
      closeActiveCustomSelect();
    }
    document.querySelectorAll(".reader-trust[open]").forEach((trust) => {
      if (!trust.contains(event.target)) trust.open = false;
    });
    if (
      workspaceContextMenu &&
      !workspaceContextMenu.contains(event.target) &&
      !event.target.closest(".workspace-tab, .workspace-actions-button")
    ) {
      closeWorkspaceContextMenu();
    }
  });
  window.addEventListener("resize", repositionActiveCustomSelect);
  window.addEventListener("resize", scheduleVisibleReaderScrollIndicatorUpdates, { passive: true });
  track.addEventListener("permitext:workspace-layout-change", scheduleVisibleReaderScrollIndicatorUpdates);
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
    if (!detachedProjectWindow && event.key === workspaceRegistryKey && event.newValue) {
      try {
        const nextRegistry = normalizeWorkspaceRegistry(JSON.parse(event.newValue), {
          activeWorkspaceID
        });
        const activeStillExists = nextRegistry.workspaces.some((workspace) => workspace.id === activeWorkspaceID);
        workspaceRegistry = nextRegistry;
        if (activeStillExists) {
          workspaceRegistry.activeWorkspaceID = activeWorkspaceID;
          renderWorkspaceTabs();
        } else {
          void switchWorkspace(nextRegistry.activeWorkspaceID);
        }
      } catch {
        // Ignore malformed registry updates from another tab.
      }
    }
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
    void flushPendingNotebookImages();
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
  bindHorizontalWheelScroll(track);
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
    if (!isProAccount() && state.readers.length >= 2) {
      enforceReaderPlanLimit();
      await transitionWorkspace("utility");
      return;
    }
    const reader = newReaderState({ chapterID: await firstChapterIDForCode("BC") });
    state.readers.push(reader);
    saveWorkspaceState();
    await transitionWorkspace("utility");
    scrollPaneIntoView(paneIDForReader(reader));
  });
  addZoningReaderButton.addEventListener("click", async () => {
    const existingReader = state.readers.find((reader) => reader.codePrefix === zoningCodePrefix);
    if (existingReader) {
      scrollPaneIntoView(paneIDForReader(existingReader));
      return;
    }
    const chapterID = await firstChapterIDForCode(zoningCodePrefix);
    if (!isProAccount() && state.readers.length >= 2) {
      const replacementReader = state.readers[state.readers.length - 1];
      Object.entries(searchLinkedReadersBySearch()).forEach(([searchID, readerID]) => {
        if (readerID === replacementReader.id) delete state.searchLinkedReaders[searchID];
      });
      delete replacementReader.projectSavedSourceKey;
      Object.assign(replacementReader, {
        codePrefix: zoningCodePrefix,
        codeVersion: zoningSyncCodeVersion,
        chapterID,
        sectionID: "",
        sectionNumber: "",
        title: "Reader",
        commentsOpen: false,
        internalSearchQuery: "",
        activeNotesSectionID: "",
        shouldSmoothScrollToSection: false
      });
      saveWorkspaceState();
      await transitionWorkspace("utility", {
        refreshPaneIDs: [paneIDForReader(replacementReader)]
      });
      scrollPaneIntoView(paneIDForReader(replacementReader));
      return;
    }
    const reader = newReaderState({
      codePrefix: zoningCodePrefix,
      codeVersion: zoningSyncCodeVersion,
      chapterID
    });
    state.readers.push(reader);
    saveWorkspaceState();
    await transitionWorkspace("utility");
    scrollPaneIntoView(paneIDForReader(reader));
  });
  toggleArchiveButton?.addEventListener("click", () => {
    toggleUtilityPane("archive");
  });
  toggleAnalysisButton.addEventListener("click", () => {
    focusUtility("analysis");
  });
  toggleSettingsButton.addEventListener("click", () => {
    focusUtility("settings");
  });
  addWorkspaceButton?.addEventListener("click", () => {
    void createNewWorkspace();
  });
  workspaceActionsButton?.addEventListener("click", () => {
    if (workspaceContextMenu) {
      closeWorkspaceContextMenu();
      return;
    }
    openWorkspaceContextMenu(activeWorkspaceID, workspaceActionsButton);
  });
  fitColumnsButton.addEventListener("click", () => {
    fitVisibleColumns();
  });
  collapseReadersButton.addEventListener("click", () => {
    closeAllColumns();
  });
  const deepLinkedSectionID = deepLinkedSectionIDFromLocation();
  consumeBrowserSectionURL();
  if (organizationInvitationTokenFromURL()) {
    state.utilities.settings = true;
    saveWorkspaceState();
  }
  await renderWorkspace();
  track.scrollLeft = Math.min(
    Number(state.trackScrollLeft) || 0,
    Math.max(0, track.scrollWidth - track.clientWidth)
  );
  if (deepLinkedSectionID) {
    try {
      const payload = await api(`/code/sections/${deepLinkedSectionID}`);
      await openDeepLinkedSectionInReader(payload.section);
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
