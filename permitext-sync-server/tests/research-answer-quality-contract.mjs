import assert from "node:assert/strict";
import {
  applyResearchDeterministicAnswerRepairs,
  evaluateResearchAnswerQuality,
  researchAnswerQualityRevisionIssues,
  researchAnswerQualityVersion
} from "../research-answer-quality.mjs";

function source(sourceID, sectionNumber, evidenceRole, topicRouteRelationship) {
  return {
    sourceID,
    sectionID: sectionNumber,
    codePrefix: "BC",
    sectionNumber,
    evidencePriority: {
      evidenceRole,
      primaryFunction: evidenceRole === "governing" ? "controlling_rule" : "calculation_table",
      topicRouteRelationship
    }
  };
}

const evidence = [
  source("travel-limit", "1017.2", "governing", "aligned"),
  source("travel-measurement", "1017.3", "governing", "aligned"),
  source("construction-table", "601.1", "supporting", "collateral"),
  source("occupant-load", "1004.1", "supporting", "collateral"),
  source("reviewed-cross-reference", "404.9", "supporting", "unrouted")
];

const bloated = evaluateResearchAnswerQuality({
  evidence,
  answer: {
    supportedPoints: [
      { sourceIDs: ["travel-limit", "travel-measurement"] },
      { sourceIDs: ["construction-table"] },
      { sourceIDs: ["occupant-load"] }
    ],
    citations: [
      { sourceIDs: ["travel-limit", "travel-measurement"] },
      { sourceIDs: ["construction-table"] },
      { sourceIDs: ["occupant-load"] }
    ]
  }
});
assert.equal(bloated.qualityVersion, researchAnswerQualityVersion);
assert.equal(bloated.pass, false);
assert.deepEqual(bloated.collateralCitationSourceIDs, ["construction-table", "occupant-load"]);
assert.equal(researchAnswerQualityRevisionIssues(bloated)[0].type, "irrelevant_citation");

const economical = evaluateResearchAnswerQuality({
  evidence,
  answer: {
    supportedPoints: [{ sourceIDs: ["travel-limit", "travel-measurement"] }],
    citations: [{ sourceIDs: ["travel-limit", "travel-measurement"] }]
  }
});
assert.equal(economical.pass, true);
assert.deepEqual(economical.evidenceEconomy, {
  citedSourceCount: 2,
  citedProvisionCount: 2,
  governingCitationCount: 2,
  supportingCitationCount: 0,
  contextualCitationCount: 0,
  reviewedOnlySourceCount: 3,
  reviewedOnlyProvisionCount: 3,
  assembledSourceCount: 5,
  assembledProvisionCount: 5
});

const orphan = evaluateResearchAnswerQuality({
  evidence,
  answer: {
    supportedPoints: [{ sourceIDs: ["travel-limit"] }],
    citations: [{ sourceIDs: ["travel-limit"] }, { sourceIDs: ["reviewed-cross-reference"] }]
  }
});
assert.equal(
  orphan.pass,
  true,
  "A valid citation may support answerText or an evidence limitation without duplicating the passage in supportedPoints."
);
assert.deepEqual(orphan.orphanCitationSourceIDs, ["reviewed-cross-reference"]);

const futureEvidence = [{
  ...source("future-ebc", "101", "governing", "aligned"),
  codePrefix: "EBC",
  applicabilityStatus: "future-effective"
}];
const undisclosedFuture = evaluateResearchAnswerQuality({
  evidence: futureEvidence,
  answer: {
    answerText: "EBC 101 governs this work.",
    supportedPoints: [{ sourceIDs: ["future-ebc"] }],
    citations: [{ sourceIDs: ["future-ebc"] }]
  }
});
assert.equal(undisclosedFuture.pass, false);
assert.deepEqual(undisclosedFuture.missingApplicabilityDisclosureSourceIDs, ["future-ebc"]);
assert.equal(
  researchAnswerQualityRevisionIssues(undisclosedFuture).at(-1).type,
  "missed_material_conclusion"
);

const disclosedFuture = evaluateResearchAnswerQuality({
  evidence: futureEvidence,
  answer: {
    answerText: "EBC 101 is enacted but not yet effective; its effective date is July 17, 2027.",
    supportedPoints: [{ sourceIDs: ["future-ebc"] }],
    citations: [{ sourceIDs: ["future-ebc"] }]
  }
});
assert.equal(disclosedFuture.pass, true);

const r7aHeightEvidence = [{
  ...source("zr-r7a-height-table", "23-432", "governing", "aligned"),
  codePrefix: "ZR",
  text: "R7A Standard residences maximum height 85. Qualifying affordable housing or qualifying senior housing maximum height 115."
}];
const missingR7AAlternative = evaluateResearchAnswerQuality({
  question: "Can a standard residential building in R7A be 90 feet tall?",
  evidence: r7aHeightEvidence,
  answer: {
    answerText: "No. The standard-residence maximum height is 85 feet.",
    supportedPoints: [{ sourceIDs: ["zr-r7a-height-table"] }],
    citations: [{ sourceIDs: ["zr-r7a-height-table"] }]
  }
});
assert.equal(missingR7AAlternative.pass, false);
assert.deepEqual(missingR7AAlternative.missingParallelTableCategorySourceIDs, ["zr-r7a-height-table"]);
assert.match(
  researchAnswerQualityRevisionIssues(missingR7AAlternative).at(-1).detail,
  /qualifying-affordable or qualifying-senior value/
);

