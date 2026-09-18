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
const scratch = await mkdtemp(join(tmpdir(), "permitext-output-truncation-"));
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
let mode, callIndex, finalVerifierCalls;
const budgets = [];
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request");
  const body = JSON.parse(options.body);
  const index = callIndex++;
  if (mode === "broad") {
    assert.equal(index, 0, "Do not repeat a broad response's already exhausted 6000-token ceiling");
    assert.equal(body.text.format.name, "permitext_code_interpretation");
    assert.equal(body.max_output_tokens, 6000);
    return Response.json({ model: body.model, status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
      usage: { input_tokens: 100, output_tokens: 6000 },
      output: [{type:"message",role:"assistant",content:[{type:"output_text",text:'{"answerText":'}]}] });
  }

  if (index >= 4 && index <= 5) {
    assert.equal(body.text.format.name, "permitext_code_interpretation");
    budgets.push(body.max_output_tokens);
    assert.equal(body.max_output_tokens, index === 4 ? 3000 : mode === "malformed" ? 3000 : 6000);
    if (index === 4 || mode !== "recover") return Response.json({
      model: body.model, status: mode === "malformed" ? "completed" : "incomplete",
      incomplete_details: mode === "malformed" ? undefined : { reason: "max_output_tokens" },
      usage: { input_tokens: 100, output_tokens: body.max_output_tokens },
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: '{"answerText":' }] }]
    });
  }
  let output;
  if (index <= 3) output = run.providerCalls[index].output;
  else if (index === 5) output = run.providerCalls[4].output;
  else {
    assert.equal(index, 6, "Only one structured retry and one final verification permitted");
    assert.equal(body.text.format.name, "permitext_research_verification");
    finalVerifierCalls++;
    output = [{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify({pass:true,issues:[]})}]}];
  }
  return Response.json({model:body.model,status:"completed",usage:{input_tokens:100,output_tokens:100},output});
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method:"POST",headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)
    });
    return {status:response.status,body:await response.json()};
  };
  const signed = await request("/account/sign-in",{credential:{provider:"web",providerUserID:randomUUID(),displayName:"Offline truncation contract"}});
  const account=signed.body.account, token=account.backendSessionToken, auth={accountUserID:account.appUserID};
  await request("/admin/lifetime-grants/grant",{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  mode="broad"; callIndex=0;
  const broadCreated=await request("/research/conversations/create",{auth},token);
  const broadID=broadCreated.body.conversation.id, broadRequestID=randomUUID();
  const broad=await request("/research/conversations/message",{auth,conversationID:broadID,
    question:"What are the requirements for designing a ramp based on the bc 2022?",requestID:broadRequestID},token);
  assert.equal(broad.status,502,JSON.stringify(broad.body));
  assert.equal(broad.body.code,"INVALID_RESEARCH_RESPONSE");
  assert.equal(callIndex,1);
  const broadReopened=await request("/research/conversations/get",{auth,conversationID:broadID},token);
  assert.equal(broadReopened.body.conversation.messages.length,1);
  assert.equal(broadReopened.body.conversation.messages[0].role,"user");
  assert.equal(broadReopened.body.conversation.messages[0].failure.code,"INVALID_RESEARCH_RESPONSE");
  assert.equal(broadReopened.body.conversation.messages[0].requestID,broadRequestID);
  for (mode of ["recover","exhaust","malformed"]) {
    callIndex=0; finalVerifierCalls=0; budgets.length=0;
    const created=await request("/research/conversations/create",{auth},token);
    const conversationID=created.body.conversation.id;
    let response;
    for (const item of run.cases) {
      response=await request("/research/conversations/message",{auth,conversationID,question:item.question,requestID:randomUUID()},token);
      if(item.id==="CC-03") assert.equal(response.status,200,JSON.stringify(response.body));
    }
    assert.equal(callIndex,mode==="recover"?7:6);
    assert.equal(finalVerifierCalls,mode==="recover"?1:0);
    const reopened=await request("/research/conversations/get",{auth,conversationID},token);
    assert.equal(reopened.body.conversation.messages.filter(m=>m.role==="assistant").length,mode==="recover"?2:1);
    if(mode==="recover") assert.equal(response.status,200,JSON.stringify(response.body));
    else {
      assert.equal(response.status,502,JSON.stringify(response.body));
      assert.equal(response.body.code,"INVALID_RESEARCH_RESPONSE");
      const telemetry=await request("/internal/evaluations/data",{auth},token);
      const failures=telemetry.body.researchSpend.operationMetrics.filter(m=>m.failureCode==="INVALID_RESEARCH_RESPONSE");
      const failed=failures.find(m=>m.verificationAttemptCount>0);
      assert(failed,"Earlier semantic verification diagnostics must survive truncated revision");
      assert.equal(failed.charged,false);
    }
  }
  console.log("Output truncation HTTP replay passed: broad ramp starts at6000 without redundant same-limit retry; normal3000 can retry6000 after truncation; malformed retry unchanged; strict final verifier and prior diagnostics retained; external calls: zero.");
} finally {
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  globalThis.fetch=nativeFetch;
  await rm(scratch,{recursive:true,force:true});
}
