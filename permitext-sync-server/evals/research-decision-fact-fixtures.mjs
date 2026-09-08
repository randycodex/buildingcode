// Verifier-only challenge cases. Expected outcomes never enter provider input.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assembledResearchEvidenceForTurn, deterministicResearchEvidenceAnalysisForTurn,
  normalizeResearchInterpretationEvidenceBindings, validateResearchInterpretation } from "../app.mjs";
import { requiredResearchClaimsFromEvidence } from "../research-required-claim-coverage.mjs";

export async function researchDecisionFactFixtures() {
  const recorded = JSON.parse(await readFile(new URL("./results/research-owner-live-compact-confirmation-2026-09-08.json", import.meta.url)));
  const fixtures = [];
  for (const id of ["PC-04", "PC-10"]) {
    const result = recorded.results.find((item) => item.id === id);
    const assembled = await assembledResearchEvidenceForTurn({ question: result.question, messages: [], pinnedEvidence: [], projectFacts: [] });
    const evidence = assembled.sources;
    const call = recorded.providerCalls.find((item) => item.caseID === id && item.phase === "permitext_code_interpretation");
    const draft = JSON.parse(call.output.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text).join(""));
    const answer = validateResearchInterpretation(normalizeResearchInterpretationEvidenceBindings(draft, evidence), evidence);
    assert.equal(answer.answerText, result.answer.answerText, "The reconstructed draft must match the delivered narrative.");
    assert.deepEqual(answer.missingFacts, result.answer.missingFacts);
    const options = { model: "gpt-5.6-luna", requiredClaims: requiredResearchClaimsFromEvidence(evidence), codeBasis: result.answer.codeBasis,
      structuredEvidenceAnalysis: deterministicResearchEvidenceAnalysisForTurn(evidence, []) };
    fixtures.push({ id: `${id}-recorded`, sourceCaseID: id, question: result.question, evidence, answer, options,
      expectedPass: false, expectedIssue: "unnecessary_qualification", expectedMissingFactIndices: answer.missingFacts.map((_, index) => index),
      purpose: "Correct direct result with downstream design inputs incorrectly listed as missing facts." });
    const corrected = structuredClone(answer);
    corrected.missingFacts = [];
    fixtures.push({ id: `${id}-decision-facts-only`, sourceCaseID: id, question: result.question, evidence, answer: corrected, options,
      expectedPass: true, purpose: "Same narrative, rules, qualifications and citations; only non-decision missing facts removed." });
  }
  const laundry = fixtures[0];
  const scopeUnknown = structuredClone(laundry.answer);
  Object.assign(scopeUnknown, {
    answerText: "The stated facts do not establish whether PC 412.4 requires a floor drain here. Confirm whether this is a public coin-operated laundry or a central washing facility of a multiple-family dwelling. In those facilities, rooms containing automatic clothes washers require floor drains that readily drain the entire floor area, with outlets at least 3 inches (76 mm) in diameter and lint strainers (PC § 412.4). The supplied standpipe fact does not establish which facility category applies.",
    conclusion: "PC 412.4 applicability is unresolved because the type of laundry facility is not stated.",
    explanation: "If the facility is within PC 412.4, its floor-drain requirements apply independently of the washer standpipes.",
    missingFacts: ["Whether the room is a public coin-operated laundry or the central washing facility of a multiple-family dwelling."],
    followUpQuestions: []
  });
  scopeUnknown.supportedPoints[0].heading = "Facility scope controls the floor-drain requirement";
  scopeUnknown.supportedPoints[0].explanation = "PC 412.4 requires floor drains in rooms containing automatic clothes washers in public coin-operated laundries and central washing facilities of multiple-family dwellings. Whether this room falls within either category is unresolved.";
  fixtures.push({ id: "PC-04-unresolved-applicability", sourceCaseID: "PC-04", question: "A laundry room has several automatic clothes washers connected to trapped standpipes. Its type of facility is not stated. Does PC 412.4 require a floor drain?",
    evidence: laundry.evidence, answer: scopeUnknown, options: laundry.options, expectedPass: true,
    purpose: "Counterfactual control: genuinely unresolved facility applicability remains in missingFacts." });
  const mixed = structuredClone(scopeUnknown);
  mixed.missingFacts[0] += " Also supply the proposed drain locations, floor elevations and outlet specifications to develop a compliant layout.";
  fixtures.push({ id: "PC-04-mixed-material-entry", sourceCaseID: "PC-04", question: fixtures.at(-1).question,
    evidence: laundry.evidence, answer: mixed, options: laundry.options, expectedPass: false,
    expectedIssue: "unnecessary_qualification", expectedMissingFactIndices: [],
    purpose: "An entry mixes necessary applicability with optional design details. Report the defect but do not authorize deletion of the material entry." });
  const design = structuredClone(laundry.answer);
  Object.assign(design, {
    answerText: "To lay out the required laundry-room floor drainage, supply the floor area, configuration and elevations, proposed drain locations, and outlet and lint-strainer details. The drains must be located to readily drain the entire floor area, have outlets at least 3 inches (76 mm) in diameter, and include lint strainers (PC §§ 412.3, 412.4). Without the layout and elevations, a final drain count and placement cannot be determined from these requirements alone.",
    conclusion: "Supply the floor layout and elevations, proposed drain locations, and outlet and lint-strainer details to develop the requested drainage design.",
    explanation: "The supplied code establishes whole-floor drainage and minimum drain specifications, but does not supply the project geometry needed for the requested layout.",
    followUpQuestions: []
  });
  fixtures.push({ id: "PC-04-requested-design", sourceCaseID: "PC-04", question: "The central laundry room in our multiple-family dwelling must have floor drains. What project details are missing to design their number, placement and specifications?",
    evidence: laundry.evidence, answer: design, options: laundry.options, expectedPass: true,
    purpose: "Counterfactual control: the same design unknowns are relevant when the question explicitly requests that design." });
  return fixtures;
}

export function decisionFactVerifierInput(fixture) {
  // Deliberately exclude expected outcomes/indices, purpose and fixture ID.
  return { question: fixture.question, evidence: fixture.evidence, answer: fixture.answer, options: fixture.options };
}
