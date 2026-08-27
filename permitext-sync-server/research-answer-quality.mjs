export const researchAnswerQualityVersion =
  "20260827-answer-binding-consolidation-v8";

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
      topicRouteRelationship: compactText(source?.evidencePriority?.topicRouteRelationship) || "unrestricted",
      applicabilityStatus: compactText(source?.applicabilityStatus).toLowerCase(),
      text: compactText(source?.text)
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

function answerApplicabilityText(answer) {
  return compactText([
    answer?.answerText,
    answer?.conclusion,
    answer?.explanation,
    ...(Array.isArray(answer?.supportedPoints)
      ? answer.supportedPoints.flatMap((point) => [point?.heading, point?.explanation])
      : []),
    ...(Array.isArray(answer?.evidenceLimitations) ? answer.evidenceLimitations : [])
  ].filter(Boolean).join(" "));
}

function disclosesApplicability(source, answerText) {
  if (source.applicabilityStatus === "future-effective") {
    return /\b(?:future[- ]effective|not\s+(?:yet\s+)?effective|effective\s+(?:on\s+)?(?:july\s+17,?\s+2027|\d{4}-\d{2}-\d{2}))\b/i.test(answerText);
  }
  if (source.applicabilityStatus === "historical") {
    return /\b(?:historical|prior[- ]code|1968\s+(?:NYC\s+)?Building\s+Code)\b/i.test(answerText);
  }
  return true;
}

