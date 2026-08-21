import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { matchesConfiguredAdminToken } from "./admin-token-auth.mjs";

export const rateLimitPolicies = new Map([
  ["account/sign-in", { limit: 30, windowMs: 5 * 60 * 1000 }],
  ["account/sign-out", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["account/delete", { limit: 5, windowMs: 60 * 60 * 1000 }],
  ["account/apple/start", { limit: 30, windowMs: 5 * 60 * 1000 }],
  ["account/apple/callback", { limit: 60, windowMs: 5 * 60 * 1000 }],
  ["account/attach-local-data", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["account/link-browser", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["account/profile", { limit: 60, windowMs: 60 * 1000 }],
  ["account/passkeys/link", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["billing/web/checkout", { limit: 20, windowMs: 10 * 60 * 1000 }],
  ["billing/web/portal", { limit: 20, windowMs: 10 * 60 * 1000 }],
  ["billing/stripe/restore", { limit: 20, windowMs: 10 * 60 * 1000 }],
  ["billing/apple/transactions/verify", { limit: 30, windowMs: 10 * 60 * 1000 }],
  ["client-errors/report", { limit: 30, windowMs: 5 * 60 * 1000 }],
  ["research/interpret", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/get", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/create", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/evidence", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/refresh", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/message", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["research/evidence/discover", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/assign-project", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/project-context", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/reuse-evidence", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/conversations/delete", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["research/answers/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/answers/get", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/usage", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["research/feedback", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["projects/foundation/state", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["projects/foundation/link", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["projects/foundation/unlink", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["projects/collaboration/notes/save", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["projects/collaboration/threads/save", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["projects/collaboration/comments/save", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["organizations/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["organizations/create", { limit: 10, windowMs: 60 * 60 * 1000 }],
  ["organizations/update", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["organizations/controls/save", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["organizations/members/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["organizations/members/invite", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["organizations/members/update", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["organizations/invitations/accept", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["organizations/invitations/revoke", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["organizations/projects/transfer", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["organizations/projects/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["organizations/projects/snapshot", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["projects/hub/bootstrap", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["organizations/evidence/reviews/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["organizations/evidence/reviews/save", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["notebook/cards/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["notebook/cards/get", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["notebook/cards/save", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["notebook/cards/delete", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["reports/sources/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["reports/options", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["reports/drafts/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["reports/drafts/get", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["reports/drafts/save", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["reports/drafts/delete", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["reports/generate", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["reports/history/list", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["reports/manifests/get", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["reports/files/upload", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["reports/files/read", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["internal/evaluations/data", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["internal/evaluations/review", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["internal/evaluations/feedback/triage", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["sync/push", { limit: 240, windowMs: 60 * 1000 }],
  ["sync/checkpoint", { limit: 120, windowMs: 60 * 1000 }],
  ["sync/pull", { limit: 600, windowMs: 60 * 1000 }],
  ["workboards/assets/upload", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["workboards/assets/read", { limit: 600, windowMs: 60 * 1000 }],
  ["workboards/assets/delete", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["workboards/previews/upload", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["workboards/previews/read", { limit: 240, windowMs: 60 * 60 * 1000 }],
  ["workboards/previews/clear", { limit: 60, windowMs: 60 * 60 * 1000 }],
  ["admin/lifetime-grants/grant", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["admin/lifetime-grants/revoke", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["admin/accounts/delete-legacy-passkey-users", { limit: 5, windowMs: 60 * 60 * 1000 }],
  ["admin/accounts/restore-checklist", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["admin/accounts/export", { limit: 30, windowMs: 60 * 60 * 1000 }],
  ["admin/accounts/grant-summaries", { limit: 120, windowMs: 60 * 60 * 1000 }],
  ["admin/storage/summary", { limit: 120, windowMs: 60 * 60 * 1000 }]
]);

function normalizedIPAddress(value) {
  let address = String(value || "").trim();
  if (address.startsWith("::ffff:") && isIP(address.slice(7)) === 4) {
    address = address.slice(7);
  }
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6) return null;
  try {
    const hostname = new URL(`http://[${address}]/`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  } catch {
    return address.toLowerCase();
  }
}

export function trustForwardedClientAddress(environment = process.env) {
  if (environment.PERMITEXT_TRUST_PROXY === "0") return false;
  if (environment.PERMITEXT_TRUST_PROXY === "1") return true;
  return Boolean(String(environment.VERCEL || "").trim());
}

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function requestClientAddress(request, environment = process.env) {
  const peerAddress = normalizedIPAddress(request.socket?.remoteAddress) || "unknown";
  if (!trustForwardedClientAddress(environment)) return peerAddress;

  const forwardedHeader = String(firstHeaderValue(request.headers?.["x-forwarded-for"]) || "");
  const forwardedAddress = normalizedIPAddress(forwardedHeader.split(",")[0]);
  if (forwardedAddress) return forwardedAddress;

  return normalizedIPAddress(firstHeaderValue(request.headers?.["x-real-ip"])) || peerAddress;
}

export function rateLimitBucketKey(scope, principal) {
  return createHash("sha256")
    .update(`${String(scope || "")}\u0000${String(principal || "")}`)
    .digest("hex");
}

function rateLimitResult({ count, limit, resetAt, observedAt = Date.now(), saturated = false }) {
  const normalizedResetAt = Number(resetAt);
  return {
    allowed: Number(count) <= limit && !saturated,
    count: Number(count),
    limit,
    resetAt: normalizedResetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((normalizedResetAt - observedAt) / 1000)),
    saturated
  };
}

export function createLocalRateLimitRepository({ maximumBuckets = 2_000 } = {}) {
  if (!Number.isSafeInteger(maximumBuckets) || maximumBuckets < 1) {
    throw new Error("Local rate-limit bucket capacity must be a positive integer.");
  }
  const buckets = new Map();

  return {
    kind: "local",
    async consume({ scope, principal, limit, windowMs, now = Date.now() }) {
      const key = rateLimitBucketKey(scope, principal);
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        if (buckets.size >= maximumBuckets) {
          for (const [candidateKey, candidate] of buckets) {
            if (candidate.resetAt <= now) buckets.delete(candidateKey);
          }
        }
        if (!buckets.has(key) && buckets.size >= maximumBuckets) {
          return rateLimitResult({
            count: limit + 1,
            limit,
            resetAt: now + windowMs,
            observedAt: now,
            saturated: true
          });
        }
        const bucket = { count: 1, resetAt: now + windowMs };
        buckets.set(key, bucket);
        return rateLimitResult({ ...bucket, limit, observedAt: now });
      }

      current.count += 1;
      return rateLimitResult({ ...current, limit, observedAt: now });
    },
    size() {
      return buckets.size;
    }
  };
}

export async function consumeRateLimit({
  repository,
  path,
  principals,
  now = Date.now(),
  policies = rateLimitPolicies
}) {
  const policy = policies.get(path);
  if (!policy) return { allowed: true, limited: false, results: [] };
  if (!repository || typeof repository.consume !== "function") {
    throw new Error("Rate-limit repository is unavailable.");
  }

  const uniquePrincipals = Array.from(
    new Set((principals || []).map((value) => String(value || "").trim()).filter(Boolean))
  );
  if (!uniquePrincipals.length) {
    throw new Error("Rate-limit enforcement requires at least one principal.");
  }
  const results = await Promise.all(uniquePrincipals.map((principal) =>
    repository.consume({
      scope: path,
      principal,
      limit: policy.limit,
      windowMs: policy.windowMs,
      now
    })
  ));
  const denied = results.filter((result) => !result.allowed);
  return {
    allowed: denied.length === 0,
    limited: true,
    results,
    retryAfterSeconds: denied.length
      ? Math.max(...denied.map((result) => result.retryAfterSeconds))
      : 0
  };
}

export function clientRateLimitPrincipal(request, environment = process.env) {
  return `ip:${requestClientAddress(request, environment)}`;
}

export function accountRateLimitPrincipal(userID) {
  const normalizedUserID = String(userID || "").trim();
  return normalizedUserID ? `account:${normalizedUserID}` : null;
}

export function verifiedAdminRateLimitPrincipal(request, path, environment = process.env) {
  if (!String(path || "").startsWith("admin/")) return null;
  const authorization = String(request.headers?.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const suppliedToken = match?.[1] || "";
  const adminToken = String(environment.PERMITEXT_SYNC_ADMIN_TOKEN || "");
  const grantToken = String(environment.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN || "");
  const grantRoute = path === "admin/lifetime-grants/grant" ||
    path === "admin/lifetime-grants/revoke";
  const authorized = matchesConfiguredAdminToken(
    suppliedToken,
    grantRoute ? [adminToken, grantToken] : [adminToken]
  );
  if (!authorized) return null;
  const tokenHash = createHash("sha256").update(suppliedToken).digest("hex");
  return `administrator:${tokenHash}`;
}