const completeR7AComparison = evaluateResearchAnswerQuality({
  question: "Can a standard residential building in R7A be 90 feet tall?",
  evidence: r7aHeightEvidence,
  answer: {
    answerText: "No. The standard-residence maximum is 85 feet; the same row allows 115 feet only for qualifying affordable housing or qualifying senior housing.",
    supportedPoints: [{ sourceIDs: ["zr-r7a-height-table"] }],
    citations: [{ sourceIDs: ["zr-r7a-height-table"] }]
  }
});
assert.equal(completeR7AComparison.pass, true);

const c3UseEvidence = [{
  ...source("zr-c3-office-table", "32-171", "governing", "aligned"),
  codePrefix: "ZR",
  text: "Offices, business, professional or governmental C3 – C4 P"
}];
const overbroadC3Denial = evaluateResearchAnswerQuality({
  question: "Is a professional office permitted as-of-right under the underlying C3 use regulations?",
  evidence: c3UseEvidence,
  answer: {
    answerText: "No. The C3 column marks professional offices as not permitted.",
    supportedPoints: [{ sourceIDs: ["zr-c3-office-table"] }],
    citations: [{ sourceIDs: ["zr-c3-office-table"] }]
  }
});
assert.equal(overbroadC3Denial.pass, false);
assert.deepEqual(overbroadC3Denial.missingZoningModificationPathDisclosureSourceIDs, ["zr-c3-office-table"]);
assert.match(
  researchAnswerQualityRevisionIssues(overbroadC3Denial).at(-1).detail,
  /special-purpose-district.*authorization.*variance/
);

const boundedC3Denial = evaluateResearchAnswerQuality({
  question: "Is a professional office permitted as-of-right under the underlying C3 use regulations?",
  evidence: c3UseEvidence,
  answer: {
    answerText: "No under the underlying C3 rules. This does not resolve any special-purpose-district, authorization, special-permit, or variance pathway.",
    supportedPoints: [{ sourceIDs: ["zr-c3-office-table"] }],
    citations: [{ sourceIDs: ["zr-c3-office-table"] }]
  }
});
assert.equal(boundedC3Denial.pass, true);

const accessoryAssemblyEvidence = [{
  ...source("bc-accessory-assembly", "303.1.3", "governing", "aligned"),
  text: "An accessory assembly room with fewer than 75 persons shall be Group B or part of that occupancy, except that plumbing fixtures may be calculated under Assembly requirements."
}];
const accessoryAssemblyQuestion =
  "If the multipurpose room is permitted to be classified as Group B because it has fewer than 75 occupants, can its plumbing fixtures use Group B requirements?";
const misattributedAccessoryRelationship = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: accessoryAssemblyEvidence,
  answer: {
    answerText: "Yes, if the room is accessory to the Group B occupancy; Assembly fixture ratios are optional.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }]
  }
});
assert.equal(misattributedAccessoryRelationship.pass, false);
assert.deepEqual(
  misattributedAccessoryRelationship.misattributedAccessoryAssemblyRelationshipSourceIDs,
  ["bc-accessory-assembly"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(misattributedAccessoryRelationship).at(-1).type,
  "wrong_attribution"
);

const correctedAccessoryRelationship = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: accessoryAssemblyEvidence,
  answer: {
    answerText: "If the room is accessory to another principal occupancy, BC 303.1.3 classifies the room as Group B or as part of that occupancy and permits the Assembly fixture calculation.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }]
  }
});
assert.equal(correctedAccessoryRelationship.pass, true);

const residentAmenityQuestion =
  "Does a 900-net-square-foot residents-only multipurpose room with tables and chairs need to be classified as Group A-3?";
