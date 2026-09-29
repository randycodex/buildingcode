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
  // Four-file fixtures remain valid when app.js does not declare lazy Notebook assets.
  await createRolloutFixture({baselineDir:join(root,'baseline'),currentDir:join(root,'current'),capability:'secret'});
  for (const version of ['baseline','current']) {
    await mkdir(join(root,version,'notebook-assets'));
    await writeFile(join(root,version,'app.js'), `const notebookClientVersion = "notebook-${version}";`);
    for (const ext of ['js','css']) await writeFile(join(root,version,'notebook-assets',`notebook.${ext}`), `${version}:notebook.${ext}`);
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
  const probePage = await (await get('/fixture/rollout?key=secret')).text();
  const probe = JSON.parse(probePage.match(/id="document-probe" type="application\/json">([^<]+)/)[1]);
  assert.equal(probe.version,'baseline');
  assert.deepEqual(probe.notebook,{js:'/web/notebook-assets/notebook.js?v=notebook-baseline',css:'/web/notebook-assets/notebook.css?v=notebook-baseline'});
  assert.match(probePage,/id="notebook"/);
  const diagnostics = await (await get('/fixture/rollout.js?key=secret')).text();
  assert.match(diagnostics,/const version = documentProbe.version/);
  assert.match(diagnostics,/import\(documentProbe.notebook.js\)/);
  assert.equal((await get('/fixture/rollout.js')).status,403);
  for (const version of ['baseline','current']) for (const ext of ['js','css']) {
    const response = await get(`/web/notebook-assets/notebook.${ext}?v=notebook-${version}`);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(await response.text(),`${version}:notebook.${ext}`);
  }
  await control({phase:'current-failed-install'});
  assert.equal(probe.version,'baseline', 'Already loaded document stays on its generation');
  const futurePage = await (await get('/fixture/rollout?key=secret')).text();
  assert.match(futurePage,/"version":"current"/);
  assert.equal(await (await get(probe.notebook.js)).text(),'baseline:notebook.js');
  assert.equal((await get('/web/app.js?v=current')).status,503);
  assert.equal(await (await get('/web/app.js?v=baseline')).text(),'const notebookClientVersion = "notebook-baseline";');
  assert.equal(await (await get('/service-worker.js')).text(),'current:service-worker.js');
  assert.match(await (await get('/workspace')).text(),/v=current/);
  await control({networkOff:true});
  await assert.rejects(get('/workspace'));
  await assert.rejects(get(probe.notebook.js));
  await assert.rejects(get(probe.notebook.css));
  await assert.rejects(get('/web/app.js?v=baseline'));
  assert.equal((await get('/fixture/rollout-state?key=secret')).status,200);
  assert.equal((await get('/fixture/rollout?key=secret')).status,200);
  await control({networkOff:false,phase:'current'});
  assert.equal(await (await get('/web/app.js?v=current')).text(),'const notebookClientVersion = "notebook-current";');
  assert.equal(await (await get('/web/offline-storage.js?v=baseline')).text(),'baseline:offline-storage.js');
  console.log('Rollout HTTP contract passed: capability, strict controls, immutable old assets, failed installation, transport failure, recovery.');
} finally { if (server) {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));} await rm(root,{recursive:true,force:true}); }
