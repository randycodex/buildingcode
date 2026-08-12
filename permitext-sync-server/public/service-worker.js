const shellCacheName = "permitext-pro-shell-v587";
const offlineAssetVersion = "20260725-visual-inventory-v13";
const offlineAssetCacheName = `permitext-pro-code-assets-${offlineAssetVersion}`;
const shellURLs = [
  "/",
  "/web/manifest.webmanifest?v=20260725-visual-inventory-v13",
  "/web/icons/permitext-192.png",
  "/web/icons/permitext-512.png",
  "/web/styles.css?v=20260811-search-history-clipping-v1",
  "/web/fonts/inter-latin-wght-normal.woff2",
  "/web/fonts/inter-latin-wght-italic.woff2",
  "/web/fonts/source-serif-4-latin-wght-normal.woff2",
  "/web/fonts/source-serif-4-latin-wght-italic.woff2",
  "/web/app.js?v=20260811-research-project-caption-v1",
  "/web/client-reliability.js?v=20260809-session-stability-v1",
  "/web/offline-storage.js?v=20260811-search-history-clipping-v1",
  "/web/sync-conflict-resolution.js?v=20260809-code-decision-v5",
  "/web/workspace-state.js?v=20260811-research-columns-v3",
  "/web/code-question-workspace.js?v=20260809-decision-index-width-v1",
  "/web/code-question-client-state.js?v=20260809-session-stability-v3",
  "/web/code-question-server.js?v=20260809-code-decision-v2",
  "/web/code-question-legacy.js?v=20260806-code-question-legacy-v1",
  "/web/code-question-issue.js?v=20260803-code-question-issue-v1",
  "/web/code-question-define.js?v=20260803-code-question-analyze-v3",
  "/web/code-question-evidence.js?v=20260807-code-question-phase5a-v1",
  "/web/code-question-analysis.js?v=20260803-code-question-analyze-v3",
  "/web/code-question-review.js?v=20260803-code-question-review-v1",
  "/web/code-references.js?v=20260720-code-reference-links-v18",
  "/web/sync-identity.js?v=20260728-enacted-code-expansion-v6",
  "/web/sync-state.js?v=20260811-research-code-basis-v2"
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
