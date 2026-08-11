import assert from "node:assert/strict";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { evaluateResearchAnswerQuality } from "../research-answer-quality.mjs";
import { resolveResearchConversationFacts } from "../research-conversation-facts.mjs";
import { withOfflineResearchHTTPHarness } from "./research-benchmark-http-harness.mjs";

const question = "An existing six-story Group R-2 building of Type IIB construction is 68 feet high. The work is an alteration on the third floor. The occupant load is 48 and the exit access travel distance is 95 feet. The building is fully sprinklered. Under BC 1017.2, does that travel distance comply, and what remains unresolved?";

function answerText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(answerText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(answerText).join(" ");
  return "";
}

function sentenceWithAll(text, values) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => values.every((value) => new RegExp(value, "i").test(sentence)));
}

function evaluateTravelDistanceRegression(answer) {
  const assertedNarrative = answerText({
    conclusion: answer.conclusion,
    supportedPoints: answer.supportedPoints,
    explanation: answer.explanation,
    assumptions: answer.assumptions,
    missingFacts: answer.missingFacts,
    followUpQuestions: answer.followUpQuestions,
    additionalEvidenceNeeded: answer.additionalEvidenceNeeded
  });
  const limitations = answerText(answer.evidenceLimitations);
  const reaskedFacts = answerText([
    answer.missingFacts,
    answer.followUpQuestions
  ]);
  const checks = {
    groupR: /\bGroup R(?:-2)?\b/i.test(assertedNarrative),
    comparisonUsesAllThreeValues: sentenceWithAll(assertedNarrative, ["\\b95\\b", "\\b150\\b", "\\b200\\b"]),
    bothLimits: /\bboth\b/i.test(assertedNarrative),
    complianceConclusion: /\b(?:complies|compliant|within)\b/i.test(answer.conclusion),
    nonsprinkleredLimit: /\b150\b[^.]{0,100}\b(?:without|non[- ]?sprinklered)\b|\b(?:without|non[- ]?sprinklered)\b[^.]{0,100}\b150\b/i.test(assertedNarrative),
    sprinkleredLimit: /\b200\b[^.]{0,100}\b(?:with|sprinklered)\b|\b(?:with|sprinklered)\b[^.]{0,100}\b200\b/i.test(assertedNarrative),
    establishedSprinklerFactNotReasked: !/\b(?:confirm|determine|verify|whether|unknown|need)\b[^.?!]{0,100}\bsprinkler/i.test(reaskedFacts) &&
      !/\bsprinkler[^.?!]{0,100}\b(?:confirm|determine|verify|unknown|need)\b/i.test(reaskedFacts),
    alterationBoundaryDisclosed: /\balteration\b/i.test(limitations) &&
      /\b(?:evidence|not supplied|does not establish|outside|unresolved|unknown)\b/i.test(limitations),
    alterationNotAssertedAsRequirement: !/\balteration\b[^.?!]{0,120}\b(?:shall|must|required?|requires?|need(?:ed)? to)\b|\b(?:shall|must|required?|requires?|need(?:ed)? to)\b[^.?!]{0,120}\balteration\b/i.test(assertedNarrative)
  };
  return {
    diagnosticOnly: true,
    pass: Object.values(checks).every(Boolean),
    checks
  };
}

const facts = resolveResearchConversationFacts({
  question,
  topicDecision: {
    decision: "topic_switch",
    nextRootTopic: { text: question }
  }
});
const established = Object.fromEntries(facts.establishedFacts.map((fact) => [fact.key, fact.value]));
assert.equal(established.occupancy_group, "R-2");
assert.equal(established.travel_distance_feet, "95");
assert.equal(established.sprinkler_status, "fully_sprinklered");
assert.equal(established.work_scope, "alteration");

await withOfflineResearchHTTPHarness("bc1017-answer-quality", async ({ discover, resolveSection }) => {
  const evidencePackage = await assembleResearchEvidence({ question, discover, resolveSection });
  const section = evidencePackage.sources.find((source) =>
    source.codePrefix === "BC" && source.sectionNumber === "1017.2"
  );
  assert(section, "The exact question must assemble canonical BC 1017.2.");
  assert.match(section.text, /E, F-1, M, R, S-1\s+150\s+200/);
  assert.match(section.text, /Buildings equipped throughout with an automatic sprinkler system/);

  const answer = {
    conclusion: "Yes. The 95-foot Group R exit access travel distance complies with both Table 1017.2 limits: 150 feet without the qualifying sprinkler system and 200 feet with it.",
    supportedPoints: [{
      heading: "Within both Group R limits",
      explanation: "BC 1017.2 sets the Group R maximum at 150 feet without the qualifying sprinkler system and 200 feet with it. Because 95 feet is below both 150 feet and 200 feet, the stated distance complies under either column.",
      sectionID: section.sectionID,
      sourceIDs: [section.sourceID]
    }],
    explanation: "The building is already established as fully sprinklered, so the 200-foot column applies; that fact does not need to be asked again. The result is also unchanged under the shorter 150-foot column because 95 feet is below it.",
    assumptions: [],
    missingFacts: [],
    followUpQuestions: [],
    evidenceLimitations: [
      "The supplied BC 1017.2 evidence does not establish whether an alteration-specific provision changes this table analysis; alteration scope remains an evidence limitation outside the supplied authority."
    ],
    additionalEvidenceNeeded: [],
    citations: [{
      sectionID: section.sectionID,
      sourceIDs: [section.sourceID],
      relevance: "Supplies both Group R travel-distance limits."
    }]
  };

  const structuralQuality = evaluateResearchAnswerQuality({
    evidence: evidencePackage.sources,
    answer
  });
  assert.equal(structuralQuality.pass, true);

  const regression = evaluateTravelDistanceRegression(answer);
  assert.equal(regression.diagnosticOnly, true);
  assert.equal(regression.pass, true);
  assert(Object.values(regression.checks).every(Boolean));

  const sprinklerReasked = structuredClone(answer);
  sprinklerReasked.missingFacts = ["Confirm whether the building is fully sprinklered."];
  assert.equal(
    evaluateTravelDistanceRegression(sprinklerReasked).checks.establishedSprinklerFactNotReasked,
    false,
    "An established active-topic sprinkler fact must not be returned as missing."
  );

  const alterationInvented = structuredClone(answer);
  alterationInvented.supportedPoints.push({
    heading: "Alteration approval",
    explanation: "The alteration requires a separate existing-building approval.",
    sectionID: section.sectionID,
    sourceIDs: [section.sourceID]
  });
  assert.equal(
    evaluateTravelDistanceRegression(alterationInvented).checks.alterationNotAssertedAsRequirement,
    false,
    "An alteration rule absent from the supplied evidence must not be asserted as a requirement."
  );

  const oneColumnOnly = structuredClone(answer);
  oneColumnOnly.conclusion = "Yes. The 95-foot Group R travel distance is below the 200-foot sprinklered limit.";
  oneColumnOnly.supportedPoints[0].explanation = "The fully sprinklered Group R limit is 200 feet, and 95 feet is below it.";
  oneColumnOnly.explanation = "The stated distance complies with the sprinklered limit.";
  const incompleteComparison = evaluateTravelDistanceRegression(oneColumnOnly);
  assert.equal(incompleteComparison.checks.comparisonUsesAllThreeValues, false);
  assert.equal(incompleteComparison.checks.nonsprinkleredLimit, false);
  assert.equal(incompleteComparison.pass, false);
});

console.log("Permitext BC 1017.2 answer-quality regression passed; paid model calls: no.");
