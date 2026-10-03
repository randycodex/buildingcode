// A completeness audit describes what was supplied, never which law applies.
// Recovery uses canonical references and retrieved terminology; model text is
// never treated as evidence.
import { researchSourcePublishedCitationReference } from "./research-definition-excerpts.mjs";

export const researchRulePacketVersion = "20261003-published-reference-context-v7";

const detailStopWords = new Set(('a an and are as at be been before between building buildings by can code codes could do does each existing feet fictional for from have how if in into is it its later may measure measured minimum maximum new not now of on one only or our project proposed question scenario section shall should same some supplied than that the their these this those to under use used using was we were what when where whether which will with without would').split(' '));
const detailForms = word => {
  const forms = new Set([word]);
  if (word.endsWith('s') && word.length > 4) forms.add(word.slice(0, -1));
  if (/^[a-z]{5,}$/.test(word) && /(?:ing|ed)$/.test(word)) {
    const stem = word.replace(/(?:ing|ed)$/, '');
    if (stem.length >= 3) { forms.add(stem); forms.add(stem + 'e'); }
  }
  return forms;
};

// Literal current details nominate complete canonical packets; neither titles
// nor this overlap establish applicability. Numeric premises never enter it.
export function researchCurrentRuleDetailScore(source, question) {
  const terms = [...new Set(String(question || '').toLowerCase().match(/[a-z]{3,}/g) || [])]
    .filter(word => !detailStopWords.has(word));
  const words = new Set((String(source?.text || source?.selectedText || source?.canonicalText || '')
    .toLowerCase().match(/[a-z]{3,}/g) || []).flatMap(word => [...detailForms(word)]));
  return terms.filter(word => [...detailForms(word)].some(form => words.has(form))).length;
}

