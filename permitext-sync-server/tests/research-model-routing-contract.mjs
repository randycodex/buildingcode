import assert from "node:assert/strict";
import {
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
