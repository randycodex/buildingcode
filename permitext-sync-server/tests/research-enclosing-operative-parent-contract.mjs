import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { researchOperativeParentLink, researchParentChildReferenceLink } from '../research-rule-groups.mjs';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { assembleResearchEvidence, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('Enclosing-parent tests forbid providers.'); };
const sha = text => createHash('sha256').update(text).digest('hex');
const authority = { corpusID: 'independent-fixture-current', codeVersion: 'fixture-v1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, codePrefix, sectionNumber, title, text) => ({ ...authority, id, sectionID: id, codePrefix, sectionNumber, title,
  text, canonicalText: text, body: { blocks: [{ id: id + '-block', plainText: text }] } });
const withText = (source, text) => ({ ...source, text, canonicalText: text, body: { blocks: [{ id: source.id + '-block', plainText: text }] } });
const child = section('independent-grille-child', 'MC', '995.3.2', 'Inspection grilles',
  'Movable inspection grilles at access openings shall be classified as restricted locations. Exception: A fixed cover has the stated distinct qualification.');
const parent = section('independent-grille-parent', 'MC', '995.3', 'Enclosing requirements',
  'Locations specified in Sections 995.3.1 through 995.3.4 shall be provided with protection. Exception: An expressly qualified fixed enclosure retains its separate conditions.');
const question = 'Could a movable inspection grille stay at that access opening without protection?';
const index = await buildResearchPassageIndex([child], async s => s.body);
const candidate = { ...child, rank: 1, score: 1, signals: {}, indexedPassage: index.passages.find(p => p.sectionID === child.id) };
assert.equal(researchOperativeParentLink(parent, child)?.kind, 'child_range');
assert.equal(researchOperativeParentLink(withText(parent, 'Locations defined in Section 995.3.2 shall not be installed without protection.'), child)?.kind, 'literal_child');
assert.equal(researchOperativeParentLink(withText(parent, 'Inspection grilles shall comply with Section 995.3.2. A closing exception retains its complete conditions.'), child)?.kind, 'literal_child');
assert.equal(researchOperativeParentLink(withText(parent, 'Inspection grilles shall conform to Sections 995.3.1 and 995.3.2.'), child)?.kind, 'literal_child');
assert.equal(researchOperativeParentLink(withText(parent, 'Metal chutes and their bracing shall be installed in accordance with Section 995.3.2.'), child)?.kind, 'literal_child');
for (const text of [
  'Sections 995.3.1 through 995.3.4 describe inspection grilles, and workshop shelving shall be installed with anchorage.',
  'Refer to Sections 995.3.1 through 995.3.4 for inspection labels; workshop shelving shall be installed with anchorage.',
  'Refer to Sections 995.3.1 through 995.3.4. Workshop shelving shall be provided with protection.',
  'The note says “Locations specified in Sections 995.3.1 through 995.3.4 shall be provided with protection.”',
  'Locations specified in Sections 995.3.5 through 995.3.8 shall be provided with protection.',
  'Locations specified in Sections 995.3.1.1 through 995.3.4.1 shall be provided with protection.',
  'Locations specified in PC Section 995.3.2 shall be provided with protection.',
  'Locations specified in Section 995.3.2 of the Plumbing Code shall be provided with protection.',
  'Locations specified in Section 995.3.2 of the 2014 Mechanical Code shall be provided with protection.',
  'Locations specified in Section 995.3.2 shall not be required to have protection.',
  'Locations specified in Section 995.3.2 have suggested protection.'
]) assert.equal(researchOperativeParentLink(withText(parent, text), child), null, text);
assert.equal(researchOperativeParentLink({ ...parent, sectionNumber: '995' }, child), null);

const coolingChild = section('independent-cooling-child', 'MC', '996.4.3', 'Drainage detail',
  'Condensate produced by cooling coils and evaporators shall be discharged to an approved place of disposal without nuisance.');
const coolingIndex = await buildResearchPassageIndex([coolingChild], async s => s.body);
const coolingParent = section('independent-cooling-parent', 'MC', '996.4', 'Systems',
  'Systems shall be in accordance with Section 996.4.3. Exception: Sensible-only installations retain their stated distinct qualification.');
