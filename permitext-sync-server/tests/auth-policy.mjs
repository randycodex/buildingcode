import { appleIdentityTokenRequired } from "../app.mjs";

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

console.log("permitext auth policy passed");
