import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHMCAlterationScope} from '../scripts/audit-hmc-alteration-scope.mjs';
const audit=await auditHMCAlterationScope();
test('complete alteration singular/plural inventory retains source identity and retains bounded applicability',()=>{
 assert.equal(audit.original.id,'4d33bc1533510d86e707');assert.equal(audit.original.applicability,'definition-chapter');
 assert.deepEqual(audit.counts,{definition:1,localDefinition:1,externalCategory:10,permitCompound:1,ordinaryCandidate:6});
 assert.equal(audit.paragraphs.length,12);
 for(const p of audit.paragraphs)for(const r of p.ranges)assert.equal(p.text.slice(r.start,r.end),r.text);
});
test('permit compound and ordinary plural in same actual paragraph remain distinct',()=>{
 const p=audit.paragraphs.find(p=>p.section==='27-2044');assert.ok(p.text.includes('alteration permit for alterations'));
 assert.deepEqual(p.ranges.map(r=>[r.text,r.classification]),[['alteration','permitCompound'],['alterations','ordinaryCandidate']]);
});
test('local declaration and external category paragraphs are excluded from ordinary candidates',()=>{
 const p=audit.paragraphs.find(p=>p.section==='27-2074');assert.ok(p.text.includes('As used in subdivisions a and e'));assert.ok(p.text.includes('conversion without physical change'));assert.equal(p.ranges[0].classification,'localDefinition');
 const candidates=audit.paragraphs.flatMap(p=>p.ranges.filter(r=>r.classification==='ordinaryCandidate').map(()=>p.section));assert.deepEqual(candidates,['27-2044','27-2056.5','27-2056.5','27-2066','27-2077','27-2089']);
});

test('full production matcher preserves six ordinary applications and rejects reviewed negatives',()=>{assert.equal(audit.prospectiveMatches,6);});
