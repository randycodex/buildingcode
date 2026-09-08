// No-network diagnostic. Builds actual request bodies but cannot dispatch them.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "../tests/research-request-envelope-preflight.mjs";
import { assembledResearchEvidenceForTurn, deterministicResearchEvidenceAnalysisForTurn } from "../app.mjs";
import { beginResearchSpendReservation, reserveResearchProviderSpend, endResearchSpendReservation } from "../research-config.mjs";
import { routeResearchAnswerModel } from "../research-model-routing.mjs";
import { requiredResearchClaimsFromEvidence } from "../research-required-claim-coverage.mjs";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";
import { resolveResearchCodeBasis } from "../research-code-basis.mjs";
import { researchDiscoveryNeedsAutomaticWebSupport, researchWebSupportTrigger } from "../research-source-policy.mjs";
assert(!process.argv.includes("--run-live"), "This diagnostic cannot make provider requests.");
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts += 1; throw new Error("Network is forbidden."); };
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
const root = new URL("../", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const terminalURL = new URL("evals/results/research-owner-live-plumbing-repair-confirmation-v2-2026-09-08.json", root);
const terminalBytes = await readFile(terminalURL);
const terminal = JSON.parse(terminalBytes);
let conservativeUSD = 0;
const attemptedIDs = new Set();
for (const entry of [...terminal.previousResultHashes, { file: terminalURL.pathname, sha256: hash(terminalBytes) }]) {
  const bytes = await readFile(entry.file.startsWith("/") ? decodeURIComponent(entry.file) : new URL(entry.file, root));
  assert.equal(hash(bytes), entry.sha256);
  const run = JSON.parse(bytes);
  assert(["completed", "stopped"].includes(run.status));
  for (const item of run.results) {
    attemptedIDs.add(item.id);
    for (const operation of item.operations || []) {
      assert.equal(operation.pendingProviderRequestCount, 0);
      const undispatched = operation.providerRequestCount === 0 && !run.providerCalls.some((call) => call.caseID === item.id);
      assert(Number.isFinite(operation.conservativeProviderCostUSD) || (undispatched && operation.conservativeProviderCostUSD === null));
      conservativeUSD += operation.conservativeProviderCostUSD || 0;
    }
  }
}
conservativeUSD = Number(conservativeUSD.toFixed(6));
assert.equal(conservativeUSD, terminal.cumulativeConservativeSpendUSD);
const remainingUSD = Number((8 - conservativeUSD).toFixed(6));
const environment = { ...researchRequestEnvelopeEnvironment,
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra" };
const { buildAnswerRequest } = await buildResearchRequestEnvelopeBuilders(environment);
const ownerBytes = await readFile(new URL("evals/research-owner-code-candidates.json", root));
const cases = JSON.parse(ownerBytes).cases;
assert.equal(cases.length, 60);
const registry = createResearchCorpusRegistry();
const results = [];
const bytes = (value) => Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value));
for (const item of cases) {
  const assembled = await assembledResearchEvidenceForTurn({ question: item.question, messages: [], pinnedEvidence: [], projectFacts: [] });
  const evidence = assembled.sources;
  assert(evidence.length);
  const requiredClaims = requiredResearchClaimsFromEvidence(evidence);
  const codeBasis = resolveResearchCodeBasis({ availableCorpora: registry,
    corpusPlan: routeResearchCorpora({ question: item.question, registry }), resolvedAt: "2026-09-08T12:00:00.000Z" });
  const webSupportRequested = researchWebSupportTrigger({ question: item.question,
    outsideLibraryRequired: researchDiscoveryNeedsAutomaticWebSupport(assembled.discovery)
  }, { PERMITEXT_RESEARCH_WEB_SUPPORT: "1" }).useWeb;
  const routing = routeResearchAnswerModel({ question: item.question, evidence, requiredClaims, codeBasis, webSupportRequested, environment });
  const body = buildAnswerRequest(item.question, evidence, "synthetic-owner-envelope", {
    model: routing.model, responseStyle: "conversational", requiredClaims, codeBasis,
    structuredEvidenceAnalysis: deterministicResearchEvidenceAnalysisForTurn(evidence, [])
  });
  let initialRequestCeilingUSD = null;
  let reservationError = null;
  beginResearchSpendReservation({ id: `offline-${item.id}` }, environment);
  try { initialRequestCeilingUSD = reserveResearchProviderSpend(body, environment).maximumRequestUSD; }
  catch (error) { assert.equal(error.code, "RESEARCH_SPEND_CAP"); reservationError = error.code; }
  finally { endResearchSpendReservation(); }
  results.push({ id: item.id, question: item.question, previouslyAttempted: attemptedIDs.has(item.id),
    model: routing.model, routingReasons: routing.reasons, sourceCount: evidence.length, webSupportRequested,
    requestBytes: bytes(body), instructionBytes: bytes(body.instructions), inputBytes: bytes(body.input), schemaBytes: bytes(body.text),
    enactedTextBytes: evidence.reduce((sum, source) => sum + bytes(source.text), 0), maxOutputTokens: body.max_output_tokens,
    initialRequestCeilingUSD, reservationError,
    initialRequestFitsRemainingAuthorization: initialRequestCeilingUSD !== null && initialRequestCeilingUSD <= remainingUSD });
}
assert.equal(networkAttempts, 0);
const report = { schema: "permitext-owner-request-envelope-diagnostic-v1", checkedOn: "2026-09-08",
  scope: "All 60 question-only owner cases using actual source assembly, routing and answer request builders. This measures an initial draft request, not a complete service turn, latency, generated answer quality, a returned web payload or a revision. No provider or network requests. Standard pricing is a local versioned fixture, not a live Production read.",
  sourceSHA256: { "app.mjs": hash(await readFile(new URL("app.mjs", root))),
    "tests/research-request-envelope-preflight.mjs": hash(await readFile(new URL("tests/research-request-envelope-preflight.mjs", root))),
    "evals/research-owner-code-candidates.json": hash(ownerBytes) },
  conservativeUSD, remainingUSD, providerCalls: 0, networkAttempts,
  results };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) { assert(process.argv[outputIndex + 1]); await writeFile(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
console.log(JSON.stringify({ conservativeUSD, remainingUSD, providerCalls: 0, networkAttempts,
  candidateInitialRequests: results.filter((item) => (!item.previouslyAttempted || item.id === "PC-04") && item.initialRequestFitsRemainingAuthorization)
    .sort((a, b) => a.initialRequestCeilingUSD - b.initialRequestCeilingUSD).map(({id,model,webSupportRequested,initialRequestCeilingUSD}) => ({id,model,webSupportRequested,initialRequestCeilingUSD})),
  plumbing: results.filter((item) => ["PC-04", "PC-10", "PC-11", "PC-13"].includes(item.id)) }, null, 2));
