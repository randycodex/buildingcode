import assert from "node:assert/strict";
import {
  adaptLegacyReviewThread, appendReviewComment, approveProfessionalConclusion,
  createReviewRequest, emptyReviewWorkspace, transitionReviewRequest,
  unresolvedBlockingRequests
} from "../public/code-question-review.js";
import { normalizeReviewThreadPayload, reviewThreadForClient } from "../collaboration-contract.mjs";
import {
  assertCodeQuestionPermission, blockingReviewRequestIDs,
  createConclusionApprovalArtifact, permissionForCommand
} from "../code-question-commands.mjs";

const questionID = "question-review-1";
const reviewer = { userID: "reviewer-1", displayName: "Riley Reviewer" };
const editor = { userID: "editor-1", displayName: "Evan Editor" };
const conclusion = { id: "conclusion-review-1", immutable: true, questionID, revision: 1, analysisDependencyHash: "a".repeat(64) };

let workspace = emptyReviewWorkspace(questionID);
const opened = createReviewRequest(workspace, {
  id: "request-1", questionID, requestType: "interpretation-review",
  targetKind: "professionalConclusion", targetID: conclusion.id,
  targetLabel: "Professional Conclusion r1",
  targetAnchor: { anchorKind: "conclusion-revision", anchorID: conclusion.id, label: "Conclusion r1", snapshotHash: conclusion.analysisDependencyHash },
  blocking: true, title: "Confirm exception interpretation",
  body: "Review the conclusion against approved evidence.", actor: reviewer,
  createdAt: "2026-08-03T12:00:00.000Z"
});
workspace = opened.workspace;
assert.equal(opened.request.kind, "general-review");
assert.equal(opened.request.reviewRound, 1);
assert.equal(unresolvedBlockingRequests(workspace).length, 1);

const originalRequest = structuredClone(workspace.requests[0]);
const commented = appendReviewComment(workspace, "request-1", {
  id: "comment-1", body: "The exception applies only if the stated Project fact is confirmed.",
  actor: editor, createdAt: "2026-08-03T12:10:00.000Z"
});
workspace = commented.workspace;
assert.equal(commented.comment.immutable, true);
assert.deepEqual(workspace.requests[0], originalRequest, "Comments must not mutate the request.");
assert.throws(() => approveProfessionalConclusion(workspace, conclusion, { basis: "Reviewed.", actor: reviewer }), /Resolve all blocking/);

workspace = transitionReviewRequest(workspace, "request-1", "waiting", { actor: reviewer, updatedAt: "2026-08-03T12:20:00.000Z" }).workspace;
assert.equal(workspace.history.at(-1).from, "open");
workspace = transitionReviewRequest(workspace, "request-1", "resolved", {
  resolution: "Applicability confirmed against the approved evidence and stated fact.",
  actor: reviewer, updatedAt: "2026-08-03T12:30:00.000Z"
}).workspace;
assert.equal(unresolvedBlockingRequests(workspace).length, 0);
assert.throws(() => appendReviewComment(workspace, "request-1", { body: "Late edit", actor: editor }), /cannot receive comments/i);

const approved = approveProfessionalConclusion(workspace, conclusion, {
  id: "approval-1", basis: "Conclusion r1 reviewed; no blocking requests remain.",
  actor: reviewer, approvedAt: "2026-08-03T12:35:00.000Z"
});
workspace = approved.workspace;
assert.equal(approved.approval.conclusionID, conclusion.id);
assert.equal(workspace.requests[0].status, "resolved", "Approval must be separate from request resolution.");

workspace = transitionReviewRequest(workspace, "request-1", "open", { actor: reviewer, updatedAt: "2026-08-03T13:00:00.000Z" }).workspace;
assert.equal(workspace.requests[0].reviewRound, 2);
assert.equal(workspace.approvals.length, 1, "Reopen must preserve prior approval history.");
assert.equal(workspace.history.at(-1).action, "code-question.review.reopened");

const legacy = adaptLegacyReviewThread({
  id: "legacy-1", kind: "missing-project-fact", status: "open",
  targetKind: "codeQuestion", targetID: questionID, title: "Legacy fact request"
}, questionID);
assert.equal(legacy.requestType, "fact-request");
assert.equal(legacy.reviewRound, 1);
assert.equal(reviewThreadForClient({ kind: "revision-request", status: "open" }).requestType, "revision-request");

const shared = normalizeReviewThreadPayload({
  projectID: "project-1", requestType: "evidence-review",
  targetKind: "questionEvidenceSet", targetID: "set-1", questionID,
  blocking: true,
  targetAnchor: { anchorKind: "evidence-set", anchorID: "set-1", snapshotHash: "b".repeat(64) },
  title: "Review approved evidence", body: "Confirm the governing passage set.",
  createdByUserID: reviewer.userID
});
assert.equal(shared.kind, "general-review");
assert.equal(shared.blocking, true);
assert.equal(shared.targetAnchor.anchorID, "set-1");
assert.throws(() => normalizeReviewThreadPayload({
  projectID: "project-1", requestType: "evidence-review",
  targetKind: "questionEvidenceSet", targetID: "set-1",
  targetAnchor: { anchorKind: "evidence-set" }, title: "Invalid anchor",
  createdByUserID: reviewer.userID
}), /anchor ID/);

assert.equal(permissionForCommand("codeQuestion.conclusion.approve"), "code-question.conclusion.approve");
assert.doesNotThrow(() => assertCodeQuestionPermission("reviewer", permissionForCommand("codeQuestion.conclusion.approve")));
assert.throws(() => assertCodeQuestionPermission("viewer", permissionForCommand("codeQuestion.conclusion.approve")), /Permission denied/);
const approvalArtifact = createConclusionApprovalArtifact({
  userID: reviewer.userID, questionID, conclusionID: conclusion.id,
  conclusionRevision: 1, dependencyHash: conclusion.analysisDependencyHash,
  reviewRound: 1, approvalBasis: "Reviewed and approved.",
  id: "approval-artifact-1", approvedAt: "2026-08-03T12:35:00.000Z"
});
assert.equal(approvalArtifact.envelope.type, "conclusionApproval");
assert.equal(approvalArtifact.payload.approvedByUserID, reviewer.userID);

const serverArtifacts = [
  { envelope: { id: "server-open", type: "reviewThread" }, payload: { questionID, blocking: true, status: "open" } },
  { envelope: { id: "server-waiting", type: "reviewThread" }, payload: { questionID, blocking: true, status: "waiting" } },
  { envelope: { id: "server-resolved", type: "reviewThread" }, payload: { questionID, blocking: true, status: "resolved" } },
  { envelope: { id: "other-question", type: "reviewThread" }, payload: { questionID: "question-2", blocking: true, status: "open" } }
];
assert.deepEqual(
  blockingReviewRequestIDs(serverArtifacts, questionID),
  ["server-open", "server-waiting"],
  "Server approval and issuance gates must share exact unresolved-blocker detection."
);

console.log("code-question-review-contract: all assertions passed");
