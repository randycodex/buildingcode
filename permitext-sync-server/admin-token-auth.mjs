import { timingSafeEqual } from "node:crypto";

// Administrative credentials are deliberately compared separately from normal
// account-session tokens. This keeps the privileged bearer-token policy in one
// place for route authorization and rate-limit principal verification.
export function timingSafeAdminTokenEqual(suppliedToken, configuredToken) {
  const supplied = Buffer.from(String(suppliedToken || ""), "utf8");
  const configured = Buffer.from(String(configuredToken || ""), "utf8");
  if (!supplied.length || !configured.length || supplied.length !== configured.length) {
    return false;
  }
  return timingSafeEqual(supplied, configured);
}

export function matchesConfiguredAdminToken(suppliedToken, configuredTokens = []) {
  let matched = 0;
  for (const configuredToken of configuredTokens) {
    // Do not short-circuit: grant routes may accept more than one configured
    // credential, and every configured candidate should receive the same check.
    matched |= Number(timingSafeAdminTokenEqual(suppliedToken, configuredToken));
  }
  return Boolean(matched);
}
