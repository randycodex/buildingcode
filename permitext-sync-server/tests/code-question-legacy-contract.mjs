import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  deterministicCodeQuestionPromotionID,
  normalizeCodeQuestionPromotionPayload
} from "../code-question-contract.mjs";
import {
  deterministicPromotedQuestionID,
  upsertCodeQuestionPromotionArtifact
} from "../code-question-commands.mjs";
import { normalizeCodeQuestionWorkspaceState } from "../public/code-question-workspace.js";
import {
  emptyLegacyWorkspace,
  filterLegacyItems,
  legacyCounts,
  legacyGuidanceForSource,
  mergeLegacyInventory,
  promoteLegacyItem,
  unlinkLegacyPromotion
} from "../public/code-question-legacy.js";

const projectID = "project-legacy-1";
const questionID = "question-legacy-1";
const userID = "owner-legacy-1";
const source = Object.freeze({
  id: "reportDraft:draft-legacy-1",
  sourceKind: "reportDraft",
  sourceID: "draft-legacy-1",
  sourceVersion: 4,
  typeLabel: "Report",
  title: "Existing generic report",
  summary: "Authored background that must remain editable outside the Code Memo.",
  assignment: "project",
  updatedAt: "2026-08-06T12:00:00.000Z"
});
const frozenSource = JSON.stringify(source);

const deterministicID = deterministicCodeQuestionPromotionID({
  ownerID: userID,
  projectID,
  questionID,
  sourceKind: source.sourceKind,
  sourceID: source.sourceID
});
assert.equal(
  deterministicID,
  deterministicCodeQuestionPromotionID({
    ownerID: userID,
    projectID,
    questionID,
    sourceKind: source.sourceKind,
    sourceID: source.sourceID
  }),
  "Promotion relationship IDs must be deterministic."
);
assert.equal(
  deterministicPromotedQuestionID({
    userID,
    projectID,
    sourceKind: source.sourceKind,
    sourceID: source.sourceID,
    idempotencyKey: "create-from-report-1"
  }),
  deterministicPromotedQuestionID({
    userID,
    projectID,
    sourceKind: source.sourceKind,
    sourceID: source.sourceID,
    idempotencyKey: "create-from-report-1"
  }),
  "Retrying create-from-source must resolve to the same distinct Question ID."
);

const normalized = normalizeCodeQuestionPromotionPayload({
  id: deterministicID,
  projectID,
  questionID,
  sourceKind: source.sourceKind,
  sourceID: source.sourceID,
  sourceVersion: source.sourceVersion,
  sourceLabel: source.title,
  sourceProjectID: projectID,
  action: "link-existing",
  status: "linked",
  idempotencyKey: "link-report-1",
  createdByUserID: userID,
  createdAt: "2026-08-06T12:05:00.000Z"
});
assert.equal(normalized.kind, "codeQuestionPromotion");
assert.equal(normalized.sourceID, source.sourceID);
assert.equal(normalized.questionID, questionID);

const created = upsertCodeQuestionPromotionArtifact(null, {
  userID,
  projectID,
  questionID,
  sourceKind: source.sourceKind,
  sourceID: source.sourceID,
  sourceVersion: source.sourceVersion,
  sourceLabel: source.title,
  sourceProjectID: projectID,
  idempotencyKey: "link-report-1",
  now: "2026-08-06T12:05:00.000Z"
});
assert.equal(created.artifact.envelope.id, deterministicID);
assert.equal(created.artifact.payload.status, "linked");
const replay = upsertCodeQuestionPromotionArtifact(created.artifact, {
  userID,
  projectID,
  questionID,
  sourceKind: source.sourceKind,
  sourceID: source.sourceID,
  idempotencyKey: "different-retry-key",
  status: "linked",
  now: "2026-08-06T12:06:00.000Z"
});
assert.equal(replay.replayed, true);
assert.equal(replay.artifact.envelope.version, 1, "Rerun must not create another relationship revision.");

