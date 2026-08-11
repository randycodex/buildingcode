export const researchClaimMaterialityVersion =
  "20260811-exact-passage-claim-materiality-v1";

export const researchClaimRoles = Object.freeze({
  governing: "governing",
  supporting: "supporting",
  contextual: "contextual"
});

export const researchEvidenceRoles = Object.freeze({
  governing: "governing",
  supporting: "supporting",
  contextual: "contextual",
  irrelevant: "irrelevant"
});

const allowedClaimRoles = new Set(Object.values(researchClaimRoles));
const allowedEvidenceRoles = new Set(Object.values(researchEvidenceRoles));

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueTextValues(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => compactText(value))
      .filter(Boolean)
  ));
}

function configurationError(message, details = {}) {
  const error = new Error(message);
  error.code = "INVALID_RESEARCH_CLAIM_MATERIALITY_CONTRACT";
  error.details = details;
  return error;
}

function evidenceRole(source) {
  const role = compactText(
    source?.evidenceRole || source?.evidencePriority?.evidenceRole || researchEvidenceRoles.supporting
  );
  if (!allowedEvidenceRoles.has(role)) {
    throw configurationError("Evidence has an unsupported materiality role.", {
      sourceID: compactText(source?.sourceID) || null,
      evidenceRole: role || null
    });
  }
  return role;
}

function evidenceBySourceID(evidence) {
  const result = new Map();
  for (const [evidenceIndex, source] of (Array.isArray(evidence) ? evidence : []).entries()) {
    const sourceID = compactText(source?.sourceID);
    if (!sourceID) {
      throw configurationError("Claim-materiality evidence must have an exact sourceID.", {
        evidenceIndex
      });
    }
    if (result.has(sourceID)) {
      throw configurationError("Claim-materiality evidence sourceIDs must be unique.", {
        sourceID
      });
    }
    result.set(sourceID, {
      sourceID,
      sectionID: compactText(source?.sectionID) || null,
      evidenceRole: evidenceRole(source)
    });
  }
  return result;
}

function normalizedEvidenceOptions(claim, availableEvidence) {
  const rawOptions = Array.isArray(claim?.evidenceOptions)
    ? claim.evidenceOptions
    : [{ sourceIDs: claim?.sourceIDs }];
  if (!rawOptions.length) {
    throw configurationError("Each materiality claim must declare exact-passage evidence.", {
      claimID: compactText(claim?.id) || null
    });
  }
  return rawOptions.map((option, optionIndex) => {
    const sourceIDs = uniqueTextValues(option?.sourceIDs);
    if (!sourceIDs.length) {
      throw configurationError("Each claim evidence option must contain an exact sourceID.", {
        claimID: compactText(claim?.id) || null,
        optionIndex
      });
    }
    const unknownSourceIDs = sourceIDs.filter((sourceID) => !availableEvidence.has(sourceID));
    if (unknownSourceIDs.length) {
      throw configurationError("A materiality claim referenced evidence outside the supplied passages.", {
        claimID: compactText(claim?.id) || null,
        optionIndex,
        unknownSourceIDs
      });
    }
    return { sourceIDs };
  });
}

function normalizedClaims(claims, availableEvidence) {
  const result = [];
  const claimIDs = new Set();
  for (const [claimIndex, claim] of (Array.isArray(claims) ? claims : []).entries()) {
    const id = compactText(claim?.id);
    const claimRole = compactText(claim?.claimRole || claim?.role);
    if (!id) {
      throw configurationError("Each materiality claim must have a stable id.", { claimIndex });
    }
    if (claimIDs.has(id)) {
      throw configurationError("Materiality claim ids must be unique.", { claimID: id });
    }
    if (!allowedClaimRoles.has(claimRole)) {
      throw configurationError("Each materiality claim must declare a supported claimRole.", {
        claimID: id,
        claimRole: claimRole || null
      });
    }
    claimIDs.add(id);
    result.push({
      id,
      label: compactText(claim?.label) || id,
      claimRole,
      evidenceOptions: normalizedEvidenceOptions(claim, availableEvidence)
    });
  }
  return result;
}

function normalizedAnswerBindings(answer) {
  const supportedPoints = (Array.isArray(answer?.supportedPoints) ? answer.supportedPoints : [])
    .map((point, pointIndex) => ({
      pointIndex,
      sourceIDs: uniqueTextValues(point?.sourceIDs)
    }));
  const citedSourceIDs = uniqueTextValues(
    (Array.isArray(answer?.citations) ? answer.citations : [])
      .flatMap((citation) => citation?.sourceIDs)
  );
  return { supportedPoints, citedSourceIDs };
}

function qualifyingEvidenceRoles(claimRole) {
  if (claimRole === researchClaimRoles.governing) {
    return new Set([researchEvidenceRoles.governing]);
  }
  if (claimRole === researchClaimRoles.supporting) {
    return new Set([researchEvidenceRoles.governing, researchEvidenceRoles.supporting]);
  }
  return new Set([
    researchEvidenceRoles.governing,
    researchEvidenceRoles.supporting,
    researchEvidenceRoles.contextual
  ]);
}

