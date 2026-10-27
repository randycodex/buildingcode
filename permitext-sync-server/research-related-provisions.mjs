import { inlineCodeReferencePhrases } from './public/code-references.js';
import { discoverResearchSources } from './research-source-discovery.mjs';

const bookNames = [
  ['BC', /\b(?:New York City|NYC) Building Code\b/i],
  ['PC', /\b(?:New York City|NYC) Plumbing Code\b/i],
  ['MC', /\b(?:New York City|NYC) Mechanical Code\b/i],
  ['FGC', /\b(?:New York City|NYC) Fuel Gas Code\b/i],
  ['FC', /\b(?:New York City|NYC) Fire Code\b/i],
  ['EC', /\b(?:New York City|NYC) Electrical Code\b/i],
  ['ECC', /\b(?:New York City|NYC) Energy Conservation Code\b/i]
];
const key = source => `${source.codePrefix}:${source.codeVersion}:${source.sectionNumber}`;
const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode, code: 'RELATED_PROVISIONS_CONTEXT_CHANGED' });

export function assertRelatedProvisionContext(conversation, body) {
  if (body.expectedRevision !== Number(conversation.revision || 0) ||
      body.expectedEvidenceSetVersion !== Number(conversation.evidenceSetVersion || 1)) {
    throw fail('This conversation changed. Reopen it, then find related provisions again before including passages.');
  }
}

