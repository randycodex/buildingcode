const workspaceKey = "permitext:webWorkspace:v1";
const track = document.querySelector("#panel-track");
const addReaderButton = document.querySelector("#add-reader");
const toggleProjectsButton = document.querySelector("#toggle-projects");
const toggleArchiveButton = document.querySelector("#toggle-archive");
const toggleSearchButton = document.querySelector("#toggle-search");
const toggleSavedButton = document.querySelector("#toggle-saved");
const toggleAnalysisButton = document.querySelector("#toggle-analysis");
const toggleSettingsButton = document.querySelector("#toggle-settings");
const fitColumnsButton = document.querySelector("#fit-columns");
const collapseReadersButton = document.querySelector("#collapse-readers");
const readerTemplate = document.querySelector("#reader-template");
const projectsTemplate = document.querySelector("#projects-template");
const searchTemplate = document.querySelector("#search-template");
const savedTemplate = document.querySelector("#saved-template");
const analysisTemplate = document.querySelector("#analysis-template");
const settingsTemplate = document.querySelector("#settings-template");

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
const defaultSettingsPaneWidth = 340;
const readerSearchFlashDurationMS = 2000;
const repeatableUtilityKeys = new Set(["search", "saved", "analysis"]);

const defaultReaderSettings = {
  fontSize: 10,
  lineSpacing: 0,
  fontFamily: "helvetica"
};

let chapters = [];
let state = loadWorkspaceState();
const searchTimers = new Map();
let syncedContent = null;
let syncLoadPromise = null;
let draggedPaneID = "";
let dragPreviewOrder = [];
let activeCustomSelect = null;
const chapterListCache = new Map();
const chapterCache = new Map();

applyReaderSettings();

function loadWorkspaceState() {
  try {
    const saved = JSON.parse(localStorage.getItem(workspaceKey) || "{}");
    const utilityInstances = normalizeUtilityInstances(saved);
    return {
      readers: Array.isArray(saved.readers) && saved.readers.length > 0 ? saved.readers : [newReaderState()],
      searchQuery: saved.searchQuery || "",
      searchCodeFilters: normalizeSearchCodeFilters(saved.searchCodeFilters ?? saved.searchCodeFilter),
      localProjects: Array.isArray(saved.localProjects) ? saved.localProjects.filter((project) => project && typeof project === "object") : [],
      archivedProjectIDs: Array.isArray(saved.archivedProjectIDs) ? saved.archivedProjectIDs.map(String) : [],
      searchResultReader: saved.searchResultReader || null,
      sectionDetail: saved.sectionDetail || saved.searchResultReader || null,
      sectionDetails: saved.sectionDetails && typeof saved.sectionDetails === "object" ? saved.sectionDetails : {},
      searchLinkedReaders: saved.searchLinkedReaders && typeof saved.searchLinkedReaders === "object" ? saved.searchLinkedReaders : {},
      projectDetail: saved.projectDetail && typeof saved.projectDetail === "object" ? saved.projectDetail : null,
      sectionNotes: saved.sectionNotes && typeof saved.sectionNotes === "object" ? saved.sectionNotes : {},
      utilityInstances,
      utilities: {
        projects: Boolean(saved.utilities?.projects),
        archive: Boolean(saved.utilities?.archive),
        search: false,
        saved: false,
        analysis: false,
        settings: Boolean(saved.utilities?.settings)
      },
      account: saved.account && typeof saved.account === "object" ? saved.account : null,
      paneWeights: saved.paneWeights && typeof saved.paneWeights === "object" ? saved.paneWeights : {},
      paneOrder: Array.isArray(saved.paneOrder) ? saved.paneOrder.filter((id) => typeof id === "string") : [],
      recentChaptersByCode: saved.recentChaptersByCode && typeof saved.recentChaptersByCode === "object" ? saved.recentChaptersByCode : {},
      readerSettings: normalizeReaderSettings(saved.readerSettings)
    };
  } catch {
    return {
      readers: [newReaderState()],
      searchQuery: "",
      searchCodeFilters: [],
      localProjects: [],
      archivedProjectIDs: [],
      searchResultReader: null,
      sectionDetail: null,
      sectionDetails: {},
      searchLinkedReaders: {},
      projectDetail: null,
      sectionNotes: {},
      utilityInstances: [],
      utilities: { projects: false, archive: false, search: false, saved: false, analysis: false, settings: false },
      account: null,
      paneWeights: {},
      paneOrder: [],
      recentChaptersByCode: {},
      readerSettings: { ...defaultReaderSettings }
    };
  }
}

function newUtilityInstance(key, overrides = {}) {
  const instance = {
    id: overrides.id || crypto.randomUUID(),
    key
  };
  if (key === "search") {
    instance.query = typeof overrides.query === "string" ? overrides.query : "";
    instance.codeFilters = normalizeSearchCodeFilters(overrides.codeFilters);
  }
  return instance;
}

function normalizeUtilityInstances(saved = {}) {
  const source = Array.isArray(saved.utilityInstances) ? saved.utilityInstances : [];
  const instances = source
    .map((pane) => newUtilityInstance(String(pane?.key || "").trim().toLowerCase(), {
      id: String(pane?.id || crypto.randomUUID()),
      query: typeof pane?.query === "string" ? pane.query : "",
      codeFilters: pane?.codeFilters
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
  localStorage.setItem(workspaceKey, JSON.stringify(state));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeReaderSettings(settings = {}) {
  return {
    fontSize: clampNumber(settings.fontSize, 10, 18, defaultReaderSettings.fontSize),
    lineSpacing: clampNumber(settings.lineSpacing, 0, 4, defaultReaderSettings.lineSpacing),
    fontFamily: "helvetica"
  };
}

function normalizeSearchCodeFilters(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)));
  }
  const prefix = typeof value === "string" ? value.trim().toUpperCase() : "";
  return prefix && prefix !== "ALL" ? [prefix] : [];
}

function normalizeSearchInstance(instance) {
  if (!instance || typeof instance !== "object") return { query: "", codeFilters: [] };
  instance.query = typeof instance.query === "string" ? instance.query : "";
  instance.codeFilters = normalizeSearchCodeFilters(instance.codeFilters);
  return instance;
}

function readerLineHeightValue(lineSpacing) {
  return 1.2 + Number(lineSpacing) * 0.15;
}

function readerFontFamilyValue() {
  return "Helvetica, Arial, sans-serif";
}

function applyReaderSettings() {
  state.readerSettings = normalizeReaderSettings(state.readerSettings);
  document.documentElement.style.setProperty("--reader-font-size", `${state.readerSettings.fontSize}pt`);
  document.documentElement.style.setProperty("--reader-line-height", String(readerLineHeightValue(state.readerSettings.lineSpacing)));
  document.documentElement.style.setProperty("--reader-font-family", readerFontFamilyValue());
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
    shouldSmoothScrollToSection: false,
    ...overrides
  };
}

function paneIDForReader(reader, options = {}) {
  return options.isSearchResult ? "reader:search-result" : `reader:${reader.id}`;
}

function paneIDForUtilityInstance(instance) {
  return `utility:${instance.key}:${instance.id}`;
}

function paneIDForSectionDetail(searchID = "legacy") {
  return `section:detail:${searchID}`;
}

function paneIDForProjectDetail() {
  return "project:detail";
}

function defaultPaneWidthForID(paneID) {
  if (!paneID) return defaultReaderPaneWidth;
  if (paneID === paneIDForProjectDetail() || paneID.startsWith("section:detail:")) return defaultDetailPaneWidth;
  if (paneID === "utility:settings" || paneID.startsWith("utility:analysis:")) return defaultSettingsPaneWidth;
  if (paneID.startsWith("utility:")) return defaultUtilityPaneWidth;
  if (paneID.startsWith("reader:")) return defaultReaderPaneWidth;
  return defaultReaderPaneWidth;
}

