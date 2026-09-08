import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const reconciledAnswerKeyURL = new URL("./research-reconciled-answer-key.json", import.meta.url);
export const reconciledAnswerKeyMarkdownURL = new URL("../../docs/PERMITEXT_RECONCILED_RESEARCH_ANSWER_KEY_2026-09-07.md", import.meta.url);
const amendmentSource = "research-answer-key-amendments.json";
const amendmentFields = new Set(["expectedAnswer", "requiredConcepts", "forbiddenClaims", "missingFacts", "reconciliationNotes"]);

// Explicit allowlist: reference answers, rubrics, reviewer notes, and forbidden
// claims are evaluator data. They must never become answering-model input.
export function reconciledResearchEvaluationInput(testCase) {
  return {
    question: [testCase.scenario, testCase.question].filter(Boolean).join("\n\n"),
    codeVersion: testCase.codeVersion,
    projectContext: structuredClone(testCase.projectContext || {}),
    selectedEvidence: structuredClone(testCase.selectedEvidence || []),
    selectedEvidenceSectionIDs: [...(testCase.selectedEvidenceSectionIDs || [])]
  };
}

// Preserve historical source approvals without paying a judge to score a new
// answer against wording that the development key has explicitly corrected.
export async function assertResearchEvaluationReferencesCurrent(sourceCaseIDs, sourceDataset = "research-cases.json") {
  const dataset = JSON.parse(await readFile(reconciledAnswerKeyURL, "utf8"));
  await validateReconciledAnswerKey(dataset);
  const requested = new Set(sourceCaseIDs);
  const amended = dataset.cases.filter((testCase) => testCase.sourceDataset === sourceDataset &&
    requested.has(testCase.sourceCaseID) && testCase.developmentAmendmentID);
  if (amended.length) throw Object.assign(new Error(
    `Evaluation reference corrected in the development key: ${amended.map((item) => item.sourceCaseID).join(", ")}. ` +
    "The legacy evaluator must not score these original source answers as current approved references. " +
    "Use the separately recorded amended development rubric for diagnostics; its professional review remains pending."
  ), { code: "RESEARCH_EVALUATION_REFERENCE_AMENDED" });
}

