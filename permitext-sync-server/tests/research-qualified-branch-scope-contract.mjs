import assert from "node:assert/strict";
import { researchQualifiedBranchScopeInstruction } from "../research-claim-scope.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

globalThis.fetch = () => { throw new Error("Qualified-branch contracts forbid provider calls."); };
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
// These fixtures test the actual request boundary, not model correctness.
// Keep the complete exception, dated identity and correction visible to both
// stages; deployment acceptance must separately grade generated answers.
const fixtures = [
  {
    id: "exception-local-formula",
    question: "This synthetic chamber is indoors. What airflow and free-opening area are required?",
    text: "Indoor chambers require mechanical airflow Q=100G. Exception: An outdoor detached chamber may use natural openings of area F=2G instead.",
    proposal: "The indoor chamber requires Q=100G airflow and F=2G free-opening area."
  },
  {
    id: "consolidated-edition-identity",
    question: "Under the 2040 synthetic code, which plan is required?",
    text: "The 2040 synthetic code, current consolidated text: category A requires an action plan. A transition rule applies only to permits issued before July 1, 2041.",
    proposal: "The supplied 2040 code cannot answer because the original 2040 unamended snapshot was not supplied."
  },
  {
    id: "removed-controlling-component",
    question: "Remove the heater from the network. What is the remaining load?",
    text: "The network demand is the sum of connected loads. The sizing length is the longest remaining delivery path.",
    previousMessages: [{ role: "user", question: "The heater is 40 units at 90 feet; the other equipment is 10 units and 20 units, with branch lengths not yet measured." }],
    proposal: "The remaining load is 30 units and the controlling length is still 90 feet."
  }
];
let envelopes = 0;
for (const fixture of fixtures) {
  for (const zoning of [false, true]) {
    const source = { sectionID: fixture.id, sourceID: `${fixture.id}-passage`, codePrefix: zoning ? "ZR" : "BC",
      sectionNumber: "999", codeEdition: "2040 synthetic code — current consolidated text", title: "Fabricated source boundary fixture", text: fixture.text };
    const options = { responseStyle: "conversational", messages: fixture.previousMessages || [],
      ...(zoning ? { zoningPlan: { questionSignals: { streetscapeExplanation: true } } } : {}) };
    for (const request of [
      buildAnswerRequest(fixture.question, [source], "offline-qualified-branch", options),
      buildAnswerRequest(fixture.question, [source], "offline-qualified-branch", { ...options,
        previousInterpretation: { answerText: fixture.proposal }, revisionFeedback: [{ type: "misstated_provision", detail: "Check each claim against its own source branch, edition and retained premises." }] }),
      buildVerifierRequest(fixture.question, [source], { answerText: fixture.proposal }, "offline-qualified-branch", options)
    ]) {
      assert(request.instructions.includes(researchQualifiedBranchScopeInstruction), `${fixture.id}: shared qualification missing`);
      assert(request.input.includes(fixture.question), `${fixture.id}: current question changed`);
      assert(request.input.includes(fixture.text), `${fixture.id}: complete qualification source changed`);
      assert.equal(request.text.format.strict, true);
      envelopes += 1;
    }
  }
}
console.log(JSON.stringify({ contract: "qualified-branch-request-boundary", envelopes, providerCalls: 0,
  generatedAnswerAcceptance: false }));
