import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { assertFrozenAcceptanceInputs, buildAcceptanceGradeRequest,
  validateAcceptanceGrade, acceptanceGradeSummary } from "../scripts/research-acceptance-grading-20261005.mjs";
const hash = value => createHash("sha256").update(value).digest("hex");
const root = new URL("../evals/retrieval-validation-2026-10-05/", import.meta.url);
const read = name => readFile(new URL(name, root), "utf8");
const fixtureText = await read("final-check-fixture.json"), sourcePacketText = await read("final-check-sources.json");
const fixture = JSON.parse(fixtureText), packet = JSON.parse(sourcePacketText);
const manifest = JSON.parse(await read("final-check-manifest.json"));
const handoff = JSON.parse(await read("Permitext_Final_40_Reviewed_Data.json"));
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts += 1; throw Error("No provider calls in grading contracts"); };
const cases = fixture.conversations.flatMap(c => c.questions.map((question, i) => ({
  id: `${c.id}-${i + 1}`, question, status: 200, answer: { answerText: "Synthetic contract answer.",
    mode: "openai", verification: { pass: true }, expected: "DO_NOT_SEND_INTERNAL_EXPECTATION",
    repairFeedback: "DO_NOT_SEND_INTERNAL_FEEDBACK" } })));
const result = { fixtureHash: manifest.fixtureSHA256, live: true, providerAPI: "responses",
  modelPolicy: "luna-only", mode: "end-to-end", phaseLabel: "fresh", finishedAt: "synthetic",
  provider: [], sourceHashes: manifest.codeHashes, cases };
const check = changes => assertFrozenAcceptanceInputs({ fixtureText, sourcePacketText, manifest, result, ...changes });
check();
assert.throws(() => check({ manifest: { ...manifest, finalCandidateFrozen: false } }));
assert.throws(() => check({ manifest: { ...manifest, ownerApproval: null } }));
assert.throws(() => check({ fixtureText: `${fixtureText}\n` }));
assert.throws(() => check({ sourcePacketText: `${sourcePacketText}\n` }));
assert.throws(() => check({ result: { ...result, sourceHashes: {} } }));
assert.throws(() => check({ result: { ...result, cases: cases.slice(1) } }));
assert.throws(() => check({ result: { ...result, provider: [{ status: "unknown" }] } }));
assert.throws(() => check({ result: { ...result, providerAPI: "chat-completions" } }));
const successfulJudgment = body => Object.fromEntries(JSON.parse(body.input).turns.map(t => [`turn-${t.turn}`, {
  requiredConcepts: Object.fromEntries(t.requiredConcepts.map(c => [c.id, { met: true, rationale: "Synthetic guard exercise.", answerExcerpt: "Synthetic" }])),
  forbiddenClaims: Object.fromEntries(t.forbiddenClaims.map(c => [c.id, { violated: false, rationale: "Synthetic guard exercise.", answerExcerpt: "" }])),
  uncertaintyConditions: Object.fromEntries(t.uncertaintyConditions.map(c => [c.id, { met: true, rationale: "Synthetic guard exercise.", answerExcerpt: "Synthetic" }])),
  boundedConclusionCorrect: true, citationsSupportClaims: true, noUnsupportedMaterialClaims: true,
  usefulAnswer: true, unresolvedMaterialDispute: false, materialErrors: [], rationale: "Synthetic guard exercise, not semantic evidence." } ]));
const rows = [];
for (const [i, c] of fixture.conversations.entries()) {
  const supplied = handoff.cases[i];
  assert.equal(c.id, supplied.case_id);
  for (const [index, rubric] of c.reviewedRubric.entries()) {
    const t = supplied.turns[index];
    assert.equal(rubric.boundedConclusion, t.expected_answer);
    assert.deepEqual(rubric.materialChecks.map(m => m.criterion), t.must_include);
    assert.deepEqual(rubric.forbiddenClaims, t.forbidden_claims);
    assert.deepEqual(rubric.genuineUnknowns, t.uncertainty_boundaries);
  }
  const body = buildAcceptanceGradeRequest(c, cases, packet.sources);
  assert.equal(body.model, "gpt-6-luna"); assert.equal(body.reasoning.effort, "medium"); assert.equal(body.store, false);
  assert(!body.input.includes("DO_NOT_SEND_INTERNAL")); assert(!body.input.includes('"verification"'));
  const j = successfulJudgment(body);
  rows.push(...validateAcceptanceGrade(body, j));
  const missing = structuredClone(j); delete missing["turn-1"].requiredConcepts["concept-1"];
  assert.throws(() => validateAcceptanceGrade(body, missing));
  const fail = structuredClone(j); fail["turn-1"].requiredConcepts["concept-1"].met = false;
  assert.equal(validateAcceptanceGrade(body, fail)[0].fullyCorrect, false, "A correct headline cannot compensate for one missing condition");
  const material = structuredClone(j); material["turn-1"].materialErrors.push("Synthetic material omission");
  assert.equal(validateAcceptanceGrade(body, material)[0].fullyCorrect, false);
  const unavailable = structuredClone(cases); unavailable.find(v => v.id === `${c.id}-1`).status = 503;
  assert.equal(validateAcceptanceGrade(buildAcceptanceGradeRequest(c, unavailable, packet.sources), j)[0].fullyCorrect, false);
  const bounded = structuredClone(cases); bounded.find(v => v.id === `${c.id}-1`).answer.mode = "clarification";
  assert.equal(JSON.parse(buildAcceptanceGradeRequest(c, bounded, packet.sources).input).turns[0].candidate.available, true,
    "Grade a delivered boundary answer substantively; a mode label alone cannot decide its correctness");
}
assert.equal(acceptanceGradeSummary(rows).general95PercentEstablished, false);
const withMaterialError = structuredClone(rows); withMaterialError[0].judgment.materialErrors = ["Synthetic material error"];
assert.equal(acceptanceGradeSummary(withMaterialError).scopedSampleGatePassed, false);
const silentOmission = structuredClone(rows); silentOmission[0].judgment.requiredConcepts["concept-1"].met = false;
assert.equal(acceptanceGradeSummary(silentOmission).scopedSampleGatePassed, false,
  "A missing material criterion is still a material failure when the grader omits it from its error list");
assert.throws(() => acceptanceGradeSummary(rows.slice(1)));
assert.equal(networkAttempts, 0);
console.log(JSON.stringify({ status: "passed", frozenTurns: 40, gradingEnvelopes: 20, omittedCriteriaRejected: true,
  materialErrorsHardFail: true, allResponsesCounted: true, providerCalls: 0, networkAttempts, syntheticOnly: true }));
