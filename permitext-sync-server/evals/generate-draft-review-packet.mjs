import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalsDirectory = dirname(fileURLToPath(import.meta.url));
const datasetPath = join(evalsDirectory, "research-cases.json");
const outputPath = join(evalsDirectory, "review-packets", "draft-cases-review.md");

function bulletList(items, emptyMessage = "None listed.") {
  if (!Array.isArray(items) || items.length === 0) return emptyMessage;
  return items.map((item) => `- ${item}`).join("\n");
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "Not specified";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${displayValue(item)}`)
      .join("; ");
  }
  return String(value);
}

function evidenceMarkdown(selectedEvidence) {
  return selectedEvidence
    .map((evidence) => [
      `#### ${evidence.reference}`,
      "",
      `Canonical section ID: \`${evidence.sectionID}\``,
      "",
      ...evidence.exactPassages.flatMap((passage, index) => [
        `Passage ${index + 1}:`,
        "",
        `> ${passage.replaceAll("\n", "\n> ")}`,
        ""
      ])
    ].join("\n"))
    .join("\n");
}

function citationMarkdown(testCase) {
  const claimsByReference = new Map(
    (testCase.requiredCitationClaims || []).map((item) => [item.reference, item.requiredClaim])
  );
  return testCase.requiredCitations
    .map((reference) => `- **${reference}:** ${claimsByReference.get(reference) || "Required citation."}`)
    .join("\n");
}

function caseMarkdown(testCase, index) {
  return [
    `## ${index + 1}. ${testCase.title}`,
    "",
    `- **Case ID:** \`${testCase.id}\``,
    `- **Current status:** ${testCase.status}`,
    `- **Jurisdiction:** ${testCase.jurisdiction}`,
    `- **Code edition:** ${testCase.codeEdition}`,
    `- **Difficulty:** ${testCase.difficulty}`,
    `- **Topics:** ${testCase.topics.join(", ")}`,
    "",
    "### Scenario source",
    "",
    testCase.sourceReference,
    "",
    "The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.",
    "",
    "### Project context",
    "",
    displayValue(testCase.projectContext),
    "",
    "### Question",
    "",
    testCase.question,
    "",
    "### Exact selected Permitext evidence",
    "",
    evidenceMarkdown(testCase.selectedEvidence),
    "### Proposed expected conclusion",
    "",
    testCase.expectedConclusion,
    "",
    "### Expected uncertainty",
    "",
    displayValue(testCase.expectedUncertainty),
    "",
    "### Required citations and the claim each must support",
    "",
    citationMarkdown(testCase),
    "",
    "### Required concepts",
    "",
    bulletList(testCase.requiredConcepts),
    "",
    "### Facts the answer must identify as missing",
    "",
    bulletList(testCase.missingFacts),
    "",
    "### Claims the answer must not make",
    "",
    bulletList(testCase.forbiddenClaims),
    "",
    "### Existing drafting note",
    "",
    testCase.notes || "None.",
    "",
    "### Reviewer decision",
    "",
    "- [ ] Approve as written",
    "- [ ] Approve after the corrections written below",
    "- [ ] Reject",
    "",
    "**Reviewer name:** ________________________________________________",
    "",
    "**Review date:** ___________________________________________________",
    "",
    "**Corrections or notes:**",
    "",
    "____________________________________________________________________",
    "",
    "____________________________________________________________________",
    "",
    "____________________________________________________________________",
    "",
    "---",
    ""
  ].join("\n");
}

const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const draftCases = dataset.cases.filter((testCase) => testCase.status === "draft");

if (draftCases.length === 0) {
  throw new Error("No draft evaluation cases were found.");
}

const document = [
  "# Permitext AI Evaluation — Draft Case Review Packet",
  "",
  "**Development-only document — contains private answer keys and must not be served to Permitext customers.**",
  "",
  `Generated from \`evals/research-cases.json\` on ${new Date().toISOString()}.`,
  "",
  `This packet contains ${draftCases.length} draft cases. Reviewing this document does not alter the evaluation dataset or approve a case automatically.`,
  "",
  "For each case, confirm that the exact enacted passages are correct, the proposed conclusion follows from those passages, the required concepts and citations are complete, and the missing-fact and forbidden-claim rules are appropriate. Select one decision and write any corrections. A case remains a draft until the decision is deliberately entered into Permitext's owner review system.",
  "",
  "## Reviewer summary",
  "",
  "| Case | Decision | Initials |",
  "| --- | --- | --- |",
  ...draftCases.map((testCase) => `| ${testCase.id} | Approve / Correct / Reject |  |`),
  "",
  "---",
  "",
  ...draftCases.map(caseMarkdown),
  "## Final reviewer statement",
  "",
  "I reviewed the exact selected evidence, expected conclusions, required concepts, citation requirements, forbidden claims, missing-fact conditions, and uncertainty expectations for the decisions recorded above.",
  "",
  "**Reviewer signature or name:** _____________________________________",
  "",
  "**Date:** ___________________________________________________________",
  ""
].join("\n");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, document, "utf8");
console.log(`Saved draft review packet: ${outputPath}`);
