import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";

export const researchBenchmarkRetrievalEvaluationVersion =
  "20260811-required-bc-recall-v1";

function normalizedReference(value) {
  return String(value || "").trim().replace(/\.$/, "");
}

function canonicalBuildingCodeSections(canonicalSectionIndex) {
  const entries = Object.entries(canonicalSectionIndex?.byCodeChapterSection || {})
    .filter(([key]) => key.startsWith("BC:"))
    .map(([key, sectionID]) => {
      const [, chapterNumber, sectionNumber] = key.split(":");
      return {
        codePrefix: "BC",
        chapterNumber,
        sectionNumber,
        sectionID: String(sectionID)
      };
    });
  return new Map(entries.map((entry) => [entry.sectionNumber, entry]));
}

function canonicalReference(sectionByNumber, sectionNumber, { table = false } = {}) {
  const normalized = normalizedReference(sectionNumber);
  return sectionByNumber.get(normalized) ||
    (table ? sectionByNumber.get(`${normalized}.1`) : null) ||
    null;
}

function referenceMatches(authority, pattern) {
  return Array.from(String(authority || "").matchAll(pattern));
}

export function requiredBuildingCodeReferences(testCase, canonicalSectionIndex) {
  const sectionByNumber = canonicalBuildingCodeSections(canonicalSectionIndex);
  const references = new Map();
  const skipped = [];
  for (const citation of testCase?.citations || []) {
    if (citation.role !== "required" || !/\bNYC BC\b/i.test(citation.authority || "")) continue;
    const authority = String(citation.authority || "");
    const applicableIndex = authority.search(/\bapplicable\b/i);
    const matches = [
      ...referenceMatches(authority, /§{1,2}\s*([A-Z]?\d+(?:\.\d+)*)/gi)
        .map((match) => ({ match, table: false })),
      ...referenceMatches(authority, /\bTable\s+([A-Z]?\d+(?:\.\d+)*)/gi)
        .map((match) => ({ match, table: true }))
    ].sort((left, right) => left.match.index - right.match.index);
    for (const { match, table } of matches) {
      const cited = normalizedReference(match[1]);
      if (applicableIndex >= 0 && match.index > applicableIndex) {
        skipped.push({
          citation: `${table ? "Table " : "BC "}${cited}`,
          reason: "project-dependent applicable alternative"
        });
        continue;
      }
      const canonical = canonicalReference(sectionByNumber, cited, { table });
      if (!canonical) {
        skipped.push({
          citation: `${table ? "Table " : "BC "}${cited}`,
          reason: "no canonical NYC BC section mapping"
        });
        continue;
      }
      references.set(canonical.sectionID, {
        ...canonical,
        reference: `BC ${canonical.sectionNumber}`,
        citedAs: `${table ? "Table " : "BC "}${cited}`
      });
    }
  }
  return {
    references: Array.from(references.values()),
    skipped
  };
}

function rankMap(candidates) {
  return new Map((candidates || []).map((candidate) => [
    String(candidate.sectionID || ""),
    Number(candidate.rank) || null
  ]));
}

function sourceIdentity(source) {
  const sectionID = String(source?.sectionID || "").trim();
  if (sectionID) return `id:${sectionID}`;
  return `reference:${String(source?.codePrefix || "").toUpperCase()}:${String(source?.sectionNumber || "")}`;
}

function expectedIdentity(reference) {
  return reference.sectionID
    ? `id:${reference.sectionID}`
    : `reference:${reference.codePrefix}:${reference.sectionNumber}`;
}

