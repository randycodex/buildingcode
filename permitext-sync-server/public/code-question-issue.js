/** Code Question Issue workspace contract (Phase 7). */

export const codeMemoStates = Object.freeze([
  "draft", "ready-for-approval", "approved", "issuing", "issued", "superseded"
]);

const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

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

export function issueFingerprint(value) {
  const text = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `memo-${(hash >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
}

function normalizedActor(value = {}) {
  return {
    userID: requiredText(value.userID || "local-user", "memo actor", 256),
    displayName: String(value.displayName || value.userID || "Permitext professional").trim(),
    role: String(value.role || "owner").trim().toLowerCase()
  };
}

export function emptyIssueWorkspace(questionID = "") {
  return {
    schemaVersion: 1,
    questionID: String(questionID || ""),
    draftRevisions: [],
    memoApprovals: [],
    pendingIssuance: [],
    issuedRecords: [],
    supersessions: [],
    activeDraftID: null,
    lastFailure: null,
    updatedAt: null
  };
}

export function normalizeIssueWorkspace(value, questionID = "") {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...emptyIssueWorkspace(questionID || source.questionID),
    ...copy(source),
    questionID: String(questionID || source.questionID || ""),
    draftRevisions: Array.isArray(source.draftRevisions) ? copy(source.draftRevisions) : [],
    memoApprovals: Array.isArray(source.memoApprovals) ? copy(source.memoApprovals) : [],
    pendingIssuance: Array.isArray(source.pendingIssuance) ? copy(source.pendingIssuance) : [],
    issuedRecords: Array.isArray(source.issuedRecords) ? copy(source.issuedRecords) : [],
    supersessions: Array.isArray(source.supersessions) ? copy(source.supersessions) : []
  };
}

function latestEvidenceSet(evidence) {
  return Array.isArray(evidence?.evidenceSets) ? evidence.evidenceSets.at(-1) || null : null;
}

function latestConclusion(analysis) {
  return Array.isArray(analysis?.conclusionRevisions) ? analysis.conclusionRevisions.at(-1) || null : null;
}

function latestAnalysis(analysis) {
  return Array.isArray(analysis?.runs) ? analysis.runs.at(-1) || null : null;
}

export function codeMemoReadiness({
  definition,
  evidence,
  analysis,
  review,
  draft = null,
  actor = {},
  currentDependencyHash = null
} = {}) {
  const checks = [];
  const add = (id, label, ready, message, classification = "blocker") => checks.push({
    id, label, ready: ready === true, classification, message
  });
  const set = latestEvidenceSet(evidence);
  const conclusion = latestConclusion(analysis);
  const run = latestAnalysis(analysis);
  const activeUnknowns = (definition?.inputs || []).filter((item) =>
    item.inputKind === "unknown" && !["resolved", "retired"].includes(item.state)
  );
  add("evidence", "Approved evidence", Boolean(set?.entries?.length),
    set?.entries?.length ? `Evidence Set v${set.version} selected.` : "Approve an Evidence Set.");
  add("inputs", "Resolved required inputs", activeUnknowns.length === 0,
    activeUnknowns.length ? `${activeUnknowns.length} unresolved unknown${activeUnknowns.length === 1 ? "" : "s"}.` : "No unresolved required unknowns.");
  const includeAnalysis = draft?.includeAnalysis !== false && Boolean(run);
  const analysisCurrent = !includeAnalysis || !currentDependencyHash || run?.dependencyHash === currentDependencyHash;
  add("analysis", "Current selected analysis", analysisCurrent,
    !includeAnalysis ? "The memo does not rely on an AI analysis." : analysisCurrent ? "Selected analysis matches current dependencies." : "Selected analysis is stale.");
  add("conclusion", "Published professional conclusion", Boolean(conclusion?.immutable),
    conclusion?.immutable ? `Professional Conclusion r${conclusion.revision}.` : "Publish a professional conclusion revision.");
  const approvedSnapshotIDs = new Set((set?.entries || []).map((entry) => String(entry.snapshotID)));
  const citations = (conclusion?.citations || []).map(String);
  const citationsValid = citations.length > 0 && citations.every((id) => approvedSnapshotIDs.has(id));
  add("citations", "Approved-evidence citations", citationsValid,
    citationsValid ? `${citations.length} conclusion citation${citations.length === 1 ? "" : "s"} resolved.` : "Every conclusion citation must resolve to the approved Evidence Set.");
  const blocking = (review?.requests || []).filter((request) =>
    request.blocking !== false && ["open", "waiting"].includes(request.status)
  );
  add("review", "Blocking Review Requests", blocking.length === 0,
    blocking.length ? `${blocking.length} blocking Review Request${blocking.length === 1 ? " remains" : "s remain"}.` : "No blocking Review Requests remain.");
  const conclusionApproval = (review?.approvals || []).slice().reverse().find((approval) =>
    approval.conclusionID === conclusion?.id &&
    Number(approval.conclusionRevision) === Number(conclusion?.revision) &&
    approval.dependencyHash === (conclusion?.analysisDependencyHash || conclusion?.evidenceSetHash)
  );
  add("conclusion-approval", "Conclusion approval", Boolean(conclusionApproval),
    conclusionApproval ? `Conclusion r${conclusion.revision} approval is current.` : "Approve the current conclusion revision.");
  const sourceBlocked = (set?.entries || []).filter((entry) =>
    ["verification-blocked", "verification-required", "unavailable"].includes(entry.sourceVerificationState)
  );
  add("source-status", "Source status", Boolean(set?.entries?.length) && sourceBlocked.length === 0,
    sourceBlocked.length ? `${sourceBlocked.length} approved entr${sourceBlocked.length === 1 ? "y requires" : "ies require"} source resolution.` : "Approved source snapshots are available and qualified.");
  const role = normalizedActor(actor).role;
  add("permission", "Issue permission", ["owner", "issuer"].includes(role),
    ["owner", "issuer"].includes(role) ? "Current role may issue." : "Only an Owner or authorized issuer may issue.");
  return {
    ready: checks.every((check) => check.ready || check.classification !== "blocker"),
    checks,
    blockers: checks.filter((check) => !check.ready && check.classification === "blocker"),
    context: { set, conclusion, run, conclusionApproval }
  };
}

function memoSections({ definition, evidence, analysis, review, narrative, includeAnalysis }) {
  const set = latestEvidenceSet(evidence);
  const conclusion = latestConclusion(analysis);
  const run = latestAnalysis(analysis);
  const snapshots = evidence?.snapshots || {};
  const inputs = (definition?.inputs || []).filter((item) => item.state !== "retired");
  return {
    questionPresented: requiredText(definition?.questionText, "question presented", 8_000),
    projectInputs: inputs.map((item) => ({
      id: item.id, inputKind: item.inputKind, state: item.state,
      statement: item.statement, revision: Number(item.revision || 1)
    })),
    evidence: (set?.entries || []).map((entry) => ({
      ...copy(entry), snapshot: copy(snapshots[entry.snapshotID] || null)
    })),
    analysisSummary: includeAnalysis && run ? {
      analysisRunID: run.id,
      conclusion: run.answer?.conclusion || "",
      limitations: copy(run.answer?.limitations || []),
      assumptions: copy(run.answer?.assumptions || []),
      missingFacts: copy(run.answer?.missingFacts || [])
    } : null,
    professionalConclusion: conclusion ? {
      id: conclusion.id,
      revision: conclusion.revision,
      conclusionText: conclusion.conclusionText,
      reasoning: conclusion.reasoning || "",
      citations: copy(conclusion.citations || []),
      assumptions: copy(conclusion.assumptions || []),
      unknowns: copy(conclusion.unknowns || [])
    } : null,
    approvalSummary: (review?.approvals || []).at(-1) || null,
    authoredNarrative: String(narrative || "").trim()
  };
}

export function prepareCodeMemoDraft(workspace, options = {}) {
  const current = normalizeIssueWorkspace(workspace, options.definition?.questionID);
  const actor = normalizedActor(options.actor);
  if (!["owner", "editor"].includes(actor.role)) throw new Error("Current role cannot prepare a Code Memo Draft.");
  const preparedAt = new Date(options.preparedAt || Date.now()).toISOString();
  const prior = current.draftRevisions.at(-1) || null;
  const revision = current.draftRevisions.length + 1;
  const includeAnalysis = options.includeAnalysis !== false;
  const components = {
    definitionRevision: Number(options.definition?.definitionRevision || 1),
    definitionHash: options.definitionHash || options.currentDependencyHash || "",
    inputSetHash: options.inputSetHash || "",
    evidenceSetID: latestEvidenceSet(options.evidence)?.id || null,
    evidenceSetVersion: latestEvidenceSet(options.evidence)?.version || null,
    evidenceSetHash: latestEvidenceSet(options.evidence)?.contentHash || null,
    analysisRunID: includeAnalysis ? latestAnalysis(options.analysis)?.id || null : null,
    analysisDependencyHash: includeAnalysis ? latestAnalysis(options.analysis)?.dependencyHash || null : null,
    conclusionID: latestConclusion(options.analysis)?.id || null,
    conclusionRevision: latestConclusion(options.analysis)?.revision || null,
    conclusionHash: latestConclusion(options.analysis)?.analysisDependencyHash || latestConclusion(options.analysis)?.evidenceSetHash || null,
    conclusionApprovalID: (options.review?.approvals || []).at(-1)?.id || null
  };
  const body = {
    schemaVersion: 2,
    recordType: "codeDecisionMemo",
    questionID: requiredText(current.questionID, "question ID", 256),
    projectID: requiredText(options.project?.id || options.projectID, "Project ID", 256),
    projectName: String(options.project?.name || "Project").trim(),
    projectAddress: String(options.project?.address || "").trim(),
    title: requiredText(options.title || `${options.definition?.displayID || "Code Question"} Code Memo`, "Code Memo title", 300),
    draftRevision: revision,
    preparedAt,
    preparedBy: actor,
    includeAnalysis,
    predecessorDraftID: prior?.id || null,
    correctionOfIssuedRecordID: options.correctionOfIssuedRecordID || null,
    components,
    sections: memoSections({ ...options, includeAnalysis })
  };
  const draftHash = issueFingerprint(body);
  const draft = Object.freeze({
    ...body,
    id: options.id || `memo-${current.questionID}-r${revision}`,
    immutable: true,
    state: "draft",
    draftHash
  });
  return {
    draft,
    workspace: {
      ...current,
      draftRevisions: [...current.draftRevisions, copy(draft)],
      activeDraftID: draft.id,
      lastFailure: null,
      updatedAt: preparedAt
    }
  };
}

export function markCodeMemoReady(workspace, draftID, readiness, options = {}) {
  const current = normalizeIssueWorkspace(workspace);
  const draft = current.draftRevisions.find((item) => item.id === draftID);
  if (!draft) throw new Error("Code Memo Draft not found.");
  if (!readiness?.ready) throw new Error("Resolve every readiness blocker before approval.");
  const actor = normalizedActor(options.actor);
  if (!["owner", "editor"].includes(actor.role)) throw new Error("Current role cannot mark a Code Memo ready.");
  const at = new Date(options.at || Date.now()).toISOString();
  const readinessRecord = Object.freeze({
    id: options.id || `${draftID}:ready`, immutable: true, draftID,
    draftRevision: draft.draftRevision, draftHash: draft.draftHash,
    state: "ready-for-approval", checks: copy(readiness.checks), actor, at
  });
  return { readinessRecord, workspace: { ...current, readinessRecord, updatedAt: at } };
}

export function approveCodeMemo(workspace, draftID, options = {}) {
  const current = normalizeIssueWorkspace(workspace);
  const draft = current.draftRevisions.find((item) => item.id === draftID);
  if (!draft || current.readinessRecord?.draftHash !== draft.draftHash) {
    throw new Error("Mark the current Code Memo Draft ready before approval.");
  }
  const actor = normalizedActor(options.actor);
  if (!["owner", "reviewer"].includes(actor.role)) throw new Error("Current role cannot approve a Code Memo.");
  const approvedAt = new Date(options.approvedAt || Date.now()).toISOString();
  const approval = Object.freeze({
    id: options.id || `${draftID}:approval:${current.memoApprovals.length + 1}`,
    immutable: true, kind: "codeMemoApproval", questionID: current.questionID,
    draftID, draftRevision: draft.draftRevision, draftHash: draft.draftHash,
    conclusionID: draft.components.conclusionID,
    conclusionRevision: draft.components.conclusionRevision,
    conclusionHash: draft.components.conclusionHash,
    basis: requiredText(options.basis, "Code Memo approval basis", 4_000),
    approvedBy: actor, approvedAt
  });
  return {
    approval,
    workspace: { ...current, memoApprovals: [...current.memoApprovals, copy(approval)], lastFailure: null, updatedAt: approvedAt }
  };
}

export function beginCodeMemoIssuance(workspace, draftID, readiness, options = {}) {
  const current = normalizeIssueWorkspace(workspace);
  const draft = current.draftRevisions.find((item) => item.id === draftID);
  const approval = current.memoApprovals.slice().reverse().find((item) => item.draftID === draftID && item.draftHash === draft?.draftHash);
  if (!draft || !approval) throw new Error("Approve the current Code Memo before issuance.");
  if (!readiness?.ready) throw new Error("Readiness changed; resolve every blocker before issuance.");
  const actor = normalizedActor(options.actor);
  if (!["owner", "issuer"].includes(actor.role)) throw new Error("Current role cannot issue a Code Memo.");
  const idempotencyKey = requiredText(options.idempotencyKey, "issuance idempotency key", 256);
  const existing = current.pendingIssuance.find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) {
    if (existing.sagaStatus === "failed") {
      const recoveredAt = new Date(options.startedAt || Date.now()).toISOString();
      const recovered = { ...existing, state: "issuing", sagaStatus: "reserved", error: null, updatedAt: recoveredAt };
      return {
        workspace: {
          ...current,
          pendingIssuance: current.pendingIssuance.map((item) => item.id === existing.id ? recovered : item),
          lastFailure: null,
          updatedAt: recoveredAt
        },
        pending: recovered,
        replayed: true,
        recovered: true
      };
    }
    return { workspace: current, pending: existing, replayed: true };
  }
  if (current.pendingIssuance.some((item) =>
    item.draftID === draftID && ["issuing", "issued"].includes(item.state)
  )) {
    throw new Error("An issuance attempt is already active for this approved draft.");
  }
  const issueVersion = Math.max(0, ...current.issuedRecords.map((item) => Number(item.issueVersion || 0))) + 1;
  const startedAt = new Date(options.startedAt || Date.now()).toISOString();
  const pending = {
    id: options.id || `pending-${current.questionID}-v${issueVersion}`,
    questionID: current.questionID, draftID, draftHash: draft.draftHash,
    approvalID: approval.id, issueVersion, idempotencyKey,
    stagedObjectKey: `staged/code-question/${current.questionID}/issue-v${issueVersion}/${issueFingerprint(idempotencyKey)}`,
    state: "issuing", actor, startedAt, updatedAt: startedAt, error: null
  };
  return {
    pending,
    replayed: false,
    workspace: { ...current, pendingIssuance: [...current.pendingIssuance, pending], lastFailure: null, updatedAt: startedAt }
  };
}

export function failCodeMemoIssuance(workspace, pendingID, options = {}) {
  const current = normalizeIssueWorkspace(workspace);
  const existing = current.pendingIssuance.find((item) => item.id === pendingID);
  if (!existing) throw new Error("Pending issuance not found.");
  const failedAt = new Date(options.failedAt || Date.now()).toISOString();
  const failed = { ...existing, state: "approved", sagaStatus: "failed", updatedAt: failedAt, error: requiredText(options.error || "Issuance failed.", "issuance error", 2_000) };
  return {
    pending: failed,
    workspace: {
      ...current,
      pendingIssuance: current.pendingIssuance.map((item) => item.id === pendingID ? failed : item),
      lastFailure: { pendingID, draftID: existing.draftID, message: failed.error, failedAt, recoveryState: "approved-unissued" },
      updatedAt: failedAt
    }
  };
}

export function buildCodeMemoManifest(draft, approval, pending, options = {}) {
  const issuedAt = new Date(options.issuedAt || Date.now()).toISOString();
  const semantic = {
    id: options.manifestID || `manifest-${draft.questionID}-v${pending.issueVersion}`,
    immutable: true,
    schemaVersion: 3,
    generatorVersion: "permitext-report-v3",
    recordType: "codeDecisionMemo",
    project: { id: draft.projectID, name: draft.projectName, address: draft.projectAddress },
    draftID: draft.id,
    draftRevision: draft.draftRevision,
    draftHash: draft.draftHash,
    title: draft.title,
    reportDate: issuedAt,
    author: copy(draft.preparedBy),
    questionSnapshot: {
      questionID: draft.questionID,
      displayID: options.displayID || "Q",
      title: options.questionTitle || draft.title,
      questionText: draft.sections.questionPresented,
      definitionRevision: draft.components.definitionRevision,
      definitionHash: draft.components.definitionHash
    },
    inputSnapshots: copy(draft.sections.projectInputs),
    evidenceSetIdentity: {
      evidenceSetID: draft.components.evidenceSetID,
      version: draft.components.evidenceSetVersion,
      contentHash: draft.components.evidenceSetHash
    },
    evidence: copy(draft.sections.evidence),
    analysisRunID: draft.components.analysisRunID,
    conclusion: copy(draft.sections.professionalConclusion),
    conclusionRevision: draft.components.conclusionRevision,
    conclusionApproval: copy(draft.sections.approvalSummary),
    memoApproval: copy(approval),
    authoredNarrative: draft.sections.authoredNarrative,
    issueLineage: {
      issueVersion: pending.issueVersion,
      predecessorID: draft.correctionOfIssuedRecordID || null,
      successorID: null
    },
    disclaimers: [
      "Permitext Issued Record — professional work product; not agency approval or a compliance certificate.",
      "This record is bounded to the identified Project inputs and approved evidence snapshots."
    ],
    createdAt: issuedAt
  };
  return { ...semantic, contentHash: issueFingerprint(semantic) };
}

export function completeCodeMemoIssuance(workspace, pendingID, options = {}) {
  const current = normalizeIssueWorkspace(workspace);
  const pending = current.pendingIssuance.find((item) => item.id === pendingID);
  if (!pending) throw new Error("Pending issuance not found.");
  const existing = current.issuedRecords.find((item) => item.idempotencyKey === pending.idempotencyKey);
  if (existing) return { workspace: current, issuedRecord: existing, replayed: true };
  const draft = current.draftRevisions.find((item) => item.id === pending.draftID);
  const approval = current.memoApprovals.find((item) => item.id === pending.approvalID);
  if (!draft || !approval || draft.draftHash !== pending.draftHash) throw new Error("Issuance dependencies changed.");
  const manifest = buildCodeMemoManifest(draft, approval, pending, options);
  const issuedAt = manifest.createdAt;
  const issuedRecord = Object.freeze({
    id: options.id || `issued-${current.questionID}-v${pending.issueVersion}`,
    immutable: true, kind: "issuedDecisionRecord", questionID: current.questionID,
    issueVersion: pending.issueVersion, status: "issued", reportManifestID: manifest.id,
    manifestHash: manifest.contentHash, draftID: draft.id, draftHash: draft.draftHash,
    componentVersions: copy(draft.components),
    componentHashes: { draft: draft.draftHash, manifest: manifest.contentHash },
    issuingActor: copy(pending.actor), approvalBasis: approval.basis,
    predecessorID: draft.correctionOfIssuedRecordID || null,
    idempotencyKey: pending.idempotencyKey, issuedAt,
    outputs: {
      structured: { contentType: "application/json", contentHash: issueFingerprint(manifest) },
      html: { contentType: "text/html", contentHash: issueFingerprint(codeMemoHTML(manifest)) },
      pdf: { contentType: "application/pdf", contentHash: options.pdfContentHash || null }
    },
    manifest
  });
  const completedPending = { ...pending, state: "issued", sagaStatus: "issued", updatedAt: issuedAt, manifestID: manifest.id, issuedRecordID: issuedRecord.id };
  const supersessions = draft.correctionOfIssuedRecordID
    ? [...current.supersessions, {
        id: `supersession-${draft.correctionOfIssuedRecordID}-${issuedRecord.id}`,
        predecessorID: draft.correctionOfIssuedRecordID,
        successorID: issuedRecord.id,
        reason: requiredText(options.supersessionReason || "Corrected by a later issued version.", "supersession reason", 2_000),
        at: issuedAt
      }]
    : current.supersessions;
  return {
    manifest,
    issuedRecord,
    replayed: false,
    workspace: {
      ...current,
      pendingIssuance: current.pendingIssuance.map((item) => item.id === pendingID ? completedPending : item),
      issuedRecords: [...current.issuedRecords, copy(issuedRecord)], supersessions,
      lastFailure: null, updatedAt: issuedAt
    }
  };
}

export function issuedRecordStatus(workspace, recordID) {
  const current = normalizeIssueWorkspace(workspace);
  const supersession = current.supersessions.find((item) => item.predecessorID === recordID);
  return supersession ? { state: "superseded", successorID: supersession.successorID, reason: supersession.reason } : { state: "issued", successorID: null, reason: null };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function codeMemoHTML(manifest) {
  if (Array.isArray(manifest.items)) {
    const renderedItems = manifest.items.map((item) => {
      if (item.kind === "heading") return `<h2>${escapeHTML(item.text)}</h2>`;
      if (item.kind === "paragraph") return `<p>${escapeHTML(item.text)}</p>`;
      if (item.kind === "list") return `<ul>${(item.items || []).map((value) => `<li>${escapeHTML(value)}</li>`).join("")}</ul>`;
      if (item.kind === "evidence") return `<article aria-label="Approved evidence ${escapeHTML(item.sectionNumber)}"><h3>${escapeHTML(item.codeBook)} ${escapeHTML(item.sectionNumber)} · ${escapeHTML(item.title)}</h3><blockquote>${escapeHTML(item.passageText)}</blockquote></article>`;
      return "";
    }).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHTML(manifest.title)}</title></head><body><main><article aria-labelledby="memo-title"><header><p>Permitext Issued Record · Version ${manifest.issueLineage?.issueVersion || manifest.reportVersion}</p><h1 id="memo-title">${escapeHTML(manifest.title)}</h1><p>${escapeHTML(manifest.project?.name)} · ${escapeHTML(manifest.project?.address)}</p></header>${renderedItems}<footer>${(manifest.disclaimers || []).map((item) => `<p>${escapeHTML(item)}</p>`).join("")}</footer></article></main></body></html>`;
  }
  const inputs = (manifest.inputSnapshots || []).map((item) => `<li><strong>${escapeHTML(item.inputKind)}</strong>: ${escapeHTML(item.statement)}</li>`).join("");
  const evidence = (manifest.evidence || []).map((item) => `<li><strong>${escapeHTML(item.snapshot?.passageLocator || item.snapshotID)}</strong><p>${escapeHTML(item.snapshot?.quotedText || "")}</p></li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHTML(manifest.title)}</title></head><body><main><article aria-labelledby="memo-title"><header><p>Permitext Issued Record · Version ${manifest.issueLineage.issueVersion}</p><h1 id="memo-title">${escapeHTML(manifest.title)}</h1><p>${escapeHTML(manifest.project.name)} · ${escapeHTML(manifest.project.address)}</p></header><section aria-labelledby="question"><h2 id="question">Question presented</h2><p>${escapeHTML(manifest.questionSnapshot.questionText)}</p></section><section aria-labelledby="inputs"><h2 id="inputs">Project inputs</h2><ul>${inputs}</ul></section><section aria-labelledby="evidence"><h2 id="evidence">Approved evidence</h2><ol>${evidence}</ol></section><section aria-labelledby="conclusion"><h2 id="conclusion">Professional conclusion</h2><p>${escapeHTML(manifest.conclusion?.conclusionText || "")}</p><p>${escapeHTML(manifest.conclusion?.reasoning || "")}</p></section><section aria-labelledby="narrative"><h2 id="narrative">Authored narrative</h2><p>${escapeHTML(manifest.authoredNarrative || "No additional narrative.")}</p></section><footer>${manifest.disclaimers.map((item) => `<p>${escapeHTML(item)}</p>`).join("")}</footer></article></main></body></html>`;
}

export function codeMemoStructuredJSON(manifest) {
  return JSON.stringify(stableValue(manifest), null, 2);
}
