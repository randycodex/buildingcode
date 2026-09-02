import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateResearchInterpretation } from "../app.mjs";

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
assert.match(serverSource, /Do not target a fixed number of paragraphs or sentences/);
assert.match(serverSource, /Use the shortest answer that fully and reliably resolves the question/);
assert.match(serverSource, /Never omit a material qualification, applicability issue, conflicting provision, or evidence limitation/);
assert.match(serverSource, /open-ended request for design requirements/);
assert.match(serverSource, /Do not let a narrow exception, a specialized ramp or equipment type/);
assert.match(serverSource, /Adapt the presentation to the question instead of forcing a fixed report template/);
assert.match(serverSource, /a concise Markdown table is permitted/);
assert.match(serverSource, /If the user asks for a short paragraph or quick explanation/);
assert.match(serverSource, /researchAnswerPresentationContract\(\{/);
assert.match(serverSource, /QUESTION-SPECIFIC ANSWER PRESENTATION CONTRACT/);
assert.match(serverSource, /The contract controls presentation only; it never permits an unsupported claim or omission/);
assert.match(serverSource, /Do not silently correct or normalize enacted wording/);
assert.match(serverSource, /RELATIONSHIP: \$\{section\.relationship/);
assert.match(serverSource, /USER_SELECTED_TEXT is the exact model-visible focus and citation target/);
assert.doesNotMatch(serverSource, /`CANONICAL_SECTION_CONTEXT:/);
assert.match(serverSource, /Do not force a generic ancestor heading or redundant parent restatement/);
assert.match(serverSource, /Preserve cumulative and alternative conditions exactly/);
assert.match(serverSource, /A and B must not be restated as A or B/);
assert.match(serverSource, /Treat facts explicitly stated in the current question as established premises/);
assert.match(serverSource, /Ordinary internal corpus exclusions are not user-facing evidence limitations/);
assert.match(serverSource, /When the question names a code edition or year, verify every legal claim/);
assert.match(serverSource, /Never borrow similarly numbered text from another edition/);
assert.match(serverSource, /fail with wrong_attribution if any legal claim or human-readable section reference is taken from another edition/);
assert.match(serverSource, /codeVersion: source\.codeVersion \|\| defaultSyncCodeVersion/);
assert.match(serverSource, /researchCorpusByPrefix\(registry, source\?\.codePrefix, source\)/);
assert.doesNotMatch(serverSource, /`EXCLUDED_CORPORA:/);
assert.match(clientSource, /function appendResearchAnswerNarrative\(container, result\)/);
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
