// Exercise actual ramp routing plus recorded draft/revision responses with provider doubles.
// This verifies bounded generation/recovery, not live legal correctness.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-fixture-confirmation-2026-09-08.json", import.meta.url)));
assert.equal(run.providerCalls.length, 5);
const scratch = await mkdtemp(join(tmpdir(), "permitext-retain-race-"));
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
let releaseProvider, providerStarted;
const started = new Promise(resolve => { providerStarted = resolve; });
const released = new Promise(resolve => { releaseProvider = resolve; });
let calls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  const body = JSON.parse(options.body);
  const record = run.providerCalls[calls++];
  assert.equal(body.text.format.name, record.phase);
  if (calls === 1) { providerStarted(); await released; }
  return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output: record.output });
};
let server;
try {
  const { handleRequest, canRebaseRetainedResearchQuestion, researchConversationWithFailedQuestion } = await import('../app.mjs');
  const base = { id: 'c', revision: 1, contextRevision: 0, title: 'Original', titleSource: 'manual', messages: [], sources: [], createdAt: new Date().toISOString() };
  const info = { userID: 'u', requestID: 'r', question: 'Original question', contextRevision: 0, startedAt: base.createdAt, code: 'RESEARCH_INTERRUPTED', origin: 'client-recovery' };
  const marker = researchConversationWithFailedQuestion(base, info); marker.revision = 2;
  const recoveryBase = { conversation: base, requestID: 'r', question: info.question };
  assert(canRebaseRetainedResearchQuestion('u', recoveryBase, marker));
  for (const changed of [{ title: 'New title' }, { contextRevision: 1 }, { primaryProjectID: 'other' }, { sources: [{ id: 'new-source' }] }, { revision: 3 }]) {
    assert.equal(canRebaseRetainedResearchQuestion('u', recoveryBase, { ...marker, ...changed }), false);
  }
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request('/account/sign-in', { credential: { provider: 'web', providerUserID: randomUUID(), displayName: 'Race fixture' } });
  const token = signed.body.account.backendSessionToken;
  const auth = { accountUserID: signed.body.account.appUserID };
  await request('/admin/lifetime-grants/grant', { userID: auth.accountUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const created = await request('/research/conversations/create', { auth }, token);
  const conversationID = created.body.conversation.id, requestID = randomUUID(), question = run.cases[0].question;
  const inflight = request('/research/conversations/message', { auth, conversationID, requestID, question }, token);
  await started;
  const retained = await request('/research/conversations/retain-interrupted-question', { auth, conversationID, requestID, question, contextRevision: 0 }, token);
  assert.equal(retained.status, 200, JSON.stringify(retained.body));
  assert.equal(retained.body.conversation.messages[0].failure.origin, 'client-recovery');
  releaseProvider();
  const completed = await inflight;
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(completed.body.conversation.messages.length, 2);
  assert.equal(completed.body.conversation.messages[0].failure, undefined);
  assert.equal(completed.body.conversation.messages[0].requestID, requestID);
  assert.equal(completed.body.conversation.messages[1].requestID, requestID);
  const store = JSON.parse(await readFile(join(scratch, 'store.json'), 'utf8'));
  assert.equal(store.researchUsageByUserID[auth.accountUserID].filter(item => item.mode !== 'reservation').length, 1);
  const priorCalls = calls;
  const replay = await request('/research/conversations/message', { auth, conversationID, requestID, question }, token);
  assert.equal(replay.body.replayed, true);
  assert.equal(calls, priorCalls);
  const after = JSON.parse(await readFile(join(scratch, 'store.json'), 'utf8'));
  assert.equal(after.researchUsageByUserID[auth.accountUserID].filter(item => item.mode !== 'reservation').length, 1);
  console.log('Retained-question race passed: paused provider, second-client marker, successful atomic answer, one question/answer/charge, replay without provider call, unrelated mutations rejected. External provider calls: zero.');
} finally {
  releaseProvider();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
