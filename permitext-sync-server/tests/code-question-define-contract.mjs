/**
 * Phase 3 Define-stage contract tests.
 * Drive real exports from public/code-question-define.js.
 */
import assert from "node:assert/strict";
import {
  assertInputPresentationSeparation,
  computeDefinitionDependencyFingerprint,
  createQuestionInput,
  deriveDefineReadiness,
  emptyDefinitionRecord,
  enqueueDefinitionOfflineMutation,
  groupInputsByKind,
  inputKindCssClass,
  inputKindLabel,
  inputRevisionHistory,
  normalizeDefinitionRecord,
  openFactRequest,
  replayDefinitionOfflineQueue,
  resolveFactRequest,
  reviseQuestionInput,
  updateDefinitionFields
} from "../public/code-question-define.js";

const now = "2026-08-03T22:00:00.000Z";
let definition = emptyDefinitionRecord("cq-1", {
  title: "Egress width",
  createdBy: "editor-1",
  createdAt: now
});

// Initial readiness: missing question text blocks approval
let readiness = deriveDefineReadiness(definition, { role: "editor" });
assert.equal(readiness.canEdit, true);
assert.equal(readiness.readOnly, false);
assert.equal(readiness.canApprove, false);
assert.ok(readiness.blockers.some((item) => item.code === "missing-question-text"));

// Viewer/Reviewer are read-only
assert.equal(deriveDefineReadiness(definition, { role: "viewer" }).readOnly, true);
assert.equal(deriveDefineReadiness(definition, { role: "reviewer" }).readOnly, true);
assert.equal(deriveDefineReadiness(definition, { role: "owner" }).canEdit, true);

// Update fields + dependency fingerprint / stale dependents
definition = updateDefinitionFields(definition, {
  questionText: "What minimum clear width applies to the primary corridor?",
  scope: "Primary exit corridor only",
  jurisdiction: "SYNTHETIC-TEST",
  asOfDate: "2026-01-01T00:00:00.000Z",
  desiredOutput: "Internal Code Memo conclusion"
}, { actorUserID: "editor-1", now, expectedVersion: 1 });
assert.equal(definition.definitionRevision, 2);
assert.equal(definition.expectedVersion, 2);
assert.equal(definition.dependentsStale.analysis, true);
assert.equal(definition.dependentsStale.conclusion, true);
assert.equal(definition.dependentsStale.approval, true);
assert.equal(definition.dependentsStale.draft, true);

// Version conflict is explicit
assert.throws(
  () => updateDefinitionFields(definition, { title: "x" }, { expectedVersion: 1 }),
  (error) => error.code === "CODE_QUESTION_VERSION_CONFLICT"
);

// Presentation separation labels
assert.equal(inputKindLabel("confirmedFact"), "Confirmed fact");
assert.equal(inputKindLabel("assumption"), "Assumption");
assert.equal(inputKindLabel("unknown"), "Unknown");
assert.equal(inputKindCssClass("confirmedFact"), "is-confirmed-fact");
assert.equal(inputKindCssClass("assumption"), "is-assumption");
assert.equal(inputKindCssClass("unknown"), "is-unknown");

// Structured inputs
definition = createQuestionInput(definition, {
  inputKind: "confirmedFact",
  statement: "Occupancy group is Business (B).",
  state: "confirmed",
  basis: "Project intake",
  actorUserID: "editor-1",
  responsibleDisplayName: "Alex Editor",
  now
});
definition = createQuestionInput(definition, {
  inputKind: "assumption",
  statement: "Corridor is not part of an accessible means of egress.",
  actorUserID: "editor-1",
  now
});
definition = createQuestionInput(definition, {
  inputKind: "unknown",
  statement: "Measured clear width is not field-verified.",
  actorUserID: "editor-1",
  now
});

assert.throws(
  () => createQuestionInput(definition, {
    inputKind: "assumption",
    statement: "Bad",
    state: "confirmed"
  }),
  /never be stored as confirmed facts/
);

const groups = groupInputsByKind(definition.inputs);
assert.equal(groups.confirmedFacts.length, 1);
assert.equal(groups.assumptions.length, 1);
assert.equal(groups.unknowns.length, 1);
assertInputPresentationSeparation(definition.inputs);

