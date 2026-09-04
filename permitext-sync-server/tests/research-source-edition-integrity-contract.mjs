import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  defaultSyncCodeVersion,
  historicalConstructionSyncCodeVersion,
  syncCodeVersion,
  syncCodeVersionForPrefix
} from "../public/sync-identity.js";
import {
  historicalConstructionSection, historicalConstructionSectionCatalog,
  historicalConstructionSectionSummary, isHistoricalConstructionSectionID
} from "../historical-construction-content.mjs";
import {
  enactedSection, enactedSectionCatalog, enactedSectionSummary, isEnactedCodeSectionID
} from "../enacted-code-content.mjs";
import {
  zoningCodePrefix, zoningSection, zoningSectionCatalog, zoningSectionSummary,
  zoningSyncCodeVersion, isZoningSectionID
} from "../zoning-content.mjs";
import {
  existingBuildingCodePrefix, existingBuildingSection, existingBuildingSectionCatalog,
  existingBuildingSectionSummary, existingBuildingSyncCodeVersion, isExistingBuildingSectionID
} from "../existing-building-content.mjs";
import { applyVisibleSectionNumber } from "../code-navigation-hierarchy.mjs";
import { immutableEvidenceSnapshot } from "../project-foundation-contract.mjs";

const [clientSource, serverSource, historicalCatalog, currentCatalogText] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  historicalConstructionSectionCatalog(),
  readFile(new URL("../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/chapterCatalog.json", import.meta.url), "utf8")
]);

function between(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert(start >= 0 && end > start, `Production function range exists: ${startText}`);
  return source.slice(start, end);
}

const historical = historicalCatalog.find((section) => section.codePrefix === "BC" && section.sectionNumber === "1010.2");
assert.equal(historical.id, 41009495);
assert.equal(historical.title, "Slope.");
const currentChapter = JSON.parse(currentCatalogText).chapters.find(([id]) => id === 10);
const currentRow = currentChapter[1].flatMap((group) => group.at(-1)).find((row) => row[1] === "1010.2");
assert.equal(currentRow[0], 2285);
assert.match(currentRow[2], /Gates/);
const current = {
  id: currentRow[0], sectionID: currentRow[0], chapterID: 10,
  codePrefix: "BC", sectionNumber: currentRow[1], title: currentRow[2],
  codeVersion: defaultSyncCodeVersion
};
const historicalSection = { ...historical, sectionID: historical.id };
const citation = {
  sectionID: String(historical.id), sectionNumber: historical.sectionNumber,
  codePrefix: "BC", codeVersion: historicalConstructionSyncCodeVersion,
  codeEdition: historical.codeEdition, title: historical.title
};
const clientFunctions = [
  between(clientSource, "function normalizedInlineSectionNumber(", "async function openReferenceInAdjacentReader("),
  between(clientSource, "function searchResultDetail(", "function savedPaneIDs("),
  between(clientSource, "function readerFieldsForSectionDetail(", "function defaultActivePaneIDs("),
  between(clientSource, "async function openNotebookReference(", "async function renderProjectNotebook("),
  between(clientSource, "async function resolveReaderSource(", "function closeSavedItemDetailsForPane(")
].join("\n");

function clientHarness(overrides = {}) {
  const requests = [];
  const notices = [];
  const opened = [];
  const state = { readers: [{ id: "reader-probe", title: "Empty Reader" }], paneWeights: {} };
  const context = vm.createContext({
    URLSearchParams, syncCodeVersion, syncCodeVersionForPrefix, state,
    currentContentSummary: () => ({ savedItems: [] }),
    normalizeAnnotationBlockID: (value) => String(value || ""),
    api: async (path) => {
      requests.push(path);
      if (overrides.api) return overrides.api(path);
      if (path === `/code/sections/${historical.id}`) return { section: historicalSection };
      if (path === `/code/sections/${current.id}`) return { section: current };
      const url = new URL(path, "https://example.test");
      if (url.pathname === "/code/search") {
        return { results: [url.searchParams.get("version") === historicalConstructionSyncCodeVersion ? historicalSection : current] };
      }
      throw new Error("Source unavailable");
    },
    showWebNotice: async (...args) => notices.push(args),
    readerMatchesSource: () => false,
    readerIsClearlyAvailable: () => true,
    paneIDForReader: (reader) => `reader:${reader.id}`,
    defaultPaneWidthForID: () => 600,
    placePaneAfter() {}, appendPaneIfMissing() {}, updateBrowserSectionURL() {},
    scheduleContinuitySync() {}, saveWorkspaceState() {}, transitionWorkspace: async () => {},
    revealReaderSourceTarget: (_reader, item) => opened.push(item), scrollPaneIntoView() {}
  });
  vm.runInContext(clientFunctions, context);
  return { context, requests, notices, opened, state };
}

