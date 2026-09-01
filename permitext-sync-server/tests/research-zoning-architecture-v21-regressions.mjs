import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateZoningDeterministicControls,
  evaluateZoningEvidenceReadiness,
  planZoningResearchQuestion,
  zoningResearchDeterministicContext
} from "../research-zoning-planner.mjs";
import { structuredRichSources } from "../evidence-discovery.mjs";
import { zoningSection } from "../zoning-content.mjs";

const fixturePath = new URL("../evals/zoning-architecture-v21-regression-fixtures.json", import.meta.url);
const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
const retainedPath = new URL(`../${fixtures.sourceResult}`, import.meta.url);
const retained = JSON.parse(await readFile(retainedPath, "utf8"));

assert.equal(fixtures.schemaVersion, 1);
assert.equal(fixtures.sourceRunID, "9f67f4ba-3944-46a4-b438-fcec082144e3");
assert.equal(fixtures.rubricsModified, false);
assert.equal(fixtures.cases.length, 8);
assert.equal(new Set(fixtures.cases.map((item) => item.id)).size, 8);
assert.equal(fixtures.cases.filter((item) =>
  item.failingAnswerProvenance === "representative_reconstruction"
).length, 3);
assert.equal(fixtures.cases.filter((item) =>
  item.failingAnswerProvenance === "retained_delivered_answer"
).length, 5);

async function evidenceFor(result) {
  return Promise.all(result.testCase.selectedEvidence.map(async (selected, index) => {
    const sectionNumber = selected.reference.replace(/^ZR\s+/i, "");
    const sourceID = result.answer?.citations?.find((citation) =>
      citation.sectionNumber === sectionNumber
    )?.sourceIDs?.[0] || `retained-${result.testCase.id}-${index}`;
    const section = await zoningSection(selected.sectionID);
    const richSourceGrids = section
      ? structuredRichSources(section)
        .filter((source) => source.kind === "table")
        .flatMap((source) => source.grids || [])
      : [];
    return {
      sourceID,
      sectionID: selected.sectionID,
      sectionNumber,
      codePrefix: "ZR",
      text: selected.exactPassages.join("\n"),
      richSourceGrids,
      evidencePriority: { evidenceRole: "governing", claimCoverageRequired: true }
    };
  }));
}

function answerFromFixture(value, result, evidence) {
  if (value === "retained") return structuredClone(result.answer);
  const sourceIDsBySection = new Map(evidence.map((source) => [source.sectionNumber, source.sourceID]));
  const answer = structuredClone(value || {});
  answer.supportedPoints = (answer.supportedPoints || []).map((point) => ({
    heading: point.heading || "Required obligation",
    explanation: point.explanation || "",
    sourceIDs: (point.sectionNumbers || []).map((sectionNumber) => sourceIDsBySection.get(sectionNumber)).filter(Boolean)
  }));
  answer.citations = evidence.map((source) => ({
    sectionNumber: source.sectionNumber,
    sourceIDs: [source.sourceID]
  }));
  return answer;
}

async function controlsFor(result, answerValue, options = {}) {
  const question = options.question || result.testCase.question;
  const plan = planZoningResearchQuestion({
    question,
    projectFacts: options.projectFacts || [],
    conversationFactContext: options.conversationFactContext || {}
  });
  const evidence = options.evidence || await evidenceFor(result);
  const deterministicContext = zoningResearchDeterministicContext({
    question,
    evidence,
    plan,
    projectFacts: options.projectFacts || [],
    conversationFactContext: options.conversationFactContext || {}
  });
  const answer = answerFromFixture(answerValue, result, evidence);
  return {
    plan,
    evidence,
    deterministicContext,
    readiness: evaluateZoningEvidenceReadiness({ question, evidence, plan, deterministicContext }),
    answer,
    controls: evaluateZoningDeterministicControls({ plan, deterministicContext, answer })
  };
}

