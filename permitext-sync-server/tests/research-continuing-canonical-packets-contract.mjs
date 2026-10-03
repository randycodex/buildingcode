import assert from 'node:assert/strict';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';
import { researchAncestorQualificationReferences, researchCheckedRuleIndexPassage, researchCurrentRuleDetailScore } from '../research-rule-packets.mjs';

globalThis.fetch = () => { throw new Error('Providers forbidden in continuing packet contracts'); };
const authority = { codePrefix: 'MC', corpusID: 'synthetic-current', codeVersion: 'synthetic-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, number, title, text, refs = []) => ({ ...authority, id, sectionID: id, sectionNumber: number, title,
  text, canonicalText: text, crossReferences: refs, body: { blocks: [{ id: id + '-body', plainText: text }] } });
const citation = source => ({ ...source, supportingPassages: [{ selectedText: 'REJECTED OLD NUMERIC CONCLUSION 999 feet shall never become a premise.' }] });
const rootQuestion = 'Can we keep solvent drums beside exterior service equipment?';
const question = 'They would be in a locked cabinet behind the service counter. Does that avoid the enclosure restriction?';
const packet = section('packet', '991', 'Storage of chemical containers',
  '991.1 Containers. Retain the ordinary container arrangement.\n991.2 Enclosures. A locked cabinet behind a service counter retains the enclosure restriction. Exception: The listed isolated unit retains its separately approved limits.');
const lead = { ...section('lead', '993', 'Identification', '993 Identification. Display the identification in its specified position.'), codePrefix: 'BC' };
const previousMessages = [{ role: 'user', question: rootQuestion }, { role: 'assistant', answer: {
  mode: 'openai', verification: { pass: true }, supportedPoints: [{}], citations: [citation(packet)] } }];
const query = researchEvidenceRetrievalQuery({ question, previousMessages });
assert.equal(query.topicDecision.decision, 'continuation');
assert.match(query.semanticQuery, /solvent drums/);
assert(!query.semanticQuery.includes('999'));
assert(!query.semanticQuery.includes('REJECTED'));
assert(!query.semanticQuery.includes('retains its separately approved limits'));
const prefixedHuman = structuredClone(previousMessages);
prefixedHuman[0].question = 'For this project, ' + rootQuestion;
assert.match(researchEvidenceRetrievalQuery({ question, previousMessages: prefixedHuman }).semanticQuery, /solvent drums/);
const measuredRoot = 'For a fictional motor enclosure in NYC, a three-foot opening has five inches of clearance. Is that sufficient?';
const measuredHistory = [{ role: 'user', question: measuredRoot }, { role: 'assistant', answer: {
  ...previousMessages[1].answer, citations: [{ ...citation(packet), title: 'Clearance of rotary pumps' }] } }];
const measuredFollow = researchEvidenceRetrievalQuery({ question: 'Can that opening use a removable panel instead of the previous arrangement?', previousMessages: measuredHistory });
assert.match(measuredFollow.semanticQuery, /Subject context: motor enclosure/);
assert.doesNotMatch(measuredFollow.semanticQuery, /Subject context:.*(?:three|five|feet|foot|inches|clearance|sufficient|has)/);
for (const changed of ['New topic: what ventilation does another garage need?', 'Under the 2014 Plumbing Code, what restriction applies?',
  'Actually, this is now an office occupancy. Which classification applies?']) {
  const reset = researchEvidenceRetrievalQuery({ question: changed, previousMessages });
  assert(!reset.semanticQuery.includes('solvent drums'), 'Current topic/family/subject correction takes precedence over old human subject.');
  if (!changed.startsWith('Actually')) assert.equal(reset.activeRulePacketReferences.length, 0);
}

