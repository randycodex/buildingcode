// Replay actual plumbing omissions and an uncited narrative rule with explicit verifier doubles.
// This verifies the delivery gate, not the legal correctness of the recorded answer.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-fountain-expansion-2026-09-08.json", import.meta.url)));
assert.equal(run.providerCalls.length, 15);
const recent = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-plumbing-repair-confirmation-2026-09-08.json", import.meta.url)));
assert.equal(recent.providerCalls.length, 2);
const cafeRun = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-routing-confirmation-v2-2026-09-08.json", import.meta.url)));
const cafeDraft = JSON.parse(cafeRun.providerCalls.find((call) => call.caseID === "PC-01" && call.phase === "permitext_code_interpretation")
  .output.flatMap((message) => message.content || []).find((content) => content.type === "output_text").text);
const fanRun = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-attribution-confirmation-2026-09-08.json", import.meta.url)));
const fanDraft = JSON.parse(fanRun.providerCalls.find(call => call.caseID === "MC-05" && call.phase === "permitext_code_interpretation")
  .output.flatMap(message => message.content || []).find(content => content.type === "output_text").text);
const occupancyRun = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json", import.meta.url)));
const occupancyDraft = JSON.parse(occupancyRun.providerCalls.find(call => call.caseID === "GAP-14" && call.phase === "permitext_code_interpretation")
  .output.flatMap(message => message.content || []).find(content => content.type === "output_text").text);
const scratch = await mkdtemp(join(tmpdir(), "permitext-plumbing-repairs-"));
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

