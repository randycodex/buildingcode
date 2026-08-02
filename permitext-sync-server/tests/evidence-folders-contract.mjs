import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [appSource, stylesSource, serverSource, entitlementSource, swiftModelSource, swiftStoreSource] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../entitlement-contract.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Models/CodeModels.swift", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Data/UserDataStore.swift", import.meta.url), "utf8")
]);

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist.`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
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

const folderType = new Function(`${functionSource(appSource, "folderType")}; return folderType;`)();
assert.equal(folderType({}), "project", "Legacy folders must default to Project.");
assert.equal(folderType({ folderType: "reference" }), "reference");
assert.equal(folderType({ folderType: "invalid" }), "project");

const savedEvidenceKey = new Function(
  "syncCodeVersion",
  "defaultSyncCodeVersion",
  `${functionSource(appSource, "savedEvidenceKey")}; return savedEvidenceKey;`
)((value) => value || "default-library", "default-library");
assert.notEqual(
  savedEvidenceKey({ codeVersion: "library-a", sectionID: 101 }),
  savedEvidenceKey({ codeVersion: "library-b", sectionID: 101 }),
  "The same numeric section in two libraries must remain two canonical saved records."
);

const normalizeAnnotationTags = new Function(
  `${functionSource(appSource, "normalizeAnnotationTags")}; return normalizeAnnotationTags;`
)();
assert.deepEqual(
  normalizeAnnotationTags(["  Fire   safety ", "fire safety", "Egress", ""]),
  ["Fire safety", "Egress"],
  "Tags must normalize Unicode whitespace and merge case-insensitive duplicates."
);

assert.match(appSource, /function persistSectionFolderSelection\([\s\S]*?if \(!selectedByID\.size\) return/);
assert.match(appSource, /destinationList\.setAttribute\("aria-multiselectable", "true"\)/);
assert.match(appSource, /confirmButton\.disabled = selected\.length === 0/);
assert.match(appSource, /await persistSectionFolderSelection\(sectionPayload, selectedFolders, projects\)/);
assert.match(appSource, /function unlinkEvidenceFromFolder\([\s\S]*?title: "Remove final folder\?"[\s\S]*?removeBookmark: true/);
assert.match(appSource, /if \(options\.removeBookmark === true\)/);
assert.match(
  appSource,
  /async function clearSettingsBookmarks\(\)[\s\S]*?deletedSavedMutationForSection[\s\S]*?deletedProjectSectionMutationForItem[\s\S]*?operationGroupID[\s\S]*?enqueueSettingsBulkClear\("bookmarks", \{ operationGroupID \}\)/,
  "Clear All Bookmarks must tombstone both canonical saved records and every Project membership in one queued operation group."
);
assert.match(appSource, /function renderUnassignedEvidenceNotice\([\s\S]*?Nothing is moved or deleted automatically\./);
assert.match(appSource, /function renderSavedFolderContext\([\s\S]*?folderIsProject\(folder\)[\s\S]*?"Notebook"[\s\S]*?"Report Draft"[\s\S]*?"Workboard"[\s\S]*?"Coordination"/);
assert.match(appSource, /convert\.disabled = !hasCapability\("projects"\)/);
assert.match(
  appSource,
  /if \(projectIsArchived\(project\)\) \{[\s\S]*?archivedLabel\.className = "settings-project-archive-label";[\s\S]*?archivedLabel\.textContent = "Archived";/,
  "Settings must mark only archived folders when active and archived folders share a name."
);
assert.match(
  appSource,
  /function projectOverviewRefreshPaneIDs\([\s\S]*?state\.utilities\.settings \? "utility:settings" : ""/,
  "Open Settings must refresh immediately after a folder is archived, restored, or deleted elsewhere."
);
assert.match(
  appSource,
  /const settingsScrollTop = refreshPaneIDs\.has\("utility:settings"\)[\s\S]*?settingsPane\.scrollTop = Math\.min\(/,
  "Refreshing Settings must preserve its vertical scroll position."
);
assert.match(appSource, /function renameAnnotationTag\([\s\S]*?normalizeAnnotationTags/);
assert.match(appSource, /function wireCodeFilterMenu\([\s\S]*?"ArrowDown"[\s\S]*?"Home"[\s\S]*?"End"[\s\S]*?"Escape"/);
assert.match(stylesSource, /\.reader-notes-project-options \{[\s\S]*?max-height:[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/);
assert.match(stylesSource, /\.saved-projects-menu\.is-open \.saved-project-list \{[\s\S]*?max-height:[\s\S]*?overflow-y: auto;/);
assert.match(stylesSource, /\.settings-project-archive-label \{[\s\S]*?text-transform: none;/);

assert.match(serverSource, /folder_type TEXT NOT NULL DEFAULT 'project'/);
assert.match(serverSource, /referenceProjectIDs\.has\(projectID\)/);
assert.match(serverSource, /record\.folderType !== "reference"/);
assert.match(entitlementSource, /record\.folderType === "reference"/);
assert.match(swiftModelSource, /enum CodeFolderType: String, Codable/);
assert.match(swiftModelSource, /case reference/);
assert.match(swiftStoreSource, /folder_type/);

console.log("permitext evidence folder contract passed");
