import {
  matchesConfiguredAdminToken,
  timingSafeAdminTokenEqual
} from "../admin-token-auth.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  timingSafeAdminTokenEqual("primary-secret", "primary-secret"),
  "A matching administrative credential was rejected."
);
assert(
  !timingSafeAdminTokenEqual("primary-secreu", "primary-secret"),
  "A same-length administrative credential mismatch was accepted."
);
assert(
  !timingSafeAdminTokenEqual("short", "primary-secret"),
  "A different-length administrative credential mismatch was accepted."
);
assert(
  !timingSafeAdminTokenEqual("", "primary-secret") &&
    !timingSafeAdminTokenEqual("primary-secret", ""),
  "An empty administrative credential was accepted."
);
assert(
  matchesConfiguredAdminToken("grant-secret", ["primary-secret", "grant-secret"]),
  "A configured grant credential was rejected."
);
assert(
  !matchesConfiguredAdminToken("grant-secreu", ["primary-secret", "grant-secret"]),
  "A mismatched credential was accepted from the configured credential list."
);

console.log("Admin bearer-token comparison contract passed.");
