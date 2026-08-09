/**
 * Server-authoritative Code Question hydration adapters (Phase 5A).
 *
 * The UI keeps its existing Phase 3-9 view models, but every governed record
 * below is reconstructed from server envelopes/payloads. Unsaved form text and
 * discovery candidates may remain local; approved/versioned records may not.
 */

const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function artifactsOfType(state, type) {
  return (Array.isArray(state?.artifacts) ? state.artifacts : [])
    .filter((artifact) => artifact?.envelope?.type === type)
    .sort((left, right) => String(left.envelope?.createdAt || "")
      .localeCompare(String(right.envelope?.createdAt || "")));
}

function researchAnswerByID(state, id) {
  return (Array.isArray(state?.researchAnswers) ? state.researchAnswers : [])
    .find((answer) => answer?.id === id) || null;
}

function normalizedAnalysisAnswer(answerRecord = {}) {
  const answer = answerRecord.answer && typeof answerRecord.answer === "object"
    ? answerRecord.answer
    : {};
  const citations = (Array.isArray(answer.citations) ? answer.citations : []).map((citation) => ({
    snapshotIDs: [...new Set((
      citation.snapshotIDs || citation.evidenceSnapshotIDs || citation.sourceIDs || []
    ).map(String).filter(Boolean))],
    relevance: String(citation.relevance || citation.explanation || "Supports the bounded analysis.")
  })).filter((citation) => citation.snapshotIDs.length);
  return {
    conclusion: String(answer.conclusion || ""),
    supportedPoints: Array.isArray(answer.supportedPoints) ? copy(answer.supportedPoints) : [],
    explanation: String(answer.explanation || ""),
    assumptions: (answer.assumptions || []).map(String),
    missingFacts: (answer.missingFacts || []).map(String),
    limitations: (answer.limitations || answer.evidenceLimitations || []).map(String),
    conflicts: (answer.conflicts || []).map(String),
    additionalEvidenceNeeded: (answer.additionalEvidenceNeeded || []).map(String),
    citations
  };
}

export function codeQuestionListFromServer(payload = {}) {
  return (Array.isArray(payload.questions) ? payload.questions : []).map((question) => ({
    ...copy(question),
    responsibleDisplayName: question.responsibleDisplayName || "",
    reviewState: question.reviewState || "",
    lastActivityAt: question.updatedAt || question.createdAt || "",
    missingInformationCount: Number(question.summary?.missingInformationCount || 0),
    blockingReviewCount: Number(question.summary?.blockingReviewCount || 0),
    conclusionCount: Number(question.summary?.conclusionCount || 0),
    latestIssuedVersion: question.summary?.latestIssuedVersion || question.latestIssuedVersion || null,
    revisionInProgress: question.summary?.revisionInProgress === true
  }));
}

