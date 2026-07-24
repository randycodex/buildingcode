import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, offlineStorage, serviceWorker, manifest] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/offline-storage.js", import.meta.url), "utf8"),
  readFile(new URL("../public/service-worker.js", import.meta.url), "utf8"),
  readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8")
]);

assert(html.includes('rel="manifest"'), "Web app does not advertise its install manifest.");
assert(html.includes("Offline Access"), "Settings does not expose the offline-access card.");
assert(html.includes("Pro feature"), "Offline access is not labelled as a Pro feature.");
assert(app.includes("isProAccount()"), "Offline access is not connected to the Pro entitlement.");
assert(app.includes("offlineAPI(path)"), "Network failures do not fall back to the offline code library.");
assert(
  offlineStorage.includes('navigator.serviceWorker.register("/service-worker.js", { scope: "/" })'),
  "Offline installation does not register a root-scoped service worker."
);
assert(
  offlineStorage.includes('fetchJSON("/code/chapters"') &&
    offlineStorage.includes("?include=body"),
  "Offline installation does not download the complete chapter library."
);
assert(
  offlineStorage.includes("disableOfflineFeature") &&
    offlineStorage.includes("registration.unregister()"),
  "Losing Pro access does not remove offline storage and registration."
);
assert(
  offlineStorage.includes("saveOfflineSyncSnapshot") &&
    offlineStorage.includes("loadOfflineSyncSnapshot") &&
    app.includes('status: "offline"'),
  "Cold offline startup does not preserve the last synced Pro account snapshot."
);
assert(serviceWorker.includes('event.request.mode === "navigate"'), "Service worker does not support offline navigation.");
assert(serviceWorker.includes('cache.match("/")'), "Service worker has no cached app-shell fallback.");
assert.equal(JSON.parse(manifest).display, "standalone", "Manifest is not installable as a standalone app.");

console.log("permitext offline contract passed");
