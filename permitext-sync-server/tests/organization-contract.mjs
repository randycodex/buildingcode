import assert from "node:assert/strict";
import {
  evidenceReviewPayload,
  invitationState,
  invitationToken,
  organizationInvitationRecord,
  organizationMembershipRecord,
  organizationPermissions,
  organizationRecord,
  organizationSeatUsage,
  projectMembershipRecord,
  projectOwnershipRecord,
  roleAllows
} from "../organization-contract.mjs";

const createdAt = "2026-07-24T12:00:00.000Z";
const organization = organizationRecord({
  id: "organization-1",
  name: "Permit Studio PLLC",
  ownerUserID: "apple:owner",
  createdAt
});
assert.equal(organization.slug, "permit-studio-pllc");
assert.equal(organization.billingIdentity.seatLimit, 5);
assert.equal(organization.capabilities.collaboration, true);

const owner = organizationMembershipRecord({
  organizationID: organization.id,
  userID: "apple:owner",
  role: "owner",
  createdAt
});
const viewer = organizationMembershipRecord({
  organizationID: organization.id,
  userID: "apple:viewer",
  role: "viewer",
  invitedByUserID: owner.userID,
  createdAt
});
assert.equal(roleAllows(owner.role, organizationPermissions.organizationManage), true);
assert.equal(roleAllows(viewer.role, organizationPermissions.projectView), true);
assert.equal(roleAllows(viewer.role, organizationPermissions.projectEdit), false);
assert.equal(roleAllows("editor", organizationPermissions.projectNoteEdit), true);
assert.equal(roleAllows("editor", organizationPermissions.projectReviewComment), true);
assert.equal(roleAllows("editor", organizationPermissions.projectReviewRequest), true);
assert.equal(roleAllows("reviewer", organizationPermissions.projectReviewRequest), true);
assert.equal(roleAllows("reviewer", organizationPermissions.projectReviewResolve), true);
assert.equal(roleAllows("viewer", organizationPermissions.projectReviewComment), false);
assert.equal(roleAllows("owner", organizationPermissions.codeQuestionIssue), true);
assert.equal(roleAllows("editor", organizationPermissions.codeQuestionEdit), true);
assert.equal(roleAllows("editor", organizationPermissions.codeQuestionIssue), false);
assert.equal(roleAllows("reviewer", organizationPermissions.codeQuestionEvidenceApprove), true);
assert.equal(roleAllows("viewer", organizationPermissions.codeQuestionEdit), false);

const credentials = invitationToken();
const invitation = organizationInvitationRecord({
  id: "invitation-1",
  organizationID: organization.id,
  projectID: "project-1",
  invitedEmail: "VIEWER@example.com",
  role: "viewer",
  tokenHash: credentials.tokenHash,
  invitedByUserID: owner.userID,
  createdAt,
  expiresAt: "2026-07-31T12:00:00.000Z"
});
assert.equal(invitation.invitedEmail, "viewer@example.com");
assert.equal(invitationState(invitation, Date.parse(createdAt)), "pending");
assert.equal(invitationState(invitation, Date.parse("2026-08-01T00:00:00.000Z")), "expired");
assert.throws(() => organizationInvitationRecord({
  organizationID: organization.id,
  invitedEmail: "owner@example.com",
  role: "owner",
  tokenHash: credentials.tokenHash,
  invitedByUserID: owner.userID
}), /Invalid organization role/);

const projectOwner = projectOwnershipRecord({
  projectID: "project-1",
  owner: {
    kind: "organization",
    id: organization.id,
    organizationID: organization.id
  },
  storageOwnerUserID: owner.userID,
  transferredByUserID: owner.userID,
  createdAt
});
assert.equal(projectOwner.owner.organizationID, organization.id);
assert.equal(projectOwner.storageOwnerUserID, owner.userID);

const projectViewer = projectMembershipRecord({
  organizationID: organization.id,
  projectID: projectOwner.projectID,
  userID: viewer.userID,
  role: viewer.role,
  invitedByUserID: owner.userID,
  invitationID: invitation.id,
  createdAt
});
assert.equal(projectViewer.role, "viewer");

const seats = organizationSeatUsage(
  [owner, viewer],
  [invitation, {
    ...invitation,
    id: "invitation-2",
    invitedEmail: "expired@example.com",
    expiresAt: "2026-07-23T12:00:00.000Z"
  }],
  Date.parse(createdAt)
);
assert.deepEqual(seats, { active: 2, pending: 1, used: 3 });
assert.deepEqual(organizationSeatUsage(
  [owner, viewer],
  [{
    ...invitation,
    invitedUserID: viewer.userID,
    invitedEmail: null
  }],
  Date.parse(createdAt)
), { active: 2, pending: 0, used: 2 });

const review = evidenceReviewPayload({
  projectID: "project-1",
  answerID: "answer-1",
  evidenceSnapshotIDs: ["snapshot-1", "snapshot-1", "snapshot-2"],
  status: "approved",
  note: "Reviewed against the selected enacted text.",
  createdByUserID: viewer.userID,
  updatedByUserID: owner.userID,
  reviewedByUserID: owner.userID,
  reviewedAt: createdAt
});
assert.deepEqual(review.evidenceSnapshotIDs, ["snapshot-1", "snapshot-2"]);
assert.equal(review.reviewedByUserID, owner.userID);
assert.throws(() => evidenceReviewPayload({
  projectID: "project-1",
  answerID: "answer-1",
  evidenceSnapshotIDs: ["snapshot-1"],
  status: "approved",
  createdByUserID: viewer.userID
}), /reviewer/);

console.log("Permitext organization contract passed.");
