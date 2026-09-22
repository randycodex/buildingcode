import assert from 'node:assert/strict';
import { applyResearchOutsideAuthorityStartingPoints } from '../research-answer-presentation.mjs';
import { researchWebSupportTrigger } from '../research-source-policy.mjs';
import { researchQuestionIsBoundedCitationLookup } from '../research-model-routing.mjs';

const questions = [
  'What does BC 101.1 call this code?',
  'Does that passage alone establish whether a particular building complies with the code? Explain its limits without adding unsupported requirements.'
];
const zoning = { sourceName: 'NYC Zoning Resolution', sourceURL: 'https://zr.planning.nyc.gov/' };
const omh = { sourceName: 'New York State Office of Mental Health', sourceURL: 'https://omh.ny.gov/omhweb/policy_and_regulations/' };
for (const question of questions) {
  const answer = { answerText: 'BC § 101.1 names the code. It does not establish whole-building compliance.',
    evidenceLimitations: ['Only the supplied title provision was reviewed.'],
    citations: [{ sourceIDs: ['bc-101-1'] }], supportedPoints: [{ sourceIDs: ['bc-101-1'] }] };
  const original = structuredClone(answer);
  // Reproduce the production failure: broad retrieval enables web support and
  // suggests Zoning. Both initial and repaired drafts must remain unpolluted.
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.deepEqual(applyResearchOutsideAuthorityStartingPoints(answer, [zoning], {
      sourcePolicy: { useWeb: true }, question
    }), original);
  }
}
for (const question of [questions[0], 'What does Building Code Section 101.1 name the code?']) {
  assert.equal(researchQuestionIsBoundedCitationLookup(question), true);
}
for (const question of [
  'What does BC 101.1 call this code and is my building compliant?',
  'What does BC 101.1 call this code compared with BC 101.2?',
  'What does BC 101.1 call this code under the 2014 exceptions?'
]) assert.equal(researchQuestionIsBoundedCitationLookup(question), false);
for (const question of [questions[1], 'Can this section by itself prove compliance?', 'Is the supplied text on its own enough?']) {
  assert.equal(researchWebSupportTrigger({question, outsideLibraryRequired: true}, {}).useWeb, false);
}
assert.equal(researchWebSupportTrigger({
  question: 'Does that passage alone establish compliance? Find official guidance too.', outsideLibraryRequired: true
}, {}).useWeb, true, 'An explicit external request remains available.');
const explicit = applyResearchOutsideAuthorityStartingPoints({answerText:'OMH requirements remain unresolved.', evidenceLimitations:[]}, [zoning, omh], {
  question: 'Find official OMH requirements.', sourcePolicy:{useWeb:true}
});
assert.match(explicit.answerText, /omh\.ny\.gov/);
assert.doesNotMatch(explicit.answerText, /zr\.planning/);
assert.doesNotMatch(explicit.evidenceLimitations.join(' '), /must be retrieved|program-specific minimum/);
assert.deepEqual(applyResearchOutsideAuthorityStartingPoints(explicit, [omh], {
  question:'Find official OMH requirements.', sourcePolicy:{useWeb:true}
}), explicit);
console.log('Research walkthrough boundary regressions passed: unrelated authority injection blocked, requested links retained, paraphrase routing bounded.');
