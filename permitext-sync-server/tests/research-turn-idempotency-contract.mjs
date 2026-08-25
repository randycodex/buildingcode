import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchRequestMessageIdentity,
  researchRequestReservationID
} from "../app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const appSource = await readFile(join(root, "../app.mjs"), "utf8");
const handlerStart = appSource.indexOf("async function handleResearchConversationMessage");
const handlerEnd = appSource.indexOf("async function handleResearchConversationDelete", handlerStart);
const handler = appSource.slice(handlerStart, handlerEnd);

const identity = researchRequestMessageIdentity("user-1", "conversation-1", "request-1");
assert.equal(identity, researchRequestMessageIdentity("user-1", "conversation-1", "request-1"));
assert.notEqual(identity, researchRequestMessageIdentity("user-1", "conversation-1", "request-2"));
assert.equal(researchRequestReservationID("user-1", "conversation-1", "request-1"), `${identity}:usage`);

assert.match(handler, /RESEARCH_REQUEST_ID_REQUIRED/);
assert.match(handler, /RESEARCH_REQUEST_ID_CONFLICT/);
assert.match(handler, /reservation\.reason === "duplicate"/);
assert.match(handler, /RESEARCH_REQUEST_IN_PROGRESS/);
assert.match(handler, /researchRequestReservationID\(/);
assert.match(handler, /await releaseResearchUsageReservation\(context\.userID, researchReservationID\)/);
assert.match(handler, /researchReservationCompleted = !mockMode && Boolean\(researchReservationID\)/);

console.log("Permitext Research one-completed-turn idempotency contract passed; paid model calls: no.");
