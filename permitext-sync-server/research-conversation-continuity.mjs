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

const failureExplanations = Object.freeze({
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

function clarificationAnswer(question = "", reason = "verification", legacy = false) {
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
  const failureExplanation = failureExplanations[reason];
  const recovery = "Your question and earlier messages are saved. You can retry this question here without starting a new conversation.";
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
  return [false, true].some(legacy => {
    const expected = clarificationAnswer(question, answer.verification.reason, legacy);
    return Object.keys(expected).every(key => JSON.stringify(answer?.[key]) === JSON.stringify(expected[key]));
  });
}
