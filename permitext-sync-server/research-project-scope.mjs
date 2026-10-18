// Only a standalone ambiguous context correction can bypass legal research.
// Questions, proposed designs and explicit site changes stay in governed Research.
export function isAmbiguousResearchProjectCorrection(question) {
  const text = String(question || '').toLowerCase().replace(/[’]/g, "'").replace(/[.,!—–-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(?:(?:no|actually|sorry|wait|rather)\s+)*(?:(?:this|it|that)\s+is|(?:this|it|that)'s|i mean|i meant|we have|we're discussing|we are discussing)\s+(?:a\s+)?(?:new|different)\s+(?:project|job)$/.test(text);
}

export const researchProjectScopeInstruction = "Keep the saved Project link. Only if a user's correction ambiguously says new or different project, clarify same-site work versus a different property. Otherwise retain the attached site; exclude its facts for an explicit other-site scenario. Existing-building inventory does not establish proposed uses or occupancy.";

export function projectScopeClarification() {
  const lead = "This conversation is still linked to the selected Project; its saved site facts have not changed.";
  const question = "Do you mean new construction or a new design at this same property, or a different property?";
  return { mode: "clarification", model: "permitext-conversation-clarification",
    answerText: `${lead}\n\n${question}`, conclusion: lead, explanation: question,
    supportedPoints: [], citations: [], assumptions: [], missingFacts: [],
    supportingSources: [], supportingSourceUses: [], additionalEvidenceNeeded: [],
    evidenceLimitations: ["No code or project determination has been made in this response."],
    followUpQuestions: [question], authorityStatus: "evidence_boundary",
    authorityLabel: "Clarification — no determination",
    verification: { status: "clarification", pass: false, reason: "project_scope" }, charged: false };
}
