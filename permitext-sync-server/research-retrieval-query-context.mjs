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
  return /\b(?:now apply|apply (?:it|that|this)|(?:return|back|go back) to (?:(?:the|our|my) )?actual|use (?:the )?saved project facts (?:again|now))\b/i.test(value) &&
    /\b(?:project|building|facts)\b/i.test(value) &&
    !/\b(?:what if|suppose|supposing|assume|assuming|hypothetically|hypothetical)\b/i.test(value);
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
  const labeledFacets = match ? facetNames(match[1]).filter(name => name !== "use" ||
    !/\b(?:zoning districts?|commercial overlays?|special purpose|special districts?)\b/i.test(match[1])) : [];
  return { full, payload, assertion, label: match ? text(match[1]) : "", custom: /^(?:Unknown:\s*)?Custom Fact\s*—/i.test(main),
    value: match ? assertion.slice(assertion.indexOf(":") + 1).trim() : "",
    facets: labeledFacets.length ? labeledFacets : facetNames(assertion),
    unknown: /^(?:Unknown:)|\bunknown; not established\b|\brejected; excluded from active Research\b/i.test(full) ||
      /:\s*(?:unknown|TBD|undetermined|not (?:yet )?known)(?:\s*(?:$|[.([]))/i.test(assertion) };
}

// Match supplied field names, not legal limits. A custom label may describe a
// narrower subject than a broad facet (for example a system's count versus the
// building's count). Only a locally supplied assertion can shadow that field.
const labelBoilerplate = new Set(["condition", "detail", "details", "measurement", "measurements", "value", "values", "fact", "facts"]);
const quantityWords = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million", "half", "quarter"
];
const valueBoilerplate = new Set([
  ...searchStopWords, "is", "are", "was", "were", "has", "only", "not", "no", "yes", "none", "than", "over", "from", "into", "along", "per",
  ...quantityWords,
  "inch", "inches", "foot", "feet", "ft", "in", "percent", "percentage", "degree", "degrees", "gallon", "gallons", "unit", "units",
  "approximately", "about", "more", "less", "least", "most", "long", "wide", "high", "actual", "proposed"
]);
const subjectQualifiers = [
  ["running", "cross"], ["primary", "secondary"], ["upper", "lower"], ["first", "second"],
  ["interior", "exterior"], ["indoor", "outdoor"], ["north", "south", "east", "west"], ["front", "rear"]
];
const measurementHeads = new Set(["slope", "fall", "drop", "count", "length", "height", "distance", "width", "depth", "rise"]);
const suppliedQuantity = new RegExp(`\\b(?:\\d+(?:\\.\\d+)?|${quantityWords.join("|")})\\b`, "i");
const broadFacetLabels = new Set([
  "proposed use", "occupancy", "occupancy group", "construction type", "sprinkler protection", "work filing type", "work type",
  "code basis", "code edition", "code version", "zoning district", "commercial overlay", "special purpose district", "special district",
  "building height", "building area", "floor area", "lot width", "lot depth", "lot area", "lot type", "zoning lot composition", "street frontage"
]);
function fieldWords(value) {
  return (text(value).toLowerCase().replace(/\bnumber of\b/g, "count ").match(/[a-z][a-z-]*/g) || [])
    .flatMap(word => word.split("-"))
    .filter(word => word.length > 1 && !["the", "of", "for", "and", "at", "to", "a", "an"].includes(word))
    .map(word => word === "falls" || word === "falling" ? "fall" : word === "served" || word === "serves" ? "serve"
      : word.length > 4 && word.endsWith("ies") ? word.slice(0, -3) + "y"
      : /(?:ches|shes|xes|zes|sses)$/.test(word) ? word.slice(0, -2)
      : word.length > 3 && word.endsWith("s") && !/(?:ss|us|is)$/.test(word) ? word.slice(0, -1) : word);
}
function conflictingFieldQualifier(labelWords, clauseWords) {
  return subjectQualifiers.some(group => {
    const named = group.filter(word => labelWords.includes(word));
    return named.length && group.some(word => clauseWords.has(word) && !named.includes(word));
  });
}
function suppliedFieldClause(clause, scenario) {
  if (/\b(?:unchanged|remain(?:s)? the same|keep (?:the )?saved|same as (?:the )?saved)\b/i.test(clause)) return false;
  // Questions about a rule or a possible value are not corrections to a saved
  // condition. An explicit assumption may supply a value within a question.
  const unprefixed = clause.replace(/^(?:actually|correction|to clarify|clarification|I meant)\s*[:,]?\s*/i, "");
  if (!scenario && /(?:^|,\s*)(?:is|are|was|were|can|could|would|should|does|do|what|which|how|why|whether)\b/i.test(unprefixed)) return false;
  if (/\b(?:code|rule|section|provision)\s+(?:says?|states?|requires?|allows?|limits?|specifies?)\b|\b(?:must|shall)\b/i.test(clause)) return false;
  return /\b(?:is|are|was|were|has|have|had|serves?|contains?|includes?|provides?|becomes?|equals?|falls?|falling|change|changed|make|set|corrected|revised)\b|\b(?:will|would)\s+(?:be|have|serve|contain|include)\b|[:=]/i.test(unprefixed) ||
    (scenario && /\b(?:of|at|to|with)\b/i.test(unprefixed));
}
function shadowedCustomFacts(facts, topics) {
  const shadowed = new Set();
  const contextWords = new Set(fieldWords(topics.join(" ")));
  for (const topic of topics) {
    const scenario = /\b(?:what if|suppose|supposing|assume|assuming|hypothetically|instead|rather than)\b/i.test(topic);
    // Clause boundaries keep an adjacent unchanged field or legal question from
    // being mistaken for part of the corrected assertion. Decimal dots remain.
    for (const clause of topic.split(/[;!?]|\.(?=\s|$)|\s+(?:and|but|while)\s+/i).map(text).filter(Boolean)) {
      if (!suppliedFieldClause(clause, scenario)) continue;
      const clauseWords = new Set(fieldWords(clause));
      const candidates = facts.filter(fact => fact.custom && fact.label).flatMap(fact => {
        const labelWords = fieldWords(fact.label).filter(word => !labelBoilerplate.has(word));
        if (!labelWords.length || conflictingFieldQualifier(labelWords, clauseWords) ||
          conflictingFieldQualifier(fieldWords(fact.value), clauseWords)) return [];
        const countLabel = labelWords.includes("count");
        if (suppliedQuantity.test(fact.value) && !suppliedQuantity.test(clause) &&
          !/\b(?:unknown|undetermined|unconfirmed|uncertain|not (?:yet )?(?:known|confirmed|established))\b/i.test(clause) &&
          !(countLabel && /\b(?:no|none)\b/i.test(clause))) return [];
        const matches = labelWords.filter(word => clauseWords.has(word));
        const identity = countLabel ? labelWords.filter(word => word !== "count") : labelWords;
        const valueWords = fieldWords(fact.value).filter(word => !valueBoilerplate.has(word) && !labelWords.includes(word));
        const valueMatch = valueWords.some(word => clauseWords.has(word));
        const fullLabel = labelWords.every(word => clauseWords.has(word));
        const countIdentity = countLabel && identity.length && identity.every(word => clauseWords.has(word)) &&
          (suppliedQuantity.test(clause) || /\b(?:no|none|unknown|undetermined)\b/i.test(clause));
        const contextualLabel = labelWords.length > 2 && labelWords.slice(-2).every(word => clauseWords.has(word)) &&
          labelWords.every(word => contextWords.has(word));
        // A descriptive value can identify the narrower attribute of a compound
        // custom field, such as the fall in a named drain run. Generic units and
        // shared measurements are never identity evidence.
        const describedAttribute = valueMatch && (matches.length ||
          valueWords.some(word => measurementHeads.has(word) && clauseWords.has(word))) &&
          labelWords.filter(word => word !== "run").every(word => contextWords.has(word));
        if (!fullLabel && !countIdentity && !contextualLabel && !describedAttribute) return [];
        return [{ fact, score: matches.length * 2 + (fullLabel ? 4 : 0) + (valueMatch ? 1 : 0) }];
      });
      if (!candidates.length) continue;
      const bestScore = Math.max(...candidates.map(candidate => candidate.score));
      const best = candidates.filter(candidate => candidate.score === bestScore);
      // A generic "the slope/count/drain" cannot choose between separately
      // labeled fields. Leave it unresolved rather than silently picking one.
      if (best.length === 1) shadowed.add(best[0].fact.full);
    }
  }
  return shadowed;
}