for (const input of [
  citation,
  { ...citation, chapterID: historical.chapterID },
  { ...citation, id: "immutable-snapshot-id", codeVersion: undefined, sourceLibraryVersion: historicalConstructionSyncCodeVersion },
  { ...current, sectionID: String(current.id), id: "saved-current-evidence-id" }
]) {
  const harness = clientHarness();
  const original = structuredClone(input);
  const reader = await harness.context.openSourceInReader(input, "research:probe", { projectID: "project-probe" });
  const expectedID = String(input.sectionID);
  assert.equal(reader.sectionID, expectedID);
  assert.equal(reader.codeVersion, input.codeVersion || input.sourceLibraryVersion);
  assert.equal(reader.sourceProjectID, "project-probe");
  assert.deepEqual(harness.requests, [`/code/sections/${expectedID}`]);
  assert.equal(harness.opened[0].id, expectedID, "Evidence record IDs must not override canonical section IDs.");
  assert.deepEqual(harness.notices, []);
  assert.deepEqual(input, original, "Opening evidence must not rewrite its saved metadata.");
}

const numberOnly = clientHarness();
await numberOnly.context.openSourceInReader({
  codePrefix: "BC", sectionNumber: "1010.2", codeVersion: historicalConstructionSyncCodeVersion
});
assert.equal(new URL(numberOnly.requests[0], "https://example.test").searchParams.get("version"), historicalConstructionSyncCodeVersion);
assert.equal(numberOnly.opened[0].sectionID, String(historical.id));

for (const [label, input, response] of [
  ["missing section", citation, {}],
  ["wrong edition", citation, { section: { ...historicalSection, codeVersion: defaultSyncCodeVersion } }],
  ["wrong section", citation, { section: { ...historicalSection, sectionID: current.id } }],
  ["wrong code family", { ...citation, codePrefix: "ZR" }, { section: historicalSection }],
  ["unidentified code family", citation, { section: { ...historicalSection, codePrefix: undefined } }],
  ["unidentified edition", citation, { section: { ...historicalSection, codeVersion: undefined } }],
  ["contradictory saved version", { ...citation, codeVersion: defaultSyncCodeVersion }, { section: historicalSection }],
  ["number-only wrong edition", { codePrefix: "BC", sectionNumber: "1010.2", codeVersion: historicalConstructionSyncCodeVersion }, { results: [current] }],
  ["number-only sibling fallback", { codePrefix: "BC", sectionNumber: "1010.2", codeVersion: historicalConstructionSyncCodeVersion }, { results: [{ ...historicalSection, sectionNumber: "1010.2.1" }] }]
]) {
  const harness = clientHarness({ api: async () => response });
  const before = structuredClone(harness.state);
  assert.equal(await harness.context.openSourceInReader(input), null, label);
  assert.deepEqual(harness.state, before, `${label}: no Reader state changed.`);
  assert.equal(harness.opened.length, 0, label);
  assert.equal(harness.notices.length, 1, `${label}: the failure is visible.`);
  assert.equal(harness.requests.length, 1, `${label}: no fallback to another edition.`);
}

// Exercise the actual canonical section response, including the current-code
// branches that previously omitted codeVersion. All I/O is stubbed in memory.
const sectionHandler = between(serverSource, "async function handleCodeSection(", "\nasync function ");
for (const blocks of [[], [{ plainText: "Current enacted text." }]]) {
  let response;
  const context = vm.createContext({
    defaultSyncCodeVersion,
    isEnactedCodeSectionID: () => false, isHistoricalConstructionSectionID: () => false,
    isZoningSectionID: () => false, isExistingBuildingSectionID: () => false,
    sectionSummaryByID: async () => current, sectionBody: async () => ({ blocks }),
    sendJSON: (_response, status, payload) => { response = { status, ...payload }; }
  });
  vm.runInContext(sectionHandler, context);
  await context.handleCodeSection(`/code/sections/${current.id}`, {});
  assert.equal(response.status, 200);
  assert.equal(response.section.codeVersion, defaultSyncCodeVersion);
}

