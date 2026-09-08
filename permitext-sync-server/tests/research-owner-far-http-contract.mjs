// Replay the recorded provider responses to isolate HTTP persistence from model
// behavior. This is not a fresh answer-quality evaluation and makes no API calls.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json", import.meta.url)));
const question = run.cases.find((item) => item.id === "ZR-08").question;
const recorded = run.providerCalls.filter((call) => call.caseID === "ZR-08");
assert.equal(recorded.length, 2);
const scratch = await mkdtemp(join(tmpdir(), "permitext-owner-far-http-"));
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
  PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
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
let providerDoubles = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request in offline test.");
  const body = JSON.parse(options.body);
  const call = recorded[providerDoubles++];
  assert(call, "Unexpected extra provider request.");
  assert.equal(body.text.format.name, call.phase);
  assert.match(options.body, /total floor area on a zoning lot, divided by the lot area/);
  return Response.json({ model: call.model, status: "completed", usage: call.usage, output: call.output });
};
const sha = (text) => createHash("sha256").update(text).digest("hex");
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    assert(response.ok, `${response.status}: ${JSON.stringify(payload)}`);
    return payload;
  };
  const { account } = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline FAR Contract" } });
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  const token = account.backendSessionToken;
  const { conversation } = await request("/research/conversations/create", { auth }, token);
  const completed = await request("/research/conversations/message", { auth, conversationID: conversation.id, question, requestID: randomUUID() }, token);
  const message = completed.conversation.messages.at(-1);
  assert.equal(message.role, "assistant");
  assert.match(message.answer.answerText, /40,000/);
  const { answer: saved } = await request("/research/answers/get", { auth, answerID: message.id }, token);
  assert.equal(saved.answer.answerText, message.answer.answerText);
  const definition = saved.evidence.find((source) => source.sectionNumber === "12-10");
  assert.match(definition.passageText, /total floor area on a zoning lot, divided by the lot area/);
  const table = saved.evidence.find((source) => source.sectionNumber === "23-22");
  assert.match(table.passageText, /within 100 feet of a wide street/);
  assert.equal(table.passageTextHash, sha(table.passageText));
  const { reference, text, grids } = table.structuredSource;
  assert.notEqual(text, table.passageText);
  assert.equal(table.structuredSource.contentHash, sha(JSON.stringify({ reference, text, grids })));
  assert.equal(providerDoubles, 2);
  console.log("FAR HTTP persistence replay passed: full definition, table context and independent hashes survive saved-answer retrieval; zero external calls. Recorded answer wording is not regraded by this test.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
