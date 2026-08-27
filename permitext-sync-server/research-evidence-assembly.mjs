import {
  prioritizeResearchEvidence,
  researchEvidencePriorityMetadata
} from "./research-evidence-priority.mjs";
import {
  decideResearchConversationTopic,
  researchConversationTopicDecisions,
  researchQuestionReturnsToOriginalTopic
} from "./research-conversation-topic.mjs";
import { targetedDefinitionExcerpt } from "./research-definition-excerpts.mjs";

export const researchEvidenceAssemblyVersion = "20260827-collateral-scope-v16";

export const researchEvidenceAssemblyLimits = Object.freeze({
  maximumCandidates: 12,
  maximumDiscovered: 10,
  maximumTargetedDefinitions: 2,
  maximumCrossReferences: 6,
  maximumCharacters: 48_000,
  maximumCharactersPerSource: 12_000
});

const sourceOrigins = Object.freeze({
  pinned: "user_pinned",
  discovered: "permitext_discovered",
  crossReference: "permitext_cross_reference"
});

const maximumPinnedAncestorContextSections = 3;

export const researchEvidenceStrategies = Object.freeze({
  broad: "broad",
  pinnedFirst: "pinned_first"
});

const selectedEvidenceCuePattern = /\b(?:selected|pinned)\s+(?:code\s+)?(?:passage|passages|evidence|text)|\b(?:both|this|these|the)\s+(?:selected\s+)?(?:passage|passages|provision|provisions|text)\b/i;
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
  if (!readerOrigin || !pinnedEvidence.length) {
    return { mode: researchEvidenceStrategies.broad, reason: "default_authorized_retrieval" };
  }
  const normalizedQuestion = compactText(question);
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

function prioritizedProjectFacts(question, projectFacts) {
  const values = (Array.isArray(projectFacts) ? projectFacts : [])
    .map((fact) => compactText(fact))
    .filter(Boolean);
  const normalizedQuestion = compactText(question).toLowerCase();
  const questionTerms = new Set(
    normalizedQuestion.match(/[a-z0-9][a-z0-9-]{2,}/g) || []
  );
  const zoningQuestion = /\b(?:zoning|district|far|floor area ratio|parking|setback|yard|lot coverage|permitted use|use permitted|development rights?)\b/i.test(normalizedQuestion);
  const constructionQuestion = /\b(?:building code|construction|occupancy|egress|travel distance|plumbing|fixture|sprinkler|fire code)\b/i.test(normalizedQuestion);
  return values
    .map((text, index) => {
      const normalizedFact = text.toLowerCase();
      let score = 0;
      if (zoningQuestion && /^zoning fact\s+—/i.test(text)) score += 1_000;
      if (constructionQuestion && /^building\s*\/\s*code fact\s+—/i.test(text)) score += 1_000;
      for (const term of questionTerms) {
        if (normalizedFact.includes(term)) score += 10;
      }
      if (/\b(?:address|borough|bbl|block|tax lot|community district)\b/i.test(text)) score += 2;
      return { text, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ text }) => text);
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
  const factContext = prioritizedProjectFacts(normalizedQuestion, projectFacts)
    .slice(0, 30)
    .join("; ")
    .slice(0, 4_000);
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
  let projectFactsApplied = false;
  if (factContext) {
    const factsPrefix = "\nProject facts: ";
    const availableFactCharacters = maximumQueryCharacters - retrievalQuery.length - factsPrefix.length;
    if (availableFactCharacters > 0) {
      retrievalQuery += `${factsPrefix}${factContext.slice(0, availableFactCharacters)}`;
      projectFactsApplied = true;
    }
  }
  return {
    question: normalizedQuestion,
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
  return codePrefix && sectionNumber ? `reference:${codePrefix}:${sectionNumber}` : "";
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
    applicabilityStatus: compactText(value.applicabilityStatus)
  };
}

function candidateValues(discovery) {
  if (Array.isArray(discovery)) return discovery;
  return Array.isArray(discovery?.candidates) ? discovery.candidates : [];
}

