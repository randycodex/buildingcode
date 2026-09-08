// Actual Research HTTP and verification path, with retained draft text and
// synthetic repair patches. No provider traffic or Project workflow.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-zoning-expansion-2026-09-08.json", import.meta.url)));
const record = retained.results.find((item) => item.id === "ZR-18");
const draft = JSON.parse(retained.providerCalls.find((item) => item.caseID === record.id).output[0].content[0].text);
const scratch = await mkdtemp(join(tmpdir(), "permitext-temporal-http-"));
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "10",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "10", PERMITEXT_RESEARCH_DAILY_CAP_USD: "10", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "10",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const nativeFetch = globalThis.fetch;
let mode, phases, proposed, doubleError;
const correctedPoint = (point) => ({ ...point, explanation: "Section 77-02 generally regulates each portion under its own district. For this lot, that application depends on confirming that it did not exist on the applicable effective or amendment date; the assembly year alone does not settle that date condition." });
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body), phase = body.text.format.name;
    phases.push(phase); assert(phases.length <= 3);
    const input = typeof body.input === "string" ? body.input : body.input.flatMap((item) => item.content.map((part) => part.text || "")).join("\n");
    let output;
    if (phase === "permitext_code_interpretation") {
      assert.equal(phases.length, 1); assert.match(input, /divided_lot_effective_date_application/);
      const ids = new Map(Array.from(input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)/g), ([, sourceID, sectionID]) => [sectionID, sourceID]));
      const replacements = new Map(record.answer.citations.flatMap((citation) => citation.sourceIDs.map((id) => [id, ids.get(citation.sectionID)])));
      assert([...replacements.values()].every(Boolean));
      proposed = JSON.parse(JSON.stringify(draft), (key, value) => typeof value === "string" && replacements.has(value) ? replacements.get(value) : value);
      if (mode === "correct-draft") proposed.supportedPoints[1] = correctedPoint(proposed.supportedPoints[1]);
      output = proposed;
    } else if (phase === "permitext_zoning_source_bounded_repair") {
      assert.equal(phase, "permitext_zoning_source_bounded_repair"); assert.equal(phases.length, 2);
      assert.match(input, /TEMPORAL_APPLICATION_NOT_ESTABLISHED/i);
      assert.match(input, /77-02/); assert.match(input, /77-11/);
      output = { answerText: proposed.answerText,
        supportedPointUpserts: [{ targetIndex: 1, value: mode === "correct-repair" ? correctedPoint(proposed.supportedPoints[1]) : proposed.supportedPoints[1] }],
        supportedPointRemovals: [], citationUpserts: [], citationRemovals: [], missingFactsAdd: [], missingFactsRemove: [],
        evidenceLimitationsAdd: [], evidenceLimitationsRemove: [], additionalEvidenceNeededAdd: [], additionalEvidenceNeededRemove: [] };
    } else {
      assert.equal(mode, "correct-repair"); assert.equal(phases.length, 3);
      assert.equal(phase, "permitext_research_verification");
      const verified = JSON.parse(input.split("PROPOSED ANSWER JSON\n")[1]);
      assert.equal(verified.supportedPoints[1].explanation, correctedPoint(proposed.supportedPoints[1]).explanation);
      assert.equal(verified.answerText, proposed.answerText);
      output = { pass: true, issues: [], unnecessaryMissingFactIndices: [] };
    }
    return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] });
  } catch (error) { doubleError = error; throw error; }
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline Research temporal contract" } });
  assert.equal(signed.status, 200);
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  const grant = await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN); assert.equal(grant.status, 200);
  const selections = record.answer.citations.map((citation) => ({ sectionID: citation.sectionID, selectedText: citation.supportingPassages[0].selectedText }));
  const seen = new Set();
  for (mode of ["bad-repair", "correct-repair", "correct-draft"]) {
    phases = []; doubleError = null;
    const created = await request("/research/conversations/create", { auth, selections, originSurface: "reader" }, token); assert.equal(created.status, 201);
    const response = await request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question: record.question, requestID: randomUUID() }, token);
    if (doubleError) throw doubleError;
    assert.deepEqual(phases, mode === "correct-draft" ? ["permitext_code_interpretation"] : mode === "correct-repair"
      ? ["permitext_code_interpretation", "permitext_zoning_source_bounded_repair", "permitext_research_verification"]
      : ["permitext_code_interpretation", "permitext_zoning_source_bounded_repair"]);
    if (mode === "bad-repair") { assert.equal(response.status, 502); assert.equal(response.body.code, "RESEARCH_VERIFICATION_FAILED"); }
    else {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const delivered = response.body.conversation.messages.findLast((message) => message.role === "assistant").answer;
      assert.equal(delivered.supportedPoints[1].explanation, correctedPoint(proposed.supportedPoints[1]).explanation);
      assert.equal(delivered.verification.sourceBoundedRepairApplied, mode === "correct-repair");
      assert(delivered.verification.pass);
    }
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    const operations = telemetry.body.researchSpend.operationMetrics.filter((operation) => !seen.has(operation.id));
    assert.equal(operations.length, 1); const operation = operations[0]; seen.add(operation.id);
    assert.equal(operation.charged, mode !== "bad-repair"); assert.equal(operation.providerRequestCount, phases.length); assert.equal(operation.pendingProviderRequestCount, 0);
  }
} finally {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await rm(scratch, { recursive: true, force: true });
}
console.log("Temporal HTTP checks passed: retained bad draft requires bounded repair, unchanged bad repair fails without charging a turn, corrected repair reaches its existing final verifier, corrected first draft passes directly; provider responses are doubles, no paid calls or Project workflow.");
