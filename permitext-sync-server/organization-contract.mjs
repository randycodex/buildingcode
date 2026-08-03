import { createHash, randomBytes, randomUUID } from "node:crypto";
import { normalizeFirmControls } from "./firm-controls-contract.mjs";

export const organizationSchemaVersion = 2;

export const organizationRoles = Object.freeze([
  "owner",
  "editor",
  "reviewer",
  "viewer"
]);

export const organizationMembershipStatuses = Object.freeze([
  "active",
  "deactivated"
]);

export const organizationInvitationStatuses = Object.freeze([
  "pending",
  "accepted",
  "revoked",
  "expired"
]);

export const evidenceReviewStatuses = Object.freeze([
  "proposed",
  "approved",
  "changes-requested"
]);

export const organizationPermissions = Object.freeze({
  organizationView: "organization.view",
  organizationManage: "organization.manage",
  organizationBilling: "organization.billing",
  memberInvite: "member.invite",
  memberManage: "member.manage",
  seatManage: "seat.manage",
  projectView: "project.view",
  projectEdit: "project.edit",
  projectReview: "project.review",
  projectNoteEdit: "project.note.edit",
  projectReviewComment: "project.review.comment",
  projectReviewRequest: "project.review.request",
  projectReviewResolve: "project.review.resolve",
  projectTransfer: "project.transfer",
  evidencePropose: "evidence.propose",
  evidenceReview: "evidence.review",
  reportDownload: "report.download",
  /** Code Question workspace permissions (Phase 1). */
  codeQuestionEdit: "code-question.edit",
  codeQuestionEvidencePropose: "code-question.evidence.propose",
  codeQuestionEvidenceApprove: "code-question.evidence.approve",
  codeQuestionAnalyze: "code-question.analyze",
  codeQuestionConclusionDraft: "code-question.conclusion.draft",
  codeQuestionConclusionApprove: "code-question.conclusion.approve",
  codeQuestionReview: "code-question.review",
  codeQuestionIssue: "code-question.issue",
  codeQuestionSupersede: "code-question.supersede"
});

export const organizationRolePermissions = Object.freeze({
  owner: Object.freeze(Object.values(organizationPermissions)),
  editor: Object.freeze([
    organizationPermissions.organizationView,
    organizationPermissions.projectView,
    organizationPermissions.projectEdit,
    organizationPermissions.projectNoteEdit,
    organizationPermissions.projectReviewComment,
    organizationPermissions.projectReviewRequest,
    organizationPermissions.evidencePropose,
    organizationPermissions.reportDownload,
    organizationPermissions.codeQuestionEdit,
    organizationPermissions.codeQuestionEvidencePropose,
    organizationPermissions.codeQuestionAnalyze,
    organizationPermissions.codeQuestionConclusionDraft,
    organizationPermissions.codeQuestionReview
  ]),
  reviewer: Object.freeze([
    organizationPermissions.organizationView,
    organizationPermissions.projectView,
    organizationPermissions.projectReview,
    organizationPermissions.projectReviewComment,
    organizationPermissions.projectReviewRequest,
    organizationPermissions.projectReviewResolve,
    organizationPermissions.evidenceReview,
    organizationPermissions.reportDownload,
    organizationPermissions.codeQuestionEvidenceApprove,
    organizationPermissions.codeQuestionConclusionApprove,
    organizationPermissions.codeQuestionReview
  ]),
  viewer: Object.freeze([
    organizationPermissions.organizationView,
    organizationPermissions.projectView,
    organizationPermissions.reportDownload
  ])
});

const roleSet = new Set(organizationRoles);
const membershipStatusSet = new Set(organizationMembershipStatuses);
const invitationStatusSet = new Set(organizationInvitationStatuses);
const evidenceReviewStatusSet = new Set(evidenceReviewStatuses);

