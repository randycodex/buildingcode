import assert from "node:assert/strict";
import {
  approveCodeMemo,
  beginCodeMemoIssuance,
  codeMemoHTML,
  codeMemoReadiness,
  codeMemoStructuredJSON,
  completeCodeMemoIssuance,
  emptyIssueWorkspace,
  failCodeMemoIssuance,
  issuedRecordStatus,
  markCodeMemoReady,
  prepareCodeMemoDraft
} from "../public/code-question-issue.js";

const questionID = "question-issue-1";
const actor = { userID: "owner-1", displayName: "Owner One", role: "owner" };
const definition = {
  questionID, displayID: "Q-001", title: "Synthetic classification",
  questionText: "What does the approved synthetic fixture establish?",
  definitionRevision: 1,
  inputs: [{ id: "input-1", inputKind: "confirmedFact", state: "confirmed", statement: "Fixture condition A", revision: 1 }]
};
const evidence = {
  evidenceSets: [{
    id: "set-1", version: 1, contentHash: "set-hash-1",
    entries: [{ snapshotID: "snapshot-1", role: "governing", analysisEligible: true, sourceVerificationState: "synthetic-fixture" }]
  }],
  snapshots: {
    "snapshot-1": { id: "snapshot-1", passageLocator: "SYNTHETIC §TEST-10.1", quotedText: "Synthetic fixture text.", contentHash: "snapshot-hash-1" }
  }
};
const analysis = {
  runs: [{ id: "analysis-1", dependencyHash: "dependency-1", answer: { conclusion: "Bounded synthetic result.", limitations: ["Synthetic only."] } }],
  conclusionRevisions: [{
    id: "conclusion-1", immutable: true, questionID, revision: 1,
    conclusionText: "The approved synthetic fixture supports the stated result.",
    reasoning: "Bounded to the approved snapshot.", citations: ["snapshot-1"],
    evidenceSetHash: "set-hash-1", analysisDependencyHash: "dependency-1"
  }]
};
const review = {
  requests: [],
  approvals: [{
    id: "conclusion-approval-1", conclusionID: "conclusion-1", conclusionRevision: 1,
    dependencyHash: "dependency-1", basis: "Reviewed.", approvedAt: "2026-08-03T12:00:00.000Z"
  }]
};

const ready = codeMemoReadiness({ definition, evidence, analysis, review, actor, currentDependencyHash: "dependency-1" });
assert.equal(ready.ready, true);
assert.equal(ready.checks.length, 9);
const unresolved = codeMemoReadiness({
  definition: { ...definition, inputs: [...definition.inputs, { id: "unknown-1", inputKind: "unknown", state: "proposed", statement: "Unknown" }] },
  evidence, analysis, review, actor, currentDependencyHash: "dependency-1"
});
assert.equal(unresolved.ready, false);
assert.equal(unresolved.blockers.some((item) => item.id === "inputs"), true);
assert.equal(codeMemoReadiness({ definition, evidence, analysis, review, actor, currentDependencyHash: "changed" }).blockers.some((item) => item.id === "analysis"), true);

let workspace = emptyIssueWorkspace(questionID);
const prepared = prepareCodeMemoDraft(workspace, {
  project: { id: "project-1", name: "Project One", address: "1 Test Place" },
  definition, evidence, analysis, review, actor,
  title: "Q-001 Code Memo", narrative: "Professional implementation condition.",
  definitionHash: "definition-hash-1", inputSetHash: "input-hash-1",
  currentDependencyHash: "dependency-1", preparedAt: "2026-08-03T13:00:00.000Z"
});
workspace = prepared.workspace;
assert.equal(prepared.draft.schemaVersion, 2);
assert.equal(prepared.draft.recordType, "codeDecisionMemo");
assert.equal(prepared.draft.sections.evidence.length, 1);
assert.equal(prepared.draft.sections.professionalConclusion.revision, 1);
assert.equal(prepared.draft.immutable, true);
const frozenDraft = JSON.stringify(prepared.draft);

const marked = markCodeMemoReady(workspace, prepared.draft.id, ready, { actor, at: "2026-08-03T13:10:00.000Z" });
workspace = marked.workspace;
assert.equal(marked.readinessRecord.state, "ready-for-approval");
const approved = approveCodeMemo(workspace, prepared.draft.id, {
  actor, basis: "Reviewed exact Draft r1 and current conclusion.", approvedAt: "2026-08-03T13:20:00.000Z"
});
workspace = approved.workspace;
assert.equal(approved.approval.draftHash, prepared.draft.draftHash);
assert.throws(() => approveCodeMemo(marked.workspace, prepared.draft.id, {
  actor: { userID: "editor-1", role: "editor" }, basis: "Not authorized."
}), /cannot approve/i);

