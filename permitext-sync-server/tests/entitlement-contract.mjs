import assert from "node:assert/strict";
import {
  enforceFreePlanMutationBatch,
  freePlanLimits,
  hasActiveProEntitlement
} from "../entitlement-contract.mjs";

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
decision = enforceFreePlanMutationBatch(savedAtLimit, [savedOverLimit, ...proOnlyMutations], activePro);
assert.equal(decision.acceptedMutations.length, proOnlyMutations.length + 1);

assert.equal(
  hasActiveProEntitlement({ plan: "pro", expiresAt: "2020-01-01T00:00:00.000Z" }),
  false,
  "Expired Pro grants must not unlock server capabilities."
);

console.log("Entitlement contract tests passed.");
