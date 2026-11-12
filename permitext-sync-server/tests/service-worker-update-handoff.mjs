import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const currentName = source.match(/const shellCacheName = "([^"]+)"/)[1];
const generation = Number(currentName.match(/v(\d+)$/)[1]);
const oldName = `permitext-pro-shell-v${generation - 2}`;
const partialName = `permitext-pro-shell-v${generation - 1}`;
const futureName = `permitext-pro-shell-v${generation + 1}`;
const origin = 'https://per.codes';
const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
const legacyScript = new Request(`${origin}/web/lazy-reader.js?v=old`);
const currentScript = new Request(`${origin}/web/app.js?v=current`);

function fixture({clients = [{id:'updating'},{id:'other-open-page'}], quota = false} = {}) {
  const records = new Map();
  const stores = new Map();
  const events = {};
  let skipped = 0, claimed = 0;
  const network = [];
  const cache = name => {
    if (!records.has(name)) records.set(name, new Map());
    if (!stores.has(name)) stores.set(name, {
      async match(request) {return records.get(name)?.get(key(request))?.clone();},
      async put(request, response) {
        if (quota && key(request).includes('__permitext_retained_shell_clients__')) throw Error('Quota exceeded');
        records.get(name).set(key(request), response.clone());
      },
      async delete(request) {return records.get(name).delete(key(request));}
    });
    return stores.get(name);
  };
  const caches = {open:async name => cache(name), keys:async () => [...records.keys()],
    async delete(name) {stores.delete(name);return records.delete(name);}};
  const context = () => {
    const c = vm.createContext({URL,Response,Promise,Set,caches,
      self:{location:{origin},addEventListener(type, handler){events[type] = handler;},
        clients:{matchAll:async () => clients,claim(){claimed++;}},skipWaiting:async () => {skipped++;}},
      fetch:async request => {network.push(key(request));return new Response('network asset');}});
    vm.runInContext(source, c);return c;
  };
  let c = context();
  return {records,network,events,cache,get c(){return c;},get skipped(){return skipped;},get claimed(){return claimed;},
    setClients(value){clients=value;},restart(){c=context();},
    async activate(){let work;events.activate({waitUntil(promise){work=promise;}});await work;},
    async requestUpdate(){let work;const replies=[];events.message({data:{type:'PERMITEXT_ACTIVATE_UPDATE'},
      source:{id:'updating'},ports:[{postMessage:value=>replies.push(value)}],waitUntil(promise){work=promise;}});await work;return replies;}
  };
}

async function seed(f) {
  await f.cache(oldName).put('/workspace', new Response('<script src="/web/app.js?v=old"></script>'));
  await f.cache(oldName).put(legacyScript, new Response('old page lazy script'));
  await f.cache(currentName).put('/workspace', new Response('<script src="/web/app.js?v=current"></script>'));
  await f.cache(currentName).put(currentScript, new Response('new app'));
  await f.cache(partialName).put('/web/incomplete.js?v=old', new Response('incomplete installation'));
  await f.cache(futureName).put('/workspace', new Response('a newer complete installation'));
}

{
  const f=fixture();await seed(f);
  assert.equal((await f.requestUpdate())[0].ready,true,'An explicit update is not blocked by other open pages.');
  assert.equal(f.skipped,1);
  await f.activate();
  assert(f.records.has(oldName),'Activation retains the other page’s complete old shell.');
  assert.equal(f.claimed,0,'Activation cannot adopt uncontrolled documents.');
  f.setClients([{id:'new-document'},{id:'other-open-page'}]);
  assert.equal(await (await f.c.cacheFirstAsset(legacyScript)).text(),'old page lazy script');
  assert.equal(await (await f.c.cacheFirstAsset(currentScript)).text(),'new app');
  assert.equal(f.network.length,0,'Both generations load their exact cached scripts without refetching mutable server files.');
  assert(f.records.has(oldName),'One remaining old page keeps its files available.');
  // Worker globals can be discarded between requests; retention survives that.
  f.restart();
  assert.equal(await (await f.c.cacheFirstAsset(legacyScript)).text(),'old page lazy script');
  assert.equal(await (await f.c.cacheFirstAsset(new Request(`${origin}/web/incomplete.js?v=old`))).text(),'network asset');
  assert.equal(f.network.length,1,'A partially installed shell is never used as a fallback.');
  f.setClients([{id:'new-document'}]);
  assert.equal(await (await f.c.cacheFirstAsset(currentScript)).text(),'new app');
  assert.equal(f.records.has(oldName),false,'Old shells are reclaimed once their documents have closed or navigated.');
  assert.equal(f.records.has(partialName),false);
  assert(f.records.has(futureName),'Cleanup cannot delete a newer worker’s staged cache.');
  assert(f.records.has(currentName));
  const metadata = await f.cache(currentName).match('/__permitext_retained_shell_clients__');
  assert.equal(metadata,undefined,'Expired client identifiers are removed with the old shells.');
}
{
  const f=fixture({clients:[]});await seed(f);await f.activate();
  assert.equal(f.records.has(oldName),false,'Natural activation with no old documents reclaims prior shells immediately.');
  assert(f.records.has(currentName));assert(f.records.has(futureName));
}
{
  const f=fixture({quota:true});await seed(f);await f.requestUpdate();await f.activate();
  assert.equal(f.skipped,1);assert(f.records.has(oldName));
  assert.equal(await (await f.c.cacheFirstAsset(legacyScript)).text(),'old page lazy script',
    'A bookkeeping write failure conservatively retains the working old assets.');
}
console.log('Worker update handoff passed: explicit activation across pages, exact old/new assets, retained caches across worker restarts, incomplete-shell rejection, safe cleanup and quota recovery.');
