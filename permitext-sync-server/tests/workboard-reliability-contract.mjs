import assert from "node:assert/strict";
import {
  boardToRetry,
  localBoardNeedsSync,
  shouldUseRemoteBoard
} from "../src/workboard-reliability.js";

const failedBoard = { id: "project-1", updatedAt: "2026-07-31T12:00:00.000Z" };
const newerPendingBoard = { id: "project-1", updatedAt: "2026-07-31T12:00:01.000Z" };
assert.equal(boardToRetry(newerPendingBoard, failedBoard), newerPendingBoard);
assert.equal(boardToRetry(null, failedBoard), failedBoard);

const unsyncedLocal = { ...failedBoard, updatedAt: "2026-07-31T11:00:00.000Z" };
const newerClockRemote = { ...failedBoard, updatedAt: "2026-07-31T13:00:00.000Z" };
assert.equal(shouldUseRemoteBoard(unsyncedLocal, newerClockRemote), false);
assert.equal(localBoardNeedsSync(unsyncedLocal, newerClockRemote), true);

const syncedLocal = { ...failedBoard, syncedAt: "2026-07-31T11:59:00.000Z" };
assert.equal(shouldUseRemoteBoard(syncedLocal, newerClockRemote), true);
assert.equal(localBoardNeedsSync(syncedLocal, newerClockRemote), false);

console.log("permitext Workboard reliability contract passed");
