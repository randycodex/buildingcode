import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';
import { boundCanonicalRulePassage, nearestCompleteIndexedRuleGroup, registeredDelegatedRuleChildren } from '../research-rule-groups.mjs';

globalThis.fetch = () => { throw Error('Providers forbidden'); };
const authority = { codePrefix: 'MC', corpusID: 'synthetic-current', codeVersion: 'v1', codeEdition: '2022', jurisdiction: 'NYC' };
const section = (id, number, title, text, refs = []) => ({ ...authority, id, sectionID: id, sectionNumber: number, title,
  text, canonicalText: text, crossReferences: refs, body: { blocks: [{ id: id + '-body', plainText: text }] } });
const passage = (value, number = value.sectionNumber, start = 0, end = value.text.length) => ({ ...authority,
  id: value.id + '-' + number, sectionID: value.id, subsectionNumber: number,
  text: value.text.slice(start, end), contextTexts: [], scopeComplete: true,
  sourceTextHash: createHash('sha256').update(value.text).digest('hex'),
  sourceOffsets: { blockID: value.id + '-body', start, end } });
const lead = '990.8 Mounting.\nThe appliance mounting retains the listed conditions.\n';
const top = '990.8.1 Upper mounting.\nThe top of the appliance retains the listed dimension.\n';
const bottom = '990.8.2 Lower mounting.\nThe bottom of the appliance retains its specified floor clearance. Exception: Protected housings retain their complete separate method.\n';
const groupText = lead + top + bottom;
const chapter = section('chapter', '990', 'Appliances', '990.1 Other preliminary scope.\n' + 'Unrelated introduction. '.repeat(1000) + '\n\n' + groupText + '990.9 Other scope.\n' + 'Unrelated ending. '.repeat(200));
const groupStart = chapter.text.indexOf(lead), childStart = chapter.text.indexOf(top);
// Published parent locators bind the lead-in only. The separately indexed
// completeSubsectionText contains its whole later subtree.
const embeddedIndex = await buildResearchPassageIndex([chapter], async value => value.body);
const parent = embeddedIndex.passages.find(p => p.subsectionNumber === '990.8');
const child = embeddedIndex.passages.find(p => p.subsectionNumber === '990.8.1');
assert(parent && child);
assert.equal(parent.scopeComplete, false);
assert.equal(parent.sourceOffsets.end, child.sourceOffsets.start);
assert(parent.completeSubsectionText.includes(bottom));
const mountingQuestion = 'What mounting limits apply to the bottom floor clearance of the appliance?';
assert.equal(nearestCompleteIndexedRuleGroup(chapter, child, [parent], 1000, mountingQuestion)?.id, parent.id);
for (const invalid of [ { ...parent, completeSubsectionText: undefined }, { ...parent, sourceTextHash: '0'.repeat(64) },
  { ...parent, completeSubsectionText: parent.completeSubsectionText.split('Exception:')[0] },
  { ...parent, codeEdition: '2014' }, { ...parent, sectionID: 'unregistered' },
  { ...parent, sourceOffsets: { ...parent.sourceOffsets, end: parent.sourceOffsets.end - 1 } } ])
  assert.equal(nearestCompleteIndexedRuleGroup(chapter, child, [invalid], 1000, mountingQuestion), null);
assert.equal(nearestCompleteIndexedRuleGroup(chapter, child, [parent], groupText.replace(/\s+/g, ' ').trim().length - 1, mountingQuestion), null);
for (const invalid of [ { ...chapter, truncated: true }, { ...chapter, body: { ...chapter.body, truncated: true } },
  { ...chapter, body: { blocks: [{ ...chapter.body.blocks[0], researchClaimEligible: false }] } } ])
  assert.equal(boundCanonicalRulePassage(invalid, child), false);
