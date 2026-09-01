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
  zoningResearchCompilerVersion,
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
const architectureV21 = process.argv.includes("--architecture-v21");
const paidEnvironmentNames = [
  "OPENAI_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "PERMITEXT_RUN_PAID_RESEARCH_EVALS",
  "PERMITEXT_RESEARCH_EVAL_MAX_USD"
];
const credentialVariablesPresent = paidEnvironmentNames.filter((name) => compactEnvironmentValue(process.env[name]));
if (architectureV21 && credentialVariablesPresent.length) {
  throw new Error(`Architecture V2.1 no-cost preflight refuses paid credentials or eval authorization: ${credentialVariablesPresent.join(", ")}`);
}
let networkAttemptCount = 0;
const providerDispatchAvailable = false;
if (architectureV21) {
  globalThis.fetch = async () => {
    networkAttemptCount += 1;
    throw new Error("Architecture V2.1 no-cost preflight blocked a network attempt.");
  };
}
const cohortPath = join(root, "evals", "zoning-cases-expanded-batch-1-successor-remediation-3.json");
const retainedResultPath = join(
  root,
  "evals",
  "results",
  architectureV21
    ? "2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.json"
    : "2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.json"
);
const regressionFixturePath = join(root, "evals", "zoning-architecture-v21-regression-fixtures.json");
const resultPath = join(
  root,
  "evals",
  "results",
  architectureV21
    ? "zoning-architecture-v21-no-cost-preflight.json"
    : "zoning-architecture-v2-no-cost-preflight.json"
);
const hybridEnvironment = {
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ACCURATE_MODEL: "gpt-5.6-terra"
};

function compactEnvironmentValue(value) {
  return String(value || "").trim();
}

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
    plan,
    deterministicContext
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

async function retainedEvidence(result) {
  return Promise.all(result.testCase.selectedEvidence.map(async (selected, index) => {
    const section = await zoningSection(selected.sectionID);
    const richSourceGrids = section
      ? structuredRichSources(section)
        .filter((source) => source.kind === "table")
        .flatMap((source) => source.grids || [])
      : [];
    return {
      sourceID: result.answer?.citations?.find((citation) =>
        citation.sectionNumber === selected.reference.replace(/^ZR\s+/i, "")
      )?.sourceIDs?.[0] || `retained-${result.testCase.id}-${index}`,
      sectionID: selected.sectionID,
      sectionNumber: selected.reference.replace(/^ZR\s+/i, ""),
      codePrefix: "ZR",
      text: selected.exactPassages.join("\n"),
      richSourceGrids,
      evidencePriority: { evidenceRole: "governing", claimCoverageRequired: true }
    };
  }));
}

async function replayRetainedAnswers(retained) {
  const delivered = retained.results.filter((result) => result.answer);
  const answers = await Promise.all(delivered.map(async (result) => {
    const question = result.testCase.question;
    const plan = planZoningResearchQuestion({ question });
    const evidence = await retainedEvidence(result);
    const deterministicContext = zoningResearchDeterministicContext({ question, evidence, plan });
    const controls = evaluateZoningDeterministicControls({
      plan,
      deterministicContext,
      answer: result.answer
    });
    return { id: result.testCase.id, pass: controls.pass, issues: controls.issues };
  }));
  return {
    deliveredCount: answers.length,
    preservedFullScoreIDs: answers.filter((item) => item.pass).map((item) => item.id),
    rejectedKnownJudgeFailureIDs: answers.filter((item) => !item.pass).map((item) => item.id),
    answers
  };
}

async function adversarialGates(retained) {
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
  const repairEvidence = await retainedEvidence(parkingResult);
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
  const v21Gates = {};
  if (architectureV21) {
    const controlsFor = async (id, answer) => {
      const result = retained.results.find((item) => item.testCase.id === id);
      const plan = planZoningResearchQuestion({ question: result.testCase.question });
      const evidence = await retainedEvidence(result);
      return evaluateZoningDeterministicControls({
        plan,
        deterministicContext: zoningResearchDeterministicContext({
          question: result.testCase.question,
          evidence,
          plan
        }),
        answer
      });
    };
    const lotCoverage = await controlsFor("zr-r7a-lot-coverage", {
      answerText: "The basic cap is 80 percent, or 8,000 square feet, so 8,500 square feet exceeds it."
    });
    const throughLotResult = retained.results.find((item) =>
      item.testCase.id === "zr-candidate-b1-deep-through-lot-vertical-yard"
    );
    const throughLot = await controlsFor(throughLotResult.testCase.id, throughLotResult.answer);
    const splitResult = retained.results.find((item) =>
      item.testCase.id === "zr-candidate-b1-r7a-r8a-weighted-far"
    );
    const splitLot = await controlsFor(splitResult.testCase.id, splitResult.answer);
    const conversionResult = retained.results.find((item) =>
      item.testCase.id === "zr-candidate-b1-c6-2-office-residential-conversion"
    );
    const conversionMutation = structuredClone(conversionResult.answer);
    const wrongMappingSourceID = conversionResult.answer?.citations?.find((citation) =>
      citation.sectionNumber === "32-121"
    )?.sourceIDs?.[0];
    const correctMappingSourceID = conversionResult.answer?.citations?.find((citation) =>
      citation.sectionNumber === "34-112"
    )?.sourceIDs?.[0];
    const mappingPoint = conversionMutation.supportedPoints?.find((point) =>
      (point?.sourceIDs || []).includes(correctMappingSourceID)
    );
    if (mappingPoint && wrongMappingSourceID) {
      mappingPoint.explanation = "C6-2 maps to the R8 residential equivalent.";
      mappingPoint.sourceIDs = [wrongMappingSourceID];
    }
    const conversion = await controlsFor(conversionResult.testCase.id, conversionMutation);
    const transitionResult = retained.results.find((item) =>
      item.testCase.id === "zr-candidate-b1-city-of-yes-transition"
    );
    const transition = await controlsFor(transitionResult.testCase.id, transitionResult.answer);
    Object.assign(v21Gates, {
      omittedLotCoverageBoundariesFail: lotCoverage.pass === false &&
        lotCoverage.issues.some((issue) => issue.obligationID === "basic_lot_coverage_independent_bulk_boundary"),
      omittedMeasurementAndObstructionUncertaintyFails: throughLot.pass === false &&
        throughLot.issues.some((issue) => issue.obligationID === "through_lot_regulated_depth_orientation_unresolved") &&
        throughLot.issues.some((issue) => issue.obligationID === "through_lot_actual_permitted_obstructions_unresolved"),
      totalVsAllocationContradictionFails: splitLot.pass === false &&
        splitLot.issues.some((issue) => issue.code === "ANSWER_OBLIGATION_CONTRADICTED"),
      misboundCitationRolesFail: conversion.pass === false &&
        conversion.issues.some((issue) => issue.code === "ANSWER_OBLIGATION_SOURCE_MISBOUND"),
      omittedSpecificTransitionRouteFails: transition.pass === false &&
        transition.issues.some((issue) => issue.obligationID === "city_of_yes_specific_transition_route")
    });
  }
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
      .every((path) => zoningResearchEvidenceLimits(path).maximumCharacters < 24_000),
    ...v21Gates
  };
}

