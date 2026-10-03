import assert from "node:assert/strict";
import { researchModelConfiguration, researchAnswerConfigurationForRevision } from "../research-config.mjs";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "./research-request-envelope-preflight.mjs";

let providerCalls = 0;
globalThis.fetch = () => { providerCalls += 1; throw new Error("Revision-effort contracts forbid network/provider calls."); };
const feedback = [{ type: "misstated_provision", detail: "Keep the exemption's building recipient; do not substitute one room." }];
const environment = { ...researchRequestEnvelopeEnvironment, PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium" };
const configuration = Object.freeze(researchModelConfiguration(environment));
const revised = researchAnswerConfigurationForRevision(configuration, { revisionFeedback: feedback });
assert.deepEqual(revised, { ...configuration, reasoningEffort: "medium" });
assert.equal(configuration.reasoningEffort, "low", "Do not mutate configured draft effort.");
for (const options of [{}, { revisionFeedback: [] }, { revisionFeedback: null }, { revisionFeedback: "not a feedback array" }, { structuredResponseRetry: true }]) {
  assert.strictEqual(researchAnswerConfigurationForRevision(configuration, options), configuration, "Only a verifier-feedback revision escalates.");
}
for (const effort of ["medium", "high", "max"]) {
  const preset = Object.freeze({ ...configuration, reasoningEffort: effort });
  assert.strictEqual(researchAnswerConfigurationForRevision(preset, { revisionFeedback: feedback }), preset, "Preserve stronger configured effort.");
}
for (const model of ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-6-sol", "gpt-6.1-sol"]) {
  const preset = Object.freeze({ ...configuration, model });
  assert.strictEqual(researchAnswerConfigurationForRevision(preset, { revisionFeedback: feedback }), preset, "Other model families retain their configuration.");
}
assert.equal(researchAnswerConfigurationForRevision({ ...configuration, model: "gpt-6-luna-2026-09-30" }, { revisionFeedback: feedback }).reasoningEffort, "medium");

const source = { sectionID: "synthetic-exemption", sourceID: "synthetic-exemption-passage", codePrefix: "BC", sectionNumber: "999",
  title: "Synthetic recipient condition", text: "The test applies to each room. Exception: detached workshop buildings used exclusively for fabrication are excluded; rooms in mixed-use buildings are not excluded by this exception." };
const question = "Does a workshop room in our mixed-use building qualify for that exception?";
const previous = { answerText: "Synthetic incorrect recipient proposal.", supportedPoints: [{ explanation: "Synthetic incorrect recipient proposal.", sectionID: source.sectionID, sourceIDs: [source.sourceID] }] };
let requestCount = 0;
for (const effort of ["low", "medium", "high"]) {
  const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders({ ...environment, PERMITEXT_RESEARCH_REASONING_EFFORT: effort });
  for (const specialized of [false, true]) {
    const options = { responseStyle: "conversational", ...(specialized ? { zoningPlan: { questionSignals: { streetscapeExplanation: true } } } : {}) };
    const draft = buildAnswerRequest(question, [source], "offline-revision", options);
    const revision = buildAnswerRequest(question, [source], "offline-revision", { ...options, previousInterpretation: previous, revisionFeedback: feedback });
    const parseRetry = buildAnswerRequest(question, [source], "offline-revision", { ...options, structuredResponseRetry: true });
    const review = buildVerifierRequest(question, [source], previous, "offline-revision", options);
    assert.equal(draft.reasoning.effort, effort);
    assert.equal(revision.reasoning.effort, effort === "low" ? "medium" : effort);
    assert.equal(parseRetry.reasoning.effort, effort, "A parse-only retry does not raise effort.");
    assert.equal(review.reasoning.effort, "medium", "Reviewer policy stays unchanged.");
    assert.equal(revision.model, draft.model);
    assert.equal(revision.service_tier, draft.service_tier);
    assert.equal(revision.max_output_tokens, draft.max_output_tokens, "No increase in the reserved output allowance.");
    assert.deepEqual(revision.text.format, draft.text.format, "Exact-source schema and strict bindings remain unchanged.");
    for (const request of [draft, revision, parseRetry, review]) {
      assert(request.input.includes(source.text));
      assert(request.input.includes(source.sourceID));
      assert(request.input.includes(source.sectionID));
      assert.equal(request.text.format.strict, true);
      assert.equal(request.store, false);
      requestCount += 1;
    }
  }
}
const { buildAnswerRequest } = await buildResearchRequestEnvelopeBuilders(environment);
const override = buildAnswerRequest(question, [source], "offline-revision", { model: "gpt-5.6-terra", revisionFeedback: feedback });
assert.equal(override.model, "gpt-5.6-terra");
assert.equal(override.reasoning.effort, "low", "Per-request non-Luna override does not escalate.");
assert.equal(providerCalls, 0);
console.log(`Revision effort contract passed: ${requestCount} exact-source draft/revision/parse-retry/reviewer envelopes; Luna low→medium only for existing feedback repair, stronger/non-Luna settings preserved; provider calls ${providerCalls}.`);
