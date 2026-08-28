import assert from "node:assert/strict";
import {
  PolicyAcceptanceError,
  accountWithPolicyAcceptance,
  currentPolicyAcceptance,
  mergedPolicyAcceptances,
  policyAcceptanceRecord,
  policyVersionConfiguration
} from "../policy-acceptance.mjs";

const environment = {
  PERMITEXT_PUBLIC_BASE_URL: "https://permitext.com",
  PERMITEXT_TERMS_VERSION: "terms-2026-08-28",
  PERMITEXT_PRIVACY_VERSION: "privacy-2026-08-28",
  PERMITEXT_SUBSCRIPTION_POLICY_VERSION: "subscriptions-2026-08-28"
};
const versions = {
  terms: environment.PERMITEXT_TERMS_VERSION,
  privacy: environment.PERMITEXT_PRIVACY_VERSION,
  subscriptionsAndRefunds: environment.PERMITEXT_SUBSCRIPTION_POLICY_VERSION
};

const configuration = policyVersionConfiguration(environment);
assert.equal(configuration.ready, true);
assert.equal(configuration.documents.terms.url, "https://permitext.com/terms");
assert.equal(configuration.documents.privacy.url, "https://permitext.com/privacy");
assert.equal(configuration.documents.subscriptionsAndRefunds.url, "https://permitext.com/refunds");
assert.equal(policyVersionConfiguration({}).ready, false);

const acceptance = policyAcceptanceRecord({
  platform: "web",
  versions,
  clientRelease: "contract-release"
}, {
  environment,
  id: "acceptance-contract",
  now: new Date("2026-08-28T16:00:00.000Z")
});
assert.equal(acceptance.id, "acceptance-contract");
assert.equal(acceptance.acceptedAt, "2026-08-28T16:00:00.000Z");
assert.equal(acceptance.platform, "web");
assert.equal(acceptance.clientRelease, "contract-release");
assert.equal(acceptance.versions.privacy, versions.privacy);

const first = accountWithPolicyAcceptance({ appUserID: "apple:contract" }, acceptance);
assert.equal(first.changed, true);
assert.equal(first.account.policyAcceptances.length, 1);
assert.equal(currentPolicyAcceptance(first.account, environment)?.id, acceptance.id);

const duplicate = accountWithPolicyAcceptance(first.account, {
  ...acceptance,
  id: "later-duplicate",
  platform: "ios",
  acceptedAt: "2026-08-28T16:05:00.000Z"
});
assert.equal(duplicate.changed, false, "The same policy set was recorded twice.");
assert.equal(duplicate.acceptance.id, acceptance.id);

const merged = mergedPolicyAcceptances(
  first.account.policyAcceptances,
  [{ ...acceptance, id: "source-acceptance", acceptedAt: "2026-08-28T15:00:00.000Z" }]
);
assert.deepEqual(merged.map((item) => item.id), ["source-acceptance", "acceptance-contract"]);

for (const [input, code] of [
  [{ platform: "web", versions: { ...versions, terms: "stale" } }, "POLICY_VERSION_MISMATCH"],
  [{ platform: "desktop", versions }, "INVALID_POLICY_ACCEPTANCE_PLATFORM"]
]) {
  assert.throws(
    () => policyAcceptanceRecord(input, { environment }),
    (error) => error instanceof PolicyAcceptanceError && error.code === code
  );
}
assert.throws(
  () => policyAcceptanceRecord({ platform: "web", versions }, { environment: {} }),
  (error) => error instanceof PolicyAcceptanceError && error.code === "POLICY_ACCEPTANCE_NOT_CONFIGURED"
);

console.log("permitext policy acceptance contract passed");
