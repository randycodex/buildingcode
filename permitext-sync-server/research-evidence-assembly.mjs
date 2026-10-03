import {
  prioritizeResearchEvidence,
  researchEvidencePriorityMetadata
} from "./research-evidence-priority.mjs";
import {
  decideResearchConversationTopic,
  researchConversationTopicDecisions,
  researchQuestionReturnsToOriginalTopic,
  extractResearchCodeReferences
} from "./research-conversation-topic.mjs";
import { targetedDefinitionExcerpt } from "./research-definition-excerpts.mjs";
import { targetedZoningContextExcerpt, isCompleteSectionSelection } from "./research-zoning-context-excerpts.mjs";
import { researchTopicDependencyPlan, sameTopicDependencyCorpus } from "./research-topic-dependencies.mjs";
import { focusedTechnicalCandidates } from "./research-focused-technical-scope.mjs";
import {
  researchRulePacketPlan, suppliedRuleReference, researchMeasurementRecoveryQuery,
  researchCanonicalApplicabilityContext
} from "./research-rule-packets.mjs";
import { asksForZoningAmendmentHistoryEvents, requestedZoningAmendmentHistory, zoningAmendmentHistoryRecord } from "./research-zoning-metadata.mjs";
import { createHash } from "node:crypto";
import { researchPriorAnswerSources, researchInheritedAuthorityReferences } from "./research-conversation-continuity.mjs";
import { researchInterpretationContextPlan, resolveResearchInterpretationContext } from "./research-interpretation-context.mjs";
import {
  semanticResearchProjectFacts, relevantResearchRetrievalFactContext,
  semanticResearchScenarioText, semanticResearchSubjectContext, researchQueryInheritedReferences
} from "./research-retrieval-query-context.mjs";

export const researchEvidenceAssemblyVersion = "20261003-complete-table-context-v58";

export const researchEvidenceAssemblyLimits = Object.freeze({
  maximumCandidates: 12,
  maximumDiscovered: 10,
  maximumTargetedDefinitions: 2,
  maximumCrossReferences: 6,
  maximumTopicDependencies: 14,
  maximumCharacters: 48_000,
  maximumSupplementalCharacters: 48_000,
  maximumCharactersPerSource: 12_000
});

export const researchPinnedEvidenceAssemblyLimits = Object.freeze({
  maximumDiscovered: 4,
  maximumTargetedDefinitions: 2,
  maximumCrossReferences: 3
});

const sourceOrigins = Object.freeze({
  pinned: "user_pinned",
  discovered: "permitext_discovered",
  crossReference: "permitext_cross_reference"
});

const maximumPinnedAncestorContextSections = 3;

function topicDependencyPriority(priority, plan, reference) {
  // Retrieving alternative frontage frameworks does not establish that both
  // govern. A direct user request or pin still owns its coverage obligation;
  // otherwise the writer may select a source-supported applicable route.
  if (reference?.applicabilityCandidate && ![
    "user-pinned enacted evidence", "exact enacted reference requested by the user"
  ].includes(priority?.claimCoverageReason)) {
    const functions = (priority?.functions || []).filter(value => value !== "controlling_rule");
    return { ...priority, evidenceRole: "supporting", functions,
      primaryFunction: functions[0] || "candidate", claimCoverageRequired: false,
      claimCoverageReason: null, reviewedDependencyReason: plan.coverageReason,
      applicabilityCandidate: true };
  }
  // Optional review sources must not become mandatory answer claims. Preserve
  // any independently established governing status instead of downgrading it.
  if (reference?.claimCoverageRequired === false) return {
    ...priority, reviewedDependencyReason: plan.coverageReason
  };
  return { ...priority, evidenceRole: "governing", claimCoverageRequired: true,
    claimCoverageReason: plan.coverageReason };
}

export const researchEvidenceStrategies = Object.freeze({
  broad: "broad",
  pinnedFirst: "pinned_first"
});

const selectedEvidenceCuePattern = /\b(?:selected|pinned)\s+(?:code\s+)?(?:passage|passages|evidence|text)|\b(?:both|this|these|the)\s+(?:selected\s+)?(?:passage|passages|provision|provisions|text)\b/i;
const strictSelectedEvidenceBoundaryPattern = /\b(?:based|using|relying)\s+only\s+on\s+(?:the\s+)?selected\s+(?:(?:building\s+)?code\s+)?(?:passage|passages|evidence|text)\b|\busing\s+only\s+(?:the\s+)?(?:selected|pinned)\s+(?:(?:building\s+)?code\s+)?(?:passages?|evidence|text|tables?)\b|\bbased\s+only\s+on\s+(?:the\s+)?selected\b|\bfrom\s+(?:the\s+)?selected\s+(?:(?:building\s+)?code\s+)?(?:passage|passages|evidence|text)\b/i;
const broaderEvidenceCuePattern = /\b(?:applicab(?:le|ility)|comply|compliance|exception|exceptions|definition|definitions|defined|table|tables|calculate|calculation|other provisions?|additional provisions?|related provisions?|cross[- ]references?|project[- ]specific|verify|verification)\b/i;

function explicitCodeReferences(value) {
  return Array.from(String(value || "").matchAll(
    /\b(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+(?:§\s*)?([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Z-]+)*)/gi
  )).map((match) => `${String(match[1]).toUpperCase()}:${String(match[2]).toUpperCase()}`);
}

export function researchEvidenceStrategyForTurn({
  question,
  pinnedEvidence = [],
  originSurface = ""
} = {}) {
  const normalizedOriginSurface = String(originSurface || "").trim().toLowerCase();
  const readerOrigin = normalizedOriginSurface === "reader" || normalizedOriginSurface.endsWith("-reader");
  if (!pinnedEvidence.length) {
    return { mode: researchEvidenceStrategies.broad, reason: "default_authorized_retrieval" };
  }
  const normalizedQuestion = compactText(question);
  if (strictSelectedEvidenceBoundaryPattern.test(normalizedQuestion)) {
    return {
      mode: researchEvidenceStrategies.pinnedFirst,
      reason: "question_explicitly_bounded_to_selected_evidence"
    };
  }
  if (!readerOrigin) {
    return { mode: researchEvidenceStrategies.broad, reason: "default_authorized_retrieval" };
  }
  if (!selectedEvidenceCuePattern.test(normalizedQuestion)) {
    return { mode: researchEvidenceStrategies.broad, reason: "question_not_bounded_to_selected_evidence" };
  }
  if (broaderEvidenceCuePattern.test(normalizedQuestion)) {
    return { mode: researchEvidenceStrategies.broad, reason: "question_requests_broader_legal_context" };
  }
  const pinnedReferences = new Set(pinnedEvidence.map((source) => {
    const codePrefix = compactText(source?.codePrefix).toUpperCase();
    const sectionNumber = compactText(source?.sectionNumber).replace(/\.$/, "").toUpperCase();
    return codePrefix && sectionNumber ? `${codePrefix}:${sectionNumber}` : "";
  }).filter(Boolean));
  const outsideReferences = explicitCodeReferences(normalizedQuestion)
    .filter((reference) => !pinnedReferences.has(reference));
  if (outsideReferences.length) {
    return { mode: researchEvidenceStrategies.broad, reason: "question_names_unselected_citation" };
  }
  return { mode: researchEvidenceStrategies.pinnedFirst, reason: "reader_question_bounded_to_selected_evidence" };
}

function compactText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function appliedLimits(value = {}) {
  return {
    maximumTopicDependencies: positiveInteger(
      value.maximumTopicDependencies,
      researchEvidenceAssemblyLimits.maximumTopicDependencies,
      researchEvidenceAssemblyLimits.maximumTopicDependencies
    ),
    maximumCandidates: positiveInteger(
      value.maximumCandidates,
      researchEvidenceAssemblyLimits.maximumCandidates,
      researchEvidenceAssemblyLimits.maximumCandidates
    ),
    maximumDiscovered: positiveInteger(
      value.maximumDiscovered,
      researchEvidenceAssemblyLimits.maximumDiscovered,
      researchEvidenceAssemblyLimits.maximumDiscovered
    ),
    maximumTargetedDefinitions: positiveInteger(
      value.maximumTargetedDefinitions,
      researchEvidenceAssemblyLimits.maximumTargetedDefinitions,
      researchEvidenceAssemblyLimits.maximumTargetedDefinitions
    ),
    maximumCrossReferences: positiveInteger(
      value.maximumCrossReferences,
      researchEvidenceAssemblyLimits.maximumCrossReferences,
      researchEvidenceAssemblyLimits.maximumCrossReferences
    ),
    maximumCharacters: positiveInteger(
      value.maximumCharacters,
      researchEvidenceAssemblyLimits.maximumCharacters,
      researchEvidenceAssemblyLimits.maximumCharacters
    ),
    maximumSupplementalCharacters: positiveInteger(
      value.maximumSupplementalCharacters,
      researchEvidenceAssemblyLimits.maximumSupplementalCharacters,
      researchEvidenceAssemblyLimits.maximumCharacters
    ),
    maximumCharactersPerSource: positiveInteger(
      value.maximumCharactersPerSource,
      researchEvidenceAssemblyLimits.maximumCharactersPerSource,
      researchEvidenceAssemblyLimits.maximumCharactersPerSource
    )
  };
}

function messageText(message) {
  if (typeof message === "string") return compactText(message);
  return compactText(message?.content || message?.text || message?.question);
}

function previousConversationTopic(messages) {
  const entries = Array.isArray(messages) ? messages : [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry && typeof entry === "object" && entry.role && entry.role !== "user") continue;
    const text = messageText(entry);
    if (text) return text;
  }
  return "";
}

