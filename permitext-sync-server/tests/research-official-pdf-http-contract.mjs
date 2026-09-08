import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PDFDocument from "pdfkit";

const replayPath = process.argv[2];
const scratch = await mkdtemp(join(tmpdir(), "permitext-official-pdf-http-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1",
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
const sourceURL = "https://www.nyc.gov/assets/buildings/pdf/bpp_build-sn.pdf";
const releaseURL = "https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf";
const releaseDocument = new PDFDocument();
const releaseChunks = [];
const releaseComplete = new Promise((resolve) => { releaseDocument.on("data", (chunk) => releaseChunks.push(chunk)); releaseDocument.on("end", () => resolve(Buffer.concat(releaseChunks))); });
releaseDocument.text("Synthetic regression source: August 2026 Wetlands documents. An initial NB-GC filing flagged as wetlands requires a DEC Jurisdictional Determination.");
releaseDocument.addPage().text("Wetlands documents continued. If the determination requires a DEC Permit, submit it before approval. Otherwise submit a waiver request for the DEC Permit document.");
releaseDocument.addPage().text("Unrelated required documents for NB-GC filing applications flagged in the DOB NOW Property Profile as Mandatory Inclusionary Housing. August 2026 workflow documents and conditional responses.");
releaseDocument.end();
const releaseBytes = await releaseComplete;
let question = `According to the official service notice at ${sourceURL}, which review type applies to the new application?`;
let payload;
let bytes;
if (replayPath) {
  const pilot = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-pilot-2026-09-07.json", import.meta.url)));
  const call = pilot.providerCalls.find((call) => call.caseID === "PDF-BPP");
  payload = { model: call.model, status: "completed", usage: call.usage, output: call.output };
  question = pilot.cases.find((item) => item.id === "PDF-BPP").question;
  bytes = await readFile(replayPath);
} else {
  const document = new PDFDocument();
  const chunks = [];
  const complete = new Promise((resolve) => { document.on("data", (chunk) => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks))); });
  document.text("Synthetic regression source. Builders Pavement Plan filings require Standard Plan Review. This is a filing step, not automatic permit approval.");
  document.end();
  bytes = await complete;
  const text = "Builders Pavement Plan filings require Standard Plan Review according to the official service notice.";
  payload = { model: "gpt-5.6-luna", status: "completed", usage: { input_tokens: 100, output_tokens: 50 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", start_index: 0, end_index: text.length, url: sourceURL, title: "Service notice" }] }] }] };
}
const nativeFetch = globalThis.fetch;
let providerDoubles = 0;
let documentDoubles = 0;
let corruptDocument = false;
let rejectSummary = false;
let summaryDoubles = 0;
let verificationDoubles = 0;
globalThis.fetch = async (url, options) => {
  if (String(url) === "https://api.openai.com/v1/responses") {
    providerDoubles += 1;
    const body = JSON.parse(options.body);
    if (body.tools?.some((tool) => tool.type === "web_search")) return Response.json(payload);
    const input = JSON.parse(body.input);
    let value;
    if (body.text.format.name === "permitext_official_guidance_summary") {
      summaryDoubles += 1;
      const wetlands = /wetlands/i.test(input.question);
      const passages = wetlands ? input.passages : input.passages.slice(0, 1);
      value = {
        paragraphs: [{
          text: rejectSummary ? "The filing automatically grants the construction permit."
            : wetlands
              ? "Submit the DEC Jurisdictional Determination. If it requires a DEC Permit, submit that permit before approval; otherwise request a waiver for the permit document."
              : replayPath
                ? "For new BPP applications beginning August 17, 2026, file in DOB NOW: Build using Standard Plan Review and complete the BPP5 Authorization to DOT."
                : "Use Standard Plan Review for the new BPP filing. This filing step does not automatically approve the permit.",
          sourceUses: passages.map((passage) => ({ sourceID: passage.sourceID, claimID: passage.claimID }))
        }], missingFacts: [], evidenceLimitations: []
      };
    } else {
      assert.equal(body.text.format.name, "permitext_official_guidance_verification");
      verificationDoubles += 1;
      assert(input.passages.every((passage) => passage.contentHash?.length === 64));
      if (rejectSummary) {
        assert.match(input.proposedAnswer.answerText, /automatically grants/);
        assert(input.passages.some((passage) => /not automatic permit approval|Once the BPP filing is approved/.test(passage.text)));
      }
      value = rejectSummary
        ? { pass: false, issues: [{ type: "overstated_compliance", detail: "The document does not say filing automatically grants a construction permit." }] }
        : { pass: true, issues: [] };
    }
    return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  }
  if (String(url) === sourceURL) {
    documentDoubles += 1;
    return new Response(corruptDocument ? Buffer.from("invalid pdf") : bytes, { headers: { "content-type": "application/pdf" } });
  }
  if (String(url) === releaseURL) return new Response(releaseBytes, { headers: { "content-type": "application/pdf" } });
  throw new Error(`Unexpected external request in offline contract: ${String(url)}`);
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const { body: { account } } = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline PDF Contract" } });
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  const ask = async () => {
    const created = await request("/research/conversations/create", { auth }, account.backendSessionToken);
    return request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question, requestID: randomUUID() }, account.backendSessionToken);
  };
  const response = await ask();
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const answer = [...response.body.conversation.messages].reverse().find((message) => message.role === "assistant").answer;
  assert.match(answer.answerText, /Standard Plan Review/);
  assert.match(answer.answerText, /#page=1/);
  assert.equal(answer.verification.pass, true);
  assert.equal(answer.citations.length, 0, "Official guidance must not become enacted-code citations.");
  assert.equal(answer.supportingSources[0].sourceValidation, "official_pdf");
  assert.equal(answer.supportingSources[0].controlling, false);
  assert.equal(answer.supportingSources[0].attributedClaims[0].pageNumber, 1);
  assert.equal(answer.supportingSources[0].sourceContentHash.length, 64);
  const saved = await request("/research/answers/get", {
    auth, answerID: response.body.conversation.messages.at(-1).id
  }, account.backendSessionToken);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.answer.immutable, true);
  assert.equal(saved.body.answer.answer.answerText, answer.answerText);
  assert.deepEqual(saved.body.answer.answer.officialGuidanceSummary, answer.officialGuidanceSummary);
  assert.deepEqual(saved.body.answer.answer.supportingSources, answer.supportingSources);
  assert.equal(providerDoubles, replayPath ? 2 : 3, "Known workflows bypass search; a summary and independent verification are both required.");
  if (replayPath) {
    assert.match(answer.answerText, /BPP5/);
    assert.match(answer.answerText, /August 17, 2026/);
    assert(answer.answerText.split(/\s+/).length < 120);
    console.log(`Saved official document summary replay passed: ${answer.answerText.split(/\s+/).length} words; complete source page retained behind the summary.`);
  }
  const beforeWorkflow = providerDoubles;
  question = "A new Builders Pavement Plan application is initiated after August 17, 2026. Where must it be filed, which review type applies, and what authorization step appears?";
  const workflowResponse = await ask();
  assert.equal(workflowResponse.status, 200, JSON.stringify(workflowResponse.body));
  const workflowAnswer = workflowResponse.body.conversation.messages.at(-1).answer;
  assert.match(workflowAnswer.answerText, /Standard Plan Review/);
  assert.equal(workflowAnswer.retrieval.officialWorkflow.retrievalMethod, "official_workflow_catalog");
  assert.equal(providerDoubles, beforeWorkflow + 2, "The BPP workflow bypasses search but verifies its summary.");
  question = "An initial NB-GC filing is on a property flagged in DOB NOW as potentially affected by Tidal Wetlands, Freshwater Wetlands, or a Coastal Erosion Hazard Area. What documents and conditional responses are required under the August 2026 workflow?";
  const wetlandResponse = await ask();
  assert.equal(wetlandResponse.status, 200, JSON.stringify(wetlandResponse.body));
  const wetlandAnswer = wetlandResponse.body.conversation.messages.at(-1).answer;
  assert.match(wetlandAnswer.answerText, /DEC Jurisdictional Determination/);
  assert.match(wetlandAnswer.answerText, /waiver request|request a waiver/);
  assert.doesNotMatch(wetlandAnswer.answerText, /Mandatory Inclusionary Housing/);
  assert.deepEqual(wetlandAnswer.supportingSources.flatMap((source) => source.attributedClaims.map((claim) => claim.pageNumber)), [1, 2]);
  assert.equal(providerDoubles, beforeWorkflow + 4, "The wetlands workflow bypasses search but verifies its summary.");
  assert.equal(summaryDoubles, 3);
  assert.equal(verificationDoubles, 3);
  rejectSummary = true;
  question = "A new Builders Pavement Plan application is initiated after August 17, 2026. Where must it be filed, which review type applies, and what authorization step appears?";
  const unsupported = await ask();
  assert(unsupported.status >= 400);
  assert.equal(unsupported.body.code, "RESEARCH_VERIFICATION_FAILED");
  const telemetry = await request("/internal/evaluations/data", { auth }, account.backendSessionToken);
  const failed = telemetry.body.researchSpend.operationMetrics.find((operation) => operation.failureCode === "RESEARCH_VERIFICATION_FAILED");
  assert(failed && failed.charged === false && failed.pendingProviderRequestCount === 0,
    "A rejected summary must not consume the user's turn; dispatched provider usage still settles.");
  rejectSummary = false;
  const beforeCorruptDocument = documentDoubles;
  // Keep the generic PDF failure check independent of catalog fallback.
  question = `According to the official service notice at ${sourceURL}, which review type applies to the new application?`;
  corruptDocument = true;
  const rejected = await ask();
  assert.equal(rejected.status, 502);
  assert.equal(rejected.body.code, "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE");
  assert.equal(documentDoubles, beforeCorruptDocument + 1);
  console.log("Official PDF summary HTTP completion, semantic rejection and invalid-document rejection passed; zero external calls, provider responses mocked.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
