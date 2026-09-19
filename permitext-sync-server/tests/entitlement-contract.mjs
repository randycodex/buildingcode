import assert from "node:assert/strict";
import {
  accountMergeHasEntitlementConflict,
  activeEntitlementAddOn,
  entitlementPackageIDs,
  entitlementWithPackage,
  entitlementWithoutPackage,
  enforceFreePlanMutationBatch,
  freePlanLimits,
  hasActiveProEntitlement,
  hasActiveResearchEntitlement,
  researchEntitlementMode
} from "../entitlement-contract.mjs";
import { postgresMutationRejectionReason } from "../postgres-sync-repository.mjs";

const userID = "entitlement-contract-user";
const codeVersion = "nyc-2022";

assert.equal(
  accountMergeHasEntitlementConflict(
    { plan: "pro", source: "lifetimeGrant" },
    {
      plan: "pro",
      source: "webSubscription",
      provider: { stripeSubscriptionID: "sub_distinct" }
    }
  ),
  true,
  "A lifetime grant must not be discarded when the target has a separate paid subscription."
);
assert.equal(
  accountMergeHasEntitlementConflict(
    {
      plan: "pro",
      source: "webSubscription",
      provider: { stripeSubscriptionID: "sub_shared" }
    },
    {
      plan: "pro",
      source: "webSubscription",
      provider: { stripeSubscriptionID: "sub_shared" }
    }
  ),
  false,
  "Duplicate records for the same provider subscription must remain mergeable."
);
assert.equal(
  accountMergeHasEntitlementConflict(
    { plan: "pro", source: "lifetimeGrant" },
    { plan: "pro", source: "lifetimeGrant" }
  ),
  false,
  "Two lifetime grant records are equivalent and must remain mergeable."
);

function mutation(kind, id, values = {}) {
  return {
    [kind]: {
      id,
      userID,
      codeVersion,
      updatedAt: values.updatedAt || "2026-01-01T00:00:00.000Z",
      ...values
    }
  };
}

assert.deepEqual(freePlanLimits, { savedItems: 0, notes: 0, projects: 0 });
const savedAtLimit = [mutation("savedItem", "saved-1", { sectionID: 1 })];
const savedOverLimit = mutation("savedItem", "saved-over-limit", { sectionID: 999 });
const proOnlyMutations = [
  savedOverLimit,
  mutation("savedItem", "saved-1", { sectionID: 1, title: "Edit existing" }),
  mutation("annotation", "note-1", { noteBody: "A note" }),
  mutation("annotation", "empty-note", { noteBody: "" }),
  mutation("annotation", "tags-1", { tags: ["egress"] }),
  mutation("annotation", "highlight-1", { color: "yellow" }),
  mutation("project", "project-1", { name: "Project" }),
  mutation("project", "reference-1", { name: "Collection", folderType: "reference" }),
  mutation("projectSection", "link-1", { sectionID: 1, folderType: "reference" }),
  mutation("workboard", "workboard-1", { projectID: "project-1" })
];
let decision;
for (const entitlement of [null, { plan: "free" }, { plan: "pro", expiresAt: "2000-01-01T00:00:00Z" }]) {
  decision = enforceFreePlanMutationBatch(savedAtLimit, proOnlyMutations, entitlement);
  assert.equal(decision.acceptedMutations.length, 0, "Free and expired Pro cannot create or edit professional work.");
  assert.equal(decision.rejectedMutationIDs.length, proOnlyMutations.length);
  for (const item of proOnlyMutations) {
    const record = Object.values(item)[0];
    assert.deepEqual(postgresMutationRejectionReason({ userID, mutation: item, context: {
      existing_user_id: userID, existing_deleted_at: null, active_pro: false
    }}), decision.rejectionReasons[record.id], "SQL and file-store rejection reasons must agree, including existing records.");
  }
}
const deletions = proOnlyMutations.map(item => {
  const [kind, record] = Object.entries(item)[0];
  return mutation(kind, record.id, { ...record, deletedAt: "2026-01-02T00:00:00Z" });
});
decision = enforceFreePlanMutationBatch(savedAtLimit, deletions, null);
assert.equal(decision.acceptedMutations.length, deletions.length, "Free retains data cleanup rights.");
assert.equal(savedAtLimit[0].savedItem.deletedAt, undefined, "Enforcement must never delete retained source records.");
decision = enforceFreePlanMutationBatch([], [mutation("continuity", "reading", { values: { sectionID: 1 } })], null);
assert.equal(decision.acceptedMutations.length, 1, "Reading continuity remains available.");

