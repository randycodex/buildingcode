import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { feedbackSourceRecords, updateFeedbackCase, feedbackRegressionExport, validateFeedbackRegressionExport, feedbackQualityReport } from "../research-feedback.mjs";

const now = new Date().toISOString();
const sample = { id: "synthetic-report", answerID: "synthetic-answer", question: "Synthetic source review question",
  answer: { answerText: "Synthetic answer for feedback testing only.", citations: [] }, citations: [],
  contextSnapshot: { conversationFacts: { facts: ["Synthetic fact"] } },
  evidenceSnapshot: { enacted: [{ sourceID: "source-1", codeBook: "Synthetic code", sectionNumber: "1", codeEdition: "Test edition", passageText: "Synthetic rule excerpt for testing only." }],
    official: [{ id: "guide-1", title: "Synthetic guide", url: "https://www.nyc.gov/test.pdf", attributedClaims: [{ id: "claim-1", verbatimText: "Synthetic guidance excerpt.", pageNumber: 2 }] }] } };
const keys = feedbackSourceRecords(sample).map(source => source.key);
assert.equal(keys.length, 2);
const review = { reviewer: "Synthetic reviewer", notes: "Checked the synthetic source." };
const draft = { question: sample.question, facts: "Synthetic fact", expectedAnswer: "Apply the synthetic rule conditionally.", requiredConcepts: ["State the condition"], requiredSourceKeys: [keys[0]], forbiddenClaims: ["Unconditional approval"] };
let candidate = updateFeedbackCase(sample, { action: "save", revision: 0, case: draft, ...review }, now);
assert.equal(candidate.status, "draft");
assert.throws(() => feedbackRegressionExport([{ ...sample, regressionCase: candidate }]), /No approved/);
assert.throws(() => updateFeedbackCase(sample, { action: "save", revision: 0, case: { ...draft, additionalSources: "bad" }, ...review }, now), /must be a list/);
assert.throws(() => updateFeedbackCase(sample, { action: "save", revision: 0, case: { ...draft, requiredSourceKeys: ["unpreserved"] }, ...review }, now), /preserved evidence/);
assert.throws(() => updateFeedbackCase({ ...sample, regressionCase: candidate }, { action: "approve", revision: 0, ...review }, now), /changed/);
candidate = updateFeedbackCase({ ...sample, regressionCase: candidate }, { action: "approve", revision: 1, case: { expectedAnswer: "Unsaved tampering" }, ...review }, now);
assert.equal(candidate.expectedAnswer, draft.expectedAnswer);
assert.equal(candidate.status, "approved");
candidate = updateFeedbackCase({ ...sample, regressionCase: candidate }, { action: "record_result", revision: 2, targetFeedback: sample, decision: "fail", ...review }, now);
assert.equal(candidate.comparisons[0].answer.answerText, sample.answer.answerText);
const exported = feedbackRegressionExport([{ ...sample, regressionCase: candidate }]);
assert.equal(validateFeedbackRegressionExport(exported).cases.length, 1);
const tampered = structuredClone(exported); tampered.cases[0].sources[0].text = "Changed";
assert.throws(() => validateFeedbackRegressionExport(tampered), /source was changed/);
const edited = updateFeedbackCase({ ...sample, regressionCase: candidate }, { action: "save", revision: 2, case: { ...draft, expectedAnswer: "New reference" }, ...review }, now);
assert.equal(edited.status, "draft");
assert.equal(edited.history.at(-1).status, "approved");
const added = updateFeedbackCase(sample, { action: "save", revision: 0, case: { ...draft, additionalSources: [{ url: "https://www.nyc.gov/test.pdf", reference: "Guide", codeEdition: "2026", text: "Reviewer excerpt" }] }, ...review }, now);
assert.match(added.sources.at(-1).snapshotOrigin, /not fetched/);
const periodStart = now.slice(0, 7) + "-01T00:00:00.000Z";
const spend = { periodStart, operationMetrics: [{ id: "op1", mode: "live", status: "completed", estimatedCostUSD: .1 }, { id: "op2", mode: "live", status: "failed", estimatedCostUSD: .03 }] };
assert.equal(feedbackQualityReport([], spend).estimatedCostPerUsableAnswerUSD, null);
const rated = [{ answerCreatedAt: now, operationID: "op1", usefulness: "usable_as_is", outsideChecking: "brief" }];
assert.equal(feedbackQualityReport(rated, spend).estimatedCostPerUsableAnswerUSD, .13);
assert.equal(feedbackQualityReport(rated, { ...spend, operationMetrics: [...spend.operationMetrics, { id: "unrated", status: "completed", estimatedCostUSD: .1 }] }).estimatedCostPerUsableAnswerUSD, null);
assert.equal(feedbackQualityReport(rated, { ...spend, operationMetrics: [{ ...spend.operationMetrics[0], estimatedCostUSD: null }] }).estimatedCostPerUsableAnswerUSD, null);

