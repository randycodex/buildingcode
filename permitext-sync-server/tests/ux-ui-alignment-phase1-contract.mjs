import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import {
  candidateSectionIDs,
  canonicalConstructionNavigationChapters,
  handleRequest,
  searchTextMatchesExactQuery
} from "../app.mjs";

const [clientSource, stylesSource, indexSource, projectSource] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/NYC CC APP.xcodeproj/project.pbxproj", import.meta.url), "utf8")
]);

assert.equal(searchTextMatchesExactQuery(["Systems   required\nby this section"], "systems required by this"), true);
assert.equal(searchTextMatchesExactQuery(["fire-resistant construction"], "resistant construction"), true);
assert.equal(searchTextMatchesExactQuery(["systematically required"], "system"), false);
assert.equal(searchTextMatchesExactQuery(["Section 101.2."], "101.2"), true);
assert.equal(searchTextMatchesExactQuery(["Section 101.20"], "101.2"), false);
assert.deepEqual(
  [...candidateSectionIDs(
    new Map([["101.2", [1]], ["101.2.1", [2]], ["101.20", [3]]]),
    ["101.2"],
    "101.2",
    "101.2"
  )].sort(),
  [1, 2, 3],
  "Numeric prefix candidates must remain available for exact filtering of nested sections."
);
const canonicalized = canonicalConstructionNavigationChapters([
  { id: "46", codePrefix: "BC", chapterNumber: "K", fullTitle: "Appendix K: Elevators", sectionCount: 1 },
  { id: "47", codePrefix: "BC", chapterNumber: "K1", fullTitle: "Appendix K: Elevators", sectionCount: 3 },
  { id: "48", codePrefix: "BC", chapterNumber: "K2", fullTitle: "Appendix K: Elevators", sectionCount: 4 },
  { id: "49", codePrefix: "BC", chapterNumber: "K3", fullTitle: "Appendix K: Elevators", sectionCount: 5 }
]);
assert.equal(canonicalized.length, 1);
assert.equal(canonicalized[0].id, "46");
assert.deepEqual(canonicalized[0].sourceChapterIDs, ["46", "47", "48", "49"]);
assert.equal(canonicalized[0].sectionCount, 13);

