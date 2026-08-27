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
assert.match(serverSource, /RELATIONSHIP: \$\{section\.relationship/);
assert.match(serverSource, /USER_SELECTED_TEXT is the exact model-visible focus and citation target/);
assert.doesNotMatch(serverSource, /`CANONICAL_SECTION_CONTEXT:/);
assert.match(serverSource, /Do not force a generic ancestor heading or redundant parent restatement/);
assert.match(serverSource, /Preserve cumulative and alternative conditions exactly/);
assert.match(serverSource, /A and B must not be restated as A or B/);
assert.match(serverSource, /Treat facts explicitly stated in the current question as established premises/);
assert.match(serverSource, /Ordinary internal corpus exclusions are not user-facing evidence limitations/);
assert.doesNotMatch(serverSource, /`EXCLUDED_CORPORA:/);
assert.match(clientSource, /function appendResearchAnswerNarrative\(container, result\)/);
assert.match(clientSource, /text\.split\(\/\\n\\s\*\\n\/\)/);
assert.match(clientSource, /list\.className = "research-answer-list"/);
assert.doesNotMatch(clientSource, /card\.append\(answer, explanation\)/);

console.log("Permitext adaptive Research answer structure contract passed; paid model calls: no.");
