// Actual Research HTTP, entitlement, binding and persistence; synthetic
// provider verdicts test mechanics only, never legal/source acceptance.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syntheticMaterialScopeReview } from "./research-applicability-response-double.mjs";

const scratch = await mkdtemp(join(tmpdir(), "permitext-repair-parent-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "", OPENAI_API_KEY: "offline-provider-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0", PERMITEXT_RESEARCH_PASSAGE_SEARCH: "1",
  PERMITEXT_RESEARCH_ADVISORY_TOPIC_ROUTES: "1", PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: "1", PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING: "1",
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "single",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_SERVICE_TIER: "priority", PERMITEXT_RESEARCH_REVISION_REASONING_EFFORT: "high",
  PERMITEXT_RESEARCH_REVISION_SERVICE_TIER: "default", PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01", PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "offline-contract", PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "5",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "5" });
const nativeFetch = globalThis.fetch;
let scenario, calls, draft, beforeRepair, doubleError;
const sentence = "The ramp requires 84 inches of headroom throughout.";
const newSentence = "The supplied door-landing provision states a 44-inch length subject to its exceptions; its door scope requires review.";
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body), phase = body.text.format.name;
    calls.push(phase); assert(calls.length <= 4);
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.reasoning.effort, phase === "permitext_research_verification" ? "medium" : calls.length === 1 ? "low" : "high");
    let value;
    if (phase === "permitext_code_interpretation") {
      const passages = [...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: BC\nSECTION: ([^\n]+)/g)];
      const core = passages.find(m => m[3] === "1012.5.2"), child = passages.find(m => m[3] === "1010.1.6");
      assert(core && child);
      assert(!passages.some(m => m[3] === "1010.1"), "The initial assembly reproduces a missing door scope");
      draft ||= { answerText: sentence,
        supportedPoints: [{ heading: "Ramp headroom", explanation: sentence, sectionID: core[2], sourceIDs: [core[1]] }],
        citations: [{ sectionID: core[2], sourceIDs: [core[1]], relevance: sentence }],
        assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: [] };
      value = structuredClone(draft);
      if (calls.length === 3) {
        value.answerText += " " + newSentence;
        value.supportedPoints.push({ heading: "Door landing source", explanation: newSentence, sectionID: child[2], sourceIDs: [child[1]] });
        value.citations.push({ sectionID: child[2], sourceIDs: [child[1]], relevance: newSentence });
      }
    } else {
      assert.equal(phase, "permitext_research_verification", "The synthetic categorical failure must use full revision");
      const answer = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
      const first = calls.length === 2;
      if (first) beforeRepair = answer;
      else {
        assert(body.input.includes("SECTION: BC 1010.1\n"), "Fresh review receives the canonical parent of the newly used child");
        assert(body.input.includes("Means of egress doors shall meet the requirements of this section"));
        assert.deepEqual(answer.citations[0], beforeRepair.citations[0], "Canonical original citation stays immutable");
        assert.deepEqual(answer.supportedPoints[0], beforeRepair.supportedPoints[0]);
      }
      const materialScopeReview = syntheticMaterialScopeReview(body);
      const fail = first || scenario === "rejected";
      value = { pass: !fail, issues: fail ? [{ type: "unsupported_requirement", detail: "Synthetic substantive failure requires review, not automatic acceptance." }] : [], materialScopeReview };
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
  for (scenario of ["accepted", "rejected"]) {
    calls = []; draft = beforeRepair = doubleError = undefined;
    const created = await request("/research/conversations/create", { auth }, token), conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, requestID: randomUUID(),
      question: "Explain the 2022 NYC Building Code minimum dimensions for a means-of-egress ramp: corridor-based capacity, clear width, headroom, width reductions and a door opening onto a landing." }, token);
    if (doubleError) throw doubleError;
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ["permitext_code_interpretation", "permitext_research_verification", "permitext_code_interpretation", "permitext_research_verification"]);
    const answer = response.body.conversation.messages.at(-1).answer;
    assert.equal(answer.mode, scenario === "rejected" ? "clarification" : "openai");
    if (scenario === "accepted") {
      assert(answer.retrieval.repairRetrieval.supplied.some(s => s.sectionNumber === "1010.1"));
      const record = await request("/research/answers/get", { auth, answerID: response.body.conversation.messages.at(-1).id }, token);
      assert.equal(record.status, 200);
      assert(record.body.answer.evidence.some(s => s.sectionNumber === "1010.1" && s.passageText.includes("Means of egress doors")));
    } else assert.deepEqual(answer.citations, [], "Parent retrieval cannot override fresh substantive rejection");
    const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
    assert.equal(reopened.body.conversation.messages.at(-1).answer.answerText, answer.answerText);
  }
  console.log("Repair-introduced parent HTTP contract passed: canonical scope supplied before fresh review, immutable original citation/point, snapshots/persistence, substantive rejection and Luna roles; synthetic providers only.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch; await rm(scratch, { recursive: true, force: true });
}
