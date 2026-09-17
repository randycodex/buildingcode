import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCClassA,extractHMCClassAOriginal} from '../scripts/definition-sources/bind-hmc-class-a.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {auditHMCClassA} from '../scripts/audit-hmc-class-a-applicability.mjs';
import {proposedClassAEntry,hypotheticalClassARegistry,matchClassAParagraph} from '../scripts/audit-hmc-class-a-matcher.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCClassAOriginal(sources[1]).map(e=>({...e,resolution:'direct',referenceText:null,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const original=registry.books.find(b=>b.chapterID===30000077).entries.find(e=>e.term==='Class A multiple dwelling');
const inventory=await auditHMCClassA();

test('Class A binding preserves original identity, ten-paragraph body and source and equals the reviewed proposal',()=>{
 const snapshot=JSON.stringify(book),compiled=compileDefinitionRegistry({books:[bindHMCClassA(book,sources)]}).books[0].entries[0];
 assert.equal(JSON.stringify(book),snapshot);
 assert.equal(compiled.id,'dc9d3eef2b81427fac2f');
 for(const key of ['id','term','text','source','resolution','referenceText'])assert.deepEqual(compiled[key],original[key]);
 assert.equal(compiled.text.split('\n\n').length,10);
 const proposal=proposedClassAEntry(original);
 for(const key of ['applicability','applicableChapters','applicableSections','excludedSections','excludedExactSections','aliases'])assert.deepEqual(compiled[key],proposal[key]);
 assert.equal(original.applicability,'review-required');
});
test('compiled Class A binding matches all 24 source ranges, excludes 13, and leaves other matches unchanged',()=>{
 const compiled=compileDefinitionRegistry({books:[bindHMCClassA(book,sources)]}).books[0].entries[0],proposed=hypotheticalClassARegistry(registry,compiled);
 let accepted=0,excluded=0;
 for(const p of inventory.paragraphs){
  const matches=matchClassAParagraph(proposed,compiled,p),expected=p.ranges.filter(r=>r.classification==='candidate');
  assert.deepEqual(matches.map(m=>[m.start,m.end]),expected.map(r=>[r.start,r.end]));
  accepted+=matches.length;excluded+=p.ranges.length-matches.length;
  const context={bundle:book.bundle,codeSectionID:5,chapterNumber:String(p.chapter),sectionNumber:p.section};
  const others=r=>createDefinitionMatcher(definitionsForReader(r,context),{sectionNumber:p.section})(p.text).flatMap(m=>m.entries.filter(e=>e.id!==compiled.id).map(e=>[m.start,m.end,e.id]));
  assert.deepEqual(others(proposed),others(registry));
 }
 assert.equal(accepted,24);assert.equal(excluded,13);
 for(const section of ['27-2004','27-2045',''])assert.ok(!definitionsForReader(proposed,{bundle:book.bundle,codeSectionID:5,chapterNumber:'2',sectionNumber:section}).some(e=>e.id===compiled.id));
});
test('binding rejects source, book and original-definition drift instead of changing the meaning',()=>{
 for(const chapter of Object.keys(sources))assert.throws(()=>bindHMCClassA(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 for(const change of [{chapterID:30000078},{bundle:'2014-construction-codes'},{codeSectionID:1},{chapter:'2'},{scope:'chapter'},{excludeWholeChapter:true}])assert.throws(()=>bindHMCClassA({...book,...change},sources),/identity changed/);
 for(const change of [{text:book.terms[0].text.split('\n\n')[0]},{aliases:['invented']},{anchor:'wrong'},{key:'wrong'},{sourceFile:'wrong'}])assert.throws(()=>bindHMCClassA({...book,terms:book.terms.map(e=>({...e,...change}))},sources),/original changed/);
 assert.throws(()=>bindHMCClassA({...book,terms:[]},sources),/original changed/);
 assert.throws(()=>bindHMCClassA({...book,terms:[...book.terms,book.terms[0]]},sources),/original changed/);
});
