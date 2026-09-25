const retryableRequestsByCache = new WeakMap();

export function cacheRetryablePromise(cache, key, loader, { signal } = {}) {
  const abortError = () => new DOMException("Request cancelled", "AbortError");
  if (signal?.aborted) return Promise.reject(abortError());
  let requests = retryableRequestsByCache.get(cache);
  if (!requests) { requests = new Map(); retryableRequestsByCache.set(cache, requests); }
  let request = requests.get(key);
  if (request && cache.get(key) !== request.promise) request = null;
  if (!cache.has(key)) {
    const controller = new AbortController();
    request = { controller, consumers: new Set(), settled: false, promise: null };
    const owned = request;
    const promise = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw abortError();
      return loader(controller.signal);
    }).then(value => {
      owned.settled = true;
      if (requests.get(key) === owned) requests.delete(key);
      return value;
    }, error => {
      owned.settled = true;
      if (requests.get(key) === owned) requests.delete(key);
      if (cache.get(key) === promise) cache.delete(key);
      throw error;
    });
    request.promise = promise;
    requests.set(key, request);
    cache.set(key, promise);
  }
  const promise = cache.get(key);
  if (!request && !signal) return promise;
  return new Promise((resolve, reject) => {
    const consumer = {};
    request?.consumers.add(consumer);
    let finished = false;
    const release = () => {
      signal?.removeEventListener("abort", onAbort);
      request?.consumers.delete(consumer);
    };
    const onAbort = () => {
      if (finished) return;
      finished = true;
      release();
      if (request && !request.settled && request.consumers.size === 0) {
        if (requests.get(key) === request) requests.delete(key);
        if (cache.get(key) === request.promise) cache.delete(key);
        request.controller.abort();
      }
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    promise.then(value => {
      if (finished) return;
      finished = true; release(); resolve(value);
    }, error => {
      if (finished) return;
      finished = true; release(); reject(error);
    });
    if (signal?.aborted) onAbort();
  });
}

export function shouldUseOfflineFallback(status) {
  return Number.isFinite(status) && status >= 500;
}

export function stableClientValue(value) {
  if (Array.isArray(value)) return value.map(stableClientValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableClientValue(value[key])])
  );
}

export function clientValuesMatch(left, right) {
  return JSON.stringify(stableClientValue(left)) === JSON.stringify(stableClientValue(right));
}

export function resolveNotebookVersionConflict(localCard, localDocument, remoteCard) {
  return {
    activeCard: {
      ...remoteCard,
      title: localCard?.title || remoteCard?.title || "",
      document: localDocument
    },
    draftDocument: localDocument,
    dirty: true
  };
}