async function buildResult() {
  const [cohortText, retainedText, regressionFixtureText, catalog, metadata] = await Promise.all([
    readFile(cohortPath, "utf8"),
    readFile(retainedResultPath, "utf8"),
    architectureV21 ? readFile(regressionFixturePath, "utf8") : Promise.resolve(null),
    zoningSectionCatalog(),
    zoningContentMetadata()
  ]);
  const cohort = JSON.parse(cohortText);
  const retained = JSON.parse(retainedText);
  const regressionFixtures = regressionFixtureText ? JSON.parse(regressionFixtureText) : null;
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
  const answerReplay = await replayRetainedAnswers(retained);
  const adversarial = await adversarialGates(retained);
  const expectedJudgeFailures = architectureV21
    ? [
        "zr-candidate-b1-deep-through-lot-vertical-yard",
        "zr-candidate-b1-mx-nonadditive-far",
        "zr-candidate-b1-r7a-r8a-weighted-far",
        "zr-candidate-b1-c6-2-office-residential-conversion",
        "zr-candidate-b1-city-of-yes-transition"
      ]
    : [
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
    ...(architectureV21 ? {
      sixteenAcceptedRetainedAnswersPreserved: answerReplay.preservedFullScoreIDs.length === 16,
      fiveObservedSemanticFailuresRejected: JSON.stringify(answerReplay.rejectedKnownJudgeFailureIDs.sort()) ===
        JSON.stringify(expectedJudgeFailures.sort()),
      eightObservedFailureFixturesLocked: regressionFixtures?.cases?.length === 8 &&
        regressionFixtures?.rubricsModified === false &&
        new Set(regressionFixtures.cases.map((item) => item.id)).size === 8
    } : {
      twelveFullScoreRetainedAnswersPreserved: answerReplay.preservedFullScoreIDs.length === 12,
      twoKnownJudgeFailuresNowRejected: JSON.stringify(answerReplay.rejectedKnownJudgeFailureIDs.sort()) ===
        JSON.stringify(expectedJudgeFailures.sort())
    }),
    allAdversarialGatesPass: Object.values(adversarial).every(Boolean),
    noNetworkOrProviderCalls: networkAttemptCount === 0 && providerDispatchAvailable === false,
    noCredentialsLoaded: credentialVariablesPresent.length === 0,
    noPaidSpend: networkAttemptCount === 0 && providerDispatchAvailable === false && credentialVariablesPresent.length === 0,
    judgeLedgerSeparateAndZero: providerDispatchAvailable === false
  };
  return {
    schemaVersion: architectureV21 ? 2 : 1,
    artifact: architectureV21
      ? "Permitext Zoning Research Architecture V2.1 no-cost preflight"
      : "Permitext Zoning Research Architecture V2 no-cost preflight",
    artifactDate: "2026-09-01",
    plannerVersion: zoningResearchPlannerVersion,
    compilerVersion: zoningResearchCompilerVersion,
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
    ...(architectureV21 ? {
      retainedV2Confirmation: {
        path: "evals/results/2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.json",
        sha256: hash(retainedText),
        answerReplay
      },
      observedFailureRegressions: {
        path: "evals/zoning-architecture-v21-regression-fixtures.json",
        sha256: hash(regressionFixtureText),
        caseCount: regressionFixtures.cases.length,
        rubricsModified: regressionFixtures.rubricsModified
      }
    } : {
      retainedV1: {
        path: "evals/results/2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.json",
        sha256: hash(retainedText),
        answerReplay
      }
    }),
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
    noCostInstrumentation: {
      networkGuardInstalled: architectureV21,
      networkAttemptCount,
      providerDispatchPath: providerDispatchAvailable ? "available" : "not_imported",
      guaranteeScope: "static local compiler, canonical-corpus replay, and deterministic controls",
      credentialVariablesPresent
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
    preserved: (result.retainedV2Confirmation || result.retainedV1).answerReplay.preservedFullScoreIDs.length,
    rejectedKnownGaps: (result.retainedV2Confirmation || result.retainedV1).answerReplay.rejectedKnownJudgeFailureIDs.length
  },
  paidModelCalls: 0,
  networkAttempts: networkAttemptCount,
  credentialVariablesPresent
}, null, 2));
