import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const base=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(`${base}/code/search?q=concrete&code=BC&version=2022&match=words&limit=5&grouped=true&readerSourceMetadata=1`);
  assert.equal(response.status,200);
  const page=await response.json();assert.ok(page.results.length);
  for(const result of page.results){
    assert.equal(result.codeSource.codePrefix,result.codePrefix);
    assert.equal(result.codeSource.canonicalEdition,result.codeVersion);
    const metadata=await(await fetch(`${base}/code/sections/${result.id}?include=metadata&version=${encodeURIComponent(result.codeVersion)}`)).json();
    assert.deepEqual(result.codeSource,metadata.section.codeSource,'Search carries the exact source identity used by source preflight');
    assert.equal(String(result.navigationChapterID),String(metadata.section.navigationChapterID));
  }
  console.log('Real concrete search results carry exact edition, source and navigation metadata.');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