const nativeFetch = globalThis.fetch;
let activeID;
let activeRun;
let accept;
let phases = [];
let reviewed;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request.");
  const body = JSON.parse(options.body);
  const phase = body.text?.format?.name;
  phases.push(phase);
  assert(phases.length <= 4, "Only one bounded revision is permitted.");
  if (activeID === "GAP-14") {
    assert.match(body.input, /commissioner shall set a time period/);
    assert.match(body.input, /Residential buildings with fewer than eight stories or fewer than four dwelling units/);
    assert.match(body.input, /Parking structures/);
    assert.match(body.input, /interim certificate of occupancy shall remain in effect until/);
    assert.match(body.input, /may revoke or suspend a temporary certificate/);
    assert.match(body.input, /not otherwise required to have a certificate of occupancy/);
  }
  let output;
  if (phase === "permitext_research_verification") {
    reviewed = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
    if (activeID === "GAP-14") {
      assert.equal(reviewed.answerText, occupancyDraft.answerText);
      assert.equal(reviewed.citations.length, occupancyDraft.citations.length,
        "Fetching complete alternatives does not guess citations for unnamed exception claims.");
      assert.equal(accept, false, "This historical draft still lacks its exception bindings.");
    } else if (activeID === "MC-05") {
      assert.equal(reviewed.answerText, fanDraft.answerText);
      assert.deepEqual(reviewed.supportedPoints.map(({ heading, explanation, sectionID, sourceIDs }) => ({ heading, explanation, sectionID, sourceIDs })), fanDraft.supportedPoints);
      assert.equal(reviewed.citations.length, fanDraft.citations.length + 1);
      const citation = reviewed.citations.at(-1);
      assert.equal(citation.codePrefix, "MC");
      assert.equal(citation.sectionNumber, "606.4.2");
      assert.equal(citation.supportingPassages.length, 1);
      assert.match(citation.supportingPassages[0].selectedText, /100 percent outdoor air systems/);
      assert.match(citation.supportingPassages[0].selectedText, /Exceptions:/);
      assert.match(citation.supportingPassages[0].selectedText, /serving not more than one floor/);
      assert(citation.codeEdition && citation.codeVersion && citation.corpusID);
    } else if (activeID === "PC-01") {
      assert.deepEqual(reviewed.supportedPoints[2].sourceIDs, [
        ...cafeDraft.supportedPoints[2].sourceIDs, "research-permitext_cross_reference-id:11923-4"
      ]);
      assert.equal(reviewed.supportedPoints[2].explanation, cafeDraft.supportedPoints[2].explanation);
      assert.equal(reviewed.answerText, cafeDraft.answerText);
      assert.deepEqual(reviewed.citations.map(({ sectionID, sourceIDs }) => ({ sectionID, sourceIDs })),
        cafeDraft.citations.map(({ sectionID, sourceIDs }) => ({ sectionID, sourceIDs })));
      assert.match(body.input, /Required public facilities shall be designated by a legible sign/);
      assert.match(body.instructions, /Fail with incorrect_citation if a claim lacks support in that point's bound passages/);
    } else if (activeID === "PC-03" && activeRun === recent) {
      assert.match(reviewed.answerText, /Each substituted fixture.*at least 10 inches high and be adjacent/);
      assert(!reviewed.answerText.includes("Each replacement bottle-filling fixture"), "A correct condition followed by adjacency must not acquire a duplicate.");
    } else if (activeID === "PC-03") {
      assert.match(reviewed.answerText, /Each replacement bottle-filling fixture.*at least 10 inches \(254 mm\) high/);
    } else {
      const point = reviewed.supportedPoints.find((point) => /lint strainers/i.test(point.explanation));
      assert.deepEqual(point.sourceIDs, ["research-permitext_discovered-id:11967-2", "research-permitext_discovered-id:11968-1"]);
    }
    const value = accept ? { pass: true, issues: [] } : {
      pass: false, issues: [{ type: activeID === "GAP-14" ? "incorrect_citation" : "unsupported_requirement",
        detail: activeID === "GAP-14" ? "Synthetic rejection retaining the historical finding: the temporary, interim and partial certificate claims have no supporting citation. Complete retrieval does not bind those claims." : "Synthetic final-verifier rejection: repairing a condition or source binding does not approve the answer." }]
    };
    output = [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }];
  } else {
    assert.equal(phase, "permitext_code_interpretation");
    output = activeRun.providerCalls.find((call) => call.caseID === activeID && call.phase === phase).output;
  }
  return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output });
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline plumbing repair contract" } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  for (const [id, recordedRun] of [["PC-03", run], ["PC-04", run], ["PC-03", recent], ["PC-01", cafeRun], ["MC-05", fanRun], ["GAP-14", occupancyRun]]) for (const accepted of (id === "GAP-14" ? [false] : [false, true])) {
    activeRun = recordedRun; activeID = id; accept = accepted; phases = []; reviewed = null;
    const created = await request("/research/conversations/create", { auth }, token);
    const conversationID = created.body.conversation.id;
    const authoredCase = activeRun.cases.find((item) => item.id === id) || activeRun.results.find(item => item.id === id);
    const response = await request("/research/conversations/message", { auth, conversationID, question: authoredCase.question, requestID: randomUUID() }, token);
    assert.deepEqual(phases, accepted
      ? ["permitext_code_interpretation", "permitext_research_verification"]
      : ["permitext_code_interpretation", "permitext_research_verification", "permitext_code_interpretation", "permitext_research_verification"]);
    if (!accepted) {
      assert.equal(response.status, 502, JSON.stringify(response.body));
      assert.equal(response.body.code, "RESEARCH_VERIFICATION_FAILED");
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.body.conversation.messages.filter((message) => message.role === "assistant").length, 0);
      const telemetry = await request("/internal/evaluations/data", { auth }, token);
      const failed = telemetry.body.researchSpend.operationMetrics.find((operation) => operation.failureCode === "RESEARCH_VERIFICATION_FAILED");
      assert(failed && !failed.charged && failed.providerRequestCount === 4 && failed.pendingProviderRequestCount === 0);
    } else {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const message = response.body.conversation.messages.at(-1);
      assert.equal(message.answer.verification.history.at(-1).pass, true);
      assert.equal(message.answer.answerText, reviewed.answerText);
      assert.deepEqual(message.answer.supportedPoints.map((point) => point.sourceIDs), reviewed.supportedPoints.map((point) => point.sourceIDs));
      const saved = await request("/research/answers/get", { auth, answerID: message.id }, token);
      assert.equal(saved.body.answer.answer.answerText, reviewed.answerText);
      assert.deepEqual(saved.body.answer.answer.supportedPoints.map((point) => point.sourceIDs), reviewed.supportedPoints.map((point) => point.sourceIDs));
      if (id === "MC-05") {
        assert.deepEqual(message.answer.citations, reviewed.citations);
        assert.deepEqual(saved.body.answer.answer.citations, reviewed.citations);
      }
    }
  }
  console.log("Plumbing HTTP replay passed: final verifier sees repairs on initial/revised answers; rejection blocks save/charge; accepted reviewed content persists with no extra provider call. All provider responses mocked.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