// Verify every shipped non-default family through the actual section handler
// and local content loaders, then open its response through the Reader path.
const [enactedCatalog, zoningCatalog, existingCatalog] = await Promise.all([
  enactedSectionCatalog(), zoningSectionCatalog(), existingBuildingSectionCatalog()
]);
const familySections = [historical, zoningCatalog[0], existingCatalog[0],
  ...[...new Set(enactedCatalog.map((section) => section.codePrefix))]
    .map((prefix) => enactedCatalog.find((section) => section.codePrefix === prefix))
];
for (const summary of familySections) {
  let response;
  const sectionContext = vm.createContext({
    defaultSyncCodeVersion, historicalConstructionSyncCodeVersion,
    historicalConstructionSection, historicalConstructionSectionSummary, isHistoricalConstructionSectionID,
    enactedSection, enactedSectionSummary, isEnactedCodeSectionID, applyVisibleSectionNumber,
    zoningCodePrefix, zoningSection, zoningSectionSummary, zoningSyncCodeVersion, isZoningSectionID,
    existingBuildingCodePrefix, existingBuildingSection, existingBuildingSectionSummary,
    existingBuildingSyncCodeVersion, isExistingBuildingSectionID,
    sendJSON: (_response, status, payload) => { response = { status, ...payload }; },
    sendError: (_response, status, message) => assert.fail(`${status}: ${message}`),
    sendNotFound: () => assert.fail(`Missing shipped section ${summary.id}`)
  });
  vm.runInContext(sectionHandler, sectionContext);
  await sectionContext.handleCodeSection(`/code/sections/${summary.id}`, {});
  assert.equal(response.status, 200);
  assert.equal(response.section.codeVersion, summary.codeVersion, `${summary.codePrefix}: canonical handler returns edition.`);
  for (const input of [
    { sectionID: summary.id, codePrefix: summary.codePrefix, codeVersion: summary.codeVersion },
    { sectionID: summary.id, codeVersion: summary.codeVersion },
    { id: summary.id }
  ]) {
    const harness = clientHarness({ api: async () => response });
    const reader = await harness.context.openSourceInReader(input);
    assert.equal(reader?.sectionID, String(summary.id), `${summary.codePrefix}: canonical and legacy id-only locators open.`);
    assert.equal(reader.codePrefix, summary.codePrefix);
    assert.equal(reader.codeVersion, summary.codeVersion);
    assert.equal(reader.chapterID, response.section.navigationChapterID || response.section.chapterID);
    assert.deepEqual(harness.requests, [`/code/sections/${summary.id}`]);
    assert.deepEqual(harness.notices, []);
  }
  const notebook = clientHarness({ api: async () => response });
  await notebook.context.openNotebookReference({}, {}, {
    referenceKind: "canonicalSection", referenceID: String(summary.id), label: "Saved source"
  }, null, "notebook:probe", "project-probe");
  assert.equal(notebook.opened[0]?.codePrefix, summary.codePrefix, `${summary.codePrefix}: Notebook can resolve a reference without a matching Saved item.`);
}

// An endpoint may explicitly map an old web ID to a canonical ID. Accept that
// declared alias; the earlier wrong-section case rejects undeclared remapping.
const alias = clientHarness({ api: async () => ({
  section: { ...current, webSectionID: 999999 }
}) });
const aliasedReader = await alias.context.openSourceInReader({ id: 999999, codeVersion: defaultSyncCodeVersion });
assert.equal(aliasedReader.sectionID, String(current.id));
assert.deepEqual(alias.requests, ["/code/sections/999999"]);

