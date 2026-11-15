import policy from "./config/internal-review-reset.json" with { type: "json" };

export function internalReviewArchivePolicy(environment = process.env) {
  // This reset belongs to the live console. Development and automated fixtures
  // retain their golden datasets unless a test explicitly exercises the reset.
  return environment.VERCEL_ENV === "production" ||
    (environment.NODE_ENV === "test" && environment.PERMITEXT_TEST_INTERNAL_REVIEW_ARCHIVE === "1") ? policy : null;
}

export function internalReviewView(source, reset, view = "active") {
  if (!["active", "archive"].includes(view)) throw new TypeError("Choose the current review workspace or its archive.");
  if (!reset) return { ...source, reviewArchive: { enabled: false, view: "active" } };
  if (reset.schemaVersion !== 1 || !Number.isFinite(Date.parse(reset.resetAt))) throw new Error("Internal review reset configuration is invalid.");
  const beforeReset = value => Number.isFinite(Date.parse(value || "")) && Date.parse(value) <= Date.parse(reset.resetAt);
  const byID = key => new Set(reset[key] || []);
  const researchIDs = byID("researchCaseIDs"), retrievalIDs = byID("retrievalCaseIDs"), zoningIDs = byID("zoningCaseIDs");
  const reviewIDs = byID("reviewIDs"), runIDs = byID("runIDs");
  const feedbackArchived = item => {
    const timestamp = item.userUpdatedAt || item.createdAt;
    // An owner triage edit is not a new user report. A user's later resubmission
    // belongs in the fresh workspace even when it concerns an older answer.
    return !timestamp || beforeReset(timestamp);
  };
  const predicates = {
    researchCases: item => researchIDs.has(item.id),
    retrievalCases: item => retrievalIDs.has(item.id),
    zoningCases: item => zoningIDs.has(item.id),
    reviews: item => reviewIDs.has(item.id) || beforeReset(item.reviewedAt),
    runs: item => runIDs.has(item.configuration?.runID) || beforeReset(item.completedAt || item.startedAt || item.configuration?.createdAt),
    feedback: feedbackArchived
  };
  const rows = { researchCases: source.dataset.cases, retrievalCases: source.retrievalDataset.cases,
    zoningCases: source.zoningDataset.cases, reviews: source.reviews, runs: source.runs, feedback: source.feedbackRecords };
  const archivedCounts = Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values.filter(predicates[key]).length]));
  const selected = Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values.filter(item => predicates[key](item) === (view === "archive"))]));
  const visibleIDs = new Set([...selected.researchCases, ...selected.retrievalCases, ...selected.zoningCases].map(item => item.id));
  const cohort = { ...source.researchSpend,
    periodStart: view === "archive" ? source.researchSpend.periodStart :
      new Date(Math.max(Date.parse(source.researchSpend.periodStart), Date.parse(reset.resetAt))).toISOString(),
    operationMetrics: source.researchSpend.operationMetrics.filter(item => beforeReset(item.createdAt) === (view === "archive")) };
  return { ...source,
    dataset: { ...source.dataset, cases: selected.researchCases },
    retrievalDataset: { ...source.retrievalDataset, cases: selected.retrievalCases },
    zoningDataset: { ...source.zoningDataset, cases: selected.zoningCases },
    caseTimeline: Object.fromEntries(Object.entries(source.caseTimeline || {}).filter(([id]) => visibleIDs.has(id))),
    reviews: selected.reviews, runs: selected.runs, feedbackRecords: selected.feedback,
    feedbackQualitySpend: cohort,
    // The spending report itself retains every historical usage/cost record.
    researchSpend: source.researchSpend,
    reviewArchive: { enabled: true, id: reset.id, resetAt: reset.resetAt, view, archivedCounts }
  };
}
