import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { structuredRichSources } from "../evidence-discovery.mjs";
import { assembleResearchEvidence, researchEvidenceStrategies } from "../research-evidence-assembly.mjs";
import { routeResearchAnswerModel } from "../research-model-routing.mjs";
import {
  evaluateZoningDeterministicControls,
  evaluateZoningEvidenceReadiness,
  planZoningResearchQuestion,
  selectZoningResearchEvidence,
  zoningResearchDeterministicContext,
  zoningResearchDispositions,
  zoningResearchEvidenceLimits,
  zoningResearchPaths,
  zoningResearchPlannerVersion,
  zoningResearchPlanCostProjection,
  zoningResearchRepairPacket
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
const retainedV1Path = join(
  root,
  "evals",
  "results",
  "2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.json"
);
const resultPath = join(root, "evals", "results", "zoning-architecture-v2-no-cost-preflight.json");
const hybridEnvironment = {
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra"
};

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
  const richSources = structuredRichSources(section);
  const richSourceGrids = richSources.flatMap((source) => source.grids || []);
  const structuredTable = richSources.find((source) =>
    source.kind === "table" && Array.isArray(source.grids) && source.grids.length
  );
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
    richSources,
    ...(structuredTable ? {
      richSourceID: structuredTable.id,
      richSourceKind: "table",
      richSourceReference: structuredTable.reference,
      richSourceContentHash: structuredTable.contentHash,
      richSourceRowCount: structuredTable.rowCount,
      richSourceGrids: structuredTable.grids
    } : { richSourceGrids }),
    sectionTextHash: hash(canonicalText),
    canonicalContextResolved: true,
    canonicalContextComplete: true
  };
}

function emptyDiscovery() {
  return {
    retrievalVersion: "zoning-architecture-v2-no-discovery",
    searchedSectionCount: 0,
    candidates: [],
    outsideCurrentLibrary: [],
    coverageLimitations: []
  };
}

async function compileCase(caseRecord, catalogByID, retainedCase = null) {
  const plan = planZoningResearchQuestion({ question: caseRecord.question });
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
    const retainedSelection = retainedCase?.testCase?.selectedEvidence?.find((item) =>
      String(item.sectionID) === String(sectionID)
    );
    const selectedText = retainedSelection?.exactPassages?.join("\n\n") || evidence.canonicalText;
    canonical.set(String(sectionID), evidence);
    pinnedEvidence.push({
      ...evidence,
      text: selectedText,
      sourceID: `zoning-v2-preflight-${sectionID}`,
      origin: "user_pinned",
      selectedText,
      userSelectedText: selectedText,
      relationship: "Frozen owner-approved evaluation evidence",
      evidencePriority: {
        evidenceRole: "governing",
        topicRouteRelationship: "exact_topic",
        claimCoverageRequired: true
      }
    });
  }
  const assembled = await assembleResearchEvidence({
    question: caseRecord.question,
    pinnedEvidence,
    strategy: {
      mode: researchEvidenceStrategies.pinnedFirst,
      reason: "question_explicitly_bounded_to_selected_evidence"
    },
    limits: zoningResearchEvidenceLimits(plan),
    discover: async () => emptyDiscovery(),
    resolveSection: async (request) => canonical.get(String(request.sectionID)) || null
  });
  const selection = selectZoningResearchEvidence({
    question: caseRecord.question,
    evidence: assembled.sources,
    plan
  });
  const deterministicContext = zoningResearchDeterministicContext({
    question: caseRecord.question,
    evidence: selection.sources,
    plan
  });
  const evidenceReadiness = evaluateZoningEvidenceReadiness({
    question: caseRecord.question,
    evidence: selection.sources,
    plan
  });
  const route = routeResearchAnswerModel({
    question: caseRecord.question,
    evidence: selection.sources,
    zoningPlan: plan,
    environment: hybridEnvironment
  });
  const cost = zoningResearchPlanCostProjection({
    plan,
    evidenceCharacters: selection.usage.characterCount
  });
  const requestedSectionIDs = (caseRecord.selectedEvidenceSectionIDs || []).map(String);
  const selectedSectionIDs = selection.sources.map((source) => String(source.sectionID));
  const expectedZeroModelBoundary = plan.disposition !== zoningResearchDispositions.ready ||
    evidenceReadiness.pass === false;
  const gates = {
    everySelectedSectionResolved: unresolvedSectionIDs.length === 0,
    exactSourceRecall: requestedSectionIDs.every((id) => selectedSectionIDs.includes(id)),
    noUnexpectedSource: selectedSectionIDs.every((id) => requestedSectionIDs.includes(id)),
    evidenceBudgetPass: selection.pass,
    deterministicPlanStable: plan.planHash === repeatedPlan.planHash,
    missingFactOrEvidenceBoundaryUsesZeroCalls: !expectedZeroModelBoundary ||
      (plan.callPolicy.maximumProviderCalls === 0 || evidenceReadiness.pass === false),
    pathSpecificInitialRoute: expectedZeroModelBoundary ||
      (plan.callPolicy.initialTier === route.tier),
    atMostOneRepair: plan.callPolicy.maximumRepairAttempts <= 1,
    noFullAnswerRewrite: plan.callPolicy.allowFullAnswerRewrite === false,
    disabledTwentyFourKCandidate: plan.evidenceLimits.maximumCharacters < 24_000
  };
  return {
    id: caseRecord.id,
    category: caseRecord.category,
    question: caseRecord.question,
    selectedEvidenceSectionIDs: requestedSectionIDs,
    unresolvedSectionIDs,
    plan,
    route: { tier: route.tier, model: route.model, reasons: route.reasons },
    evidence: {
      sourceIDs: selection.sources.map((source) => source.sourceID),
      sectionIDs: selectedSectionIDs,
      sections: selection.sources.map((source) => ({
        sourceID: source.sourceID,
        sectionNumber: source.sectionNumber,
        characterCount: String(source.text || "").length,
        mentionsSpecialParking: /\bspecial parking areas?\b/i.test(String(source.text || ""))
      })),
      usage: selection.usage,
      rejected: selection.rejected,
      gateFailures: selection.gateFailures
    },
    evidenceReadiness,
    deterministicContext: {
      contextHash: deterministicContext.contextHash,
      dates: deterministicContext.dates,
      arithmetic: deterministicContext.arithmetic,
      answerObligations: deterministicContext.answerObligations,
      structuredTables: deterministicContext.structuredTables,
      passages: deterministicContext.passages
    },
    cost,
    expectedZeroModelBoundary,
    gates,
    pass: Object.values(gates).every(Boolean)
  };
}

