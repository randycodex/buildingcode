import assert from "node:assert/strict";
import {
  applyZoningResearchRepairPatch,
  evaluateZoningEvidenceReadiness,
  evaluateZoningDeterministicControls,
  planZoningResearchQuestion,
  selectZoningResearchEvidence,
  zoningResearchDeterministicContext,
  zoningResearchDispositions,
  zoningResearchEvidenceLimits,
  zoningResearchPaths,
  zoningResearchPlanCostProjection,
  zoningResearchRepairPacket
} from "../research-zoning-planner.mjs";
import { routeResearchAnswerModel } from "../research-model-routing.mjs";
import { evaluateZoningResearchSafety } from "../research-zoning-safety.mjs";

const questionsByPath = new Map([
  [zoningResearchPaths.directRule, "What prerequisite does ZR Section 101-75 impose before demolition?"],
  [zoningResearchPaths.definitionCrossReference, "Under the selected definition, what is a zoning lot?"],
  [zoningResearchPaths.structuredTableSymbol, "Using the selected table, explain the table symbols."],
  [zoningResearchPaths.effectiveDateHistory, "What transition applies on December 5, 2024?"],
  [zoningResearchPaths.propertyMapApplicability, "Can this specific property be placed in Appendix J when its address and official map are not provided?"],
  [zoningResearchPaths.calculationScenario, "Does 42,000 square feet of residential floor area on a 10,000-square-foot zoning lot fit the FAR maximum?"]
]);

for (const [path, question] of questionsByPath) {
  const plan = planZoningResearchQuestion({ question });
  assert.equal(plan.path, path);
  assert.ok(plan.planHash);
  assert.ok(plan.evidenceLimits.maximumCharacters < 24_000);
  assert.equal(plan.callPolicy.allowFullAnswerRewrite, false);
  assert.ok(plan.callPolicy.maximumProviderCalls <= 3);
  assert.deepEqual(plan, planZoningResearchQuestion({ question }), "Planner output must be deterministic.");
}

const missingMap = planZoningResearchQuestion({
  question: "Can this specific property be placed in Appendix J when its address and official map are not provided?"
});
assert.equal(missingMap.disposition, zoningResearchDispositions.deterministicBoundary);
assert.equal(missingMap.callPolicy.maximumProviderCalls, 0);
assert.deepEqual(missingMap.missingFacts.map((item) => item.id), [
  "property_identifier",
  "official_mapped_status"
]);

const generalDefinition = planZoningResearchQuestion({
  question: "Under the selected definition, what is a zoning lot?"
});
assert.equal(generalDefinition.disposition, zoningResearchDispositions.ready);
assert.equal(generalDefinition.missingFacts.length, 0, "Collateral map words must not create a property prerequisite.");

const selected = selectZoningResearchEvidence({
  question: "What does ZR Section 23-22 require?",
  plan: planZoningResearchQuestion({ question: "What does ZR Section 23-22 require?" }),
  evidence: [
    {
      sourceID: "pin",
      origin: "user_pinned",
      codePrefix: "ZR",
      sectionNumber: "23-22",
      text: "Pinned enacted rule.",
      evidencePriority: { evidenceRole: "governing", topicRouteRelationship: "exact_topic" }
    },
    {
      sourceID: "collateral",
      origin: "permitext_discovered",
      codePrefix: "ZR",
      sectionNumber: "99-99",
      text: "Collateral material.",
      evidencePriority: { evidenceRole: "contextual", topicRouteRelationship: "collateral" }
    }
  ]
});
assert.equal(selected.pass, true);
assert.deepEqual(selected.sources.map((source) => source.sourceID), ["pin"]);
assert.deepEqual(selected.rejected, [{ sourceID: "collateral", reason: "non_material_or_collateral" }]);

const calculationPlan = planZoningResearchQuestion({
  question: questionsByPath.get(zoningResearchPaths.calculationScenario)
});
const calculationContext = zoningResearchDeterministicContext({
  question: questionsByPath.get(zoningResearchPaths.calculationScenario),
  evidence: [],
  plan: calculationPlan
});
assert.deepEqual(calculationContext.arithmetic.calculations.map((item) => item.result), [4.2]);
assert.equal(evaluateZoningDeterministicControls({
  plan: calculationPlan,
  deterministicContext: calculationContext,
  answer: { answerText: "It fits." }
}).pass, false);
assert.equal(evaluateZoningDeterministicControls({
  plan: calculationPlan,
  deterministicContext: calculationContext,
  answer: { answerText: "42,000 / 10,000 = 4.2 FAR." }
}).pass, true);

const effectivePlan = planZoningResearchQuestion({
  question: questionsByPath.get(zoningResearchPaths.effectiveDateHistory)
});
const effectiveContext = zoningResearchDeterministicContext({
  question: questionsByPath.get(zoningResearchPaths.effectiveDateHistory),
  evidence: [],
  plan: effectivePlan
});
assert.equal(evaluateZoningDeterministicControls({
  plan: effectivePlan,
  deterministicContext: effectiveContext,
  answer: { answerText: "The transition applies." }
}).pass, false);
assert.equal(evaluateZoningDeterministicControls({
  plan: effectivePlan,
  deterministicContext: effectiveContext,
  answer: { answerText: "The December 5, 2024 transition applies." }
}).pass, true);

