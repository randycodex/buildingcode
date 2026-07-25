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
}, {
  id: "4",
  codePrefix: "BC",
  chapterNumber: "D",
  sectionNumber: "D106.1",
  title: "Fire district maps"
}, {
  id: "5",
  codePrefix: "AC",
  chapterNumber: "1",
  sectionNumber: "28-101.4.5",
  title: "Prior-code buildings"
}, {
  id: "6",
  codePrefix: "PC",
  chapterNumber: "4",
  sectionNumber: "403.9",
  title: "Fixture schedule without published table"
}];

const invertedIndex = new Map([
  ["scissor", new Set(["1"])],
  ["stair", new Set(["1"])],
  ["stairway", new Set(["1"])],
  ["exit", new Set(["1"])],
  ["plumbing", new Set(["2"])],
  ["fixture", new Set(["2"])],
  ["height", new Set(["3"])],
  ["stories", new Set(["3"])],
  ["fire", new Set(["4"])],
  ["district", new Set(["4"])],
  ["maps", new Set(["4"])],
  ["prior", new Set(["5"])],
  ["code", new Set(["5"])],
  ["floor", new Set(["5"])],
  ["surface", new Set(["5"])],
  ["schedule", new Set(["6"])]
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
      plainText: "Plumbing fixtures shall be provided for the type of occupancy and in the minimum number shown in Table 403.1. PC Table 403.1 Minimum Number of Required Plumbing Fixtures. Classification B, office: one water closet per 25 for the first 50 and one per 50 for the remainder. Footnote: The fixtures shown are based on one fixture being the minimum required.",
      html: "<p>Plumbing fixtures shall be provided for the type of occupancy and in the minimum number shown in Table 403.1.</p><a title=\"PC Table 403.1\"></a><strong>Table 403.1 Minimum Number of Required Plumbing Fixtures</strong><ScrollTable><table><tbody><tr><th>Classification</th><th>Description</th><th>Water closets</th></tr><tr><td>B</td><td>Office</td><td>1 per 25 for the first 50 and 1 per 50 for the remainder</td></tr></tbody></table></ScrollTable><p>Footnote: The fixtures shown are based on one fixture being the minimum required.</p>"
    }]
  }],
  ["3", {
    blocks: [{
      id: "height-rule",
      plainText: "The maximum number of stories shall not exceed the limits specified for the construction type."
    }]
  }],
  ["4", {
    blocks: [{
      id: "fire-district-map",
      plainText: "The boundaries of the fire districts are shown on the following maps.",
      html: "<p>The boundaries are shown below.</p><img src=\"../assets/official-fire-district-map.png\" alt=\"Fire district map\">"
    }]
  }],
  ["5", {
    blocks: [{
      id: "prior-code-threshold",
      plainText: "Where the floor surface area of a prior code building is increased by more than 110 percent, the entire building shall comply with this code as if it were a new building."
    }]
  }],
  ["6", {
    blocks: [{
      id: "fixture-schedule-without-table",
      plainText: "The fixture schedule shall use the values in Table 403.1, which is not included in this source."
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

assert.equal(discovery.schemaVersion, 2);
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
assert.equal(
  outsideAuthority.outsideCurrentLibrary.find((item) => item.label === "HCR requirements")?.sourceURL,
  "https://hcr.ny.gov/",
  "Outside-agency boundaries must link to an authoritative starting point."
);

const mapAuthority = await discoverRelevantEvidence({
  question: "Show me BC D106.1 fire district maps.",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  resolveVisualSource: async (reference) => ({
    id: "visual-source-official-fire-district-map",
    kind: "image",
    assetName: reference.assetName,
    assetURL: `/code/assets/${reference.assetName}`,
    mediaType: "image/png",
    contentHash: "a".repeat(64),
    byteLength: 1_024,
    displayWidth: reference.displayWidth,
    displayHeight: reference.displayHeight
  }),
  limit: 5
});
assert.equal(mapAuthority.candidates[0].sectionID, "4", "Appendix-style exact references must resolve.");
assert.equal(mapAuthority.candidates[0].preparationEligible, false);
assert(
  mapAuthority.candidates[0].sourceReviewRequirements.some((item) =>
    item.kind === "visual-source" &&
    item.reviewMode === "explicit-selection" &&
    item.maximumSelections === 4
  ),
  "A text passage must not hide an official map or image in the same section."
);
assert(
  mapAuthority.coverageLimitations.some((item) => item.kind === "visual-source-review-required"),
  "Map-dependent candidates must disclose the text-only preparation boundary."
);
assert(
  mapAuthority.candidates[0].visualSources.some((item) =>
    item.assetName === "official-fire-district-map.png" &&
    item.assetURL === "/code/assets/official-fire-district-map.png" &&
    item.contentHash === "a".repeat(64) &&
    item.byteLength === 1_024
  ),
  "Map-dependent candidates must expose an integrity-addressed official asset inventory for review."
);

const tableAuthority = await discoverRelevantEvidence({
  question: "What minimum plumbing fixtures does PC 403.1 require?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 5
});
assert.equal(tableAuthority.candidates[0].sectionID, "2", "Plumbing Code exact references must resolve.");
assert.equal(tableAuthority.candidates[0].preparationEligible, true);
assert(
  tableAuthority.candidates[0].richSources.some((item) =>
    item.kind === "table" &&
    item.reference === "PC Table 403.1" &&
    item.rowCount === 2 &&
    item.contentHash
  ),
  "A published official table must be attached as a structured candidate source."
);
assert(
  !tableAuthority.coverageLimitations.some((item) => item.kind === "referenced-table-review-required"),
  "A complete structured table must satisfy the text-only table boundary."
);

const incompleteTableAuthority = await discoverRelevantEvidence({
  question: "What fixture schedule does PC 403.9 require?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 5
});
assert.equal(incompleteTableAuthority.candidates[0].sectionID, "6");
assert.equal(incompleteTableAuthority.candidates[0].preparationEligible, false);
assert(
  incompleteTableAuthority.candidates[0].sourceReviewRequirements.some((item) =>
    item.kind === "referenced-table" && item.references.includes("Table 403.1")
  ),
  "A table reference without the published table must remain blocked."
);
assert(
  incompleteTableAuthority.coverageLimitations.some((item) =>
    item.kind === "referenced-table-review-required"
  ),
  "Incomplete table-dependent candidates must disclose the preparation boundary."
);

const administrativeAuthority = await discoverRelevantEvidence({
  question: "What does AC 28-101.4.5 require when prior-code floor surface area increases by more than 110 percent?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 5
});
assert.equal(administrativeAuthority.candidates[0].sectionID, "5", "Administrative Code exact references must resolve.");

assert.equal(evidenceDiscoveryFeatureEnabled({}), false);
assert.equal(evidenceDiscoveryFeatureEnabled({ PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1" }), true);
assert.equal(validateEvidenceDiscoveryQuestion("  valid question  "), "valid question");
assert.throws(() => validateEvidenceDiscoveryQuestion("x"), /between 3 and 2,000/);

console.log("Permitext evidence discovery contract passed.");
