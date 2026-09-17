import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditHMCClassA} from '../scripts/audit-hmc-class-a-applicability.mjs';
const report = await auditHMCClassA();
const at = (section, paragraphIndex) => report.occurrences.filter(o => o.section === section && o.paragraphIndex === paragraphIndex);

test('complete source-only inventory retains the original ten-paragraph meaning and all singular/plural occurrences', () => {
 assert.equal(report.sources.length, 5);
 assert.equal(report.original.id, 'dc9d3eef2b81427fac2f');
 assert.equal(report.original.text.split('\n\n').length, 10);
 assert.equal(report.original.applicability, 'definition-chapter');
 assert.deepEqual(report.original.aliases, ['class A multiple dwellings']);
 assert.equal(report.occurrences.length, 37);
 assert.equal(report.paragraphs.length, 27);
 assert.deepEqual(report.counts, {generalDefinition:6, localDefinition:3, localMeaning:4, candidate:24});
 assert.deepEqual(Object.fromEntries([1,2,3,4,5].map(c => [c,report.occurrences.filter(o => o.chapter === c).length])), {1:6,2:29,3:1,4:0,5:1});
 const outside = report.occurrences.filter(o => o.section !== '27-2004');
 assert.equal(outside.filter(o => /dwellings$/i.test(o.text.slice(o.start,o.end))).length, 5);
 assert.equal(outside.filter(o => /dwelling$/i.test(o.text.slice(o.start,o.end))).length, 26);
 for (const o of report.occurrences) {
  assert.match(o.text.slice(o.start,o.end), /^class\s+a\s+multiple\s+dwellings?$/i);
  assert.match(o.paragraphSHA256, /^[a-f0-9]{64}$/);
  assert.ok(o.sourceStart > 0);
  assert.match(o.anchor, /^section-/);
 }
});
test('reviewed general applications cover the five actual sections without absorbing the local expansion', () => {
 const candidates = report.occurrences.filter(o => o.classification === 'candidate');
 assert.deepEqual(Object.fromEntries(['27-2033.1','27-2041.2','27-2043','27-2063','27-2140'].map(s => [s,candidates.filter(o => o.section === s).length])), {'27-2033.1':18,'27-2041.2':2,'27-2043':2,'27-2063':1,'27-2140':1});
 assert.equal(candidates.length, 24);
 assert.equal(at('27-2045',1).length, 3);
 assert.ok(at('27-2045',1).every(o => o.classification === 'localDefinition'));
 assert.match(at('27-2045',1)[0].text, /except that such term shall include garden-type maisonette dwellings constructed before April 18, 1954/);
 const local = report.occurrences.filter(o => o.classification === 'localMeaning');
 assert.deepEqual(local.map(o => o.paragraphIndex), [4,9,15,19]);
 assert.ok(local.every(o => o.section === '27-2045'));
});
test('general definition passages remain excluded and qualified SRO use does not replace the Class A category', () => {
 const definitions = report.occurrences.filter(o => o.classification === 'generalDefinition');
 assert.deepEqual(definitions.map(o => o.paragraphIndex), [20,20,23,31,38,38]);
 assert.match(at('27-2004',38)[0].text, /it remains a class A multiple dwelling/);
 assert.equal(at('27-2140',3)[0].classification, 'candidate');
 assert.match(at('27-2140',3)[0].text, /class A multiple dwelling used for single room occupancy pursuant to section two hundred forty-eight of the multiple dwelling law/);
 assert.match(report.original.text, /No more than five percent/);
 assert.match(report.original.text, /No rent or other payment/);
 assert.match(report.original.text.split('\n\n')[9], /garden-type maisonette dwelling project/);
});
for (let chapter = 1; chapter <= 5; chapter++) test('rejects changed source chapter ' + chapter, async () => {
 await assert.rejects(auditHMCClassA({read:async (url, encoding) => {
  const value = await readFile(url, encoding);
  return url.pathname.endsWith(`/${30000076 + chapter}.html`) ? value + '\n' : value;
 }}), /HMC source changed/);
});
test('rejects body truncation, identity drift, duplicate entries and unsupported alias changes', async () => {
 for (const mutation of [e => {e.text = e.text.split('\n\n')[0];}, e => {e.id = 'changed';}, (e,entries) => entries.push({...e}), e => {e.aliases = ['Class A'];}]) {
  await assert.rejects(auditHMCClassA({read:async (url, encoding) => {
   const value = await readFile(url, encoding);
   if (!url.pathname.endsWith('reader-definition-registry.json')) return value;
   const registry = JSON.parse(value), entries = registry.books.find(b => b.chapterID === 30000077).entries;
   mutation(entries.find(e => e.term === 'Class A multiple dwelling'), entries);
   return JSON.stringify(registry);
  }}), /source identity\/body changed/);
 }
});
