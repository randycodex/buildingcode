import { researchRequestedAreaConversions } from "./research-answer-presentation.mjs";

export const researchAnswerQualityVersion =
  "20260902-requested-unit-conversion-v24";

const accessibleDiningSurfaceMisstatementPattern =
  /(?:at\s+least\s+)?10\s*percent\s+of\s+(?:the\s+)?(?:total\s+)?(?:number\s+of\s+)?(?:seating\s+and\s+standing\s+)?spaces?\s+(?:of|for)\s+each\s+(?:dining[- ]surface\s+)?type|(?:at\s+least\s+)?10\s*percent\s+(?:of|for)\s+each\s+(?:type|dining[- ]surface)|minimum\s+accessible\s+share\s+of\s+(?:the\s+)?total\s+(?:number\s+of\s+)?seating\s+and\s+standing\s+spaces?\s+for\s+each\s+(?:type|dining[- ]surface)/i;

const accessibleDiningSurfaceCanonicalPhrase =
  "at least 10 percent of the total seating and standing spaces, with not less than one accessible seating or standing space at each type of dining surface";

const accessibleDiningSurfaceTypeMisstatementPattern =
  /(?:at\s+least|not\s+less\s+than)\s+one\s+accessible\s+dining[- ]surface\s+(?:of|for|at)\s+each\s+type/gi;

const accessibleDiningSurfaceTypeCanonicalPhrase =
  "at least one accessible seating or standing space at each type of dining surface";

const accessibleDiningSurfaceDistributionMisstatementPattern =
  /accessible\s+dining[- ]surfaces\s+must\s+be\s+distributed/gi;

const accessibleDiningSurfaceDistributionCanonicalPhrase =
  "the accessible seating and standing spaces must be distributed";

const accessibleDiningSurfaceDistributionPronounPattern =
  /those\s+surfaces\s+must\s+be\s+distributed/gi;

const accessibleDiningSurfaceDistributionPronounCanonicalPhrase =
  "those accessible spaces must be distributed";

const accessibleDiningSurfaceCountMisstatementPattern =
  /accessible\s+dining[- ]surface\s+count/gi;

const accessibleDiningSurfaceCountCanonicalPhrase =
  "accessible seating and standing-space count";

const sidewalkCafeFurnitureObstructionPattern =
  /(?:the\s+)?(?:proposed\s+)?furniture\s+(?:or|and)\s+equipment\s+(?:cannot|may\s+not|must\s+not|shall\s+not)\s+obstruct\s+(?:the\s+)?building\s+exit,?\s*(?:the\s+)?cellar\s+access\s+hatch,?\s*(?:or\s+)?(?:the\s+)?areaway/gi;

const sidewalkCafeObstructionCanonicalPhrase =
  "No part of an awning, enclosure, fixture, equipment, or removable platform may obstruct a building exit, cellar access hatch, or areaway";

const table403AuthorityMisstatementPattern =
  /Table\s+403\.1\s+(?:itself\s+)?controls\s+the\s+(?:applicable\s+)?occupancy\s+(?:type|classification),?\s*(?:the\s+)?occupant\s+load,?\s*and\s*(?:the\s+)?(?:fixture\s+minimum|minimum\s+fixture\s+count)/gi;

const table403AuthorityCanonicalPhrase =
  "The Building Code determines occupancy classification and occupant load; Table 403.1 supplies the applicable minimum fixture counts";

const diningSurfaceCalculationPattern =
  /\b10\s*percent\b|\bminimum\s+accessible\s+share\b/i;

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

function answerApplicabilityStatements(answer) {
  return [
    answer?.answerText,
    answer?.conclusion,
    answer?.explanation,
    ...(Array.isArray(answer?.supportedPoints)
      ? answer.supportedPoints.flatMap((point) => [point?.heading, point?.explanation])
      : [])
  ]
    .map(compactText)
    .filter(Boolean)
    .flatMap((text) => text.split(/(?<=[.!?])\s+/).map(compactText).filter(Boolean));
}

function isConditionalPriorCodeAccessibilityStatement(statement) {
  const hasPriorCodeScope = /\bprior[- ]code[- ]building\b/i.test(statement);
  const hasConditionalLanguage =
    /\b(?:if|assuming|provided that|subject to|once|upon|when)\b/i.test(statement) ||
    /\b(?:applicability|applies only|limited to|must be confirmed|requires confirmation)\b/i.test(statement);
  return hasPriorCodeScope && hasConditionalLanguage;
}

function isUnconditionalPriorCodeAccessibilityStatement(statement) {
  const identifiesAccessibilityRule =
    /\bBC\s*1101\.3\.1\b/i.test(statement) ||
    /\bChapter\s+11\b[^.]{0,100}\baccessible/i.test(statement) ||
    /\baccessible features?(?: and construction)?\b/i.test(statement);
  const statesMandatoryConsequence = /\b(?:must|shall|required|requires)\b/i.test(statement);
  const statesEvidenceBoundary =
    /\b(?:does not|cannot|could not) establish\b|\bnot established\b|\bunresolved\b|\bunknown\b|\bnot documented\b/i.test(statement);
  return identifiesAccessibilityRule &&
    statesMandatoryConsequence &&
    !statesEvidenceBoundary &&
    !isConditionalPriorCodeAccessibilityStatement(statement);
}