function requiredText(value, field, maximum = 512) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${field}.`);
  }
  return normalized;
}

function optionalText(value, maximum = 512) {
  const normalized = String(value || "").trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function normalizedRole(value, options = {}) {
  const role = requiredText(value, "organization role", 32).toLowerCase();
  if (!roleSet.has(role) || (options.invitation && role === "owner")) {
    throw new Error("Invalid organization role.");
  }
  return role;
}

function normalizedMembershipStatus(value) {
  const status = requiredText(value, "membership status", 32).toLowerCase();
  if (!membershipStatusSet.has(status)) throw new Error("Invalid membership status.");
  return status;
}

function normalizedInvitationStatus(value) {
  const status = requiredText(value, "invitation status", 32).toLowerCase();
  if (!invitationStatusSet.has(status)) throw new Error("Invalid invitation status.");
  return status;
}

function optionalISO(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${field}.`);
  return new Date(timestamp).toISOString();
}

function requiredISO(value, field) {
  const normalized = optionalISO(value, field);
  if (!normalized) throw new Error(`Invalid ${field}.`);
  return normalized;
}

function boundedSeatLimit(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > 10_000) {
    throw new Error("Invalid organization seat limit.");
  }
  return normalized;
}

export function organizationSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug) throw new Error("Invalid organization slug.");
  return slug;
}

export function organizationMembershipID(organizationID, userID) {
  return `organization-member-${createHash("sha256")
    .update(`${requiredText(organizationID, "organization ID", 256)}\u001f${requiredText(userID, "user ID", 256)}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export function projectMembershipID(projectID, userID) {
  return `project-member-${createHash("sha256")
    .update(`${requiredText(projectID, "project ID", 256)}\u001f${requiredText(userID, "user ID", 256)}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export function invitationToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: invitationTokenHash(token)
  };
}

export function invitationTokenHash(token) {
  return createHash("sha256")
    .update(requiredText(token, "invitation token", 1_024))
    .digest("hex");
}

export function organizationRecord({
  id = randomUUID(),
  name,
  slug,
  ownerUserID,
  status = "active",
  capabilities = {},
  billingIdentity = {},
  firmControls = null,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt
}) {
  const normalizedStatus = requiredText(status, "organization status", 32).toLowerCase();
  if (!["active", "suspended", "closed"].includes(normalizedStatus)) {
    throw new Error("Invalid organization status.");
  }
  const seatLimit = boundedSeatLimit(billingIdentity.seatLimit ?? 5);
  return {
    id: requiredText(id, "organization ID", 256),
    schemaVersion: organizationSchemaVersion,
    name: requiredText(name, "organization name", 160),
    slug: organizationSlug(slug || name),
    ownerUserID: requiredText(ownerUserID, "organization owner user ID", 256),
    status: normalizedStatus,
    capabilities: {
      collaboration: capabilities.collaboration !== false,
      organizationAdministration: capabilities.organizationAdministration !== false,
      authoredCollaboration: capabilities.authoredCollaboration === true,
      sharedEvidenceReview: capabilities.sharedEvidenceReview === true,
      sharedWorkboardEditing: capabilities.sharedWorkboardEditing === true
    },
    billingIdentity: {
      mode: optionalText(billingIdentity.mode, 64) || "beta",
      status: optionalText(billingIdentity.status, 64) || "trial",
      seatLimit,
      customerID: optionalText(billingIdentity.customerID, 256),
      subscriptionID: optionalText(billingIdentity.subscriptionID, 256)
    },
    firmControls: normalizeFirmControls(firmControls, {
      organizationName: name,
      ownerUserID,
      createdAt,
      updatedAt: firmControls?.updatedAt || createdAt,
      updatedByUserID: firmControls?.updatedByUserID || ownerUserID,
      version: firmControls?.version || 1
    }),
    createdAt: requiredISO(createdAt, "organization creation date"),
    updatedAt: requiredISO(updatedAt, "organization update date")
  };
}

