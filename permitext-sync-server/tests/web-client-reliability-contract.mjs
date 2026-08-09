import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  cacheRetryablePromise,
  clientValuesMatch,
  resolveNotebookVersionConflict,
  stableClientValue,
  shouldUseOfflineFallback
} from "../public/client-reliability.js";

const cache = new Map();
let attempts = 0;
await assert.rejects(() => cacheRetryablePromise(cache, "chapter", async () => {
  attempts += 1;
  throw new Error("temporary outage");
}));
assert.equal(cache.has("chapter"), false);
assert.equal(
  await cacheRetryablePromise(cache, "chapter", async () => {
    attempts += 1;
    return "recovered";
  }),
  "recovered"
);
assert.equal(attempts, 2);

const localDocument = { type: "doc", content: [{ type: "paragraph" }] };
const conflict = resolveNotebookVersionConflict(
  { id: "card-1", title: "Local title", version: 2 },
  localDocument,
  { id: "card-1", title: "Remote title", document: { type: "doc" }, version: 3 }
);
assert.equal(conflict.activeCard.version, 3);
assert.equal(conflict.activeCard.title, "Local title");
assert.equal(conflict.activeCard.document, localDocument);
assert.equal(conflict.dirty, true);

assert.equal(shouldUseOfflineFallback(503), true);
assert.equal(shouldUseOfflineFallback(429), false);
assert.equal(shouldUseOfflineFallback(404), false);

assert.deepEqual(stableClientValue({ z: 1, a: { y: 2, x: 3 } }), {
  a: { x: 3, y: 2 },
  z: 1
});
assert.equal(clientValuesMatch(
  { userID: "user-1", entitlement: { plan: "pro", addOns: { research: true } } },
  { entitlement: { addOns: { research: true }, plan: "pro" }, userID: "user-1" }
), true, "Equivalent account sessions must not trigger another render because object key order changed.");
assert.equal(clientValuesMatch(
  { userID: "user-1", sessionToken: "session-a" },
  { userID: "user-1", sessionToken: "session-b" }
), false, "A changed authenticated session must still propagate across browser contexts.");

const workspaceApp = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
assert(
  workspaceApp.includes("if (clientValuesMatch(JSON.parse(raw), account)) return false;") &&
    workspaceApp.includes("if (clientValuesMatch(state.account.entitlement || null, nextEntitlement))") &&
    workspaceApp.includes("if (clientValuesMatch(state.account || null, nextAccount)) return;"),
  "No-op account and entitlement writes must not restart sync or rebuild the entire workspace."
);

const workspaceStyles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const workspacePanelRule = workspaceStyles.slice(
  workspaceStyles.indexOf(".workspace-panel {"),
  workspaceStyles.indexOf(".settings-panel,")
);
assert.match(workspacePanelRule, /height:\s*100%;/);
assert.doesNotMatch(
  workspacePanelRule,
  /height:\s*calc\(100%\s*\+\s*var\(--space-3\)\)/,
  "Columns and their vertical dividers must terminate at the same track edge, including empty states."
);
assert.doesNotMatch(
  workspaceStyles,
  /body\.code-question-workspace-enabled \.panel-track/,
  "Code Decision mode must use the standard two-row shell without reserving space for a removed context bar."
);

const offlineStorage = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const searchCursorImplementation = offlineStorage.slice(
  offlineStorage.indexOf("async function matchingOfflineSearchResults"),
  offlineStorage.indexOf("async function sectionByIdentity")
);
assert(searchCursorImplementation.includes("openCursor"));
assert(!searchCursorImplementation.includes("getAll"));

console.log("permitext web client reliability contract passed");
