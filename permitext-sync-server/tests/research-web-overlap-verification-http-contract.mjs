import { withSyntheticMaterialScopeProviderResponse } from "./research-applicability-response-double.mjs";
// Adapt the recorded GAP-04 drafts to this request's selected passages. The
// web output is unchanged and verifier responses are explicit doubles: this
// proves the delivery gate, not a new live correctness result.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-technical-expansion-2026-09-08.json", import.meta.url)));
const records = run.providerCalls.filter((call) => call.caseID === "GAP-04");
assert.equal(records.length, 3);
const originalRecords = JSON.stringify(records);
const question = run.cases.find((item) => item.id === "GAP-04").question;
const cityAgencyClause = "Such exemptions shall not relieve any owner of the obligation to comply with the requirements of or file with other city agencies.";
function currentRecordedDraft(output, input) {
  const matches = [...String(input).matchAll(/^PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)/gm)];
  const sources = matches.map((match, index) => ({
    id: match[1], sectionID: match[2],
    text: String(input).slice(match.index, matches[index + 1]?.index)
  }));
  const sourceFor = (sectionID) => {
    const selected = sources.filter(source => source.sectionID === sectionID);
    assert.equal(selected.length, 1, `Replay requires one current passage for section ${sectionID}`);
    return selected[0];
  };
  assert(sourceFor("8991").text.split("\nENACTED_TEXT: ")[1]?.split("\n")[0].includes(cityAgencyClause),
    "The overlap clause must occur in the selected enacted AC 28-105.4 passage itself.");
  const replay = structuredClone(output);
  for (const item of replay) for (const content of item.content || []) {
    if (content.type !== "output_text") continue;
    const value = JSON.parse(content.text);
    if (!sources.some(source => source.sectionID === "6062")) {
      // Current retrieval does not supply the recorded, ancillary BC 3304.3.4
      // DEC example. Remove that entire example, including prose, rather than
      // binding its claim to a different section or forcing extra retrieval.
      assert.deepEqual(value.supportedPoints.map(point => point.sectionID), ["8991", "6062"]);
      assert.deepEqual(value.citations.map(citation => citation.sectionID), ["8991", "6062"]);
      const exampleStart = value.answerText.includes(" As an example of the Code’s separate-agency approach,")
        ? " As an example of the Code’s separate-agency approach," : " The supplied enacted evidence gives a state-agency example:";
      assert(value.answerText.includes(exampleStart), "The recorded DEC example must be explicitly removable.");
      value.answerText = value.answerText.slice(0, value.answerText.indexOf(exampleStart));
      assert(value.answerText.includes("required by another agency."));
      value.answerText = value.answerText.replace("required by another agency.", "required by other city agencies.");
      assert.equal(value.evidenceLimitations.length, 1);
      assert.match(value.evidenceLimitations[0], / and (?:gives a specific DEC example|provides specified DEC examples)\./);
      value.evidenceLimitations[0] = value.evidenceLimitations[0].replace(/ and (?:gives a specific DEC example|provides specified DEC examples)\./, ".");
      value.supportedPoints = value.supportedPoints.filter(point => point.sectionID !== "6062");
      value.citations = value.citations.filter(citation => citation.sectionID !== "6062");
      assert.doesNotMatch(JSON.stringify(value), /6062|3304\.3\.4|\bDEC\b|Department of Environmental Conservation|500 feet|borings|geothermal/i);
      assert.match(value.answerText, /state or federal/);
      assert.match(value.additionalEvidenceNeeded.join(" "), /applicable.*(?:statute|regulation)/);
    }
    // Rank suffixes are request-local. Rebind only to a unique current passage
    // of exactly the recorded section, never to a merely similar passage.
    for (const row of [...value.supportedPoints, ...value.citations]) {
      row.sourceIDs = row.sourceIDs.map(id => {
        const recordedSection = /^research-permitext_(?:discovered|cross_reference)-id:(\d+)-\d+$/.exec(id)?.[1];
        assert.equal(recordedSection, row.sectionID);
        return sourceFor(row.sectionID).id;
      });
    }
    content.text = JSON.stringify(value);
  }
  return replay;
}
const selectedCityPassage = `PASSAGE_ID: research-permitext_discovered-id:8991-77\nSECTION_ID: 8991\nENACTED_TEXT: ${cityAgencyClause}\n`;
for (const recorded of records.slice(1)) {
  const adapted = currentRecordedDraft(recorded.output, selectedCityPassage);
  assert.match(JSON.stringify(adapted), /research-permitext_discovered-id:8991-77/);
  assert.throws(() => currentRecordedDraft(recorded.output, ""), /one current passage for section 8991/);
  assert.throws(() => currentRecordedDraft(recorded.output, selectedCityPassage.repeat(2)), /one current passage for section 8991/);
  assert.throws(() => currentRecordedDraft(recorded.output, selectedCityPassage.replace(cityAgencyClause, "Unrelated text.")), /selected enacted/);
}
assert.equal(JSON.stringify(records), originalRecords, "Adapting a replay must not alter the historical records.");
const scratch = await mkdtemp(join(tmpdir(), "permitext-web-overlap-"));
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
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_OFFICIAL_DOMAINS: "nyc.gov,ny.gov,rules.cityofnewyork.us,ada.gov",
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
let accept = false;
let invalidCitation = false;
let draftIndex = 0;
let calls = [];
let providerDoubleError;
globalThis.fetch = async (url, options) => {
 try {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "Unexpected external request.");
  const body = JSON.parse(options.body);
  const phase = body.text?.format?.name || "web_support";
  calls.push(phase);
  let output;
  if (phase === "permitext_research_verification") {
    assert.match(body.input, /LEXICAL WEB OVERLAPS FOR SOURCE COMPARISON/);
    assert.match(body.input, /web_claim_overlap/);
    assert.match(body.input, /web-claim-ad031ccb79120118c8125466/);
    assert.match(body.input, /requirements of or file with other city agencies/);
    assert.match(body.instructions, /Shared wording alone does not make a claim web-derived/);
    const value = accept ? { pass: true, issues: [] } : {
      pass: false, issues: [{ type: "wrong_attribution", detail: "Synthetic verifier rejection: a clause is not independently established by its enacted citation." }]
    };
    output = [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }];
  } else {
    const recorded = phase === "web_support" ? records[0] : records[++draftIndex];
    assert(recorded, "At most one bounded revision is permitted.");
    assert.equal(phase, recorded.phase);
    output = phase === "web_support" ? recorded.output : currentRecordedDraft(recorded.output, body.input);
    if (phase !== "web_support" && invalidCitation) {
      assert.doesNotMatch(body.input, /^PASSAGE_ID: research-permitext_discovered-id:0-0$/m);
      // Negative control: a source absent from selected evidence must still
      // fail citation validation before any semantic verifier can accept it.
      for (const item of output) for (const content of item.content || []) {
        if (content.type !== "output_text") continue;
        const value = JSON.parse(content.text);
        value.supportedPoints[0].sourceIDs = ["research-permitext_discovered-id:0-0"];
        value.citations[0].sourceIDs = ["research-permitext_discovered-id:0-0"];
        content.text = JSON.stringify(value);
      }
    }
  }
  return Response.json(withSyntheticMaterialScopeProviderResponse(body, { model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output }));
 } catch (error) { providerDoubleError = error; throw error; }
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
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline overlap contract" } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  for (const [accepted, invalid] of [[true, true], [false, false], [true, false]]) {
    accept = accepted; invalidCitation = invalid; draftIndex = 0; calls = []; providerDoubleError = undefined;
    const created = await request("/research/conversations/create", { auth }, token);
    const conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, question, requestID: randomUUID() }, token);
    if (providerDoubleError) throw providerDoubleError;
    assert.deepEqual(calls, invalid
      ? ["web_support", "permitext_code_interpretation", "permitext_code_interpretation"] : accepted
      ? ["web_support", "permitext_code_interpretation", "permitext_research_verification"]
      : ["web_support", "permitext_code_interpretation", "permitext_research_verification", "permitext_code_interpretation", "permitext_research_verification"]);
    if (invalid || !accepted) {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.conversation.messages.at(-1).answer.mode, "clarification");
      assert.equal(response.body.conversation.messages.at(-1).answer.charged, false);
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.body.conversation.messages.filter((message) => message.role === "assistant").length, 1);
      const telemetry = await request("/internal/evaluations/data", { auth }, token);
      const failureCode = invalid ? "INVALID_RESEARCH_CITATION" : "RESEARCH_VERIFICATION_FAILED";
      const failed = telemetry.body.researchSpend.operationMetrics.find((operation) => operation.failureCode === failureCode);
      assert(failed && !failed.charged && failed.providerRequestCount === (invalid ? 3 : 5) && failed.pendingProviderRequestCount === 0);
    } else {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const message = response.body.conversation.messages.at(-1);
      assert.equal(message.answer.verification.history.at(-1).model, "gpt-5.6-luna");
      assert.equal(message.answer.verification.history.at(-1).pass, true);
      const saved = await request("/research/answers/get", { auth, answerID: message.id }, token);
      assert.equal(saved.body.answer.answer.answerText, message.answer.answerText);
    }
  }
  assert.equal(JSON.stringify(records), originalRecords);
  console.log("Adapted recorded web-overlap HTTP replay passed: invalid citations fail before semantic review, source comparison required, rejected drafts remain unsaved and uncharged, accepted draft persists; all provider responses mocked.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
