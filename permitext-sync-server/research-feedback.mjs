import { createHash } from "node:crypto";

export const researchFeedbackCategories = new Set(["helpful", "incorrect_misleading", "missing_information", "citation_problem", "too_slow", "too_verbose", "other"]);
export const researchUsefulnessValues = new Set(["", "usable_as_is", "needed_correction", "not_usable"]);
export const researchOutsideCheckingValues = new Set(["", "none", "brief", "substantial"]);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = message => { throw Object.assign(new Error(message), { code: "INVALID_FEEDBACK_CASE" }); };
const text = (value, maximum = 8000) => {
  if (typeof value !== "string" || value.length > maximum) fail(`Text must contain at most ${maximum} characters.`);
  return value.trim();
};
const lines = value => {
  const values = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  if (values.length > 30) fail("Use at most 30 criteria.");
  return [...new Set(values.map(item => text(item, 1000)).filter(Boolean))];
};

export function feedbackSourceRecords(feedback) {
  const sources = [];
  for (const source of feedback.evidenceSnapshot?.enacted || []) {
    if (!source.passageText) continue;
    sources.push({ key: `enacted:${source.sourceID}`, authority: "enacted", reference: `${source.codeBook} ${source.sectionNumber}`,
      codeEdition: source.codeEdition, sourceVersion: source.sourceLibraryVersion, sectionID: source.sectionID,
      text: source.passageText, textSHA256: createHash("sha256").update(source.passageText).digest("hex") });
  }
  for (const source of feedback.evidenceSnapshot?.official || feedback.answer?.supportingSources || []) {
    for (const claim of source.attributedClaims || []) {
      const passage = claim.verbatimText || claim.text;
      if (!passage) continue;
      sources.push({ key: `official:${source.id}:${claim.id}`, authority: "official_supporting_guidance",
        reference: source.title || source.id, url: claim.sourceURL || source.url, page: claim.pageNumber ?? null,
        sourceVersion: claim.contentHash || source.sourceContentHash || null, text: passage,
        textSHA256: createHash("sha256").update(passage).digest("hex") });
    }
  }
  const unique = new Map();
  for (const source of sources) {
    const previous = unique.get(source.key);
    if (previous && previous.textSHA256 !== source.textSHA256) fail("Saved evidence contains conflicting source identities.");
    unique.set(source.key, source);
  }
  return [...unique.values()];
}

export function feedbackSnapshotHash(feedback) {
  return digest({ question: feedback.question, answer: feedback.answer, citations: feedback.citations,
    contextSnapshot: feedback.contextSnapshot, evidenceSnapshot: feedback.evidenceSnapshot });
}

