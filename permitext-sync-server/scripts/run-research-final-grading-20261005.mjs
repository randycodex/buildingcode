// One separately prompted Luna grading pass. Never retries the application,
// changes its answers, tunes a rubric after results, or supplies a target score.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluationBudget } from "./research-evaluation-budget.mjs";
import { validationPricing, validationReservation, validationCost } from "./research-validation-pricing-20261005.mjs";
import { researchProviderReadiness } from "./research-provider-readiness-20261005.mjs";
import { researchSourceBodyState } from "../research-source-body-state.mjs";
import { assertFrozenAcceptanceInputs, buildAcceptanceGradeRequest,
  validateAcceptanceGrade, acceptanceGradeSummary } from "./research-acceptance-grading-20261005.mjs";

const root = new URL("../", import.meta.url);
const packetRoot = new URL("evals/retrieval-validation-2026-10-05/", root);
const hash = value => createHash("sha256").update(value).digest("hex");
const live = process.argv.includes("--live");
const options = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const name = process.argv[i]; if (name === "--live") continue;
  assert(["--results", "--output", "--budget-ledger"].includes(name));
  const value = process.argv[++i]; assert(value && !value.startsWith("--")); options.set(name, value);
}
assert(options.get("--results") && options.get("--output"));
const fixtureText = await readFile(new URL("final-check-fixture.json", packetRoot), "utf8");
const sourcePacketText = await readFile(new URL("final-check-sources.json", packetRoot), "utf8");
const manifest = JSON.parse(await readFile(new URL("final-check-manifest.json", packetRoot)));
const resultText = await readFile(options.get("--results"), "utf8"), application = JSON.parse(resultText);
const { fixture, sources, cases } = assertFrozenAcceptanceInputs({ fixtureText, sourcePacketText, manifest, result: application });
for (const [file, expected] of Object.entries(manifest.codeHashes))
  assert.equal(hash(await readFile(new URL(file, root))), expected, `Candidate changed after freeze: ${file}`);
assert.equal(hash(await readFile(new URL("scripts/research-acceptance-grading-20261005.mjs", root))), manifest.gradingCodeSHA256);
const apiKey = process.env.OPENAI_API_KEY, nativeFetch = globalThis.fetch;
const scratch = await mkdtemp(join(tmpdir(), "permitext-final-grade-"));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_RESEARCH_SEMANTIC_SEARCH: "0",
  PERMITEXT_RESEARCH_PASSAGE_SEARCH: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "0" });
