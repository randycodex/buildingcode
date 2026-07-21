import assert from "node:assert/strict";
import {
  defaultSyncCodeVersion,
  syncCodeVersion,
  syncProjectIdentity,
  syncMutationRecordID
} from "../public/sync-identity.js";

const userID = "apple:sync-contract";

assert.equal(syncCodeVersion("nyc-2022"), defaultSyncCodeVersion);
assert.equal(syncCodeVersion("2022 Construction Codes"), defaultSyncCodeVersion);
assert.equal(syncCodeVersion("2022 CONSTRUCTION CODES"), defaultSyncCodeVersion);
assert.equal(syncCodeVersion(defaultSyncCodeVersion), defaultSyncCodeVersion);

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
