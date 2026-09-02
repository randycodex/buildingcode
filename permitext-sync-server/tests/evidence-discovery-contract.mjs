import assert from "node:assert/strict";
import {
  discoverRelevantEvidence,
  evidenceCandidateDisplayVersion,
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
}, {
  id: "7",
  codePrefix: "BC",
  chapterNumber: "3",
  sectionNumber: "304.1",
  title: "Business Group B"
}, {
  id: "8", codePrefix: "BC", chapterNumber: "3", sectionNumber: "303.4", title: "Assembly Group A-3"
}, {
  id: "9", codePrefix: "BC", chapterNumber: "3", sectionNumber: "302.1", title: "Occupancy classification"
}, {
  id: "10", codePrefix: "BC", chapterNumber: "5", sectionNumber: "508.2", title: "Accessory occupancies"
}, {
  id: "11", codePrefix: "ZR", chapterNumber: "I-3", sectionNumber: "13-041", title: "Applicability of parking regulations within the Manhattan Core"
}, {
  id: "12", codePrefix: "ZR", chapterNumber: "I-3", sectionNumber: "13-07", title: "Existing Buildings and Off-street Parking Facilities"
}, {
  id: "13", codePrefix: "ZR", chapterNumber: "I-3", sectionNumber: "13-12", title: "Permitted Parking for Non-Residential Uses"
}, {
  id: "14", codePrefix: "BC", chapterNumber: "3", sectionNumber: "303.1.3", title: "Accessory assembly spaces"
}, {
  id: "15", codePrefix: "BC", chapterNumber: "5", sectionNumber: "508.2.3", title: "Allowable building area and height"
}, {
  id: "16", codePrefix: "BC", chapterNumber: "5", sectionNumber: "508.2.4", title: "Separation of occupancies"
}, {
  id: "17", codePrefix: "PC", chapterNumber: "4", sectionNumber: "403.1.1", title: "Fixture calculations"
}, {
  id: "18", codePrefix: "ZR", chapterNumber: "I-2", sectionNumber: "12-01", title: "Rules Applying to Text of Resolution"
}];

const invertedIndex = new Map([
  ["scissor", ["1"]],
  ["stair", ["1"]],
  ["stairway", ["1"]],
  ["exit", ["1"]],
  ["plumbing", ["2"]],
  ["fixture", ["2"]],
  ["height", ["3"]],
  ["stories", ["3"]],
  ["fire", ["4"]],
  ["district", ["4"]],
  ["maps", ["4"]],
  ["prior", ["5"]],
  ["code", ["5"]],
  ["floor", ["5"]],
  ["surface", ["5"]],
  ["schedule", ["6"]]
  ,["office", ["2", "7"]]
  ,["architects", ["7"]]
  ,["community", ["8"]]
  ,["multiple", ["9", "10"]]
  ,["parking", ["11", "12", "13"]]
  ,["manhattan", ["11", "12", "13"]]
  ,["non-residential", ["13"]]
  ,["accessory", ["10", "14", "15", "16"]]
  ,["multipurpose", ["14", "15", "16"]]
  ,["fractional", ["2", "17"]]
  ,["illustration", ["18"]]
  ,["text", ["18"]]
]);

