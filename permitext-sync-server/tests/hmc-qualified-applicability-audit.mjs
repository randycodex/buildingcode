import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHMCQualifiedApplicability} from '../scripts/audit-hmc-qualified-applicability.mjs';
const audit=await auditHMCQualifiedApplicability();
test('qualified proposal retains complete source meanings and remains unactivated',()=>{
 assert.deepEqual(audit.counts,{Tenement:14,Dormitory:2});
 assert.deepEqual(audit.originals.map(e=>e.id).sort(),['cb82004890d12b1f78e9','bee3855926d65cc9bd1d'].sort());
 for(const original of audit.originals){assert.equal(original.applicability,'review-required');const proposed=audit.proposals.find(e=>e.id===original.id);assert.equal(proposed.text,original.text);assert.deepEqual(proposed.source,original.source);}
 const dormitory=audit.originals.find(e=>e.term==='Dormitory');
 for(const phrase of ['a.A lodging house','b.A college or school dormitory','c.A dwelling owned','d.A dwelling owned'])assert.ok(dormitory.text.includes(phrase));
 assert.ok(audit.originals.find(e=>e.term==='Tenement').text.includes('An old law tenement is a tenement existing before April twelfth, nineteen hundred one'));
});
test('actual mixed sections preserve supported old-law and bare uses while withholding qualified compounds',()=>{
 for(const p of audit.paragraphs){
  if(p.section==='27-2004')assert.equal(p.matches.length,0);
  for(const m of p.matches){assert.equal(p.text.slice(m.start,m.end),m.text);assert.ok(!/new law |fireproof /i.test(p.text.slice(Math.max(0,m.start-25),m.start)));}
 }
 const mixed=audit.paragraphs.filter(p=>p.section==='27-2066');
 assert.equal(mixed.flatMap(p=>p.matches).length,5);
 assert.equal(mixed.filter(p=>/new law/i.test(p.text)).flatMap(p=>p.matches).length,0);
 assert.equal(audit.paragraphs.filter(p=>p.section==='27-2074').flatMap(p=>p.matches).length,2);
 assert.equal(audit.paragraphs.find(p=>p.section==='27-2089').matches.length,0);
});
test('dormitory proposal accepts lodging sleeping-space context and keeps institutional references plain',()=>{
 for(const section of ['27-2041','27-2093.1'])assert.equal(audit.paragraphs.filter(p=>p.section===section).flatMap(p=>p.matches).length,0);
 for(const section of ['27-2074','27-2075'])assert.equal(audit.paragraphs.filter(p=>p.section===section).flatMap(p=>p.matches).filter(m=>m.terms.includes('Dormitory')).length,1);
});
