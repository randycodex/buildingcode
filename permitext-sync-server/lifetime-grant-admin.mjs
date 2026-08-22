import { createHash } from "node:crypto";
import { createClerkClient } from "@clerk/backend";

export class LifetimeGrantAdminError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "LifetimeGrantAdminError";
    this.statusCode = statusCode;
  }
}

export function normalizedLifetimeGrantEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

export function maskedLifetimeGrantEmail(value) {
  const email = normalizedLifetimeGrantEmail(value);
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return null;
  return `${email.slice(0, Math.min(2, atIndex))}***${email.slice(atIndex)}`;
}

export function lifetimeGrantEmailHash(value) {
  const email = normalizedLifetimeGrantEmail(value);
  return email ? createHash("sha256").update(email).digest("hex") : null;
}

function userEmailAddresses(user) {
  return Array.isArray(user?.emailAddresses)
    ? user.emailAddresses
        .filter((item) => item?.verification?.status === "verified")
        .map((item) => normalizedLifetimeGrantEmail(item?.emailAddress))
        .filter(Boolean)
    : [];
}

export function exactClerkUserForEmail(users, email) {
  const normalizedEmail = normalizedLifetimeGrantEmail(email);
  if (!normalizedEmail) {
    throw new LifetimeGrantAdminError(400, "Enter a valid email address.");
  }
  const exact = (Array.isArray(users) ? users : []).filter((user) =>
    userEmailAddresses(user).includes(normalizedEmail)
  );
  if (exact.length === 0) {
    throw new LifetimeGrantAdminError(404, "No Permitext sign-in account uses that exact email address.");
  }
  if (exact.length > 1) {
    throw new LifetimeGrantAdminError(409, "More than one identity uses that email. Resolve it in Clerk before changing access.");
  }
  return exact[0];
}

export async function lookupClerkUserByExactEmail(
  email,
  { environment = process.env, clerkClient = null } = {}
) {
  const normalizedEmail = normalizedLifetimeGrantEmail(email);
  if (!normalizedEmail) {
    throw new LifetimeGrantAdminError(400, "Enter a valid email address.");
  }
  const secretKey = String(environment.CLERK_SECRET_KEY || "").trim();
  if (!secretKey && !clerkClient) {
    throw new LifetimeGrantAdminError(503, "Clerk account lookup is not configured.");
  }
  const client = clerkClient || createClerkClient({ secretKey });
  let response;
  try {
    response = await client.users.getUserList({
      emailAddress: [normalizedEmail],
      limit: 10
    });
  } catch {
    throw new LifetimeGrantAdminError(502, "Clerk account lookup failed. Try again before changing access.");
  }
  const user = exactClerkUserForEmail(response?.data, normalizedEmail);
  return {
    email: normalizedEmail,
    clerkUserID: String(user.id || "").trim(),
    userID: `clerk:${String(user.id || "").trim()}`,
    displayName: [user.firstName, user.lastName].map((value) => String(value || "").trim()).filter(Boolean).join(" ") || null,
    imageURL: String(user.imageUrl || "").trim() || null,
    createdAt: Number.isFinite(Number(user.createdAt))
      ? new Date(Number(user.createdAt)).toISOString()
      : null,
    lastSignInAt: Number.isFinite(Number(user.lastSignInAt))
      ? new Date(Number(user.lastSignInAt)).toISOString()
      : null
  };
}

