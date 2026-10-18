import assert from 'node:assert/strict';
import { createResearchCorpusRegistry } from '../research-corpus-registry.mjs';
import { projectFactProjection } from '../project-fact-projection.mjs';
import { researchEvidenceRetrievalQuery, assembleResearchEvidence } from '../research-evidence-assembly.mjs';
import { nominateZoningDistrictScope } from '../research-zoning-district-scope.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { zoningSectionCatalog, zoningSection } from '../zoning-content.mjs';
import { resolveResearchAssemblySection } from '../app.mjs';

globalThis.fetch = () => { throw Error('Special-district contract must not call a provider or network.'); };
const corpus = createResearchCorpusRegistry({ zoningResearchEligibility: true }).find(c => c.id === 'nyc-zoning-resolution');
const wanted = ['122-02', '122-10', '81-02', '81-62'];
const catalog = (await zoningSectionCatalog()).filter(s => wanted.includes(s.sectionNumber))
  .map(s => ({ ...s, corpusID: corpus.id, codeVersion: corpus.codeVersion, codeEdition: corpus.codeEdition, jurisdiction: corpus.jurisdiction }));
assert.equal(catalog.length, 4);
const projectFacts = projectFactProjection({ structuredFacts: [
  { key: 'residential-units', label: 'Residential Units', value: '37', status: 'sourced' },
  { key: 'building-class', label: 'Building Class', value: 'C1', status: 'sourced' },
  { key: 'tax-lot-area', label: 'Tax Lot Area', value: '5640 sq ft', status: 'sourced' },
  { key: 'lot-width', label: 'Lot Width', value: '47 feet', status: 'sourced' },
  { key: 'zoning-districts', label: 'Zoning District(s)', value: 'R8', status: 'sourced' },
  { key: 'special-purpose-district', label: 'Special Purpose District(s)', value: 'C — Special Grand Concourse Preservation District', status: 'sourced' },
  { key: 'special-purpose-subdistrict', label: 'Special Purpose Subdistrict / Subarea',
    value: 'Special Grand Concourse Preservation District — Limited Commercial Area; includes partial tax-lot intersections; verify boundaries', status: 'sourced' }
] }).researchFacts;
const snapshot = structuredClone(projectFacts);
const index = await buildResearchPassageIndex(catalog, s => zoningSection(s.id));
for (const question of ['how do you determine the use group for this site?', 'for this specific project, which use groups apply to it?']) {
  const query = researchEvidenceRetrievalQuery({ question, projectFacts });
  assert.match(query.semanticQuery, /R8/);
  assert.match(query.semanticQuery, /Special Grand Concourse Preservation District/);
  assert.match(query.retrievalQuery, /partial tax-lot intersections; verify boundaries/);
  assert.equal(query.sourceQuery, question, 'A mapped district is search context, not a fabricated user citation.');
  const nominations = nominateZoningDistrictScope({ question, scopeText: query.retrievalQuery, catalog });
  assert.deepEqual(nominations.map(x => x.section.sectionNumber), ['122-02', '122-10']);
  const discover = args => discoverRelevantEvidence({ ...args, catalog, invertedIndex: new Map(), passageIndex: index,
    readSectionBody: s => zoningSection(s.id) });
  const evidence = await assembleResearchEvidence({ question, projectFacts, previousMessages: [], pinnedEvidence: [], discover,
    resolveSection: request => resolveResearchAssemblySection(request, catalog, s => zoningSection(s.id ?? s.sectionID)) });
  for (const number of ['122-02', '122-10']) {
    const source = evidence.sources.find(s => s.codePrefix === 'ZR' && s.sectionNumber === number);
    assert(source, `${question}: ${number} must reach the writer, not only the candidate pool.`);
    const body = await zoningSection(catalog.find(s => s.sectionNumber === number).id);
    for (const block of body.blocks.filter(b => b.plainText?.trim())) {
      assert(source.text.replace(/\s+/g, ' ').includes(block.plainText.replace(/\s+/g, ' ').trim()), 'Preserve every scope/use paragraph and qualification.');
    }
    assert.equal(source.truncated, false);
    assert.equal(source.evidencePriority.claimCoverageRequired, false, 'Mapped scope nominates review; it does not decide legal applicability.');
  }
}
assert.deepEqual(projectFacts, snapshot);
const nominate = (scopeText, extra = {}) => nominateZoningDistrictScope({ question: 'Which use groups apply?', scopeText, catalog, ...extra });
assert.deepEqual(nominate('Special Midtown District').map(x => x.section.sectionNumber), ['81-02', '81-62'], 'District lookup is catalog-driven, not a Grand Concourse patch.');
assert.equal(nominate('R8; no mapped special purpose district').length, 0);
assert.equal(nominate('The property is not in the Special Grand Concourse Preservation District.').length, 0);
assert.equal(nominate('Special Grand Concourse Preservation District', { restricted: true }).length, 0);
assert.equal(nominate('Special Grand Concourse Preservation District', { catalog: catalog.map(s => ({ ...s, codeEdition: '2014' })) }).length, 0);
const correction = researchEvidenceRetrievalQuery({ question: 'Correction: this is a different site in R6, not in a special district. Which use groups apply?', projectFacts });
assert.doesNotMatch(correction.retrievalQuery, /Grand Concourse/);
assert.equal(nominate(correction.retrievalQuery).length, 0);
console.log('Special-district retrieval: real catalog general/use rules reach canonical assembly; complete conditions, partial boundaries, alternate districts, negation, corrections, edition and selected-evidence boundaries preserved; zero provider calls.');
