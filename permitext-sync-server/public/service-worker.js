const shellCacheName = "permitext-pro-shell-v1280";
const offlineAssetVersion = "20260901-2014-code-assets-v15";
const offlineAssetCacheName = `permitext-pro-code-assets-${offlineAssetVersion}`;
const shellURLs = [
  "/web/active-code-sources.js",
  "/web/active-code-search-scope.js",
  "/web/active-code-source-controller.js",
  "/web/active-code-source-navigation.js",
  "/web/code-asset-identity.js?v=20260923-asset-identity-v1",
  "/web/public-code-revision.js?v=20260928-public-revision-v3",
  "/web/workspace-access-gate.js?v=20260923-public-panes-v1",
  "/web/workspace-pane-hydration.js?v=20260923-independent-panes-v1",
  "/web/reader-search-match.js?v=20260923-chapter-search-v1",
  "/web/sync-identity.js",
  "/web/workspace-state.js?v=20260811-research-columns-v3",
  "/web/analytics.js?v=20260918-privacy-analytics-v1",
  "/favicon.ico",
  "/favicon-32.png",
  "/favicon-16.png",
  "/web/reader-definitions.js?v=20260917-definitions-v87",
  "/web/reader-definition-registry.js?v=20260917-definitions-v87",
  "/web/reader-definition-popover.js?v=20260917-definitions-v87",
  "/web/reader-definition-popover.css?v=20260917-definitions-v87",
  "/web/definition-matcher.js?v=20260917-definitions-v87",
  "/web/reader-definition-registry.json?v=20260917-definitions-v87",
  "/web/group-catalog.js?v=20260914-v1",
  "/web/workspace-catalog.js?v=20260914-v1",
  "/workspace",
  "/",
  "/marketing/home.js?v=20260921-theme-switch-v1",
  "/web/manifest.webmanifest?v=20260919-workspace-entry-v1",
  "/web/icons/permitext-192.png",
  "/web/icons/permitext-512.png",
  "/web/styles.css?v=20261004-research-source-notes-v636",
  "/web/fonts/source-serif-4-latin-wght-normal.woff2",
  "/web/fonts/source-serif-4-latin-wght-italic.woff2",
  "/web/app.js?v=20261004-research-recovery-question-v637",
  "/web/settings-copy.js?v=20260920-account-identity-v6",
  "/web/project-artifact-checkpoints.js?v=20260817-research-live-sync-v3",
  "/web/research-progress.js?v=20261004-failure-recovery-v125",
  "/web/research-failure-recovery.js?v=20261004-failure-recovery-v2",
  "/web/client-reliability.js?v=20260923-request-cancellation-v2",
  "/web/offline-storage.js?v=20261004-research-source-notes-v636",
  "/web/research-intent-state.js?v=20261004-research-source-notes-v636",
  "/web/sync-conflict-resolution.js?v=20260914-question-opt-in-v2",
  "/web/workspace-state.js?v=20260914-project-default-v11",
  "/web/code-question-workspace.js?v=20260914-question-opt-in-v2",
  "/web/code-question-client-state.js?v=20260914-question-state-v4",
  "/web/code-question-server.js?v=20260817-adaptive-research-answer-v1",
  "/web/code-question-legacy.js?v=20260806-code-question-legacy-v1",
  "/web/code-question-issue.js?v=20260803-code-question-issue-v1",
  "/web/code-question-define.js?v=20260803-code-question-analyze-v3",
  "/web/code-question-evidence.js?v=20260807-code-question-phase5a-v1",
  "/web/code-question-analysis.js?v=20260817-adaptive-research-answer-v1",
  "/web/code-question-review.js?v=20260803-code-question-review-v1",
  "/web/code-references.js?v=20260720-code-reference-links-v18",
  "/web/sync-identity.js?v=20260901-2014-code-v7",
  "/web/private-workspace-state.js?v=20260912-account-recovery-v8",
  "/web/legacy-workspace-restore.js?v=20260914-restore-v3",
  "/web/sync-state.js?v=20260924-empty-clears-v3"
];

