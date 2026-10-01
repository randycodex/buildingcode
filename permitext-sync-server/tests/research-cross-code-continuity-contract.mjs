// Real corpus retrieval, without provider calls. These checks establish source
// availability and continuation, not the correctness of generated answers.
import assert from 'node:assert/strict';
import { researchEvidenceRetrievalQuery } from '../research-evidence-assembly.mjs';

process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = '1';
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error('Offline retrieval check'); };
const { assembledResearchEvidenceForTurn } = await import('../app.mjs');
const cases = [
  { code: 'PC', section: '1002.4', question: 'Under the 2022 NYC Plumbing Code, what minimum and maximum liquid seal depths are permitted for an ordinary fixture trap?',
    followUp: 'For that same ordinary fixture trap, would a 6-inch liquid seal comply?', text: /not less than 2 inches.*not more than 4 inches/i },
  { code: 'MC', section: '403.3.1.1', question: 'Under the 2022 NYC Mechanical Code, what is the minimum exhaust rate for a private dwelling-unit bathroom for intermittent versus continuous operation?',
    followUp: 'For that same private bathroom, would 25 cfm operating continuously satisfy the airflow requirement?', text: /20\/50/ },
  { code: 'FGC', section: '409.5.1', question: 'Under the 2022 NYC Fuel Gas Code, where must an appliance shutoff valve be located relative to an ordinary gas appliance?',
    followUp: 'For that same gas appliance, is an accessible shutoff in the same room but 8 feet away compliant?', text: /within 6 feet/i },
  { code: 'FC', section: '906', question: 'Under the 2022 NYC Fire Code, what is the maximum travel distance to a portable fire extinguisher for Class A fire hazards?',
    followUp: 'For that Class A extinguisher, is a 90-foot walking route compliant if the straight-line distance is 60 feet?', text: /Maximum Travel Distance to Extinguisher\s+75 feet/i },
  { code: 'BC', section: '1010.1.1.1', question: 'Under the 2022 NYC Building Code, what is the minimum clear opening width of a typical accessible egress door, and how is it measured for a swinging door?',
    followUp: 'For that swinging door, does a nominal 36-inch leaf comply if the actual clear opening at 90 degrees is 31 inches?', text: /minimum clear width of 32 inches/i }
];
for (const item of cases) {
  const messages = [];
  for (const question of [item.question, item.followUp]) {
    const assembled = await assembledResearchEvidenceForTurn({ question, messages, pinnedEvidence: [], projectFacts: [] });
    const source = assembled.sources.find(s => s.codePrefix === item.code && s.sectionNumber === item.section);
    assert(source, `${item.code}: governing source must be retrieved for ${question}`);
    assert.match(source.text, item.text, `${item.code}: relevant rule must survive evidence budgeting`);
    if (item.code === 'MC') {
      assert.match(source.text, /Private dwellings/i);
      assert.match(source.text, /lower rate.*continuously/i, 'The table footnote must accompany the row');
    }
    messages.push({ role: 'user', question }, { role: 'assistant', answer: {
      citations: [{ codePrefix: item.code, sectionNumber: item.section }],
      verification: { pass: true }
    } });
  }
  const continued = researchEvidenceRetrievalQuery({ question: item.followUp, previousMessages: messages.slice(0, 2) });
  assert(continued.retrievalQuery.includes(`${item.code} § ${item.section}`), 'Follow-ups must retain non-zoning references too');
  const switched = researchEvidenceRetrievalQuery({ question: 'New topic: explain zoning lot coverage.', previousMessages: messages });
  assert(!switched.retrievalQuery.includes(`${item.code} § ${item.section}`), 'A topic switch must not inherit unrelated citations');
}
const withProjectInventory = await assembledResearchEvidenceForTurn({
  question: cases[0].question, messages: [], pinnedEvidence: [],
  projectFacts: ['Existing project information: mixed-use building; plumbing fixture counts and occupancy classification documented in PC 403.1 and BC 302.1.']
});
assert(withProjectInventory.sources.some(s => s.codePrefix === 'PC' && s.sectionNumber === '1002.4'));
assert(!withProjectInventory.sources.some(s => ['403.1', '302.1'].includes(s.sectionNumber) && s.evidencePriority?.claimCoverageRequired),
  'Background project inventory must not create unrelated mandatory answer topics');
assert.equal(networkAttempts, 0);
const valveLocation = await assembledResearchEvidenceForTurn({
  question: 'Use the 2022 NYC Construction Codes and 2022 NYC Fire Code. This conversation concerns hypothetical schematic-design examples for a proposed new building at 1070 Southern Boulevard, Bronx, with ground-floor retail and community-facility space. Do not treat the examples as confirmed project facts. Under the NYC Fuel Gas Code, where must an ordinary gas appliance shutoff valve be located? Explain the same-room, distance, access, height and union/connector conditions with the governing section.',
  messages: [], pinnedEvidence: [], projectFacts: []
});
const valveRule = valveLocation.sources.find(s => s.codePrefix === 'FGC' && s.sectionNumber === '409.5.1');
assert(valveRule, 'Natural-language valve location questions must retrieve the installation rule, not merely plan requirements');
assert.match(valveRule.text, /within 6 feet/i);
assert.match(valveRule.text, /60 inches/i);
assert.equal(networkAttempts, 0);
console.log('Cross-code continuity passed: ten real-corpus retrievals, complete relevant rules, table footnote and topic-switch isolation.');
