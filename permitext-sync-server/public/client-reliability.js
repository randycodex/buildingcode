export function cacheRetryablePromise(cache, key, loader) {
  if (cache.has(key)) return cache.get(key);
  const promise = Promise.resolve()
    .then(loader)
    .catch((error) => {
      if (cache.get(key) === promise) cache.delete(key);
      throw error;
    });
  cache.set(key, promise);
  return promise;
}

export function shouldUseOfflineFallback(status) {
  return Number.isFinite(status) && status >= 500;
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
