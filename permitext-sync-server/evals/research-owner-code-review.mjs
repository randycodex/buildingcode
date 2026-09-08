import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Keep evaluator conclusions and their cited authorities out of Research input.
export function ownerCodeResearchInput(testCase) {
  return { question: String(testCase.question || ""), codeVersion: "2022 New York City Construction Codes" };
}

export async function validateOwnerCodeSourceReview() {
  const candidateBytes = await readFile(new URL("./research-owner-code-candidates.json", import.meta.url));
  const candidate = JSON.parse(candidateBytes);
  const review = JSON.parse(await readFile(new URL("./results/research-owner-code-source-review-2026-09-08.json", import.meta.url)));
  const require = (pass, message) => { if (!pass) throw new Error(message); };
  require(createHash("sha256").update(candidateBytes).digest("hex") === review.candidateDatasetSHA256, "Candidate intake changed after source review.");
  require(review.originalIntakeSHA256 === candidate.sourceSHA256, "The source review must identify its original intake.");
  require(review.cases.length === 60 && new Set(review.cases.map((item) => item.id)).size === 60, "All 60 cases must remain represented exactly once.");
  for (const item of review.cases) {
    const original = candidate.cases.find((entry) => entry.id === item.id);
    require(original?.question === item.question && original?.candidateExpectedAnswer === item.originalExpectedAnswer, `${item.id} changed its intake wording.`);
    require(item.professionalApproval === false, `${item.id} cannot acquire professional approval from a source review.`);
    require(item.finding && item.reviewedExpectedAnswer && item.sourceReferences.length, `${item.id} needs a finding, answer and sources.`);
    for (const key of item.sourceReferences) require(review.sources[key]?.url && /^[a-f0-9]{64}$/.test(review.sources[key]?.capturedPassageSHA256), `${item.id} is missing source provenance.`);
    require(JSON.stringify(ownerCodeResearchInput({ ...item, expectedAnswer: "EVALUATOR DATA", sourceIDs: ["MUST NOT LEAK"] })) ===
      JSON.stringify(ownerCodeResearchInput({ question: item.question })), `${item.id} leaked evaluator data.`);
  }
  require(review.cases.filter((item) => item.disposition === "retain").length === review.counts.retain, "Retained-answer count mismatch.");
  require(review.cases.filter((item) => item.disposition === "revise").length === review.counts.revise, "Revised-answer count mismatch.");
  require(review.cases.filter((item) => item.currentConsolidationRefreshPending).length === review.counts.currentConsolidationRefreshPending, "Source freshness limitations must remain visible.");
  return review.counts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await validateOwnerCodeSourceReview());
