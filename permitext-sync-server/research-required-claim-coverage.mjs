export const researchRequiredClaimCoverageVersion =
  "20260827-citation-coverage-v2";

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function exactSourceID(value) {
  return compactText(value?.sourceID);
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
  error.code = "INVALID_RESEARCH_REQUIRED_CLAIM_CONTRACT";
  error.details = details;
  return error;
}

function evidenceSourceIDs(evidence) {
  const sourceIDs = new Set();
  for (const [index, source] of (Array.isArray(evidence) ? evidence : []).entries()) {
    const sourceID = exactSourceID(source);
    if (!sourceID) {
      throw configurationError(
        "Required-claim coverage evidence must have an exact sourceID.",
        { evidenceIndex: index }
      );
    }
    if (sourceIDs.has(sourceID)) {
      throw configurationError(
        "Required-claim coverage evidence sourceIDs must be unique.",
        { sourceID }
      );
    }
    sourceIDs.add(sourceID);
  }
  return sourceIDs;
}

function normalizedEvidenceOptions(claim, evidenceIDs) {
  const rawOptions = Array.isArray(claim?.evidenceOptions)
    ? claim.evidenceOptions
    : [{ sourceIDs: claim?.sourceIDs }];
  if (!rawOptions.length) {
    throw configurationError(
      "Each required claim must declare at least one exact-passage evidence option.",
      { claimID: compactText(claim?.id) || null }
    );
  }
  return rawOptions.map((option, optionIndex) => {
    const sourceIDs = uniqueTextValues(option?.sourceIDs);
    if (!sourceIDs.length) {
      throw configurationError(
        "Each required-claim evidence option must contain at least one sourceID.",
        { claimID: compactText(claim?.id) || null, optionIndex }
      );
    }
    const unknownSourceIDs = sourceIDs.filter((sourceID) => !evidenceIDs.has(sourceID));
    if (unknownSourceIDs.length) {
      throw configurationError(
        "A required claim referenced a passage outside the supplied evidence.",
        {
          claimID: compactText(claim?.id) || null,
          optionIndex,
          unknownSourceIDs
        }
      );
    }
    return { sourceIDs };
  });
}

function normalizedRequiredClaims(requiredClaims, evidenceIDs) {
  const claims = [];
  const claimIDs = new Set();
  for (const [index, claim] of (Array.isArray(requiredClaims) ? requiredClaims : []).entries()) {
    const id = compactText(claim?.id);
    if (!id) {
      throw configurationError("Each required claim must have a stable id.", { claimIndex: index });
    }
    if (claimIDs.has(id)) {
      throw configurationError("Required claim ids must be unique.", { claimID: id });
    }
    claimIDs.add(id);
    claims.push({
      id,
      label: compactText(claim?.label) || id,
      evidenceOptions: normalizedEvidenceOptions(claim, evidenceIDs)
    });
  }
  return claims;
}

function citedSourceIDs(answer) {
  return uniqueTextValues(
    (Array.isArray(answer?.citations) ? answer.citations : [])
      .flatMap((citation) => citation?.sourceIDs)
  );
}

function supportedPointSourceIDs(answer) {
  return uniqueTextValues(
    (Array.isArray(answer?.supportedPoints) ? answer.supportedPoints : [])
      .flatMap((point) => point?.sourceIDs)
  );
}

export function requiredResearchClaimsFromEvidence(evidence = []) {
  return (Array.isArray(evidence) ? evidence : [])
    .filter((source) => source?.evidencePriority?.claimCoverageRequired === true)
    .map((source) => {
      const sourceID = exactSourceID(source);
      if (!sourceID) {
        throw configurationError(
          "Evidence marked for required-claim coverage must have an exact sourceID."
        );
      }
      const reference = [compactText(source.codePrefix), compactText(source.sectionNumber)]
        .filter(Boolean)
        .join(" ");
      const title = compactText(source.title);
      return {
        id: `required-passage:${sourceID}`,
        label: [reference, title].filter(Boolean).join(" — ") || sourceID,
        sourceIDs: [sourceID],
        reason: compactText(source.evidencePriority.claimCoverageReason)
      };
    });
}

