// Real backend, source binding and persistence; synthetic provider verdicts.
// This checks bounded reconciliation mechanics, not semantic/legal accuracy.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withSyntheticMaterialScopeProviderResponse } from "./research-applicability-response-double.mjs";
const scratch = await mkdtemp(join(tmpdir(), "permitext-citation-reconciliation-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "", OPENAI_API_KEY: "offline-provider-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0", PERMITEXT_RESEARCH_MODEL: "gpt-6-luna",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "single",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_SERVICE_TIER: "priority", PERMITEXT_RESEARCH_REVISION_REASONING_EFFORT: "high",
  PERMITEXT_RESEARCH_REVISION_SERVICE_TIER: "default", PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01", PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "offline-contract", PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "5",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "5" });
const nativeFetch = globalThis.fetch;
let scenario, calls, reviews, proposed, beforePatch, afterPatch, doubleError;
const citationIssue = { type: "irrelevant_citation", detail: "Synthetic final review: the terminology citation is unnecessary; the identification source independently supplies the rule." };
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body), phase = body.text.format.name;
    calls.push(phase);
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.reasoning.effort, phase === "permitext_research_verification" ? "medium" : calls.length === 1 ? "low" : "high");
    assert.equal(body.service_tier, phase === "permitext_research_verification" || calls.length === 1 ? "priority" : "default");
    let value;
    if (phase === "permitext_code_interpretation") {
      if (!proposed) {
        const sources = [...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: [^\n]+\nSECTION: ([^\n]+)/g)];
        const rule = sources.find(s => s[3] === "304.12"), extra = sources.find(s => s[3] === "201.4");
        assert(rule && extra);
        const explanation = "MC 304.12 requires identification of the area served, with the exception for equipment serving only its own room or space.";
        proposed = { answerText: explanation, supportedPoints: [{ heading: "Identification", explanation,
          sectionID: rule[2], sourceIDs: [rule[1]] }], citations: [
          { sectionID: rule[2], sourceIDs: [rule[1]], relevance: "Identification rule and its exception." },
          { sectionID: extra[2], sourceIDs: [extra[1]], relevance: "Additional terminology." }],
          assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [],
          additionalEvidenceNeeded: [], supportingSourceUses: [] };
      }
      value = calls.length === 1 ? proposed : { ...proposed, answerText: "For the rule stated in MC 304.12: " + proposed.answerText };
    } else if (phase === "permitext_research_targeted_revision") {
      assert.equal(calls.length, 5, "Only one narrow final reconciliation is allowed");
      value = { edits: [], bindingAdditions: [], pointRemovals: [], citationRemovals: [1] };
    } else {
      assert.equal(phase, "permitext_research_verification");
      const candidate = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]); reviews++;
      if (reviews === 1) value = { pass: false, issues: [{ type: "unsupported_requirement", detail: "Synthetic initial finding: state the source-bounded rule." },
        ...(scenario === "repeated" ? [citationIssue] : [])] };
      else if (reviews === 2) { beforePatch = candidate; value = { pass: false, issues: [citationIssue] }; }
      else {
        afterPatch = candidate;
        assert.equal(candidate.answerText, beforePatch.answerText);
        assert.deepEqual(candidate.supportedPoints, beforePatch.supportedPoints);
        assert.deepEqual(candidate.citations, [beforePatch.citations[0]], "Only the unnecessary citation is removed; canonical passages and binding stay unchanged");
        value = scenario === "rejected" ? { pass: false, issues: [{ type: "unsupported_requirement", detail: "Synthetic fresh review still rejects the repaired candidate." }] }
          : { pass: true, issues: [] };
      }
    }
    return Response.json(withSyntheticMaterialScopeProviderResponse(body, { model: body.model, status: "completed",
      usage: { input_tokens: 100, output_tokens: 100 }, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] }));
  } catch (error) { doubleError = error; throw error; }
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID() } });
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  for (scenario of ["accepted", "rejected", "repeated"]) {
    calls = []; reviews = 0; proposed = beforePatch = afterPatch = doubleError = undefined;
    const created = await request("/research/conversations/create", { auth }, token), conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, requestID: randomUUID(),
      question: "For our project under the 2022 NYC codes, what identification rule does MC 304.12 provide for installed equipment?" }, token);
    if (doubleError) throw doubleError;
    assert.equal(response.status, 200);
    const answer = response.body.conversation.messages.at(-1).answer;
    assert.deepEqual(calls, ["permitext_code_interpretation", "permitext_research_verification", "permitext_code_interpretation", "permitext_research_verification",
      ...(scenario === "repeated" ? [] : ["permitext_research_targeted_revision", "permitext_research_verification"])]);
    assert.equal(answer.mode, scenario === "accepted" ? "openai" : "clarification");
    if (scenario === "accepted") assert.equal(answer.answerText, afterPatch.answerText);
    const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
    assert.equal(reopened.body.conversation.messages.at(-1).answer.answerText, answer.answerText);
    assert.equal(reopened.body.conversation.messages.filter(m => m.role === "assistant").length, 1);
    if (scenario !== "accepted") assert.deepEqual(answer.citations, [], "An unverified candidate is never delivered");
  }
  console.log("Citation reconciliation HTTP contract passed: one first-appearing narrow patch, immutable retained evidence, fresh-review rejection, repeated-finding stop, Luna roles and durable answer; zero provider calls.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch; await rm(scratch, { recursive: true, force: true });
}
