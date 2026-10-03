import assert from 'node:assert/strict';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { boundCanonicalRulePassage, nearestCompleteIndexedRuleGroup,
  nominateNearestCompleteIndexedRuleGroup } from '../research-rule-groups.mjs';

globalThis.fetch = () => { throw Error('Providers forbidden'); };
const authority = { codePrefix: 'MC', corpusID: 'synthetic-current', codeVersion: 'v1', codeEdition: '2022', jurisdiction: 'NYC' };
const section = (id, number, text, extra = {}) => ({ ...authority, id, sectionNumber: number, title: 'Appliance installations',
  body: { blocks: [{ id: id + '-body', plainText: text }] }, ...extra });
const lead = '990.8 Appliance mounting.\nPortable appliance mounting shall comply with the following complete conditions.\n';
const upper = '990.8.1 Upper mounting.\nThe top of the portable appliance shall retain its specified mounting limit.\n';
const lower = '990.8.2 Lower mounting.\nThe bottom of the portable appliance shall retain its specified floor clearance.\nException: Protected housings must satisfy the complete listed alternative conditions.\n';
const whole = '990.1 Preliminary scope.\n' + 'Other preliminary conditions. '.repeat(600) + '\n' + lead + upper + lower +
  '990.9 Other appliances.\nOther equipment retains its complete separate conditions.\n';
const value = section('chapter', '990', whole);
const index = await buildResearchPassageIndex([value], async item => item.body);
const parent = index.passages.find(p => p.subsectionNumber === '990.8');
const child = index.passages.find(p => p.subsectionNumber === '990.8.1');
const question = 'What mounting limits apply to the bottom floor clearance of a portable appliance?';
const selected = { section: value, body: value.body, indexedPassage: { ...child, passages: [child], alternatives: [] } };
assert(parent && child);
assert(!selected.indexedPassage.passages.includes(parent));
assert.equal(parent.scopeComplete, false, 'The raw parent lead-in is not incorrectly labeled the whole subtree.');
assert.equal(nominateNearestCompleteIndexedRuleGroup(selected, index, question, { maximumCharacters: 1000 }), parent,
  'The complete parent is located in the full index without injection into search alternatives.');
assert.equal(selected.indexedPassage.alternatives.length, 0, 'Nomination does not mutate ranking, selection or caller arrays.');
assert(parent.completeSubsectionText.includes(lower));
assert.equal(nearestCompleteIndexedRuleGroup({ ...value, text: whole }, child, [parent], 1000, question), parent,
  'The nominated record still passes the existing fresh assembly binding.');
assert.equal(boundCanonicalRulePassage({ ...value, text: whole }, parent, false, true), true);

const renderedLength = [...new Set([...(parent.contextTexts || []), parent.completeSubsectionText].map(text =>
  text.replace(/\s+/g, ' ').trim()))].join('\n\n').length;
assert.equal(nominateNearestCompleteIndexedRuleGroup(selected, index, question,
  { maximumCharacters: renderedLength - 1 }), null, 'A complete group over its allowance is omitted atomically.');
assert.equal(nominateNearestCompleteIndexedRuleGroup(selected, index, 'What refrigerant pressure is permitted?'), null,
  'A changed current subject cannot use the old selected child as parent authority.');
for (const extra of [{ useSelectedPassageOnly: true }, { signals: { useSelectedPassageOnly: true } },
  { contextualReference: true }, { contextualAuthorityReference: true },
  { inheritedReference: true }, { inheritedAuthorityReference: true }])
  assert.equal(nominateNearestCompleteIndexedRuleGroup({ ...selected, ...extra }, index, question), null,
    'Selection/context-only boundaries are not broadened.');
for (const field of ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction']) {
  assert.equal(nominateNearestCompleteIndexedRuleGroup({ ...selected, section: { ...value, [field]: 'foreign' } }, index, question), null,
    'The selected ' + field + ' must match its authorized registration.');
  assert.equal(nominateNearestCompleteIndexedRuleGroup({ ...selected, indexedPassage: { ...selected.indexedPassage, [field]: 'foreign' } }, index, question), null,
    'Supplied passage ' + field + ' conflicts are rejected.');
}
assert.equal(parent.jurisdiction, undefined, 'The actual v2 index intentionally omits jurisdiction.');
assert.equal(nominateNearestCompleteIndexedRuleGroup(selected, index, question, { maximumCharacters: 1000 }), parent,
  'Absent index jurisdiction is bound through the authorized registered source rather than fabricated metadata.');
for (const extra of [{ text: child.text.replace('portable', 'altered') }, { sourceTextHash: '0'.repeat(64) },
  { sourceOffsets: { ...child.sourceOffsets, end: child.sourceOffsets.end - 1 } }, { scopeComplete: false },
  { completeSubsectionText: child.completeSubsectionText + ' Invented condition.' }, { id: 'unregistered' }])
  assert.equal(nominateNearestCompleteIndexedRuleGroup({ ...selected, indexedPassage: { ...selected.indexedPassage, ...extra } }, index, question), null);
