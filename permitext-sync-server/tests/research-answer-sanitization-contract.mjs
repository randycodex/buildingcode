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

console.log("Permitext Research answer punctuation sanitization contract passed; paid model calls: no.");