export function activeResearchRetrievalFacts({ question, contextualTopics = [], projectFacts = [] } = {}) {
  const topics = currentTopics(question, contextualTopics);
  const applicationIndex = topics.findIndex(projectApplication);
  const overrideTopics = applicationIndex < 0 ? topics : topics.slice(0, applicationIndex + 1);
  const overridden = new Set(overrideTopics.flatMap(value => [...overrideFacets(value)]));
  const facts = (Array.isArray(projectFacts) ? projectFacts : []).map(factPayload);
  const customShadows = shadowedCustomFacts(facts, overrideTopics);
  const proposed = overrideTopics.some(value => /\b(?:new building|new development|proposed|redevelopment)\b/i.test(value));
  const asksExisting = /\b(?:existing (?:building|property)|current building|property record|existing inventory)\b/i.test(question || "");
  return facts.filter(fact => {
    if (/\brejected; excluded from active Research\b/i.test(fact.full)) return false;
    // Inventory is not evidence about a replacement building. Keep mapped
    // tax-lot data separately qualified; never promote it to zoning-lot data.
    if (proposed && !asksExisting && /\bexisting-property record\b/i.test(fact.full)) return false;
    if (customShadows.has(fact.full)) return false;
    // Preserve existing broad-field overrides when that is the entire custom
    // label. A narrower labeled subject must use its own identity instead.
    const broadLabel = broadFacetLabels.has(fieldWords(fact.label).join(" "));
    return fact.custom && !broadLabel ? true : !fact.facets.some(name => overridden.has(name));
  }).map(fact => fact.full);
}