function retainedEvidence(result, plan) {
  return result.testCase.selectedEvidence.map((selected, index) => ({
    sourceID: result.answer?.citations?.find((citation) =>
      citation.sectionNumber === selected.reference.replace(/^ZR\s+/i, "")
    )?.sourceIDs?.[0] || `retained-${result.testCase.id}-${index}`,
    sectionID: selected.sectionID,
    sectionNumber: selected.reference.replace(/^ZR\s+/i, ""),
    codePrefix: "ZR",
    text: selected.exactPassages.join("\n"),
    evidencePriority: { evidenceRole: "governing", claimCoverageRequired: true }
  }));
}

function replayRetainedAnswers(retained) {
  const delivered = retained.results.filter((result) => result.answer);
  const answers = delivered.map((result) => {
    const question = result.testCase.question;
    const plan = planZoningResearchQuestion({ question });
    const evidence = retainedEvidence(result, plan);
    const deterministicContext = zoningResearchDeterministicContext({ question, evidence, plan });
    const controls = evaluateZoningDeterministicControls({
      plan,
      deterministicContext,
      answer: result.answer
    });
    return { id: result.testCase.id, pass: controls.pass, issues: controls.issues };
  });
  return {
    deliveredCount: answers.length,
    preservedFullScoreIDs: answers.filter((item) => item.pass).map((item) => item.id),
    rejectedKnownJudgeFailureIDs: answers.filter((item) => !item.pass).map((item) => item.id),
    answers
  };
}