export function parseDOBReviewCases(packet) {
  const section = (body, name) => body.match(new RegExp(`^### ${name}\\n\\n([\\s\\S]*?)(?=^### |$(?![\\s\\S]))`, "m"))?.[1]?.trim() || "";
  const cases = new Map();
  for (const match of packet.matchAll(/^## `(dobnow-\d+)`[^\n]*\n([\s\S]*?)(?=^## `dobnow-|$(?![\s\S]))/gm)) {
    cases.set(match[1], {
      scenario: section(match[2], "Scenario"),
      question: section(match[2], "Question"),
      expectedAnswer: section(match[2], "Proposed answer key"),
      requiredConcepts: [...section(match[2], "Required concepts").matchAll(/^- (.+)$/gm)].map((item) => item[1]),
      forbiddenClaims: [...section(match[2], "Forbidden claims").matchAll(/^- (.+)$/gm)].map((item) => item[1])
    });
  }
  return cases;
}

export async function validateReconciledAnswerKey(dataset) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  assert(dataset.schema === "permitext-reconciled-answer-key-v1", "Unknown answer-key schema.");
  assert(dataset.cases.length === 50, "The reconciliation must contain exactly the 50 intake cases.");
  assert(["paidModelCalls", "publicResearchRelease", "deployment", "newProfessionalApproval"]
    .every((key) => dataset.authorization?.[key] === false), "Reconciliation cannot authorize paid runs, approval or release.");
  const sources = {};
  for (const [path, expectedHash] of Object.entries(dataset.sourceFileSHA256)) {
    const bytes = await readFile(new URL(path, import.meta.url));
    assert(createHash("sha256").update(bytes).digest("hex") === expectedHash,
      `Reviewed source changed: ${path}. Reconcile explicitly instead of silently using an older answer.`);
    sources[path] = path.endsWith(".json") ? JSON.parse(bytes) : parseDOBReviewCases(bytes.toString("utf8"));
  }
  const amendments = new Map();
  if (sources[amendmentSource]) {
    const registry = sources[amendmentSource];
    assert(registry.schema === "permitext-research-answer-key-amendments-v1", "Unknown amendment registry schema.");
    assert(registry.newProfessionalApproval === false, "Development corrections cannot confer professional approval.");
    for (const amendment of registry.amendments) {
      assert(amendment.id && !amendments.has(amendment.id), "Missing or duplicate amendment ID.");
      assert(amendment.status === "development-correction-pending-professional-review", "Amendment approval must remain pending.");
      assert(amendment.rationale && amendment.sourceReferences?.length, "An amendment needs its rationale and source basis.");
      assert(Object.keys(amendment.replacement || {}).every((field) => amendmentFields.has(field)), "Amendments cannot change answering-model inputs or source approval history.");
      assert(typeof amendment.replacement?.expectedAnswer === "string" && amendment.replacement.expectedAnswer,
        "An amendment must state its corrected answer.");
      amendments.set(amendment.id, amendment);
    }
  }
  const usedAmendments = new Set();
  const ids = new Set();
  const counts = { CC: 0, ZR: 0, DOBNOW: 0 };
  for (const testCase of dataset.cases) {
    assert(!ids.has(testCase.id), `Duplicate case ${testCase.id}.`);
    ids.add(testCase.id);
    counts[testCase.id.split("-")[0]] += 1;
    const sourceDataset = sources[testCase.sourceDataset];
    const sourceCase = sourceDataset instanceof Map
      ? sourceDataset.get(testCase.sourceCaseID)
      : sourceDataset?.cases.find((item) => item.id === testCase.sourceCaseID);
    assert(sourceCase, `Missing reviewed source for ${testCase.id}.`);
    const amendment = testCase.developmentAmendmentID ? amendments.get(testCase.developmentAmendmentID) : null;
    if (testCase.developmentAmendmentID) {
      assert(amendment && amendment.caseID === testCase.id && amendment.sourceDataset === testCase.sourceDataset &&
        amendment.sourceCaseID === testCase.sourceCaseID, `${testCase.id} has an unknown or mismatched amendment.`);
      assert(!usedAmendments.has(amendment.id), "An amendment cannot apply to multiple cases.");
      assert(createHash("sha256").update(JSON.stringify(sourceCase)).digest("hex") === amendment.sourceCaseSHA256,
        `${testCase.id} amendment no longer matches its original source case.`);
      assert(createHash("sha256").update(JSON.stringify(reconciledResearchEvaluationInput(testCase))).digest("hex") === amendment.evaluationInputSHA256,
        `${testCase.id} amendment changed answering-model inputs.`);
      assert(testCase.reconciliationStatus === amendment.status, `${testCase.id} must identify its pending amendment review.`);
      assert(testCase.sourceCaseStatus === sourceCase.status && testCase.sourceReviewedAt === sourceCase.reviewedAt,
        `${testCase.id} changed its original approval history.`);
      for (const [field, value] of Object.entries(amendment.replacement)) {
        assert(JSON.stringify(testCase[field]) === JSON.stringify(value), `${testCase.id} differs from its recorded amendment: ${field}.`);
      }
      usedAmendments.add(amendment.id);
    }
    assert(testCase.question === sourceCase.question, `${testCase.id} does not use its reviewed question.`);
    assert(testCase.expectedAnswer && testCase.requiredConcepts.length && testCase.forbiddenClaims.length,
      `${testCase.id} is missing its answer or acceptance rubric.`);
    assert(JSON.stringify(testCase.requiredConcepts) === JSON.stringify(amendment?.replacement.requiredConcepts || sourceCase.requiredConcepts), `${testCase.id} lost a required concept.`);
    assert(JSON.stringify(testCase.forbiddenClaims) === JSON.stringify(amendment?.replacement.forbiddenClaims || sourceCase.forbiddenClaims), `${testCase.id} lost a forbidden-claim boundary.`);
    if (testCase.id.startsWith("DOBNOW")) {
      assert(testCase.scenario && testCase.scenario === sourceCase.scenario, `${testCase.id} lost its scenario.`);
      assert(testCase.expectedAnswer === (amendment?.replacement.expectedAnswer || sourceCase.expectedAnswer), `${testCase.id} lost a reviewed answer correction.`);
    } else {
      if (testCase.id.startsWith("CC")) {
        assert(testCase.expectedAnswer === (amendment?.replacement.expectedAnswer || sourceCase.expectedConclusion), `${testCase.id} differs from its reviewed construction answer.`);
        assert(JSON.stringify(testCase.selectedEvidence) === JSON.stringify(sourceCase.selectedEvidence), `${testCase.id} lost its selected passages.`);
        assert(JSON.stringify(testCase.projectContext) === JSON.stringify(sourceCase.projectContext), `${testCase.id} lost its project facts.`);
      } else {
        assert(testCase.codeVersion === sourceDataset.codeVersion, `${testCase.id} has a mismatched corpus snapshot.`);
        assert(JSON.stringify(testCase.selectedEvidenceSectionIDs) === JSON.stringify(sourceCase.selectedEvidenceSectionIDs), `${testCase.id} changed selected evidence.`);
      }
    }
  }
  assert(usedAmendments.size === amendments.size, "A recorded amendment was silently omitted from the development key.");
  assert(counts.CC === 5 && counts.ZR === 21 && counts.DOBNOW === 24, "Reconciled case families do not match the intake.");
  return counts;
}

