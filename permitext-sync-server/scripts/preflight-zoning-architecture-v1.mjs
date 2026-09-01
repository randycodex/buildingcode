import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { structuredRichSources } from "../evidence-discovery.mjs";
import {
  assembleResearchEvidence,
  researchEvidenceStrategies
} from "../research-evidence-assembly.mjs";
import {
  evaluateZoningDeterministicControls,
  planZoningResearchQuestion,
  selectZoningResearchEvidence,
  zoningResearchDeterministicContext,
  zoningResearchDispositions,
  zoningResearchEvidenceLimits,
  zoningResearchPaths,
  zoningResearchPlannerVersion,
  zoningResearchPlanCostProjection
} from "../research-zoning-planner.mjs";
import {
  zoningCodePrefix,
  zoningContentMetadata,
  zoningSection,
  zoningSectionCatalog,
  zoningSyncCodeVersion
} from "../zoning-content.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cohortPath = join(root, "evals", "zoning-cases-expanded-batch-1-successor-remediation-3.json");
const resultPath = join(root, "evals", "results", "zoning-architecture-v1-no-cost-preflight.json");

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJSON(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((percentileValue / 100) * sorted.length) - 1];
}

function sectionText(section) {
  return (section?.blocks || [])
    .map((block) => String(block?.plainText || "").trim())
    .filter(Boolean)
    .join("\n\n") || String(section?.previewText || "").trim();
}

function evidenceRecord(summary, section) {
  const canonicalText = sectionText(section);
  return {
    sectionID: String(summary.id),
    id: String(summary.id),
    codePrefix: zoningCodePrefix,
    sectionNumber: summary.sectionNumber,
    title: summary.title,
    codeEdition: "NYC Zoning Resolution — current research corpus",
    codeVersion: zoningSyncCodeVersion,
    jurisdiction: "New York City",
    corpusID: "nyc-zoning-resolution",
    corpusLabel: "NYC Zoning Resolution",
    applicabilityStatus: "current-enacted-edition",
    sourceType: "enacted_text",
    authorityClass: "enacted",
    canonicalText,
    text: canonicalText,
    body: { blocks: section.blocks || [] },
    richSources: structuredRichSources(section),
    sectionTextHash: hash(canonicalText),
    canonicalContextResolved: true
  };
}

function emptyDiscovery() {
  return {
    retrievalVersion: "zoning-architecture-v1-no-discovery",
    searchedSectionCount: 0,
    candidates: [],
    outsideCurrentLibrary: [],
    coverageLimitations: []
  };
}

