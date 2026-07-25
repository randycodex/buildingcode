import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvaluationDataset } from "./evaluation-schema.mjs";
import { evidenceDiscoveryVersion } from "../evidence-discovery.mjs";

const evaluationDirectory = dirname(fileURLToPath(import.meta.url));
const retrievalCasesPath = join(evaluationDirectory, "evidence-retrieval-cases.json");
const researchCasesPath = join(evaluationDirectory, "research-cases.json");
const defaultOutputPath = join(
  evaluationDirectory,
  "review-packets",
  "evidence-retrieval-drafts-review.md"
);

function quoteBlock(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function renderPacket(retrievalDataset, researchDataset) {
  if (retrievalDataset.retrievalVersion !== evidenceDiscoveryVersion) {
    throw new Error("The retrieval dataset version does not match the current implementation.");
  }
  const researchByID = new Map(researchDataset.cases.map((testCase) => [testCase.id, testCase]));
  const lines = [
    "# Permitext Evidence Retrieval Draft Review Packet",
    "",
    `Retrieval implementation: \`${retrievalDataset.retrievalVersion}\``,
    "",
    "All cases in this packet are drafts. A knowledgeable reviewer must approve, correct, or reject the expected candidate set and passage relevance before any case can become a release gate. Retrieval output is candidate evidence only and does not authorize or generate a Research answer.",
    "",
    "Run `npm run eval:retrieval` from `permitext-sync-server` for the current free diagnostic ranks and recall. No paid model call is required.",
    "",
    "## Known coverage gaps",
    "",
    ...retrievalDataset.coverageGaps.map((gap) => `- ${gap}`),
    ""
  ];

  retrievalDataset.cases.forEach((retrievalCase, index) => {
    const researchCase = researchByID.get(retrievalCase.sourceResearchCaseID);
    if (!researchCase) {
      throw new Error(`${retrievalCase.id} references a missing Research case.`);
    }
    lines.push(
      `## ${index + 1}. ${retrievalCase.id}`,
      "",
      `- Dataset status: **${retrievalCase.status.toUpperCase()}**`,
      `- Expected behavior: \`${retrievalCase.expectedBehavior}\``,
      `- Diagnostic depth: ${retrievalCase.evaluationDepth}`,
      `- Categories: ${retrievalCase.scenarioCategories.join(", ")}`,
      `- Source Research case: \`${researchCase.id}\``,
      ...(retrievalCase.expectedPreparationBlockedSectionIDs?.length
        ? [`- Must block text-only preparation for section IDs: ${retrievalCase.expectedPreparationBlockedSectionIDs.map((id) => `\`${id}\``).join(", ")}`]
        : []),
      ...(retrievalCase.expectedOutsideCurrentLibrary?.length
        ? [`- Must disclose outside-scope authorities: ${retrievalCase.expectedOutsideCurrentLibrary.join(", ")}`]
        : []),
      ...(retrievalCase.expectedCoverageLimitationKinds?.length
        ? [`- Required coverage limitations: ${retrievalCase.expectedCoverageLimitationKinds.map((kind) => `\`${kind}\``).join(", ")}`]
        : []),
      "",
      "### Project question",
      "",
      researchCase.question,
      "",
      "### Review intent",
      "",
      retrievalCase.notes,
      "",
      "### Proposed expected evidence",
      ""
    );
    researchCase.selectedEvidence.forEach((evidence) => {
      lines.push(
        `#### ${evidence.reference} — section ID ${evidence.sectionID}`,
        ""
      );
      evidence.exactPassages.forEach((passage) => {
        lines.push(quoteBlock(passage), "");
      });
    });
    lines.push(
      "### Knowledgeable-human decision",
      "",
      "- [ ] Approve this candidate-set expectation as written",
      "- [ ] Correct the expected sections or passages",
      "- [ ] Reject this scenario as unsuitable",
      "",
      "Reviewer:",
      "",
      "Decision date:",
      "",
      "Corrections or notes:",
      "",
      "---",
      ""
    );
  });
  return `${lines.join("\n").trim()}\n`;
}

const [retrievalText, researchText] = await Promise.all([
  readFile(retrievalCasesPath, "utf8"),
  readFile(researchCasesPath, "utf8")
]);
const retrievalDataset = JSON.parse(retrievalText);
const researchDataset = validateEvaluationDataset(JSON.parse(researchText));
const packet = renderPacket(retrievalDataset, researchDataset);
const writeIndex = process.argv.indexOf("--write");
if (writeIndex >= 0) {
  const explicitPath = process.argv[writeIndex + 1];
  const outputPath = explicitPath ? resolve(explicitPath) : defaultOutputPath;
  await writeFile(outputPath, packet, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  process.stdout.write(packet);
}