const evidenceFunctions = between(serverSource, "async function currentResearchEvidence(", "function researchAssemblyCrossReferences(");
const refreshHandler = between(serverSource, "async function handleResearchConversationRefresh(", "function currentMonthStart(");
for (const canonical of [
  { ...historicalSection, sectionID: String(historical.id), codeEdition: "2014 NYC Construction Codes", corpusID: "nyc-2014-construction-codes", corpusLabel: "2014 NYC Construction Codes", applicabilityStatus: "prior-edition-case-specific" },
  { ...current, sectionID: String(current.id), codeEdition: "2022 NYC Construction Codes", corpusID: "nyc-2022-construction-codes", corpusLabel: "2022 NYC Construction Codes", applicabilityStatus: "current-enacted-edition" }
]) {
  Object.assign(canonical, { jurisdiction: "New York City", chapterNumber: "10", canonicalText: "Exact selected passage.", text: "Exact selected passage.", sectionTextHash: "current-hash", richSources: [], visualSources: [] });
  const source = {
    id: "selected-source", kind: "selection", sectionID: canonical.sectionID,
    selectedText: "Exact selected passage.", selectedTextHash: "selected-hash",
    sectionTextHash: "current-hash", codeVersion: canonical.codeVersion === defaultSyncCodeVersion ? historicalConstructionSyncCodeVersion : defaultSyncCodeVersion,
    codeEdition: "Incorrect stored edition", corpusID: "incorrect-corpus",
    corpusLabel: "Incorrect corpus", applicabilityStatus: "incorrect-status"
  };
  const conversation = { id: "probe", sources: [source], messages: [{ id: "historical-answer", answer: { codeVersion: source.codeVersion } }], evidenceSetVersion: 1 };
  const historicalMessages = JSON.stringify(conversation.messages);
  let response;
  let saves = 0;
  const context = vm.createContext({
    defaultSyncCodeVersion, canonicalCodeVersion: syncCodeVersion,
    researchEvidenceForSectionIDs: async () => [canonical],
    matchingCanonicalResearchSelection: (selection, text) => text.includes(selection),
    authenticatedResearchBody: async () => ({ userID: "probe-user", body: { conversationID: "probe" } }),
    requiredResearchConversation: async () => conversation,
    saveStoredResearchConversation: async () => { saves += 1; },
    bumpResearchArtifactRevisions: async () => ({}),
    researchConversationForClient: async (value) => value,
    sendJSON: (_response, status, payload) => { response = { status, ...payload }; }
  });
  vm.runInContext(`${evidenceFunctions}\n${refreshHandler}`, context);
  assert.equal((await context.currentResearchEvidence(conversation)).stale, true, "Contradictory stored identity requires refresh.");
  const selectedBeforeRefresh = context.selectedResearchEvidence(conversation, [canonical])[0];
  assert.equal(selectedBeforeRefresh.codeVersion, canonical.codeVersion, "Stored identity cannot override canonical evidence.");
  await context.handleResearchConversationRefresh({}, {});
  assert.equal(response.status, 200);
  assert.equal(saves, 1);
  const refreshed = conversation.sources[0];
  for (const field of ["jurisdiction", "codeVersion", "codeEdition", "corpusID", "corpusLabel", "applicabilityStatus"]) {
    assert.equal(refreshed[field], canonical[field], field);
  }
  assert.equal(refreshed.id, source.id);
  assert.equal(refreshed.selectedText, source.selectedText);
  assert.equal(refreshed.selectedTextHash, source.selectedTextHash);
  assert.equal(JSON.stringify(conversation.messages), historicalMessages, "Historical answers remain immutable.");
  assert.equal((await context.currentResearchEvidence(conversation)).stale, false);
  const selected = context.selectedResearchEvidence(conversation, [canonical])[0];
  const snapshot = immutableEvidenceSnapshot({ source: selected, sourceLibraryVersion: selected.codeVersion });
  assert.equal(snapshot.sourceLibraryVersion, canonical.codeVersion);
  assert.equal(snapshot.codeEdition, canonical.codeEdition);
  assert.equal(snapshot.passageText, source.selectedText);
  conversation.sources[0].selectedText = "A passage that is no longer present.";
  await context.handleResearchConversationRefresh({}, {});
  assert.equal(response.status, 409);
  assert.equal(response.code, "RESEARCH_SELECTION_CHANGED");
  assert.equal(saves, 1, "A changed selection must not be saved as refreshed.");
}

console.log("Research source edition integrity behavior contract passed; network and provider calls: zero.");