// Unresolved unknown blocks approval/issuance
readiness = deriveDefineReadiness(definition, { role: "editor" });
assert.equal(readiness.canApprove, false);
assert.equal(readiness.canIssue, false);
assert.ok(readiness.blockers.some((item) => item.code === "unresolved-unknown"));
assert.equal(readiness.summary.confirmedFactCount, 1);
assert.equal(readiness.summary.assumptionCount, 1);
assert.equal(readiness.summary.unknownCount, 1);

// Revise unknown to resolved; history reconstructable
const unknownID = groups.unknowns[0].id;
const beforeReviseFp = computeDefinitionDependencyFingerprint(definition);
definition = reviseQuestionInput(definition, unknownID, {
  state: "resolved",
  statement: "Measured clear width is 48 inches (field verified)."
}, { actorUserID: "editor-1", now: "2026-08-03T23:00:00.000Z" });
const history = inputRevisionHistory(definition, unknownID);
assert.ok(history.length >= 2);
assert.equal(definition.inputs.find((item) => item.id === unknownID).state, "resolved");
assert.notEqual(computeDefinitionDependencyFingerprint(definition), beforeReviseFp);
assert.equal(definition.dependentsStale.analysis, true);

readiness = deriveDefineReadiness(definition, { role: "editor" });
assert.equal(readiness.canApprove, true);
assert.equal(readiness.canIssue, true);
assert.equal(readiness.summary.unknownCount, 0);

// Fact requests anchored to inputs
const factInputID = groups.confirmedFacts[0].id;
definition = openFactRequest(definition, {
  inputID: factInputID,
  title: "Confirm occupancy documentation",
  body: "Please attach the intake form page.",
  actorUserID: "reviewer-1",
  actorDisplayName: "Riley Reviewer",
  now
});
assert.equal(definition.factRequests.length, 1);
assert.equal(definition.factRequests[0].requestType, "fact-request");
assert.equal(definition.factRequests[0].inputID, factInputID);
assert.throws(
  () => openFactRequest(definition, {
    inputID: "missing-input",
    title: "Bad anchor"
  }),
  /anchor/
);
readiness = deriveDefineReadiness(definition, { role: "editor" });
assert.ok(readiness.disclosedLimitations.some((item) => item.code === "open-fact-requests"));
definition = resolveFactRequest(definition, definition.factRequests[0].id, {
  actorUserID: "reviewer-1",
  now: "2026-08-03T23:30:00.000Z"
});
assert.equal(definition.factRequests[0].status, "resolved");

// Offline queue + conflict reporting (no silent loss)
definition = enqueueDefinitionOfflineMutation(definition, {
  commandKind: "codeQuestion.definition.update",
  payload: { title: "Egress width (queued)", actorUserID: "editor-1" }
});
assert.equal(definition.offlineQueue.length, 1);
const queuedVersion = definition.offlineQueue[0].expectedVersion;
const conflictReplay = replayDefinitionOfflineQueue(definition, {
  serverVersion: queuedVersion + 1,
  strictConflict: true
});
assert.equal(conflictReplay.results[0].status, "conflict");
assert.equal(conflictReplay.results[0].code, "CODE_QUESTION_VERSION_CONFLICT");
assert.ok(conflictReplay.definition.offlineQueue.some((item) => item.status === "conflict"));

const appliedReplay = replayDefinitionOfflineQueue({
  ...definition,
  offlineQueue: [{
    id: "oq-1",
    commandKind: "codeQuestion.input.save",
    payload: {
      inputKind: "confirmedFact",
      statement: "Construction type is II-B.",
      state: "confirmed",
      actorUserID: "editor-1"
    },
    expectedVersion: definition.expectedVersion,
    createdAt: now,
    status: "queued"
  }]
}, { serverVersion: definition.expectedVersion, strictConflict: false });
assert.equal(appliedReplay.results[0].status, "applied");
assert.ok(appliedReplay.definition.inputs.some((item) => item.statement.includes("II-B")));

// Normalize preserves reconstructable actors/timestamps
const roundTrip = normalizeDefinitionRecord(definition, "cq-1");
assert.equal(roundTrip.questionID, "cq-1");
assert.ok(roundTrip.updatedBy);
assert.ok(roundTrip.inputs.every((item) => item.createdBy || item.updatedBy));

console.log("code-question-define-contract: all assertions passed");
