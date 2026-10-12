import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateResearchInterpretation } from "../app.mjs";
import { researchWriterInstructions } from "../research-writer-policy.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const [serverSource, clientSource] = await Promise.all([
  readFile(join(root, "../app.mjs"), "utf8"),
  readFile(join(root, "../public/app.js"), "utf8")
]);
const nativeResearchSource = await readFile(
  join(root, "../../NYC CC APP/permitext/Views/ResearchView.swift"),
  "utf8"
);

const evidence = [{
  sectionID: "smoke-separation",
  sourceID: "smoke-separation-passage",
  codePrefix: "BC",
  sectionNumber: "509.4",
  title: "Separation and protection",
  text: "The required assembly depends on the applicable condition."
}];

function interpretation(answerText) {
  return {
    answerText,
    supportedPoints: [{
      heading: "Applicable condition",
      explanation: "The cited provision determines which assembly applies.",
      sectionID: "smoke-separation",
      sourceIDs: ["smoke-separation-passage"]
    }],
    assumptions: [],
    missingFacts: [],
    followUpQuestions: [],
    evidenceLimitations: ["Only the assembled enacted provision was evaluated."],
    additionalEvidenceNeeded: [],
    supportingSourceUses: [],
    citations: [{
      sectionID: "smoke-separation",
      sourceIDs: ["smoke-separation-passage"],
      relevance: "Controls the required separation."
    }]
  };
}

const concise = validateResearchInterpretation(
  interpretation("Yes. The cited provision directly requires the assembly for the stated condition."),
  evidence
);
assert.equal(concise.answerText, "Yes. The cited provision directly requires the assembly for the stated condition.");
assert.equal(concise.conclusion, concise.answerText);
assert.equal(concise.explanation, "");

const complexText = [
  "Conditionally, yes. The result depends on which applicability path the project satisfies.",
  "The general rule requires the stated separation, but the exception changes the assembly when its threshold is met.",
  "- Path one applies when the stated use condition is established.\n- Path two remains unresolved because the threshold fact was not supplied.",
  "The available evidence therefore supports the first path but cannot determine the second without that fact."
].join("\n\n");
const complex = validateResearchInterpretation(interpretation(complexText), evidence);
assert.equal(complex.answerText, complexText);
assert.equal(complex.conclusion, complexText.split("\n\n")[0]);
assert.match(complex.explanation, /Path one applies/);
assert.match(complex.explanation, /cannot determine the second/);

assert.match(serverSource, /answerText: \{ type: "string" \}/);
assert.doesNotMatch(serverSource, /Write the conclusion as a concise professional answer of one to three sentences/);
assert.doesNotMatch(serverSource, /write conclusion and explanation so they read consecutively/);
// The general writer policy replaced the old inline answer-template prompt.
// Exercise the actual policy used by the request builder, retaining its scope,
// formatting, qualification and source-boundary obligations.
const writerPolicy = researchWriterInstructions({ question: "What are the requirements?" });
assert.match(serverSource, /instructions: researchWriterInstructions\(\{ question, options \}\)/);
assert.match(writerPolicy, /leading with the strongest conclusion supported by the evidence/);
assert.match(writerPolicy, /choose paragraphs, lists or a table to suit the question without a fixed template/);
assert.match(writerPolicy, /every exception material to the conclusion/);
assert.match(writerPolicy, /State important qualifications at the affected claim/);
assert.match(writerPolicy, /distinguish it from a similar component covered by a different supplied rule or exception/);
assert.match(writerPolicy, /never expand a partial finding into overall compliance/);
assert.match(writerPolicy, /Do not invent facts, requirements, citations or source contents/);
assert.match(writerPolicy, /exact selection boundaries and governing ancestor conditions/);
assert.match(writerPolicy, /Treat supplied user facts as discussion premises/);
assert.match(writerPolicy, /cumulative or alternative conditions/);
assert.match(writerPolicy, /Keep claims and qualifications consistent across all fields/);
assert.match(serverSource, /RELATIONSHIP: \$\{section\.relationship/);
assert.match(serverSource, /USER_SELECTED_TEXT is the exact model-visible focus and citation target/);
assert.doesNotMatch(serverSource, /`CANONICAL_SECTION_CONTEXT:/);
assert.match(serverSource, /A and B must not be restated as A or B/);
assert.match(serverSource, /Ordinary internal corpus exclusions are not user-facing evidence limitations/);
assert.match(serverSource, /When the question names a code edition or year, verify every legal claim/);
assert.match(serverSource, /Never borrow similarly numbered text from another edition/);
assert.match(serverSource, /fail with wrong_attribution if any legal claim or human-readable section reference is taken from another edition/);
assert.match(serverSource, /codeVersion: source\.codeVersion \|\| defaultSyncCodeVersion/);
assert.match(serverSource, /researchCorpusByPrefix\(registry, source\?\.codePrefix, source\)/);
assert.doesNotMatch(serverSource, /`EXCLUDED_CORPORA:/);
assert.match(clientSource, /function appendResearchAnswerNarrative\(container, result, question = "", includeRecoveryAction = true\)/);
assert.match(clientSource, /function researchAnswerTable\(block\)/);
assert.match(clientSource, /research-answer-table/);
assert.match(clientSource, /appendResearchInlineFormatting/);
assert.match(clientSource, /research-answer-quote/);
assert.match(nativeResearchSource, /private struct ResearchFormattedNarrative: View/);
assert.match(nativeResearchSource, /case table\(header: \[String\], rows: \[\[String\]\]\)/);
assert.match(nativeResearchSource, /AttributedString\(markdown: value\)/);
assert.match(nativeResearchSource, /ResearchFormattedNarrative\(text: primaryNarrative\)/);
assert.match(nativeResearchSource, /codeVersion: citation\.codeVersion/);
assert.match(clientSource, /text\.split\(\/\\n\\s\*\\n\/\)/);
assert.match(clientSource, /list\.className = "research-answer-list"/);
assert.doesNotMatch(clientSource, /card\.append\(answer, explanation\)/);

console.log("Permitext adaptive Research answer structure contract passed; paid model calls: no.");
