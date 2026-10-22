import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { cacheRetryablePromise } from '../public/client-reliability.js';
import { createPublicContentCache } from '../public/public-content-cache.js';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = app.indexOf('async function fetchCodeSearch(');
const actual = app.slice(start, app.indexOf('\n}', start) + 2);
const searchResultCache = createPublicContentCache({ maxBytes: 4096, maxEntries: 2 });
const revision = { generation: 1 };
let calls = 0, releases = [], fail = false, delayed = false;
const runtime = vm.createContext({ cacheRetryablePromise, searchResultCache, publicCodeRevision: revision,
  structuredClone, api: async (path, { signal }) => {
    calls++;
    assert.match(path, /^\/code\/search\?/);
    if (delayed) await new Promise((resolve, reject) => {
      releases.push(resolve);
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    });
    if (fail) throw new Error('Temporary failure');
    return { results: [{ title: path }], hasMore: true, nextOffset: 20 };
  }
});
vm.runInContext(actual, runtime);
const query = '/code/search?q=water&version=2022&match=exact&offset=0&enabledSources=BC';
const first = await runtime.fetchCodeSearch(query);
first.results[0].title = 'A caller changed its own result';
const second = await runtime.fetchCodeSearch(query);
assert.equal(calls, 1, 'A repeated public query avoids another request.');
assert.equal(second.results[0].title, query, 'One caller cannot mutate the cached results.');
for (const path of [query.replace('2022', '2014'), query.replace('offset=0', 'offset=20'),
  query.replace('exact', 'words'), query.replace('Sources=BC', 'Sources=PC')]) {
  assert.equal((await runtime.fetchCodeSearch(path)).results[0].title, path);
}
assert.equal(calls, 5, 'Edition, page, match mode and enabled sources have distinct keys.');
assert.ok(searchResultCache.retainedCount <= 2 && searchResultCache.retainedBytes <= 4096);
const beforeEviction = calls;
await runtime.fetchCodeSearch(query);
assert.equal(calls, beforeEviction + 1, 'Old queries are evicted within the memory bound.');
revision.generation++;
searchResultCache.clear();
await runtime.fetchCodeSearch(query);
assert.equal(calls, beforeEviction + 2, 'A new public corpus cannot reuse an old response.');
assert.match(app, /onInvalidate\([\s\S]*?searchResultCache\.clear\(\)/);

searchResultCache.clear(); delayed = true;
const one = new AbortController(), two = new AbortController();
const abandoned = runtime.fetchCodeSearch(query, { signal: one.signal });
const kept = runtime.fetchCodeSearch(query, { signal: two.signal });
await Promise.resolve();
const beforeShared = calls;
one.abort();
await assert.rejects(abandoned, { name: 'AbortError' });
releases.shift()();
assert.equal((await kept).results[0].title, query);
assert.equal(calls, beforeShared, 'Cancelling one column must not refetch or cancel another column’s shared result.');

searchResultCache.clear();
const all = new AbortController();
const cancelled = runtime.fetchCodeSearch(query, { signal: all.signal });
await Promise.resolve(); all.abort();
await assert.rejects(cancelled, { name: 'AbortError' });
releases = []; delayed = false; fail = true;
await assert.rejects(runtime.fetchCodeSearch(query), /Temporary failure/);
fail = false;
assert.equal((await runtime.fetchCodeSearch(query)).results[0].title, query, 'Abort/failure never poisons a retry.');
searchResultCache.clear(); delayed = true;
const obsolete = runtime.fetchCodeSearch(query);
await Promise.resolve();
revision.generation++; searchResultCache.clear();
releases.shift()(); await obsolete;
assert.equal(searchResultCache.size, 0, 'A response finishing after invalidation must not repopulate the cache.');
console.log('Search result caching passed: bounded public results, exact query/source/page keys, independent consumers, cancellation, retries, clones and corpus invalidation.');
