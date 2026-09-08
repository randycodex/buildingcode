// Bounded confirmation of actual routing failures and visible material conditions.
// Default: no-network preflight. The permanent result file prevents replay.
import assert from "node:assert/strict";
import { ownerResearchNextTurnBudget } from "../evals/research-owner-batch-budget.mjs";
import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, open, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";

const serverRoot = new URL("../", import.meta.url);
const ownerBytes = await readFile(new URL("evals/research-owner-code-candidates.json", serverRoot));
const ownerCases = JSON.parse(ownerBytes).cases;
const cases = ["MC-02", "PC-01", "PC-03"].map((id) => {
  const item = ownerCases.find((item) => item.id === id);
  assert(item?.question);
  return { id, conversation: id, question: item.question };
});
const previousPackages = [
  ["pilot-2026-09-07", 8, 14], ["source-confirmation-v2-2026-09-08", 8, 18],
  ["far-confirmation-2026-09-08", 1, 2], ["quality-confirmation-2026-09-08", 6, 12],
  ["scope-confirmation-v2-2026-09-08", 2, 4], ["document-summary-confirmation-2026-09-08", 2, 4],
  ["fixture-confirmation-2026-09-08", 2, 5], ["technical-expansion-2026-09-08", 5, 11],
  ["attribution-confirmation-2026-09-08", 3, 9], ["premise-expansion-2026-09-08", 13, 28]
];
let previousConservativeSpendUSD = 0;
const previousResultHashes = [];
for (const [suffix, turns, calls] of previousPackages) {
  const file = `evals/results/research-owner-live-${suffix}.json`;
  const bytes = await readFile(new URL(file, serverRoot));
  const run = JSON.parse(bytes);
  assert.equal(run.status, "completed");
  assert.equal(run.results.length, turns);
  assert.equal(run.providerCalls.length, calls);
  const operations = run.results.flatMap((item) => item.operations || []);
  assert.equal(operations.length, turns);
  assert(operations.every((op) => op.pendingProviderRequestCount === 0 && Number.isFinite(op.conservativeProviderCostUSD) &&
    (["completed", "failed"].includes(op.status) ||
      (op.status === "rejected" && op.providerRequestCount === 0 && op.conservativeProviderCostUSD === 0))));
  previousConservativeSpendUSD += operations.reduce((sum, op) => sum + op.conservativeProviderCostUSD, 0);
  previousResultHashes.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
}
previousConservativeSpendUSD = Number(previousConservativeSpendUSD.toFixed(6));
assert.equal(previousConservativeSpendUSD, 6.336181);
const profile = {
  schema: "permitext-owner-routing-confirmation-20260908-v1",
  authorization: "Owner: approximately $8 available for API testing; test as many times as needed. One attempt each for two repaired routing failures and one visible-condition confirmation, capped at $0.80 conservative aggregate with no manual retries.",
  previousConservativeSpendUSD, previousResultHashes,
  ownerDatasetSHA256: createHash("sha256").update(ownerBytes).digest("hex"),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: serverRoot, encoding: "utf8" }).trim(),
  execution: "Isolated local HTTP Research conversations with live OpenAI responses; automatic evidence discovery; no reference answers supplied to the answering model.",
  maximumCumulativeSpendUSD: 0.80,
  maximumTurnSpendUSD: 0.50,
  maximumTurns: 3, authorizationUSD: 8,
  turnBudgetPolicy: "Cap each complete provider pipeline at the lesser of $0.50 and the remaining settled conservative $0.80 batch budget. Missing or pending accounting stops all further requests.",
  repetitions: 1, separateJudgeRequests: 0, manualRetries: 0,
  pricingSource: "https://developers.openai.com/api/docs/pricing", pricingCheckedOn: "2026-09-08",
  routing: "Existing hybrid Luna/Terra routing; general answers medium reasoning; standard service tier",
  zoning: "Local diagnostic eligibility only; no public gate or deployment changes",
  cases
};
assert.equal(cases.length, profile.maximumTurns);
const nextBudget = (operations = []) => ownerResearchNextTurnBudget({
  previousConservativeUSD: previousConservativeSpendUSD, operations,
  authorizationUSD: profile.authorizationUSD, maximumBatchUSD: profile.maximumCumulativeSpendUSD,
  maximumTurnUSD: profile.maximumTurnSpendUSD
});
nextBudget();
const preflightURL = new URL("evals/results/research-owner-routing-confirmation-preflight-2026-09-08.json", serverRoot);
if (!process.argv.includes("--run-live")) {
  process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
  process.env.PERMITEXT_RUN_PAID_RESEARCH_EVALS = "0";
  let networkAttempts = 0;
  globalThis.fetch = async () => { networkAttempts += 1; throw new Error("No network is allowed in the preflight."); };
  const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
  const { createResearchCorpusRegistry, routeResearchCorpora } = await import("../research-corpus-registry.mjs");
  const review = JSON.parse(await readFile(new URL("evals/results/research-owner-code-source-review-2026-09-08.json", serverRoot)));
  const results = [];
  for (const item of cases) {
    const assembled = await assembledResearchEvidenceForTurn({ question: item.question, messages: [], pinnedEvidence: [], projectFacts: [] });
    const references = review.cases.find((candidate) => candidate.id === item.id).sourceReferences;
    const sources = assembled.sources.map((source) => ({
      reference: `${source.codePrefix} ${source.sectionNumber}`, sourceID: source.sourceID,
      canonicalContextComplete: source.canonicalContextComplete === true,
      characters: source.text.length, textSHA256: createHash("sha256").update(source.text).digest("hex")
    }));
    const missingReferences = references.filter((reference) => !sources.some((source) => source.reference === reference));
    assert.equal(missingReferences.length, 0, `${item.id}: missing ${missingReferences.join(", ")}`);
    assert(references.every((reference) => sources.some((source) => source.reference === reference && source.canonicalContextComplete)), `${item.id}: incomplete governing reference`);
    const requiredReferences = assembled.sources.filter((source) => source.evidencePriority?.claimCoverageRequired)
      .map((source) => `${source.codePrefix} ${source.sectionNumber}`);
    const selectedCorpora = routeResearchCorpora({ question: item.question,
      registry: createResearchCorpusRegistry({ zoningResearchEligibility: true }) }).selected.map((corpus) => corpus.id);
    if (item.id === "MC-02") assert.deepEqual(selectedCorpora, ["nyc-2022-construction-codes"]);
    if (item.id === "PC-01") {
      for (const reference of ["BC 1004.1", "BC 1004.3", "BC 303.1.3", "PC 403.1.2"]) assert(!requiredReferences.includes(reference));
      for (const reference of ["PC 403.2", "PC 403.3"]) assert(requiredReferences.includes(reference));
    }
    results.push({ id: item.id, references, missingReferences, sources, requiredReferences, selectedCorpora });
  }
  assert.equal(networkAttempts, 0);
  await writeFile(preflightURL, `${JSON.stringify({ schema: "permitext-owner-routing-preflight-v1", sourceCommit: profile.sourceCommit, cases, results, networkAttempts, providerCalls: 0 }, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ status: "preflight-passed-no-network", ...profile, preflight: preflightURL.pathname }, null, 2));
  process.exit(0);
}
const preflightBytes = await readFile(preflightURL);
const preflight = JSON.parse(preflightBytes);
assert.equal(preflight.sourceCommit, profile.sourceCommit, "Run the no-network preflight on this exact committed source first.");
assert.deepEqual(preflight.cases, cases);
assert.equal(preflight.providerCalls, 0);
assert.equal(preflight.networkAttempts, 0);
assert.equal(preflight.results.length, cases.length);
assert(preflight.results.every((item) => item.missingReferences.length === 0));
profile.preflightSHA256 = createHash("sha256").update(preflightBytes).digest("hex");
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "*.mjs", "*.json"], { cwd: serverRoot, encoding: "utf8" }), "", "Tracked runtime source must remain unchanged before the pilot.");
const local = parseEnv(await readFile(new URL(".env.local", serverRoot), "utf8"));
assert(local.OPENAI_API_KEY && local.OPENAI_API_KEY !== "[SENSITIVE]", "A real local API credential is required.");
const resultURL = new URL("evals/results/research-owner-live-routing-confirmation-2026-09-08.json", serverRoot);
const lock = await open(resultURL, "wx", 0o600);
await lock.close();
const scratch = await mkdtemp(join(tmpdir(), "permitext-owner-routing-confirmation-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  OPENAI_API_KEY: local.OPENAI_API_KEY,
  NODE_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "sync-store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "private-assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: String(profile.maximumTurnSpendUSD),
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_DAILY_CAP_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: String(profile.maximumTurns),
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_OFFICIAL_DOMAINS: "nyc.gov,ny.gov,rules.cityofnewyork.us,ada.gov",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12",
  PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-20260908-terra",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-20260908-luna"
});
const result = { ...profile, startedAt: new Date().toISOString(), status: "running", results: [], providerCalls: [] };
const persist = () => writeFile(resultURL, `${JSON.stringify(result, null, 2)}\n`);
await persist();
const nativeFetch = globalThis.fetch;
let activeCase = null;
globalThis.fetch = async (url, options) => {
  if (String(url) !== "https://api.openai.com/v1/responses") return nativeFetch(url, options);
  const body = JSON.parse(options.body);
  const entry = { caseID: activeCase, model: body.model, phase: body.tools?.length ? "web_support" : body.text?.format?.name, requestBytes: Buffer.byteLength(options.body), maxOutputTokens: body.max_output_tokens, startedAt: new Date().toISOString() };
  result.providerCalls.push(entry);
  await persist();
  const start = performance.now();
  try {
    const response = await nativeFetch(url, options);
    const payload = await response.clone().json();
    Object.assign(entry, { httpStatus: response.status, durationMilliseconds: Math.round(performance.now() - start), usage: payload.usage || null, serviceTier: payload.service_tier, output: payload.output?.filter((item) => ["message", "web_search_call"].includes(item.type)), incompleteDetails: payload.incomplete_details, errorCode: payload.error?.code });
    return response;
  } catch (error) {
    Object.assign(entry, { durationMilliseconds: Math.round(performance.now() - start), errorCode: error.code || error.name });
    throw error;
  } finally { await persist(); }
};
const config = await import("../research-config.mjs");
config.validatePaidResearchEvaluationEnvironment();
assert.equal(config.researchSpendGuardrails().ready, true);
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
async function request(path, body, token) {
  const response = await nativeFetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) { const error = new Error(payload.error || "Request failed"); error.status = response.status; error.payload = payload; throw error; }
  return payload;
}
try {
  const { account } = await request("/account/sign-in", { credential: { provider: "web", providerUserID: `pilot-${randomUUID()}`, displayName: "Isolated Research Pilot" } });
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  const token = account.backendSessionToken;
  const conversations = new Map();
  const seen = new Set();
  for (const item of cases) {
    const budget = nextBudget(result.results.flatMap((item) => item.operations || []));
    if (!budget.maximumNextTurnUSD) throw new Error("Conservative aggregate budget exhausted before the next turn.");
    process.env.PERMITEXT_RESEARCH_MAX_REQUEST_USD = String(budget.maximumNextTurnUSD);
    activeCase = item.id;
    if (!conversations.has(item.conversation)) {
      const created = await request("/research/conversations/create", { auth }, token);
      conversations.set(item.conversation, created.conversation.id);
    }
    const entry = { id: item.id, question: item.question, maximumTurnSpendUSD: budget.maximumNextTurnUSD, status: "running", startedAt: new Date().toISOString() };
    result.results.push(entry);
    await persist();
    console.log(`Starting ${item.id} (${result.results.length}/${cases.length}).`);
    const start = performance.now();
    try {
      const payload = await request("/research/conversations/message", { auth, conversationID: conversations.get(item.conversation), question: item.question, requestID: randomUUID() }, token);
      entry.answer = [...payload.conversation.messages].reverse().find((m) => m.role === "assistant")?.answer;
      entry.status = entry.answer ? "completed" : "missing-answer";
    } catch (error) { entry.status = "failed"; entry.error = { message: error.message, httpStatus: error.status, ...error.payload }; }
    entry.durationMilliseconds = Math.round(performance.now() - start);
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    const operations = telemetry.researchSpend.operationMetrics.filter((o) => !seen.has(o.id));
    entry.operations = operations;
    operations.forEach((o) => seen.add(o.id));
    assert(operations.length === 1 && operations[0].conservativeProviderCostUSD <= budget.maximumNextTurnUSD + 1e-6);
    nextBudget(result.results.flatMap((item) => item.operations || []));
    result.spend = config.researchEvaluationSpendStatus();
    result.cumulativeConservativeSpendUSD = Number((previousConservativeSpendUSD + result.results.flatMap((item) => item.operations || []).reduce((sum, operation) => sum + operation.conservativeProviderCostUSD, 0)).toFixed(6));
    assert(Number.isFinite(result.cumulativeConservativeSpendUSD) && result.cumulativeConservativeSpendUSD <= 8, "Stop at the owner's cumulative authorization.");
    await persist();
    console.log(`${item.id}: ${entry.status}, ${entry.durationMilliseconds} ms; token estimate $${result.spend.actualUSD.toFixed(6)} cumulative.`);
    assert(operations.length > 0, "Missing operation telemetry; stop before any further spend.");
    assert(operations.every((o) => o.pendingProviderRequestCount === 0), "Unsettled provider request; stop before any further spend.");
    if (result.providerCalls.some((call) => call.errorCode === "insufficient_quota" || call.httpStatus === 401)) throw new Error("Provider account limit or authentication failure; remaining cases skipped.");
    if (JSON.stringify(entry.error || {}).includes("SPEND_CAP")) throw new Error("Spending guard stopped this pilot; remaining cases skipped.");
  }
  result.status = "completed";
} catch (error) { result.status = "stopped"; result.stopReason = error.message; }
finally {
  result.completedAt = new Date().toISOString();
  result.spend = config.researchEvaluationSpendStatus();
  await persist();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = nativeFetch;
}
console.log(JSON.stringify({ status: result.status, attemptedTurns: result.results.length, providerCalls: result.providerCalls.length, spend: result.spend, result: resultURL.pathname }));