const coolingPacket = async text => assembleResearchEvidence({ question: 'Could an air conditioner drip its condensate onto the public walkway?',
  discover: async () => ({ candidates: [{ ...coolingChild, rank: 1, signals: {}, indexedPassage: coolingIndex.passages[0] }] }),
  resolveSection: async request => request.sectionID === coolingChild.id ? coolingChild
    : request.sectionNumber === coolingParent.sectionNumber ? withText(coolingParent, text) : null });
const oldValid = await coolingPacket(coolingParent.text);
assert(oldValid.sources.some(s => s.sectionID === coolingParent.id && s.qualifyingParentBodySHA256 === sha(coolingParent.text)),
  'Genuine vocabulary qualification retains its original admission semantics.');
assert.equal(researchParentChildReferenceLink(coolingParent, coolingChild)?.kind, 'literal_child');
for (const text of [
  'Systems shall be in accordance with Section 996.4.3 of the Plumbing Code. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with Section 996.4.3 of the 2014 Mechanical Code. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with PC Section 996.4.3. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with Sections 996.4.1 through 996.4.4 of the Plumbing Code. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with the Plumbing Code Section 996.4.3. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with the 2014 Mechanical Code Section 996.4.3. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with 2014 MC Section 996.4.3. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with Section 996.4.3 of the PC. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with Section 996.4.3 of the 2014 MC. Exception: Sensible-only installations retain their conditions.',
  'Systems shall be in accordance with Section 996.4.3 of the 2014 edition. Exception: Sensible-only installations retain their conditions.'
]) {
  assert.equal(researchParentChildReferenceLink(withText(coolingParent, text), coolingChild), null);
  assert(!(await coolingPacket(text)).sources.some(s => s.sectionID === coolingParent.id),
    'Legacy qualification cannot bypass the explicit child-reference authority.');
}
for (const reference of ['Section 996.4.3 of the 2022 Mechanical Code', 'Section 996.4.3 of MC',
  'Section 996.4.3 of the 2022 edition', 'the Mechanical Code Section 996.4.3',
  'the NYC 2022 Mechanical Code Section 996.4.3', '2022 MC Section 996.4.3']) {
  assert((await coolingPacket(coolingParent.text.replace('Section 996.4.3', reference))).sources.some(s => s.sectionID === coolingParent.id),
    'Own-book/edition qualification remains eligible: ' + reference);
}

const assemble = async ({ q = question, childChange = {}, parentChange = {}, candidateChange = {}, parentAvailable = true,
  previousMessages = [], topicContext = null, extra = {}, otherSources = [], otherCandidates = [] } = {}) => {
  const reads = [];
  const packet = await assembleResearchEvidence({ question: q, previousMessages, topicContext,
    discover: async () => ({ candidates: [{ ...candidate, ...candidateChange }, ...otherCandidates] }),
    resolveSection: async request => {
      reads.push(request);
      if (request.sectionID === child.id) return { ...child, ...childChange };
      if (request.sectionNumber === parent.sectionNumber && request.codePrefix === parent.codePrefix)
        return parentAvailable ? { ...parent, ...parentChange } : null;
      return otherSources.find(s => request.sectionID ? s.sectionID === request.sectionID
        : s.codePrefix === request.codePrefix && s.sectionNumber === request.sectionNumber) || null;
    }, ...extra });
  return { packet, reads };
};
const first = await assemble();
const supplied = first.packet.sources.find(s => s.sectionID === parent.id);
assert.equal(supplied?.text, parent.text);
assert(supplied.canonicalContextComplete && !supplied.truncated);
assert.equal(supplied.enclosingOperativeParent.linkKind, 'child_range');
assert.equal(supplied.enclosingOperativeParent.childSectionID, child.id);
assert.equal(supplied.enclosingOperativeParent.sourceTextSHA256, sha(parent.text));
assert.equal(supplied.qualifyingParentBodySHA256, sha(parent.text));
assert(supplied.relationship.includes('advisory scope') && supplied.relationship.includes('applicability requires review'));
assert.deepEqual(supplied.applicabilityScopeAnchors, [{ sourceID: first.packet.sources.find(s => s.sectionID === child.id).sourceID,
  sectionID: child.id, kind: 'parent_scope' }]);
