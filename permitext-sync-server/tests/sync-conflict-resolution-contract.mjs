import assert from "node:assert/strict";
import { syncConflictRecordsMatch } from "../public/sync-conflict-resolution.js";

const note = {
  id: "user:annotation:BC:101.1:paragraph",
  userID: "user",
  sectionID: "101.1",
  blockID: "paragraph",
  noteBody: "Keep the egress note.",
  tags: ["egress", "review"],
  updatedAt: "2026-08-08T10:00:00.000Z"
};

assert.equal(
  syncConflictRecordsMatch(note, {
    ...note,
    tags: ["review", "egress"],
    updatedAt: "2026-08-08T10:05:00.000Z",
    serverVersion: 4
  }),
  true,
  "transport timestamps, server versions, and tag ordering must not create a destructive conflict"
);

assert.equal(
  syncConflictRecordsMatch(note, {
    ...note,
    noteBody: "A different note written on the other device.",
    updatedAt: "2026-08-08T10:05:00.000Z"
  }),
  false,
  "different user-authored note text must require review"
);

assert.equal(
  syncConflictRecordsMatch(note, {
    ...note,
    tags: ["egress"],
    updatedAt: "2026-08-08T10:05:00.000Z"
  }),
  false,
  "a tag removal must not be silently replaced by a union or last-write-wins rule"
);

assert.equal(
  syncConflictRecordsMatch({
    id: "user:project:1",
    userID: "user",
    name: "Project One",
    description: "Local description",
    updatedAt: "2026-08-08T10:00:00.000Z"
  }, {
    id: "user:project:1",
    userID: "user",
    name: "Project One renamed",
    description: "Local description",
    updatedAt: "2026-08-08T10:05:00.000Z"
  }),
  false,
  "project metadata edits must not be discarded without a shared base revision"
);

assert.equal(
  syncConflictRecordsMatch({ ...note, deletedAt: "2026-08-08T10:01:00.000Z" }, note),
  false,
  "delete versus keep is destructive and must require review"
);

console.log("permitext sync conflict resolution contract passed");
