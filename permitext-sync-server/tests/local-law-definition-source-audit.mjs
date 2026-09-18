import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditLocalLawDefinitionSources} from '../scripts/audit-local-law-definition-sources.mjs';
const report=await auditLocalLawDefinitionSources();
test('Local Law inventory retains exact file, law and paragraph identities across all 39 annual files',async()=>{
 assert.equal(report.chapters.length,39);
 assert.equal(report.laws.length,32);
 assert.equal(report.candidateParagraphs,89);
 assert.equal(report.laws.reduce((n,l)=>n+l.explicitQuotedLabels.length,0),51);
 for(const chapter of report.chapters){
  const html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/'+chapter.file,import.meta.url),'utf8');
  for(const law of report.laws.filter(l=>l.chapterID===chapter.chapterID))for(const p of law.paragraphs){
   assert.ok(html.slice(p.sourceStart,p.sourceEnd).startsWith('<p'));
   assert.match(p.paragraphSHA256,/^[a-f0-9]{64}$/);
  }
 }
});
test('same-year Certification form definitions stay separated with different full wording',()=>{
 const earlier=report.laws.find(l=>l.law==='L.L. 2021/012');
 const later=report.laws.find(l=>l.law==='L.L. 2021/137');
 assert.equal(earlier.chapterID,later.chapterID);
 assert.notEqual(earlier.anchor,later.anchor);
 const body=l=>l.paragraphs.find(p=>p.explicitQuotedLabel==='certification form');
 assert.notEqual(body(earlier).text,body(later).text);
 assert.match(body(earlier).text,/have been corrected/);
 assert.match(body(later).text,/conditions identified, if any/);
 assert.equal(body(earlier).lawSection,'1');
});
test('inventory preserves continuation and expiration context beyond lexical candidate paragraphs',()=>{
 const area=report.laws.find(l=>l.law==='L.L. 2013/031');
 assert.ok(area.paragraphs.some(p=>p.text.startsWith('a.The area within Hurricane Evacuation Zones')));
 assert.ok(area.paragraphs.some(p=>p.text.startsWith('b.The area within any Business Recovery Zone')));
 assert.ok(area.paragraphs.some(p=>p.text.includes('December 31, 2013')&&p.text.includes('deemed repealed')));
 const program=report.laws.find(l=>l.law==='L.L. 2019/049');
 assert.ok(program.paragraphs.some(p=>p.text.startsWith('(xix)then east along Belmont Avenue')));
 assert.ok(program.explicitQuotedLabels.some(p=>p.label==='1968 building code'));
 // The reference is recorded as wording, not resolved to an invented body.
 assert.match(program.paragraphs.find(p=>p.explicitQuotedLabel==='1968 building code').text,/has the same definition/);
});
test('recent scope declarations carry their local-law section, not annual chapter-wide scope',()=>{
 const law=report.laws.find(l=>l.law==='L.L. 2026/060');
 assert.equal(law.explicitQuotedLabels.length,3);
 assert.ok(law.explicitQuotedLabels.every(p=>p.lawSection==='2'));
 assert.ok(law.paragraphs.some(p=>p.text.includes('For purposes of this section')));
 const waste=report.laws.find(l=>l.law==='L.L. 2025/036');
 assert.equal(waste.explicitQuotedLabels.length,3);
 assert.ok(waste.paragraphs.some(p=>p.text.includes('For purposes of this local law')));
});