const contextBoilerplate = new Set([
  "for", "from", "are", "has", "not", "only", "use", "using", "please", "cite", "governing", "section", "nyc",
  "saved", "context", "scenario", "test", "research", "fictional", "hypothetical", "proposed", "enough", "dimensions", "access",
  "keep", "same", "such", "much", "leave", "still", "explain", "answer", "question", "asks", "ask", "check", "protection"
]);
function contextTerms(value) {
  // A floor drain is a component; "floor" here is not a building-level fact.
  const componentText = text(value).replace(/\bfloor\s+drains?\b/gi, "drain");
  return new Set([...terms(componentText)].filter(term => !contextBoilerplate.has(term)));
}
function buildingScaleDimensionsRequested(value) {
  const subject = text(value).replace(/\bfloor\s+drains?\b/gi, "drain");
  return /\b(?:how many|number of)\s+(?:building\s+)?(?:stories|storeys|floors|levels)\b|\b(?:stories|storeys|levels)\s+(?:above|below)\s+(?:ground|grade)\b|\b(?:high[- ]rise|elevators?)\b/i.test(subject) ||
    /\b(?:building|structure|project)(?:['’]s)?\b[^.!?]{0,35}\b(?:height|high|stories|storeys|floors|levels)\b|\b(?:height|stories|storeys|floors|levels)\b[^.!?]{0,35}\b(?:building|structure|project)\b/i.test(subject) ||
    /\b(?:rooftop|roof)[- ](?:access|height|level|clear path|stairs?|exit|elevator)\b/i.test(subject);
}
function hypotheticalScopeRequested(value) {
  return /\b(?:fictional|hypothetical|test|sample|example)\b[^.!?]{0,70}\b(?:scenario|premises|conditions|case|example)\b|\b(?:scenario|premises|conditions|case)\b[^.!?]{0,70}\b(?:fictional|hypothetical|test|sample|example)\b|\bsaved\b[^.!?]{0,60}\bexample\b/i.test(value);
}
function actualScopeRequested(value) {
  return projectApplication(value) || /\b(?:actual|real|existing)\s+(?:project|building|property|conditions)\b/i.test(value) &&
    !hypotheticalScopeRequested(value);
}
function contextScopeIntroduction(value) {
  if (/^(?:fictional|hypothetical|(?:research )?test (?:scenario|case)|(?:for )?(?:the )?(?:alternative|sample|example) (?:scenario|case)|suppose|assume|assuming|what if)\b/i.test(value)) return "hypothetical";
  if (/^(?:existing[- ]property records?|actual (?:project|building)|real project|(?:sourced|public) project background|proposed (?:project|building))\b/i.test(value)) return "project";
  return null;
}
function contextualFactStatements(fact) {
  // Structured fields remain atomic: slicing them could detach an exception or
  // a label from its value. Long descriptions may contain several separate
  // subjects and explicitly named scopes. Select whole statements, carrying
  // the scope introduction verbatim instead of promoting a test to a fact.
  const prefix = fact.payload.match(/^Additional Project facts\s*\([^)]*\):\s*/i)?.[0] || "";
  const description = prefix ? fact.payload.slice(prefix.length) : fact.payload;
  if (fact.label || fact.payload.length <= 640) return [{ ...fact, scope: contextScopeIntroduction(description) }];
  const rawSentences = description.split(/(?<=[.!?])\s+(?=[A-Z0-9“‘"'])/).map(text).filter(Boolean);
  if (rawSentences.length < 2) return [{ ...fact, scope: contextScopeIntroduction(description) }];
  const sentences = [];
  for (const sentence of rawSentences) {
    // These describe how to use the saved scenarios, not an equipment/site
    // condition. Their scope instruction is preserved by the named envelope;
    // the complete original wording remains available to generation.
    if (/^(?:Use these (?:fictional|hypothetical|test|example) (?:premises|assumptions)|Keep (?:real|actual) project facts|Any corrected test value)\b/i.test(sentence)) continue;
    // Conditions, exceptions, pronouns and attribution belong to the preceding
    // assertion. Never cut a negative qualification off a selected assertion.
    if (sentences.length && /^(?:source\s*:|(?:except|unless|however|but|only|provided|otherwise|if|when|this|these|those|it|they|that|no|none|keep|use)\b)/i.test(sentence)) {
      sentences[sentences.length - 1] += ` ${sentence}`;
    } else sentences.push(sentence);
  }
  let scope = null;
  let anchor = "";
  return sentences.map(sentence => {
    // Further "assume" statements in an explicit scenario inherit its named
    // scope; they do not replace it with an unrelated quantified condition.
    const introduced = scope === "hypothetical" && /^(?:assume|assuming|suppose)\b/i.test(sentence)
      ? null : contextScopeIntroduction(sentence);
    const header = introduced && sentence.match(/^([^:]{1,300}:)\s*(?=(?:assume|suppose|assuming|consider)\b)/i)?.[1];
    if (introduced) { scope = introduced; anchor = header || sentence; }
    const assertion = header ? sentence.slice(header.length).trim() : sentence;
    const scoped = anchor && assertion !== anchor ? `${anchor} ${assertion}` : assertion;
    return { ...fact, payload: `${prefix}${scoped}`, assertion, facets: facetNames(assertion), scope,
      scopeAnchor: anchor, scopeIntroduction: Boolean(introduced), descriptionStatement: true };
  });
}

function shadowedDescriptionStatements(facts, topics) {
  const shadowed = new Set();
  const measurementWords = value => fieldWords(value).map(word =>
    ({ wide: "width", widened: "width", narrow: "width", narrowed: "width", high: "height", deep: "depth", long: "length" })[word] || word);
  const heads = new Set([...measurementHeads, "clearance"]);
  for (const topic of topics) {
    const scenario = /\b(?:what if|suppose|supposing|assume|assuming|hypothetically|hypothetical|fictional|instead|rather than)\b/i.test(topic);
    for (const clause of topic.split(/[;!?]|\.(?=\s|$)|\s+(?:and|but|while)\s+/i).map(text).filter(Boolean)) {
      const descriptiveChange = scenario && (/\b(?:we|I|the|this|it)\b[\s\S]*\b(?:widened|narrowed|raised|lowered|revised|correct(?:ed)?|keep)\b/i.test(clause) ||
        /^keep\s+(?:the|our|this)\b/i.test(clause)) &&
        !/^(?:is|are|can|could|would|should|does|do|what|which|how|why|whether)\b/i.test(clause);
      if ((!suppliedFieldClause(clause, scenario) && !descriptiveChange) || !suppliedQuantity.test(clause)) continue;
      const words = new Set(measurementWords(clause));
      const attributes = [...words].filter(word => heads.has(word));
      if (!attributes.length) continue;
      const candidates = facts.filter(fact => fact.descriptionStatement && suppliedQuantity.test(fact.assertion)).flatMap(fact => {
        const factWords = measurementWords(fact.assertion);
        if (!attributes.some(word => factWords.includes(word)) || conflictingFieldQualifier(factWords, words)) return [];
        const identity = factWords.filter(word => words.has(word) && !valueBoilerplate.has(word) && !heads.has(word));
        if (!identity.length) return [];
        return [{ fact, score: new Set(identity).size }];
      });
      const best = Math.max(0, ...candidates.map(candidate => candidate.score));
      const matches = candidates.filter(candidate => candidate.score === best);
      if (matches.length === 1) shadowed.add(matches[0].fact);
    }
  }
  return shadowed;
}

export function relevantResearchRetrievalFactContext({ question, contextualTopics = [], projectFacts = [],
  maximumCharacters = 640, queryMode = "semantic" } = {}) {
  const subject = currentTopics(question, contextualTopics).join(" ");
  const currentTerms = contextTerms(question);
  const questionTerms = currentTerms.size >= 3 ? currentTerms : contextTerms(subject);
  const relevant = new Set();
  const zoning = /\b(?:zoning|district|FAR|floor area ratio|parking|setback|yards?|lot coverage|lot|permitted use|use permitted|development rights?|frontage|transparency|streetscape|street[- ]wall|glazing)\b/i.test(subject);
  if (zoning) for (const name of ["district", "use", "work", "lot"]) relevant.add(name);
  if (/\b(?:occupancy|occupant load|egress|stairs?|exit|travel distance|accessible|fire|sprinkler|ventilation|plumbing fixtures?|water closets?)\b/i.test(subject)) relevant.add("use");
  if (/\b(?:new|development|enlargement|alteration|existing|change of use|construction)\b/i.test(subject)) relevant.add("work");
  if (/\b(?:sprinkler|fire|storage|egress|travel distance|height|area)\b/i.test(subject)) relevant.add("sprinklers");
  if (/\b(?:height|stories|storeys|high[- ]rise|floors?|vertical|elevator)\b/i.test(subject.replace(/\bfloor\s+drains?\b/gi, "drain"))) relevant.add("height");
  if (/\b(?:area|FAR|coverage|square feet|sq\s*ft)\b/i.test(subject)) relevant.add("area");
  if (/\b(?:flood|waterfront|sidewalk|grade|elevation)\b/i.test(subject)) relevant.add("flood");
  if (/\b(?:construction type|fire[- ]rat(?:ing|ed)|fire[- ]resistan)\b/i.test(subject)) relevant.add("protection");
  const originalFacts = (Array.isArray(projectFacts) ? projectFacts : []).map(factPayload);
  const activeFields = activeResearchRetrievalFacts({ question, contextualTopics,
    projectFacts: originalFacts.filter(fact => fact.label).map(fact => fact.full) }).map(factPayload);
  const topics = currentTopics(question, contextualTopics);
  const applicationIndex = topics.findIndex(projectApplication);
  const overrideTopics = applicationIndex < 0 ? topics : topics.slice(0, applicationIndex + 1);
  const overridden = new Set(overrideTopics.flatMap(value => [...overrideFacets(value)]));
  const descriptions = originalFacts.filter(fact => !fact.label && !fact.unknown &&
    !/\brejected; excluded from active Research\b/i.test(fact.full)).flatMap(contextualFactStatements);
  const shadows = shadowedDescriptionStatements(descriptions, overrideTopics);
  const statementFacts = [...activeFields.filter(fact => !fact.unknown).flatMap(contextualFactStatements),
    ...descriptions.filter(fact => !shadows.has(fact) && !fact.facets.some(name => overridden.has(name)))];
  // An explicitly requested saved hypothetical must not silently use actual
  // inventory from the same description. A clear actual return drops the test.
  const latestScope = currentTopics(question, contextualTopics).find(value => hypotheticalScopeRequested(value) || actualScopeRequested(value));
  const hypothetical = latestScope && hypotheticalScopeRequested(latestScope) && statementFacts.some(fact => fact.scope === "hypothetical");
  const scopeAnchors = [...new Set(statementFacts.filter(fact => fact.scope === "hypothetical").map(fact => fact.scopeAnchor || fact.assertion))];
  const namedScopes = scopeAnchors.filter(anchor => {
    const name = anchor.match(/\b(?:scenario|case)\s+([A-Za-z0-9-]+)\s*[:—-]/i)?.[1];
    return name && new RegExp(`\\b(?:scenario|case)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(subject);
  });
  const selectedScope = scopeAnchors.length > 1 ? namedScopes.length === 1 ? namedScopes[0] : null : scopeAnchors[0];
  const ranked = statementFacts.filter(fact => hypothetical ? fact.scope === "hypothetical" &&
      (scopeAnchors.length <= 1 || (fact.scopeAnchor || fact.assertion) === selectedScope) : fact.scope !== "hypothetical")
    .map((fact, index) => {
      const buildingDimensionField = /^(?:Stories Above Grade|Levels Below Grade|Building Height)$/i.test(fact.label);
      if (buildingDimensionField && !buildingScaleDimensionsRequested(subject)) return { ...fact, index, score: 0 };
      const overlap = [...contextTerms(fact.assertion)].filter(term => questionTerms.has(term)).length;
      const facetMatches = fact.facets.filter(name => relevant.has(name)).length;
      const lexicalIdentity = queryMode === "lexical" && zoning && /\b(?:address|borough|BBL|ZIP code|community district|zoning map)\s*:/i.test(fact.payload);
      // A description's broad use/fire facet alone cannot nominate unrelated
      // prose. Within a requested scope, the first statement carries premises
      // (and remains attached to every selected subordinate statement).
      const substantive = overlap > 0 || hypothetical && fact.scopeIntroduction;
      return { ...fact, index, score: fact.descriptionStatement && !substantive ? 0 : facetMatches * 10 + overlap * 4 + (lexicalIdentity ? 1 : 0) };
    }).filter(fact => fact.score > 0 && (queryMode === "lexical" && zoning ||
      !/\b(?:address|borough|BBL|ZIP code|community district|zoning map)\s*:/i.test(fact.payload)))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = [];
  let used = 0;
  const budget = Math.max(0, Math.min(4_000, Math.floor(Number(maximumCharacters) || 0)));
  for (const fact of ranked) {
    // Scope introductions may be shared by two selected complete sentences.
    // Deduplicate the introduction without removing it from the final context.
    let payload = fact.payload;
    if (fact.scopeAnchor && selected.some(value => value.includes(fact.scopeAnchor))) {
      const prefix = fact.payload.match(/^Additional Project facts\s*\([^)]*\):\s*/i)?.[0] || "";
      payload = `${prefix}${fact.assertion}`;
    }
    const statementCost = payload.length + (selected.length ? 2 : 0);
    if (used + statementCost > budget) continue;
    selected.push(payload);
    used += statementCost;
    if (selected.length === 5) break;
  }
  return selected.join("; ");
}

export function semanticResearchProjectFacts(options = {}) {
  return relevantResearchRetrievalFactContext({ ...options, queryMode: "semantic",
    maximumCharacters: Math.max(0, Math.min(640, Math.floor(Number(options.maximumCharacters ?? 640) || 0))) });
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
    [...terms(title)].some(term => !genericSubjectWords.has(term)))
    .filter((title, index, all) => all.findIndex(candidate => candidate.toLowerCase() === title.toLowerCase()) === index);
  if (!returnToOriginal && !changedEdition && !correctedTopic && substantiveTerms.length >= 6 && titles.length) return titles.join("; ").slice(0, 140);
  // Generic section titles cannot supply a subject. Fall back only to active
  // user topics, never assistant text or the prior source's operative clauses.
  const chosen = returnToOriginal ? topics[0] : correctedTopic || topics.find(value => userSubject(value).length >= 12) || topics.at(-1);
  return userSubject(chosen || "");
}