const inferredAccessoryRelationship = evaluateResearchAnswerQuality({
  question: residentAmenityQuestion,
  evidence: accessoryAssemblyEvidence,
  answer: {
    answerText: "No. Because the room is accessory to the apartment-building occupancy, it is Group B.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }]
  }
});
assert.equal(inferredAccessoryRelationship.pass, false);
assert.deepEqual(
  inferredAccessoryRelationship.unestablishedAccessoryRelationshipSourceIDs,
  ["bc-accessory-assembly"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(inferredAccessoryRelationship).at(-1).type,
  "overstated_compliance"
);

const conditionalAccessoryRelationship = evaluateResearchAnswerQuality({
  question: residentAmenityQuestion,
  evidence: accessoryAssemblyEvidence,
  answer: {
    answerText: "If the room is accessory to the apartment-building occupancy, its calculated occupant load may support the BC 303.1.3 Group B classification path; whether that accessory relationship applies remains a missing project fact.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }]
  }
});
assert.equal(conditionalAccessoryRelationship.pass, true);

const pc403RestrictedAssemblyEvidence = {
  ...source("pc-nonaccessory-assembly", "403.1", "governing", "aligned"),
  codePrefix: "PC",
  text: "The number of fixtures for building or nonaccessory tenant space used for assembly purposes by fewer than 75 persons and classified as Group B shall be permitted to be calculated in accordance with Assembly requirements."
};
const overbroadPC403AccessoryAnswer = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: [...accessoryAssemblyEvidence, pc403RestrictedAssemblyEvidence],
  answer: {
    answerText: "BC 303.1.3 permits the Assembly calculation. PC 403.1 separately confirms that any qualifying Group B assembly room may use it.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }, { sourceIDs: ["pc-nonaccessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }, { sourceIDs: ["pc-nonaccessory-assembly"] }]
  }
});
assert.equal(overbroadPC403AccessoryAnswer.pass, false);
assert.deepEqual(
  overbroadPC403AccessoryAnswer.missingPC403NonaccessoryScopeDisclosureSourceIDs,
  ["pc-nonaccessory-assembly"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(overbroadPC403AccessoryAnswer).at(-1).type,
  "wrong_attribution"
);

const boundedPC403AccessoryAnswer = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: [...accessoryAssemblyEvidence, pc403RestrictedAssemblyEvidence],
  answer: {
    answerText: "BC 303.1.3 directly permits the accessory room's Assembly calculation. The selected PC 403.1 permission is limited to a building or nonaccessory tenant assembly space and does not independently extend that permission to this accessory room.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }, { sourceIDs: ["pc-nonaccessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }, { sourceIDs: ["pc-nonaccessory-assembly"] }]
  }
});
assert.equal(boundedPC403AccessoryAnswer.pass, true);

const overbroadNormalGroupBFixtureAnswer = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: accessoryAssemblyEvidence,
  answer: {
    answerText: "Yes. The normal starting point is therefore the Group B fixture requirements, and the normal Group B calculation remains permitted.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }]
  }
});
assert.equal(overbroadNormalGroupBFixtureAnswer.pass, false);
assert.deepEqual(
  overbroadNormalGroupBFixtureAnswer.unsupportedNormalGroupBFixturePermissionSourceIDs,
  ["bc-accessory-assembly"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(overbroadNormalGroupBFixtureAnswer).at(-1).type,
  "overstated_compliance"
);

const boundedNormalGroupBFixtureAnswer = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: accessoryAssemblyEvidence,
  answer: {
    answerText: "Not automatically. BC 303.1.3 establishes that the accessory assembly room may use the Assembly fixture calculation, while the absent Table 403.1 prevents the selected evidence from establishing whether normal Group B ratios may also be used.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }]
  }
});
assert.equal(boundedNormalGroupBFixtureAnswer.pass, true);

