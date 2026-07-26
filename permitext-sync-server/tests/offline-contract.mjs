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
    offlineStorage.includes("?include=body") &&
    offlineStorage.includes("cacheOfflineAssets([...referencedAssetNames].sort()"),
  "Offline installation does not download the complete chapter library and its figures."
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
const navigationCache = {
  async match() {
    return null;
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
      return [];
    },
    async delete() {
      return true;
    }
  },
  async fetch() {
    return {
      ok: true,
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

console.log("permitext offline contract passed");