export function updateFeedbackCase(feedback, body, now) {
  const previous = feedback.regressionCase;
  if (body.revision !== (previous?.revision || 0)) fail("This case changed. Reload it before saving.");
  const action = body.action;
  if (!["save", "approve", "reject", "record_result"].includes(action)) fail("Choose a supported case action.");
  const reviewer = text(body.reviewer || "", 120), notes = text(body.notes || "", 4000);
  if (!reviewer || !notes) fail("Provide the reviewer and a short explanation of what was checked.");
  if (action === "record_result") {
    if (previous?.status !== "approved") fail("Approve the reference case before recording a comparison.");
    const target = body.targetFeedback;
    if (!target || !["pass", "fail"].includes(body.decision)) fail("Choose a saved reported answer and a pass or fail decision.");
    const comparison = { caseRevision: previous.revision, referenceSHA256: previous.referenceSHA256,
      feedbackID: target.id, answerID: target.answerID, question: target.question, answerSnapshotSHA256: feedbackSnapshotHash(target),
      answer: structuredClone(target.answer), contextSnapshot: structuredClone(target.contextSnapshot || {}),
      evidenceSnapshot: structuredClone(target.evidenceSnapshot || {}), citations: structuredClone(target.citations || []), decision: body.decision, reviewer, notes, reviewedAt: now };
    return { ...previous, comparisons: [...(previous.comparisons || []), comparison], updatedAt: now };
  }
  if (action !== "save" && !previous) fail("Save the case before reviewing it.");
  // Review actions approve exactly the persisted revision, never unsaved form fields.
  const draft = action === "save" ? body.case : previous;
  if (!draft || typeof draft !== "object") fail("Provide a regression case.");
  if (draft.additionalSources != null && !Array.isArray(draft.additionalSources)) fail("Additional sources must be a list.");
  const additionalSources = (draft.additionalSources || []).map(source => {
    if (!source || typeof source !== "object") fail("Provide a valid additional source.");
    const url = text(source.url || "", 2000), reference = text(source.reference || "", 300);
    const passage = text(source.text || "", 20000), codeEdition = text(source.codeEdition || "", 300);
    let parsed;
    try { parsed = new URL(url); } catch { fail("Enter a valid official source URL."); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        !(parsed.hostname.endsWith(".gov") || parsed.hostname.endsWith(".gov.amlegal.com"))) fail("Use an HTTPS government or official municipal-code source URL.");
    if (!reference || !passage || !codeEdition) fail("An added source needs its reference, edition or date, and exact passage.");
    return { reference, url, text: passage, codeEdition };
  });
  if (additionalSources.length > 10) fail("Use at most 10 additional sources.");
  const sources = [...feedbackSourceRecords(feedback), ...additionalSources.map(source => ({ ...source,
    key: `reviewer:${digest(source)}`, authority: "reviewer_supplied_official_source",
    snapshotOrigin: "Reviewer-supplied excerpt; not fetched or independently validated by Permitext",
    textSHA256: createHash("sha256").update(source.text).digest("hex") }))];
  const requiredSourceKeys = lines(draft.requiredSourceKeys || []);
  if (requiredSourceKeys.some(key => !sources.some(source => source.key === key))) fail("A required source is not in the preserved evidence.");
  const candidate = {
    id: previous?.id || `feedback-${feedback.id}`, revision: (previous?.revision || 0) + 1,
    status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "draft",
    question: text(draft.question || ""), facts: text(draft.facts || ""),
    expectedAnswer: text(draft.expectedAnswer || "", 12000), requiredConcepts: lines(draft.requiredConcepts || []),
    forbiddenClaims: lines(draft.forbiddenClaims || []), requiredSourceKeys,
    sources, additionalSources, originalAnswerSnapshotSHA256: feedbackSnapshotHash(feedback),
    reviewer, reviewNotes: notes, reviewedAt: action === "save" ? null : now, updatedAt: now,
    comparisons: previous?.comparisons || [],
    history: [...(previous?.history || []), ...(previous ? [{ revision: previous.revision, status: previous.status,
      referenceSHA256: previous.referenceSHA256, question: previous.question, facts: previous.facts,
      expectedAnswer: previous.expectedAnswer, requiredConcepts: previous.requiredConcepts,
      forbiddenClaims: previous.forbiddenClaims, requiredSourceKeys: previous.requiredSourceKeys,
      sources: previous.sources, additionalSources: previous.additionalSources, originalAnswerSnapshotSHA256: previous.originalAnswerSnapshotSHA256,
      reviewer: previous.reviewer, reviewNotes: previous.reviewNotes, reviewedAt: previous.reviewedAt }] : [])]
  };
  if (!candidate.question) fail("Enter the regression question.");
  if (action === "approve" && (!candidate.expectedAnswer || !candidate.requiredConcepts.length || !requiredSourceKeys.length)) {
    fail("Approval requires a source-checked expected answer, required concepts and supporting evidence selections.");
  }
  candidate.referenceSHA256 = digest({ question: candidate.question, facts: candidate.facts, expectedAnswer: candidate.expectedAnswer,
    requiredConcepts: candidate.requiredConcepts, forbiddenClaims: candidate.forbiddenClaims, requiredSourceKeys,
    sources, originalAnswerSnapshotSHA256: candidate.originalAnswerSnapshotSHA256 });
  return candidate;
}