// Discovery never changes the conversation or calls a model. Each source keeps
// its own corpus identity; a similarly numbered section in another edition is
// never a substitute for a missing reference.
export async function findRelatedProvisions({ conversation, question, registry, resources, discover, enhanced = false, readSectionBody, focus = '', cursor = null }) {
  const pinned = (conversation.sources || []).filter(source => source.kind === 'selection' && source.selectedText);
  if (!pinned.length) throw fail('Include a passage from Reader before finding related provisions.', 400);
  if (typeof question !== 'string' || question.length > 2000) throw fail('Keep the discovery question within 2,000 characters.', 400);
  const selected = registry.filter(corpus => pinned.some(source => source.codeVersion === corpus.codeVersion &&
    corpus.codePrefixes.includes(source.codePrefix)));
  if (pinned.some(source => !selected.some(corpus => source.codeVersion === corpus.codeVersion &&
      corpus.codePrefixes.includes(source.codePrefix)))) throw fail('An included source edition is unavailable. Reopen that passage in Reader.');
  const unresolved = new Map();
  for (const source of pinned) {
    const origin = selected.find(corpus => corpus.codeVersion === source.codeVersion && corpus.codePrefixes.includes(source.codePrefix));
    const prefixes = new Set(inlineCodeReferencePhrases(source.selectedText, { includeFireCode: true })
      .map(phrase => phrase.codePrefix).filter(Boolean));
    for (const [prefix, pattern] of bookNames) if (pattern.test(source.selectedText)) {
      prefixes.add(prefix);
      unresolved.set(`${prefix}:${source.codeVersion}:book`, {
        id: `${prefix}:${source.codeVersion}:book`, codePrefix: prefix, codeVersion: source.codeVersion,
        title: source.selectedText.match(pattern)[0], reason: `Named in ${source.codePrefix} § ${source.sectionNumber}. No specific provision has been identified.`,
        kind: 'unresolved', codeEdition: origin.codeEdition
      });
    }
    for (const prefix of prefixes) {
      const corpus = registry.find(candidate => candidate.codePrefixes.includes(prefix) &&
        candidate.codeYear === origin.codeYear && candidate.automaticResearchEligible === true);
      if (corpus && !selected.includes(corpus)) selected.push(corpus);
    }
  }
  if (enhanced) {
    const query = question.trim() || pinned.map(source => `${source.title}: ${source.selectedText}`).join('; ').slice(0, 2000);
    return { ...await discoverResearchSources({ question: query, focus, cursor, selected, pinned, resources, discover, readSectionBody,
      unresolvedReferences: [...unresolved.values()] }),
      expectedRevision: Number(conversation.revision || 0), expectedEvidenceSetVersion: Number(conversation.evidenceSetVersion || 1) };
  }
  const { catalog, invertedIndex, availableCodePrefixes } = await resources({ selected, passageSearch: false });
  const byKey = new Map(catalog.map(section => [key(section), section]));
  const pinnedKeys = new Set(pinned.map(key));
  const candidates = new Map();
  const add = (section, kind, reason) => {
    if (!section || pinnedKeys.has(key(section)) || candidates.has(key(section))) return;
    candidates.set(key(section), {
      id: key(section), sectionID: String(section.id), sectionNumber: section.sectionNumber,
      title: section.title, codePrefix: section.codePrefix, codeVersion: section.codeVersion,
      codeEdition: section.codeEdition, jurisdiction: section.jurisdiction, kind, reason
    });
  };
  for (const source of pinned) {
    const origin = selected.find(corpus => corpus.codeVersion === source.codeVersion && corpus.codePrefixes.includes(source.codePrefix));
    let number = String(source.sectionNumber || '');
    while (number.includes('.')) {
      number = number.slice(0, number.lastIndexOf('.'));
      const parent = byKey.get(key({ ...source, sectionNumber: number }));
      if (parent) { add(parent, 'parent', `Parent scope of ${source.codePrefix} § ${source.sectionNumber}.`); break; }
    }
    for (const phrase of inlineCodeReferencePhrases(source.selectedText, { includeFireCode: true })) {
      const prefix = phrase.codePrefix || source.codePrefix;
      const targetCorpus = selected.find(corpus => corpus.codePrefixes.includes(prefix) &&
        (prefix === source.codePrefix ? corpus.codeVersion === source.codeVersion : corpus.codeYear === origin.codeYear));
      for (const target of phrase.references.slice(0, 12)) {
        const referenceKey = key({ codePrefix: prefix, codeVersion: targetCorpus?.codeVersion || source.codeVersion, sectionNumber: target.sectionNumber });
        const section = targetCorpus ? byKey.get(referenceKey) : null;
        if (section) add(section, 'reference', `Referenced by the included text of ${source.codePrefix} § ${source.sectionNumber}.`);
        else unresolved.set(referenceKey, { id: referenceKey, codePrefix: prefix, sectionNumber: target.sectionNumber,
          codeVersion: targetCorpus?.codeVersion || source.codeVersion, kind: 'unresolved',
          title: `${prefix} § ${target.sectionNumber}`, codeEdition: targetCorpus?.codeEdition || source.codeEdition,
          reason: `Referenced in ${source.codePrefix} § ${source.sectionNumber}; the exact provision is unavailable in the searched edition.` });
      }
    }
  }
  const query = question.trim() || pinned.map(source =>
    `${source.codePrefix} ${source.sectionNumber} ${source.title}: ${source.selectedText}`).join('; ').slice(0, 2000);
  const snippetLimit = Math.max(80, Math.floor(1400 / pinned.length));
  const sourceQuery = [query, ...pinned.map(source =>
    `${source.codePrefix} ${source.sectionNumber} ${source.title}. ${source.selectedText.slice(0, snippetLimit)}`)].join('\n').slice(0, 2000);
  const discovered = await discover({ question: query, retrievalContext: { currentQuestion: query, sourceQuery },
    catalog, invertedIndex, availableCodePrefixes, limit: 12 });
  for (const result of discovered.candidates || []) {
    const section = catalog.find(item => String(item.id) === String(result.sectionID));
    add(section, 'topic', 'Related to the discovery question. Review its scope and conditions.');
  }
  const all = [...candidates.values()];
  const balanced = [...new Map([
    ...all.filter(item => item.kind === 'parent').slice(0, 4),
    ...all.filter(item => item.kind === 'reference').slice(0, 4),
    ...all.filter(item => item.kind === 'topic').slice(0, 8), ...all
  ].map(item => [item.id, item])).values()];
  return {
    question: query, candidates: balanced.slice(0, 12),
    unresolvedReferences: [...unresolved.values()].slice(0, 12),
    sourceEditions: selected.map(corpus => ({ codeVersion: corpus.codeVersion, codeEdition: corpus.codeEdition })),
    coverageLimitations: ['These are candidate sources, not a complete list of requirements or a determination of applicability.',
      ...(discovered.coverageLimitations || []).map(item => item.text).filter(Boolean)],
    expectedRevision: Number(conversation.revision || 0), expectedEvidenceSetVersion: Number(conversation.evidenceSetVersion || 1),
    generatedAnswer: false, paidModelCall: false
  };
}

export async function validateRelatedProvisionSelections(selections, review) {
  if (!Array.isArray(selections) || !selections.length) throw fail('Select at least one reviewed passage.', 400);
  for (const selection of selections) {
    const { primary, canonicalSelection } = await review(selection.sectionID, selection.selectedText);
    if (!selection.reviewedSectionHash || selection.reviewedSectionHash !== primary.sectionTextHash ||
        selection.selectionMode === 'section_reference' ||
        selection.codeVersion !== primary.codeVersion || canonicalSelection !== selection.selectedText ||
        (selection.selectionMode !== 'passage' && canonicalSelection !== primary.canonicalText)) {
      throw fail('A reviewed passage or its edition changed. Open it in Reader and review it again.');
    }
  }
}