async function canonicalSection(resolveSection, value, origin) {
  const requested = sectionDescriptor(value);
  const requestedRichSourceIDs = Array.isArray(value?.richSourceIDs)
    ? new Set(value.richSourceIDs.map((item) => compactText(item)).filter(Boolean))
    : null;
  const resolved = await resolveSection({ ...requested, origin });
  if (!resolved || typeof resolved !== "object") {
    throw new Error(`Canonical enacted text is unavailable for ${requested.sectionID || requested.sectionNumber || "the requested section"}.`);
  }
  const text = canonicalText(resolved);
  if (!text) {
    throw new Error(`Canonical enacted text is empty for ${requested.sectionID || requested.sectionNumber || "the requested section"}.`);
  }
  return {
    ...requested,
    ...sectionDescriptor({ ...requested, ...resolved }),
    text,
    body: resolved.body,
    crossReferences: Array.isArray(resolved.crossReferences) ? resolved.crossReferences : [],
    richSources: (Array.isArray(resolved.richSources) ? resolved.richSources : [])
      .filter((source) => requestedRichSourceIDs === null || requestedRichSourceIDs.has(compactText(source?.id)))
      .map((source) => structuredClone(source))
  };
}

function comparableTableReference(value, fallbackCodePrefix = "") {
  const normalized = compactText(value).toUpperCase();
  const match = normalized.match(/\b(?:(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+)?TABLE\s+([A-Z]?\d+(?:\.[0-9A-Z-]+)*)/i);
  if (!match) return "";
  const codePrefix = String(match[1] || fallbackCodePrefix || "").toUpperCase();
  return codePrefix ? `${codePrefix}:TABLE:${match[2].toUpperCase()}` : `TABLE:${match[2].toUpperCase()}`;
}

function tableReferences(value, fallbackCodePrefix = "") {
  const references = new Set();
  for (const match of compactText(value).matchAll(/\b(?:(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+)?Table\s+([A-Z]?\d+(?:\.[0-9A-Za-z-]+)*)/gi)) {
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
  const exact = completeTables.find((source) => {
    if (String(source?.kind || "").toLowerCase() !== "table") return false;
    const identity = comparableTableReference(source.reference, value?.codePrefix);
    return identity && references.has(identity);
  });
  if (exact) return exact;

  // Some prepared legacy sections preserve a complete grid but label its rich
  // source only as "Official table." Infer the identity only when the section
  // itself is the referenced table and contains exactly one complete grid.
  const ownTableReference = comparableTableReference(
    `${value?.codePrefix || ""} Table ${value?.sectionNumber || ""}`,
    value?.codePrefix
  );
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
  if (!table || !tableText || tableText.length > characterAllowance) return record;
  return {
    ...record,
    text: tableText,
    canonicalContextComplete: false,
    truncated: false,
    richSourceID: compactText(table.id),
    richSourceKind: "table",
    richSourceReference: compactText(table.reference),
    richSourceCanonicalReference: compactText(table.canonicalReference || table.reference),
    richSourceContentHash: compactText(table.contentHash),
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
      referencePurpose: "canonical_ancestor_scope"
    });
  }
  return references;
}

function targetedDefinitionValue(value, context, maximumCharacters) {
  const excerpt = targetedDefinitionExcerpt(value, context, { maximumCharacters });
  if (!excerpt) return { value, excerpt: null };
  const { text, ...metadata } = excerpt;
  return {
    value: { ...value, text },
    excerpt: metadata
  };
}

function definitionSelectionContext(query, values = []) {
  return [
    compactText(query),
    ...values.map((value) => canonicalText(value).slice(0, 4_000))
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
    text,
    canonicalContextResolved: Boolean(canonicalResolved),
    canonicalContextComplete: Boolean(
      canonicalResolved && !targetedDefinition && text.length === rawText.length
    ),
    truncated: targetedDefinition ? false : text.length < rawText.length,
    targetedDefinition: targetedDefinition ? structuredClone(targetedDefinition) : null
  }, value, Math.max(0, characterAllowance));
}

