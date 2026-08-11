import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";

export const researchBenchmarkRetrievalEvaluationVersion =
  "20260811-required-enacted-code-recall-v2";

function normalizedReference(value) {
  return String(value || "").trim().replace(/\.$/, "");
}

function canonicalCodeSections(canonicalSectionIndex, codePrefixes = ["BC"]) {
  const allowedPrefixes = new Set(codePrefixes.map((item) => String(item).toUpperCase()));
  const entries = Object.entries(canonicalSectionIndex?.byCodeChapterSection || {})
    .filter(([key]) => allowedPrefixes.has(String(key).split(":")[0]))
    .map(([key, sectionID]) => {
      const [codePrefix, chapterNumber, sectionNumber] = key.split(":");
      return {
        codePrefix,
        chapterNumber,
        sectionNumber,
        sectionID: String(sectionID)
      };
    });
  return new Map(entries.map((entry) => [`${entry.codePrefix}:${entry.sectionNumber}`, entry]));
}

function canonicalReference(sectionByNumber, codePrefix, sectionNumber, { table = false } = {}) {
  const normalized = normalizedReference(sectionNumber);
  return sectionByNumber.get(`${codePrefix}:${normalized}`) ||
    (table ? sectionByNumber.get(`${codePrefix}:${normalized}.1`) : null) ||
    null;
}

function referenceMatches(authority, pattern) {
  return Array.from(String(authority || "").matchAll(pattern));
}

function escapedPattern(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedCodePrefixes(codePrefixes) {
  const values = Array.isArray(codePrefixes) ? codePrefixes : [codePrefixes];
  return Array.from(new Set(values
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean)));
}

function authorityCodePrefix(authority, prefixPattern, beforeIndex = Infinity) {
  const source = String(authority || "");
  const matches = Array.from(
    source.slice(0, Number.isFinite(beforeIndex) ? beforeIndex + 1 : undefined)
      .matchAll(new RegExp(`\\bNYC\\s+(${prefixPattern})\\b`, "gi"))
  );
  return matches.at(-1)?.[1]?.toUpperCase() || null;
}

function expandedRange(start, end) {
  const startParts = start.split(".");
  const endParts = end.split(".");
  if (startParts.length !== endParts.length || startParts.length < 2) return [start, end];
  if (startParts.slice(0, -1).join(".") !== endParts.slice(0, -1).join(".")) return [start, end];
  const first = Number(startParts.at(-1));
  const last = Number(endParts.at(-1));
  if (!Number.isInteger(first) || !Number.isInteger(last) || last <= first || last - first > 50) {
    return [start, end];
  }
  return Array.from({ length: last - first + 1 }, (_, index) =>
    [...startParts.slice(0, -1), first + index].join(".")
  );
}

function allConcreteCitationReferences(authority) {
  const source = String(authority || "");
  const references = [];
  const sectionMarkers = Array.from(source.matchAll(/§{1,2}\s*/g));
  for (const [markerIndex, marker] of sectionMarkers.entries()) {
    const nextMarkerIndex = sectionMarkers[markerIndex + 1]?.index ?? source.length;
    const provisionalEnd = Math.min(
      nextMarkerIndex,
      ...["—", ";"].map((delimiter) => {
        const index = source.indexOf(delimiter, marker.index + marker[0].length);
        return index < 0 ? source.length : index;
      })
    );
    const content = source.slice(marker.index + marker[0].length, provisionalEnd);
    const first = content.match(/^([A-Z]?\d+(?:\.\d+)*)/i);
    if (!first) continue;
    const tokens = [{ value: normalizedReference(first[1]), separator: "" }];
    const continuation = /(?:,\s*(?:(?:and|or)\s+)?|\b(?:and|or|through|to)\s+|\s*[-–]\s*)([A-Z]?\d+(?:\.\d+)*)/gi;
    continuation.lastIndex = first[0].length;
    for (const match of content.matchAll(continuation)) {
      tokens.push({ value: normalizedReference(match[1]), separator: match[0] });
    }
    const preceding = source.slice(Math.max(0, marker.index - 70), marker.index)
      .split(/[;,]/)
      .at(-1);
    const projectDependent = /\bapplicable\b/i.test(preceding || "");
    for (let index = 0; index < tokens.length; index += 1) {
      const current = tokens[index];
      const previous = tokens[index - 1];
      const values = previous && /through|\bto\b|-|–/i.test(current.separator)
        ? expandedRange(previous.value, current.value).slice(1)
        : [current.value];
      for (const cited of values) {
        references.push({ cited, table: false, projectDependent, matchIndex: marker.index });
      }
    }
  }
  for (const match of source.matchAll(/\bTable\s+([A-Z]?\d+(?:\.\d+)*)/gi)) {
    const preceding = source.slice(Math.max(0, match.index - 70), match.index)
      .split(/[;,]/)
      .at(-1);
    references.push({
      cited: normalizedReference(match[1]),
      table: true,
      projectDependent: /\bapplicable\b/i.test(preceding || ""),
      matchIndex: match.index
    });
  }
  return references;
}

