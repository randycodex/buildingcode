import assert from "node:assert/strict";
import {
  defaultSyncCodeVersion,
  existingBuildingSyncCodeVersion,
  syncCodeVersion,
  syncCodeVersionForPrefix,
  syncProjectIdentity,
  syncMutationRecordID,
  zoningSyncCodeVersion
} from "../public/sync-identity.js";

const userID = "apple:sync-contract";

assert.equal(syncCodeVersion("nyc-2022"), defaultSyncCodeVersion);
assert.equal(syncCodeVersion("2022 Construction Codes"), defaultSyncCodeVersion);
assert.equal(syncCodeVersion("2022 CONSTRUCTION CODES"), defaultSyncCodeVersion);
assert.equal(syncCodeVersion(defaultSyncCodeVersion), defaultSyncCodeVersion);
assert.equal(syncCodeVersion("nyc-zoning-resolution"), zoningSyncCodeVersion);
assert.equal(syncCodeVersion("NYC Zoning Resolution"), zoningSyncCodeVersion);
assert.equal(
  syncCodeVersion("NYC Zoning Resolution — text through 2026-07-16"),
  zoningSyncCodeVersion
);
assert.equal(syncCodeVersionForPrefix("ZR"), zoningSyncCodeVersion);
assert.equal(syncCodeVersionForPrefix("zr"), zoningSyncCodeVersion);
assert.equal(syncCodeVersionForPrefix("BC"), defaultSyncCodeVersion);
assert.equal(syncCodeVersion("nyc-existing-building-code"), existingBuildingSyncCodeVersion);
assert.equal(syncCodeVersion("NYC Existing Building Code"), existingBuildingSyncCodeVersion);
assert.equal(syncCodeVersionForPrefix("EBC"), existingBuildingSyncCodeVersion);
assert.equal(syncCodeVersionForPrefix("ebc"), existingBuildingSyncCodeVersion);

const legacyProjectID = `${userID}:project:2022 CONSTRUCTION CODES:2`;
const repeatedProjectID = `${userID}:project:2022 CONSTRUCTION CODES:${userID}:project:2022 CONSTRUCTION CODES:${legacyProjectID}`;
assert.equal(syncProjectIdentity(repeatedProjectID, userID), legacyProjectID);
assert.equal(
  syncProjectIdentity(`${userID}:project:${defaultSyncCodeVersion}:web-project-123`, userID),
  "web-project-123"
);

assert.equal(
  syncMutationRecordID({
    savedItem: { id: "web-saved-101", userID, codeVersion: "nyc-2022", sectionID: 101 }
  }),
  `${userID}:saved:${defaultSyncCodeVersion}:101`
);
assert.equal(
  syncMutationRecordID({
    savedItem: {
      id: "web-saved-zr-20018521",
      userID,
      codeVersion: "nyc-zoning-resolution",
      sectionID: 20_018_521
    }
  }),
  `${userID}:saved:${zoningSyncCodeVersion}:20018521`
);
assert.equal(
  syncMutationRecordID({
    annotation: {
      id: "web-note-zr-20018521",
      userID,
      codeVersion: zoningSyncCodeVersion,
      sectionID: 20_018_521,
      noteBody: "Zoning note"
    }
  }),
  `${userID}:note:${zoningSyncCodeVersion}:20018521`
);
assert.equal(
  syncMutationRecordID({
    projectSection: {
      id: "web-project-section-zr",
      folderClientID: "shared-project-id",
      userID,
      codeVersion: zoningSyncCodeVersion,
      sectionID: 20_018_521,
      scope: "manual"
    }
  }),
  `${userID}:project-section:${zoningSyncCodeVersion}:shared-project-id:20018521:manual`
);
assert.equal(
  syncMutationRecordID({
    project: {
      id: repeatedProjectID,
      clientID: repeatedProjectID,
      localFolderID: 2,
      userID,
      codeVersion: "2022 CONSTRUCTION CODES",
      name: "P2"
    }
  }),
  `${userID}:project:${defaultSyncCodeVersion}:${legacyProjectID}`
);
assert.equal(
  syncMutationRecordID({
    annotation: {
      id: "web-note-101",
      userID,
      codeVersion: "2022 Construction Codes",
      sectionID: 101,
      blockID: "paragraph-1",
      noteBody: "Field note"
    }
  }),
  `${userID}:note:${defaultSyncCodeVersion}:101:paragraph-1`
);
assert.equal(
  syncMutationRecordID({
    annotation: {
      id: "web-tags-101",
      userID,
      codeVersion: "nyc-2022",
      sectionID: 101,
      blockID: "paragraph-1",
      tags: ["Concrete"]
    }
  }),
  `${userID}:tags:${defaultSyncCodeVersion}:101:paragraph-1`
);
assert.equal(
  syncMutationRecordID({
    project: {
      id: "web-project-local",
      clientID: "shared-project-id",
      localFolderID: 42,
      userID,
      codeVersion: "2022 Construction Codes",
      name: "Synced Project Name"
    }
  }),
  `${userID}:project:${defaultSyncCodeVersion}:shared-project-id`
);
assert.equal(
  syncMutationRecordID({
    projectSection: {
      id: "web-project-section-local",
      folderClientID: "shared-project-id",
      localFolderID: 42,
      userID,
      codeVersion: "nyc-2022",
      sectionID: 101,
      scope: "manual"
    }
  }),
  `${userID}:project-section:${defaultSyncCodeVersion}:shared-project-id:101:manual`
);
assert.equal(
  syncMutationRecordID({
    projectSection: {
      id: "web-project-paragraph-local",
      folderClientID: "shared-project-id",
      localFolderID: 42,
      userID,
      codeVersion: "nyc-2022",
      sectionID: 101,
      blockID: "101-html-2",
      scope: "manual"
    }
  }),
  `${userID}:project-section:${defaultSyncCodeVersion}:shared-project-id:101:101-html-2:manual`
);
assert.equal(
  syncMutationRecordID({
    projectSection: {
      id: "remove-section-from-all-projects",
      userID,
      codeVersion: "2022 Construction Codes",
      sectionID: 101,
      scope: "allFolders"
    }
  }),
  `${userID}:project-section:${defaultSyncCodeVersion}:101:allFolders`
);
assert.equal(
  syncMutationRecordID({
    continuity: { userID, codeVersion: "2022 Construction Codes", values: {} }
  }),
  `${userID}:continuity:${defaultSyncCodeVersion}`
);
assert.equal(
  syncMutationRecordID({
    codeVersionClear: { userID, codeVersion: "nyc-2022", values: { scope: "folders" } }
  }),
  `${userID}:code-version-clear:${defaultSyncCodeVersion}:folders`
);
assert.notEqual(
  syncMutationRecordID({
    codeVersionClear: { userID, codeVersion: "nyc-2022", values: { scope: "bookmarks" } }
  }),
  syncMutationRecordID({
    codeVersionClear: { userID, codeVersion: "nyc-2022", values: { scope: "notes" } }
  }),
  "Bulk clears for different data categories must not overwrite one another."
);

console.log("permitext client sync identity passed");
