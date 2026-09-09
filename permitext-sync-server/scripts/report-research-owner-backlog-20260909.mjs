// Inventory retained evidence only. This does not run Research or approve answers.
import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

assert(!process.argv.includes("--run-live"), "This report cannot dispatch Research.");
globalThis.fetch = async () => { throw new Error("Network forbidden in backlog inventory."); };
const root = new URL("../", import.meta.url);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const files = new Map();
async function read(file, expectedHash) {
  const bytes = await readFile(new URL(file, root));
  const sha256 = hash(bytes);
  if (expectedHash) assert.equal(sha256, expectedHash, `Changed retained evidence: ${file}`);
  files.set(file, sha256);
  return JSON.parse(bytes);
}
const auditFile = "evals/results/research-owner-api-round2-source-resolutions-cost-audit-2026-09-09.json";
const audit = await read(auditFile);
const originals = await read("evals/research-reconciled-answer-key.json",
  "64c83744410c3dfa4bff565328d9e31edde3c6c55cf98b79d52c587f1965d455");
const added = await read("evals/research-owner-code-candidates.json",
  "461b47898980aeaa29cf65a728b548fe3a1de70105beb0dd34a16c4e182adbe7");
const cohort = [...originals.cases, ...added.cases];
assert.equal(cohort.length, 110);
const ids = new Set(cohort.map((item) => item.id));
assert.equal(ids.size, 110);
const firstInventoryFile = "evals/results/research-owner-backlog-2026-09-09.json";
const firstInventory = await read(firstInventoryFile);
const priorInventoryFile = "evals/results/research-owner-backlog-v4-2026-09-09.json";
const priorInventory = await read(priorInventoryFile);
const supplementalReviewFile = "evals/results/research-owner-unmatched-answer-review-2026-09-09.json";
const supplementalReview = await read(supplementalReviewFile,
  "324f63ea67b8366c0b16ccf6ad3d413d585f6340cc194c21065ba5ed34282ab2");
assert.deepEqual(new Set(supplementalReview.cases.map((item) => item.id)),
  new Set(firstInventory.cases.filter((item) => item.status === "latest_answer_review_not_located").map((item) => item.id)));
assert.equal(supplementalReview.cases.length, 24);
assert.equal(supplementalReview.summary.newProviderCalls, 0);
assert.equal(supplementalReview.summary.newNetworkCalls, 0);
const claimScopeReviewFile = "evals/results/research-owner-claim-scope-answer-assessment-2026-09-09.json";
const claimScopeReview = await read(claimScopeReviewFile,
  "74bac12c39f4c835afd1821a633dfe30974b27fab4368bf7766cf4c10fd46ba6");
assert.deepEqual(claimScopeReview.cases.map((item) => item.id), ["DOBNOW-003", "DOBNOW-004"]);
assert.equal(claimScopeReview.summary.reviewProviderCalls, 0);
assert.equal(claimScopeReview.summary.reviewNetworkCalls, 0);
const draftFocusReviewFile = "evals/results/research-owner-draft-focus-answer-assessment-2026-09-09.json";
const draftFocusReview = await read(draftFocusReviewFile,
  "b00067a51640e6cbde309478c16f14951002c2fd1ca0c83367989e9fc55ae85a");
assert.deepEqual(draftFocusReview.cases.map((item) => item.id), ["DOBNOW-003", "DOBNOW-004"]);
assert.equal(draftFocusReview.summary.reviewProviderCalls, 0);
assert.equal(draftFocusReview.summary.reviewNetworkCalls, 0);
const sourceResolutionsReviewFile = "evals/results/research-owner-source-resolutions-answer-assessment-2026-09-09.json";
const sourceResolutionsReview = await read(sourceResolutionsReviewFile,
  "ee006b57e4d309e2a173ab36d6232eb3ce241ce26573e662cdf993ba2e2f7645");
assert.deepEqual(sourceResolutionsReview.cases.map((item) => item.id), ["DOBNOW-003", "DOBNOW-004", "DOBNOW-023"]);
assert.equal(sourceResolutionsReview.summary.reviewProviderCalls, 0);
assert.equal(sourceResolutionsReview.summary.reviewNetworkCalls, 0);

