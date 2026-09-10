// Actual isolated HTTP request construction with mocked provider responses.
// This script has no live mode, reads no credential, and permits no external fetch.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { ownerHTTPResearchRequestHash } from "../evals/research-owner-http-request-binding.mjs";

const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE. Live mode is forbidden.");
const root = new URL("../", import.meta.url), hash = value => createHash("sha256").update(value).digest("hex");
const inputs = [];
async function read(file, expected) {
  const bytes = await readFile(new URL(file, root)), sha256 = hash(bytes);
  if (expected) assert.equal(sha256, expected, file);
  inputs.push({ file, sha256 }); return JSON.parse(bytes);
}
const audit = await read("evals/results/research-owner-api-round2-attestation-preparation-cost-audit-2026-09-09.json");
let conservativeUSD = 0;
for (const ledger of audit.ledgers) {
  const run = await read(ledger.file, ledger.sha256);
  assert(["completed", "stopped"].includes(run.status));
  assert.equal(run.spend.pendingRequestCount, 0);
  for (const operation of run.results.flatMap(item => item.operations || [])) {
    assert.equal(operation.pendingProviderRequestCount, 0);
    assert(Number.isFinite(operation.conservativeProviderCostUSD));
    conservativeUSD += operation.conservativeProviderCostUSD;
  }
}
conservativeUSD = Number(conservativeUSD.toFixed(6));
assert.equal(conservativeUSD, audit.summary.conservativeUSD);
assert.equal(conservativeUSD, 8.351519);
const amendment = await read("evals/research-owner-api-round2-authorization-20260909.json", audit.authorizationAmendment.sha256);
assert.equal(amendment.authorizationUSD, 8.5);
const remainingUSD = Number((amendment.authorizationUSD - conservativeUSD).toFixed(6));
assert.equal(remainingUSD, 0.148481);
const dataset = await read("evals/research-owner-code-candidates.json", "461b47898980aeaa29cf65a728b548fe3a1de70105beb0dd34a16c4e182adbe7");
const definition = dataset.cases.find(item => item.id === "MC-05");
const input = await ownerResearchScopeInput(definition);
assert.equal(input.question, definition.question);
assert.deepEqual(input.projectFacts, []); assert.deepEqual(input.pinnedEvidence, []);
const retainedRun = await read("evals/results/research-owner-live-attribution-confirmation-2026-09-08.json",
  "5921e41d84f84949d971ccfb0ec6d9f0727bacd48ded8fbc3099ac807a405499");