const catalog = [lead, packet];
const index = await buildResearchPassageIndex(catalog, async value => value.body);
assert(!index.passages.some(passage => passage.sectionID === packet.id && passage.subsectionNumber === packet.sectionNumber));
const selected = researchCheckedRuleIndexPassage(index.passages, query.activeRulePacketReferences[0], packet, question);
assert.equal(selected?.subsectionNumber, '991.2');
for (const field of ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction', 'sectionNumber', 'sectionID']) {
  assert.equal(researchCheckedRuleIndexPassage(index.passages, { ...query.activeRulePacketReferences[0], [field]: 'different' }, packet, question), null);
}
assert.equal(researchCheckedRuleIndexPassage(index.passages, query.activeRulePacketReferences[0], packet, 'What is the garden temperature?'), null);
assert.equal(researchCheckedRuleIndexPassage(index.passages, query.activeRulePacketReferences[0], packet, question, 10), null);
assert.equal(researchCheckedRuleIndexPassage(index.passages.map(p => ({ ...p, sourceTextHash: null })), query.activeRulePacketReferences[0], packet, question), null);
assert.equal(researchCheckedRuleIndexPassage(index.passages.map(p => ({ ...p, scopeComplete: false, completeSubsectionText: null })), query.activeRulePacketReferences[0], packet, question), null);
const discover = () => discoverRelevantEvidence({ question: query.retrievalQuery, retrievalContext: { ...query, currentQuestion: question },
  catalog, passageIndex: index, invertedIndex: new Map(), readSectionBody: async value => value.body, limit: 2,
  semanticSearch: { search: async () => ({ hits: [{ ...index.passages.find(p => p.sectionID === lead.id), score: 1 }], metadata: {} }) } });
const found = await discover();
assert.equal(found.candidates.find(c => c.sectionID === packet.id)?.signals.currentQuestionLexicalReservation.kind, 'active_checked_rule_current_detail');
const assemblePacket = async (options = {}) => assembleResearchEvidence({ question, previousMessages, pinnedEvidence: [], discover: async () => found,
  resolveSection: async request => catalog.find(value => value.id === request.sectionID),
  limits: { maximumCharacters: 1500, maximumCharactersPerSource: 1200, maximumDiscovered: 2, maximumCrossReferences: 0 }, ...options });
const delivered = await assemblePacket();
const complete = delivered.sources.find(source => source.sectionID === packet.id);
assert(complete?.canonicalContextComplete && !complete.truncated);
assert.equal(complete.text, packet.text);
assert(delivered.usage.characterCount <= 1500);
const small = await assemblePacket({ limits: { maximumCharacters: 150, maximumCharactersPerSource: 150, maximumDiscovered: 2, maximumCrossReferences: 0 } });
assert(!small.sources.some(source => source.sectionID === packet.id));
assert(small.usage.characterCount <= 150);
const forged = await assemblePacket({ discover: async () => ({ ...found, candidates: found.candidates.map(c => c.sectionID === packet.id ? {
  ...c, indexedPassage: { ...c.indexedPassage, sourceTextHash: '0'.repeat(64) } } : c) }) });
