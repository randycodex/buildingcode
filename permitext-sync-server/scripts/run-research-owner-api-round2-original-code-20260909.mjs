// Test all 18 remaining original code/Zoning cases; retain selection and source blocks without paying.
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
const firstRoundFile = "evals/results/research-owner-api-round2-live-percentage-scope-2026-09-09.json";
const firstRoundBytes = await readFile(new URL(firstRoundFile, root));
const firstRound = JSON.parse(firstRoundBytes);
assert(["completed", "stopped"].includes(firstRound.status));
assert(firstRound.providerCalls.length > 0);
for (const prior of firstRound.priorRoundResults) assert.equal(hash(await readFile(new URL(prior.file, root))), prior.sha256);
assert.equal(firstRound.spend.pendingRequestCount, 0);
assert(firstRound.results.flatMap((item) => item.operations).every((operation) => operation.pendingProviderRequestCount === 0));
const roundPreviousConservativeUSD = firstRound.cumulativeConservativeSpendUSD;
assert(roundPreviousConservativeUSD > 0 && roundPreviousConservativeUSD < 8);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const keyBytes = await readFile(new URL("evals/research-reconciled-answer-key.json", root));
const key = JSON.parse(keyBytes);
// A single-use coverage batch; all preceding results and costs are retained.
const ownerBytes = await readFile(new URL("evals/research-owner-code-candidates.json", root));
const ownerCases = JSON.parse(ownerBytes).cases;
const caseIDs = ["CC-02", "CC-05", "ZR-02", "ZR-03", "ZR-04", "ZR-05", "ZR-06", "ZR-07", "ZR-09", "ZR-10", "ZR-11", "ZR-12", "ZR-13", "ZR-15", "ZR-16", "ZR-17", "ZR-19", "ZR-20"];
const profile = { schema: "permitext-owner-api-round2-original-code-v1", sourceCommit,
  authorization: "Owner explicitly authorized fresh API tests with $8 currently available and requested notice if more is needed. This is a new $8 round; historical costs stay separate. This single-use batch checks all 18 unattempted original code and Zoning cases, preserving authored questions, selected passages, section references and supplied facts and dispatches only turns that fit the offline preflight. Maximum $2.00 for the batch within the remaining $8 round allowance. Each next turn requires a full $0.50 remaining conservative allowance. No Project workflow tests or deployment.",
  previousResultHashes, historicalConservativeSpendUSD: previousConservativeSpendUSD, previousConservativeSpendUSD: roundPreviousConservativeUSD, authorizationUSD: 8,
  priorRoundResults: [...firstRound.priorRoundResults, { file: firstRoundFile, sha256: hash(firstRoundBytes) }],
  ownerDatasetSHA256: hash(ownerBytes), roundID: "owner-api-round2-20260908",
  maximumCumulativeSpendUSD: Math.min(2, Number((8 - roundPreviousConservativeUSD).toFixed(6))), maximumTurnSpendUSD: 0.5, maximumTurns: 18, maximumProviderRequests: 90, maximumProviderRequestsPerTurn: 5,
  repetitions: 1, separateJudgeRequests: 0, manualRetries: 0,
  keySHA256: hash(keyBytes),
  pricingSource: "https://developers.openai.com/api/docs/pricing", pricingCheckedOn: "2026-09-08",
  routing: "Existing hybrid Luna/Terra routing and production verification/repair policy, subject to the lower evaluation spending cap; standard service tier. No forced model substitution.",
  scope: "Actual selected-passage HTTP Research flow on isolated local accounts and storage. Supplied facts for CC-02 and CC-05 are seeded only into a Research conversation fixture; no Project is created or exercised. Oversized section selections and visual-review requirements are recorded, never bypassed. Expected answers are not supplied to drafting or verification. Automatic web support remains enabled in configuration; each selected-code question must avoid it. The driver rejects web tools and document reads. Offline preflight intercepts every provider call. Preflight-blocked turns are skipped without spending. No public eligibility, deployment, Project workflow or phone changes.",
  cases: caseIDs };
