import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditHMCClassAMatcher,proposedClassAEntry,hypotheticalClassARegistry,matchClassAParagraph} from '../scripts/audit-hmc-class-a-matcher.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const original=registry.books.find(b=>b.chapterID===30000077).entries.find(e=>e.term==='Class A multiple dwelling');
const before=JSON.stringify(registry),report=await auditHMCClassAMatcher(),entry=proposedClassAEntry(original),proposed=hypotheticalClassARegistry(registry,entry);

test('complete hypothetical registry accepts 24 source applications and excludes 13 without narrowing scope',()=>{
 assert.equal(report.accepted,24);assert.equal(report.excluded,13);assert.equal(report.occurrences,37);
 assert.equal(report.paragraphs.reduce((n,p)=>n+p.ranges.length,0),37);
 for(const p of report.paragraphs)assert.deepEqual(p.matches.map(m=>[m.start,m.end]),p.ranges.filter(r=>r.classification==='candidate').map(r=>[r.start,r.end]));
 assert.deepEqual(Object.fromEntries(['27-2033.1','27-2041.2','27-2043','27-2063','27-2140'].map(s=>[s,report.paragraphs.filter(p=>p.section===s).reduce((n,p)=>n+p.matches.length,0)])),{'27-2033.1':18,'27-2041.2':2,'27-2043':2,'27-2063':1,'27-2140':1});
});
test('hypothesis preserves original complete body and identity without mutating the registry',()=>{
 for(const key of ['id','term','text','source','resolution','referenceText'])assert.deepEqual(entry[key],original[key]);
 assert.equal(entry.text.split('\n\n').length,10);
 assert.equal(createHash('sha256').update(entry.text).digest('hex'),report.bodySHA256);
 assert.equal(JSON.stringify(registry),before);
 assert.equal(original.applicability,'definition-chapter');
 assert.deepEqual(original.aliases,['class A multiple dwellings']);
 assert.deepEqual(entry.aliases,['class A multiple dwellings']);
 assert.throws(()=>hypotheticalClassARegistry({...registry,books:[]},entry),/exactly one/);
 assert.throws(()=>hypotheticalClassARegistry({...registry,books:[...registry.books,...registry.books]},entry),/exactly one/);
});
test('plural alias is source-attested and necessary for all five plural applications',()=>{
 const plurals=report.paragraphs.flatMap(p=>p.ranges.filter(r=>r.classification==='candidate'&&/dwellings$/i.test(p.text.slice(r.start,r.end))).map(r=>({p,r})));
 assert.equal(plurals.length,5);
 const noAlias={...entry,aliases:[]},without=hypotheticalClassARegistry(registry,noAlias);
 for(const {p,r} of plurals){
  assert.ok(matchClassAParagraph(proposed,entry,p).some(m=>m.start===r.start&&m.end===r.end));
  assert.ok(!matchClassAParagraph(without,noAlias,p).some(m=>m.start===r.start&&m.end===r.end));
 }
});
test('general definitions and every local2045 declaration/application stay excluded',()=>{
 for(const p of report.paragraphs.filter(p=>['27-2004','27-2045'].includes(p.section)))assert.equal(matchClassAParagraph(proposed,entry,p).length,0);
 // Broaden positives in this negative control: explicit local exclusion must still protect all operative uses.
 const broad={...entry,applicableSections:[...entry.applicableSections,'27-2045']};
 for(const p of report.paragraphs.filter(p=>p.section==='27-2045'))assert.equal(matchClassAParagraph(hypotheticalClassARegistry(registry,broad),broad,p).length,0);
 const unsafe={...broad,excludedExactSections:broad.excludedExactSections.filter(s=>s!=='27-2045')};
 const p=report.paragraphs.find(p=>p.section==='27-2045'&&p.paragraphIndex===4);
 assert.equal(matchClassAParagraph(hypotheticalClassARegistry(registry,unsafe),unsafe,p).length,1);
});
test('other competing definition matches remain unchanged in every complete inventoried paragraph',()=>{
 for(const p of report.paragraphs){
  const context={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:String(p.chapter),sectionNumber:p.section};
  const others=r=>createDefinitionMatcher(definitionsForReader(r,context),{sectionNumber:p.section})(p.text).flatMap(m=>m.entries.filter(e=>e.id!==entry.id&&e.id!=='3f92fb27b805373fcf42').map(e=>[m.start,m.end,e.id]));
  assert.deepEqual(others(proposed),others(registry),`${p.section} paragraph ${p.paragraphIndex}`);
 }
});
test('proposal fails closed outside reviewed code, edition, chapter and section context',()=>{
 const base={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:'2',sectionNumber:'27-2043'};
 for(const delta of [{bundle:'2014-construction-codes'},{codeSectionID:1},{chapterNumber:'4'},{sectionNumber:''},{sectionNumber:'27-2045'},{sectionNumber:'27-2041'},{sectionNumber:'27-2093.1'}])assert.ok(!definitionsForReader(proposed,{...base,...delta}).some(e=>e.id===entry.id));
});
