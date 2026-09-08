// One-use, bounded production-verifier diagnostic. Default is no-network preflight.
import assert from "node:assert/strict";
import { readFile, writeFile, open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import { ownerResearchNextTurnBudget } from "../evals/research-owner-batch-budget.mjs";
import { decisionFactVerifierInput } from "../evals/research-decision-fact-fixtures.mjs";
import { researchDecisionFactFixturesV2, assessDecisionFactVerifierResult } from "../evals/research-decision-fact-fixtures-v2.mjs";
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from "../tests/research-request-envelope-preflight.mjs";
import { openAIResearchVerification } from "../app.mjs";
import * as config from "../research-config.mjs";

const root = new URL("../", import.meta.url);
const nativeFetch = globalThis.fetch;
let preflightNetworkAttempts = 0;
globalThis.fetch = async () => { preflightNetworkAttempts++; throw new Error("Network forbidden before live dispatch."); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const terminalFile = "evals/results/research-owner-live-decision-fact-verifier-2026-09-08.json";
const terminalBytes = await readFile(new URL(terminalFile, root));
const terminal = JSON.parse(terminalBytes);
const previousResultHashes = [...terminal.previousResultHashes, { file: terminalFile, sha256: hash(terminalBytes) }];
assert.equal(previousResultHashes.length, 17);
assert.equal(new Set(previousResultHashes.map((entry) => entry.file)).size, 17);
let previousConservativeSpendUSD = 0;
for (const entry of previousResultHashes) {
  const bytes = await readFile(new URL(entry.file, root));
  assert.equal(hash(bytes), entry.sha256);
  const run = JSON.parse(bytes);
  assert(["completed", "stopped"].includes(run.status));
  for (const item of run.results) for (const operation of item.operations || []) {
    assert.equal(operation.pendingProviderRequestCount, 0);
    const zeroCallRejection = operation.status === "rejected" && operation.providerRequestCount === 0 &&
      !run.providerCalls.some((call) => call.caseID === item.id) && operation.conservativeProviderCostUSD === null;
    assert(zeroCallRejection || (["completed", "failed"].includes(operation.status) && Number.isFinite(operation.conservativeProviderCostUSD)));
    previousConservativeSpendUSD += operation.conservativeProviderCostUSD || 0;
  }
}
previousConservativeSpendUSD = Number(previousConservativeSpendUSD.toFixed(6));
assert.equal(previousConservativeSpendUSD, 7.789744);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const profile = { schema: "permitext-decision-fact-verifier-diagnostic-v2", sourceCommit,
  authorization: "Owner authorized repeated Research testing within approximately $8 total. This package uses at most $0.21 of the remaining $0.210256 conservative allowance for six production-verifier checks of the exact delivered laundry answer, its fact correction, a broken citation, unresolved applicability, a mixed entry and a proposed-layout review.",
  previousResultHashes, previousConservativeSpendUSD, authorizationUSD: 8, maximumCumulativeSpendUSD: .21,
  maximumTurnSpendUSD: .21, maximumChecks: 6, maximumProviderRequests: 12,
  scope: "Production verifier only; no answering-model generation, new user Research delivery, web search, paid benchmark scoring, manual retry, deployment or professional approval. Native provider-client retries remain bounded by the same conservative ledger.",
  originalFullHTTPTurnAttempts: 66, originalProviderCalls: 146, originalVerifierOnlyChecks: 7,
  pricingSource: "Versioned local standard-price fixture in tests/research-request-envelope-preflight.mjs; not a provider invoice or account balance." };
const nextBudget = (operations) => ownerResearchNextTurnBudget({ previousConservativeUSD: previousConservativeSpendUSD, operations,
  authorizationUSD: 8, maximumBatchUSD: .21, maximumTurnUSD: .21 });
nextBudget([]);
const environment = { ...researchRequestEnvelopeEnvironment, PERMITEXT_RESEARCH_MAX_REQUEST_USD: ".21",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".20", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "1.20", PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1" };
// No API key is read while assembling fixtures or building the preflight.
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
const fixtures = await researchDecisionFactFixturesV2();
assert.equal(fixtures.length, profile.maximumChecks);
const { buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders(environment);
const preflightURL = new URL("evals/results/research-decision-fact-verifier-v2-preflight-2026-09-08.json", root);
const preflightEntries = [];
for (const fixture of fixtures) {
  const input = decisionFactVerifierInput(fixture);
  const requestBody = { ...buildVerifierRequest(input.question, input.evidence, input.answer, "decision-fact-verifier", input.options), service_tier: "default" };
  assert.equal(requestBody.model, "gpt-5.6-luna");
  assert.equal(requestBody.text.format.name, "permitext_research_verification");
  assert.equal(requestBody.tools, undefined);
  assert.equal(requestBody.max_output_tokens, 4000);
  let maximumRequestUSD;
  config.beginResearchSpendReservation({ id: fixture.id }, environment);
  try { maximumRequestUSD = config.reserveResearchProviderSpend(requestBody, environment).maximumRequestUSD; }
  finally { config.endResearchSpendReservation(); }
  preflightEntries.push({ id: fixture.id, expectedPass: fixture.expectedPass, expectedIssueTypes: fixture.expectedIssueTypes, expectedRepairApplied: fixture.expectedRepairApplied,
    expectedMissingFactIndices: fixture.expectedMissingFactIndices || [], purpose: fixture.purpose,
    requestBodySHA256: hash(JSON.stringify(requestBody)), requestBytes: Buffer.byteLength(JSON.stringify(requestBody)), maximumRequestUSD });
}
assert(preflightEntries.reduce((sum, item) => sum + item.maximumRequestUSD, 0) < .21);
const preflightPayload = { ...profile, fixtureSourceSHA256: hash(await readFile(new URL("evals/research-decision-fact-fixtures-v2.mjs", root))),
  appSHA256: hash(await readFile(new URL("app.mjs", root))), entries: preflightEntries, networkAttempts: preflightNetworkAttempts };
assert.equal(preflightNetworkAttempts, 0);
if (!process.argv.includes("--run-live")) {
  await writeFile(preflightURL, JSON.stringify({ ...preflightPayload, providerCalls: 0 }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: "preflight-passed-no-provider", sourceCommit, entries: preflightEntries, capUSD: .21 }));
  process.exit(0);
}
const preflightBytes = await readFile(preflightURL);
const { providerCalls: preflightCalls, ...retainedPreflight } = JSON.parse(preflightBytes);
assert.equal(preflightCalls, 0);
assert.deepEqual(retainedPreflight, preflightPayload, "Require the exact committed-source preflight and identical request bodies.");
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "*.mjs", "*.json"], { cwd: root, encoding: "utf8" }), "");
const local = parseEnv(await readFile(new URL(".env.local", root), "utf8"));
assert(local.OPENAI_API_KEY && local.OPENAI_API_KEY !== "[SENSITIVE]");
const resultURL = new URL("evals/results/research-owner-live-decision-fact-verifier-v2-2026-09-08.json", root);
const lock = await open(resultURL, "wx", 0o600);
await lock.close();
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL)/.test(name)) delete process.env[name];
Object.assign(process.env, environment, { OPENAI_API_KEY: local.OPENAI_API_KEY, PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1", PERMITEXT_RESEARCH_EVAL_MAX_USD: ".21" });
config.validatePaidResearchEvaluationEnvironment();
const result = { ...profile, preflightSHA256: hash(preflightBytes), status: "running", startedAt: new Date().toISOString(), results: [], providerCalls: [] };
const persist = () => writeFile(resultURL, JSON.stringify(result, null, 2) + "\n");
await persist();
let activeCase;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  assert(result.providerCalls.length < profile.maximumProviderRequests);
  const body = JSON.parse(options.body);
  assert.equal(hash(options.body), preflightEntries.find((entry) => entry.id === activeCase).requestBodySHA256,
    "Abort before network if the actual production request differs from preflight.");
  const call = { caseID: activeCase, phase: body.text.format.name, model: body.model, requestBytes: Buffer.byteLength(options.body), startedAt: new Date().toISOString() };
  result.providerCalls.push(call);
  await persist();
  const started = performance.now();
  try {
    const response = await nativeFetch(url, options);
    const payload = await response.clone().json();
    Object.assign(call, { httpStatus: response.status, usage: payload.usage || null, serviceTier: payload.service_tier,
      output: payload.output?.filter((item) => item.type === "message"), incompleteDetails: payload.incomplete_details, errorCode: payload.error?.code });
    return response;
  } catch (error) { call.errorCode = error.code || error.name; throw error; }
  finally { call.durationMilliseconds = Math.round(performance.now() - started); await persist(); }
};
try {
  for (const fixture of fixtures) {
    const budget = nextBudget(result.results.flatMap((item) => item.operations));
    if (preflightEntries.find((entry) => entry.id === fixture.id).maximumRequestUSD > budget.maximumNextTurnUSD)
      throw new Error("Remaining budget cannot reserve the next verifier request; stop before dispatch.");
    process.env.PERMITEXT_RESEARCH_MAX_REQUEST_USD = String(budget.maximumNextTurnUSD);
    activeCase = fixture.id;
    const entry = { id: fixture.id, sourceCaseID: fixture.sourceCaseID, scope: "verifier-only", expectedPass: fixture.expectedPass,
      expectedIssueTypes: fixture.expectedIssueTypes, expectedRepairApplied: fixture.expectedRepairApplied, expectedMissingFactIndices: fixture.expectedMissingFactIndices || [], purpose: fixture.purpose, status: "running", operations: [] };
    result.results.push(entry);
    await persist();
    config.beginResearchSpendReservation({ id: `decision-fact-${fixture.id}` });
    const started = performance.now();
    try {
      const input = decisionFactVerifierInput(fixture);
      const output = await openAIResearchVerification(input.question, input.evidence, input.answer, "decision-fact-verifier", input.options);
      entry.verification = output.result;
      Object.assign(entry, assessDecisionFactVerifierResult(fixture, output.result));
      entry.status = "completed";
    } catch (error) { entry.status = "failed"; entry.error = { code: error.code || error.name, message: error.message }; }
    finally {
      const settled = config.endResearchSpendReservation();
      assert(settled);
      entry.durationMilliseconds = Math.round(performance.now() - started);
      entry.operations.push({ id: settled.id, status: entry.status, providerRequestCount: settled.providerRequestCount,
        pendingProviderRequestCount: settled.pendingProviderReservationCount, conservativeProviderCostUSD: settled.reservedUSD, estimatedTokenCostUSD: settled.actualUSD });
      result.spend = config.researchEvaluationSpendStatus();
      result.cumulativeConservativeSpendUSD = Number((previousConservativeSpendUSD + result.results.flatMap((item) => item.operations).reduce((sum, operation) => sum + operation.conservativeProviderCostUSD, 0)).toFixed(6));
      await persist();
    }
    nextBudget(result.results.flatMap((item) => item.operations));
    console.log(JSON.stringify({ id: entry.id, status: entry.status, expectationMatched: entry.expectationMatched, verification: entry.verification }));
    if (entry.status === "failed") throw new Error("Verifier request failed; remaining checks skipped.");
  }
  result.status = "completed";
} catch (error) { result.status = "stopped"; result.stopReason = error.message; }
finally { result.completedAt = new Date().toISOString(); result.spend = config.researchEvaluationSpendStatus(); await persist(); globalThis.fetch = nativeFetch; }
console.log(JSON.stringify({ status: result.status, checks: result.results.length, matched: result.results.filter((item) => item.expectationMatched).length,
  providerCalls: result.providerCalls.length, cumulativeConservativeSpendUSD: result.cumulativeConservativeSpendUSD }));
