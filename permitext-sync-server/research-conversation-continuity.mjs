// History storage has no exchange-count cutoff. Provider context stays bounded;
// earlier user statements are context, never independently verified authority.
export function earlierResearchUserContext(messages = [], maximumCharacters = 16_000) {
  const earlier = messages.slice(0, -8).filter(message => message.role === "user")
    .map(message => String(message.question || "").trim()).filter(Boolean);
  const retained = [];
  let used = 0;
  for (const question of earlier.reverse()) {
    if (used + question.length + 2 > maximumCharacters) break;
    retained.unshift(question);
    used += question.length + 2;
  }
  return retained.join("\n\n");
}

// Retain only the last answer's checked source identity. This is a retrieval
// hint, not permission to reuse the answer's conclusions or to skip resolving
// the cited provision from the authorized corpus again.
export function researchPriorAnswerSources(messages = [], {
  maximumSources = 3,
  maximumCharactersPerSource = 6_000
} = {}) {
  const sourceLimit = Math.max(0, Math.min(3, Math.floor(Number(maximumSources) || 0)));
  const textLimit = Math.max(0, Math.min(6_000, Math.floor(Number(maximumCharactersPerSource) || 0)));
  if (!sourceLimit) return [];
  const answer = (Array.isArray(messages) ? messages : [])
    .findLast(message => message?.role === "assistant")?.answer;
  if (answer?.verification?.pass !== true || answer?.mode === "clarification" ||
      answer?.mode === "evidence_boundary" || answer?.authorityStatus === "evidence_boundary") return [];
  // A checked explanation of what is missing is useful conversation context,
  // but its contextual citations must not become governing retrieval hints.
  if (Array.isArray(answer.supportedPoints) && answer.supportedPoints.length === 0) return [];
  const sources = [];
  const seen = new Set();
  for (const citation of Array.isArray(answer.citations) ? answer.citations : []) {
    if (citation?.evidenceRole === "contextual" || citation?.evidencePriority?.evidenceRole === "contextual") continue;
    const codePrefix = String(citation?.codePrefix || "").trim().toUpperCase();
    const sectionNumber = String(citation?.sectionNumber || "").trim();
    if (!/^(?:AC|BC|EBC|FC|FGC|MC|PC|ZR)$/.test(codePrefix) ||
        !/^[A-Z]?\d+(?:[-.][0-9A-Za-z]+)*$/.test(sectionNumber)) continue;
    const identity = [codePrefix, sectionNumber, citation.codeVersion || citation.codeEdition || ""].join(":");
    if (seen.has(identity)) continue;
    seen.add(identity);
    sources.push({
      codePrefix,
      sectionNumber,
      sectionID: citation.sectionID || null,
      reference: `${codePrefix} § ${sectionNumber}`,
      codeEdition: citation.codeEdition || null,
      codeVersion: citation.codeVersion || null,
      corpusID: citation.corpusID || null,
      applicabilityStatus: citation.applicabilityStatus || null,
      title: String(citation.title || "").slice(0, 300),
      selectedText: (Array.isArray(citation.supportingPassages) ? citation.supportingPassages : [])
        .map(passage => String(passage?.selectedText || "")).filter(Boolean)
        .join("\n").slice(0, textLimit)
    });
    if (sources.length >= sourceLimit) break;
  }
  return sources;
}

export function researchInheritedAuthorityReferences({
  question,
  previousMessages = [],
  topicDecision,
  maximumReferences = 3
} = {}) {
  if (!String(question || "").trim() || !topicDecision ||
      topicDecision.decision === "topic_switch" ||
      topicDecision.signals?.returnToOriginal ||
      topicDecision.question?.codeReferences?.length ||
      !topicDecision.contextPolicy?.includeRootTopic) return [];
  return researchPriorAnswerSources(previousMessages, { maximumSources: maximumReferences })
    .map(({ title, selectedText, ...reference }) => reference);
}

const failureExplanations = Object.freeze({
  verification_source: "Research couldn’t finish because its explanation and source references didn’t agree.",
  verification_context: "Research couldn’t finish because its explanation didn’t consistently use the project details already provided.",
  verification_format: "Research received an answer it couldn’t read.",
  verification_incomplete: "Research couldn’t resolve this question from the sources it retrieved."
});

