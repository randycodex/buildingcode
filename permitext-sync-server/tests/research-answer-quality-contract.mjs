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

console.log("Permitext Research answer-quality and evidence-economy contract passed.");
