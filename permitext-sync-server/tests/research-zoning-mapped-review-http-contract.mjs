// Real unassigned Research HTTP handler with intercepted provider calls.
// The retained generated draft is supplemented only in explicitly handwritten
// test cases. No result here is live generation or semantic-quality evidence.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ownerResearchScopeInput, ownerResearchHTTPSelections } from "../evals/research-owner-scope-input.mjs";

const scratch = await mkdtemp(join(tmpdir(), "permitext-mapped-review-http-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1", PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "10", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "10",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "10", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "10",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-storage-scope-2026-09-09.json", import.meta.url)));
const original = JSON.parse(retained.providerCalls[0].output.flatMap((item) => item.content || []).find((item) => item.type === "output_text").text);
const nativeFetch = globalThis.fetch;
let mode, phases, doubleError, proposed, lastReview;
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request.");
    const body = JSON.parse(options.body), phase = body.text.format.name;
    phases.push(phase); assert(phases.length <= 2, "No extra provider call, retry or rewrite is allowed.");
    const input = body.input;
    let value;
    if (phase === "permitext_code_interpretation") {
      assert.equal(phases.length, 1);
      const sources = [...input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: [^\n]+\nSECTION: ([^\n]+)/g)]
        .map(([, sourceID, sectionID, sectionNumber]) => ({ sourceID, sectionID, sectionNumber }));
      const ids = new Map(original.citations.flatMap((citation) => citation.sourceIDs.map((id) =>
        [id, sources.find((source) => source.sectionID === citation.sectionID)?.sourceID])));
      assert([...ids.values()].every(Boolean));
      proposed = structuredClone(original);
      for (const item of [...proposed.citations, ...proposed.supportedPoints]) item.sourceIDs = item.sourceIDs.map((id) => ids.get(id));
      if (mode !== "missing_branches") {
        const historical = sources.find((source) => source.sectionNumber === "42-192");
        proposed.supportedPoints.push({ heading: "Historical alternatives", sectionID: historical.sectionID, sourceIDs: [historical.sourceID],
          explanation: "A damaged or destroyed building with satisfactory DOB documentation may be reconstructed on the same zoning lot, subject to the Section 43-10 floor-area cap. A facility existing on December 19, 2017 without satisfactory documentation is nonconforming under Article V. Neither alternative can be applied without the missing history." });
      }
      if (mode === "explicit_property") proposed.answerText += " The property is approved.";
      if (mode === "wrong_binding") proposed.supportedPoints.at(-1).sourceIDs = proposed.supportedPoints[0].sourceIDs;
      value = proposed;
    } else {
      assert.equal(phase, "permitext_research_verification"); assert.equal(phases.length, 2);
      assert.match(body.instructions, /Review EVERY listed unit/);
      assert(body.text.format.schema.required.includes("mappedScopeReview"));
      const packet = JSON.parse(input.split("MAPPED SCOPE REVIEW\n")[1].split("\n\nPROPOSED ANSWER JSON")[0]);
      const actual = JSON.parse(input.split("PROPOSED ANSWER JSON\n")[1]);
      assert.equal(actual.answerText, proposed.answerText, "The real narrative remains unchanged.");
      assert(actual.supportedPoints[4].sourceIDs.length > proposed.supportedPoints[4].sourceIDs.length,
        "The missing performance-source binding must be repaired before reviewing scope.");
      assert(packet.units.some((unit) => unit.fields.includes("supportedPoints[6].explanation")),
        "The newly supplied, fuller reconstruction language must also be reviewed.");
      assert(packet.units.some((unit) => unit.fields.includes("evidenceLimitations")));
      const review = { packetHash: packet.packetHash, units: packet.units.map((unit) => ({
        unitID: unit.id, classification: "source_explanation", sourceIDs: unit.sourceIDs,
        reason: "Synthetic accepting scope review for pipeline verification only."
      })) };
      value = { pass: mode !== "semantic_reject", issues: mode === "semantic_reject"
        ? [{ type: "incorrect_citation", detail: "Synthetic unsupported rule despite acceptable source-vs-property scope." }] : [],
        unnecessaryMissingFactIndices: [], mappedScopeReview: review };
      if (mode === "missing_review") delete value.mappedScopeReview;
      if (mode === "missing_unit") review.units.pop();
      if (mode === "stale_review") review.packetHash = "old-answer-hash";
      if (mode === "uncertain") review.units[0].classification = "uncertain";
      if (mode === "property_result") review.units[0].classification = "project_determination";
      if (mode === "unbound_review") review.units[0].sourceIDs = ["unbound-source"];
      lastReview = review;
    }
    return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  } catch (error) { doubleError = error; throw error; }
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  const { zoningSectionSummary } = await import("../zoning-content.mjs");
  const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
  const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === "ZR-06"), { original: true, zoningSummary: zoningSectionSummary });
  server = createServer(handleRequest); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline map scope test" } });
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const seen = new Set();
  const scenarios = ["accept", "semantic_reject", "missing_review", "missing_unit", "stale_review", "uncertain", "property_result", "unbound_review",
    "missing_branches", "explicit_property", "wrong_binding"];
  for (mode of scenarios) {
    phases = []; doubleError = null; lastReview = null;
    const created = await request("/research/conversations/create", { auth, selections: ownerResearchHTTPSelections(input), originSurface: "chat" }, token);
    assert.equal(created.status, 201, JSON.stringify(created.body)); assert.equal(created.body.conversation.primaryProjectID, null);
    const conversationID = created.body.conversation.id;
    const result = await request("/research/conversations/message", { auth, conversationID, question: input.question, requestID: randomUUID() }, token);
    if (doubleError) throw doubleError;
    assert.equal(result.status, mode === "accept" ? 200 : 502, `${mode}: ${JSON.stringify(result.body)}`);
    if (mode === "accept") {
      const answer = result.body.conversation.messages.findLast((message) => message.role === "assistant").answer;
      assert.equal(answer.answerText, proposed.answerText);
      assert.equal(answer.zoningSafety.pass, true);
      assert.equal(answer.zoningSafety.mappedScopeReview.packetHash, lastReview.packetHash);
      assert.deepEqual(answer.zoningSafety.mappedScopeReview.units, lastReview.units);
      assert(answer.zoningSafety.lexicalMapIssues.some((issue) => issue.type === "zoning_missing_mapped_location"));
      assert.equal(answer.verification.pass, true);
    } else {
      const retained = await request("/research/conversations/get", { auth, conversationID }, token);
      assert(retained.body.conversation.messages.every((message) => message.role !== "assistant"), `${mode}: rejected draft was saved`);
    }
    const earlyStop = ["missing_branches", "explicit_property", "wrong_binding"].includes(mode);
    assert.deepEqual(phases, earlyStop ? ["permitext_code_interpretation"] : ["permitext_code_interpretation", "permitext_research_verification"], mode);
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    const operations = telemetry.body.researchSpend.operationMetrics.filter((operation) => !seen.has(operation.id));
    assert.equal(operations.length, 1); const operation = operations[0]; seen.add(operation.id);
    assert.equal(operation.charged, mode === "accept"); assert.equal(operation.providerRequestCount, phases.length);
    assert.equal(operation.pendingProviderRequestCount, 0);
  }
  console.log(`Mapped-scope HTTP contract passed: ${scenarios.length} unassigned Research flows; retained prose plus explicit handwritten completeness contrast; exact semantic scope review required, failed/malformed reviews unsaved and uncharged, maximum two intercepted calls, zero paid calls.`);
} finally {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await rm(scratch, { recursive: true, force: true });
}
