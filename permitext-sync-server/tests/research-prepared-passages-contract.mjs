import assert from 'node:assert/strict';
import { buildResearchPassageIndex, searchResearchPassages } from '../research-passage-index.mjs';
import { encodePreparedPassages, decodePreparedPassages } from '../research-prepared-passages.mjs';
const corpus = { id: 'nyc-2022-construction-codes', codeVersion: 'fixture-v1' };
const catalog = [{ id: '1', sectionNumber: '310.4', title: 'Residential Group R-2', codePrefix: 'BC', corpusID: corpus.id, codeVersion: corpus.codeVersion, codeEdition: '2022' }];
const index = await buildResearchPassageIndex(catalog, async () => ({ blocks: [{ plainText: 'Residential Group R-2 includes apartment houses.' }] }));
const { bytes, manifest } = await encodePreparedPassages(corpus, catalog, index);
const decoded = await decodePreparedPassages(corpus, catalog, bytes, manifest);
assert.deepEqual(decoded, index);
assert.deepEqual(searchResearchPassages(decoded, 'apartment houses'), searchResearchPassages(index, 'apartment houses'));
for (const change of [ { corpusID: 'nyc-2022-fire-code' }, { codeVersion: 'other-edition' }, { indexVersion: 'stale' },
  { publicAssetRevision: 'stale' }, { buildCommit: 'old-release' }, { implementationSHA256: 'stale' }, { catalogSHA256: 'stale' }, { sha256: 'corrupt' }, { fingerprint: 'wrong' }, { passageCount: 0 } ]) {
  await assert.rejects(decodePreparedPassages(corpus, catalog, bytes, { ...manifest, ...change }));
}
const corrupt = Buffer.from(bytes); corrupt[100] ^= 1;
await assert.rejects(decodePreparedPassages(corpus, catalog, corrupt, manifest));
await assert.rejects(decodePreparedPassages(corpus, [{ ...catalog[0], title: 'Changed source' }], bytes, manifest));
console.log('Prepared passage equality, ranking, edition, corruption and stale-identity controls passed');
