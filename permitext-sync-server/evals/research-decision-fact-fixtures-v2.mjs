// Corrected diagnostic inputs. Preserve v1 and its historical live results.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchDecisionFactFixtures } from "./research-decision-fact-fixtures.mjs";
import { applyResearchPlumbingSourceRepairs } from "../research-plumbing-source-repairs.mjs";
import { researchDecisionFactRepair } from "../research-decision-fact-repair.mjs";

export async function researchDecisionFactFixturesV2() {
  const original = await researchDecisionFactFixtures();
  const deliveredRun = JSON.parse(await readFile(new URL("./results/research-owner-live-compact-confirmation-2026-09-08.json", import.meta.url)));
  const laundry = structuredClone(original[0]);
  laundry.answer = applyResearchPlumbingSourceRepairs(laundry.answer, laundry.evidence, { question: laundry.question });
  laundry.answer = JSON.parse(JSON.stringify(laundry.answer)); // Match the delivered/provider JSON, omitting undefined fields.
  const delivered = deliveredRun.results.find((item) => item.id === "PC-04").answer;
  for (const key of Object.keys(laundry.answer)) assert.deepEqual(laundry.answer[key], delivered[key],
    `The diagnostic must reproduce the delivered ${key}, including pre-verification source repairs.`);
  Object.assign(laundry, { id: "PC-04-delivered-decision-facts", expectedIssueTypes: ["unnecessary_qualification"],
    expectedRepairApplied: true, purpose: "Actual delivered answer with all source bindings preserved; only unnecessary missing facts should fail." });

  const corrected = structuredClone(laundry);
  Object.assign(corrected, { id: "PC-04-delivered-facts-corrected", expectedPass: true, expectedIssue: undefined,
    expectedIssueTypes: [], expectedMissingFactIndices: [], expectedRepairApplied: false,
    purpose: "Identical delivered answer after the limited missing-fact correction; full verification must pass." });
  corrected.answer.missingFacts = [];

  const broken = structuredClone(corrected);
  Object.assign(broken, { id: "PC-04-missing-point-binding", expectedPass: false, expectedIssueTypes: ["incorrect_citation"],
    purpose: "Negative control: PC 412.4 remains elsewhere in the answer but is deliberately removed from the lint-strainer point." });
  const lintPoint = broken.answer.supportedPoints.find((point) => point.heading === "Required drain outlet size and lint strainer");
  lintPoint.sourceIDs = lintPoint.sourceIDs.filter((id) => broken.evidence.find((source) => source.sourceID === id)?.sectionNumber !== "412.4");

  const scope = structuredClone(original.find((item) => item.id === "PC-04-unresolved-applicability"));
  scope.answer.supportedPoints = structuredClone(laundry.answer.supportedPoints);
  scope.answer.supportedPoints[0] = structuredClone(original.find((item) => item.id === "PC-04-unresolved-applicability").answer.supportedPoints[0]);
  scope.answer.supportedPoints[1].explanation = "Under PC 412.4, floor drains in public coin-operated laundries and central washing facilities of multiple-family dwellings must have outlets at least 3 inches (76 mm) in diameter and lint strainers. PC 412.3 also establishes the minimum outlet diameter.";
  Object.assign(scope, { id: "PC-04-unresolved-applicability-v2", expectedIssueTypes: [], expectedMissingFactIndices: [], expectedRepairApplied: false });

  const mixed = structuredClone(scope);
  Object.assign(mixed, { id: "PC-04-mixed-material-entry-v2", expectedPass: false, expectedIssueTypes: ["unnecessary_qualification"],
    purpose: "A single entry contains both a material applicability question and optional design requests. Flag the unnecessary request without deleting the material entry." });
  mixed.answer.missingFacts[0] += " Also provide the proposed drain locations and outlet specifications for a later design review.";

  const review = structuredClone(corrected);
  Object.assign(review, { id: "PC-04-requested-layout-review", sourceCaseID: "PC-04",
    question: "The central laundry room in our multiple-family dwelling contains automatic clothes washers and has a proposed floor-drain layout. I want you to review that proposed layout and its drain specifications under PC 412.4. What project information do you need from me?",
    purpose: "Proposed drain positions and specifications are material inputs when reviewing an existing design, rather than outputs to request before creating one." });
  Object.assign(review.answer, {
    answerText: "Provide the proposed floor-drain layout, including the room's floor area, configuration, elevations and drain locations, together with the proposed outlet diameters and lint-strainer details. PC § 412.4 requires the drains to readily drain the entire floor area, have outlets at least 3 inches (76 mm) in diameter, and include lint strainers. Those proposed-design details are needed to assess whether this layout and its specifications satisfy these requirements.",
    conclusion: "Provide the proposed drainage layout and floor elevations, outlet diameters and lint-strainer details for the requested review.",
    explanation: "The review compares the proposed design with PC 412.4's whole-floor drainage, minimum outlet diameter and lint-strainer requirements.",
    missingFacts: ["The proposed floor-drain layout, room floor area and configuration, floor elevations and drain locations.",
      "The proposed drain outlet diameters and lint-strainer details."],
    followUpQuestions: [],
    supportedPoints: [{ ...structuredClone(laundry.answer.supportedPoints[0]), heading: "Requirements for the proposed layout review",
      explanation: "In central washing facilities of multiple-family dwellings, rooms containing automatic clothes washers require floor drains located to readily drain the entire floor area, with outlets at least 3 inches (76 mm) in diameter and lint strainers." }]
  });
  review.answer.citations = review.answer.citations.filter((citation) => citation.sectionID === review.answer.supportedPoints[0].sectionID);
  return [laundry, corrected, broken, scope, mixed, review];
}

export function assessDecisionFactVerifierResult(fixture, verification) {
  const actualIssueTypes = [...new Set((verification.issues || []).map((issue) => issue.type))].sort();
  const expectedIssueTypes = [...fixture.expectedIssueTypes].sort();
  const actualIndices = [...(verification.unnecessaryMissingFactIndices || [])].sort((a, b) => a - b);
  const repair = researchDecisionFactRepair(fixture.answer, verification);
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  return { expectationMatched: verification.pass === fixture.expectedPass && same(actualIssueTypes, expectedIssueTypes) &&
      same(actualIndices, fixture.expectedMissingFactIndices || []) && repair.applied === fixture.expectedRepairApplied,
    actualIssueTypes, actualMissingFactIndices: actualIndices, repairApplied: repair.applied };
}
