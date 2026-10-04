import { researchPriorAnswerSources } from "./research-conversation-continuity.mjs";
import { researchQuestionSubject } from "./research-question-subject.mjs";
import { researchSearchVocabulary, researchLeadingTopicSwitch } from "./research-search-vocabulary.mjs";

export const researchConversationTopicVersion = "20261004-leading-modifier-topic-continuity-v13";

export const researchConversationTopicDecisions = Object.freeze({
  continuation: "continuation",
  correction: "correction",
  relevanceComparison: "relevance_comparison",
  topicSwitch: "topic_switch"
});

const codePrefixes = "AC|BC|EBC|FC|FGC|MC|PC|ZR";
const directReferenceNumber = String.raw`(?:[A-Z]?\d+-\d+(?:\.[0-9A-Za-z-]+)*|[A-Z]?\d+(?:\.[0-9A-Za-z-]+)+)`;
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
    `\\b(${codePrefixes})\\s+(?:(Table)\\s+|(Sections?)\\s+|§{1,2}\\s*)?(${directReferenceNumber})`,
    "gi"
  );
  const directMatches = Array.from(text.matchAll(directPattern));
  for (const match of directMatches) {
    add(normalizedReference(match[1], match[4], match[2] ? "table" : "section"), match.index);
  }
  const headingPattern = new RegExp(
    `\\bSECTION\\s+(${codePrefixes})\\s+[A-Z]?\\d+(?:-\\d+)?\\s*:[^\\n]{0,120}?\\b(${directReferenceNumber})\\b`,
    "gi"
  );
  for (const match of text.matchAll(headingPattern)) {
    add(normalizedReference(match[1], match[2], "section"), match.index);
  }
  const markedPattern = /\b(Table|Sections?)\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)|§{1,2}\s*([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi;
  for (const match of text.matchAll(markedPattern)) {
    const previousDirect = directMatches.filter((direct) => direct.index <= match.index).at(-1);
    const between = previousDirect
      ? text.slice(previousDirect.index + previousDirect[0].length, match.index)
      : text.slice(0, match.index);
    const inheritedPrefix = previousDirect && !hasSentenceBoundary(between) ? previousDirect[1] : "";
    add(normalizedReference(
      inheritedPrefix,
      match[2] || match[3],
      /^table$/i.test(match[1] || "") ? "table" : "section"
    ), match.index);
  }
  const continuationPattern = /(?:,|\b(?:and|or|through|to)\b)\s*(?:§{1,2}\s*)?([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi;
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

const subjectBoilerplate = new Set([
  ...stopWords, "allow", "allowed", "applicable", "applies", "apply", "code", "codes",
  "dimension", "dimensions", "general", "governing", "maximum", "minimum", "need",
  "needed", "normal", "nyc", "ordinary", "permit", "permitted", "require", "required",
  "requirement", "requirements", "requiring", "rule", "rules", "section", "sections",
  "size", "table", "tables"
]);

function subjectTokens(value) {
  return new Set((normalizedText(value).toLowerCase().match(/[a-z]+/g) || [])
    .filter(token => token.length > 2 && !subjectBoilerplate.has(token))
    .map(token => token.length > 4 && token.endsWith("s") && !token.endsWith("ss")
      ? token.slice(0, -1) : token));
}

function sourceMatchesNamedAuthority(question, source) {
  const families = new Set((question.match(/\b(?:AC|BC|EBC|FC|FGC|MC|PC|ZR)\b/gi) || []).map(value => value.toUpperCase()));
  const existingBuilding = /\bexisting\s+building\s+code\b/i.test(question);
  if (existingBuilding) families.add("EBC");
  if (/\bzoning\s+resolution\b/i.test(question)) families.add("ZR");
  for (const [family, name] of [["AC", "administrative"], ["BC", "building"], ["MC", "mechanical"], ["PC", "plumbing"], ["FGC", "fuel gas"], ["FC", "fire"]]) {
    if (family === "BC" && existingBuilding) continue;
    if (new RegExp(`\\b${name}\\s+code\\b`, "i").test(question)) families.add(family);
  }
  if (families.size && !families.has(source.codePrefix)) return false;
  const editions = [...question.matchAll(/\b((?:19|20)\d{2})\b[^.!?]{0,30}\b(?:edition|code)\b|\b(?:edition|code)\b[^.!?]{0,25}\b((?:19|20)\d{2})\b/gi)]
    .map(match => match[1] || match[2]);
  return !editions.length || editions.some(year => new RegExp(`\\b${year}\\b`).test(source.codeEdition || ""));
}

function citedSubjectContinuation(question, previousMessages) {
  const questionTokens = subjectTokens(question);
  if (questionTokens.size < 3) return false;
  // An implicit question may name a different detail in the provision just
  // discussed, even when it shares few words with the earlier user question.
  // Require several substantive terms in one local passage; shared units,
  // generic requirement language or scattered terms in a chapter do not count.
  return researchPriorAnswerSources(previousMessages).filter(source => sourceMatchesNamedAuthority(question, source)).some(source => {
    const passages = [source.title, ...source.selectedText.split(/(?<=[.!?])\s+(?=[A-Z])/)]
      .filter(text => text && text.length <= 1_200);
    return passages.some(passage => {
      const passageTokens = subjectTokens(passage);
      const matches = [...questionTokens].filter(token => passageTokens.has(token)).length;
      return matches >= 3 && matches / questionTokens.size >= 0.4;
    });
  });
}

function causalSubjectContinuation(question, rootTopic, currentTopic, previousMessages) {
  // A user may move from a component's dimensions to its failure protection
  // without repeating its full name: "Since a blocked drain ...". Recognize
  // this only within the latest checked subject, never as code applicability.
  const opening = question.match(/^(?:since|because|given(?:\s+that)?|now\s+that)\s+([^,?!;]{1,400})/i)?.[1];
  if (!opening || extractResearchCodeReferences(question).length) return false;
  const answer = (Array.isArray(previousMessages) ? previousMessages : [])
    .findLast(message => message?.role === "assistant")?.answer;
  if (!Array.isArray(answer?.supportedPoints) || !answer.supportedPoints.length) return false;
  const sources = researchPriorAnswerSources(previousMessages).filter(source =>
    source.sectionID !== null && source.sectionID !== undefined &&
    source.corpusID && source.codeVersion && source.codeEdition && source.title && source.selectedText &&
    sourceMatchesNamedAuthority(question, source));
  if (!sources.length) return false;

  // Use the head of the opening causal subject. A newly introduced modifier
  // ("a roof drain" after a different drain) is not an implicit same-object
  // reference. Ordinary state adjectives ending in -ed do not name equipment.
  const phrase = opening.match(/^(?:a|an|the|our|my|this|that|its)\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,5})/i)?.[1];
  if (!phrase) return false;
  const words = [];
  for (const word of phrase.toLowerCase().match(/[a-z][a-z-]*/g) || []) {
    if (stopWords.has(word) || /^(?:will|shall|fail|fails|failed|leak|leaks|overflows?)$/.test(word)) break;
    words.push(word);
  }
  const head = words.at(-1);
  if (!head || /^(?:building|structure|project|property|system|equipment|unit|appliance)$/.test(head)) return false;
  const priorSubjects = subjectTokens(`${rootTopic} ${currentTopic}`);
  const [subject] = subjectTokens(head);
  if (!subject || !priorSubjects.has(subject)) return false;
  if (words.slice(0, -1).some(word => !/ed$/.test(word) &&
    ![...subjectTokens(word)].every(token => priorSubjects.has(token)))) return false;

  const questionTokens = subjectTokens(question);
  if (questionTokens.size < 3) return false;
  return sources.some(source => {
    const titleTokens = subjectTokens(source.title);
    const passages = source.selectedText.split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter(value => value && value.length <= 1_200);
    return passages.some(passage => {
      const passageTokens = subjectTokens(passage);
      if (!titleTokens.has(subject) && !passageTokens.has(subject)) return false;
      // Absolute detail matches are sufficient only with the causal subject
      // checks above. Keep the ordinary 40% citation threshold unchanged.
      return [...questionTokens].filter(token => passageTokens.has(token)).length >= 3;
    });
  });
}

function definiteSubjectContinuation(question, rootTopic, currentTopic) {
  // A phrase such as "the surface" refers back to a subject even if the last
  // answer failed and therefore supplies no verified citation. Match the noun
  // at the end of a short phrase, not a shared modifier such as "office".
  // Fully introduced settings remain subject to the ordinary topic signals.
  if (/^(?:for|in)\s+(?:a|an|another|different)\b/i.test(question)) return false;
  const priorSubjects = subjectTokens(`${rootTopic} ${currentTopic}`);
  const phraseStops = new Set([
    ...stopWords, "will", "shall", "need", "needs", "require", "requires",
    "meet", "meets", "satisfy", "satisfies", "apply", "applies", "count", "counts"
  ]);
  const genericHeads = new Set(["building", "structure", "project", "property"]);
  for (const match of question.matchAll(/\bthe\s+((?:[a-z][a-z-]*\s*){1,6})/gi)) {
    const phrase = [];
    for (const word of match[1].toLowerCase().match(/[a-z][a-z-]*/g) || []) {
      if (phraseStops.has(word)) break;
      phrase.push(word);
    }
    const head = phrase.at(-1);
    if (!head || genericHeads.has(head)) continue;
    const [subject] = subjectTokens(head);
    if (subject && priorSubjects.has(subject)) return true;
  }
  return false;
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

function humanVocabularySubjectContinuation(question, rootTopic, currentTopic, explicitSwitch) {
  if (explicitSwitch || !rootTopic.text && !currentTopic.text) return false;
  const references = extractResearchCodeReferences(question);
  const priorReferences = [...rootTopic.codeReferences, ...currentTopic.codeReferences];
  if (references.length && priorReferences.length && !referencesOverlap(references, priorReferences)) return false;
  const currentPrefixes = new Set([
    ...researchQuestionSubject(question).codePrefixes,
    ...references.map(reference => reference.codePrefix).filter(Boolean)
  ]);
  // Only the shared positive vocabulary can resolve an omitted user subject.
  // Current named/recognized equipment and references keep their own family;
  // assistant claims, source titles and private topic-specific aliases cannot.
  const vocabulary = researchSearchVocabulary(question, {
    contextDependentFollowUp: true,
    humanTopics: [rootTopic.text, currentTopic.text]
  });
  return vocabulary.concepts.some(concept => concept.origin === "human_context" &&
    [...currentPrefixes].every(prefix => concept.codePrefixes.includes(prefix)));
}

export function researchQuestionReturnsToOriginalTopic(question) {
  return /\b(?:(?:back|return(?:ing)?|go back)\s+to\s+|what\s+about\s+)(?:the\s+|our\s+)?(?:original|first|earlier|initial)\b/i
    .test(normalizedText(question));
}

export function researchQuestionExplicitlySwitchesTopic(question) {
  // Only an affirmative leading user instruction changes the topic here.
  // Quoted examples, negated mentions and a shared project/location do not.
  return researchLeadingTopicSwitch(normalizedText(question));
}

function decisionSignals(question, rootTopic, currentTopic, previousMessages) {
  const returnToOriginal = researchQuestionReturnsToOriginalTopic(question);
  const explicitSwitch = researchQuestionExplicitlySwitchesTopic(question);
  const correction = /^(?:correction\b|actually\b|to clarify\b|clarification\b)|\bI meant\b|\bnot\s+.+\s+but\b|\brather than\b/i.test(question);
  // A scope exclusion is not a request to compare this source with a prior topic.
  // A request to cite the relevant rule identifies supporting authority; it
  // does not ask whether the previous answer is relevant to another topic.
  const comparisonQuestion = question.replace(
    /\b(?:cite|identify|give|provide|include|state)\s+(?:me\s+)?(?:the\s+)?(?:relevant|applicable|supporting|related)\s+(?:code\s+)?(?:rules?|sections?|provisions?|citations?|references?|authority)\b/gi,
    ""
  ).replace(
    /\b(?:do not|don't)\s+apply\s+(?:it|this|that|the (?:section|provision|text))\s+to\s+[^.!?]*(?:[.!?]|$)/gi,
    ""
  );
  const comparesSourceRelevance =
    /\b(?:main|original|first|root|prior|previous|earlier)\b[^.!?]{0,50}\b(?:question|answer|issue|topic|claim|decision)\b|\b(?:this|that|my|our|your|the)\s+(?:question|answer|issue|topic|claim)\b/i.test(comparisonQuestion) ||
    /\b(?:is|are|was|were)\s+(?:this|that|these|those|the)\s+(?:text|sections?|provisions?|sources?|citations?|rules?)\b[^.!?]{0,40}\b(?:related|relevant|responsive|applicable)\b/i.test(comparisonQuestion) ||
    (/\b(?:compare|relationship)\b/i.test(comparisonQuestion) && extractResearchCodeReferences(comparisonQuestion).length >= 2);
  const relevanceComparison = comparesSourceRelevance &&
    /\b(?:related|relevant|responsive|contribute|support|apply|applicable|compare|relationship)\b/i.test(comparisonQuestion) &&
    !explicitSwitch;
  const projectSubjectContinuation = /^(?:the|this|that|our|my)\s+(?:building|structure|project|work|scope|space|room|application|occupant load|(?:exit access )?travel distance|construction type|building height)\b/i.test(question);
  const hypotheticalContinuation = /^(?:what if|suppose|assuming|assume|hypothetically)\b/i.test(question);
  const formatTransformation =
    /\b(?:summari[sz]e|rewrite|restate|condense|make|give)\b[\s\S]{0,100}\b(?:short|brief|concise|paragraph|quick|quickly|simpler?)\b/i.test(question) ||
    /\b(?:short|brief|concise|quick)\b[\s\S]{0,80}\b(?:summary|paragraph|version|explanation)\b/i.test(question);
  const uncertaintyContinuation = /^(?:(?:i(?:['’]m| am)|we(?:['’]re| are)) (?:not sure|unsure)|(?:i|we) (?:do not|don['’]t) know|what should (?:i|we) check (?:first|next))\b/i.test(question);
  const explicitFollowUp = /^(?:then\b|and\b|yes\b|so\b|where should (?:I|we) measure\b|what is the governing\b)/i.test(question);
  const definiteSubject = definiteSubjectContinuation(question, rootTopic.text, currentTopic.text);
  const causalSubject = !explicitSwitch && causalSubjectContinuation(question, rootTopic.text, currentTopic.text, previousMessages);
  const vocabularySubject = humanVocabularySubjectContinuation(question, rootTopic, currentTopic, explicitSwitch);
  const contextualContinuation =
    explicitFollowUp ||
    /^(?:why|how so|explain|tell me more|more details?|go on|what about)\b/i.test(question) ||
    /\b(?:it|its|that|this|those|these|them|they|same|above|remaining|further)\b/i.test(question) ||
    uncertaintyContinuation ||
    formatTransformation ||
    projectSubjectContinuation ||
    hypotheticalContinuation ||
    definiteSubject ||
    causalSubject ||
    vocabularySubject;
  const questionReferences = extractResearchCodeReferences(question);
  const topicReferences = [...rootTopic.codeReferences, ...currentTopic.codeReferences];
  const relatedReference = referencesOverlap(questionReferences, topicReferences);
  const disjointExplicitReference = questionReferences.length > 0 && topicReferences.length > 0 && !relatedReference;
  const rootTokenOverlap = tokenOverlap(question, rootTopic.text);
  const currentTokenOverlap = tokenOverlap(question, currentTopic.text);
  const maximumTokenOverlap = Math.max(rootTokenOverlap, currentTokenOverlap);
  const citedSubject = citedSubjectContinuation(question, previousMessages);
  const selfContained = significantTokens(question).size >= 4 && !contextualContinuation;
  return {
    returnToOriginal,
    correction,
    relevanceComparison,
    explicitSwitch,
    projectSubjectContinuation,
    hypotheticalContinuation,
    formatTransformation,
    contextualContinuation,
    explicitFollowUp,
    relatedReference,
    disjointExplicitReference,
    selfContained,
    rootTokenOverlap,
    currentTokenOverlap,
    maximumTokenOverlap,
    citedSubjectContinuation: citedSubject,
    causalSubjectContinuation: causalSubject,
    definiteSubjectContinuation: definiteSubject,
    humanVocabularySubjectContinuation: vocabularySubject,
    questionReferences
  };
}

function classification(signals, hasPriorTopic) {
  if (signals.returnToOriginal) return researchConversationTopicDecisions.continuation;
  if (signals.explicitSwitch) return researchConversationTopicDecisions.topicSwitch;
  if (signals.correction) return researchConversationTopicDecisions.correction;
  if (signals.relevanceComparison) return researchConversationTopicDecisions.relevanceComparison;
  if (hasPriorTopic && signals.explicitFollowUp) return researchConversationTopicDecisions.continuation;
  if (!hasPriorTopic || signals.explicitSwitch || signals.disjointExplicitReference) {
    return researchConversationTopicDecisions.topicSwitch;
  }
  if (signals.contextualContinuation || signals.relatedReference || signals.citedSubjectContinuation || signals.maximumTokenOverlap >= 0.2) {
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
  const signals = decisionSignals(normalizedQuestion, root, current, previousMessages);
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
      formatTransformation: signals.formatTransformation,
      contextualContinuation: signals.contextualContinuation,
      citedSubjectContinuation: signals.citedSubjectContinuation,
      causalSubjectContinuation: signals.causalSubjectContinuation,
      definiteSubjectContinuation: signals.definiteSubjectContinuation,
      humanVocabularySubjectContinuation: signals.humanVocabularySubjectContinuation,
      relatedReference: signals.relatedReference,
      disjointExplicitReference: signals.disjointExplicitReference,
      selfContained: signals.selfContained,
      rootTokenOverlap: signals.rootTokenOverlap,
      currentTokenOverlap: signals.currentTokenOverlap
    }
  };
}
