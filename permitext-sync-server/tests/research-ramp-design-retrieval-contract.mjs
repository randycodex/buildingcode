import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverRelevantEvidence,
  evidenceDiscoveryVersion
} from "../evidence-discovery.mjs";
import { assembleResearchEvidence, researchEvidenceAssemblyLimits } from "../research-evidence-assembly.mjs";
import { requiredResearchClaimsFromEvidence, evaluateResearchRequiredClaimCoverage } from "../research-required-claim-coverage.mjs";
import { preflightRampRequestEnvelopes } from "./research-request-envelope-preflight.mjs";
import { researchTopicDependencyPlan } from "../research-topic-dependencies.mjs";

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
        codeEdition: "2022 New York City Construction Codes",
        codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1",
        corpusID: "nyc-2022-construction-codes",
        jurisdiction: "New York City",
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
const assemble = (question, options = {}) => assembleResearchEvidence({
  question,
  discover: ({ question, limit, retrievalContext }) => discoverRelevantEvidence({
    question,
    retrievalContext,
    catalog,
    invertedIndex: new Map(Object.entries(searchIndex.tokens || {})),
    readSectionBody: async (section) => bodies.get(String(section.id)),
    availableCodePrefixes: ["AC", "BC", "FGC", "MC", "PC"],
    limit
  }),
  resolveSection,
  ...options
});
const assembled = await assemble("what are the requirements for designing a ramp?");
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

const requiredDependencies = [
  "1012.6.1", "1012.6.2", "1012.6.3", "1012.6.4", "1012.6.5",
  "1014.2", "1014.6", "1014.7", "1012.7.2", "1012.10.1",
  "1012.5.2", "1012.5.3", "1020.2", "1012.9"
];
const exactQuestion = "What are the requirements for designing an accessible ramp under the 2022 NYC Building Code?";
for (const question of [
  exactQuestion,
  "What are the requirements for designing a ramp?",
  "Give me the design requirements for an accessible ramp in NYC.",
  "Accessible ramp design: slopes, landings, handrail heights and extensions?"
]) {
  const result = await assemble(question);
  for (const reference of requiredDependencies) {
    const source = result.sources.find((source) => source.codePrefix === "BC" && source.sectionNumber === reference);
    assert(source, `${question}: missing ${reference}`);
    assert.equal(source.canonicalContextComplete, true, `${reference} must keep its exceptions.`);
    assert.equal(source.text, (await resolveSection({ codePrefix: "BC", sectionNumber: reference })).text);
    assert.equal(source.evidencePriority.claimCoverageRequired, true, `${reference} must not be silently ignored.`);
  }
  assert(result.usage.topicDependencyCount > 0 && result.usage.topicDependencyCount <= researchEvidenceAssemblyLimits.maximumTopicDependencies);
  assert(result.usage.crossReferenceCount <= researchEvidenceAssemblyLimits.maximumCrossReferences);
  assert(result.usage.characterCount <= researchEvidenceAssemblyLimits.maximumCharacters);
  assert(!result.limitations.some((item) => item.kind === "topic-dependency-coverage-gap"));
  assert(result.sources.every((source) => source.codeEdition === "2022 New York City Construction Codes"));
  // Citation coverage must still reject an answer that cites only the old ten
  // anchors and omits the newly supplied dimensional dependencies.
  const baselineIDs = result.sources.filter((source) => source.origin === "permitext_discovered").map((source) => source.sourceID);
  const coverage = evaluateResearchRequiredClaimCoverage({
    evidence: result.sources,
    requiredClaims: requiredResearchClaimsFromEvidence(result.sources),
    answer: { supportedPoints: [{ sourceIDs: baselineIDs }], citations: [{ sourceIDs: baselineIDs }] }
  });
  assert.equal(coverage.pass, false);
}

