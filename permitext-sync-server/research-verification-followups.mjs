// Passing-review questions must be material to the current requested decision,
// under the same shared presentation instructions used by the writer. This
// helper does not infer facts or judge legal relevance from question strings.
// Never reinterpret a failed verification as safe based on its issue wording.
export function applyVerifiedProjectFollowups(answer, verification) {
  if (!verification?.pass || verification.issues?.length || !verification.projectFactQuestions?.length) return answer;
  const unique = (items) => [...new Map(items.map(text => [text.toLowerCase().replace(/[^a-z0-9]/g, ''), text])).values()];
  const questions = verification.projectFactQuestions;
  return {
    ...answer,
    missingFacts: unique([...(answer.missingFacts || []), ...questions]),
    // Keep the writer's chosen first question; expose the remaining facts in the
    // structured record without turning the response into an intake checklist.
    followUpQuestions: answer.followUpQuestions?.length ? answer.followUpQuestions : [questions[0]]
  };
}

// Delivery must preserve an intentional empty writer/reviewer list. An old
// internal evidence-map suggestion is only a compatibility fallback when the
// answer has no followUpQuestions field, never an instruction to restart intake.
export function researchResponseFollowupQuestions(answer, evidenceAnalysis, {
  supportingGuidanceOnly = false
} = {}) {
  if (supportingGuidanceOnly) return [];
  if (answer && Object.prototype.hasOwnProperty.call(answer, "followUpQuestions")) {
    return Array.isArray(answer.followUpQuestions) ? [...answer.followUpQuestions] : [];
  }
  return Array.isArray(evidenceAnalysis?.highValueFollowUpQuestions)
    ? [...evidenceAnalysis.highValueFollowUpQuestions] : [];
}
