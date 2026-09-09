import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveResearchConversationFacts, researchConversationFactPromptContext } from "../research-conversation-facts.mjs";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";

// This audit has no app, credential, retrieval or provider imports. It compares
// parser behavior on the question text only; it does not score generated answers.
globalThis.fetch = () => { throw new Error("This fact-scope audit forbids network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; live execution is not supported.");
const directory = fileURLToPath(new URL("../", import.meta.url));
const baselineCommit = "2b82cb84911809ff0b064e6e40a992c3ddcffe2e";
const baselineFile = (name) => execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/${name}`], { cwd: directory, encoding: "utf8" });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const dataModule = (value) => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
const oldQualification = baselineFile("research-fact-qualification.mjs");
const oldFacts = baselineFile("research-conversation-facts.mjs");
const baseline = await import(dataModule(oldFacts.replace('"./research-fact-qualification.mjs"', JSON.stringify(dataModule(oldQualification)))));
const inventoryPath = "evals/results/research-owner-backlog-v2-2026-09-09.json";
const inventoryBytes = await readFile(new URL(`../${inventoryPath}`, import.meta.url));
assert.equal(sha256(inventoryBytes), "9af45561835a277cb40aa04c46996fe472311f66018cd0ff8651197423ac90a7");
const inventory = JSON.parse(inventoryBytes);
assert.equal(inventory.cases.length, 110);
assert.equal(new Set(inventory.cases.map((item) => item.id)).size, 110);
const projection = (facts, promptContext) => ({
  established: facts.establishedFacts.map(({ qualificationVersion, ...item }) => item),
  unknown: facts.unknownFacts.map(({ qualificationVersion, ...item }) => item),
  hypothetical: facts.hypotheticalFacts.map(({ qualificationVersion, ...item }) => item),
  prompt: promptContext(facts)
});
const cases = inventory.cases.map((item) => {
  const input = { question: item.question, topicDecision: decideResearchConversationTopic({ question: item.question, previousMessages: [] }) };
  const before = projection(baseline.resolveResearchConversationFacts(input), baseline.researchConversationFactPromptContext);
  const after = projection(resolveResearchConversationFacts(input), researchConversationFactPromptContext);
  const beforeSHA256 = sha256(JSON.stringify(before));
  const afterSHA256 = sha256(JSON.stringify(after));
  const changed = beforeSHA256 !== afterSHA256;
  return {
    id: item.id, caseDefinitionSHA256: item.caseDefinitionSHA256,
    questionSHA256: sha256(item.question), changed, beforeSHA256, afterSHA256,
    ...(changed ? { question: item.question, before, after } : {})
  };
});
const currentSources = [];
for (const path of ["research-conversation-facts.mjs", "research-fact-qualification.mjs", "research-conversation-topic.mjs", "tests/research-fact-subject-scope-contract.mjs", "scripts/check-research-fact-subject-scope-20260909.mjs"]) {
  currentSources.push({ path, sha256: sha256(await readFile(new URL(`../${path}`, import.meta.url))) });
}
assert.equal(sha256(await readFile(new URL(`../${inventory.budget.auditFile}`, import.meta.url))), inventory.budget.auditSHA256);
const summary = {
  numberedQuestions: cases.length, changedCases: cases.filter((item) => item.changed).map((item) => item.id),
  unchangedCases: cases.filter((item) => !item.changed).length,
  newProviderCalls: 0, newNetworkCalls: 0, generatedAnswersTested: 0,
  fullCurrentBaselineAcceptanceEstablished: false
};
const report = {
  schema: "permitext.research-fact-subject-scope-audit.v1", generatedAt: new Date().toISOString(),
  baseline: { commit: baselineCommit, factsSHA256: sha256(oldFacts), qualificationSHA256: sha256(oldQualification) },
  currentSources, inventory: { path: inventoryPath, sha256: sha256(inventoryBytes) },
  method: "Compare normalized facts and all four model-prompt categories for each original question using the same current topic decision. Ignore qualification-version labels only. Scenario/Project context, generated answers, retrieval, API speed and costs are outside this parser audit. Changed projections are retained in full; every unchanged case retains both matching hashes. No historical answer is reclassified.",
  summary, budget: inventory.budget, cases
};
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, ...(args.length ? { output: args[1] } : {}) }, null, 2));
