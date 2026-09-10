// Offline scope and source-preservation audit; no provider transport or live mode.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { researchTopicDependencyPlan, researchTopicDependencyVersion } from "../research-topic-dependencies.mjs";
import { researchEvidenceAssemblyVersion } from "../research-evidence-assembly.mjs";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";

const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
globalThis.fetch = () => { throw new Error("Occupancy dependency audit forbids network/provider calls."); };
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const root = new URL("../", import.meta.url), hash = value => createHash("sha256").update(value).digest("hex");
const inputs = [];
async function read(file, expected) {
  const bytes = await readFile(new URL(file, root)), sha256 = hash(bytes);
  if (expected) assert.equal(sha256, expected, file);
  inputs.push({ file, sha256 }); return JSON.parse(bytes);
}
const original = await read("evals/research-reconciled-answer-key.json", "64c83744410c3dfa4bff565328d9e31edde3c6c55cf98b79d52c587f1965d455");
const added = await read("evals/research-owner-code-candidates.json", "461b47898980aeaa29cf65a728b548fe3a1de70105beb0dd34a16c4e182adbe7");
const baseline = await read("evals/results/research-occupancy-dependencies-baseline-2026-09-09.json");
assert.match(baseline.sourceCommit, /^[a-f0-9]{40}$/);
for (const [file, expected] of Object.entries(baseline.sourceHashes)) {
  assert(["research-topic-dependencies.mjs", "research-evidence-assembly.mjs"].includes(file));
  const bytes = execFileSync("git", ["show", `${baseline.sourceCommit}:permitext-sync-server/${file}`], { cwd: root });
  assert.equal(hash(bytes), expected, `Pre-edit source hash: ${file}`);
}
const definition = added.cases.find(item => item.id === "GAP-14");
assert.deepEqual(baseline.definition, definition);
const input = await ownerResearchScopeInput(definition, { original: false, zoningSummary: zoningSectionSummary });
assert.deepEqual(input, baseline.input);
const current = await assembledResearchEvidenceForTurn(input);
const anchor = current.sources.find(source => source.codePrefix === "AC" && source.sectionNumber === "28-118.1");
const routes = [];
for (const [index, dataset] of [original, added].entries()) for (const item of dataset.cases) {
  const authored = await ownerResearchScopeInput(item, { original: index === 0, zoningSummary: zoningSectionSummary });
  // One actual resolved anchor tests only the question predicate. This is not
  // a source retrieval or answer-quality run for every question.
  const plan = researchTopicDependencyPlan({ question: authored.question, sources: [anchor] });
  routes.push({ id: item.id, authoredInputSHA256: hash(JSON.stringify(authored)),
    occupancyQuestionPredicateMatches: plan?.id === "nyc-2022-occupancy-certificate-alternatives" });
}
assert.equal(routes.length, 110);
assert.deepEqual(routes.filter(row => row.occupancyQuestionPredicateMatches).map(row => row.id), ["GAP-14"]);
const preservedFields = ["sourceID", "sectionID", "codePrefix", "sectionNumber", "codeEdition", "codeVersion", "corpusID", "jurisdiction", "text", "canonicalContextComplete", "truncated"];
const beforeSources = baseline.result.sources, beforeIDs = new Set(beforeSources.map(source => source.sectionID));
const retainedSources = beforeSources.map(before => {
  const after = current.sources.find(source => source.sectionID === before.sectionID);
  assert(after, `Preserve source ${before.sectionID}`);
  for (const field of preservedFields) assert.deepEqual(after[field], before[field], `${before.sectionID}: ${field}`);
  assert.equal(after.evidencePriority.claimCoverageRequired, before.evidencePriority.claimCoverageRequired);
  return { sectionID: before.sectionID, reference: `${before.codePrefix} ${before.sectionNumber}`, sourceID: before.sourceID,
    textSHA256: hash(before.text), characters: before.text.length };
});
const additions = current.sources.filter(source => !beforeIDs.has(source.sectionID));
assert.deepEqual(additions.map(source => source.sectionNumber).sort(), ["28-118.15", "28-118.15.1", "28-118.15.1.2", "28-118.15.2"]);
for (const source of additions) {
  assert(source.canonicalContextComplete && !source.truncated);
  assert.equal(source.evidencePriority.claimCoverageRequired, false);
}
assert(!current.limitations.some(item => item.kind === "topic-dependency-coverage-gap"));
const sourceFiles = ["app.mjs", "research-topic-dependencies.mjs", "research-evidence-assembly.mjs", "evals/research-owner-scope-input.mjs",
  "tests/research-occupancy-dependencies-contract.mjs", "tests/research-plumbing-source-repairs-http-contract.mjs",
  "scripts/check-research-occupancy-dependencies-20260909.mjs", "package.json",
  ...["9195", "9222", "9223", "9224", "9225", "9226", "9234"].map(id => `../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/${id}.json`)];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const summary = { questionPredicatesChecked: routes.length, matchingQuestionIDs: ["GAP-14"], actualRetrievalComparisons: 1,
  baselineSources: beforeSources.length, preservedSources: retainedSources.length, currentSources: current.sources.length,
  addedCompleteSources: additions.length, baselineCharacters: baseline.result.usage.characterCount,
  currentCharacters: current.usage.characterCount, newlyGeneratedAnswers: 0, providerCalls: 0, networkCalls: 0,
  liveAnswerAcceptanceConfirmed: false };
const report = { schema: "permitext.research-occupancy-dependency-check.v1", checkedAt: new Date().toISOString(),
  researchTopicDependencyVersion, researchEvidenceAssemblyVersion, sourceHashes, inputs, summary, input, routes,
  retainedSources, additions, currentUsage: current.usage, currentLimitations: current.limitations,
  limitations: [
    "All 110 authored question predicates are checked against one resolved 2022 anchor. Only GAP-14 has an actual before/after retrieval comparison. This does not test 110 answers.",
    "All 17 baseline source identities, full texts and mandatory-claim flags are preserved. Four complete supporting provisions are added; no alternative is declared applicable or mandatory to discuss.",
    "The additional evidence increases input size. Cost and latency improvement are not established.",
    "The separate mocked HTTP regression retains the old draft's missing exception citations and negative verdict. Retrieval completeness does not bind unnamed claims or override verification.",
    "Prepared repository code text is used for transport and source-integrity checks. No fresh legal-source review, live provider response or professional acceptance is claimed."
  ] };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, ...(args.length ? { output: args[1] } : {}) }, null, 2));
