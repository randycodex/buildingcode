import { researchFactQualification } from "./research-fact-qualification.mjs";

// These are search facets, not legal categories or applicability decisions.
// They retain supplied wording and only control which context may nominate text.
const facets = Object.freeze({
  district: /\b(?:zoning districts?|commercial overlays?|special purpose|special districts?|[RCM]\d(?:-\d|[A-Z])?)\b/i,
  use: /\b(?:occupancy|use(?:s| category)?|mixed[- ]use|residen(?:tial|ces?|ts?)|dwelling|apartments?|commercial|retail|community[- ]facility|office|school|warehouse|building class|land use)\b/i,
  work: /\b(?:work\s*\/\s*filing|work type|scope of work|project scope|new building|new development|development|enlargement|alteration|change of use|proposed)\b/i,
  sprinklers: /\b(?:sprinkler(?:s|ed|ing)?|sprinkler protection)\b/i,
  height: /\b(?:stories|storeys|building height|levels below|floors?)\b/i,
  area: /\b(?:building area|floor area|square feet|sq\s*ft)\b/i,
  lot: /\b(?:zoning lot|lot composition|lot width|lot depth|lot area|lot type|tax lot|frontages?)\b/i,
  basis: /\b(?:code basis|code edition|code version|(?:19|20)\d{2}\s+(?:NYC|New York City|Building|Construction|Fire|Mechanical|Plumbing|Fuel))\b/i,
  flood: /\b(?:flood|waterfront)\b/i,
  protection: /\b(?:construction type|fire[- ]resistan|fire[- ]rat(?:ing|ed)|fire protection)\b/i
});
const genericSubjectWords = new Set([
  "general", "special", "additional", "other", "minimum", "requirements", "requirement",
  "provisions", "provision", "regulations", "regulation", "scope", "applicability",
  "administration", "definitions", "definition", "reserved", "miscellaneous", "rules", "rule",
  "application", "purpose", "chapter", "section", "and", "the"
]);
const searchStopWords = new Set([
  "the", "and", "this", "that", "these", "those", "with", "without", "what", "which",
  "where", "does", "have", "must", "should", "could", "would", "under", "project",
  "building", "code", "fact", "facts", "required", "requirement", "requirements",
  "stated", "confirmed", "verified", "independently", "wording", "source", "user"
]);
function text(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function facetNames(value) { return Object.entries(facets).filter(([, pattern]) => pattern.test(value)).map(([name]) => name); }
function terms(value) {
  return new Set((text(value).toLowerCase().replace(/-/g, " ").match(/[a-z][a-z]{2,}/g) || [])
    .filter(term => !searchStopWords.has(term)));
}
function currentTopics(question, contextualTopics) {
  return [text(question), ...[...(contextualTopics || [])].reverse().map(context => text(context.text))].filter(Boolean);
}
function projectApplication(value) {
  return /\b(?:now apply|apply (?:it|that|this)|return to (?:the )?actual|back to (?:the )?actual|use (?:the )?saved project facts (?:again|now))\b/i.test(value) &&
    /\b(?:project|building|facts)\b/i.test(value) && !researchFactQualification(value).hypothetical;
}
function overrideFacets(value) {
  const valueText = text(value);
  const overrides = new Set();
  const correctedOrScenario = /^(?:actually|correction|to clarify|clarification|I meant)\b|\b(?:rather than|instead of|what if|suppose|assuming|assume|hypothetically)\b/i.test(valueText);
  const suppliedCondition = /\b(?:this|our|my|the)\s+(?:project|building|work|proposal|space|lot)\s+(?:is|has|includes|contains|will|would)\b|\b(?:this|it)(?:\s+(?:is|was)|['’]s)\s+(?:not|only|a |an )/i.test(valueText);
  if (correctedOrScenario || suppliedCondition) for (const name of facetNames(valueText)) overrides.add(name);
  // A named district or edition defines the requested search scope even when
  // phrased as a question. It does not establish that scope as a project fact.
  if (/\b[RCM]\d(?:-\d|[A-Z])?(?:\s*\/\s*[RCM]\d(?:-\d|[A-Z])?)?\b/i.test(valueText)) overrides.add("district");
  if (/\b(?:19|20)\d{2}\b[^.!?]{0,40}\b(?:edition|code|NYC|New York City)\b|\b(?:code|edition)\b[^.!?]{0,25}\b(?:19|20)\d{2}\b/i.test(valueText)) overrides.add("basis");
  return overrides;
}
function factPayload(value) {
  const full = text(value);
  const sourceWording = full.match(/\s+Original user\/source wording:\s*(.+)$/i)?.[1];
  const main = full.split(/\s+Original user\/source wording:/i)[0];
  const match = main.match(/^(?:Unknown:\s*)?(?:Building\s*\/\s*Code|Zoning|Custom) Fact\s*—\s*([^:]+):\s*([\s\S]+)$/i);
  let payload = match ? `${match[1]}: ${match[2]}` : main;
  const metadata = payload.match(/\s+\(([^()]*)\)\.?$/)?.[1];
  if (metadata && /(?:user-(?:confirmed|stated)|sourced data|not established|excluded from active Research)/i.test(metadata)) {
    payload = payload.replace(/\s+\([^()]*\)\.?$/, "");
    const retained = metadata.split(/;\s*/).filter(part =>
      /user-(?:confirmed|stated)|sourced data|unknown|not established|existing-property|proposed building|mapped tax-lot|zoning-lot composition|hypothetical|preserve.*(?:negation|scope|uncertainty)/i.test(part));
    if (sourceWording && (researchFactQualification(sourceWording).qualified || researchFactQualification(sourceWording).hypothetical)) {
      payload = match ? `${match[1]}: ${sourceWording}` : sourceWording;
      retained.push("original qualified user/source wording");
    }
    if (retained.length) payload += ` [${retained.join("; ")}]`;
  }
  const assertion = payload.split(/\s+\[/)[0];
  const labeledFacets = match ? facetNames(match[1]) : [];
  return { full, payload, assertion, facets: labeledFacets.length ? labeledFacets : facetNames(assertion),
    unknown: /^(?:Unknown:)|\bunknown; not established\b|\brejected; excluded from active Research\b/i.test(full) ||
      /:\s*(?:unknown|TBD|undetermined|not (?:yet )?known)(?:\s*(?:$|[.([]))/i.test(assertion) };
}

export function activeResearchRetrievalFacts({ question, contextualTopics = [], projectFacts = [] } = {}) {
  const topics = currentTopics(question, contextualTopics);
  const applicationIndex = topics.findIndex(projectApplication);
  const overrideTopics = applicationIndex < 0 ? topics : topics.slice(0, applicationIndex + 1);
  const overridden = new Set(overrideTopics.flatMap(value => [...overrideFacets(value)]));
  const proposed = overrideTopics.some(value => /\b(?:new building|new development|proposed|redevelopment)\b/i.test(value));
  const asksExisting = /\b(?:existing (?:building|property)|current building|property record|existing inventory)\b/i.test(question || "");
  return (Array.isArray(projectFacts) ? projectFacts : []).map(factPayload).filter(fact => {
    if (/\brejected; excluded from active Research\b/i.test(fact.full)) return false;
    // Inventory is not evidence about a replacement building. Keep mapped
    // tax-lot data separately qualified; never promote it to zoning-lot data.
    if (proposed && !asksExisting && /\bexisting-property record\b/i.test(fact.full)) return false;
    return !fact.facets.some(name => overridden.has(name));
  }).map(fact => fact.full);
}

export function semanticResearchProjectFacts({ question, contextualTopics = [], projectFacts = [], maximumCharacters = 640 } = {}) {
  const subject = currentTopics(question, contextualTopics).join(" ");
  const questionTerms = terms(subject);
  const relevant = new Set();
  const zoning = /\b(?:zoning|district|FAR|floor area ratio|parking|setback|yards?|lot coverage|lot|permitted use|use permitted|development rights?|frontage|transparency|streetscape|street[- ]wall|glazing)\b/i.test(subject);
  if (zoning) for (const name of ["district", "use", "work", "lot"]) relevant.add(name);
  if (/\b(?:occupancy|occupant load|egress|stairs?|exit|travel distance|accessible|fire|sprinkler|ventilation|plumbing fixtures?|water closets?)\b/i.test(subject)) relevant.add("use");
  if (/\b(?:new|development|enlargement|alteration|existing|change of use|construction)\b/i.test(subject)) relevant.add("work");
  if (/\b(?:sprinkler|fire|storage|egress|travel distance|height|area)\b/i.test(subject)) relevant.add("sprinklers");
  if (/\b(?:height|stories|storeys|high[- ]rise|floors?|vertical|elevator)\b/i.test(subject)) relevant.add("height");
  if (/\b(?:area|FAR|coverage|square feet|sq\s*ft)\b/i.test(subject)) relevant.add("area");
  if (/\b(?:flood|waterfront|sidewalk|grade|elevation)\b/i.test(subject)) relevant.add("flood");
  if (/\b(?:construction type|fire[- ]rat(?:ing|ed)|fire[- ]resistan)\b/i.test(subject)) relevant.add("protection");
  const ranked = activeResearchRetrievalFacts({ question, contextualTopics, projectFacts }).map(factPayload)
    .filter(fact => !fact.unknown)
    .map((fact, index) => {
      const overlap = [...terms(fact.assertion)].filter(term => questionTerms.has(term)).length;
      const facetMatches = fact.facets.filter(name => relevant.has(name)).length;
      return { ...fact, index, score: facetMatches * 10 + overlap };
    }).filter(fact => fact.score > 0 && !/\b(?:address|borough|BBL|ZIP code|community district|zoning map)\s*:/i.test(fact.payload))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = [];
  let used = 0;
  const budget = Math.max(0, Math.min(640, Math.floor(Number(maximumCharacters) || 0)));
  for (const fact of ranked) {
    const cost = fact.payload.length + (selected.length ? 2 : 0);
    // Include whole statements, including their negation and scope. A long
    // fact that does not fit remains available to generation, not sliced here.
    if (used + cost > budget) continue;
    selected.push(fact.payload);
    used += cost;
    if (selected.length === 5) break;
  }
  return selected.join("; ");
}

export function semanticResearchScenarioText(value) {
  return text(value).replace(
    /\b(?:this|it|these|those)(?:\s+(?:is|are|was|were)|['’]s)\s+not\b[^?!;]*?(?:[!;.](?=\s|$)|$)/gi,
    clause => /\bbut\b/i.test(clause) ? clause.replace(/\s+not\b[\s\S]*?\bbut\s+/i, " ") : ""
  ).trim() || text(value);
}

function sourceSubject(value) {
  return text(value).replace(/^(?:SECTION\s+)?(?:(?:AC|BC|EBC|FC|FGC|MC|PC|ZR)\s*)?\d+(?:[-.]\d+)*\s*[:.]?\s*/i, "");
}
function userSubject(value) {
  // User questions provide subject context, never source authority. Remove
  // old references, editions and measurements so they cannot answer the new
  // detail or compete with its explicit reference/edition.
  return semanticResearchScenarioText(value)
    .replace(/\b(?:AC|BC|EBC|FC|FGC|MC|PC|ZR)\s*(?:§{1,2}\s*)?\d+(?:[-.]\d+)*\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b[RCM]\d(?:-\d|[A-Z])?\b/gi, " ")
    .replace(/\b\d+(?:\.\d+|\/\d+)?(?:[- ]by[- ]\d+(?:\.\d+)?)?(?:[- ](?:foot|feet|inch(?:es)?|ft|in|percent|hour|minute|gallon|pound)(?:[- ](?:long|wide|high))?)?\b/gi, " ")
    .replace(/\b(?:Under|NYC|New York City|Building Code|Construction Code|Mechanical Code|Plumbing Code|Fire Code|Fuel Gas Code|Zoning Resolution)\b/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, 360);
}
function requestedFamilies(value) {
  const families = new Set((text(value).match(/\b(?:AC|BC|EBC|FC|FGC|MC|PC|ZR)\b/gi) || []).map(value => value.toUpperCase()));
  for (const [family, name] of [["BC", "building"], ["EBC", "existing building"], ["FC", "fire"], ["FGC", "fuel gas"], ["MC", "mechanical"], ["PC", "plumbing"]]) {
    if (new RegExp(`\\b${name} code\\b`, "i").test(value)) families.add(family);
  }
  if (/\bzoning(?: resolution)?\b/i.test(value)) families.add("ZR");
  return families;
}
function requestedEditions(value) {
  const years = [];
  const forward = /\b((?:19|20)\d{2})\s+(?:(?:NYC|New York City)\s+)?(?:(?:Existing Building|Building|Construction|Fire|Fuel Gas|Mechanical|Plumbing)\s+Codes?|AC|BC|EBC|FC|FGC|MC|PC|ZR|edition|version)\b/gi;
  const backward = /\b(?:edition|code version|code basis)\s+(?:of\s+|from\s+)?((?:19|20)\d{2})\b/gi;
  for (const pattern of [forward, backward]) for (const match of text(value).matchAll(pattern)) years.push(match[1]);
  return [...new Set(years)];
}
export function researchQueryInheritedReferences(question, references = []) {
  const families = requestedFamilies(question);
  const editions = requestedEditions(question);
  return references.filter(source => {
    if (families.size && !families.has(source.codePrefix)) return false;
    if (!editions.length) return true;
    const priorEditions = `${source.codeEdition || ""} ${source.codeVersion || ""}`.match(/\b(?:19|20)\d{2}\b/g) || [];
    return priorEditions.some(edition => editions.includes(edition));
  });
}

export function semanticResearchSubjectContext({ question, contextualTopics = [], checkedPriorSources = [], contextDependentFollowUp = false, returnToOriginal = false, substantiveTerms = [] } = {}) {
  if (!contextDependentFollowUp) return "";
  const topics = [...contextualTopics].map(context => text(context.text)).filter(Boolean);
  const families = requestedFamilies(question);
  const sources = checkedPriorSources.filter(source => !families.size || families.has(source.codePrefix));
  const priorFamilies = new Set([...checkedPriorSources.map(source => source.codePrefix), ...topics.flatMap(value => [...requestedFamilies(value)])]);
  const changedFamily = families.size && priorFamilies.size && ![...families].some(family => priorFamilies.has(family));
  if (changedFamily) return "";
  const currentYears = requestedEditions(question);
  const changedEdition = currentYears.length && checkedPriorSources.some(source => {
    const priorYears = `${source.codeEdition || ""} ${source.codeVersion || ""}`.match(/\b(?:19|20)\d{2}\b/g) || [];
    return priorYears.length && !priorYears.some(year => currentYears.includes(year));
  });
  const correctedSubject = /^(?:actually|correction|to clarify|clarification|I meant)\b/i.test(question) &&
    [...overrideFacets(question)].some(name => ["use", "work", "district"].includes(name));
  if (correctedSubject) return "";
  if (projectApplication(question)) return "";
  const correctedTopic = [...topics].reverse().find(value =>
    /^(?:actually|correction|to clarify|clarification|I meant)\b/i.test(value) &&
    [...overrideFacets(value)].some(name => ["use", "work", "district"].includes(name)));
  const titles = sources.map(source => sourceSubject(source.title)).filter(title =>
    [...terms(title)].some(term => !genericSubjectWords.has(term)));
  if (!returnToOriginal && !changedEdition && !correctedTopic && substantiveTerms.length >= 6 && titles.length) return titles.join("; ").slice(0, 140);
  // Generic section titles cannot supply a subject. Fall back only to active
  // user topics, never assistant text or the prior source's operative clauses.
  const chosen = returnToOriginal ? topics[0] : correctedTopic || topics.find(value => userSubject(value).length >= 12) || topics.at(-1);
  return userSubject(chosen || "");
}
