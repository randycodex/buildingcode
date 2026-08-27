import assert from "node:assert/strict";
import { validateResearchInterpretation } from "../app.mjs";

const evidence = [{
  sectionID: "2401",
  sourceID: "bc-1017-2",
  codePrefix: "BC",
  sectionNumber: "1017.2",
  title: "Limitations",
  text: "Group R: 150 feet without sprinklers and 200 feet with sprinklers."
}];

const answer = validateResearchInterpretation({
  conclusion: "Yes, 95 feet is below both supplied limits.",
  supportedPoints: [{
    heading: "Within the limit",
    explanation: "The stated distance is below 150 feet and 200 feet.",
    sectionID: "2401",
    sourceIDs: ["bc-1017-2"]
  }],
  explanation: "The direct comparison supports the conclusion.",
  assumptions: [],
  missingFacts: [],
  followUpQuestions: [],
  evidenceLimitations: ["Other egress topics were not evaluated."],
  additionalEvidenceNeeded: [
    "Confirm the measured route.】【。If the 200-foot allowance is needed, confirm the installation standard."
  ],
  supportingSourceUses: [],
  citations: [{
    sectionID: "2401",
    sourceIDs: ["bc-1017-2"],
    relevance: "Supplies the applicable limits."
  }]
}, evidence);

assert.equal(
  answer.additionalEvidenceNeeded[0],
  "Confirm the measured route. If the 200-foot allowance is needed, confirm the installation standard."
);
assert.doesNotMatch(answer.additionalEvidenceNeeded[0], /[【】：「」『』]/);

const whitespaceAnswer = validateResearchInterpretation({
  conclusion: "The selected text does not say whether furniture is a  fixture  or  equipment.",
  supportedPoints: [{
    heading: "Covered elements",
    explanation: "Fixtures  and  equipment are listed.",
    sectionID: "2401",
    sourceIDs: ["bc-1017-2"]
  }],
  explanation: "That classification  remains unresolved.",
  assumptions: [],
  missingFacts: [],
  followUpQuestions: [],
  evidenceLimitations: ["Only  the selected text was reviewed."],
  additionalEvidenceNeeded: [],
  supportingSourceUses: [],
  citations: [{
    sectionID: "2401",
    sourceIDs: ["bc-1017-2"],
    relevance: "Supplies  the listed elements."
  }]
}, evidence);
assert.doesNotMatch(whitespaceAnswer.answerText, / {2,}/);
assert.doesNotMatch(whitespaceAnswer.supportedPoints[0].explanation, / {2,}/);
assert.doesNotMatch(whitespaceAnswer.evidenceLimitations[0], / {2,}/);
assert.doesNotMatch(whitespaceAnswer.citations[0].relevance, / {2,}/);

console.log("Permitext Research answer punctuation sanitization contract passed; paid model calls: no.");
