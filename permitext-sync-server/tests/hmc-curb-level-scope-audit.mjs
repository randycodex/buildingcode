import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditHMCCurbLevel,curbLevelID} from '../scripts/audit-hmc-curb-level-applicability.mjs';
const report=await auditHMCCurbLevel();
test('Curb level classifies every singular/plural range across all five hash-bound HMC chapters',()=>{
 assert.equal(Object.keys(report.sourceHashes).length,5);
 assert.equal(report.total,11);assert.equal(report.plural,0);
 assert.deepEqual(report.counts,{definition:7,localDirectFront:2,localFrontingStreet:2});
 assert.deepEqual(report.applicationSections,['27-2083','27-2085']);
 assert.equal(report.liveMatches,0);
 const applications=report.paragraphs.filter(p=>p.section!=='27-2004');
 assert.deepEqual(applications.map(p=>[p.section,p.paragraphIndex,p.ranges[0].classification]),[['27-2083',2,'localDirectFront'],['27-2083',4,'localFrontingStreet'],['27-2085',2,'localDirectFront'],['27-2085',4,'localFrontingStreet']]);
 for(const p of report.paragraphs){assert.ok(p.anchor);assert.deepEqual(p.liveRanges,[]);for(const r of p.ranges)assert.equal(p.paragraph.slice(r.start,r.end),r.text);}
});
test('Original conditional full definition is retained with no fabricated alias or activation',()=>{
 assert.equal(report.original.id,curbLevelID);assert.equal(report.original.applicability,'review-required');assert.deepEqual(report.original.aliases,[]);
 assert.ok(report.original.text.startsWith('Except as otherwise provided,'));
 assert.ok(report.original.text.endsWith('unless the city engineer shall establish such curb level or its equivalent.'));
 assert.equal(report.bodySHA256,'3695949e96b45a0ad6a1e0f0ae884c5229d34d621e47f11c30fb56eaac735c4e');
});
test('Any bundled chapter drift invalidates this completed scope review',async()=>{
 for(const chapter of ['1','2','3','4','5'])await assert.rejects(auditHMCCurbLevel({sources:{[chapter]:'changed'}}),/source changed/);
});
test('Review rejects changed definition wording, identity, aliases or activation',async()=>{
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 for(const mutation of [e=>{e.text=e.text.replace('Except as otherwise provided, ','');},e=>{e.source.bundle='2014-construction-codes';},e=>{e.aliases=['curb levels'];},e=>{e.applicability='definition-chapter';},e=>{e.applicableExactSections=['27-2083'];}]){
  const changed=structuredClone(registry);mutation(changed.books.flatMap(b=>b.entries).find(e=>e.id===curbLevelID));
  await assert.rejects(auditHMCCurbLevel({registry:changed}),/source identity or body changed|withheld metadata changed/);
 }
});