const attempts = [];
const runRefs = [...audit.historicalLedgerHashes, ...audit.ledgers];
assert.equal(new Set(runRefs.map((ref) => ref.file)).size, runRefs.length);
for (const ref of runRefs) {
  const run = await read(ref.file, ref.sha256);
  const completedAt = run.completedAt || run.startedAt;
  assert(Number.isFinite(Date.parse(completedAt)), `Missing run time: ${ref.file}`);
  for (const result of run.results) {
    const calls = run.providerCalls.filter((call) => call.caseID === result.id);
    if (!ids.has(result.id) || result.scope === "verifier-only" || !calls.length) continue;
    assert(run.sourceCommit, `Missing source commit: ${ref.file}`);
    attempts.push({ id: result.id, file: ref.file, fileSHA256: ref.sha256,
      completedAt, sourceCommit: run.sourceCommit, delivered: !!result.answer,
      httpStatus: result.httpStatus ?? null, durationMilliseconds: result.durationMilliseconds ?? null,
      providerCalls: calls.length, inputSHA256: result.inputSHA256 ?? null,
      answerTextSHA256: result.answer ? hash(result.answer.answerText || "") : null,
      resultSHA256: hash(JSON.stringify(result)), failureCodes: [...new Set((result.operations || [])
        .map((operation) => operation.failureCode).filter(Boolean))] });
  }
}
attempts.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
const latest = new Map();
for (const attempt of attempts) latest.set(attempt.id, attempt);
assert.equal(latest.size, 110, "Do not silently drop a case without a retained attempt.");

const reviewFields = new Set(["coreReview", "note", "notes", "reviewStatus", "status", "review", "finding",
  "findings", "mainAnswerReview", "presentationReview", "reviewNote", "mainConclusion", "remainingQualityGap",
  "wholeAnswerAcceptance", "strictExpectedAnswerAlignment", "wholeAnswerDevelopmentReview", "issues", "reviewDetail",
  "presentationNotes", "remainingFindings", "unresolved", "confirmed", "missingExpected", "checkerFindings",
  "presentationGaps", "materialCompleteness", "presentation", "mainCalculationAndCitationReview", "reviewNotes",
  "backlogDisposition", "workItemIDs"]);
const reviews = [];
const scannedReviewFiles = [];
for (const name of (await readdir(new URL("evals/results/", root))).sort()) {
  if (!/^research-owner-.*(review|assessment).*2026-09-0[789]\.json$/.test(name) ||
    /(live-|preflight|cost-audit|code-source-review|dob008-source-scope)/.test(name)) continue;
  const file = `evals/results/${name}`, document = await read(file);
  scannedReviewFiles.push(file);
  const rows = document.cases || document.results || document.reviews ||
    (Array.isArray(document.findings) && document.findings[0]?.id ? document.findings : null) ||
    (document.case ? [document.case] : document.id || document.caseID ? [document] : []);
  for (const [index, row] of rows.entries()) {
    const id = row.id || row.caseID, attempt = latest.get(id);
    if (!attempt) continue;
    const sourceCommit = row.sourceCommit || document.liveSourceCommit || document.sourceCommit;
    const explicitRun = row.latestResultFile || row.file || row.resultFile;
    if (explicitRun ? explicitRun !== attempt.file : sourceCommit !== attempt.sourceCommit) continue;
    const matchingAttempts = attempts.filter((item) => item.id === id &&
      (explicitRun ? item.file === explicitRun : item.sourceCommit === sourceCommit));
    assert.equal(matchingAttempts.length, 1, `Ambiguous review-to-attempt binding: ${file} ${id}`);
    if (row.inputSHA256 && attempt.inputSHA256) assert.equal(row.inputSHA256, attempt.inputSHA256);
    reviews.push({ id, file, fileSHA256: files.get(file), rowIndex: index,
      sourceCommit: attempt.sourceCommit,
      binding: explicitRun ? "explicit-run-file-and-case" : "unique-source-commit-and-case",
      reviewedAt: document.reviewedAt || document.reviewedOn || document.checkedAt || null,
      findings: Object.fromEntries(Object.entries(row).filter(([key]) => reviewFields.has(key))) });
  }
}

