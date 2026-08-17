import assert from "node:assert/strict";
import {
  createResearchCorpusRegistry,
  researchCorpusByPrefix,
  routeResearchCorpora
} from "../research-corpus-registry.mjs";
import {
  enactedSearchIndex,
  enactedSection,
  enactedSectionCatalog
} from "../enacted-code-content.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";

const registry = createResearchCorpusRegistry();

const ordinary = routeResearchCorpora({
  question: "What is the maximum common path of egress travel?",
  registry
});
assert.deepEqual(ordinary.selected.map((corpus) => corpus.id), ["nyc-2022-construction-codes"]);

const fire = routeResearchCorpora({
  question: "Under FC 503, what fire apparatus access is required?",
  registry
});
assert.deepEqual(fire.selected.map((corpus) => corpus.id), ["nyc-2022-fire-code"]);

const fireFollowUp = routeResearchCorpora({
  question: "What about the exception?",
  previousMessages: [{ role: "user", question: "Under the NYC Fire Code, when is a permit required?" }],
  registry
});
assert.deepEqual(fireFollowUp.selected.map((corpus) => corpus.id), ["nyc-2022-fire-code"]);

const mixed = routeResearchCorpora({
  question: "Compare BC 903 with FC 901 for this condition.",
  registry
});
assert.deepEqual(mixed.selected.map((corpus) => corpus.id), [
  "nyc-2022-construction-codes",
  "nyc-2022-fire-code"
]);

const zoningBlocked = routeResearchCorpora({
  question: "What does ZR 12-01 control?",
  registry
});
assert.deepEqual(zoningBlocked.selected, []);
assert.deepEqual(zoningBlocked.unavailable.map((corpus) => corpus.id), ["nyc-zoning-resolution"]);

const zoningProjectDefault = routeResearchCorpora({
  question: "What rules apply here?",
  projectCodeVersion: "NYC Zoning Resolution",
  registry
});
assert.deepEqual(zoningProjectDefault.selected, []);
assert.deepEqual(zoningProjectDefault.unavailable.map((corpus) => corpus.id), ["nyc-zoning-resolution"]);
assert.equal(zoningProjectDefault.unavailable[0].routeReason, "Project configured code basis");

const zoningEnabled = routeResearchCorpora({
  question: "What does ZR 12-01 control?",
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(zoningEnabled.selected.map((corpus) => corpus.id), ["nyc-zoning-resolution"]);

const future = routeResearchCorpora({
  question: "Does EBC 101 apply now?",
  registry
});
assert.deepEqual(future.selected, []);
assert.deepEqual(
  future.excluded.filter((corpus) => corpus.routeReason !== "excluded from ordinary Research")
    .map((corpus) => corpus.id),
  ["nyc-existing-building-code-2027"]
);

const historical = routeResearchCorpora({
  question: "What did the 1968 NYC Building Code require?",
  registry
});
assert.deepEqual(historical.selected, []);
assert.deepEqual(
  historical.excluded.filter((corpus) => corpus.routeReason !== "excluded from ordinary Research")
    .map((corpus) => corpus.id),
  ["nyc-1968-building-code"]
);

assert.equal(researchCorpusByPrefix(registry, "FC")?.id, "nyc-2022-fire-code");
assert.equal(researchCorpusByPrefix(registry, "ZR")?.automaticResearchEligible, false);

const fireCorpus = researchCorpusByPrefix(registry, "FC");
const fireCatalog = (await enactedSectionCatalog())
  .filter((section) => section.codePrefix === "FC")
  .map((section) => ({
    ...section,
    sectionNumber: String(section.sectionNumber || "").replace(/^FC\s+/i, ""),
    codeEdition: fireCorpus.codeEdition,
    codeVersion: fireCorpus.codeVersion,
    corpusID: fireCorpus.id,
    corpusLabel: fireCorpus.label,
    applicabilityStatus: fireCorpus.applicabilityStatus
  }));
const fireDiscovery = await discoverRelevantEvidence({
  question: "Under FDNY Fire Code FC 503, what governs fire apparatus access?",
  catalog: fireCatalog,
  invertedIndex: await enactedSearchIndex(),
  readSectionBody: (section) => enactedSection(section.id),
  availableCodePrefixes: ["FC"],
  limit: 6
});
const fc503 = fireDiscovery.candidates.find((candidate) =>
  candidate.codePrefix === "FC" && candidate.sectionNumber === "503"
);
assert(fc503, "Fire Code routing did not retrieve FC 503.");
assert.equal(fc503.signals.exactReference, true);
assert.equal(
  fireDiscovery.outsideCurrentLibrary.some((source) => source.label === "Fire Department requirements"),
  false,
  "Fire Code should not be reported outside the routed library when FC was searched."
);

console.log("permitext routed Research corpus registry contract passed", {
  fireSections: fireCatalog.length,
  fc503Rank: fc503.rank
});
