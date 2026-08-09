import assert from "node:assert/strict";
import {
  bulkClearEventID,
  annotationAfterBulkClears,
  bulkClearTimestamp,
  foregroundSyncDelay,
  foregroundSyncSchedule,
  mergeNewestRecord,
  recordSurvivesBulkClear,
  syncCheckpointRequiresFullPull,
  syncLeaderLeaseIsAvailable
} from "../public/sync-state.js";

assert.equal(
  foregroundSyncDelay({ now: 60_000, lastActivityAt: 0, random: 0.5 }),
  foregroundSyncSchedule.activeIntervalMs,
  "Recently active clients did not use the active checkpoint interval."
);
assert.equal(
  foregroundSyncDelay({ now: 10 * 60_000, lastActivityAt: 0, random: 0.5 }),
  foregroundSyncSchedule.recentlyActiveIntervalMs,
  "Recently idle clients did not back off their checkpoint interval."
);
assert.equal(
  foregroundSyncDelay({ now: 30 * 60_000, lastActivityAt: 0, random: 0.5 }),
  foregroundSyncSchedule.idleIntervalMs,
  "Idle clients did not use the longest checkpoint interval."
);

const unchangedCheckpoint = {
  changed: false,
  latestEventID: 12,
  contentMapVersion: 2,
  entitlementFingerprint: "entitlement-a"
};
assert.equal(syncCheckpointRequiresFullPull({
  checkpoint: unchangedCheckpoint,
  latestEventID: 12,
  contentMapVersion: 2,
  entitlementFingerprint: "entitlement-a",
  lastFullPullAt: 10 * 60_000,
  now: 20 * 60_000
}), false, "An unchanged fresh checkpoint triggered a full pull.");
assert.equal(syncCheckpointRequiresFullPull({
  checkpoint: { ...unchangedCheckpoint, latestEventID: 13 },
  latestEventID: 12,
  contentMapVersion: 2,
  entitlementFingerprint: "entitlement-a",
  lastFullPullAt: 10 * 60_000,
  now: 20 * 60_000
}), true, "A remote-device event did not force a full pull.");
assert.equal(syncCheckpointRequiresFullPull({
  checkpoint: unchangedCheckpoint,
  latestEventID: 12,
  contentMapVersion: 2,
  entitlementFingerprint: "entitlement-a",
  lastFullPullAt: 0,
  now: foregroundSyncSchedule.maximumStalenessMs
}), true, "Maximum staleness did not force reconciliation.");

assert.equal(syncLeaderLeaseIsAvailable(null, { accountUserID: "u1", tabID: "tab-2" }), true);
assert.equal(syncLeaderLeaseIsAvailable({
  accountUserID: "u1", tabID: "tab-1", expiresAt: 100
}, { accountUserID: "u1", tabID: "tab-2", now: 50 }), false,
"A follower stole an active leader lease.");
assert.equal(syncLeaderLeaseIsAvailable({
  accountUserID: "u1", tabID: "tab-1", expiresAt: 100
}, { accountUserID: "u1", tabID: "tab-2", now: 101 }), true,
"A crashed leader lease did not expire.");

const canonicalVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const clearRecords = [{
  userID: "apple:sync-state",
  codeVersion: "2022 Construction Codes",
  values: { scope: "bookmarks" },
  updatedAt: "2026-07-21T12:00:00.000Z"
}];

clearRecords.unshift({
  userID: "apple:sync-state",
  codeVersion: canonicalVersion,
  values: { scope: "bookmarks" },
  updatedAt: "2026-07-21T10:00:00.000Z"
});

