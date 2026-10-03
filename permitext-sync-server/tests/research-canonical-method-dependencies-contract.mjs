import assert from 'node:assert/strict';
import { assembleResearchEvidence, researchEvidenceStrategies } from '../research-evidence-assembly.mjs';
import { researchAlternativeMethodReferences, researchCurrentRuleDetailScore } from '../research-rule-packets.mjs';

globalThis.fetch = () => { throw new Error('Providers forbidden in canonical method contracts'); };
const authority = { codePrefix: 'MC', corpusID: 'synthetic-current', codeVersion: 'synthetic-v1',
  codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, number, text, refs = []) => ({ ...authority, id, sectionID: id,
  sectionNumber: number, title: 'Equipment detail', text, canonicalText: text, crossReferences: refs });
const ref = source => ({ codePrefix: source.codePrefix, sectionNumber: source.sectionNumber, sectionID: source.id });
const methodA = section('sleeve', '998.3', '998.3 Sleeves. Retain the manufacturer-approved spiral sleeve. Exception: The listed isolated assembly retains its separate limitations.');
const methodB = section('film', '998.4', '998.4 Films. A bonded film shall be approved for its service and installed to the manufacturer instructions. Exception: A repaired joint requires the separately approved preparation.');
const methodC = section('wrap', '998.5', '998.5 Wraps. Retain the specified winding and complete joint seal.');
const parent = section('parent', '998.2', '998.2 Protection. Exposed exterior equipment shall be protected by one of the following methods: 1. Spiral sleeves in accordance with Section 998.3. 2. Bonded films in accordance with Section 998.4. 3. Wraps in accordance with Section 998.5.', [ref(methodA), ref(methodB), ref(methodC)]);
const incidentalA = section('incidental-a', '997.3', '997.3 Other detail. Retain the unrelated arrangement.');
const incidentalB = section('incidental-b', '997.4', '997.4 Other detail. Retain the unrelated arrangement.');
const incidental = section('incidental', '997.1', '997.1 Other arrangement. Follow Section 997.3 and Section 997.4.', [ref(incidentalA), ref(incidentalB)]);
const filler = section('filler', '996.1', '996.1 Room geometry. ' + 'Retain the unrelated room geometry. '.repeat(16));
const question = 'We plan brush application on exposed exterior valves. Is that acceptable?';
const all = [parent, methodA, methodB, methodC, incidental, incidentalA, incidentalB, filler];
assert.equal(researchCurrentRuleDetailScore(methodB, question), 0, 'Ordinary wording need not repeat the canonical method terminology.');
assert.deepEqual(researchAlternativeMethodReferences(parent, parent.crossReferences).map(value => value.sectionNumber), ['998.3', '998.4', '998.5']);
assert.equal(researchAlternativeMethodReferences({ ...parent, text: 'General methods: See Section 998.3 and Section 998.4.' }, parent.crossReferences).length, 0);
assert.equal(researchAlternativeMethodReferences({ ...parent, text: parent.text.replace('2. Bonded', '5. Bonded') }, parent.crossReferences).length, 0, 'An ambiguous noncontiguous enumeration is not a method packet.');
assert.equal(researchAlternativeMethodReferences({ ...parent, text: 'Use one of the following methods: 1. Retain a sleeve. 2. Retain a film. A separate procedure refers to Section 998.3 and Section 998.4.' }, parent.crossReferences).length, 0, 'References outside the method instructions do not become alternative links.');

