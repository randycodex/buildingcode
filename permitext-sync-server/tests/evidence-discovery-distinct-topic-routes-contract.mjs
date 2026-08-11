import assert from "node:assert/strict";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";

const sectionNumbers = [
  "202",
  "G301.1", "G301.2", "G304.1", "G304.2", "G304.3", "G304.4", "G501.1",
  "709.1", "709.3", "710.1", "710.3",
  "711.2.3", "711.2.4",
  "718.2.6", "718.2.6.1", "718.2.6.1.1", "718.2.6.1.2",
  "505.2", "505.2.1", "505.2.2", "505.2.3",
  "505.3", "505.3.1", "505.3.2", "505.3.3",
  "1510.2", "1510.2.1", "1510.2.2", "1510.2.3"
];
const catalog = sectionNumbers.map((sectionNumber) => ({
  id: `BC:${sectionNumber}`,
  codePrefix: "BC",
  chapterNumber: sectionNumber.startsWith("G") ? "G" : sectionNumber.split(".")[0],
  sectionNumber,
  title: `Canonical test section ${sectionNumber}`
}));

async function routedReferences(question) {
  const result = await discoverRelevantEvidence({
    question,
    catalog,
    invertedIndex: new Map(),
    readSectionBody: async (section) => ({
      blocks: [{ id: section.id, plainText: `Canonical enacted text for BC ${section.sectionNumber}.` }]
    }),
    limit: 12
  });
  return new Set(result.candidates.map((candidate) => `BC ${candidate.sectionNumber}`));
}

async function assertRoute(question, expected) {
  const references = await routedReferences(question);
  for (const reference of expected) {
    assert(references.has(reference), `${question} must retrieve ${reference}.`);
  }
}

await assertRoute(
  "Can equipment be installed below the design flood elevation in a flood hazard area?",
  ["BC G301.1", "BC G301.2", "BC G304.1", "BC G304.2", "BC G304.3", "BC G304.4", "BC G501.1"]
);
await assertRoute(
  "Does a smoke separation require a smoke barrier or a smoke partition?",
  ["BC 709.1", "BC 709.3", "BC 710.1", "BC 710.3"]
);
await assertRoute(
  "What rating applies to construction supporting a horizontal assembly?",
  ["BC 711.2.3", "BC 711.2.4"]
);
await assertRoute(
  "Where is fireblocking required in a combustible exterior wall?",
  ["BC 718.2.6", "BC 718.2.6.1", "BC 718.2.6.1.1", "BC 718.2.6.1.2"]
);
await assertRoute(
  "Does this intermediate level qualify as a mezzanine?",
  ["BC 202", "BC 505.2", "BC 505.2.1"]
);
await assertRoute(
  "Is this mechanical equipment platform an additional story?",
  ["BC 202", "BC 505.3", "BC 505.3.1"]
);
await assertRoute(
  "Is this rooftop enclosure a penthouse or bulkhead?",
  ["BC 202", "BC 1510.2", "BC 1510.2.2", "BC 1510.2.3"]
);

console.log("Permitext evidence discovery distinct topic routes contract passed.");