export function codeQuestionViewModelsFromServer(state = {}, local = {}) {
  const questionArtifact = state.question || null;
  const question = questionArtifact?.payload || {};
  const questionID = String(state.questionID || questionArtifact?.envelope?.id || "");
  const inputs = artifactsOfType(state, "questionInput").map((artifact) => ({
    ...copy(artifact.payload),
    expectedVersion: Number(artifact.envelope.version || 1)
  }));
  const priorDefinition = local.definition && typeof local.definition === "object" ? local.definition : {};
  const definition = {
    ...copy(priorDefinition),
    questionID,
    title: question.title || "New Code Question",
    questionText: question.questionText || "",
    scope: question.scope || "",
    desiredOutput: question.desiredOutput || "",
    jurisdiction: question.jurisdiction || "",
    asOfDate: question.asOfDate || null,
    definitionRevision: Number(question.definitionRevision || 1),
    expectedVersion: Number(questionArtifact?.envelope?.version || question.expectedVersion || 1),
    inputs,
    inputHistory: inputs,
    factRequests: Array.isArray(priorDefinition.factRequests) ? priorDefinition.factRequests : [],
    createdBy: question.createdBy || "",
    updatedBy: question.updatedBy || question.createdBy || "",
    createdAt: question.createdAt || questionArtifact?.envelope?.createdAt || "",
    updatedAt: question.updatedAt || questionArtifact?.envelope?.updatedAt || "",
    serverAuthoritative: true
  };

  const priorEvidence = local.evidence && typeof local.evidence === "object" ? local.evidence : {};
  const snapshots = Object.fromEntries(artifactsOfType(state, "evidenceSnapshotV2")
    .map((artifact) => [artifact.envelope.id, { id: artifact.envelope.id, ...copy(artifact.payload) }]));
  const evidenceSets = artifactsOfType(state, "questionEvidenceSet")
    .map((artifact) => ({ id: artifact.envelope.id, ...copy(artifact.payload), immutable: true }))
    .sort((left, right) => Number(left.version || 0) - Number(right.version || 0));
  const evidence = {
    ...copy(priorEvidence),
    questionID,
    snapshots,
    evidenceSets,
    currentEvidenceSetVersion: Number(evidenceSets.at(-1)?.version || 0),
    // Candidate discovery is intentionally a local, non-authoritative view.
    candidates: Array.isArray(priorEvidence.candidates) ? priorEvidence.candidates : [],
    proposals: Array.isArray(priorEvidence.proposals) ? priorEvidence.proposals : [],
    serverAuthoritative: true
  };

  const priorAnalysis = local.analysis && typeof local.analysis === "object" ? local.analysis : {};
  const runs = artifactsOfType(state, "questionAnalysis").map((artifact) => {
    const answer = researchAnswerByID(state, artifact.payload?.researchAnswerID);
    return {
      id: artifact.envelope.id,
      ...copy(artifact.payload),
      immutable: true,
      answer: normalizedAnalysisAnswer(answer),
      createdAt: artifact.payload?.createdAt || artifact.envelope.createdAt
    };
  });
  const conclusionRevisions = artifactsOfType(state, "professionalConclusion")
    .map((artifact) => ({ id: artifact.envelope.id, ...copy(artifact.payload), immutable: true }))
    .sort((left, right) => Number(left.revision || 0) - Number(right.revision || 0));
  const analysis = {
    questionID,
    runs,
    pendingRequests: {},
    conclusionRevisions,
    conclusionDraft: copy(priorAnalysis.conclusionDraft || {
      conclusionText: "", reasoning: "", citations: [], assumptions: [], unknowns: [],
      analysisRunID: null, aiAssistanceDisclosure: ""
    }),
    serverBinding: copy(state.analysisBinding || null),
    updatedAt: questionArtifact?.envelope?.updatedAt || new Date().toISOString(),
    serverAuthoritative: true
  };
  const latestRun = runs.at(-1) || null;
  const latestConclusion = conclusionRevisions.at(-1) || null;
  const binding = state.analysisBinding || null;
  definition.dependentsStale = {
    analysis: Boolean(latestRun && binding && latestRun.dependencyHash !== binding.dependencyHash),
    conclusion: Boolean(latestConclusion && binding && (
      Number(latestConclusion.definitionRevision) !== Number(binding.definitionRevision) ||
      latestConclusion.definitionHash !== binding.definitionHash ||
      latestConclusion.inputSetHash !== binding.inputSetHash ||
      latestConclusion.evidenceSetID !== binding.evidenceSetID ||
      Number(latestConclusion.evidenceSetVersion) !== Number(binding.evidenceSetVersion) ||
      latestConclusion.evidenceSetHash !== binding.evidenceSetHash
    )),
    approval: false,
    draft: false
  };
  definition.dependentsStale.approval = definition.dependentsStale.conclusion;
  definition.dependentsStale.draft = definition.dependentsStale.conclusion;

  const threads = artifactsOfType(state, "reviewThread").map((artifact) => ({
    id: artifact.envelope.id,
    version: artifact.envelope.version,
    ...copy(artifact.payload),
    createdBy: {
      userID: artifact.payload?.createdByUserID || "",
      displayName: artifact.payload?.createdByDisplayName || artifact.payload?.createdByUserID || ""
    },
    updatedBy: {
      userID: artifact.payload?.updatedByUserID || "",
      displayName: artifact.payload?.updatedByDisplayName || artifact.payload?.updatedByUserID || ""
    }
  }));
  const comments = artifactsOfType(state, "reviewComment").map((artifact) => ({
    id: artifact.envelope.id,
    immutable: true,
    requestID: artifact.payload?.threadID,
    body: artifact.payload?.body || "",
    createdBy: {
      userID: artifact.payload?.createdByUserID || "",
      displayName: artifact.payload?.createdByDisplayName || artifact.payload?.createdByUserID || ""
    },
    createdAt: artifact.payload?.createdAt || artifact.envelope.createdAt
  }));
  const approvals = artifactsOfType(state, "conclusionApproval").map((artifact) => ({
    id: artifact.envelope.id,
    immutable: true,
    ...copy(artifact.payload),
    basis: artifact.payload?.approvalBasis || "",
    approvedBy: { userID: artifact.payload?.approvedByUserID || "", displayName: artifact.payload?.approvedByUserID || "" }
  }));
  definition.factRequests = threads
    .filter((thread) => thread.requestType === "fact-request")
    .map((thread) => ({
      id: thread.id,
      version: thread.version,
      questionID,
      inputID: thread.targetKind === "questionInput" ? thread.targetID : null,
      title: thread.title,
      body: thread.body,
      status: thread.status,
      requestType: "fact-request",
      createdBy: thread.createdBy?.userID || "",
      createdByDisplayName: thread.createdBy?.displayName || "",
      createdAt: thread.createdAt || "",
      resolvedAt: thread.resolvedAt || null
    }));
  const review = {
    questionID,
    requests: threads,
    comments,
    approvals,
    history: (Array.isArray(state.activity) ? state.activity : []).map((event) => ({
      id: event.id,
      requestID: event.metadata?.threadID || null,
      action: event.action,
      from: event.previousStatus || null,
      to: event.newStatus || null,
      actor: { userID: event.actorUserID || "", displayName: event.actorUserID || "" },
      at: event.createdAt,
      metadata: copy(event.metadata || {})
    })),
    activeFilter: local.review?.activeFilter || "open",
    updatedAt: questionArtifact?.envelope?.updatedAt || new Date().toISOString(),
    serverAuthoritative: true
  };

  const drafts = artifactsOfType(state, "reportDraft")
    .filter((artifact) => artifact.payload?.recordType === "codeDecisionMemo")
    .map((artifact) => ({
      id: artifact.envelope.id,
      immutable: true,
      ...copy(artifact.payload),
      draftHash: artifact.payload?.contentHash,
      includeAnalysis: artifact.payload?.codeMemo?.includeAnalysis !== false,
      components: copy(artifact.payload?.codeMemo || {}),
      sections: { authoredNarrative: artifact.payload?.introduction || "" },
      state: "draft"
    }));
  const readiness = artifactsOfType(state, "codeMemoReadiness").at(-1);
  const memoApprovals = artifactsOfType(state, "codeMemoApproval").map((artifact) => ({
    id: artifact.envelope.id,
    immutable: true,
    ...copy(artifact.payload),
    basis: artifact.payload?.approvalBasis || ""
  }));
  const issuedRecords = artifactsOfType(state, "issuedDecisionRecord").map((artifact) => ({
    id: artifact.envelope.id,
    immutable: true,
    ...copy(artifact.payload),
    manifestHash: artifact.payload?.componentHashes?.manifest || "",
    draftID: drafts.find((draft) => Number(draft.draftRevision) === Number(artifact.payload?.componentVersions?.draftRevision))?.id || null
  }));
  const issue = {
    questionID,
    draftRevisions: drafts,
    memoApprovals,
    readinessRecord: readiness ? {
      id: readiness.envelope.id,
      immutable: true,
      ...copy(readiness.payload),
      draftHash: readiness.payload?.draftHash,
      at: readiness.payload?.markedAt
    } : null,
    pendingIssuance: (Array.isArray(state.pendingIssuance) ? state.pendingIssuance : []).map((pending) => ({
      ...copy(pending),
      state: pending.status === "issued" ? "issued" : pending.status === "failed" ? "failed" : "issuing",
      sagaStatus: pending.status
    })),
    issuedRecords,
    supersessions: issuedRecords.filter((record) => record.predecessorID).map((record) => ({
      predecessorID: record.predecessorID,
      successorID: record.id,
      reason: record.supersessionReason || "Corrected by a later issued version."
    })),
    activeDraftID: drafts.at(-1)?.id || null,
    lastFailure: (() => {
      const failed = (state.pendingIssuance || []).slice().reverse().find((item) => item.status === "failed");
      return failed ? { ...copy(failed), message: failed.error || "Issuance failed." } : null;
    })(),
    updatedAt: questionArtifact?.envelope?.updatedAt || null,
    serverAuthoritative: true
  };

  return {
    question: {
      id: questionID,
      version: questionArtifact?.envelope?.version || 1,
      ...copy(question),
      researchConversationID: state.researchConversationID || null
    },
    definition,
    evidence,
    analysis,
    review,
    issue,
    access: copy(state.access || null),
    analysisBinding: copy(state.analysisBinding || null)
  };
}

export function codeQuestionMutationError(error) {
  const code = String(error?.code || "");
  return {
    conflict: error?.status === 409 || code.includes("CONFLICT"),
    unauthorized: error?.status === 401 || error?.status === 403,
    message: String(error?.message || "The Code Question command failed.")
  };
}
