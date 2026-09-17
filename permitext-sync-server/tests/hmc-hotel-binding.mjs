import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCHotel,extractHMCHotelOriginal} from '../scripts/definition-sources/bind-hmc-hotel.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCHotelOriginal(sources[1]).map(e=>({...e,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};
test('Hotel binding preserves exact identities complete meanings and sources',()=>{
 const before=compileDefinitionRegistry({books:[book]}),after=compileDefinitionRegistry({books:[bindHMCHotel(book,sources)]});
 for(const e of after.books[0].entries){const old=before.books[0].entries.find(x=>x.id===e.id);assert.ok(old);assert.equal(e.text,old.text);assert.deepEqual(e.source,old.source);assert.deepEqual(e.aliases,['hotels']);assert.equal(e.id,'43ebeca3182a8fe2e536');}
 const select=(chapter,section,bundle=book.bundle)=>definitionsForReader(after,{bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:section});
 assert.equal(select('2','27-2041').length,1);assert.equal(select('1','27-2004').length,0);assert.equal(select('4','27-2093.1').length,0);assert.equal(select('2','27-2041','2014-construction-codes').length,0);

});
test('Hotel binding fails closed for every source and original input drift',()=>{
 for(const chapter of Object.keys(sources))assert.throws(()=>bindHMCHotel(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 assert.throws(()=>bindHMCHotel({...book,chapterID:30000078},sources),/identity changed/);
 for(const change of [{text:'changed'},{aliases:['invented']},{anchor:'wrong'},{sourceFile:'wrong'}])assert.throws(()=>bindHMCHotel({...book,terms:book.terms.map((e,i)=>i?e:{...e,...change})},sources),/original changed/);
 assert.throws(()=>bindHMCHotel({...book,terms:book.terms.slice(1)},sources),/original changed/);
 assert.throws(()=>bindHMCHotel({...book,terms:[...book.terms,book.terms[0]]},sources),/original changed/);
});
test('compiled Hotel binding preserves ordinary plural and excludes both qualified categories',async()=>{
 const {auditHMCSmallInventories}=await import('../scripts/audit-hmc-withheld-small-inventories.mjs');const {createDefinitionMatcher}=await import('../public/definition-matcher.js');
 const inventory=await auditHMCSmallInventories(),compiled=compileDefinitionRegistry({books:[bindHMCHotel(book,sources)]}).books[0].entries[0];
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));const current=registry.books.find(b=>b.chapterID===30000077).entries.find(e=>e.term==='Hotel');
 assert.equal(compiled.id,current.id);assert.equal(compiled.text,current.text);assert.deepEqual(compiled.source,current.source);
 for(const b of registry.books)b.entries=b.entries.map(e=>e.id===compiled.id?compiled:e);
 let total=0;
 for(const p of inventory.terms.Hotel.paragraphs){const chapter=String(Number(p.file.match(/(\d+)\.html$/)[1])-30000076);const matches=createDefinitionMatcher(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:p.section}),{sectionNumber:p.section})(p.text).filter(m=>m.entries.some(e=>e.id===compiled.id));total+=matches.length;assert.equal(matches.length,p.section==='27-2041'?1:0);if(matches.length)assert.equal(matches[0].start,p.ranges[0].start);}
 assert.equal(total,1);
});
