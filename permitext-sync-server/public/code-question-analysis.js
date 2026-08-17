/**
 * Code Question Analyze-stage helpers (Phase 5).
 *
 * This browser-safe module keeps the immutable analysis descriptor separate
 * from the human-authored professional conclusion. Generation itself belongs
 * to the server; these functions bind, validate, display, and revise results.
 */

function copy(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function requiredText(value, label, maximum = 20_000) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) throw new Error(`Invalid ${label}.`);
  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

/** Browser-stable dependency fingerprint; the server independently binds SHA-256 hashes. */
export function analysisFingerprint(value) {
  const text = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cq-${(hash >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
}

export function emptyAnalysisWorkspace(questionID) {
  return {
    schemaVersion: 1,
    questionID: String(questionID || ""),
    runs: [],
    pendingRequests: {},
    conclusionRevisions: [],
    conclusionDraft: {
      conclusionText: "",
      reasoning: "",
      citations: [],
      assumptions: [],
      unknowns: [],
      analysisRunID: null,
      aiAssistanceDisclosure: ""
    },
    updatedAt: new Date().toISOString()
  };
}

export function normalizeAnalysisWorkspace(value, questionID = "") {
  const source = value && typeof value === "object" ? value : {};
  const base = emptyAnalysisWorkspace(questionID || source.questionID);
  base.runs = (Array.isArray(source.runs) ? source.runs : []).filter((item) =>
    item && typeof item === "object" && item.id && item.dependencyHash
  ).map(copy);
  base.pendingRequests = source.pendingRequests && typeof source.pendingRequests === "object"
    ? copy(source.pendingRequests)
    : {};
  base.conclusionRevisions = (Array.isArray(source.conclusionRevisions)
    ? source.conclusionRevisions
    : []).filter((item) => item && typeof item === "object" && item.id).map(copy);
  base.conclusionDraft = {
    ...base.conclusionDraft,
    ...(source.conclusionDraft && typeof source.conclusionDraft === "object"
      ? copy(source.conclusionDraft)
      : {})
  };
  base.updatedAt = String(source.updatedAt || base.updatedAt);
  return base;
}

export function buildAnalysisBinding(definition, evidenceWorkspace) {
  if (!definition || !evidenceWorkspace) throw new Error("Definition and Evidence Set are required.");
  const evidenceSets = Array.isArray(evidenceWorkspace.evidenceSets) ? evidenceWorkspace.evidenceSets : [];
  const evidenceSet = evidenceSets[evidenceSets.length - 1];
  if (!evidenceSet) throw new Error("Approve an Evidence Set before analysis.");
  const snapshots = evidenceWorkspace.snapshots || {};
  const eligibleEntries = (evidenceSet.entries || []).filter((entry) => entry.analysisEligible === true);
  if (!eligibleEntries.length) throw new Error("The approved Evidence Set has no analysis-eligible passages.");
  const approvedEvidence = eligibleEntries.map((entry) => {
    const snapshot = snapshots[entry.snapshotID];
    if (!snapshot) throw new Error("An approved evidence snapshot is missing.");
    return { entry: copy(entry), snapshot: copy(snapshot) };
  });
  const activeInputs = (definition.inputs || []).filter((input) => input.state !== "retired");
  const definitionHash = analysisFingerprint({
    questionText: definition.questionText,
    scope: definition.scope,
    jurisdiction: definition.jurisdiction,
    asOfDate: definition.asOfDate,
    definitionRevision: definition.definitionRevision
  });
  const inputSetHash = analysisFingerprint(activeInputs.map((input) => ({
    id: input.id,
    inputKind: input.inputKind,
    state: input.state,
    statement: input.statement,
    revision: input.revision
  })));
  const evidenceSetHash = requiredText(evidenceSet.contentHash, "Evidence Set hash", 256);
  const dependencyHash = analysisFingerprint({ definitionHash, inputSetHash, evidenceSetHash });
  return {
    questionID: requiredText(definition.questionID, "question ID", 256),
    questionText: requiredText(definition.questionText, "question text", 8_000),
    definitionRevision: Number(definition.definitionRevision || 1),
    definitionHash,
    inputs: copy(activeInputs),
    inputSnapshotIDs: activeInputs.map((input) => input.id),
    inputSetHash,
    evidenceSetID: requiredText(evidenceSet.id, "Evidence Set ID", 256),
    evidenceSetVersion: Number(evidenceSet.version),
    evidenceSetHash,
    approvedEvidence,
    dependencyHash
  };
}

export function assertApprovedEvidenceOnly(binding, evidenceWorkspace) {
  const current = buildAnalysisBinding({
    questionID: binding.questionID,
    questionText: binding.questionText,
    definitionRevision: binding.definitionRevision,
    scope: binding.scope || "",
    jurisdiction: binding.jurisdiction || "",
    asOfDate: binding.asOfDate || null,
    inputs: binding.inputs || []
  }, evidenceWorkspace);
  const allowed = new Set(current.approvedEvidence.map((item) => item.snapshot.id));
  for (const item of binding.approvedEvidence || []) {
    if (!allowed.has(item.snapshot?.id)) {
      const error = new Error("Analysis attempted to include unapproved evidence.");
      error.code = "CODE_QUESTION_UNAPPROVED_EVIDENCE";
      throw error;
    }
  }
  return true;
}

export function validateBoundedInterpretation(interpretation, binding) {
  if (!interpretation || typeof interpretation !== "object") throw new Error("Invalid bounded analysis.");
  const allowedSnapshotIDs = new Set(binding.approvedEvidence.map((item) => item.snapshot.id));
  const citations = (Array.isArray(interpretation.citations) ? interpretation.citations : []).map((citation) => {
    const snapshotIDs = (citation.snapshotIDs || citation.evidenceSnapshotIDs || citation.sourceIDs || [])
      .map(String).filter(Boolean);
    if (!snapshotIDs.length || snapshotIDs.some((id) => !allowedSnapshotIDs.has(id))) {
      const error = new Error("Every analysis citation must resolve to approved evidence.");
      error.code = "INVALID_RESEARCH_CITATION";
      throw error;
    }
    return {
      snapshotIDs: [...new Set(snapshotIDs)],
      relevance: requiredText(citation.relevance || "Supports the bounded analysis.", "citation relevance", 2_000)
    };
  });
  if (!citations.length) throw new Error("Bounded analysis requires approved-evidence citations.");
  const limitations = (interpretation.limitations || interpretation.evidenceLimitations || [])
    .map(String).map((item) => item.trim()).filter(Boolean);
  if (!limitations.length) throw new Error("Bounded analysis must disclose its evidence limitations.");
  const answerText = requiredText(
    interpretation.answerText || [interpretation.conclusion, interpretation.explanation].filter(Boolean).join("\n\n"),
    "analysis answer"
  );
  const answerParagraphs = answerText.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  return {
    answerText,
    conclusion: String(interpretation.conclusion || answerParagraphs[0] || "").trim(),
    supportedPoints: (interpretation.supportedPoints || []).map((point) => ({
      heading: requiredText(point.heading, "supported-point heading", 500),
      explanation: requiredText(point.explanation, "supported-point explanation"),
      snapshotIDs: (point.snapshotIDs || point.sourceIDs || []).map(String).filter((id) => allowedSnapshotIDs.has(id))
    })),
    explanation: String(
      interpretation.explanation || (interpretation.answerText ? answerParagraphs.slice(1).join("\n\n") : "")
    ).trim(),
    assumptions: (interpretation.assumptions || []).map(String).filter(Boolean),
    missingFacts: (interpretation.missingFacts || []).map(String).filter(Boolean),
    limitations,
    conflicts: (interpretation.conflicts || []).map(String).filter(Boolean),
    additionalEvidenceNeeded: (interpretation.additionalEvidenceNeeded || []).map(String).filter(Boolean),
    citations
  };
}

export function beginAnalysisRequest(workspace, binding, { requestID, requestedBy = "local-user", now } = {}) {
  const current = normalizeAnalysisWorkspace(workspace, binding.questionID);
  const id = requiredText(requestID, "analysis request ID", 256);
  const completed = current.runs.find((run) => run.requestID === id);
  if (completed) return { workspace: current, replayed: true, run: completed };
  if (current.pendingRequests[id]) return { workspace: current, replayed: true, pending: current.pendingRequests[id] };
  const pending = {
    requestID: id,
    questionID: binding.questionID,
    dependencyHash: binding.dependencyHash,
    requestedBy,
    status: "generating",
    createdAt: now || new Date().toISOString()
  };
  return {
    replayed: false,
    pending,
    workspace: {
      ...current,
      pendingRequests: { ...current.pendingRequests, [id]: pending },
      updatedAt: pending.createdAt
    }
  };
}

export function completeAnalysisRequest(workspace, binding, interpretation, options = {}) {
  const current = normalizeAnalysisWorkspace(workspace, binding.questionID);
  const requestID = requiredText(options.requestID, "analysis request ID", 256);
  const existing = current.runs.find((run) => run.requestID === requestID);
  if (existing) return { workspace: current, replayed: true, run: existing };
  const answer = validateBoundedInterpretation(interpretation, binding);
  const createdAt = options.createdAt || new Date().toISOString();
  const run = {
    id: options.id || `qa-${analysisFingerprint({ requestID, dependencyHash: binding.dependencyHash })}`,
    kind: "questionAnalysis",
    immutable: true,
    questionID: binding.questionID,
    requestID,
    researchAnswerID: requiredText(options.researchAnswerID || `research-${requestID}`, "Research answer ID", 256),
    definitionRevision: binding.definitionRevision,
    definitionHash: binding.definitionHash,
    inputSnapshotIDs: copy(binding.inputSnapshotIDs),
    inputSetHash: binding.inputSetHash,
    evidenceSetID: binding.evidenceSetID,
    evidenceSetVersion: binding.evidenceSetVersion,
    evidenceSetHash: binding.evidenceSetHash,
    dependencyHash: binding.dependencyHash,
    citationValidation: "approved-evidence-only",
    modelID: String(options.modelID || "permitext-mock"),
    requestedBy: String(options.requestedBy || "local-user"),
    createdAt,
    answer
  };
  const pendingRequests = { ...current.pendingRequests };
  delete pendingRequests[requestID];
  return {
    replayed: false,
    run,
    workspace: {
      ...current,
      runs: [...current.runs, run],
      pendingRequests,
      updatedAt: createdAt
    }
  };
}

export function latestAnalysisRun(workspace) {
  const current = normalizeAnalysisWorkspace(workspace);
  return current.runs[current.runs.length - 1] || null;
}

export function analysisRunIsStale(run, binding) {
  return Boolean(run && run.dependencyHash !== binding.dependencyHash);
}

export function useAnalysisAsStartingPoint(workspace, run) {
  const current = normalizeAnalysisWorkspace(workspace, run.questionID);
  return {
    ...current,
    conclusionDraft: {
      ...current.conclusionDraft,
      conclusionText: run.answer.conclusion,
      reasoning: run.answer.explanation,
      citations: [...new Set(run.answer.citations.flatMap((citation) => citation.snapshotIDs))],
      assumptions: copy(run.answer.assumptions),
      unknowns: copy(run.answer.missingFacts),
      analysisRunID: run.id,
      aiAssistanceDisclosure: "Started from bounded Permitext Research; reviewed and authored by the professional."
    },
    updatedAt: new Date().toISOString()
  };
}

export function transferAnalysisCitations(workspace, run) {
  const current = normalizeAnalysisWorkspace(workspace, run.questionID);
  return {
    ...current,
    conclusionDraft: {
      ...current.conclusionDraft,
      citations: [...new Set([
        ...(current.conclusionDraft.citations || []),
        ...run.answer.citations.flatMap((citation) => citation.snapshotIDs)
      ])]
    },
    updatedAt: new Date().toISOString()
  };
}

export function updateConclusionDraft(workspace, patch = {}) {
  const current = normalizeAnalysisWorkspace(workspace);
  return {
    ...current,
    conclusionDraft: { ...current.conclusionDraft, ...copy(patch) },
    updatedAt: new Date().toISOString()
  };
}

export function publishProfessionalConclusion(workspace, binding, options = {}) {
  const current = normalizeAnalysisWorkspace(workspace, binding.questionID);
  const draft = current.conclusionDraft;
  const citations = [...new Set((draft.citations || []).map(String).filter(Boolean))];
  const allowed = new Set(binding.approvedEvidence.map((item) => item.snapshot.id));
  if (citations.some((id) => !allowed.has(id))) throw new Error("Conclusion cites evidence outside the approved set.");
  const prior = current.conclusionRevisions[current.conclusionRevisions.length - 1] || null;
  const createdAt = options.createdAt || new Date().toISOString();
  const revision = {
    id: options.id || `conclusion-${binding.questionID}-r${current.conclusionRevisions.length + 1}`,
    kind: "professionalConclusion",
    immutable: true,
    questionID: binding.questionID,
    revision: current.conclusionRevisions.length + 1,
    definitionRevision: binding.definitionRevision,
    definitionHash: binding.definitionHash,
    inputSetHash: binding.inputSetHash,
    evidenceSetID: binding.evidenceSetID,
    evidenceSetVersion: binding.evidenceSetVersion,
    evidenceSetHash: binding.evidenceSetHash,
    analysisRunID: draft.analysisRunID || null,
    analysisDependencyHash: draft.analysisRunID ? binding.dependencyHash : null,
    conclusionText: requiredText(draft.conclusionText, "professional conclusion"),
    reasoning: String(draft.reasoning || "").trim(),
    citations,
    assumptions: copy(draft.assumptions || []),
    unknowns: copy(draft.unknowns || []),
    aiAssistanceDisclosure: String(draft.aiAssistanceDisclosure || "").trim(),
    predecessorRevisionID: prior?.id || null,
    authorUserID: String(options.authorUserID || "local-user"),
    createdAt
  };
  return {
    revision,
    workspace: {
      ...current,
      conclusionRevisions: [...current.conclusionRevisions, revision],
      updatedAt: createdAt
    }
  };
}

export function syntheticBoundedInterpretation(binding) {
  const evidence = binding.approvedEvidence;
  return {
    conclusion: "The approved evidence supports only a conditional professional conclusion; confirm the listed Project facts before reliance.",
    supportedPoints: evidence.map((item) => ({
      heading: item.snapshot.passageLocator || "Approved passage",
      explanation: item.snapshot.quotedText,
      snapshotIDs: [item.snapshot.id]
    })).slice(0, 8),
    explanation: "This fixture analysis is bounded to the exact approved Evidence Set and selected Question Inputs.",
    assumptions: binding.inputs.filter((item) => item.inputKind === "assumption").map((item) => item.statement),
    missingFacts: binding.inputs.filter((item) => item.inputKind === "unknown" && item.state !== "resolved").map((item) => item.statement),
    limitations: ["No candidate, unapproved passage, conversation selection, or hidden corpus text was treated as authority."],
    conflicts: evidence.filter((item) => item.entry.role === "conflicting").map((item) => item.snapshot.passageLocator),
    additionalEvidenceNeeded: [],
    citations: evidence.map((item) => ({ snapshotIDs: [item.snapshot.id], relevance: item.entry.role }))
  };
}
