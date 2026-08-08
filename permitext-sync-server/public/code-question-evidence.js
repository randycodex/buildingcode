/**
 * Code Question Evidence-stage helpers (Phase 4).
 * Candidates ≠ evidence. Proposals require explicit approval before Evidence Set entry.
 * Snapshots are immutable; set changes create new versions.
 */

export const evidenceRoles = Object.freeze(["governing", "supporting", "conflicting"]);
export const evidenceProposalStates = Object.freeze([
  "proposed",
  "verification-blocked",
  "approved",
  "rejected",
  "excluded"
]);

export const sourceVerificationLabels = Object.freeze({
  verified: "Verified official source",
  "verification-required": "Verification required",
  historical: "Historical / not current",
  explanatory: "Explanatory only",
  "not-eligible": "Not eligible as governing evidence",
  "synthetic-fixture": "Synthetic test source"
});

const roleSet = new Set(evidenceRoles);
const proposalStateSet = new Set(evidenceProposalStates);

function requiredText(value, label, maximum = 500) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function optionalText(value, maximum = 20_000) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) throw new Error("Text is too long.");
  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

export function stableFingerprint(value) {
  const json = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function emptyEvidenceWorkspace(questionID, options = {}) {
  const now = options.createdAt || new Date().toISOString();
  return {
    questionID: String(questionID || ""),
    candidates: [],
    proposals: [],
    snapshots: {},
    evidenceSets: [],
    currentEvidenceSetVersion: 0,
    selectedCandidateID: null,
    selectedPassage: null,
    unassignedSaved: Array.isArray(options.unassignedSaved) ? options.unassignedSaved : [],
    createdAt: now,
    updatedAt: now,
    offlineQueue: []
  };
}

export function normalizeEvidenceWorkspace(value = {}, questionID = "") {
  const source = value && typeof value === "object" ? value : {};
  const base = emptyEvidenceWorkspace(questionID || source.questionID || "");
  base.questionID = String(source.questionID || questionID || base.questionID);
  base.candidates = (Array.isArray(source.candidates) ? source.candidates : [])
    .map(normalizeCandidate)
    .filter(Boolean);
  base.proposals = (Array.isArray(source.proposals) ? source.proposals : [])
    .map(normalizeProposal)
    .filter(Boolean);
  base.snapshots = {};
  if (source.snapshots && typeof source.snapshots === "object") {
    for (const [id, snap] of Object.entries(source.snapshots)) {
      const normalized = normalizeSnapshot(snap);
      if (normalized) base.snapshots[id] = normalized;
    }
  }
  base.evidenceSets = (Array.isArray(source.evidenceSets) ? source.evidenceSets : [])
    .map(normalizeEvidenceSet)
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
  base.currentEvidenceSetVersion = base.evidenceSets.length
    ? base.evidenceSets[base.evidenceSets.length - 1].version
    : 0;
  base.selectedCandidateID = source.selectedCandidateID
    ? String(source.selectedCandidateID)
    : null;
  base.selectedPassage = source.selectedPassage && typeof source.selectedPassage === "object"
    ? {
        candidateID: source.selectedPassage.candidateID
          ? String(source.selectedPassage.candidateID)
          : null,
        passageLocator: String(source.selectedPassage.passageLocator || ""),
        quotedText: String(source.selectedPassage.quotedText || ""),
        surroundingContext: String(source.selectedPassage.surroundingContext || ""),
        structuredMaterial: source.selectedPassage.structuredMaterial &&
          typeof source.selectedPassage.structuredMaterial === "object"
          ? source.selectedPassage.structuredMaterial
          : null
      }
    : null;
  base.unassignedSaved = (Array.isArray(source.unassignedSaved) ? source.unassignedSaved : [])
    .filter((item) => item && typeof item === "object" && item.id !== "saved-unassigned-1")
    .map((item) => ({
      id: String(item.id || ""),
      label: String(item.label || item.title || "Saved item"),
      sectionID: item.sectionID != null ? String(item.sectionID) : null,
      note: String(item.note || "")
    }));
  base.createdAt = String(source.createdAt || base.createdAt);
  base.updatedAt = String(source.updatedAt || base.updatedAt);
  base.offlineQueue = (Array.isArray(source.offlineQueue) ? source.offlineQueue : [])
    .filter((item) => item && typeof item === "object")
    .slice(-50);
  return base;
}

export function normalizeCandidate(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id || "").trim() || null,
    label: String(value.label || value.title || "").trim().slice(0, 500),
    sourceIdentity: String(value.sourceIdentity || "").trim().slice(0, 512),
    passageLocator: String(value.passageLocator || value.sectionNumber || "").trim().slice(0, 512),
    previewText: String(value.previewText || value.quotedText || "").trim().slice(0, 2_000),
    sourceFamily: String(value.sourceFamily || "").trim().slice(0, 120),
    edition: String(value.edition || value.sourceVersion || "").trim().slice(0, 240),
    effectiveDate: value.effectiveDate ? String(value.effectiveDate) : null,
    sourceStatus: String(value.sourceStatus || "verification-required").trim().slice(0, 64),
    completeness: String(value.completeness || "unknown").trim().slice(0, 64),
    researchEligible: value.researchEligible === true,
    analysisEligibleDefault: value.analysisEligibleDefault !== false,
    isCandidateOnly: true,
    note: String(value.note || "").trim().slice(0, 500)
  };
}

