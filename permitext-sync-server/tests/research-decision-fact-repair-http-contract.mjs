// Recorded drafts and usage, synthetic verifier verdicts; no paid model calls.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const recorded = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-compact-confirmation-2026-09-08.json", import.meta.url)));
const scratch = await mkdtemp(join(tmpdir(), "permitext-decision-fact-http-"));
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.50", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2", PERMITEXT_RESEARCH_DAILY_CAP_USD: "2", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const nativeFetch = globalThis.fetch;
let active;
let accept;
let phases;
let firstProposed;
let secondProposed;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  const body = JSON.parse(options.body);
  const phase = body.text.format.name;
  phases.push(phase);
  let call;
  let output;
  if (phase === "permitext_code_interpretation") {
    assert.equal(phases.length, 1, "A fact-only correction must not trigger a full-answer generation.");
    call = recorded.providerCalls.find((item) => item.caseID === active.id && item.phase === phase);
    output = call.output;
  } else {
    assert.equal(phase, "permitext_research_verification");
    assert(phases.length === 2 || phases.length === 3);
    const proposed = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
    call = recorded.providerCalls.find((item) => item.caseID === active.id && item.phase === phase);
    let verdict;
    if (phases.length === 2) {
      firstProposed = proposed;
      assert.deepEqual(proposed.missingFacts, active.answer.missingFacts);
      for (const key of ["answerText", "supportedPoints", "citations"]) {
        assert.deepEqual(proposed[key], active.answer[key], `The verifier must receive the delivered ${key}, including source repairs.`);
      }
      verdict = { pass: false, issues: [{ type: "unnecessary_qualification", detail: "Recorded decision is already established; the listed design inputs cannot change it." }],
        unnecessaryMissingFactIndices: proposed.missingFacts.map((_, index) => index) };
    } else {
      secondProposed = proposed;
      assert.deepEqual(secondProposed, { ...firstProposed, missingFacts: [] },
        "The final verifier must see every original field unchanged except the explicitly reviewed missingFacts entries.");
      verdict = accept ? { pass: true, issues: [], unnecessaryMissingFactIndices: [] } : {
        pass: false, issues: [{ type: "unsupported_requirement", detail: "Synthetic final rejection: removing facts never approves an answer by itself." }], unnecessaryMissingFactIndices: []
      };
    }
    output = [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(verdict) }] }];
  }
  // Preserve the recorded token usage rather than making the spend test cheap
  // with a tiny fake usage count. Verdicts remain synthetic.
  return Response.json({ model: body.model, status: "completed", usage: call.usage, output });
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline fact-repair contract" } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  const auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const seen = new Set();
  for (const record of recorded.results) for (const accepted of [false, true]) {
    active = record;
    accept = accepted;
    phases = [];
    const created = await request("/research/conversations/create", { auth }, token);
    const conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, question: active.question, requestID: randomUUID() }, token);
    assert.deepEqual(phases, ["permitext_code_interpretation", "permitext_research_verification", "permitext_research_verification"]);
    if (accept) {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const answer = response.body.conversation.messages.findLast((message) => message.role === "assistant").answer;
      assert.equal(answer.answerText, active.answer.answerText);
      assert.deepEqual(answer.missingFacts, []);
      assert.equal(answer.verification.decisionFactRepairApplied, true);
      assert.equal(answer.verification.regenerated, false);
      assert.equal(answer.verification.attempts, 2);
    } else {
      assert.equal(response.status, 502, JSON.stringify(response.body));
      assert.equal(response.body.code, "RESEARCH_VERIFICATION_FAILED");
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.body.conversation.messages.filter((message) => message.role === "assistant").length, 0);
    }
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    const operations = telemetry.body.researchSpend.operationMetrics.filter((operation) => !seen.has(operation.id));
    assert.equal(operations.length, 1);
    const operation = operations[0];
    seen.add(operation.id);
    assert.equal(operation.charged, accept);
    assert.equal(operation.providerRequestCount, 3);
    assert.equal(operation.pendingProviderRequestCount, 0);
    assert(operation.conservativeProviderCostUSD <= .50);
  }
} finally {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await rm(scratch, { recursive: true, force: true });
}
console.log("Decision-fact HTTP replays passed: four flows, preserved answer/citations, final accept/reject gates, no full rewrite, recorded usage under the unchanged $0.50 turn cap.");
