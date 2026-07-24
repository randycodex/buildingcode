export const supportedEvaluationRunSchemaVersions = [3];

function uniqueStrings(values) {
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return {
    values: normalized,
    unique: Array.from(new Set(normalized)),
    hasDuplicates: new Set(normalized).size !== normalized.length
  };
}

function sameStringSet(left, right) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function resultCaseID(result) {
  return String(result?.testCase?.id || "").trim();
}

export function evaluationRunEligibility(run) {
  const errors = [];
  const configured = uniqueStrings(run?.configuration?.caseIDs);
  const results = Array.isArray(run?.results) ? run.results : [];
  const rawResultCaseIDs = results.map(resultCaseID);
  const resultIDs = uniqueStrings(rawResultCaseIDs);

  if (!supportedEvaluationRunSchemaVersions.includes(Number(run?.schemaVersion))) {
    errors.push(
      `Run schema ${run?.schemaVersion ?? "missing"} is not eligible; supported baseline schema: ` +
      `${supportedEvaluationRunSchemaVersions.join(", ")}.`
    );
  }
  if (run?.status !== "completed") errors.push("Only a completed run is baseline-eligible.");
  if (run?.configuration?.suiteScope !== "full") errors.push("Only an unfiltered full-suite run is baseline-eligible.");
  if (Number(run?.configuration?.repeat) !== 1) errors.push("A baseline run must contain exactly one repetition.");
  if (!String(run?.configuration?.runID || "").trim()) errors.push("The run has no run ID.");
  if (!String(run?.configuration?.datasetSHA256 || "").trim()) errors.push("The run has no dataset hash.");
  if (!configured.values.length) errors.push("The run configuration has no case IDs.");
  if (configured.hasDuplicates) errors.push("The run configuration repeats case IDs.");
  if (!results.length) {
    errors.push("The run has no results.");
  } else {
    if (rawResultCaseIDs.some((caseID) => !caseID)) errors.push("A run result has no case ID.");
    if (results.length !== configured.unique.length) {
      errors.push("The run result count does not exactly match the configured case count.");
    }
    if (resultIDs.hasDuplicates) errors.push("The run has duplicate case results.");
    if (!sameStringSet(resultIDs.unique, configured.unique)) {
      errors.push("The run results do not exactly match the configured case IDs.");
    }
    if (results.some((result) => Number(result?.repetition ?? 1) !== 1)) {
      errors.push("The run results contain an unsupported repetition.");
    }
    if (results.some((result) => result?.error)) errors.push("The run contains one or more case errors.");
    if (results.some((result) => !result?.answer || !result?.scoring)) {
      errors.push("Every baseline result must contain both an answer and scoring.");
    }
    if (results.some((result) => result?.testCase?.status !== "approved")) {
      errors.push("Every case embedded in a baseline run must have been approved when it ran.");
    }
  }

  return {
    eligible: errors.length === 0,
    errors,
    caseIDs: configured.unique
  };
}

export function latestEvaluationRunReviews(reviews, runID) {
  const latestByCase = new Map();
  (Array.isArray(reviews) ? reviews : []).forEach((review, index) => {
    if (
      review?.kind !== "run" ||
      String(review.runID || "") !== String(runID || "") ||
      !String(review.caseID || "").trim()
    ) return;
    const reviewedAt = Number.isFinite(Date.parse(review.reviewedAt))
      ? Date.parse(review.reviewedAt)
      : Number.NEGATIVE_INFINITY;
    const previous = latestByCase.get(review.caseID);
    if (
      !previous ||
      reviewedAt > previous.reviewedAt ||
      (reviewedAt === previous.reviewedAt && index > previous.index)
    ) {
      latestByCase.set(review.caseID, { review, reviewedAt, index });
    }
  });
  return new Map(Array.from(latestByCase, ([caseID, entry]) => [caseID, entry.review]));
}

export function evaluationRunReviewStatus(run, reviews) {
  const eligibility = evaluationRunEligibility(run);
  const runID = run?.configuration?.runID;
  const latestByCase = latestEvaluationRunReviews(reviews, runID);
  const approvedCaseIDs = eligibility.caseIDs.filter(
    (caseID) => latestByCase.get(caseID)?.decision === "approved"
  );
  const rejectedCaseIDs = eligibility.caseIDs.filter(
    (caseID) => latestByCase.get(caseID)?.decision === "rejected"
  );
  const unreviewedCaseIDs = eligibility.caseIDs.filter(
    (caseID) => !["approved", "rejected"].includes(latestByCase.get(caseID)?.decision)
  );
  const reviewsForRun = eligibility.caseIDs
    .map((caseID) => latestByCase.get(caseID))
    .filter(Boolean);
  const acceptedAt = reviewsForRun.length
    ? reviewsForRun
        .map((review) => String(review.reviewedAt || ""))
        .sort()
        .at(-1) || null
    : null;

  let status = "provisional";
  if (!eligibility.eligible) status = "ineligible";
  else if (rejectedCaseIDs.length) status = "rejected";
  else if (!unreviewedCaseIDs.length && approvedCaseIDs.length === eligibility.caseIDs.length) status = "accepted";

  return {
    status,
    eligible: eligibility.eligible,
    eligibilityErrors: eligibility.errors,
    caseIDs: eligibility.caseIDs,
    approvedCaseIDs,
    rejectedCaseIDs,
    unreviewedCaseIDs,
    acceptedAt: status === "accepted" ? acceptedAt : null,
    reviews: reviewsForRun
  };
}

export function preferredAcceptedEvaluationRun(runs, reviews) {
  return (Array.isArray(runs) ? runs : [])
    .map((run) => ({ run, reviewStatus: evaluationRunReviewStatus(run, reviews) }))
    .filter((candidate) => candidate.reviewStatus.status === "accepted")
    .sort((left, right) => {
      const reviewDifference = String(right.reviewStatus.acceptedAt || "")
        .localeCompare(String(left.reviewStatus.acceptedAt || ""));
      if (reviewDifference) return reviewDifference;
      return String(right.run?.createdAt || "").localeCompare(String(left.run?.createdAt || ""));
    })[0] || null;
}