export function normalizeSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  const quotedText = String(value.quotedText || "").trim();
  if (!quotedText) return null;
  const sourceIdentity = String(value.sourceIdentity || "").trim();
  const passageLocator = String(value.passageLocator || "").trim();
  const textHash = String(value.textHash || "").trim() ||
    stableFingerprint({ quotedText, passageLocator, sourceIdentity });
  return {
    schemaVersion: 2,
    kind: "evidenceSnapshotV2",
    id: String(value.id || "").trim() || null,
    sourceIdentity: sourceIdentity.slice(0, 512),
    passageLocator: passageLocator.slice(0, 512),
    quotedText: quotedText.slice(0, 50_000),
    textHash,
    structuredMaterial: value.structuredMaterial && typeof value.structuredMaterial === "object"
      ? value.structuredMaterial
      : null,
    surroundingContext: String(value.surroundingContext || "").slice(0, 10_000),
    sourceVersion: String(value.sourceVersion || value.edition || "").slice(0, 240),
    sourceStatus: String(value.sourceStatus || "verification-required").slice(0, 64),
    createdAt: String(value.createdAt || new Date().toISOString())
  };
}

export function normalizeProposal(value) {
  if (!value || typeof value !== "object") return null;
  const state = String(value.state || "proposed").trim();
  if (!proposalStateSet.has(state)) return null;
  const role = String(value.role || "supporting").trim();
  if (!roleSet.has(role)) return null;
  return {
    id: String(value.id || "").trim() || null,
    questionID: String(value.questionID || "").trim() || null,
    candidateID: value.candidateID ? String(value.candidateID) : null,
    snapshotID: value.snapshotID ? String(value.snapshotID) : null,
    state,
    role,
    analysisEligible: value.analysisEligible === true,
    qualification: String(value.qualification || "").slice(0, 2_000),
    professionalNote: String(value.professionalNote || "").slice(0, 4_000),
    projectApplicabilityNote: String(value.projectApplicabilityNote || "").slice(0, 2_000),
    sourceVerificationState: String(value.sourceVerificationState || "verification-required").slice(0, 64),
    proposedBy: String(value.proposedBy || "").slice(0, 256),
    proposedAt: String(value.proposedAt || ""),
    dispositionBy: value.dispositionBy ? String(value.dispositionBy) : null,
    dispositionAt: value.dispositionAt ? String(value.dispositionAt) : null,
    dispositionNote: String(value.dispositionNote || "").slice(0, 2_000),
    // Source provenance cues at proposal time
    sourceDrift: value.sourceDrift === true,
    editionMismatch: value.editionMismatch === true,
    incompleteContext: value.incompleteContext === true
  };
}

