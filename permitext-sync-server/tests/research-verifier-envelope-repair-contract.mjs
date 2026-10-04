import { buildResearchClaimApplicabilityPacket } from "../research-claim-applicability-review.mjs";
import { syntheticApplicabilityReview } from "./research-applicability-response-double.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { openAIResearchVerification } from "../app.mjs";
import { beginResearchSpendReservation, endResearchSpendReservation,
  reserveResearchProviderSpend, settleResearchProviderSpend } from "../research-config.mjs";
import { researchVerificationFailureReason } from "../research-conversation-continuity.mjs";
import { planZoningMappedScopeReview } from "../research-zoning-mapped-review.mjs";
import { zoningConditionalExplanationVersion } from "../research-zoning-conditional-explanation.mjs";
import { researchRequestEnvelopeEnvironment } from "./research-request-envelope-preflight.mjs";

Object.assign(process.env, researchRequestEnvelopeEnvironment, { OPENAI_API_KEY: "offline-verifier-envelope-double" });
delete process.env.PERMITEXT_RESEARCH_EVAL_MAX_USD;
const evidence = [{ sourceID: "source-a", sectionID: "42", codePrefix: "ZR", sectionNumber: "1-1",
  codeVersion: "snapshot-A", text: "Supplied source A.", evidencePriority: { evidenceRole: "supporting" } }];
const answer = { answerText: "A property determination cannot be made from the supplied facts.",
  conclusion: "A property determination cannot be made from the supplied facts.",
  supportedPoints: [{ heading: "Generic rule", explanation: "The source describes conditional rules.", sourceIDs: ["source-a"] }],
  citations: [{ sourceIDs: ["source-a"] }], missingFacts: ["Address and mapped district"] };
const validPass = { pass: true, issues: [], unnecessaryMissingFactIndices: [], missingFactsOnly: false,
  projectFactQuestions: [], priorReviewCorrection: "" };
const validFail = { ...validPass, pass: false, issues: [{ type: "incorrect_citation", detail: "The bound source does not support the claim." }] };
const badPass = { ...validFail, pass: true };
let replies = [];
let requests = [];
let currentSignal;
let duringFirstRequest;
let afterEnvelopeEvent;
const events = [];
let selectedTimeouts = [];
const oldTimeout = AbortSignal.timeout;
AbortSignal.timeout = milliseconds => { selectedTimeouts.push(milliseconds); return oldTimeout(milliseconds); };
const oldWarn = console.warn;
const oldLog = console.log;
const oldInfo = console.info;
console.warn = (...values) => {
  const line = values.join(" ");
  events.push(line);
  if (line.includes('"event":"research_verification_envelope_repair"') && afterEnvelopeEvent) afterEnvelopeEvent();
};
console.log = (...values) => events.push(values.join(" "));
console.info = (...values) => events.push(values.join(" "));
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "No application, browser or paid provider access.");
  const body = JSON.parse(options.body);
  requests.push(body);
  if (currentSignal) assert(options.signal, "The existing guarded provider cancellation signal is retained.");
  if (requests.length === 1 && duringFirstRequest) duringFirstRequest();
  const originalReply = replies.shift();
  const reply = originalReply && { ...originalReply, value: originalReply.value && typeof originalReply.value === "object"
    ? { ...originalReply.value, claimApplicabilityReview: syntheticApplicabilityReview(body) } : originalReply.value };
  assert.notEqual(reply, undefined, "No extra provider request is authorized by this contract.");
  return Response.json({ model: body.model, status: reply.status || "completed",
    ...(reply.incomplete_details ? { incomplete_details: reply.incomplete_details } : {}),
    usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30,
      ...(Object.hasOwn(reply, "reasoningTokens") ? { output_tokens_details: { reasoning_tokens: reply.reasoningTokens } } : {}) },
    output: [{ type: "message", content: reply.refusal ? [{ type: "refusal", refusal: "Declined." }]
      : [{ type: "output_text", text: reply.raw ?? JSON.stringify(reply.value) }] }] });
};
const setup = (values, mutation) => { replies = values; requests = []; selectedTimeouts = []; duringFirstRequest = mutation; currentSignal = null; afterEnvelopeEvent = null; };
const run = async (options = {}, suppliedEvidence = evidence, suppliedAnswer = answer) =>
  openAIResearchVerification("Synthetic source-scope question.", suppliedEvidence, suppliedAnswer, "offline-user",
    { model: "gpt-5.6-luna", ...options });