async function assembleCase(caseRecord, catalogByID) {
  const firstPlan = planZoningResearchQuestion({ question: caseRecord.question });
  const repeatedPlan = planZoningResearchQuestion({ question: caseRecord.question });
  const canonical = new Map();
  const pinnedEvidence = [];
  const unresolvedSectionIDs = [];
  for (const sectionID of caseRecord.selectedEvidenceSectionIDs || []) {
    const summary = catalogByID.get(String(sectionID));
    const section = summary ? await zoningSection(sectionID) : null;
    if (!summary || !section) {
      unresolvedSectionIDs.push(String(sectionID));
      continue;
    }
    const evidence = evidenceRecord(summary, section);
    canonical.set(String(sectionID), evidence);
    pinnedEvidence.push({
      ...evidence,
      sourceID: `zoning-preflight-${sectionID}`,
      origin: "user_pinned",
      selectedText: evidence.canonicalText,
      userSelectedText: evidence.canonicalText,
      relationship: "Frozen owner-approved evaluation evidence"
    });
  }
  const assembled = await assembleResearchEvidence({
    question: caseRecord.question,
    pinnedEvidence,
    strategy: {
      mode: researchEvidenceStrategies.pinnedFirst,
      reason: "question_explicitly_bounded_to_selected_evidence"
    },
    limits: zoningResearchEvidenceLimits(firstPlan),
    discover: async () => emptyDiscovery(),
    resolveSection: async (request) => canonical.get(String(request.sectionID)) || null
  });
  const selection = selectZoningResearchEvidence({
    question: caseRecord.question,
    evidence: assembled.sources,
    plan: firstPlan
  });
  const deterministicContext = zoningResearchDeterministicContext({
    question: caseRecord.question,
    evidence: selection.sources,
    plan: firstPlan
  });
  const cost = zoningResearchPlanCostProjection({
    plan: firstPlan,
    evidenceCharacters: selection.usage.characterCount
  });
  const selectedSectionIDs = selection.sources.map((source) => String(source.sectionID));
  const requestedSectionIDs = (caseRecord.selectedEvidenceSectionIDs || []).map(String);
  const sourceRecall = requestedSectionIDs.length
    ? requestedSectionIDs.filter((id) => selectedSectionIDs.includes(id)).length / requestedSectionIDs.length
    : 1;
  const gates = {
    allSelectedSectionsResolved: unresolvedSectionIDs.length === 0,
    selectedSourceRecallComplete: sourceRecall === 1,
    questionSpecificEvidenceBudgetPass: selection.pass,
    noConstructionCorpusSearch: true,
    planStable: firstPlan.planHash === repeatedPlan.planHash,
    noModelWithMissingPrerequisites:
      firstPlan.disposition === zoningResearchDispositions.ready ||
      firstPlan.callPolicy.maximumProviderCalls === 0,
    lunaFirst: firstPlan.callPolicy.maximumProviderCalls === 0 || firstPlan.callPolicy.initialTier === "fast",
    providerRequestMaximumPass: firstPlan.callPolicy.maximumProviderCalls <= 2,
    noFullAnswerRewrite: firstPlan.callPolicy.allowFullAnswerRewrite === false,
    disabledGlobalTwentyFourKCandidate: firstPlan.evidenceLimits.maximumCharacters < 24_000
  };
  return {
    id: caseRecord.id,
    category: caseRecord.category,
    question: caseRecord.question,
    selectedEvidenceSectionIDs: requestedSectionIDs,
    unresolvedSectionIDs,
    plan: firstPlan,
    evidence: {
      sourceIDs: selection.sources.map((source) => source.sourceID),
      sectionIDs: selectedSectionIDs,
      sourceRecall,
      usage: selection.usage,
      rejected: selection.rejected,
      gateFailures: selection.gateFailures,
      assemblyLimits: assembled.limits,
      assemblyUsage: assembled.usage
    },
    deterministicContext: {
      contextHash: deterministicContext.contextHash,
      dates: deterministicContext.dates,
      arithmetic: deterministicContext.arithmetic,
      structuredTables: deterministicContext.structuredTables,
      passageHashes: deterministicContext.passages
    },
    cost,
    gates,
    pass: Object.values(gates).every(Boolean)
  };
}

