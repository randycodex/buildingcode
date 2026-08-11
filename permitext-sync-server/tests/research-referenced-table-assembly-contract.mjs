import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assembleResearchEvidence,
  researchEvidenceAssemblyVersion
} from "../research-evidence-assembly.mjs";

const table5044Text = "BC Table 504.4 Allowable Number of Stories above Grade Plane. Group B, Type IIB, sprinklered: 4 stories.";
const table5044Grids = [{
  rows: [{
    cells: [
      { text: "Occupancy", rowSpan: 1, columnSpan: 1 },
      { text: "Type IIB sprinklered", rowSpan: 1, columnSpan: 1 }
    ]
  }, {
    cells: [
      { text: "B", rowSpan: 1, columnSpan: 1 },
      { text: "4", rowSpan: 1, columnSpan: 1 }
    ]
  }]
}];
const table5044 = {
  id: "rich-source-table-504-4",
  kind: "table",
  reference: "BC Table 504.4",
  contentHash: createHash("sha256").update(JSON.stringify({
    reference: "BC Table 504.4",
    text: table5044Text,
    grids: table5044Grids
  })).digest("hex"),
  text: table5044Text,
  textLength: table5044Text.length,
  rowCount: 2,
  grids: table5044Grids
};

const sections = new Map([
  ["504.3", {
    sectionID: "BC:504.3",
    codePrefix: "BC",
    sectionNumber: "504.3",
    title: "Height in feet and number of stories",
    canonicalText: "The maximum height shall not exceed Table 504.3. The maximum number of stories shall not exceed Table 504.4.",
    crossReferences: [
      { codePrefix: "BC", sectionNumber: "903.3.1.1", referenceKind: "section" },
      { codePrefix: "BC", sectionNumber: "504.4", referenceKind: "table" }
    ]
  }],
  ["504.4", {
    sectionID: "BC:504.4",
    codePrefix: "BC",
    sectionNumber: "504.4",
    title: "Number of stories",
    canonicalText: "The maximum number of stories shall not exceed the limits specified in Table 504.4. BC Table 504.4 Allowable Number of Stories above Grade Plane.",
    richSources: [table5044]
  }],
  ["903.3.1.1", {
    sectionID: "BC:903.3.1.1",
    codePrefix: "BC",
    sectionNumber: "903.3.1.1",
    title: "NFPA 13 sprinkler systems",
    canonicalText: "Sprinkler systems shall comply with NFPA 13."
  }]
]);

const referencedTableLimitation = {
  kind: "referenced-table-review-required",
  text: "At least one candidate refers to a table whose complete structured values are not in the proposed passage."
};

function discovery() {
  return {
    retrievalVersion: "table-cross-reference-test-v1",
    candidates: [{
      sectionID: "BC:504.3",
      codePrefix: "BC",
      sectionNumber: "504.3",
      title: "Height in feet and number of stories",
      selectedText: "The maximum number of stories shall not exceed Table 504.4.",
      sourceReviewRequirements: [{
        kind: "referenced-table",
        references: ["Table 504.4"]
      }],
      signals: {
        exactTopicRouteTarget: true,
        referencesTable: true
      }
    }, {
      sectionID: "BC:506.2.4",
      codePrefix: "BC",
      sectionNumber: "506.2.4",
      title: "Mixed-occupancy allowable area",
      selectedText: "See Table 506.2.",
      sourceReviewRequirements: [{
        kind: "referenced-table",
        references: ["Table 506.2"]
      }]
    }],
    coverageLimitations: [referencedTableLimitation]
  };
}

const assembled = await assembleResearchEvidence({
  question: "How many stories are allowed for this Group B Type IIB sprinklered building?",
  discover: async () => discovery(),
  resolveSection: async (request) => sections.get(request.sectionNumber) || null,
  limits: {
    maximumCandidates: 1,
    maximumDiscovered: 1,
    maximumCrossReferences: 1,
    maximumCharacters: 2_000,
    maximumCharactersPerSource: 1_000
  }
});

