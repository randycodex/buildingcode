import assert from "node:assert/strict";
import {
  codeQuestionListFromServer,
  codeQuestionViewModelsFromServer
} from "../public/code-question-server.js";

const at = "2026-08-07T12:00:00.000Z";
const envelope = (id, type, version = 1) => ({ id, type, version, createdAt: at, updatedAt: at });

const list = codeQuestionListFromServer({ questions: [{
  id: "cq-1", displayID: "Q-001", title: "Egress", updatedAt: at
}] });
assert.equal(list[0].id, "cq-1");
assert.equal(list[0].lastActivityAt, at);

const state = {
  questionID: "cq-1",
  access: { role: "editor", permissions: ["code-question.edit"] },
  question: {
    envelope: envelope("cq-1", "codeQuestion", 2),
    payload: {
      title: "Egress", questionText: "Is the corridor sufficient?", scope: "Floor 2",
      desiredOutput: "Decision", jurisdiction: "NYC", definitionRevision: 2,
      createdBy: "owner", updatedBy: "editor", createdAt: at, updatedAt: at
    }
  },
  artifacts: [
    {
      envelope: envelope("input-1", "questionInput", 2),
      payload: { id: "input-1", questionID: "cq-1", inputKind: "confirmedFact", statement: "44 inches", state: "confirmed", revision: 2 }
    },
    {
      envelope: envelope("snapshot-1", "evidenceSnapshotV2"),
      payload: { id: "snapshot-1", sourceIdentity: "BC", passageLocator: "1005.1", quotedText: "Width", textHash: "text-hash", createdAt: at }
    },
    {
      envelope: envelope("set-1", "questionEvidenceSet"),
      payload: { id: "set-1", questionID: "cq-1", version: 1, contentHash: "set-hash", entries: [{ snapshotID: "snapshot-1", role: "governing", analysisEligible: true }] }
    },
    {
      envelope: envelope("analysis-1", "questionAnalysis"),
      payload: { questionID: "cq-1", dependencyHash: "dependency-hash", requestID: "request-1", researchAnswerID: "answer-1", modelID: "test", createdAt: at }
    },
    {
      envelope: envelope("conclusion-1", "professionalConclusion"),
      payload: { questionID: "cq-1", revision: 1, conclusionText: "Yes", citations: ["snapshot-1"], createdAt: at }
    },
    {
      envelope: envelope("issued-1", "issuedDecisionRecord"),
      payload: { questionID: "cq-1", issueVersion: 1, componentVersions: { draftRevision: 1 }, componentHashes: { manifest: "manifest-hash" }, issuedAt: at }
    }
  ],
  researchAnswers: [{
    id: "answer-1",
    answer: {
      conclusion: "Supported",
      explanation: "Bounded",
      evidenceLimitations: ["Selected evidence only"],
      citations: [{ sourceIDs: ["snapshot-1"], relevance: "Controls" }]
    }
  }],
  activity: [],
  pendingIssuance: [],
  analysisBinding: {
    questionID: "cq-1", definitionRevision: 2, definitionHash: "definition-hash",
    inputSnapshotIDs: ["input-1"], inputSetHash: "input-hash", evidenceSetID: "set-1",
    evidenceSetVersion: 1, evidenceSetHash: "set-hash", dependencyHash: "dependency-hash"
  }
};

const models = codeQuestionViewModelsFromServer(state);
assert.equal(models.definition.expectedVersion, 2);
assert.equal(models.definition.inputs[0].expectedVersion, 2);
assert.equal(models.evidence.evidenceSets[0].immutable, true);
assert.equal(models.analysis.runs[0].answer.citations[0].snapshotIDs[0], "snapshot-1");
assert.equal(models.analysis.serverBinding.dependencyHash, "dependency-hash");
assert.equal(models.analysis.conclusionRevisions[0].immutable, true);
assert.equal(models.issue.issuedRecords[0].manifestHash, "manifest-hash");
assert.equal(models.access.role, "editor");

console.log("code-question-server-adapter-contract: all assertions passed");
