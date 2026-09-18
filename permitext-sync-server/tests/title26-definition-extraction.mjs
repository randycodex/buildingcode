import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTitle26DefinitionExtraction} from '../scripts/audit-title26-definition-extraction.mjs';
const report = await auditTitle26DefinitionExtraction();
const chapter = id => report.chapters.find(c => c.chapterID === id);
const term = (id, name, section) => chapter(id).sections.filter(s=> !section || s.sectionNumber===section).flatMap(s=>s.candidates).find(c=>c.term===name);
test('all 38 physical files remain separate and retain source hashes and full audit paragraphs', () => {
  assert.equal(report.chapterCount,38); assert.equal(report.sectionCount,41);
  assert.equal(new Set(report.chapters.map(c=>c.file)).size,38);
  for(const c of report.chapters){assert.match(c.sourceSHA256,/^[a-f0-9]{64}$/);for(const s of c.sections){assert.ok(s.anchor);assert.match(s.sourceSectionSHA256,/^[a-f0-9]{64}$/);assert.ok(s.paragraphs.length);}}
  assert.equal(report.candidateCount,292);
});
test('duplicate chapter 21 and 37 meanings never collapse to printed citation identity',()=>{
  assert.ok(term(30000039,'Affordable housing'));assert.ok(term(30000040,'Booking service'));
  assert.equal(term(30000039,'Booking service'),undefined);
  assert.ok(term(30000055,'Converted homeownership unit'));assert.ok(term(30000056,'Cooperative corporation'));
  assert.notEqual(chapter(30000055).sourceSHA256,chapter(30000056).sourceSHA256);
});
test('booking service preserves both numbered continuations and final exclusion',()=>{
  const candidate=term(30000040,'Booking service');
  assert.equal(candidate.sourceParagraphs.length,4);
  assert.match(candidate.sourceText,/1\.Provides/);assert.match(candidate.sourceText,/2\.Charges/);
  assert.match(candidate.sourceText,/shall not be construed to include a platform that solely lists/);
  assert.ok(candidate.caveats.includes('qualifications retained'));
});
test('inline chapter 36 scope retains DOB meaning and isolates later operative requirements',()=>{
  const entry=term(30000054,'department','26-3601');
  assert.match(entry.sourceText,/For purposes of this section/);
  assert.match(entry.sourceText,/department of buildings/);
  assert.doesNotMatch(entry.sourceText,/shall provide information/);
  assert.ok(entry.excludedBoundaryParagraphs.some(p=>p.startsWith('b.The department')));
  assert.equal(entry.parserStatus,'additional parser or reviewed source adapter required');
  const flood=term(30000054,'10-year rainfall flood risk area','26-3602');
  assert.ok(flood.caveats.includes('cross-reference requires resolution'));
  assert.ok(chapter(30000054).sections[1].paragraphs.some(p=>p.includes('1/1/2028')));
});
test('unsupported declarations and list referrals remain visible rather than treated as full extraction',()=>{
  for(const [id,section] of [[30000022,'26-505'],[30000051,'26-3013']]){
    const source=chapter(id).sections.find(s=>s.sectionNumber===section);
    assert.equal(source.candidates.length,0);assert.ok(source.unclassifiedParagraphs.length);
  }
  const referral=chapter(30000035).sections[0];
  assert.ok(referral.unclassifiedParagraphs.some(p=>p.value.includes('administering agent;')));
  assert.ok(report.parserLabelMatches < report.candidateCount);
});

test('numbered and shall-have referrals are retained with their original target wording',()=>{
  const unit=term(30000023,'Dwelling unit');
  assert.match(unit.sourceText,/subdivision thirteen of section 27-2004/);
  assert.ok(term(30000023,'Owner').excludedBoundaryParagraphs.some(p=>p.includes('government employee')));
  assert.match(term(30000040,'Class B multiple dwelling').sourceText,/shall have the meaning ascribed/);
});
