// Typed recovery and a bounded description of the human request only. Private
// review prose and rejected drafts never enter this shared presentation policy.
export const researchSystemRecoveryReasons = Object.freeze([
  "verification_source", "verification_context", "verification_format", "verification_incomplete",
  "evidence_unavailable", "research_unresolved"
]);

const priorQuestionExplanations = Object.freeze({
  verification_source: ["I found a mismatch between my explanation and its source references", "while preparing the answer to"],
  verification_context: ["I couldn’t consistently use the project details already provided", "while preparing the answer to"],
  verification_format: ["I ran into a problem", "while preparing the answer to"],
  verification_incomplete: ["I couldn’t finish the source checks", "for the answer to"],
  evidence_unavailable: ["I couldn’t prepare the code evidence needed", "to answer"],
  research_unresolved: ["I couldn’t resolve the conditions needed", "to answer"]
});

export function researchPriorQuestionRecoveryTextForReason(reason, question = "") {
  const wording = priorQuestionExplanations[reason];
  if (!wording) return "";
  const originalQuestion = typeof question === "string" ? question.replace(/\s+/g, " ").trim() : "";
  const lead = originalQuestion
    ? `${wording[0]} ${wording[1]} “${originalQuestion}”, so I couldn’t finish it.`
    : `${wording[0]} ${wording[1]} this question, so I couldn’t finish it.`;
  return `${lead}\n\nUse Report this issue below to report this attempt.`;
}

const normalizedQuestion = value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const phraseWords = value => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const wordIdentity = word => word.length > 3 ? word.replace(/s$/, "") : word;
const phraseJoiners = new Set("a an the your our my of for in on at to from with and or about".split(" "));

// This is optional display metadata, never a verdict or a fact extractor.
// Require request vocabulary and reject clauses, instructions and markup.
// Semantic paraphrase fidelity remains a reviewer obligation; invalid metadata
// is discarded without rejecting/retrying an otherwise valid review.
export function researchRecoveryHumanContext(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-8).filter(message => message?.role === "user" &&
    typeof message.id === "string" && message.id.length > 0 && message.id.length <= 256 &&
    typeof message.question === "string" && message.question.length <= 2000 &&
    (message.requestID == null || typeof message.requestID === "string") &&
    (message.researchRequestID == null || typeof message.researchRequestID === "string"))
    .map(message => ({ role: "user", id: message.id,
      requestID: message.requestID || message.researchRequestID || "", question: normalizedQuestion(message.question) }));
}

export function researchRecoveryRequestDescription(question, value, humanContext = []) {
  if (typeof value !== "string" || value.length > 100 || /[^\p{L}\p{N} '\u2019-]/u.test(value)) return "";
  const phrase = value.replace(/\s+/g, " ").trim(), words = phraseWords(phrase);
  if (!phrase || words.length > 12 ||
      /\b(?:is|are|was|were|be|been|being|can|could|will|would|may|might|must|shall|should|do|does|did|not|need|needs|needed|require|requires|required|comply|complies|compliant|meet|meets|satisfy|satisfies|pass|passes|fail|fails|allow|allows|allowed|permit|permits|permitted|prohibit|prohibits|prohibited|approve|approves|approved|missing|unknown|verify|verified|failed|failure|checker|retry|report|please|ignore|return|write|say)\b/i.test(phrase)) return "";
  const asked = new Set(phraseWords([normalizedQuestion(question),
    ...researchRecoveryHumanContext(humanContext).map(message => message.question)].join(" ")).map(wordIdentity));
  const content = words.filter(word => !phraseJoiners.has(word));
  if (!content.length || content.some(word => !asked.has(wordIdentity(word))) ||
      words.join(" ") === phraseWords(normalizedQuestion(question)).join(" ")) return "";
  return phrase;
}

export function researchRecoveryPresentation(question, requestID = "", requestDescription = null, humanContext = []) {
  const description = researchRecoveryRequestDescription(question, requestDescription, humanContext) || null;
  return { version: 1, requestID: typeof requestID === "string" && requestID.length <= 256 ? requestID : "",
    question: normalizedQuestion(question),
    requestDescription: description,
    humanContext: description && !researchRecoveryRequestDescription(question, description)
      ? researchRecoveryHumanContext(humanContext) : [] };
}

export function researchRecoveryDescriptionForPresentation(question, presentation) {
  if (!presentation || presentation.version !== 1 || typeof presentation.requestID !== "string" ||
      presentation.question !== normalizedQuestion(question)) return "";
  return researchRecoveryRequestDescription(question, presentation.requestDescription, presentation.humanContext);
}

function recoveryExplanation(reason, question = "", presentation = null) {
  const description = researchRecoveryDescriptionForPresentation(question, presentation);
  const topic = description ? `your question about ${description}` : "your question";
  return ({
    verification_source: `I couldn’t finish the answer to ${topic} because my explanation didn’t match the cited text.`,
    verification_context: `I couldn’t consistently use the details you provided while checking ${topic}.`,
    verification_format: `I couldn’t process the response to ${topic}.`,
    verification_incomplete: `I couldn’t finish the source check for ${topic}.`,
    evidence_unavailable: `I couldn’t prepare the evidence needed to answer ${topic}.`,
    research_unresolved: `I couldn’t resolve ${topic} on this attempt.`
  })[reason] || "";
}

export function researchVerificationRecoveryTextForReason(reason, question = "", presentation = null) {
  if (!researchSystemRecoveryReasons.includes(reason)) return "";
  return `${recoveryExplanation(reason, question, presentation)}\n\nUse Report this issue below to report this attempt.`;
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
  if (["misstated_provision", "incorrect_citation", "wrong_attribution", "irrelevant_citation", "unsupported_requirement", "overstated_compliance"].some(type => types.has(type))) return "verification_source";
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
