import assert from "node:assert/strict";
import { researchDecisionFactInstruction, researchAnswerPresentationContract } from "../research-answer-presentation.mjs";
import { researchDecisionFactFixtures, decisionFactVerifierInput } from "../evals/research-decision-fact-fixtures.mjs";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "./research-request-envelope-preflight.mjs";
import { beginResearchSpendReservation, reserveResearchProviderSpend, endResearchSpendReservation } from "../research-config.mjs";

process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
globalThis.fetch = async () => { throw new Error("Network forbidden in decision-fact contract."); };
const fixtures = await researchDecisionFactFixtures();
assert.equal(fixtures.length, 7);
// This retained diagnostic's $0.24 authorization covers the older low-effort
// verifier. Production role defaults are checked by the Fast HTTP contract.
const environment = { ...researchRequestEnvelopeEnvironment, PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.24",
  PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "low" };
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders(environment);
let maximumInitialReservationsUSD = 0;
const initialRequests = [];
for (const fixture of fixtures) {
  const projected = decisionFactVerifierInput({ ...fixture, expectedPass: "EXPECTED_OUTCOME_LEAK", purpose: "REVIEWER_PURPOSE_LEAK" });
  const { question, evidence, answer, options } = projected;
  const body = { ...buildVerifierRequest(question, evidence, answer, "decision-fact-verifier", options), service_tier: "default" };
  assert.doesNotMatch(JSON.stringify(body), /EXPECTED_OUTCOME_LEAK|REVIEWER_PURPOSE_LEAK|"expectedPass"|"expectedIssue"|"expectedMissingFactIndices"/);
  assert.equal(body.model, "gpt-5.6-luna");
  assert.equal(body.text.format.name, "permitext_research_verification");
  assert.equal(body.reasoning.effort, "low");
  assert.equal(body.max_output_tokens, 4000, "Retain the authorized verifier allowance for this diagnostic.");
  assert.equal(body.tools, undefined);
  assert.equal(body.instructions.split(researchDecisionFactInstruction).length, 2, "Use the shared policy once, outside the numeric-comparison paragraph.");
  assert(body.instructions.indexOf(researchDecisionFactInstruction) < body.instructions.indexOf("For every numeric comparison"));
  assert.match(body.instructions, /Fail with unnecessary_qualification if missingFacts or followUpQuestions/);
  assert.match(body.instructions, /even when the opening gives the correct direct answer/);
  const generated = buildAnswerRequest(question, evidence, "decision-fact-verifier", { ...options, responseStyle: "conversational" });
  assert(generated.instructions.includes(researchDecisionFactInstruction));
  assert(researchAnswerPresentationContract({ question, evidence }).universalRules.includes(researchDecisionFactInstruction));
  initialRequests.push(body);
  beginResearchSpendReservation({ id: fixture.id }, environment);
  try { maximumInitialReservationsUSD += reserveResearchProviderSpend(body, environment).maximumRequestUSD; }
  finally { endResearchSpendReservation(); }
}
for (const id of ["PC-04", "PC-10"]) {
  const original = fixtures.find((item) => item.id === `${id}-recorded`);
  const corrected = fixtures.find((item) => item.id === `${id}-decision-facts-only`);
  assert(original.answer.missingFacts.length > 0);
  assert.equal(corrected.answer.missingFacts.length, 0);
  const { missingFacts: ignoredOriginal, ...originalOther } = original.answer;
  const { missingFacts: ignoredCorrected, ...correctedOther } = corrected.answer;
  assert.deepEqual(correctedOther, originalOther, "The paired correction must preserve every other field, including narrative, rules and citations.");
}
assert.match(fixtures.find((item) => item.id === "PC-04-unresolved-applicability").answer.missingFacts.join(" "), /public coin-operated.*central washing facility/);
assert.deepEqual(fixtures.find((item) => item.id === "PC-04-requested-design").answer.missingFacts, fixtures[0].answer.missingFacts,
  "Keep the same design unknowns in the control where the user actually requests a design.");
assert.deepEqual(fixtures.find((item) => item.id === "PC-04-mixed-material-entry").expectedMissingFactIndices, [],
  "A mixed material/optional entry cannot be removed as a whole.");
// Prompt growth can exhaust this historical diagnostic authorization. Prove
// cumulative admission still refuses the excess; do not raise the cap to fit.
beginResearchSpendReservation({id:"historical-diagnostic-cap"},environment);
let admittedUSD=0;
try { for (const body of initialRequests) {
 try { const reservation=reserveResearchProviderSpend(body,environment); admittedUSD+=reservation.maximumRequestUSD; }
 catch(error) { assert.equal(error.code,"RESEARCH_SPEND_CAP"); break; }
} assert(admittedUSD<=.24); if(maximumInitialReservationsUSD>.24) assert(admittedUSD<maximumInitialReservationsUSD);
} finally { endResearchSpendReservation(); }
console.log(JSON.stringify({ contract: "decision-facts", fixtures: fixtures.length, maximumInitialReservationsUSD: Number(maximumInitialReservationsUSD.toFixed(6)), providerCalls: 0,
  limitation: "This validates policy wiring, input preservation, contrasting fixtures and request bounds. It does not establish the model's semantic verdicts." }));
