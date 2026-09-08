// Compare real request builders without provider or web dispatch.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "../tests/research-request-envelope-preflight.mjs";
import { assembledResearchEvidenceForTurn, deterministicResearchEvidenceAnalysisForTurn } from "../app.mjs";
import { routeResearchAnswerModel } from "../research-model-routing.mjs";
import { requiredResearchClaimsFromEvidence } from "../research-required-claim-coverage.mjs";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";
import { resolveResearchCodeBasis } from "../research-code-basis.mjs";
import { reconciledResearchEvaluationInput } from "../evals/research-answer-key-reconciliation.mjs";
import { researchDiscoveryNeedsAutomaticWebSupport, researchWebSupportTrigger } from "../research-source-policy.mjs";

assert(!process.argv.includes("--run-live"), "This comparison cannot dispatch provider requests.");
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error("Network forbidden in instruction comparison."); };
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
const root = new URL("../", import.meta.url);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const audit = JSON.parse(await readFile(new URL("evals/research-answer-instruction-compaction-audit-20260908.json", root)));
const historical = (file) => execFileSync("git", ["show", `${audit.baselineCommit}:permitext-sync-server/${file}`], { cwd: fileURLToPath(root), maxBuffer: 8 * 1024 * 1024 });
const previousSource = historical("app.mjs").toString();
const currentSource = await readFile(new URL("app.mjs", root), "utf8");
assert.equal(hash(previousSource), audit.baselineAppSHA256);
const start = (source) => source.indexOf("async function openAIResearchInterpretation(");
const dispatch = (source) => source.indexOf("  const { payload } = await requestResearchProvider({", start(source));
assert.equal(previousSource.slice(0, start(previousSource)), currentSource.slice(0, start(currentSource)));
assert.equal(previousSource.slice(dispatch(previousSource)), currentSource.slice(dispatch(currentSource)).replaceAll(":compact-v1:conversational-v4", ":conversational-v4"),
  "Post-builder code must be unchanged except mock version metadata.");
const dependencies = ["research-config.mjs", "research-model-routing.mjs", "research-answer-presentation.mjs", "research-answer-quality.mjs", "research-evidence-assembly.mjs", "research-required-claim-coverage.mjs", "research-code-basis.mjs", "research-corpus-registry.mjs", "research-zoning-safety.mjs", "research-zoning-planner.mjs", "research-web-attribution.mjs", "research-plumbing-source-repairs.mjs"];
const unchangedDependencies = {};
for (const file of dependencies) {
  const current = await readFile(new URL(file, root));
  assert.equal(hash(current), hash(historical(file)), `${file} changed outside instruction scope.`);
  unchangedDependencies[file] = hash(current);
}
const environment = { ...researchRequestEnvelopeEnvironment, PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra" };
const previous = await buildResearchRequestEnvelopeBuilders(environment, { sourceText: previousSource });
const current = await buildResearchRequestEnvelopeBuilders(environment);
const owner = JSON.parse(await readFile(new URL("evals/research-owner-code-candidates.json", root)));
const original = JSON.parse(await readFile(new URL("evals/research-reconciled-answer-key.json", root)));
const cases = [...owner.cases.map(({ id, question }) => ({ id, question, projectContext: {} })),
  ...original.cases.map((item) => ({ id: item.id, ...reconciledResearchEvaluationInput(item) }))];
assert.equal(cases.length, 110);
assert.equal(new Set(cases.map((item) => item.id)).size, 110);
const registry = createResearchCorpusRegistry();
const results = [];
for (const item of cases) {
  const projectFacts = Object.entries(item.projectContext).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((entry) => `${key}: ${entry}`));
  // Actual automatic retrieval; original selected pins are separate fixtures.
  const assembled = await assembledResearchEvidenceForTurn({ question: item.question, messages: [], pinnedEvidence: [], projectFacts });
  const evidence = assembled.sources;
  const requiredClaims = requiredResearchClaimsFromEvidence(evidence);
  const codeBasis = resolveResearchCodeBasis({ availableCorpora: registry, corpusPlan: routeResearchCorpora({ question: item.question, registry }), resolvedAt: "2026-09-08T12:00:00.000Z" });
  const webSupportRequested = researchWebSupportTrigger({ question: item.question, outsideLibraryRequired: researchDiscoveryNeedsAutomaticWebSupport(assembled.discovery) }, { PERMITEXT_RESEARCH_WEB_SUPPORT: "1" }).useWeb;
  const routing = routeResearchAnswerModel({ question: item.question, evidence, requiredClaims, codeBasis, webSupportRequested, environment });
  const options = { model: routing.model, responseStyle: "conversational", projectContextFacts: projectFacts, requiredClaims, codeBasis,
    structuredEvidenceAnalysis: deterministicResearchEvidenceAnalysisForTurn(evidence, projectFacts) };
  const before = previous.buildAnswerRequest(item.question, evidence, "synthetic-instruction-comparison", options);
  const after = current.buildAnswerRequest(item.question, evidence, "synthetic-instruction-comparison", options);
  const { instructions: beforeInstructions, ...beforeOther } = before;
  const { instructions: afterInstructions, ...afterOther } = after;
  assert.deepEqual(afterOther, beforeOther, `${item.id}: only instructions may change.`);
  const proposed = { answerText: "Synthetic verifier payload, not a generated or reference answer." };
  assert.deepEqual(current.buildVerifierRequest(item.question, evidence, proposed, "synthetic-instruction-comparison", options),
    previous.buildVerifierRequest(item.question, evidence, proposed, "synthetic-instruction-comparison", options), `${item.id}: verifier changed.`);
  assert(Buffer.byteLength(afterInstructions) < Buffer.byteLength(beforeInstructions), `${item.id}: instructions did not shrink.`);
  results.push({ id: item.id, sourceCount: evidence.length, model: routing.model, webSupportRequested,
    beforeInstructionBytes: Buffer.byteLength(beforeInstructions), afterInstructionBytes: Buffer.byteLength(afterInstructions),
    beforeRequestBytes: Buffer.byteLength(JSON.stringify(before)), afterRequestBytes: Buffer.byteLength(JSON.stringify(after)),
    unchangedInputSHA256: hash(JSON.stringify(after.input)), unchangedSchemaSHA256: hash(JSON.stringify(after.text)), verifierUnchanged: true });
}
assert.equal(networkAttempts, 0);
const summary = { cases: results.length, providerCalls: 0, networkAttempts,
  meanInstructionBytesBefore: results.reduce((sum, item) => sum + item.beforeInstructionBytes, 0) / results.length,
  meanInstructionBytesAfter: results.reduce((sum, item) => sum + item.afterInstructionBytes, 0) / results.length,
  pc04: results.find((item) => item.id === "PC-04") };
const report = { schema: "permitext-instruction-comparison-v1", checkedOn: "2026-09-08", baselineCommit: audit.baselineCommit,
  scope: "All 110 questions/scenarios and supplied Project facts with actual automatic retrieval. Original selected-passage pins are not reconstructed in this cohort; targeted selection/web/image variants are separate contract tests. No returned web results, generated answers, live semantic grade, latency measurement or complete service-turn cost. Answer references are excluded by explicit input projection.",
  currentAppSHA256: hash(currentSource), unchangedDependencies, summary, results };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) { assert(process.argv[outputIndex + 1]); await writeFile(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
console.log(JSON.stringify(summary, null, 2));
