import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { researchClarificationAnswer } from "../research-conversation-continuity.mjs";
import { researchProgressStages } from "../public/research-progress.js";
import { researchSystemRecoveryReasons, researchFailureRecovery } from "../public/research-failure-recovery.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const marker = source.includes(`async function ${name}(`) ? `async function ${name}(` : `function ${name}(`;
  const start = source.indexOf(marker), end = source.indexOf("\n}", start);
  assert(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
function element() {
  return { dataset: {}, children: [], style: { setProperty() {} }, setAttribute() {},
    append(...nodes) { this.children.push(...nodes); }, addEventListener() {} };
}
function all(node) { return [node, ...node.children.flatMap(all)]; }
const context = vm.createContext({ Date, Map, document: { createElement: element }, researchProgressStages, researchSystemRecoveryReasons, researchFailureRecovery });
vm.runInContext(["researchAnswerHasVerificationRecovery", "researchProgressStatusLabel", "researchProgressFromSavedMessage",
  "researchProgressElapsed", "renderResearchPixelGrid", "renderResearchProgressCard"].map(extract).join("\n"), context);
const savedMessage = answer => ({ id: "historical-v6", role: "assistant", answer, createdAt: "2026-10-03T07:00:00.000Z",
  researchProgress: { status: "completed", startedAt: "2026-10-03T06:59:40.000Z", completedAt: "2026-10-03T07:00:00.000Z",
    stages: researchProgressStages.map(stage => ({ id: stage.id, state: "completed" })) } });

for (const reason of researchSystemRecoveryReasons) {
  const message = savedMessage(researchClarificationAnswer("Does this room have enough headroom?", reason));
  const snapshot = JSON.stringify(message);
  const reopened = context.researchProgressFromSavedMessage(message);
  assert.equal(reopened.status, "completed", "The saved request lifecycle remains unchanged.");
  assert.equal(context.researchProgressStatusLabel(reopened), "Research incomplete",
    "Reopened historical recovery answers cannot claim Research complete.");
  const card = context.renderResearchProgressCard(reopened, { completed: true });
  assert.equal(all(card).find(node => node.className === "research-progress-loading-label").textContent, "Research incomplete");
  assert.equal(all(card).find(node => node.className === "research-progress-elapsed").textContent, "00:20");
  assert(!all(card).some(node => /research-progress-(?:error|actions)/.test(node.className || "")),
    "A saved explanation remains the recovery narrative; the status must not add a duplicate error or retry flow.");
  assert.equal(JSON.stringify(message), snapshot, "Historical answer/progress data is never rewritten.");
}
for (const answer of [
  { mode: "openai", answerText: "The room meets this minimum.", verification: { pass: true } },
  researchClarificationAnswer("What uses face the street?", "evidence"),
  researchClarificationAnswer("What uses face the street?", "verification"),
  { mode: "openai", answerText: "The phrase ‘could not finish checking’ appears in the example.", verification: { pass: true } },
  { ...researchClarificationAnswer("What uses face the street?", "evidence"), answerText: "Research could not finish checking a hypothetical example." }
]) assert.equal(context.researchProgressStatusLabel(context.researchProgressFromSavedMessage(savedMessage(answer))), "Research complete",
  "Successes and genuine factual clarifications retain completion; narrative words alone do not classify failures.");
assert.equal(context.researchProgressFromSavedMessage({ ...savedMessage({}), researchProgress: { status: "failed", stages: [] } }), null);
assert.equal(context.researchProgressStatusLabel({ status: "failed", stages: new Map() }), "Research interrupted");
assert.equal(context.researchProgressStatusLabel({ status: "cancelled", stages: new Map() }), "Research cancelled");

// Run the shipped completion handler with synthetic transport. The first
// completed paint must match the response before the saved conversation rerenders.
for (const [answer, expected] of [
  [researchClarificationAnswer("Does this room have enough headroom?", "verification_incomplete"), "Research incomplete"],
  [{ mode: "openai", verification: { pass: true } }, "Research complete"],
  [researchClarificationAnswer("Which room use is proposed?", "evidence"), "Research complete"]
]) {
  const paints = [];
  const message = { ...savedMessage(answer), requestID: "request" };
  const response = { conversation: { id: "conversation", messages: [message] } };
  const progress = { id: "request", conversationID: "conversation", question: "Retained headroom question", status: "active", stages: new Map(), controller: new AbortController() };
  const live = vm.createContext({ Date, Map, clearInterval() {}, localStorage: {}, researchProgressStages, researchSystemRecoveryReasons, researchFailureRecovery,
    activeResearchProgress: new Map([[progress.conversationID, progress]]), captureAccountRequest: () => ({}),
    isCurrentAccountRequest: () => true, requireCurrentAccountRequest() {}, captureResearchProgressView: () => ({}),
    researchProgressConversationConflict: () => null, researchProgressViewIsCurrent: () => true,
    persistResearchProgressSession() {}, postResearchWithProgress: async () => response,
    researchRequestRecoveryScope: () => ({}), removeResearchRequestRecovery() {},
    refreshResearchProgressCard(value) { paints.push(live.researchProgressStatusLabel(value)); },
    researchFailureMessage: error => error.message, researchUsage: null });
  vm.runInContext(["researchAnswerHasVerificationRecovery", "researchProgressStatusLabel", "runResearchProgressSession"].map(extract).join("\n"), live);
  await live.runResearchProgressSession(progress);
  assert.equal(progress.status, "completed", progress.error);
  assert.deepEqual(paints, [expected]);
}
console.log("Research answer status passed: live and reopened verification recovery read incomplete, success/factual clarification stay complete, elapsed/history/lifecycle remain intact; synthetic transport only.");
