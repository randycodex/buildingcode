import { researchBoundedCitationRequest } from './research-model-routing.mjs';

// Conservative classification: uncertainty falls back to the full project path.
// This changes answer instructions, never evidence or verification requirements.
export function researchQuestionIsRuleExplanation(question) {
  const text = String(question || '').trim();
  if (!researchBoundedCitationRequest(text)) return false;
  if (/\b(?:my|our|this project|this building|for a particular|for this|comply|compliant|compliance|calculate|how many|how much|can I|can we|must I|must we|whether|would|should|sufficient|enough|required for|applies? to|for (?:a|the) (?:building|project))\b/i.test(text)) return false;
  if (/\b\d+(?:\.\d+)?\s*(?:sf|sq\.?\s*ft|square feet|occupants|people|stories|feet)\b/i.test(text)) return false;
  return /\b(?:what does|explain|summarize|quote|what is the (?:rule|text|meaning))\b/i.test(text);
}

export function researchQuestionIntentInstruction(question) {
  const task = researchQuestionIsRuleExplanation(question)
    ? 'TASK: Explain the cited enacted rule, not a project compliance decision. State the rule and its textual conditions directly. Correct a mistaken section/topic premise. Do not require occupancy, area, layout, approved records, or other project facts merely to explain what the provision says. Keep missingFacts and followUpQuestions empty unless the requested rule explanation itself is ambiguous. Describe applicability conditions as conditions of the rule, not unknown facts blocking this answer. Do not claim that the rule applies to an unstated project. Source gaps must still be disclosed accurately.'
    : 'TASK: Answer the actual question. Require project facts only when they can change the requested conclusion; distinguish missing facts from missing governing source text. Avoid unrelated occupancy-specific examples or exceptions unless needed to answer the question.';
  return task + ' Honor hypothetical premises over saved facts within that scenario; never mark hypothetical facts verified.';
}