const exact = await assemble(exactQuestion);
for (const field of ["codeEdition", "codeVersion", "corpusID", "jurisdiction"]) {
  assert.equal(researchTopicDependencyPlan({ question: exactQuestion,
    sources: exact.sources.map((source) => ({ ...source, [field]: "" })) }), null,
  `Missing ${field} must not authorize cross-section expansion.`);
}
const capped = await assemble(exactQuestion, { limits: { maximumTopicDependencies: 2 } });
assert.equal(capped.usage.topicDependencyCount, 2);
assert(capped.limitations.some((item) => item.kind === "topic-dependency-coverage-gap"));
for (const source of capped.sources.filter((source) => source.canonicalContextComplete && requiredDependencies.includes(source.sectionNumber))) {
  assert.equal(source.evidencePriority.claimCoverageRequired, true);
  assert(!capped.limitations.find((item) => item.kind === "topic-dependency-coverage-gap").text.includes(`${source.sectionNumber},`) &&
    !capped.limitations.find((item) => item.kind === "topic-dependency-coverage-gap").text.includes(`${source.sectionNumber}. `),
  "Do not report a dependency missing if generic expansion recovered it.");
}
const unavailable = await assemble(exactQuestion, {
  resolveSection: (request) => request.sectionNumber === "1014.6" ? null : resolveSection(request)
});
assert(!unavailable.sources.some((source) => source.sectionNumber === "1014.6"));
assert(unavailable.limitations.some((item) => item.kind === "topic-dependency-coverage-gap" && /1014\.6/.test(item.text)));
const wrongEdition = await assemble(exactQuestion, {
  resolveSection: async (request) => {
    const result = await resolveSection(request);
    return request.sectionNumber === "1014.6" && result ? { ...result, codeEdition: "2014 New York City Construction Codes" } : result;
  }
});
assert(!wrongEdition.sources.some((source) => source.sectionNumber === "1014.6"));
assert(wrongEdition.limitations.some((item) => item.kind === "topic-dependency-coverage-gap"));
const unlabeled = await assemble(exactQuestion, {
  resolveSection: async (request) => {
    const result = await resolveSection(request);
    if (request.sectionNumber === "1014.6" && result) {
      for (const field of ["codeEdition", "codeVersion", "corpusID", "jurisdiction"]) delete result[field];
    }
    return result;
  }
});
assert(!unlabeled.sources.some((source) => source.sectionNumber === "1014.6"),
  "Do not invent missing canonical identity from the requested reference.");
assert(unlabeled.limitations.some((item) => item.kind === "topic-dependency-coverage-gap"));
const limited = await assemble(exactQuestion, { limits: { maximumCharacters: 4_000 } });
assert(limited.usage.characterCount <= 4_000);
assert(limited.limitations.some((item) => item.kind === "topic-dependency-coverage-gap"));
const shortened = await assemble(exactQuestion, { limits: { maximumCharactersPerSource: 500 } });
assert(shortened.limitations.some((item) => item.kind === "topic-dependency-coverage-gap"));
assert(shortened.sources.filter((source) => source.retrievalReason === "Reviewed edition-matched dimensional dependency")
  .every((source) => source.canonicalContextComplete), "Never add a truncated dependency as a complete rule.");
for (const question of ["What are the requirements for a vehicular ramp?", "What are the requirements for a curb ramp?", "What are the 2014 ramp design requirements?"]) {
  const result = await assemble(question);
  assert.equal(result.usage.topicDependencyCount, 0, "The 2022 design plan must not cross into other ramp types or editions.");
}
const pinned = await assemble(exactQuestion, { pinnedEvidence: [{ sectionID: catalog.find((section) => section.sectionNumber === "1012.2" && section.codePrefix === "BC").id }] });
assert.equal(pinned.usage.topicDependencyCount, 0, "Do not broaden a selected-evidence workflow.");

await preflightRampRequestEnvelopes(assembled.sources);
await preflightRampRequestEnvelopes(exact.sources);
console.log("Permitext ramp-design full-corpus retrieval regression passed; paid model calls: no.");
