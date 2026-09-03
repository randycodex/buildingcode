import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  researchInputForEvidence, researchInterpretationSchemaForEvidence,
  researchWebSupportRequestBody
} from "../app.mjs";
import {
  beginResearchSpendReservation, endResearchSpendReservation,
  researchModelConfiguration, reserveResearchProviderSpend, settleResearchProviderSpend
} from "../research-config.mjs";
import { researchEvidenceAssemblyVersion } from "../research-evidence-assembly.mjs";
import { researchAnswerPresentationContract } from "../research-answer-presentation.mjs";
import { zoningResearchSafetyInstruction } from "../research-zoning-safety.mjs";

// Versioned offline fixture, NOT a read of Production. Standard prices checked
// against https://developers.openai.com/api/docs/pricing on 2026-09-03.
const environment = Object.freeze({
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

export async function preflightRampRequestEnvelopes(evidence) {
  const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
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
    createHash, zoningResearchSafetyInstruction, researchAnswerPresentationContract,
    researchInputForEvidence, researchInterpretationSchemaForEvidence
  };
  const buildAnswerRequest = new Function(...Object.keys(dependencies),
    `return ${source.slice(start, end).replace(/^async function/, "function")} return requestBody; };`
  )(...Object.values(dependencies));
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
    finally { endResearchSpendReservation(); }
  };
  const answerBoundUSD = bound(answer);
  const webBoundUSD = bound(web);
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
    syntheticReconciledCombinedBoundUSD = reserveResearchProviderSpend(answer, environment).reservedUSD;
    assert(syntheticReconciledCombinedBoundUSD <= 0.50);
  } finally { endResearchSpendReservation(); }
  assert.throws(() => bound({ ...web, model: "gpt-5.6-terra" }), { code: "RESEARCH_SPEND_CAP" });
  console.log(JSON.stringify({
    preflight: "ramp-base-request-envelopes", answerBoundUSD, webBoundUSD,
    unsettledCombinedBoundUSD: Number((answerBoundUSD + webBoundUSD).toFixed(6)),
    syntheticReconciledCombinedBoundUSD,
    capUSD: 0.50, providerCalls: 0, liveConfigVerified: false,
    scope: "Base requests only; no Project facts, prior chat, returned web claims, analysis, verifier, or revision. Not full-turn acceptance."
  }));
}
