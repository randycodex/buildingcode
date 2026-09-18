import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTitle26DefinitionSources} from '../scripts/audit-title26-definition-sources.mjs';

test('Title 26 discovery preserves separately authored chapters with identical printed citations', async () => {
  const report = await auditTitle26DefinitionSources();
  assert.equal(report.chapterCount, 38);
  assert.equal(report.candidateCount, 41);
  assert.equal(new Set(report.chapters.map(c => c.file)).size, 38);
  for (const [section, ids] of [
    ['26-2101', [30000039,30000040]],
    ['26-3001', [30000048,30000051]],
    ['26-3701', [30000055,30000056]],
  ]) {
    const pair = report.repeatedCandidateSections.find(s => s.identity === section).members;
    assert.deepEqual(pair.map(s => s.chapterID), ids);
    assert.equal(new Set(pair.map(s => s.anchor)).size, 2);
    assert.equal(new Set(ids.map(id => report.chapters.find(c => c.chapterID === id).sourceSHA256)).size, 2);
  }
  assert.deepEqual(report.repeatedChapterNumbers.map(c => c.identity), ['13','21','37']);
});

test('Title 26 inventory retains inline declarations beyond definition headings', async () => {
  const report = await auditTitle26DefinitionSources();
  const chapter = report.chapters.find(c => c.chapterID === 30000054);
  assert.deepEqual(chapter.candidates.map(s => s.sectionNumber), ['26-3601','26-3602']);
  assert.ok(chapter.candidates[0].heading.includes('department of buildings'));
  assert.equal(report.status, 'Discovery only; no extraction, activation or semantic acceptance');
});
