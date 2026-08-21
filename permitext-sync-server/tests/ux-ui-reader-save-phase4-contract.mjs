import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverRoot = new URL("../", import.meta.url);
const [webClient, webStyles] = await Promise.all([
  readFile(new URL("public/app.js", serverRoot), "utf8"),
  readFile(new URL("public/styles.css", serverRoot), "utf8")
]);

function sourceBetween(start, end) {
  const startIndex = webClient.indexOf(start);
  const endIndex = webClient.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0, `Missing source boundary: ${start}`);
  assert(endIndex > startIndex, `Missing source boundary: ${end}`);
  return webClient.slice(startIndex, endIndex);
}

function cssRule(selector) {
  const startIndex = webStyles.indexOf(`${selector} {`);
  const endIndex = webStyles.indexOf("\n}", startIndex);
  assert(startIndex >= 0, `Missing CSS selector: ${selector}`);
  assert(endIndex > startIndex, `Unterminated CSS selector: ${selector}`);
  return webStyles.slice(startIndex, endIndex + 2);
}

const readerSave = sourceBetween(
  "async function saveReaderPassage(panel, section, reader, target, options = {})",
  "\nfunction renderInlineCommentBox"
);
assert.match(readerSave, /persistSectionBookmark\(payload, true/);
assert.match(readerSave, /showReaderSaveConfirmation\(panel, payload, options\)/);
assert.doesNotMatch(readerSave, /activeProject|persistSectionInProject/);

const searchResults = sourceBetween(
  "function appendSearchResultGroups(results, searchResults, query, searchInstance)",
  "\nfunction appendSearchLoadMore"
);
assert.match(searchResults, /saveButton\.className = "search-result-save"/);
assert.match(searchResults, /persistSectionBookmark\(detail, !shouldRemove/);
assert.match(searchResults, /showReaderSaveConfirmation\(results\.closest\("\.search-panel"\), detail/);
assert.match(searchResults, /confirmSectionBookmarkRemoval\(results\.closest\("\.search-panel"\)\)/);
assert.match(searchResults, /sourceSurface: "search"/);

const sectionDetail = sourceBetween(
  "async function renderSectionDetail(searchID, detail)",
  "\nfunction renderTemplate"
);
const sectionDetailSaveStart = sectionDetail.indexOf('saveButton.addEventListener("click", async () => {');
const sectionDetailSaveEnd = sectionDetail.indexOf("\n  heading.addEventListener", sectionDetailSaveStart);
assert(sectionDetailSaveStart >= 0 && sectionDetailSaveEnd > sectionDetailSaveStart);
const sectionDetailSave = sectionDetail.slice(sectionDetailSaveStart, sectionDetailSaveEnd);
assert.match(sectionDetailSave, /persistSectionBookmark\(sectionPayload, true/);
assert.match(sectionDetailSave, /showReaderSaveConfirmation\(panel, sectionPayload/);
assert.match(sectionDetailSave, /confirmSectionBookmarkRemoval\(panel\)/);
assert.doesNotMatch(sectionDetailSave, /showReaderNotesProjectPicker\(notes, sectionPayload\)/);

assert.match(webClient, /message\.textContent = "Saved"/);
assert.match(webClient, /projectButton\.textContent = "Add to Project"/);
assert.match(webClient, /sheet\.setAttribute\("role", "region"\)/);
assert.doesNotMatch(webClient, /section-save-project-sheet[\s\S]{0,260}aria-modal/);
assert.match(webClient, /if \(event\.key !== "Escape"\) return;[\s\S]*?closeSectionSaveProjectSheet\(panel, focusTarget\)/);
assert.match(webClient, /onClose: \(\) => closeSectionSaveProjectSheet\(panel, focusTarget\)/);
assert.match(webClient, /if \(focusTarget\?\.isConnected\) focusTarget\.focus/);

assert.equal(
  (webClient.match(/confirmSectionBookmarkRemoval\(/g) || []).length,
  4,
  "Reader, Search, and Search detail must share the same saved-passage removal warning."
);
assert.match(webClient, /saved \? "Remove from Saved" : "Save passage"/);
assert.match(webClient, /This removes the passage from Saved and from every Project or saved collection linked to it/);

const sourceOpening = sourceBetween(
  "async function openSourceInReader(item, anchorPaneID = \"\", options = {})",
  "\nfunction closeSavedItemDetailsForPane"
);
assert.match(sourceOpening, /find\(\(candidate\) => readerMatchesSource\(candidate, detail\)\)/);
assert.match(sourceOpening, /find\(readerIsClearlyAvailable\)/);
assert.match(sourceOpening, /if \(isProAccount\(\) \|\| state\.readers\.length < 2\)/);
assert.match(sourceOpening, /options\.sourceSurface === "search"/);
assert.match(sourceOpening, /confirmSearchReaderReplacement/);
assert.match(sourceOpening, /if \(!confirmed\) return null/);
assert.match(webClient, /Free includes two Readers and both are in use/);
assert.match(webClient, /The other Reader will stay unchanged/);
assert.match(webClient, /if \(!reader \|\| !readerMatchesSource\(reader, detail\)\) return null/);

assert.match(cssRule(".section-save-project-sheet"), /border: 0;/);
const searchSaveCSS = cssRule(".search-result-save");
assert.match(searchSaveCSS, /width: 40px;[\s\S]*?height: 40px;[\s\S]*?border: 0;/);
assert.match(webStyles, /\.search-result-save:hover,[\s\S]*?\.search-result-save:focus-visible/);
assert.doesNotMatch(searchSaveCSS, /border: 1px/);

// Existing plan limits remain the authority: Free still has two Readers and
// the existing saved-item limit is checked by the canonical persistence path.
assert.match(webClient, /!isProAccount\(\) && state\.readers\.length >= 2/);
assert.match(webClient, /webFreePlanUsage\(\)\.savedItems >= webFreePlanLimits\.savedItems/);

console.log("UX/UI Reader and save Phase 4 web contract passed.");
