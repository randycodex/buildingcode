import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  activityEvent,
  artifactEnvelope,
  capabilityContract,
  conflictPolicies,
  immutableEvidenceSnapshot,
  immutableResearchAnswer,
  organizationOwnerScope,
  ownerScope,
  projectLinkRecord,
  projectMembershipRules,
  syncContract
} from "../project-foundation-contract.mjs";

const owner = ownerScope("user-1");
const organizationOwner = organizationOwnerScope("organization-1");
const createdAt = "2026-07-24T12:00:00.000Z";

assert.deepEqual(organizationOwner, {
  kind: "organization",
  id: "organization-1",
  organizationID: "organization-1"
});

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
assert.equal(artifactEnvelope({
  type: "notebookImageAsset",
  owner,
  createdAt
}).type, "notebookImageAsset");
assert.equal(artifactEnvelope({
  type: "notebookCard",
  owner: organizationOwner,
  createdAt
}).owner.kind, "organization");
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
assert.equal(conflictPolicies.notebookImageAsset, "immutable-binary-metadata-revision");
assert.equal(projectMembershipRules.projectNote.relationship, "owner");
assert.equal(projectMembershipRules.reviewThread.relationship, "owner");
assert.equal(projectMembershipRules.reviewComment.relationship, "reference");
assert.equal(conflictPolicies.projectNote, "explicit-revision");
assert.equal(conflictPolicies.reviewThread, "explicit-revision");
assert.equal(conflictPolicies.reviewComment, "immutable");
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
const organizationCapabilities = capabilityContract(
  { plan: "pro", expiresAt: "2099-01-01T00:00:00.000Z" },
  Date.now(),
  {
    collaborationEnabled: true,
    organizationAdministrationEnabled: true
  }
);
assert.equal(organizationCapabilities.capabilities["collaboration"].enabled, true);
assert.equal(organizationCapabilities.capabilities["organization-administration"].enabled, true);
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
assert.equal(researchCapabilities.capabilities["evidence-discovery"].enabled, false);
const discoveryCapabilities = capabilityContract(
  {
    plan: "pro",
    expiresAt: "2099-01-01T00:00:00.000Z",
    provider: { permitextPackage: "pro" },
    addOns: {
      research: {
        enabled: true,
        expiresAt: "2099-01-01T00:00:00.000Z"
      }
    }
  },
  Date.now(),
  { evidenceDiscoveryEnabled: true }
);
assert.equal(discoveryCapabilities.capabilities["evidence-discovery"].enabled, true);
assert.equal(discoveryCapabilities.capabilities["evidence-discovery"].release, "private-beta");

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

const structuredGrids = [{
  rows: [{
    cells: [
      { text: "Occupancy", rowSpan: 2, columnSpan: 1 },
      { text: "Water closets", rowSpan: 1, columnSpan: 2 }
    ]
  }]
}];
const structuredText = "Table 403.1 Minimum Number of Required Plumbing Fixtures";
const structuredReference = "PC Table 403.1";
const structuredContentHash = createHash("sha256")
  .update(JSON.stringify({
    reference: structuredReference,
    text: structuredText,
    grids: structuredGrids
  }))
  .digest("hex");
const structuredEvidence = immutableEvidenceSnapshot({
  id: "evidence-structured-1",
  source: {
    sourceID: "source-structured-1",
    sectionID: "11909",
    sectionNumber: "403.1",
    chapterNumber: "4",
    codePrefix: "PC",
    codeEdition: "2022 New York City Construction Codes",
    codeVersion: "library-v1",
    text: structuredText,
    richSourceID: "rich-source-table-403-1",
    richSourceKind: "table",
    richSourceReference: structuredReference,
    richSourceContentHash: structuredContentHash,
    richSourceRowCount: 1,
    richSourceGrids: structuredGrids
  },
  approvedAt: createdAt
});
assert.equal(structuredEvidence.structuredSource.reference, structuredReference);
assert.equal(structuredEvidence.structuredSource.contentHash, structuredContentHash);
assert.equal(structuredEvidence.structuredSource.grids[0].rows[0].cells[0].rowSpan, 2);

const visualBody = Buffer.from("immutable official visual evidence");
const visualContentHash = createHash("sha256").update(visualBody).digest("hex");
const visualEvidence = immutableEvidenceSnapshot({
  id: "evidence-visual-1",
  source: {
    sourceID: "source-visual-1",
    sectionID: "6881",
    sectionNumber: "D106.1",
    chapterNumber: "D",
    codePrefix: "BC",
    codeEdition: "2022 New York City Construction Codes",
    codeVersion: "library-v1",
    text: "The exact approved map-dependent passage.",
    visualSources: [{
      id: "visual-source-map-1",
      kind: "image",
      assetName: "official-map.jpg",
      assetURL: "/code/assets/official-map.jpg",
      mediaType: "image/jpeg",
      contentHash: visualContentHash,
      byteLength: visualBody.length,
      displayWidth: 640,
      displayHeight: 480,
      dataBase64: visualBody.toString("base64")
    }]
  },
  approvedAt: createdAt
});
assert.equal(visualEvidence.visualSources[0].contentHash, visualContentHash);
assert.equal(visualEvidence.visualSources[0].dataBase64, visualBody.toString("base64"));
assert.equal(visualEvidence.visualSources[0].byteLength, visualBody.length);
let rejectedTamperedVisualEvidence = false;
try {
  immutableEvidenceSnapshot({
    id: "evidence-visual-tampered",
    source: {
      ...visualEvidence,
      text: visualEvidence.passageText,
      codeVersion: visualEvidence.sourceLibraryVersion,
      visualSources: [{
        ...visualEvidence.visualSources[0],
        dataBase64: Buffer.from("tampered").toString("base64")
      }]
    },
    approvedAt: createdAt
  });
} catch {
  rejectedTamperedVisualEvidence = true;
}
assert.equal(rejectedTamperedVisualEvidence, true);

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
assert.equal(activityEvent({
  owner,
  projectID: "project-1",
  actorUserID: "user-1",
  action: "review-thread.status.changed",
  objectKind: "reviewThread",
  objectID: "thread-1",
  previousStatus: "open",
  newStatus: "resolved",
  createdAt
}).newStatus, "resolved");
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
