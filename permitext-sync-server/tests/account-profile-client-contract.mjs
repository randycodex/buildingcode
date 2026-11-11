import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function activeAccount() {");
const end = source.indexOf("\nfunction captureAccountRequest()", start);
assert.ok(start >= 0 && end > start, "activeAccount source must remain available");

const state = { account: {
  userID: "clerk:user_test",
  sessionToken: "session",
  authProvider: "clerk",
  displayName: "Randy R",
  email: "person@example.com",
  publicUsername: "randyr",
  entitlement: { plan: "free" }
} };
const context = vm.createContext({ state });
vm.runInContext(`${source.slice(start, end)}; globalThis.result = activeAccount();`, context);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.result)),
  state.account,
  "The authenticated account view must preserve profile and entitlement fields"
);
const profileStart = source.indexOf("function profileNeedsName(account) {");
const profileEnd = source.indexOf("\nfunction profileNeedsSetup", profileStart);
assert(profileStart >= 0 && profileEnd > profileStart);
vm.runInContext(source.slice(profileStart, profileEnd), context);
for (const displayName of ["", "per codes account", "Permitext account", "Apple account", "Web browser"]) {
  assert.equal(context.profileNeedsName({ displayName }), true, `${displayName || "Empty name"} must still require profile setup`);
}
for (const displayName of ["Randy R", "Permitext User", "per codes Studio"]) {
  const account = { displayName, onboardingCompleted: true };
  assert.equal(context.profileNeedsName(account), false, "Authored names must not be reclassified by the rebrand");
  assert.equal(account.displayName, displayName, "Profile checks cannot rewrite existing names");
}
console.log("Account profile client contract passed: authenticated metadata, current/legacy placeholders and authored names preserved.");
