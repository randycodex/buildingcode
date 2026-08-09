import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  acknowledgeCodeQuestionMutation,
  codeQuestionAccountCacheKey,
  codeQuestionMutationIsOfflineSafe,
  conflictCodeQuestionMutation,
  createCodeQuestionOfflineMutation,
  emptyCodeQuestionAccountState,
  enqueueCodeQuestionOfflineMutation,
  evictCodeQuestionProject,
  migrateCodeQuestionAccountState,
  readCodeQuestionAccountState,
  updateCodeQuestionWorkspaceSnapshot,
  workspaceLayoutWithoutCodeQuestionData,
  writeCodeQuestionAccountState
} from "../public/code-question-client-state.js";

class MemoryStorage {
  #values = new Map();
  setCount = 0;

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.setCount += 1;
    this.#values.set(String(key), String(value));
  }

  removeItem(key) {
    this.#values.delete(String(key));
  }
}

const storage = new MemoryStorage();
const accountA = "account-a@example.com";
const accountB = "account-b@example.com";

assert.notEqual(codeQuestionAccountCacheKey(accountA), codeQuestionAccountCacheKey(accountB));
assert.ok(codeQuestionAccountCacheKey(accountA).endsWith(encodeURIComponent(accountA)));

let stateA = updateCodeQuestionWorkspaceSnapshot(
  {
    ...emptyCodeQuestionAccountState(accountA),
    accessByProjectID: {
      "project-a": { role: "editor", permissions: ["codeQuestion.update"] }
    }
  },
  "workspace-main",
  {
    workspace: {
      activeQuestionID: "cq-a-1",
      activeStage: "define",
      openPanes: [
        { projectID: "project-a", questionID: "cq-a-1", paneRole: "research" },
        { projectID: "project-a", questionID: "cq-a-1", paneRole: "decision-record" }
      ],
      questionsByProjectID: {
        "project-a": [{ id: "cq-a-1", title: "Account A question" }]
      }
    },
    paneOrder: [
      "utility:settings",
      "cq:project-a:cq-a-1:research",
      "cq:project-a:cq-a-1:decision-record"
    ],
    paneWeights: {
      "utility:settings": 400,
      "cq:project-a:cq-a-1:research": 520,
      "cq:project-a:cq-a-1:decision-record": 420
    }
  }
);

const queued = createCodeQuestionOfflineMutation({
  accountUserID: accountA,
  clientMutationID: "offline-definition-a-1",
  commandKind: "codeQuestion.definition.update",
  path: "/projects/code-questions/definition/save",
  projectID: "project-a",
  questionID: "cq-a-1",
  expectedVersion: 3,
  payload: {
    projectID: "project-a",
    questionID: "cq-a-1",
    title: "Queued title"
  }
});
stateA = enqueueCodeQuestionOfflineMutation(stateA, queued);
writeCodeQuestionAccountState(storage, stateA, accountA);

const loadedA = readCodeQuestionAccountState(storage, accountA);
assert.equal(loadedA.workspaceSnapshots["workspace-main"].workspace.activeQuestionID, "cq-a-1");
assert.deepEqual(
  loadedA.workspaceSnapshots["workspace-main"].workspace.openPanes.map((pane) => pane.paneRole),
  ["research", "decision-record"]
);
assert.deepEqual(loadedA.workspaceSnapshots["workspace-main"].paneOrder, [
  "cq:project-a:cq-a-1:research",
  "cq:project-a:cq-a-1:decision-record"
]);
assert.deepEqual(loadedA.workspaceSnapshots["workspace-main"].paneWeights, {
  "cq:project-a:cq-a-1:research": 520,
  "cq:project-a:cq-a-1:decision-record": 420
});
assert.equal(loadedA.outbox[0].id, "offline-definition-a-1", "Mutation identity must survive reload/retry.");
assert.equal(loadedA.outbox[0].expectedVersion, 3);
assert.equal(loadedA.accessByProjectID["project-a"].role, "editor");

const writeCount = storage.setCount;
writeCodeQuestionAccountState(storage, loadedA, accountA);
assert.equal(storage.setCount, writeCount, "Semantically unchanged account state must not emit another storage write.");

const loadedB = readCodeQuestionAccountState(storage, accountB);
assert.deepEqual(loadedB.workspaceSnapshots, {}, "Account B must not inherit Account A's workspace cache.");
assert.deepEqual(loadedB.outbox, [], "Account B must not inherit Account A's outbox.");

const conflicted = conflictCodeQuestionMutation(loadedA, queued.id, {
  conflictCode: "CODE_QUESTION_VERSION_CONFLICT",
  serverVersion: 4,
  lastError: "Server version 4 supersedes expected version 3."
});
assert.equal(conflicted.outbox.length, 0);
assert.equal(conflicted.conflicts.length, 1);
assert.equal(conflicted.conflicts[0].mutation.payload.title, "Queued title", "Conflict must preserve local intent.");
assert.equal(conflicted.conflicts[0].serverVersion, 4);
assert.equal(acknowledgeCodeQuestionMutation(conflicted, queued.id).conflicts.length, 0);