function priorCodeBuildingStatusIsUnresolved(answer) {
  const missingFactsText = compactText(
    Array.isArray(answer?.missingFacts) ? answer.missingFacts.join(" ") : ""
  );
  return (
    /\b(?:verify|confirm|represented|unverified|unknown|not established|unestablished)\b[^.]{0,180}\bprior[- ]code[- ]building\b/i.test(missingFactsText) ||
    /\bprior[- ]code[- ]building\b[^.]{0,180}\b(?:verify|confirm|represented|unverified|unknown|not established|unestablished)\b/i.test(missingFactsText)
  );
}

const certificateOperationRoomThresholdBoundary =
  "The supplied evidence does not establish whether a Certificate of Operation or another filing or posted-occupancy requirement applies; that remains to be confirmed under the applicable authority.";

const unsupportedCertificateOperationRoomThresholdPattern =
  /[^.!?\n]*\b(?:absence|lack)\b[^.!?\n]*\bindividual rooms?\b[^.!?\n]*\b(?:does not|doesn't|cannot)\b[^.!?\n]*\b(?:require|trigger|establish|resolve)\b[^.!?\n]*\bCertificate of Operation\b[^.!?\n]*[.!?]/i;

const certificateOperationRoomThresholdRationalePattern =
  /[^.!?\n]*\b(?:that|the) provision\b[^.!?\n]*\b75 persons?\b[^.!?\n]*\bindividual rooms?\b[^.!?\n]*[.!?]/i;

function repairCertificateOperationRoomThresholdStatements(value) {
  let insertedBoundary = false;
  const repaired = String(value || "")
    .split(/((?<=[.!?])\s+)/)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      const statement = compactText(segment);
      if (unsupportedCertificateOperationRoomThresholdPattern.test(statement)) {
        insertedBoundary = true;
        return segment.replace(statement, certificateOperationRoomThresholdBoundary);
      }
      if (certificateOperationRoomThresholdRationalePattern.test(statement)) return "";
      return segment;
    })
    .join("")
    .replace(/\s+([.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n");
  return { repaired, insertedBoundary };
}

const priorCodeAccessibilityConditionalPrefix =
  "If the represented prior-code-building status is confirmed and this alteration is within BC 1101.3.1's change-in-occupancy-classification or zoning-use-group scope, ";

function conditionPriorCodeAccessibilityStatements(value) {
  return String(value || "")
    .split(/((?<=[.!?])\s+)/)
    .map((segment, index) => {
      if (index % 2 === 1 || !isUnconditionalPriorCodeAccessibilityStatement(compactText(segment))) {
        return segment;
      }
      return segment.replace(
        /^(\s*(?:-\s+)?)/,
        `$1${priorCodeAccessibilityConditionalPrefix}`
      );
    })
    .join("");
}

function disclosesApplicability(source, answerText) {
  if (source.applicabilityStatus === "future-effective") {
    return /\b(?:future[- ]effective|not\s+(?:yet\s+)?effective|effective\s+(?:on\s+)?(?:july\s+17,?\s+2027|\d{4}-\d{2}-\d{2}))\b/i.test(answerText);
  }
  if (source.applicabilityStatus === "historical") {
    return /\b(?:historical|prior[- ]code|1968\s+(?:NYC\s+)?Building\s+Code)\b/i.test(answerText);
  }
  if (source.applicabilityStatus === "prior-edition-case-specific") {
    const identifiesPriorEdition = /\b(?:2014\s+(?:NYC\s+)?(?:Construction|Building|Plumbing|Mechanical|Fuel\s+Gas)\s+Code|prior[- ](?:code|edition)|historical)\b/i.test(answerText);
    const statesCaseSpecificBoundary = /\b(?:project[- ]specific|applicab(?:ility|le)\s+(?:is\s+)?(?:depends|dependent|must\s+be\s+(?:determined|confirmed))|depends\s+on\s+(?:the\s+)?(?:project|filing|application)|filing\s+date)\b/i.test(answerText);
    return identifiesPriorEdition && statesCaseSpecificBoundary;
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
  const requestedAreaConversions = researchRequestedAreaConversions({ question, evidence });
  const statedSquareFeet = Array.from(
    applicabilityText.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:square\s+feet|square\s+foot|sq\.?\s*ft\.?)\b/gi),
    (match) => Number(match[1])
  ).filter(Number.isFinite);
  const missingRequestedAreaConversions = requestedAreaConversions.filter(({ squareFeet }) =>
    !statedSquareFeet.some((value) => Math.abs(value - squareFeet) <= 0.005)
  );
  const missingRequestedAreaConversionSourceIDs = unique(
    missingRequestedAreaConversions.flatMap((conversion) => conversion.sourceIDs)
  );
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
    ? Array.from(availableEvidence.values())
      .filter((source) => source.reference === "BC 303.1.3")
      .map((source) => source.sourceID)
    : [];
  const accessoryClassificationSourceIDs = Array.from(availableEvidence.values())
    .filter((source) => source.reference === "BC 303.1.3")
    .map((source) => source.sourceID);
  const userStatesAccessoryRelationship = /\baccessory\b/i.test(question);
  const assertsAccessoryRelationshipAsFact =
    /\b(?:because|since)\s+(?:the\s+)?(?:room|space|it)\s+is\s+accessory\b/i.test(applicabilityText);
  const unestablishedAccessoryRelationshipSourceIDs =
    accessoryClassificationSourceIDs.length &&
    !userStatesAccessoryRelationship &&
    assertsAccessoryRelationshipAsFact
      ? accessoryClassificationSourceIDs
      : [];
  const userStatesGroupBPrincipalOccupancy =
    /\baccessory to (?:an?|the)\s+Group B occupancy\b/i.test(question);
  const misattributedAccessoryAssemblyRelationshipSourceIDs =
    accessoryAssemblySourceIDs.length &&
    !userStatesGroupBPrincipalOccupancy &&
    /\baccessory to (?:an?|the)\s+Group B occupancy\b/i.test(applicabilityText)
      ? accessoryAssemblySourceIDs
      : [];
  const restrictedPC403AccessorySourceIDs = accessoryAssemblyPlumbingQuestion
    ? Array.from(availableEvidence.values())
      .filter((source) =>
        source.reference === "PC 403.1" &&
        /\bbuilding or nonaccessory tenant space\b/i.test(source.text)
      )
      .map((source) => source.sourceID)
    : [];
  const disclosesPC403NonaccessoryScope =
    /\bbuilding or nonaccessory tenant(?: assembly)? space\b/i.test(applicabilityText) &&
    /\b(?:limited|restricted|confined|only|does not|not independently|separate|distinct)\b/i.test(applicabilityText);
  const missingPC403NonaccessoryScopeDisclosureSourceIDs =
    restrictedPC403AccessorySourceIDs.length && !disclosesPC403NonaccessoryScope
      ? restrictedPC403AccessorySourceIDs
      : [];
  const assertsNormalGroupBFixturePermission =
    /\bnormal\s+Group B\s+(?:fixture\s+)?(?:calculation|requirements?)\s+(?:remain|remains|is|are)?\s*permitted\b|\bnormal\s+starting\s+point\s+is\s+(?:therefore\s+)?(?:the\s+)?Group B\s+fixture\s+requirements\b|\bGroup B\s+classification\s+(?:therefore\s+)?supports\s+use\s+of\s+(?:the\s+)?normal\s+Group B\s+fixture\s+requirements\b/i.test(applicabilityText);
  const unsupportedNormalGroupBFixturePermissionSourceIDs =
    accessoryAssemblySourceIDs.length && assertsNormalGroupBFixturePermission
      ? accessoryAssemblySourceIDs
      : [];
  const multipleOccupancyFractionSourceIDs = accessoryAssemblyPlumbingQuestion
    ? Array.from(availableEvidence.values())
      .filter((source) =>
        source.reference === "PC 403.1.1" &&
        /\bmultiple occupancies\b[\s\S]*\bfractional numbers?\b[\s\S]*\b(?:added|summed|combined)\b[\s\S]*\bround/i.test(
          source.text
        )
      )
      .map((source) => source.sourceID)
    : [];
  const statesMultipleOccupancyFractionSequence =
    /\b(?:add|added|sum|summed|combine|combined)\b[^.]{0,100}\bfraction(?:s|al\s+(?:numbers?|(?:fixture\s+)?requirements?))\b[^.]{0,100}\b(?:before|then|prior to)\b[^.]{0,60}\bround/i.test(applicabilityText) ||
    /\bfraction(?:s|al\s+(?:numbers?|(?:fixture\s+)?requirements?))\b[^.]{0,100}\b(?:add|added|sum|summed|combine|combined)\b[^.]{0,100}\b(?:before|then|prior to)\b[^.]{0,60}\bround/i.test(applicabilityText);
  const missingMultipleOccupancyFractionSequenceSourceIDs =
    multipleOccupancyFractionSourceIDs.length && !statesMultipleOccupancyFractionSequence
      ? multipleOccupancyFractionSourceIDs
      : [];
  const hcrVanityQuestion =
    /\bHCR\b/i.test(question) &&
    /\bvanity\b/i.test(question);
  const hcrVanitySourceIDs = hcrVanityQuestion
    ? Array.from(availableEvidence.values())
      .filter((source) => source.reference === "BC 1107.2.2.7.2.2")
      .map((source) => source.sourceID)
    : [];
  const userStatesTypeBNYCApplicability = /\bType B\+NYC\b/i.test(question);
  const preservesTypeBNYCApplicabilityAsConditional =
    /\b(?:if|whether|assuming|provided|confirm|applicab(?:le|ility)|subject to)\b[^.]{0,100}\bType B\+NYC\b/i.test(applicabilityText) ||
    /\bType B\+NYC\b[^.]{0,100}\b(?:applies|applicable|applicability|subject to|must be confirmed|remains unknown)\b/i.test(applicabilityText);
  const missingFactsText = compactText(
    Array.isArray(answer?.missingFacts) ? answer.missingFacts.join(" ") : ""
  );
  const listsTypeBNYCApplicabilityAsMissingFact =
    /\bType B\+NYC\b/i.test(missingFactsText) &&
    /\b(?:appl(?:y|ies|icable|icability)|subject to|within|scope|qualif(?:y|ies))\b/i.test(missingFactsText);
  const missingTypeBNYCContextSourceIDs =
    hcrVanitySourceIDs.length && (
      !/\bType B\+NYC\b/i.test(applicabilityText) ||
      (!userStatesTypeBNYCApplicability && (
        !preservesTypeBNYCApplicabilityAsConditional ||
        !listsTypeBNYCApplicabilityAsMissingFact
      ))
    )
      ? hcrVanitySourceIDs
      : [];
  const conflatedLavatoryVanitySourceIDs =
    hcrVanitySourceIDs.length &&
    /\b(?:lavatory\s*[/(]\s*vanity|vanity\s*[/(]\s*lavatory)\b/i.test(applicabilityText)
      ? hcrVanitySourceIDs
      : [];
  const priorCodeAccessibilitySourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    availableEvidence.get(sourceID)?.reference === "BC 1101.3.1"
  );
  const hasPriorCodeAccessibilityAncestor = Array.from(availableEvidence.values()).some((source) =>
    source.reference === "BC 1101.3" &&
    /\bchanges? of use or occupancy to prior[- ]code[- ]buildings\b/i.test(source.text)
  );
  const hasUnresolvedPriorCodeBuildingStatus = priorCodeBuildingStatusIsUnresolved(answer);
  const hasUnconditionalPriorCodeAccessibilityStatement =
    answerApplicabilityStatements(answer).some(isUnconditionalPriorCodeAccessibilityStatement);
  const unconditionalPriorCodeAccessibilitySourceIDs =
    priorCodeAccessibilitySourceIDs.length &&
    hasPriorCodeAccessibilityAncestor &&
    hasUnresolvedPriorCodeBuildingStatus &&
    hasUnconditionalPriorCodeAccessibilityStatement
      ? priorCodeAccessibilitySourceIDs
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
  const certificateOperationSourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    availableEvidence.get(sourceID)?.reference === "BC 303.7" &&
    /\bindoor assembly occupancies\b[^.]{0,160}\b75 persons or more\b/i.test(
      availableEvidence.get(sourceID)?.text
    )
  );
  const unsupportedCertificateOperationRoomThresholdSourceIDs =
    certificateOperationSourceIDs.length &&
    unsupportedCertificateOperationRoomThresholdPattern.test(applicabilityText)
      ? certificateOperationSourceIDs
      : [];
  const accessibleDiningSurfaceSourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    availableEvidence.get(sourceID)?.reference === "BC 1108.2.9.1" &&
    /10 percent of the total number of seating and standing spaces/i.test(
      availableEvidence.get(sourceID)?.text
    )
  );
  const accessibleDiningSurfaceSourceIDSet = new Set(accessibleDiningSurfaceSourceIDs);
  const misboundAccessibleDiningSurfaceRuleSourceIDs = unique(
    (Array.isArray(answer?.supportedPoints) ? answer.supportedPoints : []).flatMap((point) => {
      const pointText = compactText([point?.heading, point?.explanation].filter(Boolean).join(" "));
      if (!diningSurfaceCalculationPattern.test(pointText)) return [];
      const pointSourceIDs = unique(point?.sourceIDs).filter((sourceID) => availableEvidence.has(sourceID));
      if (pointSourceIDs.some((sourceID) => accessibleDiningSurfaceSourceIDSet.has(sourceID))) return [];
      return pointSourceIDs;
    })
  );
  const misstatedAccessibleDiningSurfacePercentageSourceIDs =
    accessibleDiningSurfaceSourceIDs.length &&
    (
      accessibleDiningSurfaceMisstatementPattern.test(applicabilityText) ||
      new RegExp(accessibleDiningSurfaceTypeMisstatementPattern.source, "i").test(applicabilityText)
    )
      ? accessibleDiningSurfaceSourceIDs
      : [];
  const table403AuthoritySourceIDs = knownCitedSourceIDs.filter((sourceID) =>
    availableEvidence.get(sourceID)?.reference === "PC 403.1" &&
    /number of occupants shall be determined by the New York City Building Code/i.test(
      availableEvidence.get(sourceID)?.text
    ) &&
    /occupancy classification shall be determined in accordance with the New York City Building Code/i.test(
      availableEvidence.get(sourceID)?.text
    )
  );
  const misstatedTable403AuthoritySourceIDs =
    table403AuthoritySourceIDs.length &&
    new RegExp(table403AuthorityMisstatementPattern.source, "i").test(applicabilityText)
      ? table403AuthoritySourceIDs
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
      unestablishedAccessoryRelationshipSourceIDs.length === 0 &&
      misattributedAccessoryAssemblyRelationshipSourceIDs.length === 0 &&
      missingPC403NonaccessoryScopeDisclosureSourceIDs.length === 0 &&
      unsupportedNormalGroupBFixturePermissionSourceIDs.length === 0 &&
      missingMultipleOccupancyFractionSequenceSourceIDs.length === 0 &&
      missingTypeBNYCContextSourceIDs.length === 0 &&
      conflatedLavatoryVanitySourceIDs.length === 0 &&
      unconditionalPriorCodeAccessibilitySourceIDs.length === 0 &&
      misstatedCumulativeConditionSourceIDs.length === 0 &&
      unsupportedExitAccessExpansionSourceIDs.length === 0 &&
      unsupportedCertificateOperationRoomThresholdSourceIDs.length === 0 &&
      misboundAccessibleDiningSurfaceRuleSourceIDs.length === 0 &&
      misstatedAccessibleDiningSurfacePercentageSourceIDs.length === 0 &&
      misstatedTable403AuthoritySourceIDs.length === 0 &&
      missingRequestedAreaConversionSourceIDs.length === 0,
    unknownAnswerSourceIDs,
    orphanCitationSourceIDs,
    uncitedSupportedPointSourceIDs,
    irrelevantCitationSourceIDs,
    collateralCitationSourceIDs,
    missingApplicabilityDisclosureSourceIDs,
    missingParallelTableCategorySourceIDs,
    missingZoningModificationPathDisclosureSourceIDs,
    unestablishedAccessoryRelationshipSourceIDs,
    misattributedAccessoryAssemblyRelationshipSourceIDs,
    missingPC403NonaccessoryScopeDisclosureSourceIDs,
    unsupportedNormalGroupBFixturePermissionSourceIDs,
    missingMultipleOccupancyFractionSequenceSourceIDs,
    missingTypeBNYCContextSourceIDs,
    conflatedLavatoryVanitySourceIDs,
    unconditionalPriorCodeAccessibilitySourceIDs,
    misstatedCumulativeConditionSourceIDs,
    unsupportedExitAccessExpansionSourceIDs,
    unsupportedCertificateOperationRoomThresholdSourceIDs,
    misboundAccessibleDiningSurfaceRuleSourceIDs,
    misstatedAccessibleDiningSurfacePercentageSourceIDs,
    misstatedTable403AuthoritySourceIDs,
    missingRequestedAreaConversions,
    missingRequestedAreaConversionSourceIDs,
    citedSourceIDs: knownCitedSourceIDs,
    reviewedOnlySourceIDs,
    evidenceEconomy,
    sources: Array.from(availableEvidence.values())
  };
}

