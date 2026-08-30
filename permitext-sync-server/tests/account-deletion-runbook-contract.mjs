import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [runbook, server, web, ios] = await Promise.all([
  readFile(new URL("../../docs/BETA1_BILLING_IDENTITY_RUNBOOK.md", import.meta.url), "utf8"),
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Views/SettingsView.swift", import.meta.url), "utf8")
]);

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
assert.match(ios, /deleting Permitext does not cancel App Store billing/i);
assert.match(ios, /accountDeletionConfirmation[\s\S]*"DELETE"/);
assert.match(ios, /Retry cleanup/);

console.log("Permitext account deletion runbook contract passed.");
