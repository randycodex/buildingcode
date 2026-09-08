// Real HTTP handler, corpus, gates and persistence; every provider response is
// a handwritten double. This is pipeline coverage, not live semantic grading.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { conditionalFixtureAnswer } from "./research-zoning-conditional-fixtures.mjs";
import { targetedZoningContextExcerpt } from "../research-zoning-context-excerpts.mjs";
import { planZoningResearchQuestion } from "../research-zoning-planner.mjs";

const scratch = await mkdtemp(join(tmpdir(), "permitext-conditional-http-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "10",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "10", PERMITEXT_RESEARCH_DAILY_CAP_USD: "10", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "10",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test",
  // Even this optional provider stage must not expand the two-call scope.
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "1", PERMITEXT_RESEARCH_WEB_SUPPORT: "1"
});
const nativeFetch = globalThis.fetch;
let activeID, mode, phases, proposed, doubleError;
const respondWithDouble = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request.");
  const body = JSON.parse(options.body);
  const phase = body.text.format.name;
  phases.push(phase);
  assert(phases.length <= 2, "Conditional path must not retry, rewrite, search, or add model evidence analysis.");
  const input = typeof body.input === "string" ? body.input : body.input.flatMap((item) => item.content.map((part) => part.text || "")).join("\n");
  assert.match(input, /ANSWER_SCOPE: conditional_source_explanation; PROPERTY_DETERMINATION: unresolved/);
  assert.match(input, /MISSING_PROJECT_FACTS/);
  if (mode === "provider_error") return Response.json({ error: { message: "Synthetic unavailable provider" } }, { status: 503 });
  let output;
  if (phase === "permitext_code_interpretation") {
    assert.equal(phases.length, 1);
    const evidence = Array.from(input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: [^\n]+\nSECTION: ([^\n]+)/g),
      ([, sourceID, sectionID, sectionNumber]) => ({ sourceID, sectionID, sectionNumber }));
    if (activeID === "ZR-06") assert(input.includes("documentation satisfactory to the Department of Buildings"), "Storage closing conditions must be supplied to the answering model.");
    proposed = conditionalFixtureAnswer(activeID, evidence);
    if (mode === "unsafe") proposed.answerText = `Yes. This property is approved.\n\n${proposed.answerText}`;
    output = mode === "invalid_draft" ? "invalid JSON double" : JSON.stringify(proposed);
  } else {
    assert.equal(phase, "permitext_research_verification");
    assert.equal(phases.length, 2);
    const actual = JSON.parse(input.split("PROPOSED ANSWER JSON\n")[1]);
    assert.equal(actual.answerText, proposed.answerText, "Verify the actual final narrative.");
    assert(actual.missingFacts.length);
    const accepted = mode === "accept";
    output = JSON.stringify({ pass: accepted, issues: accepted ? [] : [{ type: "unsupported_requirement", detail: "Synthetic rejection of a cited rule; a boundary alone must not make the answer successful." }], unnecessaryMissingFactIndices: [] });
  }
  return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    output: [{ type: "message", content: [{ type: "output_text", text: output }] }] });
};
globalThis.fetch = async (...args) => {
  try { return await respondWithDouble(...args); }
  catch (error) { doubleError = error; throw error; }
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  const { zoningSectionSummary, zoningSection } = await import("../zoning-content.mjs");
  const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline conditional contract" } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  const auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const seen = new Set();
  for (activeID of ["ZR-06", "ZR-07", "ZR-13"]) {
    const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === activeID), { original: true, zoningSummary: zoningSectionSummary });
    // Exercise the Reader's real exact-passage protocol. These canonical
    // passages cover the test double's cited rules; they are not reference-key
    // prose. The separate assembly contract covers all authored section pins.
    const selectedIDs = activeID === "ZR-06" ? [20022473, 20022474] : activeID === "ZR-07" ? [20018425] : [20018060];
    const selections = (await Promise.all(selectedIDs.map(async (sectionID) => {
      const section = await zoningSection(sectionID);
      const text = section.blocks.map((block) => block.plainText || "").join("\n\n").replace(/\s+/g, " ").trim();
      if (sectionID === 20022473) {
        const excerpt = targetedZoningContextExcerpt({ codePrefix: "ZR", sectionNumber: "42-192", text }, { question: input.question, plan: planZoningResearchQuestion(input) });
        assert(excerpt);
        return excerpt.metadata.spans.map(({ start, end }) => ({ sectionID: String(sectionID), selectedText: text.slice(start, end) }));
      }
      return [{ sectionID: String(sectionID), selectedText: text }];
    }))).flat();
    for (mode of ["accept", "verification_reject", "unsafe", "provider_error", "invalid_draft"]) {
      phases = [];
      doubleError = null;
      const created = await request("/research/conversations/create", { auth, selections, originSurface: "reader" }, token);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const conversationID = created.body.conversation.id;
      const response = await request("/research/conversations/message", { auth, conversationID, question: input.question, requestID: randomUUID() }, token);
      if (doubleError) throw doubleError;
      if (mode === "accept") {
        assert.equal(response.status, 200, `${activeID}: ${JSON.stringify(response.body)}`);
        const message = response.body.conversation.messages.findLast((item) => item.role === "assistant");
        assert.equal(message.answer.answerText, proposed.answerText);
        const { plan } = message.answer.zoningArchitecture;
        assert.equal(message.answer.zoningArchitecture.deterministicContext.planHash, plan.planHash);
        assert.equal(plan.disposition, "conditional_source_explanation");
        assert.equal(plan.conditionalExplanation.determinationStatus, "unresolved");
        assert.equal(plan.conditionalExplanation.prerequisiteMaximumProviderCalls, 0);
        assert(plan.missingFacts.length);
        assert.equal(message.answer.retrieval.webSupportRequested, false);
        const saved = await request("/research/answers/get", { auth, answerID: message.id }, token);
        assert.equal(saved.body.answer.answer.answerText, proposed.answerText);
        assert.deepEqual(saved.body.answer.answer.zoningArchitecture.plan, plan);
        assert(saved.body.answer.evidence.length);
      } else {
        assert.equal(response.status, 502, `${activeID}/${mode}: ${JSON.stringify(response.body)}`);
        const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
        assert.equal(reopened.body.conversation.messages.filter((item) => item.role === "assistant").length, 0);
      }
      assert.deepEqual(phases, ["accept", "verification_reject"].includes(mode)
        ? ["permitext_code_interpretation", "permitext_research_verification"] : ["permitext_code_interpretation"]);
      const telemetry = await request("/internal/evaluations/data", { auth }, token);
      const operations = telemetry.body.researchSpend.operationMetrics.filter((operation) => !seen.has(operation.id));
      assert.equal(operations.length, 1);
      const operation = operations[0];
      seen.add(operation.id);
      assert.equal(operation.charged, mode === "accept");
      assert.equal(operation.providerRequestCount, phases.length);
      // A 503 without usage retains its conservative accounting reservation;
      // lack of a saved user answer must not be mistaken for zero API cost.
      assert.equal(operation.pendingProviderRequestCount, mode === "provider_error" ? 1 : 0);
      if (mode === "provider_error") assert(operation.conservativeProviderCostUSD > 0);
    }
  }
  phases = [];
  doubleError = null;
  const created = await request("/research/conversations/create", { auth }, token);
  const question = "Reconstruct the text in force under the NYC Zoning Resolution on January 1, 2020.";
  const boundary = await request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question, requestID: randomUUID() }, token);
  if (doubleError) throw doubleError;
  assert.equal(boundary.status, 422, JSON.stringify(boundary.body));
  assert.equal(boundary.body.code, "RESEARCH_ZONING_PREREQUISITES_REQUIRED");
  assert.equal(boundary.body.charged, false);
  assert(boundary.body.zoningPlan.missingFacts.some((fact) => fact.id === "dated_substantive_text"));
  assert.deepEqual(phases, [], "Missing historical law must still stop before provider dispatch.");
  console.log("Conditional HTTP contract passed: 16 offline flows; cited answers persist with unresolved determination, rejected/invalid/unavailable answers stay unsaved and uncharged, maximum two provider doubles, missing historical law blocks dispatch, zero external calls.");
} finally {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await rm(scratch, { recursive: true, force: true });
}
