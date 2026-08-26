import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import {
  clearResearchRequestRecoveries,
  createResearchProgressEvent,
  readResearchRequestRecovery,
  removeResearchRequestRecovery,
  researchRequestRecoveryMaxAgeMilliseconds,
  researchRequestRecoveryStorageKey,
  researchProgressStages,
  researchProgressStates,
  researchProgressSummary,
  writeResearchRequestRecovery
} from "../public/research-progress.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

const expectedStages = [
  ["preparing_question", "Preparing the question"],
  ["searching_authorized_library", "Searching the authorized enacted library"],
  ["reviewing_provisions", "Reviewing potentially applicable provisions"],
  ["following_cross_references", "Following cross-references"],
  ["checking_citation_support", "Checking citation support"],
  ["preparing_conclusion", "Preparing the conclusion"]
];

assert.deepEqual(
  researchProgressStages.map((stage) => [stage.id, stage.label]),
  expectedStages,
  "Public Research progress stages changed order or wording."
);
assert.deepEqual(
  researchProgressStates,
  ["pending", "active", "completed", "failed", "cancelled", "retrying"],
  "Research progress states no longer cover the required public lifecycle."
);

const emitted = expectedStages.flatMap(([stageID], index) => [
  createResearchProgressEvent({ stageID, state: "active", sequence: index * 2 + 1 }),
  createResearchProgressEvent({ stageID, state: "completed", sequence: index * 2 + 2 })
]);
for (const event of emitted) {
  assert.deepEqual(
    Object.keys(event).sort(),
    ["at", "label", "sequence", "stage", "state", "version"],
    "Research progress exposed a field outside the public contract."
  );
  assert.doesNotMatch(
    JSON.stringify(event),
    /prompt|reasoning|thought|token|cost|limit|model|provider|internal/i,
    "Research progress exposed private operational or reasoning metadata."
  );
}
assert.throws(
  () => createResearchProgressEvent({ stageID: "model_reasoning", state: "active", sequence: 1 }),
  /Unsupported public Research progress stage/
);
assert.throws(
  () => createResearchProgressEvent({ stageID: "preparing_question", state: "thinking", sequence: 1 }),
  /Unsupported emitted Research progress state/
);

const summary = researchProgressSummary(emitted, {
  startedAt: emitted[0].at,
  completedAt: emitted.at(-1).at
});
assert.equal(summary.status, "completed");
assert(summary.stages.every((stage) => stage.state === "completed"));

const recoveryStorage = new MemoryStorage();
const recoveryNow = Date.parse("2026-08-26T16:00:00.000Z");
const recovery = {
  accountUserID: "account-a",
  workspaceID: "workspace-a",
  conversationID: "conversation-a",
  requestID: "request-stable",
  question: "What official guidance applies?",
  status: "cancelled",
  startedAt: recoveryNow - 10_000,
  endedAt: recoveryNow - 1_000,
  error: "Research was cancelled. Your question is still here.",
  errorCode: "RESEARCH_CANCELLED",
  stages: researchProgressStages.map((stage, index) => ({
    id: stage.id,
    state: index === 0 ? "completed" : index === 1 ? "cancelled" : "pending"
  }))
};
assert.equal(writeResearchRequestRecovery(recoveryStorage, recovery, recoveryNow), true);
assert.equal(
  readResearchRequestRecovery(recoveryStorage, {
    accountUserID: "account-a",
    workspaceID: "workspace-a",
    conversationID: "conversation-a"
  }, recoveryNow)?.requestID,
  "request-stable",
  "A cancelled question did not retain the idempotent request ID needed by Retry."
);
assert.equal(
  readResearchRequestRecovery(recoveryStorage, {
    accountUserID: "account-b",
    workspaceID: "workspace-a",
    conversationID: "conversation-a"
  }, recoveryNow),
  null,
  "A recovered Research question leaked across accounts."
);
assert.equal(
  readResearchRequestRecovery(recoveryStorage, {
    accountUserID: "account-a",
    workspaceID: "workspace-b",
    conversationID: "conversation-a"
  }, recoveryNow),
  null,
  "A recovered Research question leaked across named workspaces."
);

writeResearchRequestRecovery(recoveryStorage, {
  ...recovery,
  conversationID: "conversation-active",
  requestID: "request-active",
  status: "active",
  endedAt: null
}, recoveryNow + 1);
assert.equal(
  readResearchRequestRecovery(recoveryStorage, {
    accountUserID: "account-a",
    workspaceID: "workspace-a",
    conversationID: "conversation-active"
  }, recoveryNow + 1)?.endedAt,
  null,
  "An active recovery incorrectly acquired a completion timestamp."
);
removeResearchRequestRecovery(recoveryStorage, {
  accountUserID: "account-a",
  conversationID: "conversation-a"
}, recoveryNow + 2);
assert.equal(
  readResearchRequestRecovery(recoveryStorage, {
    accountUserID: "account-a",
    workspaceID: "workspace-a",
    conversationID: "conversation-a"
  }, recoveryNow + 2),
  null,
  "A completed or deleted conversation left its pending recovery behind."
);