export function normalizeEvidenceSet(value) {
  if (!value || typeof value !== "object") return null;
  const version = Number(value.version);
  if (!Number.isSafeInteger(version) || version < 1) return null;
  const entries = (Array.isArray(value.entries) ? value.entries : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const role = String(entry.role || "supporting").trim();
      if (!roleSet.has(role)) return null;
      return {
        snapshotID: String(entry.snapshotID || "").trim(),
        role,
        analysisEligible: entry.analysisEligible === true,
        qualification: String(entry.qualification || "").slice(0, 2_000),
        professionalNote: String(entry.professionalNote || "").slice(0, 4_000),
        approvalActor: String(entry.approvalActor || "").slice(0, 256),
        approvalAt: String(entry.approvalAt || ""),
        sourceVerificationState: String(entry.sourceVerificationState || "verification-required").slice(0, 64),
        projectApplicabilityNote: String(entry.projectApplicabilityNote || "").slice(0, 2_000)
      };
    })
    .filter((entry) => entry && entry.snapshotID);
  const contentHash = String(value.contentHash || "").trim() ||
    stableFingerprint({
      questionID: value.questionID,
      version,
      entries: entries.map((entry) => ({
        snapshotID: entry.snapshotID,
        role: entry.role,
        analysisEligible: entry.analysisEligible,
        qualification: entry.qualification
      }))
    });
  return {
    schemaVersion: 1,
    kind: "questionEvidenceSet",
    id: String(value.id || "").trim() || `eset-v${version}`,
    questionID: String(value.questionID || "").trim() || null,
    version,
    entries,
    contentHash,
    createdBy: String(value.createdBy || "").slice(0, 256),
    createdAt: String(value.createdAt || new Date().toISOString())
  };
}

/** Search results / bookmarks are candidates only. */
export function addCandidates(workspace, candidates = [], options = {}) {
  const current = normalizeEvidenceWorkspace(workspace);
  const now = options.now || new Date().toISOString();
  const nextCandidates = [...current.candidates];
  for (const raw of candidates) {
    const candidate = normalizeCandidate({
      ...raw,
      id: raw.id || `cand-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`,
      isCandidateOnly: true
    });
    if (!candidate?.id) continue;
    if (nextCandidates.some((item) => item.id === candidate.id)) continue;
    nextCandidates.push(candidate);
  }
  return {
    ...current,
    candidates: nextCandidates,
    updatedAt: now
  };
}

export function selectCandidate(workspace, candidateID) {
  const current = normalizeEvidenceWorkspace(workspace);
  const candidate = current.candidates.find((item) => item.id === candidateID);
  if (!candidate) throw new Error("Candidate not found.");
  return {
    ...current,
    selectedCandidateID: candidateID,
    selectedPassage: {
      candidateID,
      passageLocator: candidate.passageLocator,
      quotedText: candidate.previewText,
      surroundingContext: "",
      structuredMaterial: null
    },
    updatedAt: new Date().toISOString()
  };
}

