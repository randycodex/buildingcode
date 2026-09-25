import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chapterBodyContractResponse } from '../chapter-body-contract.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'chapter-revision-'));
const codeVersion = 'CodeContent/authored/new-york-city/test-edition/bundle.json#1';
const chapter = { id: 1, codePrefix: 'BC', groups: [], sections: [{id:1,title:'One'},{id:2,title:'Two'}] };
async function options(name, revision) {
 const root = join(temporary,name);
 const dir = join(root,'test-edition','prepared');
 await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'searchTextManifest.json'),JSON.stringify({sourceRevision:revision}));
 return {enabled:true,compactWindow:true,defaultCodeVersion:codeVersion,authoredRoot:root};
}
try {
 const first = await options('first','a'.repeat(64));
 const changed = await options('changed','b'.repeat(64));
 const manifest = await chapterBodyContractResponse(chapter,first);
 const body = await chapterBodyContractResponse({...chapter, sections:[{...chapter.sections[0],blocks:[]},chapter.sections[1]],bodyRange:{start:0,end:1,total:2,complete:false}},first);
 assert.equal(manifest.corpusRevision,body.corpusRevision,'Hydration must not change revision');
 assert.notEqual(manifest.corpusRevision,(await chapterBodyContractResponse(chapter,changed)).corpusRevision,'Rich source edit must invalidate');
 assert.notEqual(manifest.corpusRevision,(await chapterBodyContractResponse({...chapter,sections:[...chapter.sections].reverse()},first)).corpusRevision,'Index order must invalidate');
 assert.notEqual(manifest.corpusRevision,(await chapterBodyContractResponse({...chapter,id:2},first)).corpusRevision,'Navigation identity must invalidate');
 assert.strictEqual(await chapterBodyContractResponse(chapter,{enabled:false}),chapter,'Legacy needs no new manifest dependency');
 const malformed = await options('bad','not-a-fingerprint');
 await assert.rejects(chapterBodyContractResponse(chapter,malformed),/source revision/);
 // A transient unavailable/malformed source must be retryable rather than poison the process cache.
 await writeFile(join(malformed.authoredRoot,'test-edition','prepared','searchTextManifest.json'),JSON.stringify({sourceRevision:'c'.repeat(64)}));
 assert.equal((await chapterBodyContractResponse(chapter,malformed)).bodyContract,2);
 console.log('Chapter v2 revision, legacy, and retry contracts passed');
} finally { await rm(temporary,{recursive:true,force:true}); }
