import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRolloutFixture } from './populated-rollout-fixture.mjs';
const root = await mkdtemp(join(tmpdir(), 'rollout-contract-'));
let server;
try {
  for (const version of ['baseline','current']) {
    await mkdir(join(root,version));
    for (const name of ['index.html','app.js','offline-storage.js','service-worker.js']) await writeFile(join(root,version,name), name === 'index.html' ? `<script src="/web/app.js?v=${version}"></script>` : `${version}:${name}`);
  }
  const fixture = await createRolloutFixture({baselineDir:join(root,'baseline'),currentDir:join(root,'current'),capability:'secret'});
  server = createServer(async (req,res) => { if (!await fixture.handle(req,res,new URL(req.url,'http://localhost'))) res.writeHead(418).end('ordinary'); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(base+path);
  const control = (value,key='secret') => fetch(`${base}/fixture/rollout-control?key=${key}`,{method:'POST',body:JSON.stringify(value)});
  assert.equal((await get('/fixture/rollout')).status,403);
  assert.equal((await control({phase:'current'},'wrong')).status,403);
  assert.equal((await control({phase:'bogus'})).status,400);
  assert.equal((await control({networkOff:'yes'})).status,400);
  assert.equal((await control({unexpected:true})).status,400);
  assert.equal(await (await get('/service-worker.js')).text(),'baseline:service-worker.js');
  assert.match(await (await get('/workspace')).text(),/v=baseline/);
  assert.equal((await get('/unrelated')).status,418);
  await control({phase:'current-failed-install'});
  assert.equal((await get('/web/app.js?v=current')).status,503);
  assert.equal(await (await get('/web/app.js?v=baseline')).text(),'baseline:app.js');
  assert.equal(await (await get('/service-worker.js')).text(),'current:service-worker.js');
  assert.match(await (await get('/workspace')).text(),/v=current/);
  await control({networkOff:true});
  await assert.rejects(get('/workspace'));
  await assert.rejects(get('/web/app.js?v=baseline'));
  assert.equal((await get('/fixture/rollout-state?key=secret')).status,200);
  assert.equal((await get('/fixture/rollout?key=secret')).status,200);
  await control({networkOff:false,phase:'current'});
  assert.equal(await (await get('/web/app.js?v=current')).text(),'current:app.js');
  assert.equal(await (await get('/web/offline-storage.js?v=baseline')).text(),'baseline:offline-storage.js');
  console.log('Rollout HTTP contract passed: capability, strict controls, immutable old assets, failed installation, transport failure, recovery.');
} finally { if (server) {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));} await rm(root,{recursive:true,force:true}); }
