// Share both an in-flight load and its successful result. A transient failure
// clears the promise so a later request can retry without restarting the server.
export function createRetryableLazyLoader(loader) {
  let loadPromise = null;
  return function load() {
    if (!loadPromise) {
      loadPromise = Promise.resolve()
        .then(loader)
        .catch((error) => {
          loadPromise = null;
          throw error;
        });
    }
    return loadPromise;
  };
}