writeResearchRequestRecovery(recoveryStorage, {
  ...recovery,
  conversationID: "conversation-expired",
  requestID: "request-expired"
}, recoveryNow - researchRequestRecoveryMaxAgeMilliseconds - 1);
assert.equal(
  readResearchRequestRecovery(recoveryStorage, {
    accountUserID: "account-a",
    workspaceID: "workspace-a",
    conversationID: "conversation-expired"
  }, recoveryNow),
  null,
  "Expired failed questions were retained beyond the bounded recovery period."
);
recoveryStorage.setItem(researchRequestRecoveryStorageKey, "not-json");
assert.equal(
  readResearchRequestRecovery(recoveryStorage, {
    accountUserID: "account-a",
    workspaceID: "workspace-a",
    conversationID: "conversation-a"
  }, recoveryNow),
  null,
  "Malformed recovery storage did not fail closed."
);
writeResearchRequestRecovery(recoveryStorage, recovery, recoveryNow);
clearResearchRequestRecoveries(recoveryStorage, { accountUserID: "account-a" }, recoveryNow);
assert.equal(JSON.parse(recoveryStorage.getItem(researchRequestRecoveryStorageKey)).length, 0);

const assemblyStages = [];
await assembleResearchEvidence({
  question: "What enacted provisions apply?",
  discover: async () => ({ candidates: [] }),
  resolveSection: async () => null,
  onStage: (stageID, state) => assemblyStages.push([stageID, state])
});
assert.deepEqual(assemblyStages, [
  ["searching_authorized_library", "active"],
  ["searching_authorized_library", "completed"],
  ["reviewing_provisions", "active"],
  ["reviewing_provisions", "completed"],
  ["following_cross_references", "active"],
  ["following_cross_references", "completed"]
], "Evidence assembly no longer reports its real observable stages in order.");

const [serverSource, providerClientSource, clientSource, styleSource] = await Promise.all([
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../research-provider-client.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8")
]);
assert(serverSource.includes('context.body.progressStream === "ndjson"'));
assert(serverSource.includes("requestResearchProvider({"));
assert(serverSource.includes("signal: options.signal"));
assert(providerClientSource.includes("AbortSignal.any([signal, timeoutSignal])"));
assert(clientSource.includes("new AbortController()"));
assert(clientSource.includes("persistResearchProgressSession(progress)"));
assert(clientSource.includes("restoreResearchProgressSession(conversation)"));
assert(clientSource.includes("{ retrying: true }"));
assert(clientSource.includes("requestID: progress.id"));
assert(clientSource.includes("removeResearchRequestRecovery("));
assert(clientSource.includes("Permitext could not retrieve attributable official guidance from the approved sources. Your question is still here."));
assert(clientSource.includes('error.name === "AbortError"'));
assert(!clientSource.includes('className = "research-progress-details"'), "Research progress cards still expose the internal stage checklist.");
assert(!clientSource.includes('className = "research-progress-tasks"'), "Research progress task rows are still rendered.");
assert.match(styleSource, /\.research-progress-card\s*\{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
assert.match(clientSource, /cancel\.className = "ghost-button research-progress-cancel"/);
assert.match(clientSource, /retry\.className = "ghost-button research-progress-retry"/);
assert.match(styleSource, /\.research-progress-actions \.research-progress-cancel,[\s\S]*?\.research-progress-actions \.research-progress-retry \{[\s\S]*?min-height: 42px;[\s\S]*?border: 0;[\s\S]*?border-radius: var\(--radius-pill\);[\s\S]*?background: rgb\(246 244 241 \/ 10%\);[\s\S]*?color: #fff;/);
assert.match(styleSource, /workspace-panel:not\(\.reader-panel\) \.research-progress-loading-label\s*\{[\s\S]*?font-size: 14px !important;[\s\S]*?font-weight: 400;/);
assert.match(styleSource, /workspace-panel:not\(\.reader-panel\) \.research-progress-elapsed\s*\{[\s\S]*?font-size: 14px !important;[\s\S]*?font-weight: 400;/);
assert(styleSource.includes("grid-template-columns: repeat(3, 2px)"));
assert(!styleSource.includes("research-progress-shimmer"), "Research status text still uses a blinking shimmer animation.");
assert.match(styleSource, /\.research-message\.is-assistant\.is-pending\s*\{\s*min-block-size: 0;/);
assert.match(styleSource, /\.research-progress-loading\s*\{[\s\S]*?grid-template-columns: auto auto;[\s\S]*?justify-content: end;/);
assert.match(styleSource, /\.research-progress-elapsed\s*\{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?justify-self: end;/);
assert(styleSource.includes("@media (prefers-reduced-motion: reduce)"));

console.log("permitext research progress contract passed");
