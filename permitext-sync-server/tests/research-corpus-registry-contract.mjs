import assert from "node:assert/strict";
import {
  createResearchCorpusRegistry,
  researchCorpusByPrefix,
  routeResearchCorpora,
  unapprovedZoningDiagnosticEnabled
} from "../research-corpus-registry.mjs";
import {
  enactedSearchIndex,
  enactedSection,
  enactedSectionCatalog
} from "../enacted-code-content.mjs";
import { zoningContentMetadata } from "../zoning-content.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";

const registry = createResearchCorpusRegistry();
const zoningMetadata = await zoningContentMetadata();
const registeredZoningCorpus = researchCorpusByPrefix(registry, "ZR");
assert.equal(
  registeredZoningCorpus.codeEdition,
  zoningMetadata.codeVersion,
  "The routed Zoning edition must match the current imported official corpus metadata."
);
assert.equal(registeredZoningCorpus.codeVersion, zoningMetadata.syncCodeVersion);
assert.equal(registeredZoningCorpus.automaticResearchEligible, false);

const ordinary = routeResearchCorpora({
  question: "What is the maximum common path of egress travel?",
  registry
});
assert.deepEqual(ordinary.selected.map((corpus) => corpus.id), ["nyc-2022-construction-codes"]);

const explicit2014 = routeResearchCorpora({
  question: "Under the 2014 NYC Building Code, what is the maximum vision-panel area?",
  registry
});
assert.deepEqual(
  explicit2014.selected.map((corpus) => corpus.id),
  ["nyc-2014-construction-codes"],
  "An exact 2014 edition request must use the official historical corpus without mixing in 2022."
);
assert.equal(explicit2014.selected[0].applicabilityStatus, "prior-edition-case-specific");

const ambiguousAppendixP = routeResearchCorpora({
  question: "what BC-Appendix P",
  registry
});
assert.deepEqual(
  ambiguousAppendixP.selected.map((corpus) => corpus.id),
  ["nyc-2022-construction-codes", "nyc-2014-construction-codes"],
  "An Appendix P question without an edition must retrieve current and prior-edition context."
);

const explicit2014AppendixP = routeResearchCorpora({
  question: "What did Appendix P require in the 2014 NYC Building Code?",
  registry
});
assert.deepEqual(
  explicit2014AppendixP.selected.map((corpus) => corpus.id),
  ["nyc-2014-construction-codes"],
  "An explicit 2014 Appendix P request must not mix in the 2022 corpus."
);

const explicit2022AppendixP = routeResearchCorpora({
  question: "What is Appendix P in the 2022 NYC Building Code?",
  registry
});
assert.deepEqual(
  explicit2022AppendixP.selected.map((corpus) => corpus.id),
  ["nyc-2022-construction-codes"],
  "An explicit 2022 Appendix P request must not mix in the 2014 corpus."
);

const shorthand2014 = routeResearchCorpora({
  question: "What about 2014?",
  previousMessages: [{
    role: "user",
    question: "What are the requirements for designing a ramp under the NYC Building Code?"
  }],
  registry
});
assert.deepEqual(
  shorthand2014.selected.map((corpus) => corpus.id),
  ["nyc-2014-construction-codes"],
  "A conversational 2014 follow-up must switch the active Construction Code edition without adding 2022."
);

const shorthand2022 = routeResearchCorpora({
  question: "Use the 2022 edition instead.",
  previousMessages: [{
    role: "user",
    question: "Under the 2014 NYC Building Code, what are the ramp requirements?"
  }],
  registry
});
assert.deepEqual(
  shorthand2022.selected.map((corpus) => corpus.id),
  ["nyc-2022-construction-codes"],
  "A conversational 2022 follow-up must switch back to the current Construction Code without retaining 2014."
);

const configured2014 = routeResearchCorpora({
  question: "What does the selected code require?",
  projectCodeVersion: "nyc-2014",
  registry
});
assert.deepEqual(configured2014.selected.map((corpus) => corpus.id), ["nyc-2014-construction-codes"]);

const editionComparison = routeResearchCorpora({
  question: "Compare the 2014 NYC Building Code with the 2022 NYC Building Code.",
  registry
});
assert.deepEqual(editionComparison.selected.map((corpus) => corpus.id), [
  "nyc-2022-construction-codes",
  "nyc-2014-construction-codes"
]);

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