const groupResult = await assembleResearchEvidence({ question: mountingQuestion, pinnedEvidence: [],
  discover: async () => ({ candidates: [{ ...chapter, rank: 1, indexedPassage: { ...child, alternatives: [parent] } }] }),
  resolveSection: async () => chapter, limits: { maximumCharacters: 1200, maximumCharactersPerSource: 1000,
    maximumDiscovered: 1, maximumCrossReferences: 0, maximumTargetedDefinitions: 0 } });
assert(groupResult.sources[0].text.includes(bottom.trim()), 'The fitting parent includes its later complete sibling exception.');
assert.equal(groupResult.sources[0].indexedPassage.subsectionNumber, '990.8');
assert.deepEqual(groupResult.sources[0].indexedPassage.sourceOffsets, parent.sourceOffsets, 'Original lead-in offsets stay intact.');
assert.equal(groupResult.sources[0].indexedPassage.completeScopeOffsets.end,
  parent.sourceOffsets.start + parent.completeSubsectionText.length, 'Full group has a distinct exact raw scope.');
assert.equal(chapter.text.slice(groupResult.sources[0].indexedPassage.completeScopeOffsets.start,
  groupResult.sources[0].indexedPassage.completeScopeOffsets.end), parent.completeSubsectionText);
assert.equal(groupResult.sources[0].canonicalContextComplete, false, 'Complete group is not labeled a whole chapter.');

const stub = section('parent', '991.1', 'Opening dimensions', '991.1 Opening dimensions.\nThe minimum width and height of each equipment opening shall be in accordance with this section.');
const sizing = section('sizing', '991.1.1', 'Equipment opening width', '991.1.1 Equipment opening width.\nMeasure the clear equipment opening width between its stated boundaries in the listed open position. Exception: Approved reduced openings retain all stated alternative conditions.');
const irrelevant = section('other', '991.1.2', 'Finishes', '991.1.2 Finishes.\nRetain the prescribed finish.');
const auxiliary = section('auxiliary', '991.4.2', 'Auxiliary panels', '991.4.2 Auxiliary panels.\nAuxiliary equipment opening width shall comply with Section 991.1.',
  [{ codePrefix: 'MC', sectionNumber: '991.1', sectionID: stub.id }]);
const values = [auxiliary, stub, sizing, irrelevant];
const index = await buildResearchPassageIndex(values, async value => value.body);
const widthQuestion = 'How do we measure the clear equipment opening width when the auxiliary panel is open?';
const discovery = await discoverRelevantEvidence({ question: widthQuestion, catalog: values, passageIndex: index,
  invertedIndex: new Map(), readSectionBody: async value => value.body, limit: 1,
  semanticSearch: { search: async () => ({ hits: [{ ...index.passages.find(p => p.sectionID === auxiliary.id), score: 1 }], metadata: {} }) } });
