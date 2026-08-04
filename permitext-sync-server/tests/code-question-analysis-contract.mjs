/** Phase 5 Analyze + Professional Conclusion contract tests. */
import assert from "node:assert/strict";
import {
  analysisRunIsStale,
  beginAnalysisRequest,
  buildAnalysisBinding,
  completeAnalysisRequest,
  emptyAnalysisWorkspace,
  publishProfessionalConclusion,
  syntheticBoundedInterpretation,
  transferAnalysisCitations,
  updateConclusionDraft,
  useAnalysisAsStartingPoint,
  validateBoundedInterpretation
} from "../public/code-question-analysis.js";
import {
  addCandidates,
  approveEvidenceProposal,
  emptyEvidenceWorkspace,
  proposeEvidence,
  selectCandidate,
  setSelectedPassage
} from "../public/code-question-evidence.js";
import {
  createQuestionInput,
  emptyDefinitionRecord,
  updateDefinitionFields
} from "../public/code-question-define.js";
import { createAnalysisArtifact } from "../code-question-commands.mjs";

const now = "2026-08-03T23:50:00.000Z";
let definition = emptyDefinitionRecord("cq-5", { title: "Egress width", createdBy: "editor-1", createdAt: now });
definition = updateDefinitionFields(definition, {
  questionText: "What minimum clear width applies to the primary corridor?",
  scope: "Primary corridor",
  jurisdiction: "SYNTHETIC-TEST",
  asOfDate: "2026-01-01T00:00:00.000Z",
  desiredOutput: "Professional conclusion"
}, { actorUserID: "editor-1", expectedVersion: 1, now });
definition = createQuestionInput(definition, {
  inputKind: "confirmedFact",
  statement: "The measured corridor is 48 inches wide.",
  state: "confirmed",
  actorUserID: "editor-1",
  now
});
definition = createQuestionInput(definition, {
  inputKind: "assumption",
  statement: "The corridor serves fewer than 50 occupants.",
  actorUserID: "editor-1",
  now
});

let evidence = emptyEvidenceWorkspace("cq-5");
evidence = addCandidates(evidence, [{
  id: "candidate-approved",
  sourceIdentity: "synthetic:approved",
  passageLocator: "SYN §5.1",
  previewText: "[SYNTHETIC] The clear width shall be not less than 44 inches.",
  sourceStatus: "synthetic-fixture",
  researchEligible: true
}, {
  id: "candidate-hidden",
  sourceIdentity: "synthetic:hidden",
  passageLocator: "SYN §9.9",
  previewText: "[SYNTHETIC] Hidden candidate must never be analyzed.",
  sourceStatus: "synthetic-fixture",
  researchEligible: true
}]);
evidence = selectCandidate(evidence, "candidate-approved");
evidence = setSelectedPassage(evidence, {
  candidateID: "candidate-approved",
  passageLocator: "SYN §5.1",
  quotedText: "[SYNTHETIC] The clear width shall be not less than 44 inches.",
  surroundingContext: "Synthetic context."
});
evidence = proposeEvidence(evidence, {
  actorRole: "editor",
  actorUserID: "editor-1",
  role: "governing",
  analysisEligible: true,
  now
});
evidence = approveEvidenceProposal(evidence, evidence.proposals[0].id, {
  actorRole: "reviewer",
  actorUserID: "reviewer-1",
  now
});

const binding = buildAnalysisBinding(definition, evidence);
assert.equal(binding.approvedEvidence.length, 1);
assert.equal(binding.approvedEvidence[0].snapshot.quotedText.includes("44 inches"), true);
assert.equal(binding.approvedEvidence.some((item) => item.snapshot.quotedText.includes("Hidden")), false);
assert.equal(binding.inputSnapshotIDs.length, 2);

const descriptor = createAnalysisArtifact({
  userID: "editor-1",
  questionID: binding.questionID,
  definitionRevision: binding.definitionRevision,
  definitionHash: binding.definitionHash,
  inputSnapshotIDs: binding.inputSnapshotIDs,
  inputSetHash: binding.inputSetHash,
  evidenceSetID: binding.evidenceSetID,
  evidenceSetVersion: binding.evidenceSetVersion,
  evidenceSetHash: binding.evidenceSetHash,
  dependencyHash: binding.dependencyHash,
  researchAnswerID: "research-answer-server",
  requestID: "server-request-1",
  citationValidation: "approved-evidence-only",
  createdAt: now
});
assert.equal(descriptor.envelope.type, "questionAnalysis");
assert.equal(descriptor.payload.citationValidation, "approved-evidence-only");