export function feedbackRegressionExport(records) {
  const cases = records.filter(item => item.regressionCase?.status === "approved").map(item => {
    const { history, comparisons, ...reference } = item.regressionCase;
    return { ...reference, feedbackID: item.id, comparisons: comparisons.filter(result => result.referenceSHA256 === reference.referenceSHA256) };
  });
  if (!cases.length) fail("No approved feedback cases are available to export.");
  return { schema: "permitext.feedback-regressions.v1", cases };
}

export function validateFeedbackRegressionExport(dataset) {
  if (dataset?.schema !== "permitext.feedback-regressions.v1" || !Array.isArray(dataset.cases) || !dataset.cases.length) fail("Invalid feedback regression file.");
  const ids = new Set();
  for (const item of dataset.cases) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) || item.status !== "approved" || !item.reviewer || !item.reviewedAt || !item.expectedAnswer || !item.requiredConcepts?.length) fail("A case is duplicate, incomplete or unapproved.");
    ids.add(item.id);
    if (!Array.isArray(item.sources) || !item.sources.length || !Array.isArray(item.requiredSourceKeys) || !item.requiredSourceKeys.length || item.requiredSourceKeys.some(key => !item.sources.some(source => source.key === key))) fail("An approved case has no bound source evidence.");
    for (const source of item.sources) if (!source || typeof source.text !== "string" || createHash("sha256").update(source.text).digest("hex") !== source.textSHA256) fail("A preserved source was changed.");
    const { question, facts, expectedAnswer, requiredConcepts, forbiddenClaims, requiredSourceKeys, sources, originalAnswerSnapshotSHA256 } = item;
    if (digest({ question, facts, expectedAnswer, requiredConcepts, forbiddenClaims, requiredSourceKeys, sources, originalAnswerSnapshotSHA256 }) !== item.referenceSHA256) fail("The reviewed reference was changed.");
  }
  return dataset;
}

export function feedbackQualityReport(records, spend) {
  const operations = (spend?.operationMetrics || []).filter(item => item.mode !== "mock" && item.status !== "replayed");
  const completed = operations.filter(item => item.status === "completed");
  const current = records.filter(item => item.answerCreatedAt >= spend.periodStart);
  const rated = current.filter(item => researchUsefulnessValues.has(item.usefulness) && item.usefulness);
  const usable = rated.filter(item => item.usefulness === "usable_as_is");
  const coveredIDs = new Set(rated.map(item => item.operationID).filter(Boolean));
  const allCovered = completed.length > 0 && completed.every(item => coveredIDs.has(item.id));
  const knownCosts = operations.length > 0 && operations.every(item => ["completed", "failed", "cancelled"].includes(item.status) && Number.isFinite(item.estimatedCostUSD));
  const totalCost = knownCosts ? operations.reduce((sum, item) => sum + item.estimatedCostUSD, 0) : null;
  const completedIDs = new Set(completed.map(item => item.id));
  const usableCompleted = new Set(usable.filter(item => completedIDs.has(item.operationID)).map(item => item.operationID));
  return { periodStart: spend.periodStart, feedbackCount: current.length, ratedAnswers: rated.length,
    usableAsIs: usable.length, neededCorrection: rated.filter(item => item.usefulness === "needed_correction").length,
    notUsable: rated.filter(item => item.usefulness === "not_usable").length,
    outsideChecking: Object.fromEntries(["none", "brief", "substantial"].map(value => [value, current.filter(item => item.outsideChecking === value).length])),
    usableRateAmongRated: rated.length ? usable.length / rated.length : null, completedTurns: completed.length,
    ratedCompletedTurns: completed.filter(item => coveredIDs.has(item.id)).length,
    failedTurns: operations.filter(item => ["failed", "cancelled"].includes(item.status)).length,
    estimatedCostPerUsableAnswerUSD: allCovered && knownCosts && usableCompleted.size ? totalCost / usableCompleted.size : null,
    costMetricLimitation: "Cost per usable answer requires ratings for every completed turn in this period and known costs, including failures. Ratings measure reported usefulness, not verified correctness." };
}
