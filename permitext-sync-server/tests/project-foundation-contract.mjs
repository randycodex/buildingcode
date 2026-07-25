import assert from "node:assert/strict";
import {
  activityEvent,
  artifactEnvelope,
  capabilityContract,
  conflictPolicies,
  immutableEvidenceSnapshot,
  immutableResearchAnswer,
  ownerScope,
  projectLinkRecord,
  projectMembershipRules,
  syncContract
} from "../project-foundation-contract.mjs";

const owner = ownerScope("user-1");
const createdAt = "2026-07-24T12:00:00.000Z";

const envelope = artifactEnvelope({
  id: "card-1",
  type: "notebookCard",
  owner,
  createdAt
});
assert.deepEqual(Object.keys(envelope).sort(), [
  "archivedAt", "createdAt", "deletedAt", "id", "owner", "type", "updatedAt", "version"
]);
assert.equal(envelope.owner.id, "user-1");
assert.throws(
  () => artifactEnvelope({ type: "canonicalSection", owner, createdAt }),
  /Unsupported artifact type/,
  "Canonical sources must be referenced, not misclassified as user-authored artifacts."
);

const reusableLink = projectLinkRecord({
  id: "link-1",
  owner,
  projectID: "project-1",
  targetKind: "savedItem",
  targetID: "saved-1",
  createdAt
});
assert.equal(reusableLink.relationship, "reference");
assert.equal(projectMembershipRules.savedItem.maximumProjects, null);
assert.equal(projectMembershipRules.researchConversation.maximumProjects, 1);
assert.equal(projectMembershipRules.workboard.relationship, "owner");
assert.equal(projectMembershipRules.workboardPreview.relationship, "owner");
assert.equal(conflictPolicies.workboardPreview, "immutable");
assert.throws(
  () => projectLinkRecord({
    owner,
    projectID: "project-1",
    targetKind: "workboard",
    targetID: "workboard-1",
    relationship: "reference",
    createdAt
  }),
  /owner relationship/
);

const proCapabilities = capabilityContract({ plan: "pro", expiresAt: "2099-01-01T00:00:00.000Z" });
assert.equal(proCapabilities.capabilities["projects"].enabled, true);
assert.equal(proCapabilities.capabilities["collaboration"].enabled, false);
assert.equal(proCapabilities.capabilities.research.enabled, true, "Legacy Pro must keep Research.");
const freeCapabilities = capabilityContract(null);
assert.equal(freeCapabilities.schemaVersion, 2);
assert.equal(freeCapabilities.capabilities["saved-work"].limit, 25);
assert.equal(freeCapabilities.capabilities["projects"].enabled, false);
assert.equal(freeCapabilities.capabilities["offline-access"].enabled, false);
assert.equal(freeCapabilities.capabilities.research.enabled, false);
assert.equal(freeCapabilities.capabilities.research.monthlyLimit, 0);
const packagedProCapabilities = capabilityContract({
  plan: "pro",
  expiresAt: "2099-01-01T00:00:00.000Z",
  provider: { permitextPackage: "pro" }
});
assert.equal(packagedProCapabilities.capabilities.research.enabled, false);
assert.equal(packagedProCapabilities.packages.research.requiresPro, true);
const researchCapabilities = capabilityContract({
  plan: "pro",
  expiresAt: "2099-01-01T00:00:00.000Z",
  provider: { permitextPackage: "pro" },
  addOns: {
    research: {
      enabled: true,
      expiresAt: "2099-01-01T00:00:00.000Z"
    }
  }
});
assert.equal(researchCapabilities.capabilities.research.enabled, true);
assert.equal(researchCapabilities.capabilities.research.monthlyLimit, 100);

const compatibility = syncContract({
  entitlement: null,
  clientSchemaVersion: 1,
  clientCapabilities: ["legacy-sync", "legacy-sync", ""],
  contentMapVersion: 2,
  migrationCheckpoint: { projectFoundation: 1 }
});
assert.equal(compatibility.syncSchemaVersion, 2);
assert.deepEqual(compatibility.clientCapabilities, ["legacy-sync"]);
assert.equal(compatibility.unknownRecordPolicy, "preserve-and-ignore");
assert.equal(conflictPolicies.researchAnswer, "immutable");

const evidence = immutableEvidenceSnapshot({
  id: "evidence-1",
  source: {
    sourceID: "source-1",
    sectionID: "28-101.4.3",
    sectionNumber: "101.4.3",
    chapterNumber: "1",
    codePrefix: "BC",
    codeEdition: "2022 New York City Construction Codes",
    codeVersion: "library-v1",
    text: "The exact approved passage."
  },
  approvedAt: createdAt
});
assert.equal(evidence.passageText, "The exact approved passage.");
assert.equal(evidence.passageTextHash.length, 64);
assert.equal(evidence.snapshotHash.length, 64);

const immutableAnswer = immutableResearchAnswer({
  id: "answer-1",
  owner,
  conversationID: "conversation-1",
  projectID: "project-1",
  question: "What is required?",
  evidence: [evidence],
  answer: {
    conclusion: "The selected passage controls.",
    assumptions: ["The selected edition applies."],
    missingFacts: [],
    evidenceLimitations: [],
    additionalEvidenceNeeded: []
  },
  citations: [{
    sectionID: "28-101.4.3",
    sourceIDs: ["source-1"],
    relevance: "Direct requirement"
  }],
  model: "permitext-test",
  researchSystemVersion: "prompt-1:evidence-1",
  createdAt
});
assert.equal(immutableAnswer.immutable, true);
assert.deepEqual(immutableAnswer.passageToCitationMapping[0].evidenceSnapshotIDs, ["evidence-1"]);
assert.throws(
  () => immutableResearchAnswer({
    owner,
    conversationID: "conversation-1",
    question: "Unsupported?",
    evidence: [evidence],
    answer: {},
    citations: [{ sectionID: "x", sourceIDs: ["unknown"] }],
    model: "test",
    researchSystemVersion: "test",
    createdAt
  }),
  /not backed/
);

const event = activityEvent({
  id: "event-1",
  owner,
  projectID: "project-1",
  actorUserID: "user-1",
  action: "item.linked",
  objectKind: "savedItem",
  objectID: "saved-1",
  newStatus: "linked",
  createdAt
});
assert.equal(event.action, "item.linked");
assert.throws(
  () => activityEvent({
    owner,
    projectID: "project-1",
    actorUserID: "user-1",
    action: "autosave.pulse",
    objectKind: "note",
    objectID: "note-1",
    createdAt
  }),
  /Unsupported activity action/,
  "Implementation noise must not enter the professional activity history."
);

console.log("Project foundation contract tests passed.");
