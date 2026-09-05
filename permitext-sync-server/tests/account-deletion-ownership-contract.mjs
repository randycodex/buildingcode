import assert from "node:assert/strict";
import { accountRecordExportFromStore, accountRestoreChecklist } from "../account-data-export.mjs";

const A = "synthetic:storage-account", B = "synthetic:organization-owner";
const store = {
  users: { [A]: { appUserID: A }, [B]: { appUserID: B } },
  organizations: { firm: { id: "firm", ownerUserID: B } },
  projectOwnerships: { project: { projectID: "project", storageOwnerUserID: A,
    owner: { kind: "user", id: A } } },
  foundationArtifactsByUserID: { [A]: [{ envelope: { id: "note", type: "notebookCard", owner: { kind: "user", id: A } },
    payload: { projectID: "project", title: "organization", text: "A narrative reference is not an ownership record." } }] }
};
const exported = () => accountRecordExportFromStore(store, A);
assert.equal(exported().deletionOwnershipReview.required, false);
assert.equal(accountRecordExportFromStore(store, B).records.projectOwnerships.length, 0);

store.projectOwnerships.project.owner = { kind: "organization", id: "firm", organizationID: "firm" };
for (const userID of [A, B]) {
  const result = accountRecordExportFromStore(store, userID);
  assert.equal(result.records.projectOwnerships.length, 1);
  assert.deepEqual(result.deletionOwnershipReview, { required: true, projectCount: 1, organizationCount: 1, sharedRecordCount: 1, dependentOrganizationCount: 0 });
  assert.deepEqual(accountRestoreChecklist(result).deletionOwnershipReview, result.deletionOwnershipReview);
  assert.equal(result.scope.sharedContentReviewRequired, true);
  assert.equal(result.scope.otherMembersContentIncluded, null);
}
store.projectOwnerships.project.owner = { kind: "user", id: B };
assert.equal(exported().deletionOwnershipReview.required, true, "Logical ownership and storage attribution must agree before deletion.");

// Incomplete legacy registries must not hide an explicit organization scope on
// the retained artifact itself, even when it has no Project ID or is tombstoned.
delete store.projectOwnerships.project;
const artifact = store.foundationArtifactsByUserID[A][0];
artifact.envelope.owner = { kind: "organization", id: "firm" };
artifact.envelope.deletedAt = "2000-01-01T00:00:00Z";
delete artifact.payload.projectID;
assert.deepEqual(exported().deletionOwnershipReview, { required: true, projectCount: 0, organizationCount: 1, sharedRecordCount: 1, dependentOrganizationCount: 0 });
assert.equal(accountRecordExportFromStore(store, B).deletionOwnershipReview.required, true, "The organization owner must preserve shared artifacts stored under another account, even without a Project registry.");
delete store.foundationArtifactsByUserID[A];
store.projectLinksByUserID = { [A]: [{ projectID: "project", owner: { kind: "organization", id: "firm" } }] };
assert.equal(exported().deletionOwnershipReview.required, true, "Retained link ownership is also a shared-data boundary.");
delete store.projectLinksByUserID;
store.organizationMembershipsByOrganizationID = { firm: [{ userID: B }, { userID: A, status: "deactivated" }] };
assert.equal(accountRecordExportFromStore(store, B).deletionOwnershipReview.required, true, "An owner must not silently remove another account's retained membership history.");
console.log("Account deletion ownership passed: personal data, organization-owner inventory, foreign ownership, and incomplete/tombstoned shared records.");