export async function evaluateResearchBenchmarkRetrieval({
  dataset,
  canonicalSectionIndex,
  discover,
  resolveSection,
  firstCase = 1,
  lastCase = 27
}) {
  if (typeof discover !== "function" || typeof resolveSection !== "function") {
    throw new Error("Offline benchmark retrieval requires discovery and canonical-section adapters.");
  }
  const eligibleCases = (dataset?.cases || []).filter((testCase) =>
    testCase.number >= firstCase && testCase.number <= lastCase
  );
  const results = [];
  let paidModelCall = false;
  for (const testCase of eligibleCases) {
    const expectations = requiredBuildingCodeReferences(testCase, canonicalSectionIndex);
    if (!expectations.references.length) continue;
    let discoveryResult = null;
    const evidence = await assembleResearchEvidence({
      question: testCase.question,
      discover: async (options) => {
        discoveryResult = await discover(options);
        paidModelCall ||= discoveryResult?.paidModelCall === true;
        return discoveryResult;
      },
      resolveSection
    });
    const candidateRanks = rankMap(discoveryResult?.candidates);
    const evidenceIdentities = new Set(evidence.sources.map(sourceIdentity));
    const required = expectations.references.map((reference) => {
      const candidateRank = candidateRanks.get(reference.sectionID) || null;
      const evidenceHit = evidenceIdentities.has(expectedIdentity(reference));
      const evidenceSource = evidence.sources.find((source) =>
        sourceIdentity(source) === expectedIdentity(reference)
      );
      return {
        reference: reference.reference,
        sectionID: reference.sectionID,
        candidateRank,
        candidateHit: candidateRank !== null,
        evidenceHit,
        evidenceOrigin: evidenceSource?.origin || null
      };
    });
    const candidateHits = required.filter((item) => item.candidateHit).length;
    const evidenceHits = required.filter((item) => item.evidenceHit).length;
    results.push({
      id: testCase.id,
      number: testCase.number,
      question: testCase.question,
      required,
      skipped: expectations.skipped,
      candidateCount: discoveryResult?.candidates?.length || 0,
      evidenceSourceCount: evidence.sources.length,
      candidateRecall: candidateHits / required.length,
      evidenceRecall: evidenceHits / required.length,
      fullCandidateRecall: candidateHits === required.length,
      fullEvidenceRecall: evidenceHits === required.length,
      limitations: evidence.limitations.map((item) => item.kind)
    });
  }
  const requiredCount = results.reduce((sum, result) => sum + result.required.length, 0);
  const candidateHitCount = results.reduce(
    (sum, result) => sum + result.required.filter((item) => item.candidateHit).length,
    0
  );
  const evidenceHitCount = results.reduce(
    (sum, result) => sum + result.required.filter((item) => item.evidenceHit).length,
    0
  );
  return {
    schemaVersion: 1,
    evaluationVersion: researchBenchmarkRetrievalEvaluationVersion,
    benchmarkVersion: dataset?.benchmarkVersion || "",
    scope: { firstCase, lastCase, sourceMode: "offline-local-enacted-corpus" },
    paidModelCall,
    summary: {
      caseCount: results.length,
      requiredCitationCount: requiredCount,
      candidateRecall: requiredCount ? candidateHitCount / requiredCount : 0,
      evidenceRecall: requiredCount ? evidenceHitCount / requiredCount : 0,
      fullCandidateRecallCases: results.filter((result) => result.fullCandidateRecall).length,
      fullEvidenceRecallCases: results.filter((result) => result.fullEvidenceRecall).length
    },
    cases: results
  };
}

export function formatResearchBenchmarkRetrievalReport(report) {
  const lines = [
    `Permitext Research benchmark offline retrieval recall (${report.evaluationVersion})`
  ];
  for (const result of report.cases) {
    const required = result.required.map((item) =>
      `${item.reference}=candidate:${item.candidateRank || "missed"}/evidence:${item.evidenceHit ? item.evidenceOrigin : "missed"}`
    ).join(", ");
    lines.push(
      `${result.id}: candidate ${(result.candidateRecall * 100).toFixed(0)}%; ` +
      `evidence ${(result.evidenceRecall * 100).toFixed(0)}%; ${required}`
    );
    if (result.skipped.length) {
      lines.push(`  excluded: ${result.skipped.map((item) => `${item.citation} (${item.reason})`).join(", ")}`);
    }
  }
  lines.push(
    `Summary: ${report.summary.caseCount} cases, ${report.summary.requiredCitationCount} concrete required citations, ` +
    `${(report.summary.candidateRecall * 100).toFixed(1)}% candidate recall@12, ` +
    `${(report.summary.evidenceRecall * 100).toFixed(1)}% assembled-evidence recall, ` +
    `${report.summary.fullEvidenceRecallCases}/${report.summary.caseCount} cases with full evidence recall, ` +
    `paid model calls: ${report.paidModelCall ? "yes" : "no"}.`
  );
  return lines.join("\n");
}