// Canonical historical records are immutable. Accept their original system
// copy during validation without using it for newly created recovery answers.
const historicalFailureExplanations = Object.freeze({
  verification_source: "Research found a mismatch between the draft and its cited code passages. It could not finish a source-supported answer on this attempt.",
  verification_context: "Research detected a conflict between the draft and the project facts or scenario discussed in this conversation. It could not resolve that conflict on this attempt.",
  verification_format: "Research received an incomplete or incorrectly formatted answer from the model. It could not finish processing that answer.",
  verification_incomplete: "Research could not finish checking the draft against the retrieved code text. This attempt does not establish a code or project conclusion."
});

export function researchVerificationFailureReason(error = {}) {
  if (error.code === "INVALID_RESEARCH_RESPONSE") return "verification_format";
  if (["INVALID_RESEARCH_CITATION", "INVALID_RESEARCH_WEB_CITATION"].includes(error.code)) return "verification_source";
  // Earlier findings may already have been repaired. Explain the unresolved
  // final review, rather than presenting a corrected issue as the current error.
  const issues = (error.verificationAttempts || []).findLast(attempt => !attempt.pass)?.issues?.map(issue => issue.type) || [];
  if (issues.some(type => /premise|established_fact/.test(type))) return "verification_context";
  if (issues.some(type => /citation|unsupported_requirement/.test(type))) return "verification_source";
  return "verification_incomplete";
}

function clarificationAnswer(question = "", reason = "verification", legacy = false, historicalFailureCopy = false) {
  let nextQuestion;
  if (/\b(?:transparency|glazing|storefront|street[- ]wall|frontage)\b/i.test(question)) {
    nextQuestion = "Which ground-floor uses face the street—retail, residential lobby or amenity space, community facility, or a combination?";
  } else if (/\b(?:historical|old|vesting|vested|prior|effective date)\b/i.test(question)) {
    nextQuestion = "Which filing date or version of the provision should we examine?";
  } else if (/\b(?:address|property|parcel|district|zoning|ZR)\b/i.test(question)) {
    nextQuestion = "Which frontage or specific zoning provision would you like to examine first?";
  } else {
    nextQuestion = "Which specific part should we work through first? You can also paste the provision or drawing note you are asking about.";
  }
  const lead = reason === "evidence"
    ? "I need more source information to explain this accurately."
    : "I couldn’t verify the explanation well enough to give you a reliable answer yet.";
  const failureExplanation = (historicalFailureCopy ? historicalFailureExplanations : failureExplanations)[reason];
  const recovery = historicalFailureCopy
    ? "Your question and earlier messages are saved. You can retry this question here without starting a new conversation."
    : "Your question and conversation are saved. You don’t need to repeat the question.";
  return {
    mode: "clarification", model: "permitext-conversation-clarification",
    answerText: failureExplanation ? `${failureExplanation}\n\n${recovery}` : legacy ? `${lead} We can continue in this conversation.\n\n${nextQuestion}` : nextQuestion,
    conclusion: failureExplanation || (legacy ? lead : nextQuestion), explanation: failureExplanation ? recovery : legacy ? nextQuestion : "",
    supportedPoints: [], citations: [], assumptions: [], missingFacts: [],
    supportingSources: [], supportingSourceUses: [], additionalEvidenceNeeded: [],
    evidenceLimitations: ["No code or project determination has been made in this response."],
    followUpQuestions: failureExplanation ? [] : [nextQuestion], authorityStatus: "evidence_boundary",
    authorityLabel: "Clarification — no determination",
    verification: { status: "clarification", pass: false, reason },
    charged: false
  };
}

export function researchClarificationAnswer(question = "", reason = "verification") {
  return clarificationAnswer(question, reason);
}

export function isCanonicalResearchClarification(question, answer) {
  if (!["verification", "evidence", ...Object.keys(failureExplanations)].includes(answer?.verification?.reason)) return false;
  // Historical records remain valid without rewriting their immutable content.
  return [false, true].some(legacy => [false, true].some(historicalFailureCopy => {
    const expected = clarificationAnswer(question, answer.verification.reason, legacy, historicalFailureCopy);
    return Object.keys(expected).every(key => JSON.stringify(answer?.[key]) === JSON.stringify(expected[key]));
  }));
}
