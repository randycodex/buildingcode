// These aliases nominate enacted text. They never supply a rule, a section
// reference, an applicability decision, or a fact about the project.
export const researchSearchVocabularyVersion = '20261004-current-test-property-v5';

function compact(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

export function researchPositiveSearchText(value) {
  return String(value || '').replace(/`[^`]*`|"[^"\n]*"|“[^”\n]*”|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu, ' ')
    .replace(/\b(?:not|no|never|without|excluding|instead\s+of|rather\s+than|unlike|(?:do|does|did)\s+not|don['’]t)\b[^.;!?]*?(?=\s*[;.!?]|\bbut\b|$)/gi, ' ')
    .replace(/\b(?:compare[ds]?\s+with|compared\s+to|in\s+contrast\s+to)\b[^.;!?]*?(?=\s*[,;.!?]|\bbut\b|$)/gi, ' ');
}

const leadingTopicSwitch = /^\s*(?:(?:new|different|unrelated|another|separate)\s+(?:(?:safety|design|technical|practical|code|construction|project|fire|plumbing|mechanical|accessibility)\s+){0,2}(?:topic|question|issue|problem|concern|subject|matter)|separate(?:ly)?|moving on|switch(?:ing)?\s+(?:topics?|subjects?))\b/i;

function topicSwitchStart(value) {
  const text = String(value || '');
  const unquoted = text.replace(/`[^`]*`|"[^"\n]*"|“[^”\n]*”|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu,
    match => ' '.repeat(match.length));
  let start = leadingTopicSwitch.test(unquoted) ? 0 : null;
  for (const boundary of unquoted.matchAll(/[.!?]\s+|\n\s*/g)) {
    const next = boundary.index + boundary[0].length;
    if (leadingTopicSwitch.test(unquoted.slice(next))) start = next;
  }
  return start;
}

export function researchLeadingTopicSwitch(value) {
  // A new sentence may introduce a leading affirmative reset too. Quoted,
  // negated and interior mentions remain ordinary content.
  return topicSwitchStart(value) !== null;
}

