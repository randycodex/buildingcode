import { readFile, writeFile } from "node:fs/promises";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";

const datasetURL = new URL("./zoning-cases.json", import.meta.url);
const outputURL = new URL("./NYC_ZONING_EVALUATION_REVIEW_PACKET.md", import.meta.url);
const dataset = JSON.parse(await readFile(datasetURL, "utf8"));
const blockedCaseCount = dataset.cases.filter((testCase) =>
  testCase.evidenceReadiness === "blocked"
).length;
const approvedCaseCount = dataset.cases.filter((testCase) => testCase.status === "approved").length;
const draftCaseCount = dataset.cases.filter((testCase) => testCase.status === "draft").length;
const rejectedCaseCount = dataset.cases.filter((testCase) => testCase.status === "rejected").length;

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
  "Status: PARTIALLY APPROVED FOR TERRA ANSWER-KEY TESTING",
  "",
  `Case readiness: ${dataset.cases.length - blockedCaseCount} evidence-ready · ${blockedCaseCount} blocked by known content gaps`,
  "",
  `Review status: ${approvedCaseCount} approved for Terra answer-key testing · ${draftCaseCount} draft/revised and awaiting review · ${rejectedCaseCount} rejected`,
  "",
  "Approval in this packet is limited to Terra answer-key testing. It is not professional zoning sign-off, " +
    "does not enable Zoning in public AI Research, and does not authorize paid evaluation. Draft cases still " +
    "require explicit human approval after their revisions are reviewed.",
  "",
  "## Reviewer checklist",
  "",
  "For each draft or revised case awaiting approval:",
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
    "",
    `Case status: ${testCase.status.toUpperCase()}`,
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
    const reviewTerms = [
      ...(testCase.evidenceReviewTerms || []),
      ...(testCase.evidenceReviewTermsBySection?.[String(sectionID)] || [])
    ];
    for (const term of reviewTerms) {
      const excerpt = evidenceExcerpt(section, term);
      if (!excerpt) {
        throw new Error(`${testCase.id} review term was not found in selected section ${sectionID}: ${term}`);
      }
      output.push(`  - Matched review excerpt for “${term}”: ${excerpt}`);
    }
    const amendmentEvents = (testCase.evidenceReviewAmendmentEvents || [])
      .filter((event) => String(event.sectionID) === String(sectionID));
    for (const expectedEvent of amendmentEvents) {
      const event = (section.zoning.amendmentHistory || []).find((candidate) =>
        candidate.effectiveDate === expectedEvent.effectiveDate &&
        candidate.reportNumber === expectedEvent.reportNumber
      );
      if (!event) {
        throw new Error(
          `${testCase.id} amendment event was not found in selected section ${sectionID}: ` +
          `${expectedEvent.effectiveDate} ${expectedEvent.reportNumber}`
        );
      }
      output.push(
        `  - Amendment record: ${event.effectiveDate} · ${event.reportNumber} · ${event.action}`,
        `    - Project: ${event.projectName || "not stated"}`,
        `    - Official report: ${event.reportURL}`,
        `    - Notes: ${event.notes || "not stated"}`
      );
    }
  }
  if (testCase.revisionNotes) {
    output.push(
      "",
      "### Applied revision",
      "",
      `- ${testCase.revisionNotes}`,
      `- Applied: ${testCase.revisionAppliedAt}`
    );
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
    ...(testCase.status === "approved"
      ? [
          "### Recorded decision",
          "",
          `- Reviewer: ${testCase.reviewer}`,
          "- Role: Permitext owner",
          `- Review date: ${testCase.reviewedAt}`,
          `- Disposition: Approved for ${dataset.governance.approvedCaseUse}`,
          "- Boundary: Not professional zoning sign-off; public Zoning Research remains disabled."
        ]
      : [
          "### Reviewer decision",
          "",
          "- Reviewer:",
          "- Qualification / role:",
          "- Review date:",
          "- Disposition: Approve / Revise / Reject",
          "- Notes:"
        ]),
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
