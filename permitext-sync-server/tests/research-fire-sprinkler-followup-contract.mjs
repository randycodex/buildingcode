import assert from 'node:assert/strict';
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = '1';
globalThis.fetch = async () => { throw Error('Offline retrieval check'); };
const { assembledResearchEvidenceForTurn } = await import('../app.mjs');
const intro = 'Use the 2022 NYC Construction Codes and 2022 NYC Fire Code. This conversation concerns hypothetical schematic-design examples for a proposed new building at 1070 Southern Boulevard, Bronx, with ground-floor retail and community-facility space. Do not treat the examples as confirmed project facts. Under the NYC Fire Code, what is the maximum travel distance to a portable fire extinguisher for Class A hazards? Cite the applicable section or table and explain travel distance versus straight-line distance.';
const assembled = await assembledResearchEvidenceForTurn({
 question: 'For a fully sprinklered Group B office, does the provision allowing increased floor area per unit of A also double the maximum extinguisher travel distance? Explain the distinction.',
 messages: [
 {role:"user",question:intro},
 {role:"assistant",answer:{answerText:"75 feet (FC906.3.1,Table906.3.1)",citations:[{codePrefix:"FC",sectionNumber:"906.3.1"}],verification:{pass:true}}},
 {role:'user',question:'For that Class A extinguisher, the straight-line distance is 60 feet but the actual walking route around partitions is 90 feet. Does that location satisfy the travel-distance limit?'},
 {role:'assistant',answer:{citations:[{codePrefix:'FC',sectionNumber:'906.3.1'}],verification:{pass:true}}}
,
 {role:"user",question:"For a fully sprinklered Group B office, does the provision allowing increased floor area per unit of A also double the maximum extinguisher travel distance? Explain the distinction."},
 {role:"assistant",answer:{answerText:"Which specific part should we work through first?",citations:[],verification:{pass:false}}}
 ],pinnedEvidence:[],projectFacts:["Zoning Fact — Zoning District: R7-1", "Zoning Fact — Commercial Overlay: C2-4"]
});
assert(!assembled.corpusPlan.selected.some(c=>c.id==='nyc-zoning-resolution'),'Project zoning facts must not turn extinguisher coverage into a zoning question');
const fireSources=assembled.sources.filter(s=>s.codePrefix==='FC');

const text=fireSources.map(s=>s.text).join('\n');
assert.match(text,/Maximum Travel Distance to Extinguisher\s+75 feet/i);
assert.match(text,/floor area per unit of A.*doubled/is);
assert.match(text,/Group[s]?\s+A-?3.*B.*E/is);
console.log('Fire extinguisher follow-up retains Class A table, travel limit and sprinkler coverage footnote.');
const {routeResearchCorpora}=await import('../research-corpus-registry.mjs');
const mixed=routeResearchCorpora({question:'Compare the Fire Code extinguisher coverage with the Zoning Resolution floor area ratio requirements.',projectFacts:['Zoning Fact — Zoning District: R7-1']});
assert([...mixed.selected,...mixed.unavailable].some(c=>c.id==='nyc-zoning-resolution'),'An independently requested zoning question must remain routed alongside Fire Code');
