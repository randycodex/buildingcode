import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
let activeElement = null;
const collapsedIDs = new Set();
let includeCodeToggle = false;
class Element {
  constructor() { this.children = []; this.events = {}; this.dataset = {}; this.className = ""; this.style = { removeProperty() {} }; this.scrollTop = 123; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute() {}
  addEventListener(name, fn) { this.events[name] = fn; }
  getBoundingClientRect() { return { height: 300 }; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.className?.split(" ").includes(selector.slice(1)) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return selector === ".is-collapsed" && collapsedIDs.has(this.sectionID) ? this : null; }
  focus(options) { activeElement = this; this.focusOptions = options; }
}
const project = { id: "project", folderType: "project" };
const records = Array.from({ length: 1000 }, (_, index) => ({ id: `saved-${index}`, sectionID: index + 1, codeVersion: "2022", chapterNumber: "1", sectionNumber: String(index + 1), title: `Section ${index + 1}` }));
const summary = { projects: [project], annotations: [], savedItems: records, projectSections: records.map(item => ({ ...item, folderClientID: project.id })) };
const elements = new Map();
const panel = { isConnected: true, querySelector(selector) { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); } };
let hydrated = [], rendered = [], selectionRecords = [], changed;
const instance = { selectedFolderID: project.id, folderQuery: "", showAllSaved: false, organizeUnassigned: false, collapsedCodePrefixes: [] };
const context = vm.createContext({
  document: { createElement: () => new Element(), get activeElement() { return activeElement; } }, savedItemsPageSize: 48,
  loadSyncedContent: async () => ({ status: "connected" }), currentContentSummary: () => summary,
  projectsWithOrganizationAccess: async projects => projects, reconcileProjectStudioWithSavedFolders: async () => {},
  renderSavedFolderContext: async () => project, renderSavedProjects() {}, consolidatedSavedAnnotations: () => [],
  mergeSavedColumnItems: items => items.map(item => ({ ...item, savedColumnKind: "bookmark" })),
  renderUnassignedEvidenceNotice: () => new Set(), savedEvidenceKey: item => `${item.codeVersion}:${item.sectionID}:${item.blockID || ""}`,
  projectSectionBelongsToProject: (item, project) => item.folderClientID === project.id,
  syncCodeVersion: value => value,
  normalizeAnnotationBlockID: value => String(value || "").trim(),
  hydrateSavedColumnItems: async items => {
    hydrated.push(...items.map(item => item.sectionID));
    return items.map(item => ({ ...item, savedContentComparisonText: item.sectionID === 1000 ? "Late remote clause" : "Ordinary text", previewText: `Canonical text ${item.sectionID}` }));
  },
  mergeEquivalentSavedColumnRows: items => items,
  createSavedBulkSelectionController(_panel, items) { selectionRecords = items; return { beginRender() {} }; },
  searchCodeFilterOptions: () => [{ prefix: "BC" }], codeDisplayLabel: value => value, savedItemTitle: item => item.title,
  projectRecordID: item => item.id, workspaceProject: () => project, folderIsProject: () => true, projectDetailKey: item => item.id,
  savedEvidenceMatchesQuery: (item, query) => !query || item.savedContentComparisonText?.toLowerCase().includes(query.toLowerCase()),
  clear: element => { element.children = []; }, renderSavedItemsByCode(content, items) {
    rendered = items;
    if (includeCodeToggle) { const toggle = new Element(); toggle.className = "saved-code-toggle"; content.append(toggle); }
    items.forEach(item => {
      const row = new Element(); row.className = "saved-section-row"; row.sectionID = item.sectionID;
      row.dataset.savedEvidenceKey = context.savedEvidenceKey(item);
      const button = new Element(); button.className = "saved-section-open"; button.sectionID = item.sectionID;
      row.append(button); content.append(row);
    });
  },
  renderSavedFilters(_panel, _instance, _items, onChange) { changed = onChange; },
  animateSavedRowRemoval() {}, refreshSavedPanelInPlace() {},
});
vm.runInContext(["compareSavedCodeOrder", "sortSavedItems", "mergeEquivalentSavedColumnRows", "resolveSavedSearchPage", "performSavedPanelHydration"].map(actual).join("\n"), context);
await context.performSavedPanelHydration(panel, instance, "saved:project");
assert.equal(rendered.length, 48);
assert.equal(hydrated.length, 49, "Initial Project page loads only 48 rows plus a has-more sentinel");
assert.equal(selectionRecords.length, 1000, "Pagination cannot truncate the complete eligible selection collection");
assert.equal(panel.querySelector(".saved-column-scroll").scrollTop, 123);
const footer = panel.querySelector(".saved-content").children.at(-1);
assert.equal(footer.children[1].textContent, "Show more");
footer.children[1].focus();
footer.children[1].events.click();
for (let i = 0; i < 25; i++) await Promise.resolve();
assert.equal(rendered.length, 96);
assert.equal(activeElement.sectionID, 49, "Expanding retains keyboard focus on the first newly exposed row");
assert.equal(activeElement.focusOptions.preventScroll, true);
assert.equal(hydrated.length, 97, "Show more reuses prior hydrated rows instead of fetching them again");
instance.folderQuery = "late remote";
await panel.__applySavedView();
assert.equal(rendered.length, 1);
assert.equal(rendered[0].sectionID, 1000, "Project search reaches source text beyond its first page");
assert.equal(hydrated.length, 1000);
instance.folderQuery = "";
await panel.__applySavedView();
assert.equal(rendered.length, 48, "Changing the search resets the visible page, retaining body reuse");
assert.equal(hydrated.length, 1000);