function currentText(value) {
  // Only an affirmative leading marker can discard preceding context. A
  // marker quoted as an example cannot manufacture a new subject.
  const text = String(value || '');
  return text.slice(topicSwitchStart(text) ?? 0).replace(leadingTopicSwitch, '').replace(/^\s*[:;,]\s*/, '');
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
    canonical: /\bcombustible\b[^.!?]{0,120}\b(?:storage|materials?)\b|\bstorage\b[^.!?]{0,120}\bcombustible\b/i },
  { subject: 'egress_obstruction', codePrefixes: ['BC', 'FC'],
    terms: ['egress', 'obstruction', 'unimpeded', 'exit'],
    identity: /\b(?:exit[-\s]+(?:paths?|routes?|access|walkways?|corridors?)|escape[-\s]+(?:paths?|routes?)|means[-\s]+of[-\s]+egress|(?:required|emergency)[-\s]+exits?|egress|way[-\s]+out)\b|\brequired\b[^.!?;]{0,35}\b(?:paths?|routes?|walkways?|corridors?)\b[^.!?;]{0,25}\b(?:exit|egress)\b/i,
    aspect: /\b(?:block(?:ed|ing|s)?|obstruct\w*|imped\w*|clutter\w*)\b|\b(?:keep|kept|remain|maintain\w*)\b[^.!?;]{0,45}\bclear\b/i,
    aspectAlternative: text => /\b(?:store|storag\w*|leave|keep|place|put|stack\w*)\b/i.test(text) &&
      /\b(?:cartons?|boxes|furniture|stock|materials?|pallets?|pieces|equipment)\b/i.test(text) &&
      /\b(?:can|could|may|allow\w*|remain|pass|step\w*|around)\b/i.test(text),
    continuation: /\b(?:block\w*|obstruct\w*|imped\w*|clear|clutter\w*)\b/i,
    continuationCorrection: text => /^(?:correction|actually|to clarify)\b/i.test(text) &&
       /\b(?:materials?|metal|wood|plastic|cardboard|cartons?|boxes|pieces|furniture)\b/i.test(text) &&
       !/\b(?:wide|width|height|slope|gradient|capacity|travel[-\s]+distance)\b/i.test(text),
    competing: /\b(?:software|programs?|computers?|sunlight|condensate|air[-\s]+condition\w*|gas[-\s]+(?:piping|appliances?|vents?)|flues?|drains?|water[-\s]+heaters?)\b/i,
    guardedContinuation: true,
    canonical: /\b(?:egress|exits?|exit[-\s]+access|exit[-\s]+discharge)\b[\s\S]*\b(?:obstruct\w*|imped\w*|unobstructed|unimpeded)\b|\b(?:obstruct\w*|imped\w*|unobstructed|unimpeded)\b[\s\S]*\b(?:egress|exits?)\b/i },
  { subject: 'cooling_condensate', codePrefixes: ['MC', 'PC'],
    // Equipment identity is checked separately against complete canonical
    // text. Keep the compact probe focused on the requested action so a broad
    // equipment parent cannot consume every foreground slot.
    terms: ['condensate', 'disposal', 'discharge', 'cooling coils', 'evaporators'],
    identity: /\b(?:air[-\s]+condition\w*|cooling[-\s]+coils?|evaporators?|heat[-\s]+pumps?)\b/i,
    aspect: /\b(?:condensate|condensation)\b|\b(?:drip\w*|runoff|drain\w*)\b[^.!?;]{0,40}\bwater\b|\bwater\b[^.!?;]{0,40}\b(?:drip\w*|runoff|drain\w*)\b/i,
    detail: /\b(?:drip\w*|runoff|drain\w*|discharg\w*|dispos\w*|convey\w*|route\w*|send|level|slope|fall|pitch|gradient)\b/i,
    continuation: /\b(?:drain\w*|discharg\w*|dispos\w*|convey\w*|route\w*|send|level|slope|fall|pitch|gradient|overflow|pan|pans)\b/i,
    continuationExclusion: /\b(?:floor|roof|walkway|stairs?|ramps?)\b[^.!?;]{0,50}\b(?:level|slope|fall|pitch|gradient)\b|\b(?:level|slope|fall|pitch|gradient)\b[^.!?;]{0,50}\b(?:floor|roof|walkway|stairs?|ramps?)\b/i,
    continuedTerms: ['condensate', 'drain', 'cooling coils', 'evaporators'],
    competing: /\b(?:fuel[-\s]+burn\w*|gas[-\s]+(?:fired|burning|appliances?|boilers?|heaters?)|boilers?|flues?|steam[-\s]+(?:appliances?|sterilizers?)|rainwater|stormwater|sewage|sanitary[-\s]+sewer|lavator\w*|sinks?|toilets?|showers?|hoses?|relief[-\s]+valves?|egress|exit[-\s]+paths?)\b/i,
    guardedContinuation: true,
    defaultProperty: 'disposal',
    currentProperty: text => /\b(?:level|slope|fall|pitch|gradient)\b/i.test(text) ? 'slope'
      : /\b(?:overflow|pans?)\b/i.test(text) ? 'overflow'
      : /\b(?:drip\w*|runoff|discharg\w*|dispos\w*|convey\w*|route\w*|send)\b/i.test(text) ? 'disposal' : null,
    currentTerms: text => /\b(?:level|slope|fall|pitch|gradient)\b/i.test(text)
      ? ['condensate', 'drain', 'slope', 'piping', 'cooling coils', 'evaporators']
      : /\b(?:overflow|pans?)\b/i.test(text)
      ? ['condensate', 'overflow', 'drain', 'pan', 'cooling coils', 'evaporators'] : null,
    foregroundTerms: (text, origin) => /\b(?:level|slope|fall|pitch|gradient)\b/i.test(text)
      ? ['condensate', 'drain', 'slope', 'piping']
      : /\b(?:overflow|pans?)\b/i.test(text) ? ['condensate', 'overflow', 'drain', 'pan']
      : origin === 'current' || /\b(?:drip\w*|runoff|discharg\w*|dispos\w*|convey\w*|route\w*|send)\b/i.test(text)
      ? ['condensate', 'disposal', 'discharge'] : ['condensate', 'drain'],
    canonical: /\bcondensate\b/i,
    canonicalEquipment: /\b(?:cooling[-\s]+coils?|evaporators?)\b/i,
    canonicalProperties: { disposal: /\b(?:dispos\w*|discharg\w*|nuisance)\b/i,
      slope: /\b(?:slope|pitch|gradient)\b/i, overflow: /\b(?:overflow|auxiliary|secondary|drain[-\s]+pans?)\b/i } }
]);

