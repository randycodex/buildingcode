const shellCacheName = "permitext-pro-shell-v2293";
const offlineAssetVersion = "20260901-2014-code-assets-v15";
const offlineAssetCacheName = `permitext-pro-code-assets-${offlineAssetVersion}`;
const shellURLs = [
  "/web/notebook-content.js?v=8",
  "/web/notebook-titles.js?v=1",
  "/web/project-details-columns.js?v=20261019-project-workflow-v2",
  "/web/workflow-views.js?v=14",
  "/web/active-code-sources.js",
  "/web/offline-code-metadata.js?v=1",
  "/web/code-reference-resolution.js?v=2",
  "/web/downloaded-library.js?v=16",
  "/web/downloaded-library-worker.js?v=16",
  "/web/downloaded-library-core.js?v=14",
  "/web/search-citation-query.js?v=1",
  "/web/settings-columns.js?v=3",
  "/web/project-details-columns.js?v=20261021-project-columns-v3",
  "/web/workspace-button-icons.js?v=20261108-floating-menu-pins-v1382",
  "/web/minimal-workflow.js",
  "/web/notebook-questions.js",
  "/web/project-workflow.js?v=20261021-project-questions-v8",
  "/web/search-relevance.js?v=20261110-general-provisions-v2",
  "/web/occupant-load-calculation.js?v=31",
  "/web/calculation-drafts.js?v=3",
  "/web/notebook-passage-blocks.js?v=8",
  "/web/evidence-comments.js?v=6",
  "/web/notebook-passage-disclosure.js?v=1",
  "/web/search-words.js?v=20261025-workspace-chrome-v1379",
  "/web/nyc-property-facts.js?v=20261004-zola-facts-v1",
  "/web/active-code-sources.js?v=2",
  "/web/active-code-search-scope.js",
  "/web/active-code-source-controller.js?v=3",
  "/web/active-code-source-navigation.js",
  "/web/code-asset-identity.js?v=20260923-asset-identity-v1",
  "/web/public-code-revision.js?v=20261027-reference-metadata-v5",
  "/web/workspace-access-gate.js?v=20260923-public-panes-v1",
  "/web/workspace-pane-hydration.js?v=20260923-independent-panes-v1",
  "/web/reader-search-match.js?v=20261026-exact-section-v4",
  "/web/report-autosave.js?v=1",
  "/web/report-undo.js?v=4",
  "/web/scroll-edge-fades.js?v=20261108-reader-menus-v10",
  "/web/report-outline.js?v=20261018-pinned-outline-v12",
  "/web/report-export-review.js?v=20261109-report-export-v14",
  "/web/report-note-review.js?v=3",
  "/web/report-rich-text.js",
  "/web/report-comparison.js?v=20261109-comparison-v21",
  "/web/workspace-resume.js?v=20261019-project-workflow-v5",
  "/web/reader-navigation-tree.js?v=20261112-label-case-v3",
  "/web/reader-chapter-extent.js?v=20261112-visible-anchor-v3",
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
  "/web/workspace-layout-sync.js?v=5",
  "/web/project-update-notices.js?v=8",
  "/web/return-sync.js?v=1",
  "/web/project-update-policy.js?v=2",
  "/web/web-client-version.js?v=20261112-current-project-context-v1721",
  "/web/web-app-update.js?v=20261110-per-codes-v3",
  "/web/research-delete-controls.js?v=11",
  "/web/assistant-composer-hint.js?v=1",
  "/web/research-related-provisions.js?v=3",
  "/web/research-v2.js?v=29",
  "/web/research-inline-format.js?v=1",
  "/web/research-operation-gate.js?v=2",
  "/web/request-rate-limit.js?v=2",
  "/web/research-answer-links.js?v=1",
  "/web/research-answer-reveal.js?v=1",
  "/web/research-question-rail.js?v=2",
  "/web/research-reader-target.js?v=3",
  "/web/research-discovery-query.js?v=3",
  "/web/research-v2-rollout.js?v=2",
  "/web/research-v2.css?v=27",
  "/web/reader-shortcuts.js?v=8",
  "/web/reader-shortcuts.css?v=9",
  "/web/reader-tabs.js?v=4",
  "/workspace",
  "/",
  "/marketing/home.js?v=20260921-theme-switch-v1",
  "/web/manifest.webmanifest?v=20260919-workspace-entry-v1",
  "/web/icons/permitext-192.png",
  "/web/icons/permitext-512.png",
  "/web/styles.css?v=20261112-project-context-menu-v190",
  "/web/fonts/ibm-plex-sans-variable-roman.woff2?v=1da12f0",
  "/web/fonts/ibm-plex-sans-variable-italic.woff2?v=1da12f0",
  "/web/fonts/source-serif-4-latin-wght-normal.woff2",
  "/web/fonts/source-serif-4-latin-wght-italic.woff2",
  "/web/app.js?v=20261112-current-project-context-v1721",
  "/web/settings-copy.js?v=20261109-plan-actions-v8",
  "/web/project-artifact-checkpoints.js?v=20260817-research-live-sync-v3",
  "/web/research-progress.js?v=20261005-natural-recovery-v127",
  "/web/research-failure-recovery.js?v=20261005-natural-recovery-v4",
  "/web/client-reliability.js?v=20260923-request-cancellation-v2",
  "/web/offline-storage.js?v=20261112-current-project-context-v1721",
  "/web/research-intent-state.js?v=20261010-project-message-timeout-v780",
  "/web/sync-conflict-resolution.js?v=20260914-question-opt-in-v2",
  "/web/column-expansion.js?v=20261111-selective-menus-v3",
  "/web/workspace-state.js?v=20261109-notebook-toggle-v1300",
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
  "/web/code-references.js?v=20261027-code-reference-links-v19",
  "/web/sync-identity.js?v=20261021-identity-fast-path-v8",
  "/web/private-workspace-state.js?v=20260912-account-recovery-v8",
  "/web/legacy-workspace-restore.js?v=20261012-workflow-cache-v5",
  "/web/sync-state.js?v=20261021-bulk-clear-index-v4",
  "/web/workflow-views.js?v=12",
  "/web/public-content-cache.js?v=1",
  "/web/report-screen.js?v=20261107-floating-panels-v7",
  "/web/floating-workspace-panel.js?v=4",
  "/web/settings-disclosure-state.js?v=1",
  "/web/settings-saved-content.js?v=5",
  "/web/profile-preference-menu.js?v=3",
  "/web/report-library.js?v=20261012-sidebar-width-v8",
  "/web/notebook-note-menu.js?v=20261109-notebook-desk-v1299",
  "/web/notebook-columns.js?v=4",
  "/web/reader-block-window.js?v=10",
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

const retainedShellClientsKey = "/__permitext_retained_shell_clients__";

async function obsoleteShellCaches() {
  const generation = name => Number(name.match(/^permitext-pro-shell-v(\d+)$/)?.[1]) || 0;
  return (await caches.keys()).filter(name => generation(name) > 0 && generation(name) < generation(shellCacheName));
}

async function retainOpenClientShells() {
  const obsolete = await obsoleteShellCaches();
  if (!obsolete.length) return;
  const clients = await self.clients.matchAll({type:"window", includeUncontrolled:true});
  if (!clients.length) {
    await Promise.all(obsolete.map(name => caches.delete(name)));
    return;
  }
  // An explicit update does not reload other pages. Retain their immutable
  // scripts until those pages close or navigate to a fresh document.
  const cache = await caches.open(shellCacheName);
  try {
    await cache.put(retainedShellClientsKey, new Response(JSON.stringify(clients.map(client => client.id)), {
      headers:{"Content-Type":"application/json"}
    }));
  } catch {
    // If bookkeeping cannot be saved, leave the older public shells intact.
  }
}

async function pruneRetainedShells() {
  const cache = await caches.open(shellCacheName);
  const record = await cache.match(retainedShellClientsKey);
  if (!record) return;
  let retained;
  try { retained = await record.json(); } catch { return; }
  if (!Array.isArray(retained)) return;
  const live = new Set((await self.clients.matchAll({type:"window", includeUncontrolled:true})).map(client => client.id));
  if (retained.some(id => live.has(id))) return;
  await Promise.all((await obsoleteShellCaches()).map(name => caches.delete(name)));
  await cache.delete(retainedShellClientsKey);
}

async function previousShellAsset(request) {
  for (const name of await caches.keys()) {
    if (!name.startsWith("permitext-pro-shell-") || name === shellCacheName) continue;
    const cache = await caches.open(name);
    // Workspace HTML is committed last, so incomplete installations cannot
    // supply another page's lazy-loaded scripts.
    if (!(await cache.match("/workspace"))) continue;
    const response = await cache.match(request);
    if (response) return response;
  }
}

self.addEventListener("activate", (event) => {
  // Never claim uncontrolled pages or force another document to reload.
  event.waitUntil(retainOpenClientShells());
});

// Explicit user action only. Other pages can continue using their retained
// generation; saving and reloading the requesting tab is handled by the app.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "PERMITEXT_ACTIVATE_UPDATE" || !event.ports?.[0] || !event.source?.id) return;
  event.waitUntil((async () => {
    event.ports[0].postMessage({ready:true});
    await self.skipWaiting();
  })());
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
  if (url.pathname === "/web/app.js") await pruneRetainedShells();
  const requestedAssetRevision = url.searchParams.get("assetRevision");
  const revisionedAsset = url.pathname.startsWith("/code/assets/") && /^[a-f0-9]{64}$/.test(requestedAssetRevision || "");
  const cache = await caches.open(
    revisionedAsset ? `permitext-pro-code-assets-revision-${requestedAssetRevision}` :
      url.pathname.startsWith("/code/assets/") ? offlineAssetCacheName : shellCacheName
  );
  const cached = await cache.match(request);
  if (cached) return cached;
  if (url.pathname.startsWith("/web/") || url.pathname.startsWith("/marketing/")) {
    const retained = await previousShellAsset(request);
    if (retained) return retained;
  }
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
