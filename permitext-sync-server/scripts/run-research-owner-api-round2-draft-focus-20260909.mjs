// Confirm narrower drafting and retained filing permissions on two unchanged workflow questions once.
// Default intercepts provider dispatch at no cost. --run-live is single-use.
import assert from "node:assert/strict";
import { readFile, writeFile, open, mkdtemp } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { ownerHTTPResearchRequestHash } from "../evals/research-owner-http-request-binding.mjs";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";
import { guidanceQualificationReviewPacket } from "../research-guidance-qualification-review.mjs";
import { guidanceSourceRelationships } from "../research-guidance-source-relationships.mjs";
import { researchClaimScopeInstruction } from "../research-claim-scope.mjs";
import { researchOfficialGuidanceSummaryPromptVersion } from "../research-official-guidance-summary.mjs";

const root = new URL("../", import.meta.url);
const live = process.argv.includes("--run-live");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const terminalFile = "evals/results/research-owner-live-zoning-expansion-2026-09-08.json";
const terminalBytes = await readFile(new URL(terminalFile, root));
const terminal = JSON.parse(terminalBytes);
const previousResultHashes = [...terminal.previousResultHashes, { file: terminalFile, sha256: hash(terminalBytes) }];
assert.equal(previousResultHashes.length, 22);
let previousConservativeSpendUSD = 0;
const attempted = new Set();
for (const entry of previousResultHashes) {
  const bytes = await readFile(new URL(entry.file, root));
  assert.equal(hash(bytes), entry.sha256);
  const run = JSON.parse(bytes);
  assert(["completed", "stopped"].includes(run.status));
  for (const item of run.results) {
    if (item.scope !== "verifier-only" && run.providerCalls.some((call) => call.caseID === item.id)) attempted.add(item.id);
    for (const operation of item.operations || []) {
      assert.equal(operation.pendingProviderRequestCount, 0);
      const zeroCall = operation.providerRequestCount === 0 && !run.providerCalls.some((call) => call.caseID === item.id);
      assert(Number.isFinite(operation.conservativeProviderCostUSD) || (zeroCall && operation.conservativeProviderCostUSD === null));
      previousConservativeSpendUSD += operation.conservativeProviderCostUSD || 0;
    }
  }
}
previousConservativeSpendUSD = Number(previousConservativeSpendUSD.toFixed(6));
assert.equal(previousConservativeSpendUSD, 7.887898);
const firstRoundFile = "evals/results/research-owner-api-round2-live-claim-scope-2026-09-09.json";
const firstRoundBytes = await readFile(new URL(firstRoundFile, root));
const firstRound = JSON.parse(firstRoundBytes);
assert(["completed", "stopped"].includes(firstRound.status));
assert(firstRound.providerCalls.length > 0);
for (const prior of firstRound.priorRoundResults) {
  const bytes = await readFile(new URL(prior.file, root));
  assert.equal(hash(bytes), prior.sha256);
  for (const call of JSON.parse(bytes).providerCalls || []) attempted.add(call.caseID);
}
for (const call of firstRound.providerCalls) attempted.add(call.caseID);
assert.equal(firstRound.spend.pendingRequestCount, 0);
assert(firstRound.results.flatMap((item) => item.operations).every((operation) => operation.pendingProviderRequestCount === 0));
const roundPreviousConservativeUSD = firstRound.cumulativeConservativeSpendUSD;
assert(roundPreviousConservativeUSD > 0 && roundPreviousConservativeUSD < 8.5);
// The preceding harness stopped before its first network dispatch. Its local
// reservation stayed pending because the interceptor threw; retain that record
// separately rather than presenting its reservation as paid provider usage.
const abortedFile = "evals/results/research-owner-api-round2-live-zoning-source-repair-2026-09-09.json";
const abortedBytes = await readFile(new URL(abortedFile, root));
const aborted = JSON.parse(abortedBytes);
assert.equal(aborted.status, "stopped");
assert.equal(aborted.providerCalls.length, 0);
assert.equal(aborted.documentRequests.length, 0);
assert.equal(aborted.results.length, 1);
assert.equal(aborted.results[0].id, "ZR-02");
const abortedPreflight = JSON.parse(await readFile(new URL("evals/results/research-owner-api-round2-zoning-source-repair-preflight-2026-09-09.json", root)));
assert.notEqual(aborted.results[0].initialRequestSHA256, abortedPreflight.results[0].initialRequestSHA256);
const preDispatchAbortEvidence = { file: abortedFile, sha256: hash(abortedBytes), providerCalls: 0,
  providerCostUSD: 0, reason: "Initial request binding guard aborted before recording or sending any provider request; the isolated runtime reservation is not a provider charge." };
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const keyBytes = await readFile(new URL("evals/research-reconciled-answer-key.json", root));
const key = JSON.parse(keyBytes);
// A single-use repair confirmation; all preceding results and costs are retained.
const ownerBytes = await readFile(new URL("evals/research-owner-code-candidates.json", root));
const ownerCases = JSON.parse(ownerBytes).cases;
const repairedCaseIDs = ["DOBNOW-003", "DOBNOW-004"];
const newCaseIDs = [];
const caseIDs = [...repairedCaseIDs, ...newCaseIDs];
assert(repairedCaseIDs.every((id) => attempted.has(id)));
assert(newCaseIDs.every((id) => !attempted.has(id)));
assert.equal(roundPreviousConservativeUSD, 8.008650);
const authorizationAmendmentBytes = await readFile(new URL("evals/research-owner-api-round2-authorization-20260909.json", root));
const authorizationAmendment = JSON.parse(authorizationAmendmentBytes);
assert.equal(authorizationAmendment.roundID, "owner-api-round2-20260908");
assert.equal(authorizationAmendment.previousAuthorizationUSD, 8);
assert.equal(authorizationAmendment.additionalAuthorizationUSD, 0.5);
assert.equal(authorizationAmendment.authorizationUSD, 8.5);
assert.equal(researchOfficialGuidanceSummaryPromptVersion, "20260909-document-summary-v12");
const draftComparisonFile = "evals/results/research-draft-focus-request-comparison-2026-09-09.json";
const draftComparisonBytes = await readFile(new URL(draftComparisonFile, root));
assert.equal(hash(draftComparisonBytes), "eb98b694fb6cd688ffe61bf7055044028286af9760f90f87fdc136e618b6bf61");
const draftComparison = JSON.parse(draftComparisonBytes);
for (const [file, sha256] of Object.entries(draftComparison.sourceHashes)) {
  assert.equal(hash(await readFile(new URL(file, root))), sha256, `Offline comparison drift: ${file}`);
}
assert(draftComparison.results.filter(item => item.phase === "verification").every(item => item.completeRequestUnchanged));
const profile = { promptVersion: "20260909-document-summary-v12", schema: "permitext-owner-api-round2-draft-focus-v1", sourceCommit,
  draftComparisonFile, draftComparisonSHA256: hash(draftComparisonBytes),
  authorization: "The owner authorized continued API testing toward the full Research goal within an $8 allowance, then approved an additional $0.50 to the testing allowance. The prior scoped comparison and amendment remain immutable in the ledger. This single-use continuation uses at most $0.45 of the $0.491350 aggregate remaining allowance; the total round cap stays $8.50. It tests the unchanged DOBNOW-003 and DOBNOW-004 authored questions once each on prompt v12, changing drafting instructions only while preserving the verifier. Two unassigned Research HTTP turns, at most $0.20 for DOBNOW-003 and $0.25 for DOBNOW-004, two provider calls per turn and four total. No paid search, manual retry, separate judge, Project workflow, deployment or price change.",
  preDispatchAbortEvidence, previousResultHashes, historicalConservativeSpendUSD: previousConservativeSpendUSD, previousConservativeSpendUSD: roundPreviousConservativeUSD, authorizationUSD: authorizationAmendment.authorizationUSD, authorizationAmendmentSHA256: hash(authorizationAmendmentBytes),
  priorRoundResults: [...firstRound.priorRoundResults, { file: firstRoundFile, sha256: hash(firstRoundBytes) }],
  ownerDatasetSHA256: hash(ownerBytes), roundID: "owner-api-round2-20260908",
  maximumCumulativeSpendUSD: Math.min(0.45, Number((authorizationAmendment.authorizationUSD - roundPreviousConservativeUSD).toFixed(6))), maximumTurnSpendUSD: 0.25, turnSpendCapsUSD: { "DOBNOW-003": 0.20, "DOBNOW-004": 0.25 }, maximumTurns: 2, maximumProviderRequests: 4, maximumProviderRequestsPerTurn: 2,
  repetitions: 1, separateJudgeRequests: 0, manualRetries: 0,
  keySHA256: hash(keyBytes),
  pricingSource: "https://developers.openai.com/api/docs/pricing", pricingCheckedOn: "2026-09-09",
  routing: "Existing hybrid Luna/Terra routing and production verification/repair policy, subject to the lower evaluation spending cap; standard service tier. No forced model substitution.",
  scope: "Actual unassigned HTTP Research on isolated local accounts and storage. No Project is created or exercised. Each question includes the source packet's explicit DOB NOW workflow context plus its unchanged scenario and question. No answer key, rubric, required-citation hint or professional-review expectation is supplied to drafting or verification. The existing direct official-document route retrieves its declared public NYC sources; paid search is forbidden. Existing generation and verification models are retained. The no-API preflight intercepts every provider dispatch and permits only public NYC document GETs, needed to bind direct-document summary requests for the repaired companion-source paths. Earlier no-context attempts and all 110 numbered cases remain in the cumulative scope; this two-case confirmation does not narrow acceptance. No live filing, saved-project workflow, phone, UI or deployment changes.",
  requestComparison: "Opt-in HTML opaque-identifier normalization preserves every supplied passage, its source identity and schema binding. Runtime hashes and outgoing provider bodies remain unchanged. Raw request fingerprints are also recorded. Actual draft and verifier request bodies are retained with only safety_identifier replaced by isolated-account; their normalized hashes are rechecked before dispatch. Complete verifier source passages must equal the actual initial source packet.",
  repairedCaseIDs, newCaseIDs, cases: caseIDs };
