// Confirm the repaired divided-lot temporal application once through isolated Research HTTP with existing routing.
// Default intercepts provider dispatch at no cost. --run-live is single-use.
import assert from "node:assert/strict";
import { readFile, writeFile, open, mkdtemp } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { ownerHTTPResearchRequestHash } from "../evals/research-owner-http-request-binding.mjs";

const root = new URL("../", import.meta.url);
const live = process.argv.includes("--run-live");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const terminalFile = "evals/results/research-owner-live-zoning-expansion-2026-09-08.json";
const terminalBytes = await readFile(new URL(terminalFile, root));
const terminal = JSON.parse(terminalBytes);
const previousResultHashes = [...terminal.previousResultHashes, { file: terminalFile, sha256: hash(terminalBytes) }];
assert.equal(previousResultHashes.length, 22);
let previousConservativeSpendUSD = 0;
const attempted = new Set();
for (const entry of previousResultHashes) {
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
      previousConservativeSpendUSD += operation.conservativeProviderCostUSD || 0;
    }
  }
}
previousConservativeSpendUSD = Number(previousConservativeSpendUSD.toFixed(6));
assert.equal(previousConservativeSpendUSD, 7.887898);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const keyBytes = await readFile(new URL("evals/research-reconciled-answer-key.json", root));
const key = JSON.parse(keyBytes);
// A new, single-use confirmation of the implemented repair; the previous run is retained.
const caseIDs = ["ZR-18"];
assert(caseIDs.every((id) => attempted.has(id)), "This package confirms the previously reviewed divided-lot case.");
const profile = { schema: "permitext-owner-zoning-temporal-confirmation-v1", sourceCommit,
  authorization: "Owner authorized approximately $8 of API tests and repeated testing toward the 110-case answer target. This new package attempts ZR-18 once after implementing and checking the source-derived temporal application guard, within the existing remaining authorization; it cannot replay a consumed package.",
  previousResultHashes, previousConservativeSpendUSD, authorizationUSD: 8,
  maximumCumulativeSpendUSD: 0.112102, maximumTurnSpendUSD: 0.06, maximumTurns: 1, maximumProviderRequests: 3,
  repetitions: 1, separateJudgeRequests: 0, manualRetries: 0,
  keySHA256: hash(keyBytes),
  pricingSource: "https://developers.openai.com/api/docs/pricing", pricingCheckedOn: "2026-09-08",
  routing: "Existing hybrid Luna/Terra routing and production verification/repair policy, subject to the lower evaluation spending cap; standard service tier. No forced model substitution.",
  scope: "Actual selected-section HTTP Research flow on isolated local accounts and storage. Expected answers are not supplied to drafting or verification. Local diagnostic Zoning eligibility only; no public eligibility, deployment, or phone changes.",
  cases: caseIDs };
