import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractHMCMissingDefinitions} from '../scripts/definition-sources/hmc-missing-definitions.mjs';
import {bindHMCPersonApplicability,hmcPersonSourceSections,hmcPersonExcludedContexts} from '../scripts/definition-sources/bind-hmc-person-applicability.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
const sources=Object.fromEntries(await Promise.all([1,2,3,4,5].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+chapter}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',scope:'general',excludeWholeChapter:false,code:'HOUSING MAINTENANCE CODE',terms:extractHMCMissingDefinitions(sources[1])};
const bound=bindHMCPersonApplicability(book,sources);
const person=compileDefinitionRegistry({books:[bound]}).books[0].entries.find(entry=>entry.term==='Person');
// Retain every currently active HMC entry so longer/competing matches are real.
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const current=registry.books.find(item=>item.bundle===book.bundle&&item.chapterID===book.chapterID);
assert.equal(current.entries.filter(entry=>entry.id===person.id).length,1);
current.entries=current.entries.map(entry=>entry.id===person.id?person:entry);
const select=(chapterNumber,sectionNumber,bundle=book.bundle)=>definitionsForReader(registry,{bundle,codeSectionID:5,chapterNumber,sectionNumber});
const personMatches=(text,chapter,section)=>createDefinitionMatcher(select(chapter,section),{sectionNumber:section})(text).filter(match=>match.entries.some(entry=>entry.id===person.id));
test('complete composite, source identity, IDs and other entries preserved; no plural alias',()=>{
 const old=compileDefinitionRegistry({books:[book]}).books[0].entries.find(entry=>entry.term==='Person');
 assert.equal(person.id,old.id);assert.equal(person.text,old.text);assert.deepEqual(person.source,old.source);assert.deepEqual(person.aliases,[]);
 assert.match(person.text,/adult or child over the age of four years/);assert.match(person.text,/subchapters four and five/);assert.match(person.text,/more than ten percent/);assert.match(person.text,/at least twenty savings/);
 for(const term of bound.terms.filter(t=>t.term!=='Person'))assert.deepEqual(term,book.terms.find(t=>t.term===term.term));
});
test('explicit Article4/subchapter4+5 boundaries and definition negatives',()=>{
 for(const [chapter,section]of [['3','27-2074'],['3','27-2075'],['3','27-2080'],['4','27-2090'],['4','27-2109.52'],['5','27-2110'],['5','27-2154']])assert.ok(select(chapter,section).some(e=>e.id===person.id));
 for(const [chapter,section]of [['3','27-2073'],['3','27-2081'],['3','27-2067'],['1','27-2004'],['2','27-2007'],['4','27-2109.51'],['5','27-2150'],['3',undefined],[undefined,'27-2075'],['6','27-2075']])assert.ok(!select(chapter,section).some(e=>e.id===person.id),String([chapter,section]));
 assert.ok(!select('3','27-2075','1968-building-code').some(e=>e.id===person.id));
 assert.equal(personMatches('persons','3','27-2075').length,0);
});
test('all actual source paragraphs: 137 singular candidates, nineteen contextual exclusions, 118 links with complete active entry set',()=>{
 let raw=0,linked=0;const counts={};
 for(const section of hmcPersonSourceSections(sources)){
  if(!person.applicableSections.includes(section.number)||!['3','4','5'].includes(section.chapter))continue;
  const sectionRaw=section.paragraphs.reduce((sum,text)=>sum+[...text.matchAll(/\bperson\b/gi)].length,0);
  const sectionLinked=section.paragraphs.reduce((sum,text)=>sum+personMatches(text,section.chapter,section.number).length,0);
  raw+=sectionRaw;linked+=sectionLinked;counts[section.number]=sectionRaw-sectionLinked;
 }
 assert.equal(raw,137);assert.equal(linked,118);
 for(const [section,phrases]of Object.entries(hmcPersonExcludedContexts))assert.equal(counts[section],phrases.reduce((sum,[,count])=>sum+count,0),section);
 for(const [section,count]of Object.entries(counts))if(!hmcPersonExcludedContexts[section])assert.equal(count,0,section);
});
test('repeat decoration keeps excluded contexts plain with all existing controls masked',()=>{
 for(const section of hmcPersonSourceSections(sources)){
  if(!person.applicableSections.includes(section.number))continue;
  const matcher=createDefinitionMatcher(select(section.chapter,section.number),{sectionNumber:section.number});
  for(const text of section.paragraphs){
   const first=matcher(text);
   // Preserve exact UTF-16 offsets while emulating already-decorated controls.
   let candidate=text;
   for(const match of [...first].reverse())candidate=candidate.slice(0,match.start)+'\0'.repeat(match.end-match.start)+candidate.slice(match.end);
   assert.equal(matcher(candidate,text).filter(match=>match.entries.some(entry=>entry.id===person.id)).length,0,section.number);
  }
 }
});
test('source, original meaning, alias and book identity guards fail closed',()=>{
 assert.throws(()=>bindHMCPersonApplicability(book,{...sources,4:sources[4]+' '}),/source changed/);
 assert.throws(()=>bindHMCPersonApplicability({...book,chapterID:1},sources),/identity changed/);
 assert.throws(()=>bindHMCPersonApplicability({...book,terms:book.terms.map(t=>t.term==='Person'?{...t,text:t.text+' changed'}:t)},sources),/composite changed/);
 assert.throws(()=>bindHMCPersonApplicability({...book,terms:book.terms.map(t=>t.term==='Person'?{...t,aliases:['persons']}:t)},sources),/composite changed/);
});