export function organizationMembershipRecord({
  id,
  organizationID,
  userID,
  role,
  status = "active",
  invitedByUserID = null,
  invitationID = null,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  deactivatedAt = null
}) {
  const normalizedOrganizationID = requiredText(organizationID, "organization ID", 256);
  const normalizedUserID = requiredText(userID, "member user ID", 256);
  const normalizedStatus = normalizedMembershipStatus(status);
  return {
    id: id
      ? requiredText(id, "organization membership ID", 256)
      : organizationMembershipID(normalizedOrganizationID, normalizedUserID),
    schemaVersion: organizationSchemaVersion,
    organizationID: normalizedOrganizationID,
    userID: normalizedUserID,
    role: normalizedRole(role),
    status: normalizedStatus,
    invitedByUserID: optionalText(invitedByUserID, 256),
    invitationID: optionalText(invitationID, 256),
    createdAt: requiredISO(createdAt, "membership creation date"),
    updatedAt: requiredISO(updatedAt, "membership update date"),
    deactivatedAt: normalizedStatus === "deactivated"
      ? requiredISO(deactivatedAt || updatedAt, "membership deactivation date")
      : null
  };
}

export function organizationInvitationRecord({
  id = randomUUID(),
  organizationID,
  projectID = null,
  invitedEmail = null,
  invitedUserID = null,
  role = "viewer",
  tokenHash,
  invitedByUserID,
  status = "pending",
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
  acceptedAt = null,
  acceptedByUserID = null
}) {
  const normalizedEmail = optionalText(invitedEmail, 320)?.toLowerCase() || null;
  const normalizedInvitedUserID = optionalText(invitedUserID, 256);
  if (!normalizedEmail && !normalizedInvitedUserID) {
    throw new Error("Invitation requires an email or Permitext user.");
  }
  const normalizedStatus = normalizedInvitationStatus(status);
  const normalizedExpiresAt = requiredISO(expiresAt, "invitation expiration date");
  return {
    id: requiredText(id, "organization invitation ID", 256),
    schemaVersion: organizationSchemaVersion,
    organizationID: requiredText(organizationID, "organization ID", 256),
    projectID: optionalText(projectID, 256),
    invitedEmail: normalizedEmail,
    invitedUserID: normalizedInvitedUserID,
    role: normalizedRole(role, { invitation: true }),
    tokenHash: requiredText(tokenHash, "invitation token hash", 128),
    invitedByUserID: requiredText(invitedByUserID, "inviting user ID", 256),
    status: normalizedStatus,
    createdAt: requiredISO(createdAt, "invitation creation date"),
    updatedAt: requiredISO(updatedAt, "invitation update date"),
    expiresAt: normalizedExpiresAt,
    acceptedAt: optionalISO(acceptedAt, "invitation acceptance date"),
    acceptedByUserID: optionalText(acceptedByUserID, 256)
  };
}

export function projectOwnershipRecord({
  projectID,
  owner,
  storageOwnerUserID,
  originalOwnerUserID = storageOwnerUserID,
  transferredByUserID = null,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt
}) {
  if (!owner || !["user", "organization"].includes(owner.kind)) {
    throw new Error("Invalid Project owner.");
  }
  return {
    projectID: requiredText(projectID, "project ID", 256),
    schemaVersion: organizationSchemaVersion,
    owner: {
      kind: owner.kind,
      id: requiredText(owner.id, "Project owner ID", 256),
      organizationID: owner.kind === "organization"
        ? requiredText(owner.organizationID || owner.id, "Project organization ID", 256)
        : null
    },
    storageOwnerUserID: requiredText(storageOwnerUserID, "Project storage owner user ID", 256),
    originalOwnerUserID: requiredText(originalOwnerUserID, "Project original owner user ID", 256),
    transferredByUserID: optionalText(transferredByUserID, 256),
    createdAt: requiredISO(createdAt, "Project ownership creation date"),
    updatedAt: requiredISO(updatedAt, "Project ownership update date")
  };
}

