import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { buildPublicCodeRevision } from '../scripts/build-public-code-revision.mjs';
import { handleRequest } from '../app.mjs';
import { revisionDestination, serveStaticCodeRevision } from './static-code-revision-routing.mjs';

const browserAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
];
const native = 'permitext/1 CFNetwork/3860.500.112.2.2 Darwin/25.0.0';
const url = path => new URL(path, 'https://permitext.test');
for (const agent of browserAgents) {
  assert.equal(revisionDestination(url('/code/revision'), {'user-agent':agent}), '/code-revision.json');
  for (const query of ['?contentRevision=abc','?contentRevision=','?expectedPublicCorpusRevision=abc','?expectedPublicCorpusRevision=','?expectedPublicCorpusRevision=a&expectedPublicCorpusRevision=b']) {
    assert.equal(revisionDestination(url('/code/revision'+query), {'user-agent':agent}), '/api/index', `Pinned contract stays dynamic: ${query}`);
  }
  for (const path of ['/code/chapters','/sync/push','/sync/pull','/research/history','/notebook/notes','/account/me']) {
    assert.equal(revisionDestination(url(path), {'user-agent':agent}), '/api/index', path);
  }
}
for (const agent of [native, 'curl/8.7.1', undefined]) {
  assert.equal(revisionDestination(url('/code/revision'), {'user-agent':agent}), '/api/index');
}

const output = await mkdtemp(join(tmpdir(), 'permitext-static-revision-'));
let server, dynamicRequests = 0, staticRequests = 0;
const realFetch = globalThis.fetch;
try {
  // Build from bundled files with all outbound transport disabled.
  globalThis.fetch = () => { throw new Error('Revision metadata must not contact a database or remote service'); };
  const manifest = await buildPublicCodeRevision(output);
  const generated = await readFile(join(output,'code-revision.json'),'utf8');
  assert.deepEqual(Object.keys(manifest).sort(), ['assetRevision','cacheContract','corpusRevision','webAppVersion']);
  server = createServer(async (req,res) => {
    if (await serveStaticCodeRevision(req,res,new URL(req.url,'http://localhost'),output)) { staticRequests++; return; }
    dynamicRequests++;
    await handleRequest(req,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, agent = native, headers = {}) => realFetch(base+path,{headers:{'user-agent':agent,...headers}});
  const dynamic = await get('/code/revision');
  assert.equal(dynamic.status,200);
  assert.equal(await dynamic.text(),generated,'Static and native JSON must be byte-identical');
  const etag = dynamic.headers.get('etag');
  for (const agent of browserAgents) for (let check=0; check<4; check++) {
    const response = await get('/code/revision',agent,{'cache-control':'no-cache','cookie':'session=private-test-value','authorization':'Bearer irrelevant-public-value'});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'public, max-age=0, must-revalidate');
    assert.equal(await response.text(),generated);
  }
  assert.equal(dynamicRequests,1,'Old browser polling must not dispatch the application function');
  assert.equal(staticRequests,12);
  assert.equal((await get('/code/revision',native,{'if-none-match':etag})).status,304);
  for (const query of ['?contentRevision=wrong','?expectedPublicCorpusRevision=wrong','?expectedPublicCorpusRevision=a&expectedPublicCorpusRevision=b']) {
    const response = await get('/code/revision'+query,browserAgents[0]);
    assert.equal(response.status,409);
    assert.equal(response.headers.get('cache-control'),'no-store');
  }
  assert.equal((await get('/code/revision?expectedPublicCorpusRevision='+manifest.corpusRevision,browserAgents[0])).status,200);
  const pin = etag.replaceAll('"','');
  const pinned = await get('/code/revision?contentRevision='+pin,native);
  assert.equal(pinned.status,200);
  assert.match(pinned.headers.get('cache-control'),/immutable/);
  assert.equal((await get('/code-revision.json',browserAgents[0])).status,200);
  // Deployment replacement must become visible even to an already open old tab.
  const next = {...manifest,webAppVersion:manifest.webAppVersion+'-next-deploy'};
  await writeFile(join(output,'code-revision.json'),JSON.stringify(next));
  assert.deepEqual(await (await get('/code/revision',browserAgents[0])).json(),next);
  await buildPublicCodeRevision(output);
  assert.equal(await readFile(join(output,'code-revision.json'),'utf8'),generated,'Every build replaces previous metadata');
  console.log('Static revision passed: compiled browser/native/pinned routing, exact API parity, repeated old polling without application dispatch, replacement visibility, native ETag and download guards.');
} finally {
  globalThis.fetch = realFetch;
  if(server) {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await rm(output,{recursive:true,force:true});
}
