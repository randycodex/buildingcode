// Fictional user-supplied clause, never a code fixture or frozen acceptance
// case. Intercepted ordinary scope verdicts exercise writer -> one bounded
// revision -> full ordinary re-review -> persistence. No semantic proof claim.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applicabilityPacketFromRequest } from "./research-applicability-response-double.mjs";
const scratch = await mkdtemp(join(tmpdir(), "permitext-claim-applicability-"));
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1.50", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "4",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "4", PERMITEXT_RESEARCH_DAILY_CAP_USD: "4", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "4",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const question = 'Here is a fictional clause: “A red cabinet needs a latch.” What does this mean?';
const draft = { answerText: "Your project is compliant. The supplied fictional clause alone cannot establish real compliance.",
  supportedPoints: [], citations: [], supportingSourceUses: [], assumptions: [], missingFacts: [], followUpQuestions: [],
  evidenceLimitations: ["Only unverified supplied text is interpreted."], additionalEvidenceNeeded: [] };
const revised = { ...draft, answerText: "The fictional clause requires a latch on a red cabinet. This reading does not establish project compliance." };
const nativeFetch = globalThis.fetch;
let mode, phases, packets, providerError, writerCount;
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses", "Every external request must be intercepted.");
    const body = JSON.parse(options.body), phase = body.text.format.name;
    phases.push(phase); assert(phases.length <= 4, "Existing one-revision/four-call limit.");
    let value;
    if (phase === "permitext_code_interpretation") {
      writerCount++;
      if (writerCount === 2) assert.match(body.input, /Unsupported actual project determination/);
      value = writerCount === 1 ? draft : revised;
    } else {
      assert.equal(phase, "permitext_research_verification");
      assert.match(body.instructions, /SOURCE SCOPE AND HUMAN CONTEXT REVIEW is mandatory/);
      assert(!body.text.format.schema.required.includes("claimApplicabilityReview"));
      assert.equal(body.max_output_tokens, 8000);
      assert.equal(body.reasoning.effort, "medium");
      const packet = applicabilityPacketFromRequest(body); packets.push(packet);
      assert.equal(packet.units, undefined); assert.equal(packet.facts.currentHumanQuestion.statement, question);
      const actual = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
      assert.equal(actual.answerText, writerCount === 1 ? draft.answerText : revised.answerText);
      const pass = writerCount === 2 && mode === "fresh";
      value = { pass, issues: pass ? [] : [{ type: writerCount === 1 ? "overstated_compliance" : mode === "unsupported" ? "unsupported_requirement" : "incorrect_citation",
        detail: writerCount === 1 ? "Unsupported actual project determination: the fictional supplied clause does not establish project compliance." : "The ordinary verifier still found an unsupported claim or source binding." }],
        projectFactQuestions: [], missingFactsOnly: false, unnecessaryMissingFactIndices: [], priorReviewCorrection: "" };
    }
    return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 },
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  } catch (error) { providerError = error; throw error; }
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
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline applicability contract" } });
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const seenOperations = new Set();
  for (mode of ["fresh", "unsupported", "source"]) {
    phases = []; packets = []; writerCount = 0; providerError = null;
    const created = await request("/research/conversations/create", { auth }, token), conversationID = created.body.conversation.id;
    const result = await request("/research/conversations/message", { auth, conversationID, question, requestID: randomUUID() }, token);
    if (providerError) throw providerError;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(phases, ["permitext_code_interpretation", "permitext_research_verification", "permitext_code_interpretation", "permitext_research_verification"]);
    assert.equal(packets.length, 2); assert.notEqual(packets[0].answerHash, packets[1].answerHash);
    assert.notEqual(packets[0].contextHash, packets[1].contextHash, "Changed prose rebuilds immutable scope/human context.");
    assert.equal(packets[0].factsHash, packets[1].factsHash); assert.equal(packets[0].evidenceHash, packets[1].evidenceHash);
    const reopened = await request("/research/conversations/get", { auth, conversationID }, token), answer = reopened.body.conversation.messages.at(-1).answer;
    if (mode === "fresh") {
      assert.equal(answer.answerText, revised.answerText);
      assert.equal(answer.verification.history.at(-1).pass, true);
      assert.equal(answer.verification.history.at(-1).claimApplicabilityReview, undefined);
      const saved = await request("/research/answers/get", { auth, answerID: reopened.body.conversation.messages.at(-1).id }, token);
      assert.equal(saved.status, 200); assert.equal(saved.body.answer.answer.answerText, revised.answerText);
      assert(!JSON.stringify(answer.verification).includes('"statement"'), "Private ledger is not persisted in review diagnostics.");
    } else { assert.equal(answer.mode, "clarification"); assert.equal(answer.charged, false); }
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    const operation = telemetry.body.researchSpend.operationMetrics.find((operation) => operation.providerRequestCount === 4 && !seenOperations.has(operation.id));
    seenOperations.add(operation?.id);
    assert(operation); assert.equal(operation.pendingProviderRequestCount, 0);
    assert.equal(operation.verificationAttemptDiagnostics.length, 0, "Ordinary reviews persist verdict history without auxiliary proof diagnostics.");
    assert(!JSON.stringify(operation.verificationAttemptDiagnostics).includes("fictional clause"));
  }
  console.log("Ordinary scope HTTP mechanics passed: genuine unsupported-scope verdict triggers one bounded revision, changed immutable context re-reviewed, failed final verdict unsaved/uncharged, valid ordinary final verdict persisted without proof output; intercepted calls only, no semantic acceptance claim.");
} finally {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await rm(scratch, { recursive: true, force: true });
}
