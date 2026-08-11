export const researchAnswerQualityVersion =
  "20260811-answer-evidence-economy-v1";

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(compactText).filter(Boolean)));
}

function normalizedEvidence(evidence) {
  const result = new Map();
  for (const source of Array.isArray(evidence) ? evidence : []) {
    const sourceID = compactText(source?.sourceID);
    if (!sourceID || result.has(sourceID)) continue;
    result.set(sourceID, {
      sourceID,
      sectionID: compactText(source?.sectionID),
      reference: [compactText(source?.codePrefix), compactText(source?.sectionNumber)].filter(Boolean).join(" "),
      evidenceRole: compactText(source?.evidencePriority?.evidenceRole) || "supporting",
      evidenceFunction: compactText(source?.evidencePriority?.primaryFunction) || "candidate",
      topicRouteRelationship: compactText(source?.evidencePriority?.topicRouteRelationship) || "unrestricted"
    });
  }
  return result;
}

function answerBindings(answer) {
  const citedSourceIDs = unique(
    (Array.isArray(answer?.citations) ? answer.citations : []).flatMap((citation) => citation?.sourceIDs)
  );
  const supportedPointSourceIDs = unique(
    (Array.isArray(answer?.supportedPoints) ? answer.supportedPoints : []).flatMap((point) => point?.sourceIDs)
  );
  return { citedSourceIDs, supportedPointSourceIDs };
}

function uniqueSectionCount(sourceIDs, availableEvidence) {
  return new Set(sourceIDs.map((sourceID) => availableEvidence.get(sourceID)?.sectionID).filter(Boolean)).size;
}

export function evaluateResearchAnswerQuality({ evidence = [], answer = {} } = {}) {
  const availableEvidence = normalizedEvidence(evidence);
  const bindings = answerBindings(answer);
  const citedSet = new Set(bindings.citedSourceIDs);
  const supportedPointSet = new Set(bindings.supportedPointSourceIDs);
  const knownCitedSourceIDs = bindings.citedSourceIDs.filter((sourceID) => availableEvidence.has(sourceID));
  const reviewedOnlySourceIDs = Array.from(availableEvidence.keys()).filter((sourceID) => !citedSet.has(sourceID));
  const orphanCitationSourceIDs = knownCitedSourceIDs.filter((sourceID) => !supportedPointSet.has(sourceID));
  const uncitedSupportedPointSourceIDs = bindings.supportedPointSourceIDs.filter((sourceID) => !citedSet.has(sourceID));
  const unknownAnswerSourceIDs = unique([
    ...bindings.citedSourceIDs,
    ...bindings.supportedPointSourceIDs
  ]).filter((sourceID) => !availableEvidence.has(sourceID));
  const irrelevantCitationSourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    availableEvidence.get(sourceID)?.evidenceRole === "irrelevant"
  );
  const collateralCitationSourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    availableEvidence.get(sourceID)?.topicRouteRelationship === "collateral"
  );
  const citationSourceIDsByRole = {
    governing: knownCitedSourceIDs.filter((sourceID) => availableEvidence.get(sourceID)?.evidenceRole === "governing"),
    supporting: knownCitedSourceIDs.filter((sourceID) => availableEvidence.get(sourceID)?.evidenceRole === "supporting"),
    contextual: knownCitedSourceIDs.filter((sourceID) => availableEvidence.get(sourceID)?.evidenceRole === "contextual")
  };
  const evidenceEconomy = {
    citedSourceCount: knownCitedSourceIDs.length,
    citedProvisionCount: uniqueSectionCount(knownCitedSourceIDs, availableEvidence),
    governingCitationCount: uniqueSectionCount(citationSourceIDsByRole.governing, availableEvidence),
    supportingCitationCount: uniqueSectionCount(citationSourceIDsByRole.supporting, availableEvidence),
    contextualCitationCount: uniqueSectionCount(citationSourceIDsByRole.contextual, availableEvidence),
    reviewedOnlySourceCount: reviewedOnlySourceIDs.length,
    reviewedOnlyProvisionCount: uniqueSectionCount(reviewedOnlySourceIDs, availableEvidence),
    assembledSourceCount: availableEvidence.size,
    assembledProvisionCount: uniqueSectionCount(Array.from(availableEvidence.keys()), availableEvidence)
  };
  return {
    schemaVersion: 1,
    qualityVersion: researchAnswerQualityVersion,
    pass:
      unknownAnswerSourceIDs.length === 0 &&
      orphanCitationSourceIDs.length === 0 &&
      uncitedSupportedPointSourceIDs.length === 0 &&
      irrelevantCitationSourceIDs.length === 0 &&
      collateralCitationSourceIDs.length === 0,
    unknownAnswerSourceIDs,
    orphanCitationSourceIDs,
    uncitedSupportedPointSourceIDs,
    irrelevantCitationSourceIDs,
    collateralCitationSourceIDs,
    citedSourceIDs: knownCitedSourceIDs,
    reviewedOnlySourceIDs,
    evidenceEconomy,
    sources: Array.from(availableEvidence.values())
  };
}

function references(sourceIDs, sources) {
  const byID = new Map(sources.map((source) => [source.sourceID, source]));
  return sourceIDs.map((sourceID) => byID.get(sourceID)?.reference || sourceID).join(", ");
}

export function researchAnswerQualityRevisionIssues(result) {
  if (!result || result.pass) return [];
  const issues = [];
  if (result.collateralCitationSourceIDs?.length) {
    issues.push({
      type: "irrelevant_citation",
      detail: `Remove supported points and citations for collateral topic routes matched only by supplied facts: ${references(result.collateralCitationSourceIDs, result.sources)}. Those provisions were reviewed internally but do not materially answer the legal topic expressly asked.`
    });
  }
  if (result.irrelevantCitationSourceIDs?.length) {
    issues.push({
      type: "irrelevant_citation",
      detail: `Remove evidence classified as irrelevant: ${references(result.irrelevantCitationSourceIDs, result.sources)}.`
    });
  }
  if (result.orphanCitationSourceIDs?.length) {
    issues.push({
      type: "incorrect_citation",
      detail: `Remove citations that do not support any answer point: ${references(result.orphanCitationSourceIDs, result.sources)}.`
    });
  }
  if (result.uncitedSupportedPointSourceIDs?.length) {
    issues.push({
      type: "incorrect_citation",
      detail: `Every retained supported point must cite its exact evidence: ${references(result.uncitedSupportedPointSourceIDs, result.sources)}.`
    });
  }
  if (result.unknownAnswerSourceIDs?.length) {
    issues.push({
      type: "incorrect_citation",
      detail: `Remove evidence identities outside the assembled package: ${result.unknownAnswerSourceIDs.join(", ")}.`
    });
  }
  return issues;
}