function isFixedWidthPaneID(paneID) {
  return paneID?.startsWith("utility:") ||
    paneID === paneIDForProjectDetail() ||
    paneID?.startsWith("section:detail:");
}

function isFixedWidthReaderPaneID(paneID) {
  if (!paneID?.startsWith("reader:")) return false;
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
  return state.sectionDetails;
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
  const ids = [];
  if (state.utilities.projects) ids.push("utility:projects");
  if (state.utilities.projects && state.projectDetail) ids.push(paneIDForProjectDetail());
  if (state.utilities.archive) ids.push("utility:archive");
  (state.utilityInstances || []).forEach((instance) => {
    ids.push(paneIDForUtilityInstance(instance));
    if (instance.key === "search" && sectionDetailsBySearch()[instance.id]) {
      ids.push(paneIDForSectionDetail(instance.id));
    }
  });
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
  const paired = ordered.filter((id) => !id.startsWith("section:detail:") && id !== paneIDForProjectDetail());
  if (state.utilities.projects && state.projectDetail) {
    const projectsIndex = paired.indexOf("utility:projects");
    const detailID = paneIDForProjectDetail();
    if (projectsIndex === -1) {
      paired.push(detailID);
    } else {
      paired.splice(projectsIndex + 1, 0, detailID);
    }
  }
  (state.utilityInstances || []).forEach((instance) => {
    if (instance.key !== "search" || !sectionDetailsBySearch()[instance.id]) return;
    const searchID = paneIDForUtilityInstance(instance);
    const detailID = paneIDForSectionDetail(instance.id);
    const searchIndex = paired.indexOf(searchID);
    if (searchIndex === -1) {
      paired.push(detailID);
    } else if (!paired.includes(detailID)) {
      paired.splice(searchIndex + 1, 0, detailID);
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
  const detailID = paneIDForSectionDetail(searchID);
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== detailID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== detailID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const searchIndex = ordered.indexOf(searchPaneID);
  const insertIndex = searchIndex === -1 ? 0 : searchIndex + 1;
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

function placeProjectDetailAfterProjects() {
  const detailID = paneIDForProjectDetail();
  const activeIDs = defaultActivePaneIDs().filter((id) => id !== detailID);
  const ordered = (state.paneOrder || []).filter((id) => activeIDs.includes(id) && id !== detailID);
  activeIDs.forEach((id) => {
    if (!ordered.includes(id)) ordered.push(id);
  });
  const projectIndex = ordered.indexOf("utility:projects");
  const insertIndex = projectIndex === -1 ? 0 : projectIndex + 1;
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
  const projectIndex = ordered.indexOf("utility:projects");
  const insertIndex = projectIndex === -1 ? 0 : projectIndex + 1;
  ordered.splice(insertIndex, 0, archiveID);
  state.paneOrder = ordered;
}

async function openArchiveAfterProjectsStack() {
  state.utilities.archive = true;
  state.paneWeights["utility:archive"] = defaultPaneWidthForID("utility:archive");
  placeArchiveAfterProjectsStack();
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
  saveWorkspaceState();
  await transitionWorkspace("utility");
}

function normalizePaneWeights(ids) {
  const current = state.paneWeights || {};
  state.paneWeights = ids.reduce((weights, id) => {
    const value = Number(current[id]);
    weights[id] = Number.isFinite(value) && value > 40
      ? value
      : defaultPaneWidthForID(id);
    return weights;
  }, {});
}

function applyPaneWeight(panel, paneID) {
  panel.dataset.paneId = paneID;
  const value = Number(state.paneWeights[paneID]);
  const width = Number.isFinite(value) && value > 40 ? value : defaultPaneWidthForID(paneID);
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
  toggleProjectsButton.setAttribute("aria-pressed", String(state.utilities.projects));
  toggleArchiveButton?.setAttribute("aria-pressed", String(state.utilities.archive));
  toggleSearchButton.setAttribute("aria-pressed", String(activeRepeatableKeys.has("search")));
  toggleSavedButton.setAttribute("aria-pressed", String(activeRepeatableKeys.has("saved")));
  toggleAnalysisButton.setAttribute("aria-pressed", String(activeRepeatableKeys.has("analysis")));
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
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
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
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
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
  const headerOffset = panel ? Number.parseFloat(getComputedStyle(panel, "::before").height) : 0;
  const offset = Number.isFinite(headerOffset) ? headerOffset : 0;
  const targetTop = content.scrollTop + targetRect.top - contentRect.top - offset;
  content.scrollTo({
    top: Math.max(0, targetTop),
    behavior
  });
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

      const contentRect = content.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();
      const panel = content.closest(".reader-panel");
      const headerOffset = panel ? Number.parseFloat(getComputedStyle(panel, "::before").height) : 0;
      const visibleTop = contentRect.top + (Number.isFinite(headerOffset) ? headerOffset : 0);
      if (markRect.top < visibleTop || markRect.bottom > contentRect.bottom) {
        scrollReaderContentToNode(content, mark, "smooth");
      }

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

function mutationKindAndRecord(mutation) {
  const [kind, record] = Object.entries(mutation || {})[0] || [];
  return { kind, record };
}

function mutationUpdatedAt(mutation) {
  const record = Object.values(mutation || {})[0] || {};
  const timestamp = Date.parse(record.updatedAt || 0);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function summarizeMutations(mutations = []) {
  const sorted = [...mutations].sort((left, right) => mutationUpdatedAt(right) - mutationUpdatedAt(left));
  const projects = [];
  const savedItems = [];
  const annotations = [];
  const projectSections = [];

  sorted.forEach((mutation) => {
    const { kind, record } = mutationKindAndRecord(mutation);
    if (!record || record.deletedAt) return;
    if (kind === "project") projects.push(record);
    if (kind === "savedItem") savedItems.push(record);
    if (kind === "annotation") annotations.push(record);
    if (kind === "projectSection") projectSections.push(record);
  });

  return { projects, savedItems, annotations, projectSections };
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
  syncLoadPromise = postJSON("/sync/pull", {
    auth: { accountUserID: account.userID }
  }, { token: account.sessionToken })
    .then((payload) => {
      syncedContent = {
        status: "connected",
        pulledAt: payload.pulledAt,
        mutations: payload.mutations || [],
        summary: summarizeMutations(payload.mutations || [])
      };
      return syncedContent;
    })
    .catch((error) => {
      syncedContent = { status: "error", error: error.message, mutations: [], summary: summarizeMutations([]) };
      return syncedContent;
    })
    .finally(() => {
      syncLoadPromise = null;
    });
  return syncLoadPromise;
}

async function pushMutation(mutation) {
  const account = activeAccount();
  if (!account) {
    throw new Error("Connect Web Sync in Settings before saving from the web.");
  }
  const payload = await postJSON("/sync/push", {
    auth: { accountUserID: account.userID },
    batch: {
      user: { id: account.userID },
      mutations: [mutation]
    }
  }, { token: account.sessionToken });
  await loadSyncedContent({ force: true });
  return payload;
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
    savedItem: {
      id: `web-saved-${section.sectionID}`,
      userID: account.userID,
      codeVersion: "nyc-2022",
      sectionID: Number(section.sectionID),
      sectionNumber: section.sectionNumber,
      title: section.title,
      updatedAt: now
    }
  };
}

function deletedSavedMutationForSection(section) {
  const account = activeAccount();
  const now = new Date().toISOString();
  return {
    savedItem: {
      id: `web-saved-${section.sectionID}`,
      userID: account.userID,
      codeVersion: "nyc-2022",
      sectionID: Number(section.sectionID),
      sectionNumber: section.sectionNumber,
      title: section.title,
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
  return project?.color || project?.tintColor || project?.colorHex || projectColorOptions[0];
}

function projectMutationForRecord(project, accountOverride = null) {
  const account = accountOverride || activeAccount();
  const now = project.updatedAt || new Date().toISOString();
  const color = projectColor(project);
  return {
    project: {
      id: project.id,
      clientID: project.clientID || project.id,
      localFolderID: project.localFolderID || project.id,
      userID: account?.userID || "local-web",
      codeVersion: project.codeVersion || "nyc-2022",
      name: project.name || "Project",
      title: project.title || project.name || "Project",
      description: project.description || "",
      color,
      colorHex: project.colorHex || color,
      sortOrder: Number.isFinite(Number(project.sortOrder)) ? Number(project.sortOrder) : 0,
      sortMode: project.sortMode || "Code order",
      createdAt: project.createdAt || now,
      updatedAt: now
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

function visibleProjectRecords(syncedProjects = []) {
  const byID = new Map();
  syncedProjects.forEach((project) => {
    const id = projectRecordID(project);
    if (id) byID.set(id, project);
  });
  (state.localProjects || []).forEach((project) => {
    const id = projectRecordID(project);
    if (id && !byID.has(id)) byID.set(id, project);
  });
  return Array.from(byID.values()).sort((left, right) =>
    String(left.name || left.title || "").localeCompare(String(right.name || right.title || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function activeProjectRecords(syncedProjects = []) {
  const archived = archivedProjectIDSet();
  return visibleProjectRecords(syncedProjects).filter((project) => !archived.has(projectRecordID(project)));
}

function archivedProjectRecords(syncedProjects = []) {
  const archived = archivedProjectIDSet();
  return visibleProjectRecords(syncedProjects).filter((project) => archived.has(projectRecordID(project)));
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
  const now = new Date().toISOString();
  const id = `web-project-${Date.now().toString(36)}`;
  const fallbackName = nextProjectName();
  const name = String(details.name || "").trim() || fallbackName;
  const description = String(details.description || "").trim();
  const project = {
    id,
    clientID: id,
    localFolderID: id,
    codeVersion: "nyc-2022",
    name,
    title: name,
    description,
    color: details.color || projectColorOptions[0],
    sortMode: "Code order",
    createdAt: now,
    updatedAt: now
  };
  state.localProjects = [...(state.localProjects || []), project];
  saveWorkspaceState();

  const account = activeAccount();
  if (!account) return;

  await pushMutation(projectMutationForRecord(project, account));
  state.localProjects = (state.localProjects || []).filter((item) => item.id !== project.id);
  saveWorkspaceState();
}

async function updateProjectFolder(project, details = {}) {
  const id = projectRecordID(project);
  if (!id) return;
  const now = new Date().toISOString();
  const name = String(details.name || "").trim() || project.name || project.title || "Project";
  const color = details.color || projectColor(project);
  const updated = {
    ...project,
    id: project.id || id,
    clientID: project.clientID || id,
    localFolderID: project.localFolderID || id,
    codeVersion: project.codeVersion || "nyc-2022",
    name,
    title: name,
    description: String(details.description || "").trim(),
    color,
    colorHex: project.colorHex || color,
    tintColor: color,
    updatedAt: now
  };
  const localProjects = state.localProjects || [];
  const localIndex = localProjects.findIndex((item) => projectRecordID(item) === id);
  const account = activeAccount();

  if (account) {
    await pushMutation(projectMutationForRecord(updated, account));
    state.localProjects = localProjects.filter((item) => projectRecordID(item) !== id);
  } else {
    const nextProjects = [...localProjects];
    if (localIndex >= 0) {
      nextProjects[localIndex] = { ...nextProjects[localIndex], ...updated };
    } else {
      nextProjects.push(updated);
    }
    state.localProjects = nextProjects;
  }

  if (projectDetailMatches(project, state.projectDetail)) state.projectDetail = projectIdentity(updated);
  saveWorkspaceState();
}

function isSectionSaved(sectionID) {
  const savedItems = syncedContent?.summary?.savedItems || [];
  return savedItems.some((item) => String(item.sectionID) === String(sectionID));
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
    renderSectionComments(commentsList, []);
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

    const groupLabel = groupLabelsByFirstSection.get(String(section.id));
    if (groupLabel) {
      sectionWrapper.classList.add("starts-group");
      const groupHeading = document.createElement("div");
      groupHeading.className = "authored-section-label";
      groupHeading.textContent = groupLabel;
      sectionWrapper.append(groupHeading);
    }

    const sectionHeading = document.createElement("h3");
    sectionHeading.textContent = sectionDisplayTitle(section.sectionNumber, section.title);
    sectionWrapper.append(sectionHeading);

    const blocks = section.blocks?.length ? section.blocks : [{ plainText: section.title || "" }];
    blocks.forEach((block) => sectionWrapper.append(renderCodeBlock(block)));
    sectionWrapper.append(renderInlineCommentBox(section, reader));

    content.append(sectionWrapper);
  });
  renderSectionComments(commentsList, []);

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
  scrollReaderContentToNode(content, target, behavior);
}

function renderInlineCommentBox(section, reader) {
  const wrapper = document.createElement("section");
  wrapper.className = "inline-comment";
  wrapper.dataset.commentSectionId = String(section.id);

  const button = document.createElement("button");
  button.className = "inline-comment-toggle";
  button.type = "button";
  button.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>
    </svg>
    <span class="sr-only">Comments</span>
  `;
  button.setAttribute("aria-label", "Comments");
  button.setAttribute("aria-expanded", "false");

  const bookmarkButton = document.createElement("button");
  bookmarkButton.className = "inline-bookmark-toggle";
  bookmarkButton.type = "button";
  bookmarkButton.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
    </svg>
    <span class="sr-only">Save subsection</span>
  `;
  bookmarkButton.setAttribute("aria-label", "Save subsection");
  if (isSectionSaved(section.id)) {
    bookmarkButton.classList.add("is-saved");
    bookmarkButton.setAttribute("aria-pressed", "true");
    bookmarkButton.title = "Saved";
  } else {
    bookmarkButton.setAttribute("aria-pressed", "false");
  }

  const editor = document.createElement("textarea");
  editor.className = "inline-comment-input";
  editor.setAttribute("aria-label", `Comment for ${sectionDisplayTitle(section.sectionNumber, section.title)}`);
  editor.rows = 4;
  editor.hidden = true;
  editor.addEventListener("input", () => {
    button.classList.toggle("has-comment", Boolean(editor.value.trim()));
  });

  const resizer = document.createElement("div");
  resizer.className = "inline-comment-resizer";
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-orientation", "vertical");
  resizer.setAttribute("aria-label", "Resize comment");

  button.addEventListener("click", () => {
    const willOpen = editor.hidden;
    if (willOpen) {
      editor.hidden = false;
      requestAnimationFrame(() => {
        sectionElementForInlineComment(wrapper)?.classList.add("has-inline-comment");
        requestAnimationFrame(() => {
          wrapper.classList.add("is-open");
        });
      });
    } else {
      wrapper.classList.remove("is-open");
      sectionElementForInlineComment(wrapper)?.classList.remove("has-inline-comment");
      window.setTimeout(() => {
        if (!wrapper.classList.contains("is-open")) editor.hidden = true;
      }, 680);
    }
    button.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) editor.focus();
  });

  bookmarkButton.addEventListener("click", async () => {
    bookmarkButton.disabled = true;
    bookmarkButton.classList.remove("has-error");
    const shouldRemove = bookmarkButton.classList.contains("is-saved");
    bookmarkButton.classList.toggle("is-saved", !shouldRemove);
    bookmarkButton.setAttribute("aria-pressed", String(!shouldRemove));
    bookmarkButton.title = shouldRemove ? "Save subsection" : "Saved";
    try {
      const sectionPayload = {
        sectionID: section.id,
        sectionNumber: section.sectionNumber,
        title: section.title
      };
      await pushMutation(shouldRemove ? deletedSavedMutationForSection(sectionPayload) : savedMutationForSection(sectionPayload));
      if (state.utilities.saved) {
        await renderWorkspace();
      }
    } catch (error) {
      bookmarkButton.classList.add("has-error");
      bookmarkButton.title = error.message;
    } finally {
      bookmarkButton.disabled = false;
    }
  });

  bindInlineCommentResize(resizer, wrapper);
  wrapper.append(button, bookmarkButton, resizer);

  const fragment = document.createDocumentFragment();
  fragment.append(wrapper, editor);
  return fragment;
}

function sectionElementForInlineComment(commentWrapper) {
  return commentWrapper.closest(".chapter-section");
}

function bindInlineCommentResize(resizer, wrapper) {
  resizer.addEventListener("pointerdown", (event) => {
    const section = sectionElementForInlineComment(wrapper);
    if (!section?.classList.contains("has-inline-comment")) return;
    event.preventDefault();
    resizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-comments");

    const resize = (moveEvent) => {
      const bounds = section.getBoundingClientRect();
      if (!bounds.width) return;
      const width = ((bounds.right - moveEvent.clientX) / bounds.width) * 100;
      const clampedWidth = Math.min(60, Math.max(24, width));
      section.style.setProperty("--inline-comment-width", `${clampedWidth}%`);
    };

    const stopResize = () => {
      resizer.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-comments");
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

function syncCommentBoxHeights(content, commentsList) {
  if (!content || !commentsList) return;
  const sections = Array.from(content.querySelectorAll(".chapter-section"));
  const boxes = Array.from(commentsList.querySelectorAll(".section-comment-box"));
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
  window.addEventListener("resize", update, { passive: true });
  requestAnimationFrame(update);
}

function bindAllReaderCommentScroll() {
  track.querySelectorAll(".reader-panel").forEach((panel) => {
    bindReaderCommentScroll(panel);
    bindReaderScrollIndicator(panel);
    updateReaderScrollIndicator(panel);
  });
}

function renderSectionComments(commentsList, sections) {
  if (!commentsList) return;
  clear(commentsList);
  if (!sections.length) {
    const empty = document.createElement("p");
    empty.className = "comments-empty";
    empty.textContent = "";
    commentsList.append(empty);
    return;
  }

  sections.forEach((section) => {
    const item = document.createElement("article");
    item.className = "section-comment-box";
    item.dataset.sectionId = String(section.id);

    const inputLabel = document.createElement("label");
    inputLabel.className = "comment-composer";
    const textarea = document.createElement("textarea");
    textarea.className = "comment-input";
    textarea.rows = 4;
    textarea.setAttribute("aria-label", `Comment for ${sectionDisplayTitle(section.sectionNumber, section.title)}`);

    inputLabel.append(textarea);
    item.append(inputLabel);
    commentsList.append(item);
  });
}

function rewriteCodeHTML(html) {
  return String(html || "")
    .replace(/src=(["'])(?:\.\.\/)+assets\/([^"']+)\1/gi, (_match, quote, fileName) => {
      return `src=${quote}/code/assets/${encodeURIComponent(fileName)}${quote}`;
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
      image.src = `/code/assets/${encodeURIComponent(block.imageID)}`;
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
  const sections = (chapter.sections || []).filter((section) => {
    const title = sectionDisplayTitle(section.sectionNumber, section.title);
    const body = (section.blocks || []).map(plainTextForSearchBlock).join(" ");
    return `${title} ${body}`.toLowerCase().includes(needle);
  });

  sections.forEach((section) => {
    const row = document.createElement("button");
    row.className = "reader-internal-result";
    row.type = "button";

    const heading = document.createElement("strong");
    appendHighlighted(heading, sectionDisplayTitle(section.sectionNumber, section.title), query);

    const snippet = document.createElement("p");
    const body = (section.blocks || []).map(plainTextForSearchBlock).join(" ");
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
  const internalSearchButton = panel.querySelector(".reader-internal-search-toggle");
  const internalSearchBox = panel.querySelector(".reader-internal-search");
  const internalSearchInput = panel.querySelector(".reader-internal-search-input");
  const readerBody = panel.querySelector(".reader-body");
  const commentsPanel = panel.querySelector(".reader-comments");
  const codeSelect = panel.querySelector(".code-select");
  const chapterSelect = panel.querySelector(".chapter-select");
  const sectionSelect = panel.querySelector(".section-select");

  panel.dataset.readerId = reader.id;
  reader.codePrefix = reader.codePrefix || "BC";
  applyCodeTheme(panel, reader);
  applyPaneWeight(panel, paneIDForReader(reader, options));
  selector.hidden = false;
  setTitle(panel, reader);
  reader.commentsOpen = false;
  applyCommentsWidth(panel, reader);
  readerBody.classList.remove("comments-open");
  commentsPanel.hidden = true;
  commentsButton.hidden = true;
  internalSearchBox.hidden = true;
  internalSearchInput.value = reader.internalSearchQuery || "";

  if (options.isSearchResult) {
    closeButton.hidden = false;
  } else {
    closeButton.hidden = state.readers.length <= 1;
  }

  populateCodeSelect(panel, reader);
  codeSelect.addEventListener("change", async () => {
    reader.codePrefix = codeSelect.value || "BC";
    applyCodeTheme(panel, reader);
    reader.chapterID = await firstChapterIDForCode(reader.codePrefix);
    reader.sectionID = "";
    reader.sectionNumber = "";
    reader.title = "Reader";
    saveWorkspaceState();
    await refreshReaderContent(panel, reader);
  });

  internalSearchButton.addEventListener("click", async () => {
    const willOpen = internalSearchBox.hidden;
    internalSearchBox.hidden = !willOpen;
    internalSearchButton.setAttribute("aria-pressed", String(willOpen));
    if (willOpen) {
      internalSearchInput.value = reader.internalSearchQuery || "";
      internalSearchInput.focus();
      await renderReaderInternalSearchResults(panel, reader, internalSearchInput.value);
      return;
    }
    await renderSectionContent(panel, reader);
  });

  internalSearchInput.addEventListener("input", () => {
    reader.internalSearchQuery = internalSearchInput.value;
    saveWorkspaceState();
    renderReaderInternalSearchResults(panel, reader, internalSearchInput.value);
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
    renderWorkspace();
  });

  chapterSelect.addEventListener("change", async () => {
    reader.chapterID = chapterSelect.value;
    state.recentChaptersByCode = state.recentChaptersByCode || {};
    if (reader.chapterID) {
      state.recentChaptersByCode[reader.codePrefix || "BC"] = reader.chapterID;
    }
    reader.sectionID = "";
    reader.sectionNumber = "";
    reader.title = "Reader";
    saveWorkspaceState();
    await refreshReaderContent(panel, reader);
  });

  sectionSelect.addEventListener("change", async () => {
    reader.sectionID = sectionSelect.value;
    if (reader.sectionID) {
      const chapter = await fetchChapter(reader.chapterID);
      const summary = sectionTitleFromID(reader.sectionID, chapter);
      reader.sectionNumber = summary?.sectionNumber || "";
      reader.title = summary?.title || "Reader";
    }
    saveWorkspaceState();
    await renderWorkspace();
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
  const filterRail = panel.querySelector(".search-code-filter");
  applyPaneWeight(panel, paneID);
  input.value = searchInstance.query || "";
  renderSearchCodeFilter(filterRail, panel, searchInstance);
  bindHorizontalWheelScroll(filterRail);

  input.addEventListener("input", () => {
    searchInstance.query = input.value;
    const details = sectionDetailsBySearch();
    if (!searchInstance.query.trim() && details[searchInstance.id]) {
      delete details[searchInstance.id];
    }
    saveWorkspaceState();
    clearTimeout(searchTimers.get(paneID));
    searchTimers.set(paneID, setTimeout(() => {
      if (!searchInstance.query.trim() && sectionDetailsBySearch()[searchInstance.id]) {
        renderWorkspace();
        return;
      }
      renderSearchResults(panel, searchInstance);
    }, 250));
  });

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
  if (query.length < 2) {
    clear(results);
    return;
  }

  renderSearchPlaceholder(results, { title: "Searching", body: "Checking section titles and code text." });
  const codeQuery = selectedPrefixes.length ? `&code=${encodeURIComponent(selectedPrefixes.join(","))}` : "";
  const payload = await api(`/code/search?q=${encodeURIComponent(query)}${codeQuery}`);
  if (
    searchInstance.query.trim() !== query ||
    normalizeSearchCodeFilters(searchInstance.codeFilters).join(",") !== selectedPrefixes.join(",")
  ) {
    return;
  }
  clear(results);

  const filteredResults = (payload.results || []).filter((result) => {
    return selectedPrefixes.length === 0 || selectedPrefixes.includes(result.codePrefix || "BC");
  });

  if (filteredResults.length === 0) {
    renderSearchPlaceholder(results, { title: "No results", body: "Try a shorter phrase or a section number." });
    return;
  }

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
    const row = document.createElement("button");
    row.className = "result-row";
    row.type = "button";
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
      row.append(heading);
      if (snippetText) row.append(snippet);
    row.addEventListener("click", () => {
      openSectionDetail(searchInstance.id, {
        codePrefix: result.codePrefix || "BC",
        chapterID: result.chapterID,
        chapterNumber: result.chapterNumber || "",
        sectionID: result.id,
        sectionNumber: result.sectionNumber,
        title: result.title || result.headingLine || "Section",
        headerLine: result.headerLine || "",
        headingLine: result.headingLine || ""
      });
    });
      group.append(row);
    });
    results.append(group);
  });
}

async function openSectionDetail(searchID, section) {
  const sectionID = String(section.sectionID || section.id || "");
  if (!sectionID) return;
  const details = sectionDetailsBySearch();
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
  state.searchResultReader = null;
  placeSectionDetailAfterSearch(searchID);
  updateLinkedReaderForSearch(searchID, details[searchID]);
  saveWorkspaceState();
  await renderWorkspace();
}

function annotationForSection(sectionID) {
  const annotations = syncedContent?.summary?.annotations || [];
  return annotations.find((annotation) => String(annotation.sectionID) === String(sectionID)) || null;
}

async function resolveSectionDetail(detail) {
  let chapter = null;
  let section = null;
  if (detail.chapterID) {
    chapter = await fetchChapter(detail.chapterID, { includeBody: true });
    section = sectionTitleFromID(detail.sectionID, chapter);
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
  const saved = isSectionSaved(detail.sectionID);
  const annotation = annotationForSection(detail.sectionID);
  const noteKey = String(detail.sectionID);
  const noteBody = state.sectionNotes?.[noteKey] ?? annotation?.noteBody ?? "";
  const bodyText = sectionPlainText(section);

  const chrome = document.createElement("header");
  chrome.className = "section-detail-chrome";
  const backButton = appendDetailIconButton(chrome, {
    title: "Back",
    label: "Back to search",
    svg: circleXIconSVG()
  });
  const saveButton = appendDetailIconButton(chrome, {
    title: saved ? "Remove bookmark" : "Save bookmark",
    label: saved ? "Remove bookmark" : "Save bookmark",
    className: `section-detail-icon section-detail-save${saved ? " is-saved" : ""}`,
    svg: bookmarkIconSVG(saved)
  });
  saveButton.setAttribute("aria-pressed", String(saved));

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
  const notesTitle = document.createElement("h3");
  notesTitle.textContent = "Notes";
  const saveState = document.createElement("span");
  saveState.className = "section-detail-note-state";
  notesHeader.append(notesTitle, saveState);
  const textareaWrap = document.createElement("label");
  textareaWrap.className = "section-detail-note-box";
  const textarea = document.createElement("textarea");
  textarea.value = noteBody;
  textarea.placeholder = "Add a note";
  textarea.setAttribute("aria-label", `Note for ${sectionDisplayTitle(sectionPayload.sectionNumber, sectionPayload.title)}`);
  textareaWrap.append(textarea);
  notes.append(notesHeader, textareaWrap);

  backButton.addEventListener("click", () => {
    delete sectionDetailsBySearch()[searchID];
    saveWorkspaceState();
    renderWorkspace();
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
      await pushMutation(shouldRemove ? deletedSavedMutationForSection(sectionPayload) : savedMutationForSection(sectionPayload));
      await renderWorkspace();
    } catch (error) {
      saveButton.classList.add("has-error");
      saveButton.title = error.message;
      saveButton.setAttribute("aria-label", error.message);
    } finally {
      saveButton.disabled = false;
    }
  });

  heading.addEventListener("click", async () => {
    openOrUpdateLinkedReaderForSearch(searchID, detail, {
      chapterID: detail.chapterID || chapter?.id || "",
      sectionNumber: sectionPayload.sectionNumber,
      title: sectionPayload.title
    });
    saveWorkspaceState();
    await renderWorkspace();
  });

  let noteTimer = null;
  textarea.addEventListener("input", () => {
    state.sectionNotes = state.sectionNotes && typeof state.sectionNotes === "object" ? state.sectionNotes : {};
    state.sectionNotes[noteKey] = textarea.value;
    saveState.textContent = "Saving...";
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => {
      saveWorkspaceState();
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

async function renderUtilityInstance(instance) {
  const paneID = paneIDForUtilityInstance(instance);
  let panel = null;
  if (instance.key === "search") {
    panel = await renderSearch(instance);
  } else if (instance.key === "saved") {
    panel = await renderSaved(paneID);
  } else if (instance.key === "analysis") {
    panel = renderUtility(analysisTemplate, paneID);
    panel.classList.add("analysis-panel");
  }
  wireUtilityInstanceActions(panel, instance);
  return panel;
}

async function renderProjects() {
  const panel = renderTemplate(projectsTemplate);
  applyPaneWeight(panel, "utility:projects");
  const content = panel.querySelector(".projects-content");
  const addButton = panel.querySelector(".projects-add-button");
  const archiveButton = panel.querySelector(".projects-archive-button");
  clear(content);
  addButton?.addEventListener("click", () => showProjectCreateSheet(panel));
  archiveButton?.setAttribute("aria-pressed", String(state.utilities.archive));
  archiveButton?.addEventListener("click", toggleArchiveAfterProjectsStack);
  const data = await loadSyncedContent();

  if (data.status === "disconnected") {
    const projects = activeProjectRecords([]);
    if (projects.length === 0) {
      appendProjectEmptyCard(content, "No projects", "Use the add button to create a project folder.");
    } else {
      renderProjectRows(content, projects, [], { mode: "projects" });
    }
    return panel;
  }
  if (data.status === "error") {
    appendProjectEmptyCard(content, "Sync error", data.error || "Could not load projects.");
    return panel;
  }

  const { projects, projectSections } = data.summary;
  const visibleProjects = activeProjectRecords(projects);
  if (visibleProjects.length === 0) {
    appendProjectEmptyCard(content, "No projects", "Use the add button to create a project folder.");
  } else {
    renderProjectRows(content, visibleProjects, projectSections, { mode: "projects" });
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
  const sourceProjects = data.status === "connected" ? data.summary.projects : [];
  const projects = archivedProjectRecords(sourceProjects);
  if (data.status === "error") {
    appendProjectEmptyCard(content, "Sync error", data.error || "Could not load archived projects.");
    return panel;
  }
  if (projects.length === 0) {
    appendProjectEmptyCard(content, "No archived projects", "Archived project folders will appear here.");
  } else {
    renderProjectRows(content, projects, data.summary?.projectSections || [], { mode: "archive" });
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
    description: project.description || "",
    color: projectColor(project)
  };
}

function projectSectionBelongsToProject(item, project) {
  return (
    item.folderClientID === project.clientID ||
    item.folderClientID === project.id ||
    item.localFolderID === project.localFolderID ||
    item.folderID === project.id ||
    item.folderID === project.clientID
  );
}

async function openProjectDetail(project) {
  state.projectDetail = projectIdentity(project);
  placeProjectDetailAfterProjects();
  saveWorkspaceState();
  await renderWorkspace();
}

function projectDetailMatches(project, detail) {
  if (!project || !detail) return false;
  const ids = [project.id, project.clientID, project.localFolderID].filter(Boolean).map(String);
  return [detail.id, detail.clientID, detail.localFolderID].filter(Boolean).some((id) => ids.includes(String(id)));
}

async function archiveProject(project) {
  const id = projectRecordID(project);
  if (!id) return;
  const name = project.name || project.title || "this project";
  if (!window.confirm(`Archive ${name}?`)) return;
  const archived = archivedProjectIDSet();
  archived.add(id);
  state.archivedProjectIDs = Array.from(archived);
  if (projectDetailMatches(project, state.projectDetail)) state.projectDetail = null;
  const currentLeft = track.scrollLeft;
  saveWorkspaceState();
  await renderWorkspace();
  track.scrollLeft = currentLeft;
}

async function restoreArchivedProject(project) {
  const id = projectRecordID(project);
  if (!id) return;
  state.archivedProjectIDs = Array.from(archivedProjectIDSet()).filter((projectID) => projectID !== id);
  const currentLeft = track.scrollLeft;
  saveWorkspaceState();
  await renderWorkspace();
  track.scrollLeft = currentLeft;
}

async function deleteArchivedProject(project) {
  const id = projectRecordID(project);
  if (!id) return;
  const name = project.name || project.title || "this project";
  if (!window.confirm(`Delete ${name} permanently?`)) return;
  const isLocal = (state.localProjects || []).some((item) => projectRecordID(item) === id);
  if (!isLocal && activeAccount()) {
    try {
      await pushMutation(deletedProjectMutationForRecord(project));
    } catch (error) {
      window.alert(error.message || "Could not delete the project.");
      return;
    }
  }
  state.localProjects = (state.localProjects || []).filter((item) => projectRecordID(item) !== id);
  state.archivedProjectIDs = Array.from(archivedProjectIDSet()).filter((projectID) => projectID !== id);
  if (projectDetailMatches(project, state.projectDetail)) state.projectDetail = null;
  saveWorkspaceState();
  await renderWorkspace();
}

async function renderProjectDetail(detail) {
  const data = await loadSyncedContent();
  const projects = visibleProjectRecords(data.summary?.projects || []);
  const project = projects.find((item) => projectDetailMatches(item, detail)) || detail;
  const identity = projectIdentity(project);
  const projectSections = data.summary?.projectSections || [];
  const savedItems = data.summary?.savedItems || [];
  const sectionLinks = projectSections.filter((item) => projectSectionBelongsToProject(item, identity));
  const savedBySectionID = new Map(savedItems.map((item) => [String(item.sectionID || item.id || ""), item]));
  const linkedSavedItems = sectionLinks
    .map((link) => savedBySectionID.get(String(link.sectionID || link.savedSectionID || link.itemID || "")) || link)
    .filter(Boolean);

  const panel = document.createElement("article");
  panel.className = "workspace-panel project-detail-panel";
  panel.dataset.paneId = paneIDForProjectDetail();
  panel.style.setProperty("--project-color", identity.color);
  applyPaneWeight(panel, paneIDForProjectDetail());

  const chrome = document.createElement("header");
  chrome.className = "project-detail-chrome";
  const backButton = appendDetailIconButton(chrome, {
    title: "Back",
    label: "Back to projects",
    className: "project-detail-back",
    svg: circleXIconSVG()
  });
  const headingGroup = document.createElement("div");
  headingGroup.className = "project-detail-heading";
  const title = document.createElement("h2");
  title.textContent = identity.name;
  headingGroup.append(title);
  const descriptionText = String(project.description || identity.description || "").trim();
  if (descriptionText) {
    const description = document.createElement("p");
    description.textContent = descriptionText;
    headingGroup.append(description);
  }
  chrome.append(headingGroup);

  const content = document.createElement("section");
  content.className = "project-detail-content";

  const savedSection = document.createElement("section");
  savedSection.className = "project-detail-section";

  linkedSavedItems.forEach((item) => {
    const row = document.createElement("button");
    row.className = "saved-row project-detail-saved-row";
    row.type = "button";
    const rowTitle = document.createElement("strong");
    rowTitle.textContent = item.sectionNumber || item.sectionID || "Saved";
    const rowBody = document.createElement("span");
    rowBody.textContent = item.title || item.subtitle || "Saved section";
    row.append(rowTitle, rowBody);
    row.addEventListener("click", () => openSectionDetailForExistingSearch(item));
    savedSection.append(row);
  });

  backButton.addEventListener("click", () => {
    state.projectDetail = null;
    saveWorkspaceState();
    renderWorkspace();
  });

  content.append(savedSection);
  panel.append(chrome, content);
  return panel;
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
  const descriptionInput = document.createElement("input");
  descriptionInput.type = "text";
  descriptionInput.className = "project-description-input";
  descriptionInput.placeholder = "Description";
  descriptionInput.autocomplete = "off";
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
      const content = panel.querySelector(".projects-content");
      appendMutedRow(content, "Project not synced", error.message || "Could not save the project folder.");
    }
  });

  sheet.append(header, nameLabel, colorGroup, descriptionLabel);
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
  projects.slice(0, 24).forEach((project) => {
    const count = projectSections.filter((item) =>
      item.folderClientID === project.clientID ||
      item.folderClientID === project.id ||
      item.localFolderID === project.localFolderID
    ).length;
    const card = document.createElement("article");
    card.className = "project-card project-row";
    const isOpenProject = projectDetailMatches(project, state.projectDetail);
    if (isOpenProject) {
      card.classList.add("is-open");
      card.setAttribute("aria-current", "true");
    }
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${project.name || project.title || "project"}`);
    card.style.setProperty("--project-color", projectColor(project));
    const actionGroup = document.createElement("div");
    actionGroup.className = "project-card-actions";
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
    actionGroup.append(primaryActionButton, lifecycleButton);
    const body = document.createElement("div");
    body.className = "project-card-body";
    const heading = document.createElement("h3");
    heading.textContent = project.name || project.title || "Project";
    body.append(heading);
    const descriptionText = String(project.description || "").trim();
    if (descriptionText) {
      const description = document.createElement("p");
      description.textContent = descriptionText;
      body.append(description);
    }
    const meta = document.createElement("div");
    meta.className = "project-meta";
    [count === 1 ? "1 saved" : `${count} saved`].forEach((label) => {
      const pill = document.createElement("span");
      pill.textContent = label;
      meta.append(pill);
    });
    card.append(actionGroup, body, meta);
    card.addEventListener("click", () => openProjectDetail(project));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openProjectDetail(project);
    });
    content.append(card);
  });
}

async function renderSaved(paneID = "utility:saved") {
  const panel = renderTemplate(savedTemplate);
  applyPaneWeight(panel, paneID);
  const content = panel.querySelector(".saved-content");
  clear(content);
  const data = await loadSyncedContent();

  if (data.status === "disconnected") {
    appendEmptySaved(content, "Connect Web Sync", "Open Settings and connect an account ID plus session token to show synced projects, bookmarks, tags, and notes.");
    return panel;
  }
  if (data.status === "error") {
    appendEmptySaved(content, "Sync error", data.error || "Could not load saved content.");
    return panel;
  }

  const { savedItems, annotations } = data.summary;

  appendSectionLabel(content, "Saved sections");
  if (savedItems.length === 0) {
    appendMutedRow(content, "No saved sections", "Saved sections synced from iOS or saved in this web workspace will appear here.");
  } else {
    renderSavedItemsByCode(content, savedItems.slice(0, 48));
  }

  appendSectionLabel(content, "Tags and notes");
  if (annotations.length === 0) {
    appendMutedRow(content, "No tags or notes", "Annotations synced from iOS will appear here.");
  } else {
    annotations.slice(0, 12).forEach((annotation) => {
      const row = document.createElement("article");
      row.className = "saved-row";
      const title = document.createElement("strong");
      title.textContent = `${annotation.sectionNumber || annotation.sectionID || ""}`.trim() || "Annotation";
      const detail = document.createElement("span");
      const tags = Array.isArray(annotation.tags) && annotation.tags.length ? `Tags: ${annotation.tags.join(", ")}` : "";
      const note = annotation.noteBody ? `Note: ${annotation.noteBody}` : "";
      detail.textContent = [tags, note].filter(Boolean).join(" · ") || "Synced annotation";
      row.append(title, detail);
      content.append(row);
    });
  }
  return panel;
}

function renderSavedItemsByCode(content, savedItems) {
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

    const chapterGroups = new Map();
    items.forEach((item) => {
      const chapterKey = item.chapterNumber || item.chapterTitle || item.chapterID || "Saved";
      if (!chapterGroups.has(chapterKey)) chapterGroups.set(chapterKey, []);
      chapterGroups.get(chapterKey).push(item);
    });

    Array.from(chapterGroups.entries()).forEach(([chapterKey, chapterItems]) => {
      const chapterLabel = document.createElement("p");
      chapterLabel.className = "saved-chapter-label";
      chapterLabel.textContent = String(chapterKey).startsWith("Chapter") ? chapterKey : `Chapter ${chapterKey}`;
      codeGroup.append(chapterLabel);
      chapterItems.forEach((item) => {
        const row = document.createElement("button");
        row.className = "saved-row saved-row-button saved-section-row";
        row.type = "button";
        const title = document.createElement("strong");
        title.textContent = item.sectionNumber || item.sectionID || "Saved";
        const bookmark = document.createElement("span");
        bookmark.className = "saved-bookmark-glyph";
        bookmark.textContent = "▮";
        const heading = document.createElement("span");
        heading.className = "saved-section-heading";
        heading.append(title, bookmark);
        const subtitle = document.createElement("span");
        subtitle.textContent = item.title || "Saved section";
        const detail = document.createElement("span");
        detail.textContent = item.subtitle || item.noteBody || item.title || "Synced saved section";
        row.append(heading, subtitle, detail);
        row.addEventListener("click", () => openSectionDetailForExistingSearch(item));
        codeGroup.append(row);
      });
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

async function openSectionDetailForExistingSearch(item) {
  let searchInstance = (state.utilityInstances || []).find((instance) => instance.key === "search");
  if (!searchInstance) {
    searchInstance = newUtilityInstance("search");
    state.utilityInstances = [...(state.utilityInstances || []), searchInstance];
  }
  await openSectionDetail(searchInstance.id, item);
}

function renderSettings() {
  const panel = renderTemplate(settingsTemplate);
  applyPaneWeight(panel, "utility:settings");
  wireReaderSettingsControls(panel);
  const userInput = panel.querySelector(".account-user-id");
  const tokenInput = panel.querySelector(".account-session-token");
  const connectButton = panel.querySelector(".account-save");
  const disconnectButton = panel.querySelector(".account-clear");
  const status = panel.querySelector(".connector-status");
  userInput.value = state.account?.userID || "";
  tokenInput.value = state.account?.sessionToken || "";
  status.textContent = activeAccount()
    ? `Connected locally as ${state.account.userID}.`
    : "Not connected in this browser.";
  connectButton.addEventListener("click", async () => {
    state.account = {
      userID: userInput.value.trim(),
      sessionToken: tokenInput.value.trim()
    };
    syncedContent = null;
    saveWorkspaceState();
    status.textContent = "Checking sync...";
    await loadSyncedContent({ force: true });
    renderWorkspace();
  });
  disconnectButton.addEventListener("click", () => {
    state.account = null;
    syncedContent = null;
    saveWorkspaceState();
    renderWorkspace();
  });
  return panel;
}

function wireReaderSettingsControls(panel) {
  const fontSlider = panel.querySelector(".preview-font-slider");
  const spacingSlider = panel.querySelector(".preview-spacing-slider");
  const fontSelect = panel.querySelector(".preview-font-family-select");
  const fontLabels = panel.querySelectorAll(".preview-font-value");
  const spacingLabels = panel.querySelectorAll(".preview-spacing-value");

  const syncControls = () => {
    state.readerSettings = normalizeReaderSettings(state.readerSettings);
    fontLabels.forEach((label) => {
      label.textContent = `${state.readerSettings.fontSize} pt`;
    });
    spacingLabels.forEach((label) => {
      label.textContent = String(state.readerSettings.lineSpacing);
    });
    if (fontSlider) fontSlider.value = String(state.readerSettings.fontSize);
    if (spacingSlider) spacingSlider.value = String(state.readerSettings.lineSpacing);
    if (fontSelect) fontSelect.value = state.readerSettings.fontFamily;
    applyReaderSettings();
  };

  syncControls();

  fontSlider?.addEventListener("input", () => {
    state.readerSettings.fontSize = clampNumber(fontSlider.value, 10, 18, defaultReaderSettings.fontSize);
    syncControls();
    saveWorkspaceState();
  });
  spacingSlider?.addEventListener("input", () => {
    state.readerSettings.lineSpacing = clampNumber(spacingSlider.value, 0, 4, defaultReaderSettings.lineSpacing);
    syncControls();
    saveWorkspaceState();
  });
  fontSelect?.addEventListener("change", () => {
    state.readerSettings.fontFamily = "helvetica";
    syncControls();
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
  if (paneID === "utility:projects" || paneID === paneIDForProjectDetail()) {
    return ["utility:projects", paneIDForProjectDetail()].filter((id) => active.has(id));
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
    pane.style.transition = "none";
    pane.style.transform = `translateX(${deltaX}px)`;
    requestAnimationFrame(() => {
      pane.style.transition = "";
      pane.style.transform = "";
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
        renderWorkspace();
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
        renderWorkspace();
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
  const minimumWidthFor = (pane) => {
    const value = Number.parseFloat(getComputedStyle(pane).minWidth);
    return Number.isFinite(value) ? value : 220;
  };
  const paneData = panes.map((pane) => ({
    id: pane.dataset.paneId,
    pane,
    startWidth: pane.getBoundingClientRect().width,
    minWidth: minimumWidthFor(pane)
  }));
  const startScrollLeft = track.scrollLeft;
  const trackStartRect = track.getBoundingClientRect();
  const previousIndex = paneData.findIndex((pane) => pane.id === previousPaneID);
  const nextIndex = paneData.findIndex((pane) => pane.id === nextPaneID);
  if (previousIndex === -1 || nextIndex === -1) return;
  const rightEdgePane = paneData[paneData.length - 1]?.pane;
  const rightEdgeStartRect = rightEdgePane?.getBoundingClientRect();

  const shrinkFrom = (widths, indexes, requested) => {
    let remaining = requested;
    for (const index of indexes) {
      if (remaining <= 0) break;
      const available = Math.max(0, widths[index] - paneData[index].minWidth);
      const taken = Math.min(available, remaining);
      widths[index] -= taken;
      remaining -= taken;
    }
    return requested - remaining;
  };

  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const widths = paneData.map((pane) => pane.startWidth);
    if (delta > 0) {
      const applied = shrinkFrom(widths, [nextIndex], delta);
      widths[previousIndex] += delta;
      if (delta > applied) {
        track.scrollLeft = startScrollLeft;
      }
    } else if (delta < 0) {
      const requested = Math.abs(delta);
      const applied = shrinkFrom(widths, [previousIndex], requested);
      if (Math.abs(delta) > applied) {
        track.scrollLeft = Math.max(0, startScrollLeft - (requested - applied));
      }
      const rightGroupEdgeWithoutFill = (rightEdgeStartRect?.right ?? trackStartRect.right) - applied;
      if (rightGroupEdgeWithoutFill < trackStartRect.right) {
        widths[nextIndex] += trackStartRect.right - rightGroupEdgeWithoutFill;
      }
    }
    paneData.forEach((pane, index) => {
      state.paneWeights[pane.id] = widths[index];
      applyPaneWeight(pane.pane, pane.id);
    });
  };

  const onUp = (upEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    resizeHandle?.releasePointerCapture?.(upEvent.pointerId);
    track.classList.remove("is-resizing");
    saveWorkspaceState();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function appendPaneSequence(panes) {
  closeActiveCustomSelect();
  document.querySelectorAll(".custom-select-menu[data-floating-select='true']").forEach((menu) => menu.remove());
  const orderedPanes = orderPanes(panes);
  const previousScrollLeft = track.scrollLeft;
  const nodes = [];
  bindPaneDragging(orderedPanes);
  orderedPanes.forEach((pane, index) => {
    if (index > 0) {
      nodes.push(createDivider(orderedPanes[index - 1].dataset.paneId, pane.dataset.paneId));
    }
    nodes.push(pane);
  });
  track.replaceChildren(...nodes);
  track.scrollLeft = Math.min(previousScrollLeft, Math.max(0, track.scrollWidth - track.clientWidth));
}

function scrollPaneIntoView(paneID, behavior = "smooth") {
  const pane = track.querySelector(`.workspace-panel[data-pane-id="${CSS.escape(paneID)}"]`);
  if (!pane) return;
  const paneRect = pane.getBoundingClientRect();
  const trackRect = track.getBoundingClientRect();
  const paneRight = paneRect.right - trackRect.right;
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
  const paneIDs = activePaneIDs();
  normalizePaneWeights(paneIDs);
  setUtilityButtonStates();

  const panes = [];
  if (state.utilities.projects) {
    panes.push(await renderProjects());
    if (state.projectDetail) panes.push(await renderProjectDetail(state.projectDetail));
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

async function renderUtilityWorkspace() {
  const existingPanesByID = new Map(
    Array.from(track.querySelectorAll(".workspace-panel"))
      .filter((pane) => pane.dataset.paneId)
      .map((pane) => [pane.dataset.paneId, pane])
  );
  const existingContentPanes = Array.from(existingPanesByID.values())
    .filter((pane) => {
      const paneID = String(pane.dataset.paneId || "");
      return !paneID.startsWith("utility:") && !paneID.startsWith("section:detail:") && paneID !== paneIDForProjectDetail();
    });
  const paneIDs = activePaneIDs();
  normalizePaneWeights(paneIDs);
  setUtilityButtonStates();

  const panes = [];
  if (state.utilities.projects) {
    panes.push(await renderProjects());
    if (state.projectDetail) panes.push(await renderProjectDetail(state.projectDetail));
  }
  if (state.utilities.archive) {
    panes.push(await renderArchive());
  }
  for (const instance of state.utilityInstances || []) {
    const paneID = paneIDForUtilityInstance(instance);
    const pane = existingPanesByID.get(paneID) || await renderUtilityInstance(instance);
    wireUtilityInstanceActions(pane, instance);
    if (pane?.dataset.paneId) {
      applyPaneWeight(pane, pane.dataset.paneId);
    }
    if (pane) panes.push(pane);
    if (instance.key === "search") {
      const detailID = paneIDForSectionDetail(instance.id);
      const detailState = sectionDetailsBySearch()[instance.id];
      if (detailState) {
        const detailPane = existingPanesByID.get(detailID) || await renderSectionDetail(instance.id, detailState);
        applyPaneWeight(detailPane, detailID);
        panes.push(detailPane);
      }
    }
  }
  if (state.utilities.settings) {
    panes.push(renderSettings());
  }

  existingContentPanes.forEach((pane) => {
    resetEnhancedSelects(pane);
    if (pane.dataset.paneId) {
      applyPaneWeight(pane, pane.dataset.paneId);
    }
    panes.push(pane);
  });

  appendPaneSequence(panes);
  syncAllCommentBoxHeights();
  bindAllReaderCommentScroll();
  enhanceReaderSelects();
  saveWorkspaceState();
}

async function transitionWorkspace(mode = "default") {
  if (mode === "utility") {
    await renderUtilityWorkspace();
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
    movePaneToFront(paneID);
  } else if (key === "projects") {
    state.projectDetail = null;
    delete state.paneWeights[paneIDForProjectDetail()];
    state.paneOrder = (state.paneOrder || []).filter((id) => id !== paneIDForProjectDetail());
  } else if (key === "archive") {
    state.paneOrder = (state.paneOrder || []).filter((id) => id !== "utility:archive");
  }
  saveWorkspaceState();
  await transitionWorkspace("utility");
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
  state.projectDetail = null;
  Object.keys(state.utilities).forEach((key) => {
    state.utilities[key] = false;
  });
  state.utilityInstances = [];
  const readerPaneID = paneIDForReader(reader);
  state.paneOrder = [readerPaneID];
  state.paneWeights = { [readerPaneID]: defaultPaneWidthForID(readerPaneID) };
  saveWorkspaceState();
  await transitionWorkspace();
  track.scrollTo({ left: 0, behavior: "smooth" });
}

async function start() {
  const payload = await api("/code/chapters");
  chapters = payload.chapters || [];
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
  track.addEventListener("scroll", repositionActiveCustomSelect, { passive: true });
  addReaderButton.addEventListener("click", async () => {
    const reader = newReaderState({ chapterID: await firstChapterIDForCode("BC") });
    state.readers.push(reader);
    saveWorkspaceState();
    await transitionWorkspace();
    scrollPaneIntoView(paneIDForReader(reader));
  });
  toggleProjectsButton.addEventListener("click", () => {
    toggleUtilityPane("projects");
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
  await renderWorkspace();
}

start().catch((error) => {
  console.error(error);
  clear(track);
  const panel = renderTemplate(settingsTemplate);
  panel.querySelector(".panel-title").textContent = "Load error";
  const list = panel.querySelector(".settings-list");
  clear(list);
  const item = document.createElement("div");
  item.append(textNode("Could not load the web workspace."), textNode(error.message));
  list.append(item);
  track.append(panel);
});
