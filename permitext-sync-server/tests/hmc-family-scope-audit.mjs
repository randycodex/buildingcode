import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHMCFamily,familyCandidateSections} from '../scripts/audit-hmc-family-applicability.mjs';
import {definitionAppliesToSection} from '../public/definition-matcher.js';
const report=await auditHMCFamily();
test('Family inventory covers singular and plural actual-source ranges with full-registry agreement',()=>{
 assert.equal(report.total,84);assert.equal(report.plural,14);assert.equal(report.prospectiveMatches,8);
 assert.deepEqual(report.counts,{definition:25,sectionQualified:10,otherDeclaration:8,familyMember:5,dwellingCompound:21,householdCandidate:8,kinship:7});
 const positives=report.paragraphs.flatMap(p=>p.ranges.filter(r=>r.classification==='householdCandidate').map(r=>({section:p.section,text:r.text})));
 assert.deepEqual(positives.map(p=>p.section),['27-2076','27-2076','27-2078','27-2078','27-2083','27-2085','27-2086','27-2089']);
 assert.equal(positives.at(-1).text,'families');
 assert.ok(['review-required','definition-chapter'].includes(report.original.applicability));assert.deepEqual(report.original.aliases,report.original.applicability==='review-required'?[]:['families']);
 assert.equal(report.proposal.text,report.original.text);assert.deepEqual(report.proposal.source,report.original.source);
});
test('Family exact positive scopes do not leak into descendants, missing identity, or definition prose',()=>{
 for(const section of familyCandidateSections){assert.equal(definitionAppliesToSection(report.proposal,section),true);assert.equal(definitionAppliesToSection(report.proposal,section+'.1'),false);}
 for(const section of ['', '27-2004','27-2087','27-2097','27-2093.1'])assert.equal(definitionAppliesToSection(report.proposal,section),false);
 assert.deepEqual(report.proposal.applicableSections,[]);
 for(const p of report.paragraphs.filter(p=>['27-2004','27-2087','27-2097','27-2093.1'].includes(p.section)))assert.deepEqual(p.prospectiveRanges,[]);
});
test('Family audit rejects source drift before proposing any link',async()=>{
 for(const chapter of ['1','2','3','4','5'])await assert.rejects(auditHMCFamily({sources:{[chapter]:'changed'}}),/source changed/);
});
test('Family audit rejects altered body and source identity',async()=>{
 const {readFile}=await import('node:fs/promises');const original=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 for(const mutation of [e=>{e.text+=' changed';},e=>{e.source.bundle='2014-construction-codes';},e=>{e.aliases=['invented'];}]){
  const registry=structuredClone(original);const entry=registry.books.flatMap(b=>b.entries).find(e=>e.id===report.original.id);mutation(entry);
  await assert.rejects(auditHMCFamily({registry}),/original source identity or body changed|metadata changed|scope changed/);
 }
});
