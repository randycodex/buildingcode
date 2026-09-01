import assert from "node:assert/strict";
import {
  discoverRelevantEvidence,
  evidenceDiscoveryVersion
} from "../evidence-discovery.mjs";

const references = [
  ["BC", "1020.2"],
  ["BC", "1101.2"],
  ["BC", "1103.2"],
  ["BC", "1104.3"],
  ["BC", "716.5.5.1"],
  ["BC", "716.5.7.1.1"],
  ["BC", "716.5.8.1"],
  ["BC", "716.5.8.1.1"],
  ["BC", "716.5.8.1.2.1"],
  ["BC", "716.5.8.1.2.2"],
  ["BC", "1208.1"],
  ["BC", "1208.3.1"],
  ["BC", "P"],
  ["ZR", "34-112"],
  ["ZR", "23-22"],
  ["ZR", "23-432"],
  ["ZR", "33-122"]
];

const catalog = references.map(([codePrefix, sectionNumber]) => ({
  id: `${codePrefix}:${sectionNumber}`,
  codePrefix,
  chapterNumber: sectionNumber.split(/[.-]/)[0],
  sectionNumber,
  title: `Canonical test provision ${codePrefix} ${sectionNumber}`
}));

async function routedReferences(question) {
  const result = await discoverRelevantEvidence({
    question,
    catalog,
    invertedIndex: new Map(),
    readSectionBody: async (section) => ({
      blocks: [{
        id: `${section.id}-text`,
        plainText: `Canonical enacted text for ${section.codePrefix} ${section.sectionNumber}.`
      }]
    }),
    availableCodePrefixes: ["BC", "ZR"],
    limit: 12
  });
  assert.equal(result.retrievalVersion, evidenceDiscoveryVersion);
  return new Set(result.candidates.map((candidate) =>
    `${candidate.codePrefix} ${candidate.sectionNumber}`
  ));
}

async function assertRoute(question, expected) {
  const routed = await routedReferences(question);
  for (const reference of expected) {
    assert(routed.has(reference), `${JSON.stringify(question)} must retrieve ${reference}.`);
  }
}

await assertRoute(
  "What's the minimum hall towards a fire escape that does not require ADA?",
  ["BC 1020.2", "BC 1101.2", "BC 1103.2", "BC 1104.3"]
);

await assertRoute(
  "in the building code, where are the minimum sq ft, or minimum distance between wall for habitable spaces like a bedroom",
  ["BC 1208.1", "BC 1208.3.1"]
);

await assertRoute(
  "maximum sq ft for vision light in a fire-rated door - 2022 NYC Building Code",
  [
    "BC 716.5.5.1",
    "BC 716.5.7.1.1",
    "BC 716.5.8.1",
    "BC 716.5.8.1.1",
    "BC 716.5.8.1.2.1",
    "BC 716.5.8.1.2.2"
  ]
);

await assertRoute("what BC-Appendix P", ["BC P"]);

await assertRoute(
  "zoning area c4-4d, how similar it is to r8a?",
  ["ZR 34-112", "ZR 23-22", "ZR 23-432", "ZR 33-122"]
);

console.log("Permitext screenshot-example retrieval regression passed; paid model calls: no.");
