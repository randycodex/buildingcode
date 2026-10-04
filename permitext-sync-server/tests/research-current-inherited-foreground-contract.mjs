import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery, researchEvidenceStrategyForTurn } from '../research-evidence-assembly.mjs';
import { researchCurrentRuleDetailScore } from '../research-rule-packets.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('No providers in current/inherited foreground contracts.'); };
const hash = text => createHash('sha256').update(text).digest('hex');
const authority = { corpusID: 'synthetic-current-2022', codeVersion: 'synthetic-version-1', codeEdition: '2022', jurisdiction: 'New York City' };
const section = (id, codePrefix, sectionNumber, title, text) => ({ ...authority, id, sectionID: id, codePrefix, sectionNumber,
  title, text, canonicalText: text, body: { blocks: [{ id: id + '-body', plainText: text }] } });
const b4 = 'Correction: these would be metal cases rather than cardboard cartons. Does that change the answer if the exit path is still blocked?';
const scenarios = [{ family: 'FC', topic: 'Could cartons block the required exit path overnight?', question: b4,
  target: section('route-rule', 'FC', '980.4', 'Maintenance',
    'Required means of egress shall remain continuously unimpeded. Obstructions shall not impede access to required means of egress. Exception: A separately qualified arrangement retains its complete stated conditions.'),
  distractor: 'Metal cases rather than cardboard cartons can change the answer if the exit path is still blocked. This record describes delivery arrangements and case materials.' },
{ family: 'MC', topic: 'Could an air conditioner discharge condensate onto a walkway?',
  question: 'Correction: the outlet now reaches a disposal point. Would dripping onto the walkway on the way there be acceptable?',
  target: section('cooling-rule', 'MC', '981.6.2', 'Disposal',
    'Condensate from cooling coils and evaporators shall be conveyed to an approved place of disposal. Condensate shall not discharge so as to cause a nuisance. Exception: A separately qualified system retains every stated condition.'),
  parent: section('cooling-parent', 'MC', '981.6', 'System qualifications',
    'Systems shall comply with Sections 981.6.1 through 981.6.4. Exception: A separately qualified noncondensing system is outside this requirement.'),
  distractor: 'The outlet now reaches a disposal point. Dripping onto the walkway on the way there has a stated construction arrangement for outlets and walking surfaces.' }];
