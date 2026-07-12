import { appleIdentityTokenRequired } from "../app.mjs";
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

console.log("permitext auth policy passed");
