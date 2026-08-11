export const researchConversationFactsVersion =
  "20260811-topic-scoped-user-facts-v1";

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

function fact({ key, value, statement, kind, sourceText }) {
  return {
    id: key,
    key,
    value: compactText(value, 500),
    statement: compactText(statement, 1_000),
    kind,
    sourceText: compactText(sourceText, 1_000),
    source: "user"
  };
}

function turnKind(question, topicDecision) {
  const text = compactText(question);
  if (/^(?:what if|suppose|assuming|assume|hypothetically)\b/i.test(text)) {
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

function structuredFacts(question, kind, topicDecision) {
  const text = compactText(question);
  if (!assertionLike(text, kind, topicDecision)) return [];
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

  const occupancy = matchedValue(
    text,
    /\b(?:building|space|project|it|this)\b[^.;?]{0,30}\b(?:is|as|contains?|includes?)\s+(?:an?\s+)?(?:occupancy\s+)?Group\s+([A-Z](?:-\d+)?)\b/i
  ) || matchedValue(
    text,
    /\b(?:is|as)\s+(?:an?\s+)?([A-Z]-\d+)\s+(?:occupancy|building)\b/i
  ) || matchedValue(
    text,
    /\b([A-Z]-\d+)\s+building\b/i
  );
  if (occupancy) add("occupancy_group", occupancy.toUpperCase(), `The active-topic building is Group ${occupancy.toUpperCase()}.`);

  if (/\b(?:is|are|will be|has been)\s+(?:fully\s+)?sprinklered\b/i.test(text)) {
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
      source: "user"
    });
  }
  return result.slice(0, maximumFactsPerTopic);
}

function normalizedTopics(topicContext) {
  const result = [];
  for (const topic of Array.isArray(topicContext?.factTopics) ? topicContext.factTopics : []) {
    const rootTopic = compactText(topic?.rootTopic);
    if (!rootTopic || result.some((item) => normalizedTopic(item.rootTopic) === normalizedTopic(rootTopic))) continue;
    result.push({
      rootTopic,
      establishedFacts: normalizedFactList(topic?.establishedFacts, researchConversationFactKinds.established),
      unknownFacts: normalizedFactList(topic?.unknownFacts, researchConversationFactKinds.unknown)
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
  const extracted = structuredFacts(normalizedQuestion, kind, topicDecision);
  const hypotheticalFacts = kind === researchConversationFactKinds.hypothetical ? extracted : [];
  const unknownFacts = kind === researchConversationFactKinds.unknown ? extracted : [];
  const establishedTurnFacts = kind === researchConversationFactKinds.established ? extracted : [];

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
  return {
    established: (result?.establishedFacts || []).map((item) => item.statement),
    hypothetical: (result?.hypotheticalFacts || []).map((item) => item.statement),
    unknown: (result?.unknownFacts || []).map((item) => item.statement)
  };
}
