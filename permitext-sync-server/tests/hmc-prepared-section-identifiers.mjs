import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyVisibleSectionNumber} from '../code-navigation-hierarchy.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
test('actual prepared HMC pest sections retain canonical web Reader scope',async()=>{
 for(const [id,number] of [[31001869,'27-2017.4'],[31001873,'27-2017.8']]){
  const detail=JSON.parse(await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/prepared/sections/${id}.json`,import.meta.url),'utf8'));
  const row=applyVisibleSectionNumber(detail);
  assert.equal(row.sectionNumber,number);
  const entries=definitionsForReader(registry,{bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:'2',sectionNumber:row.sectionNumber});
  assert.ok(entries.some(entry=>entry.term==='Premises'));
 }
});