function namedPrefixes(value) {
  const names = [['PC', 'Plumbing'], ['BC', 'Building'], ['MC', 'Mechanical'],
    ['FGC', 'Fuel[-\\s]+Gas'], ['FC', 'Fire'], ['AC', 'Administrative'],
    ['EBC', 'Existing[-\\s]+Building'], ['ZR', 'Zoning']];
  return names.filter(([prefix, name]) => new RegExp(`\\b${prefix}\\b|\\b${name}\\s+(?:Code|Resolution|Rules|Regulations)\\b`, 'i').test(value))
    .map(([prefix]) => prefix);
}

export function researchNamedCodePrefixes(value) {
  return namedPrefixes(researchPositiveSearchText(currentText(String(value || ""))));
}

const gasEquipmentNoun = '(?:equipment|appliances?|(?:space[-\\s]+|water[-\\s]*)?heaters?|furnaces?|boilers?|ranges?|stoves?)';
const gasEquipmentAlias = new RegExp(`\\b(?:(?:natural[-\\s]+)?gas(?:[-\\s]+(?:fired|burning|fuelled|fueled))?[-\\s]+${gasEquipmentNoun}|${gasEquipmentNoun}[-\\s]+(?:fired|burning|fuelled|fueled|running|operating|runs|operates)(?:[-\\s]+(?:on|by|with))?[-\\s]+(?:natural[-\\s]+)?gas)\\b`, 'gi');
function hasGasEquipment(value) { gasEquipmentAlias.lastIndex = 0; return gasEquipmentAlias.test(value); }
function gasCurrentText(value) {
  // A quoted example cannot supply either the equipment or a topic reset.
  return researchPositiveSearchText(currentText(value));
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
  const continuing = options.contextDependentFollowUp === true && !researchLeadingTopicSwitch(original);
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
  return definition.identity.test(positive) && (!definition.aspect || definition.aspect.test(positive) || definition.aspectAlternative?.(positive)) &&
    (!definition.detail || definition.detail.test(positive));
}

const physicalTestSubject = /\b(?:piping|pipes?|pipework|plumbing|refrigerant|hydraulic|sprinkler|gas[-\s]+(?:lines?|systems?))\b/i;
const testAction = /\b(?:pressure[-\s]+test\w*|leak[-\s]+test\w*|test(?:s|ing|ed)?)\b/i;
const testMediumProperty = /\b(?:test(?:ing)?[-\s]+(?:medium|media|gases?|fluids?|liquids?)|(?:gases?|fluids?|liquids?|medium|media)[-\s]+(?:for|used[-\s]+for)[-\s]+(?:the[-\s]+)?test(?:ing)?)\b/i;
const testOtherProperty = /\b(?:how[-\s]+(?:high|long|much)|duration|minutes?|hours?|gauge|pressure[-\s]+(?:level|value|reading)|test[-\s]+pressure|(?:psi|psig|kpa)|leak[-\s]+(?:location|repair))\b/i;
const materialStopWords = new Set('a an the and or it its this that these those them they gas gases fluid fluids liquid liquids medium media piping pipes pipework system systems test testing acceptable required permitted allowed only instead tank tanks cylinder cylinders bottle bottles pump pumps gauge gauges compressor compressors hose hoses valve valves'.split(' '));

function testMaterial(value) {
  const words = compact(value).toLowerCase().replace(/^(?:a|an|the)\s+/, '').split(/[\s-]+/);
  return words.length > 0 && words.length <= 3 && words.every(word => /^[a-z]{3,}$/.test(word) && !materialStopWords.has(word))
    ? words.join(' ') : null;
}