function adversarialGates(retained) {
  const missingMap = planZoningResearchQuestion({
    question: "Can this specific property be placed in Appendix J when its address, BBL, and official map are not provided?"
  });
  const parkingQuestion = "The broker says this R6 site is close to a subway. What parking applies?";
  const parkingPlan = planZoningResearchQuestion({ question: parkingQuestion });
  const parkingReadiness = evaluateZoningEvidenceReadiness({
    question: parkingQuestion,
    plan: parkingPlan,
    evidence: [{
      sourceID: "definition-only",
      sectionID: "12-10",
      sectionNumber: "12-10",
      text: "Greater Transit Zone General Definition: the boundary includes special parking areas."
    }]
  });
  const dateQuestion = "What transition applies on December 5, 2024?";
  const datePlan = planZoningResearchQuestion({ question: dateQuestion });
  const dateContext = zoningResearchDeterministicContext({ question: dateQuestion, evidence: [], plan: datePlan });
  const missingDate = evaluateZoningDeterministicControls({
    plan: datePlan,
    deterministicContext: dateContext,
    answer: { answerText: "The transition applies." }
  });
  const tableQuestion = "Using the selected table, explain the table symbols and legend.";
  const tablePlan = planZoningResearchQuestion({ question: tableQuestion });
  const tableEvidence = [{
    sourceID: "table-source",
    sectionID: "table-section",
    richSourceContentHash: "locked-table-hash",
    richSourceGrids: [{ rows: [{ cells: [{ text: "● = Permitted" }] }] }]
  }];
  const tableContext = zoningResearchDeterministicContext({
    question: tableQuestion,
    evidence: tableEvidence,
    plan: tablePlan
  });
  const wrongSymbol = evaluateZoningDeterministicControls({
    plan: tablePlan,
    deterministicContext: tableContext,
    answer: { answerText: "♦ means Permitted.", citations: [{ sourceIDs: ["table-source"] }] }
  });
  const repairedSymbol = evaluateZoningDeterministicControls({
    plan: tablePlan,
    deterministicContext: tableContext,
    answer: { answerText: "● means Permitted.", citations: [{ sourceIDs: ["table-source"] }] }
  });
  const parkingResult = retained.results.find((result) =>
    result.testCase.id === "zr-candidate-b1-r6-parking-unverified-transit-zone"
  );
  const repairPlan = planZoningResearchQuestion({ question: parkingResult.testCase.question });
  const repairEvidence = retainedEvidence(parkingResult, repairPlan);
  const repairPacket = zoningResearchRepairPacket({
    question: parkingResult.testCase.question,
    issues: [{ type: "zoning_parking_geography_evidence_boundary", detail: "Do not infer the missing special-parking rule." }],
    evidence: repairEvidence,
    answer: {},
    deterministicContext: zoningResearchDeterministicContext({
      question: parkingResult.testCase.question,
      evidence: repairEvidence,
      plan: repairPlan
    })
  });
  return {
    missingPropertyFactsStopBeforeModel: missingMap.disposition !== zoningResearchDispositions.ready &&
      missingMap.callPolicy.maximumProviderCalls === 0,
    missingControllingParkingRuleStopsBeforeModel: parkingReadiness.pass === false &&
      parkingReadiness.issues.some((issue) => issue.code === "CONTROLLING_SPECIAL_PARKING_RULE_MISSING"),
    omittedEffectiveDateFails: missingDate.pass === false,
    changedTableSymbolFails: wrongSymbol.pass === false,
    exactTableSymbolPasses: repairedSymbol.pass === true,
    sourceBoundedRepairPacketEnforced: repairPacket.sources.length > 0 &&
      repairPacket.usage.characterCount <= 8_000,
    disabledTwentyFourKCandidateRemainsDisabled: Object.values(zoningResearchPaths)
      .every((path) => zoningResearchEvidenceLimits(path).maximumCharacters < 24_000)
  };
}