const observedFailures = [];
for (const fixture of fixtures.cases) {
  const result = retained.results.find((item) => item.testCase.id === fixture.id);
  assert.ok(result, `${fixture.id} must exist in the retained confirmation result.`);
  if (fixture.failureKind === "deterministic_verifier_block") {
    assert.equal(result.operationMetric.status, "failed");
    assert.equal(result.operationMetric.failureCode, "RESEARCH_VERIFICATION_FAILED");
  } else {
    assert.equal(result.operationMetric.status, "completed");
    assert.equal(result.scoring.passed, false);
  }

  const failing = await controlsFor(result, fixture.failingAnswer);
  const obligationIDs = new Set(failing.deterministicContext.answerObligations.map((item) => item.id));
  for (const obligationID of fixture.requiredCompiledObligationIDs || fixture.requiredFailureObligationIDs) {
    assert.ok(obligationIDs.has(obligationID), `${fixture.id} must compile ${obligationID}.`);
  }
  assert.equal(failing.controls.pass, false, `${fixture.id} observed failure fixture must fail closed.`);
  const failedObligationIDs = new Set(failing.controls.issues.map((issue) => issue.obligationID).filter(Boolean));
  for (const obligationID of fixture.requiredFailureObligationIDs) {
    assert.ok(failedObligationIDs.has(obligationID), `${fixture.id} must fail ${obligationID}.`);
  }

  const passing = await controlsFor(result, fixture.passingAnswer);
  assert.equal(
    passing.controls.pass,
    true,
    `${fixture.id} compliant fixture must pass: ${JSON.stringify(passing.controls.issues)}`
  );
  observedFailures.push({
    id: fixture.id,
    failureKind: fixture.failureKind,
    obligationCount: passing.deterministicContext.answerObligations.length,
    failedObligationIDs: Array.from(failedObligationIDs).sort()
  });
}

const deliveredReplay = await Promise.all(retained.results.filter((result) => result.answer).map(async (result) => {
  const replay = await controlsFor(result, "retained");
  return { id: result.testCase.id, pass: replay.controls.pass, issues: replay.controls.issues };
}));
const expectedSemanticFailureIDs = retained.results
  .filter((result) => result.answer && result.scoring?.passed === false)
  .map((result) => result.testCase.id)
  .sort();
assert.deepEqual(
  deliveredReplay.filter((item) => !item.pass).map((item) => item.id).sort(),
  expectedSemanticFailureIDs,
  "The V2.1 compiler must preserve all 16 accepted delivered answers and reject only the five observed semantic failures."
);
assert.equal(deliveredReplay.filter((item) => item.pass).length, 16);

const splitFixture = fixtures.cases.find((item) => item.id === "zr-candidate-b1-r7a-r8a-weighted-far");
const splitResult = retained.results.find((item) => item.testCase.id === splitFixture.id);
for (const unsafeText of [
  "The wide-street exception might make the 110,000-square-foot total allowable.",
  "Until the wide-street facts are known, whether the total floor area may be permitted remains unresolved."
]) {
  const adversarial = await controlsFor(splitResult, {
    ...splitFixture.passingAnswer,
    answerText: `${splitFixture.passingAnswer.answerText} ${unsafeText}`
  });
  assert.equal(adversarial.controls.pass, false, `Split-lot contradiction must fail: ${unsafeText}`);
  assert.ok(adversarial.controls.issues.some((issue) => issue.code === "ANSWER_OBLIGATION_CONTRADICTED"));
}

const conversionFixture = fixtures.cases.find((item) =>
  item.id === "zr-candidate-b1-c6-2-office-residential-conversion"
);
const conversionResult = retained.results.find((item) => item.testCase.id === conversionFixture.id);
const citationRoleMutation = structuredClone(conversionFixture.passingAnswer);
citationRoleMutation.supportedPoints[0].sectionNumbers = ["32-121"];
const misbound = await controlsFor(conversionResult, citationRoleMutation);
assert.equal(misbound.controls.pass, false);
assert.ok(misbound.controls.issues.some((issue) =>
  issue.code === "ANSWER_OBLIGATION_SOURCE_MISBOUND" &&
  issue.obligationID === "conversion_c6_2_r8_citation_role"
));

