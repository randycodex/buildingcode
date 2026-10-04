// These aliases nominate enacted text. They never supply a rule, a section
// reference, an applicability decision, or a fact about the project.
export const researchSearchVocabularyVersion = '20261004-ordinary-search-vocabulary-v2';

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

const gasEquipmentNoun = '(?:equipment|appliances?|(?:space[-\\s]+|water[-\\s]*)?heaters?|furnaces?|boilers?|ranges?|stoves?)';
const gasEquipmentAlias = new RegExp(`\\b(?:(?:natural[-\\s]+)?gas(?:[-\\s]+(?:fired|burning|fuelled|fueled))?[-\\s]+${gasEquipmentNoun}|${gasEquipmentNoun}[-\\s]+(?:fired|burning|fuelled|fueled|running|operating|runs|operates)(?:[-\\s]+(?:on|by|with))?[-\\s]+(?:natural[-\\s]+)?gas)\\b`, 'gi');
function hasGasEquipment(value) { gasEquipmentAlias.lastIndex = 0; return gasEquipmentAlias.test(value); }
function gasCurrentText(value) {
  // A quoted example cannot supply either the equipment or a topic reset.
  return researchPositiveSearchText(value).split(/\b(?:(?:new|different|separate)\s+(?:topic|question|subject)|switch\s+(?:topics?|subjects?))\s*[:;,]?/i).at(-1);
}

// One equipment-class bridge shared by candidate-book hints, the foreground
// probe and existing topic nominations. It supplies no legal applicability.
export function researchGasEquipmentVocabulary(question = '', options = {}) {
  const original = String(question || '');
  if (!original.trim() || original.length > 4000) return null;
  const positive = gasCurrentText(original);
  const named = namedPrefixes(positive);
  if (named.length && !named.includes('FGC')) return null;
  const requested = positive.match(/[^.!?]*\?/g)?.at(-1) || positive.split(/[.!]/).filter(value => value.trim()).at(-1) || positive;
  const competing = /\b(?:electric(?:al)?[-\s]+(?:equipment|appliances?|heaters?|furnaces?|boilers?|ranges?|stoves?)|heat[-\s]+pumps?|relief[-\s]+(?:valves?|pipes?|lines?)|condensate|refrigerant|lavator\w*|toilets?(?![-\s]+rooms?\b)|showers?(?![-\s]+rooms?\b)|faucets?|hoses?|drains?|sanitary|egress|guardrails?|home[-\s]+business|sprinklers?)\b/i;
  if (competing.test(requested) || (/\b(?:compar\w*|both)\b/i.test(positive) && competing.test(positive))) return null;
  const currentEquipment = hasGasEquipment(positive);
  // Conservative omission is preferable to reviving an explicitly excluded
  // equipment noun, including a quoted or negatively stated current example.
  if (!currentEquipment && hasGasEquipment(original)) return null;
  const continuing = options.contextDependentFollowUp === true &&
    !/\b(?:(?:new|different|separate)\s+(?:topic|question|subject)|switch\s+(?:topics?|subjects?))\b/i.test(researchPositiveSearchText(original));
  const edition = positive.match(/\b(?:19|20)\d{2}\b(?=[^.!?]{0,35}\b(?:codes?|edition|version)\b)/i)?.[0];
  const topics = continuing ? (options.humanTopics || []).filter(value => typeof value === 'string').slice(0, 2)
    .filter(value => !edition || !/\b(?:19|20)\d{2}\b/.test(value) || value.includes(edition))
    .map(value => gasCurrentText(value.slice(0, 640))).filter(hasGasEquipment) : [];
  if (!currentEquipment && !topics.length) return null;
  // The requested property comes from the current human question. A prior
  // equipment subject may resolve a pronoun, but cannot supply a new property.
  const location = /\b(?:in|inside|within|locat\w*|place\w*|put|go|install\w*|contain\w*)\b/i.test(requested) &&
    /\b(?:rooms?|bathrooms?|bedrooms?|closets?)\b/i.test(requested);
  const shutoff = /\bshut[-\s]?off\b|\b(?:close|closing|isolat\w*)\b[^.!?]{0,35}\b(?:valves?|gas)\b/i.test(requested);
  const combustion = /\bcombustion[-\s]+air\b/i.test(requested);
  const terms = ['gas', 'appliance'];
  let aspect = null;
  if (shutoff) { aspect = 'shutoff'; terms.push('shutoff', 'valve'); }
  else if (location) {
    aspect = 'location';
    terms.push('location');
    const roomTerms = [...requested.matchAll(/\b(?:bathrooms?|bedrooms?|sleeping|toilet|surgical|storage|closets?|rooms?)\b/gi)].map(match => match[0].toLowerCase().replace(/s$/, ''));
    terms.push(...new Set(roomTerms));
    // Keep an explicitly stated appliance type, rather than blending its
    // location request with every short generic equipment-location rule.
    if (/\bdirect[-\s]+vent\b/i.test(requested)) terms.push('direct-vent');
    else if (/\bunvented\b/i.test(requested)) terms.push('unvented');
    else if (/\bvented\b/i.test(requested)) terms.push('vented');
  } else if (combustion) { aspect = 'combustion_air'; terms.push('combustion', 'air'); }
  gasEquipmentAlias.lastIndex = 0;
  const routeQuery = [positive, ...(!currentEquipment ? ['gas appliance'] : [])].join(' ').replace(gasEquipmentAlias, 'gas appliance');
  return { subject: 'gas_appliance', codePrefixes: ['FGC'], terms, query: aspect ? terms.join(' ') : '',
    aspect, routeQuery, origin: currentEquipment ? 'current' : 'human_context' };
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
