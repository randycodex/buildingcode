import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCQualifiedOccupancy,extractHMCQualifiedOriginals} from '../scripts/definition-sources/bind-hmc-qualified-occupancy.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCQualifiedOriginals(sources[1]).map(e=>({...e,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};
test('qualified binding preserves exact identities complete meanings and sources',()=>{
 const before=compileDefinitionRegistry({books:[book]}),after=compileDefinitionRegistry({books:[bindHMCQualifiedOccupancy(book,sources)]});
 for(const e of after.books[0].entries){const old=before.books[0].entries.find(x=>x.id===e.id);assert.ok(old);assert.equal(e.text,old.text);assert.deepEqual(e.source,old.source);assert.deepEqual(e.aliases,e.term==='Tenement'?['tenements']:['dormitories']);}
 const select=(chapter,section,bundle=book.bundle)=>definitionsForReader(after,{bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:section});
 assert.equal(select('3','27-2075').length,2);assert.equal(select('3','27-2004').length,0);assert.equal(select('6','27-2075').length,0);assert.equal(select('3','27-2075','2014-construction-codes').length,0);
 for(const section of ['27-2041','27-2093.1'])assert.ok(!select('2',section).some(e=>e.term==='Dormitory'));
});
test('qualified binding fails closed for every source and original input drift',()=>{
 for(const chapter of Object.keys(sources))assert.throws(()=>bindHMCQualifiedOccupancy(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 assert.throws(()=>bindHMCQualifiedOccupancy({...book,chapterID:30000078},sources),/identity changed/);
 for(const change of [{text:'changed'},{aliases:['invented']},{anchor:'wrong'},{sourceFile:'wrong'}])assert.throws(()=>bindHMCQualifiedOccupancy({...book,terms:book.terms.map((e,i)=>i?e:{...e,...change})},sources),/original changed/);
 assert.throws(()=>bindHMCQualifiedOccupancy({...book,terms:book.terms.slice(1)},sources),/original changed/);
 assert.throws(()=>bindHMCQualifiedOccupancy({...book,terms:[...book.terms,book.terms[0]]},sources),/original changed/);
});
