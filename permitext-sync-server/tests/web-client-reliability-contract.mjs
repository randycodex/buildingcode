import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  cacheRetryablePromise,
  resolveNotebookVersionConflict,
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

const offlineStorage = await readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8");
const searchCursorImplementation = offlineStorage.slice(
  offlineStorage.indexOf("async function matchingOfflineSearchResults"),
  offlineStorage.indexOf("async function sectionByIdentity")
);
assert(searchCursorImplementation.includes("openCursor"));
assert(!searchCursorImplementation.includes("getAll"));

console.log("permitext web client reliability contract passed");