const bodies = new Map([
  ["1", {
    blocks: [{
      id: "scissor-rule",
      plainText: "Stairways that share a scissor stair assembly shall be counted as one exit stairway. Exception: In Group R-2 occupancies the stairs may be treated as separate exits where the specified enclosure and separation conditions are satisfied.",
      html: "<p>Stairways that share a scissor stair assembly shall be counted as one exit stairway.</p><ol><li>Exception: In Group R-2 occupancies the stairs may be treated as separate exits where the specified enclosure and separation conditions are satisfied.</li></ol>"
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
  ,["7", {
    blocks: [{
      id: "business-office-rule",
      plainText: "Business Group B occupancy includes office and professional services, including architects and engineers."
    }]
  }]
  ,["8", { blocks: [{ id: "community-hall", plainText: "Assembly Group A-3 includes community halls and recreation or social activities." }] }]
  ,["9", { blocks: [{ id: "multiple-occupancy", plainText: "Structures or portions shall be classified in one or more occupancy groups; multiple occupancies shall comply with Section 508." }] }]
  ,["10", { blocks: [{ id: "accessory-classification", plainText: "Accessory occupancies are ancillary to the main occupancy and shall comply with Section 508.2." }] }]
  ,["11", { blocks: [{ id: "manhattan-parking-applicability", plainText: "For accessory off-street parking facilities developed or enlarged after May 8, 2013, the as-of-right number of parking spaces permitted shall be as set forth in Section 13-10." }] }]
  ,["12", { blocks: [{ id: "existing-manhattan-parking", plainText: "This Section applies to existing buildings developed without parking and existing required or permitted accessory off-street parking spaces established before May 8, 2013." }] }]
  ,["13", { blocks: [{ id: "non-residential-manhattan-parking", plainText: "Accessory off-street parking spaces are permitted for non-residential uses in developments or enlargements, subject to the stated maximums." }] }]
  ,["14", { blocks: [{ id: "accessory-assembly", plainText: "An assembly room with fewer than 75 persons and accessory to another occupancy is Group B or part of that occupancy, except plumbing fixtures may be calculated under Assembly requirements." }] }]
  ,["15", { blocks: [{ id: "accessory-area", plainText: "Accessory occupancies are generally limited to ten percent of the story area." }] }]
  ,["16", { blocks: [{ id: "accessory-separation", plainText: "No separation is required between accessory and main occupancies except as stated." }] }]
  ,["17", { blocks: [{ id: "fixture-fractions", plainText: "Fractional fixture requirements for multiple occupancies are added and fractions are rounded up." }] }]
  ,["18", { blocks: [{ id: "zr-text-control", plainText: "The particular shall control the general. In case of any difference of meaning or implication between the text of this Resolution and any caption, illustration, summary table or illustrative table, the text shall control." }] }]
]);

const zoningTextControl = await discoverRelevantEvidence({
  question: "How does the Zoning Resolution instruct a reader to resolve a conflict between the enacted text and an illustration or summary table?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  availableCodePrefixes: ["ZR"],
  limit: 12
});
assert.equal(zoningTextControl.candidates[0].sectionID, "18");
assert.equal(zoningTextControl.candidates[0].signals.exactTopicRouteTarget, true);
assert.match(zoningTextControl.candidates[0].selectedText, /text shall control/i);

const accessoryFixtureRouting = await discoverRelevantEvidence({
  question: "A residential-building cellar contains Group B, F, and S spaces plus a multipurpose assembly room with fewer than 75 occupants that may qualify as accessory to the residential occupancy. After the correct Table 403.1 ratio has been applied separately to each occupancy, may the resulting fractional fixture requirements be added before rounding, and may the accessory multipurpose room use Assembly fixture requirements?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  availableCodePrefixes: ["BC", "PC"],
  limit: 12
});
assert.equal(
  accessoryFixtureRouting.candidates.find((candidate) => candidate.sectionID === "14")?.signals.exactTopicRouteTarget,
  true,
  "The accessory-assembly exception must remain an exact plumbing-fixture route target."
);
for (const sectionID of ["15", "16"]) {
  assert.notEqual(
    accessoryFixtureRouting.candidates.find((candidate) => candidate.sectionID === sectionID)?.signals.exactTopicRouteTarget,
    true,
    `BC ${sectionID === "15" ? "508.2.3" : "508.2.4"} must not become a mandatory route target for a fixture-calculation question.`
  );
}

const manhattanOfficeParking = await discoverRelevantEvidence({
  question: "For this Project in C6-4, is off-street parking required for an office alteration? Project facts: Borough: Manhattan; Community District: Manhattan 1.",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  availableCodePrefixes: ["ZR"],
  limit: 12
});
assert.deepEqual(
  manhattanOfficeParking.candidates.slice(0, 3).map((candidate) => candidate.sectionID).sort(),
  ["11", "12", "13"],
  "A Manhattan C6-4 office-parking question must retrieve applicability, existing-building, and non-residential parking provisions."
);
assert(
  manhattanOfficeParking.candidates.slice(0, 3).every((candidate) =>
    candidate.signals.exactTopicRouteTarget === true
  ),
  "Manhattan Core parking provisions must be explicit topic-route targets rather than incidental lexical matches."
);

for (const citationQuestion of [
  "What does ZR Section 13-12 provide?",
  "What does ZR Table 13-12 provide?",
  "What does Section 13-12 provide?"
]) {
  const citedZoning = await discoverRelevantEvidence({
    question: citationQuestion,
    catalog,
    invertedIndex,
    readSectionBody: async (section) => bodies.get(section.id),
    availableCodePrefixes: ["ZR"],
    limit: 12
  });
  assert.equal(
    citedZoning.candidates[0].sectionID,
    "13",
    `${citationQuestion} must resolve as an exact ZR provision reference.`
  );
  assert.equal(citedZoning.candidates[0].signals.exactReference, true);
}

const officeClassification = await discoverRelevantEvidence({
  question: "A 1,200 sf space is used as a small architectural office with 12 employees. What occupancy group should it be classified as?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 12
});
assert.equal(officeClassification.candidates[0].sectionID, "7", "Office classification must route directly to BC 304.1.");

const communityRoom = await discoverRelevantEvidence({
  question: "A community room in a residential building is used for meetings, parties, classes, and events. How should it be classified?",
  catalog, invertedIndex, readSectionBody: async (section) => bodies.get(section.id), limit: 12
});
assert(communityRoom.candidates.some((candidate) => candidate.sectionID === "8"), "Community-room retrieval must include BC 303.4.");
assert(communityRoom.candidates.some((candidate) => candidate.sectionID === "9"), "Multipurpose-room retrieval must include BC 302.1.");

const mixedOccupancies = await discoverRelevantEvidence({
  question: "A building contains residential apartments, ground-floor retail, and an accessory management office. How should the different occupancies be treated?",
  catalog, invertedIndex, readSectionBody: async (section) => bodies.get(section.id), limit: 12
});
for (const expectedID of ["9", "7", "10"]) {
  assert(mixedOccupancies.candidates.some((candidate) => candidate.sectionID === expectedID), `Mixed-occupancy retrieval is missing ${expectedID}.`);
}

const discovery = await discoverRelevantEvidence({
  question: "Can a Group R-2 scissor stair be counted as two exits?",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 20
});

assert.equal(discovery.schemaVersion, 2);
assert.equal(discovery.retrievalVersion, evidenceDiscoveryVersion);
assert.equal(discovery.candidateDisplayVersion, evidenceCandidateDisplayVersion);
assert.equal(discovery.candidateState, "unreviewed");
assert.equal(discovery.candidates[0].sectionID, "1");
assert.equal(discovery.candidates[0].candidateState, "candidate");
assert.equal(discovery.candidates[0].signals.containsException, true);
assert.match(discovery.candidates[0].selectedText, /scissor stair assembly/);
assert.match(discovery.candidates[0].displayBlock.html, /<ol><li>Exception:/);
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

const omhAuthority = await discoverRelevantEvidence({
  question: "This feasibility must comply with NYS Office of Mental Health guidelines. Research the minimum bathroom, toilet, and ADA requirements.",
  catalog,
  invertedIndex,
  readSectionBody: async (section) => bodies.get(section.id),
  limit: 5
});
assert.deepEqual(
  omhAuthority.outsideCurrentLibrary.filter((item) =>
    item.label === "NYS Office of Mental Health requirements"
  ).map((item) => ({ sourceName: item.sourceName, sourceURL: item.sourceURL })),
  [{
    sourceName: "New York State Office of Mental Health",
    sourceURL: "https://omh.ny.gov/"
  }]
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
