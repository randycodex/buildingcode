const shellCacheName = "permitext-pro-shell-v1874";
const offlineAssetVersion = "20260901-2014-code-assets-v15";
const offlineAssetCacheName = `permitext-pro-code-assets-${offlineAssetVersion}`;
const shellURLs = [
  "/web/project-details-columns.js?v=20261019-project-workflow-v2",
  "/web/workflow-views.js?v=9",
  "/web/active-code-sources.js",
  "/web/downloaded-library.js?v=8",
  "/web/downloaded-library-worker.js?v=8",
  "/web/downloaded-library-core.js?v=8",
  "/web/settings-columns.js?v=1",
  "/web/project-details-columns.js?v=20261021-project-columns-v3",
  "/web/workspace-button-icons.js?v=20261017-calculator-column-v1",
  "/web/minimal-workflow.js",
  "/web/notebook-questions.js",
  "/web/project-workflow.js?v=20261021-project-questions-v8",
  "/web/search-relevance.js?v=20261023-notes-reveal-v1298",
  "/web/occupant-load-calculation.js?v=23",
  "/web/notebook-passage-blocks.js?v=6",
  "/web/evidence-comments.js?v=5",
  "/web/notebook-passage-disclosure.js?v=1",
  "/web/search-words.js?v=20261023-notes-reveal-v1298",
  "/web/nyc-property-facts.js?v=20261004-zola-facts-v1",
  "/web/active-code-sources.js?v=2",
  "/web/active-code-search-scope.js",
  "/web/active-code-source-controller.js?v=2",
  "/web/active-code-source-navigation.js",
  "/web/code-asset-identity.js?v=20260923-asset-identity-v1",
  "/web/public-code-revision.js?v=20260928-public-revision-v3",
  "/web/workspace-access-gate.js?v=20260923-public-panes-v1",
  "/web/workspace-pane-hydration.js?v=20260923-independent-panes-v1",
  "/web/reader-search-match.js?v=20261015-reader-search-preview-v3",
  "/web/report-autosave.js?v=1",
  "/web/report-undo.js?v=2",
  "/web/scroll-edge-fades.js?v=20261022-viewport-v7",
  "/web/report-outline.js?v=20261018-pinned-outline-v12",
  "/web/report-export-review.js?v=20261012-report-export-v13",
  "/web/report-comparison.js?v=20261012-comparison-v20",
  "/web/workspace-resume.js?v=20261019-project-workflow-v5",
  "/web/reader-navigation-tree.js?v=20261010-contents-v1",
  "/web/reader-chapter-extent.js?v=30261010-chapter-extent-v2",
  "/web/sync-identity.js",
  "/web/analytics.js?v=20260918-privacy-analytics-v1",
  "/favicon.ico",
  "/favicon-32.png",
  "/favicon-16.png",
  "/web/reader-definitions.js?v=20260917-definitions-v87",
  "/web/reader-definition-registry.js?v=20260917-definitions-v87",
  "/web/reader-definition-popover.js?v=20260917-definitions-v87",
  "/web/reader-definition-popover.css?v=20261018-definition-theme-v90",
  "/web/definition-matcher.js?v=20260917-definitions-v87",
  "/web/reader-definition-registry.json?v=20260917-definitions-v87",
  "/web/group-catalog.js?v=20260914-v1",
  "/web/workspace-catalog.js?v=20260914-v1",
  "/web/workspace-layout-sync.js?v=1",
  "/workspace",
  "/",
  "/marketing/home.js?v=20260921-theme-switch-v1",
  "/web/manifest.webmanifest?v=20260919-workspace-entry-v1",
  "/web/icons/permitext-192.png",
  "/web/icons/permitext-512.png",
  "/web/styles.css?v=20261023-notes-reveal-v1298",
  "/web/fonts/ibm-plex-sans-variable-roman.woff2?v=1da12f0",
  "/web/fonts/ibm-plex-sans-variable-italic.woff2?v=1da12f0",
  "/web/fonts/source-serif-4-latin-wght-normal.woff2",
  "/web/fonts/source-serif-4-latin-wght-italic.woff2",
  "/web/assistant-materials.js?v=4",
  "/web/app.js?v=20261023-layout-sync-v1299",
  "/web/settings-copy.js?v=20260920-account-identity-v6",
  "/web/project-artifact-checkpoints.js?v=20260817-research-live-sync-v3",
  "/web/research-progress.js?v=20261005-natural-recovery-v127",
  "/web/research-failure-recovery.js?v=20261005-natural-recovery-v4",
  "/web/client-reliability.js?v=20260923-request-cancellation-v2",
  "/web/offline-storage.js?v=20261023-layout-sync-v1299",
  "/web/research-intent-state.js?v=20261010-project-message-timeout-v780",
  "/web/sync-conflict-resolution.js?v=20260914-question-opt-in-v2",
  "/web/column-expansion.js?v=20261022-boundary-observer-v2",
  "/web/workspace-state.js?v=20261023-notes-reveal-v1298",
  "/web/recent-view-scope.js?v=1",
  "/web/recent-search-scope.js?v=1",
  "/web/workspace-state.js?v=20261012-workflow-views-v18",
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
  "/web/sync-identity.js?v=20261021-identity-fast-path-v8",
  "/web/private-workspace-state.js?v=20260912-account-recovery-v8",
  "/web/legacy-workspace-restore.js?v=20261012-workflow-cache-v5",
  "/web/sync-state.js?v=20261021-bulk-clear-index-v4",
  "/web/workflow-views.js?v=12",
  "/web/public-content-cache.js?v=1",
  "/web/report-screen.js?v=20261011-shared-shell-v6",
  "/web/report-library.js?v=20261012-sidebar-width-v8",
  "/web/notebook-note-menu.js?v=20261023-notes-reveal-v1298",
  "/web/notebook-columns.js?v=2",
  "/web/reader-block-window.js?v=9",
  "/web/reader-section-visibility.js?v=4",
  "/web/reader-render-batches.js?v=20261012-reader-batches-v1",
  "/web/search-query-session.js?v=20261012-search-session-v2",
  "/web/report-pdf-preview.js?v=20261012-report-preview-v4",
  "/web/pdf-preview-assets/pdf.min.js",
  "/web/pdf-preview-assets/pdf.worker.min.js"
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
  // Packages are checkpointed in IndexedDB. Never cache a mutable update manifest.
  if (url.pathname.startsWith("/web/downloaded-library/")) return;
  if (url.pathname.startsWith("/web/") || url.pathname.startsWith("/marketing/") || url.pathname.startsWith("/code/assets/")) {
    event.respondWith(cacheFirstAsset(event.request));
  }
});
