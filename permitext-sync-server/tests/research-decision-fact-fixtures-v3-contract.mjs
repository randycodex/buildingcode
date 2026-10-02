import assert from "node:assert/strict";
import { researchDecisionFactFixturesV2 } from "../evals/research-decision-fact-fixtures-v2.mjs";
import { researchDecisionFactFixturesV3, assessDecisionFactVerifierResultV3 } from "../evals/research-decision-fact-fixtures-v3.mjs";
import { decisionFactVerifierInput } from "../evals/research-decision-fact-fixtures.mjs";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "./research-request-envelope-preflight.mjs";
import { beginResearchSpendReservation, reserveResearchProviderSpend, endResearchSpendReservation } from "../research-config.mjs";

process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
globalThis.fetch = async () => { throw new Error("Network forbidden in mandatory-rule application contract."); };
const fixtures = await researchDecisionFactFixturesV3();
assert.equal(fixtures.length, 4);
const { buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const previous = await researchDecisionFactFixturesV2();
const bodyFor = (fixture) => buildVerifierRequest(fixture.question, fixture.evidence, fixture.answer, "decision-fact-verifier", fixture.options);
for (let index = 0; index < 3; index++) {
  assert.deepEqual(fixtures[index].answer, previous[index].answer);
  assert.deepEqual(bodyFor(fixtures[index]), bodyFor(previous[index]),
    "Retest identical provider-visible inputs; ephemeral retrieval timestamps outside the request may differ.");
}
let initialReservationsUSD = 0;
const initialRequests=[];
for (const fixture of fixtures) {
  const { question, evidence, answer, options } = decisionFactVerifierInput(fixture);
  const body = { ...buildVerifierRequest(question, evidence, answer, "decision-fact-verifier", options), service_tier: "default" };
  assert.doesNotMatch(JSON.stringify(body), /expectedPass|acceptableSubstantiveIssueTypes|expectedIssueTypes|expectedRepairApplied|"purpose"/);
  assert.match(body.instructions, /Accept a conclusion strictly deduced from the bound rule and those facts/);
  assert.match(body.instructions, /Reject deductions that depend on an unstated factual premise, classification, equivalence, exception or external legal rule/);
  assert.match(body.instructions, /Fail with incorrect_citation if a claim lacks support in that point's bound passages/);
  initialRequests.push(body);
  beginResearchSpendReservation({ id: fixture.id }, researchRequestEnvelopeEnvironment);
  try { initialReservationsUSD += reserveResearchProviderSpend(body, researchRequestEnvelopeEnvironment).maximumRequestUSD; }
  finally { endResearchSpendReservation(); }
}
const diagnosticEnvironment={...researchRequestEnvelopeEnvironment,PERMITEXT_RESEARCH_MAX_REQUEST_USD:"0.15"};
beginResearchSpendReservation({id:"historical-v3-cap"},diagnosticEnvironment);
let admittedUSD=0;
try { for(const body of initialRequests) {
 try { admittedUSD+=reserveResearchProviderSpend(body,diagnosticEnvironment).maximumRequestUSD; }
 catch(error) { assert.equal(error.code,"RESEARCH_SPEND_CAP"); break; }
} assert(admittedUSD<=.15); if(initialReservationsUSD>.15) assert(admittedUSD<initialReservationsUSD);
} finally { endResearchSpendReservation(); }
const inventedException = fixtures.at(-1);
assert.deepEqual(inventedException.answer.citations, fixtures[1].answer.citations, "Keep source bindings unchanged while making the claimed legal exception false.");
for (const type of inventedException.acceptableSubstantiveIssueTypes) {
  assert(assessDecisionFactVerifierResultV3(inventedException, { pass: false, issues: [{ type }], unnecessaryMissingFactIndices: [] }).expectationMatched);
}
for (const verification of [{ pass: true, issues: [] }, { pass: false, issues: [{ type: "unnecessary_qualification" }] },
  { pass: false, issues: [{ type: "unsupported_requirement" }, { type: "unnecessary_qualification" }] }]) {
  assert.equal(assessDecisionFactVerifierResultV3(inventedException, verification).expectationMatched, false);
}
console.log(`Mandatory-rule application controls passed: unchanged delivered pair, incorrect point binding and invented-exception rejection; four initial reservations $${initialReservationsUSD.toFixed(6)}.`);
