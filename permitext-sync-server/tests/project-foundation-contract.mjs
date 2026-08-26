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
assert.equal(
  freeCapabilities.capabilities["code-question-workspace"].enabled,
  false,
  "Code Question workspace capability must default disabled."
);
assert.equal(
  freeCapabilities.capabilities["code-question-workspace"].featureFlag,
  "permitext:codeQuestionWorkspace"
);
const packagedProCapabilities = capabilityContract({
  plan: "pro",
  expiresAt: "2099-01-01T00:00:00.000Z",
  provider: { permitextPackage: "pro" }
});
assert.equal(packagedProCapabilities.capabilities.research.enabled, true);
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
assert.equal(researchCapabilities.capabilities.research.monthlyLimit, null);
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
const officialGuidanceClaim = "Registered low-pressure boilers listed by DOB require annual inspections.";
const officialGuidanceAuthority = "Official supporting guidance — noncontrolling and not an enacted-code conclusion.";
const officialGuidanceExplanation = `- ${officialGuidanceClaim}`;
const officialGuidanceBoundary = "The assembled enacted evidence did not establish the requested rule; Permitext is reporting only the exact official supporting guidance attributed below.";
const emptyGuidanceAnalysis = {
  controllingProvisions: [],
  generalRules: [],
  exceptions: [],
  conditions: [],
  limitations: [],
  definitions: [],
  crossReferences: [],
  tables: [],
  userPinnedEvidence: [],
  permitextDiscoveredEvidence: [],
  projectFactsUsed: [],
  unresolvedProjectFacts: [],
  evidenceLimitations: [],
  highValueFollowUpQuestions: []
};
const officialGuidanceInputAnswer = {
  answerText: `${officialGuidanceAuthority}\n\n${officialGuidanceExplanation}`,
  conclusion: officialGuidanceAuthority,
  explanation: officialGuidanceExplanation,
  authorityStatus: "official_supporting_guidance",
  authorityLabel: "Official supporting guidance — noncontrolling",
  supportedPoints: [],
  assumptions: [],
  missingFacts: [],
  followUpQuestions: [],
  evidenceLimitations: [officialGuidanceBoundary],
  additionalEvidenceNeeded: [],
  citations: [],
  retrieval: { allowOfficialGuidanceOnly: true },
  verification: { status: "passed", pass: true },
  structuredEvidenceAnalysis: emptyGuidanceAnalysis,
  factUsage: { schemaVersion: 1, projectContext: [], conversation: [], other: [] },
  supportingSourceUses: [{
    sourceID: "web-source-boiler",
    claimID: "web-claim-boiler",
    claim: officialGuidanceClaim
  }],
  supportingSources: [{
    id: "web-source-boiler",
    url: "https://www.nyc.gov/site/buildings/safety/boiler-compliance.page",
    title: "Boiler Compliance",
    publisher: "NYC Department of Buildings",
    attributedClaims: [{ id: "web-claim-boiler", text: officialGuidanceClaim }],
    authorityClass: "official_guidance",
    role: "supporting",
    controlling: false,
    claim: officialGuidanceClaim
  }]
};
const officialGuidanceAnswer = immutableResearchAnswer({
  id: "answer-official-guidance",
  owner,
  conversationID: "conversation-official-guidance",
  question: "What does current official DOB boiler guidance say?",
  evidence: [],
  answer: officialGuidanceInputAnswer,
  citations: [],
  model: "permitext-test",
  researchSystemVersion: "prompt-1:evidence-1:official-web-v1",
  createdAt
});
assert.deepEqual(officialGuidanceAnswer.citations, []);
assert.deepEqual(officialGuidanceAnswer.passageToCitationMapping, []);
const duplicateClaimGuidanceInput = structuredClone(officialGuidanceInputAnswer);
duplicateClaimGuidanceInput.supportingSourceUses.push({
  sourceID: "web-source-boiler-duplicate",
  claimID: "web-claim-boiler-duplicate",
  claim: officialGuidanceClaim
});
duplicateClaimGuidanceInput.supportingSources.push({
  ...structuredClone(officialGuidanceInputAnswer.supportingSources[0]),
  id: "web-source-boiler-duplicate",
  url: "https://www.nyc.gov/site/buildings/safety/boiler-faq.page",
  attributedClaims: [{ id: "web-claim-boiler-duplicate", text: officialGuidanceClaim }]
});
const duplicateClaimGuidanceAnswer = immutableResearchAnswer({
  id: "answer-official-guidance-duplicate-claim",
  owner,
  conversationID: "conversation-official-guidance-duplicate-claim",
  question: "What do two current official DOB boiler pages say?",
  evidence: [],
  answer: duplicateClaimGuidanceInput,
  citations: [],
  model: "permitext-test",
  researchSystemVersion: "prompt-1:evidence-1:official-web-v1",
  createdAt
});
assert.equal(duplicateClaimGuidanceAnswer.answer.explanation, officialGuidanceExplanation);
let unsafeGuidanceCounter = 0;
function assertRejectsUnsafeOfficialGuidance(mutate, message) {
  const unsafeAnswer = structuredClone(officialGuidanceInputAnswer);
  mutate(unsafeAnswer);
  unsafeGuidanceCounter += 1;
  assert.throws(
    () => immutableResearchAnswer({
      id: `answer-unsafe-guidance-${unsafeGuidanceCounter}`,
      owner,
      conversationID: `conversation-unsafe-guidance-${unsafeGuidanceCounter}`,
      question: "What does current official DOB boiler guidance say?",
      evidence: [],
      answer: unsafeAnswer,
      citations: [],
      model: "permitext-test",
      researchSystemVersion: "prompt-1:evidence-1:official-web-v1",
      createdAt
    }),
    /require evidence/,
    message
  );
}
assertRejectsUnsafeOfficialGuidance(
  (answer) => { answer.authorityLabel = "Supported by enacted text"; },
  "Citation-free official guidance must retain the exact authority label."
);
assertRejectsUnsafeOfficialGuidance(
  (answer) => { answer.answerText += "\n\nAn unbound extra conclusion."; },
  "Citation-free official guidance must reject extra unbound prose."
);
assertRejectsUnsafeOfficialGuidance(
  (answer) => { answer.supportingSources.push(structuredClone(answer.supportingSources[0])); },
  "Citation-free official guidance must reject an extra unreferenced source."
);
assertRejectsUnsafeOfficialGuidance(
  (answer) => { answer.supportingSources[0].url = "https://nyc.gov.evil.example/boiler"; },
  "Citation-free official guidance must reject a spoofed official host."
);
assertRejectsUnsafeOfficialGuidance(
  (answer) => { answer.evidenceLimitations.push("An unbound extra limitation."); },
  "Citation-free official guidance must reject extra limitations."
);
assert.throws(
  () => immutableResearchAnswer({
    id: "answer-unsafe-guidance-citation",
    owner,
    conversationID: "conversation-unsafe-guidance-citation",
    question: "What does current official DOB boiler guidance say?",
    evidence: [],
    answer: officialGuidanceInputAnswer,
    citations: [{ sectionID: "x", sourceIDs: ["unknown"] }],
    model: "permitext-test",
    researchSystemVersion: "prompt-1:evidence-1:official-web-v1",
    createdAt
  }),
  /require evidence|not backed/,
  "Official guidance must not accept an unbound enacted citation."
);
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
assert.equal(activityEvent({
  owner,
  projectID: "project-1",
  actorUserID: "user-1",
  action: "review-thread.assignee.changed",
  objectKind: "reviewThread",
  objectID: "thread-1",
  createdAt,
  metadata: { previousAssigneeUserID: null, assigneeUserID: "editor-1" }
}).metadata.assigneeUserID, "editor-1");
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