// Manual triage of the retained review findings, not model scoring or a new
// answer-key decision. These explicit lists make category choices reviewable.
const substantiveGapIDs = new Set(("CC-04 FGC-02 ZR-18 MC-09 ZR-16 DOBNOW-002 DOBNOW-008 DOBNOW-021 " +
  "DOBNOW-013 DOBNOW-016 DOBNOW-024 ZR-09 ZR-19 ZR-08 FGC-12 GAP-06 GAP-07 GAP-03 CC-02 CC-05 ZR-12").split(" "));
const presentationGapIDs = new Set(("CC-03 DOBNOW-018 FGC-03 FGC-04 MC-15 GAP-05 PC-05 GAP-11 PC-12 " +
  "MC-01 MC-12 PC-13 DOBNOW-001 DOBNOW-006 DOBNOW-015").split(" "));
const fullHistoricalReviewIDs = new Set(["ZR-01", "ZR-14", "ZR-21"]);
const coreReviewIDs = new Set(("DOBNOW-019 MC-06 PC-15 PC-04 PC-10 FGC-11 FGC-14 FGC-15 MC-11 MC-14 " +
  "PC-06 PC-07 PC-09 PC-11 PC-14 GAP-09 GAP-10 GAP-12 GAP-13 GAP-15 GAP-08 MC-13 ZR-02 ZR-05 ZR-10 " +
  "ZR-11 ZR-15 DOBNOW-005 DOBNOW-007 DOBNOW-009 DOBNOW-010 DOBNOW-011 DOBNOW-012").split(" "));
const triagedDeliveredIDs = [...substantiveGapIDs, ...presentationGapIDs, ...fullHistoricalReviewIDs, ...coreReviewIDs];
assert.equal(new Set(triagedDeliveredIDs).size, triagedDeliveredIDs.length, "Delivered triage categories must be exclusive.");
for (const id of triagedDeliveredIDs) {
  assert(ids.has(id) && latest.get(id).delivered && reviews.some((review) => review.id === id));
}
assert([...substantiveGapIDs].every((id) => !presentationGapIDs.has(id)));

