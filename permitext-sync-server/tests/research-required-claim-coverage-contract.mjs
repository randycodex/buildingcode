import assert from "node:assert/strict";
import {
  assertResearchRequiredClaimCoverage,
  evaluateResearchRequiredClaimCoverage,
  requiredResearchClaimsFromEvidence,
  researchRequiredClaimRevisionIssues,
  researchRequiredClaimCoverageVersion
} from "../research-required-claim-coverage.mjs";

const evidence = [
  {
    sectionID: "2760",
    sectionNumber: "1107.6.2",
    sourceID: "passage-r2-framework"
  },
  {
    sectionID: "2761",
    sectionNumber: "1107.6.2.1",
    sourceID: "passage-r2-type-b-nyc"
  },
  {
    sectionID: "2762",
    sectionNumber: "1107.6.2.2",
    sourceID: "passage-r2-type-b"
  },
  {
    sectionID: "2762",
    sectionNumber: "1107.6.2.2",
    sourceID: "passage-r2-type-b-heading-only"
  },
  {
    sectionID: "2756",
    sectionNumber: "1107.6.1.3",
    sourceID: "passage-unit-door-width"
  }
];

const requiredClaims = [{
  id: "r2-type-b-transition",
  label: "R-2 Type B requirement when no Type B+NYC units are required",
  sourceIDs: ["passage-r2-type-b"]
}];

assert.deepEqual(
  requiredResearchClaimsFromEvidence([
    {
      ...evidence[2],
      codePrefix: "BC",
      title: "Type B units",
      evidencePriority: {
        claimCoverageRequired: true,
        claimCoverageReason: "deterministically routed controlling provision"
      }
    },
    {
      ...evidence[4],
      evidencePriority: { claimCoverageRequired: false }
    }
  ]),
  [{
    id: "required-passage:passage-r2-type-b",
    label: "BC 1107.6.2.2 — Type B units",
    sourceIDs: ["passage-r2-type-b"],
    reason: "deterministically routed controlling provision"
  }]
);

const observedOmission = {
  conclusion: "The supplied R-2 provisions do not establish Type B units as a required category.",
  citations: [
    { sectionID: "2760", sourceIDs: ["passage-r2-framework"] },
    { sectionID: "2761", sourceIDs: ["passage-r2-type-b-nyc"] }
  ]
};

const omitted = evaluateResearchRequiredClaimCoverage({
  requiredClaims,
  evidence,
  answer: observedOmission
});
assert.equal(omitted.coverageVersion, researchRequiredClaimCoverageVersion);
assert.equal(omitted.pass, false);
assert.deepEqual(omitted.missingClaimIDs, ["r2-type-b-transition"]);
assert.deepEqual(
  omitted.claims[0].evidenceOptions[0].missingSourceIDs,
  ["passage-r2-type-b"],
  "The deterministic gate did not identify the exact omitted BC 1107.6.2.2 passage."
);
assert.deepEqual(researchRequiredClaimRevisionIssues(omitted), [{
  type: "missed_material_conclusion",
  detail: "Address the material enacted provision R-2 Type B requirement when no Type B+NYC units are required in a supported point. Bind that point to the exact supplied passage passage-r2-type-b."
}]);

let omissionRejected = false;
try {
  assertResearchRequiredClaimCoverage({ requiredClaims, evidence, answer: observedOmission });
} catch (error) {
  omissionRejected =
    error.code === "INVALID_RESEARCH_REQUIRED_CLAIM_COVERAGE" &&
    error.coverage?.missingClaimIDs?.includes("r2-type-b-transition");
}
assert(omissionRejected, "The required-claim assertion accepted the observed R-2 omission.");