const priorCodeAccessibilityEvidence = [{
  ...source("bc-prior-code-accessibility-scope", "1101.3", "supporting", "aligned"),
  text: "The provisions of this chapter shall apply to alterations and changes of use or occupancy to prior code buildings in accordance with Sections 1101.3.1 through 1101.3.5."
}, {
  ...source("bc-space-accessibility", "1101.3.1", "governing", "aligned"),
  text: "Accessible features and construction governed by this chapter shall be provided throughout a space, including its immediate entrances, where an alteration is considered a change in occupancy classification."
}];
const unconditionalPriorCodeAccessibility = evaluateResearchAnswerQuality({
  question: "Does the Group M-to-Group B change trigger BC 1101.3.1?",
  evidence: priorCodeAccessibilityEvidence,
  answer: {
    answerText: "Chapter 11 accessible features and construction must therefore be provided throughout the space and its immediate entrance.",
    supportedPoints: [{
      explanation: "BC 1101.3.1 requires accessible features throughout the changed space.",
      sourceIDs: ["bc-space-accessibility"]
    }],
    missingFacts: [
      "Verify the represented project fact that this is an existing prior-code building."
    ],
    citations: [{ sourceIDs: ["bc-space-accessibility"] }]
  }
});
assert.equal(unconditionalPriorCodeAccessibility.pass, false);
assert.deepEqual(
  unconditionalPriorCodeAccessibility.unconditionalPriorCodeAccessibilitySourceIDs,
  ["bc-space-accessibility"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(unconditionalPriorCodeAccessibility).at(-1).type,
  "overstated_compliance"
);

const repairedPriorCodeAccessibility = applyResearchDeterministicAnswerRepairs(
  {
    answerText: "Chapter 11 accessible features and construction must therefore be provided throughout the space and its immediate entrance.",
    supportedPoints: [{
      explanation: "BC 1101.3.1 requires accessible features throughout the changed space.",
      sourceIDs: ["bc-space-accessibility"]
    }],
    missingFacts: [
      "Verify the represented project fact that this is an existing prior-code building."
    ],
    citations: [{ sourceIDs: ["bc-space-accessibility"] }]
  },
  priorCodeAccessibilityEvidence
);
assert.match(
  repairedPriorCodeAccessibility.answerText,
  /^If the represented prior-code-building status is confirmed and this alteration is within BC 1101\.3\.1's/
);
assert.match(
  repairedPriorCodeAccessibility.supportedPoints[0].explanation,
  /^If the represented prior-code-building status is confirmed and this alteration is within BC 1101\.3\.1's/
);
assert.deepEqual(
  repairedPriorCodeAccessibility.missingFacts,
  ["Verify the represented project fact that this is an existing prior-code building."],
  "Condition repair must not rewrite the missing-fact request."
);
assert.equal(evaluateResearchAnswerQuality({
  question: "Does the Group M-to-Group B change trigger BC 1101.3.1?",
  evidence: priorCodeAccessibilityEvidence,
  answer: repairedPriorCodeAccessibility
}).pass, true);

const conditionalPriorCodeAccessibility = evaluateResearchAnswerQuality({
  question: "Does the Group M-to-Group B change trigger BC 1101.3.1?",
  evidence: priorCodeAccessibilityEvidence,
  answer: {
    answerText: "If the represented prior-code-building status is confirmed and this alteration is the stated occupancy-classification change, BC 1101.3.1 requires accessible features and construction throughout the space and its immediate entrance.",
    supportedPoints: [{
      explanation: "If this is confirmed as an alteration to a prior-code building, BC 1101.3.1 requires accessible features throughout the changed space.",
      sourceIDs: ["bc-space-accessibility"]
    }],
    missingFacts: [
      "Verify the represented project fact that this is an existing prior-code building."
    ],
    citations: [{ sourceIDs: ["bc-space-accessibility"] }]
  }
});
assert.equal(conditionalPriorCodeAccessibility.pass, true);

const pc403MultipleOccupancyEvidence = {
  ...source("pc-multiple-occupancy-fractions", "403.1.1", "governing", "aligned"),
  codePrefix: "PC",
  text: "Where multiple occupancies are present, fractional numbers resulting from applying the fixture ratios for each occupancy shall be added and rounded up to the next whole number."
};
const incompleteFractionSequence = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: [...accessoryAssemblyEvidence, pc403MultipleOccupancyEvidence],
  answer: {
    answerText: "Not automatically. Use the applicable Assembly ratio, apply the ratios, and round fractions up as specified.",
    supportedPoints: [
      { sourceIDs: ["bc-accessory-assembly"] },
      { sourceIDs: ["pc-multiple-occupancy-fractions"] }
    ],
    citations: [
      { sourceIDs: ["bc-accessory-assembly"] },
      { sourceIDs: ["pc-multiple-occupancy-fractions"] }
    ]
  }
});
assert.equal(incompleteFractionSequence.pass, false);
assert.deepEqual(
  incompleteFractionSequence.missingMultipleOccupancyFractionSequenceSourceIDs,
  ["pc-multiple-occupancy-fractions"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(incompleteFractionSequence).at(-1).type,
  "missed_material_conclusion"
);

const initiallyUncitedFractionSequence = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: [...accessoryAssemblyEvidence, pc403MultipleOccupancyEvidence],
  answer: {
    answerText: "Not automatically. BC 303.1.3 supplies the Assembly-calculation option.",
    supportedPoints: [{ sourceIDs: ["bc-accessory-assembly"] }],
    citations: [{ sourceIDs: ["bc-accessory-assembly"] }]
  }
});
assert.deepEqual(
  initiallyUncitedFractionSequence.missingMultipleOccupancyFractionSequenceSourceIDs,
  ["pc-multiple-occupancy-fractions"],
  "Material dependent conditions must be reported in the first repair even when their source was initially omitted."
);

const completeFractionSequence = evaluateResearchAnswerQuality({
  question: accessoryAssemblyQuestion,
  evidence: [...accessoryAssemblyEvidence, pc403MultipleOccupancyEvidence],
  answer: {
    answerText: "Not automatically. Apply the applicable ratio to each occupancy, add the resulting fractional fixture requirements, and only then round up.",
    supportedPoints: [
      { sourceIDs: ["bc-accessory-assembly"] },
      { sourceIDs: ["pc-multiple-occupancy-fractions"] }
    ],
    citations: [
      { sourceIDs: ["bc-accessory-assembly"] },
      { sourceIDs: ["pc-multiple-occupancy-fractions"] }
    ]
  }
});
assert.equal(completeFractionSequence.pass, true);

