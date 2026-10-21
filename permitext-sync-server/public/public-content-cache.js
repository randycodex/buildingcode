// This bounds retained, decoded public source data. Active requests stay shared
// until they settle; cacheRetryablePromise owns their consumer cancellation.
export function estimatePublicContentBytes(value) {
  const visited = new Set(), pending = [value];
  let bytes = 0;
  while (pending.length) {
    const item = pending.pop();
    if (typeof item === 'string') { bytes += item.length * 2; continue; }
    if (!item || typeof item !== 'object') { bytes += 8; continue; }
    if (visited.has(item)) continue;
    visited.add(item);
    bytes += 64;
    if (Array.isArray(item)) {
      bytes += item.length * 8;
      for (const child of item) pending.push(child);
    } else {
      for (const key of Object.keys(item)) {
        bytes += 16 + key.length * 2;
        pending.push(item[key]);
      }
    }
  }
  return bytes;
}

export function createPublicContentCache({ maxBytes = 16 * 1024 * 1024, maxEntries = 64 } = {}) {
  for (const value of [maxBytes, maxEntries]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Cache limits must be nonnegative integers.');
  }
  const entries = new Map();
  let retainedBytes = 0, retainedCount = 0;
  const remove = key => {
    const entry = entries.get(key);
    if (!entry) return false;
    if (entry.settled) { retainedBytes -= entry.bytes; retainedCount--; }
    return entries.delete(key);
  };
  const trim = () => {
    for (const [key, entry] of entries) {
      if (retainedCount <= maxEntries && retainedBytes <= maxBytes) break;
      if (entry.settled) remove(key);
    }
  };
  const cache = {
    has: key => entries.has(key),
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key); entries.set(key, entry);
      return entry.promise;
    },
    set(key, promise) {
      remove(key);
      const entry = {promise, settled: false, bytes: 0};
      entries.set(key, entry);
      Promise.resolve(promise).then(value => {
        // Invalidation, cancellation or a newer request may replace this key.
        // A late completion must never put the old representation back.
        if (entries.get(key) !== entry) return;
        entry.bytes = estimatePublicContentBytes(value);
        if (entry.bytes > maxBytes || maxEntries === 0) { remove(key); return; }
        entry.settled = true;
        retainedBytes += entry.bytes; retainedCount++;
        trim();
      }, () => { if (entries.get(key) === entry) remove(key); });
      return cache;
    },
    delete: remove,
    clear() { entries.clear(); retainedBytes = 0; retainedCount = 0; },
    keys: () => entries.keys(),
    get size() { return entries.size; },
    get retainedBytes() { return retainedBytes; },
    get retainedCount() { return retainedCount; },
    get pendingCount() { return entries.size - retainedCount; }
  };
  return cache;
}
