export const researchConversationTopicVersion = "20260811-deterministic-topic-decision-v2";

export const researchConversationTopicDecisions = Object.freeze({
  continuation: "continuation",
  correction: "correction",
  relevanceComparison: "relevance_comparison",
  topicSwitch: "topic_switch"
});

const codePrefixes = "AC|BC|EBC|FC|FGC|MC|PC";
const stopWords = new Set([
  "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "but", "by", "can", "could", "did",
  "do", "does", "each", "explain", "for", "from", "has", "have", "how", "if", "in",
  "into", "is", "it", "may", "must", "of", "on", "or", "should", "so", "than", "that",
  "the", "their", "then", "there", "these", "this", "those", "to", "under", "use", "was",
  "what", "when", "where", "whether", "which", "while", "with", "without", "would"
]);

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function messageText(message) {
  if (typeof message === "string") return normalizedText(message);
  return normalizedText(message?.question || message?.content || message?.text);
}

function userMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => !(message && typeof message === "object" && message.role && message.role !== "user"))
    .map(messageText)
    .filter(Boolean);
}

function referenceIdentity(reference) {
  return [
    reference.codePrefix || "UNSPECIFIED",
    reference.referenceKind,
    reference.sectionNumber
  ].join(":");
}

function normalizedReference(codePrefix, sectionNumber, referenceKind = "section") {
  const prefix = normalizedText(codePrefix).toUpperCase();
  const number = normalizedText(sectionNumber).replace(/\.$/, "").toUpperCase();
  return {
    codePrefix: prefix || null,
    sectionNumber: number,
    referenceKind,
    reference: `${prefix ? `${prefix} ` : ""}${referenceKind === "table" ? "Table " : "§ "}${number}`
  };
}

export function extractResearchCodeReferences(value) {
  const text = normalizedText(value);
  const candidates = [];
  const add = (reference, index) => {
    if (reference.sectionNumber) candidates.push({ reference, index });
  };
  const hasSentenceBoundary = (between) => /[;!?]|\.(?:\s+[A-Z]|$)/.test(between);
  const directPattern = new RegExp(
    `\\b(${codePrefixes})\\s+(?:(Table)\\s+|§{1,2}\\s*)?([A-Z]?\\d+(?:-\\d+)?(?:\\.[0-9A-Za-z-]+)+)`,
    "gi"
  );
  const directMatches = Array.from(text.matchAll(directPattern));
  for (const match of directMatches) {
    add(normalizedReference(match[1], match[3], match[2] ? "table" : "section"), match.index);
  }
  const headingPattern = new RegExp(
    `\\bSECTION\\s+(${codePrefixes})\\s+[A-Z]?\\d+(?:-\\d+)?\\s*:[^\\n]{0,120}?\\b([A-Z]?\\d+(?:-\\d+)?(?:\\.[0-9A-Za-z-]+)+)\\b`,
    "gi"
  );
  for (const match of text.matchAll(headingPattern)) {
    add(normalizedReference(match[1], match[2], "section"), match.index);
  }
  const markedPattern = /\b(Table)\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)+)|§{1,2}\s*([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)+)/gi;
  for (const match of text.matchAll(markedPattern)) {
    const previousDirect = directMatches.filter((direct) => direct.index <= match.index).at(-1);
    const between = previousDirect
      ? text.slice(previousDirect.index + previousDirect[0].length, match.index)
      : text.slice(0, match.index);
    const inheritedPrefix = previousDirect && !hasSentenceBoundary(between) ? previousDirect[1] : "";
    add(normalizedReference(
      inheritedPrefix,
      match[2] || match[3],
      match[1] ? "table" : "section"
    ), match.index);
  }
  const continuationPattern = /(?:,|\b(?:and|or|through|to)\b)\s*(?:§{1,2}\s*)?([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)+)/gi;
  for (const match of text.matchAll(continuationPattern)) {
    const previousDirect = directMatches.filter((direct) => direct.index <= match.index).at(-1);
    if (!previousDirect) continue;
    const between = text.slice(previousDirect.index + previousDirect[0].length, match.index);
    if (hasSentenceBoundary(between)) continue;
    add(normalizedReference(previousDirect[1], match[1], "section"), match.index);
  }
  const references = [];
  const seen = new Set();
  for (const { reference } of candidates.sort((left, right) => left.index - right.index)) {
    const identity = referenceIdentity(reference);
    if (seen.has(identity)) continue;
    seen.add(identity);
    references.push(reference);
  }
  return references;
}