const pc403AuthorityEvidence = {
  ...source("pc-fixture-authority", "403.1", "governing", "aligned"),
  codePrefix: "PC",
  text: "The number of occupants shall be determined by the New York City Building Code. Occupancy classification shall be determined in accordance with the New York City Building Code. Plumbing fixtures shall be provided in the minimum number shown in Table 403.1."
};
const misstatedTable403Authority = {
  answerText: "Table 403.1 controls the applicable occupancy type, occupant load, and fixture minimum.",
  supportedPoints: [{
    explanation: "Table 403.1 controls the applicable occupancy type, occupant load, and fixture minimum.",
    sourceIDs: ["pc-fixture-authority"]
  }],
  citations: [{ sourceIDs: ["pc-fixture-authority"] }]
};
const rejectedTable403Authority = evaluateResearchAnswerQuality({
  question: "How are fixture ratios selected?",
  evidence: [pc403AuthorityEvidence],
  answer: misstatedTable403Authority
});
assert.equal(rejectedTable403Authority.pass, false);
assert.deepEqual(
  rejectedTable403Authority.misstatedTable403AuthoritySourceIDs,
  ["pc-fixture-authority"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(rejectedTable403Authority).at(-1).type,
  "misstated_provision"
);
const repairedTable403Authority = applyResearchDeterministicAnswerRepairs(
  misstatedTable403Authority,
  [pc403AuthorityEvidence]
);
assert.match(
  repairedTable403Authority.answerText,
  /Building Code determines occupancy classification and occupant load; Table 403\.1 supplies the applicable minimum fixture counts/i
);
assert.match(
  repairedTable403Authority.supportedPoints[0].explanation,
  /Building Code determines occupancy classification and occupant load/i
);
assert.equal(evaluateResearchAnswerQuality({
  question: "How are fixture ratios selected?",
  evidence: [pc403AuthorityEvidence],
  answer: repairedTable403Authority
}).pass, true);

const diningSurfaceEvidence = [{
  ...source("bc-dining-surfaces", "1108.2.9.1", "governing", "aligned"),
  text: "At least 10 percent of the total number of seating and standing spaces, but not less than one, of each type of dining surfaces shall be accessible."
}];
const chapter11IncorporationEvidence = {
  ...source("bc-sidewalk-cafe-accessibility", "3111.6", "governing", "aligned"),
  text: "Sidewalk cafes and access thereto shall comply with Chapter 11."
};
const sidewalkCafeObstructionEvidence = {
  ...source("bc-sidewalk-cafe-obstruction", "3111.4", "governing", "aligned"),
  text: "No part of any awning, enclosure, fixture, equipment or removable platform of a sidewalk cafe shall be located so as to obstruct any exit from a building, cellar access hatch or areaway."
};
const misstatedDiningPercentage = evaluateResearchAnswerQuality({
  question: "How many dining surfaces must be accessible?",
  evidence: diningSurfaceEvidence,
  answer: {
    answerText: "At least 10 percent of the seating and standing spaces of each dining-surface type must be accessible.",
    supportedPoints: [{ sourceIDs: ["bc-dining-surfaces"] }],
    citations: [{ sourceIDs: ["bc-dining-surfaces"] }]
  }
});
assert.equal(misstatedDiningPercentage.pass, false);
assert.deepEqual(
  misstatedDiningPercentage.misstatedAccessibleDiningSurfacePercentageSourceIDs,
  ["bc-dining-surfaces"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(misstatedDiningPercentage).at(-1).type,
  "misstated_provision"
);
const correctDiningPercentage = evaluateResearchAnswerQuality({
  question: "How many dining surfaces must be accessible?",
  evidence: diningSurfaceEvidence,
  answer: {
    answerText: "At least 10 percent of the total seating and standing spaces must be accessible, with not less than one accessible seating or standing space at each type of dining surface.",
    supportedPoints: [{ sourceIDs: ["bc-dining-surfaces"] }],
    citations: [{ sourceIDs: ["bc-dining-surfaces"] }]
  }
});
assert.equal(correctDiningPercentage.pass, true);

const misstatedDiningPercentageInSupportedPoint = evaluateResearchAnswerQuality({
  question: "How many dining surfaces must be accessible?",
  evidence: diningSurfaceEvidence,
  answer: {
    answerText: "At least 10 percent of the total seating and standing spaces must be accessible, with not less than one accessible seating or standing space at each type of dining surface.",
    supportedPoints: [{
      explanation: "The rule establishes a minimum accessible share of the total seating and standing spaces for each type of dining surface.",
      sourceIDs: ["bc-dining-surfaces"]
    }],
    citations: [{ sourceIDs: ["bc-dining-surfaces"] }]
  }
});
assert.equal(misstatedDiningPercentageInSupportedPoint.pass, false);
assert.deepEqual(
  misstatedDiningPercentageInSupportedPoint.misstatedAccessibleDiningSurfacePercentageSourceIDs,
  ["bc-dining-surfaces"]
);

const misstatedDiningPercentageWithTotalPerType = evaluateResearchAnswerQuality({
  question: "How many dining surfaces must be accessible?",
  evidence: diningSurfaceEvidence,
  answer: {
    answerText: "At least 10 percent of the total seating and standing spaces of each type of dining surface must be accessible.",
    supportedPoints: [{ sourceIDs: ["bc-dining-surfaces"] }],
    citations: [{ sourceIDs: ["bc-dining-surfaces"] }]
  }
});
assert.equal(misstatedDiningPercentageWithTotalPerType.pass, false);
assert.deepEqual(
  misstatedDiningPercentageWithTotalPerType.misstatedAccessibleDiningSurfacePercentageSourceIDs,
  ["bc-dining-surfaces"]
);

const misboundDiningCalculation = evaluateResearchAnswerQuality({
  question: "How many dining surfaces must be accessible?",
  evidence: [chapter11IncorporationEvidence, ...diningSurfaceEvidence],
  answer: {
    answerText: "At least 10 percent of the total seating and standing spaces must be accessible, with not less than one accessible seating or standing space at each type of dining surface.",
    supportedPoints: [{
      explanation: "Sidewalk cafés and their access must comply with Chapter 11, including the 10 percent total dining-surface rule.",
      sourceIDs: ["bc-sidewalk-cafe-accessibility"]
    }, {
      explanation: "At least 10 percent of the total seating and standing spaces must be accessible, with not less than one accessible seating or standing space at each type of dining surface.",
      sourceIDs: ["bc-dining-surfaces"]
    }],
    citations: [{ sourceIDs: ["bc-sidewalk-cafe-accessibility"] }, { sourceIDs: ["bc-dining-surfaces"] }]
  }
});
assert.equal(misboundDiningCalculation.pass, false);
assert.deepEqual(
  misboundDiningCalculation.misboundAccessibleDiningSurfaceRuleSourceIDs,
  ["bc-sidewalk-cafe-accessibility"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(misboundDiningCalculation).at(-1).type,
  "incorrect_citation"
);

const repairedDiningCalculation = applyResearchDeterministicAnswerRepairs({
  answerText: "At least 10 percent of the seating and standing spaces of each dining-surface type must be accessible.",
  supportedPoints: [{
    explanation: "Chapter 11 applies, including 10 percent of each dining-surface type.",
    sectionID: "3111.6",
    sourceIDs: ["bc-sidewalk-cafe-accessibility"]
  }],
  citations: [
    { sourceIDs: ["bc-sidewalk-cafe-accessibility"] },
    { sourceIDs: ["bc-dining-surfaces"] }
  ]
}, [chapter11IncorporationEvidence, ...diningSurfaceEvidence]);
assert.match(
  repairedDiningCalculation.answerText,
  /10 percent of the total seating and standing spaces, with not less than one accessible seating or standing space at each type of dining surface/i
);
assert.deepEqual(
  repairedDiningCalculation.supportedPoints[0].sourceIDs,
  ["bc-sidewalk-cafe-accessibility", "bc-dining-surfaces"],
  "A deterministic correction must bind the calculation point to the exact enacted dining-surface passage."
);
assert.equal(evaluateResearchAnswerQuality({
  question: "How many dining surfaces must be accessible?",
  evidence: [chapter11IncorporationEvidence, ...diningSurfaceEvidence],
  answer: repairedDiningCalculation
}).pass, true);

const repairedDiningTypeAndObstruction = applyResearchDeterministicAnswerRepairs({
  answerText: "The proposed furniture or equipment cannot obstruct the building exit, cellar access hatch, or areaway. At least 10 percent of the total seating and standing spaces must be accessible, with at least one accessible dining surface of each type. Accessible dining surfaces must be distributed throughout the facility.",
  supportedPoints: [{
    explanation: "At least 10 percent of the total seating and standing spaces must be accessible, with at least one accessible dining surface of each type. Accessible dining surfaces must be distributed throughout the facility.",
    sourceIDs: ["bc-dining-surfaces"]
  }],
  missingFacts: ["The accessible dining-surface count and distribution are unknown."],
  citations: [
    { sourceIDs: ["bc-sidewalk-cafe-obstruction"] },
    { sourceIDs: ["bc-dining-surfaces"] }
  ]
}, [sidewalkCafeObstructionEvidence, ...diningSurfaceEvidence]);
assert.match(
  repairedDiningTypeAndObstruction.answerText,
  /No part of an awning, enclosure, fixture, equipment, or removable platform may obstruct a building exit, cellar access hatch, or areaway/i
);
assert.doesNotMatch(repairedDiningTypeAndObstruction.answerText, /furniture or equipment cannot obstruct/i);
assert.match(
  repairedDiningTypeAndObstruction.answerText,
  /at least one accessible seating or standing space at each type of dining surface/i
);
assert.match(
  repairedDiningTypeAndObstruction.answerText,
  /the accessible seating and standing spaces must be distributed throughout the facility/i
);
assert.match(
  repairedDiningTypeAndObstruction.supportedPoints[0].explanation,
  /at least one accessible seating or standing space at each type of dining surface/i
);
assert.match(
  repairedDiningTypeAndObstruction.missingFacts[0],
  /accessible seating and standing-space count/i
);
assert.equal(evaluateResearchAnswerQuality({
  question: "How many dining surfaces must be accessible?",
  evidence: diningSurfaceEvidence,
  answer: {
    answerText: "At least 10 percent of the total seating and standing spaces must be accessible, with at least one accessible dining surface of each type.",
    supportedPoints: [{ sourceIDs: ["bc-dining-surfaces"] }],
    citations: [{ sourceIDs: ["bc-dining-surfaces"] }]
  }
}).pass, false, "The quality gate must reject the type-specific dining-surface paraphrase if repair is bypassed.");

const vanityEvidence = [{
  ...source("bc-type-b-nyc-toilet-room", "1107.2.2.7.2.2", "governing", "aligned"),
  text: "Type B+NYC toilet and bathing rooms. A lavatory is permitted on the rear wall under the stated clearance condition."
}];
const vanityQuestion = "Does BC 1107.2.2.7.2.2 prove that HCR requires a vanity in the bathroom?";
const contextlessVanityAnswer = evaluateResearchAnswerQuality({
  question: vanityQuestion,
  evidence: vanityEvidence,
  answer: {
    answerText: "No. It permits a lavatory location and does not establish an HCR vanity requirement.",
    supportedPoints: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }],
    citations: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }]
  }
});
assert.equal(contextlessVanityAnswer.pass, false);
assert.deepEqual(contextlessVanityAnswer.missingTypeBNYCContextSourceIDs, ["bc-type-b-nyc-toilet-room"]);