assert(!forged.sources.some(source => source.sectionID === packet.id), 'A whole-source nomination retains exact child hash/offset validation.');
const strict = await assemblePacket({ pinnedEvidence: [{ ...packet, selectedText: 'Retain the ordinary container arrangement.',
  userSelectedText: 'Retain the ordinary container arrangement.' }], strategy: {
  mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' } });
assert.equal(strict.sources.length, 1);
assert.equal(strict.sources[0].text, 'Retain the ordinary container arrangement.');
const failed = researchEvidenceRetrievalQuery({ question, previousMessages: [previousMessages[0], { role: 'assistant', answer: {
  ...previousMessages[1].answer, verification: { pass: false } } }] });
assert.equal(failed.activeRulePacketReferences.length, 0, 'Unverified assistant citations never nominate a packet.');

// An ancestor qualification must stay whole even when its language does not
// repeat the child's current detail words. Ordinary unrelated links still lose
// to the existing incidental-reference cap.
const parent = section('parent', '998.2', 'General assemblies',
  '998.2 General assemblies. Approved connectors retain their stated performance. Exception: The separately listed installation retains its complete special limits.');
const parentRef = { codePrefix: 'MC', sectionNumber: parent.sectionNumber, sectionID: parent.id };
const child = section('child', '998.2.1', 'Cable sleeve protection',
  '998.2.1 Cable sleeve protection. Protect cable sleeves at concealed joints. Exception: The assembly shall be installed in accordance with Section 998.2.', [parentRef]);
const incidentalDependency = section('other', '997.2', 'Other assembly', '997.2 Other assembly. Retain the unrelated arrangement.');
const incidental = section('incidental', '997.1', 'Other detail', '997.1 Other detail. Retain Section 997.2.',
  [{ codePrefix: 'MC', sectionNumber: incidentalDependency.sectionNumber, sectionID: incidentalDependency.id }]);
const ancestorQuestion = 'Do cable sleeves need protection at concealed joints?';
assert.equal(researchCurrentRuleDetailScore(parent, ancestorQuestion), 0);
assert.deepEqual(researchAncestorQualificationReferences(child, child.crossReferences), [parentRef]);
for (const variant of [{ ...parentRef, codePrefix: 'PC' }, { ...parentRef, sectionNumber: '998.3' },
  { ...parentRef, sectionNumber: '997' }]) assert.equal(researchAncestorQualificationReferences(child, [variant]).length, 0);
assert.equal(researchAncestorQualificationReferences({ ...child, text: 'Metadata contains the parent identity, but no literal enacted link.' }, [parentRef]).length, 0);
assert.equal(researchAncestorQualificationReferences({ ...child, text: 'See Section 998.2 for an unrelated example.' }, [parentRef]).length, 0);
async function ancestorAssembly({ mutate = value => value, supplied = [incidental, child], limits = {} } = {}) {
  const reads = new Map();
  const result = await assembleResearchEvidence({ question: ancestorQuestion, pinnedEvidence: [],
    discover: async () => ({ candidates: supplied.map((value, i) => ({ ...value, rank: i + 1, selectedText: value.text })) }),
    resolveSection: async request => { const value = [parent, child, incidental, incidentalDependency].find(value =>
      request.sectionID ? value.id === request.sectionID : value.sectionNumber === request.sectionNumber);
      if (value) reads.set(value.id, (reads.get(value.id) || 0) + 1); return value ? mutate(value) : null; },
    limits: { maximumCharacters: 1500, maximumCharactersPerSource: 1200, maximumDiscovered: 2,
      maximumCrossReferences: 1, maximumTargetedDefinitions: 0, ...limits } });
  assert(result.usage.characterCount <= result.limits.maximumCharacters);
  assert(result.usage.crossReferenceCount <= result.limits.maximumCrossReferences);
  return { result, reads };
}
const ancestor = await ancestorAssembly();
assert.equal(ancestor.result.sources.find(source => source.sectionID === parent.id)?.text, parent.text);
assert(ancestor.result.sources.find(source => source.sectionID === parent.id).canonicalContextComplete);
assert.equal(ancestor.reads.get(parent.id), 1);
assert(!ancestor.result.sources.some(source => source.sectionID === incidentalDependency.id));
for (const field of ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction']) {
  const invalid = await ancestorAssembly({ mutate: value => value.id === parent.id ? { ...value, [field]: 'different-authority' } : value });
  assert(!invalid.result.sources.some(source => source.sectionID === parent.id));
  assert.equal(invalid.reads.get(parent.id), 1);
}
const noAncestorRoom = await ancestorAssembly({ limits: { maximumCharacters: incidental.text.length + child.text.length + 5 } });
assert(!noAncestorRoom.result.sources.some(source => source.sectionID === parent.id));
const oversized = await ancestorAssembly({ mutate: value => value.id === parent.id ? { ...value,
  text: value.text + ' The complete additional condition remains.'.repeat(40),
  canonicalText: value.text + ' The complete additional condition remains.'.repeat(40) } : value });
assert(!oversized.result.sources.some(source => source.sectionID === parent.id));
const fragment = await ancestorAssembly({ supplied: [incidental, { ...child, selectedText: 'Protect cable sleeves at concealed joints.',
  signals: { useSelectedPassageOnly: true } }] });
assert(!fragment.result.sources.some(source => source.sectionID === parent.id));
const ordinary = await ancestorAssembly({ mutate: value => value.id === child.id ? { ...value,
  text: value.text.replace('Exception: The assembly shall be installed in accordance with', 'For an unrelated example see'),
  canonicalText: value.text.replace('Exception: The assembly shall be installed in accordance with', 'For an unrelated example see') } : value });
assert(!ordinary.result.sources.some(source => source.sectionID === parent.id));
console.log('Continuing canonical packets passed: human subject fallback, bound child-index nomination, exact qualified ancestors, unchanged authority/pin/hash/cap guards.');