assert.match(clientSource, /&match=exact&limit=\$\{searchResultPageSize\}&offset=0&candidateOffset=0/);
assert.match(clientSource, /&match=exact` \+[\s\S]*?&candidateOffset=\$\{encodeURIComponent\(String\(options\.candidateOffset\)\)\}/);
assert.match(clientSource, /function renderWorkspaceLoadError\(error\)[\s\S]*?role", "alert"[\s\S]*?Try again[\s\S]*?window\.location\.reload\(\)/);
assert.match(stylesSource, /\.workspace-load-error \.toolbar-button \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/);
assert.match(stylesSource, /\.settings-scroll \{[\s\S]*?margin-right: calc\(0px - var\(--panel-padding\)\);[\s\S]*?padding-right: var\(--panel-padding\);/);
assert.doesNotMatch(clientSource, /start\(\)\.catch\([\s\S]*?settingsTemplate[\s\S]*?\.settings-list/);
assert.match(clientSource, /addReaderButton\.disabled = limitReached/);
assert.match(clientSource, /Two Reader limit reached/);
assert.match(clientSource, /const visibleFolders = visibleRecords;[\s\S]*?visibleFolders\.forEach/);
assert.doesNotMatch(clientSource, /const visibleProjects = visibleRecords\.filter\(folderIsProject\)/);
assert.match(clientSource, /function unassignedSavedEvidenceKeys[\s\S]*?activeFolderRecords\(projects \|\| \[\]\)/);
assert.match(clientSource, /typeLabel\.textContent = folderTypeLabel\(project\)/);
assert.match(clientSource, /folderRecordCountLabel\(selectedProjects\)/);
assert.match(indexSource, /id="add-reader"[^>]*aria-label="New Reader"[^>]*title="New Reader"[\s\S]*?<span>New Reader<\/span>/);
assert.match(indexSource, /id="fit-columns"[^>]*aria-label="Reset layout"[^>]*title="Restore default panel widths">Reset layout<\/button>/);
assert.match(indexSource, /Clear All Projects and Saved Collections/);
assert.match(stylesSource, /\.search-result-summary \{[\s\S]*?color: var\(--text-primary\);/);
assert.doesNotMatch(projectSource, /TARGETED_DEVICE_FAMILY = "1,2";/);
assert.equal((projectSource.match(/TARGETED_DEVICE_FAMILY = 1;/g) || []).length, 8);

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    response.statusCode = 500;
    response.end(error instanceof Error ? error.message : String(error));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const getJSON = async (path) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (response.status !== 200) {
    const body = await response.text();
    assert.fail(`${path} returned ${response.status}: ${body}`);
  }
  return response.json();
};

try {
  const chapterList = await getJSON("/code/chapters?code=BC");
  const appendixKOptions = chapterList.chapters.filter((chapter) =>
    String(chapter.fullTitle || "").startsWith("Appendix K:")
  );
  assert.equal(appendixKOptions.length, 1);
  assert.equal(String(appendixKOptions[0].id), "46");
  assert.deepEqual(appendixKOptions[0].sourceChapterIDs, ["46", "47", "48", "49"]);

  const appendixK = (await getJSON("/code/chapters/46")).chapter;
  const sectionNumbers = appendixK.sections.map((section) => String(section.sectionNumber || ""));
  for (const sectionNumber of ["K101.1", "K201.1", "K301.1"]) {
    const sectionIndex = sectionNumbers.indexOf(sectionNumber);
    assert.notEqual(sectionIndex, -1, `Canonical Appendix K omitted ${sectionNumber}.`);
    const windowed = (await getJSON(
      `/code/chapters/46?include=body&bodyStart=${sectionIndex}&bodyLimit=1`
    )).chapter;
    const bodyText = (windowed.sections[sectionIndex]?.blocks || [])
      .map((block) => block.plainText || block.html || "")
      .join(" ")
      .trim();
    assert(bodyText, `Canonical Appendix K did not hydrate ${sectionNumber}.`);
  }

  const query = encodeURIComponent("systems required by this");
  const broad = await getJSON(`/code/search?q=${query}&code=BC&limit=25&offset=0`);
  assert.equal(
    broad.results.some((result) => searchTextMatchesExactQuery([
      result.sectionNumber,
      result.title,
      result.headingLine,
      result.snippet
    ], "systems required by this")),
    false,
    "The exact-search regression fixture unexpectedly moved into the first broad page."
  );
  const exact = await getJSON(`/code/search?q=${query}&code=BC&match=exact&limit=25&offset=0`);
  assert.equal(exact.totalResults, 5);
  assert.equal(exact.results.length, 5);
  assert(exact.results.some((result) => String(result.id) === "1840"));
  assert.equal(exact.hasMore, false);

  const commonQuery = encodeURIComponent("of");
  const commonPageOne = await getJSON(
    `/code/search?q=${commonQuery}&match=exact&limit=25&offset=0&candidateOffset=0`
  );
  assert.equal(commonPageOne.results.length, 25);
  assert.equal(commonPageOne.hasMore, true);
  assert.equal(commonPageOne.totalResults, null);
  assert(Number(commonPageOne.nextCandidateOffset) > 0);
  const commonPageTwo = await getJSON(
    `/code/search?q=${commonQuery}&match=exact&limit=25&offset=25&candidateOffset=${commonPageOne.nextCandidateOffset}`
  );
  assert.equal(commonPageTwo.results.length, 25);
  assert.equal(commonPageTwo.offset, 25);
  const firstPageIDs = new Set(commonPageOne.results.map((result) => String(result.id)));
  assert.equal(commonPageTwo.results.some((result) => firstPageIDs.has(String(result.id))), false);
  for (const result of [...commonPageOne.results, ...commonPageTwo.results]) {
    assert.equal(searchTextMatchesExactQuery([
      result.sectionNumber,
      result.title,
      result.headingLine,
      result.snippet
    ], "of"), true);
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log("UX/UI alignment Phase 1 contract passed.");
