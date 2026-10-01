// Replay actual draft/revision records with explicit final-verifier doubles.
// This verifies the delivery gate, not the legal correctness of the recorded answer.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-fixture-confirmation-2026-09-08.json", import.meta.url)));
assert.equal(run.providerCalls.length, 5);
const scratch = await mkdtemp(join(tmpdir(), "permitext-revision-verification-"));
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
let callIndex = 0;
let acceptRevision = false;
let finalVerifierCalls = 0;
let factQuestionRepair = false;
let lateOmission = false;
let repeatOmission = false;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request.");
  const body = JSON.parse(options.body);
  const recorded = run.providerCalls[callIndex++];
  if (callIndex === 6) assert.match(body.input, /PRIOR REVIEW HISTORY/);
  if (recorded) {
    if (lateOmission && !repeatOmission && callIndex === 4) {
      const value = {pass:false,issues:[{type:"overstated_compliance",detail:"Preserve the unresolved work-scope condition."}]};
      return Response.json({model:body.model,status:"completed",usage:{input_tokens:100,output_tokens:100},output:[{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify(value)}]}]});
    }
    assert.equal(body.text.format.name, recorded.phase);
    return Response.json({ model: recorded.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output: recorded.output });
  }
  if (callIndex === 6) {
    assert.match(body.input, /PRIOR REVIEW HISTORY/);
    const value = lateOmission ? {pass:false,issues:[{type:"missed_material_conclusion",detail:"Explain the newly identified material exception."}]} : factQuestionRepair ? {pass:false,missingFactsOnly:true,unnecessaryMissingFactIndices:[0],issues:[{type:"unnecessary_qualification",detail:"Remove the unnecessary missing fact question."}]} : {pass:false,issues:[{type:"misstated_provision",detail:"Use the established mixed-use fact instead of leaving exclusive use unresolved."}],priorReviewCorrection:"Earlier review incorrectly asked to leave the exclusive-use exception unresolved despite established retail plus community-facility use."};
    return Response.json({model:body.model,status:"completed",usage:{input_tokens:100,output_tokens:100},output:[{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify(value)}]}]});
  }
  if (callIndex === 7) {
    assert.equal(body.text.format.name,"permitext_code_interpretation");
    if (lateOmission) assert.match(body.input,/newly identified material exception/);
    else if (factQuestionRepair) assert.match(body.input,/Remove the unnecessary missing fact question/);
    else assert.match(body.input,/reviewer corrected its earlier instruction/);
    return Response.json({model:body.model,status:"completed",usage:{input_tokens:100,output_tokens:100},output:run.providerCalls[4].output});
  }
  assert.equal(callIndex, 8, "Only one extra reconciliation is allowed.");
  assert.equal(body.text.format.name, "permitext_research_verification");
  assert.match(options.body, /normal Group B row is a usable baseline/,
    "The final verifier must see the changed conclusion, not the initial draft.");
  assert.match(options.body, /building or nonaccessory tenant space/);
  finalVerifierCalls += 1;
  const value = acceptRevision ? { pass: true, issues: [] } : {
    pass: false, priorReviewCorrection: "Another reviewer reversal must not extend the limit again.", issues: [{ type: "unsupported_requirement", detail: "Synthetic final-verifier rejection: the revised conclusion has not passed semantic review." }]
  };
  return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
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
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline revision contract" } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  for (const [accepted, questionRepair, omission, repeated] of [[false,false,false],[true,false,false],[false,true,false],[true,true,false],[false,false,true],[true,false,true],[false,false,true,true],[true,false,true,true]]) {
    lateOmission = omission;
    repeatOmission = repeated;
    factQuestionRepair = questionRepair;
    acceptRevision = accepted;
    callIndex = 0;
    const created = await request("/research/conversations/create", { auth }, token);
    const conversationID = created.body.conversation.id;
    let response;
    for (const item of run.cases) {
      response = await request("/research/conversations/message", { auth, conversationID, question: item.question, requestID: randomUUID() }, token);
      if (item.id === "CC-03") assert.equal(response.status, 200, JSON.stringify(response.body));
    }
    assert.equal(callIndex, 8, "Reconciliation must also pass a fresh review.");
    if (!accepted) {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.conversation.messages.at(-1).answer.mode, "clarification");
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.status, 200);
      assert.equal(reopened.body.conversation.messages.filter((message) => message.role === "assistant").length, 2,
        "Only a canonical clarification may replace the rejected draft.");
      const telemetry = await request("/internal/evaluations/data", { auth }, token);
      const failed = telemetry.body.researchSpend.operationMetrics.find((operation) => operation.failureCode === "RESEARCH_VERIFICATION_FAILED");
      assert(failed && !failed.charged && failed.providerRequestCount === 6 && failed.pendingProviderRequestCount === 0);
    } else {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const message = response.body.conversation.messages.at(-1);
      assert.equal(message.answer.verification.history.at(-1).model, "gpt-5.6-luna");
      assert.equal(message.answer.verification.history.at(-1).pass, true);
      const saved = await request("/research/answers/get", { auth, answerID: message.id }, token);
      assert.equal(saved.status, 200);
      assert.equal(saved.body.answer.answer.answerText, message.answer.answerText);
    }
  }
  assert.equal(finalVerifierCalls, 8);
  console.log("Review conflict reconciliation HTTP replay passed: final rejection blocks save/turn charge; final acceptance persists the reviewed revision. All provider responses mocked, no external calls.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
