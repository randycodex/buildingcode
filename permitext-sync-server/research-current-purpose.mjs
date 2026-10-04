// English word-family overlap nominates current request detail, never a rule's
// applicability. There are no topic, section, equipment or legal-answer maps.
import { researchPositiveSearchText } from "./research-search-vocabulary.mjs";
export const researchCurrentPurposeVersion = "20261004-current-purpose-recall-v2";
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

// An edition must belong to an affirmative authority phrase, not an incidental
// construction year or a quoted/retracted authority. Ambiguity disables the
// additional recall privilege; it never chooses a law or overrides a pin.
export function researchCurrentEditionContext(question = "") {
  const unquoted = String(question).replace(/`[^`]*`|"[^"\n]*"|“[^”\n]*”|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu, " ");
  const editions = new Set();
  let ambiguous = false;
  const clauses = unquoted.split(/[.;!?](?:\s|$)|,\s*|\b(?:but|and)\s+(?=(?:use|apply|follow|under|instead|ignore|disregard)\b)/i);
  for (const clause of clauses) {
    const comparison = /\b(?:compar\w*|versus|vs|both|difference|between)\b/i.test(clause);
    // The requested negative design ("without a label under the 2022 code")
    // does not negate its authority. Limit positive-search filtering to an
    // immediately negated authority phrase, not the whole proposed state.
    const positive = clause;
    // Adjacent authority modifiers are allowed, but dates separated from the
    // authority by a project/action/preposition cannot supply its edition.
    const yearFirst = /\b((?:19|20)\d{2})\s+(?:(?!(?:built|constructed|opened|completed|renovated|installed|was|is|has|had|in|on|at|under|for|with|and|or|to)\b)[a-z][a-z-]*\s+){0,4}(?:codes?|edition|version)\b/gi;
    const authorityFirst = /\b(?:codes?|edition|version)\s+(?:(?:of|for|from|the|year)\s+){0,3}((?:19|20)\d{2})\b/gi;
    const found = [...positive.matchAll(yearFirst), ...positive.matchAll(authorityFirst)].filter(match => {
      if (comparison) return true;
      const prefix = positive.slice(0, match.index), suffix = positive.slice(match.index + match[0].length);
      const excludedAuthority = /\b(?:ignore|disregard|exclude|excluding|(?:do\s+not|don['’]t)\s+use|not\s+(?:using|asking\s+about)|no\s+longer\s+(?:use|using))\s+(?:(?:under|from|the|an?|old|previous|earlier)\s+){0,3}$/i.test(prefix) ||
        /^\s*(?:['’]s\s+)?(?:(?:edition|version|reference|mention|assumption)\s+)?(?:is|was|has\s+been)\s+(?:not\s+(?:current|applicable)|wrong|incorrect|mistaken|retracted|superseded)\b/i.test(suffix);
      const excludedPrefix = prefix.match(/\b(?:not|no|never|without|rather\s+than|instead\s+of)\s+(?:(?:under|from|the)\s+){0,3}$/i)?.[0] || "";
      return !excludedAuthority && researchPositiveSearchText(excludedPrefix + match[0]).includes(match[1]);
    }).map(match => match[1]);
    const editionList = /\b(?:19|20)\d{2}(?:\s+(?:[a-z-]+\s+){0,3}(?:codes?|edition|version))?\s+(?:or|and)\s+(?:the\s+)?(?:19|20)\d{2}\b/i.test(positive);
    if (found.length && (comparison || editionList) && new Set(positive.match(/\b(?:19|20)\d{2}\b/g) || []).size > 1) ambiguous = true;
    found.forEach(year => editions.add(year));
  }
  return { edition: editions.size === 1 && !ambiguous ? [...editions][0] : null,
    ambiguous: ambiguous || editions.size > 1 };
}
