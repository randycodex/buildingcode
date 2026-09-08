// One bounded owner-authorized answer-quality confirmation after technical source and presentation repairs.
// Default is a no-network preflight. The permanent result file prevents replay.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, open, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";

const serverRoot = new URL("../", import.meta.url);
const keyBytes = await readFile(new URL("evals/research-reconciled-answer-key.json", serverRoot));
const key = JSON.parse(keyBytes);
const question = (id) => {
  const item = key.cases.find((item) => item.id === id);
  assert(item);
  return [item.scenario, item.question].filter(Boolean).join("\n\n");
};
const ownerBytes = await readFile(new URL("evals/research-owner-code-candidates.json", serverRoot));
const ownerCases = JSON.parse(ownerBytes).cases;
const ownerIDs = ["FGC-02", "MC-01", "GAP-11", "PC-12"];
const cases = [
  ...ownerIDs.map((id) => {
    const item = ownerCases.find((item) => item.id === id);
    assert(item?.question);
    return { id, conversation: id, question: item.question };
  }),
  { id: "ZR-08", conversation: "far", question: question("ZR-08") },
  { id: "CC-03", conversation: "assembly", question: question("CC-03") }
];
const previous = JSON.parse(await readFile(new URL("evals/results/research-owner-live-pilot-2026-09-07.json", serverRoot)));
assert.equal(previous.status, "completed");
const previousOperations = previous.results.flatMap((item) => item.operations || []);
assert(previousOperations.every((item) => item.pendingProviderRequestCount === 0));
const earlierPilotConservativeSpendUSD = previousOperations.reduce((sum, item) => sum + item.conservativeProviderCostUSD, 0);
assert(Number.isFinite(earlierPilotConservativeSpendUSD) && earlierPilotConservativeSpendUSD <= 1.066);
const confirmationBytes = await readFile(new URL("evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json", serverRoot));
const confirmation = JSON.parse(confirmationBytes);
assert.equal(confirmation.status, "completed");
assert.equal(confirmation.results.length, 8);
assert.equal(confirmation.providerCalls.length, 18);
assert.equal(confirmation.spend.pendingRequestCount, 0);
const confirmationOperations = confirmation.results.flatMap((item) => item.operations || []);
assert.equal(confirmationOperations.length, 8);
assert(confirmationOperations.every((item) => item.pendingProviderRequestCount === 0));
const farBytes = await readFile(new URL("evals/results/research-owner-live-far-confirmation-2026-09-08.json", serverRoot));
const far = JSON.parse(farBytes);
assert.equal(far.status, "completed");
assert.equal(far.spend.pendingRequestCount, 0);
assert.equal(far.providerCalls.length, 2);
const farOperations = far.results.flatMap((item) => item.operations || []);
assert.equal(farOperations.length, 1);
assert(farOperations.every((item) => item.pendingProviderRequestCount === 0));
const previousConservativeSpendUSD = Number((earlierPilotConservativeSpendUSD + [...confirmationOperations, ...farOperations].reduce((sum, item) => sum + item.conservativeProviderCostUSD, 0)).toFixed(6));
assert(Number.isFinite(previousConservativeSpendUSD) && previousConservativeSpendUSD <= 2.25);
const stoppedBytes = await readFile(new URL("evals/results/research-owner-live-source-confirmation-2026-09-08.json", serverRoot));
const stopped = JSON.parse(stoppedBytes);
assert.equal(stopped.status, "stopped");
assert.equal(stopped.providerCalls.length, 0, "The earlier guard stop must have dispatched no external requests.");
assert.equal(stopped.spend.actualUSD, 0);
assert.equal(stopped.results.length, 1);
assert.equal(stopped.results[0].error.code, "RESEARCH_SPEND_CAP");
const stoppedOperations = stopped.results.flatMap((item) => item.operations || []);
assert(stoppedOperations.length > 0);
assert(stoppedOperations.every((item) => item.providerRequestCount === 0 && item.pendingProviderRequestCount === 0 && item.actualProviderCostUSD === 0 && item.conservativeProviderCostUSD === 0));
assert(previousConservativeSpendUSD + 6 * 0.85 <= 8, "Retain the owner's total authorization across runs.");
const profile = {
  schema: "permitext-owner-answer-quality-confirmation-20260908-v1",
  authorization: "Owner: approximately $8 available for API testing; test as many times as needed. This package is limited to six turns after verified source and presentation repairs, one attempt per case.",
  previousConservativeSpendUSD,
  priorFarResultSHA256: createHash("sha256").update(farBytes).digest("hex"),
  priorConfirmationResultSHA256: createHash("sha256").update(confirmationBytes).digest("hex"),
  priorZeroCallResultSHA256: createHash("sha256").update(stoppedBytes).digest("hex"),
  priorZeroCallResult: "research-owner-live-source-confirmation-2026-09-08.json",
  priorZeroCallExplanation: "First turn rejected before dispatch; zero provider calls and costs. The stale evaluation reservation was bookkeeping, not incurred spend.",
  ownerCandidateSHA256: createHash("sha256").update(ownerBytes).digest("hex"),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: serverRoot, encoding: "utf8" }).trim(),
  keySHA256: createHash("sha256").update(keyBytes).digest("hex"),
  execution: "Isolated local HTTP Research conversations with live OpenAI responses; automatic evidence discovery; no reference answers supplied to the answering model.",
  maximumCumulativeSpendUSD: 5.2,
  maximumTurnSpendUSD: 0.85,
  maximumTurns: 6,
  absoluteTurnSumCeilingUSD: 5.1,
  repetitions: 1,
  separateJudgeRequests: 0,
  manualRetries: 0,
  pricingSource: "https://developers.openai.com/api/docs/pricing",
  pricingCheckedOn: "2026-09-08",
  routing: "Existing hybrid Luna/Terra routing, medium reasoning, standard service tier",
  zoning: "Local diagnostic eligibility only; no public gate or deployment changes",
  cases
};
assert.equal(cases.length, profile.maximumTurns);
assert(cases.length * profile.maximumTurnSpendUSD < profile.maximumCumulativeSpendUSD);
if (!process.argv.includes("--run-live")) {
  console.log(JSON.stringify({ status: "preflight-passed-no-network", ...profile }, null, 2));
  process.exit(0);
}
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "*.mjs", "*.json"], { cwd: serverRoot, encoding: "utf8" }), "", "Tracked runtime source must remain unchanged before the pilot.");
const local = parseEnv(await readFile(new URL(".env.local", serverRoot), "utf8"));
assert(local.OPENAI_API_KEY && local.OPENAI_API_KEY !== "[SENSITIVE]", "A real local API credential is required.");
const resultURL = new URL("evals/results/research-owner-live-quality-confirmation-2026-09-08.json", serverRoot);
const lock = await open(resultURL, "wx", 0o600);
await lock.close();
const scratch = await mkdtemp(join(tmpdir(), "permitext-owner-quality-confirmation-"));
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
  PERMITEXT_RESEARCH_EVAL_MAX_USD: "5.2",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5.2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "5.2",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "5.2",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "5.2",
  PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: "6",
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
    activeCase = item.id;
    if (!conversations.has(item.conversation)) {
      const created = await request("/research/conversations/create", { auth }, token);
      conversations.set(item.conversation, created.conversation.id);
    }
    const entry = { id: item.id, question: item.question, status: "running", startedAt: new Date().toISOString() };
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