// An explicit request to discuss the rule independently of the saved project
// persists only through the topics the conversation resolver actually retains.
function excludesSavedProjectFacts(question, contextualTopics) {
  const explicitGeneral = value => /\bgeneral rule question\b|\bnot (?:a |an )?(?:determination|assessment|decision) for (?:my|our|this|the)\b|\b(?:ignore|do not use|don't use) (?:the )?(?:saved )?project facts\b/i.test(value);
  const scope = value => {
    if (explicitGeneral(value)) return true;
    if (/\b(?:my|our) (?:project|building|office|work)\b|\b(?:apply|applies|applicable)\b.*\b(?:project|building)\b/i.test(value)) return false;
    return null;
  };
  for (const text of [question, ...[...contextualTopics].reverse().map(context => context.text)]) {
    const decision = scope(text);
    if (decision !== null) return decision;
  }
  return false;
}

export function researchEvidenceRetrievalQuery({
  question,
  previousTopic = "",
  previousMessages = [],
  projectFacts = [],
  topicContext = null
} = {}) {
  const normalizedQuestion = compactText(question);
  if (!normalizedQuestion) {
    throw new Error("Research evidence assembly requires a text question.");
  }
  if (normalizedQuestion.length > 2_000) {
    throw new Error("Research questions may contain no more than 2,000 characters.");
  }
  const explicitTopic = compactText(previousTopic);
  const storedOriginalTopic = compactText(topicContext?.originalTopic);
  const storedRootTopic = compactText(topicContext?.rootTopic);
  const storedCurrentTopic = compactText(topicContext?.currentTopic);
  const returningToOriginal = researchQuestionReturnsToOriginalTopic(normalizedQuestion);
  const topicDecision = decideResearchConversationTopic({
    question: normalizedQuestion,
    previousMessages,
    rootTopic: (returningToOriginal ? storedOriginalTopic : storedRootTopic) || explicitTopic,
    currentTopic: storedCurrentTopic || explicitTopic
  });
  const rootTopic = topicDecision.rootTopic.text;
  const immediateTopic = topicDecision.currentTopic.text || previousConversationTopic(previousMessages);
  const maximumQueryCharacters = 2_000;
  let retrievalQuery = normalizedQuestion;
  let previousTopicApplied = false;
  const relevanceComparison = topicDecision.decision ===
    researchConversationTopicDecisions.relevanceComparison;
  const contextDependentFollowUp = topicDecision.decision !==
    researchConversationTopicDecisions.topicSwitch;
  const contextualTopics = [];
  const distinctCurrentTopic = Boolean(
    topicDecision.contextPolicy.includeCurrentTopic &&
    immediateTopic &&
    compactText(immediateTopic) !== compactText(rootTopic)
  );
  if (topicDecision.contextPolicy.includeRootTopic && rootTopic) {
    contextualTopics.push({
      label: distinctCurrentTopic ? "Root topic" : "Previous topic",
      text: rootTopic
    });
  }
  if (distinctCurrentTopic) {
    contextualTopics.push({ label: "Previous topic", text: immediateTopic });
  }
  if (
    topicDecision.contextPolicy.includeCurrentTopic &&
    immediateTopic &&
    contextualTopics.length === 0
  ) {
    contextualTopics.push({ label: "Previous topic", text: immediateTopic });
  }
  if (contextualTopics.length) {
    const followUpPrefix = "Follow-up: ";
    let contextualQuery = `${followUpPrefix}${normalizedQuestion}`;
    let contextualTopicAdded = false;
    for (const [contextIndex, context] of contextualTopics.entries()) {
      const prefix = `\n${context.label}: `;
      const availableCharacters = maximumQueryCharacters - contextualQuery.length - prefix.length;
      if (availableCharacters < 1) break;
      const remainingContexts = contextualTopics.length - contextIndex;
      const fairContextCharacters = Math.max(1, Math.floor(availableCharacters / remainingContexts));
      contextualQuery += `${prefix}${context.text.slice(0, fairContextCharacters)}`;
      contextualTopicAdded = true;
    }
    if (contextualTopicAdded) {
      retrievalQuery = contextualQuery;
      previousTopicApplied = true;
    }
  }
  const checkedPriorSources = contextDependentFollowUp
    ? researchPriorAnswerSources(previousMessages) : [];
  const inheritedAuthorityReferences = contextDependentFollowUp &&
      !extractResearchCodeReferences(normalizedQuestion).length &&
      !/\b\d{1,3}-\d{2,4}\b/.test(normalizedQuestion)
    ? researchQueryInheritedReferences(normalizedQuestion,
      researchInheritedAuthorityReferences({ question: normalizedQuestion, previousMessages, topicDecision })) : [];
  // Carry the discussed citation into a short follow-up. An explicit new
  // citation takes precedence over previously discussed provisions.
  if (inheritedAuthorityReferences.length) retrievalQuery = `${retrievalQuery}\nPreviously discussed provisions: ${inheritedAuthorityReferences.map(reference => reference.reference).join(", ")}`.slice(0, maximumQueryCharacters);
  const sourceQuery = retrievalQuery;
  // Meaning search should answer the new detail, rather than repeatedly find
  // the previous answer's detail. Short source titles resolve the subject;
  // previous measurements and conclusions do not enter a substantive query.
  const substantiveTerms = questionSpecificTerms(normalizedQuestion);
  const semanticContext = semanticResearchSubjectContext({ question: normalizedQuestion, contextualTopics,
    checkedPriorSources, contextDependentFollowUp,
    returnToOriginal: topicDecision.signals?.returnToOriginal, substantiveTerms });
  // Do not make explicitly excluded examples the subject of meaning search.
  // The complete question, including these exclusions, still goes to corpus
  // routing and the answer/verifier as the user's scenario.
  const semanticQuestion = semanticResearchScenarioText(normalizedQuestion);
  let semanticQuery = semanticQuestion;
  if (semanticContext) {
    const prefix = "\nSubject context: ";
    if (semanticQuery.length + prefix.length + semanticContext.length <= maximumQueryCharacters) semanticQuery += `${prefix}${semanticContext}`;
  }
  const semanticFactPrefix = "\nProject search context (supplied facts, not applicability): ";
  const semanticFactContext = excludesSavedProjectFacts(normalizedQuestion, contextualTopics) ? ""
    : semanticResearchProjectFacts({ question: normalizedQuestion, contextualTopics, projectFacts,
      maximumCharacters: maximumQueryCharacters - semanticQuery.length - semanticFactPrefix.length });
  if (semanticFactContext) semanticQuery += `${semanticFactPrefix}${semanticFactContext}`;
  let projectFactsApplied = false;
  if (!excludesSavedProjectFacts(normalizedQuestion, contextualTopics)) {
    const factsPrefix = "\nProject facts: ";
    const availableFactCharacters = maximumQueryCharacters - retrievalQuery.length - factsPrefix.length;
    const factContext = relevantResearchRetrievalFactContext({ question: normalizedQuestion,
      contextualTopics, projectFacts, maximumCharacters: availableFactCharacters, queryMode: "lexical" });
    if (factContext) {
      // The selector returns complete assertions with their original scope.
      // Never cut a negation, scenario qualifier or measurement mid-statement.
      retrievalQuery += `${factsPrefix}${factContext}`;
      projectFactsApplied = true;
    }
  }
  return {
    question: normalizedQuestion,
    sourceQuery,
    semanticQuery,
    inheritedAuthorityReferences,
    retrievalQuery: retrievalQuery.trim(),
    previousTopicApplied,
    projectFactsApplied,
    contextDependentFollowUp,
    relevanceComparison,
    conversationTopic: topicDecision.decision === researchConversationTopicDecisions.topicSwitch
      ? topicDecision.nextRootTopic.text
      : rootTopic || immediateTopic,
    immediateContext: topicDecision.decision === researchConversationTopicDecisions.topicSwitch
      ? normalizedQuestion
      : immediateTopic,
    topicDecision
  };
}

function sectionIdentity(value) {
  const sectionID = compactText(value?.sectionID || value?.id);
  if (sectionID) return `id:${sectionID}`;
  const codePrefix = compactText(value?.codePrefix).toUpperCase();
  const sectionNumber = compactText(value?.sectionNumber).toUpperCase();
  const edition = compactText(value?.corpusID || value?.codeVersion);
  return codePrefix && sectionNumber ? `reference:${codePrefix}:${sectionNumber}${edition ? `:${edition}` : ""}` : "";
}

function canonicalText(value) {
  const direct = compactText(
    value?.canonicalText || value?.text || value?.selectedText || value?.passageText
  );
  if (direct) return direct;
  const bodyText = (Array.isArray(value?.body?.blocks) ? value.body.blocks : [])
    .map((block) => compactText(block?.plainText))
    .filter(Boolean)
    .join("\n\n");
  return compactText(bodyText);
}

function sectionDescriptor(value = {}) {
  return {
    sectionID: compactText(value.sectionID || value.id),
    codePrefix: compactText(value.codePrefix).toUpperCase(),
    sectionNumber: compactText(value.sectionNumber),
    title: compactText(value.title || "Section"),
    codeEdition: compactText(value.codeEdition),
    codeVersion: compactText(value.codeVersion),
    jurisdiction: compactText(value.jurisdiction),
    corpusID: compactText(value.corpusID),
    corpusLabel: compactText(value.corpusLabel),
    applicabilityStatus: compactText(value.applicabilityStatus),
    chapterNumber: compactText(value.chapterNumber),
    chapterTitle: compactText(value.chapterTitle || value.zoning?.chapter?.title),
    sectionGroupLabel: compactText(value.sectionGroupLabel || value.headerLine),
    sectionGroupTitle: compactText(value.sectionGroupTitle || value.headingLine),
    canonicalApplicabilityContext: researchCanonicalApplicabilityContext(value)
  };
}

function candidateValues(discovery) {
  if (Array.isArray(discovery)) return discovery;
  return Array.isArray(discovery?.candidates) ? discovery.candidates : [];
}

async function canonicalSection(resolveSection, value, origin, { includeAmendmentHistory = false } = {}) {
  const requested = sectionDescriptor(value);
  const requestedRichSourceIDs = Array.isArray(value?.richSourceIDs)
    ? new Set(value.richSourceIDs.map((item) => compactText(item)).filter(Boolean))
    : null;
  const resolved = await resolveSection({ ...requested, origin });
  if (!resolved || typeof resolved !== "object") {
    throw new Error(`Canonical enacted text is unavailable for ${requested.sectionID || requested.sectionNumber || "the requested section"}.`);
  }
  for (const field of ["codePrefix", "corpusID", "codeVersion", "codeEdition"]) {
    if (requested[field] && resolved[field] && requested[field] !== resolved[field]) {
      throw new Error(`Canonical source ${field} does not match the requested authority.`);
    }
  }
  const text = canonicalText(resolved);
  if (!text) {
    throw new Error(`Canonical enacted text is empty for ${requested.sectionID || requested.sectionNumber || "the requested section"}.`);
  }
  return {
    ...requested,
    ...sectionDescriptor({ ...requested, ...resolved }),
    // A candidate may carry stale or invented labels. Only the canonical
    // resolver owns enclosing source metadata, just as it owns enacted text.
    chapterNumber: compactText(resolved.chapterNumber || resolved.zoning?.chapter?.canonicalNumber),
    chapterTitle: compactText(resolved.chapterTitle || resolved.zoning?.chapter?.title),
    sectionGroupLabel: compactText(resolved.sectionGroupLabel || resolved.headerLine),
    sectionGroupTitle: compactText(resolved.sectionGroupTitle || resolved.headingLine),
    canonicalApplicabilityContext: researchCanonicalApplicabilityContext(resolved),
    text,
    body: resolved.body,
    crossReferences: Array.isArray(resolved.crossReferences) ? resolved.crossReferences : [],
    richSources: (Array.isArray(resolved.richSources) ? resolved.richSources : [])
      .filter((source) => requestedRichSourceIDs === null || requestedRichSourceIDs.has(compactText(source?.id)) ||
        (includeAmendmentHistory && source.kind === "amendment-history"))
      .map((source) => structuredClone(source))
  };
}

function comparableTableReference(value, fallbackCodePrefix = "") {
  const normalized = compactText(value).toUpperCase();
  const match = normalized.match(/\b(?:(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+)?TABLE\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Z-]+)*)/i);
  if (!match) return "";
  const codePrefix = String(match[1] || fallbackCodePrefix || "").toUpperCase();
  return codePrefix ? `${codePrefix}:TABLE:${match[2].toUpperCase()}` : `TABLE:${match[2].toUpperCase()}`;
}

