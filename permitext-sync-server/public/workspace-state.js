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
  "trackScrollLeft"
]);

function copy(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
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
    trackScrollLeft: 0
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
  layout.workboards = Array.isArray(source.workboards) ? copy(source.workboards) : [];
  layout.notebooks = Array.isArray(source.notebooks) ? copy(source.notebooks) : [];
  layout.reportDrafts = Array.isArray(source.reportDrafts) ? copy(source.reportDrafts) : [];
  layout.coordinations = Array.isArray(source.coordinations) ? copy(source.coordinations) : [];
  layout.coordinationThreads = Array.isArray(source.coordinationThreads)
    ? copy(source.coordinationThreads.filter((thread) =>
        thread && typeof thread === "object" && typeof thread.threadID === "string" && thread.threadID
      ))
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
