import { withSyntheticMaterialScopeProviderResponse } from "./research-applicability-response-double.mjs";
// Recorded initial drafts/verdicts and usage with a certified field-only candidate.
// Final-rejection controls prove that a revision cannot approve itself. No paid calls.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const recorded = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-compact-confirmation-2026-09-08.json", import.meta.url)));
const originalRecorded = JSON.stringify(recorded);
const laundryVerification = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-decision-fact-verifier-v3-2026-09-08.json", import.meta.url)));
const panVerification = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-decision-fact-verifier-2026-09-08.json", import.meta.url)));
const scratch = await mkdtemp(join(tmpdir(), "permitext-decision-fact-http-"));
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1.50", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2", PERMITEXT_RESEARCH_DAILY_CAP_USD: "2", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const nativeFetch = globalThis.fetch;
let active;
let accept;
let phases;
let firstProposed;
let secondProposed;
let providerDoubleError;
let reboundHistoricalAnswer;
// This recorded citation predates the source-boundary correction: its saved
// supporting passage included the next section's banner. Normalize only that
// known historical expectation; the answer, claims and citation metadata stay
// unchanged, and today's complete selected provision must still match exactly.
function currentRecordedPassageText(citation, selectedText) {
  if (citation.sectionID !== "11968" || citation.codePrefix !== "PC" || citation.sectionNumber !== "412.4") return selectedText;
  const nextSectionBanner = " Section PC 413: Food Waste Disposer Units";
  assert(selectedText.endsWith(nextSectionBanner), "The historical PC 412.4 fixture must contain exactly its known next-section suffix.");
  return selectedText.slice(0, -nextSectionBanner.length);
}
// Current retrieval may assign new passage IDs. Rebind this provider double
// only when the supplied section, code, edition, version and full provision text
// all match. This is fixture compatibility, never a production binding bypass.
function rebindRecordedDraft(body, draft) {
  const passages = body.input.split("\n\n---\n\n").map(block => {
    const sourceID = block.match(/PASSAGE_ID: ([^\n]+)/)?.[1];
    return { sourceID, block };
  }).filter(passage => passage.sourceID);
  const bindings = new Map();
  for (const citation of active.answer.citations) for (const passage of citation.supportingPassages) {
    const selectedText = currentRecordedPassageText(citation, passage.selectedText);
    const matches = passages.filter(({ block }) =>
      block.includes(`SECTION_ID: ${citation.sectionID}\nCODE: ${citation.codePrefix}\nSECTION: ${citation.sectionNumber}\n`) &&
      block.includes(`CODE_EDITION: ${citation.codeEdition}\nCODE_VERSION: ${citation.codeVersion}\n`) &&
      block.match(/(?:^|\n)ENACTED_TEXT: ([^\n]+)/)?.[1] === selectedText);
    assert.equal(matches.length, 1, `Rebinding ${active.id}/${citation.sectionID} requires one exact enacted passage in the current request.`);
    bindings.set(passage.sourceID, {sourceID: matches[0].sourceID, selectedText});
  }
  const rebind = answer => {
    const copy = structuredClone(answer);
    for (const item of [...copy.supportedPoints, ...copy.citations]) {
      item.sourceIDs = item.sourceIDs.map(id => { assert(bindings.has(id)); return bindings.get(id).sourceID; });
      for (const passage of item.supportingPassages || []) {
        const binding = bindings.get(passage.sourceID);
        assert(binding, "Every historical supporting passage must have an exact current binding.");
        passage.sourceID = binding.sourceID;
        passage.selectedText = binding.selectedText;
      }
    }
    return copy;
  };
  reboundHistoricalAnswer = rebind(active.answer);
  return rebind(draft);
}
// Fixture-only controls: accepting an old source ID never licenses changed
// enacted text, a different identity/edition, duplicate matches or extra text.
for (const record of recorded.results) {
  active = record;
  const blocks = record.answer.citations.flatMap(citation => citation.supportingPassages.map((passage, index) =>
    `PASSAGE_ID: current-${citation.sectionID}-${index}\nSECTION_ID: ${citation.sectionID}\nCODE: ${citation.codePrefix}\nSECTION: ${citation.sectionNumber}\nCODE_EDITION: ${citation.codeEdition}\nCODE_VERSION: ${citation.codeVersion}\nENACTED_TEXT: ${currentRecordedPassageText(citation, passage.selectedText)}\n`
  ));
  const input = blocks.join("\n\n---\n\n");
  const rebound = rebindRecordedDraft({input}, record.answer);
  assert.equal(rebound.answerText, record.answer.answerText);
  for (let index = 0; index < rebound.citations.length; index += 1) {
    const {sourceIDs, supportingPassages, ...metadata} = rebound.citations[index];
    const {sourceIDs: oldIDs, supportingPassages: oldPassages, ...oldMetadata} = record.answer.citations[index];
    assert.deepEqual(metadata, oldMetadata, "All historical citation metadata must remain unchanged.");
    assert.deepEqual(supportingPassages.map(({sourceID, selectedText, ...fields}) => fields),
      oldPassages.map(({sourceID, selectedText, ...fields}) => fields));
  }
  for (const invalidInput of ["", `${input}\n\n---\n\n${blocks[0]}`,
    input.replace("SECTION_ID: ", "SECTION_ID: wrong-"), input.replace("CODE: PC", "CODE: MC"),
    input.replace("SECTION: ", "SECTION: wrong-"), input.replace("CODE_EDITION: ", "CODE_EDITION: wrong-"),
    input.replace("CODE_VERSION: ", "CODE_VERSION: wrong-"), input.replace("ENACTED_TEXT: ", "ENACTED_TEXT: Changed ")]) {
    assert.throws(() => rebindRecordedDraft({input: invalidInput}, record.answer), /requires one exact enacted passage/);
  }
  if (record.id === "PC-04") {
    assert.throws(() => rebindRecordedDraft({input: input.replace("lint strainers.", "lint strainers. Section PC 413: Food Waste Disposer Units")}, record.answer), /requires one exact enacted passage/);
  }
}
assert.equal(JSON.stringify(recorded), originalRecorded, "Adapting provider doubles must not alter the frozen recorded run.");
// The recorded run predates canonical chapter/scope metadata. Compare every
// historical citation field exactly, and separately require today's metadata
// to remain present and explicitly avoid establishing project applicability.
const historicalCitationFields = citation => {
  const { canonicalApplicabilityContext: context, chapterNumber, chapterTitle, supportingPassages, ...fields } = citation;
  assert.equal(context.version, "canonical-source-context-v1");
  assert.equal(context.metadataAvailable, true);
  assert.equal(context.projectApplicability, "not_established_by_source_metadata");
  assert.equal(context.chapter.number, chapterNumber);
  assert.equal(context.chapter.title, chapterTitle);
  assert(context.sectionGroup.label && context.sectionGroup.title);
  return { ...fields, supportingPassages: supportingPassages.map(passage => {
    const { canonicalApplicabilityContext, ...savedFields } = passage;
    assert.deepEqual(canonicalApplicabilityContext, context);
    return savedFields;
  }) };
};
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    const phase = body.text.format.name;
    phases.push(phase);
    let call;
    let output;
    if (phase === "permitext_code_interpretation") {
      assert.equal(phases.length, 1);
      call = recorded.providerCalls.find((item) => item.caseID === active.id && item.phase === phase);
      const draft = JSON.parse(call.output.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join(""));
      output = [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(rebindRecordedDraft(body, draft)) }] }];
    } else {
      assert.equal(phase, "permitext_research_verification");
      assert(phases.length === 2 || phases.length === 3);
      const proposed = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
      const verificationRun = active.id === "PC-04" ? laundryVerification : panVerification;
      const verificationCaseID = active.id === "PC-04"
        ? (phases.length === 2 ? "PC-04-delivered-decision-facts" : "PC-04-delivered-facts-corrected")
        : (phases.length === 2 ? "PC-10-recorded" : "PC-10-decision-facts-only");
      call = verificationRun.providerCalls.find((item) => item.caseID === verificationCaseID && item.phase === phase);
      const recordedVerdict = verificationRun.results.find((item) => item.id === verificationCaseID).verification;
      let verdict;
      if (phases.length === 2) {
        firstProposed = proposed;
        assert.deepEqual(proposed.missingFacts, active.answer.missingFacts);
        for (const key of ["answerText", "supportedPoints", "citations"]) {
          assert.deepEqual(key === "citations" ? proposed.citations.map(historicalCitationFields) : proposed[key],
            reboundHistoricalAnswer[key], `The verifier must receive the delivered ${key}, including source repairs.`);
        }
        // Explicit synthetic scope annotation for the new field; historical verdicts
        // predate it. Keep the recorded issues, indices, draft, and usage unchanged.
        verdict = {...recordedVerdict, missingFactsOnly: true};
        assert.equal(verdict.pass, false);
        assert.deepEqual(verdict.unnecessaryMissingFactIndices, proposed.missingFacts.map((_, index) => index));
      } else {
        secondProposed = proposed;
        assert.deepEqual(secondProposed, { ...firstProposed, missingFacts: [] },
          "The final verifier must receive the full revised candidate, not approve it from the first verdict.");
        assert.equal(recordedVerdict.pass, true);
        verdict = accept ? recordedVerdict : {
          pass: false, issues: [{ type: "unsupported_requirement", detail: "Synthetic final rejection: removing facts never approves an answer by itself." }], unnecessaryMissingFactIndices: []
        };
      }
      output = phases.length !== 2 && accept ? call.output
        : [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(verdict) }] }];
    }
    // Preserve actual recorded token usage, including each live verifier phase.
    return Response.json(withSyntheticMaterialScopeProviderResponse(body, { model: body.model, status: "completed", usage: call.usage, output }));
  } catch (error) {
    providerDoubleError = error;
    throw error;
  }
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
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline fact-repair contract" } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  const auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const seen = new Set();
  for (const record of recorded.results) for (const accepted of [false, true]) {
    active = record;
    accept = accepted;
    phases = [];
    providerDoubleError = undefined;
    const created = await request("/research/conversations/create", { auth }, token);
    const conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, question: active.question, requestID: randomUUID() }, token);
    if (providerDoubleError) throw providerDoubleError;
    assert.deepEqual(phases, ["permitext_code_interpretation", "permitext_research_verification", "permitext_research_verification"]);
    if (accept) {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const answer = response.body.conversation.messages.findLast((message) => message.role === "assistant").answer;
      assert.equal(answer.answerText, active.answer.answerText);
      assert.deepEqual(answer.missingFacts, []);
      assert.equal(answer.verification.decisionFactRepairApplied, true);
      assert.equal(answer.verification.regenerated, false);
      assert.equal(answer.verification.attempts, 2);
    } else {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.conversation.messages.at(-1).answer.mode, "clarification");
      assert.equal(response.body.conversation.messages.at(-1).answer.charged, false);
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.body.conversation.messages.filter((message) => message.role === "assistant").length, 1);
    }
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    const operations = telemetry.body.researchSpend.operationMetrics.filter((operation) => !seen.has(operation.id));
    assert.equal(operations.length, 1);
    const operation = operations[0];
    seen.add(operation.id);
    assert.equal(operation.charged, accept);
    assert.equal(operation.providerRequestCount, 3);
    assert.equal(operation.pendingProviderRequestCount, 0);
    // Only the draft and two fresh verifier envelopes incur provider usage.
    const expectedAccounting = active.id === "PC-04"
      ? { cacheWrites: 35250, costUSD: .050629 }
      : { cacheWrites: 18696, costUSD: .033381 };
    assert.equal(operation.cacheWriteInputTokens, expectedAccounting.cacheWrites);
    assert.equal(operation.actualProviderCostUSD, expectedAccounting.costUSD);
    if (accept) assert(Math.abs(operation.estimatedCostUSD - operation.actualProviderCostUSD) <= .000001);
    assert(operation.conservativeProviderCostUSD <= 1.50);
  }
} finally {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await rm(scratch, { recursive: true, force: true });
}
assert.equal(JSON.stringify(recorded), originalRecorded, "HTTP replay must leave the frozen historical run unchanged.");
console.log("Decision-fact HTTP replays passed: four flows, recorded verdict fixtures and certified field-only candidates, preserved answer/citations, synthetic final rejection blocks saving/charging, fresh full-answer verification, recorded usage under the local $1.50 turn cap.");
