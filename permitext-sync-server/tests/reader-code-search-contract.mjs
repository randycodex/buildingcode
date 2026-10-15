import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temporary = await mkdtemp(join(tmpdir(), 'permitext-reader-code-search-'));
Object.assign(process.env, {NODE_ENV:'test', VERCEL:'', VERCEL_ENV:'', PERMITEXT_SYNC_DATA_PATH:join(temporary,'sync.json'), PERMITEXT_TEST_RESEARCH_MOCK:'1'});
for (const key of ['DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL']) delete process.env[key];
const {handleRequest} = await import('../app.mjs');
const server = createServer(handleRequest);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
async function get(path) {
  const response=await fetch(base+path);
  const payload=await response.json();
  assert.equal(response.status,200,JSON.stringify(payload));
  return payload;
}
try {
  const historical='CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1';
  for (const [code,version,query] of [['PC','', 'plumbing'],['PC',historical,'water'],['BC','','egress'],['MC','','mechanical']]) {
    const params=new URLSearchParams({code,version});
    const catalog=(await get(`/code/chapters?${params}`)).chapters;
    const current=catalog[0];
    assert.ok(current,`Missing ${code} catalog`);
    const path=`/code/chapters/${current.id}?bodyContract=2&readerSearch=${query}`;
    const start=performance.now();
    const result=(await get(path+'&readerScope=code')).readerSearch;
    const ms=Math.round(performance.now()-start);
    assert.equal(result.scope,'code');
    assert.equal(result.codePrefix,code);
    assert.equal(String(result.chapterID),String(current.id));
    assert.equal(String(result.chapters[0].chapterID),String(current.id),'current chapter comes first');
    assert.equal(result.chapters.length,catalog.length,'every navigation chapter is searched');
    assert.equal(result.total,result.results.length);
    assert.ok(new Set(result.results.map(item=>item.chapterID)).size>1,'includes matches in multiple chapters');
    const expected=[];
    for (const chapter of catalog) {
      const single=(await get(`/code/chapters/${chapter.id}?bodyContract=2&readerSearch=${query}`)).readerSearch;
      assert.equal(single.codeVersion,result.codeVersion,'never mixes editions');
      const metadata=result.chapters.find(item=>String(item.chapterID)===String(chapter.id));
      assert.equal(metadata.total,single.total);
      assert.equal(metadata.corpusRevision,single.corpusRevision);
      expected.push(...single.results.map(item=>({...item,chapterID:chapter.id,chapterNumber:metadata.chapterNumber,chapterTitle:metadata.chapterTitle,corpusRevision:single.corpusRevision})));
    }
    assert.deepEqual(result.results,expected,'code scope preserves all chapter-search matches and their exact block targets');
    assert.ok(result.results.every(item=>!('blocks' in item)&&!('html' in item)),'search does not ship rich chapter bodies');
    const conflict=await fetch(base+path+'&readerScope=code&expectedCorpusRevision='+'0'.repeat(64));
    assert.equal(conflict.status,409,'stale chapter identity remains fenced');
    console.log(`${code} ${version?'2014':'current'}: ${result.chapters.length} chapters, ${result.total} matches, ${ms} ms isolated localhost search`);
  }
  const plumbing=(await get('/code/chapters?code=PC')).chapters;
  const waterHeaters=plumbing.find(chapter=>String(chapter.chapterNumber)==='5');
  const outside=(await get(`/code/chapters/${waterHeaters.id}?readerScope=code&readerSearch=storm%20drainage`)).readerSearch;
  assert.equal(String(outside.chapters[0].chapterID),String(waterHeaters.id),'a later current chapter still comes first');
  assert.equal(outside.chapters[0].total,0);
  assert.ok(outside.results.length>0,'other chapters are returned even with no current-chapter match');
  const pc=plumbing[0];
  const noResults=(await get(`/code/chapters/${pc.id}?readerScope=code&readerSearch=zzzxqvnonexistentzzzxqv`)).readerSearch;
  assert.equal(noResults.total,0);
  assert.ok(noResults.chapters.length>1);
  console.log('Reader code-wide HTTP search passed: complete chapter coverage, edition/revision fences, compact results and unchanged chapter search.');
} finally {
  await new Promise(resolve=>server.close(resolve));
  await rm(temporary,{recursive:true,force:true});
}