const unlinked = upsertCodeQuestionPromotionArtifact(created.artifact, {
  userID,
  projectID,
  questionID,
  sourceKind: source.sourceKind,
  sourceID: source.sourceID,
  sourceVersion: source.sourceVersion,
  sourceLabel: source.title,
  sourceProjectID: projectID,
  idempotencyKey: "link-report-1",
  status: "unlinked",
  now: "2026-08-06T12:10:00.000Z"
});
assert.equal(unlinked.artifact.payload.status, "unlinked");
assert.equal(unlinked.artifact.payload.sourceID, source.sourceID, "Unlink must preserve source provenance.");
assert.equal(unlinked.artifact.payload.questionID, questionID, "Unlink must preserve recoverable Question identity.");

const recovered = upsertCodeQuestionPromotionArtifact(unlinked.artifact, {
  userID,
  projectID,
  questionID,
  sourceKind: source.sourceKind,
  sourceID: source.sourceID,
  sourceVersion: source.sourceVersion,
  sourceLabel: source.title,
  sourceProjectID: projectID,
  idempotencyKey: "link-report-1",
  status: "linked",
  now: "2026-08-06T12:12:00.000Z"
});
assert.equal(recovered.recovered, true);
assert.equal(recovered.artifact.payload.recoveryCount, 1);

let workspace = mergeLegacyInventory(emptyLegacyWorkspace(projectID), {
  projectID,
  items: [
    source,
    {
      id: "savedItem:saved-1",
      sourceKind: "savedItem",
      sourceID: "saved-1",
      title: "BC 1006.3.2",
      summary: "Saved source; not approved evidence.",
      assignment: "unassigned"
    },
    {
      id: "workboard:board-1",
      sourceKind: "workboard",
      sourceID: "board-1",
      title: "Project Workboard",
      assignment: "project"
    }
  ]
}, projectID);
assert.deepEqual(legacyCounts(workspace.items), {
  total: 3,
  unassigned: 3,
  linked: 0,
  recovery: 0,
  projectOwned: 2,
  accountUnassigned: 1
});
assert.equal(filterLegacyItems(workspace, { sourceKindFilter: "savedItem" }).length, 1);
assert.match(legacyGuidanceForSource("savedItem"), /not approved Evidence/i);

const localLinked = promoteLegacyItem(workspace, source, questionID, {
  projectID,
  actorUserID: userID,
  idempotencyKey: "local-link-1"
});
workspace = localLinked.workspace;
assert.equal(localLinked.replayed, false);
assert.equal(legacyCounts(workspace.items).linked, 1);
const localReplay = promoteLegacyItem(workspace, source, questionID, {
  projectID,
  actorUserID: userID,
  idempotencyKey: "local-link-1"
});
assert.equal(localReplay.replayed, true);
assert.equal(localReplay.workspace.promotions.length, 1);

const localUnlink = unlinkLegacyPromotion(workspace, localLinked.promotion.id, {
  actorUserID: userID,
  at: "2026-08-06T12:20:00.000Z"
});
workspace = localUnlink.workspace;
assert.equal(legacyCounts(workspace.items).recovery, 1);
const localRecovery = promoteLegacyItem(workspace, source, questionID, {
  projectID,
  actorUserID: userID,
  idempotencyKey: "local-link-1",
  at: "2026-08-06T12:22:00.000Z"
});
assert.equal(localRecovery.recovered, true);
assert.equal(localRecovery.promotion.recoveryCount, 1);
assert.equal(JSON.stringify(source), frozenSource, "Promotion and recovery must not mutate the legacy source.");

const workspaceState = normalizeCodeQuestionWorkspaceState({
  activeQuestionID: questionID,
  legacyByProjectID: { [projectID]: localRecovery.workspace }
}, { activeProjectID: projectID });
assert.equal(workspaceState.legacyByProjectID[projectID].promotions.length, 1);

const serverSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
assert.match(serverSource, /projects\/code-questions\/legacy\/list/);
assert.match(serverSource, /projects\/code-questions\/legacy\/promote/);
assert.match(serverSource, /projects\/code-questions\/legacy\/unlink/);
assert.match(serverSource, /sourcePreserved: true/);
assert.match(serverSource, /questionPreserved: true/);

console.log("code-question-legacy-contract: all assertions passed");