const initiallyUncitedVanityScope = evaluateResearchAnswerQuality({
  question: vanityQuestion,
  evidence: vanityEvidence,
  answer: {
    answerText: "No. The evidence does not establish an HCR vanity requirement.",
    supportedPoints: [],
    citations: []
  }
});
assert.deepEqual(
  initiallyUncitedVanityScope.missingTypeBNYCContextSourceIDs,
  ["bc-type-b-nyc-toilet-room"],
  "A first repair must receive the material Type B+NYC applicability condition even when the source was initially omitted."
);

const contextualVanityAnswer = evaluateResearchAnswerQuality({
  question: vanityQuestion,
  evidence: vanityEvidence,
  answer: {
    answerText: "No. If the subject unit and bathroom are within the Type B+NYC scope, the provision permits a compliant lavatory location and does not establish an HCR vanity requirement; that applicability must be confirmed.",
    supportedPoints: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }],
    citations: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }]
  }
});
assert.equal(contextualVanityAnswer.pass, false);
assert.deepEqual(
  contextualVanityAnswer.missingTypeBNYCContextSourceIDs,
  ["bc-type-b-nyc-toilet-room"],
  "Conditional prose alone must not hide unresolved Type B+NYC applicability from the Missing facts list."
);

const contextualVanityAnswerWithMissingFact = evaluateResearchAnswerQuality({
  question: vanityQuestion,
  evidence: vanityEvidence,
  answer: {
    answerText: "No. If the subject unit and bathroom are within the Type B+NYC scope, the provision permits a compliant lavatory location and does not establish an HCR vanity requirement; that applicability must be confirmed.",
    missingFacts: ["Whether the subject unit and bathroom are within the Type B+NYC scope."],
    supportedPoints: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }],
    citations: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }]
  }
});
assert.equal(contextualVanityAnswerWithMissingFact.pass, true);

