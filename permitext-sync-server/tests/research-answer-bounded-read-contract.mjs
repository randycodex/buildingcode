import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { projectResearchAnswerForList } from "../app.mjs";

const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const owner = "web:bounded-answer-owner";
const largeText = "x".repeat(8 * 1024 * 1024);
const answers = Array.from({ length: 10 }, (_, index) => ({
  id: `answer-${index}`, conversationID: `conversation-${index % 2}`,
  projectID: index < 8 ? "project-a" : "project-b", question: `Question ${index}`,
  reviewStatus: "unreviewed", createdAt: `2026-10-06T12:00:${String(index).padStart(2, "0")}.000Z`,
  answer: { conclusion: `Conclusion ${index}`, answerText: `Complete answer ${index}` },
  citations: [{ sectionID: "source-a" }],
  evidence: [{ sectionID: "source-a", text: largeText }, { sectionID: "source-b", text: "Other source" }]
}));
assert.ok(Buffer.byteLength(JSON.stringify(answers)) > 67108864);
const reads = [];
let migrations = 0;
const context = vm.createContext({
  authenticatedResearchBody: async request => ({ userID: request.userID || owner, body: request.body }),
  migrateLegacyProjectFoundation: async userID => { assert.ok(userID); migrations += 1; },
  listStoredResearchAnswers: async (userID, options = {}) => {
    reads.push({ userID, options: JSON.parse(JSON.stringify(options)) });
    // Emulate Neon's response boundary before the handler can filter results.
    if (!options.summaryOnly && !options.ids) throw new Error("response is too large (max is 67108864 bytes)");
    const selected = userID === owner ? answers.filter(answer =>
      (!options.projectID || answer.projectID === options.projectID) &&
      (!options.ids || options.ids.includes(answer.id))) : [];
    return options.summaryOnly ? selected.map(projectResearchAnswerForList) : selected;
  },
  listStoredResearchFeedback: async userID => userID === owner
    ? [{ answerID: "answer-0", message: "Retained feedback" }] : [],
  researchAnswerRecordForClient: answer => answer,
  researchFeedbackForClient: feedback => feedback,
  sendJSON: (response, status, body) => Object.assign(response, { status, body }),
  sendError: (response, status, error) => Object.assign(response, { status, body: { error } })
});
for (const name of ["handleResearchAnswerList", "handleResearchAnswerGet"]) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end + 2), context);
}

const list = {};
await context.handleResearchAnswerList({ body: { projectID: "project-a", conversationID: "conversation-0" } }, list);
assert.equal(list.status, 200);
assert.deepEqual(Array.from(list.body.answers, answer => answer.id), ["answer-6", "answer-4", "answer-2", "answer-0"]);
assert.ok(Buffer.byteLength(JSON.stringify(list.body)) < 3000);
assert.equal(list.body.answers[0].evidenceCount, 2);
assert.deepEqual(Array.from(list.body.answers[0].sectionIDs), ["source-a", "source-b"]);
assert.equal(list.body.answers[0].conclusion, "Conclusion 6");
assert.equal(list.body.answers[0].evidence, undefined);
assert.deepEqual(reads.at(-1).options, { projectID: "project-a", summaryOnly: true });

const all = {};
await context.handleResearchAnswerList({ body: {} }, all);
assert.equal(all.body.answers.length, 10);

const detail = {};
await context.handleResearchAnswerGet({ body: { answerID: "answer-0" } }, detail);
assert.equal(detail.status, 200);
assert.equal(detail.body.answer.evidence[0].text, largeText);
assert.deepEqual(detail.body.answer.citations, answers[0].citations);
assert.equal(detail.body.answer.answer.answerText, "Complete answer 0");
assert.equal(detail.body.answer.userFeedback.message, "Retained feedback");
assert.deepEqual(reads.at(-1).options, { ids: ["answer-0"] });
for (const request of [
  { body: { answerID: "missing" } }, { body: {} },
  { userID: "web:other-owner", body: { answerID: "answer-0" } }
]) {
  const response = {};
  await context.handleResearchAnswerGet(request, response);
  assert.equal(response.status, 404);
}
assert.equal(migrations, 6);
console.log("Research answer routes passed: >64 MiB history, compact scoped lists, complete selected evidence, feedback and owner isolation.");
