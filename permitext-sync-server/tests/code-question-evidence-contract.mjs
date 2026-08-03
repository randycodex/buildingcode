/**
 * Phase 4 Evidence-stage contract tests.
 */
import assert from "node:assert/strict";
import {
  addCandidates,
  analysisEligibleEvidence,
  approveEvidenceProposal,
  assertNoCandidatesInAnalysisInput,
  canApproveEvidence,
  canProposeEvidence,
  currentEvidenceSet,
  emptyEvidenceWorkspace,
  isApprovedEvidenceSnapshot,
  normalizeEvidenceWorkspace,
  proposeEvidence,
  readerProvenanceModel,
  reconstructEvidenceSet,
  rejectEvidenceProposal,
  removeEvidenceEntry,
  selectCandidate,
  setSelectedPassage,
  sourceVerificationLabel,
  trayModel
} from "../public/code-question-evidence.js";

const now = "2026-08-03T23:00:00.000Z";
let evidence = emptyEvidenceWorkspace("cq-1");

// Candidates are not evidence
evidence = addCandidates(evidence, [{
  id: "cand-1",
  label: "SYN §10.1",
  sourceIdentity: "synthetic:10.1",
  passageLocator: "SYN §10.1",
  previewText: "[SYNTHETIC] corridor width 44 inches",
  sourceStatus: "synthetic-fixture",
  researchEligible: true,
  edition: "fixture-1"
}]);
assert.equal(evidence.candidates.length, 1);
assert.equal(evidence.candidates[0].isCandidateOnly, true);
assert.equal(currentEvidenceSet(evidence), null);
assert.deepEqual(analysisEligibleEvidence(evidence), []);

// Select + set passage
evidence = selectCandidate(evidence, "cand-1");
evidence = setSelectedPassage(evidence, {
  candidateID: "cand-1",
  passageLocator: "SYN §10.1",
  quotedText: "[SYNTHETIC] corridor width 44 inches",
  surroundingContext: "Prior paragraph context."
});
assert.equal(evidence.selectedCandidateID, "cand-1");

// Viewer cannot propose
assert.equal(canProposeEvidence("viewer"), false);
assert.throws(
  () => proposeEvidence(evidence, { actorRole: "viewer", actorUserID: "v1" }),
  (error) => error.code === "CODE_QUESTION_PERMISSION_DENIED"
);

// Editor proposes — not yet analysis-eligible set
assert.equal(canProposeEvidence("editor"), true);
evidence = proposeEvidence(evidence, {
  actorRole: "editor",
  actorUserID: "editor-1",
  role: "governing",
  analysisEligible: true,
  projectApplicabilityNote: "Applies to primary corridor of synthetic project.",
  now
});
assert.equal(evidence.proposals.length, 1);
assert.equal(evidence.proposals[0].state, "proposed");
assert.equal(currentEvidenceSet(evidence), null);
assert.deepEqual(analysisEligibleEvidence(evidence), []);
assert.ok(Object.keys(evidence.snapshots).length >= 1);

// Editor cannot approve
assert.equal(canApproveEvidence("editor"), false);
assert.throws(
  () => approveEvidenceProposal(evidence, evidence.proposals[0].id, {
    actorRole: "editor",
    actorUserID: "editor-1"
  }),
  (error) => error.code === "CODE_QUESTION_PERMISSION_DENIED"
);

// Reviewer approves → Evidence Set v1
const proposalID = evidence.proposals[0].id;
const snapshotID = evidence.proposals[0].snapshotID;
evidence = approveEvidenceProposal(evidence, proposalID, {
  actorRole: "reviewer",
  actorUserID: "reviewer-1",
  now
});
const set = currentEvidenceSet(evidence);
assert.equal(set.version, 1);
assert.equal(set.entries.length, 1);
assert.equal(set.entries[0].snapshotID, snapshotID);
assert.equal(set.entries[0].role, "governing");
assert.equal(isApprovedEvidenceSnapshot(evidence, snapshotID), true);
assert.equal(analysisEligibleEvidence(evidence).length, 1);
assertNoCandidatesInAnalysisInput(evidence);

// Reconstruct byte-for-byte via snapshot textHash
const reconstructed = reconstructEvidenceSet(evidence, 1);
assert.equal(reconstructed.reconstructable, true);
assert.equal(reconstructed.entries[0].textHash, evidence.snapshots[snapshotID].textHash);
assert.equal(reconstructed.entries[0].quotedText, evidence.snapshots[snapshotID].quotedText);
assert.equal(reconstructed.set.contentHash, set.contentHash);

