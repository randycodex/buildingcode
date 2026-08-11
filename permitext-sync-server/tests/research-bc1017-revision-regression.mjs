import assert from "node:assert/strict";
import {
  accumulatedResearchVerificationIssues,
  researchInputForEvidence
} from "../app.mjs";

const question = "An existing six-story Group R-2 building of Type IIB construction is 68 feet high and fully sprinklered. Under BC 1017.2, which stated project facts are you using to evaluate a 95-foot exit access travel distance, and what still requires verification?";

const issueHistory = [
  {
    pass: false,
    issues: [{
      type: "repeated_established_fact",
      detail: "Do not ask the user to reconfirm the established 95-foot distance."
    }]
  },
  {
    pass: false,
    issues: [{
      type: "unsupported_requirement",
      detail: "Do not assert that alteration provisions require another review without supplied enacted support."
    }]
  },
  {
    pass: false,
    issues: [{
      type: "weakest_supported_conclusion",
      detail: "State that 95 feet is below both the 150-foot baseline and conditional 200-foot allowance."
    }]
  },
  {
    pass: false,
    issues: [{
      type: "repeated_established_fact",
      detail: "Do not ask the user to reconfirm the established 95-foot distance."
    }]
  }
];

const accumulated = accumulatedResearchVerificationIssues(issueHistory);
assert.deepEqual(
  accumulated.map((issue) => issue.type),
  ["repeated_established_fact", "unsupported_requirement", "weakest_supported_conclusion"],
  "A later retry must retain earlier corrections and deduplicate exact repeats."
);

const evidence = [{
  sourceID: "table-1017-2",
  sectionID: "2401",
  codePrefix: "BC",
  sectionNumber: "1017.2",
  title: "1017.2 Limitations.",
  text: "Group R: 150 feet without sprinklers and 200 feet with a qualifying sprinkler system.",
  evidencePriority: {
    primaryFunction: "calculation_table",
    evidenceRole: "governing",
    claimCoverageRequired: true
  }
}];

const revisionInput = researchInputForEvidence(question, evidence, {
  conversationFactContext: {
    established: [
      "The occupancy is Group R-2.",
      "The active-topic exit access travel distance is 95 feet."
    ],
    hypothetical: [],
    unknown: []
  },
  revisionFeedback: accumulated
});

for (const issue of accumulated) {
  assert.match(revisionInput, new RegExp(issue.type));
  assert.match(revisionInput, new RegExp(issue.detail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(revisionInput, /The active-topic exit access travel distance is 95 feet\./);
assert.match(revisionInput, /Resolve all listed feedback together/);
assert.match(revisionInput, /Do not fix one issue by inventing an unsupplied legal requirement/);
assert.match(revisionInput, /strictest directly applicable supplied limit/);
assert.match(revisionInput, /150 feet without sprinklers and 200 feet/);

console.log("Permitext BC 1017.2 bounded-revision regression passed; paid model calls: no.");