function topicRecord(text, source) {
  const normalized = normalizedText(text);
  return {
    text: normalized,
    source: normalized ? source : "none",
    codeReferences: extractResearchCodeReferences(normalized)
  };
}

function significantTokens(value) {
  return new Set(
    normalizedText(value).toLowerCase()
      .match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g)
      ?.filter((token) => token.length > 1 && !stopWords.has(token)) || []
  );
}

function tokenOverlap(left, right) {
  const leftTokens = significantTokens(left);
  const rightTokens = significantTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function sectionNumbersRelated(left, right) {
  if (left.referenceKind !== right.referenceKind) return false;
  if (left.codePrefix && right.codePrefix && left.codePrefix !== right.codePrefix) return false;
  return left.sectionNumber === right.sectionNumber ||
    left.sectionNumber.startsWith(`${right.sectionNumber}.`) ||
    right.sectionNumber.startsWith(`${left.sectionNumber}.`);
}

function referencesOverlap(questionReferences, topicReferences) {
  return questionReferences.some((questionReference) =>
    topicReferences.some((topicReference) => sectionNumbersRelated(questionReference, topicReference))
  );
}

export function researchQuestionReturnsToOriginalTopic(question) {
  return /\b(?:(?:back|return(?:ing)?|go back)\s+to\s+|what\s+about\s+)(?:the\s+|our\s+)?(?:original|first|earlier|initial)\b/i
    .test(normalizedText(question));
}

function decisionSignals(question, rootTopic, currentTopic) {
  const returnToOriginal = researchQuestionReturnsToOriginalTopic(question);
  const correction = /^(?:correction\b|actually\b|to clarify\b|clarification\b)|\bI meant\b|\bnot\s+.+\s+but\b|\brather than\b/i.test(question);
  const relevanceComparison =
    /\b(?:related|relevant|responsive|contribute|support|apply|applicable|compare|relationship)\b/i.test(question) &&
    /\b(?:main|original|first|root|prior|previous|earlier|question|answer|issue|topic|this|that)\b/i.test(question);
  const explicitSwitch = /^(?:new topic|different (?:topic|question)|separate(?:ly)?|unrelated (?:topic|question)|moving on|another (?:topic|question))\b/i.test(question);
  const projectSubjectContinuation = /^(?:the|this|that|our|my)\s+(?:building|structure|project|work|scope|space|room|application|occupant load|(?:exit access )?travel distance|construction type|building height)\b/i.test(question);
  const hypotheticalContinuation = /^(?:what if|suppose|assuming|assume|hypothetically)\b/i.test(question);
  const contextualContinuation =
    /^(?:why|how so|explain|tell me more|more details?|go on|what about)\b/i.test(question) ||
    /\b(?:it|its|that|this|those|these|them|they|same|above|remaining|further)\b/i.test(question) ||
    projectSubjectContinuation ||
    hypotheticalContinuation;
  const questionReferences = extractResearchCodeReferences(question);
  const topicReferences = [...rootTopic.codeReferences, ...currentTopic.codeReferences];
  const relatedReference = referencesOverlap(questionReferences, topicReferences);
  const disjointExplicitReference = questionReferences.length > 0 && topicReferences.length > 0 && !relatedReference;
  const rootTokenOverlap = tokenOverlap(question, rootTopic.text);
  const currentTokenOverlap = tokenOverlap(question, currentTopic.text);
  const maximumTokenOverlap = Math.max(rootTokenOverlap, currentTokenOverlap);
  const selfContained = significantTokens(question).size >= 4 && !contextualContinuation;
  return {
    returnToOriginal,
    correction,
    relevanceComparison,
    explicitSwitch,
    projectSubjectContinuation,
    hypotheticalContinuation,
    contextualContinuation,
    relatedReference,
    disjointExplicitReference,
    selfContained,
    rootTokenOverlap,
    currentTokenOverlap,
    maximumTokenOverlap,
    questionReferences
  };
}

function classification(signals, hasPriorTopic) {
  if (signals.returnToOriginal) return researchConversationTopicDecisions.continuation;
  if (signals.correction) return researchConversationTopicDecisions.correction;
  if (signals.relevanceComparison) return researchConversationTopicDecisions.relevanceComparison;
  if (!hasPriorTopic || signals.explicitSwitch || signals.disjointExplicitReference) {
    return researchConversationTopicDecisions.topicSwitch;
  }
  if (signals.contextualContinuation || signals.relatedReference || signals.maximumTokenOverlap >= 0.2) {
    return researchConversationTopicDecisions.continuation;
  }
  if (signals.selfContained) return researchConversationTopicDecisions.topicSwitch;
  return researchConversationTopicDecisions.continuation;
}

export function decideResearchConversationTopic({
  question,
  previousMessages = [],
  rootTopic = "",
  currentTopic = ""
} = {}) {
  const normalizedQuestion = normalizedText(question);
  if (!normalizedQuestion) throw new Error("A Research topic decision requires a question.");
  const messages = userMessages(previousMessages);
  const root = topicRecord(
    normalizedText(rootTopic) || messages[0] || "",
    normalizedText(rootTopic) ? "explicit_root" : messages[0] ? "conversation_root" : "none"
  );
  const current = topicRecord(
    normalizedText(currentTopic) || messages.at(-1) || root.text,
    normalizedText(currentTopic)
      ? "explicit_current"
      : messages.length
        ? "conversation_current"
        : root.text
          ? root.source
          : "none"
  );
  const signals = decisionSignals(normalizedQuestion, root, current);
  const decision = classification(signals, Boolean(root.text || current.text));
  const questionTopic = topicRecord(normalizedQuestion, "current_question");
  const switchesTopic = decision === researchConversationTopicDecisions.topicSwitch;
  const nextRoot = switchesTopic ? questionTopic : root.text ? root : questionTopic;
  const nextCurrent = decision === researchConversationTopicDecisions.relevanceComparison && current.text
    ? current
    : questionTopic;
  return {
    version: researchConversationTopicVersion,
    decision,
    question: questionTopic,
    rootTopic: root,
    currentTopic: current,
    nextRootTopic: nextRoot,
    nextCurrentTopic: nextCurrent,
    contextPolicy: {
      includeRootTopic: !switchesTopic && Boolean(root.text),
      includeCurrentTopic: !switchesTopic && !signals.returnToOriginal && Boolean(current.text),
      replaceRootTopic: switchesTopic
    },
    signals: {
      returnToOriginal: signals.returnToOriginal,
      correction: signals.correction,
      relevanceComparison: signals.relevanceComparison,
      explicitSwitch: signals.explicitSwitch,
      projectSubjectContinuation: signals.projectSubjectContinuation,
      hypotheticalContinuation: signals.hypotheticalContinuation,
      contextualContinuation: signals.contextualContinuation,
      relatedReference: signals.relatedReference,
      disjointExplicitReference: signals.disjointExplicitReference,
      selfContained: signals.selfContained,
      rootTokenOverlap: signals.rootTokenOverlap,
      currentTokenOverlap: signals.currentTokenOverlap
    }
  };
}
