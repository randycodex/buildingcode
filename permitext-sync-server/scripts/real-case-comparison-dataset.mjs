import { createHash } from "node:crypto";

export const sha256 = value => createHash("sha256").update(value).digest("hex");
const text = value => typeof value === "string" && value.trim();
const stringList = value => Array.isArray(value) && value.every(text);

export function prepareRealCaseDataset(sourceText) {
  const dataset = JSON.parse(sourceText);
  if (!Array.isArray(dataset.cases) || !dataset.cases.length) throw Error("A nonempty cases array is required.");
  const ids = new Set(), urls = new Set(), categories = {}, errors = [];
  const flagged = new Set(dataset.metadata?.additional_review_flags || []);
  const adapted = new Set(dataset.metadata?.explicit_NYC_adaptation_with_unstated_source_jurisdiction || []);
  const historical = new Set(dataset.metadata?.historical_filing_case || []);
  for (const entry of dataset.cases) {
    for (const field of ["id", "category", "target_jurisdiction", "research_as_of", "question", "expected_answer", "code_edition", "answer_time_basis", "location_status", "review_status"]) {
      if (!text(entry[field])) errors.push(`${entry.id || "unknown"}: missing ${field}`);
    }
    for (const field of ["provided_facts", "missing_facts", "must_include", "must_not_claim"]) {
      if (!stringList(entry[field])) errors.push(`${entry.id}: invalid ${field}`);
    }
    if (!/^[A-Z][A-Z0-9-]{1,63}$/.test(entry.id || "")) errors.push(`${entry.id}: invalid case ID`);
    if (ids.has(entry.id)) errors.push(`${entry.id}: duplicate ID`);
    ids.add(entry.id);
    if (!text(entry.source?.url) || !text(entry.source?.retrieval_status)) errors.push(`${entry.id}: incomplete provenance`);
    else {
      if (urls.has(entry.source.url)) errors.push(`${entry.id}: duplicate original thread URL`);
      urls.add(entry.source.url);
    }
    if (!Array.isArray(entry.authorities) || !entry.authorities.length || entry.authorities.some(a => !text(a.section) || !text(a.url))) errors.push(`${entry.id}: incomplete authorities`);
    for (const value of [entry.source?.url, ...(entry.authorities || []).map(a => a.url)].filter(Boolean)) {
      try { if (new URL(value).protocol !== "https:") errors.push(`${entry.id}: non-HTTPS source`); }
      catch { errors.push(`${entry.id}: invalid URL`); }
    }
    categories[entry.category] = (categories[entry.category] || 0) + 1;
  }
  if (dataset.metadata?.case_count !== dataset.cases.length) errors.push("Declared case count differs from actual count.");
  if (dataset.metadata?.unique_original_thread_count !== urls.size) errors.push("Declared unique-thread count differs from actual count.");
  for (const [category, count] of Object.entries(dataset.metadata?.coverage || {})) {
    if (categories[category] !== count) errors.push(`Declared coverage differs for ${category}.`);
  }
  if (Object.keys(categories).length !== Object.keys(dataset.metadata?.coverage || {}).length) errors.push("Declared category set differs from actual set.");
  for (const id of [...flagged, ...adapted, ...historical]) if (!ids.has(id)) errors.push(`Review flag names nonexistent case ${id}.`);
  if (errors.length) throw Error(errors.join("\n"));

  // Deliberate allowlist: answer keys, authorities, missing facts and review
  // rubrics never enter the inputs used by retrieval or candidate writers.
  const inputs = dataset.cases.map(entry => ({
    id: entry.id,
    question: entry.question,
    suppliedFacts: [...entry.provided_facts],
    jurisdiction: entry.target_jurisdiction,
    originalLocationStatus: entry.location_status,
    researchAsOf: entry.research_as_of,
    scenarioAdaptedToNYC: adapted.has(entry.id),
    prompt: [
      `Evaluate this New York City scenario as of ${entry.research_as_of}. Preserve any stated filing or work dates when selecting the applicable code.`,
      adapted.has(entry.id) ? "The original project's jurisdiction is unknown; this question expressly adapts that scenario to NYC." : "",
      `Original-source location status: ${entry.location_status}`,
      entry.question,
      entry.provided_facts.length ? `Additional facts supplied by the questioner:\n${entry.provided_facts.map(f => `- ${f}`).join("\n")}` : ""
    ].filter(Boolean).join("\n\n")
  }));
  const references = dataset.cases.map(entry => ({
    ...entry,
    status: "draft",
    independentlyVerifiedInThisExercise: false,
    additionalVerificationRequired: flagged.has(entry.id),
    historicalFilingQuestion: historical.has(entry.id)
  }));
  return {
    sourceSHA256: sha256(sourceText),
    inputsSHA256: sha256(JSON.stringify(inputs)),
    inputs, references,
    summary: {
      caseCount: inputs.length, uniqueOriginalThreadCount: urls.size, categories,
      authorityCount: references.reduce((sum, c) => sum + c.authorities.length, 0),
      uniqueAuthorityURLCount: new Set(references.flatMap(c => c.authorities.map(a => a.url))).size,
      flaggedReferenceIDs: [...flagged], adaptedScenarioIDs: [...adapted], historicalFilingIDs: [...historical],
      sourceAccessNeedsReviewIDs: references.filter(c => /index|search|blocked|403|unavailable|error/i.test(c.source.retrieval_status)).map(c => c.id),
      allReferencesRemainDraft: true
    }
  };
}
