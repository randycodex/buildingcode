import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { allSectionCatalogByID, researchBodyForCatalogSection,
  assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from '../app.mjs';
import { createResearchCorpusRegistry } from '../research-corpus-registry.mjs';
import { researchEmbeddedDefinitionCarrier, targetedDefinitionExcerpt,
  researchBoundDefinitionPublishedReference } from '../research-definition-excerpts.mjs';
import { constructionContentRoot, constructionChapterHTMLSource,
  constructionHTMLBodyForSection } from '../construction-html-content.mjs';
import { enrichResearchConstructionDefinitionBody } from '../research-construction-definition-content.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('No providers in canonical-body enrichment contract.'); };
process.env.NODE_ENV = 'test';
delete process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH;
delete process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH;
const hash = value => createHash('sha256').update(value).digest('hex');
const corpus = createResearchCorpusRegistry().find(c => c.id === 'nyc-2022-construction-codes');

// A different construction family and invented terms exercise source binding,
// not a gas/appliance-specific legal answer or a section-number lookup table.
function fixture({ heading = 'Section PC 202: General Definitions', oneEntry = false } = {}) {
  const section = { id: 'canonical-fixture', codePrefix: 'PC', sectionNumber: '201.4',
    chapterNumber: '2', chapterID: 'fixture-chapter', title: 'Undefined terms',
    corpusID: corpus.id, codeVersion: corpus.codeVersion,
    codeEdition: corpus.codeEdition, jurisdiction: corpus.jurisdiction };
  const opening = 'Terms not defined here retain their ordinary accepted meanings.';
  const entries = ['ALPHA DEVICE. A device supplying the first fixture function.',
    ...oneEntry ? [] : ['BETA DEVICE. A device supplying the second fixture function.']];
  const html = `<p>${opening}</p><h2>${heading}</h2>` +
    entries.map(entry => `<div class="Normal-Level">${entry}</div>`).join('');
  const plainText = [opening, heading, ...entries].join('\n');
  const rawPrefix = '<html><body>';
  const officialSource = { path: join(constructionContentRoot, 'fixture/Chapter 2.html'),
    html: rawPrefix + html + '</body></html>', cacheKey: 'PC:2' };
  const prepared = { schemaVersion: 2, sectionID: section.id, chapterID: section.chapterID,
    chapterNumber: section.chapterNumber, sectionNumber: section.sectionNumber, title: section.title,
    blocks: [{ id: 'prepared-opening', kind: 'html', html: `<p>${opening}</p>`, plainText: opening }] };
  const official = { ...prepared, sourceHTMLPath: 'fixture/Chapter 2.html',
    blocks: [{ id: 'official-fixture', kind: 'html', html, plainText }],
    officialSourceBinding: {
      version: 'current-construction-html-body-v1', corpusID: corpus.id,
      codeVersion: corpus.codeVersion, codeEdition: corpus.codeEdition,
      jurisdiction: corpus.jurisdiction, codePrefix: section.codePrefix,
      sectionID: section.id, sectionNumber: section.sectionNumber,
      sourceChapterNumber: section.chapterNumber, sourceHTMLPath: 'fixture/Chapter 2.html',
      sourceHTMLHash: hash(officialSource.html),
      sourceHTMLRange: { start: rawPrefix.length, end: rawPrefix.length + html.length },
      bodyHTMLHash: hash(html), bodyTextHash: hash(plainText)
    } };
  return { section, prepared, official, officialSource };
}
const enrich = value => enrichResearchConstructionDefinitionBody(value.prepared,
  value.official, value.section, value.officialSource);
const valid = fixture();
const frozen = structuredClone(valid);
assert.equal(enrich(valid), valid.official);
assert.deepEqual(valid, frozen, 'Enrichment never mutates prepared, official or canonical records.');
const completed = { ...valid, prepared: structuredClone(valid.official) };
assert.equal(enrich(completed), completed.prepared, 'An already complete prepared source remains the same object.');
const partial = fixture();
partial.prepared.blocks[0].plainText += '\nSection PC 202: General Definitions\nALPHA DEVICE.';
assert.equal(enrich(partial), partial.official, 'A verified incomplete dictionary prefix can recover the full same-source body.');

for (const [reason, change] of [
  ['wrong canonical identity', v => { v.section.id = 'other-canonical'; }],
  ['wrong official section', v => { v.official.sectionNumber = '203'; }],
  ['wrong prepared section', v => { v.prepared.sectionNumber = '203'; }],
  ['wrong prepared title', v => { v.prepared.title = 'Another rule'; }],
  ['wrong chapter', v => { v.official.officialSourceBinding.sourceChapterNumber = '3'; }],
  ['wrong family', v => { v.section.codePrefix = 'MC'; }],
  ['wrong corpus', v => { v.section.corpusID = 'unregistered-corpus'; }],
  ['wrong canonical edition', v => { v.section.codeEdition = '2014 New York City Construction Codes'; }],
  ['wrong prepared edition', v => { v.prepared.codeEdition = '2014'; }],
  ['wrong official version', v => { v.official.officialSourceBinding.codeVersion = 'old-version'; }],
  ['conflicting jurisdiction', v => { v.section.jurisdiction = 'Elsewhere'; }],
  ['stale body hash', v => { v.official.blocks[0].plainText += ' Changed body.'; }],
  ['stale chapter HTML', v => { v.officialSource.html += ' Changed source.'; }],
  ['wrong source path', v => { v.officialSource.path += '.other'; }],
  ['wrong source cache binding', v => { v.officialSource.cacheKey = 'MC:2'; }],
  ['wrong source range', v => { v.official.officialSourceBinding.sourceHTMLRange.start++; }],
  ['missing binding', v => { delete v.official.officialSourceBinding; }],
  ['missing independent official source', v => { v.officialSource = null; }],
  ['changed ordinary opening', v => { v.prepared.blocks[0].plainText = 'A different ordinary qualification.'; }],
  ['truncated official body', v => { v.official.truncated = true; }],
  ['ineligible official source', v => { v.official.blocks[0].researchClaimEligible = false; }],
  ['ineligible canonical source preserved', v => { v.section.researchClaimEligible = false; }],
  ['ineligible prepared source preserved', v => { v.prepared.researchClaimEligible = false; }],
  ['ineligible prepared block preserved', v => { v.prepared.blocks[0].researchClaimEligible = false; }],
  ['section reference boundary', v => { v.prepared.referenceOnly = true; }],
  ['section reference mode boundary', v => { v.prepared.selectionMode = 'section_reference'; }],
  ['selected-only boundary', v => { v.prepared.pinnedSelectionExact = true; }],
  ['discovery-only boundary', v => { v.prepared.discoveryPassageOnly = true; }],
  ['prepared table preserved', v => { v.prepared.blocks[0].kind = 'table'; }],
  ['prepared image preserved', v => { v.prepared.blocks[0].imageID = 'existing-image'; }],
  ['prepared structured grid preserved', v => { v.prepared.blocks[0].html += '<scrolltable>Grid</scrolltable>'; }]
]) {
  const value = fixture(); change(value);
  assert.equal(enrich(value), value.prepared, reason);
}
for (const value of [fixture({ heading: 'Section MC 202: General Definitions' }),
  fixture({ heading: 'General Definitions' }), fixture({ oneEntry: true })]) {
  assert.equal(enrich(value), value.prepared,
    'An unbound/wrong-family heading or insufficient complete entries cannot establish a dictionary.');
}

const catalog = await allSectionCatalogByID();
const section = [...catalog.values()].find(s => s.codePrefix === 'FGC' && s.sectionNumber === '201.4' &&
  !s.codeVersion?.includes('2014-construction-codes'));
assert(section, 'Actual current FGC carrier must be present in the canonical catalog.');
const body = await researchBodyForCatalogSection(section);
const source = { ...section, sectionID: String(section.id), body,
  corpusID: corpus.id, codeVersion: corpus.codeVersion, codeEdition: corpus.codeEdition, jurisdiction: corpus.jurisdiction };
const carrier = researchEmbeddedDefinitionCarrier(source);
assert.equal(carrier?.sectionNumber, '202',
  'The fresh canonical app body must retain the existing official FGC202 embedded definitions.');
const definition = targetedDefinitionExcerpt(source, 'direct-vent appliance', {
  completeDefinitionLabels: ['DIRECT-VENT APPLIANCES'], maximumCharacters: 12000
});
assert.match(definition?.text || '', /all air for combustion is derived directly from the outdoor atmosphere/);
assert.match(definition.text, /all flue gases are discharged directly to the outdoor atmosphere/);
const published = researchBoundDefinitionPublishedReference(source, definition, definition.text);
assert.equal(published?.codePrefix, 'FGC');
assert.equal(published?.sectionNumber, '202');
assert.equal(published?.carrierSectionID, String(section.id));
assert.equal(published?.carrierSectionNumber, '201.4');
const officialBody = await constructionHTMLBodyForSection(section, { includeOfficialSourceBinding: true });
assert.equal((await constructionHTMLBodyForSection(section)).officialSourceBinding, undefined,
  'The default existing loader/Reader body shape does not acquire recovery metadata.');
const officialSource = await constructionChapterHTMLSource(section.codePrefix, section.chapterNumber);
assert.equal(body.officialSourceBinding.sourceHTMLHash, hash(officialSource.html));
assert.equal(body.officialSourceBinding.bodyTextHash, hash(body.blocks[0].plainText));
assert.deepEqual(body, officialBody, 'The app restores the existing same-source official body rather than synthesizing legal text.');
for (const prefix of ['PC', 'MC']) {
  const completeSection = [...catalog.values()].find(s => s.codePrefix === prefix && s.sectionNumber === '201.4' &&
    !s.codeVersion?.includes('2014-construction-codes'));
  const completeBody = await researchBodyForCatalogSection(completeSection);
  const completeOfficial = await constructionHTMLBodyForSection(completeSection, { includeOfficialSourceBinding: true });
  const completeRaw = await constructionChapterHTMLSource(prefix, completeSection.chapterNumber);
  assert.equal(enrichResearchConstructionDefinitionBody(completeBody, completeOfficial, completeSection, completeRaw), completeBody,
    `Existing complete ${prefix} canonical body remains the original object.`);
}

// The canonical source becoming complete must not widen a selected passage.
// Its opening retains the carrier identity; only exact bound entries may use
// the separately published dictionary reference.
const selectedText = body.blocks[0].plainText.slice(0, carrier.sourceOffsets.start).trim();
assert.equal(researchBoundDefinitionPublishedReference(source, definition, selectedText), null);
const input = { question: 'Using only the selected passage, explain its stated rule.',
  messages: [], projectFacts: [], originSurface: 'reader',
  pinnedEvidence: [{ ...source, sectionID: String(section.id), selectedText }] };
const packet = await assembledResearchEvidenceForTurn({ ...input,
  corpusPlan: await researchCorpusPlanForTurn(input) });
assert.equal(packet.strategy.mode, 'pinned_first');
assert.equal(packet.sources.length, 1);
assert.equal(packet.sources[0].text, selectedText);
assert.equal(packet.sources[0].sectionNumber, '201.4');
assert.equal(packet.sources[0].pinnedSelectionExact, true);
assert.equal(packet.sources[0].publishedCitationReference, undefined);
assert.equal(providerCalls, 0);
console.log('Verified same-source definition recovery, identity/media negatives and real selected-only app boundary passed without providers.');
