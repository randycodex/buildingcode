import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  compareOfflineChapters,
  offlineAssetNamesForChapter,
  offlineFeatureMetadata
} from "../public/offline-storage.js";

const [html, app, offlineStorage, serviceWorker, manifest] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8"),
  readFile(new URL("../public/service-worker.js", import.meta.url), "utf8"),
  readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8")
]);

assert(html.includes('rel="manifest"'), "Web app does not advertise its install manifest.");
assert(html.includes("Offline Access"), "Settings does not expose the offline-access card.");
assert(!html.includes('class="settings-pro-badge"'), "Offline access still renders a redundant Pro feature badge.");
assert(app.includes("Offline reading is a Pro feature."), "Free users are not told that offline reading requires Pro.");
assert(app.includes("isProAccount()"), "Offline access is not connected to the Pro entitlement.");
assert(app.includes("offlineAPI(path)"), "Network failures do not fall back to the offline code library.");
assert(
  offlineStorage.includes('navigator.serviceWorker.register("/service-worker.js", { scope: "/" })'),
  "Offline installation does not register a root-scoped service worker."
);
assert(
  offlineStorage.includes('fetchJSON("/code/chapters"') &&
    offlineStorage.includes('fetchJSON("/code/libraries"') &&
    offlineStorage.includes("?include=body") &&
    offlineStorage.includes("cacheOfflineAssets([...referencedAssetNames].sort()"),
  "Offline installation does not download the code index, trust metadata, and complete figure library."
);
assert(
  offlineStorage.includes("codeTrustProfiles: librariesPayload.codeTrustProfiles || []") &&
    offlineStorage.includes("librarySchemaVersion: offlineLibrarySchemaVersion") &&
    offlineStorage.includes('if (url.pathname === "/code/libraries")') &&
    offlineStorage.includes("codeTrustProfiles: metadata.codeTrustProfiles || []"),
  "Cold offline startup cannot recover the installed legal-source trust metadata."
);
assert(
  offlineStorage.includes("disableOfflineFeature") &&
    offlineStorage.includes("registration.unregister()"),
  "Losing Pro access does not remove offline storage and registration."
);
assert(
  app.includes('offlineRemove.addEventListener("click"') &&
    app.includes("await disableOfflineFeature();") &&
    !app.includes("await removeOfflineLibrary();"),
  "Removing a download does not unregister the offline service worker."
);
assert(
  offlineStorage.includes("saveOfflineSyncSnapshot") &&
    offlineStorage.includes("loadOfflineSyncSnapshot") &&
    app.includes('status: "offline"'),
  "Cold offline startup does not preserve the last synced Pro account snapshot."
);
assert(
  offlineStorage.includes('const notebookImagesStoreName = "notebook-images"') &&
    offlineStorage.includes("stageNotebookImage") &&
    offlineStorage.includes("markNotebookImageUploaded") &&
    offlineStorage.includes("saveNotebookDraft") &&
    offlineStorage.includes("saveNotebookProjectSnapshot") &&
    offlineStorage.includes("saveNotebookCardSnapshot") &&
    app.includes("flushPendingNotebookImages") &&
    app.includes('permitext:notebook-image-uploaded'),
  "Notebook images do not use the durable offline queue and draft reconciliation path."
);
assert(
  offlineFeatureMetadata.assetCacheName.includes(offlineFeatureMetadata.assetVersion) &&
    offlineStorage.includes("caches.open(offlineAssetCacheName)") &&
    serviceWorker.includes("offlineAssetCacheName"),
  "Downloaded code figures are not isolated from disposable app-shell cache generations."
);
assert(
  serviceWorker.includes("cache.addAll(shellURLs)") &&
    serviceWorker.includes("event.waitUntil"),
  "A service-worker update can activate before its replacement shell is cached."
);
assert(serviceWorker.includes('cache.match("/")'), "Service worker has no cached app-shell fallback.");
assert.equal(JSON.parse(manifest).display, "standalone", "Manifest is not installable as a standalone app.");

function constantValue(source, name) {
  return source.match(new RegExp(`const ${name} = "([^"]+)";`))?.[1] || "";
}

assert.equal(
  constantValue(offlineStorage, "shellCacheName"),
  constantValue(serviceWorker, "shellCacheName"),
  "Offline storage and the active service worker use different shell cache generations."
);
assert.equal(
  offlineFeatureMetadata.shellCacheName,
  constantValue(serviceWorker, "shellCacheName"),
  "Exported offline metadata does not describe the active shell cache."
);
assert.equal(
  offlineFeatureMetadata.librarySchemaVersion,
  2,
  "Offline packages do not advertise the legal-source metadata schema."
);
assert(
  html.includes(offlineFeatureMetadata.shellAssetVersion) &&
    app.includes(`./offline-storage.js?v=${offlineFeatureMetadata.shellAssetVersion}`) &&
    offlineStorage.includes(`/web/offline-storage.js?v=${offlineFeatureMetadata.shellAssetVersion}`),
  "The served app shell does not consistently reference the active shell asset generation."
);
assert(
  app.includes("?v=${offlineFeatureMetadata.assetVersion}") &&
    offlineStorage.includes("?v=${offlineAssetVersion}"),
  "Downloaded figures and rendered figure requests do not share one cache key."
);

assert.deepEqual(
  offlineAssetNamesForChapter({
    sections: [{
      blocks: [
        { imageID: "equation-1.png" },
        { html: '<img src="../../assets/diagram-2.svg?legacy=1"><img src="data:image/png;base64,ignored">' },
        { imageID: "equation-1.png" }
      ]
    }]
  }).sort(),
  ["diagram-2.svg", "equation-1.png"],
  "Offline figure discovery missed or duplicated referenced chapter assets."
);

