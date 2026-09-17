import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCClassALocal} from '../scripts/definition-sources/hmc-class-a-local-definitions.mjs';
import {bindHMCClassA,extractHMCClassAOriginal} from '../scripts/definition-sources/bind-hmc-class-a.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {auditHMCClassALocal} from '../scripts/audit-hmc-class-a-local-applicability.mjs';
import {auditHMCClassA} from '../scripts/audit-hmc-class-a-applicability.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async c=>[c,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(c)}.html`,import.meta.url),'utf8')])));
const raw={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCClassAOriginal(sources[1]).map(e=>({...e,resolution:'direct',referenceText:null,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};
const book=bindHMCClassA(raw,sources),snapshot=JSON.stringify(book),bound=bindHMCClassALocal(book,sources),compiled=compileDefinitionRegistry({books:[bound]}).books[0].entries;
const general=compiled.find(e=>e.source.sectionNumber==='27-2004'),local=compiled.find(e=>e.source.sectionNumber==='27-2045');
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const proposed={...registry,books:registry.books.map(b=>b.chapterID===30000077?{...b,entries:[...b.entries.filter(e=>e.id!==local.id).map(e=>e.id===general.id?general:e),local]}:b)};
const inventory=await auditHMCClassALocal(),globalInventory=await auditHMCClassA();
const context=(section='27-2045',chapter='2')=>({bundle:book.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:section});
const matches=(r,p,c=context())=>createDefinitionMatcher(definitionsForReader(r,c),{sectionNumber:c.sectionNumber})(p.text);
test('separate local companion preserves the original and complete source excerpt without mutating inputs',()=>{
 assert.equal(JSON.stringify(book),snapshot);
 assert.equal(general.id,'dc9d3eef2b81427fac2f');assert.notEqual(local.id,general.id);
 assert.equal(general.text,inventory.original.text);assert.deepEqual(general.source,inventory.original.source);
 assert.equal(local.text,inventory.excerpt);assert.equal(local.text.length,882);
 assert.equal(local.source.anchor,'section-31001911');assert.equal(local.source.sectionNumber,'27-2045');
 assert.deepEqual(general.applicableSections,book.terms[0].applicableSections);
 assert.deepEqual(general.applicableExactSections,['27-2045']);assert.deepEqual(local.applicableExactSections,['27-2045']);
 assert.deepEqual(local.applicableSections,[]);
 // Previous clients ignore the new exact field; an explicit empty prefix scope must fail closed.
 const legacyApplies=(entry,section)=>(!entry.applicableSections||entry.applicableSections.some(scope=>section===scope||section.startsWith(scope+'.')));
 for(const section of ['27-2045','27-2045.1','27-2043'])assert.equal(legacyApplies(local,section),false);
});
test('all four operative ranges carry both full sources, all three declarations stay plain, and all other entries are unaffected',()=>{
 let links=0;
 for(const p of inventory.paragraphs){
  const full=matches(proposed,p),classA=full.filter(m=>m.entries.some(e=>e.id===general.id||e.id===local.id));
  assert.deepEqual(classA.map(m=>[m.start,m.end]),p.ranges.filter(r=>r.classification==='operative').map(r=>[r.start,r.end]));
  for(const m of classA){assert.deepEqual(new Set(m.entries.map(e=>e.id)),new Set([general.id,local.id]));links++;}
  const others=ms=>ms.flatMap(m=>m.entries.filter(e=>![general.id,local.id].includes(e.id)).map(e=>[m.start,m.end,e.id]));
  assert.deepEqual(others(full),others(matches(registry,p)),'paragraph '+p.paragraphIndex);
 }
 assert.equal(links,4);
});
test('existing 24 general applications retain their original single source',()=>{
 for(const p of globalInventory.paragraphs.filter(p=>p.section!=='27-2045')){
  const selected=matches(proposed,p,context(p.section,String(p.chapter))).filter(m=>m.entries.some(e=>e.id===general.id||e.id===local.id));
  assert.deepEqual(selected.map(m=>[m.start,m.end]),p.ranges.filter(r=>r.classification==='candidate').map(r=>[r.start,r.end]));
  assert.ok(selected.every(m=>m.entries.length===1&&m.entries[0].id===general.id));
 }
});
test('local scope fails closed for unknown, descendant and unrelated contexts',()=>{
 for(const delta of [{sectionNumber:''},{sectionNumber:'27-2045.1'},{sectionNumber:'27-20450'},{sectionNumber:'27-2043'},{chapterNumber:'3'},{bundle:'2014-construction-codes'},{codeSectionID:1}]){
  const eligible=definitionsForReader(proposed,{...context(),...delta});assert.ok(!eligible.some(e=>e.id===local.id));
 }
 assert.ok(!definitionsForReader(proposed,context('27-2045.1')).some(e=>e.id===general.id));
});
test('source and original drift or duplicate companion are rejected',()=>{
 for(const c of Object.keys(sources))assert.throws(()=>bindHMCClassALocal(book,{...sources,[c]:sources[c]+' '}),/source changed/);
 for(const change of [{text:'truncated'},{aliases:['invented']},{anchor:'wrong'}])assert.throws(()=>bindHMCClassALocal({...book,terms:book.terms.map(e=>({...e,...change}))},sources),/changed/);
 assert.throws(()=>bindHMCClassALocal(bound,sources),/Duplicate/);
});

test('activated registry preserves all37 boundaries with28 operative links and9 declaration exclusions',()=>{
 const actualGeneral=registry.books.flatMap(b=>b.entries).find(e=>e.id===general.id),actualLocal=registry.books.flatMap(b=>b.entries).find(e=>e.id===local.id);
 for(const key of ['id','text','source','aliases','applicableSections','applicableExactSections','applicableChapters','excludedSections','excludedExactSections','excludedOccurrences']){
  assert.deepEqual(actualGeneral[key],general[key]);assert.deepEqual(actualLocal[key],local[key]);
 }
 let total=0,excluded=0;
 for(const p of globalInventory.paragraphs){
  const links=matches(registry,p,context(p.section,String(p.chapter))).filter(m=>m.entries.some(e=>e.id===general.id));
  const expected=p.ranges.filter(r=>r.classification==='candidate'||r.classification==='localMeaning');
  assert.deepEqual(links.map(m=>[m.start,m.end]),expected.map(r=>[r.start,r.end]));
  for(const m of links)assert.deepEqual(new Set(m.entries.map(e=>e.id)),new Set(p.section==='27-2045'?[general.id,local.id]:[general.id]));
  total+=links.length;excluded+=p.ranges.length-links.length;
 }
 assert.equal(total,28);assert.equal(excluded,9);
});
