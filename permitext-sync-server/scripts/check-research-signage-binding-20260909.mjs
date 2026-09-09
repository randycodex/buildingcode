// Compare provenance transformations on retained answers, not live answer quality.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { applyResearchPlumbingSourceRepairs } from "../research-plumbing-source-repairs.mjs";

globalThis.fetch = () => { throw new Error("Signage binding checks forbid network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
const root = new URL("../", import.meta.url);
const hash = value => createHash("sha256").update(value).digest("hex");
const hashJSON = value => hash(JSON.stringify(value));
const baselineCommit = execFileSync("git", ["rev-parse", "69ba87c83"], { cwd: root, encoding: "utf8" }).trim();
const baselineSource = execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/research-plumbing-source-repairs.mjs`], { cwd: root, encoding: "utf8" });
const old = await import(`data:text/javascript;base64,${Buffer.from(baselineSource.replace('"./evidence-discovery.mjs"',
  JSON.stringify(new URL("evidence-discovery.mjs", root).href))).toString("base64")}`);
const inputs = new Map();
async function read(file, expectedSHA256) {
  if (!inputs.has(file)) {
    const bytes = await readFile(new URL(file, root));
    inputs.set(file, { file, sha256: hash(bytes), value: JSON.parse(bytes) });
  }
  const entry = inputs.get(file);
  if (expectedSHA256) assert.equal(entry.sha256, expectedSHA256, file);
  return entry.value;
}
const backlog = await read("evals/results/research-owner-backlog-v6-2026-09-09.json");
await read("evals/research-reconciled-answer-key.json", "64c83744410c3dfa4bff565328d9e31edde3c6c55cf98b79d52c587f1965d455");
await read("evals/research-owner-code-candidates.json", "461b47898980aeaa29cf65a728b548fe3a1de70105beb0dd34a16c4e182adbe7");
const cases = [];
for (const item of backlog.cases) {
  const run = await read(item.latestAttempt.file, item.latestAttempt.fileSHA256);
  const result = run.results.find(result => result.id === item.id);
  assert(result, item.id);
  const identity = { id: item.id, latestAttemptFile: item.latestAttempt.file, latestAttemptFileSHA256: item.latestAttempt.fileSHA256,
    caseDefinitionSHA256: item.caseDefinitionSHA256 };
  if (!item.latestAttempt.delivered) {
    cases.push({ ...identity, status: "not-compared-no-delivered-answer" });
    continue;
  }
  const answer = result.answer ?? result.response?.conversation?.messages?.at(-1)?.answer;
  assert(answer, item.id);
  assert.equal(hash(answer.answerText), item.latestAttempt.answerTextSHA256, item.id);
  const evidence = (answer.citations || []).flatMap(citation => (citation.supportingPassages || []).map(passage => ({
    sourceID: passage.sourceID, sectionID: citation.sectionID, sectionNumber: citation.sectionNumber,
    codePrefix: citation.codePrefix, codeEdition: citation.codeEdition, codeVersion: citation.codeVersion,
    corpusID: citation.corpusID, evidenceRole: citation.evidenceRole, text: passage.selectedText
  })));
  const sourceSnapshot = hashJSON(evidence), answerSnapshot = hashJSON(answer);
  const options = { question: item.question };
  const before = old.applyResearchPlumbingSourceRepairs(answer, evidence, options);
  const after = applyResearchPlumbingSourceRepairs(answer, evidence, options);
  assert.equal(hashJSON(answer), answerSnapshot);
  assert.equal(hashJSON(evidence), sourceSnapshot);
  const changes = [];
  if (hashJSON(before) !== hashJSON(after)) {
    const restored = structuredClone(after);
    assert.equal(after.supportedPoints.length, before.supportedPoints.length);
    for (let index = 0; index < after.supportedPoints.length; index += 1) {
      const prior = before.supportedPoints[index].sourceIDs;
      const next = after.supportedPoints[index].sourceIDs;
      if (hashJSON(prior) !== hashJSON(next)) changes.push({ pointIndex: index, beforeSourceIDs: prior, afterSourceIDs: next });
      restored.supportedPoints[index].sourceIDs = prior;
    }
    assert.deepEqual(restored, before, "Every other field and all wording must remain unchanged.");
  }
  cases.push({ ...identity, status: "compared", retainedAnswerSHA256: answerSnapshot, citedPassageCount: evidence.length,
    citedPassagesSHA256: sourceSnapshot, beforeSHA256: hashJSON(before), afterSHA256: hashJSON(after),
    changed: changes.length > 0, changes });
}
assert.equal(cases.length, 110);
assert.equal(new Set(cases.map(item => item.id)).size, 110);
assert.deepEqual(cases.filter(item => item.changed).map(item => item.id), ["PC-01"]);
const sourceFiles = ["research-plumbing-source-repairs.mjs", "research-answer-quality.mjs", "evidence-discovery.mjs",
  "tests/research-plumbing-source-repairs-contract.mjs", "tests/research-plumbing-source-repairs-http-contract.mjs",
  "scripts/check-research-signage-binding-20260909.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const summary = { numberedQuestions: cases.length, retainedAnswersCompared: cases.filter(item => item.status === "compared").length,
  withReturnedEnactedPassages: cases.filter(item => item.citedPassageCount > 0).length,
  withoutReturnedEnactedPassages: cases.filter(item => item.citedPassageCount === 0).length,
  undeliveredAnswersNotCompared: cases.filter(item => item.status !== "compared").length,
  changedCases: cases.filter(item => item.changed).map(item => item.id),
  unchangedComparedAnswers: cases.filter(item => item.status === "compared" && !item.changed).length,
  providerCalls: 0, networkCalls: 0, newlyGeneratedAnswers: 0, liveQualityConfirmed: false };
const report = { schema: "permitext.research-signage-binding-check.v1", checkedAt: new Date().toISOString(), baselineCommit,
  baselineSourceSHA256: hash(baselineSource), sourceHashes,
  inputs: [...inputs.values()].map(({ value, ...identity }) => identity), summary,
  limitations: [
    "This compares the old and new plumbing provenance transformation using retained answers and their returned cited passages. It does not reconstruct full retrieval or run live Research.",
    "The 13 undelivered cases have no delivered answer to compare; 18 delivered cases return no enacted passages. These are explicit coverage limits, not passing generated-answer tests.",
    "Only one existing signage source ID is added to PC-01 point 3. Original and transformed prose, other bindings, references and result classifications remain unchanged.",
    "Adding a binding does not establish substantive support, materiality or correct applicability. Full semantic verification and current-baseline whole-answer acceptance remain required."
  ], cases };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, ...(args.length ? { output: args[1] } : {}) }, null, 2));
