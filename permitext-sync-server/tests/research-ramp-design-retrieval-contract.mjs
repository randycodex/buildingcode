import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverRelevantEvidence,
  evidenceDiscoveryVersion
} from "../evidence-discovery.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";

const testRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(testRoot, "../..");
const legacyBundlePath = join(
  workspaceRoot,
  "NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/bundle.json"
);
const shippedSearchIndexPath = join(
  workspaceRoot,
  "NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/searchIndex.json"
);

const [bundle, searchIndex] = await Promise.all([
  readFile(legacyBundlePath, "utf8").then(JSON.parse),
  readFile(shippedSearchIndexPath, "utf8").then(JSON.parse)
]);
const catalogByReference = new Map();
const bodies = new Map();

for (const chapter of bundle.chapters || []) {
  for (const group of chapter.groups || []) {
    const codePrefix = String(group.headerLine || "").match(/^SECTION\s+([A-Z]+)/i)?.[1];
    if (!codePrefix) continue;
    for (const section of group.sections || []) {
      const id = String(section.id || "");
      if (!id) continue;
      const catalogEntry = {
        id,
        codePrefix,
        chapterNumber: String(chapter.chapterNumber || ""),
        sectionNumber: String(section.sectionNumber || ""),
        title: String(section.title || ""),
        headingLine: String(group.headingLine || "")
      };
      catalogByReference.set(
        `${catalogEntry.codePrefix}:${catalogEntry.chapterNumber}:${catalogEntry.sectionNumber}`,
        catalogEntry
      );
      bodies.set(id, {
        blocks: [{
          id: `${id}-enacted-text`,
          plainText: String(section.officialText || "")
        }]
      });
    }
  }
}

const result = await discoverRelevantEvidence({
  question: "what are the requirements for designing a ramp?",
  catalog: Array.from(catalogByReference.values()),
  invertedIndex: new Map(Object.entries(searchIndex.tokens || {})),
  readSectionBody: async (section) => bodies.get(String(section.id)),
  availableCodePrefixes: ["AC", "BC", "FGC", "MC", "PC"],
  limit: 12
});

assert.equal(result.retrievalVersion, evidenceDiscoveryVersion);
assert(result.candidates.length >= 10, "The full corpus should return the routed ramp baseline.");

const topTen = result.candidates.slice(0, 10);
const topTenReferences = new Set(topTen.map((candidate) =>
  `${candidate.codePrefix} ${candidate.sectionNumber}`
));
for (const reference of [
  "BC 1101.2",
  "BC 1012.1",
  "BC 1012.2",
  "BC 1012.3",
  "BC 1012.4",
  "BC 1012.5.1",
  "BC 1012.6",
  "BC 1012.7.1",
  "BC 1012.8",
  "BC 1012.10"
]) {
  assert(topTenReferences.has(reference), `Ramp-design retrieval is missing ${reference}.`);
}
assert(topTen.every((candidate) =>
  candidate.signals.exactTopicRouteTarget === true &&
  candidate.signals.topicRoutes.includes("pedestrian ramp design and accessibility provisions")
), "The usable ramp baseline must outrank incidental lexical matches.");

const slope = topTen.find((candidate) => candidate.sectionNumber === "1012.2");
assert.match(slope?.selectedText || "", /one unit vertical in 12 units horizontal/i);
const scope = topTen.find((candidate) => candidate.sectionNumber === "1012.1");
assert.match(scope?.selectedText || "", /component of a means of egress/i);

for (const incidentalReference of ["BC 1111.3", "BC 1817.9", "BC 1023.7"]) {
  assert(!topTenReferences.has(incidentalReference), `${incidentalReference} displaced the core ramp rules.`);
}

const catalog = Array.from(catalogByReference.values());
const catalogByID = new Map(catalog.map((section) => [String(section.id), section]));
const resolveSection = async (request) => {
  const section = catalogByID.get(String(request.sectionID || "")) || catalog.find((candidate) =>
    candidate.codePrefix === request.codePrefix &&
    candidate.sectionNumber === request.sectionNumber
  );
  if (!section) return null;
  return {
    ...section,
    sectionID: section.id,
    text: (bodies.get(String(section.id))?.blocks || [])
      .map((block) => block.plainText)
      .filter(Boolean)
      .join("\n\n")
  };
};
const assembled = await assembleResearchEvidence({
  question: "what are the requirements for designing a ramp?",
  discover: ({ question, limit, retrievalContext }) => discoverRelevantEvidence({
    question,
    retrievalContext,
    catalog,
    invertedIndex: new Map(Object.entries(searchIndex.tokens || {})),
    readSectionBody: async (section) => bodies.get(String(section.id)),
    availableCodePrefixes: ["AC", "BC", "FGC", "MC", "PC"],
    limit
  }),
  resolveSection
});
const assembledBaseline = assembled.sources.filter((source) =>
  source.origin === "permitext_discovered"
);
assert.equal(assembledBaseline.length, 10, "The model-visible package must retain the complete routed baseline.");
assert(assembledBaseline.every((source) =>
  source.evidencePriority?.claimCoverageRequired === true
), "Each routed baseline provision must receive answer and citation coverage.");
const assembledReferences = new Set(assembledBaseline.map((source) =>
  `${source.codePrefix} ${source.sectionNumber}`
));
for (const reference of topTenReferences) {
  assert(assembledReferences.has(reference), `${reference} was lost during evidence assembly.`);
}
assert(assembled.sources.some((source) => source.sectionNumber === "1012.6.3"));
assert(assembled.sources.some((source) => source.sectionNumber === "1012.6.4"));
assert(assembled.sources.some((source) => source.sectionNumber === "1012.10.1"));

console.log("Permitext ramp-design full-corpus retrieval regression passed; paid model calls: no.");
