// Full 110-case source/planning diagnostic. No generated answers or paid calls.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { validateReconciledAnswerKey } from "../evals/research-answer-key-reconciliation.mjs";
import { validateOwnerCodeSourceReview } from "../evals/research-owner-code-review.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { resolveResearchConversationFacts, researchConversationFactPromptContext } from "../research-conversation-facts.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness } from "../research-zoning-planner.mjs";
import { researchDiscoveryNeedsAutomaticWebSupport, researchWebSupportTrigger } from "../research-source-policy.mjs";

assert(!process.argv.includes("--run-live"), "This diagnostic cannot dispatch provider requests.");
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error("Network forbidden in authored-input source diagnostic."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1", PERMITEXT_RUN_PAID_RESEARCH_EVALS: "0" });
const root = new URL("../", import.meta.url);
const hash = (text) => createHash("sha256").update(text).digest("hex");
const terminalFile = "evals/results/research-owner-live-decision-fact-verifier-v3-2026-09-08.json";
const terminalBytes = await readFile(new URL(terminalFile, root));
const terminal = JSON.parse(terminalBytes);
const ledgerHashes = [...terminal.previousResultHashes, { file: terminalFile, sha256: hash(terminalBytes) }];
assert.equal(ledgerHashes.length, 19);
const attempted = new Set();
let conservativeUSD = 0;
for (const entry of ledgerHashes) {
  const bytes = await readFile(new URL(entry.file, root));
  assert.equal(hash(bytes), entry.sha256);
  const run = JSON.parse(bytes);
  assert(["completed", "stopped"].includes(run.status));
  for (const item of run.results) {
    if (item.scope !== "verifier-only" && run.providerCalls.some((call) => call.caseID === item.id)) attempted.add(item.id);
    for (const operation of item.operations || []) {
      assert.equal(operation.pendingProviderRequestCount, 0);
      const zeroCall = operation.providerRequestCount === 0 && !run.providerCalls.some((call) => call.caseID === item.id);
      assert(Number.isFinite(operation.conservativeProviderCostUSD) || (zeroCall && operation.conservativeProviderCostUSD === null));
      conservativeUSD += operation.conservativeProviderCostUSD || 0;
    }
  }
}
conservativeUSD = Number(conservativeUSD.toFixed(6));
assert.equal(conservativeUSD, 7.853484);
const keyBytes = await readFile(new URL("evals/research-reconciled-answer-key.json", root));
const original = JSON.parse(keyBytes);
await validateReconciledAnswerKey(original);
await validateOwnerCodeSourceReview();
const reviewBytes = await readFile(new URL("evals/results/research-owner-code-source-review-2026-09-08.json", root));
const review = JSON.parse(reviewBytes);
const cases = [...original.cases.map((item) => ({ item, original: true })), ...review.cases.map((item) => ({ item, original: false }))];
assert.equal(cases.length, 110);
assert.equal(new Set(cases.map(({ item }) => item.id)).size, 110);
const compact = (text) => String(text || "").replace(/\s+/g, " ").trim();
const results = [];
for (const testCase of cases) {
  const { item } = testCase;
  const started = performance.now();
  const input = await ownerResearchScopeInput(item, { original: testCase.original, zoningSummary: zoningSectionSummary });
  const corpusPlan = await researchCorpusPlanForTurn(input);
  const zoningTurn = [...corpusPlan.selected, ...(corpusPlan.pinnedCorpora || [])].some((corpus) => corpus.id === "nyc-zoning-resolution");
  const initialZoningPlan = zoningTurn ? planZoningResearchQuestion(input) : null;
  const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan, zoningPlan: initialZoningPlan });
  const conversationFactContext = researchConversationFactPromptContext(resolveResearchConversationFacts({ question: input.question, topicDecision: assembled.topicDecision }));
  const zoningPlan = zoningTurn ? planZoningResearchQuestion({ ...input, conversationFactContext }) : null;
  const deterministicContext = zoningPlan ? zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan: zoningPlan, conversationFactContext }) : null;
  const readiness = zoningPlan ? evaluateZoningEvidenceReadiness({ question: input.question, evidence: assembled.sources, plan: zoningPlan, deterministicContext }) : null;
  const exactSelections = input.pinnedEvidence.filter((source) => source.selectedText).map((pin) => {
    const resolved = assembled.sources.find((source) => source.sourceID === pin.sourceID);
    return { sectionID: pin.sectionID, sourceID: pin.sourceID, exact: compact(resolved?.text) === compact(pin.selectedText),
      selectedTextSHA256: hash(compact(pin.selectedText)), deliveredTextSHA256: hash(compact(resolved?.text)) };
  });
  const expectedReferences = testCase.original
    ? input.pinnedEvidence.map((source) => `${source.codePrefix} ${source.sectionNumber}`) : item.sourceReferences;
  const sources = assembled.sources.map((source) => ({ sourceID: source.sourceID, sectionID: source.sectionID,
    reference: `${source.codePrefix} ${source.sectionNumber}`, origin: source.origin, role: source.evidencePriority?.evidenceRole,
    characters: source.text.length, textSHA256: hash(source.text), canonicalContextComplete: source.canonicalContextComplete,
    truncated: source.truncated, structuredTable: !!source.richSourceGrids, targetedDefinition: !!source.targetedDefinition,
    ...(source.targetedZoningContext ? { targetedZoningContext: source.targetedZoningContext } : {}) }));
  const web = researchWebSupportTrigger({ question: input.question, retrievalQuery: assembled.retrievalQuery,
    outsideLibraryRequired: researchDiscoveryNeedsAutomaticWebSupport(assembled.discovery) }, { PERMITEXT_RESEARCH_WEB_SUPPORT: "1" });
  results.push({ id: item.id, family: item.id.split("-")[0], previouslyProviderAttempted: attempted.has(item.id),
    inputSHA256: hash(JSON.stringify(input)), question: input.question, authoredPinCount: input.pinnedEvidence.length,
    suppliedProjectFactCount: input.projectFacts.length, exactSelections, expectedReferences,
    missingExactReferences: expectedReferences.filter((ref) => !sources.some((source) => source.reference === ref)),
    sources, usage: assembled.usage, limitations: assembled.limitations,
    zoning: zoningPlan ? { path: zoningPlan.path, disposition: zoningPlan.disposition, missingFacts: zoningPlan.missingFacts,
      selection: assembled.zoningSelection ? {
        pass: assembled.zoningSelection.pass, rejected: assembled.zoningSelection.rejected,
        gateFailures: assembled.zoningSelection.gateFailures, usage: assembled.zoningSelection.usage
      } : null, readiness } : null,
    webSupportRequested: web.useWeb, webSupportReasons: web.reasons,
    durationMilliseconds: Math.round(performance.now() - started) });
}
assert.equal(networkAttempts, 0);
const summary = { cases: results.length, providerCalls: 0, networkAttempts, conservativeUSD, remainingAuthorizationUSD: Number((8 - conservativeUSD).toFixed(6)),
  previouslyProviderAttempted: results.filter((item) => item.previouslyProviderAttempted).length,
  notProviderAttempted: results.filter((item) => !item.previouslyProviderAttempted).map((item) => item.id),
  authoredPins: results.reduce((sum, item) => sum + item.authoredPinCount, 0),
  exactSelectedPassages: results.flatMap((item) => item.exactSelections).length,
  changedSelectedPassages: results.flatMap((item) => item.exactSelections.filter((pin) => !pin.exact).map((pin) => ({ id: item.id, sectionID: pin.sectionID }))),
  missingReferences: results.filter((item) => item.missingExactReferences.length).map(({ id, missingExactReferences }) => ({ id, missingExactReferences })),
  noSources: results.filter((item) => !item.sources.length).map((item) => item.id),
  zoningNotReady: results.filter((item) => item.zoning && (item.zoning.disposition !== "ready" || !item.zoning.selection?.pass || !item.zoning.readiness?.pass)).map((item) => ({ id: item.id, disposition: item.zoning.disposition, selectionPass: item.zoning.selection?.pass, readiness: item.zoning.readiness })) };
