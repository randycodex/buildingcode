import assert from "node:assert/strict";
import {
  latestReviewThreadUpdatedAt,
  normalizeProjectNotePayload,
  normalizeReviewCommentPayload,
  normalizeReviewThreadPayload,
  projectReviewKinds,
  projectReviewStatuses,
  projectReviewTargetKinds
} from "../collaboration-contract.mjs";

const createdAt = "2026-07-25T12:00:00.000Z";
const responseCreatedAt = "2026-07-25T13:00:00.000Z";

assert.equal(
  latestReviewThreadUpdatedAt(createdAt, [{ createdAt: responseCreatedAt }]),
  responseCreatedAt,
  "A response must advance the displayed Coordination thread update date."
);
assert.equal(latestReviewThreadUpdatedAt(responseCreatedAt, [{ createdAt }]), responseCreatedAt);

const note = normalizeProjectNotePayload({
  projectID: "project-1",
  title: "Filing coordination",
  body: "Confirm the filing sequence with the applicant.",
  createdByUserID: "editor-1",
  createdByDisplayName: "Alex Editor"
});
assert.equal(note.updatedByUserID, "editor-1");
assert.equal(note.schemaVersion, 2);
assert.equal(note.createdByDisplayName, "Alex Editor");

const structuredNote = normalizeProjectNotePayload({
  projectID: "project-1",
  document: {
    schema: "permitext-notebook-card",
    schemaVersion: 2,
    format: "blocknote-json",
    document: [{
      type: "paragraph",
      content: [{ type: "text", text: "One shared Project note.", styles: {} }]
    }, {
      type: "image",
      props: { url: "permitext-notebook-asset:11111111-1111-4111-8111-111111111111" }
    }]
  },
  createdByUserID: "editor-1"
});
assert.equal(structuredNote.title, "Project information");
assert.equal(structuredNote.body, "One shared Project note.\n\nImage");
assert.equal(structuredNote.document.format, "blocknote-json");
assert.deepEqual(structuredNote.imageAssets, ["11111111-1111-4111-8111-111111111111"]);

const request = normalizeReviewThreadPayload({
  projectID: "project-1",
  kind: "missing-project-fact",
  targetKind: "researchAnswer",
  targetID: "answer-1",
  title: "Confirm occupancy group",
  body: "The Research answer identifies this as a missing fact.",
  createdByUserID: "reviewer-1"
});
assert.equal(request.status, "open");
assert.equal(request.resolvedAt, null);
assert.equal(request.assigneeUserID, null);
assert.equal(request.linkedItemSnapshot, null);

const resolved = normalizeReviewThreadPayload({
  ...request,
  status: "resolved",
  resolvedByUserID: "reviewer-1",
  resolvedAt: createdAt,
  resolution: "Occupancy group B was confirmed from the approved drawings."
});
assert.equal(resolved.resolvedAt, createdAt);
assert.equal(resolved.resolvedByUserID, "reviewer-1");
assert.match(resolved.resolution, /confirmed/);

const waiting = normalizeReviewThreadPayload({
  ...request,
  status: "waiting",
  assigneeUserID: "editor-1",
  linkedItemSnapshot: {
    label: "Research answer: Egress review",
    description: "Research conclusion based on selected evidence.",
    updatedAt: createdAt
  }
});
assert.equal(waiting.status, "waiting");
assert.equal(waiting.assigneeUserID, "editor-1");
assert.equal(waiting.resolvedAt, null);
assert.equal(waiting.resolvedByUserID, null);
assert.equal(waiting.linkedItemSnapshot.label, "Research answer: Egress review");

const legacyDismissed = normalizeReviewThreadPayload({
  ...request,
  status: "dismissed",
  resolvedByUserID: "reviewer-1",
  resolvedAt: createdAt
});
assert.equal(legacyDismissed.status, "dismissed");
assert.equal(legacyDismissed.resolution, null);

const legacyResolved = normalizeReviewThreadPayload({
  ...request,
  status: "resolved",
  resolvedByUserID: "reviewer-1",
  resolvedAt: createdAt,
  assigneeUserID: "inactive-historical-member",
  allowLegacyResolvedWithoutResolution: true
});
assert.equal(legacyResolved.status, "resolved");
assert.equal(legacyResolved.resolution, null);
assert.equal(legacyResolved.assigneeUserID, "inactive-historical-member");

const comment = normalizeReviewCommentPayload({
  projectID: "project-1",
  threadID: "thread-1",
  body: "Occupancy group B confirmed from the approved drawings.",
  createdByUserID: "editor-1",
  createdByDisplayName: "Alex Editor",
  createdAt
});
assert.equal(comment.createdAt, createdAt);
assert.equal(comment.createdByDisplayName, "Alex Editor");

assert.deepEqual(projectReviewKinds, [
  "general-review",
  "revision-request",
  "missing-project-fact"
]);
assert.deepEqual(projectReviewStatuses, ["open", "waiting", "resolved", "dismissed"]);
assert.equal(projectReviewTargetKinds.includes("notebookCard"), true);
assert.throws(
  () => normalizeReviewThreadPayload({
    ...request,
    kind: "automatic-approval"
  }),
  /Invalid review kind/
);
assert.throws(
  () => normalizeReviewThreadPayload({
    ...request,
    status: "resolved",
    resolvedByUserID: "reviewer-1",
    resolvedAt: createdAt
  }),
  /resolution statement/
);
assert.throws(
  () => normalizeReviewThreadPayload({
    ...request,
    linkedItemSnapshot: ["untrusted", "shape"]
  }),
  /linked item snapshot/
);
assert.throws(
  () => normalizeReviewCommentPayload({
    projectID: "project-1",
    threadID: "thread-1",
    body: " ",
    createdByUserID: "editor-1"
  }),
  /Invalid review comment/
);

console.log("Permitext collaboration contract passed.");
