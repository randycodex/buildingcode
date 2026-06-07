const workspaceKey = "permitext:webWorkspace:v1";
const track = document.querySelector("#panel-track");
const addReaderButton = document.querySelector("#add-reader");
const readerTemplate = document.querySelector("#reader-template");
const searchTemplate = document.querySelector("#search-template");
const savedTemplate = document.querySelector("#saved-template");
const settingsTemplate = document.querySelector("#settings-template");

let chapters = [];
let state = loadWorkspaceState();
let searchTimer = null;

function loadWorkspaceState() {
  try {
    const saved = JSON.parse(localStorage.getItem(workspaceKey) || "{}");
    return {
      readers: Array.isArray(saved.readers) && saved.readers.length > 0 ? saved.readers : [newReaderState()],
      searchQuery: saved.searchQuery || "",
      searchResultReader: saved.searchResultReader || null
    };
  } catch {
    return {
      readers: [newReaderState()],
      searchQuery: "",
      searchResultReader: null
    };
  }
}

function saveWorkspaceState() {
  localStorage.setItem(workspaceKey, JSON.stringify(state));
}

function newReaderState(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    chapterID: "",
    sectionID: "",
    sectionNumber: "",
    title: "Reader",
    selectorOpen: true,
    ...overrides
  };
}

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function textNode(value) {
  return document.createTextNode(value ?? "");
}

function clear(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function setTitle(panel, reader) {
  const title = panel.querySelector(".panel-title");
  if (reader.sectionNumber) {
    title.textContent = `${reader.sectionNumber} ${reader.title || ""}`.trim();
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

function emptyReader(content, title = "Choose a section", message = "Use Section to pick a chapter and a code section.") {
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

function sectionTitleFromID(sectionID, chapter) {
  return chapter?.sections?.find((section) => section.id === sectionID) || null;
}

async function populateReaderSelectors(panel, reader) {
  const chapterSelect = panel.querySelector(".chapter-select");
  const sectionSelect = panel.querySelector(".section-select");
  clear(chapterSelect);
  clear(sectionSelect);

  const blankChapter = document.createElement("option");
  blankChapter.value = "";
  blankChapter.textContent = "Select a chapter";
  chapterSelect.append(blankChapter);
  chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = `Chapter ${chapter.chapterNumber}: ${chapter.title}`;
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
    option.textContent = `${section.sectionNumber} ${section.title}`;
    sectionSelect.append(option);
  });
  sectionSelect.value = reader.sectionID || "";
}

async function renderSectionContent(panel, reader) {
  const content = panel.querySelector(".reader-content");
  if (!reader.sectionID) {
    emptyReader(content);
    return;
  }

  clear(content);
  const { section } = await api(`/code/sections/${reader.sectionID}`);
  const meta = document.createElement("section");
  meta.className = "reader-meta";
  const eyebrow = document.createElement("p");
  eyebrow.textContent = `Chapter ${section.chapterNumber || ""}`;
  const heading = document.createElement("h3");
  heading.textContent = `${reader.sectionNumber || section.sectionID} ${reader.title || ""}`.trim();
  meta.append(eyebrow, heading);
  content.append(meta);

  (section.blocks || []).forEach((block) => {
    const paragraph = document.createElement("p");
    paragraph.className = "section-block";
    paragraph.textContent = block.plainText || "";
    content.append(paragraph);
  });
}

async function renderReader(reader, options = {}) {
  const panel = readerTemplate.content.firstElementChild.cloneNode(true);
  const selector = panel.querySelector(".selector-stack");
  const closeButton = panel.querySelector(".reader-close");
  const pickButton = panel.querySelector(".reader-pick");
  const chapterSelect = panel.querySelector(".chapter-select");
  const sectionSelect = panel.querySelector(".section-select");

  panel.dataset.readerId = reader.id;
  selector.hidden = !reader.selectorOpen;
  setTitle(panel, reader);

  if (options.isSearchResult) {
    panel.querySelector(".panel-kind").textContent = "Search Result";
    pickButton.hidden = true;
    closeButton.hidden = false;
  } else {
    closeButton.hidden = state.readers.length <= 1;
  }

  pickButton.addEventListener("click", () => {
    reader.selectorOpen = !reader.selectorOpen;
    saveWorkspaceState();
    renderWorkspace();
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
    reader.sectionID = "";
    reader.sectionNumber = "";
    reader.title = "Reader";
    reader.selectorOpen = true;
    saveWorkspaceState();
    await renderWorkspace();
  });

  sectionSelect.addEventListener("change", async () => {
    reader.sectionID = sectionSelect.value;
    if (reader.sectionID) {
      const { chapter } = await api(`/code/chapters/${reader.chapterID}`);
      const summary = sectionTitleFromID(reader.sectionID, chapter);
      reader.sectionNumber = summary?.sectionNumber || "";
      reader.title = summary?.title || "Reader";
      reader.selectorOpen = false;
    }
    saveWorkspaceState();
    await renderWorkspace();
  });

  if (options.isSearchResult && !reader.sectionID) {
    emptyReader(
      panel.querySelector(".reader-content"),
      "No active search result",
      "Pick a search result to load it here. Clearing Search keeps this reader empty until you close it."
    );
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
    row.type = "button";
    const heading = document.createElement("strong");
    heading.textContent = `${result.sectionNumber} ${result.title}`.trim();
    const snippet = document.createElement("p");
    appendHighlighted(snippet, result.snippet, query);
    row.append(heading, snippet);
    row.addEventListener("click", () => {
      state.searchResultReader = {
        id: "search-result-reader",
        chapterID: result.chapterID,
        sectionID: result.id,
        sectionNumber: result.sectionNumber,
        title: result.title,
        selectorOpen: false
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

async function renderWorkspace() {
  clear(track);
  for (const reader of state.readers) {
    track.append(await renderReader(reader));
  }
  track.append(await renderSearch());
  if (state.searchResultReader) {
    track.append(await renderReader(state.searchResultReader, { isSearchResult: true }));
  }
  track.append(renderTemplate(savedTemplate));
  track.append(renderTemplate(settingsTemplate));
}

async function start() {
  const payload = await api("/code/chapters");
  chapters = payload.chapters || [];
  addReaderButton.addEventListener("click", () => {
    const reader = newReaderState();
    state.readers.push(reader);
    saveWorkspaceState();
    renderWorkspace().then(() => {
      document.querySelector(`[data-reader-id="${reader.id}"]`)?.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest"
      });
    });
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