// Resolve the property from current human wording. Prior human context may
// identify the physical system, but never supplies a test material, an old
// pressure/duration question, or a legal permission. This has no source route.
export function researchTestMediumVocabulary(question = '', options = {}) {
  const original = compact(question);
  if (!original || original.length > 4000) return null;
  const current = currentText(original);
  const positive = researchPositiveSearchText(current);
  const requested = positive.match(/[^.!?]*\?/g)?.at(-1) || positive;
  if (!testAction.test(positive) || /\b(?:compar\w*|versus|vs|both|difference)\b/i.test(current) ||
      /\b(?:egress|exit[-\s]+paths?|home[-\s]+business|software|blood|medical|laboratory|lab[-\s]+samples?)\b/i.test(requested) ||
      testOtherProperty.test(requested)) return null;
  const phrases = [];
  const remember = value => { const material = testMaterial(value); if (material) phrases.push(material); };
  for (const match of positive.matchAll(/\b(?:use|using)\s+([a-z]+(?:[ -]+[a-z]+){0,2}?)\s+(?:to|for)\s+(?:(?:the|a|this|that|such)\s+)?(?:pressure[-\s]+|leak[-\s]+)?test\w*\b/gi)) remember(match[1]);
  for (const match of positive.matchAll(/\b(?:pressure[-\s]+|leak[-\s]+)?test\w*\b[^.!?;]{0,80}?\b(?:with|using|use)\s+([a-z]+(?:[ -]+[a-z]+){0,2}?)(?=\s*(?:[.!?;,]|$)|\s+(?:for|to|instead|or)\b)/gi)) remember(match[1]);
  for (const match of positive.matchAll(/\b(?:is|would|could|can)\s+([a-z]+(?:[ -]+[a-z]+){0,2}?)\s+(?:be\s+)?(?:acceptable|allowed|permitted|suitable|used)\b[^.!?;]{0,80}\btest\w*\b/gi)) remember(match[1]);
  if (testMediumProperty.test(positive)) {
    for (const match of positive.matchAll(/\b(?:corrected|changed|switched)\b[^.!?;]{0,35}\bto\s+([a-z]+(?:[ -]+[a-z]+){0,2}?)(?=\s*(?:[.!?;,]|$))/gi)) remember(match[1]);
  }
  const materials = [...new Set(phrases)];
  if (materials.length > 2 || !materials.length && !testMediumProperty.test(positive)) return null;
  // A quoted/negated proposal is not a positive material nomination. A second
  // retained request about another property is deliberately left to recall.
  if (!testMediumProperty.test(requested) && !/\b(?:acceptable|allowed|permitted|suitable|use|using)\b/i.test(requested)) return null;
  const named = namedPrefixes(positive);
  const currentSubject = physicalTestSubject.test(positive);
  const continuing = options.contextDependentFollowUp === true && current === original;
  const edition = positive.match(/\b(?:19|20)\d{2}\b(?=[^.!?]{0,35}\b(?:codes?|edition|version)\b)/i)?.[0];
  const topics = continuing ? (options.humanTopics || []).filter(value => typeof value === 'string').slice(0, 2)
    .map(value => researchPositiveSearchText(currentText(value.slice(0, 640))))
    .filter(value => physicalTestSubject.test(value) && testAction.test(value) &&
      (!edition || !/\b(?:19|20)\d{2}\b/.test(value) || value.includes(edition)) &&
      (!named.length || named.every(prefix => namedPrefixes(value).includes(prefix)))) : [];
  if (!currentSubject && !topics.length) return null;
  const terms = ['test', 'medium', ...materials];
  return { subject: 'test_medium', property: 'medium', codePrefixes: named, terms,
    foregroundTerms: terms, materials, origin: currentSubject ? 'current' : 'human_context' };
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
  const active = matchedCurrent.filter(definition => !definition.guardedContinuation ||
    !/\b(?:compar\w*|versus|vs|both|difference)\b/i.test(current)).filter(definition => multipleRequested ||
    (!definition.competing?.test(requested) &&
      !(/\b(?:compar\w*|both)\b/i.test(positive) && definition.competing?.test(positive))));
  const concepts = active.map(definition => ({ subject: definition.subject,
    codePrefixes: [...definition.codePrefixes], terms: [...(definition.currentTerms?.(positive) || definition.terms)], origin: 'current',
    ...(definition.foregroundTerms ? { foregroundTerms: definition.foregroundTerms(positive, 'current') } : {}),
    ...(definition.currentProperty || definition.defaultProperty
      ? { property: definition.currentProperty?.(positive) || definition.defaultProperty } : {}) }));
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
      const edition = current.match(/\b(?:19|20)\d{2}\b(?=[^.!?]{0,35}\b(?:codes?|edition|version)\b)/i)?.[0];
      if (definition.guardedContinuation && (/\b(?:compar\w*|versus|vs|both|difference)\b/i.test(current) ||
          /\b(?:BC|PC|MC|FC|FGC|AC|EBC|ZR)\s*\d|§/i.test(positive))) continue;
      const detailMatches = detail?.test(positive) || definition.continuationCorrection?.(positive);
      if (!detailMatches || definition.continuationExclusion?.test(positive) || !topics.some(topic => (!definition.guardedContinuation || !edition ||
          !/\b(?:19|20)\d{2}\b/.test(topic) || topic.includes(edition)) && matched(definition, topic))) continue;
      concepts.push({ subject: definition.subject, codePrefixes: [...definition.codePrefixes],
        terms: [...(definition.currentTerms?.(positive) || definition.continuedTerms || definition.terms)], origin: 'human_context',
        ...(definition.foregroundTerms ? { foregroundTerms: definition.foregroundTerms(positive, 'human_context') } : {}),
        ...(definition.currentProperty?.(positive) ? { property: definition.currentProperty(positive) } : {}) });
    }
  }
  const testMedium = researchTestMediumVocabulary(original, options);
  if (testMedium && concepts.length === 0) concepts.push(testMedium);
  const query = [...new Set(concepts.flatMap(concept => concept.terms))].join(' ');
  const currentQuery = [...new Set(concepts.filter(concept => concept.origin === 'current').flatMap(concept => concept.terms))].join(' ');
  const definitionQuery = query && original.length + query.length + 1 <= 2000 ? `${original} ${query}` : original;
  return { version: researchSearchVocabularyVersion, query, currentQuery, definitionQuery, concepts,
    codePrefixes: [...new Set(concepts.flatMap(concept => concept.codePrefixes))] };
}

