// Compare prompt representation and portal routing over all 110 authored inputs.
// No answer generation, provider dispatch, public document fetch or UI workflow.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";
import { resolveResearchConversationFacts, researchConversationFactPromptContext } from "../research-conversation-facts.mjs";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";

assert(!process.argv.includes("--run-live"));
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error("Network forbidden in qualified-premise inspection."); };
const root = new URL("../", import.meta.url);
const baselineCommit = "8fb342f94";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const priorText = (file) => execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/${file}`], { cwd: root, encoding: "utf8", maxBuffer: 12_000_000 });
const moduleURL = (text) => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const previousFacts = await import(moduleURL(priorText("research-conversation-facts.mjs")
  .replace('"./research-fact-qualification.mjs"', JSON.stringify(new URL("research-fact-qualification.mjs", root).href))));
const previousRouting = await import(moduleURL(priorText("research-dob-workflow-routing.mjs")));
const originalsFile = "evals/research-reconciled-answer-key.json";
const additionsFile = "evals/results/research-owner-code-source-review-2026-09-08.json";
const originals = await readFile(new URL(originalsFile, root), "utf8");
const additions = await readFile(new URL(additionsFile, root), "utf8");
assert.equal(originals, priorText(originalsFile), "Do not change reference answers to fit generation.");
assert.equal(additions, priorText(additionsFile));
const cases = [...JSON.parse(originals).cases.map((item) => ({ item, original: true })),
  ...JSON.parse(additions).cases.map((item) => ({ item, original: false }))];
assert.equal(cases.length, 110);
const results = [];
let pins = 0;
let exactSelections = 0;
for (const { item, original } of cases) {
  const input = await ownerResearchScopeInput(item, { original, zoningSummary: zoningSectionSummary });
  const topicDecision = decideResearchConversationTopic({ question: input.question });
  const argumentsForFacts = { question: input.question, topicDecision };
  const state = resolveResearchConversationFacts(argumentsForFacts);
  const previousState = previousFacts.resolveResearchConversationFacts(argumentsForFacts);
  assert.deepEqual(state, previousState, `${item.id}: no categorical fact promotion or stored-state mutation.`);
  const before = previousFacts.researchConversationFactPromptContext(previousState);
  const after = researchConversationFactPromptContext(state);
  assert.deepEqual(after.established, before.established);
  assert.deepEqual(after.hypothetical, before.hypothetical);
  for (const line of before.unknown) assert(after.unknown.includes(line) || after.qualified.some((statement) => line.endsWith(statement)),
    `${item.id}: preserve every prior unresolved assertion verbatim.`);
  for (const line of after.qualified) assert(before.unknown.some((statement) => statement.endsWith(line)));
  const routeBefore = previousRouting.researchDOBWorkflowRoute(input.question);
  const routeAfter = researchDOBWorkflowRoute(input.question);
  pins += input.pinnedEvidence.length;
  exactSelections += (item.selectedEvidence || []).length;
  results.push({ id: item.id, inputSHA256: hash(JSON.stringify(input)), storedStateUnchanged: true,
    qualifiedStatements: after.qualified, remainingUnknowns: after.unknown,
    previousUnknownCount: before.unknown.length,
    guidanceOnlyBefore: routeBefore?.guidanceOnly ?? null, guidanceOnlyAfter: routeAfter?.guidanceOnly ?? null });
}
assert.equal(pins, 47);
assert.equal(exactSelections, 8);
assert.equal(networkAttempts, 0);
const routingChanges = results.filter((item) => item.guidanceOnlyBefore !== item.guidanceOnlyAfter).map((item) => item.id);
assert.deepEqual(routingChanges, ["DOBNOW-021"], "Inspect every route change against the authored scope.");
const sourceFiles = ["app.mjs", "research-conversation-facts.mjs", "research-dob-workflow-routing.mjs", "research-source-policy.mjs",
  "research-official-guidance-summary.mjs", "research-answer-presentation.mjs", "research-zoning-planner.mjs", "research-zoning-safety.mjs",
  originalsFile, additionsFile];
const sourceHashes = await Promise.all(sourceFiles.map(async (file) => ({ file, sha256: hash(await readFile(new URL(file, root))) })));
const costAuditFile = "evals/results/research-owner-api-round2-dob-source-coverage-cost-audit-2026-09-09.json";
const costAuditBytes = await readFile(new URL(costAuditFile, root));
const cost = JSON.parse(costAuditBytes).summary;
const report = {
  schema: "permitext-owner-qualified-premise-inspection-v1", checkedAt: new Date().toISOString(), baselineCommit,
  sourceHashes, priorCostAudit: { file: costAuditFile, sha256: hash(costAuditBytes) },
  scope: "Offline representation and routing comparison over all 110 authored questions; no new answer-quality or live-latency finding.",
  summary: { cases: results.length, pins, exactSelections, storedStatesChanged: 0, sourceQuestionsOrReferencesChanged: 0,
    casesWithQualifiedStatements: results.filter((item) => item.qualifiedStatements.length).length, routingChanges,
    networkAttempts, newProviderCalls: 0, liveProviderAttemptedCases: cost.fullCohortProviderAttempted,
    remainingUnattemptedCases: cost.fullCohortNotProviderAttempted, remainingConservativeAuthorizationUSD: cost.remainingConservativeAuthorizationUSD },
  results
};
const output = process.argv[process.argv.indexOf("--output") + 1];
assert(process.argv.includes("--output") && output, "Provide an output path for the comparison record.");
await writeFile(new URL(output, root), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary));
