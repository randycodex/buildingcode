import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  clearPendingResearchIntent,
  pendingResearchIntentStorageKey,
  pendingResearchIntentTTLMS,
  readPendingResearchIntent,
  writePendingResearchIntent
} from "../public/research-intent-state.js";

const root = new URL("..", import.meta.url);
const [appSource, serverSource, indexSource, stylesSource, serviceWorkerSource] = await Promise.all([
  readFile(new URL("public/app.js", root), "utf8"),
  readFile(new URL("app.mjs", root), "utf8"),
  readFile(new URL("public/index.html", root), "utf8"),
  readFile(new URL("public/styles.css", root), "utf8"),
  readFile(new URL("public/service-worker.js", root), "utf8")
]);

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const now = Date.now();
assert.equal(pendingResearchIntentTTLMS, 2 * 60 * 60 * 1000);
const storage = new MemoryStorage();
const intent = writePendingResearchIntent(storage, {
  intentID: "resume-intent-1",
  kind: "create-selection",
  workspaceID: "workspace-main",
  projectID: "project-a",
  originPaneID: "reader:one",
  originSurface: "reader",
  passages: [{
    sectionID: "113",
    selectedText: "Enacted source text",
    savedItemID: "saved-113",
    sessionToken: "must-not-persist"
  }],
  sessionToken: "must-not-persist",
  credential: "must-not-persist"
}, { now });
assert.equal(intent.expiresAt, now + pendingResearchIntentTTLMS);
const persisted = storage.getItem(pendingResearchIntentStorageKey);
assert.equal(persisted.includes("sessionToken"), false);
assert.equal(persisted.includes("credential"), false);
assert.deepEqual(
  readPendingResearchIntent(storage, {
    now: now + 1,
    allowedWorkspaceIDs: new Set(["workspace-main"])
  }),
  intent
);
assert.equal(clearPendingResearchIntent(storage, "different-intent"), false);
assert.ok(storage.getItem(pendingResearchIntentStorageKey));
assert.equal(clearPendingResearchIntent(storage, intent.intentID), true);
assert.equal(storage.getItem(pendingResearchIntentStorageKey), null);

writePendingResearchIntent(storage, {
  intentID: "expired-intent",
  kind: "create-selection",
  workspaceID: "workspace-main",
  passages: [{ sectionID: "113", selectedText: "Source" }]
}, { now });
assert.equal(readPendingResearchIntent(storage, { now: now + pendingResearchIntentTTLMS + 1 }), null);
assert.equal(storage.getItem(pendingResearchIntentStorageKey), null);

writePendingResearchIntent(storage, {
  intentID: "wrong-workspace",
  kind: "append-selection",
  workspaceID: "workspace-deleted",
  conversationID: "conversation-a",
  passages: [{ sectionID: "113", selectedText: "Source" }]
}, { now });
assert.equal(readPendingResearchIntent(storage, {
  now: now + 1,
  allowedWorkspaceIDs: new Set(["workspace-main"])
}), null);

assert.match(appSource, /NYC code research you can verify\./);
assert.match(appSource, /Read enacted code, save the sections that matter, and ask cited Research questions\./);
assert.match(appSource, /Explore the Codes/);
assert.match(appSource, /See How Research Works/);
assert.match(appSource, /Illustrative Research example/);
assert.match(appSource, /Static example — no question is submitted\./);
assert.match(appSource, /sectionID: 113[\s\S]*?sectionNumber: "202"[\s\S]*?SECTION 202: Definitions/);
assert.match(appSource, /aria-label", "Open enacted source BC 202 Definitions in Reader"/);
assert.match(appSource, /firstUseWelcomeSeenKey[\s\S]*?completeFirstUseWelcome\(\)/);
assert.doesNotMatch(appSource, /new URLSearchParams\(window\.location\.search\)\.size/);
assert.match(appSource, /"checkout"[\s\S]*?"appleSignIn"[\s\S]*?"organizationInvite"/);

assert.match(appSource, /writePendingResearchIntent\(sessionStorage/);
assert.match(appSource, /allowedWorkspaceIDs: pendingResearchWorkspaceIDs\(\)/);
assert.match(appSource, /pendingResearchIntentResumePromise/);
assert.match(appSource, /requestID: intent\.intentID/);
assert.match(
  appSource,
  /await openResearchConversation\(conversationID,[\s\S]*?clearPendingResearchIntent\(sessionStorage, intent\.intentID\)/,
  "The pending intent must clear only after the conversation opens."
);

assert.match(serverSource, /deterministicResearchConversationID\(context\.userID, requestID\)/);
assert.match(serverSource, /creationRequestFingerprint !== requestFingerprint/);
assert.match(serverSource, /RESEARCH_CREATE_REQUEST_CONFLICT/);
assert.match(serverSource, /creationRequestID: _creationRequestID/);
assert.match(serverSource, /creationRequestFingerprint: _creationRequestFingerprint/);
assert.match(serverSource, /withResearchConversationCreateLock/);

assert.match(stylesSource, /\.first-use-primary\s*\{[\s\S]*?color: #0d0d0f;[\s\S]*?background: var\(--accent-building\)/);
assert.match(stylesSource, /\.first-use-actions button,[\s\S]*?border: 0;/);
assert.match(stylesSource, /\.first-use-actions button:focus-visible,[\s\S]*?outline: 3px solid/);
assert.match(indexSource, /app\.js\?v=[^"']+/);
assert.match(serviceWorkerSource, /research-intent-state\.js\?v=[^"']+/);

console.log("ux ui first-use phase 5 contract passed");