assert.equal(discovery.delegatingRuleGroups.length, 1);
assert.equal(discovery.delegatingRuleGroups[0].children[0].sectionID, sizing.id);
assert(!discovery.delegatingRuleGroups[0].children.some(value => value.sectionID === irrelevant.id));
const controlled = { ...discovery, candidates: [{ ...auxiliary, rank: 1, selectedText: auxiliary.text }] };
async function assemble({ mutate = value => value, maximumCharacters = 3000, pins = [], selectedOnly = false, groups = controlled.delegatingRuleGroups, question = widthQuestion } = {}) {
  const reads = new Map();
  const result = await assembleResearchEvidence({ question, pinnedEvidence: pins,
    strategy: pins.length ? { mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' } : null,
    discover: async () => ({ ...controlled, delegatingRuleGroups: groups, candidates: controlled.candidates.map(candidate =>
      selectedOnly ? { ...candidate, signals: { useSelectedPassageOnly: true }, selectedText: 'Auxiliary equipment opening width.' } : candidate) }),
    resolveSection: async request => {
      const value = values.find(value => request.sectionID ? value.id === request.sectionID : value.sectionNumber === request.sectionNumber);
      if (value) reads.set(value.id, (reads.get(value.id) || 0) + 1);
      return value ? mutate(value) : null;
    }, limits: { maximumCharacters, maximumCharactersPerSource: 1000, maximumDiscovered: 1,
      maximumCrossReferences: 2, maximumTargetedDefinitions: 0 } });
  return { result, reads };
}
const recovered = await assemble();
assert.equal(recovered.result.sources.find(source => source.sectionID === sizing.id)?.text, sizing.text);
assert.equal(recovered.result.usage.crossReferenceCount, 2);
assert.equal(recovered.reads.get(stub.id), 1);
assert.equal(recovered.reads.get(sizing.id), 1);
assert(recovered.result.sources.find(source => source.sectionID === stub.id)?.canonicalContextComplete);
assert.match(recovered.result.sources.find(source => source.sectionID === sizing.id).relationship, /not a complete child-group claim/);
assert(recovered.result.usage.characterCount <= 3000);
assert.equal(recovered.result.usage.characterCount, recovered.result.sources.reduce((sum, source) => sum + source.text.length, 0));
const weakParent = await assemble({ question: 'What are the auxiliary equipment boundaries?' });
assert(weakParent.result.sources.some(source => source.sectionID === sizing.id),
  'A literal linked, exact delegating parent need not repeat the responsive child terminology.');
const unrelatedDetail = await assemble({ question: 'What finish does the auxiliary equipment require?' });
assert(!unrelatedDetail.result.sources.some(source => source.sectionID === sizing.id),
  'A nominated child still requires substantive current-detail overlap after a topic/detail change.');
for (const [name, mutate] of [
  ...['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction'].map(field => [field, value => value.id === sizing.id ? { ...value, [field]: 'foreign' } : value]),
  ['missing exception', value => value.id === sizing.id ? { ...value, text: value.text.split('Exception:')[0], canonicalText: value.text.split('Exception:')[0], body: { blocks: [{ ...value.body.blocks[0], plainText: value.text.split('Exception:')[0] }] } } : value],
  ['ineligible block', value => value.id === sizing.id ? { ...value, body: { blocks: [{ ...value.body.blocks[0], researchClaimEligible: false }] } } : value],
  ['truncated body', value => value.id === sizing.id ? { ...value, body: { ...value.body, truncated: true } } : value],
  ['extra block', value => value.id === sizing.id ? { ...value, body: { blocks: [...value.body.blocks, { id: 'qualifier', plainText: 'Additional condition.' }] } } : value],
]) {
  const invalid = await assemble({ mutate });
  assert(!invalid.result.sources.some(source => source.sectionID === sizing.id), name);
  assert.equal(invalid.reads.get(sizing.id), 1, name + ': rejected source is not reread');
}
assert(!((await assemble({ maximumCharacters: auxiliary.text.length + stub.text.length + sizing.text.length - 1 })).result.sources.some(source => source.sectionID === sizing.id)), 'Whole child over remaining budget is omitted.');
assert(!((await assemble({ selectedOnly: true })).result.sources.some(source => source.sectionID === sizing.id)));
assert.equal((await assemble({ pins: [{ ...auxiliary, userSelectedText: 'Auxiliary equipment opening width.', selectedText: 'Auxiliary equipment opening width.' }] })).result.sources.length, 1);
assert.equal(registeredDelegatedRuleChildren(stub, [passage(sizing)], [], widthQuestion).length, 0, 'Orphan children cannot be inferred from a number.');
assert.equal(registeredDelegatedRuleChildren(stub, [{ ...passage(sizing), scopeComplete: false }], [sizing], widthQuestion).length, 0);
assert.equal(registeredDelegatedRuleChildren({ ...stub, text: 'Retain the listed requirements.' }, [passage(sizing)], [sizing], widthQuestion).length, 0, 'A broad ordinary parent does not delegate children.');
console.log('Complete rule groups passed: exact fitting parent scope; one fresh complete registered child; pins, authority, qualifiers, eligibility, reads and caps preserved.');
