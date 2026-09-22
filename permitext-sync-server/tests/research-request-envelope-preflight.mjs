import { researchSuppliedTextPrompt } from "../research-supplied-text.mjs";
import assert from "node:assert/strict";
import { evaluateResearchWebAttribution } from "../research-web-attribution.mjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  researchInputForEvidence, researchInterpretationSchemaForEvidence,
  researchWebSupportRequestBody, deterministicResearchEvidenceAnalysisForTurn
} from "../app.mjs";
import { requiredResearchClaimsFromEvidence } from "../research-required-claim-coverage.mjs";
import {
  beginResearchSpendReservation, endResearchSpendReservation,
  researchModelConfiguration, reserveResearchProviderSpend, settleResearchProviderSpend
} from "../research-config.mjs";
import { researchEvidenceAssemblyVersion } from "../research-evidence-assembly.mjs";
import { researchAnswerPresentationContract, researchDecisionFactInstruction, researchGuidedNextStepInstruction } from "../research-answer-presentation.mjs";
import { researchQuestionIntentInstruction } from "../research-question-intent.mjs";
import { researchPracticalNextStepPrompt } from "../research-practical-next-step.mjs";
import { researchQualifiedFactInstruction } from "../research-conversation-facts.mjs";
import { researchClaimScopeInstruction } from "../research-claim-scope.mjs";
import { zoningResearchSafetyInstruction, zoningResearchSafetyPromptContext } from "../research-zoning-safety.mjs";
import { zoningResearchPromptContext } from "../research-zoning-planner.mjs";
import { zoningContextExcerptPrompt } from "../research-zoning-context-excerpts.mjs";
import { isZoningConditionalExplanation } from "../research-zoning-conditional-explanation.mjs";
import { zoningMappedReviewInstruction, zoningMappedReviewSchema } from "../research-zoning-mapped-review.mjs";
import { resolveResearchCodeBasis } from "../research-code-basis.mjs";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";

// Versioned offline fixture, NOT a read of Production. Standard prices checked
// against https://developers.openai.com/api/docs/pricing on 2026-09-03.
export const researchRequestEnvelopeEnvironment = Object.freeze({
  VERCEL_ENV: "production",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.50",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "7",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "10",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "100",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.20",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12",
  PERMITEXT_RESEARCH_PRICING_VERSION: "openai-standard-2026-09-03",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.20",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.20",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-standard-2026-09-03"
});