assert(roundPreviousConservativeUSD + profile.maximumCumulativeSpendUSD <= profile.authorizationUSD);
assert(profile.maximumTurnSpendUSD <= profile.maximumCumulativeSpendUSD);
const preflightURL = new URL("evals/results/research-owner-api-round2-original-code-preflight-2026-09-09.json", root);
const resultURL = new URL("evals/results/research-owner-api-round2-live-original-code-2026-09-09.json", root);
const sourceFiles = ["app.mjs", "research-answer-quality.mjs", "research-focused-technical-scope.mjs", "research-conversation-topic.mjs", "research-technical-topic-routes.mjs", "evidence-discovery.mjs", "research-conversation-facts.mjs", "research-fact-qualification.mjs", "research-source-policy.mjs", "research-official-html-attribution.mjs", "research-official-pdf-attribution.mjs", "research-config.mjs", "research-cost-usage.mjs", "research-provider-client.mjs", "research-zoning-planner.mjs", "research-zoning-temporal-application.mjs", "research-zoning-safety.mjs",
  "research-evidence-assembly.mjs", "research-zoning-context-excerpts.mjs", "project-foundation-contract.mjs", "research-corpus-registry.mjs", "research-model-routing.mjs", "evals/research-owner-scope-input.mjs",
  "evals/research-reconciled-answer-key.json", "evals/research-owner-code-candidates.json", "evals/research-owner-code-review.mjs", "evals/research-owner-http-request-binding.mjs", "scripts/run-research-owner-api-round2-original-code-20260909.mjs"];
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
  assert.equal(preflight.results.length, caseIDs.length);
  assert(preflight.results.every((item) => item.status === "preflight-blocked" || (item.status === "preflight-intercepted" && item.initialRequestSHA256 && item.initialMaximumUSD <= profile.maximumTurnSpendUSD)));
  assert(preflight.results.some((item) => item.status === "preflight-intercepted"));
  assert.equal(execFileSync("git", ["diff", "HEAD", "--", "*.mjs", "*.json"], { cwd: root, encoding: "utf8" }), "");
  profile.preflightSHA256 = hash(bytes);
  const lock = await open(resultURL, "wx", 0o600);
  await lock.close();
}
const scratch = await mkdtemp(join(tmpdir(), live ? "permitext-api-round2-live-" : "permitext-api-round2-preflight-"));
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
  PERMITEXT_RESEARCH_DAILY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_MONTHLY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: String(profile.maximumTurns),
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid", PERMITEXT_RESEARCH_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-20260908-terra",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-20260908-luna"
});
const result = { ...profile, sourceHashes, startedAt: new Date().toISOString(), status: "running", results: [], providerCalls: [], documentRequests: [] };
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
  if (String(url) !== "https://api.openai.com/v1/responses") {
    throw stop("This focused enacted-code package must not request web documents.");
  }
  const body = JSON.parse(options.body);
  if (active?.authoredProjectFacts?.length && body.text?.format?.name === "permitext_code_interpretation") {
    assert(active.authoredProjectFacts.every((fact) => String(body.input).includes(fact)), "Authored facts must reach the actual draft request.");
  }
  if (!active || body.tools?.length || body.service_tier !== "default") throw stop("Unexpected provider request shape.");
  const phase = body.tools?.length ? "web_support" : body.text?.format?.name;
  if (!active.initialRequestSHA256) {
    assert(["web_support", "permitext_code_interpretation"].includes(phase));
    active.initialRequestSHA256 = requestHash(body);
    initialBody = structuredClone(body);
    active.initialModel = body.model;
    active.initialRequestBytes = Buffer.byteLength(options.body);
    if (live && active.initialRequestSHA256 !== preflight.results.find((item) => item.id === active.id).initialRequestSHA256) throw stop("Outgoing initial request differs from the actual HTTP preflight.");
  }
  if (!live) {
    active.interceptCount = (active.interceptCount || 0) + 1;
    assert(active.interceptCount <= profile.maximumProviderRequestsPerTurn, "Offline fallback intercept ceiling reached.");
    // Zero-usage terminal double stops this no-cost request. It is not an answer.
    return Response.json({ error: { code: "offline_preflight", message: "Provider dispatch intercepted." }, usage: { input_tokens: 0, output_tokens: 0 } }, { status: 400 });
  }
  if (result.providerCalls.length >= profile.maximumProviderRequests || result.providerCalls.filter((call) => call.caseID === active.id).length >= profile.maximumProviderRequestsPerTurn) throw stop("Package provider-call ceiling reached.");
  const entry = { caseID: active.id, phase, model: body.model, requestBytes: Buffer.byteLength(options.body), maxOutputTokens: body.max_output_tokens,
    requestSHA256: requestHash(body), startedAt: new Date().toISOString() };
  result.providerCalls.push(entry);
  await persist();
  const start = performance.now();
  try {
    const response = await nativeFetch(url, options);
    const payload = await response.clone().json();
    Object.assign(entry, { httpStatus: response.status, usage: payload.usage || null, serviceTier: payload.service_tier,
      output: payload.output?.filter((item) => ["message", "web_search_call"].includes(item.type)), incompleteDetails: payload.incomplete_details, errorCode: payload.error?.code });
    return response;
  } catch (error) { entry.errorCode = error.code || error.name; throw error; }
  finally { entry.durationMilliseconds = Math.round(performance.now() - start); await persist(); }
};
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const adapter = createFileStoreAdapter();
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
    const preflightCase = preflight?.results.find((item) => item.id === id);
    if (live && preflightCase.status === "preflight-blocked") {
      result.results.push({ id, status: "not-dispatched", reason: "Unresolved offline input or source requirement",
        inputSHA256: preflightCase.inputSHA256, failureStage: preflightCase.failureStage,
        error: preflightCase.error, operations: [] });
      await persist();
      continue;
    }
    const settledBatchUSD = result.results.flatMap((item) => item.operations || []).reduce((sum, operation) => sum + (operation.conservativeProviderCostUSD || 0), 0);
    if (live && profile.maximumCumulativeSpendUSD - settledBatchUSD < profile.maximumTurnSpendUSD) throw stop("Remaining conservative batch allowance cannot reserve another complete turn.");
    const original = key.cases.find((item) => item.id === id);
    const input = await ownerResearchScopeInput(original || ownerCases.find((item) => item.id === id), { original: !!original, zoningSummary: zoningSectionSummary });
    assert.equal(input.projectFacts.length, id.startsWith("CC-") ? 5 : 0);
    const selections = await Promise.all(input.pinnedEvidence.map(async ({ sectionID, selectedText }) => {
      if (selectedText) return { sectionID, selectedText };
      const section = await zoningSection(sectionID);
      assert(section);
      return { sectionID, selectedText: section.blocks.map((block) => block.plainText || "").join("\n\n").replace(/\s+/g, " ").trim() };
    }));
    initialBody = null;
    active = { id, question: input.question, inputSHA256: hash(JSON.stringify(input)), requestedCodeVersion: input.projectCodeVersion,
      readerSelectionsSHA256: hash(JSON.stringify(selections)), authoredProjectFacts: input.projectFacts,
      selectionCharacterCounts: selections.map((selection) => ({ sectionID: selection.sectionID, characters: selection.selectedText.length })),
      status: "running", maximumTurnSpendUSD: profile.maximumTurnSpendUSD };
    result.results.push(active);
    await persist();
    console.log(`${live ? "Live" : "Offline preflight"}: ${id}`);
    const created = await request("/research/conversations/create", { auth, ...(selections.length ? { selections, originSurface: "reader" } : {}) }, token);
    if (created.status !== 201) {
      assert(!live, "A preflighted selection cannot newly fail creation during the paid package.");
      active.status = "preflight-blocked";
      active.failureStage = "authored_selection_creation";
      active.httpStatus = created.status;
      active.error = created.body;
      active.operations = [];
      continue;
    }
    if (input.projectFacts.length) {
      const conversation = (await adapter.listResearchConversations(account.appUserID)).find((item) => item.id === created.body.conversation.id);
      assert(conversation && !conversation.primaryProjectID);
      await adapter.saveResearchConversation(account.appUserID, { ...conversation,
        projectContext: { facts: [...input.projectFacts], source: "user-provided", updatedAt: new Date().toISOString() }
      }, conversation.revision);
      const saved = (await adapter.listResearchConversations(account.appUserID)).find((item) => item.id === conversation.id);
      assert.deepEqual(saved.projectContext.facts, input.projectFacts);
      assert.equal(saved.primaryProjectID, null);
    }
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
      if (!active.interceptCount || /SPEND_CAP/.test(response.body.code || "")) {
        assert.equal(active.operations[0].pendingProviderRequestCount, 0);
        active.status = "preflight-blocked";
        active.failureStage = "before_provider_dispatch";
        active.error = response.body;
        continue;
      }
      assert(active.interceptCount >= 1 && active.interceptCount <= profile.maximumProviderRequestsPerTurn, JSON.stringify(response.body));
      assert.equal(active.operations[0].pendingProviderRequestCount, 0);
      assert.equal(active.operations[0].actualProviderCostUSD, 0);
      assert(active.initialMaximumUSD <= profile.maximumTurnSpendUSD);
      assert(response.status >= 400);
      active.status = "preflight-intercepted";
      continue;
    }
    active.answer = response.body.conversation?.messages.findLast((message) => message.role === "assistant")?.answer;
    active.status = response.status === 200 && active.answer ? "completed" : "failed";
    if (active.status === "failed") active.error = response.body;
    assert(active.operations.every((operation) => Number.isFinite(operation.conservativeProviderCostUSD) && operation.conservativeProviderCostUSD <= profile.maximumTurnSpendUSD + 1e-6));
    result.cumulativeConservativeSpendUSD = Number((roundPreviousConservativeUSD + result.results.flatMap((item) => item.operations || []).reduce((sum, operation) => sum + operation.conservativeProviderCostUSD, 0)).toFixed(6));
    assert(result.cumulativeConservativeSpendUSD <= roundPreviousConservativeUSD + profile.maximumCumulativeSpendUSD);
    assert(result.cumulativeConservativeSpendUSD <= profile.authorizationUSD);
    result.spend = config.researchEvaluationSpendStatus();
    await persist();
    assert(active.operations.every((operation) => operation.pendingProviderRequestCount === 0), "Stop on unsettled accounting.");
    if (result.providerCalls.some((call) => call.errorCode === "insufficient_quota" || call.httpStatus === 401) || /SPEND_CAP/.test(JSON.stringify(active.error || {}))) throw new Error(`${id} hit provider or spending limits; remaining cases skipped.`);
    console.log(JSON.stringify({ id, status: active.status, durationMilliseconds: active.durationMilliseconds, conservativeUSD: result.cumulativeConservativeSpendUSD, usageEstimateUSD: result.spend.actualUSD }));
  }
  result.status = live ? "completed" : "preflight-passed";
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