const workItems = [
  { id: "R1", area: "Conditions and exceptions", title: "Keep conclusions consistent with conditions and conflicting source passages",
    cases: "CC-04 FGC-02 MC-09 ZR-18 ZR-19 DOBNOW-003 DOBNOW-004 DOBNOW-014 DOBNOW-022",
    state: "open", closeWhen: "The delivered main conclusion and every supporting claim preserve the applicable condition; a caveat elsewhere cannot contradict or repair an unconditional claim." },
  { id: "R2", area: "Complete sources and answers", title: "Retain the material source scope and required answer branches",
    cases: "ZR-04 ZR-09 ZR-13 ZR-16 DOBNOW-002 DOBNOW-013 DOBNOW-015 DOBNOW-016 DOBNOW-020 DOBNOW-021 DOBNOW-024",
    state: "open", closeWhen: "Complete source passages reach drafting and verification, and each material benchmark concept is present without inventing missing project facts. Any proposed reference correction is documented separately." },
  { id: "R3", area: "Conditions and exceptions", title: "Respect established facts and ask only decision-relevant questions",
    cases: "ZR-08 ZR-12 ZR-13 ZR-17 FGC-12 GAP-03 GAP-06 GAP-07 CC-02 CC-05",
    state: "open", closeWhen: "Stated facts remain conditional premises rather than being unnecessarily reopened; missing facts are requested only when they can change the asked conclusion." },
  { id: "R4", area: "Answer verification", title: "Confirm mapped-location and definition checks accept supported uncertainty",
    cases: "ZR-03 ZR-07 ZR-20", state: "partly-repaired-awaiting-confirmation",
    localEvidence: ["tests/research-zoning-original-code-regressions.mjs", "tests/research-storage-scope-live-contract.mjs", "tests/research-zoning-mapped-review-http-contract.mjs"],
    closeWhen: "Current retained-draft and negative-control checks pass, followed by accepted live answers for the affected cases; unsafe parcel conclusions remain rejected." },
  { id: "R5", area: "Complete sources and answer verification", title: "Match DOB source selection and verification to the requested decision",
    cases: "DOBNOW-004 DOBNOW-008 DOBNOW-014 DOBNOW-017 DOBNOW-020 DOBNOW-022 DOBNOW-023",
    state: "partly-repaired-awaiting-confirmation",
    localEvidence: ["evals/results/research-owner-focused-source-validation-2026-09-09.json", "tests/research-official-pdf-http-contract.mjs"],
    closeWhen: "Authority and field questions retain material conditions without unrelated readiness demands; complete PDF groups and missing-group rejection work in the live path. No failed semantic verdict is overridden." },
  { id: "R6", area: "Citation accuracy", title: "Bind each retained claim to all of its supporting authorities",
    cases: "GAP-14", state: "open",
    closeWhen: "Mixed-source points and additional narrative claims retain every needed source identity, or unasked claims are omitted. Top-level citations or a separate correctly cited point do not cure a missing binding in another point. Occupancy-exception claims remain included in this repair." },
  { id: "R7", area: "Answer format", title: "Remove repeated rules, unrelated branches and unasked navigation",
    cases: [...presentationGapIDs].join(" "), state: "open",
    closeWhen: "The complete delivered answer follows direct answer, rule/citation, application and material qualifications without repeated generated fields or unasked instructions. Substantive fixes retain their own closure requirements." },
  { id: "V1", area: "Validation", title: "Review latest answers without a matched retained answer review",
    cases: "", state: "pending-review", closeWhen: "Each unmatched answer receives a source-bound, complete-answer review; unresolved older findings are checked rather than assumed fixed." },
  { id: "V2", area: "Validation", title: "Confirm all 110 questions against one identified current baseline",
    cases: cohort.map((item) => item.id).join(" "), state: "pending-confirmation",
    closeWhen: "All cases have current, source-bound delivery and whole-answer acceptance evidence; historical core matches and model verifier passes do not count as complete acceptance." },
  { id: "V3", area: "Speed and cost", title: "Measure representative latency and cost of acceptable answers",
    cases: cohort.map((item) => item.id).join(" "), state: "pending-confirmation",
    closeWhen: "A prepriced, authorized sample measures full-turn p50/p90 latency and cost including failures and repairs; report development estimates separately from invoices and subscription economics." }
];

const cases = cohort.map((item) => {
  const attempt = latest.get(item.id), matched = reviews.filter((review) => review.id === item.id);
  assert(matched.length <= 1, `Multiple latest reviews need explicit reconciliation: ${item.id}`);
  let status;
  if (!attempt.delivered) status = "latest_attempt_undelivered";
  else if (!matched.length) status = "latest_answer_review_not_located";
  else if ([supplementalReviewFile, claimScopeReviewFile, draftFocusReviewFile, sourceResolutionsReviewFile].includes(matched[0].file)) {
    status = matched[0].findings.backlogDisposition;
    assert(["historical_whole_answer_review_pass", "delivered_with_substance_or_scope_gap", "delivered_with_presentation_gap"].includes(status));
    if (status === "historical_whole_answer_review_pass") {
      assert.equal(matched[0].findings.strictExpectedAnswerAlignment, true);
      assert.equal(matched[0].findings.wholeAnswerDevelopmentReview, "passes-current-reference");
    }
  }
  else if (substantiveGapIDs.has(item.id)) status = "delivered_with_substance_or_scope_gap";
  else if (presentationGapIDs.has(item.id)) status = "delivered_with_presentation_gap";
  else if (fullHistoricalReviewIDs.has(item.id)) {
    assert(matched[0].findings.strictExpectedAnswerAlignment === true);
    assert.equal(matched[0].findings.wholeAnswerDevelopmentReview, "passes-current-reference");
    status = "historical_whole_answer_review_pass";
  } else {
    assert(coreReviewIDs.has(item.id), `A new matched review requires explicit manual triage: ${item.id}`);
    status = "historical_core_review_only";
  }
  return { id: item.id, title: item.title, question: item.question, scenario: item.scenario || "",
    questionContext: item.questionContext || null, caseDefinitionSHA256: hash(JSON.stringify(item)),
    status, latestAttempt: attempt, latestReview: matched[0] || null,
    fullCurrentBaselineAcceptance: "unproven", workItemIDs: [] };
});
for (const review of [...supplementalReview.cases, ...claimScopeReview.cases, ...draftFocusReview.cases, ...sourceResolutionsReview.cases]) for (const id of review.workItemIDs) {
  const item = workItems.find((item) => item.id === id);
  assert(item && id.startsWith("R"), "Supplemental triage must use an existing repair work item.");
  item.cases = [...new Set([...item.cases.split(" ").filter(Boolean), review.id])].join(" ");
}
const missingReviewWork = workItems.find((item) => item.id === "V1");
missingReviewWork.cases = supplementalReview.cases.map((item) => item.id).join(" ");
missingReviewWork.state = "retained-answer-review-complete";
for (const item of workItems) {
  item.cases = item.cases.split(" ").filter(Boolean);
  assert.equal(item.cases.length, new Set(item.cases).size);
  for (const id of item.cases) {
    assert(ids.has(id), `Work item outside the cohort: ${id}`);
    cases.find((item) => item.id === id).workItemIDs.push(item.id);
  }
}
assert(cases.filter((item) => item.status.includes("gap") || !item.latestAttempt.delivered)
  .every((item) => item.workItemIDs.some((id) => id.startsWith("R"))), "Every known gap needs a repair work item.");
