import assert from "node:assert/strict";
import {
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

const savedAtLimit = Array.from({ length: freePlanLimits.savedItems }, (_, index) =>
  mutation("savedItem", `saved-${index + 1}`, { sectionID: index + 1 })
);
const savedOverLimit = mutation("savedItem", "saved-over-limit", { sectionID: 999 });
let decision = enforceFreePlanMutationBatch(savedAtLimit, [savedOverLimit], null);
assert.deepEqual(decision.acceptedMutations, []);
assert.equal(decision.rejectionReasons["saved-over-limit"].code, "FREE_SAVED_ITEM_LIMIT");

const savedUpdate = mutation("savedItem", "saved-1", {
  sectionID: 1,
  title: "Updated",
  updatedAt: "2026-01-02T00:00:00.000Z"
});
decision = enforceFreePlanMutationBatch(savedAtLimit, [savedUpdate], null);
assert.equal(decision.acceptedMutations.length, 1, "Free users must be able to update existing saved records.");

const existingProject = mutation("project", "legacy-project", {
  name: "Existing Project",
  updatedAt: "2026-01-01T00:00:00.000Z"
});
const projectUpdate = mutation("project", "legacy-project", {
  name: "Changed Without Pro",
  updatedAt: "2026-01-02T00:00:00.000Z"
});
decision = enforceFreePlanMutationBatch([existingProject], [projectUpdate], null);
assert.equal(
  decision.rejectionReasons["legacy-project"].code,
  "PRO_REQUIRED_PROJECTS",
  "A lapsed account must retain but not edit a Pro-only Project."
);
const projectDeletion = mutation("project", "legacy-project", {
  name: "Existing Project",
  updatedAt: "2026-01-02T00:00:00.000Z",
  deletedAt: "2026-01-02T00:00:00.000Z"
});
decision = enforceFreePlanMutationBatch([existingProject], [projectDeletion], null);
assert.equal(decision.acceptedMutations.length, 1, "A lapsed account must still be able to delete a Project.");

const deleteSaved = mutation("savedItem", "saved-1", {
  sectionID: 1,
  deletedAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z"
});
decision = enforceFreePlanMutationBatch(savedAtLimit, [deleteSaved, savedOverLimit], null);
assert.equal(decision.acceptedMutations.length, 2, "Deleting an item must release capacity in the same batch.");

const newerSavedAtLimit = savedAtLimit.map((item, index) =>
  index === 0
    ? mutation("savedItem", "saved-1", {
        sectionID: 1,
        updatedAt: "2026-01-03T00:00:00.000Z"
      })
    : item
);
decision = enforceFreePlanMutationBatch(newerSavedAtLimit, [deleteSaved, savedOverLimit], null);
assert.equal(
  decision.rejectionReasons["saved-over-limit"].code,
  "FREE_SAVED_ITEM_LIMIT",
  "A stale deletion must not release Free-plan capacity for a later mutation in the same batch."
);

const notesAtLimit = Array.from({ length: freePlanLimits.notes }, (_, index) =>
  mutation("annotation", `note-${index + 1}`, { sectionID: index + 1, noteBody: `Note ${index + 1}` })
);
const noteOverLimit = mutation("annotation", "note-over-limit", { sectionID: 999, noteBody: "Extra note" });
decision = enforceFreePlanMutationBatch(notesAtLimit, [noteOverLimit], null);
assert.equal(decision.rejectionReasons["note-over-limit"].code, "FREE_NOTE_LIMIT");

const proOnlyMutations = [
  mutation("annotation", "tags-1", { sectionID: 1, tags: ["egress"] }),
  mutation("project", "project-1", { name: "Project" }),
  mutation("projectSection", "project-section-1", { sectionID: 1 }),
  mutation("workboard", "workboard-1", { projectID: "project-1" })
];
decision = enforceFreePlanMutationBatch([], proOnlyMutations, null);
assert.equal(decision.rejectedMutationIDs.length, proOnlyMutations.length);

const activePro = { plan: "pro", expiresAt: "2099-01-01T00:00:00.000Z" };
assert.equal(hasActiveProEntitlement(activePro), true);
assert.equal(
  researchEntitlementMode(activePro),
  "legacy-included",
  "Existing Pro records without package metadata must keep Research during migration."
);
assert.equal(hasActiveResearchEntitlement(activePro), true);
decision = enforceFreePlanMutationBatch(savedAtLimit, [savedOverLimit, ...proOnlyMutations], activePro);
assert.equal(decision.acceptedMutations.length, proOnlyMutations.length + 1);

const packagedPro = {
  plan: "pro",
  expiresAt: "2099-01-01T00:00:00.000Z",
  provider: { permitextPackage: entitlementPackageIDs.pro }
};
assert.equal(hasActiveResearchEntitlement(packagedPro), false, "New Pro packages must not imply Research.");
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
  false,
  "Expired Research add-ons must not remain active."
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
assert.equal(hasActiveResearchEntitlement(newPackagedPro), false);
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
assert.equal(hasActiveResearchEntitlement(researchRevocation.entitlement), false);
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
  "FREE_SAVED_ITEM_LIMIT",
  "PostgreSQL sync must explain Free-plan quota rejections."
);
assert.equal(
  postgresMutationRejectionReason({
    userID,
    mutation: savedUpdate,
    context: {
      active_pro: false,
      existing_user_id: userID,
      existing_updated_at: "2026-01-03T00:00:00.000Z",
      existing_deleted_at: null,
      existing_mutation: newerSavedAtLimit[0]
    }
  }).code,
  "SERVER_NEWER",
  "PostgreSQL sync must distinguish a stale client write from an entitlement rejection."
);
assert.equal(
  postgresMutationRejectionReason({
    userID,
    mutation: savedUpdate,
    context: {
      active_pro: true,
      existing_user_id: "another-user",
      existing_updated_at: savedUpdate.savedItem.updatedAt,
      existing_mutation: savedUpdate
    }
  }).code,
  "RECORD_OWNERSHIP_MISMATCH",
  "PostgreSQL sync must report ownership conflicts explicitly."
);

console.log("Entitlement contract tests passed.");