for (const body of [{ ...value.body, truncated: true }, { blocks: [] },
  { blocks: [{ ...value.body.blocks[0], researchClaimEligible: false }] },
  { blocks: [{ ...value.body.blocks[0], truncated: true }] },
  { blocks: [{ ...value.body.blocks[0], plainText: whole.replace('complete listed alternative', 'changed alternative') }] }])
  assert.equal(nominateNearestCompleteIndexedRuleGroup({ ...selected, body }, index, question), null,
    'Fresh source completeness, eligibility and block hashes remain mandatory.');
assert.equal(nominateNearestCompleteIndexedRuleGroup({ ...selected, body: null, section: { ...value, body: null } }, index, question), null);
assert.equal(nominateNearestCompleteIndexedRuleGroup({ ...selected, section: { ...value, jurisdiction: '' } }, index, question), null);
assert.equal(nominateNearestCompleteIndexedRuleGroup(selected, { ...index, sections: new Map() }, question), null,
  'An index record cannot bypass canonical registration in the authorized selected corpus.');

function replacingParent(extra) {
  const replacement = { ...parent, ...extra };
  return { ...index, passages: index.passages.map(p => p === parent ? replacement : p),
    passagesByID: new Map([...index.passagesByID].map(([id, p]) => [id, p === parent ? replacement : p])) };
}
for (const extra of [{ subsectionNumber: '990' }, { kind: 'table_row' }, { jurisdiction: 'foreign' },
  { sectionID: 'foreign-section' }, { sourceTextHash: '0'.repeat(64) },
  { completeSubsectionText: parent.completeSubsectionText.split('Exception:')[0] },
  { sourceOffsets: { ...parent.sourceOffsets, blockID: 'another-block' } }])
  assert.equal(nominateNearestCompleteIndexedRuleGroup(selected, replacingParent(extra), question), null,
    'An unrelated, broad, foreign or incomplete parent cannot be promoted.');

const oversized = section('oversized', '991', lead.replaceAll('990', '991') + upper.replaceAll('990', '991') +
  lower.replaceAll('990', '991') + 'Additional appliance mounting qualifications. '.repeat(400));
const oversizedIndex = await buildResearchPassageIndex([oversized], async item => item.body);
const oversizedChild = oversizedIndex.passages.find(p => p.subsectionNumber === '991.8.1');
assert.equal(nominateNearestCompleteIndexedRuleGroup({ section: oversized, body: oversized.body, indexedPassage: oversizedChild },
  oversizedIndex, question), null, 'A huge complete parent is not replaced with a clipped prefix or an increased cap.');
assert.equal(nominateNearestCompleteIndexedRuleGroup({ section: oversized, body: oversized.body, indexedPassage: oversizedChild },
  oversizedIndex, question, { maximumCharacters: 50000 }), null, 'The existing 12k source ceiling cannot be increased through the helper.');
const split = section('split', '992', '');
split.body.blocks = [{ id: 'scope', plainText: lead.replaceAll('990', '992') },
  { id: 'child', plainText: upper.replaceAll('990', '992') + lower.replaceAll('990', '992') }];
const splitIndex = await buildResearchPassageIndex([split], async item => item.body);
assert.equal(nominateNearestCompleteIndexedRuleGroup({ section: split, body: split.body,
  indexedPassage: splitIndex.passages.find(p => p.subsectionNumber === '992.8.1') }, splitIndex, question), null,
  'Shared numeric labels in different blocks do not invent an enclosing raw subtree.');
const nested = section('nested', '993', '993.4 Appliance mounting.\nPortable appliance mounting retains the enclosing conditions.\n' +
  '993.4.2 Portable appliance mounting.\nPortable appliance mounting retains this complete method.\n' +
  '993.4.2.1 Upper mounting.\nThe portable appliance mounting retains its upper limit.\n' +
  '993.4.2.2 Lower mounting.\nThe portable appliance bottom retains its floor clearance.\nException: Protected housings retain all listed conditions.\n' +
  '993.4.3 Other mounting.\nOther appliance mounting has a different complete method.\n');
const nestedIndex = await buildResearchPassageIndex([nested], async item => item.body);
const nestedParent = nominateNearestCompleteIndexedRuleGroup({ section: nested, body: nested.body,
  indexedPassage: nestedIndex.passages.find(p => p.subsectionNumber === '993.4.2.1') }, nestedIndex, question);
assert.equal(nestedParent?.subsectionNumber, '993.4.2', 'The nearest fitting responsive parent wins over a broader numeric ancestor.');
assert(nestedParent.completeSubsectionText.includes('Protected housings retain all listed conditions.'));
assert(!nestedParent.completeSubsectionText.includes('993.4.3'), 'The complete subtree stops before its enclosing sibling branch.');
console.log('Full-index rule group contract passed: non-injected complete parent; canonical, subject, authority, pin and source-cap boundaries.');