export function researchSearchVocabularyMatches(text, concept) {
  if (concept?.subject === 'test_medium') {
    // The complete enacted text must itself regulate the requested property.
    // A generic pressure rule merely mentioning stabilization of a testing
    // medium is not a medium rule. Negative operative prohibitions remain law.
    const canonical = String(text || '');
    if (!Array.isArray(concept.materials) || concept.materials.length > 2) return false;
    const words = compact(canonical).toLowerCase().replace(/-/g, ' ');
    if (!concept.materials.every(material => testMaterial(material) === material &&
        new RegExp(`\\b${material.replace(/ /g, '\\s+')}\\b`, 'i').test(words))) return false;
    return /\b(?:test(?:ing)?\s+(?:medium|media|gases?|fluids?|liquids?)|(?:medium|media|gases?|fluids?|liquids?)\s+(?:used\s+)?for\s+(?:the\s+)?(?:pressure[-\s]+)?test(?:ing)?)\b[^.!?]{0,100}\b(?:shall|must|may|permitted|prohibited|allowed)\b/i.test(canonical) ||
      /\btests?\s+(?:shall|must)\s+be\s+(?:performed|made|conducted)\s+with\b/i.test(canonical) ||
      concept.materials.some(material => new RegExp(`\\b(?:shall|must|may)\\b[^.!?]{0,35}\\btest(?:ed|ing)?\\b[^.!?]{0,35}\\b(?:using|with)\\s+${material.replace(/ /g, '\\s+')}\\b`, 'i').test(words));
  }
  const definition = definitions.find(value => value.subject === concept?.subject);
  const canonical = definition?.guardedContinuation ? String(text || '') : researchPositiveSearchText(text);
  return Boolean(definition?.canonical.test(canonical) &&
    (!definition.canonicalEquipment || definition.canonicalEquipment.test(canonical)) &&
    (!concept?.property || !definition.canonicalProperties || definition.canonicalProperties[concept.property]?.test(canonical)));
}
