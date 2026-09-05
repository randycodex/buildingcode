import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [runbook, server, web, ios] = await Promise.all([
  readFile(new URL("../../docs/BETA1_BILLING_IDENTITY_RUNBOOK.md", import.meta.url), "utf8"),
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Views/SettingsView.swift", import.meta.url), "utf8")
]);

function functionSource(source, name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist.`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = source.indexOf("{", parametersEnd);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}.`);
}

const activeAccountState = {
  account: {
    userID: "clerk:user_contract",
    sessionToken: "session-contract",
    authProvider: "clerk"
  }
};
const activeAccount = new Function(
  "state",
  `${functionSource(web, "activeAccount")}; return activeAccount;`
)(activeAccountState);
assert.deepEqual(
  activeAccount(),
  {
    userID: "clerk:user_contract",
    sessionToken: "session-contract",
    authProvider: "clerk"
  },
  "The active account boundary must retain the Clerk provider for identity deletion."
);

const accountScopedState = {
  localProjects: [
    { id: "owned-local", userID: "clerk:user_contract" },
    { id: "other-local", userID: "clerk:other" },
    { id: "legacy-unscoped" }
  ],
  syncOutbox: [
    {
      accountUserID: "clerk:user_contract",
      mutation: { project: { id: "owned-queued", userID: "clerk:user_contract" } }
    },
    {
      accountUserID: "clerk:other",
      mutation: { project: { id: "other-queued", userID: "clerk:other" } }
    }
  ],
  syncConflicts: [
    {
      accountUserID: "clerk:user_contract",
      mutation: { workboard: { id: "clerk:user_contract:workboard:owned-conflict" } }
    },
    {
      accountUserID: "clerk:user_contract",
      mutation: { workboard: { projectID: "wrong-owner", userID: "clerk:other" } }
    }
  ]
};
const accountScopedWorkboardProjectIDs = new Function(
  "state",
  "currentContentSummary",
  `${functionSource(web, "accountScopedWorkboardProjectIDs")}; return accountScopedWorkboardProjectIDs;`
)(accountScopedState, () => ({
  projects: [{ id: "owned-synced" }],
  workboards: [{ projectID: "owned-synced-board" }]
}));
assert.deepEqual(
  new Set(accountScopedWorkboardProjectIDs({ userID: "clerk:user_contract" })),
  new Set(["owned-synced", "owned-synced-board", "owned-local", "owned-queued", "owned-conflict"]),
  "Account deletion must remove only Workboards attributable to the account being deleted."
);

for (const requiredBoundary of [
  /dedicated disposable Production acceptance account/i,
  /Never use the owner's primary account, an administrator account, a Lifetime Pro account, or a real customer account/,
  /exact serving Git commit/i,
  /does not cancel an App Store subscription/i,
  /Deletion is permanent and cannot be rolled back/i,
  /Never commit an admin token, session token, raw account export/i
]) {
  assert.match(runbook, requiredBoundary);
}

for (const requiredRoute of [
  /`POST \/admin\/accounts\/restore-checklist`/,
  /`POST \/admin\/accounts\/export`/,
  /`DELETE \/account\/delete`/
]) {
  assert.match(runbook, requiredRoute);
}

for (const requiredFailureCode of [
  /STRIPE_CANCELLATION_FAILED/,
  /PRIVATE_ASSET_DELETION_FAILED/,
  /ACCOUNT_DATA_DELETION_FAILED/
]) {
  assert.match(runbook, requiredFailureCode);
  assert.match(server, requiredFailureCode);
}

assert.match(runbook, /Server success followed by device or Clerk failure:[\s\S]*Retry cleanup/);
assert.match(runbook, /deleted session receives HTTP `401`/);
assert.match(runbook, /empty Free Permitext account/);
assert.match(runbook, /minimal purchase-ownership tombstone remains to prevent replay/);

assert.match(server, /"admin\/accounts\/restore-checklist": handleRestoreChecklist/);
assert.match(server, /"admin\/accounts\/export": handleAccountExport/);
assert.match(server, /"account\/delete": handleAccountDelete/);
assert.match(server, /body\.confirmation !== "DELETE"/);
assert.match(server, /status: "userManaged"/);
assert.match(web, /deleting Permitext does not cancel App Store billing/i);
assert.match(web, /confirmation: "DELETE"/);
assert.match(web, /Retry cleanup/);
assert.match(web, /const clearThisBrowser = \(\) => clearDeletedAccountBrowserData\(account, deletionIdentity\)/);
const accountCleanup = functionSource(web, "clearDeletedAccountBrowserData");
assert.match(accountCleanup, /deleteOfflineAccountData\(account\.userID\)/);
assert.match(accountCleanup, /removePrivateWorkspace\(localStorage, account\.userID\)/);
assert.match(accountCleanup, /removePrivateWorkspace\(sessionStorage, account\.userID\)/);
assert.doesNotMatch(accountCleanup, /deleteLocalWorkboard\(/,
  "Retired Project-only Workboard caches have no account ownership proof and must not be erased by another account's deletion.");
assert.doesNotMatch(web, /\.\.\.\(state\.localProjects \|\| \[\]\)\.map\(\(project\) => workboardProjectID/);
assert.match(ios, /deleting Permitext does not cancel App Store billing/i);
assert.match(ios, /accountDeletionConfirmation[\s\S]*"DELETE"/);
assert.match(ios, /Retry cleanup/);

console.log("Permitext account deletion runbook contract passed.");
