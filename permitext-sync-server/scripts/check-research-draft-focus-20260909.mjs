// Compare drafting instructions on the actual retained source packets. No API,
// network, answer rewriting, source rebinding or semantic-verdict override.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";

globalThis.fetch = () => { throw new Error("Draft-focus comparison forbids network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
const root = new URL("../", import.meta.url);
const hash = value => createHash("sha256").update(value).digest("hex");
const baselineCommit = "5033f203f";
const oldSource = execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/research-official-guidance-summary.mjs`], { cwd: root, encoding: "utf8" });
const oldModule = oldSource.replace(/from "(\.\/[^\"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, root).href)}`);
const old = await import(`data:text/javascript;base64,${Buffer.from(oldModule).toString("base64")}`);
const runFile = "evals/results/research-owner-api-round2-live-claim-scope-2026-09-09.json";
const runBytes = await readFile(new URL(runFile, root));
const run = JSON.parse(runBytes);
assert.equal(hash(runBytes), "96bf0051c296cc9f7a07b35093b6159093de6b968f2204e649d058369bd14978");
assert.equal(run.status, "completed");
const results = [];
for (const id of run.cases) {
  const calls = run.providerCalls.filter(call => call.caseID === id);
  assert.equal(calls.length, 2);
  const initial = JSON.parse(calls[0].retainedRequestBody.input);
  const sources = new Map();
  for (const p of initial.passages) {
    const source = sources.get(p.sourceID) || { id: p.sourceID, title: p.title, url: p.url,
      sourceValidation: p.page === null ? "official_html" : "official_pdf",
      sourceContentHash: p.contentHash, extractionLimitations: p.extractionLimitations, attributedClaims: [] };
    assert.equal(source.sourceContentHash, p.contentHash);
    source.attributedClaims.push({ id: p.claimID, text: p.text, verbatimText: p.text,
      contentHash: p.contentHash, sourceURL: p.url, pageNumber: p.page, heading: p.heading, intro: p.intro });
    sources.set(p.sourceID, source);
  }
  const context = { projectContextFacts: initial.userFacts, conversationFactContext: initial.conversationFacts,
    messages: initial.recentConversation.map(({ role, text }) => role === "user" ? { role, question: text } : { role, answer: { answerText: text } }) };
  for (const call of calls) {
    const verification = call.phase === "permitext_official_guidance_verification";
    const retained = call.retainedRequestBody, input = JSON.parse(retained.input);
    const verificationSchema = structuredClone(retained.text.format.schema);
    delete verificationSchema.properties.qualificationReview;
    verificationSchema.required = verificationSchema.required.filter(field => field !== "qualificationReview");
    const options = { question: initial.question, context, model: call.model, userID: "offline-draft-focus",
      webSupport: { sources: [...sources.values()], limitation: initial.retrievalLimitation },
      ...(verification ? { proposedAnswer: input.proposedAnswer, verificationSchema } : {}) };
    const before = old.researchOfficialGuidanceSummaryRequest(options);
    const after = researchOfficialGuidanceSummaryRequest(options);
    assert.deepEqual(JSON.parse(before.input), input, "Reconstruction must exactly preserve the retained packet, facts and draft.");
    assert.equal(before.instructions, retained.instructions, "Baseline instructions must match actual provider input.");
    assert.deepEqual(before.text, retained.text);
    if (verification) assert.deepEqual(after, before, "The complete verifier request must be unchanged.");
    else {
      const { instructions: oldInstructions, ...oldOther } = before;
      const { instructions: newInstructions, ...newOther } = after;
      assert.notEqual(newInstructions, oldInstructions);
      assert.deepEqual(newOther, oldOther, "Only draft instructions may change.");
    }
    results.push({ id, phase: verification ? "verification" : "draft", sourcePacketSHA256: hash(JSON.stringify(input.passages)),
      beforeSHA256: hash(JSON.stringify(before)), afterSHA256: hash(JSON.stringify(after)),
      additionalBytes: Buffer.byteLength(JSON.stringify(after)) - Buffer.byteLength(JSON.stringify(before)),
      completeRequestUnchanged: verification, onlyDraftInstructionsChanged: !verification });
  }
}
const sourceFiles = ["research-official-guidance-summary.mjs", "research-guidance-qualification-review.mjs",
  "research-guidance-source-relationships.mjs", "research-claim-scope.mjs", "research-conversation-facts.mjs",
  "research-source-policy.mjs", "scripts/check-research-draft-focus-20260909.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const report = { schema: "permitext.research-draft-focus-comparison.v1", checkedAt: new Date().toISOString(),
  baselineCommit: execFileSync("git", ["rev-parse", baselineCommit], { cwd: root, encoding: "utf8" }).trim(),
  baselineSummarySHA256: hash(oldSource), sourceHashes, runFile, runSHA256: hash(runBytes),
  summary: { cases: 2, requestEnvelopes: 4, providerCalls: 0, networkCalls: 0, semanticVerdictsChanged: 0,
    sourceFactSchemaModelOrOutputBudgetChanges: 0, answerQualityConfirmed: false, latencyMeasured: false }, results };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...report.summary, results, ...(args.length ? { output: args[1] } : {}) }, null, 2));
