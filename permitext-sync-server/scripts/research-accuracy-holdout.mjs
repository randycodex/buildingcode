// Isolated acceptance runner. Default: retrieval only, zero provider calls.
// --live opts into the existing Luna configuration with a cumulative $2 cap.
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const live = process.argv.includes("--live");
const fixedEvidence = process.argv.includes("--fixed-evidence");
const root = new URL("../", import.meta.url);
const options = new Map();
for (let index = 2; index < process.argv.length; index++) {
  const [name, ...suffix] = process.argv[index].split("=");
  if (["--live", "--fixed-evidence"].includes(name)) { assert(!suffix.length); continue; }
  assert(["--fixture", "--only"].includes(name), `Unknown option: ${name}`);
  const value = suffix.length ? suffix.join("=") : process.argv[++index];
  assert(value && !value.startsWith("--"), `Missing value for ${name}`);
  options.set(name, value);
}
const argument = name => options.get(name);
const fixturePath = argument("--fixture") || "evals/research-accuracy-holdout-2026-10-01.json";
const fixtureText = await readFile(new URL(fixturePath, root), "utf8");
const fixture = JSON.parse(fixtureText);
const selectedIDs = argument("--only")?.split(",");
if (selectedIDs) fixture.conversations = fixture.conversations.filter(item => selectedIDs.includes(item.id));
assert(fixture.conversations.length, "At least one evaluation conversation must be selected");
const directory = process.env.PERMITEXT_ACCURACY_OUTPUT || join(tmpdir(), `permitext-accuracy-${Date.now()}`);
await mkdir(directory); // Refuse an existing directory rather than overwrite its spend ledger.
const scratch = await mkdtemp(join(tmpdir(), "permitext-accuracy-store-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
if (live) {
  const local = await readFile(new URL(".env.local", root), "utf8");
  const key = local.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  if (!key) throw Error("A local API key is required for explicit live evaluation.");
  process.env.OPENAI_API_KEY = key;
}
Object.assign(process.env, {
  NODE_ENV: "", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_WEB_SUPPORT: "0",
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "0",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5",
  PERMITEXT_RESEARCH_PRICING_VERSION: "luna-standard-evaluation-20261001",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: ".85", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2", PERMITEXT_RESEARCH_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2"
});
const nativeFetch = globalThis.fetch;
const sourceHashes = {};
for (const name of ["app.mjs", "research-rule-packets.mjs", "research-evidence-assembly.mjs",
  "research-conversation-facts.mjs", "research-targeted-revision.mjs", "evidence-discovery.mjs",
  "research-evidence-priority.mjs", "research-conversation-topic.mjs", "research-corpus-registry.mjs",
  "research-question-intent.mjs", "research-conversation-continuity.mjs", "research-answer-presentation.mjs", "research-answer-quality.mjs",
  "research-zoning-safety.mjs", "project-foundation-contract.mjs",
  "research-technical-topic-routes.mjs", "scripts/research-accuracy-holdout.mjs"]) {
  sourceHashes[name] = createHash("sha256").update(await readFile(new URL(name, root))).digest("hex");
}
const result = { fixturePath, fixtureHash: createHash("sha256").update(fixtureText).digest("hex"), sourceHashes, selectedIDs,
  live, mode: fixedEvidence ? "fixed-evidence-reasoning" : "end-to-end", capUSD: 2, startedAt: new Date().toISOString(), provider: [], cases: [] };
const persist = () => writeFile(join(directory, "results.json"), JSON.stringify(result, null, 2));
globalThis.fetch = async (url, options = {}) => {
  const target = new URL(String(url));
  if (target.hostname === "127.0.0.1") return nativeFetch(url, options);
  assert(live && target.hostname === "api.openai.com" && target.pathname === "/v1/responses", "External access is not allowed for this evaluation");
  const body = JSON.parse(options.body);
  assert.equal(body.model, "gpt-6-luna", "Do not silently change the evaluated model");
  assert(!body.tools?.length && !body.previous_response_id && !body.conversation);
  assert(!body.service_tier || body.service_tier === "default");
  const reserved = ((Buffer.byteLength(options.body) + 8192) * .1 * 2.5 + body.max_output_tokens * .5 * 1.5) / 1e6;
  assert(!result.provider.some(call => call.status === "pending" || call.status === "unknown"), "Reconcile unsettled requests before spending more");
  const spent = result.provider.reduce((sum, call) => sum + (call.costUSD ?? call.reservedUSD), 0);
  if (spent + reserved > result.capUSD) throw Object.assign(Error("Evaluation cap reached"), { code: "RESEARCH_EVAL_SPEND_CAP" });
  const call = { id: randomUUID(), case: result.activeCase, model: body.model, effort: body.reasoning?.effort,
    phase: body.text?.format?.name, status: "pending", reservedUSD: reserved, startedAt: new Date().toISOString() };
  result.provider.push(call); await persist();
  await writeFile(join(directory, `${call.id}-request.json`), JSON.stringify(body));
  const started = performance.now();
  try {
    const response = await nativeFetch(url, options);
    const payload = await response.clone().json();
    await writeFile(join(directory, `${call.id}-response.json`), JSON.stringify(payload));
    call.seconds = (performance.now() - started) / 1000;
    call.usage = payload.usage;
    call.status = payload.usage ? "settled" : response.ok ? "unknown" : "rejected";
    if (payload.usage) {
      const cached = payload.usage.input_tokens_details?.cached_tokens || 0;
      call.costUSD = ((payload.usage.input_tokens - cached) * .1 + cached * .01 + payload.usage.output_tokens * .5) / 1e6;
    }
    await persist(); return response;
  } catch (error) { call.status = "unknown"; call.error = error.code || error.name; await persist(); throw error; }
};
let server;
try {
  const { assembledResearchEvidenceForTurn, handleRequest, researchBodyForCatalogSection,
    openAIResearchInterpretation, openAIResearchVerification } = await import("../app.mjs");
  // Save first-question retrieval separately from answer scoring. The expected
  // references never enter normal retrieval or the user's question.
  for (const conversation of fixture.conversations) {
    const question = conversation.questions[0];
    const packet = await assembledResearchEvidenceForTurn({ question, messages: [], projectFacts: [], pinnedEvidence: [] });
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
    let projectID;
    if (fixture.project) {
      projectID = randomUUID();
      const pushed = await request("/sync/push", { batch: { user: { id: account.appUserID }, mutations: [{ project: {
        ...fixture.project, id: projectID, clientID: projectID, userID: account.appUserID, updatedAt: new Date().toISOString()
      } }] } }, token);
      assert.equal(pushed.status, 200);
      result.projectID = projectID;
    }
    for (const conversation of fixture.conversations) {
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
        if (projectID && response.status === 200) assert.equal(response.body.conversation.primaryProjectID, projectID);
        const item = { id: result.activeCase, question, status: response.status, seconds: (performance.now() - started) / 1000,
          projectID: response.body.conversation?.primaryProjectID, topicContext: response.body.conversation?.topicContext,
          answer: response.body.conversation?.messages.at(-1)?.answer, error: response.body.error, expected: conversation.checks[index] };
        result.cases.push(item); await persist();
        console.log(JSON.stringify({ id: item.id, status: item.status, seconds: item.seconds, mode: item.answer?.mode }));
        if (response.status !== 200) break;
      }
    }
  }
  result.finishedAt = new Date().toISOString(); await persist();
  console.log(`EVIDENCE_DIRECTORY ${directory}`);
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
