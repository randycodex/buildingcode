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
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_REASONING_EFFORT: "high",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "0.1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.01",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "0.5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});

const nativeFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  const body = JSON.parse(options.body);
  const writer = body.text.format.name === "permitext_code_interpretation";
  assert.equal(body.model, writer ? "gpt-6-luna" : "gpt-5.6-luna");
  assert.equal(body.reasoning.effort, writer ? "high" : "low");
  if (writer) assert.equal(body.max_output_tokens, 24000);
  const index = calls++;
  const output = index < 5 ? run.providerCalls[index].output : index === 5
    ? [{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify({pass:true,issues:[]})}]}] : null;
  assert(output, "Unexpected additional provider call");
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
  const created = await request("/research/conversations/create", {auth}, token);
  assert.equal(created.status, 201);
  const conversationID = created.body.conversation.id;
  for (const item of run.cases) {
    const response = await request("/research/conversations/message", {auth, conversationID, question:item.question, requestID:randomUUID()}, token);
    assert.equal(response.status, 200, JSON.stringify(response.body));
  }
  assert.equal(calls, 6);
  console.log("Luna 6 high HTTP replay passed: actual writer and revision requests use high effort and 24000 tokens; verifier remains Luna 5.6 low; no external calls.");
} finally {
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  globalThis.fetch=nativeFetch;
  await rm(scratch,{recursive:true,force:true});
}