export function setSelectedPassage(workspace, passage = {}) {
  const current = normalizeEvidenceWorkspace(workspace);
  return {
    ...current,
    selectedPassage: {
      candidateID: passage.candidateID || current.selectedCandidateID,
      passageLocator: String(passage.passageLocator || "").slice(0, 512),
      quotedText: String(passage.quotedText || "").slice(0, 50_000),
      surroundingContext: String(passage.surroundingContext || "").slice(0, 10_000),
      structuredMaterial: passage.structuredMaterial && typeof passage.structuredMaterial === "object"
        ? passage.structuredMaterial
        : null
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Editor proposes evidence. Does NOT put content into analysis-eligible set.
 */
export function proposeEvidence(workspace, options = {}) {
  const current = normalizeEvidenceWorkspace(workspace);
  const role = String(options.actorRole || "editor").toLowerCase();
  if (role === "viewer") {
    const error = new Error("Viewers cannot propose evidence.");
    error.code = "CODE_QUESTION_PERMISSION_DENIED";
    throw error;
  }
  const passage = options.passage || current.selectedPassage;
  if (!passage?.quotedText?.trim()) {
    throw new Error("Exact passage text is required to propose evidence.");
  }
  const candidate = current.candidates.find((item) => item.id === (passage.candidateID || current.selectedCandidateID));
  const now = options.now || new Date().toISOString();
  const actor = options.actorUserID || "local-user";
  const snapshotID = options.snapshotID ||
    `esnap-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`;
  const snapshot = normalizeSnapshot({
    id: snapshotID,
    sourceIdentity: options.sourceIdentity || candidate?.sourceIdentity || "unknown-source",
    passageLocator: passage.passageLocator || candidate?.passageLocator || "unspecified",
    quotedText: passage.quotedText,
    surroundingContext: passage.surroundingContext,
    structuredMaterial: passage.structuredMaterial,
    sourceVersion: options.sourceVersion || candidate?.edition || "",
    sourceStatus: options.sourceStatus || candidate?.sourceStatus || "verification-required",
    createdAt: now
  });
  const evidenceRole = String(options.role || "supporting").trim();
  if (!roleSet.has(evidenceRole)) throw new Error("Invalid evidence role.");
  const sourceStatus = snapshot.sourceStatus || "verification-required";
  const verificationBlocked = sourceStatus === "not-eligible" ||
    sourceStatus === "verification-required" && options.forceVerificationBlock === true;
  const proposal = normalizeProposal({
    id: options.proposalID || `prop-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`,
    questionID: current.questionID,
    candidateID: passage.candidateID || current.selectedCandidateID,
    snapshotID: snapshot.id,
    state: verificationBlocked ? "verification-blocked" : "proposed",
    role: evidenceRole,
    analysisEligible: options.analysisEligible === true && !verificationBlocked,
    qualification: options.qualification || "",
    professionalNote: options.professionalNote || "",
    projectApplicabilityNote: options.projectApplicabilityNote || "",
    sourceVerificationState: sourceStatus,
    proposedBy: actor,
    proposedAt: now,
    sourceDrift: options.sourceDrift === true,
    editionMismatch: options.editionMismatch === true,
    incompleteContext: options.incompleteContext === true || !String(passage.surroundingContext || "").trim()
  });
  // Solo Owner may propose+approve in one explicit combined flow.
  if (options.combinedOwnerApprove === true && (role === "owner" || role === "reviewer")) {
    const withProposal = {
      ...current,
      snapshots: { ...current.snapshots, [snapshot.id]: snapshot },
      proposals: [...current.proposals, proposal],
      updatedAt: now
    };
    return approveEvidenceProposal(withProposal, proposal.id, {
      actorUserID: actor,
      actorRole: role,
      now,
      combined: true
    });
  }
  return {
    ...current,
    snapshots: { ...current.snapshots, [snapshot.id]: snapshot },
    proposals: [...current.proposals, proposal],
    updatedAt: now
  };
}

/**
 * Reviewer/Owner approval creates/reuses immutable snapshot and versions Evidence Set.
 */
export function approveEvidenceProposal(workspace, proposalID, options = {}) {
  const current = normalizeEvidenceWorkspace(workspace);
  const role = String(options.actorRole || "reviewer").toLowerCase();
  if (role !== "owner" && role !== "reviewer") {
    const error = new Error("Only Reviewers or Owners may approve evidence.");
    error.code = "CODE_QUESTION_PERMISSION_DENIED";
    throw error;
  }
  const proposal = current.proposals.find((item) => item.id === proposalID);
  if (!proposal) throw new Error("Evidence proposal not found.");
  if (proposal.state === "approved") {
    return current; // idempotent
  }
  if (proposal.state === "rejected" || proposal.state === "excluded") {
    throw new Error("Rejected or excluded proposals cannot be approved.");
  }
  if (proposal.state === "verification-blocked" && options.overrideVerification !== true) {
    throw new Error("Verification-blocked material requires an explicit override rule before approval.");
  }
  const snapshot = current.snapshots[proposal.snapshotID];
  if (!snapshot) throw new Error("Immutable snapshot missing for proposal.");
  const now = options.now || new Date().toISOString();
  const actor = options.actorUserID || "local-user";
  const prior = currentEvidenceSet(current);
  const nextVersion = (prior?.version || 0) + 1;
  const entry = {
    snapshotID: snapshot.id,
    role: options.role || proposal.role,
    analysisEligible: options.analysisEligible != null
      ? options.analysisEligible === true
      : proposal.analysisEligible === true,
    qualification: options.qualification != null ? options.qualification : proposal.qualification,
    professionalNote: options.professionalNote != null
      ? options.professionalNote
      : proposal.professionalNote,
    approvalActor: actor,
    approvalAt: now,
    sourceVerificationState: proposal.sourceVerificationState,
    projectApplicabilityNote: options.projectApplicabilityNote != null
      ? options.projectApplicabilityNote
      : proposal.projectApplicabilityNote
  };
  // Preserve prior entries; add/replace same snapshot with new role.
  const priorEntries = (prior?.entries || []).filter((item) => item.snapshotID !== snapshot.id);
  const set = normalizeEvidenceSet({
    id: `eset-${current.questionID}-v${nextVersion}`,
    questionID: current.questionID,
    version: nextVersion,
    entries: [...priorEntries, entry],
    createdBy: actor,
    createdAt: now
  });
  const proposals = current.proposals.map((item) =>
    item.id === proposalID
      ? {
          ...item,
          state: "approved",
          dispositionBy: actor,
          dispositionAt: now,
          dispositionNote: options.dispositionNote || "Approved into Evidence Set."
        }
      : item
  );
  return {
    ...current,
    proposals,
    evidenceSets: [...current.evidenceSets, set],
    currentEvidenceSetVersion: nextVersion,
    updatedAt: now
  };
}

export function rejectEvidenceProposal(workspace, proposalID, options = {}) {
  const current = normalizeEvidenceWorkspace(workspace);
  const role = String(options.actorRole || "reviewer").toLowerCase();
  if (role !== "owner" && role !== "reviewer") {
    const error = new Error("Only Reviewers or Owners may reject evidence.");
    error.code = "CODE_QUESTION_PERMISSION_DENIED";
    throw error;
  }
  const now = options.now || new Date().toISOString();
  const actor = options.actorUserID || "local-user";
  const nextState = options.exclude === true ? "excluded" : "rejected";
  return {
    ...current,
    proposals: current.proposals.map((item) =>
      item.id === proposalID
        ? {
            ...item,
            state: nextState,
            dispositionBy: actor,
            dispositionAt: now,
            dispositionNote: options.dispositionNote || nextState
          }
        : item
    ),
    updatedAt: now
  };
}

/** Removal creates a new Evidence Set version; prior versions stay immutable. */
export function removeEvidenceEntry(workspace, snapshotID, options = {}) {
  const current = normalizeEvidenceWorkspace(workspace);
  const role = String(options.actorRole || "reviewer").toLowerCase();
  if (role !== "owner" && role !== "reviewer") {
    const error = new Error("Only Reviewers or Owners may remove approved evidence.");
    error.code = "CODE_QUESTION_PERMISSION_DENIED";
    throw error;
  }
  const prior = currentEvidenceSet(current);
  if (!prior) throw new Error("No approved Evidence Set to modify.");
  if (!prior.entries.some((entry) => entry.snapshotID === snapshotID)) {
    throw new Error("Snapshot is not in the current Evidence Set.");
  }
  const now = options.now || new Date().toISOString();
  const actor = options.actorUserID || "local-user";
  const nextVersion = prior.version + 1;
  const set = normalizeEvidenceSet({
    id: `eset-${current.questionID}-v${nextVersion}`,
    questionID: current.questionID,
    version: nextVersion,
    entries: prior.entries.filter((entry) => entry.snapshotID !== snapshotID),
    createdBy: actor,
    createdAt: now
  });
  return {
    ...current,
    evidenceSets: [...current.evidenceSets, set],
    currentEvidenceSetVersion: nextVersion,
    updatedAt: now
  };
}

export function currentEvidenceSet(workspace) {
  const current = normalizeEvidenceWorkspace(workspace);
  if (!current.evidenceSets.length) return null;
  return current.evidenceSets[current.evidenceSets.length - 1];
}

/**
 * Analysis may only use approved, analysis-eligible entries — never candidates or proposals.
 */
export function analysisEligibleEvidence(workspace) {
  const set = currentEvidenceSet(workspace);
  if (!set) return [];
  const snaps = normalizeEvidenceWorkspace(workspace).snapshots;
  return set.entries
    .filter((entry) => entry.analysisEligible === true)
    .map((entry) => ({
      ...entry,
      snapshot: snaps[entry.snapshotID] || null
    }))
    .filter((entry) => entry.snapshot);
}

export function isApprovedEvidenceSnapshot(workspace, snapshotID) {
  const set = currentEvidenceSet(workspace);
  return Boolean(set?.entries?.some((entry) => entry.snapshotID === snapshotID));
}

export function reconstructEvidenceSet(workspace, version = null) {
  const current = normalizeEvidenceWorkspace(workspace);
  const set = version == null
    ? currentEvidenceSet(current)
    : current.evidenceSets.find((item) => item.version === Number(version));
  if (!set) return null;
  const entries = set.entries.map((entry) => {
    const snapshot = current.snapshots[entry.snapshotID];
    if (!snapshot) {
      throw new Error(`Evidence Set v${set.version} cannot be reconstructed; missing snapshot ${entry.snapshotID}.`);
    }
    return {
      entry,
      snapshot,
      // Byte-for-byte reconstruction uses immutable snapshot text + content hash
      textHash: snapshot.textHash,
      quotedText: snapshot.quotedText
    };
  });
  return {
    set,
    entries,
    contentHash: set.contentHash,
    reconstructable: true
  };
}

export function sourceVerificationLabel(state) {
  return sourceVerificationLabels[state] || sourceVerificationLabels["verification-required"];
}

export function readerProvenanceModel(candidateOrSnapshot = {}) {
  const status = candidateOrSnapshot.sourceStatus ||
    candidateOrSnapshot.sourceVerificationState ||
    "verification-required";
  return {
    authority: candidateOrSnapshot.sourceIdentity || candidateOrSnapshot.sourceFamily || "Unknown source",
    edition: candidateOrSnapshot.edition || candidateOrSnapshot.sourceVersion || "Unknown edition",
    effectiveDate: candidateOrSnapshot.effectiveDate || null,
    sourceStatus: status,
    sourceStatusLabel: sourceVerificationLabel(status),
    completeness: candidateOrSnapshot.completeness || "unknown",
    researchEligible: candidateOrSnapshot.researchEligible === true,
    // Never conflate with project applicability
    verificationAxis: "source-verification",
    applicabilityAxis: "project-applicability"
  };
}

export function evidenceWarnings(proposalOrEntry = {}) {
  const warnings = [];
  if (proposalOrEntry.sourceDrift) {
    warnings.push({ code: "source-drift", message: "Source text may have drifted from the approved edition." });
  }
  if (proposalOrEntry.editionMismatch) {
    warnings.push({ code: "edition-mismatch", message: "Edition/as-of date may not match Project conditions." });
  }
  if (proposalOrEntry.incompleteContext) {
    warnings.push({ code: "incomplete-context", message: "Surrounding context may be incomplete." });
  }
  if (proposalOrEntry.state === "verification-blocked") {
    warnings.push({ code: "verification-blocked", message: "Source verification blocks analysis eligibility." });
  }
  return warnings;
}

/**
 * Candidates and unapproved proposals must never appear as analysis input.
 */
export function assertNoCandidatesInAnalysisInput(workspace) {
  const eligible = analysisEligibleEvidence(workspace);
  for (const item of eligible) {
    if (item.snapshot?.isCandidateOnly) {
      throw new Error("Candidates cannot enter analysis input.");
    }
  }
  const set = currentEvidenceSet(workspace);
  if (!set) return true;
  const proposals = normalizeEvidenceWorkspace(workspace).proposals;
  for (const entry of set.entries) {
    const openProposal = proposals.find((item) =>
      item.snapshotID === entry.snapshotID && item.state === "proposed"
    );
    if (openProposal) {
      throw new Error("Proposed-only material cannot enter the approved Evidence Set without approval.");
    }
  }
  return true;
}

export function canProposeEvidence(actorRole) {
  const role = String(actorRole || "").toLowerCase();
  return role === "owner" || role === "editor" || role === "reviewer";
}

export function canApproveEvidence(actorRole) {
  const role = String(actorRole || "").toLowerCase();
  return role === "owner" || role === "reviewer";
}

export function trayModel(workspace) {
  const current = normalizeEvidenceWorkspace(workspace);
  const set = currentEvidenceSet(current);
  return {
    proposals: current.proposals.filter((item) =>
      item.state === "proposed" || item.state === "verification-blocked"
    ),
    approved: (set?.entries || []).map((entry) => ({
      entry,
      snapshot: current.snapshots[entry.snapshotID] || null
    })),
    rejected: current.proposals.filter((item) =>
      item.state === "rejected" || item.state === "excluded"
    ),
    unassignedSaved: current.unassignedSaved,
    currentVersion: set?.version || 0,
    setContentHash: set?.contentHash || null
  };
}

export function enqueueEvidenceOfflineMutation(workspace, mutation) {
  const current = normalizeEvidenceWorkspace(workspace);
  const entry = {
    id: `eq-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`,
    commandKind: String(mutation?.commandKind || "codeQuestion.evidence.propose"),
    payload: mutation?.payload && typeof mutation.payload === "object" ? mutation.payload : {},
    createdAt: mutation?.createdAt || new Date().toISOString(),
    status: "queued"
  };
  return {
    ...current,
    offlineQueue: [...current.offlineQueue, entry].slice(-50)
  };
}
