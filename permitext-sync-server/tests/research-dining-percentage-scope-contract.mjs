import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateResearchAnswerQuality, applyResearchDeterministicAnswerRepairs } from "../research-answer-quality.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in retained percentage regression."); };
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json", import.meta.url)));
const failed = retained.results.find((item) => item.id === "MC-09");
assert.equal(failed.status, "failed");
assert(failed.operations.some((operation) => operation.verificationIssueTypes.includes("incorrect_citation")));
const evidence = (await assembledResearchEvidenceForTurn({ question: failed.question, messages: [], pinnedEvidence: [], projectFacts: [] })).sources;
const drafts = retained.providerCalls.filter((call) => call.caseID === failed.id).map((call) =>
  JSON.parse(call.output.find((item) => item.type === "message").content.find((item) => item.type === "output_text").text));
assert.equal(drafts.length, 2);
for (const answer of drafts) {
  assert(answer.supportedPoints.some((point) => /10 percent of intake airflow/.test(point.explanation)));
  assert.deepEqual(evaluateResearchAnswerQuality({ question: failed.question, evidence, answer })
    .misboundAccessibleDiningSurfaceRuleSourceIDs, [], "Exhaust re-entrainment is not a dining accessibility calculation.");
}

const source = (sourceID, codePrefix, sectionNumber, text) => ({ sourceID, codePrefix, sectionNumber, sectionID: sourceID, text,
  evidencePriority: { evidenceRole: "governing", primaryFunction: "controlling_rule", topicRouteRelationship: "aligned" } });
const exhaust = source("exhaust", "MC", "501.3.1", "Combined cross-contamination and re-entrainment shall be less than 10 percent of intake airflow.");
const dining = source("dining", "BC", "1108.2.9.1", "At least 10 percent of the total number of seating and standing spaces, but not less than one, of each type of dining surfaces shall be accessible.");
const cafe = source("cafe", "BC", "3111.6", "Sidewalk cafes and access thereto shall comply with Chapter 11.");
const mixedEvidence = [exhaust, dining, cafe];
for (const percentage of ["10 percent", "10%", "minimum accessible share"]) {
  const answer = { answerText: "Separate exhaust and dining-accessibility questions.",
    supportedPoints: [
      { heading: "Exhaust exception", explanation: `Re-entrainment must be below ${percentage === "minimum accessible share" ? "10 percent" : percentage} of intake airflow.`, sourceIDs: ["exhaust"] },
      { heading: "Dining surfaces", explanation: `The ${percentage} of the total seating and standing spaces must be accessible.`, sourceIDs: ["cafe"] }
    ], citations: [{ sourceIDs: ["exhaust"] }, { sourceIDs: ["cafe"] }, { sourceIDs: ["dining"] }] };
  const checked = evaluateResearchAnswerQuality({ question: "Check exhaust separation and dining accessibility.", evidence: mixedEvidence, answer });
  assert.deepEqual(checked.misboundAccessibleDiningSurfaceRuleSourceIDs, ["cafe"], "An unrelated percentage in the same answer must not acquire the dining rule.");
  const fixed = applyResearchDeterministicAnswerRepairs(answer, mixedEvidence);
  assert.deepEqual(fixed.supportedPoints[0], answer.supportedPoints[0]);
  assert.deepEqual(fixed.supportedPoints[1].sourceIDs, ["cafe", "dining"]);
}
console.log("Retained exhaust drafts and mixed-domain percentage checks passed; genuine dining misbinding remains rejected and repair stays on its own point. No API calls; draft semantic correctness is not certified.");
