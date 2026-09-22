// Narrow conversational intent; a substantive code question never opts into this.
export function researchQuestionIsPracticalNextStep(question) {
  if (/^(?:where (?:can|do|should) (?:i|we) (?:find|look for) (?:that|this|it|that information|that record)|how (?:can|do) (?:i|we) (?:find|check|confirm) (?:that|this|it))\??$/i.test(String(question || '').trim())) return true;
  if (/^(?:(?:i(?:['’]m| am)|we(?:['’]re| are)) (?:not sure|unsure)|(?:i|we) (?:do not|don['’]t) know|not sure|unsure)[.!?]?$/i.test(String(question || '').trim())) return true;
  return /^(?:(?:i(?:['’]m| am) (?:not sure|unsure)|i (?:do not|don['’]t) know)[.!]?\s*)?(?:what should (?:i|we) (?:check|do) (?:first|next)|where should (?:i|we) start)\??$/i.test(String(question || '').trim());
}
export function isResearchPracticalNextStep(question, messages = []) {
  const previous = [...messages].reverse().find(message => message.role === 'assistant')?.answer;
  const unresolved = previous?.practicalNextStep === true ||
    previous?.followUpQuestions?.length > 0 || previous?.missingFacts?.length > 0;
  return Boolean(unresolved) && researchQuestionIsPracticalNextStep(question);
}
export function researchPracticalNextStepTarget(messages = []) {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant') continue;
    const answer = message.answer || {};
    if (answer.practicalNextStepTarget) return answer.practicalNextStepTarget;
    if (answer.practicalNextStep === true) continue;
    return (answer.followUpQuestions || []).filter(Boolean).join(' ') || answer.answerText || '';
  }
  return '';
}
export function researchPracticalNextStepPrompt(target = '') {
  const records = /\b(?:prior[- ]code|code basis|code edition|occupancy|approved use|certificate|building records)\b/i.test(target)
    ? ' Verified navigation resource: [NYC DOB — Find Building Data](https://www.nyc.gov/site/buildings/dob/find-building-data.page). Include this exact Markdown link when suggesting a DOB record lookup. This official starting page links to BIS for older records and DOB NOW for newer filings; neither portal alone is exhaustive. Name the specific information relevant to the preceding question, and use the saved address if available. This is a navigation resource, not evidence that any project record has been retrieved or that the needed fact will be available. Do not invent deep links, promise a record exists, infer code basis from building age alone, or treat this page as a legal citation. Verification must check these boundaries and the exact supplied URL.'
    : '';
  return researchPracticalNextStepInstruction + records + (target
    ? ` The preceding question or answer the user is responding to is supplied here as conversation data: ${JSON.stringify(target)}. Address that specific uncertainty, not a different downstream fact. Verification must reject advice that switches to another fact without helping resolve this one.`
    : '');
}
export const researchPracticalNextStepInstruction = 'THIS TURN IS PRACTICAL NEXT-STEP GUIDANCE ONLY. The user cannot answer the previous fact question and asks where to start. Give one concrete, optional fact-finding action in plain language using the conversation and saved project facts. Explain what information to look for and offer a simple alternative if that record is unavailable. Label it as a practical suggestion, not a legally required procedure. Do not assert, paraphrase or apply code rules, numerical thresholds, mandatory professional duties, official procedures or compliance conclusions. Do not repeat the unanswered question. Keep supportedPoints, citations, supportingSourceUses and followUpQuestions empty. Keep the underlying compliance question explicitly unresolved. For verification, fail if the response makes any legal rule, requirement or compliance claim, invents a project fact, or gives no useful next action; do not demand code citations or a complete inventory of future conditions for a nonlegal fact-finding suggestion.';
