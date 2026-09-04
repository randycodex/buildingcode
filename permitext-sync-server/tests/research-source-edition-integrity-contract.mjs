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

const [clientSource, serverSource, historicalCatalog, currentCatalogText, offlineSource] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  historicalConstructionSectionCatalog(),
  readFile(new URL("../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/chapterCatalog.json", import.meta.url), "utf8"),
  readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8")
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
const canonicalFamilyResponses = [current];
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
  canonicalFamilyResponses.push(response.section);
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

// Exercise the offline response boundary against the same Reader resolver.
// Only the IndexedDB reads are replaced with in-memory fixtures; no installed
// user library, network, or provider is touched.
const offlineFunctions = [
  between(offlineSource, "function sectionIdentityValues(", "async function writeDownloadedChapter("),
  between(offlineSource, "async function matchingOfflineSearchResults(", "async function sectionByIdentity("),
  between(offlineSource, "function sectionSummary(", "function tokenizeSearchText("),
  between(offlineSource, "function tokenizeSearchText(", "export async function offlineAPI(")
    .replace(/^export /gm, ""),
  between(offlineSource, "export async function offlineAPI(", "export const offlineFeatureMetadata")
    .replace("export async function", "async function")
].join("\n");
const installMetadata = {
  installID: "offline-edition-fixture", librarySchemaVersion: 2, codeVersion: defaultSyncCodeVersion,
  libraries: [{ id: "nyc-2022-construction-codes", syncCodeVersion: defaultSyncCodeVersion }]
};
function offlineHarness(records, chapters, metadata = installMetadata) {
  const context = vm.createContext({
    URL, defaultCodeVersion: defaultSyncCodeVersion, historicalConstructionSyncCodeVersion,
    syncCodeVersion, syncCodeVersionForPrefix, chaptersStoreName: "chapters", sectionsStoreName: "sections",
    IDBKeyRange: { only: (value) => value },
    window: { location: { origin: "https://example.test" } },
    metadataRecord: async () => metadata,
    sectionByIdentity: async (_installID, id) => records.find((record) =>
      [record.id, record.sectionID, record.webSectionID].map(String).includes(String(id))) || null,
    requestResult: async (value) => value,
    openDatabase: async () => ({
      transaction: (store, mode) => {
        assert(["chapters", "sections"].includes(store));
        assert.equal(mode, "readonly", "Legacy edition recovery does not rewrite installed content.");
        return { objectStore: () => ({
          get: (key) => chapters.find((chapter) => chapter.key === key),
          index: () => ({ openCursor: (installID) => {
            const request = {};
            const installed = records.filter((record) => record.installID === installID);
            let index = 0;
            const next = () => queueMicrotask(() => {
              request.result = index < installed.length
                ? { value: installed[index++], continue: next } : null;
              request.onsuccess();
            });
            next();
            return request;
          } })
        }) };
      },
      close() {}
    })
  });
  vm.runInContext(offlineFunctions, context);
  return context;
}
for (const canonical of canonicalFamilyResponses) {
  const sectionID = canonical.sectionID || canonical.id;
  const chapter = {
    id: canonical.navigationChapterID || canonical.chapterID,
    codePrefix: canonical.codePrefix, codeVersion: canonical.codeVersion,
    chapterNumber: canonical.chapterNumber
  };
  const offline = offlineHarness([], []);
  const record = offline.chapterSectionRecord(installMetadata.installID, chapter, {
    ...canonical, id: sectionID, blocks: [{ plainText: "Retained offline enacted text." }]
  });
  assert.equal(record.codeVersion, canonical.codeVersion, `${canonical.codePrefix}: download retains section edition.`);
  for (const legacy of [false, true]) {
    const storedRecord = { ...record };
    const storedChapter = { ...chapter };
    if (legacy) {
      delete storedRecord.codeVersion;
      // Current Construction chapter responses historically omitted edition.
      if (canonical.codeVersion === defaultSyncCodeVersion) delete storedChapter.codeVersion;
    }
    const chapters = [{ key: `${installMetadata.installID}:${chapter.id}`, installID: installMetadata.installID, chapter: storedChapter }];
    const fallback = offlineHarness([storedRecord], chapters);
    const before = JSON.stringify([storedRecord, chapters]);
    const payload = await fallback.offlineAPI(`/code/sections/${sectionID}`);
    assert.equal(payload?.section?.codeVersion, canonical.codeVersion, `${canonical.codePrefix}: ${legacy ? "legacy" : "new"} offline section response.`);
    const summaries = await fallback.offlineAPI(`/code/sections?ids=${sectionID}`);
    assert.equal(summaries.sections[0]?.codeVersion, canonical.codeVersion, "Batch hydration preserves the same edition.");
    const reader = clientHarness({ api: (path) => fallback.offlineAPI(path) });
    const opened = await reader.context.openSourceInReader({ sectionID, codePrefix: canonical.codePrefix, codeVersion: canonical.codeVersion });
    assert.equal(opened?.sectionID, String(sectionID));
    assert.equal(opened.codeVersion, canonical.codeVersion);
    const numberOnlyReader = clientHarness({ api: (path) => fallback.offlineAPI(path) });
    const numberOnlyOpened = await numberOnlyReader.context.openSourceInReader({
      sectionNumber: canonical.sectionNumber, codePrefix: canonical.codePrefix, codeVersion: canonical.codeVersion
    });
    assert.equal(numberOnlyOpened?.sectionID, String(sectionID), `${canonical.codePrefix}: offline number-only resolution retains edition.`);
    const wrongVersionSearch = await fallback.offlineAPI(`/code/search?${new URLSearchParams({
      q: canonical.sectionNumber, code: canonical.codePrefix,
      version: canonical.codeVersion === defaultSyncCodeVersion ? historicalConstructionSyncCodeVersion : defaultSyncCodeVersion
    })}`);
    assert.equal(wrongVersionSearch.results.length, 0, "Offline search cannot substitute a different requested edition.");
    assert.equal(JSON.stringify([storedRecord, chapters]), before);
  }
}
const legacyRecord = { ...current, installID: installMetadata.installID, codeVersion: undefined };
const legacyChapter = { key: `${installMetadata.installID}:${current.chapterID}`, installID: installMetadata.installID,
  chapter: { id: current.chapterID, codePrefix: "BC" } };
