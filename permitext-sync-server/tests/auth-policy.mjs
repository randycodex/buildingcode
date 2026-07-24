import {
  appleIdentityTokenRequired,
  appleWebOAuthStateSecret,
  compatibilityAccountMergeAllowed,
  requestBodyLimit
} from "../app.mjs";
import { accountSessionTTLSeconds } from "../postgres-account-repository.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  appleIdentityTokenRequired({}) === false,
  "Local development should permit tokenless synthetic Apple credentials."
);
assert(
  appleIdentityTokenRequired({ PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN: "1" }) === true,
  "The explicit Apple identity-token policy was ignored."
);
assert(
  appleIdentityTokenRequired({ VERCEL: "1" }) === true,
  "A hosted Vercel deployment did not require Apple identity tokens."
);
assert(
  appleIdentityTokenRequired({ VERCEL_ENV: "preview" }) === true,
  "A hosted preview deployment did not require Apple identity tokens."
);
assert(
  appleIdentityTokenRequired({ VERCEL: "1", PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN: "0" }) === true,
  "A hosted deployment allowed the Apple identity-token requirement to be disabled."
);
assert(accountSessionTTLSeconds({}) === 60 * 60 * 24 * 30, "The default session expiry changed unexpectedly.");
assert(
  accountSessionTTLSeconds({ PERMITEXT_SESSION_TTL_SECONDS: "7200" }) === 7200,
  "The configured session expiry was ignored."
);
assert(
  accountSessionTTLSeconds({ PERMITEXT_SESSION_TTL_SECONDS: "60" }) === 60 * 60 * 24 * 30,
  "An unsafe session expiry below one hour was accepted."
);
assert(requestBodyLimit({}) === 1024 * 1024, "The default request body limit changed unexpectedly.");
assert(
  requestBodyLimit({ PERMITEXT_MAX_REQUEST_BODY_BYTES: String(2 * 1024 * 1024) }) === 2 * 1024 * 1024,
  "The configured request body limit was ignored."
);
assert(
  requestBodyLimit({ PERMITEXT_MAX_REQUEST_BODY_BYTES: "1024" }) === 1024 * 1024,
  "An unsafe request body limit was accepted."
);
assert(compatibilityAccountMergeAllowed({ kind: "file" }) === true, "Local account merge was disabled.");
assert(
  compatibilityAccountMergeAllowed({ kind: "postgres" }) === false,
  "Postgres allowed the unsafe compatibility account merge path."
);
assert(
  compatibilityAccountMergeAllowed({ kind: "postgres", mergeUserAccounts() {} }) === true,
  "Postgres did not allow its transactional account merge path."
);
assert(
  appleWebOAuthStateSecret({ APPLE_WEB_OAUTH_STATE_SECRET: "dedicated-secret", VERCEL: "1" }) === "dedicated-secret",
  "Hosted Apple web sign-in ignored its dedicated OAuth state secret."
);
assert(
  appleWebOAuthStateSecret({ PERMITEXT_SYNC_ADMIN_TOKEN: "admin-secret", VERCEL: "1" }) !== "admin-secret",
  "Hosted Apple web sign-in did not derive a domain-separated OAuth state key."
);
try {
  appleWebOAuthStateSecret({ VERCEL: "1", STRIPE_WEBHOOK_SECRET: "unrelated-secret" });
  throw new Error("Hosted Apple web sign-in accepted an unrelated OAuth secret.");
} catch (error) {
  assert(
    error.statusCode === 500 && error.message.includes("OAuth state secret"),
    "Hosted Apple web sign-in did not clearly reject a missing dedicated OAuth state secret."
  );
}

console.log("permitext auth policy passed");