const temporary = await mkdtemp(join(tmpdir(), "permitext-feedback-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1", PERMITEXT_SYNC_DATA_PATH: join(temporary, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"), PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-feedback-grant" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const adapter = createFileStoreAdapter();
let owner;
const serve = process.argv.includes("--serve");
const server = createServer((req, res) => {
  // Disposable local browser fixture only; this route is never part of the app.
  if (serve && req.url === "/__feedback_test") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify({ userID: owner.id, sessionToken: owner.token }))});location.href='/admin/'</script>`); return;
  }
  return handleRequest(req, res);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  assert.equal(new URL(typeof input === "string" ? input : input.url).origin, base, "All external/provider calls are forbidden.");
  return nativeFetch(input, options);
};
async function request(path, body = {}, who = owner, expected = 200) {
  const response = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...(who?.token ? { authorization: `Bearer ${who.token}` } : {}) }, body: JSON.stringify({ auth: { accountUserID: who?.id }, ...body }) });
  const json = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(json)}`); return json;
}
async function signIn(name) {
  const id = `apple:${name}`;
  await request("/admin/lifetime-grants/grant", { userID: id }, { token: process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN });
  const result = await request("/account/sign-in", { credential: { provider: "apple", providerUserID: name, displayName: "Synthetic feedback test" } }, null);
  return { id, token: result.account.backendSessionToken };
}
try {
  owner = await signIn("synthetic-feedback-owner");
  const outsider = await signIn("synthetic-feedback-outsider");
  const { conversation } = await request("/research/conversations/create", { requestID: "synthetic-feedback-create" }, owner, 201);
  await adapter.saveResearchConversation(owner.id, { ...conversation, messages: [{ id: "synthetic-question", role: "user", question: sample.question, createdAt: now }, { id: sample.answerID, role: "assistant", answer: sample.answer, createdAt: now }] }, conversation.revision);
  await adapter.saveResearchAnswer(owner.id, { id: sample.answerID, question: sample.question, answer: sample.answer, evidence: sample.evidenceSnapshot.enacted, officialEvidenceSnapshot: sample.evidenceSnapshot.official, conversationFactSnapshot: sample.contextSnapshot.conversationFacts, citations: [], createdAt: now, operationID: "synthetic-op" });
  const input = { conversationID: conversation.id, answerID: sample.answerID, category: "too_slow", usefulness: "needed_correction", outsideChecking: "substantial", comment: "Synthetic feedback report" };
  let result = await request("/research/feedback", input, owner, 201);
  const feedbackID = result.feedback.id;
  assert.equal(result.feedback.usefulness, input.usefulness);
  for (const privateField of ["evidenceSnapshot", "contextSnapshot", "regressionCase", "triageNotes", "operationID"]) assert.equal(privateField in result.feedback, false);
  await request("/research/feedback", { ...input, usefulness: "invented" }, owner, 400);
  await request("/research/feedback", input, outsider, 404);
  process.env.VERCEL = "1";
  process.env.PERMITEXT_INTERNAL_OWNER_USER_IDS = owner.id;
  await request("/internal/evaluations/data", {}, outsider, 403);
  await request("/internal/evaluations/feedback/triage", { feedbackID, triageStatus: "reviewing", ...review }, outsider, 403);
  await request("/internal/evaluations/feedback/case", { feedbackID, action: "export" }, outsider, 403);
  await request("/internal/evaluations/feedback/triage", { feedbackID, triageStatus: "reviewing", ...review });
  const caseInput = { feedbackID, action: "save", revision: 0, case: draft, ...review };
  result = await request("/internal/evaluations/feedback/case", caseInput);
  assert.equal(result.regressionCase.status, "draft");
  await request("/internal/evaluations/feedback/case", { feedbackID, action: "export" }, owner, 400);
  result = await request("/internal/evaluations/feedback/case", { feedbackID, action: "approve", revision: 1, ...review });
  assert.equal(result.regressionCase.status, "approved");
  await request("/internal/evaluations/feedback/case", caseInput, owner, 400);
  result = await request("/research/feedback", { ...input, category: "too_verbose" });
  assert.equal(result.feedback.category, "too_verbose");
  const saved = (await adapter.listResearchFeedback(owner.id))[0];
  assert.equal(await adapter.saveResearchFeedback(owner.id, { ...saved, id: "duplicate-id" }), null, "A racing initial submission must not overwrite an owner review.");
  assert.equal(saved.regressionCase.status, "approved", "Tester updates must retain owner reviews.");
  assert.equal(saved.evidenceSnapshot.official[0].attributedClaims[0].verbatimText, "Synthetic guidance excerpt.");
  assert.equal(saved.triageHistory.length, 1);
  await request("/internal/evaluations/feedback/case", { feedbackID, action: "record_result", revision: 2, targetFeedbackID: feedbackID, decision: "fail", ...review });
  result = await request("/internal/evaluations/feedback/case", { feedbackID, action: "export" });
  assert.equal(validateFeedbackRegressionExport(result.dataset).cases[0].comparisons.length, 1);
  const exportPath = join(temporary, "approved.json");
  await writeFile(exportPath, JSON.stringify(result.dataset));
  const summary = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/validate-feedback-regressions.mjs", import.meta.url)), exportPath], { encoding: "utf8" }));
  assert.equal(summary.recordedHumanFailures, 1);
  assert.equal(summary.providerCalls, 0);
  assert.equal(await adapter.updateResearchFeedback(feedbackID, { ...saved, userComment: "stale write" }, "outdated"), null);
  const ownerData = await request("/internal/evaluations/data");
  assert.equal(ownerData.feedbackRecords[0].regressionCase.status, "approved");
  assert.equal(ownerData.feedbackQuality.neededCorrection, 1);
  assert.equal(ownerData.feedbackQuality.estimatedCostPerUsableAnswerUSD, null);
  console.log("Feedback contracts passed: preserved evidence, private owner review, stale-write rejection, approval/export integrity, human comparisons and coverage-aware metrics. Zero provider calls.");
  if (serve) {
    process.env.VERCEL = "";
    console.log(`Isolated synthetic browser fixture: ${base}/__feedback_test`);
    await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
} finally {
  globalThis.fetch = nativeFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
