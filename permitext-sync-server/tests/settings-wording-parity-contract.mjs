import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  settingsAccountSummary,
  settingsCopy,
  settingsPlanCopy
} from "../public/settings-copy.js";

const iosSettings = await readFile(
  new URL("../../NYC CC APP/permitext/Views/SettingsView.swift", import.meta.url),
  "utf8"
);
const webIndex = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

const signedOut = {
  plan: settingsPlanCopy(),
  account: settingsAccountSummary(null)
};
assert.equal(signedOut.plan.title, "Free");
assert.equal(signedOut.plan.summary, settingsCopy.freePlanSummary);
assert.equal(signedOut.plan.details, settingsCopy.freePlanDetails);
assert.equal(signedOut.account, settingsCopy.signedOutAccountSummary);

const signedInFree = {
  plan: settingsPlanCopy({ pro: false }),
  account: settingsAccountSummary({ displayName: "Permitext User", authProvider: "clerk" })
};
assert.equal(signedInFree.plan.title, "Free");
assert.equal(
  signedInFree.account,
  "Signed in as Permitext User. Saved sections, notes, and Projects can sync across your devices."
);

const signedInPro = {
  plan: settingsPlanCopy({ pro: true, source: "webSubscription" }),
  account: settingsAccountSummary({ displayName: "Permitext User", authProvider: "clerk" })
};
assert.equal(signedInPro.plan.title, "Pro");
assert.equal(signedInPro.plan.summary, settingsCopy.proPlanSummary);
assert.equal(signedInPro.plan.details, null);
assert.equal(signedInPro.account, signedInFree.account);

const lifetimePro = settingsPlanCopy({ pro: true, source: "lifetimeGrant" });
assert.equal(lifetimePro.title, "Lifetime Pro");
assert.equal(lifetimePro.summary, settingsCopy.lifetimePlanSummary);
assert.equal(lifetimePro.details, null);

for (const copy of [
  settingsCopy.freePlanSummary,
  settingsCopy.proPlanSummary,
  settingsCopy.lifetimePlanSummary,
  settingsCopy.freePlanDetails,
  settingsCopy.signedOutAccountSummary,
  settingsCopy.signedInAccountSuffix
]) {
  assert(iosSettings.includes(copy), `iOS Settings no longer contains shared Account copy: ${copy}`);
}

for (const copy of [
  settingsCopy.freePlanSummary,
  settingsCopy.proPlanSummary,
  settingsCopy.freePlanDetails
]) {
  assert(webIndex.includes(copy), `Web Settings template no longer contains shared Account copy: ${copy}`);
}

assert(!iosSettings.includes('CodeEyebrow(text: "Offline Access"'));
assert(webIndex.includes('id="settings-offline-title"'));

console.log("permitext settings wording parity contract passed");
