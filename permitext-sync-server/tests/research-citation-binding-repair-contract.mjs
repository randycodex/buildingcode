import assert from 'node:assert/strict';
import { researchRevisionAnswerHash } from '../research-targeted-revision.mjs';
import { researchCitationBindingTargets, researchCitationBindingRepairEligible,
  researchCitationBindingRepairSchema, applyResearchCitationBindingRepair } from '../research-citation-binding-repair.mjs';
import { normalizeResearchInterpretationEvidenceBindings, validateResearchInterpretation } from '../app.mjs';

const metadata = { sectionID: 'definitions', sectionNumber: '12-10', codePrefix: 'ZR', corpusID: 'nyc-zoning-resolution',
  codeVersion: 'fixture-current', codeEdition: 'current ZR', jurisdiction: 'New York City' };
const evidence = [{ ...metadata, sourceID: 'other-definition', text: 'A commercial use is a use listed in the specified commercial use groups.' },
  { ...metadata, sourceID: 'use-definition', text: 'A use is any purpose for which a building or land is designed, arranged, intended, maintained or occupied, or any activity carried on or intended there.' }];
const raw = { answerText: 'Classify the space by its intended or actual purpose or activity (ZR §12-10).',
  supportedPoints: [{ heading: 'Meaning of use', explanation: 'ZR §12-10 defines use by purpose or activity.', sectionID: 'definitions', sourceIDs: ['other-definition'] }],
  citations: [{ sectionID: 'definitions', sourceIDs: ['other-definition'], relevance: 'Definition of use.' }],
  assumptions: ['If this is the proposed activity.'], missingFacts: ['Proposed activity.'], followUpQuestions: ['What activity is proposed?'],
  evidenceLimitations: ['Partial boundaries remain unresolved.'], additionalEvidenceNeeded: [], supportingSourceUses: [],
  conversationFacts: [{ value: 'Preserve the saved Project facts.' }] };
const original = validateResearchInterpretation(raw, evidence);
const snapshot = structuredClone(original), sourceSnapshot = structuredClone(evidence);
const issues = [{ type: 'incorrect_citation', message: 'The general use definition is in the other supplied passage.' }];
assert(researchCitationBindingRepairEligible(original, evidence, issues));
const schema = researchCitationBindingRepairSchema(original, evidence);
assert.equal(schema.additionalProperties, false);
assert.equal(schema.properties.replacements.items.additionalProperties, false);
assert.deepEqual(schema.required, ['answerHash', 'cannotRepair', 'replacements']);
assert(!JSON.stringify(schema).includes('answerText'), 'The patch response cannot carry replacement prose.');
const patch = { answerHash: researchRevisionAnswerHash(original), cannotRepair: false, replacements: [
  { targetID: 'supportedPoints/0', fromSourceID: 'other-definition', toSourceID: 'use-definition' },
  { targetID: 'citations/0', fromSourceID: 'other-definition', toSourceID: 'use-definition' }] };
const candidate = applyResearchCitationBindingRepair(original, patch, evidence);
const checked = validateResearchInterpretation(normalizeResearchInterpretationEvidenceBindings(candidate, evidence), evidence);
assert.equal(checked.answerText, original.answerText);
for (const field of ['conclusion', 'explanation', 'assumptions', 'missingFacts', 'followUpQuestions', 'evidenceLimitations', 'additionalEvidenceNeeded', 'supportingSourceUses'])
  assert.deepEqual(checked[field], original[field], field);
assert.deepEqual(candidate.conversationFacts, original.conversationFacts);
assert.deepEqual(checked.supportedPoints[0], { ...original.supportedPoints[0], sourceIDs: ['use-definition'] });
assert.deepEqual(checked.citations[0].sourceIDs, ['use-definition']);
assert.equal(checked.citations[0].supportingPassages[0].selectedText, evidence[1].text, 'Canonical evidence is rebuilt from the supplied passage, not model-authored text.');
assert.equal(checked.citations[0].relevance, original.citations[0].relevance);
assert.deepEqual(original, snapshot); assert.deepEqual(evidence, sourceSnapshot);
assert.equal(applyResearchCitationBindingRepair(original, { ...patch, cannotRepair: true, replacements: [] }, evidence), null);

for (const wrong of [
  { ...patch, answerHash: 'stale' }, { ...patch, replacements: [] }, { ...patch, answerText: 'Changed claim.' },
  { ...patch, cannotRepair: true }, { ...patch, replacements: [patch.replacements[0], patch.replacements[0]] },
  { ...patch, replacements: [{ ...patch.replacements[0], targetID: 'unknown' }] },
  { ...patch, replacements: [{ ...patch.replacements[0], toSourceID: 'invented' }] },
  { ...patch, replacements: [{ ...patch.replacements[0], toSourceID: 'other-definition' }] },
  { ...patch, replacements: [{ ...patch.replacements[0], selectedText: 'Invented law.' }] }
]) assert.throws(() => applyResearchCitationBindingRepair(original, wrong, evidence), { code: 'INVALID_RESEARCH_RESPONSE' });
for (const key of ['sectionID', 'sectionNumber', 'codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction']) {
  const changed = evidence.map((source, index) => index ? { ...source, [key]: 'different' } : source);
  assert(!researchCitationBindingRepairEligible(original, changed, issues), key);
  assert.throws(() => applyResearchCitationBindingRepair(original, patch, changed), { code: 'INVALID_RESEARCH_RESPONSE' });
}
for (const issue of ['unsupported_requirement', 'wrong_attribution', 'unsupported_project_fact', 'missed_material_conclusion'])
  assert(!researchCitationBindingRepairEligible(original, evidence, [...issues, { type: issue }]));
assert(!researchCitationBindingRepairEligible(original, evidence, []));
assert.deepEqual(researchCitationBindingTargets(original, [...evidence, evidence[0]]), []);
assert(!researchCitationBindingRepairEligible(original, evidence.map((source, index) => ({ ...source,
  publishedCitationReference: { sectionNumber: index ? 'separate embedded entry' : 'original embedded entry' } })), issues),
  'A shared carrier section does not authorize a different published identity.');
for (const extra of [{ claimCoverageRequired: true }, { evidenceRole: 'irrelevant' }]) {
  const changed = evidence.map(source => ({ ...source, evidencePriority: extra }));
  assert(!researchCitationBindingRepairEligible(original, changed, issues));
}
// A mechanical correction is not a substantive pass: arbitrary proposed
// replacements remain candidates for the HTTP path's fresh full-answer review.
console.log('Citation binding repair: immutable prose, facts, caveats and source text; same-section/edition authorization, stale/ambiguous/unknown IDs, protected coverage and malformed patches fail closed.');
