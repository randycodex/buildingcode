import {
  accountRateLimitPrincipal,
  clientRateLimitPrincipal,
  consumeRateLimit,
  createLocalRateLimitRepository,
  rateLimitBucketKey,
  rateLimitPolicies,
  requestClientAddress,
  trustForwardedClientAddress,
  verifiedAdminRateLimitPrincipal
} from "../rate-limit.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requestFixture({
  remoteAddress = "::ffff:127.0.0.1",
  forwardedFor,
  realIP,
  authorization
} = {}) {
  return {
    headers: {
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...(realIP ? { "x-real-ip": realIP } : {}),
      ...(authorization ? { authorization } : {})
    },
    socket: { remoteAddress }
  };
}

assert(
  trustForwardedClientAddress({ VERCEL: "1" }) === true &&
    trustForwardedClientAddress({ PERMITEXT_TRUST_PROXY: "1" }) === true &&
    trustForwardedClientAddress({ VERCEL: "1", PERMITEXT_TRUST_PROXY: "0" }) === false,
  "Trusted-proxy policy did not honor hosted, explicit opt-in, and explicit opt-out modes."
);

const forwardedRequest = requestFixture({
  forwardedFor: " 203.0.113.14, 10.0.0.8 ",
  realIP: "203.0.113.99"
});
assert(
  requestClientAddress(forwardedRequest, { PERMITEXT_TRUST_PROXY: "1" }) === "203.0.113.14",
  "Trusted forwarding did not use the first valid client address."
);
assert(
  requestClientAddress(forwardedRequest, {}) === "127.0.0.1",
  "An untrusted forwarding header overrode the direct peer address."
);
assert(
  requestClientAddress(
    requestFixture({ forwardedFor: "not-an-ip, 203.0.113.15", realIP: "203.0.113.16" }),
    { PERMITEXT_TRUST_PROXY: "1" }
  ) === "203.0.113.16",
  "Malformed first-hop forwarding did not fall back safely."
);
assert(
  requestClientAddress(
    requestFixture({ remoteAddress: "2001:0db8:0:0:0:0:0:1" }),
    {}
  ) === "2001:db8::1",
  "IPv6 client addresses were not canonicalized."
);
assert(
  clientRateLimitPrincipal(forwardedRequest, { PERMITEXT_TRUST_PROXY: "1" }) ===
    "ip:203.0.113.14",
  "Client principal did not preserve the trusted normalized address."
);
assert(
  accountRateLimitPrincipal(" apple:test-user ") === "account:apple:test-user",
  "Account principal was not normalized."
);

const adminEnvironment = {
  PERMITEXT_SYNC_ADMIN_TOKEN: "primary-secret",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "grant-secret"
};
const adminPrincipal = verifiedAdminRateLimitPrincipal(
  requestFixture({ authorization: "Bearer primary-secret" }),
  "admin/accounts/export",
  adminEnvironment
);
assert(
  adminPrincipal?.startsWith("administrator:") && !adminPrincipal.includes("primary-secret"),
  "Verified administrator principals did not hash the configured credential."
);
assert(
  verifiedAdminRateLimitPrincipal(
    requestFixture({ authorization: "Bearer grant-secret" }),
    "admin/accounts/export",
    adminEnvironment
  ) === null,
  "A grant-only credential was treated as a general administrator."
);
assert(
  verifiedAdminRateLimitPrincipal(
    requestFixture({ authorization: "Bearer grant-secret" }),
    "admin/lifetime-grants/grant",
    adminEnvironment
  )?.startsWith("administrator:"),
  "The configured grant administrator was not recognized on a grant route."
);

for (const prefix of ["account/", "billing/", "research/", "organizations/", "internal/", "admin/"]) {
  assert(
    Array.from(rateLimitPolicies.keys()).some((path) => path.startsWith(prefix)),
    `No rate-limit policy covers ${prefix}.`
  );
}

const now = Date.parse("2026-07-26T12:00:00.000Z");
const policy = new Map([["contract/concurrency", { limit: 30, windowMs: 60_000 }]]);
const concurrentRepository = createLocalRateLimitRepository();
const concurrentResults = await Promise.all(
  Array.from({ length: 50 }, () =>
    consumeRateLimit({
      repository: concurrentRepository,
      path: "contract/concurrency",
      principals: ["account:concurrent-user"],
      now,
      policies: policy
    })
  )
);
assert(
  concurrentResults.filter((result) => result.allowed).length === 30 &&
    concurrentResults.filter((result) => !result.allowed).length === 20,
  "Concurrent local requests did not enforce the exact atomic allowance."
);
assert(
  concurrentResults.map((result) => result.results[0].count).sort((left, right) => left - right)
    .every((count, index) => count === index + 1),
  "Concurrent local increments lost or duplicated a bucket count."
);

const resetResult = await consumeRateLimit({
  repository: concurrentRepository,
  path: "contract/concurrency",
  principals: ["account:concurrent-user"],
  now: now + 60_000,
  policies: policy
});
assert(
  resetResult.allowed && resetResult.results[0].count === 1,
  "Expired local buckets did not reset deterministically."
);

const multiPrincipalRepository = createLocalRateLimitRepository();
const multiPrincipalPolicy = new Map([["contract/multi", { limit: 2, windowMs: 60_000 }]]);
await consumeRateLimit({
  repository: multiPrincipalRepository,
  path: "contract/multi",
  principals: ["ip:203.0.113.20", "account:user-a"],
  now,
  policies: multiPrincipalPolicy
});
await consumeRateLimit({
  repository: multiPrincipalRepository,
  path: "contract/multi",
  principals: ["ip:203.0.113.21", "account:user-a"],
  now,
  policies: multiPrincipalPolicy
});
const accountLimitedAcrossIPs = await consumeRateLimit({
  repository: multiPrincipalRepository,
  path: "contract/multi",
  principals: ["ip:203.0.113.22", "account:user-a"],
  now,
  policies: multiPrincipalPolicy
});
assert(
  !accountLimitedAcrossIPs.allowed &&
    accountLimitedAcrossIPs.results.find((result) => result.count === 3),
  "The account bucket did not enforce a shared limit across client addresses."
);

const boundedRepository = createLocalRateLimitRepository({ maximumBuckets: 2 });
await boundedRepository.consume({
  scope: "bounded",
  principal: "one",
  limit: 5,
  windowMs: 60_000,
  now
});
await boundedRepository.consume({
  scope: "bounded",
  principal: "two",
  limit: 5,
  windowMs: 60_000,
  now
});
const saturated = await boundedRepository.consume({
  scope: "bounded",
  principal: "three",
  limit: 5,
  windowMs: 60_000,
  now
});
assert(
  !saturated.allowed && saturated.saturated && boundedRepository.size() === 2,
  "The bounded local fallback evicted an active bucket instead of failing closed."
);
assert(
  rateLimitBucketKey("scope-a", "principal-a") === rateLimitBucketKey("scope-a", "principal-a") &&
    rateLimitBucketKey("scope-a", "principal-a") !== rateLimitBucketKey("scope-a", "principal-b"),
  "Rate-limit bucket keys were not stable and scope-aware."
);

console.log("permitext rate-limit contract passed");