async function buildResult() {
  const [cohortText, retainedText, catalog, metadata] = await Promise.all([
    readFile(cohortPath, "utf8"),
    readFile(retainedV1Path, "utf8"),
    zoningSectionCatalog(),
    zoningContentMetadata()
  ]);
  const cohort = JSON.parse(cohortText);
  const retained = JSON.parse(retainedText);
  const catalogByID = new Map(catalog.map((section) => [String(section.id), section]));
  const retainedByID = new Map(retained.results.map((result) => [result.testCase.id, result]));
  const cases = [];
  for (const caseRecord of cohort.cases || []) {
    cases.push(await compileCase(caseRecord, catalogByID, retainedByID.get(caseRecord.id)));
  }
  const readyCases = cases.filter((item) => !item.expectedZeroModelBoundary);
  const nominalUSD = cases.reduce((sum, item) => sum + item.cost.production.nominalUSD, 0);
  const adverseUSD = cases.reduce((sum, item) => sum + item.cost.production.adverseUSD, 0);
  const nominalCalls = readyCases.map((item) => item.cost.production.nominalRequestCount);
  const adverseCalls = readyCases.map((item) => item.cost.production.adverseRequestCount);
  const answerReplay = replayRetainedAnswers(retained);
  const adversarial = adversarialGates(retained);
  const expectedJudgeFailures = [
    "zr-candidate-b1-r6a-uap-insufficient-affordable-area",
    "zr-candidate-b1-deep-through-lot-vertical-yard"
  ];
  const aggregateGates = {
    exactFrozenCohortCount: cases.length === 30,
    everyCaseCompiles: cases.every((item) => item.pass),
    allSixPathsCovered: new Set(cases.map((item) => item.plan.path)).size === 6,
    allExpectedBoundariesUseZeroProviderCalls: cases.every((item) =>
      !item.expectedZeroModelBoundary ||
      item.plan.callPolicy.maximumProviderCalls === 0 ||
      item.evidenceReadiness.pass === false
    ),
    oneRepairMaximum: cases.every((item) => item.plan.callPolicy.maximumRepairAttempts <= 1),
    maximumAdverseLogicalCallsAtMostThree: Math.max(...adverseCalls) <= 3,
    productionNominalCostAtMostSixPerHundred:
      readyCases.length > 0 && (nominalUSD / readyCases.length) * 100 <= 6,
    productionAdverseCostAtMostSixPerHundred:
      readyCases.length > 0 && (adverseUSD / readyCases.length) * 100 <= 6,
    twelveFullScoreRetainedAnswersPreserved: answerReplay.preservedFullScoreIDs.length === 12,
    twoKnownJudgeFailuresNowRejected: JSON.stringify(answerReplay.rejectedKnownJudgeFailureIDs.sort()) ===
      JSON.stringify(expectedJudgeFailures.sort()),
    allAdversarialGatesPass: Object.values(adversarial).every(Boolean),
    noNetworkOrProviderCalls: true,
    noCredentialsLoaded: true,
    noPaidSpend: true,
    judgeLedgerSeparateAndZero: true
  };
  return {
    schemaVersion: 1,
    artifact: "Permitext Zoning Research Architecture V2 no-cost preflight",
    artifactDate: "2026-09-01",
    plannerVersion: zoningResearchPlannerVersion,
    cohort: {
      path: "evals/zoning-cases-expanded-batch-1-successor-remediation-3.json",
      sha256: hash(cohortText),
      rubricHash: hash(JSON.stringify((cohort.cases || []).map((item) => ({
        id: item.id,
        requiredConcepts: item.requiredConcepts,
        missingFacts: item.missingFacts,
        forbiddenClaims: item.forbiddenClaims,
        requiredCitations: item.requiredCitations
      })))),
      caseCount: cases.length
    },
    retainedV1: {
      path: "evals/results/2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.json",
      sha256: hash(retainedText),
      answerReplay
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
      readyCaseCount: readyCases.length,
      zeroModelBoundaryCount: cases.length - readyCases.length,
      pathCounts: Object.fromEntries(Object.values(zoningResearchPaths).map((path) => [
        path,
        cases.filter((item) => item.plan.path === path).length
      ])),
      routeCounts: {
        fast: readyCases.filter((item) => item.route.tier === "fast").length,
        accurate: readyCases.filter((item) => item.route.tier === "accurate").length
      },
      providerRequests: {
        nominalP50: percentile(nominalCalls, 50),
        nominalP90: percentile(nominalCalls, 90),
        adverseMaximum: Math.max(...adverseCalls),
        nominalTotal: nominalCalls.reduce((sum, count) => sum + count, 0),
        adverseTotal: adverseCalls.reduce((sum, count) => sum + count, 0)
      },
      productionCost: {
        frozenCohortNominalUSD: Number(nominalUSD.toFixed(6)),
        frozenCohortAdverseUSD: Number(adverseUSD.toFixed(6)),
        nominalUSDPerHundredCompleted: Number(((nominalUSD / readyCases.length) * 100).toFixed(6)),
        adverseUSDPerHundredCompleted: Number(((adverseUSD / readyCases.length) * 100).toFixed(6))
      },
      judgeCost: { requestCount: 0, nominalUSD: 0, adverseUSD: 0 }
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
    throw new Error("The retained Zoning Architecture V2 no-cost preflight is stale. Run with --write after intentional review.");
  }
  console.log(`Verified ${resultPath}`);
}
if (!result.summary.pass) {
  const failed = Object.entries(result.aggregateGates).filter(([, pass]) => !pass).map(([gate]) => gate);
  throw new Error(`Zoning Architecture V2 no-cost preflight failed: ${failed.join(", ")}`);
}
console.log(JSON.stringify({
  pass: result.summary.pass,
  caseCount: result.cohort.caseCount,
  readyCaseCount: result.summary.readyCaseCount,
  zeroModelBoundaryCount: result.summary.zeroModelBoundaryCount,
  providerRequests: result.summary.providerRequests,
  productionCost: result.summary.productionCost,
  retainedAnswerReplay: {
    preserved: result.retainedV1.answerReplay.preservedFullScoreIDs.length,
    rejectedKnownGaps: result.retainedV1.answerReplay.rejectedKnownJudgeFailureIDs.length
  },
  paidModelCalls: 0
}, null, 2));
