const shellCacheName = "permitext-pro-shell-v32";

self.addEventListener("install", () => {
  self.skipWaiting();
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
    return response;
  } catch (error) {
    return (await cache.match("/")) || Promise.reject(error);
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(shellCacheName);
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
