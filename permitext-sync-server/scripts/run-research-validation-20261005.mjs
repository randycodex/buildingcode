// Isolated acceptance runner. Default: retrieval only, zero provider calls.
// --live requires an explicit model policy and the durable $10.99 campaign ledger.
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { evaluationBudget } from "./research-evaluation-budget.mjs";
import { researchProviderReadiness } from "./research-provider-readiness-20261005.mjs";
import { validationReservation, validationCost, validationPricing } from "./research-validation-pricing-20261005.mjs";
import { researchSemanticEmbeddingModel, researchSemanticEmbeddingReservation, researchSemanticEmbeddingCost } from "../research-semantic-passages.mjs";
const live = process.argv.includes("--live");
const retrievalLive = process.argv.includes("--retrieval-live");
const fixedEvidence = process.argv.includes("--fixed-evidence");
const advisoryRoutes = true;
const currentCorpusRecall = true;
const advisoryRanking = true;
const passageSearch = process.argv.includes("--passage-search");
const root = new URL("../", import.meta.url);
const options = new Map();
for (let index = 2; index < process.argv.length; index++) {
  const [name, ...suffix] = process.argv[index].split("=");
  if (["--live", "--retrieval-live", "--fixed-evidence", "--advisory-routes", "--current-corpus-recall", "--advisory-ranking", "--passage-search"].includes(name)) { assert(!suffix.length); continue; }
  assert(["--fixture", "--only", "--budget-ledger", "--campaign-cap-usd", "--application-root", "--semantic-vectors", "--phase", "--model-policy"].includes(name), `Unknown option: ${name}`);
  const value = suffix.length ? suffix.join("=") : process.argv[++index];
  assert(value && !value.startsWith("--"), `Missing value for ${name}`);
  options.set(name, value);
}
const argument = name => options.get(name);
const modelPolicy = argument("--model-policy") || "existing-hybrid";
assert(["existing-hybrid", "luna-only"].includes(modelPolicy));
assert(!live || argument("--model-policy"), "Answer evaluation requires an explicit model policy; never silently opt into Sol");
const applicationRoot = argument("--application-root") ? pathToFileURL(`${argument("--application-root").replace(/\/$/, "")}/`) : root;
const campaignCapUSD = Number(argument("--campaign-cap-usd") || 10.99);
assert.equal(campaignCapUSD, 10.99, "This authorization is fixed at $10.99");
const phaseBucket = argument("--phase") || "diagnostic";
assert(["diagnostic", "fresh"].includes(phaseBucket));
const phaseCapUSD = phaseBucket === "diagnostic" ? 2.99 : 8;
assert(Number.isFinite(campaignCapUSD) && campaignCapUSD > 0 && campaignCapUSD <= 15.73);
const campaignBudget = argument("--budget-ledger") ? evaluationBudget(argument("--budget-ledger"), campaignCapUSD, validationPricing) : null;
const semanticVectorPath = argument("--semantic-vectors") || (live ? new URL("prepared/research-semantic/current-vectors.bin", root).pathname : null);
if (semanticVectorPath) assert(passageSearch && campaignBudget && (live || retrievalLive), "Semantic query calls require passage search, explicit paid mode and shared budget ledger");
if (retrievalLive) assert(semanticVectorPath && !live, "Retrieval-only paid mode requires semantic vectors and excludes answer calls");
const fixturePath = argument("--fixture") || "evals/research-accuracy-holdout-2026-10-01.json";
const fixtureText = await readFile(new URL(fixturePath, root), "utf8");
const fixture = JSON.parse(fixtureText);
const selectedIDs = argument("--only")?.split(",");
if (selectedIDs) fixture.conversations = fixture.conversations.filter(item => selectedIDs.includes(item.id));
assert(fixture.conversations.length, "At least one evaluation conversation must be selected");
const directory = process.env.PERMITEXT_ACCURACY_OUTPUT || join(tmpdir(), `permitext-accuracy-${Date.now()}`);
await mkdir(directory); // Refuse an existing directory rather than overwrite its spend ledger.
const inheritedAPIKey = process.env.OPENAI_API_KEY;
assert(!live || campaignBudget, "Live testing requires the shared durable ledger");
if (live || retrievalLive) {
  const readiness = await researchProviderReadiness({ apiKey: inheritedAPIKey });
  await writeFile(join(directory, "readiness.json"), JSON.stringify(readiness, null, 2));
  assert(readiness.ready, "Provider authentication is not ready; no billable evaluation calls were dispatched");
}
const scratch = await mkdtemp(join(tmpdir(), "permitext-accuracy-store-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
if (live || retrievalLive) {
  assert(inheritedAPIKey, "The managed environment must supply OPENAI_API_KEY");
  process.env.OPENAI_API_KEY = inheritedAPIKey;
}
Object.assign(process.env, {
  NODE_ENV: "", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_WEB_SUPPORT: "0",
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "0",
  PERMITEXT_RESEARCH_ADVISORY_TOPIC_ROUTES: "1",
  PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL: "1",
  PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING: "1",
  PERMITEXT_RESEARCH_PASSAGE_SEARCH: passageSearch ? "1" : "0",
  PERMITEXT_RESEARCH_SEMANTIC_SEARCH: semanticVectorPath ? "1" : "0",
  PERMITEXT_RESEARCH_SEMANTIC_VECTOR_PATH: semanticVectorPath || "",
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-6.1-sol", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_ROUTING_POLICY: "review_first", PERMITEXT_RESEARCH_COMPLEX_VERIFICATION: "1",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_SERVICE_TIER: "priority", PERMITEXT_RESEARCH_ACCURATE_SERVICE_TIER: "default",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: ".5",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "official-model-docs-2026-10-03",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".10",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "10",
  PERMITEXT_RESEARCH_PRICING_VERSION: "official-model-docs-2026-10-03",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "10.99",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "10.99", PERMITEXT_RESEARCH_DAILY_CAP_USD: "10.99",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "10.99"
});
if (modelPolicy === "luna-only") Object.assign(process.env, {
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "fixed",
  PERMITEXT_RESEARCH_COMPLEX_VERIFICATION: "0",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5"
});
const nativeFetch = globalThis.fetch;
const sourceHashes = {};
for (const name of ["app.mjs", "research-rule-packets.mjs", "research-evidence-assembly.mjs",
  "research-conversation-facts.mjs", "research-targeted-revision.mjs", "evidence-discovery.mjs",
  "research-evidence-priority.mjs", "research-conversation-topic.mjs", "research-corpus-registry.mjs",
  "research-question-intent.mjs", "research-conversation-continuity.mjs", "research-answer-presentation.mjs", "research-answer-quality.mjs",
  "research-web-attribution.mjs", "research-config.mjs",
  "research-zoning-safety.mjs", "project-foundation-contract.mjs",
  "research-technical-topic-routes.mjs", "scripts/research-evaluation-budget.mjs", "scripts/run-research-validation-20261005.mjs", "scripts/research-validation-pricing-20261005.mjs", "scripts/research-provider-readiness-20261005.mjs"]) {
  sourceHashes[name] = createHash("sha256").update(await readFile(new URL(name, applicationRoot))).digest("hex");
}
for (const name of ["research-passage-index.mjs", "research-semantic-passages.mjs",
  "research-retrieval-query-context.mjs", "research-interpretation-context.mjs"]) {
  try { sourceHashes[name] = createHash("sha256").update(await readFile(new URL(name, applicationRoot))).digest("hex"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
const result = { fixturePath, applicationRoot: applicationRoot.href, fixtureHash: createHash("sha256").update(fixtureText).digest("hex"), sourceHashes, selectedIDs,
  live, retrievalLive, modelPolicy, semanticVectorPath, advisoryRoutes, currentCorpusRecall, advisoryRanking, passageSearch, campaignCapUSD,
  mode: fixedEvidence ? "fixed-evidence-reasoning" : "end-to-end", phaseBucket, capUSD: phaseCapUSD, startedAt: new Date().toISOString(), provider: [], cases: [] };
const persist = () => writeFile(join(directory, "results.json"), JSON.stringify(result, null, 2));
globalThis.fetch = async (url, options = {}) => {
  const target = new URL(String(url));
  if (target.hostname === "127.0.0.1") return nativeFetch(url, options);
  const embedding = target.pathname === "/v1/embeddings";
  assert((live || (retrievalLive && embedding)) && target.hostname === "api.openai.com" &&
    (target.pathname === "/v1/responses" || (semanticVectorPath && embedding)), "External access is not allowed for this evaluation");
  const body = JSON.parse(options.body);
  assert(embedding ? body.model === researchSemanticEmbeddingModel : ["gpt-6-luna", "gpt-6.1-sol"].includes(body.model), "Do not silently change the evaluated models");
  assert(embedding || modelPolicy !== "luna-only" || body.model === "gpt-6-luna", "Sol dispatch is forbidden in Luna-only evaluation");
  assert(!body.tools?.length && !body.previous_response_id && !body.conversation);
  assert(!body.service_tier || ["priority", "default"].includes(body.service_tier));
  const reserved = embedding ? researchSemanticEmbeddingReservation(body.input) : validationReservation(body);
  assert(!result.provider.some(call => call.status === "pending" || call.status === "unknown"), "Reconcile unsettled requests before spending more");
  assert(!result.provider.some(call => call.status === "rejected"), "Stop after provider rejection; do not dispatch a model fallback");
  const spent = result.provider.reduce((sum, call) => sum + (call.costUSD ?? call.reservedUSD), 0);
  if (spent + reserved > result.capUSD) throw Object.assign(Error("Evaluation cap reached"), { code: "RESEARCH_EVAL_SPEND_CAP" });
  if (campaignBudget) {
    const bucketSpent = campaignBudget.snapshot().calls.filter(call => call.phaseBucket === phaseBucket)
      .reduce((sum, call) => sum + (call.costUSD ?? call.reservedUSD), 0);
    if (bucketSpent + reserved > phaseCapUSD) throw Object.assign(Error("Phase spending cap reached"), { code: "RESEARCH_EVAL_SPEND_CAP" });
  }
  const call = { phaseBucket, id: randomUUID(), case: result.activeCase, model: body.model, effort: body.reasoning?.effort,
    phase: embedding ? "query_embeddings" : body.text?.format?.name, status: "pending", reservedUSD: reserved, startedAt: new Date().toISOString() };
  campaignBudget?.reserve({ ...call, runDirectory: directory });
  result.provider.push(call); await persist();
  await writeFile(join(directory, `${call.id}-request.json`), JSON.stringify(body));
  const started = performance.now();
  try {
    const response = await nativeFetch(url, options);
    const payload = await response.clone().json();
    const savedPayload = structuredClone(payload);
    if (savedPayload.error?.code === "invalid_api_key") savedPayload.error.message = "Authentication rejected (credential-bearing message removed)";
    await writeFile(join(directory, `${call.id}-response.json`), JSON.stringify(savedPayload));
    call.httpStatus = response.status;
    call.errorCode = payload.error?.code;
    call.seconds = (performance.now() - started) / 1000;
    call.usage = payload.usage;
    call.status = payload.usage ? "settled" : response.ok ? "unknown" : "rejected";
    if (payload.usage) {
      call.costUSD = embedding ? researchSemanticEmbeddingCost(payload.usage) : validationCost(payload);
    } else if (response.status === 401 && payload.error?.code === "invalid_api_key") {
      call.costUSD = 0; // Authentication rejected before generation.
    }
    campaignBudget?.settle(call.id, { status: call.status, costUSD: call.costUSD, usage: call.usage,
      httpStatus: call.httpStatus, errorCode: call.errorCode, endedAt: new Date().toISOString() });
    await persist(); return response;
  } catch (error) {
    call.status = "unknown"; call.error = error.code || error.name;
    const pending = campaignBudget?.snapshot().calls.find(item => item.id === call.id && item.status === "pending");
    if (pending) campaignBudget.settle(call.id, { status: "unknown", error: call.error });
    await persist(); throw error;
  }
};
let server;
try {
  const { assembledResearchEvidenceForTurn, handleRequest, researchBodyForCatalogSection,
    openAIResearchInterpretation, openAIResearchVerification, researchProjectInformation,
    researchCorpusPlanForTurn } = await import(new URL("app.mjs", applicationRoot));
  const { researchCorpusPlanRequestsCorpus } = await import(new URL("research-corpus-registry.mjs", applicationRoot));
  const { planZoningResearchQuestion } = await import(new URL("research-zoning-planner.mjs", applicationRoot));
  // Save first-question retrieval separately from answer scoring. The expected
  // references never enter normal retrieval or the user's question.
  for (const conversation of live ? [] : fixture.conversations) {
    result.activeCase = `${conversation.id}-retrieval`;
    const question = conversation.questions[0];
    const project = conversation.project || fixture.project;
    const projectInformation = project ? researchProjectInformation(`eval-${conversation.id}`, project) : null;
    const projectFacts = projectInformation?.facts || [];
    const corpusPlan = await researchCorpusPlanForTurn({ question, messages: [], projectFacts,
      projectCodeVersion: projectInformation?.canonicalCodeVersion });
    const zoningPlan = researchCorpusPlanRequestsCorpus(corpusPlan, "nyc-zoning-resolution")
      ? planZoningResearchQuestion({ question, projectFacts }) : null;
    const packet = await assembledResearchEvidenceForTurn({ question, messages: [], projectFacts, pinnedEvidence: [], corpusPlan, zoningPlan });
    if (projectInformation) packet.evaluationProjectInformation = projectInformation;
    await writeFile(join(directory, `${conversation.id}-retrieval.json`), JSON.stringify(packet, null, 2));
  }
  if (live) {
    server = createServer(handleRequest);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const request = async (path, body, token) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body)
      });
      return { status: response.status, body: await response.json() };
    };
    const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Isolated accuracy evaluation" } });
    assert.equal(signed.status, 200);
    const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
    const grant = await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
    assert.equal(grant.status, 200);
    const createProject = async project => {
      const projectID = randomUUID();
      const pushed = await request("/sync/push", { batch: { user: { id: account.appUserID }, mutations: [{ project: {
        ...project, id: projectID, clientID: projectID, userID: account.appUserID, updatedAt: new Date().toISOString()
      } }] } }, token);
      assert.equal(pushed.status, 200);
      return projectID;
    };
    const fixtureProjectID = fixture.project ? await createProject(fixture.project) : null;
    result.projectID = fixtureProjectID;
    result.projectIDsByConversation = {};
    for (const conversation of fixture.conversations) {
      const projectID = conversation.project ? await createProject(conversation.project) : fixtureProjectID;
      if (projectID) result.projectIDsByConversation[conversation.id] = projectID;
      if (fixedEvidence) {
        // Diagnostic arm only: references are curated answer-key sources, never
        // inserted into the ordinary retrieval arm or its user questions.
        const sources = [];
        for (const reference of conversation.references) {
          const packet = await assembledResearchEvidenceForTurn({ question: `Explain ${reference}`, messages: [], projectFacts: [], pinnedEvidence: [] });
          const source = packet.sources.find(value => `${value.codePrefix} ${value.sectionNumber}` === reference);
          assert(source, `Missing fixed-evidence reference: ${reference}`);
          const body = await researchBodyForCatalogSection({ ...source, id: source.sectionID });
          const text = body.blocks.map(block => block.plainText || "").join("\n\n");
          assert(text.trim(), `Empty canonical reference: ${reference}`);
          sources.push({ ...source, text, canonicalContextComplete: true, truncated: false,
            sourceID: `fixed-${source.sectionID}`, evidencePriority: { claimCoverageRequired: false } });
        }
        assert(sources.reduce((sum, source) => sum + source.text.length, 0) <= 48000, "Fixed evidence exceeds normal package ceiling");
        await writeFile(join(directory, `${conversation.id}-fixed-evidence.json`), JSON.stringify(sources, null, 2));
        const messages = [];
        for (const [index, question] of conversation.questions.entries()) {
          result.activeCase = `${conversation.id}-${index + 1}`;
          const started = performance.now();
          try {
            const generated = await openAIResearchInterpretation(question, sources, account.appUserID, { responseStyle: "conversational", messages });
            const verification = await openAIResearchVerification(question, sources, generated.interpretation, account.appUserID, { messages });
            result.cases.push({ id: result.activeCase, question, seconds: (performance.now() - started) / 1000,
              answer: generated.interpretation, verification, expected: conversation.checks[index] });
            messages.push({ role: "user", question }, { role: "assistant", answer: generated.interpretation });
          } catch (error) {
            result.cases.push({ id: result.activeCase, question, seconds: (performance.now() - started) / 1000, error: error.code || error.message });
          }
          await persist();
        }
        continue;
      }
      const created = await request("/research/conversations/create", { auth, ...(projectID ? {projectID} : {}) }, token);
      assert.equal(created.status, 201);
      for (const [index, question] of conversation.questions.entries()) {
        result.activeCase = `${conversation.id}-${index + 1}`;
        const started = performance.now();
        const response = await request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question, requestID: randomUUID() }, token);
        if (projectID && response.status === 200) {
          assert.equal(response.body.conversation.primaryProjectID, projectID);
          const expectedProject = researchProjectInformation(projectID, conversation.project || fixture.project);
          assert.equal(response.body.conversation.projectInformation?.projectID, projectID);
          assert.deepEqual(response.body.conversation.projectInformation.facts, expectedProject.facts,
            "The live project-linked question must receive the same normalized facts as retrieval preflight.");
        }
        const item = { id: result.activeCase, question, status: response.status, seconds: (performance.now() - started) / 1000,
          projectID: response.body.conversation?.primaryProjectID, topicContext: response.body.conversation?.topicContext,
          projectInformation: response.body.conversation?.projectInformation,
          answer: response.body.conversation?.messages.at(-1)?.answer, error: response.body.error, expected: conversation.checks[index] };
        result.cases.push(item); await persist();
        console.log(JSON.stringify({ id: item.id, status: item.status, seconds: item.seconds, mode: item.answer?.mode, costUSD: result.provider.filter(call=>call.case===item.id).reduce((sum,call)=>sum+(call.costUSD??call.reservedUSD),0) }));
        // Diagnostics pause at the first unresolved answer. The frozen fresh
        // cohort retains and counts withheld answers instead of dropping them.
        if (response.status !== 200 || (phaseBucket === "diagnostic" &&
            (item.answer?.mode === "clarification" || item.answer?.verification?.pass !== true))) {
          result.stoppedAfterFailure = item.id; break;
        }
      }
      if (result.stoppedAfterFailure) break;
    }
  }
  result.finishedAt = new Date().toISOString(); await persist();
  console.log(`EVIDENCE_DIRECTORY ${directory}`);
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
