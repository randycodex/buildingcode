const revisionPattern = /^[a-f0-9]{64}$/;
export function isPublicCodePath(path) {
  const url = new URL(path, "http://permitext.invalid");
  return /^\/code\/(?:libraries|chapters(?:\/[a-zA-Z0-9_-]+)?|sections(?:\/\d+)?|search)$/.test(url.pathname);
}

function waitForProbe(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason || new DOMException("Request cancelled", "AbortError")); };
    const cleanup = () => signal.removeEventListener("abort", aborted);
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export function createPublicCodeRevisionController({ fetchRevision, onInvalidate, now = Date.now, intervalMS = 60000 }) {
  let revision = "", generation = 0, flight = null, lastProbe = -Infinity;
  let initialAdoptionGeneration = -1;
  const changed = () => {
    const error = new Error("Code library changed while loading. Retry with its current manifest.");
    error.code = "PUBLIC_CORPUS_CHANGED";
    return error;
  };
  function adopt(value) {
    if (!revisionPattern.test(value || "") || value === revision) return false;
    const previous = revision;
    const initialAdoption = !revision && generation === 0;
    revision = value;
    generation++;
    if (initialAdoption) initialAdoptionGeneration = generation;
    onInvalidate({ previous, revision, generation });
    return true;
  }
  function probe({ force = false, reconnect = false } = {}) {
    if (reconnect) { generation++; onInvalidate({ previous: revision, revision, generation }); }
    if (flight) return flight;
    if (!force && now() - lastProbe < intervalMS) return Promise.resolve(revision);
    lastProbe = now();
    const started = generation;
    const pending = Promise.resolve().then(fetchRevision).then(payload => {
      if (started === generation) adopt(payload?.corpusRevision);
      return revision;
    }).catch(() => revision).finally(() => { if (flight === pending) flight = null; });
    flight = pending;
    return pending;
  }
  async function read(path, { signal } = {}, request) {
    const base = new URL(path, "http://permitext.invalid");
    const isWindow = base.searchParams.has("bodyStart");
    for (let attempt = 0; attempt < 2; attempt++) {
      signal?.throwIfAborted();
      let started = generation;
      const expected = revision;
      const url = new URL(base);
      if (expected) url.searchParams.set("expectedPublicCorpusRevision", expected);
      try {
        const payload = await request(`${url.pathname}${url.search}`, response => {
          const incoming = response.headers?.get?.("x-permitext-corpus-revision");
          if (started !== generation) {
            // Initial unpinned reads may finish after the parallel startup probe.
            // Their exact response digest proves membership in that first epoch.
            // A reconnect or actual revision change permanently closes this path.
            const sameInitialEpoch = started === 0 && !expected &&
              generation === initialAdoptionGeneration && incoming === revision;
            if (!sameInitialEpoch) throw changed();
            started = generation;
          }
          if (incoming && incoming !== revision && revisionPattern.test(incoming)) {
            adopt(incoming);
            if (expected) throw changed();
            // First successful public response establishes this session's epoch.
            started = generation;
          }
        });
        signal?.throwIfAborted();
        if (started !== generation) throw changed();
        return payload;
      } catch (error) {
        signal?.throwIfAborted();
        if (error?.name === "AbortError") throw error;
        if (error?.status !== 409 && error?.code !== "PUBLIC_CORPUS_CHANGED") throw error;
        if (error.status === 409) await waitForProbe(probe({ force: true }), signal);
        signal?.throwIfAborted();
        if (isWindow) {
          const mismatch = changed();
          mismatch.code = "CHAPTER_WINDOW_MISMATCH";
          throw mismatch;
        }
        if (attempt === 1) throw changed();
      }
    }
  }
  return { probe, read, get revision() { return revision; }, get generation() { return generation; } };
}
