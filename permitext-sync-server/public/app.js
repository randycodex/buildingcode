const workspaceKey = "permitext:webWorkspace:v1";
const track = document.querySelector("#panel-track");
const addReaderButton = document.querySelector("#add-reader");
const collapseReadersButton = document.querySelector("#collapse-readers");
const toggleSearchButton = document.querySelector("#toggle-search");
const toggleSavedButton = document.querySelector("#toggle-saved");
const toggleAnalysisButton = document.querySelector("#toggle-analysis");
const toggleSettingsButton = document.querySelector("#toggle-settings");
const readerTemplate = document.querySelector("#reader-template");
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

const defaultReaderSettings = {
  fontSize: 12,
  lineSpacing: 1,
  fontFamily: "helvetica"
};

let chapters = [];
let state = loadWorkspaceState();
let searchTimer = null;
let syncedContent = null;
let syncLoadPromise = null;

applyReaderSettings();

function loadWorkspaceState() {
  try {
    const saved = JSON.parse(localStorage.getItem(workspaceKey) || "{}");
    return {
      readers: Array.isArray(saved.readers) && saved.readers.length > 0 ? saved.readers : [newReaderState()],
      searchQuery: saved.searchQuery || "",
      searchResultReader: saved.searchResultReader || null,
      utilities: {
        search: Boolean(saved.utilities?.search),
        saved: Boolean(saved.utilities?.saved),
        analysis: Boolean(saved.utilities?.analysis),
        settings: Boolean(saved.utilities?.settings)
      },
      account: saved.account && typeof saved.account === "object" ? saved.account : null,
      paneWeights: saved.paneWeights && typeof saved.paneWeights === "object" ? saved.paneWeights : {},
      recentChaptersByCode: saved.recentChaptersByCode && typeof saved.recentChaptersByCode === "object" ? saved.recentChaptersByCode : {},
      readerSettings: normalizeReaderSettings(saved.readerSettings)
    };
  } catch {
    return {
      readers: [newReaderState()],
      searchQuery: "",
      searchResultReader: null,
      utilities: { search: false, saved: false, analysis: false, settings: false },
      account: null,
      paneWeights: {},
      recentChaptersByCode: {},
      readerSettings: { ...defaultReaderSettings }
    };
  }
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
    ...overrides
  };
}

function paneIDForReader(reader, options = {}) {
  return options.isSearchResult ? "reader:search-result" : `reader:${reader.id}`;
}

function activePaneIDs() {
  const ids = [];
  if (state.utilities.search) ids.push("utility:search");
  if (state.utilities.saved) ids.push("utility:saved");
  if (state.utilities.analysis) ids.push("utility:analysis");
  if (state.utilities.settings) ids.push("utility:settings");
  if (state.searchResultReader) ids.push("reader:search-result");
  state.readers.forEach((reader) => ids.push(paneIDForReader(reader)));
  return ids;
}

function normalizePaneWeights(ids) {
  const current = state.paneWeights || {};
  const existingWeights = ids.map((id) => Number(current[id])).filter((value) => Number.isFinite(value) && value > 0);
  const fallbackWeight = existingWeights.length > 0
    ? existingWeights.reduce((sum, value) => sum + value, 0) / existingWeights.length
    : 1;
  state.paneWeights = ids.reduce((weights, id) => {
    const value = Number(current[id]);
    weights[id] = Number.isFinite(value) && value > 0 ? value : fallbackWeight;
    return weights;
  }, {});
}

function applyPaneWeight(panel, paneID) {
  panel.dataset.paneId = paneID;
  panel.style.flex = `${state.paneWeights[paneID] || 1} 1 0`;
}

function setUtilityButtonStates() {
  toggleSearchButton.setAttribute("aria-pressed", String(state.utilities.search));
  toggleSavedButton.setAttribute("aria-pressed", String(state.utilities.saved));
  toggleAnalysisButton.setAttribute("aria-pressed", String(state.utilities.analysis));
  toggleSettingsButton.setAttribute("aria-pressed", String(state.utilities.settings));
  if (collapseReadersButton) {
    collapseReadersButton.disabled = state.readers.length <= 1;
    collapseReadersButton.setAttribute("aria-disabled", String(state.readers.length <= 1));
  }
}

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
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
  return chapter?.sections?.find((section) => section.id === sectionID) || null;
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
  menu.hidden = true;

  const syncTrigger = () => {
    trigger.textContent = select.options[select.selectedIndex]?.textContent || "";
  };

  const closeMenu = () => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
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

  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", () => {
    const willOpen = menu.hidden;
    document.querySelectorAll(".custom-select-menu").forEach((openMenu) => {
      if (openMenu !== menu) openMenu.hidden = true;
    });
    renderOptions();
    menu.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", String(willOpen));
  });

  select.addEventListener("change", () => {
    syncTrigger();
    renderOptions();
  });

  document.addEventListener("click", (event) => {
    if (!custom.contains(event.target)) closeMenu();
  });

  syncTrigger();
  renderOptions();
  custom.append(trigger, menu);
  select.insertAdjacentElement("afterend", custom);
}

