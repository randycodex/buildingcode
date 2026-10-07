import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { sha256 } from "./real-case-comparison-dataset.mjs";
import { chargedMicros } from "./real-case-comparison-budget.mjs";

const index = process.argv.indexOf("--directory");
if (index < 0 || !process.argv[index + 1]) throw Error("Required: --directory PATH");
const directory = resolve(process.argv[index + 1]);
const run = join(directory, "paid-run");
const read = name => JSON.parse(readFileSync(join(run, name), "utf8"));
const completion = read("completion.json"), answers = read("answers.json"), freeze = read("answer-freeze.json"), grades = read("grades.json"), ledger = read("ledger.json");
const references = JSON.parse(readFileSync(join(directory, "reference-review.json"), "utf8"));
const retrieval = JSON.parse(readFileSync(join(directory, "preflight.json"), "utf8"));
if (completion.status !== "completed" || answers.cases.length !== 80 || grades.cases.length !== 80 || sha256(JSON.stringify(answers)) !== freeze.SHA256 || grades.answersSHA256 !== freeze.SHA256) throw Error("Incomplete or changed experiment; cannot summarize as a complete comparison.");
if (chargedMicros(ledger) > ledger.capMicros || ledger.capMicros !== 10000000) throw Error("Budget audit failed.");
const arms = ["minimal", "simplified", "current"];
const dimensions = ["correctness", "completeness", "directness", "citationSupport", "materialUncertainty"];
const mean = values => values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(3)) : null;
const median = values => { const a = [...values].sort((a, b) => a - b); return a.length ? a[Math.floor(a.length / 2)] : null; };
const rows = answers.cases.map(c => {
  const review = grades.cases.find(g => g.id === c.id);
  const reference = references.cases.find(r => r.id === c.id);
  const packet = retrieval.rows.find(r => r.id === c.id);
  const judgments = review.review.status === "completed" ? Object.fromEntries(review.review.answer.candidates.map(g => [review.labels[g.label], g])) : {};
  const exactRubricPartition = Object.fromEntries(arms.map(arm => {
    const g = judgments[arm];
    const covered = g ? [...g.requiredConceptsCovered, ...g.missingRequiredConcepts] : [];
    return [arm, covered.length === reference.must_include.length && new Set(covered).size === covered.length && covered.every(s => reference.must_include.includes(s))];
  }));
  return { id: c.id, category: reference.category, requestedFamilyPresent: packet.retrievedCodePrefixes.includes(c.id.split("-")[0] === "GAC" ? "AC" : c.id.split("-")[0]), sourceAccessFlag: retrieval.sourceAccessNeedsReviewIDs.includes(c.id), additionalReferenceVerification: reference.additionalVerificationRequired, adaptedScenario: reference.scenarioAdaptedToNYC ?? c.id === "MC-08", historicalFilingQuestion: reference.historicalFilingQuestion, evidenceSufficiency: review.review.answer?.evidenceSufficiency ?? "grade_failed", evidenceGap: review.review.answer?.evidenceGap ?? review.review.failure, referenceDisagreement: review.review.answer?.referenceDisagreement ?? false, referenceConcern: review.review.answer?.referenceConcern ?? "", preferences: (review.review.answer?.preferredLabels ?? []).map(label => review.labels[label]), exactRubricPartition, judgments, answers: c.answers };
});
function aggregate(selected) {
  return Object.fromEntries(arms.map(arm => {
    const judged = selected.map(c => c.judgments[arm]).filter(Boolean);
    const calls = ledger.requests.filter(r => !r.discarded && r.key.endsWith(`:${arm}`));
    return [arm, {
      cases: selected.length, machineGraded: judged.length,
      completedAnswers: selected.filter(c => c.answers[arm].status === "completed").length,
      means: Object.fromEntries(dimensions.map(d => [d, mean(judged.map(g => g[d]))])),
      unnecessaryRefusals: judged.filter(g => g.unnecessaryRefusal).length,
      flaggedMaterialLegalErrors: judged.filter(g => g.materialLegalError).length,
      flaggedUnsupportedClaims: judged.filter(g => g.unsupportedClaims.length).length,
      flaggedForbiddenClaims: judged.filter(g => g.forbiddenClaimsMade.length).length,
      allDraftConceptsCovered: selected.filter(c => c.exactRubricPartition[arm] && c.judgments[arm]?.missingRequiredConcepts.length === 0).length,
      invalidRubricPartitions: selected.filter(c => c.judgments[arm] && !c.exactRubricPartition[arm]).length,
      // Review prose sometimes treats preferredLabels as an ordering and
      // sometimes as a tied set. Preserve it, but never count it as wins.
      medianAnswerWords: median(selected.filter(c => c.answers[arm].answer).map(c => c.answers[arm].answer.answerText.trim().split(/\s+/).length)),
      medianSeconds: median(calls.filter(c => Number.isFinite(c.seconds)).map(c => c.seconds)),
      costUpperUSD: calls.reduce((n, c) => n + (c.costUpperMicros ?? c.reservedMicros), 0) / 1e6
    }];
  }));
}
const summary = {
  status: "exploratory_draft_reference_machine_review", sourceSHA256: answers.sourceSHA256, answersSHA256: freeze.SHA256,
  writerAttemptCount: 240, completedAnswerCount: rows.reduce((n, c) => n + arms.filter(arm => c.answers[arm].status === "completed").length, 0), reviewAttemptCount: 80, completedReviewCount: grades.cases.filter(c => c.review.status === "completed").length, model: "gpt-6-luna", writerEffort: "low", graderEffort: "medium", capUSD: 10,
  costUpperUSD: chargedMicros(ledger) / 1e6, estimatedTokenCostUSD: completion.estimatedTokenCostUSD,
  actualBillingVerified: false, discardedSetupCalls: ledger.requests.filter(r => r.discarded).length,
  discardedSetupCostUpperUSD: ledger.requests.filter(r => r.discarded).reduce((n, r) => n + (r.costUpperMicros ?? r.reservedMicros), 0) / 1e6,
  total: aggregate(rows), byCategory: Object.fromEntries([...new Set(rows.map(c => c.category))].map(category => [category, aggregate(rows.filter(c => c.category === category))])),
  byEvidenceSufficiency: Object.fromEntries([...new Set(rows.map(c => c.evidenceSufficiency))].map(s => [s, aggregate(rows.filter(c => c.evidenceSufficiency === s))])),
  referenceDisagreementIDs: rows.filter(c => c.referenceDisagreement).map(c => c.id),
  rows
};
writeFileSync(join(run, "summary.json"), JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
const columns = arms.map(arm => `| ${arm} | ${dimensions.map(d => summary.total[arm].means[d]?.toFixed(2) ?? "n/a").join(" | ")} | ${summary.total[arm].unnecessaryRefusals} | ${summary.total[arm].flaggedMaterialLegalErrors} |`).join("\n");
const report = `# Permitext: 80 real-case instruction comparison\n\n240 frozen first-draft attempts produced ${summary.completedAnswerCount} completed answers; 80 comparative review attempts produced ${summary.completedReviewCount} completed reviews. All three writers used gpt-6-luna with low reasoning, identical local evidence, facts, schema and output allowance. The reviewer used Luna with medium reasoning. Results are exploratory machine judgments against draft references, not certified legal accuracy or a production acceptance result.\n\n## Cost\n\nEstimated token cost: $${summary.estimatedTokenCostUSD.toFixed(4)}. Conservative usage-based cost: $${summary.costUpperUSD.toFixed(4)}, including ${summary.discardedSetupCalls} discarded setup calls ($${summary.discardedSetupCostUpperUSD.toFixed(4)} conservative). Hard cap: $10. Actual billing deductions were not independently checked. Pricing was checked against [OpenAI's model documentation](${ledger.pricing.source}).\n\n## Provisional scores\n\nEach dimension is scored separately from 0 to 4. Correctness is evidence-bounded: a cautious answer can score well while answering little, so read completeness and directness alongside it. Error/refusal flags require case review. Averages use completed reviews only; generation failures remain visible to the grader as failed answers.\n\n| Instructions | Correctness | Completeness | Directness | Citation support | Material uncertainty | Unnecessary refusals | Material error flags |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${columns}\n\n## Controls and limitations\n\n- The minimal arm retains the common JSON interface, citation identifiers and model/provider constraints. This is not a recreation of ChatGPT Instant.\n- Current policies were relocated into the instructions field to hold all evidence/data identical. That role-placement change is a possible confound. The current arm tests writer policies, not the unchanged deployed pipeline.\n- No browsing, additional retrieval, production reviewer, repair loop, account storage or user history was used. Answers were frozen before any grading and were not improved after seeing grades.\n- Automatic local Research lacked the listed energy/electrical families in all 20 of those questions; 27 total packets lacked their listed family. Family presence does not establish that the governing provision was retrieved. Reference text-through dates and historical filing paths may need separate verification.\n- References remain drafts. EC-03 and EC-04 require additional base-NEC verification, MC-08 is an explicit NYC adaptation, ECC-10 preserves historical filing dates, and source-access flags remain visible.\n- The reviewer is a separate call of the same model family as the writers. Its judgments and disagreements need human review. Raw responses and exact requests are retained.\n- The first setup forced guidance-only mode. It was stopped before grading, preserved outside this comparison and excluded from scores; its charges remain inside the same $10 cap.\n\n## Review artifacts\n\nSee [all 80 questions and three answers](<${join(run, "answers-for-review.md")}>) and [structured results](<${join(run, "summary.json")}>). No production restrictions were changed by this experiment.\n`;
writeFileSync(join(run, "comparison-report.md"), report, { mode: 0o600 });
let book = "# 80 real questions: three instruction sets\n\nExploratory comparison. Draft reference answers and machine review are not professional approvals. Original source/jurisdiction/access flags are retained below.\n\n";
for (const row of rows) {
  const ref = references.cases.find(c => c.id === row.id);
  book += `## ${row.id}: ${ref.question}\n\nOriginal question: [${ref.source.title}](${ref.source.url}). ${ref.location_status}\n\nFacts: ${ref.provided_facts.join("; ")}.\n\nEvidence review: **${row.evidenceSufficiency}**. ${row.evidenceGap}\n\n`;
  for (const arm of arms) {
    const answer = row.answers[arm], g = row.judgments[arm];
    book += `### ${arm}\n\n${answer.answer?.answerText ?? `Generation failed: ${answer.failure}`}\n\n`;
    if (g) book += `Machine scores (0–4): correctness ${g.correctness}, completeness ${g.completeness}, directness ${g.directness}, citation support ${g.citationSupport}, uncertainty ${g.materialUncertainty}. ${g.summary}\n\n`;
    if (answer.answer?.supportedPoints.length) book += `Source-bound details retained in the full response:\n\n${answer.answer.supportedPoints.map(p => `- **${p.heading}:** ${p.explanation}`).join("\n")}\n\n`;
    if (g?.legalErrors.length) book += `Flagged legal errors: ${g.legalErrors.join("; ")}\n\n`;
    if (g?.unsupportedClaims.length) book += `Flagged unsupported claims: ${g.unsupportedClaims.join("; ")}\n\n`;
  }
  book += `### Draft reference\n\n${ref.expected_answer}\n\nRequired concepts:\n\n${ref.must_include.map(s => `- ${s}`).join("\n")}\n\nSource authorities:\n\n${ref.authorities.map(a => `- [${a.section}](${a.url})`).join("\n")}\n\n${(ref.notes ?? []).join("\n\n")}\n\nReference disagreement: ${row.referenceDisagreement ? row.referenceConcern : "None flagged by the machine reviewer; reference remains unapproved."}\n\n`;
}
writeFileSync(join(run, "answers-for-review.md"), book, { mode: 0o600 });
const bindings = read("binding-audit.json");
writeFileSync(join(run, "comparison-report.md"), report + `\n## Interface validation\n\nThe free production binding audit passed ${bindings.summary.minimal.passed}/80 minimal, ${bindings.summary.simplified.passed}/80 simplified and ${bindings.summary.current.passed}/80 current first drafts. Minimal/simplified failures populated the field reserved for provided web-source claim pairs even though no web sources were supplied. These are interface failures and must be separated from substantive prose scores. Current failed three enacted binding checks. The audit applied production binding normalization and validation, with no semantic reviewer, repair or account storage.\n\nThe reviewer used preferredLabels inconsistently as either an ordering or a tied set. Those lists are retained but are not counted as wins. Its referenceDisagreement flags often denote missing corroborating text, rather than an assertion that the draft answer key is wrong. One case (ZR-09) failed exact rubric partition accounting in all three grades; full-concept counts exclude that case.\n`, { mode: 0o600 });
const followupPath = join(directory, "interface-followup");
if (existsSync(join(followupPath, "binding-audit.json"))) {
  const followup = JSON.parse(readFileSync(join(followupPath, "completion.json"), "utf8"));
  const audit = JSON.parse(readFileSync(join(followupPath, "binding-audit.json"), "utf8"));
  if (followup.status !== "completed") throw Error("Follow-up is incomplete.");
  summary.interfaceFollowup = { cases: 8, attempts: 24, completedAnswers: followup.completedAnswers, paidGrades: 0, bindingSummary: audit.summary, incrementalCostUpperUSD: followup.incrementalCostUpperUSD, selection: "First-listed question in each family", change: "Unused supportingSourceUses field disabled in every arm", scoresCombinedWithPrimary: false };
  summary.totalCostUpperUSD = followup.costUpperUSD;
  summary.totalEstimatedTokenCostUSD = followup.estimatedTokenCostUSD;
  writeFileSync(join(run, "summary.json"), JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
  const primaryReport = readFileSync(join(run, "comparison-report.md"), "utf8");
  writeFileSync(join(run, "comparison-report.md"), primaryReport + `\n## Separate interface follow-up\n\nThe first-listed question in each of the eight families was regenerated once per arm, with one shared interface change: supportingSourceUses had maxItems=0 because no web-support sources were supplied. Behavioral instructions, evidence and other controls stayed fixed. This produced 24 completed answers. The production binding audit passed ${audit.summary.minimal.passed}/8 minimal, ${audit.summary.simplified.passed}/8 simplified and ${audit.summary.current.passed}/8 current. This isolates an interface-contract failure; it does not establish semantic accuracy or production readiness. No additional paid grading was performed and these answers were not mixed into the primary 80-case scores.\n\nIncremental conservative cost: $${followup.incrementalCostUpperUSD.toFixed(5)}. **Total conservative campaign cost: $${followup.costUpperUSD.toFixed(5)}**, including the discarded setup, primary comparison/review and follow-up, under the same $10 cap. Actual billing remains unverified.\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ total: summary.total, byEvidenceSufficiency: Object.fromEntries(Object.entries(summary.byEvidenceSufficiency).map(([s, a]) => [s, a.minimal.cases])), referenceDisagreementIDs: summary.referenceDisagreementIDs, costUpperUSD: summary.costUpperUSD, estimatedTokenCostUSD: summary.estimatedTokenCostUSD, discardedSetupCalls: summary.discardedSetupCalls }, null, 2));
