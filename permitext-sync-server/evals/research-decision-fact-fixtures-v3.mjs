// Controls for applying a mandatory rule, without inventing an exception.
// V2 inputs and live outcomes remain immutable.
import { researchDecisionFactFixturesV2, assessDecisionFactVerifierResult } from "./research-decision-fact-fixtures-v2.mjs";
import { researchDecisionFactRepair } from "../research-decision-fact-repair.mjs";

export async function researchDecisionFactFixturesV3() {
  const fixtures = (await researchDecisionFactFixturesV2()).slice(0, 3);
  const inventedException = structuredClone(fixtures[1]);
  Object.assign(inventedException, { id: "PC-04-invented-standpipe-exception", expectedPass: false,
    expectedIssueTypes: [], acceptableSubstantiveIssueTypes: ["misstated_provision", "overstated_compliance", "unsupported_requirement", "incorrect_citation"],
    purpose: "Adversarial control: falsely treat the stipulated standpipes as an exception to PC 412.4's applicable mandatory floor-drain rule." });
  Object.assign(inventedException.answer, {
    answerText: "Yes. Because the washers have trapped standpipes, the central laundry room may omit floor drains. The standpipes substitute for PC § 412.4's floor-drain requirement. The three-inch outlet and lint-strainer requirements apply only if floor drains are voluntarily provided.",
    conclusion: "Yes. The trapped standpipes permit omission of the floor drains.",
    explanation: "PC 412.4 allows the stated standpipes to substitute for floor drains."
  });
  inventedException.answer.supportedPoints[0].heading = "Standpipes replace floor drains";
  inventedException.answer.supportedPoints[0].explanation = "PC 412.4 permits the central laundry room to omit floor drains when the automatic clothes washers discharge through trapped standpipes.";
  fixtures.push(inventedException);
  return fixtures;
}

export function assessDecisionFactVerifierResultV3(fixture, verification) {
  if (!fixture.acceptableSubstantiveIssueTypes) return assessDecisionFactVerifierResult(fixture, verification);
  // Several issue labels correctly describe an invented legal exception. Every
  // issue must be substantive, and no fact-deletion repair may activate.
  const actualIssueTypes = [...new Set((verification.issues || []).map((issue) => issue.type))].sort();
  const actualMissingFactIndices = verification.unnecessaryMissingFactIndices || [];
  const repairApplied = researchDecisionFactRepair(fixture.answer, verification).applied;
  return { expectationMatched: verification.pass === false && actualIssueTypes.length > 0 &&
      actualIssueTypes.every((type) => fixture.acceptableSubstantiveIssueTypes.includes(type)) && !actualMissingFactIndices.length && !repairApplied,
    actualIssueTypes, actualMissingFactIndices, repairApplied };
}
