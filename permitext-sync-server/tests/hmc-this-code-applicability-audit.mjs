import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHMCThisCode} from '../scripts/audit-hmc-this-code-applicability.mjs';
const report=await auditHMCThisCode();
test('This code complete corpus proposal excludes external referrals and defining prose',()=>{
 assert.deepEqual(report.counts,{definition:6,external:7,inlineDefinition:2,candidate:89});assert.equal(report.matches,89);assert.equal(report.original.applicability,'review-required');assert.equal(report.paragraphs.length,84);
});
test('mixed source section preserves HMC applications alongside external referral exclusion',()=>{
 const paragraphs=report.paragraphs.filter(p=>p.section==='27-2056.9');assert.deepEqual(paragraphs.flatMap(p=>p.ranges.map(r=>r.classification)),['candidate','external','candidate']);
 assert.ok(paragraphs[1].text.includes('section 17-179 of this code'));assert.ok(paragraphs[2].text.includes('section 27-2115 of this code'));
});
