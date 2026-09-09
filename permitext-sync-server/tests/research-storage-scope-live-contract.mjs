import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness,
  evaluateZoningDeterministicControls } from "../research-zoning-planner.mjs";
import { planZoningConditionalExplanation } from "../research-zoning-conditional-explanation.mjs";
import { bindExplicitZoningRuleSources } from "../research-zoning-attribution.mjs";
import { zoningMappedClauseAnalysis } from "../research-zoning-safety.mjs";

globalThis.fetch = async () => { throw new Error("No network in retained storage-scope checks."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-storage-scope-2026-09-09.json", import.meta.url)));
assert.equal(run.status, "completed");
assert.equal(run.results[0].status, "failed");
assert.equal(run.providerCalls.length, 1);
assert.equal(run.spend.pendingRequestCount, 0);
const call = run.providerCalls[0];
assert.equal(call.phase, "permitext_code_interpretation");
const raw = call.output.flatMap((item) => item.content || []).find((item) => item.type === "output_text");
const answer = JSON.parse(raw.text);
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === "ZR-06"), { original: true, zoningSummary: zoningSectionSummary });
input.pinnedEvidence = input.pinnedEvidence.map((pin) => ({ ...pin, selectionMode: "section_reference",
  sourceID: answer.citations.find((citation) => citation.sectionID === pin.sectionID).sourceIDs[0] }));
const originalPlan = planZoningResearchQuestion(input);
const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: originalPlan });
const originalContext = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan: originalPlan });
const plan = planZoningConditionalExplanation({ plan: originalPlan, evidence: assembled.sources,
  evidenceReadiness: evaluateZoningEvidenceReadiness({ ...input, evidence: assembled.sources, plan: originalPlan, deterministicContext: originalContext }),
  evidenceSelection: assembled.zoningSelection });
const context = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan });
const result = evaluateZoningDeterministicControls({ plan, deterministicContext: context, answer, providerRequestCount: 1 });
assert(!result.issues.some((issue) => issue.code === "CONDITIONAL_PROJECT_FACT_OMITTED"),
  "The actual generated draft now includes both newly preserved missing facts.");
assert(result.issues.some((issue) => issue.code === "EXPLICIT_ZONING_RULE_SOURCE_NOT_BOUND" &&
  issue.pointIndex === 4 && issue.sectionNumber === "42-193"),
  "The actual new mixed-source point must remain rejected until its missing source is bound.");
// Do not encode the observed wording-related false rejections as desired
// behavior. The live result preserves them for the next parser repair.
const reconciled = bindExplicitZoningRuleSources({ answer, evidence: assembled.sources, plan });
assert.equal(reconciled.repairs.length, 1);
assert.equal(reconciled.repairs[0].sectionNumber, "42-193");
assert.equal(reconciled.repairs[0].pointIndex, 4);
const after = evaluateZoningDeterministicControls({ plan, deterministicContext: context, answer: reconciled.answer, providerRequestCount: 1 });
assert(!after.issues.some((issue) => ["EXPLICIT_ZONING_RULE_SOURCE_NOT_BOUND", "CONDITIONAL_DETERMINATION_BOUNDARY_MISSING"].includes(issue.code)),
  JSON.stringify(after.issues));
assert.deepEqual(after.issues.filter((issue) => issue.code === "ANSWER_OBLIGATION_NOT_COVERED").map((issue) => issue.obligationID),
  ["storage_documented_reconstruction_branch", "storage_undocumented_nonconforming_branch"],
  "The actual draft's omitted source branches must remain visible after metadata repair.");
assert.equal(reconciled.answer.answerText, answer.answerText);
const clauses = zoningMappedClauseAnalysis(reconciled.answer);
assert(clauses.some((clause) => clause.locationBoundary && /an as-of-right determination/.test(clause.clause)));
assert(!clauses.some((clause) => /supplied facts.*The property/.test(clause.clause)),
  "Closing Markdown emphasis must not join adjacent sentences into one assertion.");
console.log("Retained storage-scope draft: missing facts preserved; source binding and nominal boundary repaired; two omitted branches rejected; zero new API calls or full-quality acceptance.");