export function researchRequiredClaimRevisionIssues(coverage, maximumIssues = 12) {
  const claimByID = new Map(
    (Array.isArray(coverage?.claims) ? coverage.claims : []).map((claim) => [claim.id, claim])
  );
  return (Array.isArray(coverage?.missingClaimIDs) ? coverage.missingClaimIDs : [])
    .slice(0, Math.max(1, Number(maximumIssues) || 12))
    .map((claimID) => {
      const claim = claimByID.get(claimID);
      const requiredSourceIDs = uniqueTextValues(
        claim?.evidenceOptions?.flatMap((option) => option.sourceIDs)
      );
      return {
        type: "missed_material_conclusion",
        detail: [
          `Cite the material enacted provision ${claim?.label || claimID} in the answer.`,
          requiredSourceIDs.length
            ? `Bind that point to the exact supplied passage ${requiredSourceIDs.join(", ")}.`
            : "Bind that point to its exact supplied passage."
        ].join(" ")
      };
    });
}

/**
 * Evaluates whether explicitly declared material claims are represented by the
 * answer's exact citations. Supported-point bindings remain diagnostic while
 * semantic support is judged once by the verifier.
 *
 * Each evidence option is an all-of set. A claim is covered when any one option
 * is fully cited. Evidence that is not assigned to a required claim is not
 * required merely because retrieval included it.
 */
export function evaluateResearchRequiredClaimCoverage({
  requiredClaims = [],
  evidence = [],
  answer = {}
} = {}) {
  const availableEvidenceSourceIDs = evidenceSourceIDs(evidence);
  const claims = normalizedRequiredClaims(requiredClaims, availableEvidenceSourceIDs);
  const answerCitedSourceIDs = citedSourceIDs(answer);
  const answerSupportedPointSourceIDs = supportedPointSourceIDs(answer);
  const citedSet = new Set(answerCitedSourceIDs);
  const supportedPointSet = new Set(answerSupportedPointSourceIDs);
  const unknownCitationSourceIDs = answerCitedSourceIDs.filter(
    (sourceID) => !availableEvidenceSourceIDs.has(sourceID)
  );
  const claimResults = claims.map((claim) => {
    const optionResults = claim.evidenceOptions.map((option, optionIndex) => {
      const missingSupportedPointSourceIDs = option.sourceIDs.filter(
        (sourceID) => !supportedPointSet.has(sourceID)
      );
      const missingCitationSourceIDs = option.sourceIDs.filter((sourceID) => !citedSet.has(sourceID));
      return {
        optionIndex,
        sourceIDs: option.sourceIDs,
        missingSourceIDs: [...missingCitationSourceIDs],
        missingSupportedPointSourceIDs,
        missingCitationSourceIDs,
        covered: missingCitationSourceIDs.length === 0
      };
    });
    const matchedOption = optionResults.find((option) => option.covered) || null;
    return {
      id: claim.id,
      label: claim.label,
      covered: Boolean(matchedOption),
      matchedOptionIndex: matchedOption?.optionIndex ?? null,
      evidenceOptions: optionResults
    };
  });
  const requiredEvidenceSourceIDs = Array.from(new Set(
    claims.flatMap((claim) => claim.evidenceOptions.flatMap((option) => option.sourceIDs))
  ));
  const missingClaimIDs = claimResults
    .filter((claim) => !claim.covered)
    .map((claim) => claim.id);
  return {
    schemaVersion: 1,
    coverageVersion: researchRequiredClaimCoverageVersion,
    pass: missingClaimIDs.length === 0 && unknownCitationSourceIDs.length === 0,
    requiredClaimCount: claims.length,
    coveredClaimCount: claims.length - missingClaimIDs.length,
    missingClaimIDs,
    unknownCitationSourceIDs,
    requiredEvidenceSourceIDs,
    supportedPointEvidenceSourceIDs: answerSupportedPointSourceIDs.filter((sourceID) =>
      availableEvidenceSourceIDs.has(sourceID)
    ),
    citedEvidenceSourceIDs: answerCitedSourceIDs.filter((sourceID) =>
      availableEvidenceSourceIDs.has(sourceID)
    ),
    nonRequiredEvidenceSourceIDs: Array.from(availableEvidenceSourceIDs).filter(
      (sourceID) => !requiredEvidenceSourceIDs.includes(sourceID)
    ),
    claims: claimResults
  };
}

export function assertResearchRequiredClaimCoverage(input) {
  const result = evaluateResearchRequiredClaimCoverage(input);
  if (result.pass) return result;
  const error = new Error("The Research answer omitted required material claim evidence.");
  error.code = "INVALID_RESEARCH_REQUIRED_CLAIM_COVERAGE";
  error.coverage = result;
  throw error;
}
