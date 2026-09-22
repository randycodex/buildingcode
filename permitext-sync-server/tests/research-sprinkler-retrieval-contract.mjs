import assert from 'node:assert/strict';
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = '1';
globalThis.fetch = () => { throw new Error('No paid/network calls in corpus regression'); };
const { assembledResearchEvidenceForTurn } = await import('../app.mjs');
const { requiredResearchClaimsFromEvidence } = await import('../research-required-claim-coverage.mjs');
const root = 'How do I find out whether my building needs sprinklers under the 2022 NYC Building Code?';
for (const input of [
  { question: root },
  { question: "I'm not sure. What should I check first?", topicContext: {rootTopic: root, currentTopic: root} },
  { question: "For this project's proposed work, how do I find out whether sprinklers are required?", projectFacts: ['Hypothetical interior alteration in an existing building; no enlargement.'] },
  { question: 'For this hypothetical test, assume the approved occupancy is Group B office and the work keeps that use, with no enlargement. Does that settle whether sprinklers are required?', projectFacts: ['Hypothetical interior alteration in an existing building; no enlargement.'], topicContext: {rootTopic: root, currentTopic: root} }
]) {
  const result = await assembledResearchEvidenceForTurn({ messages: [], projectFacts: [], pinnedEvidence: [], ...input });
  const refs = result.sources.map(s => `${s.codePrefix} ${s.sectionNumber}`);
  assert(refs.includes('BC 903.2'), JSON.stringify(refs));
  for (const section of ['901.9.2', '901.9.4.1', '901.9.4.2', '901.9.4.3', '901.9.5', '901.9.6']) {
    assert(refs.includes(`BC ${section}`), `Missing operative alteration source ${section}: ${refs.join(', ')}`);
  }
  assert(refs.some(r => /^BC 903\.2\.\d+$/.test(r)), JSON.stringify(refs));
  assert(!refs.includes('AC 28-315.2.1'), 'Painting must not displace applicability evidence');
  if (input.projectFacts) assert(refs.some(r => r.startsWith('BC 901.9.4')), JSON.stringify(refs));
  const mandatory = requiredResearchClaimsFromEvidence(result.sources);
  assert(!mandatory.some(claim => /BC 903\.2 —/.test(claim.label)), 'A broad sprinkler question does not require boilerplate overview coverage.');
  assert(!mandatory.some(claim => /BC 903\.2\.(?:4|6|7|8|9)\b/.test(claim.label)), 'Retrieving occupancy alternatives must not force unrelated occupancy conclusions: ' + JSON.stringify(mandatory));
  console.log(input.question, refs.join(', '));
}
console.log('Sprinkler trigger and uncertainty follow-up corpus regressions passed.');
