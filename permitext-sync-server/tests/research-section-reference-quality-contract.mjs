import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness,
  evaluateZoningDeterministicControls, applyZoningResearchRepairPatch } from "../research-zoning-planner.mjs";
import { planZoningConditionalExplanation } from "../research-zoning-conditional-explanation.mjs";
import { evaluateZoningResearchSafety } from "../research-zoning-safety.mjs";

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
  // This does not certify the draft's separate source-attribution defects.
  assert(storage.controls(storage.answer).pass, JSON.stringify(storage.controls(storage.answer).issues));
  assert(!storage.safety(storage.answer).pass, "The retained storage draft still has unresolved defects.");
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
