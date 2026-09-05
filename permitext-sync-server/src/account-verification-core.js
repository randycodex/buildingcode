import { reverificationError } from "@clerk/shared/authorization-errors";

export function captureClerkDeletionIdentity(account, clerk) {
  const user = clerk?.user;
  const session = clerk?.session;
  if (account?.authProvider !== "clerk" || !user?.id ||
      account.userID !== `clerk:${user.id}` || !session?.id ||
      typeof user.delete !== "function") {
    throw new Error("The original sign-in identity is unavailable. Sign in to that identity before deleting the account.");
  }
  if (user.deleteSelfEnabled === false) {
    throw new Error("This sign-in identity cannot be deleted here. Contact support before deleting Permitext data.");
  }
  return { clerk, userID: user.id, sessionID: session.id };
}

export function requireCapturedClerkIdentity(captured) {
  const { clerk, userID, sessionID } = captured;
  if (clerk.user?.id !== userID || clerk.session?.id !== sessionID) {
    throw new Error("The sign-in identity changed. Only the originally selected account may be deleted.");
  }
  return { user: clerk.user, session: clerk.session };
}

export function clerkDeletionVerification(captured) {
  const { session } = requireCapturedClerkIdentity(captured);
  if (typeof session.checkAuthorization !== "function") {
    throw new Error("Secure identity verification is unavailable. Reload and try again before deleting any data.");
  }
  // Clerk requires the strongest available factor within ten minutes for user
  // deletion. Return its supported hint so useReverification opens the SDK UI.
  return session.checkAuthorization({ reverification: "strict" })
    ? true
    : reverificationError("strict");
}

export async function removeCapturedClerkIdentity(captured, assertCleanupOwner) {
  const { user } = requireCapturedClerkIdentity(captured);
  assertCleanupOwner();
  await user.delete();
  return "deleted";
}
