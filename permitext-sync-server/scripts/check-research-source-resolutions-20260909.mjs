// Fixed-source request comparison. This does not generate an answer or call an
// app/provider endpoint; retained failed prose is never repaired by this script.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";
import { beginResearchSpendReservation, reserveResearchProviderSpend, endResearchSpendReservation } from "../research-config.mjs";

globalThis.fetch = () => { throw new Error("Source-resolution comparison forbids provider/network calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
const root = new URL("../", import.meta.url), hash = x => createHash("sha256").update(x).digest("hex");
const baselineCommit = "b51897f42";
const oldSource = execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/research-official-guidance-summary.mjs`], { cwd: root, encoding: "utf8" });
const old = await import(`data:text/javascript;base64,${Buffer.from(oldSource.replace(/from "(\.\/[^\"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, root).href)}`)).toString("base64")}`);
const inputs = [];
const read = async file => { const bytes = await readFile(new URL(file, root)); inputs.push({ file, sha256: hash(bytes) }); return JSON.parse(bytes); };
const latest = await read("evals/results/research-owner-api-round2-live-draft-focus-2026-09-09.json");
const actor = await read("evals/results/research-owner-api-round2-live-source-span-2026-09-09.json");
const inventory = await read("evals/results/research-owner-backlog-v4-2026-09-09.json");
const pricingEnvironment = { PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "retained-pricing-20260909",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "retained-pricing-20260909",
  ...Object.fromEntries(["MAX_REQUEST", "USER_DAILY_CAP", "USER_MONTHLY_CAP", "DAILY_CAP", "MONTHLY_CAP"].map(key => [`PERMITEXT_RESEARCH_${key}_USD`, "1"])) };
const bound = body => {
  beginResearchSpendReservation({ id: "offline-bound" }, pricingEnvironment);
  try { return reserveResearchProviderSpend(body, pricingEnvironment).maximumRequestUSD; }
  finally { endResearchSpendReservation(); }
};
const cases = [];
for (const [id, run] of [["DOBNOW-003", latest], ["DOBNOW-004", latest], ["DOBNOW-023", actor]]) {
  const calls = run.providerCalls.filter(call => call.caseID === id);
  const initial = JSON.parse(calls.find(c => c.phase === "permitext_official_guidance_summary").retainedRequestBody.input);
  const verifierCall = calls.find(c => c.phase === "permitext_official_guidance_verification");
  const verifierInput = JSON.parse(verifierCall.retainedRequestBody.input);
  const sources = initial.passages.map(p => ({ id: p.sourceID, title: p.title, url: p.url,
    sourceValidation: p.page === null ? "official_html" : "official_pdf", sourceContentHash: p.contentHash,
    extractionLimitations: p.extractionLimitations, attributedClaims: [{ id: p.claimID, text: p.text, verbatimText: p.text,
      contentHash: p.contentHash, sourceURL: p.url, pageNumber: p.page, heading: p.heading, intro: p.intro }] }));
  const options = { question: initial.question, userID: "offline-source-resolutions", webSupport: { sources, limitation: initial.retrievalLimitation },
    context: { projectContextFacts: initial.userFacts, conversationFactContext: initial.conversationFacts,
      messages: initial.recentConversation.map(({ role, text }) => role === "user" ? { role, question: text } : { role, answer: { answerText: text } }) } };
  const comparisons = [];
  for (const verification of [false, true]) {
    const retained = verification ? verifierCall : calls.find(c => c.phase === "permitext_official_guidance_summary");
    const verificationSchema = structuredClone(verifierCall.retainedRequestBody.text.format.schema);
    delete verificationSchema.properties.qualificationReview;
    verificationSchema.required = verificationSchema.required.filter(key => key !== "qualificationReview");
    const selected = { ...options, model: retained.model,
      ...(verification ? { verificationSchema, proposedAnswer: verifierInput.proposedAnswer } : {}) };
    const before = old.researchOfficialGuidanceSummaryRequest(selected), after = researchOfficialGuidanceSummaryRequest(selected);
    const bi = JSON.parse(before.input), ai = JSON.parse(after.input);
    const unchangedInput = ({ sourceResolutionPacket, qualificationReviewPacket, ...rest }) => rest;
    assert.deepEqual(unchangedInput(ai), unchangedInput(bi));
    assert.deepEqual(ai.passages, initial.passages);
    if (verification) {
      assert.deepEqual(ai.proposedAnswer, verifierInput.proposedAnswer);
      assert.deepEqual(ai.qualificationReviewPacket.passages, bi.qualificationReviewPacket.passages);
      const withoutHash = request => { const schema = structuredClone(request.text); schema.format.schema.properties.qualificationReview.properties.packetSHA256.enum = ["normalized-input-hash"]; return schema; };
      assert.deepEqual(withoutHash(after), withoutHash(before));
    } else {
      assert(after.text.format.schema.required.includes("sourceResolutions"));
      const schema = structuredClone(after.text);
      delete schema.format.schema.properties.sourceResolutions;
      schema.format.schema.required = schema.format.schema.required.filter(key => key !== "sourceResolutions");
      assert.deepEqual(schema, before.text);
    }
    for (const field of ["model", "store", "reasoning", "max_output_tokens", "safety_identifier"]) assert.deepEqual(after[field], before[field]);
    const control = { ...selected, question: "Where is the payment menu?" };
    assert.deepEqual(researchOfficialGuidanceSummaryRequest(control), old.researchOfficialGuidanceSummaryRequest(control), "Requests without a detected source relationship remain identical.");
    comparisons.push({ phase: verification ? "verification" : "draft", beforeRequestSHA256: hash(JSON.stringify(before)),
      afterRequestSHA256: hash(JSON.stringify(after)), additionalBytes: Buffer.byteLength(JSON.stringify(after)) - Buffer.byteLength(JSON.stringify(before)),
      beforeMaximumRequestUSD: bound(before), afterMaximumRequestUSD: bound(after), relationships: ai.sourceResolutionPacket.relationships.length });
  }
  cases.push({ id, question: initial.question, sourcePacketSHA256: hash(JSON.stringify(initial.passages)),
    retainedDraftSHA256: hash(JSON.stringify(verifierInput.proposedAnswer)), comparisons });
}
const sourceFiles = ["app.mjs", "research-official-guidance-summary.mjs", "research-guidance-source-resolutions.mjs",
  "research-guidance-source-relationships.mjs", "research-guidance-qualification-review.mjs", "research-config.mjs",
  "evals/research-owner-http-request-binding.mjs", "tests/research-guidance-source-resolutions-contract.mjs",
  "tests/research-official-pdf-http-contract.mjs", "tests/research-owner-http-request-binding-contract.mjs",
  "scripts/check-research-source-resolutions-20260909.mjs", "package.json"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const report = { schema: "permitext.research-source-resolution-comparison.v1", checkedAt: new Date().toISOString(),
  baselineCommit: execFileSync("git", ["rev-parse", baselineCommit], { cwd: root, encoding: "utf8" }).trim(), baselineSummarySHA256: hash(oldSource),
  sourceHashes, inputs, pricingEnvironment, budget: inventory.budget,
  summary: { retainedCases: 3, requestComparisons: 6, identicalNoRelationshipControlRequests: 6, detectedRelationships: 4,
    providerCalls: 0, networkCalls: 0, rewrittenDrafts: 0, changedSourcePassages: 0, changedOutputBudgets: 0,
    liveQualityConfirmed: false, liveSpeedMeasured: false },
  limitations: ["This compares request construction and conservative reservations on fixed retained input, not generated answers.",
    "Verifier comparisons retain the exact historical draft without a new resolution plan; these are not dispatchable v13 full-turn candidates or semantic regrades.",
    "Reservation figures are conservative per-request estimates under retained pricing, not usage or a new spending allowance. The actual new verifier input depends on the future generated draft.",
    "All 110 questions remain in scope. Structural binding cannot prove scope, semantic truth or cross-paragraph consistency; the independent semantic gate remains required."], cases };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...report.summary, cases, ...(args.length ? { output: args[1] } : {}) }, null, 2));