const tablePlan = planZoningResearchQuestion({
  question: questionsByPath.get(zoningResearchPaths.structuredTableSymbol)
});
const tableContext = zoningResearchDeterministicContext({
  question: questionsByPath.get(zoningResearchPaths.structuredTableSymbol),
  evidence: [{
    sourceID: "table-source",
    sectionID: "table-section",
    richSourceContentHash: "table-hash",
    richSourceGrids: [{ rows: [{ cells: [{ text: "● = Permitted" }] }] }]
  }],
  plan: tablePlan
});
assert.equal(evaluateZoningDeterministicControls({
  plan: tablePlan,
  deterministicContext: tableContext,
  answer: { answerText: "● means permitted.", citations: [] }
}).pass, false);
assert.equal(evaluateZoningDeterministicControls({
  plan: tablePlan,
  deterministicContext: tableContext,
  answer: { answerText: "● means permitted.", citations: [{ sourceIDs: ["table-source"] }] }
}).pass, true);

assert.equal(evaluateZoningDeterministicControls({
  plan: missingMap,
  deterministicContext: zoningResearchDeterministicContext({
    question: questionsByPath.get(zoningResearchPaths.propertyMapApplicability),
    evidence: [],
    plan: missingMap
  }),
  providerRequestCount: 1
}).pass, false);

const hybridEnvironment = {
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra"
};
const zoningRoute = routeResearchAnswerModel({
  question: "Which table controls this calculation?",
  evidence: [{ sourceID: "zr", text: "Table", visualSources: [{ id: "visual" }] }],
  codeBasis: { searchedCorpora: [{ id: "nyc-zoning-resolution" }] },
  zoningPlan: tablePlan,
  environment: hybridEnvironment
});
assert.equal(zoningRoute.model, "gpt-5.6-terra");
assert.equal(zoningRoute.tier, "accurate");
assert.match(zoningRoute.reasons[0], /zoning_compiler_terra_first/);

const directPlan = planZoningResearchQuestion({ question: "What does this Zoning definition say?" });
const generalSafety = evaluateZoningResearchSafety({
  question: "What does this Zoning definition say?",
  questionPlan: directPlan,
  evidence: [{
    sourceID: "definition",
    codePrefix: "ZR",
    text: "This general definition also mentions a special district map."
  }],
  answer: {
    answerText: "The selected definition states the supplied rule.",
    conclusion: "The selected definition states the supplied rule.",
    citations: [{ sourceIDs: ["definition"] }]
  }
});
assert.equal(generalSafety.categories.includes("missing-location"), false);

const projection = zoningResearchPlanCostProjection({
  plan: tablePlan,
  evidenceCharacters: zoningResearchEvidenceLimits(tablePlan).maximumCharacters
});
assert.equal(projection.production.requestCount, 2);
assert.equal(projection.production.adverseRequestCount, 3);
assert.equal(projection.judge.requestCount, 0);
assert.ok(projection.production.adverseUSD >= projection.production.nominalUSD);
assert.ok(projection.production.adverseUSD * 100 < 6);

const missingSpecialParkingRule = evaluateZoningEvidenceReadiness({
  question: "The broker says this R6 site is close to a subway. What parking applies?",
  plan: planZoningResearchQuestion({
    question: "The broker says this R6 site is close to a subway. What parking applies?"
  }),
  evidence: [{
    sourceID: "definition-only",
    sectionID: "12-10",
    sectionNumber: "12-10",
    text: "Greater Transit Zone General Definition: the boundary includes special parking areas."
  }]
});
assert.equal(missingSpecialParkingRule.pass, false);
assert.equal(missingSpecialParkingRule.issues[0].code, "CONTROLLING_SPECIAL_PARKING_RULE_MISSING");

const repairPacket = zoningResearchRepairPacket({
  question: "What does the selected rule require?",
  issues: [{ type: "missed_material_conclusion", detail: "Add the 30-foot requirement from source-a." }],
  evidence: [
    {
      sourceID: "source-a",
      sectionID: "section-a",
      sectionNumber: "23-343",
      text: "A minimum depth of 30 feet shall be provided.",
      evidencePriority: { evidenceRole: "governing" }
    },
    {
      sourceID: "source-b",
      sectionID: "section-b",
      text: "Unrelated collateral material.",
      evidencePriority: { evidenceRole: "contextual", topicRouteRelationship: "collateral" }
    }
  ],
  answer: { citations: [{ sourceIDs: ["source-a"] }] }
});
assert.equal(repairPacket.sources[0].sourceID, "source-a");
assert.ok(repairPacket.usage.characterCount <= repairPacket.usage.maximumCharacters);

const patched = applyZoningResearchRepairPatch({
  answerText: "The rule may apply.",
  conclusion: "The rule may apply.",
  explanation: "",
  supportedPoints: [{ heading: "Old", explanation: "Old.", sectionID: "section-a", sourceIDs: ["source-a"] }],
  assumptions: [],
  missingFacts: ["Old missing fact"],
  followUpQuestions: [],
  evidenceLimitations: ["Original limitation."],
  additionalEvidenceNeeded: [],
  supportingSourceUses: [],
  supportingSources: [],
  citations: [{ sectionID: "section-a", sourceIDs: ["source-a"], relevance: "Old." }]
}, {
  answerText: "The selected rule requires 30 feet.",
  supportedPointUpserts: [{
    targetIndex: 0,
    value: { heading: "Required depth", explanation: "The rule requires 30 feet.", sectionID: "section-a", sourceIDs: ["source-a"] }
  }],
  supportedPointRemovals: [],
  citationUpserts: [],
  citationRemovals: [],
  missingFactsAdd: [],
  missingFactsRemove: ["Old missing fact"],
  evidenceLimitationsAdd: [],
  evidenceLimitationsRemove: [],
  additionalEvidenceNeededAdd: [],
  additionalEvidenceNeededRemove: []
});
assert.equal(patched.supportedPoints[0].heading, "Required depth");
assert.deepEqual(patched.missingFacts, []);
assert.equal(patched.answerText, "The selected rule requires 30 feet.");

console.log("Permitext Zoning Architecture V2 compiler and bounded-repair contract passed; paid model calls: no.");
