// Typed recovery copy and the original question only. Private review prose and
// legal drafts never enter this policy. Shared by server and history presentation.
export const researchSystemRecoveryReasons = Object.freeze([
  "verification_source", "verification_context", "verification_format", "verification_incomplete",
  "evidence_unavailable", "research_unresolved"
]);

const explanations = Object.freeze({
  verification_source: ["I found a mismatch between my explanation and its source references", "while preparing the answer to"],
  verification_context: ["I couldn’t consistently use the project details already provided", "while preparing the answer to"],
  verification_format: ["I ran into a problem", "while preparing the answer to"],
  verification_incomplete: ["I couldn’t finish the source checks", "for the answer to"],
  evidence_unavailable: ["I couldn’t prepare the code evidence needed", "to answer"],
  research_unresolved: ["I couldn’t resolve the conditions needed", "to answer"]
});

function recoveryExplanation(reason, question = "") {
  const wording = explanations[reason];
  if (!wording) return "";
  const originalQuestion = typeof question === "string" ? question.replace(/\s+/g, " ").trim() : "";
  return originalQuestion
    ? `${wording[0]} ${wording[1]} “${originalQuestion}”, so I couldn’t finish it.`
    : `${wording[0]} ${wording[1]} this question, so I couldn’t finish it.`;
}

export function researchVerificationRecoveryTextForReason(reason, question = "") {
  if (!researchSystemRecoveryReasons.includes(reason)) return "";
  return `${recoveryExplanation(reason, question)}\n\nUse Report this issue below to report this attempt.`;
}

export function researchFailureReason(error = {}) {
  const code = String(error.code || error.payload?.code || "").toUpperCase();
  if (["INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_VERIFICATION", "INVALID_RESEARCH_EVIDENCE_ANALYSIS"].includes(code)) return "verification_format";
  if (["INVALID_RESEARCH_CITATION", "INVALID_RESEARCH_WEB_CITATION"].includes(code)) return "verification_source";
  if (["RESEARCH_EVIDENCE_NOT_FOUND", "RESEARCH_ZONING_EVIDENCE_BUDGET_FAILED", "RESEARCH_ZONING_EVIDENCE_REQUIRED"].includes(code)) return "evidence_unavailable";
  if (code === "RESEARCH_ZONING_PREREQUISITES_REQUIRED") return "research_unresolved";
  // Earlier findings may have been repaired; only the last unresolved review
  // is evidence for the current reason. Never inspect issue.detail strings.
  const attempts = Array.isArray(error.verificationAttempts) ? error.verificationAttempts : [];
  const last = attempts.findLast(attempt => attempt?.pass !== true);
  const types = new Set((Array.isArray(last?.issues) ? last.issues : []).map(issue => issue?.type));
  if (["missed_premise_contradiction", "repeated_established_fact", "fact_evidence_confusion"].some(type => types.has(type))) return "verification_context";
  if (["incorrect_citation", "wrong_attribution", "irrelevant_citation", "unsupported_requirement"].some(type => types.has(type))) return "verification_source";
  return "verification_incomplete";
}

export function researchFailureRecovery(error = {}, question = "") {
  const code = String(error.code || error.payload?.code || "").toUpperCase();
  const status = Number(error.status || error.payload?.status || 0);
  const suppliedReason = error.recoveryReason || error.payload?.recoveryReason || error.reason;
  // Only canonical saved reasons (no code) or compatible typed error categories
  // can refine copy. A failed verifier cannot masquerade as missing library law.
  const acceptedReasons = !code ? researchSystemRecoveryReasons
    : ["RESEARCH_EVIDENCE_NOT_FOUND", "RESEARCH_ZONING_EVIDENCE_BUDGET_FAILED", "RESEARCH_ZONING_EVIDENCE_REQUIRED"].includes(code) ? ["evidence_unavailable"]
    : code === "RESEARCH_ZONING_PREREQUISITES_REQUIRED" ? ["research_unresolved"]
    : code === "RESEARCH_VERIFICATION_FAILED" ? ["verification_source", "verification_context", "verification_format", "verification_incomplete"]
    : ["INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_VERIFICATION", "INVALID_RESEARCH_EVIDENCE_ANALYSIS", "INVALID_RESEARCH_CITATION", "INVALID_RESEARCH_WEB_CITATION"].includes(code)
      ? [researchFailureReason(error)] : [];
  const reason = acceptedReasons.includes(suppliedReason) ? suppliedReason : researchFailureReason(error);
  const preserved = " Your question is still here.";
  const response = (kind, action, text, retryable = false) => ({ kind, action, text, retryable });
  if (["RESEARCH_CONTEXT_CHANGED", "RESEARCH_CONVERSATION_CHANGED", "RESEARCH_PROJECT_REVIEW_REQUIRED"].includes(code)) {
    return response("context", "review_context", "Review the current Project details and conversation before continuing." + preserved);
  }
  if (["RESEARCH_SOURCE_CHANGED", "INCOMPLETE_RESEARCH_SECTION", "RESEARCH_EVIDENCE_REQUIRED"].includes(code)) {
    return response("source", "review_sources", "Review the selected code sources before continuing." + preserved);
  }
  if (status === 401 || code === "ACCOUNT_SESSION_INACTIVE") {
    return response("account", "review_account", "Sign in from Account to continue Research." + preserved);
  }
  if (status === 402 || status === 403 || ["RESEARCH_ADDON_REQUIRED", "RESEARCH_TURNS_REQUIRED"].includes(code)) {
    return response("account", "review_account", "Review Research access and available turns in Account." + preserved);
  }
  if (["RESEARCH_SPEND_CAP", "RESEARCH_EVAL_SPEND_CAP"].includes(code)) {
    return response("limit", "contact_support", "Research stopped at a spending limit before completing an answer." + preserved);
  }
  if (code === "RESEARCH_NOT_CONFIGURED" || code === "RESEARCH_ZONING_SOURCE_UNAVAILABLE") {
    return response("unavailable", "contact_support", "Research is not enabled for this request." + preserved);
  }
  if (["RESEARCH_INTERRUPTED", "RESEARCH_PROVIDER_ERROR", "RESEARCH_VERIFIER_ERROR", "TIMEOUTERROR", "RESEARCH_CANCELLED", "ABORTERROR"].includes(code)) {
    return response("interrupted", "retry", "Research was interrupted before a completed answer returned. You can retry this request." + preserved, true);
  }
  const verificationCodes = ["INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_CITATION", "INVALID_RESEARCH_WEB_CITATION",
    "INVALID_RESEARCH_EVIDENCE_ANALYSIS", "INVALID_RESEARCH_VERIFICATION", "RESEARCH_VERIFICATION_FAILED",
    "RESEARCH_EVIDENCE_NOT_FOUND", "RESEARCH_ZONING_EVIDENCE_BUDGET_FAILED", "RESEARCH_ZONING_EVIDENCE_REQUIRED", "RESEARCH_ZONING_PREREQUISITES_REQUIRED"];
  if (verificationCodes.includes(code) || researchSystemRecoveryReasons.includes(error.reason)) {
    return { ...response(reason === "evidence_unavailable" ? "evidence" : "verification", "report", recoveryExplanation(reason, question)), reason };
  }
  if (code === "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE") {
    return response("evidence", "report", "Research couldn’t confirm attributable official guidance for this question." + preserved);
  }
  return response("unknown", "contact_support", "Research couldn’t complete this attempt. It did not establish an answer." + preserved);
}
