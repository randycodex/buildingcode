import assert from 'node:assert/strict';
import { createResearchCorpusRegistry, routeResearchCorpora } from '../research-corpus-registry.mjs';
import { semanticResearchProjectFacts } from '../research-retrieval-query-context.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
globalThis.fetch = () => { throw Error('Provider access forbidden'); };
process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = '1';
process.env.PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING = '1';
const registry = createResearchCorpusRegistry({zoningResearchEligibility:true});
const facts = ['Zoning Fact — Zoning District(s): R7-1 (sourced data)',
 'Building / Code Fact — Building Area: 14000 square feet (sourced data; existing-property record)',
 'Building / Code Fact — Proposed uses: Retail and offices (user-confirmed)',
 'Additional Project facts (user-provided): Retail inventory currently reports 90000 square feet. The proposed offices have a dropped ceiling. ' + 'The public parcel record has a separate inventory subject. '.repeat(14)];
const requested = options => routeResearchCorpora({projectCodeVersion:'NYC Zoning Resolution', projectFacts:facts, registry,...options}).selected.filter(c=>c.retrievalRole==='requested').map(c=>c.id);
for(const question of ['How much headroom is required in this office?','How low can the ceiling over our retail sales area be?','What clear height is needed for this room?','How far down can the retail sales area ceiling come?']) {
 assert.deepEqual(requested({question}),['nyc-2022-construction-codes']);
 const hints=semanticResearchProjectFacts({question,projectFacts:facts});
 assert.doesNotMatch(hints,/14000|90000|R7-1/);
 assert.match(hints,/Retail and offices|dropped ceiling/);
}
assert.deepEqual(requested({question:'Could propane cylinders be stored outdoors?'}),['nyc-2022-fire-code']);
assert.deepEqual(requested({question:'Does the kitchen sink drain indirectly?'}),['nyc-2022-construction-codes']);
assert.deepEqual(requested({question:'Does a grease hood need a duct?'}),['nyc-2022-construction-codes']);
assert.deepEqual(requested({question:'Do new apartments need parking in a transit zone?'}),['nyc-zoning-resolution']);
assert.deepEqual(requested({question:'What is the ceiling on floor area for this zoning lot?'}),['nyc-zoning-resolution']);
assert.deepEqual(requested({question:'How much storefront transparency does zoning require?'}),['nyc-zoning-resolution']);
assert.deepEqual(requested({question:'Check room headroom and zoning floor area.'}),['nyc-2022-construction-codes','nyc-zoning-resolution']);
assert.deepEqual(requested({question:'Under the 2014 Building Code, what room height applies?'}),['nyc-2014-construction-codes']);
assert.deepEqual(requested({question:'What rules apply here?'}),['nyc-zoning-resolution']);
const fireCorpus=registry.find(c=>c.id==='nyc-2022-fire-code');
const messages=[{role:'user',question:'Can propane cylinders be stored outside this building?'},{role:'assistant',answer:{mode:'openai',verification:{pass:true},citations:[{codePrefix:'FC',sectionNumber:'999.1',corpusID:fireCorpus.id,codeVersion:fireCorpus.codeVersion,codeEdition:fireCorpus.codeEdition}]}}];
assert.deepEqual(requested({question:'They would be in a locked cage. Does that avoid the residential restriction?',previousMessages:messages}),['nyc-2022-fire-code']);
// Both synthetic passages share retail/area vocabulary. The physical ceiling
// subject favors its book over a commercial floor-area text; no legal result
// or code threshold is encoded in these routing/discovery/context assertions.
const catalog=[{id:'room',sectionID:'room',codePrefix:'BC',sectionNumber:'999.1',title:'Retail sales area ceiling',text:'Retail sales area ceiling height. Office room ceilings retain their stated clear height.'},{id:'bulk',sectionID:'bulk',codePrefix:'ZR',sectionNumber:'99-11',title:'Retail sales area ceiling',text:'Retail sales area ceiling on floor area in this district.'}];
const discovered=await discoverRelevantEvidence({question:'How low can the ceiling over our retail sales area be?',retrievalContext:{currentQuestion:'How low can the ceiling over our retail sales area be?'},catalog,readSectionBody:async section=>({blocks:[{plainText:section.text}]}),invertedIndex:new Map([['ceiling',new Set(['room','bulk'])],['retail',new Set(['room','bulk'])],['sales',new Set(['room','bulk'])]]),limit:2});
assert.equal(discovered.candidates[0]?.codePrefix,'BC');
assert(discovered.candidates.some(c=>c.codePrefix==='ZR'),'A soft subject prior does not exclude cross-code sources.');
console.log('Shared subject routing/discovery/context passed with mixed/historical/pronoun scope guards.');
