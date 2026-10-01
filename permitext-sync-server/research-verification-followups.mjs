// Follow-up questions are advisory only after the entire answer passes review.
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
