import assert from "node:assert/strict";
import {
  prioritizeResearchEvidence,
  researchEvidenceFunctions,
  researchEvidencePriorityMetadata,
  researchEvidencePriorityVersion
} from "../research-evidence-priority.mjs";

function candidate(sectionNumber, text, signals = {}) {
  return {
    sectionID: `BC:${sectionNumber}`,
    codePrefix: "BC",
    sectionNumber,
    title: `BC ${sectionNumber}`,
    selectedText: text,
    signals
  };
}

const accessibleUnitCandidates = [
  candidate("202", "Definitions of Accessible unit, Type B+NYC unit, and Type B unit."),
  candidate("Q105.1", "Unrelated standpipe installation text."),
  candidate("1107.6.1.4", "Boarding houses shall comply with this section."),
  candidate("1107.6.1.3", "Doors and doorways in all units shall comply."),
  candidate("1107.6.1.2", "Type B+NYC units are required unless the number is permitted to be reduced."),
  candidate("1107.6.1.1", "Accessible units shall be provided in accordance with Table 1107.6.1.1. Minimum required number of Accessible units."),
  candidate("1107.6.1", "Group R-1 shall provide Accessible, Type B+NYC, and Type B units."),
  candidate("1107.7.1", "Where no elevator service is provided, only units on specified stories are required."),
  candidate("1107.6.3", "Group R-3 structures with four or more units shall provide Type B units. Exception: the number may be reduced."),
  candidate("1107.6.2.2", "Where no Type B+NYC units are required, units shall be Type B units. Exceptions: the number may be reduced."),
  candidate("1107.6.2.1", "Every Group R-2 dwelling unit and sleeping unit shall be a Type B+NYC unit."),
  candidate("1107.6.2", "Type B+NYC and Type B units shall be provided in Group R-2."),
  candidate("1107.6", "Accessible, Type B+NYC, and Type B units shall be provided in Group R.", {
    exactTopicRouteTarget: true
  }),
  candidate("414.2.5.1", "Unrelated material quantity table."),
  {
    ...candidate("1101.2", "Buildings shall be designed in accordance with ICC A117.1."),
    origin: "permitext_cross_reference",
    retrievalDepth: 1
  }
];

const originalSnapshot = structuredClone(accessibleUnitCandidates);
const prioritized = prioritizeResearchEvidence(accessibleUnitCandidates, { limit: 12 });
const selectedNumbers = prioritized.map((item) => item.sectionNumber);

assert.equal(prioritized.length, 12);
assert.equal(prioritized[0].sectionNumber, "1107.6", "The routed controlling section must remain first.");
for (const required of [
  "1107.6.1",
  "1107.6.2",
  "1107.6.3",
  "1107.6.1.1",
  "1107.6.1.2",
  "1107.6.2.1",
  "1107.6.2.2"
]) {
  assert(
    selectedNumbers.includes(required),
    `Material accessible-unit provision BC ${required} must survive the bounded evidence selection.`
  );
}
assert(!selectedNumbers.includes("Q105.1"), "Unrelated lexical matches must not crowd out material descendants.");
assert(!selectedNumbers.includes("414.2.5.1"), "An unrelated quantity table must not outrank a controlling hierarchy.");
assert.deepEqual(
  accessibleUnitCandidates,
  originalSnapshot,
  "Prioritization must not mutate discovery or assembly input records."
);

const typeBException = prioritized.find((item) => item.sectionNumber === "1107.6.2.2");
assert.equal(typeBException.evidencePriority.version, researchEvidencePriorityVersion);
assert.equal(typeBException.evidencePriority.controllingRoot, "BC 1107.6");
assert.equal(typeBException.evidencePriority.hierarchyDepth, 2);
assert(typeBException.evidencePriority.functions.includes(researchEvidenceFunctions.controllingRule));
assert(typeBException.evidencePriority.functions.includes(researchEvidenceFunctions.exception));
assert.equal(typeBException.evidencePriority.claimCoverageRequired, true);
assert(
  typeBException.evidencePriority.reasons.includes("material descendant of BC 1107.6"),
  "The priority audit metadata must explain why a nested provision was retained."
);

const quantityTable = prioritized.find((item) => item.sectionNumber === "1107.6.1.1");
assert(quantityTable.evidencePriority.functions.includes(researchEvidenceFunctions.calculationTable));

const definition = researchEvidencePriorityMetadata(accessibleUnitCandidates[0]);
assert.equal(definition.primaryFunction, researchEvidenceFunctions.definition);

const supportingCrossReference = researchEvidencePriorityMetadata(accessibleUnitCandidates.at(-1));
assert.equal(
  supportingCrossReference.primaryFunction,
  researchEvidenceFunctions.supportingCrossReference
);
assert.equal(supportingCrossReference.claimCoverageRequired, false);

const contextualReference = researchEvidencePriorityMetadata(candidate(
  "101.1",
  "This code shall be known as the New York City Building Code.",
  { exactReference: true, contextualReference: true }
));
assert.equal(contextualReference.primaryFunction, researchEvidenceFunctions.contextual);
assert.equal(contextualReference.evidenceRole, "contextual");
assert.equal(contextualReference.claimCoverageRequired, false);

const ordinaryCandidate = researchEvidencePriorityMetadata(candidate(
  "999.9",
  "A provision retrieved for an ordinary open-ended question."
));
assert.equal(
  ordinaryCandidate.evidenceRole,
  "supporting",
  "A generic candidate must not be rejected outside a relevance-comparison turn."
);
const rejectedComparisonCandidate = researchEvidencePriorityMetadata(candidate(
  "999.9",
  "A same-term provision outside the governing topic.",
  { relevanceComparison: true }
));
assert.equal(rejectedComparisonCandidate.evidenceRole, "irrelevant");

const explicitRootPrioritization = prioritizeResearchEvidence([
  candidate("1107.6.2.2", "Type B units. Exception: reductions may apply."),
  candidate("999.9", "A high-scoring but unrelated lexical result.")
], {
  controllingRoots: [{ codePrefix: "BC", sectionNumber: "1107.6" }],
  limit: 1
});
assert.equal(
  explicitRootPrioritization[0].sectionNumber,
  "1107.6.2.2",
  "An explicit routed root must prioritize its material descendants over unrelated candidates."
);

console.log("Permitext deterministic Research evidence priority contract passed.");