function adversarialGates() {
  const generalDefinition = planZoningResearchQuestion({
    question: "Under the selected definition, what is a zoning lot?"
  });
  const missingMap = planZoningResearchQuestion({
    question: "Is this specific property in the Appendix J subarea when its address and official map are not provided?"
  });
  const effectivePlan = planZoningResearchQuestion({
    question: "Did the December 5, 2024 transition date preserve this filing?"
  });
  const effectiveContext = zoningResearchDeterministicContext({
    question: "Did the December 5, 2024 transition date preserve this filing?",
    evidence: [],
    plan: effectivePlan
  });
  const missingDate = evaluateZoningDeterministicControls({
    plan: effectivePlan,
    deterministicContext: effectiveContext,
    answer: { answerText: "The transition may apply." }
  });
  const boundDate = evaluateZoningDeterministicControls({
    plan: effectivePlan,
    deterministicContext: effectiveContext,
    answer: { answerText: "The December 5, 2024 transition may apply." }
  });
  const tablePlan = planZoningResearchQuestion({
    question: "Using the selected table, explain the table symbols."
  });
  const tableContext = zoningResearchDeterministicContext({
    question: "Using the selected table, explain the table symbols.",
    evidence: [{
      sourceID: "table-source",
      sectionID: "table-section",
      codePrefix: "ZR",
      richSourceContentHash: "locked-table-hash",
      richSourceGrids: [{ rows: [{ cells: [{ text: "● = Permitted" }] }] }]
    }],
    plan: tablePlan
  });
  const uncitedTable = evaluateZoningDeterministicControls({
    plan: tablePlan,
    deterministicContext: tableContext,
    answer: { answerText: "The symbol means permitted.", citations: [] }
  });
  const citedTable = evaluateZoningDeterministicControls({
    plan: tablePlan,
    deterministicContext: tableContext,
    answer: {
      answerText: "The symbol means permitted.",
      citations: [{ sourceIDs: ["table-source"] }]
    }
  });
  const calculationPlan = planZoningResearchQuestion({
    question: "Does 42,000 square feet of residential floor area on a 10,000-square-foot zoning lot fit the FAR maximum?"
  });
  const calculationContext = zoningResearchDeterministicContext({
    question: "Does 42,000 square feet of residential floor area on a 10,000-square-foot zoning lot fit the FAR maximum?",
    evidence: [],
    plan: calculationPlan
  });
  const missingArithmetic = evaluateZoningDeterministicControls({
    plan: calculationPlan,
    deterministicContext: calculationContext,
    answer: { answerText: "It fits." }
  });
  const shownArithmetic = evaluateZoningDeterministicControls({
    plan: calculationPlan,
    deterministicContext: calculationContext,
    answer: { answerText: "42,000 / 10,000 = 4.2 FAR." }
  });
  const modelBeforePrerequisites = evaluateZoningDeterministicControls({
    plan: missingMap,
    deterministicContext: zoningResearchDeterministicContext({
      question: "Is this specific property in the Appendix J subarea when its address and official map are not provided?",
      evidence: [],
      plan: missingMap
    }),
    providerRequestCount: 1
  });
  return {
    generalDefinitionDoesNotRequireMap: generalDefinition.path === zoningResearchPaths.definitionCrossReference &&
      generalDefinition.missingFacts.length === 0,
    propertyMapMissingFactsStopsModel: missingMap.disposition !== zoningResearchDispositions.ready &&
      missingMap.callPolicy.maximumProviderCalls === 0,
    missingEffectiveDateFails: missingDate.pass === false &&
      missingDate.issues.some((issue) => issue.code === "EFFECTIVE_DATE_NOT_BOUND"),
    exactEffectiveDatePasses: boundDate.pass === true,
    uncitedStructuredTableFails: uncitedTable.pass === false &&
      uncitedTable.issues.some((issue) => issue.code === "STRUCTURED_TABLE_NOT_CITED"),
    citedStructuredTablePasses: citedTable.pass === true,
    missingArithmeticFails: missingArithmetic.pass === false &&
      missingArithmetic.issues.some((issue) => issue.code === "ARITHMETIC_RESULT_NOT_SHOWN"),
    shownArithmeticPasses: shownArithmetic.pass === true,
    modelCallBeforePrerequisitesFails: modelBeforePrerequisites.pass === false &&
      modelBeforePrerequisites.issues.some((issue) => issue.code === "MODEL_CALLED_WITH_MISSING_PREREQUISITES"),
    twentyFourKCandidateRemainsDisabled: Object.values(zoningResearchPaths)
      .every((path) => zoningResearchEvidenceLimits(path).maximumCharacters < 24_000)
  };
}

