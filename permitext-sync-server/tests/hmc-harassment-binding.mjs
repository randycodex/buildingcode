import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCHarassment,extractHMCHarassmentOriginal} from '../scripts/definition-sources/bind-hmc-harassment.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {auditHMCHarassment} from '../scripts/audit-hmc-harassment-applicability.mjs';
import {proposedHarassmentEntry,hypotheticalHarassmentRegistry,matchHarassmentParagraph} from '../scripts/audit-hmc-harassment-matcher.mjs';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCHarassmentOriginal(sources[1]).map(e=>({...e,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};

test('Harassment binding preserves full original 45 paragraphs, stable ID and source',()=>{
 const before=compileDefinitionRegistry({books:[book]}).books[0].entries[0],after=compileDefinitionRegistry({books:[bindHMCHarassment(book,sources)]}).books[0].entries[0];
 assert.equal(after.id,'e7eabb36ef1f70ffd848');assert.equal(after.id,before.id);assert.equal(after.text,before.text);assert.equal(after.text.length,11330);assert.equal(after.text.split('\n\n').length,45);assert.deepEqual(after.source,before.source);assert.deepEqual(after.aliases,[]);
 assert.deepEqual(after,proposedHarassmentEntry(before));
});
test('Harassment binding rejects source, original meaning and identity drift',()=>{
 for(const chapter of Object.keys(sources))assert.throws(()=>bindHMCHarassment(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 for(const change of [{bundle:'other'},{codeSectionID:6},{chapterID:30000078},{chapter:'2'},{scope:'chapter'},{excludeWholeChapter:true}])assert.throws(()=>bindHMCHarassment({...book,...change},sources),/identity changed/);
 for(const change of [{text:'changed'},{aliases:['invented']},{anchor:'wrong'},{sourceFile:'wrong'},{key:'wrong'},{sectionNumber:'27-2093'}])assert.throws(()=>bindHMCHarassment({...book,terms:book.terms.map(e=>({...e,...change}))},sources),/original changed/);
 assert.throws(()=>bindHMCHarassment({...book,terms:[]},sources),/original changed/);
 assert.throws(()=>bindHMCHarassment({...book,terms:[...book.terms,...book.terms]},sources),/original changed/);
});
test('compiled candidate binds all 38 accepted and none of 87 excluded uses in full current registry',async()=>{
 const inventory=await auditHMCHarassment(),entry=compileDefinitionRegistry({books:[bindHMCHarassment(book,sources)]}).books[0].entries[0];
 assert.equal(entry.id,inventory.original.id);assert.equal(entry.text,inventory.original.text);assert.deepEqual(entry.source,inventory.original.source);
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8')),before=JSON.stringify(registry),candidate=hypotheticalHarassmentRegistry(registry,entry);
 let total=0,count=0;
 for(const p of inventory.paragraphs){
  const matches=matchHarassmentParagraph(candidate,entry,p),expected=p.ranges.filter(r=>r.classification==='candidate');
  assert.deepEqual(matches.map(m=>[m.start,m.end]),expected.map(r=>[r.start,r.end]),`${p.section} paragraph ${p.paragraphIndex}`);
  total+=matches.length;count+=p.ranges.length;
 }
 assert.equal(total,38);assert.equal(count,125);assert.equal(count-total,87);assert.equal(JSON.stringify(registry),before);
});
test('binding does not mutate input or unrelated entries',()=>{
 const unrelated={term:'Unrelated',sectionNumber:'27-2004',text:'Unrelated meaning'},input={...book,terms:[...book.terms,unrelated]},before=JSON.stringify(input),bound=bindHMCHarassment(input,sources);
 assert.equal(JSON.stringify(input),before);assert.equal(bound.terms.at(-1),unrelated);
});
