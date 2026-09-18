import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditHMCDwelling} from '../scripts/audit-hmc-dwelling-applicability.mjs';
const registry = JSON.parse(await readFile(new URL('../public/reader-definition-registry.json', import.meta.url), 'utf8'));
const before = JSON.stringify(registry);
const report = await auditHMCDwelling({registry});

test('full current registry inventory preserves every original and reports preliminary overlap honestly', () => {
  assert.equal(JSON.stringify(registry), before);
  assert.deepEqual(report.counts, {Dwelling: {raw:1359,eligible:318,pluralEligible:79}, 'Dwelling unit': {raw:521,eligible:407,pluralEligible:55}});
  assert.equal(report.occurrences.length,1880);
  assert.equal(report.sources.length,5);
  assert.deepEqual(report.candidateHazards,{multiple:48,private:8,converted:2,covered:31,sro:5,ancillary:1,unoccupied:2,adjective:1,importedLaw:0});
  for(const row of report.occurrences) {
    assert.equal(row.text.slice(row.start,row.end),row.matchedText);
    assert.match(row.paragraphSHA256,/^[a-f0-9]{64}$/);
    assert.ok(row.sourceEnd>row.sourceStart);
    for(const hazard of row.hazards) {
      assert.equal(row.text.slice(hazard.start,hazard.end),hazard.text);
      assert.ok(hazard.start<=row.start&&hazard.end>=row.end);
    }
  }
  for(const entry of report.originals) assert.equal(entry.applicability,'review-required');
});
test('candidate analysis uses longer entries from full registry, not the two generic entries alone',async()=>{
  const reduced=structuredClone(registry);
  for(const book of reduced.books) book.entries=book.entries.filter(entry=>report.originals.some(original=>original.id===entry.id));
  const isolated=await auditHMCDwelling({registry:reduced});
  assert.ok(isolated.counts.Dwelling.eligible>report.counts.Dwelling.eligible);
  assert.equal(isolated.counts.Dwelling.raw,report.counts.Dwelling.raw);
});
test('all source chapters reject drift before yielding an inventory',async()=>{
  for(const chapter of ['1','2','3','4','5']) await assert.rejects(auditHMCDwelling({sources:{[chapter]:'changed'}}),/source changed/);
});
test('both definitions reject identity, meaning and premature activation drift',async()=>{
  for(const original of report.originals) for(const mutate of [entry=>{entry.text+=' changed';},entry=>{entry.source.anchor='wrong';},entry=>{entry.aliases=['invented'];},entry=>{entry.applicability='definition-chapter';},entry=>{entry.excludedOccurrences=[];}]) {
    const changed=structuredClone(registry);
    mutate(changed.books.flatMap(book=>book.entries).find(entry=>entry.id===original.id));
    await assert.rejects(auditHMCDwelling({registry:changed}),/identity or meaning changed|metadata changed/);
  }
});
test('inventory retains imported compounds and mixed declaration contexts for unresolved review',()=>{
  assert.equal(report.occurrences.filter(row=>row.candidateEligible&&row.hazards.some(hazard=>hazard.kind==='ancillary')).length,1);
  assert.ok(report.occurrences.some(row=>row.section==='27-2074'&&/alteration/i.test(row.text)));
  assert.ok(report.occurrences.some(row=>row.section==='27-2030'&&/such term means/i.test(row.text)));
  assert.ok(report.occurrences.some(row=>row.section==='27-2152'&&row.candidateEligible&&/each dwelling unit/.test(row.text)));
  assert.ok(report.occurrences.filter(row=>row.section==='27-2004').every(row=>!row.candidateEligible));
});