async function assemble({ supplied = [incidental, parent, filler, methodB], mutate = value => value, limits = {}, pins = [], strategy = null } = {}) {
  const reads = new Map();
  const result = await assembleResearchEvidence({ question, pinnedEvidence: pins, strategy,
    discover: async () => ({ candidates: supplied.map((value, index) => ({ ...value, rank: index + 1, selectedText: value.text })) }),
    resolveSection: async request => {
      const value = all.find(source => request.sectionID ? source.id === request.sectionID :
        source.codePrefix === request.codePrefix && source.sectionNumber === request.sectionNumber);
      if (value) reads.set(value.id, (reads.get(value.id) || 0) + 1);
      return value ? mutate(value) : null;
    }, limits: { maximumCharacters: 2000, maximumCharactersPerSource: 800,
      maximumDiscovered: 3, maximumCrossReferences: 2, maximumTargetedDefinitions: 0, ...limits } });
  assert(result.usage.characterCount <= result.limits.maximumCharacters);
  assert(result.usage.crossReferenceCount <= result.limits.maximumCrossReferences);
  assert(result.usage.discoveredCount <= result.limits.maximumDiscovered);
  assert.equal(result.usage.characterCount, result.sources.reduce((sum, source) => sum + source.text.length, 0));
  return { result, reads };
}
const tail = await assemble();
for (const method of [methodA, methodB]) {
  const delivered = tail.result.sources.find(source => source.sectionID === method.id);
  assert(delivered?.canonicalContextComplete && !delivered.truncated);
  assert.equal(delivered.text, method.text, 'The complete method conditions and exception remain verbatim.');
  for (const field of ['sectionID', 'codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction']) assert.equal(delivered[field], method[field]);
  assert.equal(tail.reads.get(method.id), 1, 'A shortlist nominee not actually delivered remains eligible for one canonical read.');
}
assert(!tail.result.sources.some(source => source.sectionID === incidentalA.id));
assert(!tail.result.sources.some(source => source.sectionID === methodC.id), 'The existing two-source reservation and cross-reference cap remain.');
const admitted = await assemble({ supplied: [incidental, parent, methodB] });
assert.equal(admitted.result.sources.filter(source => source.sectionID === methodB.id).length, 1);
assert.equal(admitted.reads.get(methodB.id), 1, 'A later admitted nominee shares the exact canonical resolution.');
const alreadySupplied = await assemble({ supplied: [methodB, incidental, parent] });
assert.equal(alreadySupplied.result.sources.filter(source => source.sectionID === methodB.id).length, 1);
assert.equal(alreadySupplied.reads.get(methodB.id), 1, 'Actual complete evidence needs no duplicate dependency.');

for (const field of ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction']) {
  const wrong = await assemble({ mutate: value => value.id === methodB.id ? { ...value, [field]: 'wrong-authority' } : value });
  assert(!wrong.result.sources.some(source => source.sectionID === methodB.id), field + ' conflicts remain excluded.');
  assert.equal(wrong.reads.get(methodB.id), 1, 'An invalid reservation is not retried by incidental expansion.');
}
const missing = await assemble({ mutate: value => value.id === methodB.id ? null : value });
assert(!missing.result.sources.some(source => source.sectionID === methodB.id));
assert.equal(missing.reads.get(methodB.id), 1);
const oversized = await assemble({ mutate: value => value.id === methodB.id ? { ...value,
  text: methodB.text + ' Retain the complete qualification.'.repeat(30), canonicalText: methodB.text + ' Retain the complete qualification.'.repeat(30) } : value });
assert(!oversized.result.sources.some(source => source.sectionID === methodB.id), 'Complete over-cap methods are omitted atomically.');
const noRoom = await assemble({ limits: { maximumCharacters: incidental.text.length + parent.text.length + methodA.text.length + 10 } });
assert(!noRoom.result.sources.some(source => source.sectionID === methodB.id), 'A source cannot consume more than remaining total allowance.');
const weakParent = await assemble({ mutate: value => value.id === parent.id ? { ...value,
  text: value.text.replace('Exposed exterior', 'Interior'), canonicalText: value.text.replace('Exposed exterior', 'Interior') } : value });
assert(!weakParent.result.sources.some(source => source.sectionID === methodB.id), 'An unrelated alternatives list has no current-detail reservation.');
const broadParent = await assemble({ mutate: value => value.id === parent.id ? { ...value,
  text: value.text.replace('one of the following methods:', 'the general procedures.'),
  canonicalText: value.text.replace('one of the following methods:', 'the general procedures.') } : value });
assert(!broadParent.result.sources.some(source => source.sectionID === methodB.id), 'Ordinary broad references do not gain the method-list exception.');
const strict = await assemble({ pins: [{ ...parent, selectedText: 'Exposed exterior equipment.', userSelectedText: 'Exposed exterior equipment.' }],
  strategy: { mode: researchEvidenceStrategies.pinnedFirst, reason: 'question_explicitly_bounded_to_selected_evidence' } });
assert.equal(strict.result.sources.length, 1);
assert.equal(strict.result.sources[0].text, 'Exposed exterior equipment.');
const fragment = await assemble({ supplied: [incidental, { ...parent,
  selectedText: 'Exposed exterior equipment.', signals: { useSelectedPassageOnly: true } }, filler] });
assert(!fragment.result.sources.some(source => source.sectionID === methodB.id), 'Selected fragments do not authorize omitted method-list expansion.');
console.log('Canonical method dependencies passed: exact complete linked alternatives, shortlist/admission distinction, one canonical read, identity/pin/budget/weak-parent guards.');
