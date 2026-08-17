import { readFile, writeFile } from "node:fs/promises";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";

const datasetURL = new URL("./zoning-cases.json", import.meta.url);
const outputURL = new URL("./NYC_ZONING_EVALUATION_REVIEW_PACKET.md", import.meta.url);
const dataset = JSON.parse(await readFile(datasetURL, "utf8"));
const blockedCaseCount = dataset.cases.filter((testCase) =>
  testCase.evidenceReadiness === "blocked"
).length;

function line(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function evidenceExcerpt(section, term, radius = 260) {
  const plainText = line((section.blocks || []).map((block) => block.plainText).join(" "));
  const index = plainText.toLowerCase().indexOf(String(term || "").toLowerCase());
  if (index === -1) return null;
  const start = Math.max(0, index - radius);
  const end = Math.min(plainText.length, index + String(term).length + radius);
  return `${start > 0 ? "…" : ""}${plainText.slice(start, end)}${end < plainText.length ? "…" : ""}`;
}

const output = [
  "# NYC Zoning Resolution Evaluation Review Packet",
  "",
  `Content edition: ${dataset.codeVersion}`,
  "",
  "Status: DRAFT — NOT APPROVED",
  "",
  `Case readiness: ${dataset.cases.length - blockedCaseCount} evidence-ready · ${blockedCaseCount} blocked by known content gaps`,
  "",
  "This packet is for review by a professional qualified to evaluate New York City zoning sources. " +
    "No case in this packet enables Zoning in AI Research. Approval must be explicit and recorded; " +
    "the application never treats a generated answer or an automatic score as reviewer approval.",
  "",
  "## Reviewer checklist",
  "",
  "For every case:",
  "",
  "1. Confirm that the selected evidence is the correct official authority for the question.",
  "2. Confirm that every required concept is supportable from the selected evidence.",
  "3. Confirm that each forbidden claim is genuinely unsafe or unsupported.",
  "4. Check tables, symbols, map scope, amendment dates, and special-district applicability directly.",
  "5. Record missing facts and uncertainty conditions a professional answer must state.",
  "6. Enter reviewer name, review date, disposition, and notes. Do not mark a case approved conditionally.",
  ""
];

for (const [index, testCase] of dataset.cases.entries()) {
  output.push(
    `## ${index + 1}. ${testCase.id}`,
    "",
    `Category: ${testCase.category}`,
    ...(testCase.evidenceReadiness
      ? ["", `Evidence readiness: ${testCase.evidenceReadiness.toUpperCase()}`]
      : []),
    "",
    `Question: ${testCase.question}`,
    "",
    "### Selected official evidence",
    ""
  );
  for (const sectionID of testCase.selectedEvidenceSectionIDs) {
    const [summary, section] = await Promise.all([
      zoningSectionSummary(sectionID),
      zoningSection(sectionID)
    ]);
    output.push(
      `- ZR ${summary.sectionNumber} — ${summary.title}`,
      `  - Permitext section ID: ${sectionID}`,
      `  - Official source: ${section.zoning.sourceURL}`,
      `  - Text version: ${section.zoning.version}`,
      `  - Last amended: ${section.zoning.lastAmended || "not stated"}`,
      `  - Evidence preview: ${line(section.previewText).slice(0, 500)}`
    );
    for (const term of testCase.evidenceReviewTerms || []) {
      const excerpt = evidenceExcerpt(section, term);
      if (!excerpt) {
        throw new Error(`${testCase.id} review term was not found in selected section ${sectionID}: ${term}`);
      }
      output.push(`  - Matched review excerpt for “${term}”: ${excerpt}`);
    }
  }
  if (testCase.knownEvidenceLimitations?.length) {
    output.push(
      "",
      "### Known evidence limitations",
      "",
      ...testCase.knownEvidenceLimitations.map((limitation) => `- ${limitation}`)
    );
  }
  output.push(
    "",
    "### Required concepts",
    "",
    ...testCase.requiredConcepts.map((concept) => `- [ ] ${concept}`),
    "",
    "### Forbidden claims",
    "",
    ...testCase.forbiddenClaims.map((claim) => `- [ ] ${claim}`),
    "",
    "### Reviewer decision",
    "",
    "- Reviewer:",
    "- Qualification / role:",
    "- Review date:",
    "- Disposition: Approve / Revise / Reject",
    "- Notes:",
    "",
    "---",
    ""
  );
}

const rendered = `${output.join("\n").trim()}\n`;
if (process.argv.includes("--write")) {
  await writeFile(outputURL, rendered);
  console.log(`wrote ${outputURL.pathname}`);
} else if (process.argv.includes("--check")) {
  const existing = await readFile(outputURL, "utf8");
  if (existing !== rendered) {
    throw new Error("The Zoning review packet is stale. Run the generator with --write.");
  }
  console.log("zoning review packet is current");
} else {
  process.stdout.write(rendered);
}