export function projectMembershipRecord({
  id,
  organizationID,
  projectID,
  userID,
  role,
  status = "active",
  invitedByUserID = null,
  invitationID = null,
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  deactivatedAt = null
}) {
  const normalizedProjectID = requiredText(projectID, "project ID", 256);
  const normalizedUserID = requiredText(userID, "Project member user ID", 256);
  const normalizedStatus = normalizedMembershipStatus(status);
  return {
    id: id
      ? requiredText(id, "Project membership ID", 256)
      : projectMembershipID(normalizedProjectID, normalizedUserID),
    schemaVersion: organizationSchemaVersion,
    organizationID: requiredText(organizationID, "organization ID", 256),
    projectID: normalizedProjectID,
    userID: normalizedUserID,
    role: normalizedRole(role),
    status: normalizedStatus,
    invitedByUserID: optionalText(invitedByUserID, 256),
    invitationID: optionalText(invitationID, 256),
    createdAt: requiredISO(createdAt, "Project membership creation date"),
    updatedAt: requiredISO(updatedAt, "Project membership update date"),
    deactivatedAt: normalizedStatus === "deactivated"
      ? requiredISO(deactivatedAt || updatedAt, "Project membership deactivation date")
      : null
  };
}

export function evidenceReviewPayload({
  projectID,
  answerID,
  evidenceSnapshotIDs,
  status = "proposed",
  note = "",
  createdByUserID,
  updatedByUserID = createdByUserID,
  reviewedByUserID = null,
  reviewedAt = null
}) {
  const normalizedStatus = requiredText(status, "evidence review status", 64).toLowerCase();
  if (!evidenceReviewStatusSet.has(normalizedStatus)) {
    throw new Error("Invalid evidence review status.");
  }
  const normalizedSnapshotIDs = Array.from(new Set(
    (Array.isArray(evidenceSnapshotIDs) ? evidenceSnapshotIDs : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
  if (!normalizedSnapshotIDs.length || normalizedSnapshotIDs.length > 250) {
    throw new Error("Evidence review requires between 1 and 250 evidence snapshots.");
  }
  const normalizedNote = String(note || "").trim();
  if (normalizedNote.length > 4_000) {
    throw new Error("Evidence review notes are limited to 4,000 characters.");
  }
  const requiresReviewer = normalizedStatus !== "proposed";
  return {
    schemaVersion: organizationSchemaVersion,
    projectID: requiredText(projectID, "Project ID", 256),
    answerID: requiredText(answerID, "Research answer ID", 256),
    evidenceSnapshotIDs: normalizedSnapshotIDs,
    status: normalizedStatus,
    note: normalizedNote,
    createdByUserID: requiredText(createdByUserID, "evidence review creator", 256),
    updatedByUserID: requiredText(updatedByUserID, "evidence review updater", 256),
    reviewedByUserID: requiresReviewer
      ? requiredText(reviewedByUserID, "evidence reviewer", 256)
      : optionalText(reviewedByUserID, 256),
    reviewedAt: requiresReviewer
      ? requiredISO(reviewedAt, "evidence review date")
      : optionalISO(reviewedAt, "evidence review date")
  };
}

export function roleAllows(role, permission) {
  const normalized = String(role || "").trim().toLowerCase();
  return (organizationRolePermissions[normalized] || []).includes(permission);
}

export function organizationSeatUsage(memberships, invitations, now = Date.now()) {
  const activeUsers = new Set((memberships || [])
    .filter((membership) => membership.status === "active")
    .map((membership) => membership.userID));
  const pendingInvitees = new Set((invitations || [])
    .filter((invitation) =>
      invitation.status === "pending" &&
      Date.parse(invitation.expiresAt || "") > now
    )
    .filter((invitation) =>
      !invitation.invitedUserID || !activeUsers.has(invitation.invitedUserID)
    )
    .map((invitation) =>
      invitation.invitedUserID
        ? `user:${invitation.invitedUserID}`
        : `email:${String(invitation.invitedEmail || "").toLowerCase()}`
    ));
  return {
    active: activeUsers.size,
    pending: pendingInvitees.size,
    used: activeUsers.size + pendingInvitees.size
  };
}

export function invitationState(invitation, now = Date.now()) {
  if (!invitation) return "missing";
  if (invitation.status !== "pending") return invitation.status;
  return Date.parse(invitation.expiresAt || "") <= now ? "expired" : "pending";
}
