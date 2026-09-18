import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
const bundle='2026-enacted-administrative-code';
const context={bundle,codeSectionID:3,chapterNumber:'21',sectionNumber:'26-2102'};
function fixture() {
 return compileDefinitionRegistry({books:[30000039,30000040].map(chapterID=>({bundle,code:'ADMINISTRATIVE CODE TITLE 26',codeSectionID:3,chapter:'21',chapterID,scope:'general',excludeWholeChapter:false,terms:[{term:'Dwelling unit',key:'dwelling unit',text:`Fixture meaning ${chapterID}`,sourceFile:`${bundle}/chapters/${chapterID}.html`,anchor:`fixture-${chapterID}`,sectionNumber:'26-2101',applicability:'definition-chapter',resolution:'direct',applicableChapters:['21'],applicableChapterIDs:[chapterID],excludedExactSections:['26-2101']}]}))});
}
test('compiled chapter IDs isolate two identical printed chapter and section numbers',()=>{
 const registry=fixture();
 for(const chapterID of [30000039,30000040]) {
  const selected=definitionsForReader(registry,{...context,chapterID});
  assert.equal(selected.length,1);
  assert.equal(selected[0].text,`Fixture meaning ${chapterID}`);
  assert.deepEqual(selected[0].applicableChapterIDs,[chapterID]);
 }
 for(const chapterID of [undefined,null,'30000039',0,30000055,NaN])assert.deepEqual(definitionsForReader(registry,{...context,chapterID}),[]);
 for(const override of [{bundle:'other'},{codeSectionID:5},{chapterNumber:'37'},{sectionNumber:'26-2101'},{sectionNumber:undefined}])assert.deepEqual(definitionsForReader(registry,{...context,chapterID:30000039,...override}),[]);
 assert.equal(definitionsForReader(registry,{...context,chapterID:30000039,includeSectionScoped:true}).length,1);
 assert.equal(definitionsForReader(registry,{...context,includeSectionScoped:true}).length,0);
});
test('whole definition chapter protection uses actual identity while missing identity stays conservative',()=>{
 const registry=fixture();registry.books[0].excludeWholeChapter=true;
 assert.equal(definitionsForReader(registry,{...context,chapterID:30000039}).length,0);
 assert.equal(definitionsForReader(registry,{...context,chapterID:30000040}).length,1);
 assert.equal(definitionsForReader(registry,context).length,0);
});
test('current published registry selects identically with actual chapter IDs or legacy context',async()=>{
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url)));
 const bundleJSON=JSON.parse(await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json',import.meta.url)));
 for(const chapter of bundleJSON.chapters) {
  const ctx={bundle,codeSectionID:chapter.codeSectionID,chapterNumber:chapter.chapterNumber,includeSectionScoped:true};
  assert.deepEqual(definitionsForReader(registry,{...ctx,chapterID:chapter.id}),definitionsForReader(registry,ctx),chapter.title);
 }
});