globalThis.fetch = async () => { throw Error("No network during canonical grading preparation"); };
try {
  const { researchCorpusPlanForTurn, researchCorpusResources, researchBodyForCatalogSection } = await import("../app.mjs");
  const catalogs = new Map();
  const fields = ["codePrefix", "sectionNumber", "corpusID", "codeVersion", "codeEdition"];
  for (const citation of cases.flatMap(item => item.answer?.citations || [])) {
    const reference = `${citation.codePrefix} ${citation.sectionNumber}`;
    let snapshot = sources.find(source => source.reference === reference);
    if (snapshot) {
      assert.equal(snapshot.sectionID, citation.sectionID);
      for (const field of fields) assert.equal(snapshot[field], citation[field], `${reference}: citation authority identity`);
      continue;
    }
    if (!catalogs.has(citation.codePrefix)) {
      const family = citation.codePrefix === "FC" ? "Fire Code" : citation.codePrefix === "ZR" ? "Zoning Resolution" : "Construction Codes";
      const plan = await researchCorpusPlanForTurn({ question: `Explain current NYC ${family} ${reference}.` });
      catalogs.set(citation.codePrefix, (await researchCorpusResources(plan)).catalog);
    }
    const matches = catalogs.get(citation.codePrefix).filter(source => String(source.id) === citation.sectionID &&
      fields.every(field => source[field] === citation[field]));
    assert.equal(matches.length, 1, `${reference}: unique exact canonical citation required`);
    const section = matches[0], body = await researchBodyForCatalogSection(section);
    const text = (body.blocks || []).map(block => String(block.plainText || "")).filter(Boolean).join("\n\n");
    snapshot = { reference, sectionID: String(section.id), ...Object.fromEntries([...fields, "jurisdiction"].map(field => [field, section[field]])),
      title: section.title, titleIsMetadata: true, text, textSHA256: hash(text) };
    const state = researchSourceBodyState(section, body); if (state) snapshot.sourceBodyState = state;
    sources.push(snapshot);
  }
  const requests = fixture.conversations.map(conversation => ({ id: conversation.id,
    body: buildAcceptanceGradeRequest(conversation, cases, sources) }));
  const directory = options.get("--output"); await mkdir(directory);
  await writeFile(join(directory, "sources.json"), JSON.stringify({ status: "complete_exact_canonical_grading_snapshots", sources }, null, 2));
  await writeFile(join(directory, "input-manifest.json"), JSON.stringify({ applicationResultSHA256: hash(resultText),
    fixtureSHA256: manifest.fixtureSHA256, frozenSourcesSHA256: manifest.sourcePacketSHA256,
    gradingSourcesSHA256: hash(JSON.stringify(sources)), scriptSHA256: hash(await readFile(new URL(import.meta.url))),
    requests: requests.map(({ id, body }) => ({ id, requestSHA256: hash(JSON.stringify(body)) })),
    model: "gpt-6-luna", effort: "medium", externalExpertApproval: false,
    applicationReruns: 0, sourceCharacterCeiling: 48000, maximumGradingCostUSD: .50 }, null, 2));
  globalThis.fetch = nativeFetch;
  if (!live) {
    console.log(JSON.stringify({ status: "offline_grading_preflight_passed", requests: requests.length, providerCalls: 0 }));
  } else {
    assert(options.get("--budget-ledger") && apiKey);
    const budget = evaluationBudget(options.get("--budget-ledger"), 10.99, validationPricing);
    const readiness = await researchProviderReadiness({ apiKey });
    await writeFile(join(directory, "readiness.json"), JSON.stringify(readiness, null, 2)); assert(readiness.ready);
    const grades = { startedAt: new Date().toISOString(), method: "separate_Luna_model_grading",
      applicationReruns: 0, externalExpertApproval: false, provider: [], rows: [], rejectedEnvelopes: [] };
    const persist = () => writeFile(join(directory, "results.json"), JSON.stringify(grades, null, 2));
    await persist();
    const spent = calls => calls.reduce((sum, call) => sum + (call.costUSD ?? call.reservedUSD), 0);
    for (const { id, body } of requests) {
      const reservedUSD = validationReservation(body), snapshot = budget.snapshot();
      assert(spent(snapshot.calls.filter(call => call.phaseBucket === "fresh")) + reservedUSD <= 8);
      assert(spent(grades.provider) + reservedUSD <= .50);
      const call = { id: randomUUID(), case: id, model: "gpt-6-luna", effort: "medium", providerAPI: "responses",
        phaseBucket: "fresh", phase: "separate_final_acceptance_grade", status: "pending", reservedUSD,
        startedAt: new Date().toISOString(), runDirectory: directory };
      budget.reserve(call); grades.provider.push(call); await persist();
      await writeFile(join(directory, `${call.id}-request.json`), JSON.stringify(body));
      let payload;
      try {
        const response = await nativeFetch("https://api.openai.com/v1/responses", { method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
        payload = await response.json();
        if (payload.error?.code === "invalid_api_key") payload.error.message = "Authentication rejected (credential-bearing message removed)";
        await writeFile(join(directory, `${call.id}-response.json`), JSON.stringify(payload));
        const settled = { httpStatus: response.status, status: payload.usage ? "settled" : response.ok ? "unknown" : "rejected",
          usage: payload.usage, endedAt: new Date().toISOString() };
        if (payload.usage) {
          assert(/^gpt-6-luna(?:-|$)/.test(payload.model)); settled.costUSD = validationCost(payload);
        } else if (response.status === 401 && payload.error?.code === "invalid_api_key") settled.costUSD = 0;
        budget.settle(call.id, settled); Object.assign(call, settled); await persist();
        assert(response.ok && call.status === "settled", "Stop after rejected or unreconciled provider response");
      } catch (error) {
        if (call.status === "pending") {
          call.status = "unknown"; budget.settle(call.id, { status: "unknown", errorName: error.name }); await persist();
        }
        throw error;
      }
      try {
        assert.equal(payload.status, "completed");
        const text = payload.output.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join("");
        const rows = validateAcceptanceGrade(body, JSON.parse(text));
        grades.rows.push(...rows);
        console.log(JSON.stringify({ conversation: id, gradedTurns: rows.length, correct: rows.filter(row => row.fullyCorrect).length }));
      } catch (error) {
        grades.rejectedEnvelopes.push({ conversationID: id, callID: call.id, error: error.message, paidRetry: false });
        console.log(JSON.stringify({ conversation: id, gradeEnvelope: "rejected", paidRetry: false }));
      }
      await persist();
    }
    grades.finishedAt = new Date().toISOString();
    grades.summary = grades.rows.length === 40 ? acceptanceGradeSummary(grades.rows)
      : { status: "grading_incomplete", gradedTurns: grades.rows.length, total: 40, general95PercentEstablished: false };
    grades.estimatedCostUSD = spent(grades.provider); await persist();
    console.log(JSON.stringify({ status: "complete", ...grades.summary, estimatedCostUSD: grades.estimatedCostUSD }));
  }
} finally { globalThis.fetch = nativeFetch; await rm(scratch, { recursive: true, force: true }); }
