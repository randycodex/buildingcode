import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const sw = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const storage = await readFile(new URL('../public/offline-storage.js', import.meta.url), 'utf8');
const manifestURLs = source => JSON.parse(source.slice(source.indexOf('const shellURLs = ') + 'const shellURLs = '.length, source.indexOf('];', source.indexOf('const shellURLs')) + 1));
assert.deepEqual(manifestURLs(storage), manifestURLs(sw), 'Manual preparation and service worker must cache the same complete shell');
const expected = sw.match(/"(\/web\/app\.js\?[^"\n]+)"/)[1];
const html = (src = expected) => `<html><script type="module" src="${src}"></script></html>`;
function harness(source = sw, gateBodies = false) {
  let releaseBody; let firstFetch = true;
  const bodyDrained = new Promise(resolve => { releaseBody = resolve; });
  const records = new Map([['/workspace', new Response(html())]]);
  const writes = []; const fetches = []; let mismatch = false, failFetch = false, failWrite = false, networkDown = false;
  const cache = { match: async key => records.get(String(key))?.clone(), put: async (key, response) => {
    if (failWrite && String(key).startsWith('/web/app.js')) throw Error('quota');
    writes.push(String(key)); records.set(String(key), response.clone());
  }};
  const context = vm.createContext({ URL, Response, Promise, setTimeout, clearTimeout,
    self: { location: { origin: 'https://test.local' }, addEventListener() {}, skipWaiting() {}, clients: { claim() {} } },
    navigator: { serviceWorker: { register: async () => ({ update: async () => {} }), ready: Promise.resolve({}) } }, window: { caches: {} },
    caches: { open: async () => cache },
    fetch: async request => {
      if (networkDown) throw Error('offline');
      if (gateBodies) {
        if (firstFetch) {
          firstFetch = false;
          return new Response(new ReadableStream({
            start(controller) { controller.enqueue(new Uint8Array([1])); },
            pull(controller) { controller.close(); releaseBody(); }
          }));
        }
        await bodyDrained;
      }
      const path = typeof request === 'string' ? request : new URL(request.url).pathname;
      fetches.push(path);
      if (failFetch && path.startsWith('/web/app.js')) return new Response('unavailable', { status: 503 });
      return new Response(path === '/' ? '<html>marketing</html>' : html(mismatch ? '/web/app.js?v=future' : expected));
    }
  });
  vm.runInContext(source, context);
  return { context, records, writes, fetches, cache, set(flags) { ({ mismatch = mismatch, failFetch = failFetch, failWrite = failWrite, networkDown = networkDown } = flags); } };
}
const storageManifest = storage.slice(storage.indexOf('const shellCacheName'), storage.indexOf('const defaultCodeVersion')) +
  storage.slice(storage.indexOf('const shellURLs'), storage.indexOf('];', storage.indexOf('const shellURLs')) + 2);
const storageFunctions = storage.slice(storage.indexOf('async function isMatchingWorkspaceShell'), storage.indexOf('export async function downloadOfflineLibrary')).replace('export ', '');
for (const source of [sw, storageManifest + storageFunctions]) {
  const h = harness(source);
  const run = () => h.context.prepareOfflineShell ? h.context.prepareOfflineShell() : h.context.cacheCoherentShell(h.cache);
  h.set({ mismatch: true }); await assert.rejects(run(), /updated/); assert.equal(h.writes.length, 0);
  h.set({ mismatch: false, failFetch: true }); await assert.rejects(run(), /installation failed/); assert.equal(h.writes.length, 0);
  h.set({ failFetch: false, failWrite: true }); await assert.rejects(run(), /quota/); assert(!h.writes.includes('/workspace'));
  h.set({ failWrite: false }); h.fetches.length = 0; await run();
  assert.equal(new Set(h.fetches).size, h.fetches.length, 'Each shell URL is fetched once per preparation'); assert.equal(h.writes.at(-1), '/workspace');
  assert.equal(await h.records.get('/workspace').text(), html());
  const streaming = harness(source, true);
  const streamingRun = streaming.context.prepareOfflineShell ? streaming.context.prepareOfflineShell() : streaming.context.cacheCoherentShell(streaming.cache);
  let timeout;
  await Promise.race([streamingRun, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Unread bodies blocked later shell requests')), 1000); })]).finally(() => clearTimeout(timeout));
  assert.equal(streaming.writes.at(-1), '/workspace');
}
const h = harness(); h.set({ mismatch: true });
for (const path of ['/workspace', '/workspace/', '/web', '/web/', '/open/section/123']) {
  assert.equal(await (await h.context.networkFirstNavigation(new Request('https://test.local' + path))).text(), html());
}
assert.equal(h.writes.length, 0);
assert.match(await (await h.context.networkFirstNavigation(new Request('https://test.local/'))).text(), /marketing/);
h.set({ networkDown: true }); assert.equal(await (await h.context.networkFirstNavigation(new Request('https://test.local/workspace'))).text(), html());
console.log('Shell coherence: mismatched generation, asset failure, write failure, recovery, aliases and marketing passed.');

const coherent = harness();
assert.equal(await (await coherent.context.networkFirstNavigation(new Request('https://test.local/workspace'))).text(), html());
assert.deepEqual(coherent.writes, ['/workspace']);
const uncached = harness(); uncached.records.clear(); uncached.set({ mismatch: true });
assert.match(await (await uncached.context.networkFirstNavigation(new Request('https://test.local/workspace'))).text(), /future/);
assert.equal(uncached.writes.length, 0, 'Without a prior shell online navigation may proceed but cannot poison this generation');