assert.equal(
  bulkClearTimestamp(clearRecords, canonicalVersion, "bookmarks"),
  Date.parse("2026-07-21T12:00:00.000Z"),
  "Bulk clears must match equivalent code-version aliases."
);
assert.equal(
  bulkClearEventID([{ ...clearRecords[0], serverEventID: 42 }], canonicalVersion, "bookmarks"),
  42,
  "Bulk clears did not preserve server event order."
);
assert.equal(
  recordSurvivesBulkClear({
    codeVersion: canonicalVersion,
    updatedAt: "2026-07-21T13:00:00.000Z",
    serverEventID: 41
  }, [{ ...clearRecords[0], updatedAt: "2026-07-21T12:00:00.000Z", serverEventID: 42 }], ["bookmarks"]),
  false,
  "A clock-skewed record survived a later server-ordered clear."
);
assert.equal(
  recordSurvivesBulkClear({
    codeVersion: canonicalVersion,
    updatedAt: "2026-07-21T11:00:00.000Z",
    serverEventID: 43
  }, [{ ...clearRecords[0], updatedAt: "2026-07-21T12:00:00.000Z", serverEventID: 42 }], ["bookmarks"]),
  false,
  "An older edit replayed after a clear was allowed to resurrect."
);
assert.equal(
  recordSurvivesBulkClear({
    codeVersion: canonicalVersion,
    updatedAt: "2026-07-21T13:00:00.000Z",
    serverEventID: 43
  }, [{ ...clearRecords[0], updatedAt: "2026-07-21T12:00:00.000Z", serverEventID: 42 }], ["bookmarks"]),
  true,
  "A genuinely newer record was hidden by an older clear."
);
assert.equal(
  recordSurvivesBulkClear({ codeVersion: canonicalVersion, updatedAt: "2026-07-21T11:59:59.000Z" }, clearRecords, ["bookmarks"]),
  false,
  "An older saved item survived a newer clear."
);
assert.equal(
  recordSurvivesBulkClear({ codeVersion: canonicalVersion }, clearRecords, ["bookmarks"]),
  false,
  "An undated legacy browser item survived a durable clear."
);
assert.equal(
  recordSurvivesBulkClear({ codeVersion: canonicalVersion, updatedAt: "2026-07-21T12:00:01.000Z" }, clearRecords, ["bookmarks"]),
  true,
  "A newer saved item was hidden by an older clear."
);
assert.equal(
  recordSurvivesBulkClear({ codeVersion: canonicalVersion }, clearRecords, ["folders"]),
  true,
  "A bookmark clear incorrectly removed a project folder."
);

const annotationClearRecords = [
  ...clearRecords,
  {
    userID: "apple:sync-state",
    codeVersion: canonicalVersion,
    values: { scope: "notes" },
    updatedAt: "2026-07-21T12:00:00.000Z"
  }
];
assert.deepEqual(
  annotationAfterBulkClears({
    codeVersion: canonicalVersion,
    noteBody: "Old note",
    tags: ["Keep tag"],
    updatedAt: "2026-07-21T11:00:00.000Z"
  }, annotationClearRecords),
  {
    codeVersion: canonicalVersion,
    noteBody: null,
    tags: ["Keep tag"],
    updatedAt: "2026-07-21T11:00:00.000Z"
  },
  "Clearing notes also removed a surviving tag."
);
annotationClearRecords.push({
  userID: "apple:sync-state",
  codeVersion: canonicalVersion,
  values: { scope: "tags" },
  updatedAt: "2026-07-21T12:00:00.000Z"
});
assert.equal(
  annotationAfterBulkClears({
    codeVersion: canonicalVersion,
    noteBody: "Old note",
    tags: ["Old tag"],
    updatedAt: "2026-07-21T11:00:00.000Z"
  }, annotationClearRecords),
  null,
  "An annotation survived after both its note and tags were cleared."
);

const projects = new Map();
const remoteProject = { id: "p1", colorHex: "#F27A4F", updatedAt: "2026-07-21T12:00:00.000Z" };
mergeNewestRecord(projects, "p1", remoteProject);
mergeNewestRecord(projects, "p1", { id: "p1", colorHex: "#6674C8", updatedAt: "2026-07-21T11:00:00.000Z" });
assert.equal(projects.get("p1").colorHex, "#F27A4F", "A stale local color replaced the newer synced color.");
mergeNewestRecord(projects, "p1", { id: "p1", colorHex: "#5AAEA4" });
assert.equal(projects.get("p1").colorHex, "#F27A4F", "An undated local color replaced the synced color.");
mergeNewestRecord(projects, "p1", { id: "p1", colorHex: "#A14FC0", updatedAt: "2026-07-21T13:00:00.000Z" });
assert.equal(projects.get("p1").colorHex, "#A14FC0", "A newer offline color edit did not remain visible.");

console.log("permitext client latest-change state passed");
