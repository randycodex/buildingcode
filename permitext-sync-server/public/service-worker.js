const shellCacheName = "permitext-pro-shell-v356";
const offlineAssetVersion = "20260725-visual-inventory-v13";
const offlineAssetCacheName = `permitext-pro-code-assets-${offlineAssetVersion}`;
const shellURLs = [
  "/",
  "/web/manifest.webmanifest?v=20260725-visual-inventory-v13",
  "/web/icons/permitext-192.png",
  "/web/icons/permitext-512.png",
  "/web/styles.css?v=20260802-archived-label-v392",
  "/web/workboard-assets/workboard.css?v=20260801-workboard-control-align-v68",
  "/web/app.js?v=20260802-archived-label-v392",
  "/web/client-reliability.js?v=20260731-debug-audit-v1",
  "/web/offline-storage.js?v=20260802-archived-label-v392",
  "/web/workspace-state.js?v=20260802-coordination-workspace-v2",
  "/web/code-references.js?v=20260720-code-reference-links-v18",
  "/web/sync-identity.js?v=20260728-enacted-code-expansion-v6",
  "/web/sync-state.js?v=20260721-causal-clear-v4"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(shellCacheName)
      .then((cache) => cache.addAll(shellURLs))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name.startsWith("permitext-pro-shell-") && name !== shellCacheName)
        .map((name) => caches.delete(name))
    ))
  ]));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(shellCacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put("/", response.clone());
    if (response.status >= 500) return (await cache.match("/")) || response;
    return response;
  } catch (error) {
    return (await cache.match("/")) || Promise.reject(error);
  }
}

async function cacheFirstAsset(request) {
  const url = new URL(request.url);
  const cache = await caches.open(
    url.pathname.startsWith("/code/assets/") ? offlineAssetCacheName : shellCacheName
  );
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function isPublicAppNavigation(url) {
  return url.pathname === "/" ||
    url.pathname === "/web" ||
    url.pathname === "/web/" ||
    url.pathname === "/detached-workboard" ||
    url.pathname.startsWith("/open/section/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && isPublicAppNavigation(url)) {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }
  if (url.pathname.startsWith("/web/") || url.pathname.startsWith("/code/assets/")) {
    event.respondWith(cacheFirstAsset(event.request));
  }
});
