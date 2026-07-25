import assert from "node:assert/strict";
import {
  discoverRelevantEvidence,
  evidenceDiscoveryFeatureEnabled,
  evidenceDiscoveryMaximumCandidates,
  evidenceDiscoveryVersion,
  validateEvidenceDiscoveryQuestion
} from "../evidence-discovery.mjs";

const catalog = [{
  id: "1",
  codePrefix: "BC",
  chapterNumber: "10",
  sectionNumber: "1007.1.1",
  title: "Two exits or exit access doorways"
}, {
  id: "2",
  codePrefix: "PC",
  chapterNumber: "4",
  sectionNumber: "403.1",
  title: "Minimum number of plumbing fixtures"
}, {
  id: "3",
  codePrefix: "BC",
  chapterNumber: "5",
  sectionNumber: "504.3",
  title: "Height in stories"
}];

const invertedIndex = new Map([
  ["scissor", new Set(["1"])],
  ["stair", new Set(["1"])],
  ["stairway", new Set(["1"])],
  ["exit", new Set(["1"])],
  ["plumbing", new Set(["2"])],
  ["fixture", new Set(["2"])],
  ["height", new Set(["3"])],
  ["stories", new Set(["3"])]
]);

const bodies = new Map([
  ["1", {
    blocks: [{
      id: "scissor-rule",
      plainText: "Stairways that share a scissor stair assembly shall be counted as one exit stairway. Exception: In Group R-2 occupancies the stairs may be treated as separate exits where the specified enclosure and separation conditions are satisfied."
    }]
  }],
  ["2", {
    blocks: [{
      id: "fixture-rule",
      plainText: "Plumbing fixtures shall be provided for the type of occupancy and in the minimum number shown in Table 403.1."
    }]
  }],
  ["3", {
    blocks: [{
      id: "height-rule",
      plainText: "The maximum number of stories shall not exceed the limits specified for the construction type."
    }]
  }]
]);

const discovery = await discoverRelevantEvidence({
  question: "Can a Group R-2 scissor stair be counted as two exits?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 20
});

assert.equal(discovery.schemaVersion, 1);
assert.equal(discovery.retrievalVersion, evidenceDiscoveryVersion);
assert.equal(discovery.candidateState, "unreviewed");
assert.equal(discovery.candidates[0].sectionID, "1");
assert.equal(discovery.candidates[0].candidateState, "candidate");
assert.equal(discovery.candidates[0].signals.containsException, true);
assert.match(discovery.candidates[0].selectedText, /scissor stair assembly/);
assert.equal(discovery.generatedAnswer, undefined);
assert(discovery.candidates.length <= evidenceDiscoveryMaximumCandidates);
assert(
  discovery.coverageLimitations.some((item) => item.kind === "candidate-review-required"),
  "Discovery results must tell the user that candidates are not approved."
);

const outsideAuthority = await discoverRelevantEvidence({
  question: "Does this section prove that HCR requires a vanity?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 5
});
assert(
  outsideAuthority.coverageLimitations.some((item) => item.kind === "query-context-required"),
  "A context-dependent question must identify the missing section context."
);
assert(
  outsideAuthority.outsideCurrentLibrary.some((item) => item.label === "HCR requirements"),
  "Outside-agency requirements must be identified separately from code candidates."
);

assert.equal(evidenceDiscoveryFeatureEnabled({}), false);
assert.equal(evidenceDiscoveryFeatureEnabled({ PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1" }), true);
assert.equal(validateEvidenceDiscoveryQuestion("  valid question  "), "valid question");
assert.throws(() => validateEvidenceDiscoveryQuestion("x"), /between 3 and 2,000/);

console.log("Permitext evidence discovery contract passed.");
