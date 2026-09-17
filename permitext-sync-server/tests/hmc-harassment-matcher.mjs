import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditHMCHarassmentMatcher,proposedHarassmentEntry,hypotheticalHarassmentRegistry,matchHarassmentParagraph} from '../scripts/audit-hmc-harassment-matcher.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const original=registry.books.find(b=>b.chapterID===30000077).entries.find(e=>e.term==='Harassment');
const before=JSON.stringify(registry),report=await auditHMCHarassmentMatcher(),entry=proposedHarassmentEntry(original),proposed=hypotheticalHarassmentRegistry(registry,entry);

test('hypothetical full-registry audit covers all 125 source occurrences without narrowing 38 candidates',()=>{
 assert.equal(report.accepted,38);assert.equal(report.excluded,87);assert.equal(report.occurrences,125);
 assert.equal(report.paragraphs.reduce((n,p)=>n+p.ranges.length,0),125);
 assert.deepEqual(Object.fromEntries(['27-2093.1','27-2115','27-2120'].map(s=>[s,report.paragraphs.filter(p=>p.section===s).reduce((n,p)=>n+p.matches.length,0)])),{'27-2093.1':29,'27-2115':8,'27-2120':1});
 for(const p of report.paragraphs)assert.deepEqual(p.matches.map(m=>[m.start,m.end]),p.ranges.filter(r=>r.classification==='candidate').map(r=>[r.start,r.end]));
});
test('hypothesis preserves complete original body, identity, source, aliases and production registry',()=>{
 for(const key of ['id','term','aliases','text','source','resolution','referenceText'])assert.deepEqual(entry[key],original[key]);
 assert.equal(entry.text.length,11330);assert.equal(entry.text.split('\n\n').length,45);
 assert.equal(createHash('sha256').update(entry.text).digest('hex'),report.bodySHA256);
 assert.equal(JSON.stringify(registry),before);
 assert.equal(original.applicability,'review-required');
 assert.throws(()=>hypotheticalHarassmentRegistry({...registry,books:[]},entry),/exactly one/);
 assert.throws(()=>hypotheticalHarassmentRegistry({...registry,books:[...registry.books,...registry.books]},entry),/exactly one/);
});
test('mixed certification paragraphs retain ordinary uses at their exact positions',()=>{
 for(const index of [44,45,46,51,59,66]){
  const p=report.paragraphs.find(p=>p.section==='27-2093.1'&&p.paragraphIndex===index);
  assert.ok(p.ranges.some(r=>r.classification==='candidate'));
  assert.ok(p.ranges.some(r=>r.classification==='certificationCompound'));
  assert.deepEqual(matchHarassmentParagraph(proposed,entry,p).map(m=>m.start),p.ranges.filter(r=>r.classification==='candidate').map(r=>r.start));
 }
});
test('nested definitions, separate local meaning and mixed unresolved enforcement paragraph remain unlinked',()=>{
 for(const p of report.paragraphs.filter(p=>p.section==='27-2093'||p.section==='27-2004'||(p.section==='27-2093.1'&&p.paragraphIndex<=22)||(p.section==='27-2115'&&p.paragraphIndex===67)))assert.equal(matchHarassmentParagraph(proposed,entry,p).length,0);
 const unguarded={...entry,excludedOccurrences:[]},unprotected=hypotheticalHarassmentRegistry(registry,unguarded);
 const mixed=report.paragraphs.find(p=>p.section==='27-2115'&&p.paragraphIndex===67);
 assert.equal(matchHarassmentParagraph(unprotected,unguarded,mixed).length,4,'negative control must expose all four unresolved uses');
 const header=report.paragraphs.find(p=>p.section==='27-2093.1'&&p.paragraphIndex===10);
 assert.equal(matchHarassmentParagraph(unprotected,unguarded,header).length,2,'has-the-meaning declaration requires explicit protection');
});
test('adding hypothetical entry does not suppress or alter existing competing definitions',()=>{
 for(const p of report.paragraphs){
  const context={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:String(p.chapter),sectionNumber:p.section};
  const others=r=>createDefinitionMatcher(definitionsForReader(r,context),{sectionNumber:p.section})(p.text).flatMap(m=>m.entries.filter(e=>e.id!==entry.id).map(e=>[m.start,m.end,e.id]));
  assert.deepEqual(others(proposed),others(registry),`${p.section} paragraph ${p.paragraphIndex}`);
 }
});
test('hypothesis stays out of unrelated editions, unknown sections and local section 27-2093',()=>{
 for(const context of [
  {bundle:'2014-construction-codes',codeSectionID:5,chapterNumber:'4',sectionNumber:'27-2093.1'},
  {bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:'4',sectionNumber:'27-2093'},
  {bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:'4',sectionNumber:''},
  {bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:'5',sectionNumber:'27-2109.2'}
 ])assert.ok(!definitionsForReader(proposed,context).some(e=>e.id===entry.id));
});