export function renderReconciledAnswerKey(dataset) {
  const lines = [
    "# Permitext — Reconciled Research Questions and Answer Key",
    "", `Reconciled: ${dataset.reconciledOn}. Contains 5 Construction Code, 21 Zoning, and 24 DOB NOW cases.`,
    "", "This is a development-only acceptance reference. The uploaded file remains unchanged. Reference wording is illustrative; source correctness, complete qualifications, and useful answers govern acceptance.",
    "", "## Approved answer structure", "",
    dataset.answerSequence.join(" → "), "",
    "Put a condition that changes Yes/No in the opening answer. Use adjacent citations, identify the relevant edition or source snapshot, and show arithmetic when it helps. Use paragraphs for narrow answers, tables for comparisons or parallel requirements, and numbered steps for workflows. Do not force four headings or ask for facts that do not affect the result.",
    "", "## Reconciliation and review boundaries", "",
    ...dataset.sourceNotes.map((note) => `- ${note}`),
    "- The 24 DOB NOW scenarios are restored. Several Zoning questions are replaced with their revised repository versions; their original intake wording remains visible below.",
    "- Construction answers retain Plumbing Code scope and vanity/lavatory distinctions. Explicit development corrections below preserve the original source record and carry their own pending-review status. DOB NOW answers retain the subsequent-filing completion distinction, PAA source conflict, site-safety applicability, DEP drainage condition, and distinct Loft Board routes.",
    "- This work does not authorize paid model calls, change source approval status, enable public Research, or establish professional sign-off. New reconciled prose has no new independent professional approval.",
    "", "## Source provenance", "",
    `Intake: \`${dataset.intake.filename}\`; SHA-256 \`${dataset.intake.sha256}\`.`,
    "",
    ...Object.entries(dataset.sourceFileSHA256).map(([path, hash]) => `- [${path}](../permitext-sync-server/evals/${path}) — SHA-256 \`${hash}\`.`),
    "", "DOB workflow material remains dated to its review snapshot. Consult current [DOB FAQs](https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page), [NB/Alteration-CO FAQs](https://www.nyc.gov/site/buildings/industry/new-building-buildfaqs.page), [PAA guidance](https://www.nyc.gov/site/buildings/industry/post-approval-amendment-paa.page), [Application User Guide](https://www.nyc.gov/assets/buildings/pdf/dob_now_application_user_guide.pdf), [release notes](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf), and [service updates](https://www.nyc.gov/site/buildings/dob/service-updates.page) for live guidance. A source URL is not a claim that all 50 answers were newly verified online.",
    ""
  ];
  for (const testCase of dataset.cases) {
    lines.push(`## ${testCase.id} — ${testCase.title}`, "",
      `Source basis: ${testCase.codeVersion}`, "",
      `Source case: \`${testCase.sourceCaseID}\`; recorded status: ${testCase.sourceCaseStatus}; reviewed: ${testCase.sourceReviewedAt}. Scope: ${testCase.sourceApprovalScope}`, "");
    if (testCase.developmentAmendmentID) lines.push(
      `**Development correction:** \`${testCase.developmentAmendmentID}\`. Status: ${testCase.reconciliationStatus}. The original approval above is historical; it does not approve this corrected wording or rubric.`, "");
    if (testCase.scenario) lines.push("**Scenario supplied to Research:**", "", testCase.scenario, "");
    if (testCase.projectContext && Object.keys(testCase.projectContext).length) {
      lines.push("**Project facts supplied to Research:**", "", "```json", JSON.stringify(testCase.projectContext, null, 2), "```", "");
    }
    if (testCase.intakeQuestion !== testCase.question) lines.push("**Original intake wording:**", "", testCase.intakeQuestion, "");
    lines.push("**Evaluation question:**", "", testCase.question, "", "**Expected answer:**", "", testCase.expectedAnswer, "",
      "**Required concepts:**", "", ...testCase.requiredConcepts.map((value) => `- ${value}`), "",
      "**Forbidden conclusions:**", "", ...testCase.forbiddenClaims.map((value) => `- ${value}`), "");
    if (testCase.requiredCitations.length) lines.push("**Authority / evidence to verify:**", "", ...testCase.requiredCitations.map((value) => `- ${value}`), "");
    if (testCase.selectedEvidenceSectionIDs?.length) lines.push(`Selected canonical Zoning section IDs: ${testCase.selectedEvidenceSectionIDs.join(", ")}.`, "");
    if (testCase.missingFacts.length) lines.push("**Missing facts:**", "", ...testCase.missingFacts.map((value) => `- ${value}`), "");
    lines.push("**Reconciliation notes:**", "", ...testCase.reconciliationNotes.map((value) => `- ${value}`), "");
  }
  return `${lines.join("\n").trim()}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dataset = JSON.parse(await readFile(reconciledAnswerKeyURL, "utf8"));
  const counts = await validateReconciledAnswerKey(dataset);
  const markdown = renderReconciledAnswerKey(dataset);
  if (process.argv.includes("--write")) await writeFile(reconciledAnswerKeyMarkdownURL, markdown);
  else if (await readFile(reconciledAnswerKeyMarkdownURL, "utf8") !== markdown) {
    throw new Error("Reconciled Markdown differs from its source dataset. Regenerate with --write.");
  }
  console.log(`Reconciled answer key verified: ${JSON.stringify(counts)}; no provider calls.`);
}
