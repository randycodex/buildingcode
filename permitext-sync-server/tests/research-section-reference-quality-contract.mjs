import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness,
  evaluateZoningDeterministicControls, applyZoningResearchRepairPatch } from "../research-zoning-planner.mjs";
import { planZoningConditionalExplanation } from "../research-zoning-conditional-explanation.mjs";
import { evaluateZoningResearchSafety, zoningMappedClauseAnalysis } from "../research-zoning-safety.mjs";

globalThis.fetch = async () => { throw new Error("No network in retained section-reference checks."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const retained = JSON.parse(await readFile(new URL("../evals/fixtures/research-section-reference-live-diagnostics-20260909.json", import.meta.url)));
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const records = new Map();
for (const id of ["ZR-03", "ZR-06", "ZR-20"]) {
  const fixture = retained.cases.find((item) => item.id === id);
  const answer = fixture.providerResponses.find((item) => item.phase === "permitext_code_interpretation").response;
  const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === id), { original: true, zoningSummary: zoningSectionSummary });
  // Reuse only opaque source identities from the retained response. Expected
  // answers never enter canonical source retrieval or the question plan.
  input.pinnedEvidence = input.pinnedEvidence.map((pin) => ({ ...pin, selectionMode: "section_reference",
    sourceID: answer.citations.find((citation) => citation.sectionID === pin.sectionID).sourceIDs[0] }));
  const prerequisitePlan = planZoningResearchQuestion(input);
  const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: prerequisitePlan });
  const originalContext = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan: prerequisitePlan });
  const plan = planZoningConditionalExplanation({ plan: prerequisitePlan, evidence: assembled.sources,
    evidenceReadiness: evaluateZoningEvidenceReadiness({ ...input, evidence: assembled.sources, plan: prerequisitePlan, deterministicContext: originalContext }),
    evidenceSelection: assembled.zoningSelection });
  const deterministicContext = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan });
  const controls = (candidate) => evaluateZoningDeterministicControls({ plan, deterministicContext, answer: candidate, providerRequestCount: 1 });
  const safety = (candidate) => evaluateZoningResearchSafety({ ...input, evidence: assembled.sources, answer: candidate, questionPlan: plan });
  const patch = fixture.providerResponses.find((item) => item.phase === "permitext_zoning_source_bounded_repair")?.response;
  const repaired = patch ? applyZoningResearchRepairPatch(answer, patch) : null;
  records.set(id, { answer, repaired, input, assembled, plan, deterministicContext, controls, safety });
  if (process.argv.includes("--inspect")) console.log(JSON.stringify({ id,
    draft: { controls: controls(answer).issues, safety: safety(answer).issues },
    repaired: repaired ? { controls: controls(repaired).issues, safety: safety(repaired).issues } : null }));
}
if (!process.argv.includes("--inspect")) {
  const appendix = records.get("ZR-03");
  for (const candidate of [appendix.answer, appendix.repaired]) {
    assert(appendix.controls(candidate).pass);
    assert(appendix.safety(candidate).pass, JSON.stringify(appendix.safety(candidate).issues));
    for (const field of ["answerText", "conclusion", "supportedPoint"]) {
      for (const delimiter of [". ", "; ", ", and ", ", but ", " — "]) {
        for (const assertion of ["the property is approved", "the owner may proceed", "this site lies in Subarea 1"]) {
          const bad = structuredClone(candidate);
          if (field === "supportedPoint") bad.supportedPoints[0].explanation += delimiter + assertion;
          else bad[field] = (bad[field] || bad.answerText).replace(/\.$/, "") + delimiter + assertion;
          assert(!appendix.safety(bad).pass, `${field}: ${delimiter}${assertion}`);
        }
      }
    }
  }
  const storage = records.get("ZR-06");
  // The nominal negative lead must satisfy the conditional-plan boundary.
  // The separate mixed-source point must fail even though both provisions have
  // valid top-level citations. This runs through the conditional-plan compiler.
  const storageIssues = storage.controls(storage.answer).issues;
  assert(!storageIssues.some((issue) => issue.code === "CONDITIONAL_DETERMINATION_BOUNDARY_MISSING"));
  assert.deepEqual(storageIssues.filter((issue) => issue.code === "EXPLICIT_ZONING_RULE_SOURCE_NOT_BOUND")
    .map((issue) => [issue.code, issue.pointIndex, issue.sectionNumber]),
    [["EXPLICIT_ZONING_RULE_SOURCE_NOT_BOUND", 4, "42-192"]]);
  assert.deepEqual(storageIssues.filter((issue) => issue.code === "CONDITIONAL_PROJECT_FACT_OMITTED").map((issue) => issue.factID),
    ["special_district_status", "zoning_lot_area"]);
  const existingFacilitySource = storage.answer.citations.find((citation) => citation.sectionID === "20022473").sourceIDs[0];
  const performanceSource = storage.answer.supportedPoints[4].sourceIDs[0];
  const boundStorage = structuredClone(storage.answer);
  boundStorage.supportedPoints[4].sourceIDs.push(existingFacilitySource);
  boundStorage.missingFacts.push("Special-district status", "Current zoning-lot area");
  assert.deepEqual(storage.controls(boundStorage).issues.map((issue) => issue.obligationID),
    ["storage_documented_reconstruction_branch", "storage_undocumented_nonconforming_branch"]);
  // A handwritten completeness contrast, not a repair of the retained draft or
  // proof that the provider generated these missing branches.
  boundStorage.supportedPoints.push({ heading: "Historical alternatives", sourceIDs: [existingFacilitySource],
    explanation: "Documented reconstruction after damage or destruction on the same zoning lot has a Section 43-10 floor-area limit; inadequate documentation leads to nonconforming-use treatment under Article V. Neither historical alternative can be applied without the missing 2017 facts." });
  assert(storage.controls(boundStorage).pass, JSON.stringify(storage.controls(boundStorage).issues));
  const switchedStorage = structuredClone(boundStorage);
  switchedStorage.supportedPoints[4].sourceIDs = [existingFacilitySource];
  assert.deepEqual(storage.controls(switchedStorage).issues.map((issue) => [issue.code, issue.sectionNumber, issue.sourceIDs]),
    [["EXPLICIT_ZONING_RULE_SOURCE_NOT_BOUND", "42-193", [performanceSource]]]);
  assert(storage.safety(storage.answer).pass, JSON.stringify(storage.safety(storage.answer).issues));
  assert(storage.safety(boundStorage).pass, JSON.stringify(storage.safety(boundStorage).issues));
  assert(!zoningMappedClauseAnalysis(storage.answer).some((clause) => /^\(ZR\b/.test(clause.clause)),
    "Reference-only parentheticals must not become assertion fragments.");
  assert(zoningMappedClauseAnalysis(storage.answer).some((clause) => clause.locationBoundary && /no property location/i.test(clause.clause)));
  assert(zoningMappedClauseAnalysis(storage.answer).some((clause) => clause.locationBoundary && /no selected map/i.test(clause.clause)));
  // Every field remains accountable for its own claims. These mutations retain
  // the real draft and sources, including its general rule and unknown facts.
  const targetFields = ["answerText", "conclusion", ...boundStorage.supportedPoints.flatMap((_, index) =>
    [`${index}.heading`, `${index}.explanation`])];
  for (const field of targetFields) {
    for (const delimiter of [". ", "; ", ", and ", ", but ", " — ", " (ZR § 42-192; "]) {
      for (const assertion of ["the property is approved", "the owner may proceed", "this applies to the project", "this site is in Subarea 1", "the proposed facility is not permitted as-of-right"]) {
        const unsafe = structuredClone(boundStorage);
        const [index, key] = field.split(".");
        const target = key ? unsafe.supportedPoints[Number(index)] : unsafe;
        const name = key || field;
        target[name] = (target[name] || unsafe.answerText).replace(/\.$/, "") + delimiter + assertion + (delimiter.includes("(") ? ".)" : ".");
        assert(storage.safety(unsafe).issues.some((issue) => issue.type === "zoning_missing_mapped_location"),
          `${field}: ${delimiter}${assertion}`);
      }
    }
  }
  for (const sentence of [
    "The owner should verify the map. It is not an as-of-right authorization.",
    "He cannot determine the mapped status without the official map, but retains the right to proceed.",
    "He cannot determine the mapped status without the official map, but is cleared to proceed."
  ]) {
    const unsafe = structuredClone(boundStorage);
    unsafe.answerText += ` ${sentence}`;
    assert(storage.safety(unsafe).issues.some((issue) => issue.type === "zoning_missing_mapped_location"), sentence);
  }
  const { answer, repaired, controls, safety } = records.get("ZR-20");
  assert(controls(answer).pass, JSON.stringify(controls(answer).issues));
  // The first draft still has an unqualified classification in a supported
  // point. The retained repair adds the qualification to that point too.
  assert(safety(answer).issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"));
  for (const candidate of [repaired]) {
    assert(controls(candidate).pass, JSON.stringify(controls(candidate).issues));
    assert(safety(candidate).pass, JSON.stringify(safety(candidate).issues));
    const misbound = structuredClone(candidate);
    misbound.supportedPoints[0].sourceIDs = ["unrelated-source"];
    assert(controls(misbound).issues.some((issue) => issue.code === "ANSWER_OBLIGATION_SOURCE_NOT_BOUND"));
    const missing = { ...candidate, missingFacts: [] };
    assert(safety(missing).issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"));
    for (const placement of ["conclusion", "answerText", "supportedPoint", "supportedPointHeading", "evidenceLimitation"]) {
      const bad = structuredClone(candidate);
      const text = "The level is excluded from zoning floor area regardless of the lowered-yard condition.";
      if (placement === "supportedPoint") bad.supportedPoints.push({ heading: "Final result", explanation: text, sourceIDs: candidate.supportedPoints[0].sourceIDs });
      else if (placement === "supportedPointHeading") bad.supportedPoints[0].heading = text;
      else if (placement === "evidenceLimitation") bad.evidenceLimitations.push(text);
      else bad[placement] = text;
      assert(safety(bad).issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"), placement);
    }
    for (const text of [
      "The lowered-yard condition remains unresolved. The level is excluded from zoning floor area.",
      "The owner provided the lowered-yard documents. The level is excluded from zoning floor area.",
      "No, the level is excluded from zoning floor area, provided the lowered-yard rule does not apply; however, the level is excluded from zoning floor area.",
      "No, the level is excluded from zoning floor area, provided the lowered-yard rule does not apply. However, the level is excluded regardless of the yard measurement.",
      "No, the level is excluded from zoning floor area, provided the lowered-yard rule does not apply.\n\nThe level is excluded from zoning floor area."
    ]) {
      assert(safety({ ...candidate, answerText: text }).issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"), text);
    }
    const formatted = structuredClone(candidate);
    formatted.answerText = formatted.answerText.replace("provided that", "**provided that**");
    assert(safety(formatted).pass, JSON.stringify(safety(formatted).issues));
  }
  console.log("Retained section-reference quality checks passed with wrong-source and unconditional-result controls; zero API calls.");
}