// A complete canonical alternatives list can name a method differently from
// the user's ordinary wording. These exact links nominate dependencies only;
// they never establish which alternative is applicable or approved.
export function researchAlternativeMethodReferences(source, references = []) {
  const text = String(source?.text || '');
  const introduction = /\b(?:one|any) of (?:the )?following (?:methods?|means|options?|alternatives?)\s*:/i.exec(text);
  if (!introduction) return [];
  const tail = text.slice(introduction.index + introduction[0].length);
  const markers = [...tail.matchAll(/(?:^|\s)([1-9]\d*)[.)]\s+/g)];
  const items = [];
  for (const marker of markers) {
    if (Number(marker[1]) !== items.length + 1) break;
    items.push(marker);
  }
  if (items.length < 2) return [];
  const itemTexts = items.map((marker, index) => tail.slice(marker.index + marker[0].length,
    items[index + 1]?.index ?? tail.length).split(/\.(?=\s+[A-Z]|$)/, 1)[0]);
  const literalReference = reference => {
    if (reference.codePrefix !== source.codePrefix || reference.referenceKind === 'table') return false;
    const number = String(reference.sectionNumber || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefix = String(source.codePrefix || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return number && itemTexts.some(item => new RegExp(`\\b(?:Sections?\\s+|${prefix}\\s+(?:Sections?\\s+)?)${number}(?=$|[\\s,.;:)])`, 'i').test(item));
  };
  const linked = [...new Map(references.filter(literalReference)
    .map(reference => [reference.sectionNumber, reference])).values()];
  return linked.length >= 2 ? linked : [];
}

// An operative qualification can refer upward to the enclosing numbered rule
// without repeating the user's detail words. Only an actual literal ancestor
// link qualifies; unrelated siblings and reference metadata alone do not.
export function researchAncestorQualificationReferences(source, references = []) {
  const number = String(source?.sectionNumber || '');
  if (!/^\d+(?:\.\d+)+$/.test(number)) return [];
  const clauses = String(source?.text || '').split(/(?<=[.!?])\s+(?=[A-Z])/);
  return references.filter(reference => {
    if (reference.codePrefix !== source.codePrefix || reference.referenceKind === 'table' ||
        !/^\d+(?:\.\d+)*$/.test(String(reference.sectionNumber || '')) ||
        !number.startsWith(reference.sectionNumber + '.')) return false;
    const target = reference.sectionNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefix = String(source.codePrefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const literal = new RegExp(`\\b(?:Sections?\\s+|${prefix}\\s+(?:Sections?\\s+)?)${target}(?=$|[\\s,.;:)])`, 'i');
    return clauses.some(clause => literal.test(clause) &&
      /\b(?:exceptions?|subject to|in accordance with|(?:established|required|specified|provided|permitted|allowed|regulated|governed|limited) (?:in|by|under))\b/i.test(clause));
  });
}

// The same checked catalog identity can be represented only by child passages
// in the index. A responsive child nominates the whole canonical packet; its
// text never stands in for that whole source, which the assembler must resolve
// freshly, bind by hash/offsets and include atomically within the existing cap.
export function researchCheckedRuleIndexPassage(passages, reference, registeredSection, question, maximumCharacters = 12000) {
  const fields = ['codePrefix', 'sectionNumber', 'corpusID', 'codeVersion', 'codeEdition'];
  if (!registeredSection?.jurisdiction || !fields.every(key => reference?.[key] &&
      registeredSection[key] === reference[key]) ||
      (reference.jurisdiction && reference.jurisdiction !== registeredSection.jurisdiction)) return null;
  const matching = (passages || []).filter(passage => fields.every(key => passage[key] === reference[key]) &&
    (!reference.sectionID || String(passage.sectionID) === String(reference.sectionID)) &&
    String(passage.sectionID) === String(registeredSection.sectionID || registeredSection.id) &&
    (!passage.jurisdiction || passage.jurisdiction === registeredSection.jurisdiction));
  const roots = matching.filter(passage => passage.subsectionNumber === passage.sectionNumber);
  const pool = roots.length ? roots : matching.filter(passage =>
    String(passage.subsectionNumber).startsWith(passage.sectionNumber + '.'));
  return pool.filter(passage => passage.text && passage.sourceTextHash && passage.sourceOffsets &&
    (passage.scopeComplete === true || passage.completeSubsectionText) &&
    [...new Set([...(passage.contextTexts || []), passage.completeSubsectionText || passage.text])].join('\n\n').length <= maximumCharacters &&
    researchCurrentRuleDetailScore(passage, question) >= 2)
    .sort((left, right) => researchCurrentRuleDetailScore(right, question) - researchCurrentRuleDetailScore(left, question))[0] || null;
}

const contextText = value => typeof value === "string" || typeof value === "number"
  ? String(value).replace(/\s+/g, " ").trim().slice(0, 600) : "";

// Callers supply canonical catalog/body metadata, not a model's interpretation
// of applicability. Titles locate a rule; they do not establish project facts
// or replace the enacted scope clauses and referenced applicability provisions.
export function researchCanonicalApplicabilityContext(value = {}) {
  const stored = value.canonicalApplicabilityContext || {};
  // A previously normalized context owns its unknowns too. Flat display fields
  // must not fill metadata that canonical resolution explicitly left absent.
  const flat = value.canonicalApplicabilityContext ? {} : value;
  const zoning = value.zoning || {};
  const article = {
    label: contextText(zoning.article?.roman || flat.articleNumber || stored.article?.label),
    title: contextText(zoning.article?.title || flat.articleTitle || stored.article?.title)
  };
  const chapter = {
    number: contextText(zoning.chapter?.canonicalNumber || flat.chapterNumber || stored.chapter?.number),
    title: contextText(zoning.chapter?.title || flat.chapterTitle || stored.chapter?.title)
  };
  const sectionGroup = {
    label: contextText(flat.sectionGroupLabel || flat.headerLine || stored.sectionGroup?.label),
    title: contextText(flat.sectionGroupTitle || flat.headingLine || stored.sectionGroup?.title)
  };
  const specialDistrict = {
    name: contextText(zoning.specialDistrict?.name || stored.specialDistrict?.name),
    abbreviation: contextText(zoning.specialDistrict?.abbreviation || stored.specialDistrict?.abbreviation)
  };
  const entries = { article, chapter, sectionGroup, specialDistrict };
  const context = Object.fromEntries(Object.entries(entries)
    .filter(([, fields]) => Object.values(fields).some(Boolean)));
  return {
    version: "canonical-source-context-v1",
    metadataAvailable: Object.keys(context).length > 0,
    ...context,
    projectApplicability: "not_established_by_source_metadata"
  };
}

export function researchSourceApplicabilityPrompt(source) {
  const context = researchCanonicalApplicabilityContext(source);
  const publishedReference = researchSourcePublishedCitationReference(source);
  return [`CANONICAL_SOURCE_CONTEXT: ${JSON.stringify(context)}`,
    ...(publishedReference ? [`PUBLISHED_CITATION_REFERENCE: ${JSON.stringify(publishedReference)}`] : [])].join("\n");
}

export const researchSourceApplicabilityInstruction = "Read each rule within its CANONICAL_SOURCE_CONTEXT and its supplied enacted scope conditions. Article, chapter, section-group and special-district labels are canonical source metadata, not project facts or proof of applicability. Wording such as 'in all districts' in a special-district chapter does not by itself extend that rule to districts outside its enclosing special district. A parallel rule from another chapter, use category or district is not an applicable substitute merely because its threshold or wording is similar. Do not present a geographically or categorically scoped provision as a general conflict, waiver or exception without supplied evidence and facts establishing that scope. When that scope is not established and is immaterial to the requested ordinary rule, omit the collateral provision rather than inventing an unresolved conflict. If it can materially affect the requested conclusion, state the precise supported conditional scope and what remains unknown. Metadata is not additional selected enacted text: retain the exact selected passage, its edition and its source boundary, and never infer omitted scope clauses from titles alone. PUBLISHED_CITATION_REFERENCE, when present, is a server-verified published heading for the exact complete definition entries supplied in that passage. SECTION_ID, PASSAGE_ID and the carrier SECTION/TITLE remain immutable storage identifiers. Cite those supplied IDs while using the published reference in prose; normalization supplies its display label. When a citation combines ordinary carrier text and embedded definitions, its carrier label remains a storage label and the supporting passages identify any separately bound published reference. Do not relabel ordinary carrier text from a later embedded heading, invent an unbound published reference, or request model edits to server-owned citation labels. This identity distinction does not establish rule applicability or excuse a wrong scope, definition, temperature, threshold or conclusion.";

export function researchMeasurementRecoveryQuery(question, sources) {
  if (!/\b(?:maximum|minimum|how (?:high|wide|far|deep|much|many)|limit|rate|temperature)\b/i.test(question)) return null;
  const measures = [
    [/\btemperature\b/i, /[°º]\s*[FC]|\bdegrees?\b|\b(?:Fahrenheit|Celsius)\b/i, "degrees Fahrenheit Celsius"],
    [/\b(?:airflow|exhaust rate|ventilation rate)\b/i, /\b(?:cfm|cubic feet per minute|L\/s)\b/i, "cfm cubic feet per minute"],
    [/\b(?:height|width|depth|distance|riser|tread)\b/i, /\b\d+(?:\.\d+)?\s*(?:feet|foot|ft|inches|inch|mm|meters?)\b/i, "feet inches mm"]
  ];
  const measurement = measures.find(([subject]) => subject.test(question));
  if (!measurement) return null;
  const primary = sources.filter(source => source.origin === "permitext_discovered" &&
    source.retrievalRank > 0 && source.retrievalRank <= 2);
  if (!primary.length || primary.some(source => measurement[1].test(source.text))) return null;
  // Preserve the user's subject and named edition. An unsuccessful result's
  // title is not authority to redirect recovery to a different code topic.
  // Unit vocabulary improves recall without supplying a threshold or answer.
  const suffix = ` ${measurement[2]}`;
  return `${String(question).slice(0, 2000 - suffix.length)}${suffix}`;
}

export function sameRuleIdentity(left, right) {
  return left.codePrefix === right.codePrefix && left.sectionNumber === right.sectionNumber &&
    (!right.corpusID || left.corpusID === right.corpusID) &&
    (!right.codeVersion || left.codeVersion === right.codeVersion) &&
    (!right.codeEdition || left.codeEdition === right.codeEdition);
}

function referenceKey(reference) {
  return [reference.corpusID, reference.codeVersion, reference.codePrefix,
    reference.sectionNumber, reference.referenceKind || "section"].join(":");
}

export function suppliedRuleReference(sources, reference) {
  const matching = sources.filter(source => sameRuleIdentity(source, reference.referenceKind === "table"
    ? { ...reference, sectionNumber: source.sectionNumber } : reference));
  if (reference.referenceKind === "table") {
    return matching.some(source => source.richSourceGrids?.length &&
      new RegExp(`\\b${String(reference.sectionNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        .test(source.richSourceCanonicalReference || source.richSourceReference || ""));
  }
  return matching.some(source => source.canonicalContextComplete === true);
}

export function researchRulePacketPlan({ sources, canonicalSources, referencesFor, strictBoundary = false }) {
  const references = new Map();
  const packets = [];
  const pinnedScope = sources.some(source => source.origin === "user_pinned");
  const isPrimary = source => source.evidencePriority?.claimCoverageRequired === true ||
    source.currentRulePacketAnchor === true ||
    (source.origin === "permitext_discovered" && source.retrievalRank > 0 && source.retrievalRank <= 2);
  const primaryDependencies = sources.filter(isPrimary).flatMap(source => {
    const canonical = canonicalSources.find(value => sameRuleIdentity(value, source));
    return canonical ? referencesFor(canonical).map(reference => ({ ...reference, codeEdition: source.codeEdition })) : [];
  });
  for (const source of sources) {
    // Do not recursively widen every retrieved topic. Review only primary rules
    // and their first-hop dependencies, never excerpt-only user selections.
    if (source.discoveryPassageOnly || source.targetedDefinition || source.targetedZoningContext ||
        source.richSourceKind === "amendment-history" ||
        (pinnedScope && source.origin === "permitext_discovered")) continue;
    const primary = isPrimary(source);
    const dependency = source.origin === "permitext_cross_reference" && source.retrievalDepth === 1 &&
      primaryDependencies.some(reference => sameRuleIdentity(source, reference));
    if (!primary && !dependency) continue;
    const canonical = canonicalSources.find(value => sameRuleIdentity(value, source));
    if (!canonical) continue;
    const dependencies = referencesFor(canonical).map(reference => ({
      ...reference,
      // A reference to a different code must be resolved in its own routed
      // corpus; never force the source's corpus onto a different code family.
      ...(reference.codePrefix === source.codePrefix ? {
        corpusID: source.corpusID, codeVersion: source.codeVersion, codeEdition: source.codeEdition
      } : { codeEdition: source.codeEdition })
    })).filter(reference => !sameRuleIdentity(source, reference) || reference.referenceKind === "table");
    const missing = [...new Map(dependencies.filter(reference => !suppliedRuleReference(sources, reference))
      .map(reference => [referenceKey(reference), reference])).values()];
    packets.push({ sourceID: source.sourceID, sectionNumber: source.sectionNumber,
      textComplete: source.canonicalContextComplete === true,
      missingReferences: missing.map(reference => ({ codePrefix: reference.codePrefix,
        sectionNumber: reference.sectionNumber, referenceKind: reference.referenceKind })) });
    for (const reference of missing) if (!references.has(referenceKey(reference))) {
      references.set(referenceKey(reference), { ...reference, parentSourceID: source.sourceID,
        parentDepth: source.retrievalDepth || 0 });
    }
  }
  return { version: researchRulePacketVersion, strictBoundary, packets,
    // Tables lose meaning without their columns/notes. Resolve those before
    // ordinary references; the caller enforces one pass and a fixed read cap.
    recoveryReferences: strictBoundary ? [] : [...references.values()].sort((a, b) =>
      Number(b.referenceKind === "table") - Number(a.referenceKind === "table")) };
}

export const researchRulePacketInstruction = "Treat the evidence as a rule packet: check the controlling text together with its applicable exceptions, definitions, table row, column units and notes. A retrieved reference is a candidate dependency, not proof that it applies. Missing text is not proof that a requirement or exception does not exist. If a material dependency remains unavailable, state the supported rule and identify exactly which application cannot be resolved; do not substitute a nearby rule or ask the user to find law that is already supplied. A complete source flag describes the supplied passage, not complete project compliance.";

export function researchRulePacketPrompt(source) {
  if (!source.rulePacket) return "";
  const review = { ...source.rulePacket, missingReferences: source.rulePacket.missingReferences.slice(0, 6),
    additionalUnlistedReferenceCount: Math.max(0, source.rulePacket.missingReferences.length - 6) };
  return `SOURCE_COMPLETENESS_REVIEW: ${JSON.stringify(review)}\nMissing references are possible dependencies to review for materiality, not mandatory topics or missing project facts.`;
}