assert.equal(assembled.assemblyVersion, researchEvidenceAssemblyVersion);
assert.equal(assembled.usage.discoveredCount, 1);
assert.equal(assembled.usage.crossReferenceCount, 1);
assert.equal(assembled.sources.length, 2, "The bounded package should contain the rule and its table source.");
assert.equal(assembled.sources[0].sectionNumber, "504.3");
const assembledTable = assembled.sources.find((source) => source.sectionNumber === "504.4");
assert(assembledTable, "Table 504.4 must be resolved before a non-table cross-reference.");
assert.equal(assembledTable.origin, "permitext_cross_reference");
assert.equal(assembledTable.richSourceID, table5044.id);
assert.equal(assembledTable.richSourceKind, "table");
assert.equal(assembledTable.richSourceReference, "BC Table 504.4");
assert.equal(assembledTable.richSourceCanonicalReference, "BC Table 504.4");
assert.equal(assembledTable.richSourceContentHash, table5044.contentHash);
assert.equal(assembledTable.richSourceRowCount, table5044.rowCount);
assert.deepEqual(assembledTable.richSourceGrids, table5044.grids);
assert.equal(assembledTable.text, table5044.text);
assert.equal(
  createHash("sha256").update(JSON.stringify({
    reference: assembledTable.richSourceReference,
    text: assembledTable.text,
    grids: assembledTable.richSourceGrids
  })).digest("hex"),
  assembledTable.richSourceContentHash,
  "The assembled immutable table passage must retain the exact content covered by its source hash."
);
assert(
  !assembled.limitations.some((item) => item.kind === "referenced-table-review-required"),
  "A canonically resolved structured table must clear the provisional discovery limitation."
);
assert(assembled.usage.characterCount <= assembled.limits.maximumCharacters);

const unresolved = await assembleResearchEvidence({
  question: "How many stories are allowed for this Group B Type IIB sprinklered building?",
  discover: async () => discovery(),
  resolveSection: async (request) => {
    const section = sections.get(request.sectionNumber);
    return request.sectionNumber === "504.4" ? { ...section, richSources: [] } : section;
  },
  limits: {
    maximumCandidates: 1,
    maximumDiscovered: 1,
    maximumCrossReferences: 1,
    maximumCharacters: 2_000,
    maximumCharactersPerSource: 1_000
  }
});
assert(
  unresolved.limitations.some((item) => item.kind === "referenced-table-review-required"),
  "A section reference without the complete structured table must retain the limitation."
);
assert.equal(
  unresolved.sources.find((source) => source.sectionNumber === "504.4")?.richSourceID,
  undefined
);

const legacyAnonymousTable = await assembleResearchEvidence({
  question: "How many stories are allowed for this Group B Type IIB sprinklered building?",
  discover: async () => discovery(),
  resolveSection: async (request) => {
    const section = sections.get(request.sectionNumber);
    if (request.sectionNumber !== "504.4") return section;
    return {
      ...section,
      richSources: [{
        ...table5044,
        reference: "Official table",
        contentHash: createHash("sha256").update(JSON.stringify({
          reference: "Official table",
          text: table5044.text,
          grids: table5044.grids
        })).digest("hex")
      }]
    };
  },
  limits: {
    maximumCandidates: 1,
    maximumDiscovered: 1,
    maximumCrossReferences: 1,
    maximumCharacters: 2_000,
    maximumCharactersPerSource: 1_000
  }
});
const normalizedLegacyTable = legacyAnonymousTable.sources.find((source) =>
  source.sectionNumber === "504.4"
);
assert.equal(normalizedLegacyTable?.richSourceReference, "Official table");
assert.equal(normalizedLegacyTable?.richSourceCanonicalReference, "BC Table 504.4");
assert.deepEqual(normalizedLegacyTable?.richSourceGrids, table5044.grids);
assert(
  !legacyAnonymousTable.limitations.some((item) =>
    item.kind === "referenced-table-review-required"
  ),
  "A single complete anonymous legacy grid in its own table section must receive that table's canonical identity."
);

console.log("Permitext referenced-table Research assembly contract passed.");
