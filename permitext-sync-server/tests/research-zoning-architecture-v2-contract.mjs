import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateZoningDeterministicControls,
  evaluateZoningEvidenceReadiness,
  planZoningResearchQuestion,
  zoningResearchDeterministicContext,
  zoningResearchDispositions
} from "../research-zoning-planner.mjs";
import { structuredRichSources } from "../evidence-discovery.mjs";
import { zoningSection } from "../zoning-content.mjs";

const retainedResultPath = new URL(
  "../evals/results/2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.json",
  import.meta.url
);
const retained = JSON.parse(await readFile(retainedResultPath, "utf8"));

async function evidenceFor(result) {
  return Promise.all(result.testCase.selectedEvidence.map(async (selected, index) => {
    const sectionNumber = selected.reference.replace(/^ZR\s+/i, "");
    const citedSourceID = result.answer?.citations?.find((citation) =>
      citation.sectionNumber === sectionNumber
    )?.sourceIDs?.[0];
    const section = await zoningSection(selected.sectionID);
    return {
      sourceID: citedSourceID || `retained-${result.testCase.id}-${index}`,
      sectionID: selected.sectionID,
      sectionNumber,
      codePrefix: "ZR",
      text: selected.exactPassages.join("\n"),
      richSourceGrids: section
        ? structuredRichSources(section)
          .filter((source) => source.kind === "table")
          .flatMap((source) => source.grids || [])
        : [],
      evidencePriority: { evidenceRole: "governing", claimCoverageRequired: true }
    };
  }));
}

async function controlsFor(result, answer = result.answer) {
  const question = result.testCase.question;
  const plan = planZoningResearchQuestion({ question });
  const evidence = await evidenceFor(result);
  const deterministicContext = zoningResearchDeterministicContext({ question, evidence, plan });
  return {
    plan,
    evidence,
    deterministicContext,
    controls: evaluateZoningDeterministicControls({ plan, deterministicContext, answer })
  };
}

const delivered = retained.results.filter((result) => result.answer);
assert.equal(delivered.length, 14);
const replay = new Map(await Promise.all(delivered.map(async (result) => [
  result.testCase.id,
  await controlsFor(result)
])));
const knownObligationFailures = new Set([
  "zr-r7a-lot-coverage",
  "zr-candidate-b1-r6a-uap-insufficient-affordable-area",
  "zr-candidate-b1-deep-through-lot-vertical-yard",
  "zr-candidate-b1-r7a-r8a-weighted-far"
]);

for (const result of delivered) {
  const controls = replay.get(result.testCase.id).controls;
  assert.equal(
    controls.pass,
    !knownObligationFailures.has(result.testCase.id),
    `${result.testCase.id} must preserve a retained answer or reject a later-confirmed obligation failure.`
  );
}

const uap = replay.get("zr-candidate-b1-r6a-uap-insufficient-affordable-area");
assert.ok(uap.controls.issues.some((issue) =>
  issue.obligationID === "table_qualifying_floor_area_ceiling"
));
assert.equal(evaluateZoningDeterministicControls({
  plan: uap.plan,
  deterministicContext: uap.deterministicContext,
  answer: {
    ...delivered.find((result) => result.testCase.id === "zr-candidate-b1-r6a-uap-insufficient-affordable-area").answer,
    answerText: `${delivered.find((result) => result.testCase.id === "zr-candidate-b1-r6a-uap-insufficient-affordable-area").answer.answerText}\n\nThe qualifying-housing table ceiling is 8,000 x 3.90 = 31,200 square feet; that numerical ceiling does not establish entitlement to the qualifying column.`
  }
}).pass, true);

const throughLot = replay.get("zr-candidate-b1-deep-through-lot-vertical-yard");
assert.ok(throughLot.controls.issues.some((issue) =>
  issue.obligationID === "through_lot_upper_vertical_portion"
));
assert.equal(evaluateZoningDeterministicControls({
  plan: throughLot.plan,
  deterministicContext: throughLot.deterministicContext,
  answer: {
    ...delivered.find((result) => result.testCase.id === "zr-candidate-b1-deep-through-lot-vertical-yard").answer,
    answerText: `${delivered.find((result) => result.testCase.id === "zr-candidate-b1-deep-through-lot-vertical-yard").answer.answerText}\n\nThe upper 25 feet of each 100-foot wing is above the 75-foot tier.`,
    missingFacts: [
      ...(delivered.find((result) => result.testCase.id === "zr-candidate-b1-deep-through-lot-vertical-yard").answer.missingFacts || []),
      "Confirm whether the stated 30-foot measurement is taken in the regulated depth orientation and whether actual obstructions satisfy the permitted-obstruction rules."
    ]
  }
}).pass, true);

const failedV1 = retained.results.filter((result) =>
  result.operationMetric?.failureCode === "RESEARCH_VERIFICATION_FAILED"
);
assert.equal(failedV1.length, 11);
for (const result of failedV1) {
  const question = result.testCase.question;
  const plan = planZoningResearchQuestion({ question });
  const evidence = await evidenceFor(result);
  const deterministicContext = zoningResearchDeterministicContext({ question, evidence, plan });
  const readiness = evaluateZoningEvidenceReadiness({ question, evidence, plan, deterministicContext });
  if (result.testCase.id === "zr-candidate-b1-r6-parking-unverified-transit-zone") {
    assert.notEqual(plan.disposition, zoningResearchDispositions.ready);
    assert.equal(plan.callPolicy.maximumProviderCalls, 0);
    assert.ok(readiness.pass === false || plan.missingFacts.some((item) => item.id === "official_mapped_status"));
    continue;
  }
  assert.equal(plan.disposition, zoningResearchDispositions.ready);
  assert.equal(plan.callPolicy.repairEligible, true, `${result.testCase.id} needs one bounded repair path.`);
  assert.equal(plan.callPolicy.maximumRepairAttempts, 1);
  assert.equal(plan.callPolicy.allowFullAnswerRewrite, false);
}

const missingMap = planZoningResearchQuestion({
  question: "Can this specific parcel be placed in Appendix J when no address, BBL, or official map is supplied?"
});
assert.notEqual(missingMap.disposition, zoningResearchDispositions.ready);
assert.equal(missingMap.callPolicy.maximumProviderCalls, 0);

console.log(JSON.stringify({
  pass: true,
  retainedDeliveredAnswers: delivered.length,
  retainedAnswersPreserved: 10,
  knownObligationFailuresRejected: 4,
  formerVerifierBlocksWithBoundedRepair: 10,
  formerVerifierBlockConvertedToEarlyEvidenceBoundary: 1,
  paidModelCalls: 0
}, null, 2));