const retainedDraft = retainedRun.providerCalls.find(call => call.caseID === "MC-05" && call.phase === "permitext_code_interpretation");
assert(retainedDraft);
const rawDraft = JSON.parse(retainedDraft.output.flatMap(message => message.content || []).find(content => content.type === "output_text").text);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sourceFiles = ["app.mjs", "research-narrative-source-bindings.mjs", "research-answer-quality.mjs",
  "research-config.mjs", "research-provider-client.mjs", "research-cost-usage.mjs", "research-evidence-assembly.mjs",
  "evidence-discovery.mjs", "research-model-routing.mjs", "research-corpus-registry.mjs", "research-source-policy.mjs",
  "research-conversation-facts.mjs", "research-conversation-topic.mjs", "research-focused-technical-scope.mjs",
  "research-technical-topic-routes.mjs", "research-answer-presentation.mjs", "research-claim-scope.mjs",
  "evals/research-owner-scope-input.mjs", "evals/research-owner-http-request-binding.mjs", "evals/research-owner-code-review.mjs",
  "scripts/check-research-narrative-live-budget-20260909.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const scratch = await mkdtemp(join(tmpdir(), "permitext-narrative-budget-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
// $1 exists only in this no-network request-sizing process. A second HTTP
// attempt below uses the real remaining allowance and proves its spending gate.
Object.assign(process.env, {
  OPENAI_API_KEY: "offline-request-sizing", NODE_ENV: "", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1", PERMITEXT_RUN_PAID_RESEARCH_EVALS: "0",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: "1", PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "1", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "1",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "1", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "1",
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-20260908-terra",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-20260908-luna"
});
const nativeFetch = globalThis.fetch;
const captures = [], attempts = [];
let stage = "sizing", stageCalls = 0, server;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "External network forbidden.");
  assert.equal(stage, "sizing", "The actual remaining allowance must block this request before dispatch.");
  const body = JSON.parse(options.body), phase = body.text?.format?.name;
  assert(!body.tools?.length); assert.equal(body.service_tier, "default");
  assert.equal(phase, stageCalls++ === 0 ? "permitext_code_interpretation" : "permitext_research_verification");
  assert(stageCalls <= 2);
  if (phase === "permitext_code_interpretation") {
    assert(body.input.includes(input.question));
    assert.equal(body.model, "gpt-5.6-terra");
  } else {
    assert.equal(body.model, "gpt-5.6-luna");
    const candidate = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
    assert.equal(candidate.answerText, rawDraft.answerText);
    assert.equal(candidate.citations.length, rawDraft.citations.length + 1);
    const citation = candidate.citations.at(-1);
    assert.equal(citation.codePrefix, "MC"); assert.equal(citation.sectionNumber, "606.4.2");
    assert(citation.codeVersion && citation.codeEdition && citation.corpusID);
    assert.match(citation.supportingPassages[0].selectedText, /Exceptions:/);
    assert.match(citation.supportingPassages[0].selectedText, /serving not more than one floor/);
  }
  const retainedRequestBody = { ...body, safety_identifier: "isolated-account" };
  assert.match(body.safety_identifier, /^[a-f0-9]{64}$/);
  assert.equal(ownerHTTPResearchRequestHash(retainedRequestBody), ownerHTTPResearchRequestHash(body));
  captures.push({ phase, model: body.model, maxOutputTokens: body.max_output_tokens,
    requestBytes: Buffer.byteLength(options.body), safetyIdentifierLength: body.safety_identifier.length,
    requestSHA256: ownerHTTPResearchRequestHash(body),
    retainedRequestBody, retainedRequestSHA256: hash(JSON.stringify(retainedRequestBody)) });
  const output = phase === "permitext_code_interpretation" ? retainedDraft.output : [
    { type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ pass: true, issues: [] }) }] }
  ];
  // Synthetic zero-usage accounting is local test data, never provider billing.
  return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 0, output_tokens: 0 }, output });
};
try {
  const config = await import("../research-config.mjs");
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  const seenOperations = new Set();
  for (const maximumTurnUSD of [1, remainingUSD]) {
    stage = maximumTurnUSD === 1 ? "sizing" : "remaining-allowance";
    stageCalls = 0; process.env.PERMITEXT_RESEARCH_MAX_REQUEST_USD = String(maximumTurnUSD);
    const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline Research request sizing" } });
    assert.equal(signed.status, 200);
    const { account } = signed.body, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
    assert.equal((await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
    const created = await request("/research/conversations/create", { auth }, token);
    assert.equal(created.status, 201); assert(!created.body.conversation.primaryProjectID);
    const response = await request("/research/conversations/message", { auth, conversationID: created.body.conversation.id,
      question: input.question, requestID: randomUUID() }, token);
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    assert.equal(telemetry.status, 200);
    const operations = telemetry.body.researchSpend.operationMetrics.filter(operation => !seenOperations.has(operation.id));
    operations.forEach(operation => seenOperations.add(operation.id));
    assert.equal(operations.length, 1); assert.equal(operations[0].pendingProviderRequestCount, 0);
    assert.equal(operations[0].conservativeProviderCostUSD, 0);
    if (stage === "sizing") {
      assert.equal(response.status, 200, JSON.stringify(response.body)); assert.equal(stageCalls, 2);
    } else {
      assert.equal(response.body.code, "RESEARCH_SPEND_CAP", JSON.stringify(response.body)); assert.equal(stageCalls, 0);
      assert.equal(operations[0].providerRequestCount, 0);
      const reopened = await request("/research/conversations/get", { auth, conversationID: created.body.conversation.id }, token);
      assert.equal(reopened.body.conversation.messages.filter(message => message.role === "assistant").length, 0);
    }
    attempts.push({ stage, maximumTurnUSD, httpStatus: response.status, responseCode: response.body.code || null,
      interceptedRequests: stageCalls, operations, syntheticDelivery: stage === "sizing" });
  }
  const sizingEnvironment = { ...process.env, PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1" };
  for (const capture of captures) {
    // Redaction shortens the saved body. Restore the identifier's original
    // byte length for pricing without retaining the isolated account hash.
    const sizingBody = { ...capture.retainedRequestBody, safety_identifier: "0".repeat(capture.safetyIdentifierLength) };
    assert.equal(Buffer.byteLength(JSON.stringify(sizingBody)), capture.requestBytes);
    config.beginResearchSpendReservation({ id: `offline-reservation-${capture.phase}` }, sizingEnvironment);
    try { capture.maximumRequestUSD = config.reserveResearchProviderSpend(sizingBody, sizingEnvironment).maximumRequestUSD; }
    finally { config.endResearchSpendReservation(); }
  }
  assert(captures[0].maximumRequestUSD > remainingUSD);
  const summary = { id: "MC-05", authorizationUSD: amendment.authorizationUSD, conservativeSpentUSD: conservativeUSD,
    remainingConservativeAuthorizationUSD: remainingUSD, initialRequestMaximumUSD: captures[0].maximumRequestUSD,
    retainedCandidateVerifierMaximumUSD: captures[1].maximumRequestUSD,
    initialRequestFitsRemainingAllowance: false, liveProviderCalls: 0, externalNetworkCalls: 0,
    mockedProviderResponses: captures.length, liveAnswerQualityConfirmed: false };
  const report = { schema: "permitext.research-narrative-live-budget-check.v1", checkedAt: new Date().toISOString(), sourceCommit,
    sourceHashes, inputs, authoredInput: input, authoredInputSHA256: hash(JSON.stringify(input)), summary,
    limitations: ["The $1 ceiling is confined to a process with intercepted provider calls and no credentials; it is not live spending authorization.",
      "The second actual HTTP request uses the approved remaining allowance and stops before any provider dispatch. No model, source packet, output budget or live spending guard was reduced to fit.",
      "The verifier request is constructed from a retained historical draft and the current citation repair. Its mocked passing response is not a new quality review or professional acceptance.",
      "Request maxima are conservative reservations using configured rates, not actual charges or a quote for typical Research. Current provider balance/invoice was not checked.",
      "All 110 authored questions remain in scope. This one-case request-sizing check does not establish current full-cohort quality, cost or latency."], attempts, captures };
  if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