const conflatedVanityAnswer = evaluateResearchAnswerQuality({
  question: vanityQuestion,
  evidence: vanityEvidence,
  answer: {
    answerText: "No. If the Type B+NYC scope applies, this provision permits a compliant lavatory location; it does not establish an HCR lavatory/vanity requirement.",
    supportedPoints: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }],
    citations: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }]
  }
});
assert.equal(conflatedVanityAnswer.pass, false);
assert.deepEqual(
  conflatedVanityAnswer.conflatedLavatoryVanitySourceIDs,
  ["bc-type-b-nyc-toilet-room"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(conflatedVanityAnswer).at(-1).type,
  "misstated_provision"
);

const unresolvedTypeBNYCAnswer = evaluateResearchAnswerQuality({
  question: vanityQuestion,
  evidence: vanityEvidence,
  answer: {
    answerText: "No. Within the supplied Type B+NYC unit toilet-and-bathing-room scope, it permits a compliant lavatory location and does not establish an HCR vanity requirement.",
    supportedPoints: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }],
    citations: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }]
  }
});
assert.equal(unresolvedTypeBNYCAnswer.pass, false);
assert.deepEqual(
  unresolvedTypeBNYCAnswer.missingTypeBNYCContextSourceIDs,
  ["bc-type-b-nyc-toilet-room"]
);