const begun = beginCodeMemoIssuance(workspace, prepared.draft.id, ready, {
  actor, idempotencyKey: "issue-key-1", startedAt: "2026-08-03T13:30:00.000Z"
});
workspace = begun.workspace;
assert.equal(begun.pending.state, "issuing");
const replay = beginCodeMemoIssuance(workspace, prepared.draft.id, ready, { actor, idempotencyKey: "issue-key-1" });
assert.equal(replay.replayed, true);
assert.equal(replay.pending.id, begun.pending.id);
assert.throws(() => beginCodeMemoIssuance(workspace, prepared.draft.id, ready, {
  actor, idempotencyKey: "concurrent-second-key"
}), /already active/i, "Concurrent issue attempts must not reserve another version.");

const failed = failCodeMemoIssuance(workspace, begun.pending.id, {
  error: "Synthetic staged upload interruption.", failedAt: "2026-08-03T13:31:00.000Z"
});
workspace = failed.workspace;
assert.equal(workspace.lastFailure.recoveryState, "approved-unissued");
const recovered = beginCodeMemoIssuance(workspace, prepared.draft.id, ready, {
  actor, idempotencyKey: "issue-key-1", startedAt: "2026-08-03T13:32:00.000Z"
});
workspace = recovered.workspace;
assert.equal(recovered.recovered, true);
assert.equal(recovered.pending.state, "issuing");

const completed = completeCodeMemoIssuance(workspace, recovered.pending.id, {
  id: "issued-1", manifestID: "manifest-1", displayID: "Q-001",
  questionTitle: definition.title, issuedAt: "2026-08-03T13:35:00.000Z",
  pdfContentHash: "pdf-hash-1"
});
workspace = completed.workspace;
assert.equal(completed.manifest.schemaVersion, 3);
assert.equal(completed.issuedRecord.issueVersion, 1);
assert.equal(completed.issuedRecord.status, "issued");
assert.equal(JSON.stringify(prepared.draft), frozenDraft, "Issuance must not mutate the approved draft revision.");

const manifestFrozen = JSON.stringify(completed.manifest);
definition.questionText = "Later Project edit that must not alter v1.";
evidence.snapshots["snapshot-1"].quotedText = "Later local edit.";
assert.equal(JSON.stringify(completed.manifest), manifestFrozen, "Issued content must remain unchanged after current Project edits.");
const html = codeMemoHTML(completed.manifest);
assert.match(html, /<main>/);
assert.match(html, /aria-labelledby="memo-title"/);
assert.match(html, /not agency approval or a compliance certificate/i);
assert.deepEqual(JSON.parse(codeMemoStructuredJSON(completed.manifest)), JSON.parse(JSON.stringify(completed.manifest)), "Web and iOS structured readers must resolve the same semantic manifest.");

// Restore current inputs for a correction built from the same governed versions.
definition.questionText = "What does the approved synthetic fixture establish?";
evidence.snapshots["snapshot-1"].quotedText = "Synthetic fixture text.";
const correction = prepareCodeMemoDraft(workspace, {
  project: { id: "project-1", name: "Project One", address: "1 Test Place" },
  definition, evidence, analysis, review, actor,
  title: "Q-001 Code Memo · Correction", narrative: "Corrected authored narrative.",
  correctionOfIssuedRecordID: completed.issuedRecord.id,
  definitionHash: "definition-hash-1", inputSetHash: "input-hash-1",
  currentDependencyHash: "dependency-1", preparedAt: "2026-08-03T14:00:00.000Z"
});
workspace = correction.workspace;
workspace = markCodeMemoReady(workspace, correction.draft.id, ready, { actor }).workspace;
workspace = approveCodeMemo(workspace, correction.draft.id, { actor, basis: "Correction reviewed." }).workspace;
const correctionPending = beginCodeMemoIssuance(workspace, correction.draft.id, ready, { actor, idempotencyKey: "issue-key-2" });
workspace = correctionPending.workspace;
const corrected = completeCodeMemoIssuance(workspace, correctionPending.pending.id, {
  id: "issued-2", manifestID: "manifest-2", displayID: "Q-001",
  questionTitle: definition.title, supersessionReason: "Corrected authored narrative."
});
workspace = corrected.workspace;
assert.equal(corrected.issuedRecord.issueVersion, 2);
assert.equal(corrected.issuedRecord.predecessorID, "issued-1");
assert.deepEqual(issuedRecordStatus(workspace, "issued-1"), {
  state: "superseded", successorID: "issued-2", reason: "Corrected authored narrative."
});
assert.equal(completed.issuedRecord.status, "issued", "Supersession lineage must not mutate the prior immutable wrapper.");

console.log("code-question-issue-contract: all assertions passed");