const schemaOne = offlineHarness([legacyRecord], [legacyChapter], { installID: installMetadata.installID, codeVersion: defaultSyncCodeVersion });
assert.equal((await schemaOne.offlineAPI(`/code/sections/${current.id}`)).section.codeVersion, defaultSyncCodeVersion,
  "An old Construction install can use its stored edition without library metadata.");
for (const [label, record, chapter, metadata] of [
  ["contradictory section edition", { ...legacyRecord, codeVersion: historicalConstructionSyncCodeVersion }, legacyChapter, installMetadata],
  ["contradictory chapter edition", legacyRecord, { ...legacyChapter, chapter: { ...legacyChapter.chapter, codeVersion: historicalConstructionSyncCodeVersion } }, installMetadata],
  ["different installed library", { ...legacyRecord, installID: "another-install" }, legacyChapter, installMetadata],
  ["missing installed chapter", legacyRecord, null, installMetadata],
  ["unidentified legacy edition", legacyRecord, legacyChapter, { installID: installMetadata.installID }],
  ["incorrect legacy install label", legacyRecord, legacyChapter, { installID: installMetadata.installID, codeVersion: historicalConstructionSyncCodeVersion }],
  ["non-default family cannot inherit 2022", { ...legacyRecord, id: 20000000, sectionID: 20000000, codePrefix: "ZR" },
    { ...legacyChapter, chapter: { ...legacyChapter.chapter, codePrefix: "ZR" } }, installMetadata]
]) {
  const fallback = offlineHarness([record], chapter ? [chapter] : [], metadata);
  assert.equal(await fallback.offlineAPI(`/code/sections/${record.id}`), null, label);
  const reader = clientHarness({ api: (path) => fallback.offlineAPI(path) });
  assert.equal(await reader.context.openSourceInReader({ sectionID: record.id }), null, label);
  assert.equal(reader.opened.length, 0, label);
  assert.equal(reader.notices.length, 1, label);
}

const downloadedChapters = [];
let activatedDownload = null;
const currentDownloadChapter = { id: 10, codePrefix: "BC", sections: [{
  id: current.id, sectionNumber: current.sectionNumber, title: current.title, blocks: []
}] };
const downloadFixtures = [currentDownloadChapter, { id: 999, codePrefix: "BC", sections: [] }];
const downloadContext = vm.createContext({
  indexedDB: {}, crypto: { randomUUID: () => "new-offline-install" },
  navigator: { storage: { persist: async () => {} } },
  defaultCodeVersion: defaultSyncCodeVersion, historicalConstructionSyncCodeVersion,
  syncCodeVersion, syncCodeVersionForPrefix, offlineLibrarySchemaVersion: 2, offlineAssetVersion: "fixture",
  prepareOfflineShell: async () => {},
  fetchJSON: async (path) => {
    if (path === "/code/chapters") return { chapters: downloadFixtures.map(({ sections, ...chapter }) => chapter) };
    if (path === "/code/libraries") return { libraries: installMetadata.libraries };
    const id = path.match(/\/code\/chapters\/(\d+)/)?.[1];
    assert(id, "Download uses only fixture paths.");
    return { chapter: downloadFixtures.find((chapter) => String(chapter.id) === id) };
  },
  mapWithConcurrency: async (items, _limit, operation) => Promise.all(items.map(operation)),
  offlineAssetNamesForChapter: () => [], cacheOfflineAssets: async () => 0,
  writeDownloadedChapter: async (_installID, chapter) => downloadedChapters.push(chapter),
  activateInstall: async (metadata) => { activatedDownload = metadata; },
  offlineLibraryStatus: async () => activatedDownload, deleteInstall: async () => {}
});
vm.runInContext([
  between(offlineSource, "function offlineSectionCodeVersion(", "function chapterSectionRecord("),
  between(offlineSource, "export async function downloadOfflineLibrary(", "export async function offlineLibraryStatus(")
    .replace("export async function", "async function")
].join("\n"), downloadContext);
await downloadContext.downloadOfflineLibrary();
assert.equal(activatedDownload.installID, "new-offline-install");
assert.equal(downloadedChapters.find((chapter) => chapter.id === 10).codeVersion, defaultSyncCodeVersion,
  "Download persists Construction edition from the fetched library metadata.");
assert.equal(downloadedChapters.find((chapter) => chapter.id === 999).sections.length, 0,
  "A reserved empty chapter does not prevent a complete offline install.");
activatedDownload = null;
currentDownloadChapter.sections[0].codeVersion = historicalConstructionSyncCodeVersion;
await assert.rejects(downloadContext.downloadOfflineLibrary(), /exact offline code edition/);
assert.equal(activatedDownload, null, "A contradictory download is never activated.");

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
