// Question-only replay of the real local corpus/discovery/assembly path.
// Source-reference comparison runs afterwards and never enters Research input.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { ownerCodeResearchInput, validateOwnerCodeSourceReview } from "../evals/research-owner-code-review.mjs";

await validateOwnerCodeSourceReview();
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
process.env.PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS = "1";
process.env.PERMITEXT_RUN_PAID_RESEARCH_EVALS = "0";
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts += 1; throw new Error("No network is allowed during this retrieval diagnostic."); };
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const { evidenceDiscoveryVersion } = await import("../evidence-discovery.mjs");
const reviewBytes = await readFile(new URL("../evals/results/research-owner-code-source-review-2026-09-08.json", import.meta.url));
const review = JSON.parse(reviewBytes);
const variantBytes = process.argv.includes("--variants")
  ? await readFile(new URL("../evals/research-owner-code-variants.json", import.meta.url)) : null;
const cases = variantBytes ? JSON.parse(variantBytes).cases.map((item) => {
  const base = review.cases.find((candidate) => candidate.id === item.baseCaseID);
  assert(base, `${item.id} has no reviewed source basis.`);
  return { ...item, sourceReferences: base.sourceReferences };
}) : review.cases;
const results = [];
for (const item of cases) {
  const input = ownerCodeResearchInput(item);
  assert.deepEqual(Object.keys(input).sort(), ["codeVersion", "question"]);
  const start = performance.now();
  const assembled = await assembledResearchEvidenceForTurn({ question: input.question, messages: [], pinnedEvidence: [], projectFacts: [] });
  const durationMilliseconds = Math.round(performance.now() - start);
  const sources = assembled.sources.map((source) => ({
    reference: `${source.codePrefix} ${source.sectionNumber}`, sectionID: source.sectionID,
    text: source.text, canonicalContextComplete: source.canonicalContextComplete,
    origin: source.origin, textSHA256: createHash("sha256").update(source.text).digest("hex")
  }));
  const missingExactReferences = item.sourceReferences.filter((reference) => !sources.some((source) => source.reference === reference));
  results.push({ id: item.id, question: input.question, expectedReferences: item.sourceReferences,
    missingExactReferences, sources, durationMilliseconds, usage: assembled.usage, corpusPlan: assembled.corpusPlan });
}
assert.equal(networkAttempts, 0, "Even a caught network attempt invalidates this no-network diagnostic.");
const summary = {
  cases: results.length,
  allExactReferencesFound: results.filter((item) => !item.missingExactReferences.length).length,
  noSources: results.filter((item) => !item.sources.length).map((item) => item.id),
  averageCharacters: Math.round(results.reduce((n, item) => n + item.sources.reduce((sum, source) => sum + source.text.length, 0), 0) / results.length),
  networkAttempts, providerCalls: 0
};
const report = {
  schema: "permitext-owner-code-retrieval-diagnostic-v1", createdAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  evidenceDiscoveryVersion, sourceReviewSHA256: createHash("sha256").update(reviewBytes).digest("hex"),
  variantDatasetSHA256: variantBytes ? createHash("sha256").update(variantBytes).digest("hex") : null,
  limitation: "Exact reference recall is a retrieval diagnostic, not an answer-quality grade. Parent/child coverage, applicability and semantic completeness require separate review. Local discovery timing excludes network and generation.",
  summary, results
};
const output = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, missing: results.filter((item) => item.missingExactReferences.length).map(({ id, missingExactReferences }) => ({ id, missingExactReferences })) }, null, 2));
