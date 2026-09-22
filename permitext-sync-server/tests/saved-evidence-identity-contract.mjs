import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  defaultSyncCodeVersion,
  enactedAdministrativeSyncCodeVersion,
  historicalConstructionSyncCodeVersion,
  syncCodeVersion
} from "../public/sync-identity.js";
import { bulkClearTimestamp } from "../public/sync-state.js";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function functionSource(source, name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist.`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = source.indexOf("{", parametersEnd);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}.`);
}

const state = { localAnnotations: [] };
let summaryAnnotations = [];
let clearRecords = [];
const currentContentSummary = () => ({ annotations: summaryAnnotations });
const currentBulkClearRecords = () => clearRecords;
const activeFolderRecords = (projects) => (projects || []).filter((project) => !project.deletedAt);
const projectSectionBelongsToProject = (link, project) => link.folderClientID === project.id;

const savedIdentity = new Function(
  "syncCodeVersion",
  "defaultSyncCodeVersion",
  "bulkClearTimestamp",
  "state",
  "currentContentSummary",
  "currentBulkClearRecords",
  "activeFolderRecords",
  "projectSectionBelongsToProject",
  [
    "normalizeAnnotationBlockID",
    "normalizeAnnotationTags",
    "annotationRecordsForTarget",
    "annotationForTarget",
    "savedEvidenceKey",
    "annotationEvidenceIsVisible",
    "consolidatedSavedAnnotations",
    "mergeSavedColumnItems",
    "unassignedSavedEvidenceKeys"
  ].map((name) => functionSource(appSource, name)).join("\n") +
  "\nreturn { annotationForTarget, savedEvidenceKey, consolidatedSavedAnnotations, mergeSavedColumnItems, unassignedSavedEvidenceKeys };"
)(
  syncCodeVersion,
  defaultSyncCodeVersion,
  bulkClearTimestamp,
  state,
  currentContentSummary,
  currentBulkClearRecords,
  activeFolderRecords,
  projectSectionBelongsToProject
);

const sectionID = 101;
const note1968 = {
  id: "note-1968",
  codeVersion: enactedAdministrativeSyncCodeVersion,
  codePrefix: "BC68",
  sectionID,
  sectionNumber: "27-375",
  title: "Exits",
  noteBody: "1968 stair note",
  updatedAt: "2020-01-01T00:00:00.000Z"
};
const note2014 = {
  id: "note-2014",
  codeVersion: historicalConstructionSyncCodeVersion,
  codePrefix: "BC",
  sectionID,
  sectionNumber: "1010.2",
  title: "Slope.",
  noteBody: "2014 slope note",
  updatedAt: "2021-01-01T00:00:00.000Z"
};
const currentBookmark = {
  id: "bookmark-current",
  codeVersion: defaultSyncCodeVersion,
  codePrefix: "BC",
  sectionID,
  sectionNumber: "1010.2",
  title: "Gates",
  updatedAt: "2024-01-01T00:00:00.000Z"
};
const currentNote = {
  id: "note-current",
  codeVersion: defaultSyncCodeVersion,
  codePrefix: "BC",
  sectionID,
  noteBody: "Current section note",
  updatedAt: "2024-03-01T00:00:00.000Z"
};
const passageNote = {
  id: "passage-current",
  codeVersion: defaultSyncCodeVersion,
  codePrefix: "BC",
  sectionID,
  blockID: "paragraph-2",
  sectionNumber: "1010.2",
  title: "Gates",
  noteBody: "Passage note",
  updatedAt: "2024-02-01T00:00:00.000Z"
};
const tagsOnly = {
  id: "tags-only",
  codeVersion: defaultSyncCodeVersion,
  codePrefix: "BC",
  sectionID: 404,
  noteBody: "",
  tags: ["egress"],
  updatedAt: "2024-05-01T00:00:00.000Z"
};
const deletedNote = {
  id: "note-deleted-older",
  codeVersion: historicalConstructionSyncCodeVersion,
  codePrefix: "BC",
  sectionID: 505,
  noteBody: "Deleted historical note",
  updatedAt: "2020-06-01T00:00:00.000Z"
};
const deletedTombstone = {
  ...deletedNote,
  id: "note-deleted-newer",
  noteBody: "",
  deletedAt: "2024-06-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z"
};
const clearedNote = {
  id: "note-cleared",
  codeVersion: historicalConstructionSyncCodeVersion,
  codePrefix: "BC",
  sectionID: 606,
  noteBody: "Cleared historical note",
  updatedAt: "2024-01-01T00:00:00.000Z"
};

summaryAnnotations = [
  note1968,
  note2014,
  currentNote,
  passageNote,
  tagsOnly,
  deletedNote,
  deletedTombstone
];
clearRecords = [];

const annotated = savedIdentity.consolidatedSavedAnnotations(summaryAnnotations);
const annotatedIDs = annotated.map((item) => item.id);
assert.deepEqual(annotatedIDs.sort(), ["note-1968", "note-2014", "note-current", "passage-current", "tags-only"].sort());
assert.equal(annotated.find((item) => item.id === "note-1968").codeVersion, enactedAdministrativeSyncCodeVersion);
assert.equal(annotated.find((item) => item.id === "note-2014").noteBody, "2014 slope note");
assert.equal(
  savedIdentity.annotationForTarget(note1968).noteBody,
  "1968 stair note",
  "A historical note must resolve against its own edition."
);
assert.notEqual(
  savedIdentity.annotationForTarget(sectionID, "").noteBody,
  "1968 stair note",
  "Looking up a section without its edition must not return another edition's note."
);