export function requiredEnactedCodeReferences(
  testCase,
  canonicalSectionIndex,
  codePrefixes = ["BC"],
  options = {}
) {
  const normalizedPrefixes = normalizedCodePrefixes(codePrefixes);
  if (!normalizedPrefixes.length) return { references: [], skipped: [] };
  const prefixPattern = normalizedPrefixes.map(escapedPattern).join("|");
  const sectionByNumber = canonicalCodeSections(canonicalSectionIndex, normalizedPrefixes);
  const references = new Map();
  const skipped = [];
  for (const citation of testCase?.citations || []) {
    if (citation.role !== "required") continue;
    const authority = String(citation.authority || "");
    const firstAuthorityPrefix = authorityCodePrefix(authority, prefixPattern);
    if (!firstAuthorityPrefix) continue;
    const applicableIndex = authority.search(/\bapplicable\b/i);
    const matches = options.allConcrete
      ? allConcreteCitationReferences(authority)
      : [
          ...referenceMatches(authority, /§{1,2}\s*([A-Z]?\d+(?:\.\d+)*)/gi)
            .map((match) => ({ cited: normalizedReference(match[1]), table: false, matchIndex: match.index })),
          ...referenceMatches(authority, /\bTable\s+([A-Z]?\d+(?:\.\d+)*)/gi)
            .map((match) => ({ cited: normalizedReference(match[1]), table: true, matchIndex: match.index }))
        ].sort((left, right) => left.matchIndex - right.matchIndex);
    for (const { cited, table, projectDependent, matchIndex } of matches) {
      const authorityPrefix = authorityCodePrefix(authority, prefixPattern, matchIndex) || firstAuthorityPrefix;
      if (projectDependent || (!options.allConcrete && applicableIndex >= 0 && matchIndex > applicableIndex)) {
        skipped.push({
          citation: `${table ? "Table " : `${authorityPrefix} `}${cited}`,
          reason: "project-dependent applicable alternative"
        });
        continue;
      }
      const canonical = canonicalReference(sectionByNumber, authorityPrefix, cited, { table });
      if (!canonical) {
        skipped.push({
          citation: `${table ? "Table " : `${authorityPrefix} `}${cited}`,
          reason: `no canonical NYC ${authorityPrefix} section mapping`
        });
        continue;
      }
      references.set(canonical.sectionID, {
        ...canonical,
        reference: `${canonical.codePrefix} ${canonical.sectionNumber}`,
        citedAs: `${table ? "Table " : `${canonical.codePrefix} `}${cited}`
      });
    }
  }
  return {
    references: Array.from(references.values()),
    skipped
  };
}

export function requiredBuildingCodeReferences(testCase, canonicalSectionIndex) {
  return requiredEnactedCodeReferences(testCase, canonicalSectionIndex, ["BC"]);
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
  lastCase = 27,
  authorityPrefixes = ["BC"],
  allConcreteRequiredCitations = false
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
    const expectations = requiredEnactedCodeReferences(
      testCase,
      canonicalSectionIndex,
      authorityPrefixes,
      { allConcrete: allConcreteRequiredCitations }
    );
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
  const requiredCitationCountByPrefix = {};
  const candidateHitCountByPrefix = {};
  const evidenceHitCountByPrefix = {};
  for (const result of results) {
    for (const item of result.required) {
      const prefix = item.reference.split(" ")[0];
      requiredCitationCountByPrefix[prefix] = (requiredCitationCountByPrefix[prefix] || 0) + 1;
      if (item.candidateHit) candidateHitCountByPrefix[prefix] = (candidateHitCountByPrefix[prefix] || 0) + 1;
      if (item.evidenceHit) evidenceHitCountByPrefix[prefix] = (evidenceHitCountByPrefix[prefix] || 0) + 1;
    }
  }
  return {
    schemaVersion: 1,
    evaluationVersion: researchBenchmarkRetrievalEvaluationVersion,
    benchmarkVersion: dataset?.benchmarkVersion || "",
    scope: {
      firstCase,
      lastCase,
      sourceMode: "offline-local-enacted-corpus",
      authorityPrefixes: authorityPrefixes.map((item) => String(item).toUpperCase())
    },
    paidModelCall,
    summary: {
      caseCount: results.length,
      requiredCitationCount: requiredCount,
      requiredCitationCountByPrefix,
      candidateHitCountByPrefix,
      evidenceHitCountByPrefix,
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