export async function verifiedClerkUserIdentity(
  clerkUserID,
  { environment = process.env, clerkClient = null } = {}
) {
  const normalizedUserID = String(clerkUserID || "").trim();
  if (!normalizedUserID.startsWith("user_")) {
    throw new LifetimeGrantAdminError(400, "Clerk user identity is invalid.");
  }
  const secretKey = String(environment.CLERK_SECRET_KEY || "").trim();
  if (!secretKey && !clerkClient) {
    throw new LifetimeGrantAdminError(503, "Clerk account lookup is not configured.");
  }
  const client = clerkClient || createClerkClient({ secretKey });
  let user;
  try {
    user = await client.users.getUser(normalizedUserID);
  } catch {
    throw new LifetimeGrantAdminError(502, "Clerk account verification failed. Try signing in again.");
  }
  const emails = userEmailAddresses(user);
  if (!emails.length) {
    throw new LifetimeGrantAdminError(409, "The Clerk account does not have a verified email address.");
  }
  const primaryEmail = normalizedLifetimeGrantEmail(
    user.emailAddresses?.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
  );
  return {
    clerkUserID: normalizedUserID,
    emails: Array.from(new Set(emails)),
    primaryEmail: primaryEmail && emails.includes(primaryEmail) ? primaryEmail : emails[0]
  };
}

function clerkInvitationRedirectURL(environment) {
  const configured = String(environment.CLERK_ACCOUNT_PORTAL_URL || "").trim();
  try {
    const url = new URL(configured);
    url.pathname = "/sign-up";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "https://accounts.permitext.com/sign-up";
  }
}

export async function sendClerkLifetimeGrantInvitation(
  email,
  { environment = process.env, clerkClient = null } = {}
) {
  const normalizedEmail = normalizedLifetimeGrantEmail(email);
  if (!normalizedEmail) {
    throw new LifetimeGrantAdminError(400, "Enter a valid email address.");
  }
  const secretKey = String(environment.CLERK_SECRET_KEY || "").trim();
  if (!secretKey && !clerkClient) {
    throw new LifetimeGrantAdminError(503, "Clerk invitations are not configured.");
  }
  const client = clerkClient || createClerkClient({ secretKey });
  let invitation;
  try {
    invitation = await client.invitations.createInvitation({
      emailAddress: normalizedEmail,
      expiresInDays: 30,
      ignoreExisting: true,
      notify: true,
      redirectUrl: clerkInvitationRedirectURL(environment)
    });
  } catch {
    throw new LifetimeGrantAdminError(502, "Clerk could not send the invitation email. No Lifetime Pro invitation was saved.");
  }
  return {
    id: String(invitation.id || "").trim(),
    status: String(invitation.status || "pending"),
    sentAt: new Date().toISOString()
  };
}

export async function revokeClerkLifetimeGrantInvitation(
  invitationID,
  { environment = process.env, clerkClient = null } = {}
) {
  const normalizedInvitationID = String(invitationID || "").trim();
  if (!normalizedInvitationID) return false;
  const secretKey = String(environment.CLERK_SECRET_KEY || "").trim();
  if (!secretKey && !clerkClient) return false;
  const client = clerkClient || createClerkClient({ secretKey });
  try {
    await client.invitations.revokeInvitation(normalizedInvitationID);
    return true;
  } catch {
    // The local pending grant is still revoked even when Clerk reports that its
    // email link was already used, expired, or independently revoked.
    return false;
  }
}

export function lifetimeGrantChangeDecision(entitlement, action) {
  const current = entitlement || null;
  if (action === "grant") {
    if (!current) return { allowed: true, outcome: "grant", message: null };
    if (current.source === "lifetimeGrant") {
      return {
        allowed: false,
        outcome: "already_granted",
        message: "This account already has Lifetime Pro. Nothing was changed."
      };
    }
    return {
      allowed: false,
      outcome: "paid_entitlement_present",
      message: "This account already has a provider-managed entitlement. Lifetime Pro cannot overwrite Apple or Stripe access."
    };
  }
  if (action === "revoke") {
    if (!current) {
      return {
        allowed: false,
        outcome: "not_granted",
        message: "This account does not have Lifetime Pro. Nothing was changed."
      };
    }
    if (current.source !== "lifetimeGrant") {
      return {
        allowed: false,
        outcome: "paid_entitlement_present",
        message: "Only a Lifetime Pro grant can be revoked here. Apple and Stripe access was not changed."
      };
    }
    return { allowed: true, outcome: "revoke", message: null };
  }
  throw new LifetimeGrantAdminError(400, "Unsupported Lifetime Pro action.");
}