const corrected = evaluateResearchRequiredClaimCoverage({
  requiredClaims,
  evidence,
  answer: {
    conclusion: "If no Type B+NYC units are required, BC 1107.6.2.2 makes the residential units Type B, subject to its exceptions.",
    supportedPoints: [{ sectionID: "2762", sourceIDs: ["passage-r2-type-b"] }],
    citations: [{ sectionID: "2762", sourceIDs: ["passage-r2-type-b"] }]
  }
});
assert.equal(corrected.pass, true);
assert.deepEqual(corrected.missingClaimIDs, []);
assert(
  corrected.nonRequiredEvidenceSourceIDs.includes("passage-unit-door-width"),
  "The coverage report did not distinguish retrieved context from required claim evidence."
);
assert(
  !corrected.requiredEvidenceSourceIDs.includes("passage-unit-door-width"),
  "The deterministic gate naively required every retrieved source to be cited."
);

const sameSectionWrongPassage = evaluateResearchRequiredClaimCoverage({
  requiredClaims,
  evidence,
  answer: {
    supportedPoints: [{ sectionID: "2762", sourceIDs: ["passage-r2-type-b-heading-only"] }],
    citations: [{ sectionID: "2762", sourceIDs: ["passage-r2-type-b-heading-only"] }]
  }
});
assert.equal(
  sameSectionWrongPassage.pass,
  false,
  "A section label or neighboring passage must not substitute for the required exact passage identity."
);

const alternativeEvidence = evaluateResearchRequiredClaimCoverage({
  requiredClaims: [{
    id: "r2-category-framework",
    evidenceOptions: [
      { sourceIDs: ["passage-r2-framework", "passage-r2-type-b"] },
      { sourceIDs: ["passage-r2-type-b-nyc"] }
    ]
  }],
  evidence,
  answer: {
    supportedPoints: [{ sourceIDs: ["passage-r2-type-b-nyc"] }],
    citations: [{ sourceIDs: ["passage-r2-type-b-nyc"] }]
  }
});
assert.equal(alternativeEvidence.pass, true);
assert.equal(alternativeEvidence.claims[0].matchedOptionIndex, 1);

const conjunctiveEvidence = evaluateResearchRequiredClaimCoverage({
  requiredClaims: [{
    id: "r2-conjunctive-rule",
    sourceIDs: ["passage-r2-framework", "passage-r2-type-b"]
  }],
  evidence,
  answer: {
    supportedPoints: [{ sourceIDs: ["passage-r2-type-b"] }],
    citations: [{ sourceIDs: ["passage-r2-type-b"] }]
  }
});
assert.equal(conjunctiveEvidence.pass, false);
assert.deepEqual(
  conjunctiveEvidence.claims[0].evidenceOptions[0].missingSourceIDs,
  ["passage-r2-framework"]
);

assert.throws(
  () => evaluateResearchRequiredClaimCoverage({
    requiredClaims: [{ id: "outside-evidence", sourceIDs: ["not-retrieved"] }],
    evidence,
    answer: { citations: [] }
  }),
  (error) => error.code === "INVALID_RESEARCH_REQUIRED_CLAIM_CONTRACT",
  "A required-claim contract referenced evidence outside the supplied package."
);

const unknownCitation = evaluateResearchRequiredClaimCoverage({
  requiredClaims: [],
  evidence,
  answer: { citations: [{ sourceIDs: ["invented-passage"] }] }
});
assert.equal(unknownCitation.pass, false);
assert.deepEqual(unknownCitation.unknownCitationSourceIDs, ["invented-passage"]);

const orphanCitation = evaluateResearchRequiredClaimCoverage({
  requiredClaims,
  evidence,
  answer: {
    supportedPoints: [{ sourceIDs: ["passage-r2-framework"] }],
    citations: [{ sourceIDs: ["passage-r2-type-b"] }]
  }
});
assert.equal(orphanCitation.pass, false);
assert.deepEqual(
  orphanCitation.claims[0].evidenceOptions[0].missingSupportedPointSourceIDs,
  ["passage-r2-type-b"],
  "An orphan citation must not substitute for explaining the material rule in a supported point."
);

console.log("Research exact-passage required-claim coverage contract passed.");
