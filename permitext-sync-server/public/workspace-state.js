const workspaceRegistryVersion = 2;
const defaultWorkspaceName = "Main";
const maximumWorkspaceNameLength = 40;

export const workspaceLayoutStateKeys = Object.freeze([
  "readers",
  "searchQuery",
  "searchCodeFilters",
  "searchLinkedReaders",
  "sectionDetails",
  "sectionDetailAnchors",
  "projectDetail",
  "projectDetails",
  "projectHostPaneID",
  "utilityInstances",
  "utilities",
  "paneWeights",
  "paneOrder",
  "researchConversationID",
  "workboards",
  "notebooks",
  "reportDrafts",
  "coordinations",
  "coordinationThreads",
  "coordinationFilters",
  "trackScrollLeft",
  "codeQuestionWorkspace"
]);

function copy(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function projectIdentityValues(project) {
  return [project?.id, project?.clientID, project?.localFolderID]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String);
}

function projectRecordsMatch(left, right) {
  const leftIDs = projectIdentityValues(left);
  const rightIDs = projectIdentityValues(right);
  if (leftIDs.length && rightIDs.length) {
    return leftIDs.some((id) => rightIDs.includes(id));
  }
  const leftName = String(left?.name || left?.title || "").trim();
  const rightName = String(right?.name || right?.title || "").trim();
  return Boolean(leftName && rightName && leftName === rightName);
}

function activeProjectToolState(records, activeProject) {
  if (!activeProject || !Array.isArray(records)) return [];
  return records.some((record) => projectRecordsMatch(record, activeProject))
    ? [copy(activeProject)]
    : [];
}

function cleanWorkspaceName(value, fallback = defaultWorkspaceName) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  return (name || fallback).slice(0, maximumWorkspaceNameLength);
}

function utilityState(value = {}) {
  return {
    projects: Boolean(value.projects),
    archive: Boolean(value.archive),
    search: Boolean(value.search),
    saved: Boolean(value.saved),
    analysis: Boolean(value.analysis),
    settings: Boolean(value.settings)
  };
}

function emptyCodeQuestionWorkspaceLayout() {
  return {
    activeQuestionID: "",
    activeStage: "define",
    openPanes: [],
    questionIndexOpen: true,
    moreMenuOpen: false,
    questionsByProjectID: {},
    definitionsByQuestionID: {},
    questionFilters: {
      query: "",
      recordState: "active",
      includeArchived: false
    },
    deepLink: null
  };
}

function normalizeCodeQuestionOpenPane(value) {
  if (!value || typeof value !== "object") return null;
  const projectID = String(value.projectID || "").trim();
  const questionID = String(value.questionID || "_").trim() || "_";
  const paneRole = String(value.paneRole || "").trim();
  if (!projectID || !paneRole) return null;
  const paneID = typeof value.paneID === "string" && value.paneID.startsWith("cq:")
    ? value.paneID
    : `cq:${projectID}:${questionID}:${paneRole}`;
  return { projectID, questionID, paneRole, paneID };
}

function normalizeCodeQuestionWorkspaceLayout(value = {}, activeProject = null) {
  const source = value && typeof value === "object" ? value : {};
  const layout = emptyCodeQuestionWorkspaceLayout();
  const activeProjectID = String(
    activeProject?.id || activeProject?.clientID || activeProject?.localFolderID || ""
  ).trim();
  const stages = new Set(["define", "evidence", "analyze", "review", "issue"]);
  const stage = String(source.activeStage || "define").trim().toLowerCase();
  layout.activeStage = stages.has(stage) ? stage : "define";
  layout.activeQuestionID = typeof source.activeQuestionID === "string"
    ? source.activeQuestionID.trim()
    : "";
  layout.questionIndexOpen = source.questionIndexOpen !== false;
  layout.moreMenuOpen = source.moreMenuOpen === true;
  layout.questionFilters = {
    query: typeof source.questionFilters?.query === "string" ? source.questionFilters.query : "",
    recordState: ["active", "archived", "all"].includes(source.questionFilters?.recordState)
      ? source.questionFilters.recordState
      : "active",
    includeArchived: source.questionFilters?.includeArchived === true
  };
  let openPanes = (Array.isArray(source.openPanes) ? source.openPanes : [])
    .map(normalizeCodeQuestionOpenPane)
    .filter(Boolean);
  if (activeProjectID) {
    openPanes = openPanes.filter((pane) => pane.projectID === activeProjectID);
  }
  if (layout.activeQuestionID) {
    openPanes = openPanes.filter((pane) =>
      pane.questionID === "_" || pane.questionID === layout.activeQuestionID
    );
  } else {
    openPanes = openPanes.filter((pane) => pane.questionID === "_");
  }
  const seen = new Set();
  layout.openPanes = openPanes.filter((pane) => {
    if (seen.has(pane.paneID)) return false;
    seen.add(pane.paneID);
    return true;
  });
  // Drop orphan cq: pane weights/order is handled by paneOrder filter in normalizeWorkspaceLayout.
  if (source.questionsByProjectID && typeof source.questionsByProjectID === "object") {
    layout.questionsByProjectID = copy(source.questionsByProjectID);
  }
  if (source.definitionsByQuestionID && typeof source.definitionsByQuestionID === "object") {
    layout.definitionsByQuestionID = copy(source.definitionsByQuestionID);
  }
  if (source.deepLink && typeof source.deepLink === "object") {
    layout.deepLink = {
      projectID: String(source.deepLink.projectID || "").trim() || null,
      questionID: String(source.deepLink.questionID || "").trim() || null,
      stage: stages.has(String(source.deepLink.stage || "").trim().toLowerCase())
        ? String(source.deepLink.stage).trim().toLowerCase()
        : null
    };
  }
  return layout;
}