function deterministicSourceID(origin, value, index) {
  const identity = sectionIdentity(value)
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .slice(0, 160);
  return `research-${origin}-${identity || "unknown"}-${index + 1}`;
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
  strategy = null,
  discover,
  resolveSection,
  onStage,
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
  const limits = appliedLimits(requestedLimits);
  const appliedStrategy = strategy?.mode === researchEvidenceStrategies.pinnedFirst
    ? {
        mode: researchEvidenceStrategies.pinnedFirst,
        reason: compactText(strategy.reason) || "selected_evidence_first"
      }
    : {
        mode: researchEvidenceStrategies.broad,
        reason: compactText(strategy?.reason) || "default_authorized_retrieval"
      };
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
          currentQuestion: query.question,
          conversationTopic: query.conversationTopic,
          immediateContext: query.immediateContext,
          contextDependentFollowUp: query.contextDependentFollowUp,
          relevanceComparison: query.relevanceComparison
        }
      });
  const prioritizedCandidates = prioritizeResearchEvidence(candidateValues(discovery), {
    limit: limits.maximumCandidates
  });
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
  const candidates = selectedBuildingCodePassageBoundary && routedTopicPresent
    ? relevanceCandidates.filter((candidate) =>
        candidate?.signals?.exactTopicRouteTarget === true &&
        compactText(candidate?.codePrefix).toUpperCase() === "BC"
      )
    : relevanceCandidates;
  const nonMaterialCandidateCount = prioritizedCandidates.length - candidates.length;
  await onStage?.("searching_authorized_library", "completed");
  await onStage?.("reviewing_provisions", "active");
  const sources = [];
  const canonicalForExpansion = [];
  const includedSectionIdentities = new Set();
  const limitations = [];
  let characterCount = 0;
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
    resolvedPins.push({ index, pinned, value, resolved });
  }

  for (const [position, entry] of resolvedPins.entries()) {
    const remainingCharacters = Math.max(0, limits.maximumCharacters - characterCount);
    const remainingPins = resolvedPins.length - position;
    const fairPinnedShare = remainingPins ? Math.floor(remainingCharacters / remainingPins) : 0;
    const allowance = Math.min(limits.maximumCharactersPerSource, fairPinnedShare);
    const targeted = !entry.pinned.richSourceID &&
      allowance > 0 &&
      targetedDefinitionCount < limits.maximumTargetedDefinitions
      ? targetedDefinitionValue(
          entry.value,
          definitionSelectionContext(query.retrievalQuery, [entry.pinned]),
          allowance
        )
      : { value: entry.value, excerpt: null };
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
    record.userSelectedText = compactText(
      entry.pinned.userSelectedText || entry.pinned.selectedText || entry.pinned.text
    );
    if (
      entry.resolved &&
      !entry.pinned.richSourceID &&
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
    if (Array.isArray(entry.pinned.visualSources) && entry.pinned.visualSources.length) {
      record.visualSources = structuredClone(entry.pinned.visualSources);
    }
    sources.push(record);
    if (targeted.excerpt) targetedDefinitionCount += 1;
    characterCount += record.text.length + String(record.canonicalContextText || "").length;
    const identity = sectionIdentity(record);
    if (identity) includedSectionIdentities.add(identity);
    if (entry.resolved) {
      canonicalForExpansion.push(query.relevanceComparison
        ? { ...entry.value, text: record.text, canonicalText: record.text, crossReferences: [] }
        : entry.value);
    }
  }

  let discoveredCount = 0;
  for (const [index, candidate] of candidates.entries()) {
    if (discoveredCount >= limits.maximumDiscovered) break;
    const identity = sectionIdentity(candidate);
    if (!identity || includedSectionIdentities.has(identity)) continue;
    const remainingCharacters = limits.maximumCharacters - characterCount;
    if (remainingCharacters < 1) break;
    let resolved;
    try {
      resolved = await canonicalSection(resolveSection, candidate, sourceOrigins.discovered);
    } catch {
      resolverFailureCount += 1;
      continue;
    }
    const remainingCandidateSlots = Math.max(
      1,
      Math.min(limits.maximumDiscovered - discoveredCount, candidates.length - index)
    );
    const fairCandidateShare = Math.max(1, Math.floor(remainingCharacters / remainingCandidateSlots));
    const allowance = Math.min(
      limits.maximumCharactersPerSource,
      remainingCharacters,
      fairCandidateShare
    );
    const targeted = targetedDefinitionCount < limits.maximumTargetedDefinitions
      ? targetedDefinitionValue(
          resolved,
          definitionSelectionContext(query.retrievalQuery, canonicalForExpansion),
          allowance
        )
      : { value: resolved, excerpt: null };
    const record = sourceRecord(targeted.value, {
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
    if (useSelectedPassageOnly) {
      const selectedPassage = compactText(candidate.selectedText).slice(0, allowance);
      if (selectedPassage) {
        record.text = selectedPassage;
        record.canonicalContextComplete = false;
        record.truncated = false;
        record.discoveryPassageOnly = true;
      }
    }
    if (!record.text) break;
    sources.push(record);
    if (targeted.excerpt) targetedDefinitionCount += 1;
    canonicalForExpansion.push(useSelectedPassageOnly || query.relevanceComparison
      ? { ...resolved, text: record.text, canonicalText: record.text, crossReferences: [] }
      : resolved);
    includedSectionIdentities.add(sectionIdentity(resolved));
    characterCount += record.text.length;
    discoveredCount += 1;
  }

  // Definitions rank after controlling provisions, so a bounded discovery set can
  // legitimately fill before a giant canonical definition section such as BC 202.
  // Reserve a separate, small budget for query-targeted enacted definition entries.
  for (const [index, candidate] of candidates.entries()) {
    if (targetedDefinitionCount >= limits.maximumTargetedDefinitions) break;
    if (!isDefinitionCandidate(candidate)) continue;
    const candidateIdentity = sectionIdentity(candidate);
    if (!candidateIdentity || includedSectionIdentities.has(candidateIdentity)) continue;
    const remainingCharacters = limits.maximumCharacters - characterCount;
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
    const allowance = Math.min(limits.maximumCharactersPerSource, remainingCharacters);
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

  await onStage?.("reviewing_provisions", "completed");
  await onStage?.("following_cross_references", "active");

  const crossReferenceQueue = [];
  const queuedCrossReferenceIdentities = new Set();
  for (const entry of resolvedPins) {
    if (!entry.resolved) continue;
    const ancestorReferences = canonicalAncestorReferences(entry.value);
    for (const reference of ancestorReferences) {
      const identity = sectionIdentity(reference);
      if (
        !identity ||
        includedSectionIdentities.has(identity) ||
        queuedCrossReferenceIdentities.has(identity)
      ) continue;
      queuedCrossReferenceIdentities.add(identity);
      crossReferenceQueue.push(reference);
    }
  }
  for (const source of canonicalForExpansion) {
    for (const reference of normalizedCrossReferences(source, {
      inlineOnly: query.relevanceComparison
    })) {
      const identity = sectionIdentity(reference);
      if (
        !identity ||
        includedSectionIdentities.has(identity) ||
        queuedCrossReferenceIdentities.has(identity)
      ) continue;
      queuedCrossReferenceIdentities.add(identity);
      crossReferenceQueue.push(reference);
    }
  }
  const crossReferencePriority = (reference) => {
    if (reference?.referencePurpose === "canonical_ancestor_scope") return 3;
    if (String(reference?.referenceKind || "").toLowerCase() === "table") return 2;
    return 0;
  };
  crossReferenceQueue.sort((left, right) =>
    crossReferencePriority(right) - crossReferencePriority(left)
  );

  let crossReferenceCount = 0;
  for (const [index, reference] of crossReferenceQueue.entries()) {
    if (crossReferenceCount >= limits.maximumCrossReferences) break;
    const remainingCharacters = limits.maximumCharacters - characterCount;
    if (remainingCharacters < 1) break;
    let resolved;
    try {
      resolved = await canonicalSection(resolveSection, reference, sourceOrigins.crossReference);
    } catch {
      resolverFailureCount += 1;
      continue;
    }
    const identity = sectionIdentity(resolved);
    if (!identity || includedSectionIdentities.has(identity)) continue;
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
    if (!record.text) break;
    sources.push(record);
    if (targeted.excerpt) targetedDefinitionCount += 1;
    includedSectionIdentities.add(identity);
    characterCount += record.text.length;
    crossReferenceCount += 1;
  }
  await onStage?.("following_cross_references", "completed");

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
  const requestedTableReferences = new Set(candidates
    .filter((candidate) => includedDiscoveredIdentities.has(sectionIdentity(candidate)))
    .flatMap((candidate) =>
    (Array.isArray(candidate?.sourceReviewRequirements) ? candidate.sourceReviewRequirements : [])
      .filter((requirement) => requirement?.kind === "referenced-table")
      .flatMap((requirement) => Array.isArray(requirement.references) ? requirement.references : [])
      .map((reference) => comparableTableReference(reference, candidate.codePrefix))
      .filter(Boolean)
  ));
  const resolvedTableReferences = new Set(sources
    .map((source) => comparableTableReference(
      source.richSourceCanonicalReference || source.richSourceReference,
      source.codePrefix
    ))
    .filter(Boolean));
  const allRequestedTablesResolved = requestedTableReferences.size === 0 ||
    [...requestedTableReferences].every((reference) => resolvedTableReferences.has(reference));
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
    limits,
    sources,
    usage: {
      pinnedCount: pinnedEvidence.length,
      candidateCount: candidates.length,
      discoveredCount,
      targetedDefinitionCount,
      crossReferenceCount,
      characterCount,
      resolverFailureCount,
      nonMaterialCandidateCount
    },
    limitations,
    discovery: {
      retrievalVersion: compactText(discovery?.retrievalVersion),
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