/**
 * Repairs a narrow set of objectively detectable paraphrase errors only when
 * the answer is already cited to the exact enacted passage. Replacements are
 * source-bound and cannot add an outside requirement. The dining calculation
 * repair also adds the exact BC 1108.2.9.1 binding to any supported point that
 * states the calculation. When exact BC 1101.3 ancestor scope and BC 1101.3.1
 * evidence are both present, the repair preserves unresolved prior-code status
 * as a condition instead of adding another model revision.
 */
export function applyResearchDeterministicAnswerRepairs(answer, evidence = [], { question = "" } = {}) {
  if (!answer || typeof answer !== "object") return answer;
  const diningSourceIDs = (Array.isArray(evidence) ? evidence : [])
    .filter((source) =>
      compactText(source?.codePrefix).toUpperCase() === "BC" &&
      compactText(source?.sectionNumber) === "1108.2.9.1" &&
      /10 percent of the total number of seating and standing spaces/i.test(compactText(source?.text))
    )
    .map((source) => compactText(source?.sourceID))
    .filter(Boolean);
  const obstructionSourceIDs = (Array.isArray(evidence) ? evidence : [])
    .filter((source) =>
      compactText(source?.codePrefix).toUpperCase() === "BC" &&
      compactText(source?.sectionNumber) === "3111.4" &&
      /awning, enclosure, fixture, equipment or removable platform/i.test(compactText(source?.text))
    )
    .map((source) => compactText(source?.sourceID))
    .filter(Boolean);
  const table403AuthoritySourceIDs = (Array.isArray(evidence) ? evidence : [])
    .filter((source) =>
      compactText(source?.codePrefix).toUpperCase() === "PC" &&
      compactText(source?.sectionNumber) === "403.1" &&
      /number of occupants shall be determined by the New York City Building Code/i.test(compactText(source?.text)) &&
      /occupancy classification shall be determined in accordance with the New York City Building Code/i.test(compactText(source?.text))
    )
    .map((source) => compactText(source?.sourceID))
    .filter(Boolean);
  const priorCodeAccessibilitySourceIDs = (Array.isArray(evidence) ? evidence : [])
    .filter((source) =>
      compactText(source?.codePrefix).toUpperCase() === "BC" &&
      compactText(source?.sectionNumber) === "1101.3.1"
    )
    .map((source) => compactText(source?.sourceID))
    .filter(Boolean);
  const certificateOperationSourceIDs = (Array.isArray(evidence) ? evidence : [])
    .filter((source) =>
      compactText(source?.codePrefix).toUpperCase() === "BC" &&
      compactText(source?.sectionNumber) === "303.7" &&
      /\bindoor assembly occupancies\b[^.]{0,160}\b75 persons or more\b/i.test(compactText(source?.text))
    )
    .map((source) => compactText(source?.sourceID))
    .filter(Boolean);
  const hasPriorCodeAccessibilityAncestor = (Array.isArray(evidence) ? evidence : []).some((source) =>
    compactText(source?.codePrefix).toUpperCase() === "BC" &&
    compactText(source?.sectionNumber) === "1101.3" &&
    /\bchanges? of use or occupancy to prior[- ]code[- ]buildings\b/i.test(compactText(source?.text))
  );
  if (
    !diningSourceIDs.length &&
    !obstructionSourceIDs.length &&
    !table403AuthoritySourceIDs.length &&
    !priorCodeAccessibilitySourceIDs.length &&
    !certificateOperationSourceIDs.length
  ) return answer;
  const citedSourceIDs = new Set(
    (Array.isArray(answer.citations) ? answer.citations : [])
      .flatMap((citation) => Array.isArray(citation?.sourceIDs) ? citation.sourceIDs : [])
      .map(compactText)
      .filter(Boolean)
  );
  const boundDiningSourceIDs = diningSourceIDs.filter((sourceID) => citedSourceIDs.has(sourceID));
  const boundObstructionSourceIDs = obstructionSourceIDs.filter((sourceID) => citedSourceIDs.has(sourceID));
  const boundTable403AuthoritySourceIDs = table403AuthoritySourceIDs.filter((sourceID) => citedSourceIDs.has(sourceID));
  const boundPriorCodeAccessibilitySourceIDs = priorCodeAccessibilitySourceIDs.filter((sourceID) => citedSourceIDs.has(sourceID));
  const boundCertificateOperationSourceIDs = certificateOperationSourceIDs.filter((sourceID) => citedSourceIDs.has(sourceID));
  const conditionPriorCodeAccessibility =
    boundPriorCodeAccessibilitySourceIDs.length > 0 &&
    hasPriorCodeAccessibilityAncestor &&
    priorCodeBuildingStatusIsUnresolved(answer);
  if (
    !boundDiningSourceIDs.length &&
    !boundObstructionSourceIDs.length &&
    !boundTable403AuthoritySourceIDs.length &&
    !conditionPriorCodeAccessibility &&
    !boundCertificateOperationSourceIDs.length
  ) return answer;

  const replacementPattern = new RegExp(accessibleDiningSurfaceMisstatementPattern.source, "ig");
  const repairText = (value, { narrative = false } = {}) => {
    let text = String(value || "");
    if (boundDiningSourceIDs.length) {
      text = text
        .replace(replacementPattern, accessibleDiningSurfaceCanonicalPhrase)
        .replace(accessibleDiningSurfaceTypeMisstatementPattern, accessibleDiningSurfaceTypeCanonicalPhrase)
        .replace(
          accessibleDiningSurfaceDistributionMisstatementPattern,
          accessibleDiningSurfaceDistributionCanonicalPhrase
        )
        .replace(
          accessibleDiningSurfaceDistributionPronounPattern,
          accessibleDiningSurfaceDistributionPronounCanonicalPhrase
        )
        .replace(
          accessibleDiningSurfaceCountMisstatementPattern,
          accessibleDiningSurfaceCountCanonicalPhrase
        );
    }
    if (boundObstructionSourceIDs.length) {
      text = text.replace(sidewalkCafeFurnitureObstructionPattern, sidewalkCafeObstructionCanonicalPhrase);
    }
    if (boundTable403AuthoritySourceIDs.length) {
      text = text.replace(table403AuthorityMisstatementPattern, table403AuthorityCanonicalPhrase);
    }
    if (narrative && conditionPriorCodeAccessibility) {
      text = conditionPriorCodeAccessibilityStatements(text);
    }
    if (narrative && boundCertificateOperationSourceIDs.length) {
      text = repairCertificateOperationRoomThresholdStatements(text).repaired;
    }
    return text;
  };
  let changed = false;
  const repairedTextField = (value, options) => {
    const repaired = repairText(value, options);
    if (repaired !== value) changed = true;
    return repaired;
  };
  const supportedPoints = (Array.isArray(answer.supportedPoints) ? answer.supportedPoints : []).map((point) => {
    const pointText = compactText([point?.heading, point?.explanation].filter(Boolean).join(" "));
    const statesCalculation = diningSurfaceCalculationPattern.test(pointText);
    const explanation = repairedTextField(point?.explanation, { narrative: true });
    if (!statesCalculation) return { ...point, explanation };
    const nextSourceIDs = Array.from(new Set([
      ...(Array.isArray(point?.sourceIDs) ? point.sourceIDs : []),
      ...boundDiningSourceIDs
    ]));
    if (nextSourceIDs.length !== (point?.sourceIDs || []).length) changed = true;
    return { ...point, explanation, sourceIDs: nextSourceIDs };
  });
  const missingFacts = Array.isArray(answer.missingFacts)
    ? answer.missingFacts.map((value) => repairedTextField(value))
    : [];
  const occupantLoadDocumentationQuestion =
    /\boccupant load\b/i.test(question) &&
    /\b(?:1\s*:\s*100|existing (?:documentation|basis|load))\b/i.test(question);
  if (
    occupantLoadDocumentationQuestion &&
    !missingFacts.some((value) => /\b(?:approved occupancy record|Certificate of Occupancy|approved occupant load)\b/i.test(value))
  ) {
    missingFacts.push(
      "The existing approved occupancy record and approved occupant load supporting the represented 1:100 basis."
    );
    changed = true;
  }
  const egressCapacityIndex = missingFacts.findIndex((value) =>
    /\begress capacity\b/i.test(value) && !/\bother egress[- ]design inputs\b/i.test(value)
  );
  if (occupantLoadDocumentationQuestion && egressCapacityIndex >= 0) {
    missingFacts[egressCapacityIndex] =
      "The available egress capacity and other egress-design inputs needed to evaluate the resulting design occupant load.";
    changed = true;
  }
  const result = {
    ...answer,
    answerText: repairedTextField(answer.answerText, { narrative: true }),
    ...(typeof answer.conclusion === "string"
      ? { conclusion: repairedTextField(answer.conclusion, { narrative: true }) }
      : {}),
    ...(typeof answer.explanation === "string"
      ? { explanation: repairedTextField(answer.explanation, { narrative: true }) }
      : {}),
    ...(Array.isArray(answer.missingFacts)
      ? { missingFacts }
      : {}),
    ...(Array.isArray(answer.additionalEvidenceNeeded)
      ? { additionalEvidenceNeeded: answer.additionalEvidenceNeeded.map((value) => repairedTextField(value)) }
      : {}),
    supportedPoints
  };
  return changed ? result : answer;
}