function evaluateOption({ option, optionIndex, claimRole, evidence, supportedPoints, citedSet }) {
  const qualifyingRoles = qualifyingEvidenceRoles(claimRole);
  const evidenceRoles = option.sourceIDs.map((sourceID) => evidence.get(sourceID).evidenceRole);
  const qualifyingSourceIDs = option.sourceIDs.filter((sourceID) =>
    qualifyingRoles.has(evidence.get(sourceID).evidenceRole)
  );
  const contextualSourceIDs = option.sourceIDs.filter((sourceID) =>
    evidence.get(sourceID).evidenceRole === researchEvidenceRoles.contextual
  );
  const irrelevantSourceIDs = option.sourceIDs.filter((sourceID) =>
    evidence.get(sourceID).evidenceRole === researchEvidenceRoles.irrelevant
  );
  const missingCitationSourceIDs = option.sourceIDs.filter((sourceID) => !citedSet.has(sourceID));
  const pointResults = supportedPoints.map((point) => {
    const pointSet = new Set(point.sourceIDs);
    const missingSupportedPointSourceIDs = option.sourceIDs.filter(
      (sourceID) => !pointSet.has(sourceID)
    );
    const pointIrrelevantSourceIDs = point.sourceIDs.filter((sourceID) =>
      evidence.get(sourceID)?.evidenceRole === researchEvidenceRoles.irrelevant
    );
    return {
      pointIndex: point.pointIndex,
      sourceIDs: point.sourceIDs,
      missingSupportedPointSourceIDs,
      irrelevantSourceIDs: pointIrrelevantSourceIDs,
      exactPassagesBound: missingSupportedPointSourceIDs.length === 0,
      acceptable: missingSupportedPointSourceIDs.length === 0 && pointIrrelevantSourceIDs.length === 0
    };
  });
  const matchedPoint = pointResults.find((point) => point.acceptable) || null;
  const materialitySatisfied = qualifyingSourceIDs.length > 0 && irrelevantSourceIDs.length === 0;
  const exactPassagesCited = missingCitationSourceIDs.length === 0;
  return {
    optionIndex,
    sourceIDs: option.sourceIDs,
    evidenceRoles: Array.from(new Set(evidenceRoles)),
    qualifyingSourceIDs,
    contextualSourceIDs,
    irrelevantSourceIDs,
    missingCitationSourceIDs,
    materialitySatisfied,
    exactPassagesCited,
    matchedPointIndex: matchedPoint?.pointIndex ?? null,
    covered: materialitySatisfied && exactPassagesCited && Boolean(matchedPoint),
    supportedPoints: pointResults
  };
}

/**
 * Checks exact-passage bindings and legal materiality without interpreting prose.
 *
 * Each evidence option is an all-of exact sourceID set and alternatives are
 * any-of. A single supported point must bind the complete option, and every
 * passage in it must also appear in the answer citations. Governing claims need
 * at least one governing passage; ordinary supporting or contextual passages
 * may supplement that passage but cannot replace it. Contextual claims may use
 * contextual passages to explain non-governing relevance. Irrelevant passages
 * never satisfy a claim.
 */
export function evaluateResearchClaimMateriality({ claims = [], evidence = [], answer = {} } = {}) {
  const availableEvidence = evidenceBySourceID(evidence);
  const normalized = normalizedClaims(claims, availableEvidence);
  const bindings = normalizedAnswerBindings(answer);
  const citedSet = new Set(bindings.citedSourceIDs);
  const answerSourceIDs = uniqueTextValues([
    ...bindings.citedSourceIDs,
    ...bindings.supportedPoints.flatMap((point) => point.sourceIDs)
  ]);
  const unknownAnswerSourceIDs = answerSourceIDs.filter(
    (sourceID) => !availableEvidence.has(sourceID)
  );

  const claimResults = normalized.map((claim) => {
    const evidenceOptions = claim.evidenceOptions.map((option, optionIndex) =>
      evaluateOption({
        option,
        optionIndex,
        claimRole: claim.claimRole,
        evidence: availableEvidence,
        supportedPoints: bindings.supportedPoints,
        citedSet
      })
    );
    const matchedOption = evidenceOptions.find((option) => option.covered) || null;
    return {
      id: claim.id,
      label: claim.label,
      claimRole: claim.claimRole,
      covered: Boolean(matchedOption),
      matchedOptionIndex: matchedOption?.optionIndex ?? null,
      matchedPointIndex: matchedOption?.matchedPointIndex ?? null,
      evidenceOptions
    };
  });
  const missingClaimIDs = claimResults.filter((claim) => !claim.covered).map((claim) => claim.id);
  const irrelevantAnswerSourceIDs = answerSourceIDs.filter((sourceID) =>
    availableEvidence.get(sourceID)?.evidenceRole === researchEvidenceRoles.irrelevant
  );

  return {
    schemaVersion: 1,
    materialityVersion: researchClaimMaterialityVersion,
    pass:
      missingClaimIDs.length === 0 &&
      unknownAnswerSourceIDs.length === 0 &&
      irrelevantAnswerSourceIDs.length === 0,
    claimCount: claimResults.length,
    coveredClaimCount: claimResults.length - missingClaimIDs.length,
    missingClaimIDs,
    unknownAnswerSourceIDs,
    irrelevantAnswerSourceIDs,
    citedEvidenceSourceIDs: bindings.citedSourceIDs.filter((sourceID) => availableEvidence.has(sourceID)),
    claims: claimResults
  };
}

export function assertResearchClaimMateriality(input) {
  const result = evaluateResearchClaimMateriality(input);
  if (result.pass) return result;
  const error = new Error("The Research answer used evidence that cannot establish the declared claim.");
  error.code = "INVALID_RESEARCH_CLAIM_MATERIALITY";
  error.materiality = result;
  throw error;
}
