import {
  prioritizeResearchEvidence,
  researchEvidencePriorityMetadata
} from "./research-evidence-priority.mjs";
import { targetedDefinitionExcerpt } from "./research-definition-excerpts.mjs";

export const researchEvidenceAssemblyVersion = "20260811-enacted-chat-evidence-v6";

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

function isContextDependentFollowUp(question) {
  const normalized = compactText(question);
  if (!normalized) return false;
  if (/^(?:why|how so|explain|tell me more|more details?|go on)[?.!]*$/i.test(normalized)) return true;
  const words = normalized.split(/\s+/);
  return words.length <= 16 && (
    /\b(?:it|its|that|this|those|these|them|they|same|above|previous|earlier|remaining|further)\b/i.test(normalized) ||
    /\b(?:more detail|more details|explain more|what about)\b/i.test(normalized)
  );
}

export function researchEvidenceRetrievalQuery({
  question,
  previousTopic = "",
  previousMessages = [],
  projectFacts = []
} = {}) {
  const normalizedQuestion = compactText(question);
  if (!normalizedQuestion) {
    throw new Error("Research evidence assembly requires a text question.");
  }
  if (normalizedQuestion.length > 2_000) {
    throw new Error("Research questions may contain no more than 2,000 characters.");
  }
  const topic = compactText(previousTopic) || previousConversationTopic(previousMessages);
  const factContext = Array.isArray(projectFacts)
    ? projectFacts.map((fact) => compactText(fact)).filter(Boolean).slice(0, 30).join("; ").slice(0, 4_000)
    : "";
  const maximumQueryCharacters = 2_000;
  let retrievalQuery = normalizedQuestion;
  let previousTopicApplied = false;
  if (topic && isContextDependentFollowUp(normalizedQuestion)) {
    const followUpPrefix = "Follow-up: ";
    const topicPrefix = "\nPrevious topic: ";
    const availableTopicCharacters = maximumQueryCharacters -
      followUpPrefix.length - normalizedQuestion.length - topicPrefix.length;
    if (availableTopicCharacters > 0) {
      retrievalQuery = `${followUpPrefix}${normalizedQuestion}${topicPrefix}${topic.slice(0, availableTopicCharacters)}`;
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
    projectFactsApplied
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
    jurisdiction: compactText(value.jurisdiction)
  };
}

function candidateValues(discovery) {
  if (Array.isArray(discovery)) return discovery;
  return Array.isArray(discovery?.candidates) ? discovery.candidates : [];
}

async function canonicalSection(resolveSection, value, origin) {
  const requested = sectionDescriptor(value);
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
    richSources: Array.isArray(resolved.richSources) ? structuredClone(resolved.richSources) : []
  };
}

function comparableTableReference(value, fallbackCodePrefix = "") {
  const normalized = compactText(value).toUpperCase();
  const match = normalized.match(/\b(?:(AC|BC|EBC|FC|FGC|MC|PC)\s+)?TABLE\s+([A-Z]?\d+(?:\.[0-9A-Z-]+)*)/i);
  if (!match) return "";
  const codePrefix = String(match[1] || fallbackCodePrefix || "").toUpperCase();
  return codePrefix ? `${codePrefix}:TABLE:${match[2].toUpperCase()}` : `TABLE:${match[2].toUpperCase()}`;
}