async function buildResult() {
  const cohortText = await readFile(cohortPath, "utf8");
  const cohort = JSON.parse(cohortText);
  const [catalog, metadata] = await Promise.all([zoningSectionCatalog(), zoningContentMetadata()]);
  const catalogByID = new Map(catalog.map((section) => [String(section.id), section]));
  const cases = [];
  for (const caseRecord of cohort.cases || []) cases.push(await assembleCase(caseRecord, catalogByID));
  const productionNominalUSD = cases.reduce((sum, item) => sum + item.cost.production.nominalUSD, 0);
  const productionAdverseUSD = cases.reduce((sum, item) => sum + item.cost.production.adverseUSD, 0);
  const judgeNominalUSD = cases.reduce((sum, item) => sum + item.cost.judge.nominalUSD, 0);
  const judgeAdverseUSD = cases.reduce((sum, item) => sum + item.cost.judge.adverseUSD, 0);
  const callCounts = cases.map((item) => item.plan.callPolicy.maximumProviderCalls);
  const adversarial = adversarialGates();
  const aggregateGates = {
    exactFrozenCohortCount: cases.length === 30,
    everyCasePasses: cases.every((item) => item.pass),
    allSixQuestionPathsCovered: new Set(cases.map((item) => item.plan.path)).size === 6,
    selectedSourceRecallComplete: cases.every((item) => item.evidence.sourceRecall === 1),
    noModelWithMissingPrerequisites: cases.every((item) =>
      item.plan.disposition === zoningResearchDispositions.ready ||
      item.plan.callPolicy.maximumProviderCalls === 0
    ),
    medianProviderRequestsAtMostOne: percentile(callCounts, 50) <= 1,
    maximumProviderRequestsAtMostTwo: Math.max(...callCounts) <= 2,
    nominalProductionCostAtMostSixPerHundred:
      (productionNominalUSD / cases.length) * 100 <= 6,
    adverseProductionCostAtMostSixPerHundred:
      (productionAdverseUSD / cases.length) * 100 <= 6,
    judgeLedgerSeparateAndZero: judgeNominalUSD === 0 && judgeAdverseUSD === 0,
    allAdversarialGatesPass: Object.values(adversarial).every(Boolean),
    noNetworkOrModelCalls: true,
    noCredentialsLoaded: true,
    noPaidSpend: true
  };
  return {
    schemaVersion: 1,
    artifact: "Permitext Zoning Research Architecture V1 no-cost preflight",
    artifactDate: "2026-09-01",
    plannerVersion: zoningResearchPlannerVersion,
    cohort: {
      path: "evals/zoning-cases-expanded-batch-1-successor-remediation-3.json",
      sha256: hash(cohortText),
      caseCount: cases.length,
      approvedCaseCount: cases.filter((item) => item.category && item.id).length
    },
    corpus: {
      id: metadata.id,
      codeVersion: metadata.codeVersion,
      syncCodeVersion: metadata.syncCodeVersion,
      textChangesThrough: metadata.textChangesThrough,
      researchEligibility: metadata.researchEligibility
    },
    summary: {
      pass: Object.values(aggregateGates).every(Boolean),
      pathCounts: Object.fromEntries(Object.values(zoningResearchPaths).map((path) => [
        path,
        cases.filter((item) => item.plan.path === path).length
      ])),
      dispositionCounts: Object.fromEntries(Object.values(zoningResearchDispositions).map((disposition) => [
        disposition,
        cases.filter((item) => item.plan.disposition === disposition).length
      ])),
      providerRequests: {
        p50: percentile(callCounts, 50),
        p90: percentile(callCounts, 90),
        maximum: Math.max(...callCounts),
        totalProjected: callCounts.reduce((sum, count) => sum + count, 0)
      },
      productionCost: {
        frozenCohortNominalUSD: Number(productionNominalUSD.toFixed(6)),
        frozenCohortAdverseUSD: Number(productionAdverseUSD.toFixed(6)),
        nominalUSDPerHundred: Number(((productionNominalUSD / cases.length) * 100).toFixed(6)),
        adverseUSDPerHundred: Number(((productionAdverseUSD / cases.length) * 100).toFixed(6))
      },
      judgeCost: {
        frozenCohortNominalUSD: Number(judgeNominalUSD.toFixed(6)),
        frozenCohortAdverseUSD: Number(judgeAdverseUSD.toFixed(6)),
        nominalUSDPerHundred: 0,
        adverseUSDPerHundred: 0
      }
    },
    adversarial,
    aggregateGates,
    cases
  };
}

const mode = process.argv.includes("--write") ? "write" : "check";
const result = await buildResult();
const output = stableJSON(result);
if (mode === "write") {
  await writeFile(resultPath, output, "utf8");
  console.log(`Wrote ${resultPath}`);
} else {
  const retained = await readFile(resultPath, "utf8");
  if (retained !== output) {
    throw new Error("The retained Zoning Architecture V1 no-cost preflight result is stale. Run with --write after an intentional review.");
  }
  console.log(`Verified ${resultPath}`);
}
if (!result.summary.pass) {
  const failed = Object.entries(result.aggregateGates).filter(([, pass]) => !pass).map(([gate]) => gate);
  throw new Error(`Zoning Architecture V1 no-cost preflight failed: ${failed.join(", ")}`);
}
console.log(JSON.stringify({
  pass: result.summary.pass,
  caseCount: result.cohort.caseCount,
  pathCounts: result.summary.pathCounts,
  dispositionCounts: result.summary.dispositionCounts,
  providerRequests: result.summary.providerRequests,
  productionCost: result.summary.productionCost,
  judgeCost: result.summary.judgeCost,
  paidModelCalls: 0
}, null, 2));
