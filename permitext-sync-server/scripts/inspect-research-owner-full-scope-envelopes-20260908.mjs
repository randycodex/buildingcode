// Read-only request construction. No API credential or provider dispatch path.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "../tests/research-request-envelope-preflight.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn, deterministicResearchEvidenceAnalysisForTurn } from "../app.mjs";
import { beginResearchSpendReservation, reserveResearchProviderSpend, endResearchSpendReservation } from "../research-config.mjs";
import { routeResearchAnswerModel } from "../research-model-routing.mjs";
import { requiredResearchClaimsFromEvidence } from "../research-required-claim-coverage.mjs";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";
import { resolveResearchCodeBasis } from "../research-code-basis.mjs";
import { researchDiscoveryNeedsAutomaticWebSupport, researchWebSupportTrigger } from "../research-source-policy.mjs";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { validateReconciledAnswerKey } from "../evals/research-answer-key-reconciliation.mjs";
import { validateOwnerCodeSourceReview } from "../evals/research-owner-code-review.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { resolveResearchConversationFacts, researchConversationFactPromptContext } from "../research-conversation-facts.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness } from "../research-zoning-planner.mjs";
import { planZoningConditionalExplanation, isZoningConditionalExplanation } from "../research-zoning-conditional-explanation.mjs";