// Only retain HTML whose entry point belongs to this shell generation.
async function isMatchingWorkspaceShell(response) {
  const html = await response.clone().text();
  const expected = shellURLs.find((url) => url.startsWith("/web/app.js?"));
  const scripts = html.match(/<script\b[^>]*>/gi) || [];
  return scripts.some((script) => {
    const source = script.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!source) return false;
    const url = new URL(source.replace(/&amp;/g, "&"), self.location.origin);
    return url.origin === self.location.origin && `${url.pathname}${url.search}` === expected;
  });
}

async function cacheCoherentShell(cache) {
  // Fetch once and validate the entire generation before replacing any known-good entry.
  const entries = await Promise.all(shellURLs.map(async (url) => {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok || response.status === 206 || response.headers.get("vary")?.trim() === "*") {
      throw new Error("Offline app installation failed. Please try again.");
    }
    if (url === "/workspace" && !(await isMatchingWorkspaceShell(response))) {
      throw new Error("The app was updated during offline preparation. Reload and try again.");
    }
    // Drain each body while other requests are still arriving. Holding unread
    // responses until the all-fetch barrier can exhaust browser connections.
    // Keep the original Response (including its URL/redirect metadata) for CacheStorage.
    await response.clone().arrayBuffer();
    return [url, response];
  }));
  await Promise.all(entries.filter(([url]) => url !== "/workspace").map(([url, response]) => cache.put(url, response)));
  const workspace = entries.find(([url]) => url === "/workspace");
  await cache.put(...workspace);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(shellCacheName)
      .then((cache) => cacheCoherentShell(cache))
  );
});

self.addEventListener("activate", (event) => {
  // Updates wait for existing controlled tabs to close. Do not claim an
  // uncontrolled document: it may still be running an older app generation.
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name.startsWith("permitext-pro-shell-") && name !== shellCacheName)
        .map((name) => caches.delete(name))
    ))
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(shellCacheName);
  // Never replace the offline workspace with marketing HTML from the root.
  const cacheKey = new URL(request.url).pathname === "/" ? "/" : "/workspace";
  try {
    // Revalidate the HTML even when an older release gave it a long HTTP TTL.
    // CacheStorage remains the explicit fallback when the network is down.
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) {
      if (cacheKey === "/workspace" && !(await isMatchingWorkspaceShell(response))) {
        return (await cache.match(cacheKey)) || response;
      }
      await cache.put(cacheKey, response.clone());
    }
    if (response.status >= 500) return (await cache.match(cacheKey)) || response;
    return response;
  } catch (error) {
    return (await cache.match(cacheKey)) || Promise.reject(error);
  }
}

async function cacheFirstAsset(request) {
  const url = new URL(request.url);
  const requestedAssetRevision = url.searchParams.get("assetRevision");
  const revisionedAsset = url.pathname.startsWith("/code/assets/") && /^[a-f0-9]{64}$/.test(requestedAssetRevision || "");
  const cache = await caches.open(
    revisionedAsset ? `permitext-pro-code-assets-revision-${requestedAssetRevision}` :
      url.pathname.startsWith("/code/assets/") ? offlineAssetCacheName : shellCacheName
  );
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && (!revisionedAsset || response.headers.get("x-permitext-asset-revision") === requestedAssetRevision)) {
    await cache.put(request, response.clone());
  }
  return response;
}

function isPublicAppNavigation(url) {
  return url.pathname === "/" ||
    url.pathname === "/workspace" ||
    url.pathname === "/workspace/" ||
    url.pathname === "/web" ||
    url.pathname === "/web/" ||
    url.pathname.startsWith("/open/section/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && isPublicAppNavigation(url)) {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }
  if (url.pathname.startsWith("/web/") || url.pathname.startsWith("/marketing/") || url.pathname.startsWith("/code/assets/")) {
    event.respondWith(cacheFirstAsset(event.request));
  }
});
