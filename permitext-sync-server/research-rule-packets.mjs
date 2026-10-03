// A completeness audit describes what was supplied, never which law applies.
// Recovery uses canonical references and retrieved terminology; model text is
// never treated as evidence.
export const researchRulePacketVersion = "20261003-canonical-applicability-context-v3";

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
  return `CANONICAL_SOURCE_CONTEXT: ${JSON.stringify(context)}`;
}

export const researchSourceApplicabilityInstruction = "Read each rule within its CANONICAL_SOURCE_CONTEXT and its supplied enacted scope conditions. Article, chapter, section-group and special-district labels are canonical source metadata, not project facts or proof of applicability. Wording such as 'in all districts' in a special-district chapter does not by itself extend that rule to districts outside its enclosing special district. A parallel rule from another chapter, use category or district is not an applicable substitute merely because its threshold or wording is similar. Do not present a geographically or categorically scoped provision as a general conflict, waiver or exception without supplied evidence and facts establishing that scope. When that scope is not established and is immaterial to the requested ordinary rule, omit the collateral provision rather than inventing an unresolved conflict. If it can materially affect the requested conclusion, state the precise supported conditional scope and what remains unknown. Metadata is not additional selected enacted text: retain the exact selected passage, its edition and its source boundary, and never infer omitted scope clauses from titles alone.";

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