const merged = savedIdentity.mergeSavedColumnItems([currentBookmark], annotated);
const mergedCurrent = merged.filter((item) => item.savedColumnKind === "bookmark");
assert.equal(mergedCurrent.length, 1);
assert.equal(mergedCurrent[0].noteBody, "Current section note");
assert.equal(merged.filter((item) => item.id === "note-current").length, 0, "A same-edition section note folds into its bookmark.");
for (const id of ["note-1968", "note-2014", "passage-current", "tags-only"]) {
  assert.equal(merged.filter((item) => item.id === id).length, 1, `${id} stays an independent row.`);
}
assert.equal(merged.filter((item) => item.id === "note-deleted-older").length, 0);

summaryAnnotations = [clearedNote];
clearRecords = [{
  codeVersion: historicalConstructionSyncCodeVersion,
  updatedAt: "2024-07-01T00:00:00.000Z",
  values: { scope: "notes" }
}];
assert.deepEqual(savedIdentity.consolidatedSavedAnnotations(summaryAnnotations), []);

const visibleAnnotations = annotated.filter((item) => item.id !== "note-current");
const unassigned = savedIdentity.unassignedSavedEvidenceKeys(
  [currentBookmark],
  [],
  [],
  visibleAnnotations
);
assert.equal(unassigned.has(savedIdentity.savedEvidenceKey(note1968)), true);
assert.equal(unassigned.has(savedIdentity.savedEvidenceKey(note2014)), true);
assert.equal(unassigned.has(savedIdentity.savedEvidenceKey(passageNote)), true);
assert.equal(unassigned.has(savedIdentity.savedEvidenceKey(tagsOnly)), true);
assert.equal(unassigned.has(savedIdentity.savedEvidenceKey(currentBookmark)), true);

const assignedCurrent = savedIdentity.unassignedSavedEvidenceKeys(
  [currentBookmark],
  [{ ...currentBookmark, folderClientID: "project-1" }],
  [{ id: "project-1" }],
  visibleAnnotations
);
assert.equal(assignedCurrent.has(savedIdentity.savedEvidenceKey(currentBookmark)), false);
assert.equal(assignedCurrent.has(savedIdentity.savedEvidenceKey(note1968)), true);
assert.equal(assignedCurrent.has(savedIdentity.savedEvidenceKey(note2014)), true);
assert.equal(assignedCurrent.has(savedIdentity.savedEvidenceKey(passageNote)), true);

const requests = [];
const resolveSectionDetail = new Function(
  "syncCodeVersion",
  "api",
  "fetchChapter",
  "sectionTitleFromID",
  `${functionSource(appSource, "sectionRecordMatchesRequestedEdition")}\n${functionSource(appSource, "resolveSectionDetail")}\nreturn resolveSectionDetail;`
)(
  syncCodeVersion,
  async (path) => {
    requests.push(path);
    if (path === "/code/sections/101") {
      return {
        section: {
          id: 101,
          sectionID: 101,
          codeVersion: defaultSyncCodeVersion,
          codePrefix: "BC",
          title: "Gates",
          chapterID: 10,
          sectionNumber: "1010.2"
        }
      };
    }
    if (String(path).includes("/code/search")) {
      const version = new URL(path, "https://example.test").searchParams.get("version");
      if (version === historicalConstructionSyncCodeVersion) {
        return {
          results: [{
            id: 41009495,
            sectionID: 41009495,
            codeVersion: historicalConstructionSyncCodeVersion,
            codePrefix: "BC",
            title: "Slope.",
            chapterID: 41,
            sectionNumber: "1010.2"
          }]
        };
      }
      return {
        results: [{
          id: 101,
          sectionID: 101,
          codeVersion: defaultSyncCodeVersion,
          codePrefix: "BC",
          title: "Gates",
          chapterID: 10,
          sectionNumber: "1010.2"
        }]
      };
    }
    throw new Error(path);
  },
  async () => {
    throw new Error("A mismatched edition must not load the default chapter.");
  },
  () => null
);

const historicalDetail = {
  sectionID: 101,
  codeVersion: historicalConstructionSyncCodeVersion,
  codePrefix: "BC",
  title: "Slope.",
  sectionNumber: "1010.2"
};
const resolved = await resolveSectionDetail(historicalDetail);
assert.equal(historicalDetail.title, "Slope.");
assert.equal(resolved.section, null);
assert.equal(requests[0], "/code/sections/101");
assert.equal(
  new URL(requests[1], "https://example.test").searchParams.get("version"),
  historicalConstructionSyncCodeVersion
);
assert.equal(requests.length, 2, "Search must not fall through to the current edition.");

assert.match(
  functionSource(appSource, "hydrateSavedColumnItems"),
  /codeVersion: syncCodeVersion\(item\.codeVersion/,
  "Saved hydration must request the row's edition."
);
assert.match(
  functionSource(appSource, "consolidatedSavedAnnotations"),
  /annotationForTarget\(annotation\)/,
  "Saved consolidation must pass the annotation's edition into note resolution."
);
