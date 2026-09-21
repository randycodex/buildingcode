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
console.log("Account profile client contract passed: authenticated identity preserves profile metadata.");
