// Real HTTP, canonical retrieval and persistence with explicit semantic doubles.
// This proves candidate/gate mechanics, not legal or provider-model accuracy.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withSyntheticMaterialScopeProviderResponse, applicabilityPacketFromRequest } from "./research-applicability-response-double.mjs";
const scratch = await mkdtemp(join(tmpdir(), "permitext-certified-field-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-provider-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0",
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "single",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium", PERMITEXT_RESEARCH_SERVICE_TIER: "priority",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-standard-rates",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "5",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "5", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "5"
});
const nativeFetch = globalThis.fetch;
let active, phases, proposed, firstReviewed, finalReviewed, firstScope, finalScope, doubleError;
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), "https://api.openai.com/v1/responses", "No other external request is permitted.");
    const body = JSON.parse(options.body), phase = body.text.format.name;
    phases.push(phase);
    assert.equal(body.model, "gpt-6-luna"); assert.equal(body.service_tier, "priority");
    assert.equal(body.reasoning.effort, phase === "permitext_code_interpretation" && phases.length === 1 ? "low" : "medium");
    assert.equal(body.max_output_tokens, phase === "permitext_research_verification" ? 8000 : 24000);
    let value;
    if (phase === "permitext_code_interpretation") {
      assert(phases.length === 1 || active.mixed && phases.length === 3);
      if (phases.length === 3) {
        assert(body.input.includes(firstReviewed.answerText));
        value = { ...proposed, answerText: proposed.answerText.replace("The stated exception remains part of this explanation.", "Keep the source's stated exception in this explanation."), missingFacts: [] };
      } else {
      const sources = [...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: [^\n]+\nSECTION: ([^\n]+)/g)];
      const source = sources.find(match => match[3] === "304.12"); assert(source);
      const explanation = "MC § 304.12 requires permanent identification of the area served, with its exception for equipment serving only the room or space where it is located.";
      proposed = { answerText: explanation + " The stated exception remains part of this explanation.",
        supportedPoints: [{ heading: "Identification", explanation, sectionID: source[2], sourceIDs: [source[1]] }],
        citations: [{ sectionID: source[2], sourceIDs: [source[1]], relevance: "Identification rule and exception." }],
        assumptions: [], missingFacts: active.protected ? [] : ["What finish color is planned for the label?"],
        followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: [] };
      value = proposed;
      }
    } else if (phase === "permitext_research_targeted_revision") {
      assert(!active.fieldOnly, "A certified field edit must not request a broader model revision.");
      assert.equal(phases.length, 3);
      const targets = JSON.parse(body.input.split("EDITABLE TEXT TARGETS\n")[1]);
      const narrative = targets.find(target => target.path === "answerText" && target.text.includes("stated exception")); assert(narrative);
      value = { edits: [{ targetID: narrative.id, after: "Keep the source's stated exception in this explanation.", remove: false },
        ...(!active.protected ? targets.filter(target => target.path.startsWith("missingFacts/")).map(target => ({ targetID: target.id, after: "", remove: true })) : [])],
        bindingAdditions: [], pointRemovals: [], citationRemovals: [] };
    } else {
      assert.equal(phase, "permitext_research_verification");
      const candidate = JSON.parse(body.input.split("PROPOSED ANSWER JSON\n")[1]);
      const scope = applicabilityPacketFromRequest(body);
      if (!firstReviewed) {
        firstReviewed = candidate; firstScope = scope;
        if (active.protected) assert(candidate.missingFacts.some(fact => /served area.*unknown/i.test(fact)));
        else assert.deepEqual(candidate.missingFacts, proposed.missingFacts);
        value = { pass: false, issues: [{ type: "unnecessary_qualification", detail: "Synthetic finding limited to the indicated optional missing fact." }],
          unnecessaryMissingFactIndices: [0], ...(active.certificate !== undefined ? { missingFactsOnly: active.certificate } : {}) };
        if (active.mixed) value.issues.push({ type: "misstated_provision", detail: "Synthetic substantive finding also requires narrative revision." });
      } else {
        finalReviewed = candidate; finalScope = scope;
        assert.notEqual(scope.answerHash, firstScope.answerHash); assert.notEqual(scope.contextHash, firstScope.contextHash);
        assert.match(body.input, /PRIOR REVIEW HISTORY/);
        if (active.fieldOnly) assert.deepEqual(candidate, { ...firstReviewed, missingFacts: [] }, "Only the certified field changes before fresh review.");
        else {
          assert.notEqual(candidate.answerText, firstReviewed.answerText, "Uncertified/mixed/restored findings use ordinary revision.");
          if (active.protected) assert.deepEqual(candidate.missingFacts, firstReviewed.missingFacts, "A declared unknown survives restoration and revision.");
        }
        assert.deepEqual(candidate.supportedPoints, firstReviewed.supportedPoints); assert.deepEqual(candidate.citations, firstReviewed.citations);
        value = active.reject ? { pass: false, issues: [{ type: "unsupported_requirement", detail: "Synthetic fresh review still rejects the narrative despite the field certificate." }],
          unnecessaryMissingFactIndices: [], missingFactsOnly: false } : { pass: true, issues: [], unnecessaryMissingFactIndices: [], missingFactsOnly: false };
      }
    }
    return Response.json(withSyntheticMaterialScopeProviderResponse(body, { model: body.model, status: "completed",
      usage: { input_tokens: 100, output_tokens: 100 }, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] }));
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
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline field-repair contract" } });
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const seenOperations = new Set();
  for (const scenario of [{ id: "certified", certificate: true, fieldOnly: true }, { id: "fresh-rejection", certificate: true, fieldOnly: true, reject: true },
    { id: "mixed", certificate: true, mixed: true }, { id: "uncertified", certificate: false }, { id: "legacy", certificate: undefined },
    { id: "protected", certificate: true, protected: true }]) {
    active = scenario; phases = []; firstReviewed = finalReviewed = undefined; doubleError = undefined;
    let projectID;
    if (active.protected) {
      projectID = randomUUID();
      const pushed = await request("/sync/push", { batch: { user: { id: account.appUserID }, mutations: [{ project: {
        id: projectID, clientID: projectID, userID: account.appUserID, name: "Declared unknown contract",
        structuredFacts: [{ key: "served-area", label: "Served area", value: "Unknown", status: "unknown", source: "user" }], updatedAt: new Date().toISOString()
      } }] } }, token); assert.equal(pushed.status, 200);
    }
    const created = await request("/research/conversations/create", { auth, ...(projectID ? { projectID } : {}) }, token);
    const conversationID = created.body.conversation.id;
    const response = await request("/research/conversations/message", { auth, conversationID, requestID: randomUUID(),
      question: "For our project under the 2022 NYC codes, what identification rule does MC 304.12 provide for installed equipment?" }, token);
    if (doubleError) throw doubleError;
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(phases, ["permitext_code_interpretation", "permitext_research_verification",
      ...(!active.fieldOnly ? [active.mixed ? "permitext_code_interpretation" : "permitext_research_targeted_revision"] : []), "permitext_research_verification"]);
    assert(finalReviewed, "The candidate must receive a fresh semantic verdict.");
    const delivered = response.body.conversation.messages.at(-1).answer;
    const operations = (await request("/internal/evaluations/data", { auth }, token)).body.researchSpend.operationMetrics;
    const currentOperations = operations.filter(operation => !seenOperations.has(operation.id)); assert.equal(currentOperations.length, 1);
    const operation = currentOperations[0]; seenOperations.add(operation.id);
    assert.equal(operation.providerRequestCount, active.fieldOnly ? 3 : 4); assert.equal(operation.pendingProviderRequestCount, 0);
    assert.equal(operation.charged, !active.reject); assert(operation.conservativeProviderCostUSD <= 1);
    if (active.reject) {
      assert.equal(delivered.mode, "clarification"); assert.equal(delivered.charged, false);
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.body.conversation.messages.filter(message => message.role === "assistant").length, 1);
      assert.notEqual(reopened.body.conversation.messages.at(-1).answer.answerText, finalReviewed.answerText, "A rejected candidate is not persisted as the delivered answer.");
    }
    else {
      assert.equal(delivered.mode, "openai"); assert.equal(delivered.answerText, finalReviewed.answerText);
      assert.deepEqual(delivered.supportedPoints, finalReviewed.supportedPoints); assert.deepEqual(delivered.citations, finalReviewed.citations);
      assert.equal(delivered.verification.decisionFactRepairApplied === true, active.fieldOnly === true);
      assert.equal(delivered.verification.regenerated, active.fieldOnly !== true); assert.equal(delivered.verification.attempts, 2);
      const reopened = await request("/research/conversations/get", { auth, conversationID }, token);
      assert.equal(reopened.body.conversation.messages.at(-1).answer.answerText, finalReviewed.answerText);
    }
  }
  console.log("Certified field repair HTTP mechanics passed: certified unchanged body/citations, fresh rejection, mixed/uncertified/legacy revision, protected unknown no-edit fallthrough, fresh hashes, configured roles/caps, bounded call counts and persistence. Provider responses synthetic; semantic accuracy unproved.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch; await rm(scratch, { recursive: true, force: true });
}
