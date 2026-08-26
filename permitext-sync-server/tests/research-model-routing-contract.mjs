import assert from "node:assert/strict";
import {
  researchBoundedCitationRequest,
  researchEvidenceForBoundedCitationLookup,
  researchEvidenceSupportsBoundedCitationFastPath,
  researchEscalationModel,
  researchModelRoutingConfiguration,
  researchModelRoutingVersion,
  researchQuestionIsBoundedCitationLookup,
  routeResearchAnswerModel
} from "../research-model-routing.mjs";

const environment = {
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra"
};

assert.equal(researchModelRoutingConfiguration(environment).mode, "hybrid");
assert.match(researchModelRoutingVersion, /luna-terra-hybrid/);

const direct = routeResearchAnswerModel({
  question: "What does BC 101.2 require?",
  evidence: [{ sectionID: "bc-101-2", title: "Scope", text: "This code applies to construction." }],
  environment
});
assert.equal(direct.tier, "fast");
assert.equal(direct.model, "gpt-5.6-luna");
assert.equal(researchQuestionIsBoundedCitationLookup("What does Building Code Section 101.2 say about scope?"), true);
assert.deepEqual(
  researchBoundedCitationRequest("What does the current 2022 NYC Building Code Section 101.1 state?"),
  { codePrefix: "BC", sectionNumber: "101.1" }
);
assert.deepEqual(
  researchEvidenceForBoundedCitationLookup(
    "What does the current 2022 NYC Building Code Section 101.1 state?",
    [
      { sourceID: "bc-101-1-a", codePrefix: "BC", sectionNumber: "101.1" },
      { sourceID: "pc-101-1", codePrefix: "PC", sectionNumber: "101.1" },
      { sourceID: "bc-101-2", codePrefix: "BC", sectionNumber: "101.2" }
    ]
  ).map((source) => source.sourceID),
  ["bc-101-1-a"]
);
assert.equal(researchBoundedCitationRequest("List BC 101.1 and BC 101.2"), null);
assert.equal(researchBoundedCitationRequest("List BC 101.1 and 101.2"), null);
assert.equal(researchQuestionIsBoundedCitationLookup("What does BC 101.1 require for my project?"), false);
assert.equal(researchQuestionIsBoundedCitationLookup("What does BC 101.1 state about my project's compliance?"), false);
assert.equal(researchQuestionIsBoundedCitationLookup("According to BC 101.1, is this project compliant?"), false);
assert.equal(researchQuestionIsBoundedCitationLookup("What does BC 101.1 say compared with FC 101.2?"), false);
const governingCurrentExactEvidence = [{
  sourceID: "bc-101-1-a",
  origin: "permitext_discovered",
  sourceType: "enacted_text",
  authorityClass: "enacted",
  codePrefix: "BC",
  sectionNumber: "101.1",
  applicabilityStatus: "current-enacted-edition",
  evidencePriority: { evidenceRole: "governing", topicRouteRelationship: "exact_topic" },
  canonicalContextResolved: true,
  canonicalContextComplete: true,
  truncated: false
}];
assert.equal(researchEvidenceSupportsBoundedCitationFastPath(governingCurrentExactEvidence), true);
for (const unsafeEvidence of [
  [{ ...governingCurrentExactEvidence[0], applicabilityStatus: "historical" }],
  [{ ...governingCurrentExactEvidence[0], applicabilityStatus: "future-effective" }],
  [{ ...governingCurrentExactEvidence[0], evidencePriority: { evidenceRole: "contextual" } }],
  [{ ...governingCurrentExactEvidence[0], evidencePriority: { evidenceRole: "irrelevant" } }],
  [{ ...governingCurrentExactEvidence[0], canonicalContextComplete: false, truncated: true }]
]) {
  assert.equal(researchEvidenceSupportsBoundedCitationFastPath(unsafeEvidence), false);
}
const unmatchedBoundedEvidence = [{ sourceID: "bc-101-2", codePrefix: "BC", sectionNumber: "101.2" }];
assert.deepEqual(
  researchEvidenceForBoundedCitationLookup(
    "What does the current 2022 NYC Building Code Section 101.1 state?",
    unmatchedBoundedEvidence
  ),
  [],
  "A missing exact section must fail closed instead of substituting a nearby provision."
);

const pinnedDirectLookup = routeResearchAnswerModel({
  question: "What does Building Code Section 101.1 state?",
  evidence: Array.from({ length: 12 }, (_, index) => ({
    sourceID: `pinned-${index + 1}`,
    codePrefix: "BC",
    sectionNumber: `${101 + index}.1`
  })),
  boundedCitationLookup: false,
  environment
});
assert.equal(pinnedDirectLookup.tier, "accurate");
assert.ok(pinnedDirectLookup.reasons.includes("large_evidence_package"));

const boundedBroadRetrieval = routeResearchAnswerModel({
  question: "What does Building Code Section 101.2 say about scope?",
  evidence: Array.from({ length: 14 }, (_, index) => ({
    sectionID: `bc-101-2-${index}`,
    title: "Scope",
    text: index === 0 ? "This code applies to construction." : "Collateral retrieved text with an exception."
  })),
  requiredClaims: Array.from({ length: 6 }, (_, index) => ({ id: `claim-${index}` })),
  codeBasis: { searchedCorpora: [{ id: "building-code" }, { id: "mechanical-code" }] },
  webSupportRequested: true,
  environment
});
assert.equal(boundedBroadRetrieval.tier, "fast", "An exact enacted-section lookup remains Luna-first even when retrieval is conservatively broad.");

for (const candidate of [
  {
    question: "Which exception and table footnote controls this calculation?",
    evidence: [{ sectionID: "bc-table", title: "Table 1017.2", text: "Table 1017.2" }]
  },
  {
    question: "What does Building Code Section 1017.2 require for this table exception?",
    evidence: [{ sectionID: "bc-table", title: "Table 1017.2", text: "Table 1017.2" }]
  },
  {
    question: "What is required?",
    evidence: [{ sectionID: "zr-1", title: "Zoning", text: "District rule" }],
    codeBasis: { searchedCorpora: [{ id: "nyc-zoning-resolution", label: "NYC Zoning Resolution" }] }
  },
  {
    question: "What is required?",
    evidence: [{ sectionID: "visual", title: "Diagram", text: "See figure", visualSources: [{ id: "figure-1" }] }]
  }
]) {
  const routed = routeResearchAnswerModel({ ...candidate, environment });
  assert.equal(routed.tier, "accurate");
  assert.equal(routed.model, "gpt-5.6-terra");
}

assert.equal(researchEscalationModel(direct, environment), "gpt-5.6-terra");
assert.equal(
  researchModelRoutingConfiguration({ PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra" }).mode,
  "single",
  "Production must remain single-model until hybrid routing is explicitly enabled."
);

console.log("Permitext Research model-routing contract passed; paid model calls: no.");
