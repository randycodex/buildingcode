// English word-family overlap nominates current request detail, never a rule's
// applicability. There are no topic, section, equipment or legal-answer maps.
export const researchCurrentPurposeVersion = "20261004-current-purpose-recall-v1";
const generic = new Set(("a an the this that same each any all we i you they it them what which how can could may must should will would do does is are be have has put get make use need leave keep stay remain tell show required requirement requirements code codes section sections rule rules equipment unit units under on of for to from with about still now" ).split(" "));
function family(word) {
  // Keep short/ambiguous stems literal. Nominal/action forms such as
  // calibration/calibrate and identification/identifies share a long stem.
  let stem = word.toLowerCase().replace(/^un(?=[a-z]{5,}$)/, "");
  if (/ification$/.test(stem)) stem = stem.slice(0, -9);
  else if (/ifies$/.test(stem)) stem = stem.slice(0, -5);
  else if (/ified$/.test(stem)) stem = stem.slice(0, -5);
  else if (/ify$/.test(stem)) stem = stem.slice(0, -3);
  else if (/ation$/.test(stem)) stem = stem.slice(0, -5);
  else if (/ated$/.test(stem)) stem = stem.slice(0, -4);
  else if (/ate$/.test(stem)) stem = stem.slice(0, -3);
  else if (/ing$/.test(stem)) stem = stem.slice(0, -3);
  else if (/ed$/.test(stem)) { stem = stem.slice(0, -2); if (/([b-df-hj-np-tv-z])\1$/.test(stem)) stem = stem.slice(0, -1); }
  else if (/(?:xes|ches|shes|sses|zes)$/.test(stem)) stem = stem.slice(0, -2);
  else if (/s$/.test(stem)) stem = stem.slice(0, -1);
  // Ordinary identification verbs/nouns share a purpose across any subject.
  // This vocabulary nominates text; it supplies no applicable requirement.
  if (["ident", "label", "tag", "mark"].includes(stem)) return "ident";
  return stem.length >= 4 ? stem : word.toLowerCase();
}
export function researchCurrentPurposeTerms(question = "") {
  // Require an actual request clause, not an embedded interrogative in a
  // declaration, retracted example or quotation. Courtesy after it is ignored.
  const unquoted = String(question).replace(/`[^`]*`|"[^"\n]*"|“[^”\n]*”|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu, " ");
  const requests = unquoted.split(/[.;!?](?:\s|$)|,\s+(?=(?:what|which|how|can|could|may|must|should|does|do|is|are)\b)|\band\s+(?=(?:please\s+)?(?:explain|describe|summarize)\b)/i)
    .map(clause => clause.trim().replace(/^please\s+/i, "")
      .replace(/^(?:i(?:['’]m| am)|we(?:['’]re| are))\s+asking\s+about\s+/i, "What ")
      .replace(/^(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:(?:tell|show)\s+me\s+)?/i, ""))
    .filter(clause => /^(?:what|which|how|can|could|may|must|should|does|do|is|are|explain|describe|summarize)\b/i.test(clause));
  const query = requests.at(-1);
  if (!query) return [];
  const property = query.match(/^(?:what|which|how)\s+([\s\S]+?)(?=\b(?:can|could|may|must|should|will|would|does|do|is|are)\b|$)/i)?.[1];
  const action = query.match(/\b(?:can|could|may|must|should|will|would)\s+(?:(?:we|i|you|they|it)\s+)?(?:(?:still|now|not)\s+)?([a-z]{3,})/i)?.[1];
  const needed = query.match(/\b(?:need|needs|require|requires)\s+(?:an?\s+|the\s+)?([\s\S]+?)(?=\b(?:for|on|in|at|from|under|to)\b|$)/i)?.[1];
  const passive = query.match(/^(?:is|are)\s+([\s\S]+?)\s+(?:required|needed|permitted|allowed)\b/i)?.[1];
  const state = query.match(/\b(?:stay|remain|be)\s+(?:un)?([a-z]{3,})\b/i)?.[1];
  const explanation = query.match(/^(?:explain|describe|summarize)\s+([\s\S]+?)(?=\b(?:for|on|of|in|at|under)\b|$)/i)?.[1];
  const identify = /\b(?:tell|know)\s+(?:which|what)\b|\btell\b[^.!?]*\bapart\b/i.test(query) ? "identify" : "";
  const negativeState = (query.match(/\bun[a-z]{5,}\b/gi) || []).join(" ");
  const absentObject = query.match(/\bwithout\s+(?:an?\s+|the\s+)?([\s\S]+?)(?=\b(?:for|on|in|at|from|under|to)\b|$)/i)?.[1];
  // Explicit operators isolate the requested detail from surrounding subject
  // and location words. A modal's bare noun fallback is used only if no more
  // specific property/action phrase was found.
  const phrases = [property, needed, passive, state, explanation, identify, negativeState, absentObject].filter(Boolean);
  if (!phrases.length || action && /^(?:we|i|you|they|it)\b/i.test(query.replace(/^\w+\s+/, ""))) phrases.push(action);
  return [...new Set((phrases.join(" ").toLowerCase().match(/[a-z]{3,}/g) || [])
    .filter(word => !generic.has(word)).map(family))].slice(0, 8);
}
export function researchCurrentPurposeMatches(sourceText, purposeTerms) {
  const words = new Set((String(sourceText).toLowerCase().match(/[a-z]{3,}/g) || []).filter(word => !generic.has(word)).map(family));
  return purposeTerms.filter(term => words.has(term)).length;
}
