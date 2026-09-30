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

export function researchClarificationAnswer(question = "", reason = "verification") {
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
  return {
    mode: "clarification", model: "permitext-conversation-clarification",
    answerText: `${lead} We can continue in this conversation.\n\n${nextQuestion}`,
    conclusion: lead, explanation: nextQuestion,
    supportedPoints: [], citations: [], assumptions: [], missingFacts: [],
    supportingSources: [], supportingSourceUses: [], additionalEvidenceNeeded: [],
    evidenceLimitations: ["No code or project determination has been made in this response."],
    followUpQuestions: [nextQuestion], authorityStatus: "evidence_boundary",
    authorityLabel: "Clarification — no determination",
    verification: { status: "clarification", pass: false, reason },
    charged: false
  };
}

export function isCanonicalResearchClarification(question, answer) {
  if (!["verification", "evidence"].includes(answer?.verification?.reason)) return false;
  const expected = researchClarificationAnswer(question, answer.verification.reason);
  return Object.keys(expected).every(key => JSON.stringify(answer?.[key]) === JSON.stringify(expected[key]));
}