// Citation attacks are rejected, including candidate IDs and invented source IDs.
const validInterpretation = syntheticBoundedInterpretation(binding);
assert.equal(validateBoundedInterpretation(validInterpretation, binding).citations.length, 1);
assert.throws(() => validateBoundedInterpretation({
  ...validInterpretation,
  citations: [{ snapshotIDs: ["candidate-hidden"], relevance: "attack" }]
}, binding), (error) => error.code === "INVALID_RESEARCH_CITATION");
assert.throws(() => validateBoundedInterpretation({
  ...validInterpretation,
  citations: [{ snapshotIDs: ["corpus-secret"], relevance: "attack" }]
}, binding), (error) => error.code === "INVALID_RESEARCH_CITATION");
assert.throws(() => validateBoundedInterpretation({
  ...validInterpretation,
  limitations: [],
  evidenceLimitations: []
}, binding), /limitations/);

// Idempotent request start and completion: one request → one immutable run.
let workspace = emptyAnalysisWorkspace("cq-5");
let started = beginAnalysisRequest(workspace, binding, {
  requestID: "request-5",
  requestedBy: "editor-1",
  now
});
assert.equal(started.replayed, false);
workspace = started.workspace;
started = beginAnalysisRequest(workspace, binding, { requestID: "request-5", requestedBy: "editor-1", now });
assert.equal(started.replayed, true);
let completed = completeAnalysisRequest(workspace, binding, validInterpretation, {
  requestID: "request-5",
  researchAnswerID: "research-answer-5",
  requestedBy: "editor-1",
  createdAt: now
});
assert.equal(completed.run.immutable, true);
assert.equal(completed.run.citationValidation, "approved-evidence-only");
workspace = completed.workspace;
completed = completeAnalysisRequest(workspace, binding, validInterpretation, {
  requestID: "request-5",
  researchAnswerID: "different-answer-must-not-win"
});
assert.equal(completed.replayed, true);
assert.equal(completed.run.researchAnswerID, "research-answer-5");
assert.equal(workspace.runs.length, 1);

// Dependency change makes prior run stale and controlled rerun gets a new request.
const revisedDefinition = updateDefinitionFields(definition, {
  questionText: "What minimum clear width applies after the scope revision?"
}, { actorUserID: "editor-1", expectedVersion: definition.expectedVersion, now: "2026-08-04T00:10:00.000Z" });
const revisedBinding = buildAnalysisBinding(revisedDefinition, evidence);
assert.equal(analysisRunIsStale(workspace.runs[0], revisedBinding), true);
assert.equal(beginAnalysisRequest(workspace, revisedBinding, { requestID: "request-6" }).replayed, false);

// AI transfer is explicit; the professional conclusion remains a separate artifact.
workspace = useAnalysisAsStartingPoint(workspace, workspace.runs[0]);
assert.equal(workspace.conclusionDraft.analysisRunID, workspace.runs[0].id);
assert.match(workspace.conclusionDraft.aiAssistanceDisclosure, /Started from bounded/);
workspace = updateConclusionDraft(workspace, {
  conclusionText: "The professional concludes that 44 inches applies, subject to verification of the stated assumptions.",
  reasoning: "Professional review of the approved passage and Project inputs."
});
let published = publishProfessionalConclusion(workspace, binding, {
  authorUserID: "architect-1",
  createdAt: "2026-08-04T00:15:00.000Z"
});
assert.equal(published.revision.kind, "professionalConclusion");
assert.equal(published.revision.revision, 1);
assert.equal(published.revision.authorUserID, "architect-1");
assert.notEqual(published.revision.id, workspace.runs[0].id);

// AI can be skipped entirely; authoring from approved evidence still works.
let noAI = emptyAnalysisWorkspace("cq-5");
noAI = updateConclusionDraft(noAI, {
  conclusionText: "Independent professional conclusion from the approved evidence.",
  citations: [binding.approvedEvidence[0].snapshot.id],
  analysisRunID: null,
  aiAssistanceDisclosure: ""
});
published = publishProfessionalConclusion(noAI, binding, { authorUserID: "architect-2", createdAt: now });
assert.equal(published.revision.analysisRunID, null);
assert.equal(published.revision.aiAssistanceDisclosure, "");

// Citation transfer alone does not copy analysis prose.
let citationOnly = emptyAnalysisWorkspace("cq-5");
citationOnly = transferAnalysisCitations(citationOnly, workspace.runs[0]);
assert.equal(citationOnly.conclusionDraft.conclusionText, "");
assert.deepEqual(citationOnly.conclusionDraft.citations, [binding.approvedEvidence[0].snapshot.id]);

console.log("code-question-analysis-contract: all assertions passed");
