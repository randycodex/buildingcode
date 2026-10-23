// Public library only. Private workspace data stays in offline-storage.js.
const preferenceKey = "permitext.downloaded-library.enabled.v1";
let worker,
  timer,
  memoryPreference = false,
  sequence = 0;
const pending = new Map();
export const downloadedLibrarySupported = () =>
  typeof Worker !== "undefined" &&
  typeof indexedDB !== "undefined" &&
  typeof caches !== "undefined" &&
  typeof DecompressionStream !== "undefined" &&
  Boolean(globalThis.navigator?.locks && globalThis.crypto?.subtle);
export function usesDownloadedLibrary() {
  try {
    return localStorage.getItem(preferenceKey) === "true";
  } catch {
    return memoryPreference;
  }
}
export function useDownloadedLibrary(enabled) {
  memoryPreference = Boolean(enabled);
  try {
    localStorage.setItem(preferenceKey, String(memoryPreference));
    localStorage.setItem(
      "permitext.downloaded-library.change.v1",
      String(Date.now()) + Math.random(),
    );
  } catch {}
  if (typeof globalThis.window?.dispatchEvent === "function")
    window.dispatchEvent(new Event("permitext:downloaded-library-changed"));
}
function stop(error = new Error("Downloaded library worker stopped.")) {
  worker?.terminate();
  worker = null;
  clearTimeout(timer);
  for (const request of pending.values()) {
    request.cleanup();
    request.reject(error);
  }
  pending.clear();
}
function idle() {
  clearTimeout(timer);
  if (!pending.size) timer = setTimeout(() => stop(), 30_000);
}
function call(action, data = {}, { signal, onProgress } = {}) {
  if (!downloadedLibrarySupported())
    return Promise.reject(
      new Error("This browser does not support downloaded libraries."),
    );
  signal?.throwIfAborted();
  clearTimeout(timer);
  if (!worker) {
    worker = new Worker("/web/downloaded-library-worker.js?v=7", {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      if (data.progress) {
        request.onProgress?.(data.progress);
        return;
      }
      pending.delete(data.id);
      request.cleanup();
      if (data.error)
        request.reject(
          Object.assign(new Error(data.error), {
            code: data.code,
            name: data.name || "Error",
          }),
        );
      else request.resolve(data.result);
      idle();
    };
    worker.onerror = () =>
      stop(
        new Error(
          "Could not start the downloaded library. Reload or use the online library.",
        ),
      );
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const abort = () => {
      worker?.postMessage({ action: "cancel", requestID: id });
      pending.delete(id);
      cleanup();
      reject(signal.reason || new DOMException("Canceled", "AbortError"));
      idle();
    };
    const cleanup = () => signal?.removeEventListener("abort", abort);
    pending.set(id, { resolve, reject, onProgress, cleanup });
    signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage({ id, action, ...data });
  });
}
export async function downloadedLibraryStatus() {
  if (!downloadedLibrarySupported())
    return { available: false, supported: false };
  return {
    ...(await call("status")),
    supported: true,
    enabled: usesDownloadedLibrary(),
  };
}
export async function downloadLocalLibrary(options = {}) {
  const record = await call("install", {}, options);
  useDownloadedLibrary(true);
  try {
    await navigator.storage?.persist?.();
  } catch {}
  return record;
}
export async function removeDownloadedLibrary() {
  if (downloadedLibrarySupported()) await call("remove");
  useDownloadedLibrary(false);
  stop();
}
export async function readDownloadedLibrary(
  path,
  { signal, force = false } = {},
) {
  if ((!force && !usesDownloadedLibrary()) || !downloadedLibrarySupported())
    return null;
  if (
    !/^\/code\/(?:revision|libraries|chapters(?:\/[a-zA-Z0-9_-]+)?|sections(?:\/(?:\d+|resolve))?|search)(?:\?|$)/.test(
      path,
    )
  )
    return null;
  try {
    return await call("read", { path, offline: force }, { signal });
  } catch (error) {
    signal?.throwIfAborted();
    return null;
  } // Network/legacy fallback remains available.
}
export async function checkDownloadedLibraryUpdate({ signal } = {}) {
  const status = await downloadedLibraryStatus();
  if (!status.available && !status.pending) return status;
  const controller = new AbortController(),
    abort = () => controller.abort(signal.reason);
  signal?.throwIfAborted();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("/web/downloaded-library/manifest.json", {
      cache: "no-cache",
      signal: controller.signal,
    });
    if (!response.ok) throw Error("Could not check library updates.");
    const manifest = await response.json();
    return {
      ...status,
      updateAvailable: status.indexRevision !== manifest.indexRevision,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (![null, preferenceKey, "permitext.downloaded-library.change.v1"].includes(event.key))
      return;
    // Storage events already came from another tab. Re-broadcasting here makes
    // two open tabs echo forever; unrelated private sync must not evict code.
    memoryPreference = usesDownloadedLibrary();
    window.dispatchEvent(new Event("permitext:downloaded-library-changed"));
  });
