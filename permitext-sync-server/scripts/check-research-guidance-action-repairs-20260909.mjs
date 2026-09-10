// Offline source-route and retained-candidate comparisons, never live Research.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { repairGuidanceDeclaredActions } from "../research-guidance-action-repairs.mjs";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { researchOfficialGuidanceSummaryRequest, researchOfficialGuidanceSummaryInterpretation } from "../research-official-guidance-summary.mjs";
import { validateGuidanceSourceResolutions } from "../research-guidance-source-resolutions.mjs";
import { validateGuidanceQualificationReview } from "../research-guidance-qualification-review.mjs";

globalThis.fetch = () => { throw new Error("Action-repair audit forbids network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
const root = new URL("../", import.meta.url), hash = value => createHash("sha256").update(value).digest("hex");
const inputs = [];
async function read(file, expected) {
  const bytes = await readFile(new URL(file, root)), sha256 = hash(bytes);
  if (expected) assert.equal(sha256, expected, file);
  inputs.push({ file, sha256 }); return JSON.parse(bytes);
}
const original = await read("evals/research-reconciled-answer-key.json", "64c83744410c3dfa4bff565328d9e31edde3c6c55cf98b79d52c587f1965d455");
const added = await read("evals/research-owner-code-candidates.json", "461b47898980aeaa29cf65a728b548fe3a1de70105beb0dd34a16c4e182adbe7");
const routes = [];
for (const [index, dataset] of [original, added].entries()) for (const item of dataset.cases) {
  const input = await ownerResearchScopeInput(item, { original: index === 0, zoningSummary: zoningSectionSummary });
  const route = researchDOBWorkflowRoute(input.question);
  const sources = route?.sources?.map(source => ({ id: source.id, url: source.url })) || [];
  routes.push({ id: item.id, authoredInputSHA256: hash(JSON.stringify(input)), sourceDeclarations: sources,
    declaresPreviewDocument: sources.some(source => source.id === "dob-filing-submission-steps") });
}
assert.equal(routes.length, 110);
assert.deepEqual(routes.filter(row => row.declaresPreviewDocument).map(row => row.id), ["DOBNOW-023"]);
const calls = [];
for (const [file, id] of [
  ["evals/results/research-owner-api-round2-live-source-resolution-parts-2026-09-09.json", "DOBNOW-003"],
  ["evals/results/research-owner-api-round2-live-attestation-preparation-2026-09-09.json", "DOBNOW-023"]
]) {
  const run = await read(file);
  calls.push({ file, id, draft: run.providerCalls.find(call => call.caseID === id && call.phase === "permitext_official_guidance_summary"),
    verifier: run.providerCalls.find(call => call.caseID === id && call.phase === "permitext_official_guidance_verification") });
}
const cases = [];
for (const { file, id, draft, verifier } of calls) {
  const prior = JSON.parse(verifier.retainedRequestBody.input), { answerText, ...answer } = prior.proposedAnswer;
  const snapshot = JSON.stringify(prior);
  const repaired = repairGuidanceDeclaredActions(prior, answer);
  assert.equal(JSON.stringify(prior), snapshot);
  if (id === "DOBNOW-003") {
    assert.deepEqual(repaired, { answer, repairs: [] });
    // This older timing packet predates the release-history relationship
    // revision. Preserve its rejection; do not rehash it into an apparent pass.
    assert.throws(() => validateGuidanceSourceResolutions(prior, answer), { code: "INVALID_RESEARCH_RESPONSE" });
    cases.push({ id, retainedRunFile: file, fullSourcePacketSHA256: hash(JSON.stringify(prior.passages)),
      before: answer, after: repaired.answer, repairs: [], requestComparisons: [],
      legacySourceResolutionPacketCompatible: false });
    continue;
  }
  assert.equal(validateGuidanceSourceResolutions(prior, repaired.answer).complete, true);
  const sources = prior.passages.map(p => ({ id: p.sourceID, title: p.title, url: p.url,
    sourceValidation: p.page === null ? "official_html" : "official_pdf", sourceContentHash: p.contentHash,
    extractionLimitations: p.extractionLimitations, attributedClaims: [{ id: p.claimID, text: p.text, verbatimText: p.text,
      contentHash: p.contentHash, sourceURL: p.url, pageNumber: p.page, heading: p.heading, intro: p.intro }] }));
  const options = { question: prior.question, webSupport: { sources, limitation: prior.retrievalLimitation },
    context: { projectContextFacts: prior.userFacts, conversationFactContext: prior.conversationFacts,
      messages: prior.recentConversation.map(({ role, text }) => role === "user" ? { role, question: text } : { role, answer: { answerText: text } }) },
    userID: "offline-construction" };
  const { qualificationReview, ...baseProperties } = verifier.retainedRequestBody.text.format.schema.properties;
  const base = { ...verifier.retainedRequestBody.text.format.schema, properties: baseProperties,
    required: verifier.retainedRequestBody.text.format.schema.required.filter(field => field !== "qualificationReview") };
  const projected = researchOfficialGuidanceSummaryInterpretation(repaired.answer, options.webSupport);
  const requests = [researchOfficialGuidanceSummaryRequest({ ...options, model: draft.model }),
    researchOfficialGuidanceSummaryRequest({ ...options, model: verifier.model, verificationSchema: base,
      proposedAnswer: { ...repaired.answer, answerText: projected.answerText } })];
  const comparisons = requests.map((request, index) => {
    const before = [draft, verifier][index].retainedRequestBody;
    const after = { ...request, safety_identifier: before.safety_identifier, service_tier: before.service_tier };
    const beforeInput = JSON.parse(before.input), afterInput = JSON.parse(after.input);
    assert.deepEqual(afterInput.passages, beforeInput.passages);
    assert.equal(after.model, before.model); assert.deepEqual(after.reasoning, before.reasoning);
    assert.equal(after.max_output_tokens, before.max_output_tokens);
    assert.deepEqual(afterInput.userFacts, beforeInput.userFacts); assert.deepEqual(afterInput.conversationFacts, beforeInput.conversationFacts);
    if (index === 0) {
      assert.deepEqual(afterInput, beforeInput);
      assert.deepEqual(after.text.format.schema, before.text.format.schema);
    }
    return { phase: index ? "verification" : "draft", beforeBytesWithRedactedIdentity: Buffer.byteLength(JSON.stringify(before)),
      afterBytesWithRedactedIdentity: Buffer.byteLength(JSON.stringify(after)),
      beforeRequestSHA256: hash(JSON.stringify(before)), afterRequestSHA256: hash(JSON.stringify(after)),
      fullPassagesPreserved: true, factsPreserved: true, modelAndOutputBudgetPreserved: true };
  });
  const verdict = JSON.parse(verifier.output.flatMap(message => message.content || []).find(content => content.type === "output_text").text);
  const stale = validateGuidanceQualificationReview({ input: JSON.parse(requests[1].input), value: verdict,
    verification: { pass: verdict.pass, issues: verdict.issues } });
  if (id === "DOBNOW-023") { assert.equal(repaired.repairs.length, 1); assert.equal(stale.pass, false); }
  else assert.deepEqual(repaired, { answer, repairs: [] });
  cases.push({ id, retainedRunFile: file, fullSourcePacketSHA256: hash(JSON.stringify(prior.passages)),
    before: answer, after: repaired.answer, repairs: repaired.repairs, requestComparisons: comparisons,
    historicalReceiptCannotApproveModifiedCandidate: repaired.repairs.length ? !stale.pass : null });
}
const sourceFiles = ["app.mjs", "research-guidance-action-repairs.mjs", "research-official-guidance-summary.mjs",
  "research-guidance-source-resolutions.mjs", "research-guidance-qualification-review.mjs", "research-dob-workflow-routing.mjs",
  "tests/research-guidance-action-repairs-contract.mjs", "tests/research-official-pdf-http-contract.mjs", "package.json",
  "scripts/check-research-guidance-action-repairs-20260909.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const summary = { numberedSourceRouteChecks: 110, routesDeclaringPreviewDocument: ["DOBNOW-023"], retainedCandidatesCompared: 2,
  changedRetainedCandidates: cases.filter(item => item.repairs.length).map(item => item.id), constructedRequests: 2,
  providerCalls: 0, networkCalls: 0, generatedAnswersTested: 0, liveQualityConfirmed: false };
const report = { schema: "permitext.research-guidance-action-repair-check.v1", checkedAt: new Date().toISOString(), inputs, sourceHashes, summary,
  limitations: ["The 110-case check inspects declared source routes, not generated answers or a complete current-baseline acceptance run.",
    "Only two retained candidates have the complete packets used in this comparison; other historical guidance drafts are not silently reconstructed from partial citations.",
    "The retained v14 timing packet is unchanged by this repair and remains incompatible with the later release-history relationship check. Only the v15 attestation packet is used for current request construction.",
    "The shared v16 instruction reaches all official-guidance drafting and verification requests. Route eligibility does not prove other generated answers will be unchanged.",
    "Constructed requests preserve full source passages and model settings but are not a fresh HTTP preflight. Identity is redacted; no price, latency or semantic pass is inferred.",
    "Only the specified positive applicant signature wording is completed. Other phrasings, compound actions, source conflicts and omitted actions still require semantic verification."], routes, cases };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, ...(args.length ? { output: args[1] } : {}) }, null, 2));