const report = { schema: "permitext-owner-authored-source-diagnostic-v1", checkedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  scope: "All 110 authored question/scenario inputs, Project facts and selected passages/section IDs through production corpus planning and evidence assembly. Zoning planning/selection/readiness functions run with local diagnostic eligibility. Web triggering is inspected, but no document is fetched. No answer generation, semantic grading, saved answer, full HTTP dispatch, latency benchmark, public eligibility or professional approval is claimed. Exact reference presence does not prove source or answer completeness.",
  sourceHashes: { ...Object.fromEntries(await Promise.all([
      "app.mjs", "research-zoning-planner.mjs", "research-zoning-safety.mjs",
      "research-dob-workflow-routing.mjs", "research-source-policy.mjs",
      "research-evidence-assembly.mjs", "research-zoning-context-excerpts.mjs",
      "evals/research-owner-scope-input.mjs", "scripts/check-research-owner-full-scope-20260908.mjs"
    ].map(async (file) => [file, hash(await readFile(new URL(file, root)))]))),
    "evals/research-reconciled-answer-key.json": hash(keyBytes), "evals/results/research-owner-code-source-review-2026-09-08.json": hash(reviewBytes) }, ledgerHashes, summary, results };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) { assert(process.argv[outputIndex + 1]); await writeFile(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
console.log(JSON.stringify(summary, null, 2));
