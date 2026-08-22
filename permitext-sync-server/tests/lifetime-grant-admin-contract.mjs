import { readFile } from "node:fs/promises";
import {
  LifetimeGrantAdminError,
  exactClerkUserForEmail,
  lifetimeGrantChangeDecision,
  lifetimeGrantEmailHash,
  lookupClerkUserByExactEmail,
  maskedLifetimeGrantEmail,
  normalizedLifetimeGrantEmail,
  revokeClerkLifetimeGrantInvitation,
  sendClerkLifetimeGrantInvitation,
  verifiedClerkUserIdentity
} from "../lifetime-grant-admin.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejectsWithStatus(operation, statusCode, message) {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof LifetimeGrantAdminError, `${message} returned the wrong error type.`);
    assert(error.statusCode === statusCode, `${message} returned status ${error.statusCode}.`);
    return;
  }
  throw new Error(`${message} was accepted.`);
}

function clerkUser(id, email, status = "verified") {
  return {
    id,
    firstName: "Beta",
    lastName: "User",
    primaryEmailAddressId: `email_${id}`,
    emailAddresses: [{
      id: `email_${id}`,
      emailAddress: email,
      verification: { status }
    }],
    createdAt: Date.parse("2026-08-22T12:00:00Z"),
    lastSignInAt: Date.parse("2026-08-22T13:00:00Z")
  };
}

assert(
  normalizedLifetimeGrantEmail("  PERSON@Example.com ") === "person@example.com",
  "Lifetime grant email normalization was not exact and case-insensitive."
);
assert(!normalizedLifetimeGrantEmail("not-an-email"), "An invalid invitation email was accepted.");
assert(
  maskedLifetimeGrantEmail("person@example.com") === "pe***@example.com",
  "Invitation history did not mask the target email."
);
assert(
  lifetimeGrantEmailHash("PERSON@example.com") === lifetimeGrantEmailHash("person@example.com"),
  "Invitation matching did not use a stable normalized email hash."
);

const exactUser = clerkUser("user_exact", "person@example.com");
assert(
  exactClerkUserForEmail([exactUser], "PERSON@example.com").id === "user_exact",
  "The exact verified Clerk identity was not selected."
);
await rejectsWithStatus(
  () => Promise.resolve(exactClerkUserForEmail([
    clerkUser("user_partial", "person+other@example.com")
  ], "person@example.com")),
  404,
  "A partial Clerk email match"
);
await rejectsWithStatus(
  () => Promise.resolve(exactClerkUserForEmail([
    clerkUser("user_unverified", "person@example.com", "unverified")
  ], "person@example.com")),
  404,
  "An unverified Clerk email"
);
await rejectsWithStatus(
  () => Promise.resolve(exactClerkUserForEmail([
    clerkUser("user_one", "person@example.com"),
    clerkUser("user_two", "person@example.com")
  ], "person@example.com")),
  409,
  "An ambiguous Clerk identity"
);

let lookupParams = null;
const lookedUp = await lookupClerkUserByExactEmail("PERSON@example.com", {
  clerkClient: {
    users: {
      async getUserList(params) {
        lookupParams = params;
        return { data: [exactUser], totalCount: 1 };
      }
    }
  }
});
assert(
  lookupParams.emailAddress.length === 1 && lookupParams.emailAddress[0] === "person@example.com",
  "Clerk lookup was not restricted to the normalized exact email."
);
assert(lookedUp.userID === "clerk:user_exact", "Clerk identity did not map to the Permitext account ID.");

const verifiedIdentity = await verifiedClerkUserIdentity("user_exact", {
  clerkClient: { users: { async getUser() { return exactUser; } } }
});
assert(
  verifiedIdentity.primaryEmail === "person@example.com",
  "Verified Clerk sign-in did not expose the primary email for pending invitation activation."
);
assert(
  verifiedIdentity.emails.length === 1 && verifiedIdentity.emails[0] === "person@example.com",
  "Verified Clerk sign-in did not expose every verified email for exact pending-invitation matching."
);

let invitationParams = null;
const sentInvitation = await sendClerkLifetimeGrantInvitation("person@example.com", {
  environment: { CLERK_ACCOUNT_PORTAL_URL: "https://accounts.permitext.com/sign-in" },
  clerkClient: {
    invitations: {
      async createInvitation(params) {
        invitationParams = params;
        return { id: "inv_123", status: "pending" };
      }
    }
  }
});
assert(sentInvitation.id === "inv_123", "The Clerk invitation ID was not retained for revocation.");
assert(invitationParams.notify === true, "The Lifetime Pro invitation did not request an email notification.");
assert(invitationParams.ignoreExisting === true, "Existing Clerk identities could not receive the invitation email.");
assert(
  invitationParams.redirectUrl === "https://accounts.permitext.com/sign-up",
  "The Clerk invitation did not return the recipient to the Permitext sign-up portal."
);

let revokedInvitationID = null;
assert(await revokeClerkLifetimeGrantInvitation("inv_123", {
  clerkClient: {
    invitations: {
      async revokeInvitation(id) { revokedInvitationID = id; }
    }
  }
}), "A pending Clerk invitation could not be revoked.");
assert(revokedInvitationID === "inv_123", "The wrong Clerk invitation was revoked.");

assert(lifetimeGrantChangeDecision(null, "grant").allowed, "A Free account could not receive Lifetime Pro.");
assert(
  lifetimeGrantChangeDecision({ source: "lifetimeGrant" }, "revoke").allowed,
  "An active Lifetime Pro grant could not be revoked."
);
for (const source of ["appleSubscription", "webSubscription"]) {
  assert(
    !lifetimeGrantChangeDecision({ source, plan: "pro" }, "grant").allowed,
    `${source} could be overwritten by a Lifetime Pro grant.`
  );
  assert(
    !lifetimeGrantChangeDecision({ source, plan: "pro" }, "revoke").allowed,
    `${source} could be revoked through the Lifetime Pro control.`
  );
}

const [serverSource, consoleHTML, consoleSource] = await Promise.all([
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../internal/index.html", import.meta.url), "utf8"),
  readFile(new URL("../internal/app.js", import.meta.url), "utf8")
]);
for (const route of ["data", "lookup", "invite", "revoke"]) {
  assert(
    serverSource.includes(`internal/lifetime-grants/${route}`),
    `The owner console is missing the ${route} Lifetime Pro route.`
  );
}
assert(
  serverSource.includes("await authenticatedInternalBody(request, response)"),
  "Lifetime Pro console routes are not protected by owner session authentication."
);
assert(
  serverSource.includes('deletePersistedEntitlement(targetUserID, { source: "lifetimeGrant" })'),
  "Lifetime Pro revocation is not source-scoped."
);
assert(
  serverSource.includes("activatePendingLifetimeGrantForAccount") &&
    serverSource.includes('performedBy: "verified-clerk-sign-in"') &&
    serverSource.includes("account?.verifiedEmails"),
  "Pending Lifetime Pro invitations do not activate through verified sign-in."
);
assert(
  consoleHTML.includes('data-tab="lifetime-grants"') &&
    consoleSource.includes("Type ${state.email} to confirm a change") &&
    consoleSource.includes("Revoke Lifetime Pro"),
  "The owner console is missing invitation confirmation or revocation controls."
);
assert(
  !consoleSource.includes("PERMITEXT_SYNC_ADMIN_TOKEN") &&
    !consoleSource.includes("PERMITEXT_SYNC_GRANT_ADMIN_TOKEN"),
  "The browser console references a server grant secret."
);

console.log("Lifetime Pro invitation and revocation contract passed.");
