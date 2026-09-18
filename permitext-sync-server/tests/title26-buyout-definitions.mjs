import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'parse5';
import {title26BuyoutSource as binding,isTitle26BuyoutChapter,extractTitle26BuyoutDefinitions} from '../scripts/definition-sources/title26-buyout-definitions.mjs';
import {definitionAuditScopedPassages} from '../scripts/definition-audit-prose.mjs';
const source=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+binding.file,import.meta.url),'utf8');
const terms=extractTitle26BuyoutDefinitions(source);
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
function paragraphs(node,result=[]) {if(node.tagName==='p')result.push(text(node));for(const child of node.childNodes||[])paragraphs(child,result);return result;}
const counts=value=>['buyout agreement','buyout agreements','commissioner','commissioners','department','departments'].map(term=>[...value.matchAll(new RegExp('\\b'+term+'\\b','gi'))].length);
test('extracts exactly three complete source bodies with immutable provenance and exact chapter scope',()=>{
 assert.deepEqual(terms.map(t=>t.term),['Buyout agreement','Commissioner','Department']);
 assert.deepEqual(terms.map(t=>t.text),[
 'Buyout agreement. The term "buyout agreement" means an agreement wherein the owner of a dwelling unit exchanges money or other valuable consideration to induce any person lawfully entitled to occupancy of such unit to surrender or waive any rights in relation to such occupancy that results in the tenant vacating such unit.',
 'Commissioner. The term "commissioner" means the commissioner of housing preservation and development and any successor thereto.',
 'Department. The term "department" means the department of housing preservation and development and any successor thereto.'
 ]);
 for(const term of terms){assert.equal(term.anchor,binding.anchor);assert.equal(term.sectionNumber,binding.section);assert.equal(term.referenceOnly,false);assert.equal(term.applicability,'definition-chapter');assert.deepEqual(term.applicableChapters,['24']);assert.ok(!term.text.includes('L.L.'));}
});
test('source and exact chapter guards reject modified, neighboring, same-number foreign-code sources',()=>{
 const chapter={id:binding.chapterID,codeSectionID:3,chapterNumber:'24'};
 assert.equal(isTitle26BuyoutChapter(binding.bundle,chapter),true);
 for(const change of [{id:30000041},{codeSectionID:2},{chapterNumber:'25'}])assert.equal(isTitle26BuyoutChapter(binding.bundle,{...chapter,...change}),false);
 assert.equal(isTitle26BuyoutChapter('2022-construction-codes',chapter),false);
 assert.throws(()=>extractTitle26BuyoutDefinitions(source.replace('successor thereto','successors thereto')),/source changed/);
});
test('exhaustive paragraph occurrence inventory separates declarations and operative prose',()=>{
 assert.deepEqual(counts(paragraphs(parse(source)).join('\n')),[7,2,5,0,5,0]);
 const passages=definitionAuditScopedPassages(source).filter(p=>p.sectionNumber?.startsWith('26-')); 
 assert.deepEqual(passages.map(p=>[p.sectionNumber,counts(p.text)]),[
 ['26-2401',[0,1,0,0,0,0]],['26-2403',[4,0,1,0,2,0]],
 ['26-2404',[0,1,1,0,0,0]],['26-2405',[1,0,0,0,0,0]]]);
 assert.ok(!passages.some(p=>p.sectionNumber==='26-2402'));
 assert.doesNotMatch(passages.map(p=>p.text).join('\n'),/department of (?:buildings|citywide administrative services)|commissioner of finance/i);
 assert.match(source,/This chapter applies to all buyout agreements executed on or after the effective date of this chapter\./);
 assert.equal((source.match(/eff\. 7\/1\/2020/g)||[]).length,5);
});

test('published full matcher decorates eleven exact applications and rejects missing identity or other scope',async()=>{
 const {definitionsForReader}=await import('../public/reader-definition-registry.js');
 const {createDefinitionMatcher}=await import('../public/definition-matcher.js');
 const registry=JSON.parse(readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url)));
 const context={bundle:binding.bundle,codeSectionID:3,chapterNumber:'24',chapterID:30000042};
 const totals={};
 for(const passage of definitionAuditScopedPassages(source)){
  const entries=definitionsForReader(registry,{...context,sectionNumber:passage.sectionNumber});
  for(const match of createDefinitionMatcher(entries,{sectionNumber:passage.sectionNumber})(passage.text))for(const e of match.entries)totals[e.term]=(totals[e.term]||0)+1;
 }
 assert.deepEqual(totals,{'Buyout agreement':7,Department:2,Commissioner:2});
 for(const change of [{chapterID:undefined},{chapterID:30000041},{chapterNumber:'21'},{codeSectionID:2},{bundle:'2022-construction-codes'},{sectionNumber:undefined},{sectionNumber:'26-2402'},{sectionNumber:'26-2403.1'}]){
  assert.deepEqual(definitionsForReader(registry,{...context,sectionNumber:'26-2403',...change}).filter(entry=>entry.source.chapterID===binding.chapterID),[]);
 }
});
