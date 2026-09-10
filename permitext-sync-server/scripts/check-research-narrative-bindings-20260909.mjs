// Offline comparison using retained answers and their recorded evidence maps.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { bindResearchNarrativeSources, researchNarrativeSourceBindingVersion } from "../research-narrative-source-bindings.mjs";

globalThis.fetch = () => { throw new Error("Narrative citation audit forbids network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
const root = new URL("../", import.meta.url), hash = value => createHash("sha256").update(value).digest("hex");
const hashJSON = value => hash(JSON.stringify(value)), inputs = new Map();
async function read(file, expected) {
  if (!inputs.has(file)) {
    const bytes = await readFile(new URL(file, root));
    inputs.set(file, { file, sha256: hash(bytes), value: JSON.parse(bytes) });
  }
  const entry = inputs.get(file);
  if (expected) assert.equal(entry.sha256, expected, file);
  return entry.value;
}
const backlog = await read("evals/results/research-owner-backlog-v7-2026-09-09.json");
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
  assert(answer, item.id); assert.equal(hash(answer.answerText), item.latestAttempt.answerTextSHA256, item.id);
  // This retained map contains passage identities, exact recorded text, roles
  // and reference labels. Do not invent omitted corpus/edition metadata or
  // substitute today's retrieval for the historical packet.
  const retainedSources = answer.answerQuality?.sources || [];
  const evidence = retainedSources.map(({ reference, ...source }) => {
    const match = reference.match(/^([A-Z]+) (.+)$/);
    assert(match, `${item.id}: malformed retained reference`);
    return { ...source, codePrefix: match[1], sectionNumber: match[2] };
  });
  const before = hashJSON(answer), sourceBefore = hashJSON(evidence);
  const repaired = bindResearchNarrativeSources(answer, evidence);
  assert.equal(hashJSON(answer), before); assert.equal(hashJSON(evidence), sourceBefore);
  assert.deepEqual(repaired.answer.citations.slice(0, answer.citations.length), answer.citations);
  assert.deepEqual({ ...repaired.answer, citations: answer.citations }, answer);
  assert.deepEqual(bindResearchNarrativeSources(repaired.answer, evidence), { answer: repaired.answer, repairs: [] });
  cases.push({ ...identity, status: "compared", retainedAnswerSHA256: before,
    recordedEvidenceCount: evidence.length, recordedEvidenceSHA256: hashJSON(retainedSources),
    afterSHA256: hashJSON(repaired.answer), changed: repaired.repairs.length > 0, repairs: repaired.repairs,
    addedCitations: repaired.answer.citations.slice(answer.citations.length) });
}
assert.equal(cases.length, 110); assert.equal(new Set(cases.map(item => item.id)).size, 110);
assert.deepEqual(cases.filter(item => item.changed).map(item => item.id), ["MC-05"]);
const summary = { numberedQuestions: cases.length, retainedAnswersCompared: cases.filter(item => item.status === "compared").length,
  withRecordedEvidence: cases.filter(item => item.recordedEvidenceCount > 0).length,
  withoutRecordedEvidence: cases.filter(item => item.recordedEvidenceCount === 0).length,
  undeliveredAnswersNotCompared: cases.filter(item => item.status !== "compared").length,
  changedCases: cases.filter(item => item.changed).map(item => item.id),
  unchangedComparedAnswers: cases.filter(item => item.status === "compared" && !item.changed).length,
  providerCalls: 0, networkCalls: 0, newlyGeneratedAnswers: 0, liveQualityConfirmed: false };
const sourceFiles = ["app.mjs", "research-answer-quality.mjs", "research-narrative-source-bindings.mjs",
  "tests/research-narrative-source-bindings-contract.mjs", "tests/research-plumbing-source-repairs-http-contract.mjs",
  "scripts/check-research-narrative-bindings-20260909.mjs", "package.json"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const report = { schema: "permitext.research-narrative-binding-check.v1", checkedAt: new Date().toISOString(),
  bindingVersion: researchNarrativeSourceBindingVersion, sourceHashes, inputs: [...inputs.values()].map(({ value, ...entry }) => entry), summary,
  limitations: [
    "This compares provenance only on 97 retained delivered answers, not 110 newly generated answers or a complete current-baseline acceptance run.",
    "Recorded answer-quality source maps preserve reference labels, passage identities/text and roles. They are not full original provider requests and omit some corpus/edition metadata. No such metadata is invented for this comparison.",
    "Only MC-05 gains a citation for its explicit MC 606.4.2 reference. All existing prose, points, citations and other fields remain unchanged. The separate HTTP test checks actual retrieval metadata, verification and delivery using mocked provider responses.",
    "Source identity does not establish substantive support or project applicability. The independent verifier remains required. Unasked discussion, repetition and complete-answer acceptance remain open.",
    "GAP-14 has no delivered answer in the latest ledger. Its uncited occupancy-exception claims do not explicitly name their authorities and are not repaired by guessing them from terminology.",
    "A missing source, ambiguous identity, incorporated reference or a request to obtain unavailable evidence is not silently converted into a verified rule or a citation."
  ], cases };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, ...(args.length ? { output: args[1] } : {}) }, null, 2));
