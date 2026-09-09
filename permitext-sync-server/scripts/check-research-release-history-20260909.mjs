// Source and request coverage only. No provider dispatch, answer rewriting or grading.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";
import { researchOfficialPDFSectionPassages } from "../research-official-pdf-ranking.mjs";
import { researchOfficialGuidanceSummaryRequest, researchOfficialGuidanceSummaryPromptVersion } from "../research-official-guidance-summary.mjs";
import { validateGuidanceSourceResolutions } from "../research-guidance-source-resolutions.mjs";

globalThis.fetch = () => { throw new Error("Offline release-history checks forbid network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
assert.equal(researchOfficialGuidanceSummaryPromptVersion, "20260909-document-summary-v15");
const root = new URL("../", import.meta.url), hash = value => createHash("sha256").update(value).digest("hex");
const inputs = [];
async function read(file, expected) { const bytes = await readFile(new URL(file, root)); const sha256 = hash(bytes); if (expected) assert.equal(sha256, expected); inputs.push({ file, sha256 }); return JSON.parse(bytes); }
const baselineCommit = "d81a7c73195ee814cb0af0967d2cba58c4af04f5";
const baselineRouter = execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/research-dob-workflow-routing.mjs`], { cwd: root, encoding: "utf8" });
const old = await import(`data:text/javascript;base64,${Buffer.from(baselineRouter).toString("base64")}`);
const key = await read("evals/research-reconciled-answer-key.json", "64c83744410c3dfa4bff565328d9e31edde3c6c55cf98b79d52c587f1965d455");
const added = await read("evals/research-owner-code-candidates.json", "461b47898980aeaa29cf65a728b548fe3a1de70105beb0dd34a16c4e182adbe7");
const run = await read("evals/results/research-owner-api-round2-live-source-resolution-parts-2026-09-09.json", "7cc352badc9e6ed4ac022784ff022ccedbf7d508cc66bac7ef2820302a9a9d7a");
const fixture = await read("evals/fixtures/dob-official-document-pages-20260909.json");
const release = fixture.documents.find(item => item.source.id === "dob-build-release-notes");
const stripVersion = route => { if (!route) return route; const { version, ...rest } = route; return rest; };
const routes = [...key.cases, ...added.cases].map(item => {
  const question = [item.questionContext ? `Context: ${item.questionContext}` : null, item.scenario, item.question].filter(Boolean).join("\n\n");
  const before = old.researchDOBWorkflowRoute(question), after = researchDOBWorkflowRoute(question);
  const changed = JSON.stringify(stripVersion(before)) !== JSON.stringify(stripVersion(after));
  if (changed) {
    assert.equal(after.topic, "subsequent_filings");
    assert.deepEqual(stripVersion({ ...after, sources: after.sources.slice(0, -1) }), stripVersion(before));
    assert.equal(after.sources.at(-1).id, release.source.id);
  }
  return { id: item.id, questionSHA256: hash(question), topic: after?.topic ?? null, changed, beforeSourceCount: before?.sources.length ?? 0, afterSourceCount: after?.sources.length ?? 0 };
});
assert.equal(routes.length, 110);
assert.deepEqual(routes.filter(item => item.changed).map(item => item.id), ["DOBNOW-003"]);
const cases = [];
for (const result of run.results) {
  const calls = run.providerCalls.filter(call => call.caseID === result.id);
  const retained = JSON.parse(calls[0].retainedRequestBody.input);
  const originalProposed = JSON.parse(calls[1].retainedRequestBody.input).proposedAnswer;
  const passages = structuredClone(retained.passages);
  if (result.id === "DOBNOW-003") {
    const source = researchDOBWorkflowRoute(retained.question).sources.find(source => source.id === release.source.id);
    for (const page of researchOfficialPDFSectionPassages(release.document.passages, source.pdfSectionHeadings))
      passages.push({ sourceID: source.id, claimID: page.id, title: source.title, url: page.sourceURL, page: page.pageNumber,
        contentHash: page.contentHash, text: page.text, heading: page.heading, intro: page.intro || null, extractionLimitations: [] });
  }
  const sources = passages.map(p => ({ id: p.sourceID, title: p.title, url: p.url.split("#")[0],
    sourceValidation: p.page === null ? "official_html" : "official_pdf", sourceContentHash: p.contentHash,
    extractionLimitations: p.extractionLimitations, attributedClaims: [{ id: p.claimID, contentHash: p.contentHash,
      text: p.text, verbatimText: p.text, pageNumber: p.page, sourceURL: p.url, heading: p.heading, intro: p.intro }] }));
  const options = { question: retained.question, webSupport: { sources, limitation: retained.retrievalLimitation }, userID: "isolated-account",
    context: { projectContextFacts: retained.userFacts, conversationFactContext: retained.conversationFacts,
      messages: retained.recentConversation.map(({ role, text }) => role === "user" ? { role, question: text } : { role, answer: { answerText: text } }) } };
  const draft = researchOfficialGuidanceSummaryRequest({ ...options, model: calls[0].model });
  const input = JSON.parse(draft.input);
  assert.deepEqual(input.passages.slice(0, retained.passages.length), retained.passages);
  for (const field of ["question", "userFacts", "conversationFacts", "recentConversation", "retrievalLimitation"]) assert.deepEqual(input[field], retained[field]);
  // This derivative keeps every historical word and citation. Only the plan's
  // context hash changes so the new missing-source check can be isolated.
  const diagnosticProposed = structuredClone(originalProposed);
  diagnosticProposed.sourceResolutions.packetSHA256 = input.sourceResolutionPacket.packetSHA256;
  let missingReleaseCitationRejected = null;
  if (result.id === "DOBNOW-003") {
    assert.throws(() => validateGuidanceSourceResolutions(input, diagnosticProposed), { code: "INVALID_RESEARCH_RESPONSE" });
    missingReleaseCitationRejected = true;
  } else assert.equal(validateGuidanceSourceResolutions(input, diagnosticProposed).complete, true);
  const verifier = researchOfficialGuidanceSummaryRequest({ ...options, model: calls[1].model,
    verificationSchema: calls[1].retainedRequestBody.text.format.schema, proposedAnswer: diagnosticProposed });
  const vi = JSON.parse(verifier.input);
  assert.deepEqual(vi.passages, input.passages);
  assert.deepEqual(vi.proposedAnswer, diagnosticProposed);
  const comparisons = [draft, verifier].map((request, index) => {
    const before = calls[index].retainedRequestBody;
    request.service_tier = before.service_tier;
    request.safety_identifier = before.safety_identifier;
    for (const field of ["model", "reasoning", "max_output_tokens", "store", "service_tier"]) assert.deepEqual(request[field], before[field]);
    const beforeBytes = Buffer.byteLength(JSON.stringify(before)), afterBytes = Buffer.byteLength(JSON.stringify(request));
    return { phase: index ? "verification" : "draft", beforeBytes, afterBytes, additionalBytes: afterBytes - beforeBytes,
      beforeRequestSHA256: hash(JSON.stringify(before)), afterRequestSHA256: hash(JSON.stringify(request)), model: request.model, maxOutputTokens: request.max_output_tokens };
  });
  cases.push({ id: result.id, originalPassages: retained.passages.length, currentPassages: input.passages.length,
    originalSourcesPreserved: true, addedReleasePages: input.passages.slice(retained.passages.length).map(p => p.page),
    missingReleaseCitationRejected, diagnosticDraftProseAndCitationsUnchanged: true, sourceRelationships: input.sourceRelationships, comparisons });
}
const sourceFiles = ["app.mjs", "research-dob-workflow-routing.mjs", "research-official-guidance-summary.mjs", "research-guidance-source-resolutions.mjs",
  "research-guidance-source-relationships.mjs", "research-guidance-qualification-review.mjs", "research-official-pdf-ranking.mjs",
  "tests/research-guidance-source-relationships-contract.mjs", "tests/research-official-pdf-ranking-contract.mjs", "tests/research-official-pdf-http-contract.mjs",
  "scripts/check-research-release-history-20260909.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const summary = { numberedRouteChecks: 110, routesWithChangedSources: routes.filter(r => r.changed).map(r => r.id), requestComparisons: 4,
  addedCompleteReleasePages: 2, originalPassagesRemovedOrRewritten: 0, providerCalls: 0, networkCalls: 0, generatedAnswersTested: 0,
  liveQualityConfirmed: false, liveLatencyMeasured: false };
const report = { schema: "permitext.research-release-history-check.v1", checkedAt: new Date().toISOString(), baselineCommit,
  baselineRouterSHA256: hash(baselineRouter), sourceHashes, inputs, summary,
  limitations: ["This checks all 110 question routes and four constructed requests; it does not generate or approve 110 answers.",
    "The fixed release snapshot is not a fresh public-source fetch. A future live request must retrieve and validate the complete sections again.",
    "The diagnostic verifier candidate preserves the prior flawed wording; its new packet hash is an explicit local binding derivative, not a new provider output. The timing candidate lacks the newly required release citation and is not dispatchable.",
    "Instruction presence does not prove that the model will resolve the timing issue, include preparation permission, or ground its verification reason correctly."], routes, cases };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, cases: cases.map(({ id, currentPassages, addedReleasePages, comparisons }) => ({ id, currentPassages, addedReleasePages, comparisons })), ...(args.length ? { output: args[1] } : {}) }, null, 2));