const implicitSectionVanityAnswer = evaluateResearchAnswerQuality({
  question: "Does this section prove that HCR requires a vanity in the bathroom?",
  evidence: vanityEvidence,
  answer: {
    answerText: "No. It permits a lavatory location and does not establish an HCR vanity requirement.",
    supportedPoints: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }],
    citations: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }]
  }
});
assert.equal(implicitSectionVanityAnswer.pass, false);
assert.deepEqual(
  implicitSectionVanityAnswer.missingTypeBNYCContextSourceIDs,
  ["bc-type-b-nyc-toilet-room"],
  "Pinned-section questions must retain their governing Type B+NYC scope even when the user says only this section."
);

const singleExitItemEvidence = [{
  ...source("bc-single-exit-item-seven", "1006.3.2", "governing", "aligned"),
  text: "Buildings of Occupancy Group R-2 of construction Type I or II not exceeding six stories and not exceeding 2,000 square feet per story."
}];
const driftingSingleExitAnswer = evaluateResearchAnswerQuality({
  question: "Can this six-story residential building use one exit stair?",
  evidence: singleExitItemEvidence,
  answer: {
    answerText: "A single exit or access to a single exit is allowed if the building does not exceed six stories or 2,000 square feet per story.",
    supportedPoints: [{ sourceIDs: ["bc-single-exit-item-seven"] }],
    citations: [{ sourceIDs: ["bc-single-exit-item-seven"] }]
  }
});
assert.equal(driftingSingleExitAnswer.pass, false);
assert.deepEqual(
  driftingSingleExitAnswer.misstatedCumulativeConditionSourceIDs,
  ["bc-single-exit-item-seven"]
);
assert.deepEqual(
  driftingSingleExitAnswer.unsupportedExitAccessExpansionSourceIDs,
  ["bc-single-exit-item-seven"]
);
assert.deepEqual(
  researchAnswerQualityRevisionIssues(driftingSingleExitAnswer).slice(-2).map((issue) => issue.type),
  ["misstated_provision", "unsupported_requirement"]
);

const certificateOperationEvidence = [{
  ...source("bc-certificate-operation", "303.7", "supporting", "aligned"),
  text: "A Certificate of Operation shall be required for indoor assembly occupancies used or intended for use by 75 persons or more."
}];
const unsupportedRoomThresholdAnswer = {
  answerText: "The reported overall load above 200 does not itself resolve the calculation, and the stated absence of any individual room at 75 or more does not require analysis under the supplied Certificate of Operation provision. That provision concerns indoor assembly occupancies used or intended for use by 75 persons or more; the project facts state no individual room reaches that threshold.",
  explanation: "The absence of any individual room at 75 or more does not require Certificate of Operation analysis. That provision concerns 75 persons, while no individual room reaches the threshold.",
  supportedPoints: [{
    explanation: "BC 303.7 states the supplied threshold, but filing applicability remains unresolved.",
    sourceIDs: ["bc-certificate-operation"]
  }],
  missingFacts: [
    "The available egress capacity for comparison with the resulting design occupant load.",
    "Applicable filing and posted-occupancy requirements."
  ],
  citations: [{ sourceIDs: ["bc-certificate-operation"] }]
};
const rejectedRoomThresholdInference = evaluateResearchAnswerQuality({
  question: "May the existing 1:100 occupant load be retained for movable seats?",
  evidence: certificateOperationEvidence,
  answer: unsupportedRoomThresholdAnswer
});
assert.equal(rejectedRoomThresholdInference.pass, false);
assert.deepEqual(
  rejectedRoomThresholdInference.unsupportedCertificateOperationRoomThresholdSourceIDs,
  ["bc-certificate-operation"]
);
assert.equal(
  researchAnswerQualityRevisionIssues(rejectedRoomThresholdInference).at(-1).type,
  "fact_evidence_confusion"
);
const repairedRoomThresholdInference = applyResearchDeterministicAnswerRepairs(
  unsupportedRoomThresholdAnswer,
  certificateOperationEvidence,
  { question: "May the existing 1:100 occupant load be retained for movable seats?" }
);
assert.doesNotMatch(repairedRoomThresholdInference.answerText, /no individual room/i);
assert.match(
  repairedRoomThresholdInference.answerText,
  /does not establish whether a Certificate of Operation or another filing or posted-occupancy requirement applies/i
);
assert.doesNotMatch(repairedRoomThresholdInference.explanation, /does not require Certificate of Operation analysis/i);
assert(
  repairedRoomThresholdInference.missingFacts.some((value) =>
    /existing approved occupancy record and approved occupant load/i.test(value)
  ),
  "Occupant-load documentation repair omitted the existing approved record."
);
assert(
  repairedRoomThresholdInference.missingFacts.some((value) =>
    /egress capacity and other egress-design inputs/i.test(value)
  ),
  "Occupant-load documentation repair did not preserve the broader egress boundary."
);
assert.equal(evaluateResearchAnswerQuality({
  question: "May the existing 1:100 occupant load be retained for movable seats?",
  evidence: certificateOperationEvidence,
  answer: repairedRoomThresholdInference
}).pass, true);

console.log("Permitext Research answer-quality and evidence-economy contract passed.");
