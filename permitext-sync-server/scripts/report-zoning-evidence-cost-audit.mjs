import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { researchPercentile } from "../research-economics.mjs";

const resultURL = new URL(
  "../evals/results/2026-08-30T17-54-11-252Z-5e394dd0-fce2-4fd7-8c5a-cb05dcb29e53.json",
  import.meta.url
);

const maximumEvidenceCharacters = 48_000;
const nearMaximumEvidenceCharacters = 47_000;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function distribution(values) {
  if (!values.length) return { count: 0, mean: 0, p50: 0, p90: 0, maximum: 0 };
  return {
    count: values.length,
    mean: Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(3)),
    p50: Number(researchPercentile(values, 0.5).toFixed(3)),
    p90: Number(researchPercentile(values, 0.9).toFixed(3)),
    maximum: Number(Math.max(...values).toFixed(3))
  };
}

function reviewedPassageCharacters(testCase = {}) {
  return (testCase.selectedEvidence || []).reduce((caseTotal, source) =>
    caseTotal + (source.exactPassages || []).reduce((sourceTotal, passage) =>
      sourceTotal + String(passage || "").length, 0), 0);
}

export async function createZoningEvidenceCostAudit() {
  const result = JSON.parse(await fs.readFile(resultURL, "utf8"));
  const completedCases = result.results
    .filter((item) => item.operationMetric?.status === "completed")
    .map((item) => {
      const reviewedCharacters = reviewedPassageCharacters(item.testCase);
      const assembledCharacters = number(item.answer?.retrieval?.usage?.characterCount);
      return {
        caseID: item.testCase.id,
        passed: item.scoring?.passed === true,
        score: number(item.scoring?.overallScore),
        reviewedPassageCharacters: reviewedCharacters,
        assembledEvidenceCharacters: assembledCharacters,
        nonPassageEvidenceCharacters: Math.max(0, assembledCharacters - reviewedCharacters),
        pinnedCount: number(item.answer?.retrieval?.usage?.pinnedCount),
        discoveredCount: number(item.answer?.retrieval?.usage?.discoveredCount),
        crossReferenceCount: number(item.answer?.retrieval?.usage?.crossReferenceCount),
        answerInputTokens: number(item.answer?.usage?.inputTokens),
        verificationAttempts: number(item.answer?.verification?.attempts),
        operatingCostUSD: number(item.operationMetric?.conservativeProviderCostUSD)
      };
    });
  const nearMaximumCases = completedCases
    .filter((item) => item.assembledEvidenceCharacters >= nearMaximumEvidenceCharacters)
    .map((item) => item.caseID);
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-30T19:30:00.000Z",
    source: {
      runID: result.configuration.runID,
      gitCommit: result.configuration.gitCommit,
      resultStatus: result.status,
      maximumEvidenceCharacters,
      nearMaximumEvidenceCharacters
    },
    sample: {
      completedCases: completedCases.length,
      qualityPasses: completedCases.filter((item) => item.passed).length,
      revisedCases: completedCases.filter((item) => item.verificationAttempts > 1).length
    },
    distributions: {
      reviewedPassageCharacters: distribution(completedCases.map((item) => item.reviewedPassageCharacters)),
      assembledEvidenceCharacters: distribution(completedCases.map((item) => item.assembledEvidenceCharacters)),
      nonPassageEvidenceCharacters: distribution(completedCases.map((item) => item.nonPassageEvidenceCharacters)),
      answerInputTokens: distribution(completedCases.map((item) => item.answerInputTokens)),
      operatingCostUSD: distribution(completedCases.map((item) => item.operatingCostUSD))
    },
    pressure: {
      nearMaximumCaseCount: nearMaximumCases.length,
      nearMaximumCaseRate: Number((nearMaximumCases.length / completedCases.length).toFixed(4)),
      nearMaximumCaseIDs: nearMaximumCases
    },
    cases: completedCases,
    recommendation: {
      evidenceCostReductionRequired: true,
      retrievalLimitChangeAuthorized: false,
      nextGate: "Prototype a supplemental-evidence budget that always preserves every exact pinned passage, reviewed structured source, and controlling discovered provision; pass no-cost recall and Zoning contracts before requesting another paid run."
    }
  };
}

export function renderZoningEvidenceCostAuditMarkdown(report) {
  const reviewed = report.distributions.reviewedPassageCharacters;
  const assembled = report.distributions.assembledEvidenceCharacters;
  return `# Permitext Zoning Research evidence-cost audit\n\n` +
    `Generated locally from retained run ${report.source.runID} without provider calls.\n\n` +
    `${report.sample.completedCases} completed cases averaged ${Math.round(reviewed.mean).toLocaleString("en-US")} owner-reviewed exact-passage characters and ${Math.round(assembled.mean).toLocaleString("en-US")} assembled evidence characters. ${report.pressure.nearMaximumCaseCount} cases reached at least ${report.source.nearMaximumEvidenceCharacters.toLocaleString("en-US")} of the ${report.source.maximumEvidenceCharacters.toLocaleString("en-US")}-character ceiling.\n\n` +
    `No retrieval limit change is authorized by this audit. The next gate is a no-cost prototype that preserves every exact pin, reviewed structured source, and controlling discovered provision before any paid rerun.\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await createZoningEvidenceCostAudit();
  console.log(process.argv.includes("--json")
    ? JSON.stringify(report, null, 2)
    : renderZoningEvidenceCostAuditMarkdown(report));
}
