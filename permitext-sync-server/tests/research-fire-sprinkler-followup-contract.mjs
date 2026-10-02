import assert from 'node:assert/strict';
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = '1';
globalThis.fetch = async () => { throw Error('Offline retrieval check'); };
const { assembledResearchEvidenceForTurn } = await import('../app.mjs');
const assembled = await assembledResearchEvidenceForTurn({
 question: 'For a fully sprinklered Group B office, does the provision allowing increased floor area per unit of A also double the maximum extinguisher travel distance? Explain the distinction.',
 messages: [
 {role:'user',question:'For that Class A extinguisher, the straight-line distance is 60 feet but the actual walking route around partitions is 90 feet. Does that location satisfy the travel-distance limit?'},
 {role:'assistant',answer:{citations:[{codePrefix:'FC',sectionNumber:'906.3.1'}],verification:{pass:true}}}
 ],pinnedEvidence:[],projectFacts:[]
});
const fireSources=assembled.sources.filter(s=>s.codePrefix==='FC');

const text=fireSources.map(s=>s.text).join('\n');
assert.match(text,/Maximum Travel Distance to Extinguisher\s+75 feet/i);
assert.match(text,/floor area per unit of A.*doubled/is);
assert.match(text,/Group[s]?\s+A-?3.*B.*E/is);
console.log('Fire extinguisher follow-up retains Class A table, travel limit and sprinkler coverage footnote.');