let caseNumber = 0;
async function reservationTest(callback, environment = process.env) {
  beginResearchSpendReservation({ id: `offline-envelope-${++caseNumber}` }, environment);
  try { return await callback(); }
  finally {
    const accounting = endResearchSpendReservation();
    assert.equal(accounting.pendingProviderReservationCount, 0, "All known synthetic provider usage is settled.");
  }
}

try {
  // Exact budget selection runs through the real request/reservation/parser.
  for (const [effort, boundAnswer, expectedEffort, expectedCap, expectedTimeout, expectedProfile] of [
    ["medium", answer, "low", 12_000, 90_000, "claim_applicability"],
    ["low", answer, "low", 12_000, 90_000, "claim_applicability"],
    ["medium", { answerText: "A source-free explanation." }, "medium", 8_000, 90_000, "ordinary"],
    ["low", { answerText: "A source-free explanation." }, "low", 4_000, 45_000, "ordinary"]]) {
    process.env.PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT = effort;
    setup([{ value: validPass }]);
    await reservationTest(async () => {
      const result = await run({}, evidence, boundAnswer);
      assert.equal(result.result.pass, true);
      assert.equal(result.reasoningEffort, expectedEffort, "Routing/result telemetry reports the actual dispatched effort");
      assert.equal(requests.length, 1);
      assert.equal(requests[0].max_output_tokens, expectedCap);
      assert.equal(requests[0].reasoning.effort, expectedEffort);
      assert.equal(requests[0].model, "gpt-5.6-luna");
      assert.deepEqual(selectedTimeouts, [expectedTimeout]);
      const profile = events.map(line => JSON.parse(line)).filter(event => event.event === "research_verification_profile").at(-1);
      assert.deepEqual(profile, { event: "research_verification_profile", profile: expectedProfile,
        reasoningEffort: expectedEffort, maximumOutputTokens: expectedCap, timeoutMilliseconds: expectedTimeout,
        unitCount: result.result.claimApplicabilityReview.unitCount, edgeCount: result.result.claimApplicabilityReview.edgeCount,
        bindingCount: result.result.claimApplicabilityReview.bindingCount });
      assert(!JSON.stringify(profile).includes("Synthetic"), "Profile telemetry contains no question, source or fact prose");
    });
  }
  process.env.PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT = "medium";
  const actualBuilder = (await import("./research-request-envelope-preflight.mjs")).buildResearchRequestEnvelopeBuilders;
  const { buildVerifierRequest } = await actualBuilder();
  const serializedRequest = buildVerifierRequest("Synthetic source-scope question.", evidence, answer, "offline-user", { model: "gpt-5.6-luna" });
  assert.equal(serializedRequest.max_output_tokens, 12_000);
  assert.equal(serializedRequest.reasoning.effort, "low");
  assert(serializedRequest.text.format.schema.required.includes("claimApplicabilityReview"));
  assert.match(serializedRequest.instructions, /Do not emit binding\/unit aggregate states/);
  await reservationTest(async () => {
    const reserved = reserveResearchProviderSpend(serializedRequest);
    const bytes = Buffer.byteLength(JSON.stringify(serializedRequest), "utf8") + 1_024;
    // Versioned offline Fast-model rates, including existing conservative
    // cache-write/long-context ceilings. The final cap/schema/input are bound.
    const expectedBound = Math.ceil((bytes * .2 * 2.5 + 12_000 * 1.2 * 1.5)) / 1_000_000;
    assert.equal(reserved.maximumRequestUSD, expectedBound);
    settleResearchProviderSpend(reserved, { usage: { input_tokens: 0, output_tokens: 0 } });
    const lower = reserveResearchProviderSpend({ ...serializedRequest, max_output_tokens: 8_000 });
    assert(lower.maximumRequestUSD < reserved.maximumRequestUSD);
    settleResearchProviderSpend(lower, { usage: { input_tokens: 0, output_tokens: 0 } });
    const enlarged = reserveResearchProviderSpend({ ...serializedRequest, input: serializedRequest.input + "Extra synthetic frame.".repeat(100) });
    assert(enlarged.maximumRequestUSD > reserved.maximumRequestUSD);
    settleResearchProviderSpend(enlarged, { usage: { input_tokens: 0, output_tokens: 0 } });
  });
  // A packet that exceeds the old medium allocation is finalized under12k,
  // before dispatch. No missing obligations or stale provisional hash survives.
  const manyEvidence = Array.from({ length: 24 }, (_, index) => ({ sourceID: `fictional-${index}`, sectionID: `fictional-${index}`,
    codePrefix: "LIB", codeEdition: "2041", codeVersion: "original", corpusID: "fictional", text: `Fictional source ${index}.` }));
  const manyAnswer = { answerText: "Independent fictional rules are explained.", citations: [{ sourceIDs: manyEvidence.map((source) => source.sourceID) }],
    supportedPoints: manyEvidence.map((source, index) => ({ heading: `Fictional point ${index}`, explanation: `Separate explanation ${index}.`, sourceIDs: [source.sourceID] })) };
  const provisional = buildResearchClaimApplicabilityPacket({ question: "Synthetic source-scope question.", evidence: manyEvidence, answer: manyAnswer,
    maximumOutputTokens: 8_000 });
  assert(provisional.preflightReasons.includes("packet_capacity"));
  setup([{ value: validPass }]);
  await reservationTest(async () => {
    const result = await run({}, manyEvidence, manyAnswer);
    assert.equal(result.result.pass, true);
    const packet = JSON.parse(requests[0].input.split("CLAIM APPLICABILITY REVIEW\n")[1].split("\n\n")[0]);
    assert.deepEqual(packet.preflightReasons, []);
    assert.equal(requests[0].max_output_tokens, 12_000);
    assert.notEqual(packet.packetHash, provisional.packetHash);
    assert.equal(packet.units.length, provisional.units.length);
    assert.equal(packet.bindingCount, provisional.bindingCount);
  });

  // Safe diagnostics and fail-closed handling cover truncated and parseable
  // otherwise-valid incomplete responses without adding a provider call.
  for (const [reply, expectedReason, expectedReasoning] of [
    [{ raw: "{PRIVATE DRAFT", status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, reasoningTokens: 7 }, "max_output_tokens", 7],
    [{ value: validPass, status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, reasoningTokens: 3 }, "max_output_tokens", 3],
    [{ value: validPass, status: "incomplete", incomplete_details: { reason: "PRIVATE FACT" }, reasoningTokens: "PRIVATE FACT" }, "unknown", undefined]
  ]) {
    setup([reply]);
    await reservationTest(async () => {
      await assert.rejects(run(), (error) => {
        assert.equal(error.code, "INVALID_RESEARCH_VERIFICATION");
        assert.equal(error.failureStage, "verification_output_parse");
        assert.equal(error.verificationOutputDiagnostics.selectedProfile, "claim_applicability");
        assert.equal(error.verificationOutputDiagnostics.selectedReasoningEffort, "low");
        assert.equal(error.verificationOutputDiagnostics.selectedOutputTokenCap, 12_000);
        assert.equal(error.verificationOutputDiagnostics.selectedTimeoutMilliseconds, 90_000);
        assert.equal(error.verificationOutputDiagnostics.incompleteReason, expectedReason);
        assert.equal(error.verificationOutputDiagnostics.reasoningTokenCount, expectedReasoning);
        assert.equal(error.verificationOutputDiagnostics.unitCount, 3);
        assert(error.verificationOutputDiagnostics.edgeCount > 0 && error.verificationOutputDiagnostics.bindingCount > 0);
        assert(!JSON.stringify(error.verificationOutputDiagnostics).includes("PRIVATE"));
        assert.equal(error.incompleteReason, expectedReason);
        return true;
      });
      assert.equal(requests.length, 1);
    });
  }
  // Valid semantic failure remains a failure; no formatting retry is allowed.
  setup([{ value: validFail }]);
  await reservationTest(async () => {
    const result = await run();
    assert.equal(result.result.pass, false);
    assert.deepEqual(result.result.issues, validFail.issues);
    assert.equal(requests.length, 1);
    assert.equal(result.verificationEnvelopeRetryCount, undefined);
  });

  setup([{ value: badPass }, { value: validPass }]);
  let normalRequest;
  await reservationTest(async () => {
    const result = await run();
    assert.equal(result.result.pass, true);
    assert.equal(result.verificationEnvelopeRetryCount, 1);
    assert.equal(result.verificationEnvelopeDiagnostics.invariant, "pass_with_issues");
    assert.equal(result.usage.inputTokens, 40);
    assert.equal(result.usage.outputTokens, 20);
    assert.equal(result.usage.totalTokens, 60);
    assert.equal(result.usage.providerRequestCount, 2);
    assert.equal(result.usage.modelUsage.length, 2);
    assert.equal(requests.length, 2);
    normalRequest = requests[0];
    assert.deepEqual(selectedTimeouts, [90_000, 90_000], "Envelope repair retains the selected timeout");
    assert.equal(result.reasoningEffort, "low");
    for (const field of ["model", "store", "service_tier", "reasoning", "max_output_tokens", "safety_identifier", "text"]) {
      assert.deepEqual(requests[1][field], requests[0][field], `Repair cannot change ${field}.`);
    }
    assert(requests[1].input.startsWith(requests[0].input));
    assert(requests[1].instructions.startsWith(requests[0].instructions));
    assert(requests[1].input.includes('"invariant":"pass_with_issues"'));
    assert(requests[1].instructions.includes("Never discard a substantive issue to obtain pass=true"));
  });

  // A corrected envelope may reject the draft. It is never coerced to pass.
  setup([{ value: { ...validPass, pass: false } }, { value: validFail }]);
  await reservationTest(async () => {
    const result = await run();
    assert.equal(result.result.pass, false);
    assert.deepEqual(result.result.issues, validFail.issues);
    assert.equal(result.verificationEnvelopeDiagnostics.invariant, "failure_without_issues");
    assert.equal(requests.length, 2);
  });

  const qualificationFail = { ...validFail, issues: [{ type: "unnecessary_qualification", detail: "An optional missing fact should be removed." }],
    missingFactsOnly: true, unnecessaryMissingFactIndices: [0] };
  for (const [value, invariant] of [
    [null, "result_shape"],
    [{ ...validPass, missingFactsOnly: "false" }, "missing_facts_only_type"],
    [{ ...validPass, priorReviewCorrection: 1 }, "prior_review_correction"],
    [{ ...validPass, projectFactQuestions: {} }, "project_fact_questions_type"],
    [{ ...validPass, projectFactQuestions: [""] }, "project_fact_question_item"],
    [{ ...validFail, projectFactQuestions: ["Question?"] }, "project_fact_questions_on_failure"],
    [{ ...validFail, issues: [{ type: "unrecognized", detail: "Private issue details." }] }, "issue_item"],
    [{ ...validPass, unnecessaryMissingFactIndices: [0] }, "missing_fact_indices_without_failed_qualification"],
    [{ ...qualificationFail, unnecessaryMissingFactIndices: [1] }, "missing_fact_index_bounds"],
    [{ ...qualificationFail, unnecessaryMissingFactIndices: [0, 0] }, "missing_fact_indices_duplicates"]
  ]) {
    setup([{ value }, { value }]);
    await reservationTest(async () => {
      await assert.rejects(run(), error => {
        assert.equal(error.code, "INVALID_RESEARCH_VERIFICATION");
        assert.equal(error.failureStage, "verification_envelope_validation");
        assert.equal(error.verificationInvariant, invariant);
        assert.equal(error.verificationEnvelopeRetryCount, 1);
        assert.equal(error.providerUsage.inputTokens, 40);
        assert.equal(error.providerUsage.providerRequestCount, 2);
        assert.equal(error.rejectedVerificationEnvelope, undefined);
        assert.equal(requests.length, 2);
        return true;
      });
    });
  }

  // Index correction remains scoped to this unchanged missing-fact array.
  setup([{ value: { ...qualificationFail, unnecessaryMissingFactIndices: [9] } }, { value: qualificationFail }]);
  await reservationTest(async () => {
    const result = await run();
    assert.equal(result.result.pass, false);
    assert.deepEqual(result.result.unnecessaryMissingFactIndices, [0]);
  });

  // Concurrent mutations of caller-owned objects cannot alter the repair or
  // its mapped-packet validation, even after the first provider await.
  const mutableEvidence = structuredClone(evidence);
  const mutableAnswer = structuredClone(answer);
  setup([{ value: badPass }, { value: validPass }], () => {
    mutableEvidence[0].text = "Caller changed source after dispatch.";
    mutableAnswer.answerText = "Caller changed draft after dispatch.";
    mutableAnswer.missingFacts = [];
  });
  await reservationTest(async () => {
    await run({}, mutableEvidence, mutableAnswer);
    assert(requests[1].input.includes("Supplied source A."));
    assert(!requests[1].input.includes("Caller changed"));
    assert(requests[1].input.includes('"missingFacts":["Address and mapped district"]'));
  });

  const plan = { disposition: "conditional_source_explanation", path: "property_map_applicability",
    conditionalExplanation: { version: zoningConditionalExplanationVersion, determinationStatus: "unresolved" },
    callPolicy: { subjectiveVerification: true } };
  const packet = planZoningMappedScopeReview({ plan, answer, evidence,
    safety: { pass: false, issues: [{ type: "zoning_missing_mapped_location", detail: "Scope remains unresolved." }] } });
  assert(packet);
  const mapReview = { packetHash: packet.packetHash, units: packet.units.map(unit => ({ unitID: unit.id,
    classification: unit.fields.includes("answerText") || unit.fields.some(field => field.startsWith("supportedPoints")) ? "source_explanation" : "unresolved_boundary",
    sourceIDs: ["source-a"], reason: "Synthetic protocol verdict only." })) };
  for (const validMap of [true, false]) {
    const mapped = structuredClone(mapReview);
    if (!validMap) mapped.units[0].sourceIDs = ["unknown-source"];
    const mutablePacket = structuredClone(packet);
    setup([{ value: { ...badPass, mappedScopeReview: mapReview } },
      { value: { ...validPass, mappedScopeReview: mapped } }], () => { mutablePacket.packetHash = "concurrent-mutation"; });
    await reservationTest(async () => {
      const result = await run({ mappedScopeReview: mutablePacket });
      assert.equal(result.result.pass, validMap);
      assert.equal(result.result.mappedScopeReview.pass, validMap);
      if (!validMap) assert(result.result.issues.some(issue => issue.type === "fact_evidence_confusion"));
      assert.deepEqual(requests[1].text.format.schema, requests[0].text.format.schema);
    });
  }

  // The envelope retry is shared across later semantic review invocations,
  // not one extra call for every revised draft in the same turn.
  const sharedState = { attempted: false };
  setup([{ value: badPass }, { value: validFail }]);
  await reservationTest(async () => {
    await run({ verificationEnvelopeRetryState: sharedState });
    assert.equal(sharedState.attempted, true);
    setup([{ value: badPass }]);
    await assert.rejects(run({ verificationEnvelopeRetryState: sharedState }), { code: "INVALID_RESEARCH_VERIFICATION" });
    assert.equal(requests.length, 1);
  });

  // No envelope regeneration for refusal, truncation or invalid JSON. These
  // retain their existing error path instead of repeating an exhausted result.
  for (const [reply, code] of [
    [{ refusal: true }, "RESEARCH_REFUSAL"],
    [{ raw: "{broken" }, "INVALID_RESEARCH_VERIFICATION"],
    [{ value: badPass, status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, "INVALID_RESEARCH_VERIFICATION"]
  ]) {
    setup([reply]);
    await reservationTest(async () => { await assert.rejects(run(), { code }); assert.equal(requests.length, 1); });
  }

  // Both dispatches use the unchanged cumulative spend guard. The first
  // response settles normally; a second request over the original cap stops
  // before fetch, retaining first usage on the thrown error.
  beginResearchSpendReservation({ id: "offline-bound-probe" });
  const probe = reserveResearchProviderSpend(normalRequest);
  settleResearchProviderSpend(probe, { model: normalRequest.model, usage: { input_tokens: 0, output_tokens: 0 } });
  endResearchSpendReservation();
  setup([{ value: badPass }]);
  await reservationTest(async () => {
    await assert.rejects(run(), error => {
      assert.equal(error.code, "RESEARCH_SPEND_CAP");
      assert.equal(error.providerUsage.inputTokens, 20);
      assert.equal(error.providerUsage.providerRequestCount, 1);
      assert.equal(requests.length, 1);
      return true;
    });
  }, { ...process.env, PERMITEXT_RESEARCH_MAX_REQUEST_USD: String(probe.maximumRequestUSD) });

  const abort = new AbortController();
  setup([{ value: badPass }]);
  afterEnvelopeEvent = () => abort.abort();
  currentSignal = abort.signal;
  await reservationTest(async () => {
    await assert.rejects(run({ signal: abort.signal }), error => {
      assert(error.code === "RESEARCH_CANCELLED" || error.name === "AbortError");
      assert.equal(error.providerUsage.inputTokens, 20);
      assert.equal(requests.length, 1);
      return true;
    });
  });

  assert(events.some(line => line.includes('"invariant":"pass_with_issues"')));
  assert(!events.some(line => line.includes("Private issue details") || line.includes("Supplied source A.") || line.includes(answer.answerText)),
    "Runtime envelope diagnostics must not log private answer/source/issue prose.");
  assert.equal(researchVerificationFailureReason({ code: "INVALID_RESEARCH_VERIFICATION" }), "verification_format");

  // Execute the real canonical-recovery catch branch with local storage/UI
  // doubles: exhausted malformed verdict saves an uncharged format recovery,
  // releases its turn reservation, and retains this conversation/question.
  const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
  const start = source.indexOf('    if (!researchReservationCompleted && ["RESEARCH_VERIFICATION_FAILED"');
  const end = source.indexOf("    if (!researchReservationCompleted && researchRequestID &&", start);
  assert(start >= 0 && end > start);
  const releases = [];
  const commits = [];
  const researchOperation = {};
  const context = { userID: "offline-user" };
  const conversation = { id: "same-conversation", primaryProjectID: "same-project" };
  const dependencies = { researchReservationCompleted: false, failureCode: "INVALID_RESEARCH_VERIFICATION",
    researchReservationID: "reservation-to-release", context, conversation, originalConversation: structuredClone(conversation),
    question: "Exact saved question", researchRequestID: "original-request", progressResponse: {}, researchOperation,
    error: { code: "INVALID_RESEARCH_VERIFICATION", message: "Envelope failed twice.", failureStage: "verification_envelope_validation",
      verificationEnvelopeRetryCount: 1,
      verificationEnvelopeDiagnostics: { invariant: "failure_without_issues", issueCount: 0 },
      firstVerificationEnvelopeDiagnostics: { invariant: "pass_with_issues", issueCount: 1 } },
    releaseResearchUsageReservation: async (...args) => releases.push(args),
    commitMissingDocumentClarification: async value => commits.push(value),
    researchVerificationFailureReason, researchVerificationAttemptDiagnostics: () => [], console: { warn: () => {} } };
  await new Function(...Object.keys(dependencies), `return (async () => { ${source.slice(start, end)} })();`)(...Object.values(dependencies));
  assert.deepEqual(releases, [[context.userID, "reservation-to-release"]]);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].conversation, conversation);
  assert.equal(commits[0].conversation.primaryProjectID, "same-project");
  assert.equal(commits[0].question, "Exact saved question");
  assert.equal(commits[0].researchRequestID, "original-request");
  assert.equal(commits[0].clarificationReason, "verification_format");
  assert.equal(researchOperation.charged, false);
  assert.equal(researchOperation.mode, "clarification");
  assert.equal(researchOperation.failureCode, "INVALID_RESEARCH_VERIFICATION");
  assert.equal(researchOperation.failureStage, "verification_envelope_validation");
  assert.equal(researchOperation.verificationEnvelopeRetryCount, 1);
  assert.deepEqual(researchOperation.verificationEnvelopeDiagnostics, { invariant: "failure_without_issues", issueCount: 0 });
  assert.deepEqual(researchOperation.firstVerificationEnvelopeDiagnostics, { invariant: "pass_with_issues", issueCount: 1 });
  assert(!JSON.stringify(researchOperation).includes("Envelope failed twice."), "Operation diagnostics must not retain verifier narrative.");
} finally {
  AbortSignal.timeout = oldTimeout;
  console.warn = oldWarn;
  console.log = oldLog;
  console.info = oldInfo;
}
console.log("Verifier envelope contracts passed: immutable draft/evidence/schema, one repair per turn, no semantic pass coercion, mapped validation, usage/caps/cancellation, typed private diagnostics and uncharged canonical recovery; synthetic responses only.");
