import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditHMCHarassment} from '../scripts/audit-hmc-harassment-applicability.mjs';
const report = await auditHMCHarassment();
const at = (section, paragraphIndex) => report.occurrences.filter(o => o.section === section && o.paragraphIndex === paragraphIndex);

test('complete guarded inventory preserves the entire original meaning and records 38 candidates, not links', () => {
 assert.equal(report.sources.length, 5);
 assert.equal(report.original.id, 'e7eabb36ef1f70ffd848');
 assert.equal(report.original.text.length, 11330);
 assert.equal(report.original.text.split('\n\n').length, 45);
 assert.equal(report.original.applicability, 'definition-chapter');
 assert.equal(report.occurrences.length, 125);
 assert.equal(report.paragraphs.length, 62);
 assert.deepEqual(Object.fromEntries([1,2,3,4,5].map(c => [c,report.occurrences.filter(o => o.chapter === c).length])), {1:1,2:0,3:0,4:111,5:13});
 const candidates = report.occurrences.filter(o => o.classification === 'candidate');
 assert.deepEqual(Object.fromEntries(['27-2093.1','27-2115','27-2120'].map(s => [s,candidates.filter(o => o.section === s).length])), {'27-2093.1':29,'27-2115':8,'27-2120':1});
 for (const occurrence of report.occurrences) {
  assert.match(occurrence.text.slice(occurrence.start, occurrence.end), /^harassment$/i);
  assert.match(occurrence.paragraphSHA256, /^[a-f0-9]{64}$/);
  assert.ok(occurrence.sourceStart > 0);
  assert.match(occurrence.anchor, /^section-/);
 }
});
test('exact local section stays separate from 2093.1 and all nested definitions take precedence over compounds', () => {
 const local = report.occurrences.filter(o => o.section === '27-2093');
 assert.equal(local.filter(o => o.classification === 'localDefinition').length, 1);
 assert.equal(local.filter(o => o.classification === 'localMeaning').length, 33);
 const nested = report.occurrences.filter(o => o.section === '27-2093.1' && o.classification === 'nestedDefinition');
 assert.deepEqual([...new Set(nested.map(o => o.paragraphIndex))], [1,2,10,14,16,22]);
 assert.equal(nested.length, 11);
 assert.equal(at('27-2093.1',2).length,3);
 assert.ok(at('27-2093.1',2).every(o => o.classification === 'nestedDefinition'));
});
test('mixed paragraphs distinguish ordinary conduct from certification and named task force', () => {
 assert.deepEqual(at('27-2093.1',27).map(o => o.classification), ['candidate','candidate','taskForceCompound']);
 assert.deepEqual(at('27-2093.1',44).map(o => o.classification), ['candidate','certificationCompound']);
 assert.deepEqual(at('27-2093.1',51).map(o => o.classification), ['certificationCompound','certificationCompound','candidate','certificationCompound']);
 assert.equal(at('27-2093.1',39)[0].classification, 'certificationCompound');
 assert.match(at('27-2093.1',39)[0].text, /certificate of no harassment/);
});
test('only reviewed enforcement contexts qualify and mixed/local recorded determinations remain unresolved', () => {
 const enforcement = report.occurrences.filter(o => o.section === '27-2115' && o.classification === 'candidate');
 assert.deepEqual(enforcement.map(o => o.paragraphIndex), [31,32,32,33,63,63,63,64]);
 assert.equal(at('27-2115',67).length, 4);
 assert.ok(at('27-2115',67).every(o => o.classification === 'unresolvedMixedScope'));
 assert.match(at('27-2115',67)[0].text, /27-2093 or section 27-2093\.1/);
 assert.equal(at('27-2120',1)[0].classification, 'candidate');
 assert.match(at('27-2120',1)[0].text, /subdivision d of section 27-2005/);
 assert.equal(report.occurrences.find(o => o.section === '27-2109.2').classification, 'unresolvedRecordedFinding');
 assert.equal(report.occurrences.find(o => o.section === '27-2109.52').classification, 'certificationCompound');
});
for (let chapter = 1; chapter <= 5; chapter++) test('rejects changed source chapter ' + chapter, async () => {
 await assert.rejects(auditHMCHarassment({read:async (url, encoding) => {
  const value = await readFile(url, encoding);
  return url.pathname.endsWith(`/${30000076 + chapter}.html`) ? value + '\n' : value;
 }}), /HMC source changed/);
});
test('rejects shortened original body and duplicated identity rather than silently accepting source drift', async () => {
 for (const mutation of [entries => {entries.find(e => e.term === 'Harassment').text = 'Harassment means harassment.';}, entries => {entries.find(e => e.term === 'Harassment').id = 'changed';}, entries => {entries.push({...entries.find(e => e.term === 'Harassment')});}]) {
  await assert.rejects(auditHMCHarassment({read:async (url, encoding) => {
   const value = await readFile(url, encoding);
   if (!url.pathname.endsWith('reader-definition-registry.json')) return value;
   const registry = JSON.parse(value); mutation(registry.books.find(b => b.chapterID === 30000077).entries); return JSON.stringify(registry);
  }}), /source identity\/body changed/);
 }
});
