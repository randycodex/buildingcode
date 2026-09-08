import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchDecisionFactFixtures, decisionFactVerifierInput } from "../evals/research-decision-fact-fixtures.mjs";
import { researchDecisionFactFixturesV2, assessDecisionFactVerifierResult } from "../evals/research-decision-fact-fixtures-v2.mjs";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "./research-request-envelope-preflight.mjs";
import { beginResearchSpendReservation, reserveResearchProviderSpend, endResearchSpendReservation } from "../research-config.mjs";

process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
globalThis.fetch = async () => { throw new Error("Network forbidden in corrected diagnostic contract."); };
const fixtures = await researchDecisionFactFixturesV2();
const historical = await researchDecisionFactFixtures();
assert.equal(fixtures.length, 6);
assert.equal(historical[0].answer.supportedPoints[1].sourceIDs.length, 1, "Preserve the historical draft fixture; it did not include the delivered correction.");
assert.equal(fixtures[0].answer.supportedPoints[1].sourceIDs.length, 2);
assert.deepEqual(fixtures[1].answer, { ...fixtures[0].answer, missingFacts: [] });
const { buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
let initialReservationsUSD = 0;
for (const fixture of fixtures) {
  const { question, evidence, answer, options } = decisionFactVerifierInput(fixture);
  const body = { ...buildVerifierRequest(question, evidence, answer, "decision-fact-verifier", options), service_tier: "default" };
  assert.doesNotMatch(JSON.stringify(body), /expectedPass|expectedIssueTypes|expectedRepairApplied|expectedMissingFactIndices|"purpose"/);
  const lookup = JSON.parse(body.input.split("SUPPORTED-POINT BINDING LOOKUP — STRUCTURAL METADATA ONLY\n")[1].split("\n\n")[0]);
  assert.equal(lookup.length, answer.supportedPoints.length);
  for (const [index, point] of answer.supportedPoints.entries()) {
    assert.deepEqual(lookup[index].boundPassages.map((source) => source.sourceID), point.sourceIDs);
    for (const source of lookup[index].boundPassages) {
      assert.match(body.input, new RegExp(`SECTION_ID: ${source.sectionID}\\nSECTION: ${source.section.replaceAll(".", "\\.")}`));
    }
  }
  const synthetic = { pass: fixture.expectedPass, issues: fixture.expectedIssueTypes.map((type) => ({ type, detail: "Offline control" })),
    unnecessaryMissingFactIndices: fixture.expectedMissingFactIndices || [] };
  assert.equal(assessDecisionFactVerifierResult(fixture, synthetic).expectationMatched, true);
  beginResearchSpendReservation({ id: fixture.id }, researchRequestEnvelopeEnvironment);
  try { initialReservationsUSD += reserveResearchProviderSpend(body, researchRequestEnvelopeEnvironment).maximumRequestUSD; }
  finally { endResearchSpendReservation(); }
}
// V2 is consumed. Preserve its committed preflight cost rather than asserting
// that every future runtime still fits that historical package's cap.
const historicalPreflight = JSON.parse(await readFile(new URL("../evals/results/research-decision-fact-verifier-v2-preflight-2026-09-08.json", import.meta.url)));
assert(historicalPreflight.entries.reduce((sum, entry) => sum + entry.maximumRequestUSD, 0) < historicalPreflight.maximumCumulativeSpendUSD);
const mixedIssues = { pass: false, issues: [{ type: "unnecessary_qualification", detail: "Optional fact" },
  { type: "incorrect_citation", detail: "Separate citation defect" }], unnecessaryMissingFactIndices: [0, 1] };
assert.deepEqual(assessDecisionFactVerifierResult(fixtures[0], mixedIssues), {
  expectationMatched: false, actualIssueTypes: ["incorrect_citation", "unnecessary_qualification"],
  actualMissingFactIndices: [0, 1], repairApplied: false
}, "A matched fact flag cannot hide another defect that prevents the bounded correction.");
const broken = fixtures.find((fixture) => fixture.id === "PC-04-missing-point-binding");
assert.equal(broken.answer.supportedPoints[1].sourceIDs.length, 1);
assert.deepEqual(broken.answer.citations, fixtures[1].answer.citations, "The negative control removes only the point binding, not the globally available citation.");
const review = fixtures.at(-1);
assert.doesNotMatch(JSON.stringify(review.answer.supportedPoints), /standpipes/);
assert(review.answer.missingFacts.length > 0);
console.log(`Corrected diagnostic contracts passed: exact delivered answer, paired fact-only change, broken-binding control, strict issue/repair grading. Current six-request reservation sum $${initialReservationsUSD.toFixed(6)}; historical V2 cap checked against its retained preflight.`);