function tableReferences(value, fallbackCodePrefix = "") {
  const references = new Set();
  for (const match of compactText(value).matchAll(/\b(?:(AC|BC|EBC|FC|FGC|MC|PC)\s+)?Table\s+([A-Z]?\d+(?:\.[0-9A-Za-z-]+)*)/gi)) {
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
  const rangePattern = /\b(?:(AC|BC|EBC|FC|FGC|MC|PC)\s+)?(?:Sections?|§{1,2})\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)\s+(?:through|to|[-–])\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi;
  for (const match of source.matchAll(rangePattern)) {
    const start = String(match[2] || "").replace(/\.$/, "");
    const end = String(match[3] || "").replace(/\.$/, "");
    const startParts = start.split(".");
    const endParts = end.split(".");
    const sameParent = startParts.length === endParts.length &&
      startParts.length > 1 &&
      startParts.slice(0, -1).join(".") === endParts.slice(0, -1).join(".");
    const first = Number(startParts.at(-1));
    const last = Number(endParts.at(-1));
    if (!sameParent || !Number.isInteger(first) || !Number.isInteger(last) || last < first || last - first > 50) {
      continue;
    }
    const codePrefix = String(match[1] || fallbackCodePrefix || "").toUpperCase();
    for (let value = first; value <= last; value += 1) {
      references.push({
        codePrefix,
        sectionNumber: [...startParts.slice(0, -1), value].join("."),
        referenceKind: "section"
      });
    }
  }
  const pattern = /\b(?:(AC|BC|EBC|FC|FGC|MC|PC)\s+)?(?:Sections?|§{1,2}|Table)\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi;
  for (const match of source.matchAll(pattern)) {
    references.push({
      codePrefix: String(match[1] || fallbackCodePrefix || "").toUpperCase(),
      sectionNumber: String(match[2] || "").replace(/\.$/, ""),
      referenceKind: /table/i.test(match[0]) ? "table" : "section"
    });
  }
  return references;
}

function normalizedCrossReferences(source) {
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
  return [...structured, ...inlineCrossReferences(source.text, source.codePrefix)]
    .filter((reference) => sectionIdentity(reference));
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
  discover,
  resolveSection,
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

  const query = researchEvidenceRetrievalQuery({ question, previousTopic, previousMessages, projectFacts });
  const limits = appliedLimits(requestedLimits);
  const discovery = await discover({
    question: query.retrievalQuery,
    limit: limits.maximumCandidates
  });
  const candidates = prioritizeResearchEvidence(candidateValues(discovery), {
    limit: limits.maximumCandidates
  });
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
    characterCount += record.text.length;
    const identity = sectionIdentity(record);
    if (identity) includedSectionIdentities.add(identity);
    if (entry.resolved) canonicalForExpansion.push(entry.value);
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
    if (!record.text) break;
    sources.push(record);
    if (targeted.excerpt) targetedDefinitionCount += 1;
    canonicalForExpansion.push(resolved);
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

  const crossReferenceQueue = [];
  const queuedCrossReferenceIdentities = new Set();
  for (const source of canonicalForExpansion) {
    for (const reference of normalizedCrossReferences(source)) {
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
  crossReferenceQueue.sort((left, right) =>
    Number(String(right.referenceKind || "").toLowerCase() === "table") -
      Number(String(left.referenceKind || "").toLowerCase() === "table")
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
    const record = sourceRecord(targeted.value, {
      origin: sourceOrigins.crossReference,
      sourceID: deterministicSourceID(sourceOrigins.crossReference, resolved, index),
      relationship: `Direct enacted-text cross-reference from this answer's primary evidence`,
      characterAllowance: allowance,
      canonicalResolved: true,
      retrievalReason: `Direct cross-reference to ${reference.codePrefix || resolved.codePrefix} ${reference.sectionNumber || resolved.sectionNumber}`,
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
      text: "Permitext did not locate enacted text in the current authorized corpus for this question."
    });
  }

  return {
    schemaVersion: 1,
    assemblyVersion: researchEvidenceAssemblyVersion,
    question: query.question,
    retrievalQuery: query.retrievalQuery,
    previousTopicApplied: query.previousTopicApplied,
    projectFactsApplied: query.projectFactsApplied,
    sourceScope: "authorized_enacted_text",
    sourceMode: "text_only",
    limits,
    sources,
    usage: {
      pinnedCount: pinnedEvidence.length,
      candidateCount: candidates.length,
      discoveredCount,
      targetedDefinitionCount,
      crossReferenceCount,
      characterCount,
      resolverFailureCount
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
