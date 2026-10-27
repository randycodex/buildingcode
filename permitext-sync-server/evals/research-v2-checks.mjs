// A narrow developer expectation, not an independent legal accuracy grade.
// A negated or quoted compliance assertion must not be scored as an assertion.
export function rejectsUnsupportedRampApproval(answer) {
  const text=String(answer?.answerText || '');
  return /(?:1\s*[:/]\s*12|one unit vertical in 12)/i.test(text) &&
    /(?:does not meet|cannot (?:determine|establish|say|confirm)|can[’']t (?:determine|establish|say|confirm)|does not establish|not supported|not demonstrate)/i.test(text) &&
    /\[S1\]/.test(text);
}
