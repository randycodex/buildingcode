import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCThisCode,extractHMCThisCodeOriginal} from '../scripts/definition-sources/bind-hmc-this-code.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCThisCodeOriginal(sources[1]).map(e=>({...e,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};
test('This code binding preserves exact identities complete meanings and sources',()=>{
 const before=compileDefinitionRegistry({books:[book]}),after=compileDefinitionRegistry({books:[bindHMCThisCode(book,sources)]});
 for(const e of after.books[0].entries){const old=before.books[0].entries.find(x=>x.id===e.id);assert.ok(old);assert.equal(e.text,old.text);assert.deepEqual(e.source,old.source);assert.deepEqual(e.aliases,old.aliases);}
 const entry=after.books[0].entries[0];assert.equal(entry.id,'36ec815a89e5f6032f66');assert.equal(entry.text,'This code shall mean the housing maintenance code.');
 const select=(chapter,section,bundle=book.bundle)=>definitionsForReader(after,{bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:section});
 assert.equal(select('2','27-2005').length,1);assert.equal(select('1','27-2004').length,0);assert.equal(select('6','27-2005').length,0);assert.equal(select('2','27-2005','2014-construction-codes').length,0);

});
test('This code binding fails closed for every source and original input drift',()=>{
 for(const chapter of Object.keys(sources))assert.throws(()=>bindHMCThisCode(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 assert.throws(()=>bindHMCThisCode({...book,chapterID:30000078},sources),/identity changed/);
 for(const change of [{text:'changed'},{aliases:['invented']},{anchor:'wrong'},{sourceFile:'wrong'}])assert.throws(()=>bindHMCThisCode({...book,terms:book.terms.map((e,i)=>i?e:{...e,...change})},sources),/original changed/);
 assert.throws(()=>bindHMCThisCode({...book,terms:book.terms.slice(1)},sources),/original changed/);
 assert.throws(()=>bindHMCThisCode({...book,terms:[...book.terms,book.terms[0]]},sources),/original changed/);
});

test('compiled binding agrees with every reviewed This code occurrence in the full registry',async()=>{
 const {auditHMCThisCode}=await import('../scripts/audit-hmc-this-code-applicability.mjs');
 const {createDefinitionMatcher}=await import('../public/definition-matcher.js');
 const audit=await auditHMCThisCode();const compiled=compileDefinitionRegistry({books:[bindHMCThisCode(book,sources)]}).books[0].entries[0];
 assert.equal(compiled.id,audit.original.id);assert.equal(compiled.text,audit.original.text);assert.deepEqual(compiled.source,audit.original.source);
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 for(const b of registry.books)b.entries=b.entries.map(e=>e.id===compiled.id?compiled:e);
 let count=0;
 for(const p of audit.paragraphs){
  const chapter=String(Number(p.file.match(/(\d+)\.html$/)[1])-30000076);
  const matches=createDefinitionMatcher(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:p.section}),{sectionNumber:p.section})(p.text).filter(m=>m.entries.some(e=>e.id===compiled.id));count+=matches.length;
  for(const r of p.ranges)assert.equal(matches.some(m=>m.start===r.start&&m.end===r.end),r.classification==='candidate',p.section+' '+p.paragraphIndex);
 }
 assert.equal(count,89);
});