assert.equal(supplied.evidencePriority.claimCoverageRequired, false);
assert(first.reads.filter(r => r.sectionNumber === parent.sectionNumber).length === 1);
assert(first.packet.usage.crossReferenceCount <= 6 && first.packet.usage.characterCount <= 48000);
// Whole discovered three-component children need their literal immediate parent
// even when the parent's grammar is not recognized as an operative obligation.
for (const text of [
  'Inspection grilles shall be installed where indicated in Sections 995.3.1 through 995.3.4.',
  'For Section 995.3.2, protection is unnecessary under the following complete qualification. Exception: The fixed-cover conditions remain distinct.',
  'Section 995.3.2 describes one of the locations. The enclosing scope retains its own conditions.',
  'Locations specified in Section 995.3.2 shall not be required to have protection.'
]) {
  const freshParent = withText(parent, text);
  assert(researchParentChildReferenceLink(freshParent, child));
  assert.equal(researchOperativeParentLink(freshParent, child), null, 'No operative grammar verdict is necessary.');
  const { packet, reads } = await assemble({ parentChange: freshParent });
  const advisory = packet.sources.find(s => s.sectionID === parent.id);
  assert.equal(advisory?.text, text);
  assert(advisory.canonicalContextComplete && !advisory.truncated && advisory.relationship.includes('advisory scope'));
  assert.equal(advisory.qualifyingParentBodySHA256, sha(text));
  for (const key of ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction']) assert.equal(advisory[key], child[key]);
  assert.equal(advisory.applicabilityScopeAnchors[0].sourceID, packet.sources.find(s => s.sectionID === child.id).sourceID);
  assert.equal(reads.filter(r => r.sectionNumber === parent.sectionNumber).length, 1);
  assert.equal(advisory.evidencePriority.claimCoverageRequired, false, 'Available context does not establish an independent determination.');
}
for (const text of [
  'Inspection grilles shall be installed where indicated in Sections 995.3.5 through 995.3.8.',
  'Inspection grilles shall be installed where indicated in Sections 995.3.1.1 through 995.3.4.1.',
  'Inspection grilles shall be installed where indicated in PC Section 995.3.2.',
  'Inspection grilles shall be installed where indicated in Section 995.3.2 of the 2014 Mechanical Code.',
  'The note says “Inspection grilles shall be installed where indicated in Section 995.3.2.”'
]) {
  const { packet } = await assemble({ parentChange: withText(parent, text) });
  assert(!packet.sources.some(s => s.sectionID === parent.id), 'Unbound references do not admit parent scope.');
  assert(packet.sources.find(s => s.sectionID === child.id).parentScopeContextGaps.some(g => g.reference === 'MC 995.3'));
}
const deeperChild = section('independent-deeper-child', 'MC', '795.6.3.2', child.title, child.text);
const deeperParent = section('independent-deeper-parent', 'MC', '795.6.3', 'Immediate context',
  'Inspection grilles shall be installed where indicated in Section 795.6.3.2. The enclosing condition remains part of this complete text.');
const deeperIndex = await buildResearchPassageIndex([deeperChild], async s => s.body);
const ancestorReads = [];
const deeper = await assembleResearchEvidence({ question,
  discover: async () => ({ candidates: [{ ...deeperChild, rank: 1, indexedPassage: deeperIndex.passages[0] }] }),
  resolveSection: async request => { ancestorReads.push(request);
    return request.sectionID === deeperChild.id ? deeperChild : request.sectionNumber === deeperParent.sectionNumber ? deeperParent : null; } });
assert.equal(deeper.sources.find(s => s.sectionID === deeperParent.id)?.text, deeperParent.text);
assert.equal(ancestorReads.filter(r => r.sectionNumber === deeperParent.sectionNumber).length, 1);
assert(!ancestorReads.some(r => r.sectionNumber === '795.6'), 'The immediate-parent lane does not promote an unbound grandparent.');
const shallowChild = section('independent-shallow-child', 'MC', '795.6', child.title, child.text);
const shallowIndex = await buildResearchPassageIndex([shallowChild], async s => s.body);
const shallowReads = [];
await assembleResearchEvidence({ question,
  discover: async () => ({ candidates: [{ ...shallowChild, rank: 1, indexedPassage: shallowIndex.passages[0] }] }),
  resolveSection: async request => { shallowReads.push(request); return request.sectionID === shallowChild.id ? shallowChild : null; } });
assert(!shallowReads.some(r => r.sectionNumber === '795'), 'A chapter hierarchy alone does not nominate a literal child parent.');
for (const parentChange of [{ id: '', sectionID: '' }, { sectionNumber: '995.4' }, { codePrefix: 'PC' }, { corpusID: 'foreign' },
  { codeVersion: 'stale' }, { codeEdition: '2014' }, { jurisdiction: 'Elsewhere' }, { jurisdiction: '' },
  { referenceOnly: true }, { selectionMode: 'section_reference' }, { truncated: true }, { textComplete: false },
  { canonicalContextComplete: false }, { authorityClass: 'guidance' }, { researchClaimEligible: false },
  { body: { ...parent.body, researchClaimEligible: false } }, { body: { ...parent.body, truncated: true } },
  { body: { blocks: [{ ...parent.body.blocks[0], truncated: true }] } },
  { text: parent.text, canonicalText: parent.text, body: { blocks: [{ ...parent.body.blocks[0], plainText: 'Another scope is available.' }] } },
  withText(parent, 'Inspection grille requirements. No enacted reference establishes an enclosing rule.')]) {
  assert(!(await assemble({ parentChange })).packet.sources.some(s => s.sectionID === parent.id), 'Fresh complete parent scope is independently authoritative.');
}
assert(!(await assemble({ parentAvailable: false })).packet.sources.some(s => s.sectionID === parent.id));
for (const childChange of [{ sectionID: 'wrong', id: 'wrong' }, { sectionNumber: '' }, { sectionNumber: '995.3.3' },
  { corpusID: '' }, { codeEdition: '' }, { jurisdiction: '' }, { referenceOnly: true }, { authorityStatus: 'guidance' },
  { body: { ...child.body, researchClaimEligible: false } }, { body: { ...child.body, truncated: true } },
  withText(child, child.text + ' Changed fresh canonical words.')]) {
  assert(!(await assemble({ childChange })).packet.sources.some(s => s.sectionID === parent.id), 'Candidate request identity cannot attest a fresh child.');
}
for (const indexedPassage of [{ ...candidate.indexedPassage, sourceTextHash: '0'.repeat(64) },
  { ...candidate.indexedPassage, scopeComplete: false },
  { ...candidate.indexedPassage, sourceOffsets: { ...candidate.indexedPassage.sourceOffsets, start: 1 } }]) {
  assert(!(await assemble({ candidateChange: { indexedPassage } })).packet.sources.some(s => s.sectionID === parent.id));
}
for (const candidateChange of [{ signals: { contextualReference: true } }, { signals: { historicalReference: true } },
  { signals: { useSelectedPassageOnly: true } }]) {
  assert(!(await assemble({ candidateChange })).packet.sources.some(s => s.sectionID === parent.id), JSON.stringify(candidateChange));
}
for (const q of ['Compare a movable inspection grille and a service access panel: what applies to both?',
  'Under the Plumbing Code, could a movable inspection grille stay at that access opening?',
  'Under the 2014 codes, could a movable inspection grille stay at that access opening?',
  'The drawing says “movable inspection grille at an access opening”. What permit fee applies?',
  'No inspection grille is proposed. Different issue: what is the filing fee?']) {
  assert(!(await assemble({ q })).packet.sources.some(s => s.sectionID === parent.id), q);
}
const history = [{ role: 'user', question }, { role: 'assistant', answer: { mode: 'openai', authorityStatus: 'supported_by_enacted_text',
  verification: { pass: true }, supportedPoints: [{ heading: 'Prior topic', explanation: 'This is not source authority.' }],
  citations: [{ ...child, text: undefined, body: undefined, evidenceRole: 'supporting', supportingPassages: [{ selectedText: child.text }] }] } }];
const continuation = await assemble({ q: 'The inspection grille is now movable at the access opening. Does that change the requirement?',
  previousMessages: history, topicContext: { rootTopic: question, currentTopic: question },
  candidateChange: { rank: 3, signals: { inheritedAuthorityReference: true,
    currentQuestionLexicalReservation: { kind: 'active_checked_rule_current_detail' } } } });
assert(continuation.packet.sources.some(s => s.sectionID === parent.id), 'A checked hint does not defeat independent fresh current child qualification.');
assert(!(await assemble({ q: 'What fee applies now?', previousMessages: history, topicContext: { rootTopic: question, currentTopic: question },
  candidateChange: { rank: 3, signals: { inheritedAuthorityReference: true,
    currentQuestionLexicalReservation: { kind: 'active_checked_rule_current_detail' } } } })).packet.sources.some(s => s.sectionID === parent.id), 'Prior assistant permission cannot create a current source match.');
for (const rank of [3, 9]) assert((await assemble({ candidateChange: { rank } })).packet.sources.some(s => s.sectionID === parent.id),
  'An independently current-responsive delivered child is not excluded by incidental discovery rank.');
assert(!(await assemble({ q: 'What filing fee applies?', candidateChange: { rank: 1 } })).packet.sources.some(s => s.sectionID === parent.id),
  'Leading rank is not current-topic authority.');
const shortHuman = await assemble({ q: 'Does that change anything?',
  previousMessages: [{ role: 'user', question }, { role: 'user', question: 'Correction: the grille is movable now.' }],
  topicContext: { rootTopic: question, currentTopic: 'Correction: the grille is movable now.' } });
assert(shortHuman.packet.sources.some(s => s.sectionID === parent.id), 'A short application question may retain an independently matching active human subject.');
const assistantOnly = await assemble({ q: 'Does that change anything?', previousMessages: [{ role: 'assistant', answer: { answerText: question } }],
  topicContext: { rootTopic: question, currentTopic: question } });
assert(!assistantOnly.packet.sources.some(s => s.sectionID === parent.id), 'Assistant permission does not supply the human subject.');
const switchedShort = await assemble({ q: 'Does that change anything?', previousMessages: [{ role: 'user', question },
  { role: 'user', question: 'Different issue: what filing fee applies?' }],
  topicContext: { rootTopic: 'Different issue: what filing fee applies?', currentTopic: 'Different issue: what filing fee applies?' } });
assert(!switchedShort.packet.sources.some(s => s.sectionID === parent.id), 'A short continuation cannot revive a switched-away human subject.');
const ambientChild = section('ambient-child', 'MC', '995.3.2', 'Ambient temperatures',
  'Ambient temperature at raised platforms is classified in this category.');
const ambientParent = withText(parent, 'Locations specified in Sections 995.3.1 through 995.3.4 shall be provided with temperature monitoring.');
const ambientIndex = await buildResearchPassageIndex([ambientChild], async s => s.body);
const incidental = await assemble({ q: 'Under the Mechanical Code, must a ventilation grille at the raised platform be screened?',
  childChange: ambientChild, parentChange: ambientParent, candidateChange: { ...ambientChild, indexedPassage: ambientIndex.passages[0] } });
assert(!incidental.packet.sources.some(s => s.sectionID === parent.id), 'Incidental shared location words cannot qualify a different requested subject.');
const unrelatedTitle = await assemble({ childChange: { title: 'Operative category' },
  candidateChange: { title: 'Operative category' } });
assert(unrelatedTitle.packet.sources.some(s => s.sectionID === parent.id), 'A fresh own enacted subject can qualify despite a different heading label.');
const ordinaryDifference = await assemble({ q: 'The inspection grille is movable at the access opening. Does that make a difference?' });
assert(ordinaryDifference.packet.sources.some(s => s.sectionID === parent.id), 'An ordinary applicability correction is not an authority comparison.');
const pcChild = section('service-panel-child', 'PC', '731.5.3', 'Service panels', 'Movable service panels at access openings shall be classified as restricted locations.');
const pcParent = section('service-panel-parent', 'PC', '731.5', 'Enclosing requirements', 'Locations defined in Section 731.5.3 shall be provided with protection. Exception: An expressly qualified enclosure retains all conditions.');
const pcIndex = await buildResearchPassageIndex([pcChild], async s => s.body);
const parallel = await assemble({ q: 'Do both the movable inspection grille and movable service panel need protection at their access openings?',
  otherSources: [pcChild, pcParent], otherCandidates: [{ ...pcChild, rank: 2, score: .9, signals: {}, indexedPassage: pcIndex.passages[0] }] });
assert.equal(parallel.packet.sources.filter(s => s.enclosingOperativeParent).length, 2);
assert.equal(parallel.reads.filter(r => [parent.sectionNumber, pcParent.sectionNumber].includes(r.sectionNumber)).length, 2);
assert(parallel.packet.usage.crossReferenceCount <= 6);
const sibling = section('second-grille-child', 'MC', '995.3.3', child.title, child.text);
const siblingIndex = await buildResearchPassageIndex([sibling], async s => s.body);
const common = await assemble({ otherSources: [sibling], otherCandidates: [{ ...sibling, rank: 2, score: .9, signals: {}, indexedPassage: siblingIndex.passages[0] }] });
assert.equal(common.packet.sources.filter(s => s.sectionID === parent.id).length, 1);
assert.equal(common.reads.filter(r => r.sectionNumber === parent.sectionNumber).length, 1);
assert.equal(common.packet.sources.find(s => s.sectionID === parent.id).applicabilityScopeAnchors.length, 2);
const partialRange = await assemble({ parentChange: withText(parent, 'Inspection grilles shall be installed where indicated in Section 995.3.2.'),
  otherSources: [sibling], otherCandidates: [{ ...sibling, rank: 2, score: .9, signals: {}, indexedPassage: siblingIndex.passages[0] }] });
assert.equal(partialRange.packet.sources.find(s => s.sectionID === parent.id).applicabilityScopeAnchors.length, 1,
  'A deduplicated parent cannot create an unverified relation to another child.');
assert(partialRange.packet.sources.find(s => s.sectionID === sibling.id).parentScopeContextGaps.some(g => g.reference === 'MC 995.3'));
const oneSlot = await assemble({ q: 'Do both the movable inspection grille and movable service panel need protection at their access openings?',
  otherSources: [pcChild, pcParent], otherCandidates: [{ ...pcChild, rank: 2, score: .9, signals: {}, indexedPassage: pcIndex.passages[0] }],
  extra: { limits: { maximumCrossReferences: 1 } } });
assert.equal(oneSlot.packet.sources.filter(s => s.enclosingOperativeParent).length, 1);
assert(oneSlot.packet.sources.some(s => s.sectionID === child.id) && oneSlot.packet.sources.some(s => s.sectionID === pcChild.id),
  'A dependency cap cannot discard either direct child.');
assert(oneSlot.packet.sources.find(s => s.sectionID === pcChild.id).parentScopeContextGaps.some(g => g.reference === 'PC 731.5'),
  'A parent excluded by existing slots remains an explicit gap.');
assert.equal(oneSlot.reads.filter(r => r.sectionNumber === pcParent.sectionNumber).length, 0);
const speculativeChildren = Array.from({ length: 5 }, (_, i) => section('speculative-child-' + i, 'MC', (990 + i) + '.7.2', child.title, child.text));
const speculativeIndex = await buildResearchPassageIndex(speculativeChildren, async s => s.body);
const speculativeReads = [];
const speculativePacket = await assembleResearchEvidence({ question, discover: async () => ({ candidates: speculativeChildren.map((s, i) => ({ ...s, rank: i + 1,
  indexedPassage: speculativeIndex.passages.find(p => p.sectionID === s.id) })) }),
  resolveSection: async request => { speculativeReads.push(request);
    return request.sectionID ? speculativeChildren.find(s => s.id === request.sectionID) : null; } });
assert.equal(speculativeReads.filter(r => speculativeChildren.some(s => s.sectionNumber.split('.').slice(0, -1).join('.') === r.sectionNumber)).length, 4,
  'Unavailable enclosing bodies remain bounded by the existing four-read lane.');
assert(speculativePacket.sources.filter(s => speculativeChildren.some(c => c.id === s.sectionID)).every(s =>
  s.parentScopeContextGaps?.some(g => g.reference === 'MC ' + s.sectionNumber.split('.').slice(0, -1).join('.'))),
  'Unavailable and unread parent contexts remain explicit for every admitted child.');
const extraReferences = Array.from({ length: 7 }, (_, i) => section('generic-reference-' + i, 'MC', '880.' + (i + 1), 'Optional reference', 'Optional complete context.'));
const referencedChild = { ...withText(child, child.text + ' ' + extraReferences.map(s => 'See Section ' + s.sectionNumber + '.').join(' ')),
  crossReferences: extraReferences.map(s => ({ codePrefix: s.codePrefix, sectionNumber: s.sectionNumber })) };
const referencedIndex = await buildResearchPassageIndex([referencedChild], async s => s.body);
const competed = await assemble({ childChange: referencedChild, otherSources: extraReferences,
  candidateChange: { ...referencedChild, indexedPassage: referencedIndex.passages[0] } });
assert(competed.packet.sources.some(s => s.sectionID === parent.id), 'Literal parent context wins an existing slot before generic expansion.');
assert.equal(competed.packet.usage.crossReferenceCount, 6);
const oversized = withText(parent, parent.text + ' Complete remaining parent qualification.'.repeat(100));
const small = await assemble({ parentChange: oversized, extra: { limits: { maximumCharacters: 1100, maximumCharactersPerSource: 900 } } });
assert(!small.packet.sources.some(s => s.sectionID === parent.id));
assert(small.packet.limitations.some(l => l.kind === 'current-action-parent-context-budget'));
assert(small.packet.sources.some(s => s.sectionID === child.id), 'An oversized enclosing context cannot discard the current child.');
assert(small.packet.usage.characterCount <= 1100);
assert(small.packet.sources.find(s => s.sectionID === child.id).parentScopeContextGaps.some(g => g.reference === 'MC 995.3'));
const strictQuestion = 'Based only on the selected passage, ' + question;
const pin = { ...child, selectedText: child.text, selectionMode: 'passage' };
let broad = 0;
const strict = await assembleResearchEvidence({ question: strictQuestion, pinnedEvidence: [pin],
  strategy: researchEvidenceStrategyForTurn({ question: strictQuestion, pinnedEvidence: [pin] }),
  discover: async () => { broad++; return { candidates: [candidate] }; }, resolveSection: async () => child });
assert.equal(broad, 0); assert.equal(strict.sources.length, 1); assert.equal(strict.sources[0].text, child.text);

let realProof = null;
if (process.argv.includes('--real-corpus')) {
  Object.assign(process.env, { NODE_ENV: 'test', PERMITEXT_EVIDENCE_DISCOVERY_BETA: '1', PERMITEXT_RESEARCH_PASSAGE_SEARCH: '1',
    PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: '1', PERMITEXT_RESEARCH_SEMANTIC_SEARCH: '0', PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: '1' });
  const app = await import('../app.mjs');
  const B3 = 'Another detail: a swinging door has a small plain-glass viewing opening only two inches across, so a three-inch ball cannot pass through it. Does the door-glazing rule require safety glazing for that opening?';
  const B4 = 'The opening is being enlarged so a three-inch ball can pass through. It is still plain glass in the swinging door. Does that change the answer?';
  const resources = await app.researchCorpusResources(await app.researchCorpusPlanForTurn({ question: B3, messages: [], projectFacts: [] }));
  const resolve = async descriptor => {
    const s = resources.catalog.find(s => descriptor.sectionID ? String(s.id) === String(descriptor.sectionID)
      : s.codePrefix === descriptor.codePrefix && s.sectionNumber === descriptor.sectionNumber);
    if (!s) return null;
    const body = await app.researchBodyForCatalogSection(s);
    const v = { ...s, sectionID: String(s.id), body, text: body.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n') };
    return { ...v, crossReferences: app.researchAssemblyCrossReferences(v, resources.catalog) };
  };
  const classification = await resolve({ codePrefix: 'BC', sectionNumber: '2406.4.1' });
  const enclosing = await resolve({ codePrefix: 'BC', sectionNumber: '2406.4' });
  const otherCanonicalLinks = [];
  for (const [book, parentNumber, childNumber] of [['MC', '313.3.2', '313.3.2.1'], ['PC', '1102.2', '1102.2.1']]) {
    const completeParent = await resolve({ codePrefix: book, sectionNumber: parentNumber });
    const completeChild = await resolve({ codePrefix: book, sectionNumber: childNumber });
    assert(completeParent && completeChild);
    const link = researchOperativeParentLink(completeParent, completeChild);
    assert(link, book + ' complete canonical delegation');
    otherCanonicalLinks.push({ parentReference: book + ' ' + parentNumber, childReference: book + ' ' + childNumber,
      parentBody: completeParent.text, parentSHA256: sha(completeParent.text), childSHA256: sha(completeChild.text), link,
      corpusID: completeParent.corpusID, codeEdition: completeParent.codeEdition });
  }
  const known = [{ role: 'user', question: B3 }, { role: 'assistant', answer: { mode: 'openai', authorityStatus: 'supported_by_enacted_text',
    verification: { pass: true }, supportedPoints: [{ text: 'The prior answer applies the small-opening exception.' }],
    citations: [{ ...classification, text: undefined, body: undefined, evidenceRole: 'supporting', supportingPassages: [{ selectedText: classification.text }] }] } }];
  realProof = { catalogCount: resources.catalog.length, passageCount: resources.passageIndex.passages.length, providerCalls: 0,
    otherCanonicalLinks, canonicalParent: { sectionID: enclosing.sectionID, codeEdition: enclosing.codeEdition, corpusID: enclosing.corpusID, text: enclosing.text, sha256: sha(enclosing.text) }, turns: [],
    limitations: ['Empty facts and constructed checked history; mock uses delivered references, not actual hosted semantic ranking. Retrieval/assembly proof is not generated-answer correctness.'] };
  for (const [name, q, messages] of [['B3-initial', B3, []], ['B4-human', B4, [{ role: 'user', question: B3 }]], ['B4-checked', B4, known]]) {
    const accounting = JSON.parse(fs.readFileSync('/tmp/permitext-production-v36-' + (name === 'B3-initial' ? 'B3' : 'B4') + '.accounting.json'));
    const mockHits = accounting.evidenceReferences.flatMap(ref => {
      const s = resources.catalog.find(s => s.codePrefix + ' ' + s.sectionNumber === ref);
      const p = s && resources.passageIndex.passages.find(p => String(p.sectionID) === String(s.id)); return p ? [p] : [];
    });
    for (const mode of ['lexical', 'mock_actual_reference_competition']) {
      let found; const reads = [];
      const packet = await assembleResearchEvidence({ question: q, previousMessages: messages, projectFacts: [],
        topicContext: messages.length ? { rootTopic: B3, currentTopic: B3 } : null,
        discover: async request => { assert.equal(request.retrievalContext.currentQuestion, q);
          found = await discoverRelevantEvidence({ question: request.question, retrievalContext: request.retrievalContext, ...resources,
            limit: request.limit, readSectionBody: app.researchBodyForCatalogSection,
            ...(mode === 'lexical' ? {} : { semanticSearch: { search: async () => ({ hits: mockHits.map((p, i) => ({ ...p, score: 1 - i / 100, passages: [p] })), metadata: { enabled: true, mockProvider: true } }) } }) }); return found; },
        resolveSection: async r => { reads.push(r); return resolve(r); } });
      const actualParent = packet.sources.find(s => s.sectionID === enclosing.sectionID);
      const actualChild = packet.sources.find(s => s.sectionID === classification.sectionID);
      if (!actualParent && process.env.PERMITEXT_ENCLOSING_PARENT_DIAGNOSTICS === '1') console.error(JSON.stringify({ name, mode,
        query: packet.query, candidates: found.candidates.map(s => ({ reference: s.codePrefix + ' ' + s.sectionNumber, rank: s.rank, signals: s.signals,
          indexedSection: s.indexedPassage?.subsectionNumber, scope: s.indexedPassage?.scopeComplete })),
        sources: packet.sources.map(s => ({ reference: s.codePrefix + ' ' + s.sectionNumber, title: s.title, complete: s.canonicalContextComplete,
          text: s.sectionID === classification.sectionID ? s.text : undefined })), reads, usage: packet.usage, limitations: packet.limitations }));
      assert(actualParent && !actualParent.truncated && actualParent.canonicalContextComplete && actualParent.text.includes(enclosing.text), name + '/' + mode);
      assert(actualChild && !actualChild.truncated && actualChild.text.includes(classification.text));
      assert.equal(actualParent.enclosingOperativeParent.sourceTextSHA256, sha(enclosing.text));
      assert.equal(actualParent.evidencePriority.claimCoverageRequired, false);
      assert(packet.usage.crossReferenceCount <= 6 && packet.usage.discoveredCount <= 10 && packet.usage.characterCount <= 48000 && found.candidates.length <= 12);
      realProof.turns.push({ name, mode, question: q, parentText: actualParent.text, parentSHA256: sha(actualParent.text),
        parentMetadata: actualParent.enclosingOperativeParent, childComplete: true,
        parentReads: reads.filter(r => r.codePrefix === enclosing.codePrefix && r.sectionNumber === enclosing.sectionNumber).length,
        sources: packet.sources.map(s => ({ reference: s.codePrefix + ' ' + s.sectionNumber, length: s.text.length, sha256: sha(s.text) })), usage: packet.usage });
    }
  }
  const output = process.argv.find(s => s.startsWith('--output='))?.slice(9);
  if (output) fs.writeFileSync(output, JSON.stringify({ schema: 'permitext-v37-real-corpus-parent-proof-v1', realProof, providerCalls }, null, 2) + '\n');
}
assert.equal(providerCalls, 0);
console.log(JSON.stringify({ contract: 'enclosing-operative-parent', providers: 0, syntheticFamilies: 2,
  parallelAndCommonParents: true, realTurns: realProof?.turns.length || 0, generatedAnswerAccuracyClaim: false }));