const naturalLanguageZoning = routeResearchCorpora({
  question: "For this C6-4 project, is off-street parking required for an office alteration?",
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(
  naturalLanguageZoning.selected.map((corpus) => corpus.id),
  ["nyc-zoning-resolution"],
  "Natural-language parking questions with a zoning district must route to the Zoning Resolution."
);

const plainCommercialDistrictZoning = routeResearchCorpora({
  question: "A 1,500-square-foot architectural office is proposed in a C3 district. Is the professional office use permitted as-of-right under the underlying C3 use regulations?",
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(
  plainCommercialDistrictZoning.selected.map((corpus) => corpus.id),
  ["nyc-zoning-resolution"],
  "An unsuffixed commercial zoning district such as C3 must route to the Zoning Resolution."
);

const bareZoningSection = routeResearchCorpora({
  question: "What does Section 23-151 establish?",
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(
  bareZoningSection.selected.map((corpus) => corpus.id),
  ["nyc-zoning-resolution"],
  "A bare hyphenated Zoning Resolution citation must not fall back to the Construction Codes."
);

const longZoningFollowUp = routeResearchCorpora({
  question: "And what if that condition is unknown?",
  previousMessages: [
    { role: "user", question: "Under the Zoning Resolution, is this use permitted in C6-4?" },
    { role: "user", question: "What exception applies?" },
    { role: "user", question: "Does that change for an existing building?" },
    { role: "user", question: "Explain the transition rule." }
  ],
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(
  longZoningFollowUp.selected.map((corpus) => corpus.id),
  ["nyc-zoning-resolution"],
  "A fourth cue-less follow-up must retain the active Zoning Resolution corpus."
);

const projectFactZoning = routeResearchCorpora({
  question: "Is this use permitted on the lot?",
  projectFacts: ["Zoning Fact — Zoning District(s): C6-4 (NYC Planning imported)"],
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(projectFactZoning.selected.map((corpus) => corpus.id), ["nyc-zoning-resolution"]);
assert.equal(projectFactZoning.selected[0].routeReason, "zoning question with Project zoning facts");

const projectFactConstructionQuestion = routeResearchCorpora({
  question: "How many plumbing fixtures are required for this office?",
  projectFacts: ["Zoning Fact — Zoning District(s): C6-4 (NYC Planning imported)"],
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(
  projectFactConstructionQuestion.selected.map((corpus) => corpus.id),
  ["nyc-2022-construction-codes"],
  "A collateral Project zoning fact must not reroute a Construction Code question."
);

const buildingCodeOnlyBoundary = routeResearchCorpora({
  question: "A change between Group B and Group M follows a zoning Use Group renumbering. Based only on the selected Building Code passages, what accessibility consequence can be stated?",
  registry: createResearchCorpusRegistry({ zoningResearchEligibility: true })
});
assert.deepEqual(
  buildingCodeOnlyBoundary.selected.map((corpus) => corpus.id),
  ["nyc-2022-construction-codes"],
  "An express Building-Code-only evidence boundary must not retrieve the Zoning Resolution merely because the question identifies a missing zoning transition issue."
);

assert.equal(
  unapprovedZoningDiagnosticEnabled({
    PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1"
  }),
  true
);
assert.equal(
  unapprovedZoningDiagnosticEnabled({
    PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
    VERCEL: "1"
  }),
  false,
  "The unapproved Zoning diagnostic must never enable hosted Research."
);
assert.equal(
  unapprovedZoningDiagnosticEnabled({
    PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
    VERCEL_ENV: "preview"
  }),
  false,
  "The unapproved Zoning diagnostic must remain local-only."
);

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
assert.equal(
  researchCorpusByPrefix(registry, "BC", {
    codeVersion: "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1"
  })?.id,
  "nyc-2014-construction-codes",
  "Pinned 2014 evidence must resolve by its exact version identity instead of the ambiguous BC prefix."
);
assert.equal(
  researchCorpusByPrefix(registry, "BC", {
    corpusID: "nyc-2022-construction-codes"
  })?.id,
  "nyc-2022-construction-codes"
);

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
