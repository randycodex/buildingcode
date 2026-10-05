// Actual Research HTTP, entitlement, binding and persistence; synthetic
// provider verdicts test mechanics only, never legal/source acceptance.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syntheticMaterialScopeReview } from "./research-applicability-response-double.mjs";

const scratch = await mkdtemp(join(tmpdir(), "permitext-source-explanation-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "", OPENAI_API_KEY: "offline-provider-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0",
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "single",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_SERVICE_TIER: "priority", PERMITEXT_RESEARCH_REVISION_REASONING_EFFORT: "high",
  PERMITEXT_RESEARCH_REVISION_SERVICE_TIER: "default", PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01", PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "offline-contract", PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "5",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "5" });
const nativeFetch = globalThis.fetch;
const intact = "The identification rule describes the area served.";
let wrong = "The exception covers equipment serving any room.";
let corrected = "The supplied exception is limited to equipment or appliances located within the room or space they serve.";
let scenario, calls, draft, beforePatch, afterPatch, doubleError;
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body), phase = body.text.format.name;
    calls.push(phase); assert(calls.length <= 4, "No new calls or answer revisions are allowed");
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.reasoning.effort, phase === "permitext_research_verification" ? "medium" : calls.length === 1 ? "low" : "high");
    assert.equal(body.service_tier, phase === "permitext_research_verification" || calls.length === 1 ? "priority" : "default");
    let value;
    if (phase === "permitext_code_interpretation") {
      if (!draft) {
        const match = [...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: MC\nSECTION: ([^\n]+)/g)]
          .find(m => m[3] === "304.12"); assert(match);
        draft = { answerText: `${intact} ${wrong}`, supportedPoints: [
          { heading: "Any room exception", explanation: wrong, sectionID: match[2], sourceIDs: [match[1]] },
          { heading: "Independent identification statement", explanation: intact, sectionID: match[2], sourceIDs: [match[1]] }
        ], citations: [{ sectionID: match[2], sourceIDs: [match[1]], relevance: wrong }],
        assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: [] };
      }
      value = calls.length === 1 ? draft : { ...draft, answerText: `${intact} ${corrected}`,
        supportedPoints: [{ ...draft.supportedPoints[0], heading: "Located-in-served-space exception", explanation: corrected }, draft.supportedPoints[1]],
        citations: [{ ...draft.citations[0], relevance: corrected }] };
      if (calls.length === 3) assert(scenario.endsWith("categorical"), "Only categorical failures retain full rewrite here");
    } else if (phase === "permitext_research_targeted_revision") {
      assert.equal(calls.length, 3);
      assert(!scenario.endsWith("categorical"));
      const targets = JSON.parse(body.input.split("EDITABLE TEXT TARGETS\n")[1]);
      const replacement = target => target.path.endsWith("/heading") ? "Located-in-served-space exception" : corrected;
      value = { edits: targets.filter(t => t.text.trim() === wrong || t.path === "supportedPoints/0/heading")
        .map(t => ({ targetID: t.id, after: replacement(t), remove: false })),
        bindingAdditions: [], pointRemovals: [], citationRemovals: [] };
      assert.equal(value.edits.length, 4, "Correct narrative, point heading/explanation and citation relevance together");
    } else {
      assert.equal(phase, "permitext_research_verification");
      const answer = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
      const materialScopeReview = syntheticMaterialScopeReview(body);
      const first = calls.length === 2;
      if (first) {
        beforePatch = answer;
        for (const row of Object.values(materialScopeReview.checks)) {
          row.sourceResult = scenario.startsWith("false-limitation") ? "supported" : "unsupported"; row.categoricalApplication = scenario.endsWith("categorical");
        }
      } else {
        afterPatch = answer;
        assert.equal(answer.answerText, `${intact} ${corrected}`);
        assert.deepEqual(answer.supportedPoints[1], beforePatch.supportedPoints[1], "Independent conditions and bindings are preserved");
        assert.deepEqual(answer.citations[0], { ...beforePatch.citations[0], relevance: corrected }, "Only citation prose changes; canonical passage/metadata are immutable");
      }
      const fail = first || scenario.endsWith("rejected");
      value = { pass: !fail, issues: fail ? [{ type: scenario.startsWith("false-limitation") ? "false_evidence_limitation" : "misstated_provision", detail: "Synthetic source explanation broadens the exception recipient." }] : [],
        materialScopeReview };
    }
    return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 },
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
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
  for (scenario of ["accepted", "rejected", "categorical", "false-limitation", "false-limitation-rejected", "false-limitation-categorical"]) {
    wrong = scenario.startsWith("false-limitation") ? "The supplied evidence does not resolve the exception recipient." : "The exception covers equipment serving any room.";
    corrected = "The supplied exception is limited to equipment or appliances located within the room or space they serve.";
    calls = []; draft = beforePatch = afterPatch = doubleError = undefined;
    const created = await request("/research/conversations/create", { auth }, token), conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, requestID: randomUUID(),
      question: "For our project under the 2022 NYC codes, what identification rule does MC 304.12 provide for installed equipment?" }, token);
    if (doubleError) throw doubleError;
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ["permitext_code_interpretation", "permitext_research_verification",
      scenario.endsWith("categorical") ? "permitext_code_interpretation" : "permitext_research_targeted_revision", "permitext_research_verification"]);
    const answer = response.body.conversation.messages.at(-1).answer;
    assert.equal(answer.mode, scenario.endsWith("rejected") ? "clarification" : "openai");
    const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
    assert.equal(reopened.body.conversation.messages.at(-1).answer.answerText, answer.answerText);
    assert.equal(reopened.body.conversation.messages.filter(m => m.role === "assistant").length, 1);
    if (scenario.endsWith("rejected")) assert.deepEqual(answer.citations, [], "A patched but unverified candidate is not delivered");
  }
  console.log("Source explanation HTTP contract passed: bound completed review, targeted condition edits, unchanged independent text/canonical sources, full-review rejection, categorical fallback, Luna roles and persistence; four synthetic calls per turn.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch; await rm(scratch, { recursive: true, force: true });
}