assert(roundPreviousConservativeUSD + profile.maximumCumulativeSpendUSD <= profile.authorizationUSD);
assert(profile.maximumTurnSpendUSD <= profile.maximumCumulativeSpendUSD);
const preflightURL = new URL("evals/results/research-owner-api-round2-draft-focus-preflight-2026-09-09.json", root);
const resultURL = new URL("evals/results/research-owner-api-round2-live-draft-focus-2026-09-09.json", root);
const sourceFiles = ["app.mjs", "research-claim-scope.mjs", "research-answer-presentation.mjs", "research-official-guidance-summary.mjs", "research-guidance-qualification-review.mjs", "research-guidance-source-relationships.mjs", "evals/research-answer-key-amendments.json", "research-answer-quality.mjs", "research-focused-technical-scope.mjs", "research-conversation-topic.mjs", "research-technical-topic-routes.mjs", "evidence-discovery.mjs", "research-conversation-facts.mjs", "research-fact-qualification.mjs", "research-source-policy.mjs", "research-official-html-attribution.mjs", "research-official-pdf-attribution.mjs", "research-official-pdf-ranking.mjs", "research-official-pdf-worker.mjs", "research-dob-workflow-routing.mjs", "evals/research-answer-key-reconciliation.mjs", "research-config.mjs", "research-cost-usage.mjs", "research-provider-client.mjs", "research-zoning-planner.mjs", "research-zoning-temporal-application.mjs", "research-zoning-safety.mjs",
  "research-evidence-assembly.mjs", "research-zoning-context-excerpts.mjs", "research-zoning-metadata.mjs", "research-zoning-conditional-explanation.mjs", "project-foundation-contract.mjs", "research-corpus-registry.mjs", "research-model-routing.mjs", "evals/research-owner-scope-input.mjs",
  "package.json", "package-lock.json", "evals/research-reconciled-answer-key.json", "evals/research-owner-code-candidates.json", "evals/research-owner-code-review.mjs", "evals/research-owner-http-request-binding.mjs", "evals/research-owner-api-round2-authorization-20260909.json", "scripts/report-research-owner-api-round2-20260908.mjs", "scripts/run-research-owner-api-round2-draft-focus-20260909.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, hash(await readFile(new URL(file, root)))])));
let preflight;
if (live) {
  const bytes = await readFile(preflightURL);
  preflight = JSON.parse(bytes);
  assert.equal(preflight.status, "preflight-passed");
  assert.equal(preflight.sourceCommit, sourceCommit);
  assert.deepEqual(preflight.sourceHashes, sourceHashes);
  assert.deepEqual(preflight.previousResultHashes, previousResultHashes);
  assert.deepEqual(preflight.cases, caseIDs);
  assert.equal(preflight.providerCalls.length, 0);
  assert.equal(preflight.results.length, caseIDs.length);
  assert(preflight.results.every((item) => item.status === "preflight-blocked" || (item.status === "preflight-intercepted" && item.initialRequestSHA256 && item.initialMaximumUSD <= profile.turnSpendCapsUSD[item.id])));
  assert(preflight.results.every((item) => item.status === "preflight-intercepted"), "Both unchanged authored workflow questions must pass the no-API HTTP preflight before live dispatch.");
  assert.equal(execFileSync("git", ["diff", "HEAD", "--", "*.mjs", "*.json"], { cwd: root, encoding: "utf8" }), "");
  profile.preflightSHA256 = hash(bytes);
  const lock = await open(resultURL, "wx", 0o600);
  await lock.close();
}
const scratch = await mkdtemp(join(tmpdir(), live ? "permitext-api-round2-live-" : "permitext-api-round2-preflight-"));
let apiKey = "offline-provider-intercept";
if (live) {
  const local = parseEnv(await readFile(new URL(".env.local", root), "utf8"));
  assert(local.OPENAI_API_KEY && local.OPENAI_API_KEY !== "[SENSITIVE]");
  apiKey = local.OPENAI_API_KEY;
}
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  OPENAI_API_KEY: apiKey, NODE_ENV: "", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: live ? "1" : "0", PERMITEXT_RESEARCH_EVAL_MAX_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: String(profile.maximumTurnSpendUSD),
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: String(profile.maximumCumulativeSpendUSD),
  PERMITEXT_RESEARCH_DAILY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_MONTHLY_CAP_USD: String(profile.maximumCumulativeSpendUSD), PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: String(profile.maximumTurns),
  PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid", PERMITEXT_RESEARCH_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-20260908-terra",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-20260908-luna"
});
const result = { ...profile, sourceHashes, startedAt: new Date().toISOString(), status: "running", results: [], providerCalls: [], documentRequests: [] };
const persist = () => live ? writeFile(resultURL, JSON.stringify(result, null, 2) + "\n") : Promise.resolve();
await persist();
const nativeFetch = globalThis.fetch;
let active, initialBody;
const requestHash = (body) => ownerHTTPResearchRequestHash(body, { normalizeOfficialHTML: true });
const stop = (message) => Object.assign(new Error(message), { code: "RESEARCH_EVAL_SPEND_CAP" });
const config = await import("../research-config.mjs");
if (live) config.validatePaidResearchEvaluationEnvironment();
assert.equal(config.researchSpendGuardrails().ready, true);
globalThis.fetch = async (url, options) => {
  if (String(url) !== "https://api.openai.com/v1/responses") {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !(parsed.hostname === "nyc.gov" || parsed.hostname.endsWith(".nyc.gov")) || options?.method !== "GET") {
      throw stop("This package permits only public NYC document GET requests; provider calls are intercepted during preflight.");
    }
    const documentRequest = { caseID: active?.id, preflight: !live, url: String(url), startedAt: new Date().toISOString() };
    result.documentRequests.push(documentRequest);
    const started = performance.now();
    try {
      const response = await nativeFetch(url, options);
      Object.assign(documentRequest, { httpStatus: response.status, contentType: response.headers.get("content-type"), finalURL: response.url });
      return response;
    } catch (error) { documentRequest.errorCode = error.code || error.name; throw error; }
    finally { documentRequest.durationMilliseconds = Math.round(performance.now() - started); await persist(); }
  }
  const body = JSON.parse(options.body);
  if (active?.authoredProjectFacts?.length && body.text?.format?.name === "permitext_code_interpretation") {
    assert(active.authoredProjectFacts.every((fact) => String(body.input).includes(fact)), "Authored facts must reach the actual draft request.");
  }
  if (!active || body.tools?.length || body.service_tier !== "default") throw stop("Unexpected provider request shape.");
  const phase = body.tools?.length ? "web_support" : body.text?.format?.name;
  if (!active.initialRequestSHA256) {
    assert.equal(phase, "permitext_official_guidance_summary");
    assert(caseIDs.includes(active.id));
    const workflow = researchDOBWorkflowRoute(active.question);
    assert.equal(workflow?.directDocumentRetrieval, true, "The repaired direct official-document route must be active.");
    if (workflow?.directDocumentRetrieval) {
      assert.equal(phase, "permitext_official_guidance_summary", "A direct companion route must retrieve its catalog before drafting.");
      const input = JSON.parse(body.input);
      const urls = new Set(input.passages.map((passage) => passage.url.split("#")[0]));
      assert(workflow.sources.every((source) => urls.has(source.url)), "Every declared companion source must reach the initial summary.");
      const text = input.passages.map((passage) => passage.text).join(" ").replace(/\s+/g, " ");
      assert.deepEqual(input.sourceRelationships, guidanceSourceRelationships(input));
      assert.equal(input.sourceRelationships.length, active.id === "DOBNOW-004" ? 1 : 2, "All fetched source relationships must reach drafting.");
      assert.match(body.instructions, /Resolve each material relationship/);
      assert.match(body.instructions, /A negative permission answer or a statement of necessary conditions does not assert/);
      assert.match(body.instructions, /80 to 160 words/);
      assert(body.instructions.includes(researchClaimScopeInstruction));
      if (active.id === "DOBNOW-004") {
        assert.equal(input.sourceRelationships[0].kind, "field_editability");
        assert.equal(input.sourceRelationships[0].field, "Work on Floors");
        assert.match(text, /Work on floors can be changed with a PAA/);
        assert.match(text, /fields are NOT editable.*Work on Floors/);
        assert(input.sourceRelationships[0].relatedEvidence.some((evidence) => evidence.sourceID === "dob-paa-faq"));
        assert.match(text, /same Applicant of Record as the original filing/);
        assert.match(text, /Only one PAA can be in progress at a time/);
        assert.match(text, /PAA cannot be submitted if the filing includes legalization/);
      } else {
        assert.equal(active.id, "DOBNOW-003");
        assert.equal(input.sourceRelationships[0].kind, "creation_and_submission_timing");
        assert.equal(input.sourceRelationships[1].kind, "filing_completion_scope");
        assert(input.sourceRelationships[1].relatedEvidence.some((evidence) => evidence.sourceID === "dob-nb-altco-faq"));
        assert(input.passages.some((passage) => /subsequent filing of an NB or Alteration-CO filing.*remain Permit Entire/s.test(passage.text)),
          "The primary passage must retain the FAQ question that scopes the completion exception.");
        assert.match(text, /subsequent filing in pre-filing status/);
      }
      assert.equal(input.question.replace(/\s+/g, " ").trim(), active.question.replace(/\s+/g, " ").trim());
    }
    active.initialSourceStatistics = Object.entries(Object.groupBy(JSON.parse(body.input).passages, (passage) => passage.sourceID)).map(([sourceID, passages]) => ({sourceID, passages: passages.length, characters: passages.reduce((sum, passage) => sum + passage.text.length, 0)}));
    active.initialPhase = phase;
    active.initialRequestSHA256 = requestHash(body);
    active.initialRawRequestSHA256 = hash(options.body);
    initialBody = structuredClone(body);
    active.initialModel = body.model;
    active.initialRequestBytes = Buffer.byteLength(options.body);
    if (live && active.initialRequestSHA256 !== preflight.results.find((item) => item.id === active.id).initialRequestSHA256) {
      result.preDispatchAbort = "Outgoing initial request differs from the actual HTTP preflight.";
    }
  }
  if (result.preDispatchAbort) {
    // An explicit local no-dispatch response settles the synthetic reservation
    // at zero. No transport ran and no provider usage is being fabricated.
    active.localInterceptCount = (active.localInterceptCount || 0) + 1;
    assert(active.localInterceptCount <= profile.maximumProviderRequestsPerTurn);
    await persist();
    return Response.json({ error: { code: "local_preflight_mismatch", message: result.preDispatchAbort }, usage: { input_tokens: 0, output_tokens: 0 } }, { status: 400 });
  }
  if (!live) {
    active.interceptCount = (active.interceptCount || 0) + 1;
    assert(active.interceptCount <= profile.maximumProviderRequestsPerTurn, "Offline fallback intercept ceiling reached.");
    // Zero-usage terminal double stops this no-cost request. It is not an answer.
    return Response.json({ error: { code: "offline_preflight", message: "Provider dispatch intercepted." }, usage: { input_tokens: 0, output_tokens: 0 } }, { status: 400 });
  }
  if (result.providerCalls.length >= profile.maximumProviderRequests || result.providerCalls.filter((call) => call.caseID === active.id).length >= profile.maximumProviderRequestsPerTurn) throw stop("Package provider-call ceiling reached.");
  const earlier = result.providerCalls.filter((call) => call.caseID === active.id);
  assert.equal(phase, earlier.length ? "permitext_official_guidance_verification" : "permitext_official_guidance_summary");
  if (earlier.length) {
    const input = JSON.parse(body.input);
    assert.deepEqual(input.passages, JSON.parse(initialBody.input).passages, "The verifier must receive the full original source packet, including uncited conditions.");
    assert.deepEqual(input.sourceRelationships, JSON.parse(initialBody.input).sourceRelationships);
    assert.deepEqual(input.sourceRelationships, guidanceSourceRelationships(input));
    assert.match(body.instructions, /Resolve each material relationship/);
    assert(body.instructions.includes(researchClaimScopeInstruction));
    assert.deepEqual(input.qualificationReviewPacket, guidanceQualificationReviewPacket(input));
    assert(body.text.format.schema.required.includes("qualificationReview"));
    assert.equal(input.qualificationReviewPacket.version, "20260909-guidance-qualifications-v2");
    assert(body.text.format.schema.properties.qualificationReview.properties.passages.items.required.includes("conditionSpanIDs"));
    assert(input.qualificationReviewPacket.passages.every((passage) => passage.spans.map((span) => span.text).join("") === input.passages[passage.passageIndex].text));
  }
  const retainedRequestBody = { ...body, safety_identifier: "isolated-account" };
  assert.equal(requestHash(retainedRequestBody), requestHash(body));
  const entry = { caseID: active.id, phase, model: body.model, requestBytes: Buffer.byteLength(options.body), maxOutputTokens: body.max_output_tokens,
    retainedRequestBody, retainedRequestSHA256: hash(JSON.stringify(retainedRequestBody)),
    requestSHA256: requestHash(body), rawRequestSHA256: hash(options.body), startedAt: new Date().toISOString() };
  result.providerCalls.push(entry);
  await persist();
  const start = performance.now();
  try {
    const response = await nativeFetch(url, options);
    entry.responseHeadersMilliseconds = Math.round(performance.now() - start);
    const bodyStarted = performance.now();
    // These transport timings precede the provider-client wrapper. The wrapper
    // receives the response after this retained-output clone has been read.
    const payload = await response.clone().json();
    entry.responseBodyReadMilliseconds = Math.round(performance.now() - bodyStarted);
    Object.assign(entry, { httpStatus: response.status, usage: payload.usage || null, serviceTier: payload.service_tier,
      output: payload.output?.filter((item) => ["message", "web_search_call"].includes(item.type)), incompleteDetails: payload.incomplete_details, errorCode: payload.error?.code });
    return response;
  } catch (error) { entry.errorCode = error.code || error.name; throw error; }
  finally { entry.durationMilliseconds = Math.round(performance.now() - start); await persist(); }
};
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const adapter = createFileStoreAdapter();
const { ownerResearchScopeInput, ownerResearchHTTPSelections } = await import("../evals/research-owner-scope-input.mjs");
const { zoningSectionSummary } = await import("../zoning-content.mjs");
const server = createServer(handleRequest);
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const request = async (path, body, token) => {
  const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
};
try {
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Isolated owner draft focus confirmation" } });
  assert.equal(signed.status, 200);
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  const granted = await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  assert.equal(granted.status, 200);
  const seen = new Set();
  for (const id of caseIDs) {
    const maximumTurnSpendUSD = profile.turnSpendCapsUSD[id];
    assert(maximumTurnSpendUSD > 0 && maximumTurnSpendUSD <= profile.maximumTurnSpendUSD);
    process.env.PERMITEXT_RESEARCH_MAX_REQUEST_USD = String(maximumTurnSpendUSD);
    const preflightCase = preflight?.results.find((item) => item.id === id);
    if (live && preflightCase.status === "preflight-blocked") {
      result.results.push({ id, status: "not-dispatched", reason: "Unresolved offline input or source requirement",
        inputSHA256: preflightCase.inputSHA256, failureStage: preflightCase.failureStage,
        error: preflightCase.error, operations: [] });
      await persist();
      continue;
    }
    const settledBatchUSD = result.results.flatMap((item) => item.operations || []).reduce((sum, operation) => sum + (operation.conservativeProviderCostUSD || 0), 0);
    if (live && profile.maximumCumulativeSpendUSD - settledBatchUSD < maximumTurnSpendUSD) throw stop("Remaining conservative batch allowance cannot reserve another complete turn.");
    const original = key.cases.find((item) => item.id === id);
    const input = await ownerResearchScopeInput(original || ownerCases.find((item) => item.id === id), { original: !!original, zoningSummary: zoningSectionSummary });
    assert.equal(input.projectFacts.length, 0);
    assert.equal(input.pinnedEvidence.length, 0);
    assert.equal(input.question, `Context: DOB NOW workflow\n\n${original.scenario}\n\n${original.question}`);
    const selections = ownerResearchHTTPSelections(input);
    initialBody = null;
    active = { id, question: input.question, inputSHA256: hash(JSON.stringify(input)), requestedCodeVersion: input.projectCodeVersion,
      readerSelectionsSHA256: hash(JSON.stringify(selections)), authoredProjectFacts: input.projectFacts,
      authoredQuestionContext: original?.questionContext || null,
      selectionCharacterCounts: selections.map((selection) => ({ sectionID: selection.sectionID, characters: selection.selectedText.length })),
      status: "running", maximumTurnSpendUSD };
    result.results.push(active);
    await persist();
    console.log(`${live ? "Live" : "Offline preflight"}: ${id}`);
    const created = await request("/research/conversations/create", { auth, ...(selections.length ? { selections, originSurface: "reader" } : {}) }, token);
    if (created.status !== 201) {
      assert(!live, "A preflighted selection cannot newly fail creation during the paid package.");
      active.status = "preflight-blocked";
      active.failureStage = "authored_selection_creation";
      active.httpStatus = created.status;
      active.error = created.body;
      active.operations = [];
      continue;
    }
    if (input.projectFacts.length) {
      const conversation = (await adapter.listResearchConversations(account.appUserID)).find((item) => item.id === created.body.conversation.id);
      assert(conversation && !conversation.primaryProjectID);
      await adapter.saveResearchConversation(account.appUserID, { ...conversation,
        projectContext: { facts: [...input.projectFacts], source: "user-provided", updatedAt: new Date().toISOString() }
      }, conversation.revision);
      const saved = (await adapter.listResearchConversations(account.appUserID)).find((item) => item.id === conversation.id);
      assert.deepEqual(saved.projectContext.facts, input.projectFacts);
      assert.equal(saved.primaryProjectID, null);
    }
    const started = performance.now();
    const response = await request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question: input.question, requestID: randomUUID() }, token);
    active.durationMilliseconds = Math.round(performance.now() - started);
    active.httpStatus = response.status;
    if (initialBody) {
      // Outside the completed HTTP handler, independently size its captured
      // initial request using the production reservation calculation.
      config.beginResearchSpendReservation({ id: `offline-size-${id}` });
      try { active.initialMaximumUSD = config.reserveResearchProviderSpend(initialBody).maximumRequestUSD; }
      finally { config.endResearchSpendReservation(); }
      const captureIndex = process.argv.indexOf("--capture-prefix");
      if (!live && captureIndex !== -1) {
        assert(process.argv[captureIndex + 1]);
        await writeFile(`${process.argv[captureIndex + 1]}-${id}.json`, JSON.stringify({ ...initialBody, safety_identifier: "isolated-account" }, null, 2), { flag: "wx" });
      }
    }
    const telemetry = await request("/internal/evaluations/data", { auth }, token);
    assert.equal(telemetry.status, 200);
    active.operations = telemetry.body.researchSpend.operationMetrics.filter((operation) => !seen.has(operation.id));
    active.operations.forEach((operation) => seen.add(operation.id));
    assert.equal(active.operations.length, 1);
    if (!live) {
      if (!active.interceptCount || /SPEND_CAP/.test(response.body.code || "")) {
        assert.equal(active.operations[0].pendingProviderRequestCount, 0);
        active.status = "preflight-blocked";
        active.failureStage = "before_provider_dispatch";
        active.error = response.body;
        continue;
      }
      assert(active.interceptCount >= 1 && active.interceptCount <= profile.maximumProviderRequestsPerTurn, JSON.stringify(response.body));
      assert.equal(active.operations[0].pendingProviderRequestCount, 0);
      assert.equal(active.operations[0].actualProviderCostUSD, 0);
      assert(active.initialMaximumUSD <= maximumTurnSpendUSD);
      assert(response.status >= 400);
      active.status = "preflight-intercepted";
      continue;
    }
    active.answer = response.body.conversation?.messages.findLast((message) => message.role === "assistant")?.answer;
    active.status = response.status === 200 && active.answer ? "completed" : "failed";
    if (active.status === "failed") active.error = response.body;
    assert(active.operations.every((operation) => Number.isFinite(operation.conservativeProviderCostUSD) && operation.conservativeProviderCostUSD <= maximumTurnSpendUSD + 1e-6));
    result.cumulativeConservativeSpendUSD = Number((roundPreviousConservativeUSD + result.results.flatMap((item) => item.operations || []).reduce((sum, operation) => sum + operation.conservativeProviderCostUSD, 0)).toFixed(6));
    assert(result.cumulativeConservativeSpendUSD <= roundPreviousConservativeUSD + profile.maximumCumulativeSpendUSD);
    assert(result.cumulativeConservativeSpendUSD <= profile.authorizationUSD);
    result.spend = config.researchEvaluationSpendStatus();
    await persist();
    assert(active.operations.every((operation) => operation.pendingProviderRequestCount === 0), "Stop on unsettled accounting.");
    if (result.preDispatchAbort) throw stop(result.preDispatchAbort);
    if (result.providerCalls.some((call) => call.errorCode === "insufficient_quota" || call.httpStatus === 401) || /SPEND_CAP/.test(JSON.stringify(active.error || {}))) throw new Error(`${id} hit provider or spending limits; remaining cases skipped.`);
    console.log(JSON.stringify({ id, status: active.status, durationMilliseconds: active.durationMilliseconds, conservativeUSD: result.cumulativeConservativeSpendUSD, usageEstimateUSD: result.spend.actualUSD }));
  }
  result.status = live ? "completed" : result.results.every((item) => item.status === "preflight-intercepted") ? "preflight-passed" : "preflight-blocked";
} catch (error) { result.status = "stopped"; result.stopReason = error.message; }
finally {
  result.completedAt = new Date().toISOString();
  result.spend = config.researchEvaluationSpendStatus();
  await persist();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = nativeFetch;
}
if (!live) {
  assert(["preflight-passed", "preflight-blocked"].includes(result.status), result.stopReason);
  const index = process.argv.indexOf("--output");
  await writeFile(index === -1 ? preflightURL : process.argv[index + 1], JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ status: result.status, cases: result.results.map(({ id, status, initialMaximumUSD }) => ({ id, status, initialMaximumUSD })), providerCalls: result.providerCalls.length, spend: result.spend, stopReason: result.stopReason }));
