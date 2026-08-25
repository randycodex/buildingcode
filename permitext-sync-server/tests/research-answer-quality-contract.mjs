import assert from "node:assert/strict";
import {
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
assert.equal(orphan.pass, false);
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

const contextualVanityAnswer = evaluateResearchAnswerQuality({
  question: vanityQuestion,
  evidence: vanityEvidence,
  answer: {
    answerText: "No. In its Type B+NYC unit toilet-and-bathing-room context, it permits a compliant lavatory location and does not establish an HCR vanity requirement.",
    supportedPoints: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }],
    citations: [{ sourceIDs: ["bc-type-b-nyc-toilet-room"] }]
  }
});
assert.equal(contextualVanityAnswer.pass, true);

console.log("Permitext Research answer-quality and evidence-economy contract passed.");
