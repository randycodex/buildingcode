import assert from 'node:assert/strict';
import { researchQuestionIsRuleExplanation, researchQuestionIntentInstruction } from '../research-question-intent.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
const failedQuestion = 'Under the 2022 NYC Building Code, what does BC 1004.5 say about determining occupant load? Explain the rule and cite the enacted provision; do not assume a particular occupancy or floor area.';
for (const q of [failedQuestion, 'Explain BC 1004.5.', 'What does BC 101.1 call this code?']) {
  assert.equal(researchQuestionIsRuleExplanation(q), true, q);
  assert.match(researchQuestionIntentInstruction(q), /not a project compliance decision/);
}
for (const q of ['Explain BC 1004.5 for my building.', 'Under BC 1004.5, calculate occupant load for 2000 square feet.', 'Does BC 1004.5 apply to our project?', 'Explain BC 1004.5 and whether we comply.', 'What evidence do you need for this project?', 'Explain BC 1004.5 and tell me whether two exits suffice.']) {
  assert.equal(researchQuestionIsRuleExplanation(q), false, q);
}
const numbers = ['1004.1','1004.1.1','1004.1.2','1004.1.3','1004.3','1006.2.1','1006.3','1006.3.1','1006.3.2'];
const catalog = numbers.map(sectionNumber=>({id:`BC:${sectionNumber}`,codePrefix:'BC',chapterNumber:'10',sectionNumber,title:`Section ${sectionNumber}`}));
for (const question of [
 'Under the 2022 NYC Building Code, can you determine the required number of exits for my building if I have not supplied its occupancy, occupant load, or layout? Explain what remains unresolved without guessing. Use enacted sources only.',
 'How many exits are required?', 'Explain exit-count requirements.'
]) {
 const result=await discoverRelevantEvidence({question,catalog,invertedIndex:new Map(),readSectionBody:async s=>({blocks:[{id:s.id,plainText:`Enacted provision ${s.sectionNumber}.`}]}),limit:8});
 const refs=result.candidates.map(c=>`${c.codePrefix} ${c.sectionNumber}`);
 assert(refs.includes('BC 1006.2.1'),JSON.stringify(refs));
 assert(refs.some(r=>r.startsWith('BC 1006.3')),JSON.stringify(refs));
}
console.log('Rule explanation intent and exit-count retrieval regressions passed.');

for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
globalThis.fetch = () => { throw new Error("No provider/network calls permitted."); };
const { assembledResearchEvidenceForTurn } = await import('../app.mjs');
const assembled = await assembledResearchEvidenceForTurn({question:'Under the 2022 NYC Building Code, can you determine the required number of exits for my building if I have not supplied its occupancy, occupant load, or layout? Explain what remains unresolved without guessing. Use enacted sources only.',messages:[],projectFacts:[],pinnedEvidence:[]});
for (const root of ['1006.2.1','1006.3']) {
 assert(assembled.sources.some(s=>s.codePrefix==='BC' && (s.sectionNumber===root || s.sectionNumber.startsWith(root+'.'))), `Real corpus assembly omitted ${root}: ${assembled.sources.map(s=>s.sectionNumber)}`);
}
console.log('Real corpus exit-count assembly includes room/space and story exit-number rules.');
