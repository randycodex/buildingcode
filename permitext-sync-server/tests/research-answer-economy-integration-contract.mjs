import assert from "node:assert/strict";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { evaluateResearchAnswerQuality } from "../research-answer-quality.mjs";
import { withOfflineResearchHTTPHarness } from "./research-benchmark-http-harness.mjs";

const question = "An existing six-story Group R-2 building of Type IIB construction is 68 feet high and fully sprinklered. The work is an alteration on the third floor. The occupant load is 48 and the exit access travel distance is 120 feet. Under BC 1017.2, what additional facts are needed to determine whether that travel distance complies?";

await withOfflineResearchHTTPHarness("answer-economy-integration", async ({ discover, resolveSection }) => {
  const evidencePackage = await assembleResearchEvidence({ question, discover, resolveSection });
  const evidence = evidencePackage.sources;
  const byReference = new Map(evidence.map((source) => [
    `${source.codePrefix} ${source.sectionNumber}`,
    source
  ]));

  for (const reference of ["BC 1017.1", "BC 1017.2", "BC 1017.3"]) {
    const source = byReference.get(reference);
    assert(source, `${reference} must be assembled.`);
    assert.equal(source.evidencePriority.evidenceRole, "governing");
    assert.equal(source.evidencePriority.topicRouteRelationship, "aligned");
  }
  for (const reference of ["BC 601.1", "BC 602.1", "BC 602.2", "BC 1004.1", "BC 1004.3"]) {
    const source = byReference.get(reference);
    assert(source, `${reference} must remain available for internal review.`);
    assert.equal(source.evidencePriority.evidenceRole, "supporting");
    assert.equal(source.evidencePriority.topicRouteRelationship, "collateral");
    assert.equal(source.evidencePriority.claimCoverageRequired, false);
  }

  const alignedSourceIDs = ["BC 1017.1", "BC 1017.2", "BC 1017.3"]
    .map((reference) => byReference.get(reference).sourceID);
  const collateralSourceIDs = ["BC 601.1", "BC 1004.1"]
    .map((reference) => byReference.get(reference).sourceID);
  const bloated = evaluateResearchAnswerQuality({
    evidence,
    answer: {
      supportedPoints: [
        { sourceIDs: alignedSourceIDs },
        ...collateralSourceIDs.map((sourceID) => ({ sourceIDs: [sourceID] }))
      ],
      citations: [
        { sourceIDs: alignedSourceIDs },
        ...collateralSourceIDs.map((sourceID) => ({ sourceIDs: [sourceID] }))
      ]
    }
  });
  assert.equal(bloated.pass, false);
  assert.deepEqual(bloated.collateralCitationSourceIDs, collateralSourceIDs);

  const economical = evaluateResearchAnswerQuality({
    evidence,
    answer: {
      supportedPoints: [{ sourceIDs: alignedSourceIDs }],
      citations: [{ sourceIDs: alignedSourceIDs }]
    }
  });
  assert.equal(economical.pass, true);
  assert.equal(economical.evidenceEconomy.citedProvisionCount, 3);
  assert(economical.evidenceEconomy.reviewedOnlyProvisionCount >= 5);
});

console.log("Permitext live-query evidence-economy integration contract passed; paid model calls: no.");