const unsortedChapters = [
  { id: 10, codePrefix: "BC", chapterNumber: "10" },
  { id: 2, codePrefix: "BC", chapterNumber: "2" },
  { id: 28, codePrefix: "AC", chapterNumber: "28" }
];
assert.deepEqual(
  unsortedChapters.sort(compareOfflineChapters).map((chapter) => `${chapter.codePrefix}-${chapter.chapterNumber}`),
  ["AC-28", "BC-2", "BC-10"],
  "Offline chapters are not ordered by code and numeric chapter number."
);

const listeners = new Map();
const navigationCacheWrites = [];
const shellPrecacheURLs = [];
const deletedCacheNames = [];
let cachedNavigationResponse = null;
let nextNetworkResponse = null;
const navigationCache = {
  async addAll(urls) {
    shellPrecacheURLs.push(...urls);
  },
  async match(key) {
    return String(key) === "/" ? cachedNavigationResponse : null;
  },
  async put(key) {
    navigationCacheWrites.push(String(key));
  }
};
vm.runInNewContext(serviceWorker, {
  URL,
  Promise,
  caches: {
    async open() {
      return navigationCache;
    },
    async keys() {
      return ["permitext-pro-shell-v222", offlineFeatureMetadata.assetCacheName];
    },
    async delete(name) {
      deletedCacheNames.push(name);
      return true;
    }
  },
  async fetch() {
    return nextNetworkResponse || {
      ok: true,
      status: 200,
      clone() {
        return this;
      }
    };
  },
  self: {
    location: { origin: "https://permitext.test" },
    clients: { claim: async () => {} },
    skipWaiting() {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  }
});

let installCompletion;
listeners.get("install")({
  waitUntil(value) {
    installCompletion = Promise.resolve(value);
  }
});
await installCompletion;
assert(shellPrecacheURLs.includes("/") && shellPrecacheURLs.includes("/web/app.js?v=20260812-research-history-project-v92"));
assert(shellPrecacheURLs.includes("/web/styles.css?v=20260812-research-history-project-v92"));
assert(shellPrecacheURLs.includes("/web/research-progress.js?v=20260812-research-history-project-v92"));
assert(shellPrecacheURLs.includes("/web/client-reliability.js?v=20260809-session-stability-v1"));
assert(shellPrecacheURLs.includes("/web/workspace-state.js?v=20260811-research-columns-v3"));
assert(!shellPrecacheURLs.some((url) => url.includes("/web/workboard-assets/workboard.css")));
assert(shellPrecacheURLs.includes("/web/code-question-workspace.js?v=20260809-decision-index-width-v1"));
assert(shellPrecacheURLs.includes("/web/code-question-client-state.js?v=20260809-session-stability-v3"));
assert(shellPrecacheURLs.includes("/web/code-question-server.js?v=20260809-code-decision-v2"));
assert(shellPrecacheURLs.includes("/web/code-question-legacy.js?v=20260806-code-question-legacy-v1"));
assert(shellPrecacheURLs.includes("/web/code-question-issue.js?v=20260803-code-question-issue-v1"));
assert(shellPrecacheURLs.includes("/web/code-question-define.js?v=20260803-code-question-analyze-v3"));
assert(shellPrecacheURLs.includes("/web/code-question-evidence.js?v=20260807-code-question-phase5a-v1"));
assert(shellPrecacheURLs.includes("/web/code-question-analysis.js?v=20260803-code-question-analyze-v3"));
assert(shellPrecacheURLs.includes("/web/code-question-review.js?v=20260803-code-question-review-v1"));
assert(shellPrecacheURLs.includes("/web/fonts/inter-latin-wght-normal.woff2"));
assert(shellPrecacheURLs.includes("/web/fonts/inter-latin-wght-italic.woff2"));
assert(shellPrecacheURLs.includes("/web/fonts/source-serif-4-latin-wght-normal.woff2"));
assert(shellPrecacheURLs.includes("/web/fonts/source-serif-4-latin-wght-italic.woff2"));

let activationCompletion;
listeners.get("activate")({
  waitUntil(value) {
    activationCompletion = Promise.resolve(value);
  }
});
await activationCompletion;
assert.ok(deletedCacheNames.some((name) => name.startsWith("permitext-pro-shell-") && name !== "permitext-pro-shell-v648"));

function navigationResponse(path) {
  let response;
  listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: `https://permitext.test${path}`
    },
    respondWith(value) {
      response = Promise.resolve(value);
    }
  });
  return response;
}

assert.equal(navigationResponse("/internal/"), undefined, "Internal navigation can overwrite the public app fallback.");
assert.equal(
  navigationResponse("/account/apple/callback"),
  undefined,
  "Authentication callback navigation can overwrite the public app fallback."
);
assert.equal(navigationResponse("/health"), undefined, "Health navigation can overwrite the public app fallback.");
await navigationResponse("/");
await navigationResponse("/open/section/303");
assert.deepEqual(
  navigationCacheWrites,
  ["/", "/"],
  "Public app navigation does not refresh only the cached public app shell."
);
cachedNavigationResponse = { source: "cached-shell" };
nextNetworkResponse = { ok: false, status: 503 };
assert.equal((await navigationResponse("/")).source, "cached-shell", "Resolved 503 navigation bypassed the offline shell.");

console.log("permitext offline contract passed");
