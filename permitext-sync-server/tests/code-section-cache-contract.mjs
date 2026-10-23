import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { cacheRetryablePromise } from '../public/client-reliability.js';
import { createPublicContentCache } from '../public/public-content-cache.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('async function api(');
const actual = source.slice(start, source.indexOf('\n}', start) + 2);
const cache = createPublicContentCache({maxBytes: 4096, maxEntries: 3});
let calls = 0, fail = false, delay = false, releases = [];
const revision = {generation: 1, read: (path, _options, request) => request(path, () => {})};
const runtime = vm.createContext({cacheRetryablePromise, codeSectionCache: cache,
  publicCodeRevision: revision, structuredClone, isPublicCodePath: path => path.startsWith('/code/'),
  hasCapability: () => false, updateConnectionStatus() {}, serverReachable: true,
  fetch: async (path, {signal} = {}) => {
    calls++;
    if (delay) await new Promise((resolve, reject) => {
      releases.push(resolve);
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), {once: true});
    });
    if (fail) throw new Error('Temporary failure');
    return {ok: true, json: async () => ({section: {id: path, blocks: [{plainText: 'Exact enacted text'}]}})};
  }
});
vm.runInContext(actual, runtime);
const path = '/code/sections/113?include=metadata&version=2022';
const first = await runtime.api(path);
first.section.blocks[0].plainText = 'Caller edit';
assert.equal((await runtime.api(path)).section.blocks[0].plainText, 'Exact enacted text');
assert.equal(calls, 1, 'Repeated source hydration across projects uses one public read');
for (const distinct of [path.replace('2022', '2014'), '/code/sections/113', '/code/sections/resolve?code=BC&sectionNumber=202']) {
  assert.equal((await runtime.api(distinct)).section.id, distinct);
}
assert.equal(calls, 4, 'Body, metadata, edition and citation resolution have exact separate keys');
assert.ok(cache.retainedBytes <= 4096 && cache.retainedCount <= 3);
await runtime.api('/account/me'); await runtime.api('/account/me');
assert.equal(calls, 6, 'Private API reads never enter the public cache');
revision.generation++; cache.clear();
await runtime.api(path);
assert.equal(calls, 7);
assert.match(source, /onInvalidate\([\s\S]*?codeSectionCache\.clear\(\)/);

cache.clear(); delay = true;
const one = new AbortController(), two = new AbortController();
const abandoned = runtime.api(path, {signal: one.signal});
const retained = runtime.api(path, {signal: two.signal});
await Promise.resolve();
const before = calls;
one.abort(); await assert.rejects(abandoned, {name: 'AbortError'});
releases.shift()(); await retained;
assert.equal(calls, before, 'Closing one column does not cancel or duplicate another column’s source read');
cache.clear();
const obsolete = runtime.api(path);
await Promise.resolve();
revision.generation++; cache.clear();
releases.shift()(); await obsolete;
assert.equal(cache.size, 0, 'A late old-corpus response cannot refill an invalidated cache');
delay = false; fail = true;
await assert.rejects(runtime.api(path), /Temporary failure/);
fail = false; assert.equal((await runtime.api(path)).section.id, path);
console.log('Public section caching: repeated project hydration, exact edition/body/metadata/citation keys, private exclusion, bounded retention, isolated clones, independent cancellation, invalidation and retry passed.');
