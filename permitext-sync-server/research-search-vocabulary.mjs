// These aliases nominate enacted text. They never supply a rule, a section
// reference, an applicability decision, or a fact about the project.
export const researchSearchVocabularyVersion = '20261003-ordinary-search-vocabulary-v1';

function compact(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

export function researchPositiveSearchText(value) {
  return String(value || '').replace(/`[^`]*`|"[^"\n]*"|“[^”\n]*”|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu, ' ')
    .replace(/\b(?:not|no|never|without|excluding|instead\s+of|rather\s+than|unlike|(?:do|does|did)\s+not|don['’]t)\b[^.;!?]*?(?=\s*[;.!?]|\bbut\b|$)/gi, ' ')
    .replace(/\b(?:compare[ds]?\s+with|compared\s+to|in\s+contrast\s+to)\b[^.;!?]*?(?=\s*[,;.!?]|\bbut\b|$)/gi, ' ');
}

function currentText(value) {
  // Only an affirmative leading marker can discard preceding context. A
  // marker quoted as an example cannot manufacture a new subject.
  return String(value || '').replace(/^\s*(?:(?:new|different|separate)\s+(?:topic|question|issue|problem|subject)|switch\s+(?:topics?|subjects?))\s*[:;,]?/i, '');
}

const definitions = Object.freeze([
  { subject: 'relief_discharge', codePrefixes: ['PC'],
    terms: ['water heater', 'relief valve', 'discharge piping', 'air gap'],
    identity: /\b(?:water[-\s]+heaters?|(?:hot[-\s]+water|domestic[-\s]+hot[-\s]+water)[-\s]+(?:tanks?|cylinders?))\b/i,
    aspect: /\b(?:relief|safety)\b|\b(?:pressure|temperature)\b[^.!?]{0,45}\b(?:valves?|devices?)\b/i,
    detail: /\b(?:pipes?|piping|discharg\w*|drains?|(?:open|air)[-\s]+(?:break|gap)|threaded[-\s]+ends?)\b/i,
    competing: /\b(?:boilers?|gas[-\s]+(?:piping|pipes?|connectors?)|condensate|refrigerant|steam|lavator\w*|sinks?|faucets?|hoses?|showers?|toilets?|egress|guardrails?)\b/i,
    canonical: /\b(?:discharge\s+piping|relief\s+valves?)\b/i },
  { subject: 'home_occupation', codePrefixes: ['ZR'], terms: ['home occupation'],
    identity: /\b(?:home[-\s]+(?:based[-\s]+)?business(?:es)?|home[-\s]+occupations?|business\b[^.!?;]{0,70}\b(?:in|from)\s+(?:(?:my|the|an?|our)\s+)?(?:apartment|home|dwelling)|(?:apartment|dwelling|home)\b[^.!?;]{0,70}\b(?:run|operate|conduct|business))\b/i,
    continuation: /\b(?:business|supplies|customers?|clients?|employ\w*|workers?|area|floor\s+space|square[-\s]+(?:feet|foot))\b/i,
    competing: /\b(?:guardrails?|guards?|handrails?|egress|gas[-\s]+(?:piping|valves?)|drains?|water[-\s]+heaters?|boilers?|ducts?|ventilation|exhaust|lavator\w*|sinks?|faucets?|toilets?|showers?)\b/i,
    canonical: /\bhome\s+occupation\b/i },
  { subject: 'combustible_storage', codePrefixes: ['FC'],
    terms: ['combustible material', 'outdoor storage'],
    identity: /\b(?:cardboard|cartons?|combustible[-\s]+(?:materials?|packaging)|packing[-\s]+materials?)\b/i,
    aspect: /\b(?:outdoors?|outside|open[-\s]+air)\b/i,
    detail: /\b(?:stor\w*|stack\w*|piles?|keep|kept|place\w*|packaging)\b/i,
    competing: /\b(?:flammable[-\s]+liquids?|propane|LPG|gas[-\s]+cylinders?)\b/i,
    canonical: /\bcombustible\b[^.!?]{0,120}\b(?:storage|materials?)\b|\bstorage\b[^.!?]{0,120}\bcombustible\b/i }
]);

function namedPrefixes(value) {
  const names = [['PC', 'Plumbing'], ['BC', 'Building'], ['MC', 'Mechanical'],
    ['FGC', 'Fuel[-\\s]+Gas'], ['FC', 'Fire'], ['AC', 'Administrative'],
    ['EBC', 'Existing[-\\s]+Building'], ['ZR', 'Zoning']];
  return names.filter(([prefix, name]) => new RegExp(`\\b${prefix}\\b|\\b${name}\\s+(?:Code|Resolution|Rules|Regulations)\\b`, 'i').test(value))
    .map(([prefix]) => prefix);
}

function matched(definition, positive) {
  return definition.identity.test(positive) && (!definition.aspect || definition.aspect.test(positive)) &&
    (!definition.detail || definition.detail.test(positive));
}

export function researchSearchVocabulary(question = '', options = {}) {
  const original = compact(question);
  const empty = { version: researchSearchVocabularyVersion, query: '', currentQuery: '',
    definitionQuery: original, concepts: [], codePrefixes: [] };
  if (!original || original.length > 4000) return empty;
  const current = currentText(original);
  const positive = researchPositiveSearchText(current);
  const named = namedPrefixes(positive);
  const requested = positive.match(/[^.!?]*\?/g)?.at(-1) || positive;
  const matchedCurrent = definitions.filter(definition => (!named.length || definition.codePrefixes.some(prefix => named.includes(prefix))) &&
    matched(definition, positive));
  const multipleRequested = matchedCurrent.length > 1 && /\b(?:compar\w*|both)\b/i.test(positive);
  const active = matchedCurrent.filter(definition => multipleRequested ||
    (!definition.competing?.test(requested) &&
      !(/\b(?:compar\w*|both)\b/i.test(positive) && definition.competing?.test(positive))));
  const concepts = active.map(definition => ({ subject: definition.subject,
    codePrefixes: [...definition.codePrefixes], terms: [...definition.terms], origin: 'current' }));
  // Only active human topics may resolve an omitted subject. Current quoted or
  // negated aliases, a new issue, and a competing requested object forbid it.
  const continuing = options.contextDependentFollowUp === true && current === original;
  if (continuing) {
    const topics = (options.humanTopics || []).filter(value => typeof value === 'string').slice(0, 2)
      .map(value => researchPositiveSearchText(currentText(value.slice(0, 640))));
    for (const definition of definitions) {
      if (concepts.some(concept => concept.subject === definition.subject) ||
          (named.length && !definition.codePrefixes.some(prefix => named.includes(prefix))) ||
          definition.competing?.test(requested) || definition.identity.test(current) && !definition.identity.test(positive)) continue;
      const detail = definition.continuation || definition.detail;
      if (!detail?.test(positive) || !topics.some(topic => matched(definition, topic))) continue;
      concepts.push({ subject: definition.subject, codePrefixes: [...definition.codePrefixes],
        terms: [...definition.terms], origin: 'human_context' });
    }
  }
  const query = [...new Set(concepts.flatMap(concept => concept.terms))].join(' ');
  const currentQuery = [...new Set(concepts.filter(concept => concept.origin === 'current').flatMap(concept => concept.terms))].join(' ');
  const definitionQuery = query && original.length + query.length + 1 <= 2000 ? `${original} ${query}` : original;
  return { version: researchSearchVocabularyVersion, query, currentQuery, definitionQuery, concepts,
    codePrefixes: [...new Set(concepts.flatMap(concept => concept.codePrefixes))] };
}

export function researchSearchVocabularyMatches(text, concept) {
  const definition = definitions.find(value => value.subject === concept?.subject);
  return Boolean(definition?.canonical.test(researchPositiveSearchText(text)));
}
