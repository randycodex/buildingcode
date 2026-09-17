import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditHMCClassALocal} from '../scripts/audit-hmc-class-a-local-applicability.mjs';
const report=await auditHMCClassALocal();
test('local source-only excerpt is exactly the contiguous three complete paragraphs with independent citations',()=>{
 assert.equal(report.excerpt.length,882);
 assert.deepEqual(report.excerptParagraphs.map(p=>p.paragraphIndex),[0,1,2]);
 assert.equal(report.excerpt,report.excerptParagraphs.map(p=>p.text).join('\n\n'));
 assert.equal(report.localSource.anchor,'section-31001911');
 assert.equal(report.localSource.sectionNumber,'27-2045');
 assert.equal(report.original.id,'dc9d3eef2b81427fac2f');
 assert.equal(report.original.text.split('\n\n').length,10);
 assert.equal(report.original.source.sectionNumber,'27-2004');
 assert.ok(!Object.hasOwn(report.localSource,'id'));
 assert.match(report.excerpt,/constructed before April 18, 1954/);
 assert.match(report.excerpt,/paragraph 6 of subdivision a of section 27-2004\.$/);
 assert.ok(!report.excerpt.includes('Private dwelling. The term'));
 assert.ok(report.paragraphs[3].text.startsWith('Private dwelling.'));
});
test('all seven exact source ranges retain complete paragraphs and declaration exclusions',()=>{
 assert.equal(report.occurrences.length,7);
 assert.deepEqual(report.counts,{declaration:3,operative:4});
 assert.deepEqual(report.occurrences.map(o=>[o.paragraphIndex,o.start,o.end]),[[1,0,25],[1,37,62],[1,72,97],[4,17,42],[9,11,36],[15,147,172],[19,43,68]]);
 for(const o of report.occurrences){
  assert.match(o.text.slice(o.start,o.end),/^class A multiple dwelling$/i);
  assert.equal(o.text,report.paragraphs[o.paragraphIndex].text);
  assert.equal(o.classification,o.paragraphIndex===1?'declaration':'operative');
  assert.ok(o.sourceStart>0);
 }
});
for(const chapter of [30000077,30000078])test('rejects altered source '+chapter,async()=>{
 await assert.rejects(auditHMCClassALocal({read:async(url,encoding)=>{const value=await readFile(url,encoding);return url.pathname.endsWith('/'+chapter+'.html')?value+'\n':value;}}),/source changed/);
});
test('rejects truncation and wrong or duplicated original general identity',async()=>{
 for(const mutate of [e=>{e.text=e.text.split('\n\n')[0];},e=>{e.id='changed';},e=>{e.source.anchor='wrong';},(e,entries)=>entries.push({...e})]){
  await assert.rejects(auditHMCClassALocal({read:async(url,encoding)=>{
   const value=await readFile(url,encoding);if(!url.pathname.endsWith('reader-definition-registry.json'))return value;
   const registry=JSON.parse(value),entries=registry.books.find(b=>b.chapterID===30000077).entries;
   mutate(entries.find(e=>e.term==='Class A multiple dwelling'),entries);return JSON.stringify(registry);
  }}),/identity\/body changed/);
 }
});