const cityFixture = fixtures.cases.find((item) => item.id === "zr-candidate-b1-city-of-yes-transition");
const cityResult = retained.results.find((item) => item.testCase.id === cityFixture.id);
const missingApprovalDeadline = structuredClone(cityFixture.passingAnswer);
missingApprovalDeadline.answerText = missingApprovalDeadline.answerText.replaceAll("December 5, 2025", "the later deadline");
missingApprovalDeadline.supportedPoints[0].explanation = missingApprovalDeadline.supportedPoints[0].explanation
  .replaceAll("December 5, 2025", "the later deadline");
const missingDeadline = await controlsFor(cityResult, missingApprovalDeadline);
assert.equal(missingDeadline.controls.pass, false);
assert.ok(missingDeadline.controls.issues.some((issue) =>
  issue.obligationID === "city_of_yes_specific_transition_route"
));

const changedConversionQuestion = conversionResult.testCase.question
  .replace("90,000-square-foot office building", "120,000-square-foot office building")
  .replace("15,000-square-foot C6-2 zoning lot", "20,000-square-foot C6-2 zoning lot")
  .replace("to 100 market-rate apartments", "to 150 market-rate apartments")
  .replace("Is 100 units allowed", "Is 150 units allowed");
const changedConversionAnswer = {
  answerText: "The proposed 150 units are 27 units below the preliminary density maximum of 177 units. That numerical calculation does not establish legal approvability. The general recreation-space minimum is 3 percent of 120,000 square feet, or 3,600 square feet.",
  supportedPoints: [
    {
      heading: "C6-2 residential equivalent",
      explanation: "C6-2 maps to the R8 residential equivalent.",
      sectionNumbers: ["34-112"]
    },
    {
      heading: "Preliminary density factor",
      explanation: "The 680 dwelling-unit factor applies, and a fraction of at least three-quarters rounds to one unit.",
      sectionNumbers: ["23-52"]
    },
    {
      heading: "General recreation baseline",
      explanation: "The 3 percent recreation baseline produces 3,600 square feet of recreation space.",
      sectionNumbers: ["23-63"]
    }
  ]
};
const changedConversion = await controlsFor(conversionResult, changedConversionAnswer, {
  question: changedConversionQuestion
});
assert.equal(changedConversion.readiness.pass, true);
assert.equal(changedConversion.controls.pass, true, JSON.stringify(changedConversion.controls.issues));
const changedObligationText = changedConversion.deterministicContext.answerObligations
  .map((item) => item.detail).join(" ");
assert.match(changedObligationText, /177 units/);
assert.match(changedObligationText, /27 units below/);
assert.match(changedObligationText, /3600-square-foot/);
assert.doesNotMatch(changedObligationText, /133 units|33 units below|2700-square-foot/);
const staleConversionNumbers = await controlsFor(conversionResult, conversionFixture.passingAnswer, {
  question: changedConversionQuestion
});
assert.equal(staleConversionNumbers.controls.pass, false);

const aboveLimitQuestion = conversionResult.testCase.question
  .replace("to 100 market-rate apartments", "to 200 market-rate apartments")
  .replace("Is 100 units allowed", "Is 200 units allowed");
const aboveLimitAnswer = structuredClone(conversionFixture.passingAnswer);
aboveLimitAnswer.answerText = aboveLimitAnswer.answerText
  .replace("The proposed 100 units are 33 units below the preliminary density maximum of 133 units.",
    "The proposed 200 units are 67 units above the preliminary density maximum of 133 units and exceed it by 67.");
