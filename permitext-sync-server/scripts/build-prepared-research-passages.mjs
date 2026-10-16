import assert from 'node:assert/strict';
import { preparedResearchSemanticCorpusIDs } from '../research-semantic-artifact.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { encodePreparedPassages, decodePreparedPassages, preparedPassageDirectory } from '../research-prepared-passages.mjs';
process.env.PERMITEXT_RESEARCH_BUILD_PASSAGES = '1';
process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = '1';
process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = '1';
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = '0';
globalThis.fetch = async () => { throw Error('Passage preparation is offline'); };
const { researchCorpusPlanForTurn, researchCorpusResources } = await import('../app.mjs');
const plan = await researchCorpusPlanForTurn({ question: 'What requirements apply to an ordinary project?', messages: [], projectFacts: [], pinnedEvidence: [] });
assert.deepEqual(plan.selected.map(corpus => corpus.id).sort(), [...preparedResearchSemanticCorpusIDs].sort());
assert(plan.selected.every(corpus => corpus.automaticResearchEligible && !corpus.optInRequired));
await mkdir(preparedPassageDirectory, { recursive: true });
let bytes = 0, passages = 0;
for (const corpus of plan.selected) {
  const resource = await researchCorpusResources({ ...plan, selected: [corpus] });
  const artifact = await encodePreparedPassages(corpus, resource.catalog, resource.passageIndex);
  // Exact whole-index equality, including all posting lists and source text.
  assert.deepEqual(await decodePreparedPassages(corpus, resource.catalog, artifact.bytes, artifact.manifest), resource.passageIndex);
  await writeFile(new URL(`${corpus.id}.bin.gz`, preparedPassageDirectory), artifact.bytes);
  await writeFile(new URL(`${corpus.id}.json`, preparedPassageDirectory), JSON.stringify(artifact.manifest));
  bytes += artifact.bytes.length; passages += resource.passageIndex.passageCount;
}
console.log(JSON.stringify({ preparedPassageCorpora: plan.selected.length, bytes, passages, exactIndexEquality: true, providerRequests: 0 }));
