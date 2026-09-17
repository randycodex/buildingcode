import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {definitionAuditScopedPassages} from '../scripts/definition-audit-prose.mjs';
const registry=JSON.parse(readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url)));
const root=new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/',import.meta.url);
function fixture(bundle,chapter,section,term){
 const book=registry.books.find(b=>b.bundle===bundle&&b.scope==='general'&&b.entries.some(e=>e.term===term));
 const entries=definitionsForReader(registry,{bundle,codeSectionID:book.codeSectionID,chapterNumber:chapter,sectionNumber:section}).filter(e=>e.term===term);
 const html=readFileSync(new URL(`${bundle}/chapters/${chapter==='15'?'30000071':chapter}.html`,root),'utf8');
 const passage=definitionAuditScopedPassages(html).find(p=>p.sectionNumber===section);
 assert.ok(passage,section);return {entries,text:passage.text};
}
test('actual mixed 1968 oil section suppresses material grade while retaining ground grade',()=>{
 const {entries,text}=fixture('2026-enacted-administrative-code','15','27-830','GRADE');
 const all=[...text.matchAll(/\bgrade\b/gi)];assert.equal(all.length,4);
 const matches=createDefinitionMatcher(entries,{sectionNumber:'27-830'})(text);
 assert.equal(matches.length,1);assert.match(text.slice(matches[0].start-15,matches[0].end),/at or above grade/i);
 assert.equal(createDefinitionMatcher(entries,{sectionNumber:'27-831'})(text).length,4);
});
test('actual D305 court and unit dimensions stay plain, dwelling-height meanings remain',()=>{
 const {entries,text}=fixture('2026-existing-building-code','D3','D305','HEIGHT (MDL 4(35))');
 assert.equal(entries.length,1); // Identical referral/appendix meanings are deduplicated.
 assert.equal(registry.books.flatMap(b=>b.entries).filter(e=>e.term==='HEIGHT (MDL 4(35))'&&e.excludedOccurrences?.some(r=>r.section==='D305')).length,2);
 const matches=createDefinitionMatcher(entries,{sectionNumber:'D305'})(text);
 assert.equal([...text.matchAll(/\bheight\b/gi)].length,10);
 assert.equal(matches.length,3);
 for(const match of matches)assert.equal(match.entries.length,1);
 assert.ok(matches.some(m=>text.slice(m.start-45,m.end).replace(/\s+/g,' ').includes('dwelling 3 stories or less in height')));
 assert.ok(matches.some(m=>text.slice(m.start,m.end+25).includes('height of the dwelling')));
});
test('occurrence exclusions preserve other definitions, Unicode offsets and exact scope',()=>{
 const {entries}=fixture('2026-enacted-administrative-code','15','27-830','GRADE');
 const text='😀 SAME grade\nOF OIL; above grade. grade B seamless. grade.';
 const material={id:'other',term:'GRADE',text:'Unrelated fixture meaning'};
 const matches=createDefinitionMatcher([...entries,material],{sectionNumber:'27-830.1'})(text);
 assert.deepEqual(matches.map(m=>m.entries.length),[1,2,1,2]);
 assert.ok(matches[0].start>2);assert.equal(text.slice(matches[0].start,matches[0].end),'grade');
 assert.equal(createDefinitionMatcher(entries,{sectionNumber:'27-8300'})(text).length,4);
 assert.equal(createDefinitionMatcher(entries)(text).length,4);
});

test('a context with repeated terms excludes only its reviewed occurrence',()=>{
 const entry={id:'fixture',term:'GRADE',excludedOccurrences:[{section:'1',phrases:[{text:'grade versus grade',occurrence:1}]}]};
 const text='grade versus grade; grade';
 assert.deepEqual(createDefinitionMatcher([entry],{sectionNumber:'1'})(text).map(m=>m.start),[0,20]);
});

test('repeated decoration retains context across existing definition buttons',()=>{
 const book=registry.books.find(b=>b.bundle==='2026-existing-building-code'&&b.scope==='general');
 const entries=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'D3',sectionNumber:'D305'});
 const text='Such dwelling unit has at least one-half of its height';
 const matcher=createDefinitionMatcher(entries,{sectionNumber:'D305'});
 const first=matcher(text);
 assert.ok(first.some(m=>m.text==='dwelling unit'));
 assert.ok(!first.some(m=>m.text==='height'));
 let masked=text;for(const match of [...first].reverse())masked=masked.slice(0,match.start)+'\0'.repeat(match.end-match.start)+masked.slice(match.end);
 assert.deepEqual(matcher(masked,text),[]);
});

test('reviewed Appendix D dimensions are excluded individually while neighboring height uses remain',()=>{
 for(const [chapter,section,total,linked] of [['D3','D306',11,9],['D6','D602',5,4],['D6','D603',5,2],['D6','D604',8,7],['D7','D702',22,20],['D7','D703',24,19],['D7','D704',1,0]]){
  const {entries,text}=fixture('2026-existing-building-code',chapter,section,'HEIGHT (MDL 4(35))');
  assert.equal([...text.matchAll(/\bheight\b/gi)].length,total,section);
  const matches=createDefinitionMatcher(entries,{sectionNumber:section})(text);
  assert.equal(matches.length,linked,section);
  assert.ok(matches.every(m=>!/(?:height of the riser|height of the floor beams)/i.test(text.slice(m.start,m.end+25))),section);
 }
});


test('actual 27-828 commercial oil grades stay plain without suppressing adjacent ground grade',()=>{
 const {entries,text}=fixture('2026-enacted-administrative-code','15','27-828','GRADE');
 assert.equal([...text.matchAll(/commercial\s+grade\s+oils/gi)].length,2);
 assert.equal([...text.matchAll(/\bgrade\b/gi)].length,2);
 assert.equal(createDefinitionMatcher(entries,{sectionNumber:'27-828'})(text).length,0);
 assert.equal(createDefinitionMatcher(entries,{sectionNumber:'27-828'})('A tank above grade.').length,1);
 const adjacent=fixture('2026-enacted-administrative-code','15','27-830','GRADE');
 assert.equal(createDefinitionMatcher(adjacent.entries,{sectionNumber:'27-830'})(adjacent.text).length,1);
});
