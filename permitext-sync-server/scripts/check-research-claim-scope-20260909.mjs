// Offline comparison of request construction on fixed, previously fetched
// official passages and saved failed drafts. No provider/app dispatch or keys.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";

globalThis.fetch = () => { throw new Error("Claim-scope comparison forbids network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; live execution is not supported.");
const root = new URL("../", import.meta.url);
const baselineCommit = "842781a1e";
const baseline = (name) => execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/${name}`], { cwd: fileURLToPath(root), encoding: "utf8" });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const moduleURL = (text) => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const oldRelationships = baseline("research-guidance-source-relationships.mjs");
const oldSummary = baseline("research-official-guidance-summary.mjs");
const old = await import(moduleURL(oldSummary.replace(/from "(\.\/[^\"]+)"/g, (match, path) =>
  `from ${JSON.stringify(path === "./research-guidance-source-relationships.mjs" ? moduleURL(oldRelationships) : new URL(path, root).href)}`)));
const inputs = [];
const read = async (path) => { const bytes = await readFile(new URL(path, root)); inputs.push({ path, sha256: hash(bytes) }); return JSON.parse(bytes); };
const inspection = await read("evals/results/research-owner-dob-source-conditions-inspection-2026-09-09.json");
const timingRun = await read("evals/results/research-owner-api-round2-live-decision-scope-2026-09-09.json");
const amendmentRun = await read("evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json");
const inventory = await read("evals/results/research-owner-backlog-v2-2026-09-09.json");
assert.equal(hash(await readFile(new URL(inventory.budget.auditFile, root))), inventory.budget.auditSHA256);
const calls = [...timingRun.providerCalls.filter((call) => call.caseID === "DOBNOW-003"), ...amendmentRun.providerCalls.filter((call) => call.caseID === "DOBNOW-004")];
const results = [];
for (const id of ["DOBNOW-003", "DOBNOW-004"]) {
  const snapshot = inspection.results.find((item) => item.id === id);
  const retained = calls.find((call) => call.caseID === id && call.phase === "permitext_official_guidance_summary");
  const retainedInput = retained.retainedRequestBody ? JSON.parse(retained.retainedRequestBody.input) : null;
  const text = retained.output.flatMap((item) => item.content || []).find((item) => item.type === "output_text").text;
  const proposedAnswer = JSON.parse(text);
  const citationRebindings = [];
  for (const paragraph of proposedAnswer.paragraphs) for (const use of paragraph.sourceUses) {
    const source = snapshot.sources.find((source) => source.id === use.sourceID);
    assert(source, `${id}: missing source ${use.sourceID}`);
    if (source.attributedClaims.some((claim) => claim.id === use.claimID)) continue;
    const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const originalPassage = retainedInput?.passages.find((passage) => passage.sourceID === use.sourceID && passage.claimID === use.claimID);
    const matches = originalPassage ? source.attributedClaims.filter((claim) =>
      compact(source.sourceValidation === "official_pdf" ? claim.verbatimText || claim.text : claim.text) === compact(originalPassage.text)) : source.attributedClaims;
    assert.equal(matches.length, 1, `Cannot rebind an ambiguous or changed passage: ${use.sourceID}/${use.claimID}`);
    citationRebindings.push({ sourceID: use.sourceID, from: use.claimID, to: matches[0].id,
      binding: originalPassage ? "exact-normalized-passage-text" : "single-passage-source-in-fixed-comparison-snapshot" });
    use.claimID = matches[0].id;
  }
  const options = { question: snapshot.question, webSupport: { sources: snapshot.sources }, userID: "offline-claim-scope", model: "offline-fixed-model" };
  const comparisons = [];
  for (const verification of [false, true]) {
    const selected = verification ? { ...options, proposedAnswer, verificationSchema: { type: "object", properties: { pass: { type: "boolean" } }, required: ["pass"] } } : options;
    const before = old.researchOfficialGuidanceSummaryRequest(selected);
    const after = researchOfficialGuidanceSummaryRequest(selected);
    const beforeInput = JSON.parse(before.input), afterInput = JSON.parse(after.input);
    const content = ({ sourceRelationships, qualificationReviewPacket, ...input }) => input;
    assert.deepEqual(content(afterInput), content(beforeInput), "Question, facts, complete passages and proposed text must remain unchanged.");
    if (verification) assert.deepEqual(afterInput.qualificationReviewPacket.passages, beforeInput.qualificationReviewPacket.passages);
    for (const field of ["model", "store", "reasoning", "max_output_tokens", "safety_identifier"]) assert.deepEqual(after[field], before[field]);
    // Only the qualification packet's input hash changes in the verifier schema.
    const schema = (request) => { const value = structuredClone(request.text); if (verification) value.format.schema.properties.qualificationReview.properties.packetSHA256.enum = ["normalized-input-hash"]; return value; };
    assert.deepEqual(schema(after), schema(before));
    const beforeBytes = Buffer.byteLength(JSON.stringify(before)), afterBytes = Buffer.byteLength(JSON.stringify(after));
    comparisons.push({ phase: verification ? "verification" : "draft", beforeBytes, afterBytes, additionalBytes: afterBytes - beforeBytes,
      beforeRequestSHA256: hash(JSON.stringify(before)), afterRequestSHA256: hash(JSON.stringify(after)), maxOutputTokens: after.max_output_tokens,
      completePassagesUnchanged: true, factsAndQuestionUnchanged: true, proposedAnswerUnchanged: verification ? true : null,
      sourceRelationships: afterInput.sourceRelationships || [] });
  }
  results.push({ id, question: snapshot.question, sourceSnapshotInputSHA256: snapshot.inputSHA256, sourceCount: snapshot.sources.length,
    retainedDraftSHA256: hash(text), citationRebindings, comparisons });
}
const sourceHashes = {};
for (const path of ["app.mjs", "research-claim-scope.mjs", "research-answer-presentation.mjs", "research-guidance-source-relationships.mjs", "research-official-guidance-summary.mjs", "research-guidance-qualification-review.mjs", "tests/research-claim-scope-contract.mjs", "scripts/check-research-claim-scope-20260909.mjs"]) sourceHashes[path] = hash(await readFile(new URL(path, root)));
const summary = { savedCases: results.length, requestEnvelopes: results.length * 2, newProviderCalls: 0, newNetworkCalls: 0,
  generatedAnswersTested: 0, sourceAndFactChanges: 0, outputBudgetChanges: 0, liveQualityConfirmed: false, liveLatencyMeasured: false };
const report = { schema: "permitext.research-claim-scope-request-comparison.v1", checkedAt: new Date().toISOString(),
  baselineCommit: execFileSync("git", ["rev-parse", baselineCommit], { cwd: fileURLToPath(root), encoding: "utf8" }).trim(),
  baselineSourceHashes: { summary: hash(oldSummary), relationships: hash(oldRelationships) }, sourceHashes, inputs, summary,
  method: "Build old and current requests against the same retained official source snapshots and failed draft text. Rebind only unambiguous single-passage source IDs that changed across the recorded fetches; do not rewrite draft prose. This diagnoses request changes, not whether a model will now answer correctly. Public sources have not been refreshed by this check. No answer key enters a request.",
  budget: inventory.budget, results };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, changes: results.map((item) => ({ id: item.id, requests: item.comparisons.map(({ phase, beforeBytes, afterBytes, additionalBytes }) => ({ phase, beforeBytes, afterBytes, additionalBytes })) })), ...(args.length ? { output: args[1] } : {}) }, null, 2));