function tableReferences(value, fallbackCodePrefix = "") {
  const references = new Set();
  for (const match of compactText(value).matchAll(/\b(?:(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+)?Table\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi)) {
    const identity = comparableTableReference(match[0], match[1] || fallbackCodePrefix);
    if (identity) references.add(identity);
  }
  return references;
}

function applicableStructuredTable(value) {
  const references = tableReferences(canonicalText(value), value?.codePrefix);
  const completeTables = (Array.isArray(value?.richSources) ? value.richSources : []).filter((source) =>
    String(source?.kind || "").toLowerCase() === "table" &&
      compactText(source.id) && compactText(source.contentHash) &&
      Number(source.rowCount) > 0 && Array.isArray(source.grids) && source.grids.length > 0
  );
  const ownTableReference = comparableTableReference(
    `${value?.codePrefix || ""} Table ${value?.sectionNumber || ""}`,
    value?.codePrefix
  );
  const exact = completeTables.find((source) => {
    if (String(source?.kind || "").toLowerCase() !== "table") return false;
    const identity = comparableTableReference(source.reference, value?.codePrefix);
    return identity && references.has(identity);
  });
  if (exact) return (["ZR", "PC", "MC"].includes(value?.codePrefix) || (value?.codePrefix === "BC" && value?.sectionNumber === "1006.2.1")) && completeTables.length === 1 &&
      comparableTableReference(exact.reference, value.codePrefix) === ownTableReference
    ? { ...exact, preserveSectionContext: true } : exact;

  // Some prepared legacy sections preserve a complete grid but label its rich
  // source only as "Official table." Infer the identity only when the section
  // itself is the referenced table and contains exactly one complete grid.
  // Zoning tables can be introduced as "the following table". Require a
  // unique grid explicitly identified as this section's table; never infer
  // identity merely from a shared chapter number or nearby table.
  if (value?.codePrefix === "ZR" && completeTables.length === 1 && ownTableReference &&
      comparableTableReference(completeTables[0].reference, "ZR") === ownTableReference) {
    return { ...completeTables[0], preserveSectionContext: true };
  }
  if (
    completeTables.length === 1 &&
    ownTableReference &&
    references.has(ownTableReference) &&
    !comparableTableReference(completeTables[0].reference, value?.codePrefix)
  ) {
    return {
      ...completeTables[0],
      canonicalReference: `${value.codePrefix} Table ${value.sectionNumber}`
    };
  }
  return null;
}

function attachStructuredTable(record, value, characterAllowance) {
  const table = applicableStructuredTable(value);
  const tableText = String(table?.text || "").trim();
  if (!table || !tableText) return record;
  // HTML-derived table text can differ from the complete selected passage only
  // in whitespace. Preserve its verified grid without replacing that passage
  // or importing a different table to recover the same legend.
  // A complete canonical passage can include an introductory rule and its
  // exceptions around the rich table. Attaching the exact grid must not erase
  // that already supplied text merely because this code family is not one of
  // the older table-context special cases.
  const tableAlreadyIncluded = record.canonicalContextComplete &&
    record.text.replace(/\s/g, "").includes(tableText.replace(/\s/g, ""));
  const preserveSectionContext = table.preserveSectionContext || tableAlreadyIncluded;
  const sameCompleteText = preserveSectionContext && record.canonicalContextComplete &&
    tableText.replace(/\s/g, "") === record.text.replace(/\s/g, "");
  if (tableText.length > characterAllowance && !sameCompleteText) return record;
  if (preserveSectionContext && !record.canonicalContextComplete) return record;
  return {
    ...record,
    text: preserveSectionContext ? record.text : tableText,
    canonicalContextComplete: preserveSectionContext ? record.canonicalContextComplete : false,
    truncated: false,
    richSourceID: compactText(table.id),
    richSourceKind: "table",
    richSourceReference: compactText(table.reference),
    richSourceCanonicalReference: compactText(table.canonicalReference || table.reference),
    richSourceContentHash: compactText(table.contentHash),
    // The table hash binds its own text and grid. The passage may additionally
    // preserve the section's scope and footnotes, which have their own hash.
    richSourceText: tableText,
    richSourceRowCount: Number(table.rowCount),
    richSourceGrids: structuredClone(table.grids)
  };
}

function inlineCrossReferences(text, fallbackCodePrefix) {
  const source = compactText(text);
  const references = [];
  const rangePattern = /\b(?:(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+)?(?:Sections?|§{1,2})\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)\s+(?:through|to|[-–])\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi;
  for (const match of source.matchAll(rangePattern)) {
    const start = String(match[2] || "").replace(/\.$/, "");
    const end = String(match[3] || "").replace(/\.$/, "");
    const startParts = start.split(".");
    const endParts = end.split(".");
    const sameDottedParent = startParts.length === endParts.length &&
      startParts.length > 1 &&
      startParts.slice(0, -1).join(".") === endParts.slice(0, -1).join(".");
    const codePrefix = String(match[1] || fallbackCodePrefix || "").toUpperCase();
    if (sameDottedParent) {
      const first = Number(startParts.at(-1));
      const last = Number(endParts.at(-1));
      if (Number.isInteger(first) && Number.isInteger(last) && last >= first && last - first <= 50) {
        for (let value = first; value <= last; value += 1) {
          references.push({
            codePrefix,
            sectionNumber: [...startParts.slice(0, -1), value].join("."),
            referenceKind: "section"
          });
        }
        continue;
      }
    }
    const startHyphen = start.match(/^([A-Z]?\d+)-(\d+)$/i);
    const endHyphen = end.match(/^([A-Z]?\d+)-(\d+)$/i);
    const first = Number(startHyphen?.[2]);
    const last = Number(endHyphen?.[2]);
    if (
      startHyphen && endHyphen &&
      startHyphen[1].toUpperCase() === endHyphen[1].toUpperCase() &&
      startHyphen[2].length === endHyphen[2].length &&
      Number.isInteger(first) && Number.isInteger(last) &&
      last >= first && last - first <= 50
    ) {
      for (let value = first; value <= last; value += 1) {
        references.push({
          codePrefix,
          sectionNumber: `${startHyphen[1]}-${String(value).padStart(startHyphen[2].length, "0")}`,
          referenceKind: "section"
        });
      }
    }
  }
  const pattern = /\b(?:(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+)?(?:Sections?|§{1,2}|Table)\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi;
  for (const match of source.matchAll(pattern)) {
    references.push({
      codePrefix: String(match[1] || fallbackCodePrefix || "").toUpperCase(),
      sectionNumber: String(match[2] || "").replace(/\.$/, ""),
      referenceKind: /table/i.test(match[0]) ? "table" : "section"
    });
  }
  return references;
}

function normalizedCrossReferences(source, { inlineOnly = false } = {}) {
  const structured = (source.crossReferences || []).map((reference) => {
    if (typeof reference === "string") {
      const parsed = inlineCrossReferences(reference, source.codePrefix);
      return parsed[0] || {
        codePrefix: source.codePrefix,
        sectionNumber: compactText(reference)
      };
    }
    return {
      sectionID: compactText(reference?.sectionID || reference?.id),
      codePrefix: compactText(reference?.codePrefix || source.codePrefix).toUpperCase(),
      sectionNumber: compactText(reference?.sectionNumber),
      referenceKind: compactText(reference?.referenceKind || reference?.kind || "section")
    };
  });
  return [
    ...(inlineOnly ? [] : structured),
    ...inlineCrossReferences(source.text, source.codePrefix)
  ]
    .filter((reference) => sectionIdentity(reference));
}

function canonicalAncestorReferences(source, maximum = maximumPinnedAncestorContextSections) {
  const codePrefix = compactText(source?.codePrefix).toUpperCase();
  const sectionNumber = compactText(source?.sectionNumber).replace(/\.$/, "");
  const parts = sectionNumber.split(".").filter(Boolean);
  if (!codePrefix || parts.length < 4) return [];
  const references = [];
  while (parts.length > 2 && references.length < maximum) {
    parts.pop();
    references.push({
      codePrefix,
      sectionNumber: parts.join("."),
      referenceKind: "ancestor_scope",
      referencePurpose: "canonical_ancestor_scope",
      corpusID: source.corpusID,
      codeVersion: source.codeVersion,
      codeEdition: source.codeEdition
    });
  }
  return references;
}

function targetedDefinitionValue(value, context, maximumCharacters) {
  const excerpt = targetedDefinitionExcerpt(value, context, { maximumCharacters });
  if (!excerpt) return { value, excerpt: null };
  const { text, ...metadata } = excerpt;
  return {
    // HTTP pins can carry the full canonicalText as well as text. Both fields
    // must represent this excerpt or sourceRecord will restore the full section.
    value: { ...value, text, canonicalText: text },
    excerpt: metadata
  };
}

const questionSpecificIgnoredTerms = new Set([
  "about", "after", "again", "also", "before", "between", "could", "does", "from",
  "have", "into", "only", "permitext", "should", "that", "their", "these", "this",
  "under", "using", "what", "when", "where", "which", "with", "would", "your"
]);

function questionSpecificTerms(value) {
  return Array.from(new Set((compactText(value).toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || [])
    .filter((term) => !questionSpecificIgnoredTerms.has(term))));
}

function questionSpecificBlockValue(value, question, maximumCharacters) {
  const original = canonicalText(value);
  if (!original || original.length <= maximumCharacters) return value;
  let blocks = (Array.isArray(value?.body?.blocks) ? value.body.blocks : [])
    .map((block, index) => ({ index, text: compactText(block?.plainText) }))
    .filter((block) => block.text);
  // Some imported chapters encode an entire numbered section in one HTML
  // block. Preserve complete numbered subsections instead of taking only the
  // beginning of that block and losing a responsive rule near its end.
  if (blocks.length === 1 && /^\d+$/.test(String(value.sectionNumber || ""))) {
    const raw = value.body.blocks.map(block => block.plainText || "").join("\n\n");
    const headings = [...raw.matchAll(new RegExp(`(?:^|\\n\\s*\\n)(${value.sectionNumber}\\.\\d+(?:\\.\\d+)*)\\s+[A-Za-z]`, "g"))];
    if (headings.length > 1) {
      blocks = headings.map((heading, index) => ({
        index, scope: heading[1],
        text: compactText(raw.slice(heading.index, headings[index + 1]?.index ?? raw.length))
      }));
      const introduction = compactText(raw.slice(0, headings[0].index));
      if (introduction) blocks.unshift({ index: -1, scope: String(value.sectionNumber), text: introduction });
    }
  }
  if (blocks.length < 2) return value;
  const terms = questionSpecificTerms(question);
  const references = explicitCodeReferences(question);
  const ranked = blocks.map((block) => {
    const normalized = block.text.toLowerCase();
    const termMatches = terms.filter((term) => normalized.includes(term)).length;
    const referenceMatches = references.filter((reference) => {
      const [, sectionNumber] = reference.split(":");
      return sectionNumber && normalized.includes(sectionNumber.toLowerCase());
    }).length;
    return {
      ...block,
      score: referenceMatches * 1_000 + termMatches * 10 - Math.min(block.text.length / 1_000, 9)
    };
  }).filter((block) => block.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = [];
  let used = 0;
  for (const block of ranked) {
    if (selected.some(value => value.index === block.index)) continue;
    const group = [...blocks.filter(parent => parent.scope && block.scope?.startsWith(`${parent.scope}.`)), block]
      .filter(value => !selected.some(existing => existing.index === value.index));
    const additional = group.reduce((sum, value) => sum + value.text.length + 2, 0);
    if (used + additional > maximumCharacters) continue;
    selected.push(...group);
    used += additional;
  }
  if (!selected.length) return value;
  selected.sort((left, right) => left.index - right.index);
  const text = selected.map((block) => block.text).join("\n\n");
  return {
    ...value,
    text,
    canonicalText: text,
    questionSpecificPassage: {
      version: "20261002-numbered-subsection-block-v2",
      canonicalSectionCharacterCount: original.length,
      selectedBlockIndexes: selected.map((block) => block.index)
    }
  };
}

function definitionSelectionContext(query, values = []) {
  return [
    compactText(query),
    // A section reference supplies no passage. Feeding the first 4,000
    // characters of its entire definitions section into ranking makes those
    // unrelated opening entries outrank the user's question.
    ...values.map((value) => value?.selectionMode === "section_reference"
      ? "" : canonicalText(value).slice(0, 4_000))
  ].filter(Boolean).join("\n").slice(0, 32_000);
}

function isDefinitionCandidate(value) {
  const functions = Array.isArray(value?.evidencePriority?.functions)
    ? value.evidencePriority.functions
    : [];
  return value?.evidencePriority?.primaryFunction === "definition" || functions.includes("definition");
}

function sourceRecord(value, {
  origin,
  sourceID,
  relationship,
  characterAllowance,
  canonicalResolved,
  retrievalReason = "",
  retrievalRank = null,
  retrievalScore = null,
  retrievalVersion = "",
  retrievalDepth = 0,
  evidencePriority = null,
  targetedDefinition = null,
  retrievedAt = new Date().toISOString()
}) {
  const rawText = canonicalText(value);
  const text = rawText.slice(0, Math.max(0, characterAllowance)).trimEnd();
  return attachStructuredTable({
    sourceID,
    origin,
    sourceType: "enacted_text",
    relationship,
    authorityClass: "enacted",
    retrievalReason: compactText(retrievalReason || relationship),
    retrievalRank: retrievalRank !== null && retrievalRank !== "" && Number.isFinite(Number(retrievalRank))
      ? Number(retrievalRank)
      : null,
    retrievalScore: retrievalScore !== null && retrievalScore !== "" && Number.isFinite(Number(retrievalScore))
      ? Number(retrievalScore)
      : null,
    retrievalVersion: compactText(retrievalVersion),
    retrievalDepth: Number.isFinite(Number(retrievalDepth)) ? Number(retrievalDepth) : 0,
    evidencePriority: evidencePriority ? structuredClone(evidencePriority) : null,
    retrievedAt,
    ...sectionDescriptor(value),
    ...(canonicalResolved ? {} : {
      chapterTitle: "", sectionGroupLabel: "", sectionGroupTitle: "",
      canonicalApplicabilityContext: researchCanonicalApplicabilityContext()
    }),
    text,
    canonicalContextResolved: Boolean(canonicalResolved),
    canonicalContextComplete: Boolean(
      canonicalResolved && !targetedDefinition && !value.questionSpecificPassage &&
      !value.targetedZoningContext && text.length === rawText.length
    ),
    truncated: targetedDefinition ? false : Boolean(value.questionSpecificPassage) || text.length < rawText.length,
    targetedDefinition: targetedDefinition ? structuredClone(targetedDefinition) : null,
    ...(value.targetedZoningContext ? { targetedZoningContext: structuredClone(value.targetedZoningContext) } : {})
  }, value, Math.max(0, characterAllowance));
}

function deterministicSourceID(origin, value, index) {
  const identity = sectionIdentity(value)
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .slice(0, 160);
  return `research-${origin}-${identity || "unknown"}-${index + 1}`;
}

function canonicalIndexedPassage(value, candidate, allowance, question = "") {
  const passage = candidate?.indexedPassage;
  if (!passage?.text || !passage.sourceTextHash || !value?.body?.blocks) return null;
  const valid = item => {
    const block = value.body.blocks.find(block =>
      (!item.sourceOffsets?.blockID || String(block.id || "") === String(item.sourceOffsets.blockID)) &&
      createHash("sha256").update(String(block.plainText || "")).digest("hex") === item.sourceTextHash);
    const { start, end } = item.sourceOffsets || {};
    return !!block && Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end > start &&
      String(block.plainText).slice(start, end) === item.text;
  };
  if (!valid(passage)) return null;
  const fullText = compactText(canonicalText(value));
  // Canonical resolvers can flatten paragraph breaks while indexed slices keep
  // the raw block layout. Compare whitespace consistently; the block hash,
  // offsets and exact indexed text above still bind the authoritative source.
  // Keep the original slices below so emitted evidence is never rewritten.
  const containmentText = fullText.replace(/\s+/g, " ");
  const terms = questionSpecificTerms(question);
  const alternatives = [...(passage.alternatives || []), ...(passage.sameSectionReferences || [])]
    .filter(item => item.id !== passage.id && valid(item))
    .map(item => ({ item, matches: terms.filter(term => compactText(item.text).toLowerCase().includes(term)).length }))
    .filter(entry => entry.matches >= 2)
    .sort((left, right) => right.matches - left.matches);
  for (const item of [passage, ...alternatives.map(entry => entry.item)]) {
    const slices = [...(item.contextTexts || []), item.completeSubsectionText || item.text]
      .map(compactText).filter(Boolean);
    if (!slices.length || slices.some(text => !containmentText.includes(text.replace(/\s+/g, " ")))) continue;
    let selected = fullText.length <= allowance ? fullText : [...new Set(slices)].join("\n\n");
    // A complete alternative is preferable to an unrelated prefix when the
    // highest-ranked parent subtree cannot fit the bounded answer package.
    if (selected.length > allowance) continue;
    const companions = [];
    const companion = candidate?.signals?.useSelectedPassageOnly === true ? null : passage.companion;
    const siblingParent = value => /^\d+(?:\.\d+)+$/.test(String(value || ""))
      ? String(value).slice(0, String(value).lastIndexOf(".")) : null;
    if (selected !== fullText && companion && companion.id !== item.id && valid(companion) &&
        ["codePrefix", "corpusID", "codeVersion"].every(key => companion[key] && companion[key] === candidate[key] &&
          (!value[key] || companion[key] === value[key])) &&
        ["codeEdition", "jurisdiction"].every(key => {
          const registered = value[key] || candidate[key];
          return registered ? companion[key] === registered && candidate[key] === registered : !companion[key];
        }) &&
        String(companion.sectionID) === String(candidate.sectionID || candidate.id) &&
        siblingParent(item.subsectionNumber) && siblingParent(item.subsectionNumber) === siblingParent(companion.subsectionNumber) &&
        (companion.scopeComplete === true || companion.completeSubsectionText)) {
      const companionSlices = [...(companion.contextTexts || []), companion.completeSubsectionText || companion.text]
        .map(compactText).filter(Boolean);
      const combined = [...new Set([...slices, ...companionSlices])].join("\n\n");
      // A companion is optional but atomic. Never shave its conditions or
      // borrow another source's allowance to force it into the package.
      if (companionSlices.length && companionSlices.every(text => containmentText.includes(text.replace(/\s+/g, " "))) &&
          combined.length <= allowance) {
        selected = combined;
        companions.push({ id: companion.id, subsectionNumber: companion.subsectionNumber,
          sourceTextHash: companion.sourceTextHash, sourceOffsets: companion.sourceOffsets, completeSubsection: true });
      }
    }
    // Embedded chapters can resolve a direct child reference back to the same
    // catalog section, which the outer cross-reference queue has already seen.
    // Retain one responsive, complete referenced child from the existing bound
    // pool. This is source context, not a finding that the child governs.
    if (selected !== fullText && candidate?.signals?.useSelectedPassageOnly !== true) {
      const referenced = new Set(extractResearchCodeReferences(selected)
        .filter(reference => reference.referenceKind === "section" &&
          (!reference.codePrefix || reference.codePrefix === candidate.codePrefix))
        .map(reference => reference.sectionNumber));
      const bound = entry => valid(entry) &&
        String(entry.sectionID) === String(candidate.sectionID || candidate.id) &&
        ["codePrefix", "corpusID", "codeVersion", "codeEdition"].every(key =>
          entry[key] && entry[key] === candidate[key] && (!value[key] || entry[key] === value[key])) &&
        // Index v2 omits jurisdiction. An absent label inherits the registered
        // catalog identity; a conflicting supplied jurisdiction is rejected.
        Boolean(candidate.jurisdiction && (!value.jurisdiction || candidate.jurisdiction === value.jurisdiction) &&
          (!entry.jurisdiction || entry.jurisdiction === candidate.jurisdiction));
      const delivered = new Set([item.id, ...companions.map(entry => entry.id)]);
      const genericDetailWords = new Set([...questionSpecificIgnoredTerms, "section", "code", "general",
        "access", "requirements", "requirement", "provisions", "provision", "minimum", "maximum"]);
      const detailWords = text => new Set((String(text).toLowerCase().match(/[a-z]{3,}/g) || [])
        .filter(word => !genericDetailWords.has(word)).flatMap(word => [word,
          ...(word.endsWith("s") && !word.endsWith("ss") ? [word.slice(0, -1)] : []),
          ...(word.length > 5 && word.endsWith("ing") ? [word.slice(0, -3), `${word.slice(0, -3)}e`] : [])]));
      const currentDetailWords = detailWords(question);
      const matchDetail = text => {
        const words = detailWords(text);
        return [...currentDetailWords].filter(word => words.has(word)).length;
      };
      const sourcePool = [...(passage.alternatives || []), ...(passage.sameSectionReferences || []),
        ...(item.sameSectionReferences || []),
        ...(companions.some(entry => entry.id === passage.companion?.id)
          ? passage.companion.sameSectionReferences || [] : [])];
      const dependencies = [...new Map(sourcePool
        .filter(entry => !delivered.has(entry.id) && referenced.has(entry.subsectionNumber) && bound(entry) &&
          (entry.scopeComplete === true || entry.completeSubsectionText))
        .map(entry => [entry.id, entry])).values()]
        .map(entry => ({ entry, slices: [...(entry.contextTexts || []), entry.completeSubsectionText || entry.text]
          .map(compactText).filter(Boolean) }))
        .filter(dependency => dependency.slices.length && dependency.slices.every(text =>
          containmentText.includes(text.replace(/\s+/g, " "))))
        .map(dependency => ({ ...dependency,
          // A referenced child's exact source heading owns its detail. Repeated
          // parent context cannot outrank a pipe/valve/etc. named by the user.
          headingMatches: matchDetail(String(dependency.entry.text).split(/\r?\n/, 1)[0]),
          ownMatches: matchDetail(dependency.entry.text),
          matches: terms.filter(term => dependency.slices.join(" ").toLowerCase().includes(term)).length }))
        .filter(dependency => dependency.matches > 0 || dependency.ownMatches > 0)
        .sort((left, right) => right.headingMatches - left.headingMatches ||
          right.ownMatches - left.ownMatches || right.matches - left.matches ||
          left.entry.subsectionNumber.localeCompare(right.entry.subsectionNumber, undefined, { numeric: true }));
      for (const dependency of dependencies) {
        const combined = [selected, ...dependency.slices.filter(text => !selected.includes(text))].join("\n\n");
        if (combined.length > allowance) continue;
        selected = combined;
        companions.push({ id: dependency.entry.id, subsectionNumber: dependency.entry.subsectionNumber,
          sourceTextHash: dependency.entry.sourceTextHash, sourceOffsets: dependency.entry.sourceOffsets,
          relationship: "same_section_reference", completeSubsection: true });
        break;
      }
    }
    return { text: selected, id: item.id, subsectionNumber: item.subsectionNumber,
      sourceTextHash: item.sourceTextHash, sourceOffsets: item.sourceOffsets,
      ...(companions.length ? { companions } : {}),
      completeSection: selected === fullText, completeSubsection: Boolean(item.completeSubsectionText || item.scopeComplete) };
  }
  return null;
}

function focusedVentilationCandidates(query, candidates, pinnedCount) {
  const question = compactText(query.question);
  if (pinnedCount || query.contextDependentFollowUp || query.relevanceComparison ||
      !/\bair[- ]condition\w*\b/i.test(question) || !/\b(?:windows?|natural ventilation)\b/i.test(question) ||
      !/\bventilat\w*\b/i.test(question)) return candidates;
  // Scope only the window-versus-mechanical-ventilation decision. Preserve
  // broader system design, residential exceptions and independently requested
  // authorities in the normal retrieval path.
  if ((question.match(/\?/g) || []).length > 1 ||
      /\b(?:Building Code|Fuel Gas Code|Plumbing Code|Energy Code|Zoning Resolution|DOB|local law)\b/i.test(question) ||
      /\b(?:without|no|not)\b[^.?]{0,35}\bair[- ]condition\w*\b|\b(?:airflow|cfm|calculat\w*|exhaust|smoke|fire|egress|accessib\w*|bathroom|bedroom|sleeping|dwelling|residential|hospital|clinic|ambulatory|healthcare|permit\w*|energy|existing|alteration|renovation|conversion|1968|2008|2014)\b|\b(?:all|complete|full)\s+(?:code\s+)?(?:requirements?|design)\b|\b(?:also|and|in addition)\s+(?:explain|check|assess|verify|what|how|which)\b/i.test(question)) return candidates;
  const anchors = ["401.2", "403.1"].map((sectionNumber) => candidates.find((candidate) =>
    candidate.codePrefix === "MC" && candidate.sectionNumber === sectionNumber && candidate.signals?.exactTopicRouteTarget &&
    /\b2022\b/.test(candidate.codeEdition || "") && /new york city|nyc/i.test(candidate.jurisdiction || "")));
  if (anchors.some((anchor) => !anchor) ||
      !["codeEdition", "codeVersion", "corpusID", "jurisdiction"].every((field) =>
        anchors[0][field] && anchors[0][field] === anchors[1][field]) ||
      !/provided with air conditioning shall be mechanically ventilated/i.test(anchors[0].selectedText || "") ||
      !/Mechanical ventilation shall be provided by a method of supply air/i.test(anchors[1].selectedText || "")) return candidates;
  if (candidates.some((candidate) => candidate.codePrefix !== "MC" && candidate.signals?.exactTopicRouteTarget)) return candidates;
  return candidates.filter((candidate) => candidate.codePrefix === "MC" || candidate.signals?.exactReference ||
    candidate.signals?.contextualReference || candidate.evidencePriority?.primaryFunction === "definition");
}

/**
 * Assemble the text-only enacted evidence package for one Research answer.
 * Discovery and canonical section access are injected so this module remains
 * independent of storage, HTTP, model, and UI concerns.
 */
export async function assembleResearchEvidence({
  question,
  previousTopic = "",
  previousMessages = [],
  projectFacts = [],
  pinnedEvidence = [],
  topicContext = null,
  questionPlan = null,
  strategy = null,
  discover,
  resolveSection,
  onStage,
  recoveryAttempted = false,
  limits: requestedLimits = {}
} = {}) {
  if (typeof discover !== "function") {
    throw new Error("Research evidence assembly requires an injected discover callback.");
  }
  if (typeof resolveSection !== "function") {
    throw new Error("Research evidence assembly requires an injected canonical section resolver.");
  }
  if (!Array.isArray(pinnedEvidence)) {
    throw new Error("Pinned Research evidence must be an array.");
  }

  const query = researchEvidenceRetrievalQuery({
    question,
    previousTopic,
    previousMessages,
    projectFacts,
    topicContext
  });
  const requestedLimitsApplied = appliedLimits(requestedLimits);
  const limits = pinnedEvidence.length
    ? {
        ...requestedLimitsApplied,
        maximumDiscovered: Math.min(
          requestedLimitsApplied.maximumDiscovered,
          researchPinnedEvidenceAssemblyLimits.maximumDiscovered
        ),
        maximumTargetedDefinitions: Math.min(
          requestedLimitsApplied.maximumTargetedDefinitions,
          researchPinnedEvidenceAssemblyLimits.maximumTargetedDefinitions
        ),
        maximumCrossReferences: Math.min(
          requestedLimitsApplied.maximumCrossReferences,
          researchPinnedEvidenceAssemblyLimits.maximumCrossReferences
        )
      }
    : requestedLimitsApplied;
  const appliedStrategy = strategy?.mode === researchEvidenceStrategies.pinnedFirst
    ? {
        mode: researchEvidenceStrategies.pinnedFirst,
        reason: compactText(strategy.reason) || "selected_evidence_first"
      }
    : {
        mode: researchEvidenceStrategies.broad,
        reason: compactText(strategy?.reason) || "default_authorized_retrieval"
      };
  const strictPinnedEvidenceBoundary =
    appliedStrategy.mode === researchEvidenceStrategies.pinnedFirst &&
    appliedStrategy.reason === "question_explicitly_bounded_to_selected_evidence";
  await onStage?.("searching_authorized_library", "active");
  const discovery = appliedStrategy.mode === researchEvidenceStrategies.pinnedFirst
    ? {
        retrievalVersion: researchEvidenceAssemblyVersion,
        searchedSectionCount: 0,
        candidates: [],
        outsideCurrentLibrary: [],
        coverageLimitations: []
      }
    : await discover({
        question: query.retrievalQuery,
        limit: limits.maximumCandidates,
        retrievalContext: {
          sourceQuery: query.sourceQuery,
          semanticQuery: query.semanticQuery,
          currentQuestion: query.question,
          inheritedAuthorityReferences: query.inheritedAuthorityReferences,
          conversationTopic: query.conversationTopic,
          immediateContext: query.immediateContext,
          contextDependentFollowUp: query.contextDependentFollowUp,
          relevanceComparison: query.relevanceComparison
        }
      });
  const currentReferences = extractResearchCodeReferences(query.question);
  const discoveryCandidates = candidateValues(discovery).map(candidate => {
    const historicalReference = query.contextDependentFollowUp && candidate?.signals?.exactReference === true &&
      !currentReferences.some(reference => reference.codePrefix === candidate.codePrefix &&
        reference.sectionNumber === candidate.sectionNumber);
    return historicalReference ? { ...candidate, signals: { ...candidate.signals, historicalReference: true } } : candidate;
  });
  const prioritizedCandidates = prioritizeResearchEvidence(discoveryCandidates, {
    limit: limits.maximumCandidates,
    // Selected enacted passages define the primary answer scope. Discovery is
    // still assembled for review, but it must not become mandatory coverage
    // before the pins and candidates are merged into one package.
    pinnedScopeActive: pinnedEvidence.length > 0
  });
  // A remembered citation is retrieval context, not a demand to restate its
  // entire rule on every follow-up. Explicit current references retain coverage.
  if (query.contextDependentFollowUp) for (const candidate of prioritizedCandidates) {
    if (currentReferences.some(reference => reference.codePrefix === candidate.codePrefix &&
      reference.sectionNumber === candidate.sectionNumber)) continue;
    candidate.evidencePriority = { ...candidate.evidencePriority,
      claimCoverageRequired: false, claimCoverageReason: "Prior-topic context for the current follow-up" };
  }
  const routedTopicPresent = prioritizedCandidates.some((candidate) =>
    candidate?.signals?.exactTopicRouteTarget === true
  );
  const relevanceCandidates = query.relevanceComparison && routedTopicPresent
    ? prioritizedCandidates.filter((candidate) =>
        ["governing", "contextual"].includes(candidate?.evidencePriority?.evidenceRole) ||
        candidate?.evidencePriority?.primaryFunction === "definition"
      )
    : prioritizedCandidates;
  const selectedBuildingCodePassageBoundary =
    /\bbased only on (?:the )?selected Building Code passages?\b/i.test(query.question);
  const boundaryCandidates = selectedBuildingCodePassageBoundary && routedTopicPresent
    ? relevanceCandidates.filter((candidate) =>
        candidate?.signals?.exactTopicRouteTarget === true &&
        compactText(candidate?.codePrefix).toUpperCase() === "BC"
      )
    : relevanceCandidates;
  const candidates = focusedTechnicalCandidates(query,
    focusedVentilationCandidates(query, boundaryCandidates, pinnedEvidence.length), pinnedEvidence.length);
  const nonMaterialCandidateCount = prioritizedCandidates.length - candidates.length;
  await onStage?.("searching_authorized_library", "completed");
  await onStage?.("reviewing_provisions", "active");
  const sources = [];
  const canonicalForExpansion = [];
  const incompleteGoverningPassages = [];
  const includedSectionIdentities = new Set();
  const limitations = [];
  let characterCount = 0;
  let pinnedCanonicalContextCharacterCount = 0;
  let resolverFailureCount = 0;
  let targetedDefinitionCount = 0;
  const retrievedAt = new Date().toISOString();

  const resolvedPins = [];
  for (const [index, pinned] of pinnedEvidence.entries()) {
    let value = pinned;
    let resolved = false;
    try {
      const canonical = await canonicalSection(resolveSection, pinned, sourceOrigins.pinned);
      value = {
        ...pinned,
        ...canonical,
        ...(pinned.richSourceID ? { text: pinned.text || pinned.selectedText } : {})
      };
      resolved = true;
    } catch {
      resolverFailureCount += 1;
    }
    const contextExcerpt = resolved && !pinned.richSourceID
      ? targetedZoningContextExcerpt({ ...value, canonicalText: value.text }, { question: query.question, plan: questionPlan,
          selectedText: pinned.userSelectedText || pinned.selectedText || pinned.text }) : null;
    resolvedPins.push({ index, pinned, value, resolved, contextExcerpt });
  }

  // Complete selected Zoning sections get first use of the existing turn
  // budget. Do not cut its closing exceptions merely to leave room for
  // opportunistic discovery. Partial selections, unresolved sections and
  // oversized sections keep their existing source boundaries and limits.
  const completeZoningPins = resolvedPins.map((entry) => {
    const selected = compactText(entry.pinned.userSelectedText || entry.pinned.selectedText || entry.pinned.text);
    const completeText = selected || canonicalText(entry.value);
    if (entry.resolved && entry.value.codePrefix === "ZR" && !entry.pinned.richSourceID && !entry.contextExcerpt &&
        completeText &&
        (!selected || isCompleteSectionSelection(entry.value, selected))) {
      return completeText;
    }
    return null;
  });
  if (completeZoningPins.length && completeZoningPins.every(Boolean) &&
      completeZoningPins.reduce((sum, text) => sum + text.length, 0) <= limits.maximumCharacters) {
    resolvedPins.forEach((entry, index) => { entry.completeZoningText = completeZoningPins[index]; });
    limits.maximumCompletePinnedSectionCharacters = limits.maximumCharacters;
  }

  // Reserve complete selected source excerpts before sharing the remaining
  // budget. A fair-share prefix must not cut a closing condition in half.
  const excerptReservation = resolvedPins.reduce((sum, entry) => sum + (entry.contextExcerpt?.text.length || 0), 0);
  if (excerptReservation) {
    for (const entry of resolvedPins) {
      entry.atomicSelectedLength = entry.contextExcerpt ? 0 :
        compactText(entry.pinned.userSelectedText || entry.pinned.selectedText || entry.pinned.text).length;
    }
  }
  const reservationFor = (entry) => entry.completeZoningText?.length || entry.contextExcerpt?.text.length || entry.atomicSelectedLength || 0;
  const pinnedSourceLimit = (entry) => entry.completeZoningText
    ? limits.maximumCompletePinnedSectionCharacters : limits.maximumCharactersPerSource;
  const atomicReservation = resolvedPins.reduce((sum, entry) => sum + reservationFor(entry), 0);
  const ordinaryPinCount = resolvedPins.filter((entry) => !reservationFor(entry)).length;
  if (atomicReservation + ordinaryPinCount > limits.maximumCharacters ||
      resolvedPins.some((entry) => reservationFor(entry) > pinnedSourceLimit(entry))) {
    for (const entry of resolvedPins) { entry.completeZoningText = null; entry.contextExcerpt = null; entry.atomicSelectedLength = 0; }
    delete limits.maximumCompletePinnedSectionCharacters;
  }

  for (const [position, entry] of resolvedPins.entries()) {
    const remainingCharacters = Math.max(0, limits.maximumCharacters - characterCount);
    const remainingEntries = resolvedPins.slice(position);
    const reservedCharacters = remainingEntries.reduce((sum, item) => sum + reservationFor(item), 0);
    const remainingOrdinaryPins = remainingEntries.filter((item) => !reservationFor(item)).length;
    const fairPinnedShare = remainingOrdinaryPins
      ? Math.floor(Math.max(0, remainingCharacters - reservedCharacters) / remainingOrdinaryPins) : 0;
    const allowance = Math.min(pinnedSourceLimit(entry),
      reservationFor(entry) || fairPinnedShare, remainingCharacters);
    let targeted = entry.completeZoningText
      ? { value: { ...entry.value, text: entry.completeZoningText, canonicalText: entry.completeZoningText }, excerpt: null }
      : entry.contextExcerpt
      ? { value: { ...entry.value, text: entry.contextExcerpt.text, canonicalText: entry.contextExcerpt.text,
          targetedZoningContext: entry.contextExcerpt.metadata }, excerpt: null }
      : !entry.pinned.richSourceID &&
      allowance > 0 &&
      targetedDefinitionCount < limits.maximumTargetedDefinitions
      ? targetedDefinitionValue(
          entry.value,
          definitionSelectionContext(query.retrievalQuery, [entry.pinned]),
          allowance
        )
      : { value: entry.value, excerpt: null };
    if (!targeted.excerpt && !entry.contextExcerpt && !entry.completeZoningText && !entry.pinned.richSourceID && allowance > 0) {
      targeted = {
        ...targeted,
        value: questionSpecificBlockValue(targeted.value, query.retrievalQuery, allowance)
      };
    }
    const record = sourceRecord(targeted.value, {
      origin: sourceOrigins.pinned,
      sourceID: compactText(entry.pinned.sourceID || entry.pinned.id) ||
        deterministicSourceID(sourceOrigins.pinned, entry.value, entry.index),
      relationship: compactText(entry.pinned.relationship) || "Pinned by the user",
      characterAllowance: allowance,
      canonicalResolved: entry.resolved,
      retrievalReason: "Explicitly pinned by the user",
      retrievalVersion: researchEvidenceAssemblyVersion,
      retrievalDepth: 0,
      evidencePriority: researchEvidencePriorityMetadata({
        ...entry.value,
        origin: sourceOrigins.pinned
      }),
      targetedDefinition: targeted.excerpt,
      retrievedAt
    });
    if (targeted.value.questionSpecificPassage) {
      record.questionSpecificPassage = structuredClone(targeted.value.questionSpecificPassage);
    }
    record.userSelectedText = compactText(
      entry.pinned.userSelectedText || entry.pinned.selectedText || entry.pinned.text
    );
    if (entry.contextExcerpt && record.userSelectedText) {
      record.pinnedSelectionExcerpted = true;
      record.pinnedSelectionExact = false;
    }
    if (
      entry.resolved &&
      !entry.pinned.richSourceID &&
      !entry.contextExcerpt &&
      record.userSelectedText &&
      compactText(record.text) !== record.userSelectedText
    ) {
      const canonicalContextText = record.richSourceID
        ? canonicalText(entry.value)
        : record.text;
      const selectedText = record.userSelectedText.slice(0, allowance).trimEnd();
      const contextAllowance = Math.max(0, allowance - selectedText.length);
      record.text = selectedText;
      record.canonicalContextText = canonicalContextText.slice(0, contextAllowance).trimEnd();
      record.canonicalContextComplete = canonicalContextText.length <= contextAllowance;
      record.truncated = selectedText.length < record.userSelectedText.length ||
        canonicalContextText.length > record.canonicalContextText.length;
      record.pinnedSelectionExact = selectedText.length === record.userSelectedText.length;
      [
        "richSourceID",
        "richSourceKind",
        "richSourceReference",
        "richSourceCanonicalReference",
        "richSourceContentHash",
        "richSourceRowCount",
        "richSourceGrids"
      ].forEach((key) => delete record[key]);
    }
    const exactStructuredText = entry.pinned.richSourceID
      ? String(entry.pinned.text || entry.pinned.selectedText || "").trim()
      : "";
    if (exactStructuredText && exactStructuredText.length <= allowance) {
      record.text = exactStructuredText;
      record.canonicalContextComplete = false;
      record.truncated = false;
      [
        "richSourceID",
        "richSourceKind",
        "richSourceReference",
        "richSourceContentHash",
        "richSourceRowCount",
        "richSourceGrids"
      ].forEach((key) => {
        if (entry.pinned[key] !== undefined && entry.pinned[key] !== null) {
          record[key] = structuredClone(entry.pinned[key]);
        }
      });
    }
    if (record.userSelectedText && record.pinnedSelectionExact === undefined) {
      record.pinnedSelectionExact = compactText(record.text) === record.userSelectedText;
    }
    if (Array.isArray(entry.pinned.visualSources) && entry.pinned.visualSources.length) {
      record.visualSources = structuredClone(entry.pinned.visualSources);
    }
    sources.push(record);
    if (targeted.excerpt) targetedDefinitionCount += 1;
    characterCount += record.text.length;
    pinnedCanonicalContextCharacterCount += String(record.canonicalContextText || "").length;
    const identity = sectionIdentity(record);
    if (identity) includedSectionIdentities.add(identity);
    if (entry.resolved) {
      canonicalForExpansion.push(query.relevanceComparison || targeted.excerpt
        ? { ...entry.value, text: record.text, canonicalText: record.text, crossReferences: [] }
        : entry.value);
    }
  }

  const pinnedCharacterCount = characterCount;
  const pinnedSelectionExactCount = sources.filter((source) =>
    source.origin === sourceOrigins.pinned && source.pinnedSelectionExact === true
  ).length;
  const pinnedSelectionTruncatedCount = sources.filter((source) =>
    source.origin === sourceOrigins.pinned && source.pinnedSelectionExact === false && !source.pinnedSelectionExcerpted
  ).length;
  const pinnedSelectionExcerptedCount = sources.filter((source) =>
    source.origin === sourceOrigins.pinned && source.pinnedSelectionExcerpted === true
  ).length;
  const structuredPinnedCount = sources.filter((source) =>
    source.origin === sourceOrigins.pinned && source.richSourceID
  ).length;
  const pinnedTableReferences = new Set(sources
    .filter((source) => source.origin === sourceOrigins.pinned)
    .flatMap((source) => [...tableReferences(source.text, source.codePrefix)]));
  const missingPinnedTable = (reference) => {
    if (reference.referenceKind !== "table") return false;
    const identity = comparableTableReference(`Table ${reference.sectionNumber}`, reference.codePrefix);
    return pinnedTableReferences.has(identity) && !sources.some((source) => source.richSourceGrids &&
      comparableTableReference(source.richSourceCanonicalReference || source.richSourceReference, source.codePrefix) === identity);
  };
  const supplementalCharacterCeiling = pinnedEvidence.length
    ? Math.min(limits.maximumCharacters, pinnedCharacterCount + limits.maximumSupplementalCharacters)
    : limits.maximumCharacters;

  let discoveredCount = 0;
  const includeRequestedHistory = (section, explicitlyPinned = false) => {
    if (strictPinnedEvidenceBoundary || discoveredCount >= limits.maximumDiscovered) return false;
    const history = requestedZoningAmendmentHistory(section, query.question, { explicitlyPinned });
    if (!history || sources.some((source) => source.richSourceID === history.id)) return false;
    const record = zoningAmendmentHistoryRecord(section, history, {
      sourceID: `research-metadata-${history.id}`,
      characterAllowance: Math.min(limits.maximumCharactersPerSource, supplementalCharacterCeiling - characterCount),
      retrievedAt
    });
    if (!record) return false;
    sources.push(record);
    characterCount += record.text.length;
    discoveredCount += 1;
    return true;
  };
  for (const entry of resolvedPins) {
    if (entry.resolved) includeRequestedHistory(entry.value, true);
  }
  for (const [index, candidate] of candidates.entries()) {
    if (discoveredCount >= limits.maximumDiscovered) break;
    const identity = sectionIdentity(candidate);
    if (!identity || includedSectionIdentities.has(identity)) continue;
    const remainingCharacters = supplementalCharacterCeiling - characterCount;
    if (remainingCharacters < 1) break;
    let resolved;
    try {
      resolved = await canonicalSection(resolveSection, candidate, sourceOrigins.discovered, {
        includeAmendmentHistory: asksForZoningAmendmentHistoryEvents(query.question)
      });
    } catch {
      resolverFailureCount += 1;
      continue;
    }
    if (includeRequestedHistory(resolved)) {
      includedSectionIdentities.add(sectionIdentity(resolved));
      continue;
    }
    const remainingCandidateSlots = Math.max(
      1,
      Math.min(limits.maximumDiscovered - discoveredCount, candidates.length - index)
    );
    // Keep a leading provision whole when it fits the existing per-source cap.
    // Reserve at least half the remaining budget for other evidence, using the
    // actual section length rather than a multiple of the maximum allowed size.
    // Otherwise a fair share can cut a short section just before its exception
    // or final condition. Oversized ordinary candidates still share the budget.
    const fairCandidateShare = Math.max(1, Math.floor(remainingCharacters / remainingCandidateSlots));
    const completeIndexedExcerpt = canonicalIndexedPassage(resolved, candidate,
      Math.min(limits.maximumCharactersPerSource, Math.floor(remainingCharacters / 2)), query.question);
    const containsOwnTable = new RegExp(`\\btable\\s+${String(resolved.sectionNumber || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      .test(resolved.text || resolved.canonicalText || '');
    const allowance = Math.min(
      limits.maximumCharactersPerSource,
      remainingCharacters,
      ((candidate.rank ?? index + 1) <= 2 && remainingCharacters >= 2 * canonicalText(resolved).length &&
        canonicalText(resolved).length <= limits.maximumCharactersPerSource &&
        (!candidates.some(value => value.evidencePriority?.claimCoverageRequired === true) ||
          candidate.evidencePriority?.claimCoverageRequired === true)) ||
      (index < 3 && (candidate.evidencePriority?.functions?.includes("calculation_table") || containsOwnTable))
        ? remainingCharacters : Math.max(fairCandidateShare, completeIndexedExcerpt?.text.length || 0)
    );
    const indexedExcerpt = canonicalIndexedPassage(resolved, candidate, allowance, query.question);
    const contextExcerpt = indexedExcerpt || candidate?.signals?.useSelectedPassageOnly === true ? null
      : targetedZoningContextExcerpt(resolved, { question: query.question, plan: questionPlan });
    // A scoped excerpt is atomic. When it cannot fit, retain the ordinary
    // shortened-source limitation rather than mislabel a partial excerpt.
    const targeted = contextExcerpt && contextExcerpt.text.length <= allowance
      ? { value: { ...resolved, text: contextExcerpt.text, canonicalText: contextExcerpt.text,
          targetedZoningContext: contextExcerpt.metadata }, excerpt: null }
      : targetedDefinitionCount < limits.maximumTargetedDefinitions
      ? targetedDefinitionValue(
          resolved,
          definitionSelectionContext(query.retrievalQuery, canonicalForExpansion),
          allowance
        )
      : { value: resolved, excerpt: null };
    const passageValue = indexedExcerpt ? { ...resolved, text: indexedExcerpt.text, canonicalText: indexedExcerpt.text }
      : targeted.excerpt || contextExcerpt ? targeted.value
      : questionSpecificBlockValue(targeted.value, query.retrievalQuery, allowance);
    const record = sourceRecord(passageValue, {
      origin: sourceOrigins.discovered,
      sourceID: deterministicSourceID(sourceOrigins.discovered, resolved, index),
      relationship: compactText(candidate.whyRelevant) || "Automatically retrieved for this answer",
      characterAllowance: allowance,
      canonicalResolved: true,
      retrievalReason: compactText(candidate.whyRelevant) || "Automatically retrieved for this answer",
      retrievalRank: candidate.rank ?? index + 1,
      retrievalScore: candidate.score,
      retrievalVersion: compactText(discovery?.retrievalVersion) || researchEvidenceAssemblyVersion,
      retrievalDepth: 0,
      evidencePriority: candidate.evidencePriority,
      targetedDefinition: targeted.excerpt,
      retrievedAt
    });
    const useSelectedPassageOnly = candidate?.signals?.useSelectedPassageOnly === true;
    if (indexedExcerpt) {
      // Rich table-only replacement has a different scope from the indexed
      // passage. Its grid remains bound independently, but a locator for the
      // omitted prose cannot prove the delivered table is a complete section.
      const indexedTextPreserved = record.text === indexedExcerpt.text;
      record.canonicalContextComplete = indexedTextPreserved && indexedExcerpt.completeSection;
      record.truncated = false;
      if (indexedTextPreserved) record.indexedPassage = { ...indexedExcerpt, text: undefined };
    }
    if (useSelectedPassageOnly) {
      const selectedPassage = compactText(candidate.selectedText).slice(0, allowance);
      if (selectedPassage) {
        if (record.text !== selectedPassage) delete record.indexedPassage;
        record.text = selectedPassage;
        record.canonicalContextComplete = false;
        record.truncated = false;
        record.discoveryPassageOnly = true;
      }
    }
    // A separately cataloged companion is its own canonical sibling scope.
    // If its complete source cannot fit, omit this optional reservation rather
    // than deliver a clipped or narrower block as the complete companion.
    if (candidate?.signals?.completeSiblingCompanionOf && !record.canonicalContextComplete) continue;
    if (!record.text) break;
    sources.push(record);
    if (record.truncated && (candidate.evidencePriority?.claimCoverageRequired === true ||
        (query.contextDependentFollowUp && index < 2)) &&
        !useSelectedPassageOnly && !indexedExcerpt && !targeted.excerpt && !query.relevanceComparison) {
      incompleteGoverningPassages.push({ record, value: resolved });
    }
    if (targeted.excerpt) targetedDefinitionCount += 1;
    canonicalForExpansion.push({
      ...(indexedExcerpt ? { ...resolved, text: record.text, canonicalText: record.text,
          crossReferences: inlineCrossReferences(record.text, resolved.codePrefix) }
        : useSelectedPassageOnly || query.relevanceComparison || targeted.excerpt
        ? { ...resolved, text: record.text, canonicalText: record.text, crossReferences: [] }
        : resolved),
      researchAssemblyOrigin: sourceOrigins.discovered
    });
    includedSectionIdentities.add(sectionIdentity(resolved));
    characterCount += record.text.length;
    discoveredCount += 1;
  }

  // A numerical question whose leading passages contain no requested measure
  // warrants one terminology-guided lookup. Reassemble with the same limits
  // rather than appending an unbounded second evidence package.
  const recoveryQuery = !recoveryAttempted && !pinnedEvidence.length &&
    appliedStrategy.mode === researchEvidenceStrategies.broad
    ? researchMeasurementRecoveryQuery(query.question, sources) : null;
  if (recoveryQuery) {
    let targeted;
    try { targeted = await discover({ question: recoveryQuery, limit: limits.maximumCandidates, retrievalContext: {
      sourceQuery: recoveryQuery, currentQuestion: recoveryQuery,
      contextDependentFollowUp: false, relevanceComparison: false
    } }); } catch { targeted = { candidates: [] }; }
    const additions = candidateValues(targeted).filter(candidate =>
      !sources.some(existing => sectionIdentity(existing) === sectionIdentity(candidate)));
    if (additions.length) {
      const promoted = additions.slice(0, 2);
      const merged = [...promoted, ...candidateValues(discovery).filter(candidate =>
        !promoted.some(leading => sectionIdentity(leading) === sectionIdentity(candidate)))].slice(0, limits.maximumCandidates)
        .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
      const recovered = await assembleResearchEvidence({ question, previousTopic, previousMessages, projectFacts,
        pinnedEvidence, topicContext, questionPlan, strategy, resolveSection, onStage,
        limits: requestedLimits, recoveryAttempted: true,
        discover: async () => ({ ...discovery, candidates: merged }) });
      recovered.rulePackets.measurementRecovery = { attempted: true, addedCandidates: additions.slice(0, 2).map(sectionDescriptor) };
      return recovered;
    }
    recoveryAttempted = true;
  }

  // Definitions rank after controlling provisions, so a bounded discovery set can
  // legitimately fill before a giant canonical definition section such as BC 202.
  // Reserve a separate, small budget for query-targeted enacted definition entries.
  const dependencyPlan = !pinnedEvidence.length && appliedStrategy.mode === researchEvidenceStrategies.broad
    ? researchTopicDependencyPlan({ question: query.retrievalQuery, sources })
    : null;
  // A reviewed topic plan already reserves its governing dependencies. Keep
  // that package within its established request budget; incidental dictionaries
  // must not consume the space needed for those complete governing provisions.

  await onStage?.("reviewing_provisions", "completed");
  await onStage?.("following_cross_references", "active");

  // Reviewed topic dependencies precede opportunistic references and share
  // the existing character and provider-spend ceilings.
  let topicDependencyCount = 0;
  const missingTopicDependencies = [];
  for (const [index, reference] of (dependencyPlan?.references || []).entries()) {
    const existing = sources.find((source) => source.codePrefix === reference.codePrefix &&
      source.sectionNumber === reference.sectionNumber && sameTopicDependencyCorpus(source, dependencyPlan.anchor));
    const completeDefinitionDependency = reference.definitionLabels?.length > 0;
    const suppliedDefinitionLabels = new Set((existing?.targetedDefinition?.labels || []).map(label => compactText(label).toLowerCase()));
    if (existing?.canonicalContextComplete || (completeDefinitionDependency && existing?.targetedDefinition?.completeDefinitionEntries &&
        reference.definitionLabels.every(label => suppliedDefinitionLabels.has(compactText(label).toLowerCase())))) {
      existing.evidencePriority = topicDependencyPriority(existing.evidencePriority, dependencyPlan, reference);
      continue;
    }
    if (existing && (existing.discoveryPassageOnly || existing.targetedZoningContext ||
        (existing.targetedDefinition && !completeDefinitionDependency))) {
      missingTopicDependencies.push(reference.sectionNumber);
      continue;
    }
    // A discovered source may have been shortened to its fair share before the
    // governing topic dependencies were known. Spend the remaining topic budget
    // to restore that source instead of treating its omitted rule as unavailable.
    const remainingCharacters = supplementalCharacterCeiling - characterCount + (existing?.text.length || 0);
    if ((!existing && topicDependencyCount >= limits.maximumTopicDependencies) || remainingCharacters < 1) {
      missingTopicDependencies.push(reference.sectionNumber);
      continue;
    }
    let resolved;
    try {
      resolved = await canonicalSection(async (request) => {
        const value = await resolveSection(request);
        // Validate the resolver's own identity before canonicalSection can fill
        // omitted descriptor fields from the requested reference.
        if (value?.codePrefix !== reference.codePrefix || value?.sectionNumber !== reference.sectionNumber ||
          !sameTopicDependencyCorpus(value, dependencyPlan.anchor)) throw new Error("Dependency corpus mismatch");
        return value;
      }, reference, sourceOrigins.crossReference);
    } catch {
      resolverFailureCount += 1;
      missingTopicDependencies.push(reference.sectionNumber);
      continue;
    }
    const definitionExcerpt = completeDefinitionDependency ? targetedDefinitionExcerpt(resolved,
      reference.definitionLabels.join(" "), { completeDefinitionLabels: reference.definitionLabels,
        maximumCharacters: Math.min(limits.maximumCharactersPerSource, remainingCharacters) }) : null;
    if (completeDefinitionDependency && !definitionExcerpt) {
      missingTopicDependencies.push(reference.sectionNumber);
      continue;
    }
    const dependencyValue = definitionExcerpt
      ? { ...resolved, text: definitionExcerpt.text, canonicalText: definitionExcerpt.text }
      : resolved;
    // Do not truncate a dimensional rule away from its exceptions. If it cannot
    // fit, preserve an explicit gap instead of declaring the topic complete.
    if (dependencyValue.text.length > Math.min(limits.maximumCharactersPerSource, remainingCharacters)) {
      missingTopicDependencies.push(reference.sectionNumber);
      continue;
    }
    const record = sourceRecord(dependencyValue, {
      origin: existing?.origin || sourceOrigins.crossReference,
      sourceID: existing?.sourceID || deterministicSourceID(sourceOrigins.crossReference, resolved, index),
      relationship: `${dependencyPlan.label}: ${reference.purpose}`,
      characterAllowance: remainingCharacters,
      canonicalResolved: true,
      retrievalReason: reference.claimCoverageRequired === false
        ? "Reviewed edition-matched supporting scope dependency" : "Reviewed edition-matched governing dependency",
      retrievalVersion: dependencyPlan.version,
      retrievalDepth: 1,
      evidencePriority: topicDependencyPriority(
        researchEvidencePriorityMetadata({ ...resolved, origin: sourceOrigins.crossReference, retrievalDepth: 1 }),
        dependencyPlan, reference),
      ...(definitionExcerpt ? { targetedDefinition: (({ text, ...metadata }) => metadata)(definitionExcerpt) } : {}),
      retrievedAt
    });
    if (definitionExcerpt && !existing?.targetedDefinition) targetedDefinitionCount += 1;
    if (existing) {
      characterCount += record.text.length - existing.text.length;
      Object.assign(existing, record);
    } else {
      sources.push(record);
      includedSectionIdentities.add(sectionIdentity(resolved));
      characterCount += record.text.length;
      topicDependencyCount += 1;
    }
  }
  const crossReferenceQueue = [];
  const queuedCrossReferenceIdentities = new Set();
  if (!strictPinnedEvidenceBoundary) {
    for (const entry of resolvedPins) {
      if (!entry.resolved) continue;
      const ancestorReferences = canonicalAncestorReferences(entry.value);
      for (const reference of ancestorReferences) {
        const identity = sectionIdentity(reference);
        if (
          !identity ||
          (includedSectionIdentities.has(identity) && !missingPinnedTable(reference)) ||
          queuedCrossReferenceIdentities.has(identity)
        ) continue;
        queuedCrossReferenceIdentities.add(identity);
        crossReferenceQueue.push(reference);
      }
    }
    for (const source of canonicalForExpansion) {
      if (
        pinnedEvidence.length &&
        source?.researchAssemblyOrigin === sourceOrigins.discovered
      ) continue;
      for (const unresolvedReference of normalizedCrossReferences(source, {
        inlineOnly: query.relevanceComparison
      })) {
        const sourceSectionRoot = compactText(source?.sectionNumber).split(".")[0];
        const referenceSectionRoot = compactText(unresolvedReference?.sectionNumber).split(".")[0];
        const reference = {
          ...unresolvedReference,
          // Numbered references belong to their source edition, even when a
          // comparison turn searches multiple editions of the same code.
          ...(unresolvedReference.codePrefix === source.codePrefix ? {
            corpusID: source.corpusID, codeVersion: source.codeVersion
          } : {}),
          codeEdition: source.codeEdition,
          sameSectionFamily: Boolean(
            sourceSectionRoot && referenceSectionRoot && sourceSectionRoot === referenceSectionRoot
          )
        };
        const identity = sectionIdentity(reference);
        if (
          !identity ||
          (includedSectionIdentities.has(identity) && !missingPinnedTable(reference)) ||
          queuedCrossReferenceIdentities.has(identity)
        ) continue;
        queuedCrossReferenceIdentities.add(identity);
        crossReferenceQueue.push(reference);
      }
    }
  }
  const crossReferencePriority = (reference) => {
    if (reference?.referencePurpose === "canonical_ancestor_scope") return 4;
    if (String(reference?.referenceKind || "").toLowerCase() === "table") return 3;
    if (reference?.sameSectionFamily === true) return 2;
    return 0;
  };
  crossReferenceQueue.sort((left, right) =>
    crossReferencePriority(right) - crossReferencePriority(left)
  );

  let crossReferenceCount = 0;
  // The reviewed design dependencies replace most opportunistic expansion;
  // do not append a second broad reference package and crowd out the cost budget.
  const maximumCrossReferencesForTurn = dependencyPlan && !dependencyPlan.preserveGenericExpansion
    ? Math.min(limits.maximumCrossReferences, dependencyPlan.maximumGenericCrossReferences ?? 2)
    : limits.maximumCrossReferences;
  for (const [index, reference] of crossReferenceQueue.entries()) {
    if (crossReferenceCount >= maximumCrossReferencesForTurn) break;
    const remainingCharacters = supplementalCharacterCeiling - characterCount;
    if (remainingCharacters < 1) break;
    let resolved;
    try {
      resolved = await canonicalSection(resolveSection, reference, sourceOrigins.crossReference);
    } catch {
      resolverFailureCount += 1;
      continue;
    }
    const identity = sectionIdentity(resolved);
    // An exact excerpt does not supply the complete table in its section.
    // Add the referenced grid separately, retaining every selected fragment.
    const sameSectionTable = includedSectionIdentities.has(identity) && missingPinnedTable(reference);
    if (!identity || (includedSectionIdentities.has(identity) && !sameSectionTable)) continue;
    const allowance = Math.min(limits.maximumCharactersPerSource, remainingCharacters);
    const targeted = targetedDefinitionCount < limits.maximumTargetedDefinitions
      ? targetedDefinitionValue(
          resolved,
          definitionSelectionContext(query.retrievalQuery, canonicalForExpansion),
          allowance
        )
      : { value: resolved, excerpt: null };
    const ancestorScope = reference.referencePurpose === "canonical_ancestor_scope";
    const relationship = ancestorScope
      ? `Governing ancestor scope for pinned ${reference.codePrefix || resolved.codePrefix} ${reference.sectionNumber || resolved.sectionNumber}`
      : `Direct enacted-text cross-reference from this answer's primary evidence`;
    const record = sourceRecord(targeted.value, {
      origin: sourceOrigins.crossReference,
      sourceID: deterministicSourceID(sourceOrigins.crossReference, resolved, index),
      relationship,
      characterAllowance: allowance,
      canonicalResolved: true,
      retrievalReason: ancestorScope
        ? `Canonical ancestor scope for pinned ${reference.codePrefix || resolved.codePrefix} ${reference.sectionNumber || resolved.sectionNumber}`
        : `Direct cross-reference to ${reference.codePrefix || resolved.codePrefix} ${reference.sectionNumber || resolved.sectionNumber}`,
      retrievalVersion: compactText(discovery?.retrievalVersion) || researchEvidenceAssemblyVersion,
      retrievalDepth: 1,
      evidencePriority: researchEvidencePriorityMetadata({
        ...resolved,
        origin: sourceOrigins.crossReference,
        retrievalDepth: 1
      }),
      targetedDefinition: targeted.excerpt,
      retrievedAt
    });
    if (record.truncated) {
      limitations.push({ kind: "cross-reference-context-incomplete",
        reference: `${resolved.codePrefix} ${resolved.sectionNumber}`,
        text: `Complete context for referenced ${resolved.codePrefix} ${resolved.sectionNumber} could not fit the remaining evidence budget. No partial prefix was supplied; the dependency remains unresolved.` });
      continue;
    }
    if (!record.text) break;
    if (sameSectionTable && (!record.richSourceGrids ||
        comparableTableReference(record.richSourceCanonicalReference || record.richSourceReference, record.codePrefix) !==
        comparableTableReference(`Table ${reference.sectionNumber}`, reference.codePrefix))) continue;
    sources.push(record);
    if (targeted.excerpt) targetedDefinitionCount += 1;
    includedSectionIdentities.add(identity);
    characterCount += record.text.length;
    crossReferenceCount += 1;
    canonicalForExpansion.push(resolved);
  }
  await onStage?.("following_cross_references", "completed");

  // One bounded recovery pass over canonical dependencies. It can recover a
  // table referenced by a first-hop rule without repeating a model call or
  // recursively walking the code. Never exceed the original character budget.
  const packetPlan = researchRulePacketPlan({ sources, canonicalSources: canonicalForExpansion,
    referencesFor: normalizedCrossReferences, strictBoundary: strictPinnedEvidenceBoundary });
  let recoveryReads = 0;
  let recoveredReferenceCount = 0;
  let recoverySearchCount = recoveryAttempted ? 1 : 0;
  for (const reference of packetPlan.recoveryReferences) {
    if (recoveryReads >= 4 || supplementalCharacterCeiling <= characterCount) break;
    if (suppliedRuleReference(sources, reference)) continue;
    if (crossReferenceCount + recoveredReferenceCount >= maximumCrossReferencesForTurn) break;
    recoveryReads += 1;
    let resolved;
    try { resolved = await canonicalSection(resolveSection, reference, sourceOrigins.crossReference); }
    catch { /* A table can be stored under a differently numbered parent. */ }
    if (!resolved && reference.referenceKind === "table" && recoverySearchCount === 0 && recoveryReads < 4) {
      recoverySearchCount += 1;
      const recoveryQuestion = `${reference.codePrefix} Table ${reference.sectionNumber}`;
      const targeted = await Promise.resolve().then(() => discover({ question: recoveryQuestion, limit: 2, retrievalContext: {
        currentQuestion: recoveryQuestion, sourceQuery: recoveryQuestion,
        contextDependentFollowUp: false, relevanceComparison: false
      } })).catch(() => ({ candidates: [] }));
      for (const candidate of candidateValues(targeted).slice(0, 2)) {
        if (recoveryReads >= 4) break;
        if (candidate.codePrefix !== reference.codePrefix ||
            (reference.codeEdition && candidate.codeEdition !== reference.codeEdition) ||
            (reference.corpusID && candidate.corpusID !== reference.corpusID)) continue;
        recoveryReads += 1;
        try {
          const found = await canonicalSection(resolveSection, candidate, sourceOrigins.crossReference);
          const table = applicableStructuredTable(found);
          if (comparableTableReference(table?.canonicalReference || table?.reference, found.codePrefix) ===
              comparableTableReference(recoveryQuestion, reference.codePrefix)) { resolved = found; break; }
        } catch { /* Preserve the explicit unresolved dependency. */ }
      }
    }
    if (!resolved) continue;
    const existing = reference.referenceKind === "table" ? null : sources.find(source =>
      sectionIdentity(source) === sectionIdentity(resolved) && !source.canonicalContextComplete &&
      source.origin !== sourceOrigins.pinned);
    const allowance = Math.min(limits.maximumCharactersPerSource,
      supplementalCharacterCeiling - characterCount + (existing?.text.length || 0));
    // Indexed children do not prove that enclosing scope and closing parent
    // conditions are present across arbitrary imported blocks. Recover the
    // complete canonical dependency atomically, or retain its explicit absence.
    if (canonicalText(resolved).length > allowance) continue;
    const record = sourceRecord(resolved, {
      origin: sourceOrigins.crossReference,
      sourceID: existing?.sourceID || deterministicSourceID(sourceOrigins.crossReference, resolved, `recovery-${recoveryReads}`),
      relationship: `Canonical dependency of ${reference.parentSourceID}; applicability requires review`,
      characterAllowance: allowance, canonicalResolved: true,
      retrievalReason: "Targeted recovery of a missing canonical rule dependency",
      retrievalVersion: researchEvidenceAssemblyVersion, retrievalDepth: reference.parentDepth + 1,
      evidencePriority: existing?.evidencePriority || researchEvidencePriorityMetadata({
        ...resolved, origin: sourceOrigins.crossReference, retrievalDepth: reference.parentDepth + 1
      }), retrievedAt
    });
    if (!record.text || !suppliedRuleReference([record], reference)) continue;
    if (existing) {
      characterCount -= existing.text.length;
      Object.assign(existing, record);
    } else {
      sources.push(record);
      includedSectionIdentities.add(sectionIdentity(record));
    }
    characterCount += record.text.length;
    recoveredReferenceCount += 1;
  }

  // Initial fair shares protect room for other candidates and dependencies.
  // Once those are assembled, reclaim unused space for complete governing
  // passages. A long table must not hide a qualification below it merely
  // because the other candidates turned out to be short.
  for (const { record, value } of incompleteGoverningPassages.sort((a, b) =>
    Number(b.record.evidencePriority?.claimCoverageRequired === true) - Number(a.record.evidencePriority?.claimCoverageRequired === true))) {
    if (!record.truncated) continue;
    const completeText = canonicalText(value);
    const additionalCharacters = completeText.length - record.text.length;
    if (additionalCharacters <= 0 || completeText.length > limits.maximumCharactersPerSource ||
        characterCount + additionalCharacters > supplementalCharacterCeiling) continue;
    const withTable = attachStructuredTable({
      ...record, text: completeText, canonicalContextComplete: true, truncated: false
    }, value, completeText.length);
    Object.assign(record, withTable, {
      text: completeText, canonicalContextComplete: true, truncated: false,
      completionReason: "unused_evidence_budget_for_governing_passage"
    });
    characterCount += additionalCharacters;
  }

  // Same-authority interpretation context can help distinguish a specific
  // exception from a general requirement. It is supporting enacted evidence,
  // never a legal conclusion, mandatory output claim or substitute code family.
  // Operative sources and their complete direct dependencies receive space first.
  const interpretationPlan = researchInterpretationContextPlan({
    anchors: sources.map(source => {
      const candidate = candidates.find(candidate => candidate.codePrefix === source.codePrefix &&
        candidate.sectionNumber === source.sectionNumber && sectionIdentity(candidate) === sectionIdentity(source));
      const pin = pinnedEvidence.find(pin => pin.codePrefix === source.codePrefix &&
        pin.sectionNumber === source.sectionNumber && sectionIdentity(pin) === sectionIdentity(source));
      const inherited = candidate?.signals?.inheritedAuthorityReference === true;
      return { ...source,
        eligiblePrimary: source.canonicalContextResolved === true && source.retrievalDepth === 0 &&
          [sourceOrigins.discovered, sourceOrigins.pinned].includes(source.origin) &&
          !source.targetedDefinition && !source.discoveryPassageOnly && !source.referenceOnly &&
          candidate?.referenceOnly !== true && pin?.referenceOnly !== true &&
          candidate?.selectionMode !== "section_reference" && pin?.selectionMode !== "section_reference" &&
          source.richSourceKind !== "amendment-history" &&
          !["contextual", "irrelevant"].includes(source.evidencePriority?.evidenceRole) &&
          !isDefinitionCandidate(source) && !source.evidencePriority?.functions?.includes("definition"),
        ...(inherited ? { inheritedAuthorityReference: true, activeTopic: query.contextDependentFollowUp === true } : {})
      };
    }),
    strategy: appliedStrategy, strictBoundary: strictPinnedEvidenceBoundary, pinnedEvidence,
    explicitlyAuthorizedBroadening: appliedStrategy.mode === researchEvidenceStrategies.broad
  });
  let interpretationContextCount = 0;
  for (const [index, reference] of interpretationPlan.references.entries()) {
    const existing = sources.find(source => source.codePrefix === reference.codePrefix &&
      source.sectionNumber === reference.sectionNumber && sameTopicDependencyCorpus(source, reference));
    if (existing?.canonicalContextComplete && !existing.truncated) continue;
    // A partial non-selected copy can be restored atomically. Exact user
    // selections stay untouched; authorized broadening may append full context.
    const replacement = existing?.origin !== sourceOrigins.pinned ? existing : null;
    const remainingCharacters = supplementalCharacterCeiling - characterCount + (replacement?.text.length || 0);
    if (remainingCharacters < 1) break;
    const { source: resolved, limitation } = await resolveResearchInterpretationContext(reference, resolveSection);
    if (!resolved) {
      limitations.push({ ...limitation, text: `Optional edition-matched ${reference.codePrefix} interpretation context was unavailable. This does not establish that the operative rule is missing.` });
      continue;
    }
    const allowance = Math.min(limits.maximumCharactersPerSource, remainingCharacters);
    if (resolved.text.length > allowance) {
      limitations.push({ kind: "optional-interpretation-context-budget", optional: true,
        reference: `${reference.codePrefix} ${reference.sectionNumber}`,
        text: "Complete optional interpretation context did not fit the remaining budget; operative evidence was preserved." });
      continue;
    }
    const record = sourceRecord(resolved, {
      origin: replacement?.origin || sourceOrigins.crossReference,
      sourceID: replacement?.sourceID || deterministicSourceID(sourceOrigins.crossReference, resolved, `interpretation-${index}`),
      relationship: `Same-edition interpretation context for operative ${reference.codePrefix} evidence`,
      characterAllowance: allowance, canonicalResolved: true,
      retrievalReason: "Optional same-authority enacted interpretation context",
      retrievalVersion: interpretationPlan.version, retrievalDepth: replacement?.retrievalDepth ?? 1,
      evidencePriority: replacement?.evidencePriority || resolved.evidencePriority, retrievedAt
    });
    if (!record.text || record.truncated) continue;
    Object.assign(record, { interpretationContext: true, optional: record.evidencePriority?.claimCoverageRequired !== true,
      referencePurpose: reference.referencePurpose, anchorSourceIDs: resolved.anchorSourceIDs,
      anchorSectionIDs: resolved.anchorSectionIDs });
    if (replacement) {
      characterCount -= replacement.text.length;
      Object.assign(replacement, record);
    } else sources.push(record);
    includedSectionIdentities.add(sectionIdentity(record));
    characterCount += record.text.length;
    interpretationContextCount += 1;
  }

  // Optional definitions fill the remaining space; an oversized definitions
  // section must not displace the complete closing conditions of a short rule.
  const definitionCandidates = dependencyPlan?.corpusPrefix === "ZR" && !dependencyPlan.preserveGenericExpansion ? [] : [...candidates, ...prioritizeResearchEvidence(
    Array.isArray(discovery?.supplementalDefinitionCandidates) ? discovery.supplementalDefinitionCandidates : [],
    { limit: limits.maximumTargetedDefinitions, pinnedScopeActive: true }
  )];
  for (const [index, candidate] of definitionCandidates.entries()) {
    if (targetedDefinitionCount >= limits.maximumTargetedDefinitions) break;
    if (!isDefinitionCandidate(candidate)) continue;
    const candidateIdentity = sectionIdentity(candidate);
    if (!candidateIdentity || includedSectionIdentities.has(candidateIdentity)) continue;
    const remainingCharacters = supplementalCharacterCeiling - characterCount;
    if (remainingCharacters < 1) break;
    let resolved;
    try {
      resolved = await canonicalSection(resolveSection, candidate, sourceOrigins.discovered);
    } catch {
      resolverFailureCount += 1;
      continue;
    }
    const identity = sectionIdentity(resolved);
    if (!identity || includedSectionIdentities.has(identity)) continue;
    const allowance = Math.min(limits.maximumCharactersPerSource, remainingCharacters, 2_500);
    const targeted = targetedDefinitionValue(
      resolved,
      definitionSelectionContext(query.retrievalQuery, canonicalForExpansion),
      allowance
    );
    if (!targeted.excerpt) continue;
    const record = sourceRecord(targeted.value, {
      origin: sourceOrigins.discovered,
      sourceID: deterministicSourceID(sourceOrigins.discovered, resolved, index),
      relationship: compactText(candidate.whyRelevant) ||
        "Query-targeted definitions from the enacted text",
      characterAllowance: allowance,
      canonicalResolved: true,
      retrievalReason: compactText(candidate.whyRelevant) ||
        "Query-targeted definitions from the enacted text",
      retrievalRank: candidate.rank ?? index + 1,
      retrievalScore: candidate.score,
      retrievalVersion: compactText(discovery?.retrievalVersion) || researchEvidenceAssemblyVersion,
      retrievalDepth: 0,
      evidencePriority: candidate.evidencePriority,
      targetedDefinition: targeted.excerpt,
      retrievedAt
    });
    if (!record.text) continue;
    sources.push(record);
    includedSectionIdentities.add(identity);
    characterCount += record.text.length;
    targetedDefinitionCount += 1;
  }

  // Generic expansion may recover a dependency that the topic-specific count
  // limit omitted. Report final coverage, not an intermediate false absence.
  const unresolvedTopicDependencies = missingTopicDependencies.filter((sectionNumber) => {
    const reference = dependencyPlan.references.find(reference => reference.sectionNumber === sectionNumber);
    const recovered = sources.find((source) => source.codePrefix === dependencyPlan.corpusPrefix && source.sectionNumber === sectionNumber &&
      (source.canonicalContextComplete || (reference.definitionLabels?.length && source.targetedDefinition?.completeDefinitionEntries &&
        reference.definitionLabels.every(label => source.targetedDefinition.labels.some(supplied => compactText(supplied).toLowerCase() === compactText(label).toLowerCase())))) &&
      sameTopicDependencyCorpus(source, dependencyPlan.anchor));
    if (!recovered) return true;
    recovered.evidencePriority = topicDependencyPriority(recovered.evidencePriority, dependencyPlan,
      dependencyPlan.references.find(reference => reference.sectionNumber === sectionNumber));
    return false;
  });
  if (unresolvedTopicDependencies.length) limitations.push({
    kind: "topic-dependency-coverage-gap",
    text: `The routed ${dependencyPlan.label.toLowerCase()} package could not include complete edition-matched ${dependencyPlan.corpusPrefix} sections: ${unresolvedTopicDependencies.join(", ")}. Do not infer those requirements from memory.`,
    planID: dependencyPlan.id
  });

  if (resolverFailureCount) {
    limitations.push({
      kind: "canonical-section-unavailable",
      count: resolverFailureCount,
      text: `${resolverFailureCount} enacted ${resolverFailureCount === 1 ? "section was" : "sections were"} not available from the canonical resolver.`
    });
  }
  if (sources.some((source) => source.truncated)) {
    limitations.push({
      kind: "evidence-character-limit",
      text: "At least one enacted section was shortened to keep this answer within the evidence character limit."
    });
  }
  if (targetedDefinitionCount) {
    limitations.push({
      kind: "targeted-definition-excerpt",
      count: targetedDefinitionCount,
      text: "One or more very large canonical definition sections were represented by query-targeted enacted definition entries; the complete section was not included in this bounded evidence package."
    });
  }
  for (const source of sources.filter((item) => item.targetedZoningContext)) {
    limitations.push({ kind: "targeted-zoning-context-excerpt", sourceID: source.sourceID,
      text: source.targetedZoningContext.limitation });
  }
  if (crossReferenceQueue.length > crossReferenceCount) {
    limitations.push({
      kind: "cross-reference-limit",
      text: "Additional direct cross-references were identified but were not added to this bounded answer package."
    });
  }
  const includedDiscoveredIdentities = new Set(sources
    .filter((source) => source.origin === sourceOrigins.discovered)
    .map(sectionIdentity)
    .filter(Boolean));
  const requestedTableReferences = new Set([...pinnedTableReferences, ...candidates
    .filter((candidate) => includedDiscoveredIdentities.has(sectionIdentity(candidate)))
    .flatMap((candidate) =>
    (Array.isArray(candidate?.sourceReviewRequirements) ? candidate.sourceReviewRequirements : [])
      .filter((requirement) => requirement?.kind === "referenced-table")
      .flatMap((requirement) => Array.isArray(requirement.references) ? requirement.references : [])
      .map((reference) => comparableTableReference(reference, candidate.codePrefix))
      .filter(Boolean)
  )]);
  const resolvedTableReferences = new Set(sources
    .map((source) => comparableTableReference(
      source.richSourceCanonicalReference || source.richSourceReference,
      source.codePrefix
    ))
    .filter(Boolean));
  const allRequestedTablesResolved = requestedTableReferences.size === 0 ||
    [...requestedTableReferences].every((reference) => resolvedTableReferences.has(reference));
  const missingPinnedTableReferences = [...pinnedTableReferences].filter((reference) => !resolvedTableReferences.has(reference));
  if (missingPinnedTableReferences.length) limitations.push({
    kind: "referenced-table-review-required",
    references: missingPinnedTableReferences,
    text: "Selected text refers to a table whose complete structured values are not in this evidence package. Do not infer row or column relationships from separate selected fragments."
  });
  for (const limitation of Array.isArray(discovery?.coverageLimitations)
    ? discovery.coverageLimitations
    : []) {
    if (!limitation || limitation.kind === "candidate-review-required") continue;
    if (limitation.kind === "referenced-table-review-required" && allRequestedTablesResolved) continue;
    limitations.push({
      kind: compactText(limitation.kind) || "retrieval-coverage",
      text: compactText(limitation.text) || "The enacted-corpus retrieval stage reported a coverage limitation."
    });
  }
  if (!sources.length) {
    limitations.push({
      kind: "no-enacted-evidence-found",
      text: "Permitext did not locate enacted text in the authorized corpora routed for this question."
    });
  }

  const finalRulePackets = researchRulePacketPlan({ sources, canonicalSources: canonicalForExpansion,
    referencesFor: normalizedCrossReferences, strictBoundary: strictPinnedEvidenceBoundary });
  for (const packet of finalRulePackets.packets) {
    const source = sources.find(source => source.sourceID === packet.sourceID);
    if (source) source.rulePacket = packet;
  }
  return {
    schemaVersion: 1,
    assemblyVersion: researchEvidenceAssemblyVersion,
    question: query.question,
    retrievalQuery: query.retrievalQuery,
    previousTopicApplied: query.previousTopicApplied,
    projectFactsApplied: query.projectFactsApplied,
    topicDecision: structuredClone(query.topicDecision),
    sourceScope: "authorized_enacted_text",
    sourceMode: "text_only",
    strategy: appliedStrategy,
    rulePackets: { ...finalRulePackets,
      recoveryReads, recoveredReferenceCount, recoverySearchCount },
    limits,
    sources,
    usage: {
      pinnedCount: pinnedEvidence.length,
      pinnedCharacterCount,
      pinnedCanonicalContextCharacterCount,
      pinnedSelectionExactCount,
      pinnedSelectionTruncatedCount,
      pinnedSelectionExcerptedCount,
      structuredPinnedCount,
      supplementalCharacterCeiling,
      supplementalCharacterCount: Math.max(0, characterCount - pinnedCharacterCount),
      candidateCount: candidates.length,
      discoveredCount,
      targetedDefinitionCount,
      crossReferenceCount,
      topicDependencyCount,
      interpretationContextCount,
      characterCount,
      resolverFailureCount,
      nonMaterialCandidateCount
    },
    limitations,
    discovery: {
      retrievalVersion: compactText(discovery?.retrievalVersion),
      ...(discovery?.semanticSearch ? { semanticSearch: structuredClone(discovery.semanticSearch) } : {}),
      ...(discovery?.passageIndexFingerprint ? { passageIndexFingerprint: discovery.passageIndexFingerprint } : {}),
      searchedSectionCount: Number.isFinite(Number(discovery?.searchedSectionCount))
        ? Number(discovery.searchedSectionCount)
        : null,
      outsideCurrentLibrary: Array.isArray(discovery?.outsideCurrentLibrary)
        ? discovery.outsideCurrentLibrary.map((item) => ({
            kind: compactText(item?.kind),
            label: compactText(item?.label),
            sourceName: compactText(item?.sourceName),
            sourceURL: compactText(item?.sourceURL),
            text: compactText(item?.text)
          }))
        : []
    }
  };
}
