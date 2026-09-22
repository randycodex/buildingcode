import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile, writeFile, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
const live = process.argv.includes("--live");
const runID = process.argv.find(arg => arg.startsWith("--run-id="))?.slice(9) || "2026-09-21";
assert.match(runID, /^[a-z0-9-]+$/, "Run ID must be a safe artifact name.");
const resultURL = new URL(`../evals/results/research-walkthrough-repair-${live?'live':'offline'}-${runID}.json`, import.meta.url);
const config = live ? parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8")) : {};
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key)) delete process.env[key];
if(live){ assert(config.OPENAI_API_KEY && config.OPENAI_API_KEY !== "[SENSITIVE]"); for(const [key,value] of Object.entries(config)) if(key.startsWith("PERMITEXT_RESEARCH_")) process.env[key]=value; process.env.OPENAI_API_KEY=config.OPENAI_API_KEY; }
const results=[]; let providerCalls=0;
if(live) await (await open(resultURL, "wx", 0o600)).close();

// Isolated full HTTP/corpus replay. Default forbids external calls; --live is
// single-use, owner-authorized for three turns and a maximum $2 provider spend.
const questions = [
 'Based only on the selected 2022 BC 101.1 passage, what is the code called and how are section numbers designated? Cite the passage.',
 'Does that passage alone establish whether a particular building complies with the code? Explain its limits without adding unsupported requirements.',
 'What does BC 101.1 call this code?'
];
const temporary = await mkdtemp(join(tmpdir(), "permitext-selected-passage-"));
Object.assign(process.env, {
  NODE_ENV: live ? "" : "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: live ? "0" : "1",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-20260908-terra",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02", PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-20260908-luna",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: live ? "1" : "0", PERMITEXT_RESEARCH_EVAL_MAX_USD: "2",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.65", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2", PERMITEXT_RESEARCH_DAILY_CAP_USD: "2", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2", PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: "3",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1", PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-passage-grant"
});
for (const key of ["DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if(url.origin !== base){
    assert(live, "Offline mode forbids external calls.");
    assert.equal(url.href, "https://api.openai.com/v1/responses");
    const body=JSON.parse(options.body);
    assert(!(body.tools||[]).some(t=>/web_search/.test(t.type)), "Paid search is outside this bounded test.");
    assert(++providerCalls<=12, "Provider call cap");
  }
  return originalFetch(input, options);
};
let userID;
let token;
async function request(path, body, bearer = token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ auth: { accountUserID: userID }, ...body })
  });
  const json = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(json)}`);
  return json;
}
try {
  const signedIn = await request("/account/sign-in", { credential: {
    provider: "web", providerUserID: "synthetic-passage-owner",
    email: "passage@example.test", displayName: "Synthetic passage test"
  } });
  token = signedIn.account.backendSessionToken;
  userID=signedIn.account.appUserID;
  await request("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const created = await request("/research/conversations/create", {
    requestID: "synthetic-passage-create", originSurface: "reader",
    sectionID: "1",
    selectedText: 'This code shall be known and may be cited as the "New York City Building Code," "NYCBC" or "BC". All section numbers in this code shall be deemed to be preceded by the designation "BC".' 
  });
  let conversationID=created.conversation.id;
  for(let i=0;i<questions.length;i++){
    if(i===2) conversationID=(await request("/research/conversations/create",{})).conversation.id;
    const start=Date.now();
    let result;
    try {
      result=await request("/research/conversations/message",{conversationID,question:questions[i],requestID:`walkthrough-${i}`});
    } catch (error) {
      results.push({question:questions[i],durationMs:Date.now()-start,status:"failed",error:error.message});
      throw error;
    }
    const answer=result.conversation.messages.findLast(m=>m.role==="assistant")?.answer;
    assert(answer);
    results.push({question:questions[i],durationMs:Date.now()-start,answer});
    console.log(JSON.stringify({turn:i+1,durationMs:Date.now()-start,providerCalls,answerText:answer.answerText}));
    assert.equal(answer.retrieval.webSupportRequested,false);
    assert.doesNotMatch(JSON.stringify({answerText:answer.answerText,evidenceLimitations:answer.evidenceLimitations}), /zr\.planning|program-specific minimum|Official starting point/i);
    const reopened=await request("/research/conversations/get",{conversationID});
    assert.deepEqual(reopened.conversation.messages.findLast(m=>m.role==="assistant").answer,answer);
  }
  console.log("All three Research turns completed and persisted.");
} finally {
  globalThis.fetch = originalFetch;
  const stored=await createFileStoreAdapter().read();
  const operations=Object.values(stored.researchOperationsByUserID||{}).flatMap(v=>Array.isArray(v)?v:Object.values(v||{}));
  await writeFile(resultURL, JSON.stringify({mode:live?'live-isolated-local':'offline-mock',providerCalls,maximumSpendUSD:live?2:0,results,operations},null,2)+'\n',{mode:0o600});
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
