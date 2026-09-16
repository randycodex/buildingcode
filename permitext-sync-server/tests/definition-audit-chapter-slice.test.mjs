import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {sharedChapterSlice} from '../scripts/definition-audit-chapter-slice.mjs';

const root=new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/code-sections/',import.meta.url);
for(const [code,file,labels] of [
 ['building-code','K',['K1','K2','K3']],
 ['fuel-gas-code','Appendices',['A','B','C','D','E','F','G']],
 ['mechanical-code','Appendices',['A','B','C']],
 ['plumbing-code','Appendices',['A','B','C','D','E','F','G']]
])test(`${code}: shared chapter boundaries follow the published headings`,async()=>{
 const html=await readFile(new URL(`${code}/chapters/${file}.html`,root),'utf8');
 for(const label of labels){
  const slice=sharedChapterSlice(html,label);
  assert.ok(slice);
  assert.match(slice,new RegExp(`(?:Appendix|Chapter) ${label}:`));
  for(const other of labels.filter(x=>x!==label))assert.doesNotMatch(slice,new RegExp(`(?:Appendix|Chapter) ${other}:`));
 }
 assert.equal(sharedChapterSlice(html,'Z99'),null);
});
test('duplicate headings do not silently select a chapter',()=>{
 assert.equal(sharedChapterSlice('<h6>Appendix A: One</h6><h6>Appendix A: Two</h6>','A'),null);
});