let continueSearch = true, resolveBatch;
const pending = context.resolveSavedSearchPage({ candidates: records, limit: 48, batchSize: 48,
  hydrateItems: () => new Promise(resolve => { resolveBatch = resolve; }), shouldContinue: () => continueSearch });
continueSearch = false;
resolveBatch(records.slice(0, 48));
assert.equal((await pending).cancelled, true, "An obsolete query cannot publish its first asynchronous batch");
assert.match(actual("createSavedBulkSelectionController"), /register\(row, item\)[\s\S]*?recordByID\.set\(id, item\)/,
  "Bulk actions must use the canonical hydrated text from the displayed row");
console.log("Project Saved pagination passed: 1,000 initial body reads/rows reduced to 49 reads and 48 rows; 96-row expansion uses 97 total reads; late-source-text search, full selection scope, query cancellation and scroll preservation.");

// Legacy Project saves receive canonical ordering before choosing the first page.
records[999].chapterNumber = ""; records[999].sectionNumber = "";
const normalHydrate = context.hydrateSavedColumnItems;
context.hydrateSavedColumnItems = async items => (await normalHydrate(items)).map(item => item.sectionID === 1000 ? { ...item, chapterNumber: "1", sectionNumber: "0" } : item);
hydrated = [];
await context.performSavedPanelHydration(panel, instance, "saved:project");
assert.equal(rendered[0].sectionID, 1000, "A legacy row resolved to an earlier canonical section must occur on the first page");
assert.equal(hydrated.filter(id => id === 1000).length, 1, "Canonical metadata enrichment also reuses the resolved body");
assert.equal(hydrated.length, 49);
records[999].chapterNumber = "1"; records[999].sectionNumber = "1000";
context.hydrateSavedColumnItems = normalHydrate;
await context.performSavedPanelHydration(panel, instance, "saved:project");
const expand = () => { const button = panel.querySelector(".saved-content").children.at(-1).children[1]; button.focus(); button.events.click(); return button; };
const settle = async () => { for (let index = 0; index < 40; index++) await Promise.resolve(); };
collapsedIDs.add(49); expand(); await settle();
assert.equal(activeElement.sectionID, 50, "Expansion skips a newly exposed row in a collapsed code group");
const searchFocus = new Element(); expand(); searchFocus.focus(); await settle();
assert.equal(activeElement, searchFocus, "Expansion must not steal focus moved to another control while hydration was pending");
expand(); instance.folderQuery = "late remote"; searchFocus.focus(); await panel.__applySavedView(); await settle();
assert.equal(activeElement, searchFocus, "An obsolete expansion cannot reclaim focus from a newer query");
instance.folderQuery = ""; await panel.__applySavedView();
expand(); panel.isConnected = false; searchFocus.focus(); await settle();
assert.equal(activeElement, searchFocus, "An unmounted panel cannot move keyboard focus");
panel.isConnected = true;
console.log("Project Saved pagination also passed canonical legacy-order recovery and keyboard focus preservation across expansion, collapsed groups, query changes, moved focus and panel removal.");

// Merging a bookmark/annotation pair across the initial batch boundary must
// fill the visible page from later candidates instead of truncating it.
const duplicateCandidates = records.slice(0, 50).map(item => ({ ...item, savedColumnKind: "bookmark", blockID: "paragraph", previewText: "Exact same text" }));
duplicateCandidates.splice(48, 0, { ...duplicateCandidates[0], id: "annotation", savedColumnKind: "annotation", noteBody: "Retained note" });
const duplicatePage = await context.resolveSavedSearchPage({ candidates: duplicateCandidates, limit: 48, batchSize: 48,
  normalizeMatches: context.mergeEquivalentSavedColumnRows });
assert.equal(duplicatePage.items.length, 48); assert.equal(duplicatePage.hasMore, true);
assert.equal(duplicatePage.scannedCount, 50); assert.equal(duplicatePage.items[0].noteBody, "Retained note");
const completePage = await context.resolveSavedSearchPage({ candidates: duplicateCandidates, limit: 96, batchSize: 48,
  normalizeMatches: context.mergeEquivalentSavedColumnRows });
assert.equal(completePage.items.length, 50); assert.equal(completePage.hasMore, false);

// The last expansion has no replacement Show more control. If its rows are
// collapsed, keyboard focus still lands on the visible code-group toggle.
includeCodeToggle = true; collapsedIDs.clear(); instance.folderQuery = "";
summary.savedItems = records.slice(0, 60);
await context.performSavedPanelHydration(panel, instance, "saved:project");
for (let id = 49; id <= 60; id++) collapsedIDs.add(id);
expand(); await new Promise(resolve => setImmediate(resolve));
assert.equal(rendered.length, 60); assert.equal(activeElement.className, "saved-code-toggle");
console.log("Saved page boundary normalization and final collapsed-page focus fallback passed.");
