// Replay the actual GAP-04 web/draft outputs. Verifier responses are explicit
// doubles: this proves the delivery gate, not a new live correctness result.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-technical-expansion-2026-09-08.json", import.meta.url)));
const records = run.providerCalls.filter((call) => call.caseID === "GAP-04");
assert.equal(records.length, 3);
const question = run.cases.find((item) => item.id === "GAP-04").question;
const scratch = await mkdtemp(join(tmpdir(), "permitext-web-overlap-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_OFFICIAL_DOMAINS: "nyc.gov,ny.gov,rules.cityofnewyork.us,ada.gov",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12",
  PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const nativeFetch = globalThis.fetch;
let accept = false;
let draftIndex = 0;
let calls = [];
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request.");
  const body = JSON.parse(options.body);
  const phase = body.text?.format?.name || "web_support";
  calls.push(phase);
  let output;
  if (phase === "permitext_research_verification") {
    assert.match(body.input, /LEXICAL WEB OVERLAPS FOR SOURCE COMPARISON/);
    assert.match(body.input, /web_claim_overlap/);
    assert.match(body.input, /web-claim-ad031ccb79120118c8125466/);
    assert.match(body.input, /requirements of or file with other city agencies/);
    assert.match(body.instructions, /Shared wording alone does not make a claim web-derived/);
    const value = accept ? { pass: true, issues: [] } : {
      pass: false, issues: [{ type: "wrong_attribution", detail: "Synthetic verifier rejection: a clause is not independently established by its enacted citation." }]
    };
    output = [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }];
  } else {
    const recorded = phase === "web_support" ? records[0] : records[++draftIndex];
    assert(recorded, "At most one bounded revision is permitted.");
    assert.equal(phase, recorded.phase);
    output = recorded.output;
  }
  return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output });
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
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline overlap contract" } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  for (const accepted of [false, true]) {
    accept = accepted; draftIndex = 0; calls = [];
    const created = await request("/research/conversations/create", { auth }, token);
    const conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, question, requestID: randomUUID() }, token);
    assert.deepEqual(calls, accepted
      ? ["web_support", "permitext_code_interpretation", "permitext_research_verification"]
      : ["web_support", "permitext_code_interpretation", "permitext_research_verification", "permitext_code_interpretation", "permitext_research_verification"]);
    if (!accepted) {
      assert.equal(response.status, 502, JSON.stringify(response.body));
      assert.equal(response.body.code, "RESEARCH_VERIFICATION_FAILED");
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.body.conversation.messages.filter((message) => message.role === "assistant").length, 0);
      const telemetry = await request("/internal/evaluations/data", { auth }, token);
      const failed = telemetry.body.researchSpend.operationMetrics.find((operation) => operation.failureCode === "RESEARCH_VERIFICATION_FAILED");
      assert(failed && !failed.charged && failed.providerRequestCount === 5 && failed.pendingProviderRequestCount === 0);
    } else {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const message = response.body.conversation.messages.at(-1);
      assert.equal(message.answer.verification.history.at(-1).model, "gpt-5.6-luna");
      assert.equal(message.answer.verification.history.at(-1).pass, true);
      const saved = await request("/research/answers/get", { auth, answerID: message.id }, token);
      assert.equal(saved.body.answer.answer.answerText, message.answer.answerText);
    }
  }
  console.log("Recorded web-overlap HTTP replay passed: source comparison required, rejected drafts remain unsaved and uncharged, accepted draft persists; all provider responses mocked.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