function enhanceReaderSelects() {
  track.querySelectorAll(".reader-panel select").forEach(enhanceSelect);
}

function resetEnhancedSelects(scope) {
  scope.querySelectorAll("select.native-select-hidden").forEach((select) => {
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
  const chapterPayload = await api(`/code/chapters?code=${encodeURIComponent(reader.codePrefix)}`);
  const readerChapters = chapterPayload.chapters || [];
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

  const { chapter } = await api(`/code/chapters/${reader.chapterID}`);
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
  if (!reader.chapterID) {
    blankReader(content);
    renderSectionComments(commentsList, []);
    return;
  }

  clear(content);
  const { chapter } = await api(`/code/chapters/${reader.chapterID}?include=body`);
  const sections = chapter.sections || [];
  const groupLabelsByFirstSection = groupLabelsForChapter(chapter);

  sections.forEach((section) => {
    const sectionWrapper = document.createElement("section");
    sectionWrapper.className = "chapter-section";
    sectionWrapper.dataset.sectionId = String(section.id);

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
      content.querySelector(`[data-section-id="${CSS.escape(String(reader.sectionID))}"]`)?.scrollIntoView({ block: "start" });
    });
  }
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
    try {
      const sectionPayload = {
        sectionID: section.id,
        sectionNumber: section.sectionNumber,
        title: section.title
      };
      await pushMutation(shouldRemove ? deletedSavedMutationForSection(sectionPayload) : savedMutationForSection(sectionPayload));
      bookmarkButton.classList.toggle("is-saved", !shouldRemove);
      bookmarkButton.setAttribute("aria-pressed", String(!shouldRemove));
      bookmarkButton.title = shouldRemove ? "Save subsection" : "Saved";
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
  wrapper.append(button, bookmarkButton, resizer, editor);
  return wrapper;
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

function bindAllReaderCommentScroll() {
  track.querySelectorAll(".reader-panel").forEach(bindReaderCommentScroll);
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
  const saveButton = panel.querySelector(".reader-save");
  const commentsButton = panel.querySelector(".reader-comments-toggle");
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

  if (options.isSearchResult) {
    closeButton.hidden = false;
  } else {
    closeButton.hidden = state.readers.length <= 1;
  }

  populateCodeSelect(panel, reader);
  codeSelect.addEventListener("change", async () => {
    reader.codePrefix = codeSelect.value || "BC";
    reader.chapterID = state.recentChaptersByCode?.[reader.codePrefix] || "";
    reader.sectionID = "";
    reader.sectionNumber = "";
    reader.title = "Reader";
    saveWorkspaceState();
    await refreshReaderContent(panel, reader);
  });

  saveButton.hidden = !reader.sectionID;
  saveButton.disabled = !reader.sectionID;

  saveButton.addEventListener("click", async () => {
    if (!reader.sectionID) return;
    saveButton.disabled = true;
    const originalLabel = saveButton.textContent;
    saveButton.textContent = "Saving";
    try {
      await pushMutation(savedMutationForReader(reader));
      saveButton.textContent = "Saved";
      if (state.utilities.saved) {
        await renderWorkspace();
      }
    } catch (error) {
      saveButton.textContent = "Connect sync";
      saveButton.title = error.message;
    } finally {
      setTimeout(() => {
        saveButton.disabled = !reader.sectionID;
        saveButton.textContent = originalLabel;
      }, 1600);
    }
  });

  closeButton.addEventListener("click", () => {
    if (options.isSearchResult) {
      state.searchResultReader = null;
    } else {
      state.readers = state.readers.filter((item) => item.id !== reader.id);
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
      const { chapter } = await api(`/code/chapters/${reader.chapterID}`);
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

async function renderSearch() {
  const panel = searchTemplate.content.firstElementChild.cloneNode(true);
  const input = panel.querySelector(".search-input");
  applyPaneWeight(panel, "utility:search");
  input.value = state.searchQuery || "";

  input.addEventListener("input", () => {
    state.searchQuery = input.value;
    if (!state.searchQuery.trim() && state.searchResultReader) {
      state.searchResultReader = { ...state.searchResultReader, sectionID: "", sectionNumber: "", title: "Search Result" };
    }
    saveWorkspaceState();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (!state.searchQuery.trim() && state.searchResultReader) {
        renderWorkspace();
        return;
      }
      renderSearchResults(panel);
    }, 250);
  });

  await renderSearchResults(panel);
  return panel;
}

async function renderSearchResults(panel) {
  const results = panel.querySelector(".search-results");
  const query = state.searchQuery.trim();
  if (query.length < 2) {
    renderSearchPlaceholder(results, {
      title: "Search the code",
      body: "Type at least two characters to search section numbers, titles, and body text."
    });
    return;
  }

  renderSearchPlaceholder(results, { title: "Searching", body: "Checking section titles and code text." });
  const payload = await api(`/code/search?q=${encodeURIComponent(query)}`);
  clear(results);

  if (payload.results.length === 0) {
    renderSearchPlaceholder(results, { title: "No results", body: "Try a shorter phrase or a section number." });
    return;
  }

  payload.results.forEach((result) => {
    const row = document.createElement("button");
    row.className = "result-row";
    row.classList.add(`code-theme-${codeTheme(result.codePrefix || "BC")}`);
    row.type = "button";
    const heading = document.createElement("strong");
    heading.textContent = sectionDisplayTitle(result.sectionNumber, result.title);
    const snippet = document.createElement("p");
    appendHighlighted(snippet, result.snippet, query);
    row.append(heading, snippet);
    row.addEventListener("click", () => {
      state.searchResultReader = {
        id: "search-result-reader",
        codePrefix: result.codePrefix || "BC",
        chapterID: result.chapterID,
        sectionID: result.id,
        sectionNumber: result.sectionNumber,
        title: result.title
      };
      saveWorkspaceState();
      renderWorkspace().then(() => {
        document.querySelector('[data-reader-id="search-result-reader"]')?.scrollIntoView({
          behavior: "smooth",
          inline: "start",
          block: "nearest"
        });
      });
    });
    results.append(row);
  });
}

function renderTemplate(template) {
  return template.content.firstElementChild.cloneNode(true);
}

function renderUtility(template, paneID) {
  const panel = renderTemplate(template);
  applyPaneWeight(panel, paneID);
  return panel;
}

async function renderSaved() {
  const panel = renderTemplate(savedTemplate);
  applyPaneWeight(panel, "utility:saved");
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

  const { projects, savedItems, annotations, projectSections } = data.summary;
  appendSectionLabel(content, "Projects");
  if (projects.length === 0) {
    appendMutedRow(content, "No projects", "Projects synced from iOS will appear here.");
  } else {
    projects.slice(0, 12).forEach((project) => {
      const count = projectSections.filter((item) =>
        item.folderClientID === project.clientID ||
        item.folderClientID === project.id ||
        item.localFolderID === project.localFolderID
      ).length;
      const card = document.createElement("article");
      card.className = "project-card";
      const body = document.createElement("div");
      const heading = document.createElement("h3");
      heading.textContent = project.name || project.title || "Project";
      const description = document.createElement("p");
      description.textContent = project.description || "Private project workspace.";
      body.append(heading, description);
      const meta = document.createElement("div");
      meta.className = "project-meta";
      [count === 1 ? "1 saved" : `${count} saved`, project.sortMode || "Code order"].forEach((label) => {
        const pill = document.createElement("span");
        pill.textContent = label;
        meta.append(pill);
      });
      card.append(body, meta);
      content.append(card);
    });
  }

  appendSectionLabel(content, "Saved sections");
  if (savedItems.length === 0) {
    appendMutedRow(content, "No saved sections", "Saved sections synced from iOS or saved in this web workspace will appear here.");
  } else {
    savedItems.slice(0, 24).forEach((item) => {
      const row = document.createElement("button");
      row.className = "saved-row saved-row-button";
      row.type = "button";
      const title = document.createElement("strong");
      title.textContent = sectionDisplayTitle(item.sectionNumber || item.sectionID, item.title, "Saved section");
      const subtitle = document.createElement("span");
      subtitle.textContent = item.updatedAt ? `Updated ${new Date(item.updatedAt).toLocaleString()}` : "Synced saved section";
      row.append(title, subtitle);
      row.addEventListener("click", () => openSectionInReader(item));
      content.append(row);
    });
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

async function openSectionInReader(item) {
  const sectionID = String(item.sectionID || item.id || "");
  if (!sectionID) return;
  let summary = null;
  try {
    const search = await api(`/code/search?q=${encodeURIComponent(item.sectionNumber || sectionID)}`);
    summary = (search.results || []).find((result) => String(result.id) === sectionID) || null;
  } catch {
    summary = null;
  }
  state.readers.push(newReaderState({
    chapterID: item.chapterID || summary?.chapterID || "",
    sectionID,
    sectionNumber: item.sectionNumber || summary?.sectionNumber || "",
    title: item.title || summary?.title || "Saved section"
  }));
  saveWorkspaceState();
  await renderWorkspace();
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
  divider.role = "separator";
  divider.tabIndex = 0;
  divider.setAttribute("aria-orientation", "vertical");
  divider.addEventListener("pointerdown", (event) => startPaneResize(event, previousPaneID, nextPaneID));
  return divider;
}

function startPaneResize(event, previousPaneID, nextPaneID) {
  const previousPane = track.querySelector(`[data-pane-id="${CSS.escape(previousPaneID)}"]`);
  const nextPane = track.querySelector(`[data-pane-id="${CSS.escape(nextPaneID)}"]`);
  if (!previousPane || !nextPane) return;

  event.preventDefault();
  const startX = event.clientX;
  const previousRect = previousPane.getBoundingClientRect();
  const nextRect = nextPane.getBoundingClientRect();
  const totalWidth = previousRect.width + nextRect.width;
  const minimumWidth = Math.min(220, Math.max(80, totalWidth * 0.25), totalWidth / 2 - 1);

  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const nextPreviousWidth = Math.min(Math.max(previousRect.width + delta, minimumWidth), totalWidth - minimumWidth);
    const nextNextWidth = totalWidth - nextPreviousWidth;
    state.paneWeights[previousPaneID] = nextPreviousWidth;
    state.paneWeights[nextPaneID] = nextNextWidth;
    previousPane.style.flex = `${nextPreviousWidth} 1 0`;
    nextPane.style.flex = `${nextNextWidth} 1 0`;
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    saveWorkspaceState();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function appendPaneSequence(panes) {
  panes.forEach((pane, index) => {
    if (index > 0) {
      track.append(createDivider(panes[index - 1].dataset.paneId, pane.dataset.paneId));
    }
    track.append(pane);
  });
}

async function renderWorkspace() {
  clear(track);
  const paneIDs = activePaneIDs();
  normalizePaneWeights(paneIDs);
  setUtilityButtonStates();

  const panes = [];
  if (state.utilities.search) {
    panes.push(await renderSearch());
  }
  if (state.utilities.saved) {
    panes.push(await renderSaved());
  }
  if (state.utilities.analysis) {
    panes.push(renderUtility(analysisTemplate, "utility:analysis"));
  }
  if (state.utilities.settings) {
    panes.push(renderSettings());
  }
  if (state.searchResultReader) {
    panes.push(await renderReader(state.searchResultReader, { isSearchResult: true }));
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

async function transitionWorkspace(mode = "default") {
  await renderWorkspace();
}

async function start() {
  const payload = await api("/code/chapters");
  chapters = payload.chapters || [];
  addReaderButton.addEventListener("click", () => {
    const reader = newReaderState({ chapterID: state.recentChaptersByCode?.BC || "" });
    state.readers.push(reader);
    saveWorkspaceState();
    transitionWorkspace();
  });
  collapseReadersButton?.addEventListener("click", () => {
    if (state.readers.length <= 1) return;
    state.readers = [state.readers[0] || newReaderState({ chapterID: state.recentChaptersByCode?.BC || "" })];
    saveWorkspaceState();
    transitionWorkspace();
  });
  toggleSearchButton.addEventListener("click", () => {
    const willOpen = !state.utilities.search;
    state.utilities.search = willOpen;
    saveWorkspaceState();
    transitionWorkspace(willOpen ? "open" : "close");
  });
  toggleSavedButton.addEventListener("click", () => {
    const willOpen = !state.utilities.saved;
    state.utilities.saved = willOpen;
    saveWorkspaceState();
    transitionWorkspace(willOpen ? "open" : "close");
  });
  toggleAnalysisButton.addEventListener("click", () => {
    const willOpen = !state.utilities.analysis;
    state.utilities.analysis = willOpen;
    saveWorkspaceState();
    transitionWorkspace(willOpen ? "open" : "close");
  });
  toggleSettingsButton.addEventListener("click", () => {
    const willOpen = !state.utilities.settings;
    state.utilities.settings = willOpen;
    saveWorkspaceState();
    transitionWorkspace(willOpen ? "open" : "close");
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