const aboveLimit = await controlsFor(conversionResult, aboveLimitAnswer, { question: aboveLimitQuestion });
assert.equal(aboveLimit.controls.pass, true, JSON.stringify(aboveLimit.controls.issues));
const aboveLimitDetail = aboveLimit.deterministicContext.answerObligations.find((item) =>
  item.id === "conversion_preliminary_density_not_approval"
)?.detail || "";
assert.match(aboveLimitDetail, /67 units above/);
assert.doesNotMatch(aboveLimitDetail, /-67 units below/);

const equalLimitQuestion = conversionResult.testCase.question
  .replace("to 100 market-rate apartments", "to 133 market-rate apartments")
  .replace("Is 100 units allowed", "Is 133 units allowed");
const equalLimitAnswer = structuredClone(conversionFixture.passingAnswer);
equalLimitAnswer.answerText = equalLimitAnswer.answerText
  .replace("The proposed 100 units are 33 units below the preliminary density maximum of 133 units.",
    "The proposed 133 units are exactly the preliminary density maximum of 133 units.");
const equalLimit = await controlsFor(conversionResult, equalLimitAnswer, { question: equalLimitQuestion });
assert.equal(equalLimit.controls.pass, true, JSON.stringify(equalLimit.controls.issues));

const negativeMapping = structuredClone(conversionFixture.passingAnswer);
negativeMapping.supportedPoints[0].explanation = "C6-2 does not map to R8.";
const negativeMappingResult = await controlsFor(conversionResult, negativeMapping);
assert.equal(negativeMappingResult.controls.pass, false);
assert.ok(negativeMappingResult.controls.issues.some((issue) =>
  issue.obligationID === "conversion_c6_2_r8_citation_role"
));
const correctedNegation = structuredClone(conversionFixture.passingAnswer);
correctedNegation.supportedPoints[0].explanation =
  "It is wrong to say C6-2 does not map to R8; C6-2 maps to R8 under the table.";
const correctedNegationResult = await controlsFor(conversionResult, correctedNegation);
assert.equal(correctedNegationResult.controls.pass, true, JSON.stringify(correctedNegationResult.controls.issues));
const keywordSoup = structuredClone(conversionFixture.passingAnswer);
keywordSoup.supportedPoints[0].explanation = "C6-2; R8.";
const keywordSoupResult = await controlsFor(conversionResult, keywordSoup);
assert.equal(keywordSoupResult.controls.pass, false);

const mixedSourceMapping = structuredClone(conversionFixture.passingAnswer);
mixedSourceMapping.supportedPoints[0].sectionNumbers = ["34-112", "32-121"];
const mixedSourceMappingResult = await controlsFor(conversionResult, mixedSourceMapping);
assert.equal(mixedSourceMappingResult.controls.pass, false);
assert.ok(mixedSourceMappingResult.controls.issues.some((issue) =>
  issue.code === "ANSWER_OBLIGATION_SOURCE_MISBOUND" &&
  issue.obligationID === "conversion_c6_2_r8_citation_role"
));

const sourceMissingEvidence = (await evidenceFor(conversionResult)).map((source) =>
  source.sectionNumber === "34-112" ? { ...source, sourceID: undefined } : source
);
const sourceMissing = await controlsFor(conversionResult, conversionFixture.passingAnswer, {
  evidence: sourceMissingEvidence
});
assert.equal(sourceMissing.readiness.pass, false);
assert.ok(sourceMissing.readiness.issues.some((issue) =>
  issue.code === "CONTROLLING_OBLIGATION_SOURCE_MISSING"
));
assert.ok(sourceMissing.controls.issues.some((issue) =>
  issue.code === "ANSWER_OBLIGATION_SOURCE_UNRESOLVED"
));