const counts = Object.fromEntries(["latest_answer_review_not_located", "delivered_with_substance_or_scope_gap",
  "delivered_with_presentation_gap", "historical_whole_answer_review_pass", "historical_core_review_only", "latest_attempt_undelivered"].map((status) =>
  [status, cases.filter((item) => item.status === status).length]));
assert.equal(Object.values(counts).reduce((a, b) => a + b), 110);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const report = { schema: "permitext-owner-research-backlog-v1", generatedAt: new Date().toISOString(), sourceCommit,
  previousInventory: { file: priorInventoryFile, sha256: files.get(priorInventoryFile) },
  generator: { file: "scripts/report-research-owner-backlog-20260909.mjs", sha256: hash(await readFile(new URL(import.meta.url))) },
  method: "Inventory of retained attempts and explicitly matched development reviews. Gap categories are manual triage of the saved findings, not new semantic grading. No provider, public-document, Project, UI or deployment calls.",
  summary: { numberedCases: 110, latestDelivered: cases.filter((item) => item.latestAttempt.delivered).length,
    latestUndelivered: cases.filter((item) => !item.latestAttempt.delivered).length, counts,
    repairWorkItems: 7, validationWorkItems: 3, completedValidationWorkItems: ["V1"], remainingValidationWorkItems: ["V2", "V3"],
    newProviderCalls: 0, newNetworkCalls: 0,
    currentBaselineFullAcceptanceEstablished: false },
  budget: { auditFile, auditSHA256: files.get(auditFile), authorizationUSD: audit.summary.authorizationUSD,
    conservativeUSD: audit.summary.conservativeUSD, usageEstimateUSD: audit.summary.usageEstimateUSD,
    remainingConservativeAuthorizationUSD: audit.summary.remainingConservativeAuthorizationUSD,
    accountBalanceVerified: false },
  limitations: [
    "The seven repair items are a scoped grouping of known findings, not a proven total of independent bugs. Case overlap is intentional; do not sum work-item case counts.",
    "Latest-attempt results span different code and prompt versions. Failed old attempts can have subsequent local repairs; those repairs need separate confirmation.",
    "Positive prior core reviews are narrower than complete answer acceptance. All explicit whole-answer development passes remain saved-sample findings, not current-baseline or professional approval.",
    "No matched review means no matching standalone answer-review JSON was located in the scanned files. It does not prove the answer is wrong or that no review exists elsewhere.",
    "All original and added questions remain in scope. The supplemental PDF-BPP probe and verifier-only checks are excluded from the 110-case count.",
    "The reference key and source snapshots have evolved; historical passing judgments must be revalidated before current acceptance. No answer-key or runtime verdict was changed by this inventory."
  ], scannedReviewFiles, inputs: [...files].map(([file, sha256]) => ({ file, sha256 })), workItems, cases };

const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) {
  const output = process.argv[outputIndex + 1]; assert(output);
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify({ sourceCommit, summary: report.summary, budget: report.budget }, null, 2));
