import { researchFactQualification } from "./research-fact-qualification.mjs";

export const researchConversationFactsVersion =
  "20260904-qualified-user-facts-v5";

export const researchConversationFactKinds = Object.freeze({
  established: "established",
  hypothetical: "hypothetical",
  unknown: "unknown"
});

const maximumStoredTopics = 8;
const maximumFactsPerTopic = 30;

function compactText(value, maximum = 2_000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function normalizedTopic(value) {
  return compactText(value).toLowerCase();
}

function formattedNumber(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number.toLocaleString("en-US") : compactText(value);
}

function canonicalCount(value) {
  const normalized = compactText(value).toLowerCase();
  const words = {
    one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10"
  };
  return words[normalized] || compactText(value);
}

function canonicalOrdinal(value) {
  const normalized = compactText(value).toLowerCase();
  const words = {
    first: "1", second: "2", third: "3", fourth: "4", fifth: "5",
    sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10"
  };
  return words[normalized] || canonicalCount(normalized.replace(/(?:st|nd|rd|th)$/i, ""));
}

function canonicalConstructionType(value) {
  return compactText(value).toUpperCase().replace(/[\s-]/g, "");
}

function canonicalDate(value) {
  const date = new Date(compactText(value));
  if (Number.isNaN(date.valueOf())) return compactText(value);
  return date.toISOString().slice(0, 10);
}

function fact({ key, value, statement, kind, sourceText }) {
  return {
    id: key,
    key,
    value: compactText(value, 500),
    statement: compactText(statement, 1_000),
    kind,
    sourceText: compactText(sourceText, 1_000),
    source: "user",
    qualificationVersion: researchConversationFactsVersion
  };
}

function turnKind(question, topicDecision) {
  const text = compactText(question);
  if (researchFactQualification(text).hypothetical) {
    return researchConversationFactKinds.hypothetical;
  }
  if (/\b(?:unknown|not known|not yet known|not determined|undetermined|to be determined|tbd)\b/i.test(text)) {
    return researchConversationFactKinds.unknown;
  }
  if (
    topicDecision?.decision === "correction" ||
    /^(?:actually|correction|to clarify|clarification|I meant)\b/i.test(text)
  ) {
    return researchConversationFactKinds.established;
  }
  return researchConversationFactKinds.established;
}

function assertionLike(question, kind, topicDecision) {
  if (kind !== researchConversationFactKinds.established) return true;
  const text = compactText(question);
  if (topicDecision?.decision === "correction") return true;
  if (!/[?]$/.test(text)) return true;
  return /\b(?:is|are|has|have|contains?|includes?|consists?|used as|intended as|with)\b/i.test(text) &&
    !/^(?:is|are|does|do|can|could|may|must|should|would|will|why|how|what|when|where|which)\b/i.test(text);
}

function matchedValue(text, pattern, index = 1) {
  const match = text.match(pattern);
  return match ? compactText(match[index]) : "";
}

function occupancyFactValue(text) {
  const patterns = [
    /\b(?:building|space|project|room|it|this)\b[^.;?]{0,40}\b(?:is|as)\s+(?:an?\s+)?(?:occupancy\s+)?Group\s+([A-Z](?:-\d+)?)\b/i,
    /\b(?:is|as)\s+(?:an?\s+)?([A-Z]-\d+)\s+(?:occupancy|building)\b/i,
    /\b([A-Z]-\d+)\s+building\b/i
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const sentenceStart = Math.max(
      text.lastIndexOf(".", match.index),
      text.lastIndexOf("?", match.index),
      text.lastIndexOf("!", match.index),
      text.lastIndexOf(";", match.index)
    ) + 1;
    const clausePrefix = text.slice(sentenceStart, match.index);
    const classificationQuestion =
      /\b(?:classif(?:y|ied)|treat(?:ed)?|consider(?:ed)?|count(?:ed)?)\s+as\s+(?:an?\s+)?(?:occupancy\s+)?Group\b/i.test(match[0]) &&
      /\b(?:does|do|can|could|may|must|should|would|will|is|are)\b/i.test(clausePrefix);
    if (!classificationQuestion) return compactText(match[1]);
  }
  return "";
}

function structuredFacts(question, kind, topicDecision) {
  const text = compactText(question);
  if (!assertionLike(text, kind, topicDecision)) return [];
  const startsWithLegalAuthority = /^(?:(?:AC|BC|EBC|FC|FGC|MC|PC)\b|Table\b|Section\b)/i.test(text);
  const facts = [];
  const add = (key, value, statement) => {
    if (!value || facts.some((item) => item.key === key)) return;
    facts.push(fact({ key, value, statement, kind, sourceText: text }));
  };

  const area = matchedValue(
    text,
    /\b([\d,]+(?:\.\d+)?)\s*(?:sf|sq\.?\s*ft\.?|square feet)\s+(?:space|room|building|project)\b/i
  ) || matchedValue(
    text,
    /\b(?:space|room|building|project)\b[^.;?]{0,50}?\b(?:has|had|contains?|with|area of)\s+([\d,]+(?:\.\d+)?)\s*(?:sf|sq\.?\s*ft\.?|square feet)\b/i
  );
  if (area) add("area_square_feet", area, `The active-topic space has an area of ${formattedNumber(area)} square feet.`);

  const employees = matchedValue(text, /\b(?:with|has|had|contains?|employs|occupied by)\s+([\d,]+)\s+employees?\b/i);
  if (employees) add("employee_count", employees, `The active-topic space has ${formattedNumber(employees)} employees.`);

  const dwellingUnits = matchedValue(text, /\b(?:with|has|had|contains?|containing)\s+([\d,]+)\s+dwelling units?\b/i);
  if (dwellingUnits) add("dwelling_unit_count", dwellingUnits, `The active-topic project contains ${formattedNumber(dwellingUnits)} dwelling units.`);

  const occupants = matchedValue(
    text,
    /\b(?:with|has|had|contains?|serves|occupied by|occupant load of)\s+([\d,]+)\s+(?:occupants?|persons?)\b/i
  );
  if (occupants) add("occupant_count", occupants, `The active-topic space has ${formattedNumber(occupants)} occupants.`);

  const occupantLoad = matchedValue(
    text,
    /\b(?:the\s+|this\s+|its\s+)?occupant\s+load\s+(?:is|was|will be|of|equals?|were)\s+([\d,]+)\b/i
  );
  if (occupantLoad && !startsWithLegalAuthority) add("occupant_load", occupantLoad, `The active-topic occupant load is ${formattedNumber(occupantLoad)}.`);

  const stories = matchedValue(
    text,
    /\b(?:a\s+)?([\d,]+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[- ]\s*|\s+)(?:story|stories)\b[^.;?]{0,30}\b(?:building|structure|project)\b/i
  ) || matchedValue(
    text,
    /\b(?:building|structure|project|it)\b[^.;?]{0,20}\b(?:is|has|had|contains?)\s+(?:a\s+)?([\d,]+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[- ]\s*|\s+)(?:story|stories)\b/i
  );
  if (stories) {
    const count = canonicalCount(stories);
    add("story_count", count, `The active-topic building has ${formattedNumber(count)} stories.`);
  }


  const constructionType = matchedValue(
    text,
    /\b(?:building|structure|project|it|this)\b[^.;?]{0,45}?\b(?:is|has|uses?|of|with)\s+(?:a\s+)?Type\s+(I{1,3}|IV|V)(?:\s*[- ]?\s*([AB]))?\s+construction\b/i
  ) || matchedValue(
    text,
    /\bType\s+(I{1,3}|IV|V)(?:\s*[- ]?\s*([AB]))?\s+construction\b[^.;?]{0,45}\b(?:building|structure|project)\b/i
  );
  const constructionMatch = text.match(/\bType\s+(I{1,3}|IV|V)(?:\s*[- ]?\s*([AB]))?\s+construction\b/i);
  if (constructionType && constructionMatch) {
    const type = canonicalConstructionType(`${constructionMatch[1]}${constructionMatch[2] || ""}`);
    add("construction_type", type, `The active-topic building is Type ${type} construction.`);
  }

  const buildingHeight = matchedValue(
    text,
    /\b(?:building|structure|project|it|this)\b[^.;?]{0,40}?\b(?:is|has a height of|height is)\s+([\d,]+(?:\.\d+)?)\s*(?:feet|ft\.?)\s+(?:high|in height)\b/i
  ) || (
    /\b(?:building|structure|project)\b/i.test(text)
      ? matchedValue(text, /\b([\d,]+(?:\.\d+)?)\s*(?:feet|ft\.?)\s+high\b/i)
      : ""
  );
  if (buildingHeight) add("building_height_feet", buildingHeight, `The active-topic building is ${formattedNumber(buildingHeight)} feet high.`);

  const floorLocation = matchedValue(
    text,
    /\b(?:work|alteration|space|room|project|application|it)\b[^.;?]{0,45}?\b(?:is|will be|occurs?|proposed)?\s*(?:on|at)\s+(?:the\s+)?([\d,]+(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+floor\b/i
  );
  if (floorLocation) {
    const floor = canonicalOrdinal(floorLocation);
    add("floor_location", floor, `The active-topic work or space is on floor ${formattedNumber(floor)}.`);
  }

  const travelDistance = matchedValue(
    text,
    /\b(?:the\s+|this\s+|its\s+)?(?:exit\s+access\s+)?travel\s+distance\s+(?:is|was|will be|of|equals?|were)\s+([\d,]+(?:\.\d+)?)\s*(?:feet|ft\.?)\b/i
  ) || (
    /\b(?:building|project|space|room|work|application|it|this)\b/i.test(text)
      ? matchedValue(text, /\b([\d,]+(?:\.\d+)?)\s*[- ]\s*(?:foot|ft\.?)\s+(?:exit\s+access\s+)?travel\s+distance\b/i)
      : ""
  );
  if (travelDistance && !startsWithLegalAuthority) add("travel_distance_feet", travelDistance, `The active-topic exit access travel distance is ${formattedNumber(travelDistance)} feet.`);

  const occupancy = occupancyFactValue(text);
  if (occupancy) add("occupancy_group", occupancy.toUpperCase(), `The active-topic building is Group ${occupancy.toUpperCase()}.`);

  if (/^(?:an?\s+)?existing\b[^.;?]{0,120}\b(?:building|structure|project)\b|\b(?:this|that)\s+is\s+an?\s+existing\b[^.;?]{0,80}\b(?:building|structure|project)\b|\b(?:this|the|an?)\s+(?:building|structure|project)\s+(?:is|was)\s+existing\b|\bexisting\s+(?:building|structure|project)\b/i.test(text)) {
    add("building_status", "existing", "The active-topic building is existing.");
  } else if (/^(?:an?\s+)?new\b[^.;?]{0,120}\b(?:building|structure|project)\b|\b(?:this|that)\s+is\s+an?\s+new\b[^.;?]{0,80}\b(?:building|structure|project)\b|\b(?:this|the|an?)\s+(?:building|structure|project)\s+(?:is|will be)\s+new\b|\bnew\s+(?:building|structure|project)\b/i.test(text)) {
    add("building_status", "new", "The active-topic building is new construction.");
  }

  const workScope = matchedValue(
    text,
    /\b(?:the\s+|this\s+)?(?:work|project|scope|application)\s+(?:is|was|will be|includes?|consists? of|involves?|proposes?)\s+(?:an?\s+)?(alteration|new construction|change of (?:occupancy|use))\b/i
  );
  if (workScope) {
    add("work_scope", workScope.toLowerCase(), `The active-topic work scope is ${workScope.toLowerCase()}.`);
  }

  const filingDate = matchedValue(
    text,
    /\b(?:the\s+|this\s+)?(?:application|project|work)\s+(?:was|is|will be)?\s*filed\s+(?:on\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/i
  );
  if (filingDate) {
    const date = canonicalDate(filingDate);
    add("filing_date", date, `The active-topic application filing date is ${date}.`);
  }

  const codeBasisYear = matchedValue(
    text,
    /\b(?:filed\b[^.;?]{0,50}?|designed\s+|reviewed\s+|evaluated\s+)under\s+(?:the\s+)?(20\d{2})\s+(?:NYC\s+|New York City\s+)?(?:Construction Codes?|Building Code|codes?)\b/i
  );
  if (codeBasisYear) add("code_basis_year", codeBasisYear, `The user-stated code basis year for the active topic is ${codeBasisYear}.`);

  if (
    /\b(?:is|are|will be|has been)\s+fully\s+sprinklered\b/i.test(text) ||
    (!startsWithLegalAuthority && /\b(?:building|structure|project|it|this)\b/i.test(text) && /\band\s+fully\s+sprinklered\b/i.test(text))
  ) {
    add("sprinkler_status", "fully_sprinklered", "The active-topic building is fully sprinklered.");
  } else if (/\b(?:is|are)\s+(?:not|un)\s*-?sprinklered\b|\bwithout\s+(?:an\s+)?automatic sprinkler/i.test(text)) {
    add("sprinkler_status", "not_sprinklered", "The active-topic building is not sprinklered.");
  }

  const use = matchedValue(
    text,
    /\b(?:space|room|building)\s+(?:is\s+)?(?:used|designed|arranged|intended)\s+(?:for|as)\s+(.+?)(?=\s+with\b|[.;?]|,\s*(?:and|but|under|what|which|how|why)\b|$)/i
  );
  if (use) add("use", use, `The active-topic space is used as ${use}.`);

  if (kind === researchConversationFactKinds.unknown) {
    if (/\bsprinkler(?:ed| status| system)?\b/i.test(text)) {
      add("sprinkler_status", "unknown", "The active-topic building's sprinkler status");
    }
    if (/\boccupancy(?: group| classification)?\b/i.test(text)) {
      add("occupancy_group", "unknown", "The active-topic building's occupancy group");
    }
    if (/\b(?:story|stories|story count)\b/i.test(text)) {
      add("story_count", "unknown", "The active-topic building's story count");
    }
    if (/\bconstruction type\b/i.test(text)) {
      add("construction_type", "unknown", "The active-topic building's construction type");
    }
    if (/\b(?:building )?height\b/i.test(text)) {
      add("building_height_feet", "unknown", "The active-topic building's height");
    }
    if (/\b(?:exit access )?travel distance\b/i.test(text)) {
      add("travel_distance_feet", "unknown", "The active-topic exit access travel distance");
    }
    if (/\boccupant load\b/i.test(text)) {
      add("occupant_load", "unknown", "The active-topic occupant load");
    }
  }

  if (kind === researchConversationFactKinds.unknown) {
    return facts.map((item) => ({
      ...item,
      value: "unknown",
      statement: `${item.statement.replace(/[.]$/, "")} is user-stated as unknown.`
    }));
  }
  return facts;
}

const qualifiedFactMentions = [
  ["sprinkler_status", /\bsprinkler(?:ed|s|ing| status| system| protection)?\b/i],
  ["building_status", /\b(?:existing|new)\b[^.;?]{0,80}\b(?:building|structure|project)\b|\b(?:building|structure|project)\b[^.;?]{0,40}\b(?:existing|new)\b/i],
  ["story_count", /\b(?:story|stories)\b/i],
  ["occupancy_group", /\b(?:occupancy|Group\s+[A-Z](?:-\d+)?)\b/i],
  ["construction_type", /\b(?:construction type|Type\s+[IV]+[AB]?\s+construction)\b/i],
  ["building_height_feet", /\bheight\b|\b(?:feet|ft)\s+high\b/i],
  ["occupant_load", /\boccupant load\b/i],
  ["occupant_count", /\boccupants?\b/i],
  ["travel_distance_feet", /\btravel distance\b/i],
  ["employee_count", /\bemployees?\b/i],
  ["dwelling_unit_count", /\bdwelling units?\b/i],
  ["area_square_feet", /\b(?:sf|sq\.?\s*ft\.?|square feet)\b/i],
  ["work_scope", /\b(?:work|scope|alteration|new construction|change of (?:use|occupancy))\b/i],
  ["floor_location", /\b(?:work|alteration|space|room)\b[^.;?]{0,60}\bfloor\b/i],
  ["use", /\b(?:space|room|building)\b[^.;?]{0,40}\b(?:used|designed|arranged|intended)\b/i],
  ["filing_date", /\bfiled\b/i],
  ["code_basis_year", /\bunder\b[^.;?]{0,40}\b20\d{2}\b/i]
];

function qualifiedFacts(question, topicDecision) {
  // Split independent sentences, but keep an embedded assumption with the
  // assertion it might qualify. Do not split decimal or thousands separators.
  const clauses = compactText(question)
    .split(/(?<=[.!?;])\s+(?=[A-Z])|;\s*/i)
    .filter(Boolean);
  const result = [];
  let hypotheticalScope = false;
  for (const clause of clauses) {
    if (/^(?:(?:AC|BC|EBC|FC|FGC|MC|PC)\b|Table\b|Section\b)/i.test(clause)) continue;
    const qualification = researchFactQualification(clause);
    hypotheticalScope ||= qualification.hypothetical;
    const kind = hypotheticalScope ? researchConversationFactKinds.hypothetical : turnKind(clause, topicDecision);
    // A question about a fact does not correct that fact, even when negated.
    if (!assertionLike(clause, kind, topicDecision)) continue;
    const extracted = structuredFacts(clause, kind, topicDecision);
    const sprinklerMention = /\bsprinkler(?:ed|s|ing| status| system| protection)?\b/i.test(clause);
    const limitedSprinklerScope = sprinklerMention && (
      /\b(?:floor|room|space|level|cellar|basement|portion|area|tenant|unit|wing)\b[^.;?]{0,40}\bsprinkler|\bsprinkler[^.;?]{0,40}\b(?:on|in|at|for)\b[^.;?]{0,30}\b(?:floor|room|space|level|cellar|basement|portion|area|tenant|unit|wing)\b|\b(?:above|below)\s+grade\b/i.test(clause) ||
      !extracted.some((item) => item.key === "sprinkler_status")
    );
    const requiresQualification = qualification.qualified || limitedSprinklerScope || kind === researchConversationFactKinds.unknown;
    if (requiresQualification || hypotheticalScope) {
      const keys = new Set(extracted.map((item) => item.key));
      for (const [key, pattern] of qualifiedFactMentions) {
        if (pattern.test(clause)) keys.add(key);
      }
      // Canonical categories cannot encode scope, negation or conditionality.
      // Keep the exact assertion and replace prior certainty for the same key.
      for (const key of keys) {
        result.push(fact({
          key,
          value: requiresQualification ? "unknown" : extracted.find((item) => item.key === key)?.value || "unknown",
          statement: `${hypotheticalScope ? "Turn-only hypothetical" : "Qualified user statement; do not infer an unqualified fact"}: ${clause}`,
          kind: hypotheticalScope ? researchConversationFactKinds.hypothetical : researchConversationFactKinds.unknown,
          sourceText: clause
        }));
      }
    } else {
      result.push(...extracted);
    }
  }
  return result;
}

function normalizedFactList(value, kind) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(value) ? value : []) {
    const key = compactText(item?.key, 240);
    const statement = compactText(item?.statement, 1_000);
    if (!key || !statement || seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: compactText(item?.id, 240) || key,
      key,
      value: compactText(item?.value, 500),
      statement,
      kind,
      sourceText: compactText(item?.sourceText, 1_000),
      source: "user",
      qualificationVersion: item?.qualificationVersion || null
    });
  }
  return result.slice(0, maximumFactsPerTopic);
}

function normalizedTopics(topicContext) {
  const result = [];
  for (const topic of Array.isArray(topicContext?.factTopics) ? topicContext.factTopics : []) {
    const rootTopic = compactText(topic?.rootTopic);
    if (!rootTopic || result.some((item) => normalizedTopic(item.rootTopic) === normalizedTopic(rootTopic))) continue;
    const established = normalizedFactList(topic?.establishedFacts, researchConversationFactKinds.established);
    const unknown = normalizedFactList(topic?.unknownFacts, researchConversationFactKinds.unknown);
    const revalidated = [];
    const needsConfirmation = [];
    for (const item of established) {
      if (item.qualificationVersion === researchConversationFactsVersion) {
        revalidated.push(item);
        continue;
      }
      const candidate = item.sourceText
        ? qualifiedFacts(item.sourceText, { decision: "continuation" }).filter((entry) => entry.key === item.key).at(-1)
        : null;
      if (candidate?.kind === researchConversationFactKinds.established) revalidated.push(candidate);
      else needsConfirmation.push(fact({
        key: item.key,
        value: "unknown",
        statement: `A prior saved fact requires reconfirmation. Original user wording: ${item.sourceText || item.statement}`,
        kind: researchConversationFactKinds.unknown,
        sourceText: item.sourceText || item.statement
      }));
    }
    result.push({
      rootTopic,
      establishedFacts: revalidated,
      unknownFacts: replaceByKey(needsConfirmation, unknown)
    });
  }
  return result.slice(0, maximumStoredTopics);
}

function replaceByKey(items, replacements) {
  const replacementKeys = new Set(replacements.map((item) => item.key));
  return [
    ...items.filter((item) => !replacementKeys.has(item.key)),
    ...replacements
  ].slice(-maximumFactsPerTopic);
}

export function resolveResearchConversationFacts({
  question,
  topicDecision,
  topicContext = null
} = {}) {
  const normalizedQuestion = compactText(question);
  if (!normalizedQuestion || !topicDecision) {
    throw new Error("Conversation facts require a question and topic decision.");
  }
  const rootTopic = compactText(topicDecision.nextRootTopic?.text || topicDecision.rootTopic?.text || normalizedQuestion);
  const topics = normalizedTopics(topicContext);
  let active = topics.find((topic) => normalizedTopic(topic.rootTopic) === normalizedTopic(rootTopic));
  if (!active) {
    active = { rootTopic, establishedFacts: [], unknownFacts: [] };
    topics.push(active);
  }

  const kind = turnKind(normalizedQuestion, topicDecision);
  const extracted = qualifiedFacts(normalizedQuestion, topicDecision);
  const hypotheticalFacts = extracted.filter((item) => item.kind === researchConversationFactKinds.hypothetical);
  const latestActiveFacts = [...new Map(extracted
    .filter((item) => item.kind !== researchConversationFactKinds.hypothetical)
    .map((item) => [item.key, item])).values()];
  const unknownFacts = latestActiveFacts.filter((item) => item.kind === researchConversationFactKinds.unknown);
  const establishedTurnFacts = latestActiveFacts.filter((item) => item.kind === researchConversationFactKinds.established);

  if (establishedTurnFacts.length) {
    active.establishedFacts = replaceByKey(active.establishedFacts, establishedTurnFacts);
    const establishedKeys = new Set(establishedTurnFacts.map((item) => item.key));
    active.unknownFacts = active.unknownFacts.filter((item) => !establishedKeys.has(item.key));
  }
  if (unknownFacts.length) {
    active.unknownFacts = replaceByKey(active.unknownFacts, unknownFacts);
    const unknownKeys = new Set(unknownFacts.map((item) => item.key));
    active.establishedFacts = active.establishedFacts.filter((item) => !unknownKeys.has(item.key));
  }

  const dedupedTopics = [];
  for (const topic of [...topics.filter((item) => item !== active), active]) {
    const existingIndex = dedupedTopics.findIndex(
      (item) => normalizedTopic(item.rootTopic) === normalizedTopic(topic.rootTopic)
    );
    if (existingIndex >= 0) dedupedTopics.splice(existingIndex, 1);
    dedupedTopics.push(topic);
  }
  const nextFactTopics = dedupedTopics.slice(-maximumStoredTopics).map((topic) => ({
    rootTopic: topic.rootTopic,
    establishedFacts: normalizedFactList(topic.establishedFacts, researchConversationFactKinds.established),
    unknownFacts: normalizedFactList(topic.unknownFacts, researchConversationFactKinds.unknown)
  }));

  return {
    schemaVersion: 1,
    factsVersion: researchConversationFactsVersion,
    activeRootTopic: rootTopic,
    turnKind: kind,
    establishedFacts: normalizedFactList(active.establishedFacts, researchConversationFactKinds.established),
    hypotheticalFacts: normalizedFactList(hypotheticalFacts, researchConversationFactKinds.hypothetical),
    unknownFacts: normalizedFactList(active.unknownFacts, researchConversationFactKinds.unknown),
    extractedFactKeys: extracted.map((item) => item.key),
    nextFactTopics
  };
}

export function researchConversationFactPromptContext(result) {
  const wording = (item) => item.sourceText && !item.statement.includes(item.sourceText)
    ? `${item.statement} Original user wording: ${item.sourceText}`
    : item.statement;
  return {
    established: (result?.establishedFacts || []).map(wording),
    hypothetical: (result?.hypotheticalFacts || []).map(wording),
    unknown: (result?.unknownFacts || []).map(wording)
  };
}
