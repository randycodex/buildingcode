// Offline matched baseline/candidate: identical questions and full evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const questions = ['how do you determine the use group for this site?',
  'for this specific project, which use groups apply to it?',
  'Under the 2022 NYC Building Code, how should apartments and a residents-only community room be classified?'];
if (process.argv.includes('--child')) {
  Object.assign(process.env, { NODE_ENV: 'test', PERMITEXT_RESEARCH_PASSAGE_SEARCH: '1',
    PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: '1', PERMITEXT_RESEARCH_SEMANTIC_SEARCH: '0' });
  globalThis.fetch = async () => { throw Error('Offline benchmark cannot make network requests'); };
  const { researchCorpusPlanForTurn, researchCorpusResources, assembledResearchEvidenceForTurn } = await import('../app.mjs');
  const plan = await researchCorpusPlanForTurn({ question: questions[0], messages: [], projectFacts: [], pinnedEvidence: [] });
  const started = performance.now();
  const resources = await researchCorpusResources(plan);
  const loadingMilliseconds = Math.round(performance.now() - started);
  const results = [];
  for (const question of questions) {
    const timings = [];
    const evidence = await assembledResearchEvidenceForTurn({ question, messages: [], projectFacts: [], pinnedEvidence: [],
      corpusPlan: plan, onTiming: row => timings.push(row) });
    // Exclude elapsed time and retrieval timestamp; all authority/passage content counts.
    const json = JSON.stringify(evidence, (key, value) => ['elapsedMS', 'retrievedAt'].includes(key) ? undefined : value);
    results.push({ question, sha256: createHash('sha256').update(json).digest('hex'), sourceCount: evidence.sources.length, timings });
  }
  console.log(JSON.stringify({ loadingMilliseconds, passages: resources.passageIndex.passageCount, results }));
} else {
  const run = fresh => JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--child'], {
    encoding: 'utf8', maxBuffer: 1024 * 1024, env: { ...process.env, PERMITEXT_RESEARCH_BUILD_PASSAGES: fresh ? '1' : '0' }
  }));
  const baseline = run(true), prepared = run(false);
  assert.equal(prepared.passages, baseline.passages);
  assert.deepEqual(prepared.results.map(row => row.sha256), baseline.results.map(row => row.sha256),
    'Prepared retrieval must preserve the entire canonical evidence packet');
  console.log(JSON.stringify({ exactEvidenceEquality: true, networkRequests: 0, baseline, prepared }, null, 2));
}
