import assert from "node:assert/strict";
import {
  assertResearchClaimMateriality,
  evaluateResearchClaimMateriality,
  researchClaimMaterialityVersion,
  researchClaimRoles,
  researchEvidenceRoles
} from "../research-claim-materiality.mjs";

const evidence = [
  {
    sourceID: "passage-governing-rule",
    sectionID: "rule-section",
    evidencePriority: { evidenceRole: "governing" }
  },
  {
    sourceID: "passage-supporting-definition",
    sectionID: "definition-section",
    evidencePriority: { evidenceRole: "supporting" }
  },
  {
    sourceID: "passage-contextual-comparison",
    sectionID: "comparison-section",
    evidencePriority: { evidenceRole: "contextual" }
  },
  {
    sourceID: "passage-irrelevant-sibling",
    sectionID: "rule-section",
    evidencePriority: { evidenceRole: "irrelevant" }
  }
];

function answerFor(sourceIDs) {
  return {
    supportedPoints: [{ sourceIDs }],
    citations: sourceIDs.map((sourceID) => ({ sourceIDs: [sourceID] }))
  };
}

function claim(id, claimRole, sourceIDs) {
  return { id, claimRole, sourceIDs };
}

const contextualCannotGovern = evaluateResearchClaimMateriality({
  evidence,
  claims: [claim("governing-result", researchClaimRoles.governing, ["passage-contextual-comparison"])],
  answer: answerFor(["passage-contextual-comparison"])
});
assert.equal(contextualCannotGovern.pass, false);
assert.equal(contextualCannotGovern.claims[0].evidenceOptions[0].materialitySatisfied, false);
assert.deepEqual(
  contextualCannotGovern.claims[0].evidenceOptions[0].contextualSourceIDs,
  ["passage-contextual-comparison"]
);

const irrelevantCannotGovern = evaluateResearchClaimMateriality({
  evidence,
  claims: [claim("governing-result", "governing", ["passage-irrelevant-sibling"])],
  answer: answerFor(["passage-irrelevant-sibling"])
});
assert.equal(irrelevantCannotGovern.pass, false);
assert.deepEqual(irrelevantCannotGovern.irrelevantAnswerSourceIDs, ["passage-irrelevant-sibling"]);

const contextualExplanation = assertResearchClaimMateriality({
  evidence,
  claims: [claim("non-governing-comparison", "contextual", ["passage-contextual-comparison"])],
  answer: answerFor(["passage-contextual-comparison"])
});
assert.equal(contextualExplanation.pass, true);
assert.equal(contextualExplanation.claims[0].matchedPointIndex, 0);

const ordinarySupportingEvidence = assertResearchClaimMateriality({
  evidence,
  claims: [claim("defined-term", "supporting", ["passage-supporting-definition"])],
  answer: answerFor(["passage-supporting-definition"])
});
assert.equal(ordinarySupportingEvidence.pass, true);

const governingWithOrdinarySupport = assertResearchClaimMateriality({
  evidence,
  claims: [claim("governing-result", "governing", [
    "passage-governing-rule",
    "passage-supporting-definition"
  ])],
  answer: answerFor(["passage-governing-rule", "passage-supporting-definition"])
});
assert.equal(governingWithOrdinarySupport.pass, true);
assert.deepEqual(
  governingWithOrdinarySupport.claims[0].evidenceOptions[0].qualifyingSourceIDs,
  ["passage-governing-rule"]
);
assert.deepEqual(
  governingWithOrdinarySupport.claims[0].evidenceOptions[0].evidenceRoles,
  [researchEvidenceRoles.governing, researchEvidenceRoles.supporting]
);

const sameSectionIsNotSamePassage = evaluateResearchClaimMateriality({
  evidence,
  claims: [claim("governing-result", "governing", ["passage-governing-rule"])],
  answer: answerFor(["passage-irrelevant-sibling"])
});
assert.equal(sameSectionIsNotSamePassage.pass, false);
assert.deepEqual(
  sameSectionIsNotSamePassage.claims[0].evidenceOptions[0]
    .supportedPoints[0].missingSupportedPointSourceIDs,
  ["passage-governing-rule"]
);

const citationWithoutPointBinding = evaluateResearchClaimMateriality({
  evidence,
  claims: [claim("governing-result", "governing", ["passage-governing-rule"])],
  answer: {
    supportedPoints: [{ sourceIDs: ["passage-supporting-definition"] }],
    citations: [{ sourceIDs: ["passage-governing-rule"] }]
  }
});
assert.equal(citationWithoutPointBinding.pass, false);

const pointBindingWithoutCitation = evaluateResearchClaimMateriality({
  evidence,
  claims: [claim("governing-result", "governing", ["passage-governing-rule"])],
  answer: {
    supportedPoints: [{ sourceIDs: ["passage-governing-rule"] }],
    citations: [{ sourceIDs: ["passage-supporting-definition"] }]
  }
});
assert.equal(pointBindingWithoutCitation.pass, false);
assert.deepEqual(
  pointBindingWithoutCitation.claims[0].evidenceOptions[0].missingCitationSourceIDs,
  ["passage-governing-rule"]
);

assert.throws(
  () => evaluateResearchClaimMateriality({
    evidence,
    claims: [claim("unknown-passage", "supporting", ["passage-not-supplied"])],
    answer: answerFor(["passage-not-supplied"])
  }),
  (error) => error?.code === "INVALID_RESEARCH_CLAIM_MATERIALITY_CONTRACT"
);

assert.equal(researchClaimMaterialityVersion, "20260811-exact-passage-claim-materiality-v1");
console.log("Research claim materiality contract passed.");