function references(sourceIDs, sources) {
  const byID = new Map(sources.map((source) => [source.sourceID, source]));
  return unique(sourceIDs.map((sourceID) => byID.get(sourceID)?.reference || sourceID)).join(", ");
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
  if (result.missingRequestedAreaConversionSourceIDs?.length) {
    const conversions = result.missingRequestedAreaConversions
      .map(({ squareInches, squareFeet }) => `${squareInches} square inches ÷ 144 = ${squareFeet.toFixed(3)} square feet`)
      .join("; ");
    issues.push({
      type: "missed_material_conclusion",
      detail: `The user requested square feet. State the source-bound arithmetic conversion (${conversions}) and label it as derived rather than enacted wording. Bind the original area limit to: ${references(result.missingRequestedAreaConversionSourceIDs, result.sources)}.`
    });
  }
  if (result.misstatedAccessibleDiningSurfacePercentageSourceIDs?.length) {
    issues.push({
      type: "misstated_provision",
      detail: `State the dining-surface calculation as at least 10 percent of the total seating and standing spaces, with not less than one accessible space of each dining-surface type; do not apply 10 percent separately to each type. Bind it to: ${references(result.misstatedAccessibleDiningSurfacePercentageSourceIDs, result.sources)}.`
    });
  }
  if (result.misstatedTable403AuthoritySourceIDs?.length) {
    issues.push({
      type: "misstated_provision",
      detail: `State that the Building Code determines occupancy classification and occupant load, while Table 403.1 supplies minimum fixture counts. Do not attribute the classification and load determinations to Table 403.1: ${references(result.misstatedTable403AuthoritySourceIDs, result.sources)}.`
    });
  }
  if (result.misboundAccessibleDiningSurfaceRuleSourceIDs?.length) {
    issues.push({
      type: "incorrect_citation",
      detail: `Do not attribute the detailed dining-surface percentage to evidence that only incorporates Chapter 11 generally: ${references(result.misboundAccessibleDiningSurfaceRuleSourceIDs, result.sources)}. Bind the 10-percent total calculation, the one-per-type minimum, distribution, and accessible-route requirements only to the supplied BC 1108.2.9.1 evidence.`
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
      detail: `State the historical, prior-edition case-specific, or future-effective applicability status for explicitly selected evidence before relying on it: ${references(result.missingApplicabilityDisclosureSourceIDs, result.sources)}.`
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
  if (result.unestablishedAccessoryRelationshipSourceIDs?.length) {
    issues.push({
      type: "overstated_compliance",
      detail: `Do not infer that a room is legally accessory merely because it serves residents or a principal occupancy. Unless the user expressly established the accessory relationship, make the BC 303.1.3 classification conclusion conditional on that relationship and include it as a missing project fact. Bind the condition to: ${references(result.unestablishedAccessoryRelationshipSourceIDs, result.sources)}.`
    });
  }
  if (result.misattributedAccessoryAssemblyRelationshipSourceIDs?.length) {
    issues.push({
      type: "wrong_attribution",
      detail: `BC 303.1.3 requires the assembly room to be accessory to another or served principal occupancy; Group B is the resulting room classification, not necessarily the principal occupancy to which it is accessory. Correct that relationship and bind it to: ${references(result.misattributedAccessoryAssemblyRelationshipSourceIDs, result.sources)}.`
    });
  }
  if (result.missingPC403NonaccessoryScopeDisclosureSourceIDs?.length) {
    issues.push({
      type: "wrong_attribution",
      detail: `For an accessory assembly-room question, do not use PC 403.1's separate fewer-than-75 permission as authority for the accessory room without its express scope. State that the selected PC permission is limited to a building or nonaccessory tenant assembly space and does not independently extend to the accessory room; use BC 303.1.3 as the direct authority for the accessory-room Assembly fixture option. Bind the PC limitation to: ${references(result.missingPC403NonaccessoryScopeDisclosureSourceIDs, result.sources)}.`
    });
  }
  if (result.unsupportedNormalGroupBFixturePermissionSourceIDs?.length) {
    issues.push({
      type: "overstated_compliance",
      detail: `Do not conclude that the normal Group B fixture calculation remains permitted merely because the accessory assembly room is classified as Group B. Lead with Not automatically: the supplied BC 303.1.3 establishes the Assembly-calculation option, while the absent Table 403.1 prevents this evidence package from establishing that normal Group B ratios may also be used. Bind the limited conclusion to: ${references(result.unsupportedNormalGroupBFixturePermissionSourceIDs, result.sources)}.`
    });
  }
  if (result.missingMultipleOccupancyFractionSequenceSourceIDs?.length) {
    issues.push({
      type: "missed_material_conclusion",
      detail: `State the supplied multiple-occupancy calculation sequence explicitly: calculate each occupancy with its applicable ratio, add the resulting fractional fixture requirements, and only then round up. Bind that sequence to: ${references(result.missingMultipleOccupancyFractionSequenceSourceIDs, result.sources)}.`
    });
  }
  if (result.missingTypeBNYCContextSourceIDs?.length) {
    issues.push({
      type: "missed_material_conclusion",
      detail: `Place BC 1107.2.2.7.2.2 in its Type B+NYC unit toilet-and-bathing-room context before explaining its water-closet clearance and permitted lavatory location. Unless the user established that the subject unit and bathroom are within that scope, make the Building Code discussion conditional on Type B+NYC applicability and include that applicability as a missing project fact. Bind the context to: ${references(result.missingTypeBNYCContextSourceIDs, result.sources)}.`
    });
  }
  if (result.conflatedLavatoryVanitySourceIDs?.length) {
    issues.push({
      type: "misstated_provision",
      detail: `Keep lavatory and vanity as distinct terms. Do not join them with a slash, parentheses, or other shorthand that implies they are interchangeable; state separately what the cited Building Code text says about a lavatory and what it does not establish about a vanity. Bind that distinction to: ${references(result.conflatedLavatoryVanitySourceIDs, result.sources)}.`
    });
  }
  if (result.unconditionalPriorCodeAccessibilitySourceIDs?.length) {
    issues.push({
      type: "overstated_compliance",
      detail: `Do not apply BC 1101.3.1 categorically while prior-code-building status remains represented or otherwise unresolved. Make the accessibility consequence conditional on confirming the prior-code-building and alteration/change context, and preserve that applicability fact in missingFacts. Bind the conditional rule to: ${references(result.unconditionalPriorCodeAccessibilitySourceIDs, result.sources)}.`
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
  if (result.unsupportedCertificateOperationRoomThresholdSourceIDs?.length) {
    issues.push({
      type: "fact_evidence_confusion",
      detail: `Do not infer that a Certificate of Operation or filing requirement is inapplicable merely because no individual room is represented as reaching 75 persons. The supplied provision states a threshold for an indoor assembly occupancy and does not establish that individual rooms are the governing unit. Keep filing and posted-occupancy applicability unresolved and bind the boundary to: ${references(result.unsupportedCertificateOperationRoomThresholdSourceIDs, result.sources)}.`
    });
  }
  return issues;
}