const proofs = [];
for (const scenario of scenarios) {
  const { target } = scenario;
  const distractors = Array.from({ length: 12 }, (_, i) => section(scenario.family + '-background-' + i, scenario.family,
    '987.' + (i + 1), 'Other construction detail', scenario.distractor));
  const catalog = [...distractors, target];
  const passageIndex = await buildResearchPassageIndex(catalog, async s => s.body);
  const citation = { ...target, evidenceRole: 'supporting', supportingPassages: [{ selectedText: target.text }] };
  const assistant = c => ({ role: 'assistant', answer: { mode: 'openai', authorityStatus: 'supported_by_enacted_text',
    verification: { pass: true }, supportedPoints: [{ text: 'Prior checked rule explained the requested subject.' }], citations: [c] } });
  const history = c => [{ role: 'user', question: scenario.topic }, assistant(c)];
  const topicContext = { rootTopic: scenario.topic, currentTopic: scenario.topic };
  const semanticSearch = { search: async () => ({ hits: distractors.map((s, i) => {
    const passage = passageIndex.passages.find(p => p.sectionID === s.id);
    return { ...passage, score: 1 - i / 100, passages: [passage] };
  }), metadata: { enabled: true, mockProvider: true } }) };
  const discover = async ({ question: q = scenario.question, prior = citation, extra = {}, index = passageIndex, bodyChange = null, catalogChange = null, limit = 12, mock = semanticSearch } = {}) => {
    const query = researchEvidenceRetrievalQuery({ question: q, previousMessages: history(prior), topicContext });
    const found = await discoverRelevantEvidence({ question: query.retrievalQuery, catalog: catalogChange ? catalog.map(s => s.id === target.id ? { ...s, ...catalogChange } : s) : catalog, passageIndex: index,
      invertedIndex: new Map(), semanticSearch: mock, readSectionBody: async s => bodyChange && s.id === target.id ? bodyChange : s.body,
      limit, retrievalContext: { ...query, currentQuestion: query.question, ...extra } });
    return { query, found };
  };
  const { query, found } = await discover();
  assert.equal(query.contextDependentFollowUp, true);
  assert.equal(query.inheritedAuthorityReferences.length, 1);
  assert(query.sourceQuery.includes('Previously discussed provisions: ' + scenario.family));
  const nominee = found.candidates.find(s => s.sectionID === target.id);
  assert(nominee && nominee.rank <= 10, scenario.family + ': current own-source match survives checked citation and unrelated semantics.');
  assert(nominee.signals.currentQuestionForeground, scenario.family + ': independent positive current subject retains foreground eligibility.');
  assert.equal(nominee.signals.inheritedAuthorityReference, true);
  assert.equal(nominee.signals.exactReference, false);
  assert.equal(nominee.evidencePriority?.claimCoverageRequired ?? false, false);
  assert(found.candidates.length <= 12 && found.candidates.filter(s => s.signals.currentQuestionForeground).length <= 3);
  const packet = await assembleResearchEvidence({ question: scenario.question, previousMessages: history(citation), topicContext,
    discover: async request => { assert.equal(request.retrievalContext.currentQuestion, scenario.question); return found; },
    resolveSection: async request => [...catalog, scenario.parent].filter(Boolean).find(s => request.sectionID
      ? s.sectionID === request.sectionID : s.codePrefix === request.codePrefix && s.sectionNumber === request.sectionNumber),
    limits: { maximumDiscovered: 10, maximumCharacters: 12000, maximumCharactersPerSource: 2000 } });
  const delivered = packet.sources.find(s => s.sectionID === target.id);
  assert.equal(delivered?.text, target.text);
  assert(delivered.canonicalContextComplete && !delivered.truncated);
  assert.equal(delivered.indexedPassage.sourceTextHash, hash(target.text));
  assert.deepEqual(delivered.indexedPassage.sourceOffsets, { blockID: target.id + '-body', start: 0, end: target.text.length });
  assert.equal(delivered.evidencePriority.claimCoverageRequired, false, 'Inherited hint does not become mandatory legal coverage.');
  assert(packet.usage.discoveredCount <= 10 && packet.usage.crossReferenceCount <= 6 && packet.usage.characterCount <= 12000);
  // Neither absent nor stale historical identity is authority. Fresh current
  // text may still qualify independently; the old reference never gets exact
  // priority or supplies legal conclusions.
  for (const priorChange of [{ sectionID: 'forged-old-id' }, { corpusID: 'foreign-old-corpus' },
    { codeVersion: 'obsolete-version' }, { codeEdition: '2014' }, { evidenceRole: 'contextual' }]) {
    const checked = await discover({ prior: { ...citation, ...priorChange } });
    const fresh = checked.found.candidates.find(s => s.sectionID === target.id);
    assert(fresh && fresh.rank <= 10 && !fresh.signals.exactReference,
      'Current independently verified source remains eligible despite untrusted old locator metadata.');
  }
  for (const catalogChange of [{ corpusID: 'foreign-current-corpus' }, { codeVersion: 'stale-current-version' },
    { codeEdition: '2014' }, { jurisdiction: '' }, { referenceOnly: true }, { selectionMode: 'section_reference' },
    { researchClaimEligible: false }, { textComplete: false }, { authorityClass: 'guidance' }]) {
    const bad = await discover({ catalogChange });
    assert(!bad.found.candidates.find(s => s.sectionID === target.id)?.signals.currentQuestionForeground,
      'Unbound or ineligible fresh authority cannot receive the inherited exception.');
  }
  for (const bodyChange of [{ ...target.body, researchClaimEligible: false }, { ...target.body, truncated: true },
    { blocks: [{ ...target.body.blocks[0], researchClaimEligible: false }] },
    { blocks: [{ ...target.body.blocks[0], truncated: true }] },
    { blocks: [{ ...target.body.blocks[0], plainText: 'A room has a separate sunlight condition.' }] }]) {
    const bad = await discover({ bodyChange });
    assert(!bad.found.candidates.find(s => s.sectionID === target.id)?.signals.currentQuestionForeground,
      'Fresh body eligibility and operative bytes govern, never old index wording.');
  }
  for (const change of ['hash', 'offsets', 'incomplete']) {
    const staleIndex = structuredClone(passageIndex);
    for (const passage of staleIndex.passages.filter(p => p.sectionID === target.id)) {
      if (change === 'hash') passage.sourceTextHash = '0'.repeat(64);
      if (change === 'offsets') passage.sourceOffsets = { ...passage.sourceOffsets, start: 1 };
      if (change === 'incomplete') { passage.scopeComplete = false; passage.completeSubsectionText = null; }
    }
    const bad = await discover({ index: staleIndex });
    assert(!bad.found.candidates.find(s => s.sectionID === target.id)?.signals.currentQuestionForeground,
      'Stale hash, forged source window and incomplete subtree cannot receive foreground protection.');
  }
  for (const extra of [{ relevanceComparison: true }, { sourceSelectionRestricted: true }]) {
    const bounded = await discover({ extra });
    assert(!bounded.found.candidates.find(s => s.sectionID === target.id)?.signals.currentQuestionForeground,
      'Comparison and selected-only boundaries retain inherited-reference restrictions.');
  }
  const restricted = await discover({ limit: 1 });
  assert(restricted.found.candidates.length <= 1);
  assert(restricted.found.candidates.every(s => !s.signals.currentQuestionForeground));
  const tiny = await assembleResearchEvidence({ question: scenario.question, previousMessages: history(citation), topicContext,
    discover: async () => found, resolveSection: async r => catalog.find(s => s.sectionID === r.sectionID),
    limits: { maximumCharacters: 40, maximumCharactersPerSource: 40 } });
  assert(tiny.usage.characterCount <= 40 && !tiny.sources.some(s => s.sectionID === target.id && s.canonicalContextComplete));
  const pin = { ...distractors[0], selectedText: distractors[0].text, selectionMode: 'passage' };
  const strictQuestion = 'Based only on the selected passage, ' + scenario.question;
  let broadReads = 0;
  const strict = await assembleResearchEvidence({ question: strictQuestion, previousMessages: history(citation), pinnedEvidence: [pin],
    strategy: researchEvidenceStrategyForTurn({ question: strictQuestion, pinnedEvidence: [pin] }),
    discover: async () => { broadReads++; return found; }, resolveSection: async r => catalog.find(s => s.sectionID === r.sectionID) });
  assert.equal(broadReads, 0); assert.equal(strict.sources.length, 1); assert.equal(strict.sources[0].text, pin.selectedText);
  for (const q of ['Different issue: how hot may a solar collector become?',
    'Correction: these cases need new latches. Which finish should they have?',
    'Correction: they are not blocking the exit path. How tall are the cases?',
    '"Could cartons block the exit path?" was a quote. How are metal cases recycled?',
    'Compare blocked exit paths with air conditioner condensate disposal.',
    'Under the 2014 codes, does a blocked exit path remain allowed?',
    scenario.family === 'FC' ? 'Under the Mechanical Code, can an exit path remain blocked?' :
      'Under the Fire Code, can cooling-coil condensate drip onto a walkway?']) {
    const negative = await discover({ question: q });
    assert(!negative.found.candidates.find(s => s.sectionID === target.id)?.signals.currentQuestionForeground,
      'Prior authority without a current compatible positive own-source match gets no special foreground eligibility: ' + q);
  }
  // A valid protected lead receives no new foreground signal. Existing parent
  // qualification remains independently fresh/current and must keep working.
  if (scenario.parent) {
    const leadPassage = passageIndex.passages.find(p => p.sectionID === target.id);
    const lead = await discover({ mock: { search: async () => ({ hits: [{ ...leadPassage, score: 2, passages: [leadPassage] }],
      metadata: { enabled: true, mockProvider: true } }) } });
    assert.equal(lead.found.candidates[0].sectionID, target.id);
    assert.equal(lead.found.candidates[0].signals.inheritedAuthorityReference, true);
    const leadPacket = await assembleResearchEvidence({ question: scenario.question, previousMessages: history(citation), topicContext,
      discover: async () => lead.found, resolveSection: async r => [...catalog, scenario.parent].find(s => r.sectionID
        ? s.sectionID === r.sectionID : s.codePrefix === r.codePrefix && s.sectionNumber === r.sectionNumber) });
    assert.equal(leadPacket.sources.find(s => s.sectionID === scenario.parent.id)?.text, scenario.parent.text);
    assert.equal(leadPacket.sources.find(s => s.sectionID === scenario.parent.id)?.evidencePriority.claimCoverageRequired, false);
  }
  proofs.push({ family: scenario.family, query: query.question, reference: target.codePrefix + ' ' + target.sectionNumber,
    candidateRank: nominee.rank, bodySHA256: hash(target.text), usage: packet.usage,
    detailScore: researchCurrentRuleDetailScore({ text: target.text }, scenario.question) });
}
let realProof = null;
if (process.argv.includes('--real-corpus')) {
  Object.assign(process.env, { NODE_ENV: 'test', PERMITEXT_EVIDENCE_DISCOVERY_BETA: '1', PERMITEXT_RESEARCH_PASSAGE_SEARCH: '1',
    PERMITEXT_RESEARCH_SEMANTIC_SEARCH: '0', PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: '1',
    PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING: '1', PERMITEXT_RESEARCH_ADVISORY_TOPIC_ROUTES: '1',
    PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: '1' });
  const app = await import('../app.mjs');
  const cooling = 'Another NYC example using the 2022 codes: could an air conditioner drip its condensate onto a public walkway if the amount is small, even though it would keep the walking surface wet?';
  const detail = 'We will send it to an approved disposal point instead. Can the gravity drain pipe run perfectly level to get there?';
  const egress = 'Different safety issue at that building: can delivery cartons temporarily block the required exit path overnight if staff will move them in the morning?';
  const knownAccounting = JSON.parse(fs.readFileSync('/tmp/permitext-production-v34-known-B4.accounting.json'));
  const inputs = [{ id: 'exact-B4-checked-history', question: b4, humans: [cooling, detail, egress],
    topic: egress, prior: ['FC', '1027'], expected: [['FC', '1027']], modes: ['lexical', 'mock_known_reference_competition'] },
  { id: 'MC-protected-current-lead-checked-history', question: detail, humans: [cooling], topic: cooling,
    prior: ['MC', '307.2.1'], expected: [['MC', '307.2.1'], ['MC', '307.2']], modes: ['mock_responsive_lead'] }];
  realProof = { mode: 'Full current authorized index, checked assistant identity constructed from canonical source, empty facts; no hosted input reconstruction.', turns: [] };
  for (const input of inputs) {
    const topicContext = { rootTopic: input.topic, currentTopic: input.topic, originalTopic: cooling };
    const humans = input.humans.map(question => ({ role: 'user', question }));
    const corpusPlan = await app.researchCorpusPlanForTurn({ question: input.question, messages: humans, topicContext, projectFacts: [] });
    const resources = await app.researchCorpusResources(corpusPlan);
    const prior = resources.catalog.find(s => s.codePrefix === input.prior[0] && s.sectionNumber === input.prior[1]);
    assert(prior);
    const body = await app.researchBodyForCatalogSection(prior);
    const priorText = body.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n');
    const messages = [...humans, { role: 'assistant', answer: { mode: 'openai', authorityStatus: 'supported_by_enacted_text',
      verification: { pass: true }, supportedPoints: [{ text: 'Prior checked source addressed the active subject.' }],
      citations: [{ ...prior, sectionID: String(prior.id), evidenceRole: 'supporting', supportingPassages: [{ selectedText: priorText }] }] } }];
    for (const mode of input.modes) {
      const mockHits = mode === 'mock_responsive_lead'
        ? resources.passageIndex.passages.filter(p => String(p.sectionID) === String(prior.id)).slice(0, 1)
        : knownAccounting.evidenceReferences.flatMap(ref => {
          const s = resources.catalog.find(s => s.codePrefix + ' ' + s.sectionNumber === ref);
          const p = s && resources.passageIndex.passages.find(p => String(p.sectionID) === String(s.id));
          return p ? [p] : [];
        });
      let found = null;
      const packet = await assembleResearchEvidence({ question: input.question, previousMessages: messages, topicContext,
        projectFacts: [], pinnedEvidence: [], discover: async request => {
          assert.equal(request.retrievalContext.currentQuestion, input.question);
          found = await discoverRelevantEvidence({ question: request.question, retrievalContext: request.retrievalContext,
            ...resources, limit: request.limit, readSectionBody: app.researchBodyForCatalogSection,
            ...(mode === 'lexical' ? {} : { semanticSearch: { search: async () => ({ hits: mockHits.map((p, i) =>
              ({ ...p, score: 1 - i / 100, passages: [p] })), metadata: { enabled: true, mockProvider: true } }) } }) });
          return found;
        }, resolveSection: async descriptor => {
          const s = resources.catalog.find(s => descriptor.sectionID ? String(s.id) === String(descriptor.sectionID)
            : s.codePrefix === descriptor.codePrefix && s.sectionNumber === descriptor.sectionNumber);
          if (!s) return null;
          const body = await app.researchBodyForCatalogSection(s);
          const resolved = { ...s, sectionID: String(s.id), body, text: body.blocks.filter(b => b.researchClaimEligible !== false)
            .map(b => b.plainText || '').join('\n\n') };
          return { ...resolved, crossReferences: app.researchAssemblyCrossReferences(resolved, resources.catalog) };
        } });
      const complete = [];
      for (const [prefix, number] of input.expected) {
        const supplied = packet.sources.find(s => s.codePrefix === prefix && s.sectionNumber === number);
        const s = resources.catalog.find(s => s.codePrefix === prefix && s.sectionNumber === number);
        const b = await app.researchBodyForCatalogSection(s);
        const canonicalText = b.blocks.filter(b => b.researchClaimEligible !== false).map(b => b.plainText || '').join('\n\n');
        assert(supplied && supplied.canonicalContextComplete && !supplied.truncated && supplied.text.includes(canonicalText),
          input.id + ': complete rule, qualifications and exceptions remain available');
        assert.equal(supplied.evidencePriority.claimCoverageRequired, false);
        complete.push({ reference: prefix + ' ' + number, canonicalBodySHA256: hash(canonicalText), suppliedSHA256: hash(supplied.text) });
      }
      const nominee = found.candidates.find(s => s.codePrefix === input.prior[0] && s.sectionNumber === input.prior[1]);
      assert(nominee && nominee.signals.inheritedAuthorityReference && !nominee.signals.exactReference);
      if (mode === 'mock_responsive_lead') assert.equal(found.candidates[0], nominee);
      assert(found.candidates.length <= 12 && packet.usage.discoveredCount <= 10 && packet.usage.crossReferenceCount <= 6 && packet.usage.characterCount <= 48000);
      realProof.turns.push({ id: input.id, mode, question: input.question, complete, candidates: found.candidates.map(s =>
        ({ reference: s.codePrefix + ' ' + s.sectionNumber, rank: s.rank, signals: s.signals })), usage: packet.usage,
        catalogCount: resources.catalog.length, passageCount: resources.passageIndex.passages.length });
    }
  }
}
assert.equal(providerCalls, 0);
const report = { contract: 'research-current-inherited-foreground', providerCalls, proofs, realProof,
  runtimeHashes: Object.fromEntries(['evidence-discovery.mjs', 'research-evidence-assembly.mjs'].map(file =>
    [file, hash(fs.readFileSync(new URL('../' + file, import.meta.url)))])) };
if (process.env.PERMITEXT_CURRENT_INHERITED_VALIDATION_PATH) fs.writeFileSync(process.env.PERMITEXT_CURRENT_INHERITED_VALIDATION_PATH,
  JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ contract: 'research-current-inherited-foreground', families: proofs.length, providerCalls, realTurns: realProof?.turns.length || 0 }));