const activePro = { plan: "pro", expiresAt: "2099-01-01T00:00:00.000Z" };
assert.equal(hasActiveProEntitlement(activePro), true);
assert.equal(
  researchEntitlementMode(activePro),
  "included",
  "Every active Pro record must include Research."
);
assert.equal(hasActiveResearchEntitlement(activePro), true);
decision = enforceFreePlanMutationBatch(savedAtLimit, [savedOverLimit, ...proOnlyMutations], activePro);
assert.equal(decision.acceptedMutations.length, proOnlyMutations.length + 1);

const packagedPro = {
  plan: "pro",
  expiresAt: "2099-01-01T00:00:00.000Z",
  provider: { permitextPackage: entitlementPackageIDs.pro }
};
assert.equal(hasActiveResearchEntitlement(packagedPro), true, "New Pro packages must include Research.");
const proWithResearch = {
  ...packagedPro,
  addOns: {
    research: {
      enabled: true,
      expiresAt: "2099-01-01T00:00:00.000Z",
      source: "webSubscription"
    }
  }
};
assert.equal(activeEntitlementAddOn(proWithResearch, entitlementPackageIDs.research)?.enabled, true);
assert.equal(researchEntitlementMode(proWithResearch), "add-on");
assert.equal(hasActiveResearchEntitlement(proWithResearch), true);
assert.equal(
  hasActiveResearchEntitlement({
    ...proWithResearch,
    addOns: {
      research: {
        enabled: true,
        expiresAt: "2020-01-01T00:00:00.000Z"
      }
    }
  }),
  true,
  "An expired legacy Research add-on must not remove Research included with Pro."
);
assert.equal(
  hasActiveResearchEntitlement({ plan: "pro", source: "lifetimeGrant" }),
  true,
  "Lifetime grants must retain full Research access."
);