export function emptyWorkspaceLayout() {
  return {
    readers: [],
    searchQuery: "",
    searchCodeFilters: [],
    searchLinkedReaders: {},
    sectionDetails: {},
    sectionDetailAnchors: {},
    projectDetail: null,
    projectDetails: [],
    projectHostPaneID: "",
    utilityInstances: [],
    utilities: utilityState(),
    paneWeights: {},
    paneOrder: [],
    researchConversationID: "",
    workboards: [],
    notebooks: [],
    reportDrafts: [],
    coordinations: [],
    coordinationThreads: [],
    coordinationFilters: {},
    trackScrollLeft: 0,
    codeQuestionWorkspace: emptyCodeQuestionWorkspaceLayout()
  };
}

export function normalizeWorkspaceLayout(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const layout = emptyWorkspaceLayout();
  layout.readers = Array.isArray(source.readers)
    ? copy(source.readers.filter((reader) => reader && typeof reader === "object" && !reader.comparisonManaged))
    : [];
  layout.searchQuery = typeof source.searchQuery === "string" ? source.searchQuery : "";
  layout.searchCodeFilters = Array.isArray(source.searchCodeFilters) ? copy(source.searchCodeFilters) : [];
  layout.searchLinkedReaders = source.searchLinkedReaders && typeof source.searchLinkedReaders === "object"
    ? copy(source.searchLinkedReaders)
    : {};
  layout.sectionDetails = source.sectionDetails && typeof source.sectionDetails === "object"
    ? copy(source.sectionDetails)
    : {};
  layout.sectionDetailAnchors = source.sectionDetailAnchors && typeof source.sectionDetailAnchors === "object"
    ? copy(source.sectionDetailAnchors)
    : {};
  layout.projectDetails = (Array.isArray(source.projectDetails)
    ? source.projectDetails
    : source.projectDetail && typeof source.projectDetail === "object" ? [source.projectDetail] : [])
    .filter((detail) => detail && typeof detail === "object")
    .slice(0, 1)
    .map(copy);
  layout.projectDetail = layout.projectDetails[0] || null;
  layout.utilityInstances = Array.isArray(source.utilityInstances)
    ? copy(source.utilityInstances.filter((instance) => instance && typeof instance === "object"))
    : [];
  const savedPaneIDs = new Set(layout.utilityInstances
    .filter((instance) => instance.key === "saved" && instance.id)
    .map((instance) => `utility:saved:${instance.id}`));
  layout.projectHostPaneID = typeof source.projectHostPaneID === "string" && savedPaneIDs.has(source.projectHostPaneID)
    ? source.projectHostPaneID
    : "";
  layout.utilities = utilityState(source.utilities);
  layout.paneWeights = source.paneWeights && typeof source.paneWeights === "object"
    ? Object.fromEntries(
        Object.entries(source.paneWeights)
          .filter(([paneID, width]) =>
            typeof paneID === "string" &&
            !paneID.startsWith("section:detail:") &&
            Number.isFinite(Number(width)) &&
            Number(width) > 40
          )
          .map(([paneID, width]) => [paneID, Number(width)])
      )
    : {};
  layout.paneOrder = Array.isArray(source.paneOrder)
    ? source.paneOrder.filter((paneID) => typeof paneID === "string" && !paneID.startsWith("section:detail:"))
    : [];
  layout.researchConversationID = typeof source.researchConversationID === "string"
    ? source.researchConversationID
    : "";
  const activeProject = layout.projectDetails[0] || null;
  layout.workboards = activeProjectToolState(source.workboards, activeProject);
  layout.notebooks = activeProjectToolState(source.notebooks, activeProject);
  layout.reportDrafts = activeProjectToolState(source.reportDrafts, activeProject);
  layout.coordinations = activeProjectToolState(source.coordinations, activeProject);
  const coordinationThread = activeProject && layout.coordinations.length && Array.isArray(source.coordinationThreads)
    ? source.coordinationThreads.find((thread) =>
        thread &&
        typeof thread === "object" &&
        typeof thread.threadID === "string" &&
        thread.threadID &&
        projectRecordsMatch(thread, activeProject)
      )
    : null;
  layout.coordinationThreads = coordinationThread
    ? [{ ...copy(activeProject), threadID: coordinationThread.threadID }]
    : [];
  layout.coordinationFilters = source.coordinationFilters && typeof source.coordinationFilters === "object"
    ? Object.fromEntries(
        Object.entries(source.coordinationFilters)
          .filter(([projectID, status]) =>
            typeof projectID === "string" && ["open", "waiting", "resolved"].includes(status)
          )
      )
    : {};
  layout.trackScrollLeft = Number.isFinite(Number(source.trackScrollLeft))
    ? Math.max(0, Number(source.trackScrollLeft))
    : 0;
  layout.codeQuestionWorkspace = normalizeCodeQuestionWorkspaceLayout(
    source.codeQuestionWorkspace,
    activeProject
  );
  // Drop stale Code Question pane IDs from order/weights when they no longer belong
  // to the active Project/question (Project or question switch must not leak context).
  const cqPaneIDs = new Set(
    (layout.codeQuestionWorkspace.openPanes || []).map((pane) => pane.paneID)
  );
  layout.paneOrder = layout.paneOrder.filter((paneID) =>
    !String(paneID).startsWith("cq:") || cqPaneIDs.has(paneID)
  );
  layout.paneWeights = Object.fromEntries(
    Object.entries(layout.paneWeights).filter(([paneID]) =>
      !String(paneID).startsWith("cq:") || cqPaneIDs.has(paneID)
    )
  );
  return layout;
}