export function evaluateResearchAnswerQuality({ question = "", evidence = [], answer = {} } = {}) {
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
  const applicabilityText = answerApplicabilityText(answer);
  const missingApplicabilityDisclosureSourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    !disclosesApplicability(availableEvidence.get(sourceID), applicabilityText)
  );
  const standardResidenceTableQuestion = /\bstandard\s+(?:residences?|residential)\b/i.test(question);
  const parallelCategorySourceIDs = standardResidenceTableQuestion
    ? Array.from(availableEvidence.values())
      .filter((source) =>
        /\bstandard residences\b/i.test(source.text) &&
        /\bqualifying affordable housing\b/i.test(source.text)
      )
      .map((source) => source.sourceID)
    : [];
  const missingParallelTableCategorySourceIDs =
    parallelCategorySourceIDs.length &&
    !/\bqualifying (?:affordable housing|senior housing)\b/i.test(applicabilityText)
      ? parallelCategorySourceIDs
      : [];
  const underlyingZoningUseQuestion =
    /\b(?:as[- ]of[- ]right|underlying)\b/i.test(question) &&
    /\b(?:permitted|permission|use)\b/i.test(question) &&
    /\b(?:C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?|R\d{1,2}[A-Z]?)\b/i.test(question);
  const zoningUseDenied = underlyingZoningUseQuestion &&
    /\b(?:no|not permitted|prohibited|does not permit)\b/i.test(applicabilityText);
  const zoningModificationPathDisclosed =
    /\b(?:special(?:[- ]purpose)? district|authorization|variance|special permit|mapped overlay)\b/i.test(applicabilityText);
  const missingZoningModificationPathDisclosureSourceIDs =
    zoningUseDenied && !zoningModificationPathDisclosed
      ? knownCitedSourceIDs.filter((sourceID) => availableEvidence.get(sourceID)?.reference.startsWith("ZR "))
      : [];
  const accessoryAssemblyPlumbingQuestion =
    /\b(?:plumbing fixtures?|fixture requirements?)\b/i.test(question) &&
    /\bGroup B\b/i.test(question) &&
    /\b(?:fewer than|under|less than)\s+75\b/i.test(question);
  const accessoryAssemblySourceIDs = accessoryAssemblyPlumbingQuestion
    ? knownCitedSourceIDs.filter((sourceID) => availableEvidence.get(sourceID)?.reference === "BC 303.1.3")
    : [];
  const userStatesGroupBPrincipalOccupancy =
    /\baccessory to (?:an?|the)\s+Group B occupancy\b/i.test(question);
  const misattributedAccessoryAssemblyRelationshipSourceIDs =
    accessoryAssemblySourceIDs.length &&
    !userStatesGroupBPrincipalOccupancy &&
    /\baccessory to (?:an?|the)\s+Group B occupancy\b/i.test(applicabilityText)
      ? accessoryAssemblySourceIDs
      : [];
  const hcrVanityQuestion =
    /\bHCR\b/i.test(question) &&
    /\bvanity\b/i.test(question);
  const hcrVanitySourceIDs = hcrVanityQuestion
    ? knownCitedSourceIDs.filter((sourceID) =>
      availableEvidence.get(sourceID)?.reference === "BC 1107.2.2.7.2.2"
    )
    : [];
  const missingTypeBNYCContextSourceIDs =
    hcrVanitySourceIDs.length && !/\bType B\+NYC\b/i.test(applicabilityText)
      ? hcrVanitySourceIDs
      : [];
  const cumulativeSingleExitSourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    /not exceeding six stories\s+and\s+not exceeding 2,?000 square feet/i.test(
      availableEvidence.get(sourceID)?.text
    )
  );
  const misstatedCumulativeConditionSourceIDs =
    cumulativeSingleExitSourceIDs.length &&
    /(?:does\s+not\s+exceed|not\s+exceeding)\s+six\s+stories\s+or\s+(?:does\s+not\s+exceed|not\s+exceeding\s+)?2,?000\s+square\s+feet/i.test(applicabilityText)
      ? cumulativeSingleExitSourceIDs
      : [];
  const unsupportedExitAccessExpansionSourceIDs =
    cumulativeSingleExitSourceIDs.length &&
    /\b(?:single|one)\s+exit\s+or\s+access\s+to\s+(?:a\s+single|one|an?)\s+exit\b/i.test(applicabilityText) &&
    !cumulativeSingleExitSourceIDs.some((sourceID) =>
      /\baccess\s+to\s+(?:a\s+single|one|an?)\s+exit\b/i.test(availableEvidence.get(sourceID)?.text)
    )
      ? cumulativeSingleExitSourceIDs
      : [];
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
      uncitedSupportedPointSourceIDs.length === 0 &&
      irrelevantCitationSourceIDs.length === 0 &&
      collateralCitationSourceIDs.length === 0 &&
      missingApplicabilityDisclosureSourceIDs.length === 0 &&
      missingParallelTableCategorySourceIDs.length === 0 &&
      missingZoningModificationPathDisclosureSourceIDs.length === 0 &&
      misattributedAccessoryAssemblyRelationshipSourceIDs.length === 0 &&
      missingTypeBNYCContextSourceIDs.length === 0 &&
      misstatedCumulativeConditionSourceIDs.length === 0 &&
      unsupportedExitAccessExpansionSourceIDs.length === 0,
    unknownAnswerSourceIDs,
    orphanCitationSourceIDs,
    uncitedSupportedPointSourceIDs,
    irrelevantCitationSourceIDs,
    collateralCitationSourceIDs,
    missingApplicabilityDisclosureSourceIDs,
    missingParallelTableCategorySourceIDs,
    missingZoningModificationPathDisclosureSourceIDs,
    misattributedAccessoryAssemblyRelationshipSourceIDs,
    missingTypeBNYCContextSourceIDs,
    misstatedCumulativeConditionSourceIDs,
    unsupportedExitAccessExpansionSourceIDs,
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
  if (result.missingApplicabilityDisclosureSourceIDs?.length) {
    issues.push({
      type: "missed_material_conclusion",
      detail: `State the historical or future-effective applicability status for explicitly selected evidence before relying on it: ${references(result.missingApplicabilityDisclosureSourceIDs, result.sources)}.`
    });
  }
  if (result.missingParallelTableCategorySourceIDs?.length) {
    issues.push({
      type: "missed_material_conclusion",
      detail: `For the stated standard-residence category, also state the materially different qualifying-affordable or qualifying-senior value supplied in the same table row and identify the fact that selects that alternative. Bind the comparison to: ${references(result.missingParallelTableCategorySourceIDs, result.sources)}.`
    });
  }
  if (result.missingZoningModificationPathDisclosureSourceIDs?.length) {
    issues.push({
      type: "missed_material_conclusion",
      detail: `When concluding that a use is not permitted as-of-right under the underlying zoning district, limit that conclusion to the underlying district rules and expressly preserve separate special-purpose-district, authorization, special-permit, or variance pathways not resolved by the supplied evidence. Bind the underlying use conclusion to: ${references(result.missingZoningModificationPathDisclosureSourceIDs, result.sources)}.`
    });
  }
  if (result.misattributedAccessoryAssemblyRelationshipSourceIDs?.length) {
    issues.push({
      type: "wrong_attribution",
      detail: `BC 303.1.3 requires the assembly room to be accessory to another or served principal occupancy; Group B is the resulting room classification, not necessarily the principal occupancy to which it is accessory. Correct that relationship and bind it to: ${references(result.misattributedAccessoryAssemblyRelationshipSourceIDs, result.sources)}.`
    });
  }
  if (result.missingTypeBNYCContextSourceIDs?.length) {
    issues.push({
      type: "missed_material_conclusion",
      detail: `Place BC 1107.2.2.7.2.2 in its Type B+NYC unit toilet-and-bathing-room context before explaining its water-closet clearance and permitted lavatory location. Bind that applicability context to: ${references(result.missingTypeBNYCContextSourceIDs, result.sources)}.`
    });
  }
  if (result.misstatedCumulativeConditionSourceIDs?.length) {
    issues.push({
      type: "misstated_provision",
      detail: `Preserve the cumulative Item 7 conditions: the building must not exceed six stories and must not exceed 2,000 square feet per story. Do not restate those conditions with or. Bind the corrected statement to: ${references(result.misstatedCumulativeConditionSourceIDs, result.sources)}.`
    });
  }
  if (result.unsupportedExitAccessExpansionSourceIDs?.length) {
    issues.push({
      type: "unsupported_requirement",
      detail: `The pinned Item 7 passage supports the one-exit allowance asked about but does not supply the phrase access to one exit. Remove that unsupported expansion and stay within: ${references(result.unsupportedExitAccessExpansionSourceIDs, result.sources)}.`
    });
  }
  return issues;
}