// Source verification vs project applicability are separate fields
const entry = set.entries[0];
assert.ok(entry.sourceVerificationState);
assert.ok("projectApplicabilityNote" in entry);
assert.notEqual(entry.sourceVerificationState, entry.projectApplicabilityNote);
const provenance = readerProvenanceModel(evidence.candidates[0]);
assert.equal(provenance.verificationAxis, "source-verification");
assert.equal(provenance.applicabilityAxis, "project-applicability");
assert.equal(sourceVerificationLabel("synthetic-fixture"), "Synthetic test source");

// Removal creates v2; v1 remains
const v1Hash = set.contentHash;
evidence = removeEvidenceEntry(evidence, snapshotID, {
  actorRole: "owner",
  actorUserID: "owner-1",
  now: "2026-08-03T23:30:00.000Z"
});
assert.equal(currentEvidenceSet(evidence).version, 2);
assert.equal(currentEvidenceSet(evidence).entries.length, 0);
const v1 = reconstructEvidenceSet(evidence, 1);
assert.equal(v1.set.contentHash, v1Hash);
assert.equal(v1.entries.length, 1);

// Rejected proposals stay out of analysis
evidence = proposeEvidence(evidence, {
  actorRole: "editor",
  actorUserID: "editor-1",
  role: "supporting",
  analysisEligible: true,
  passage: {
    candidateID: "cand-1",
    passageLocator: "SYN §10.1 Exception",
    quotedText: "[SYNTHETIC] exception 36 inches",
    surroundingContext: "Exception context"
  },
  now
});
const prop2 = evidence.proposals.find((item) => item.state === "proposed");
evidence = rejectEvidenceProposal(evidence, prop2.id, {
  actorRole: "reviewer",
  actorUserID: "reviewer-1",
  now
});
assert.equal(evidence.proposals.find((item) => item.id === prop2.id).state, "rejected");
assert.equal(analysisEligibleEvidence(evidence).length, 0);

// Tray model keeps unassigned saved outside approved set
evidence = normalizeEvidenceWorkspace({
  ...evidence,
  unassignedSaved: [{ id: "saved-1", label: "Unassigned bookmark", note: "Not evidence" }]
}, "cq-1");
const tray = trayModel(evidence);
assert.equal(tray.unassignedSaved.length, 1);
assert.equal(tray.approved.length, 0);

// Combined owner propose+approve
let solo = emptyEvidenceWorkspace("cq-2");
solo = addCandidates(solo, [{
  id: "c2",
  label: "Solo path",
  sourceIdentity: "synthetic:solo",
  passageLocator: "S §1",
  previewText: "[SYNTHETIC] solo",
  sourceStatus: "synthetic-fixture"
}]);
solo = selectCandidate(solo, "c2");
solo = setSelectedPassage(solo, {
  candidateID: "c2",
  passageLocator: "S §1",
  quotedText: "[SYNTHETIC] solo passage",
  surroundingContext: "ctx"
});
solo = proposeEvidence(solo, {
  actorRole: "owner",
  actorUserID: "owner-1",
  role: "governing",
  analysisEligible: true,
  combinedOwnerApprove: true,
  now
});
assert.equal(currentEvidenceSet(solo).version, 1);
assert.equal(analysisEligibleEvidence(solo).length, 1);

// Structured material survives snapshot
let grid = emptyEvidenceWorkspace("cq-3");
grid = addCandidates(grid, [{
  id: "cg",
  label: "Table candidate",
  sourceIdentity: "synthetic:table",
  passageLocator: "T §1",
  previewText: "Table row",
  sourceStatus: "synthetic-fixture"
}]);
grid = selectCandidate(grid, "cg");
grid = setSelectedPassage(grid, {
  candidateID: "cg",
  passageLocator: "T §1",
  quotedText: "Table row value 44",
  structuredMaterial: { kind: "table", headers: ["Width"], rows: [["44 in"]] }
});
grid = proposeEvidence(grid, {
  actorRole: "editor",
  actorUserID: "e1",
  role: "supporting",
  analysisEligible: true,
  now
});
const gridSnapID = grid.proposals[0].snapshotID;
assert.deepEqual(grid.snapshots[gridSnapID].structuredMaterial.headers, ["Width"]);
grid = approveEvidenceProposal(grid, grid.proposals[0].id, {
  actorRole: "reviewer",
  actorUserID: "r1",
  now
});
const recon = reconstructEvidenceSet(grid);
assert.deepEqual(recon.entries[0].snapshot.structuredMaterial.rows, [["44 in"]]);

console.log("code-question-evidence-contract: all assertions passed");
