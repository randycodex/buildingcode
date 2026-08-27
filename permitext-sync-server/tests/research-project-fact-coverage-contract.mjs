import assert from "node:assert/strict";
import {
  applyResearchProjectFactCoverage,
  researchProjectFactIsExplicitlyUnresolved,
  researchProjectFactMissingFact,
  researchProjectFactRequiresValidation,
  researchUnresolvedProjectFacts
} from "../research-project-fact-coverage.mjs";

assert.equal(
  researchProjectFactIsExplicitlyUnresolved("Unknowns: occupant load calculations"),
  true
);
assert.equal(
  researchProjectFactRequiresValidation("Applicant Assertions: both uses are in the same zoning use group"),
  true
);
assert.equal(
  researchProjectFactRequiresValidation("Building: Existing building represented by the applicant as prior-code"),
  true
);
assert.equal(
  researchProjectFactRequiresValidation("Building Use: Group B office"),
  false
);

const unresolvedFacts = researchUnresolvedProjectFacts([
  "Building Use: Group B office",
  "Unknowns: existing Certificate of Occupancy and approved documents",
  "Applicant Assertions: the alteration does not change the required exits",
  "Owner Position: the former occupancy may resume automatically",
  "Building: Existing building represented by the applicant as a prior-code building"
]);

assert.deepEqual(unresolvedFacts, [
  "Unknowns: existing Certificate of Occupancy and approved documents",
  "Applicant Assertions: the alteration does not change the required exits",
  "Owner Position: the former occupancy may resume automatically",
  "Building: Existing building represented by the applicant as a prior-code building"
]);

assert.equal(
  researchProjectFactMissingFact("Unknowns: filing and Certificate of Occupancy implications"),
  "Filing and Certificate of Occupancy implications."
);
assert.equal(
  researchProjectFactMissingFact("Owner Claim: outdoor authorization eliminates accessibility review"),
  "Verify the owner's claim: outdoor authorization eliminates accessibility review."
);

const interpretation = {
  answerText: "The supplied provisions support only a conditional result.",
  missingFacts: [
    "The existing Certificate of Occupancy and approved documents.",
    "The applicable occupant-load calculations."
  ]
};

const covered = applyResearchProjectFactCoverage(interpretation, [
  "Unknowns: existing Certificate of Occupancy and approved documents",
  "Unknowns: occupant-load calculations",
  "Unknowns: ground-floor and direct exterior public-access configuration",
  "Applicant Assertions: the alteration does not change the required exits",
  "Building: Existing building represented by the applicant as a prior-code building"
]);

assert.deepEqual(covered.missingFacts, [
  "The existing Certificate of Occupancy and approved documents.",
  "The applicable occupant-load calculations.",
  "Ground-floor and direct exterior public-access configuration.",
  "Verify the applicant assertion: the alteration does not change the required exits.",
  "Verify the represented project fact: Building: Existing building represented by the applicant as a prior-code building."
]);
assert.deepEqual(
  applyResearchProjectFactCoverage(covered, unresolvedFacts).missingFacts,
  [
    ...covered.missingFacts,
    "Verify the owner's position: the former occupancy may resume automatically."
  ],
  "Applying the safeguard repeatedly must not duplicate already preserved uncertainty."
);

console.log("Research Project-fact uncertainty coverage contract passed.");