export async function buildResearchRequestEnvelopeBuilders(environment = researchRequestEnvelopeEnvironment, { sourceText } = {}) {
  // A retained source revision may be supplied only to compare offline requests.
  // Both paths end before dispatch and share the current, separately checked helpers.
  const source = sourceText ?? await readFile(new URL("../app.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function openAIResearchInterpretation(");
  const end = source.indexOf("  const { payload } = await requestResearchProvider({", start);
  assert(start >= 0 && end > start, "The production answer-request builder must remain identifiable.");
  // Execute the actual builder with its actual prompt/schema/evidence helpers,
  // ending BEFORE provider dispatch. No source mutation or real API key needed.
  const dependencies = {
    process: { env: { OPENAI_API_KEY: "offline-never-dispatched" } },
    fetch: () => { throw new Error("Network is forbidden in the request preflight."); },
    requestResearchProvider: () => { throw new Error("Provider dispatch is forbidden in the request preflight."); },
    researchModelConfiguration: () => researchModelConfiguration(environment),
    researchEvidenceAssemblyVersion,
    defaultSyncCodeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1",
    createHash, zoningResearchSafetyInstruction, researchAnswerPresentationContract, researchDecisionFactInstruction, researchQualifiedFactInstruction, researchClaimScopeInstruction,
    researchInputForEvidence, researchInterpretationSchemaForEvidence,
    researchQuestionIntentInstruction, researchSuppliedTextPrompt, researchPracticalNextStepPrompt, researchGuidedNextStepInstruction
  };
  const buildAnswerRequest = new Function(...Object.keys(dependencies),
    `return ${source.slice(start, end).replace(/^async function/, "function")} return requestBody; };`
  )(...Object.values(dependencies));
  const verificationStart = source.indexOf("async function openAIResearchVerification(");
  const verificationEnd = source.indexOf("  const { payload } = await requestResearchProvider({", verificationStart);
  const schemaStart = source.indexOf("const researchVerificationIssueTypes =");
  const schemaEnd = source.indexOf("function validateResearchVerification(", schemaStart);
  assert(verificationStart >= 0 && verificationEnd > verificationStart && schemaStart >= 0 && schemaEnd > schemaStart);
  const verificationDependencies = { ...dependencies, zoningResearchSafetyPromptContext, zoningResearchPromptContext, zoningContextExcerptPrompt,
    isZoningConditionalExplanation, zoningMappedReviewInstruction, zoningMappedReviewSchema, evaluateResearchWebAttribution };
  const buildVerifierRequest = new Function(...Object.keys(verificationDependencies),
    `${source.slice(schemaStart, schemaEnd)} return ${source.slice(verificationStart, verificationEnd).replace(/^async function/, "function")} return requestBody; };`
  )(...Object.values(verificationDependencies));
  return { buildAnswerRequest, buildVerifierRequest };
}

export async function preflightRampRequestEnvelopes(evidence) {
  const environment = researchRequestEnvelopeEnvironment;
  const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders(environment);
  const question = "What are the requirements for designing an accessible ramp under the 2022 NYC Building Code?";
  const userID = "synthetic-ramp-preflight";
  const answer = buildAnswerRequest(question, evidence, userID, { responseStyle: "conversational" });
  assert.equal(answer.model, "gpt-5.6-terra");
  assert.equal(answer.max_output_tokens, 3_000);
  const web = researchWebSupportRequestBody({
    model: "gpt-5.6-luna", userID, sanitizedQuery: question, allowedDomains: ["nyc.gov"]
  });
  const bound = (body) => {
    beginResearchSpendReservation({ id: "offline-envelope" }, environment);
    try { return reserveResearchProviderSpend(body, environment).maximumRequestUSD; }
    catch (error) {
      // Offline measurement only: preserve the original rejection and report
      // its size without dispatching or changing any production allowance.
      const diagnostic = { ...environment, PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85" };
      beginResearchSpendReservation({ id: "offline-rejected-envelope-measurement" }, diagnostic);
      const measured = reserveResearchProviderSpend(body, diagnostic).maximumRequestUSD;
      error.message += ` Offline request bound: $${measured.toFixed(6)}.`;
      throw error;
    }
    finally { endResearchSpendReservation(); }
  };
  const answerBoundUSD = bound(answer);
  const webBoundUSD = bound(web);
  const registry = createResearchCorpusRegistry();
  const answerOptions = {
    responseStyle: "conversational",
    requiredClaims: requiredResearchClaimsFromEvidence(evidence),
    structuredEvidenceAnalysis: deterministicResearchEvidenceAnalysisForTurn(evidence, []),
    codeBasis: resolveResearchCodeBasis({ availableCorpora: registry,
      corpusPlan: routeResearchCorpora({ question, registry }), resolvedAt: "2026-09-03T23:00:00.000Z" })
  };
  const completeAnswer = buildAnswerRequest(question, evidence, userID, answerOptions);
  const completeAnswerBoundUSD = bound(completeAnswer);
  assert.equal(completeAnswer.max_output_tokens, 6_000);
  assert(completeAnswerBoundUSD > 0 && completeAnswerBoundUSD <= 0.50);
  const truncationRetry = buildAnswerRequest(question, evidence, userID, {
    ...answerOptions, structuredResponseRetry: true, retryAfterOutputTruncation: true
  });
  assert.equal(truncationRetry.max_output_tokens, 6_000);
  assert.throws(() => bound(truncationRetry), { code: "RESEARCH_SPEND_CAP" },
    "This broad ramp retry must fail closed under the unchanged 0.50 fixture cap.");
  // Measure the envelope under a separate diagnostic-only allowance; this does
  // not modify process.env or Production configuration.
  const diagnosticEnvironment = { ...environment, PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85" };
  beginResearchSpendReservation({ id: "offline-truncation-envelope" }, diagnosticEnvironment);
  let truncationRetryBoundUSD;
  try { truncationRetryBoundUSD = reserveResearchProviderSpend(truncationRetry, diagnosticEnvironment).maximumRequestUSD; }
  finally { endResearchSpendReservation(); }
  assert(truncationRetryBoundUSD > completeAnswerBoundUSD);
  const initialOutputBudgetEnvelopes = {};
  for (const outputTokens of [4_000, 4_500, 6_000]) {
    beginResearchSpendReservation({ id: `offline-initial-${outputTokens}` }, diagnosticEnvironment);
    try {
      initialOutputBudgetEnvelopes[outputTokens] = reserveResearchProviderSpend(
        { ...completeAnswer, max_output_tokens: outputTokens }, diagnosticEnvironment
      ).maximumRequestUSD;
    } finally { endResearchSpendReservation(); }
  }

  beginResearchSpendReservation({ id: "offline-truncation-cap" }, environment);
  try {
    const initial = reserveResearchProviderSpend(completeAnswer, environment);
    settleResearchProviderSpend(initial, { usage: { input_tokens: 24_000, output_tokens: 3_000 } }, environment);
    assert.throws(() => reserveResearchProviderSpend(truncationRetry, environment),
      { code: "RESEARCH_SPEND_CAP" }, "A larger truncation retry must not bypass the existing cumulative cap.");
  } finally { endResearchSpendReservation(); }

  // Request-size fixture only: no private Project facts or previous live answer.
  const projectAnswer = buildAnswerRequest(question, evidence, userID, {
    ...answerOptions,
    projectContextFacts: Array.from({ length: 29 }, (_, index) =>
      `Synthetic property fact ${index + 1}: value not independently verified.`)
  });
  assert.equal(projectAnswer.max_output_tokens, 6_000);
  assert.throws(() => bound(projectAnswer), { code: "RESEARCH_SPEND_CAP" },
    "Broad coverage plus this project context exceeds the unchanged fixture cap.");
  beginResearchSpendReservation({ id: "offline-project-envelope" }, diagnosticEnvironment);
  let projectAnswerBoundUSD;
  try { projectAnswerBoundUSD = reserveResearchProviderSpend(projectAnswer, diagnosticEnvironment).maximumRequestUSD; }
  finally { endResearchSpendReservation(); }


  const verifier = buildVerifierRequest(question, evidence, {
    answerText: "Synthetic answer-size placeholder. ".repeat(240)
  }, userID, { ...answerOptions, model: "gpt-5.6-luna" });
  const verifierBoundUSD = bound(verifier);
  assert(answerBoundUSD > 0 && answerBoundUSD <= 0.50);
  assert(webBoundUSD > 0 && webBoundUSD <= 0.50);
  beginResearchSpendReservation({ id: "offline-cumulative" }, environment);
  try {
    reserveResearchProviderSpend(web, environment);
    assert.throws(() => reserveResearchProviderSpend(web, environment), { code: "RESEARCH_SPEND_CAP" },
      "An unreconciled web request must not allow an unaffordable retry.");
  } finally { endResearchSpendReservation(); }
  beginResearchSpendReservation({ id: "offline-reconciled-cumulative" }, environment);
  let syntheticReconciledCombinedBoundUSD;
  try {
    const reservation = reserveResearchProviderSpend(web, environment);
    // Synthetic usage demonstrates reconciliation, not the cost of a live run.
    settleResearchProviderSpend(reservation, {
      usage: { input_tokens: 18_000, output_tokens: 700 }
    }, environment);
    assert.throws(() => reserveResearchProviderSpend(completeAnswer, environment), { code: "RESEARCH_SPEND_CAP" },
      "Prior web usage must still count against the broad answer's reservation.");
    syntheticReconciledCombinedBoundUSD = null;
  } finally { endResearchSpendReservation(); }
  beginResearchSpendReservation({ id: "offline-answer-verifier" }, environment);
  let syntheticAnswerVerifierBoundUSD;
  try {
    const reservation = reserveResearchProviderSpend(completeAnswer, environment);
    // Synthetic usage is a bounded test case, not measured cost or latency.
    settleResearchProviderSpend(reservation, { usage: { input_tokens: 24_000, output_tokens: 3_000 } }, environment);
    syntheticAnswerVerifierBoundUSD = reserveResearchProviderSpend(verifier, environment).reservedUSD;
    assert(syntheticAnswerVerifierBoundUSD <= 0.50);
  } finally { endResearchSpendReservation(); }
  assert.throws(() => bound({ ...web, model: "gpt-5.6-terra" }), { code: "RESEARCH_SPEND_CAP" });
  console.log(JSON.stringify({
    preflight: "ramp-request-envelopes", initialOutputBudgetEnvelopes, truncationRetryBoundUSD, answerBoundUSD, completeAnswerBoundUSD, projectAnswerBoundUSD, verifierBoundUSD, webBoundUSD,
    unsettledCombinedBoundUSD: Number((answerBoundUSD + webBoundUSD).toFixed(6)),
    syntheticReconciledCombinedBoundUSD, syntheticAnswerVerifierBoundUSD,
    capUSD: 0.50, providerCalls: 0, liveConfigVerified: false,
    scope: "Actual request builders with deterministic analysis, required claims and routed code basis; separate synthetic 29-fact, settled-web and answer/verifier cases. No prior chat, returned web claims or revision. Not live or full-turn acceptance."
  }));
}
