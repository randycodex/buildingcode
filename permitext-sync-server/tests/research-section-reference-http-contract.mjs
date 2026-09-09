import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ownerResearchScopeInput, ownerResearchHTTPSelections } from "../evals/research-owner-scope-input.mjs";

const scratch = await mkdtemp(join(tmpdir(), "permitext-section-reference-http-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "10",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "10", PERMITEXT_RESEARCH_DAILY_CAP_USD: "10", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "10",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "0"
});
const nativeFetch = globalThis.fetch;
let requests = [], server;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  const body = JSON.parse(options.body);
  assert(!body.tools?.length, "A selected enacted-source test must not perform web discovery.");
  requests.push(body);
  return Response.json({ error: { code: "offline_preflight", message: "Provider dispatch intercepted." },
    usage: { input_tokens: 0, output_tokens: 0 } }, { status: 400 });
};
try {
  const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
  const { zoningSectionSummary, zoningSection } = await import("../zoning-content.mjs");
  const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
  const adapter = createFileStoreAdapter();
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline source references" } });
  assert.equal(signed.status, 200);
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const create = (selections, extra = {}) => request("/research/conversations/create", { auth, selections, ...extra }, token);
  const ask = (conversationID, question) => request("/research/conversations/message", { auth, conversationID, question, requestID: randomUUID() }, token);
  const reference = { sectionID: "20018523", selectionMode: "section_reference" };
  for (const selection of [
    { ...reference, selectedText: "Invented highlight" }, { ...reference, richSourceIDs: [] },
    { ...reference, visualSourceIDs: [] }, { ...reference, visualReviewConfirmed: true },
    { ...reference, visualReviewDisposition: "diagnostic-structured-text-only" }, { ...reference, savedItemID: "unverified-saved-item" },
    { ...reference, selectionMode: "unknown" }, { sectionID: reference.sectionID }, { ...reference, sectionID: "missing-section" }
  ]) {
    const rejected = await create([selection]);
    assert(rejected.status >= 400, JSON.stringify({ selection, response: rejected.body }));
  }
  assert.equal(requests.length, 0);
  const requestID = randomUUID(), first = await create([reference], { requestID });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const replay = await create([reference], { requestID });
  assert.equal(replay.status, 200); assert.equal(replay.body.conversation.id, first.body.conversation.id);
  assert.equal((await create([{ ...reference, sectionID: "20018017" }], { requestID })).status, 409);
  // Use a single contiguous authored passage for the unchanged legacy path.
  // Joining noncontiguous fragments is not a valid selection; do not weaken
  // canonical matching to make that separate harness problem pass here.
  const exactCase = key.cases.find((item) => item.id === "CC-02");
  const exactInput = await ownerResearchScopeInput(exactCase, { original: true, zoningSummary: zoningSectionSummary });
  const exact = await create(ownerResearchHTTPSelections(exactInput));
  assert.equal(exact.status, 201, JSON.stringify(exact.body));
  const savedExact = (await adapter.listResearchConversations(account.appUserID)).find((item) => item.id === exact.body.conversation.id);
  for (const source of savedExact.sources.filter((source) => source.kind === "selection")) {
    assert(source.selectedText.length > 0); assert.equal(source.selectionMode, undefined);
  }
  for (const id of ["ZR-03", "ZR-06", "ZR-09", "ZR-19", "ZR-20"]) {
    const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === id), { original: true, zoningSummary: zoningSectionSummary });
    const selections = ownerResearchHTTPSelections(input);
    assert(selections.every((selection) => selection.selectionMode === "section_reference" && selection.selectedText === undefined));
    const created = await create(selections);
    assert.equal(created.status, 201, `${id}: ${JSON.stringify(created.body)}`);
    const saved = (await adapter.listResearchConversations(account.appUserID)).find((item) => item.id === created.body.conversation.id);
    assert.equal(saved.primaryProjectID, null); assert.equal(saved.sources.length, selections.length);
    for (const source of saved.sources) {
      assert.equal(source.selectionMode, "section_reference"); assert.equal(source.selectedText, "");
      assert.equal(source.selectedTextHash, null); assert.deepEqual(source.visualSources, []);
      assert.equal(source.visualReviewConfirmedAt, null); assert.match(source.sectionTextHash, /^[a-f0-9]{64}$/);
    }
    requests = [];
    const response = await ask(saved.id, input.question);
    assert(response.status >= 400, "The preflight double cannot produce a saved answer.");
    assert(requests.length > 0, `${id}: did not reach provider boundary: ${JSON.stringify(response.body)}`);
    const prompt = requests[0].input;
    assert.equal(typeof prompt, "string");
    assert.doesNotMatch(prompt, /READER_SELECTION_SCOPE: The user selected the full section/);
    assert.doesNotMatch(prompt, /USER_SELECTED_EXCERPT:/);
    if (id === "ZR-19") {
      assert.match(prompt, /contiguous for a minimum of 10 linear feet/);
      assert.match(prompt, /Do not reopen/);
      const contextLine = prompt.split("\n").find((line) => line.startsWith("DETERMINISTIC_CONTEXT: "));
      assert(contextLine, "The actual HTTP request must carry the premise-aware context.");
      const context = JSON.parse(contextLine.slice("DETERMINISTIC_CONTEXT: ".length));
      const history = context.answerObligations.find((item) => item.id === "definition_historical_branches");
      assert.equal(history.lotHistoryPremise.exclusion, "stated");
      assert.deepEqual(history.values, []);
      assert(history.lotHistoryPremise.groundingStatements.some((text) => text.includes("were not historically one zoning lot")));
    }
    if (id === "ZR-20") {
      assert.match(prompt, /sloping base plane/); assert.match(prompt, /dwelling purposes/);
      assert.match(prompt, /basement/); assert.match(prompt, /cellar/);
    }
    if (id === "ZR-09") {
      assert.match(prompt, /5\.01/);
      assert.match(prompt, /only by the amount of affordable housing provided/);
      assert.match(prompt, /Qualifying affordable housing[”"]? shall include/);
      assert.doesNotMatch(prompt, /ENACTED_TEXT: above-grade mass transit station/);
    }
    if (id === "ZR-06") assert.match(prompt, /documentation satisfactory to the Department of Buildings/);
    assert((await adapter.listResearchConversations(account.appUserID)).find((item) => item.id === saved.id).messages.every((message) => message.role !== "assistant"));
  }
  const mapText = (await zoningSection("20021237")).blocks.map((block) => block.plainText || "").join("\n\n");
  const passageMap = await create([{ sectionID: "20021237", selectedText: mapText }]);
  assert.equal(passageMap.body.code, "RESEARCH_VISUAL_REVIEW_REQUIRED", "The existing exact-passage visual gate must remain intact.");
  const mapReference = await create([{ sectionID: "20021237", selectionMode: "section_reference" }]);
  requests = [];
  const mapAnswer = await ask(mapReference.body.conversation.id, "Does this specific property lie in Appendix J Subarea 1 and permit self-service storage as of right?");
  // Existing behavior permits a cited conditional explanation of supplied
  // rules, while withholding a parcel determination. A reference must keep it.
  assert(mapAnswer.status >= 400);
  assert.equal(requests.length, 1);
  assert.match(requests[0].input, /ANSWER_SCOPE: conditional_source_explanation; PROPERTY_DETERMINATION: unresolved/);
  assert.match(requests[0].input, /property_identifier/);
  assert.match(requests[0].input, /official_mapped_status/);
  assert.match(requests[0].input, /Do not assign a district, map area/);
  requests = [];
  const historicalAnswer = await ask(mapReference.body.conversation.id,
    "For this specific property, what did ZR Section 42-192 require in 2010?");
  assert.equal(requests.length, 0, "Missing historical enacted text must still block provider dispatch.");
  assert.equal(historicalAnswer.body.code, "RESEARCH_ZONING_PREREQUISITES_REQUIRED");
  console.log("Section-reference HTTP contract passed: all five authored inputs reach a zero-usage boundary, exact-passage and visual safeguards remain intact; zero external/provider calls.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
