export const researchEvidenceAssemblyVersion = "20260811-enacted-chat-evidence-v3";

export const researchEvidenceAssemblyLimits = Object.freeze({
  maximumCandidates: 12,
  maximumDiscovered: 10,
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
    crossReferences: Array.isArray(resolved.crossReferences) ? resolved.crossReferences : []
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
  retrievedAt = new Date().toISOString()
}) {
  const rawText = canonicalText(value);
  const text = rawText.slice(0, Math.max(0, characterAllowance)).trimEnd();
  return {
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
    retrievedAt,
    ...sectionDescriptor(value),
    text,
    canonicalContextResolved: Boolean(canonicalResolved),
    canonicalContextComplete: Boolean(canonicalResolved && text.length === rawText.length),
    truncated: text.length < rawText.length
  };
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
  const candidates = candidateValues(discovery).slice(0, limits.maximumCandidates);
  const sources = [];
  const canonicalForExpansion = [];
  const includedSectionIdentities = new Set();
  const limitations = [];
  let characterCount = 0;
  let resolverFailureCount = 0;
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
    const record = sourceRecord(entry.value, {
      origin: sourceOrigins.pinned,
      sourceID: compactText(entry.pinned.sourceID || entry.pinned.id) ||
        deterministicSourceID(sourceOrigins.pinned, entry.value, entry.index),
      relationship: compactText(entry.pinned.relationship) || "Pinned by the user",
      characterAllowance: allowance,
      canonicalResolved: entry.resolved,
      retrievalReason: "Explicitly pinned by the user",
      retrievalVersion: researchEvidenceAssemblyVersion,
      retrievalDepth: 0,
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
    const record = sourceRecord(resolved, {
      origin: sourceOrigins.discovered,
      sourceID: deterministicSourceID(sourceOrigins.discovered, resolved, index),
      relationship: compactText(candidate.whyRelevant) || "Automatically retrieved for this answer",
      characterAllowance: Math.min(
        limits.maximumCharactersPerSource,
        remainingCharacters,
        fairCandidateShare
      ),
      canonicalResolved: true,
      retrievalReason: compactText(candidate.whyRelevant) || "Automatically retrieved for this answer",
      retrievalRank: candidate.rank ?? index + 1,
      retrievalScore: candidate.score,
      retrievalVersion: compactText(discovery?.retrievalVersion) || researchEvidenceAssemblyVersion,
      retrievalDepth: 0,
      retrievedAt
    });
    if (!record.text) break;
    sources.push(record);
    canonicalForExpansion.push(resolved);
    includedSectionIdentities.add(sectionIdentity(resolved));
    characterCount += record.text.length;
    discoveredCount += 1;
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
    const record = sourceRecord(resolved, {
      origin: sourceOrigins.crossReference,
      sourceID: deterministicSourceID(sourceOrigins.crossReference, resolved, index),
      relationship: `Direct enacted-text cross-reference from this answer's primary evidence`,
      characterAllowance: Math.min(limits.maximumCharactersPerSource, remainingCharacters),
      canonicalResolved: true,
      retrievalReason: `Direct cross-reference to ${reference.codePrefix || resolved.codePrefix} ${reference.sectionNumber || resolved.sectionNumber}`,
      retrievalVersion: compactText(discovery?.retrievalVersion) || researchEvidenceAssemblyVersion,
      retrievalDepth: 1,
      retrievedAt
    });
    if (!record.text) break;
    sources.push(record);
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
  if (crossReferenceQueue.length > crossReferenceCount) {
    limitations.push({
      kind: "cross-reference-limit",
      text: "Additional direct cross-references were identified but were not added to this bounded answer package."
    });
  }
  for (const limitation of Array.isArray(discovery?.coverageLimitations)
    ? discovery.coverageLimitations
    : []) {
    if (!limitation || limitation.kind === "candidate-review-required") continue;
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