export function captureWorkspaceLayout(state = {}, options = {}) {
  return normalizeWorkspaceLayout({
    ...Object.fromEntries(workspaceLayoutStateKeys.map((key) => [key, state[key]])),
    trackScrollLeft: options.trackScrollLeft ?? state.trackScrollLeft
  });
}

export function applyWorkspaceLayout(state, value) {
  const layout = normalizeWorkspaceLayout(value);
  workspaceLayoutStateKeys.forEach((key) => {
    state[key] = copy(layout[key]);
  });
  state.searchResultReader = null;
  state.sectionDetail = null;
  return state;
}

export function workspaceLayoutHasVisiblePanes(value = {}) {
  const layout = normalizeWorkspaceLayout(value);
  return Boolean(
    layout.readers.length ||
    layout.utilityInstances.length ||
    layout.projectDetails.length ||
    layout.workboards.length ||
    layout.notebooks.length ||
    layout.reportDrafts.length ||
    layout.coordinations.length ||
    layout.coordinationThreads.length ||
    (layout.codeQuestionWorkspace?.openPanes || []).length ||
    Object.values(layout.utilities).some(Boolean)
  );
}

function uniqueWorkspaceName(workspaces, preferredName) {
  const existing = new Set((workspaces || []).map((workspace) => workspace.name.toLocaleLowerCase()));
  const base = cleanWorkspaceName(preferredName, "Workspace");
  if (!existing.has(base.toLocaleLowerCase())) return base;
  let suffix = 2;
  while (existing.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return cleanWorkspaceName(`${base} ${suffix}`);
}

function workspaceRecord(value, options = {}) {
  const now = options.now || new Date().toISOString();
  return {
    id: String(value?.id || options.makeID?.() || crypto.randomUUID()),
    name: cleanWorkspaceName(value?.name, options.fallbackName || defaultWorkspaceName),
    createdAt: String(value?.createdAt || now),
    updatedAt: String(value?.updatedAt || now)
  };
}

export function normalizeWorkspaceRegistry(value, options = {}) {
  const source = value && typeof value === "object" ? value : {};
  const makeID = options.makeID || (() => crypto.randomUUID());
  const now = options.now || new Date().toISOString();
  const seen = new Set();
  const workspaces = (Array.isArray(source.workspaces) ? source.workspaces : [])
    .map((item) => workspaceRecord(item, { makeID, now }))
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  if (!workspaces.length) {
    workspaces.push(workspaceRecord({ name: defaultWorkspaceName }, { makeID, now }));
  }
  const requestedActiveID = String(options.activeWorkspaceID || source.activeWorkspaceID || "");
  return {
    version: workspaceRegistryVersion,
    activeWorkspaceID: workspaces.some((workspace) => workspace.id === requestedActiveID)
      ? requestedActiveID
      : workspaces[0].id,
    workspaces
  };
}

export function createWorkspace(registry, options = {}) {
  const normalized = normalizeWorkspaceRegistry(registry, options);
  const number = normalized.workspaces.length + 1;
  const workspace = workspaceRecord({
    name: uniqueWorkspaceName(normalized.workspaces, options.name || `Workspace ${number}`)
  }, options);
  return {
    registry: {
      ...normalized,
      activeWorkspaceID: workspace.id,
      workspaces: [...normalized.workspaces, workspace]
    },
    workspace,
    layout: emptyWorkspaceLayout()
  };
}

export function renameWorkspace(registry, workspaceID, name, options = {}) {
  const normalized = normalizeWorkspaceRegistry(registry, options);
  const workspace = normalized.workspaces.find((item) => item.id === workspaceID);
  if (!workspace) return normalized;
  const otherWorkspaces = normalized.workspaces.filter((item) => item.id !== workspaceID);
  const nextName = uniqueWorkspaceName(otherWorkspaces, cleanWorkspaceName(name, workspace.name));
  const now = options.now || new Date().toISOString();
  return {
    ...normalized,
    workspaces: normalized.workspaces.map((item) => item.id === workspaceID
      ? { ...item, name: nextName, updatedAt: now }
      : item)
  };
}

export function duplicateWorkspace(registry, workspaceID, layout, options = {}) {
  const normalized = normalizeWorkspaceRegistry(registry, options);
  const source = normalized.workspaces.find((item) => item.id === workspaceID);
  if (!source) return null;
  const workspace = workspaceRecord({
    name: uniqueWorkspaceName(normalized.workspaces, options.name || `${source.name} Copy`)
  }, options);
  const sourceIndex = normalized.workspaces.findIndex((item) => item.id === workspaceID);
  const workspaces = normalized.workspaces.slice();
  workspaces.splice(sourceIndex + 1, 0, workspace);
  return {
    registry: { ...normalized, activeWorkspaceID: workspace.id, workspaces },
    workspace,
    layout: normalizeWorkspaceLayout(layout)
  };
}

export function reorderWorkspace(registry, workspaceID, targetWorkspaceID, position = "before", options = {}) {
  const normalized = normalizeWorkspaceRegistry(registry, options);
  if (workspaceID === targetWorkspaceID) return normalized;
  const fromIndex = normalized.workspaces.findIndex((item) => item.id === workspaceID);
  const targetIndex = normalized.workspaces.findIndex((item) => item.id === targetWorkspaceID);
  if (fromIndex === -1 || targetIndex === -1) return normalized;
  const workspaces = normalized.workspaces.slice();
  const [workspace] = workspaces.splice(fromIndex, 1);
  const nextTargetIndex = workspaces.findIndex((item) => item.id === targetWorkspaceID);
  workspaces.splice(nextTargetIndex + (position === "after" ? 1 : 0), 0, workspace);
  return { ...normalized, workspaces };
}

export function deleteWorkspace(registry, workspaceID, options = {}) {
  const normalized = normalizeWorkspaceRegistry(registry, options);
  const index = normalized.workspaces.findIndex((item) => item.id === workspaceID);
  if (index === -1) return { registry: normalized, deletedWorkspaceID: "", replacementLayout: null };
  if (normalized.workspaces.length === 1) {
    const now = options.now || new Date().toISOString();
    const remaining = { ...normalized.workspaces[0], name: defaultWorkspaceName, updatedAt: now };
    return {
      registry: { ...normalized, activeWorkspaceID: remaining.id, workspaces: [remaining] },
      deletedWorkspaceID: "",
      replacementLayout: emptyWorkspaceLayout()
    };
  }
  const workspaces = normalized.workspaces.filter((item) => item.id !== workspaceID);
  const fallback = workspaces[Math.min(index, workspaces.length - 1)];
  const activeWorkspaceID = normalized.activeWorkspaceID === workspaceID
    ? fallback.id
    : normalized.activeWorkspaceID;
  return {
    registry: { ...normalized, activeWorkspaceID, workspaces },
    deletedWorkspaceID: workspaceID,
    replacementLayout: null
  };
}

export function workspaceRegistrySchemaVersion() {
  return workspaceRegistryVersion;
}
