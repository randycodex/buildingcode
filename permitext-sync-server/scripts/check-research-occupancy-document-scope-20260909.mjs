// Compare fact extraction, not generated answer quality. No network/provider calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolveResearchConversationFacts, researchConversationFactPromptContext } from "../research-conversation-facts.mjs";
import { decideResearchConversationTopic } from "../research-conversation-topic.mjs";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";

globalThis.fetch = () => { throw new Error("Occupancy/document scope checks forbid network/provider calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
const root = new URL("../", import.meta.url), hash = value => createHash("sha256").update(value).digest("hex");
const baselineCommit = "2a03acf71";
const fullBaseline = execFileSync("git", ["rev-parse", baselineCommit], { cwd: root, encoding: "utf8" }).trim();
const sourceAtBaseline = file => execFileSync("git", ["show", `${fullBaseline}:permitext-sync-server/${file}`], { cwd: root, encoding: "utf8" });
const moduleURL = value => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
const oldQualification = sourceAtBaseline("research-fact-qualification.mjs");
const oldFacts = sourceAtBaseline("research-conversation-facts.mjs");
const old = await import(moduleURL(oldFacts.replace('"./research-fact-qualification.mjs"', JSON.stringify(moduleURL(oldQualification)))));
const inputs = [];
async function read(file, expected) { const bytes = await readFile(new URL(file, root)); const sha256 = hash(bytes); if (expected) assert.equal(sha256, expected); inputs.push({ file, sha256 }); return JSON.parse(bytes); }
const original = await read("evals/research-reconciled-answer-key.json", "64c83744410c3dfa4bff565328d9e31edde3c6c55cf98b79d52c587f1965d455");
const added = await read("evals/research-owner-code-candidates.json", "461b47898980aeaa29cf65a728b548fe3a1de70105beb0dd34a16c4e182adbe7");
const originalIDs = new Set(original.cases.map(item => item.id));
const projection = (state, prompt) => ({ established: state.establishedFacts.map(({ qualificationVersion, ...fact }) => fact),
  unknown: state.unknownFacts.map(({ qualificationVersion, ...fact }) => fact),
  hypothetical: state.hypotheticalFacts.map(({ qualificationVersion, ...fact }) => fact), prompt: prompt(state) });
const cases = [];
for (const item of [...original.cases, ...added.cases]) {
  const authored = await ownerResearchScopeInput(item, { original: originalIDs.has(item.id), zoningSummary: zoningSectionSummary });
  const input = { question: authored.question, topicDecision: decideResearchConversationTopic({ question: authored.question, previousMessages: [] }) };
  const before = projection(old.resolveResearchConversationFacts(input), old.researchConversationFactPromptContext);
  const after = projection(resolveResearchConversationFacts(input), researchConversationFactPromptContext);
  const beforeSHA256 = hash(JSON.stringify(before)), afterSHA256 = hash(JSON.stringify(after));
  cases.push({ id: item.id, caseDefinitionSHA256: hash(JSON.stringify(item)), authoredInputSHA256: hash(JSON.stringify(authored)),
    questionSHA256: hash(input.question), changed: beforeSHA256 !== afterSHA256, beforeSHA256, afterSHA256,
    ...(beforeSHA256 !== afterSHA256 ? { question: input.question, before, after } : {}) });
}
assert.equal(cases.length, 110); assert.equal(new Set(cases.map(item => item.id)).size, 110);
const followup = (module, statement, prior) => module.resolveResearchConversationFacts({ question: statement,
  topicDecision: { decision: "continuation", nextRootTopic: { text: "Occupancy and its documents" } },
  topicContext: prior ? { factTopics: prior.nextFactTopics } : null });
const current = { resolveResearchConversationFacts };
const scenarios = ["The Certificate of Occupancy is not available.", "The Certificate of Occupancy is unavailable.",
  "The temporary Certificate of Occupancy has not been issued.", "The occupancy group is unknown."];
const followups = scenarios.map(question => {
  const before = followup(old, question, followup(old, "The building is occupancy Group R-2."));
  const after = followup(current, question, followup(current, "The building is occupancy Group R-2."));
  const keepClassification = question !== "The occupancy group is unknown.";
  assert.equal(after.establishedFacts.find(f => f.key === "occupancy_group")?.value, keepClassification ? "R-2" : undefined);
  if (keepClassification) assert(after.unknownFacts.some(f => f.key.includes("certificate_of_occupancy_")));
  return { question, before: projection(before, old.researchConversationFactPromptContext), after: projection(after, researchConversationFactPromptContext) };
});
const sourceFiles = ["research-conversation-facts.mjs", "research-fact-qualification.mjs", "research-conversation-topic.mjs",
  "evals/research-owner-scope-input.mjs", "evals/research-answer-key-reconciliation.mjs", "evals/research-owner-code-review.mjs",
  "tests/research-fact-subject-scope-contract.mjs", "scripts/check-research-occupancy-document-scope-20260909.mjs"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const summary = { numberedQuestions: 110, changedCases: cases.filter(c => c.changed).map(c => c.id), unchangedCases: cases.filter(c => !c.changed).length,
  followupComparisons: followups.length, providerCalls: 0, networkCalls: 0, generatedAnswersTested: 0, liveQualityConfirmed: false };
const report = { schema: "permitext.research-occupancy-document-scope-check.v1", checkedAt: new Date().toISOString(), baselineCommit: fullBaseline,
  baselineSourceHashes: { facts: hash(oldFacts), qualification: hash(oldQualification) }, sourceHashes, inputs, summary,
  limitations: ["This compares current authored HTTP question text, including scenario/context, using the same topic decision. It does not run HTTP Research, retrieval or a Project workflow.",
    "The original source wording and unresolved conditions remain; document status does not establish occupancy classification or legal approval.",
    "Existing wrongly erased classifications cannot be reconstructed from a later document-only statement. Legacy migration only recovers the unknown fact's subject.",
    "All 110 cases still require complete current-baseline generated-answer acceptance; these parser checks reclassify no historical answer."], cases, followups };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...summary, ...(args.length ? { output: args[1] } : {}) }, null, 2));
