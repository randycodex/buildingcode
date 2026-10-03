import assert from "node:assert/strict";
import { researchVerificationConfigurationForEvidence, routeResearchAnswerModel } from "../research-model-routing.mjs";
import { researchModelConfiguration, beginResearchSpendReservation, endResearchSpendReservation, reserveResearchProviderSpend, settleResearchProviderSpend } from "../research-config.mjs";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "./research-request-envelope-preflight.mjs";

const environment = { ...researchRequestEnvelopeEnvironment,
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_REASONING_EFFORT: "low",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-6.1-sol", PERMITEXT_RESEARCH_COMPLEX_VERIFICATION: "1",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.10",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "10", PERMITEXT_RESEARCH_PRICING_VERSION: "official-model-docs-2026-10-03",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.10", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.01",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "0.50", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "official-model-docs-2026-10-03",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "2", PERMITEXT_RESEARCH_SERVICE_TIER: "priority" };
const configuration = Object.freeze(researchModelConfiguration(environment));
const authority = { codePrefix: "BC", corpusID: "synthetic-2022", codeVersion: "synthetic-v1", codeEdition: "2022", jurisdiction: "NYC" };
const definition = { ...authority, sourceID: "definition", sectionID: "definition-section", sectionNumber: "202", text: "Synthetic whole-building recipient definition.", targetedDefinition: { completeDefinitionEntries: true } };
const framework = id => ({ ...authority, sourceID: id, sectionID: id+"-section", sectionNumber: id, title: "Synthetic applicability", text: "Synthetic complete alternative framework.", canonicalContextComplete: true, evidencePriority: { applicabilityCandidate: true } });
const evidence = [definition, framework("111"), framework("222")];
const reviewFirst = { ...environment, PERMITEXT_RESEARCH_ROUTING_POLICY: "review_first" };
assert.equal(routeResearchAnswerModel({ question: "Calculate the percentage from this table and explain exceptions.", evidence, environment: reviewFirst }).model, "gpt-6-luna");
assert.equal(routeResearchAnswerModel({ question: "Calculate the percentage from this table and explain exceptions.", evidence: [{ ...evidence[1], applicabilityStatus: "historical" }], environment: reviewFirst }).model, "gpt-6.1-sol");
assert.equal(researchVerificationConfigurationForEvidence(configuration, evidence, {}, environment).model, "gpt-6.1-sol");
assert.equal(researchVerificationConfigurationForEvidence(configuration, evidence, {}, environment).verificationReasoningEffort, "low");
for (const packet of [[], evidence.slice(0,2), [definition, framework("111"), { ...framework("222"), codeEdition: "2014" }], [{ ...definition, truncated: true }, ...evidence.slice(1)], [definition, framework("111"), { ...framework("111"), sourceID: "duplicate" }]]) {
  assert.strictEqual(researchVerificationConfigurationForEvidence(configuration, packet, {}, environment), configuration);
}
assert.strictEqual(researchVerificationConfigurationForEvidence(configuration, evidence, {}, { ...environment, PERMITEXT_RESEARCH_COMPLEX_VERIFICATION: "0" }), configuration);
assert.strictEqual(researchVerificationConfigurationForEvidence(configuration, evidence, {}, { ...environment, PERMITEXT_RESEARCH_ROUTING_MODE: "single" }), configuration);
const stronger = { ...configuration, model: "gpt-6.1-sol", verificationReasoningEffort: "medium" };
assert.strictEqual(researchVerificationConfigurationForEvidence(stronger, evidence, {}, environment), stronger);
assert.equal(researchVerificationConfigurationForEvidence(configuration, [], { priorVerificationAttempts: [{ issues: [{ type: "misstated_provision" }] }] }, environment).model, "gpt-6.1-sol");
assert.strictEqual(researchVerificationConfigurationForEvidence(configuration, [], { priorVerificationAttempts: [{ issues: [{ type: "incorrect_citation" }] }] }, environment), configuration);

const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders(environment);
const question = "Which framework applies to this synthetic building?";
const interpretation = { answerText: "Synthetic answer.", supportedPoints: [], citations: [] };
const draft = buildAnswerRequest(question, evidence, "offline-complex", { responseStyle: "conversational", model: "gpt-6-luna" });
const review = buildVerifierRequest(question, evidence, interpretation, "offline-complex", { model: "gpt-6-luna" });
const ordinary = buildVerifierRequest(question, [evidence[1]], interpretation, "offline-complex", { model: "gpt-6-luna" });
assert.equal(draft.model, "gpt-6-luna"); assert.equal(draft.reasoning.effort, "low");
assert.equal(review.model, "gpt-6.1-sol"); assert.equal(review.reasoning.effort, "low");
assert.equal(review.max_output_tokens, 4000); assert.equal(review.store, false);
assert.equal(ordinary.model, "gpt-6-luna"); assert.equal(ordinary.reasoning.effort, "medium");
for (const source of evidence) assert(review.input.includes(source.text) && review.input.includes(source.sourceID));
assert.equal(review.text.format.strict, true);
beginResearchSpendReservation({ id: "offline-priced-review" }, environment);
try {
  const reservation = reserveResearchProviderSpend(review, environment);
  assert.equal(reservation.pricingCeiling.inputRate, 5, "Priority2x and proven short-context cache-write1.25x use SOL rates, never Luna rates.");
  assert.equal(reservation.pricingCeiling.outputRate, 20);
  const settled = settleResearchProviderSpend(reservation, { model: "gpt-6.1-sol", service_tier: "priority", usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 0 } } }, environment);
  assert.equal(settled.actualUSD, 0.006);
} finally { endResearchSpendReservation(); }
const longEnvironment = { ...environment, PERMITEXT_RESEARCH_MAX_REQUEST_USD: "5", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5" };
beginResearchSpendReservation({ id: "offline-long-context-review" }, longEnvironment);
try {
  const held = reserveResearchProviderSpend({ ...review, input: 'x'.repeat(273_000) }, longEnvironment);
  assert.equal(held.pricingCeiling.inputRate, 10); assert.equal(held.pricingCeiling.outputRate, 30);
  const cached = settleResearchProviderSpend(held, { model: "gpt-6.1-sol", service_tier: "priority", usage: { input_tokens: 273_000, output_tokens: 100, input_tokens_details: { cached_tokens: 1000, cache_write_tokens: 1000 } } }, environment);
  assert(cached.settled && cached.actualUSD > 2, "Long-context/cache-write SOL usage is priced, never mistaken for Luna or unknown zero spend.");
} finally { endResearchSpendReservation(); }
console.log("Complex verification passed: actual cheap draft/ordinary reviewer envelopes, selective stronger review, complete edition-matched negative cases and correctly priced conservative spend reservation. No providers.");