assert.throws(
  () => createCodeQuestionOfflineMutation({
    accountUserID: accountA,
    commandKind: "codeQuestion.issue.start",
    path: "/projects/code-questions/issue/start",
    projectID: "project-a",
    questionID: "cq-a-1",
    payload: { projectID: "project-a", questionID: "cq-a-1" }
  }),
  (error) => error?.code === "CODE_QUESTION_ISSUANCE_REQUIRES_ONLINE"
);
assert.equal(codeQuestionMutationIsOfflineSafe(queued), true);
for (const commandKind of [
  "codeQuestion.analysis.create",
  "codeQuestion.conclusion.publish",
  "codeQuestion.conclusion.approve",
  "codeQuestion.evidence.approve",
  "codeQuestion.review.manage",
  "codeQuestion.memo.prepare",
  "codeQuestion.memo.ready",
  "codeQuestion.memo.approve"
]) {
  assert.equal(codeQuestionMutationIsOfflineSafe({ commandKind, path: "/projects/code-questions/command" }), false);
  assert.throws(
    () => createCodeQuestionOfflineMutation({
      accountUserID: accountA,
      commandKind,
      path: "/projects/code-questions/command",
      projectID: "project-a",
      questionID: "cq-a-1",
      payload: { projectID: "project-a", questionID: "cq-a-1" }
    }),
    (error) => error?.code === "CODE_QUESTION_COMMAND_REQUIRES_ONLINE"
  );
}

const legacyUnsafe = writeCodeQuestionAccountState(storage, {
  ...emptyCodeQuestionAccountState("account-c"),
  outbox: [{
    id: "legacy-analysis",
    clientMutationID: "legacy-analysis",
    accountUserID: "account-c",
    commandKind: "codeQuestion.analysis.create",
    path: "/projects/code-questions/analysis/create",
    projectID: "project-c",
    questionID: "cq-c-1",
    payload: { projectID: "project-c", questionID: "cq-c-1" }
  }]
}, "account-c");
assert.equal(legacyUnsafe.outbox.length, 0, "Legacy server-only commands must never replay from offline storage.");
assert.equal(legacyUnsafe.conflicts[0].conflictCode, "CODE_QUESTION_COMMAND_REQUIRES_ONLINE");

const deniedState = evictCodeQuestionProject(loadedA, "project-a", {
  conflictCode: "CODE_QUESTION_ACCESS_REVOKED"
});
assert.equal(deniedState.accessByProjectID["project-a"], undefined);
assert.equal(deniedState.workspaceSnapshots["workspace-main"].workspace.questionsByProjectID["project-a"], undefined);
assert.equal(deniedState.outbox.length, 0);
assert.equal(deniedState.conflicts[0].conflictCode, "CODE_QUESTION_ACCESS_REVOKED");

const targetInitial = updateCodeQuestionWorkspaceSnapshot(
  emptyCodeQuestionAccountState(accountB),
  "workspace-target",
  { workspace: { questionsByProjectID: { "project-b": [{ id: "cq-b-1", title: "B" }] } } }
);
writeCodeQuestionAccountState(storage, targetInitial, accountB);
const mergedAccount = migrateCodeQuestionAccountState(storage, accountA, accountB);
assert.ok(mergedAccount.workspaceSnapshots["workspace-main"], "Source workspace must migrate to merged account.");
assert.ok(mergedAccount.workspaceSnapshots["workspace-target"], "Existing target workspace must be retained.");
assert.equal(mergedAccount.outbox[0].accountUserID, accountB);
assert.equal(storage.getItem(codeQuestionAccountCacheKey(accountA)), null, "Obsolete source cache must be removed.");

const scrubbed = workspaceLayoutWithoutCodeQuestionData({
  readers: [{ id: "reader-1" }],
  codeQuestionWorkspace: {
    questionsByProjectID: {
      "project-a": [{ id: "cq-a-1", title: "Must not leak" }]
    }
  },
  paneOrder: ["reader:1", "cq:project-a:cq-a-1:definition"],
  paneWeights: {
    "reader:1": 600,
    "cq:project-a:cq-a-1:definition": 520
  }
});
assert.equal("codeQuestionWorkspace" in scrubbed, false);
assert.deepEqual(scrubbed.paneOrder, ["reader:1"]);
assert.deepEqual(scrubbed.paneWeights, { "reader:1": 600 });
assert.equal(JSON.stringify(scrubbed).includes("Must not leak"), false);

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
assert.equal(appSource.includes("Queue sample offline save"), false, "Production UI must not expose a synthetic queue mutation.");
assert.ok(appSource.includes("codeQuestionRequestContextIsCurrent(requestContext)"));
assert.ok(appSource.includes('renderWorkspace({ persist: false })'));
assert.ok(appSource.includes('conflictCode: "CODE_QUESTION_DEPENDENCY_CONFLICT"'));
assert.ok(appSource.includes("migrateCodeQuestionAccountState(localStorage, previousUserID, account.appUserID)"));
assert.ok(
  appSource.includes("if (previousUserID && payload.mergedAccount?.sourceUserID === previousUserID)"),
  "Fresh sign-in must not run account-merge migration without a source account."
);
assert.ok(appSource.includes("evictDeniedCodeQuestionCache(error"));
assert.ok(appSource.includes("context.sessionToken === account?.sessionToken"));
assert.ok(appSource.includes("(!context.trackProject || context.projectID === activeProjectIDForCodeQuestions())"));
assert.ok(appSource.includes("postCodeQuestionForContext(requestContext, path"));
assert.ok(appSource.includes("mutation.accountUserID === requestContext.accountUserID"));
assert.ok(appSource.includes("postCodeQuestionForContext(requestContext, mutation.path"));
assert.ok(appSource.includes('postCodeQuestionForContext(requestContext, "/projects/code-questions/issue/start"'));
assert.ok(appSource.includes('postCodeQuestionForContext(requestContext, "/projects/code-questions/issue/complete"'));
assert.equal(appSource.includes('postCodeQuestion("/projects/code-questions/issue/start"'), false);
assert.ok((appSource.match(/evictDeniedCodeQuestionCache\(error/g) || []).length >= 6,
  "Hydration, direct mutation, replay, and issuance denials must converge on authoritative eviction.");

console.log("code-question-client-state-contract: all assertions passed");