const mixedFixture = fixtures.cases.find((item) => item.id === "zr-candidate-b1-mx-nonadditive-far");
const mixedResult = retained.results.find((item) => item.testCase.id === mixedFixture.id);
const malformedMixedEvidence = (await evidenceFor(mixedResult)).map((source) =>
  source.sectionNumber === "43-12"
    ? { ...source, text: `Incidental prose mentions M1-4 and 99.00 without a table row. ${source.text}`, richSourceGrids: [{ rows: [] }] }
    : source
);
const malformedMixed = await controlsFor(mixedResult, mixedFixture.passingAnswer, {
  evidence: malformedMixedEvidence
});
assert.equal(malformedMixed.readiness.pass, false);
assert.ok(malformedMixed.deterministicContext.answerObligations.some((item) =>
  item.id === "mixed_use_manufacturing_table_row_unresolved"
));
assert.ok(!malformedMixed.deterministicContext.answerObligations.some((item) =>
  item.id === "mixed_use_manufacturing_component_far" && item.detail.includes("99")
));

const standardFarResult = retained.results.find((item) => item.testCase.id === "zr-r7a-standard-far");
const missingFarTable = await controlsFor(standardFarResult, standardFarResult.answer, {
  evidence: [{
    sourceID: "unrelated-lot-coverage",
    sectionID: "20018029",
    sectionNumber: "23-342",
    text: "This unrelated section does not supply the ZR 23-22 FAR table.",
    richSourceGrids: []
  }]
});
assert.equal(missingFarTable.readiness.pass, false);
assert.ok(missingFarTable.deterministicContext.answerObligations.some((item) =>
  item.id === "residential_far_table_row_unresolved"
));

const lotCoverageResult = retained.results.find((item) => item.testCase.id === "zr-r7a-lot-coverage");
const missingCoverageRule = await controlsFor(lotCoverageResult, fixtures.cases.find((item) =>
  item.id === "zr-r7a-lot-coverage"
).passingAnswer, {
  evidence: [{
    sourceID: "unrelated-yard-rule",
    sectionID: "unrelated",
    sectionNumber: "23-40",
    text: "This unrelated section does not supply a basic lot-coverage percentage.",
    richSourceGrids: []
  }]
});
assert.equal(missingCoverageRule.readiness.pass, false);
assert.ok(missingCoverageRule.deterministicContext.answerObligations.some((item) =>
  item.id === "basic_lot_coverage_governing_percentage_unresolved"
));

const cellarFixture = fixtures.cases.find((item) => item.id === "zr-cellar-floor-area-definition");
const cellarResult = retained.results.find((item) => item.testCase.id === cellarFixture.id);
const resolvedCellar = await controlsFor(cellarResult, {
  ...cellarFixture.passingAnswer,
  missingFacts: []
}, {
  projectFacts: [
    "The base plane is not sloping.",
    "The zoning lot is not a through lot.",
    "No yard was lowered after December 5, 1990."
  ]
});
assert.ok(!resolvedCellar.deterministicContext.answerObligations.some((item) =>
  item.id === "cellar_special_measurement_conditions"
));
assert.equal(resolvedCellar.controls.pass, true, JSON.stringify(resolvedCellar.controls.issues));
const unknownCellar = await controlsFor(cellarResult, cellarFixture.passingAnswer, {
  conversationFactContext: {
    unknown: [
      "It is unknown whether the base plane is not sloping.",
      "It is unknown whether this is not a through lot.",
      "It is unknown whether no yard was lowered after December 5, 1990."
    ]
  }
});
assert.ok(unknownCellar.deterministicContext.answerObligations.some((item) =>
  item.id === "cellar_special_measurement_conditions"
));