assert(previousConservativeSpendUSD + profile.maximumCumulativeSpendUSD <= 8);
assert(profile.maximumTurnSpendUSD * profile.maximumTurns <= profile.maximumCumulativeSpendUSD);
const preflightURL = new URL("evals/results/research-owner-zoning-temporal-preflight-2026-09-08.json", root);
const resultURL = new URL("evals/results/research-owner-live-zoning-temporal-confirmation-2026-09-08.json", root);
const sourceFiles = ["app.mjs", "research-config.mjs", "research-cost-usage.mjs", "research-provider-client.mjs", "research-zoning-planner.mjs", "research-zoning-temporal-application.mjs", "research-zoning-safety.mjs",
  "research-evidence-assembly.mjs", "research-zoning-context-excerpts.mjs", "project-foundation-contract.mjs", "research-corpus-registry.mjs", "research-model-routing.mjs", "evals/research-owner-scope-input.mjs",
  "evals/research-reconciled-answer-key.json", "evals/research-owner-http-request-binding.mjs", "scripts/run-research-owner-zoning-temporal-confirmation-20260908.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, hash(await readFile(new URL(file, root)))])));
let preflight;
if (live) {
  const bytes = await readFile(preflightURL);
  preflight = JSON.parse(bytes);
  assert.equal(preflight.status, "preflight-passed");
  assert.equal(preflight.sourceCommit, sourceCommit);
  assert.deepEqual(preflight.sourceHashes, sourceHashes);
  assert.deepEqual(preflight.previousResultHashes, previousResultHashes);
  assert.deepEqual(preflight.cases, caseIDs);
  assert.equal(preflight.providerCalls.length, 0);
  assert.equal(preflight.results.length, 1);
  assert(preflight.results.every((item) => item.initialRequestSHA256 && item.initialMaximumUSD <= profile.maximumTurnSpendUSD));
  assert.equal(execFileSync("git", ["diff", "HEAD", "--", "*.mjs", "*.json"], { cwd: root, encoding: "utf8" }), "");
  profile.preflightSHA256 = hash(bytes);
  const lock = await open(resultURL, "wx", 0o600);
  await lock.close();
}
const scratch = await mkdtemp(join(tmpdir(), live ? "permitext-zoning-temporal-live-" : "permitext-zoning-temporal-preflight-"));
let apiKey = "offline-provider-intercept";
if (live) {
  const local = parseEnv(await readFile(new URL(".env.local", root), "utf8"));
  assert(local.OPENAI_API_KEY && local.OPENAI_API_KEY !== "[SENSITIVE]");
  apiKey = local.OPENAI_API_KEY;
}
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  OPENAI_API_KEY: apiKey, NODE_ENV: "", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: live ? "1" : "0", PERMITEXT_RESEARCH_EVAL_MAX_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: String(profile.maximumTurnSpendUSD),
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_DAILY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_MONTHLY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: "1",
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid", PERMITEXT_RESEARCH_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-20260908-terra",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-20260908-luna"
});
const result = { ...profile, sourceHashes, startedAt: new Date().toISOString(), status: "running", results: [], providerCalls: [] };
const persist = () => live ? writeFile(resultURL, JSON.stringify(result, null, 2) + "\n") : Promise.resolve();
await persist();
const nativeFetch = globalThis.fetch;
let active, initialBody;
const requestHash = ownerHTTPResearchRequestHash;
const stop = (message) => Object.assign(new Error(message), { code: "RESEARCH_EVAL_SPEND_CAP" });
const config = await import("../research-config.mjs");
if (live) config.validatePaidResearchEvaluationEnvironment();
assert.equal(config.researchSpendGuardrails().ready, true);
globalThis.fetch = async (url, options) => {
  if (String(url) !== "https://api.openai.com/v1/responses") throw stop("This package forbids external document and other network requests.");
  const body = JSON.parse(options.body);
  if (!active || body.tools?.length || body.service_tier !== "default") throw stop("Unexpected provider request shape.");
  const phase = body.text?.format?.name;
  if (!active.initialRequestSHA256) {
    assert.equal(phase, "permitext_code_interpretation");
    active.initialRequestSHA256 = requestHash(body);
    initialBody = structuredClone(body);
    active.initialModel = body.model;
    active.initialRequestBytes = Buffer.byteLength(options.body);
    if (live && active.initialRequestSHA256 !== preflight.results.find((item) => item.id === active.id).initialRequestSHA256) throw stop("Outgoing draft differs from the actual HTTP preflight.");
  }
  if (!live) {
    active.interceptCount = (active.interceptCount || 0) + 1;
    assert.equal(active.interceptCount, 1, "Only the initial draft may reach the no-network intercept.");
    // Zero-usage terminal double stops this no-cost request. It is not an answer.
    return Response.json({ error: { code: "offline_preflight", message: "Provider dispatch intercepted." }, usage: { input_tokens: 0, output_tokens: 0 } }, { status: 400 });
  }
  if (result.providerCalls.length >= profile.maximumProviderRequests) throw stop("Package provider-call ceiling reached.");
  const entry = { caseID: active.id, phase, model: body.model, requestBytes: Buffer.byteLength(options.body), maxOutputTokens: body.max_output_tokens,
    requestSHA256: requestHash(body), startedAt: new Date().toISOString() };
  result.providerCalls.push(entry);
  await persist();
  const start = performance.now();
  try {
    const response = await nativeFetch(url, options);
    const payload = await response.clone().json();
    Object.assign(entry, { httpStatus: response.status, usage: payload.usage || null, serviceTier: payload.service_tier,
      output: payload.output?.filter((item) => item.type === "message"), incompleteDetails: payload.incomplete_details, errorCode: payload.error?.code });
    return response;
  } catch (error) { entry.errorCode = error.code || error.name; throw error; }
  finally { entry.durationMilliseconds = Math.round(performance.now() - start); await persist(); }
};
const { handleRequest } = await import("../app.mjs");
const { ownerResearchScopeInput } = await import("../evals/research-owner-scope-input.mjs");
const { zoningSectionSummary, zoningSection } = await import("../zoning-content.mjs");
const server = createServer(handleRequest);
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const request = async (path, body, token) => {
  const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
};
try {
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Isolated owner Zoning diagnostic" } });
  assert.equal(signed.status, 200);
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  const granted = await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  assert.equal(granted.status, 200);
  const seen = new Set();
  for (const id of caseIDs) {
    const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === id), { original: true, zoningSummary: zoningSectionSummary });
    assert.equal(input.projectFacts.length, 0);
    assert(input.pinnedEvidence.every((pin) => !pin.selectedText));
    const selections = await Promise.all(input.pinnedEvidence.map(async ({ sectionID }) => {
      const section = await zoningSection(sectionID);
      assert(section);
      return { sectionID, selectedText: section.blocks.map((block) => block.plainText || "").join("\n\n").replace(/\s+/g, " ").trim() };
    }));
    const created = await request("/research/conversations/create", { auth, selections, originSurface: "reader" }, token);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    initialBody = null;
    active = { id, question: input.question, inputSHA256: hash(JSON.stringify(input)), readerSelectionsSHA256: hash(JSON.stringify(selections)), status: "running", maximumTurnSpendUSD: profile.maximumTurnSpendUSD };
    result.results.push(active);
    await persist();
    console.log(`${live ? "Live" : "Offline preflight"}: ${id}`);
    const started = performance.now();
    const response = await request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question: input.question, requestID: randomUUID() }, token);
    active.durationMilliseconds = Math.round(performance.now() - started);
    active.httpStatus = response.status;
    if (initialBody) {
      // Outside the completed HTTP handler, independently size its captured
      // initial request using the production reservation calculation.
      config.beginResearchSpendReservation({ id: `offline-size-${id}` });
      try { active.initialMaximumUSD = config.reserveResearchProviderSpend(initialBody).maximumRequestUSD; }
      finally { config.endResearchSpendReservation(); }
      const captureIndex = process.argv.indexOf("--capture-prefix");
      if (!live && captureIndex !== -1) {
        assert(process.argv[captureIndex + 1]);
        await writeFile(`${process.argv[captureIndex + 1]}-${id}.json`, JSON.stringify({ ...initialBody, safety_identifier: "isolated-account" }, null, 2), { flag: "wx" });
      }
    }
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    assert.equal(telemetry.status, 200);
    active.operations = telemetry.body.researchSpend.operationMetrics.filter((operation) => !seen.has(operation.id));
    active.operations.forEach((operation) => seen.add(operation.id));
    assert.equal(active.operations.length, 1);
    if (!live) {
      if (!active.interceptCount && response.body.code === "RESEARCH_EVAL_SPEND_CAP") {
        assert.equal(active.operations[0].providerRequestCount, 0);
        assert.equal(active.operations[0].pendingProviderRequestCount, 0);
        active.status = "preflight-blocked";
        active.error = response.body;
        result.stopReason = response.body.message;
        break;
      }
      assert.equal(active.interceptCount, 1, JSON.stringify(response.body));
      assert(active.initialMaximumUSD <= profile.maximumTurnSpendUSD);
      assert(response.status >= 400);
      active.status = "preflight-intercepted";
      continue;
    }
    active.answer = response.body.conversation?.messages.findLast((message) => message.role === "assistant")?.answer;
    active.status = response.status === 200 && active.answer ? "completed" : "failed";
    if (active.status === "failed") active.error = response.body;
    assert(active.operations.every((operation) => Number.isFinite(operation.conservativeProviderCostUSD) && operation.conservativeProviderCostUSD <= profile.maximumTurnSpendUSD + 1e-6));
    result.cumulativeConservativeSpendUSD = Number((previousConservativeSpendUSD + result.results.flatMap((item) => item.operations || []).reduce((sum, operation) => sum + operation.conservativeProviderCostUSD, 0)).toFixed(6));
    assert(result.cumulativeConservativeSpendUSD <= 8);
    result.spend = config.researchEvaluationSpendStatus();
    await persist();
    assert(active.operations.every((operation) => operation.pendingProviderRequestCount === 0), "Stop on unsettled accounting.");
    if (active.status !== "completed") throw new Error(`${id} failed; remaining cases skipped for investigation.`);
  }
  result.status = live ? "completed" : result.results.some((item) => item.status === "preflight-blocked") ? "preflight-blocked" : "preflight-passed";
} catch (error) { result.status = "stopped"; result.stopReason = error.message; }
finally {
  result.completedAt = new Date().toISOString();
  result.spend = config.researchEvaluationSpendStatus();
  await persist();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = nativeFetch;
}
if (!live) {
  assert(["preflight-passed", "preflight-blocked"].includes(result.status), result.stopReason);
  const index = process.argv.indexOf("--output");
  await writeFile(index === -1 ? preflightURL : process.argv[index + 1], JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ status: result.status, cases: result.results.map(({ id, status, initialMaximumUSD }) => ({ id, status, initialMaximumUSD })), providerCalls: result.providerCalls.length, spend: result.spend, stopReason: result.stopReason }));