assert(!process.argv.includes("--run-live"), "This diagnostic cannot dispatch provider requests.");
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error("Network forbidden in owner request diagnostic."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1", PERMITEXT_RUN_PAID_RESEARCH_EVALS: "0" });
const root = new URL("../", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const terminalFile = "evals/results/research-owner-live-zoning-small-confirmation-2026-09-08.json";
const terminalBytes = await readFile(new URL(terminalFile, root));
const terminal = JSON.parse(terminalBytes);
const ledgerHashes = [...terminal.previousResultHashes, { file: terminalFile, sha256: hash(terminalBytes) }];
assert.equal(ledgerHashes.length, 20);
let conservativeUSD = 0;
const attempted = new Set();
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
assert.equal(conservativeUSD, 7.864152);
const remainingAuthorizationUSD = Number((8 - conservativeUSD).toFixed(6));
const key = JSON.parse(await readFile(new URL("evals/research-reconciled-answer-key.json", root)));
await validateReconciledAnswerKey(key);
await validateOwnerCodeSourceReview();
const review = JSON.parse(await readFile(new URL("evals/results/research-owner-code-source-review-2026-09-08.json", root)));
const cases = [...key.cases.map((item) => ({ item, original: true })), ...review.cases.map((item) => ({ item, original: false }))];
assert.equal(cases.length, 110);
assert.equal(new Set(cases.map(({ item }) => item.id)).size, 110);
const environment = { ...researchRequestEnvelopeEnvironment, PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra" };
const { buildAnswerRequest } = await buildResearchRequestEnvelopeBuilders(environment);
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const results = [];
for (const { item, original } of cases) {
  const input = await ownerResearchScopeInput(item, { original, zoningSummary: zoningSectionSummary });
  const corpusPlan = await researchCorpusPlanForTurn(input);
  const zoningTurn = [...corpusPlan.selected, ...(corpusPlan.pinnedCorpora || [])].some((corpus) => corpus.id === "nyc-zoning-resolution");
  const initialPlan = zoningTurn ? planZoningResearchQuestion(input) : null;
  const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan, zoningPlan: initialPlan });
  const evidence = assembled.sources;
  const conversationFactContext = researchConversationFactPromptContext(resolveResearchConversationFacts({ question: input.question, topicDecision: assembled.topicDecision }));
  const prerequisitePlan = zoningTurn ? planZoningResearchQuestion({ ...input, conversationFactContext }) : null;
  const deterministicContext = prerequisitePlan ? zoningResearchDeterministicContext({ ...input, evidence, plan: prerequisitePlan, conversationFactContext }) : null;
  const readiness = prerequisitePlan ? evaluateZoningEvidenceReadiness({ question: input.question, evidence, plan: prerequisitePlan, deterministicContext }) : null;
  const zoningPlan = planZoningConditionalExplanation({ plan: prerequisitePlan, evidence, evidenceReadiness: readiness, evidenceSelection: assembled.zoningSelection });
  const conditional = isZoningConditionalExplanation(zoningPlan);
  const blocked = !!prerequisitePlan && (!readiness?.pass || !assembled.zoningSelection?.pass || (prerequisitePlan.disposition !== "ready" && !conditional));
  const webSupportRequested = !conditional && researchWebSupportTrigger({ question: input.question, retrievalQuery: assembled.retrievalQuery,
    outsideLibraryRequired: researchDiscoveryNeedsAutomaticWebSupport(assembled.discovery) }, { PERMITEXT_RESEARCH_WEB_SUPPORT: "1" }).useWeb;
  const requiredClaims = requiredResearchClaimsFromEvidence(evidence);
  const codeBasis = resolveResearchCodeBasis({ availableCorpora: registry, corpusPlan, resolvedAt: "2026-09-08T12:00:00.000Z" });
  const routing = routeResearchAnswerModel({ question: input.question, evidence, requiredClaims, codeBasis, webSupportRequested, zoningPlan, environment });
  const body = blocked ? null : buildAnswerRequest(input.question, evidence, "offline-owner-full-scope", {
    model: routing.model, responseStyle: "conversational", projectContextFacts: input.projectFacts, conversationFactContext,
    requiredClaims, codeBasis, zoningPlan, zoningDeterministicContext: deterministicContext,
    structuredEvidenceAnalysis: deterministicResearchEvidenceAnalysisForTurn(evidence, input.projectFacts, assembled.limitations)
  });
  let initialDraftMaximumUSD = null;
  let reservationError = null;
  if (body) {
    beginResearchSpendReservation({ id: `offline-${item.id}` }, environment);
    try { initialDraftMaximumUSD = reserveResearchProviderSpend(body, environment).maximumRequestUSD; }
    catch (error) { assert.equal(error.code, "RESEARCH_SPEND_CAP"); reservationError = error.code; }
    finally { endResearchSpendReservation(); }
  }
  results.push({ id: item.id, inputSHA256: hash(JSON.stringify(input)), previouslyProviderAttempted: attempted.has(item.id),
    sourceCount: evidence.length, authoredPinCount: input.pinnedEvidence.length, projectFactCount: input.projectFacts.length,
    blockedByZoningPrerequisitesOrEvidence: blocked, zoningPath: zoningPlan?.path || null, conditionalExplanation: conditional,
    model: body?.model || null, routingReasons: routing.reasons, webSupportRequested,
    requestBytes: body ? Buffer.byteLength(JSON.stringify(body)) : null, maxOutputTokens: body?.max_output_tokens || null,
    initialDraftMaximumUSD, reservationError,
    initialDraftFitsRemainingAuthorization: initialDraftMaximumUSD !== null && initialDraftMaximumUSD <= remainingAuthorizationUSD });
}
assert.equal(networkAttempts, 0);
const sourceFiles = ["app.mjs", "research-config.mjs", "research-model-routing.mjs", "research-corpus-registry.mjs", "research-code-basis.mjs",
  "research-source-policy.mjs", "research-evidence-assembly.mjs", "research-zoning-planner.mjs", "research-zoning-conditional-explanation.mjs",
  "research-required-claim-coverage.mjs", "research-conversation-facts.mjs", "evals/research-owner-scope-input.mjs",
  "evals/research-reconciled-answer-key.json", "evals/results/research-owner-code-source-review-2026-09-08.json",
  "tests/research-request-envelope-preflight.mjs", "scripts/inspect-research-owner-full-scope-envelopes-20260908.mjs"];
const candidates = results.filter((item) => !item.previouslyProviderAttempted && !item.webSupportRequested && item.initialDraftFitsRemainingAuthorization);
const report = { schema: "permitext-owner-full-scope-envelope-diagnostic-v1", checkedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  scope: "All 110 authored inputs, including supplied Project facts and selected passages/section IDs, through source assembly, existing hybrid routing and actual answer request construction. Local diagnostic Zoning eligibility. Initial draft bounds only; no returned web material, prior answer, verification, repair, full HTTP acceptance, latency or live answer grade. Standard pricing is a versioned offline fixture, not a live Production or provider-balance read. A draft fitting the remaining authorization does not authorize or prove a complete turn.",
  sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, hash(await readFile(new URL(file, root)))]))), ledgerHashes,
  summary: { cases: results.length, providerCalls: 0, networkAttempts, conservativeUSD, remainingAuthorizationUSD,
    previouslyProviderAttempted: results.filter((item) => item.previouslyProviderAttempted).length,
    notProviderAttempted: results.filter((item) => !item.previouslyProviderAttempted).length,
    candidateInitialDrafts: candidates.map(({ id, model, initialDraftMaximumUSD, zoningPath }) => ({ id, model, initialDraftMaximumUSD, zoningPath })) }, results };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) { assert(process.argv[outputIndex + 1]); await writeFile(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
console.log(JSON.stringify(report.summary, null, 2));