const throughFixture = fixtures.cases.find((item) =>
  item.id === "zr-candidate-b1-deep-through-lot-vertical-yard"
);
const throughResult = retained.results.find((item) => item.testCase.id === throughFixture.id);
const resolvedThrough = await controlsFor(throughResult, {
  ...throughFixture.passingAnswer,
  missingFacts: []
}, {
  projectFacts: [
    "The 30-foot dimension is measured perpendicular in the regulated depth orientation.",
    "The open area contains no obstructions."
  ]
});
assert.ok(!resolvedThrough.deterministicContext.answerObligations.some((item) =>
  item.id === "through_lot_regulated_depth_orientation_unresolved" ||
    item.id === "through_lot_actual_permitted_obstructions_unresolved"
));
assert.equal(resolvedThrough.controls.pass, true, JSON.stringify(resolvedThrough.controls.issues));
const unknownThrough = await controlsFor(throughResult, throughFixture.passingAnswer, {
  conversationFactContext: {
    unknown: [
      "Whether the 30-foot dimension is measured perpendicular is unknown.",
      "Whether the open area contains no obstructions is unknown."
    ]
  }
});
assert.ok(unknownThrough.deterministicContext.answerObligations.some((item) =>
  item.id === "through_lot_regulated_depth_orientation_unresolved"
));
assert.ok(unknownThrough.deterministicContext.answerObligations.some((item) =>
  item.id === "through_lot_actual_permitted_obstructions_unresolved"
));

const answerTextUncertainty = await controlsFor(throughResult, {
  answerText: `${throughFixture.passingAnswer.answerText} Confirm whether the 30-foot measurement is taken in the regulated depth orientation and whether actual obstructions satisfy the permitted-obstruction rules.`
});
assert.equal(answerTextUncertainty.controls.pass, true, JSON.stringify(answerTextUncertainty.controls.issues));

const parkingFixture = fixtures.cases.find((item) => item.id === "zr-inner-transit-zone-new-unit-parking");
const parkingResult = retained.results.find((item) => item.testCase.id === parkingFixture.id);
const negatedZeroParking = structuredClone(parkingFixture.passingAnswer);
negatedZeroParking.answerText = negatedZeroParking.answerText.replace(
  "requires zero accessory off-street parking spaces",
  "states that zero spaces are not required"
);
negatedZeroParking.supportedPoints[0].explanation = negatedZeroParking.supportedPoints[0].explanation.replace(
  "No accessory off-street parking spaces are required",
  "Zero spaces are not required"
);
const negatedZeroParkingResult = await controlsFor(parkingResult, negatedZeroParking);
assert.equal(negatedZeroParkingResult.controls.pass, false);
assert.ok(negatedZeroParkingResult.controls.issues.some((issue) =>
  issue.code === "ANSWER_OBLIGATION_CONTRADICTED" &&
  issue.obligationID === "inner_transit_post_2024_zero_spaces"
));

for (const negatedConclusion of [
  "It is false that zero accessory off-street parking spaces are required",
  "It would be incorrect to conclude that zero accessory off-street parking spaces are required"
]) {
  const polarityMutation = structuredClone(parkingFixture.passingAnswer);
  polarityMutation.answerText = polarityMutation.answerText.replace(
    "Section 25-211 requires zero accessory off-street parking spaces",
    negatedConclusion
  );
  const polarityResult = await controlsFor(parkingResult, polarityMutation);
  assert.equal(
    polarityResult.controls.pass,
    false,
    `An affirmative supported point must not mask a negated primary conclusion: ${negatedConclusion}`
  );
  assert.ok(polarityResult.controls.issues.some((issue) =>
    issue.code === "ANSWER_OBLIGATION_NOT_COVERED" &&
    issue.obligationID === "inner_transit_post_2024_zero_spaces"
 ));
}

console.log(JSON.stringify({
  pass: true,
  observedFailureFixtures: observedFailures.length,
  verifierBlockFixtures: observedFailures.filter((item) => item.failureKind === "deterministic_verifier_block").length,
  semanticFailureFixtures: observedFailures.filter((item) => item.failureKind === "judged_semantic_failure").length,
  retainedAcceptedAnswersPreserved: deliveredReplay.filter((item) => item.pass).length,
  retainedSemanticFailuresRejected: deliveredReplay.filter((item) => !item.pass).length,
  focusedAdversarialSuitePassed: true,
  ownerApprovedRubricsModified: false,
  paidModelCalls: 0
}, null, 2));