const packagedAt = new Date("2026-07-24T18:00:00.000Z");
const newPackagedPro = entitlementWithPackage(null, {
  userID,
  packageID: entitlementPackageIDs.pro,
  source: "webSubscription",
  expiresAt: "2099-01-01T00:00:00.000Z",
  provider: { stripeSubscriptionID: "sub_pro" },
  now: packagedAt
});
assert.equal(newPackagedPro.provider.permitextPackage, entitlementPackageIDs.pro);
assert.equal(hasActiveResearchEntitlement(newPackagedPro), true);
const restoredLegacyPro = entitlementWithPackage(null, {
  userID,
  packageID: entitlementPackageIDs.pro,
  source: "webSubscription",
  provider: { stripeSubscriptionID: "sub_legacy" },
  explicitPackage: false,
  now: packagedAt
});
assert.equal(restoredLegacyPro.legacyResearchIncluded, true);
assert.equal(hasActiveResearchEntitlement(restoredLegacyPro), true);
const refreshedLegacyPro = entitlementWithPackage(restoredLegacyPro, {
  userID,
  packageID: entitlementPackageIDs.pro,
  source: "webSubscription",
  provider: {
    stripeSubscriptionID: "sub_legacy",
    permitextPackage: entitlementPackageIDs.pro
  },
  explicitPackage: true,
  now: packagedAt
});
assert.equal(hasActiveResearchEntitlement(refreshedLegacyPro), true);
const renewedPackagedPro = entitlementWithPackage(newPackagedPro, {
  userID,
  packageID: entitlementPackageIDs.pro,
  source: "webSubscription",
  expiresAt: "2100-01-01T00:00:00.000Z",
  provider: {
    stripeSubscriptionID: "sub_pro",
    stripeEventCreatedAt: "2026-07-24T18:10:00.000Z"
  },
  now: packagedAt
});
const delayedCheckoutPro = entitlementWithPackage(renewedPackagedPro, {
  userID,
  packageID: entitlementPackageIDs.pro,
  source: "webSubscription",
  expiresAt: "2026-07-24T18:15:00.000Z",
  provider: {
    stripeSubscriptionID: "sub_pro",
    stripeCheckoutSessionID: "cs_delayed",
    stripeEventCreatedAt: "2026-07-24T18:00:00.000Z"
  },
  now: packagedAt
});
assert.equal(
  delayedCheckoutPro.expiresAt,
  "2100-01-01T00:00:00.000Z",
  "A delayed checkout event must not shorten a newer subscription period."
);
assert.equal(
  delayedCheckoutPro.provider.stripeSubscriptionID,
  "sub_pro",
  "An older Stripe event must not replace newer provider metadata."
);
const delayedDifferentSubscription = entitlementWithPackage(renewedPackagedPro, {
  userID,
  packageID: entitlementPackageIDs.pro,
  source: "webSubscription",
  expiresAt: "2026-07-24T18:15:00.000Z",
  provider: {
    stripeSubscriptionID: "sub_old",
    stripeCheckoutSessionID: "cs_old",
    stripeEventCreatedAt: "2026-07-24T18:00:00.000Z"
  },
  now: packagedAt
});
assert.equal(
  delayedDifferentSubscription,
  renewedPackagedPro,
  "An older checkout for a different subscription must not replace newer entitlement state."
);
const checkoutWithoutPeriod = entitlementWithPackage(renewedPackagedPro, {
  userID,
  packageID: entitlementPackageIDs.pro,
  source: "webSubscription",
  provider: { stripeSubscriptionID: "sub_pro", stripeCheckoutSessionID: "cs_missing_period" },
  now: packagedAt
});
assert.equal(
  checkoutWithoutPeriod.expiresAt,
  "2100-01-01T00:00:00.000Z",
  "A same-subscription update without a period must preserve the known expiration."
);
const packagedWithResearch = entitlementWithPackage(newPackagedPro, {
  userID,
  packageID: entitlementPackageIDs.research,
  source: "webSubscription",
  expiresAt: "2099-01-01T00:00:00.000Z",
  provider: { stripeSubscriptionID: "sub_research" },
  now: packagedAt
});
assert.equal(hasActiveResearchEntitlement(packagedWithResearch), true);
const researchRevocation = entitlementWithoutPackage(
  packagedWithResearch,
  entitlementPackageIDs.research,
  {
    source: "webSubscription",
    providerKey: "stripeSubscriptionID",
    providerValue: "sub_research"
  },
  packagedAt
);
assert.equal(researchRevocation.changed, true);
assert.equal(hasActiveProEntitlement(researchRevocation.entitlement), true);
assert.equal(
  hasActiveResearchEntitlement(researchRevocation.entitlement),
  true,
  "Removing a legacy add-on must not remove Research included with Pro."
);
const mismatchedRevocation = entitlementWithoutPackage(
  packagedWithResearch,
  entitlementPackageIDs.research,
  {
    providerKey: "stripeSubscriptionID",
    providerValue: "sub_other"
  },
  packagedAt
);
assert.equal(mismatchedRevocation.changed, false);
assert.throws(
  () => entitlementWithPackage(null, {
    userID,
    packageID: entitlementPackageIDs.research,
    source: "webSubscription",
    now: packagedAt
  }),
  /active Pro plan/
);

assert.equal(
  hasActiveProEntitlement({ plan: "pro", expiresAt: "2020-01-01T00:00:00.000Z" }),
  false,
  "Expired Pro grants must not unlock server capabilities."
);

assert.equal(
  postgresMutationRejectionReason({
    userID,
    mutation: savedOverLimit,
    context: {
      active_pro: false,
      saved_item_count: freePlanLimits.savedItems
    }
  }).code,
  "PRO_REQUIRED_SAVED_WORK",
  "PostgreSQL sync must explain Free-plan quota rejections."
);
assert.equal(
  postgresMutationRejectionReason({
    userID,
    mutation: proOnlyMutations[1],
    context: {
      active_pro: false,
      existing_user_id: userID,
      existing_updated_at: "2026-01-03T00:00:00.000Z",
      existing_deleted_at: null,
      existing_mutation: savedAtLimit[0]
    }
  }).code,
  "PRO_REQUIRED_SAVED_WORK",
  "Free cannot update existing work even when its revision is stale."
);
assert.equal(
  postgresMutationRejectionReason({
    userID,
    mutation: proOnlyMutations[1],
    context: {
      active_pro: true,
      existing_user_id: "another-user",
      existing_updated_at: proOnlyMutations[1].savedItem.updatedAt,
      existing_mutation: proOnlyMutations[1]
    }
  }).code,
  "RECORD_OWNERSHIP_MISMATCH",
  "PostgreSQL sync must report ownership conflicts explicitly."
);

console.log("Entitlement contract tests passed.");
