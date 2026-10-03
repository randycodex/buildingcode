// A dependent measurement has no independent equipment/category subject.
// Resolve a bounded search subject from active user topics, never an answer,
// citation, measurement value or conclusion. This is recall, not authority.
const genericWords = new Set((`a an and are as at be been by can code codes could do does explain for from governing have how i in is it its me my need needed of on or our please project proposed requirement requirements rule rules shall should so some that the their them then there these this those to under use us was we what when where whether which with would you your basic building nyc new york city measure measured measuring measurement measurements calculate calculated calculation area areas dimension dimensions foot feet ft inch inches in high higher low lower wide wider long longer height heights width widths depth depths vertical horizontal clearance clearances slope slopes sloping maximum minimum level levels above below`).split(/\s+/));

const explicitAuthority = /\b(?:AC|BC|EBC|FC|FGC|MC|PC|ZR)\b|\b(?:Zoning Resolution|(?:Existing Building|Building|Construction|Fire|Fuel[- ]Gas|Mechanical|Plumbing|Administrative)\s+Codes?)\b|\b(?:19|20)\d{2}\s+(?:edition|version|(?:NYC\s+)?[A-Z]+\s+Code)|\b(?:edition|code version|code basis)\b/i;
const measurementDetail = /\bmeasur\w*\b|\b(?:calculate|calculation)\b[^?!]*\b(?:area|dimension|volume)\b|\b(?:height|width|depth|clearance|slope|sill)\b|\b\d+(?:\.\d+)?\s*(?:feet|foot|ft|inches|inch)\b/i;

function excludesSubject(question, words) {
  const clauses = [...question.matchAll(/\b(?:not|rather than|instead of)\b([^.;!?]*)/gi)]
    .map(match => match[1].split(/\b(?:but|instead)\b/i, 1)[0]);
  return clauses.some(clause => words.some(word => new RegExp(`\\b${word}s?\\b`, 'i').test(clause)));
}

export function researchDependentMeasurementSubject({ question, topicDecision, contextualTopics = [] } = {}) {
  const current = String(question || '').trim();
  if (topicDecision?.decision !== 'continuation' || !topicDecision.contextPolicy?.includeRootTopic ||
      !measurementDetail.test(current) || explicitAuthority.test(current)) return null;
  for (const topic of contextualTopics) {
    // Contextual topics are already active user statements selected by the
    // topic decision. Ignore statements after the first question and old data.
    const value = String(topic?.text || '').split(/[?!]/, 1)[0];
    const words = [...new Set((value.toLowerCase().match(/[a-z]+/g) || [])
      .filter(word => word.length > 2 && !genericWords.has(word)))];
    if (!words.length || words.length > 8) continue;
    if (excludesSubject(current, words)) return null;
    return { text: words.join(' '), terms: words, source: 'active_user_topic' };
  }
  return null;
}
