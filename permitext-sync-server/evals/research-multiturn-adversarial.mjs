import {
  assembleResearchEvidence,
  researchEvidenceRetrievalQuery
} from "../research-evidence-assembly.mjs";

export const researchMultiturnAdversarialEvaluationVersion =
  "20260811-research-multiturn-deterministic-v1";

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizedList(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => compactText(item)).filter(Boolean)))
    : [];
}

function topicAction(query) {
  if (query.relevanceComparison) return "compare_to_root";
  if (query.previousTopicApplied) return "continue_root";
  return "replace_topic";
}

function evidenceReference(source) {
  const codePrefix = compactText(source?.codePrefix).toUpperCase();
  const sectionNumber = compactText(source?.sectionNumber);
  return codePrefix && sectionNumber ? `${codePrefix} ${sectionNumber}` : "";
}

function includesFragment(value, fragment) {
  return String(value || "").toLowerCase().includes(String(fragment || "").toLowerCase());
}

function check(name, passed, expected, observed) {
  return { name, passed: Boolean(passed), expected, observed };
}

function expectedArray(expected, key) {
  return normalizedList(expected?.[key]);
}

function scoreCase({ testCase, query, evidence, paidModelCall }) {
  const expected = testCase.expected || {};
  const roles = normalizedList(evidence.sources.map((source) => source?.evidencePriority?.evidenceRole));
  const prefixes = normalizedList(evidence.sources.map((source) =>
    compactText(source?.codePrefix).toUpperCase()
  ));
  const references = normalizedList(evidence.sources.map(evidenceReference));
  const checks = [
    check("topic-action", topicAction(query) === expected.topicAction, expected.topicAction, topicAction(query)),
    check(
      "conversation-topic",
      includesFragment(query.conversationTopic, expected.conversationTopicContains),
      expected.conversationTopicContains,
      query.conversationTopic
    ),
    check(
      "immediate-context",
      includesFragment(query.immediateContext, expected.immediateContextContains),
      expected.immediateContextContains,
      query.immediateContext
    ),
    check(
      "previous-topic-applied",
      query.previousTopicApplied === expected.previousTopicApplied,
      expected.previousTopicApplied,
      query.previousTopicApplied
    ),
    check(
      "project-facts-applied",
      query.projectFactsApplied === expected.projectFactsApplied,
      expected.projectFactsApplied,
      query.projectFactsApplied
    ),
    check(
      "required-query-fragments",
      expectedArray(expected, "requiredQueryFragments").every((fragment) =>
        includesFragment(query.retrievalQuery, fragment)
      ),
      expectedArray(expected, "requiredQueryFragments"),
      query.retrievalQuery
    ),
    check(
      "forbidden-query-fragments",
      expectedArray(expected, "forbiddenQueryFragments").every((fragment) =>
        !includesFragment(query.retrievalQuery, fragment)
      ),
      expectedArray(expected, "forbiddenQueryFragments"),
      query.retrievalQuery
    ),
    check(
      "required-evidence-roles",
      expectedArray(expected, "requiredEvidenceRoles").every((role) => roles.includes(role)),
      expectedArray(expected, "requiredEvidenceRoles"),
      roles
    ),
    check(
      "forbidden-evidence-roles",
      expectedArray(expected, "forbiddenEvidenceRoles").every((role) => !roles.includes(role)),
      expectedArray(expected, "forbiddenEvidenceRoles"),
      roles
    ),
    check(
      "required-code-prefixes",
      expectedArray(expected, "requiredCodePrefixes").every((prefix) => prefixes.includes(prefix)),
      expectedArray(expected, "requiredCodePrefixes"),
      prefixes
    ),
    check(
      "forbidden-code-prefixes",
      expectedArray(expected, "forbiddenCodePrefixes").every((prefix) => !prefixes.includes(prefix)),
      expectedArray(expected, "forbiddenCodePrefixes"),
      prefixes
    ),
    check(
      "required-references",
      expectedArray(expected, "requiredReferences").every((reference) => references.includes(reference)),
      expectedArray(expected, "requiredReferences"),
      references
    ),
    check(
      "forbidden-references",
      expectedArray(expected, "forbiddenReferences").every((reference) => !references.includes(reference)),
      expectedArray(expected, "forbiddenReferences"),
      references
    ),
    check("no-paid-model-call", paidModelCall === false, false, paidModelCall)
  ];
  const passedCheckCount = checks.filter((item) => item.passed).length;
  return {
    id: compactText(testCase.id),
    behavior: compactText(testCase.behavior),
    topicAction: topicAction(query),
    previousTopicApplied: query.previousTopicApplied,
    projectFactsApplied: query.projectFactsApplied,
    retrievalQuery: query.retrievalQuery,
    evidenceRoles: roles,
    codePrefixes: prefixes,
    references,
    paidModelCall,
    passedCheckCount,
    checkCount: checks.length,
    score: checks.length ? passedCheckCount / checks.length : 0,
    passed: passedCheckCount === checks.length,
    checks
  };
}

export async function evaluateResearchMultiturnAdversarial({
  dataset,
  discover,
  resolveSection
} = {}) {
  if (!Array.isArray(dataset?.cases) || !dataset.cases.length) {
    throw new Error("The multi-turn Research benchmark requires at least one case.");
  }
  if (typeof discover !== "function" || typeof resolveSection !== "function") {
    throw new Error("The multi-turn Research benchmark requires deterministic discovery and canonical-section adapters.");
  }
  const results = [];
  let paidModelCall = false;
  for (const testCase of dataset.cases) {
    const query = researchEvidenceRetrievalQuery({
      question: testCase.question,
      previousMessages: testCase.previousMessages,
      projectFacts: testCase.projectFacts
    });
    let casePaidModelCall = false;
    const evidence = await assembleResearchEvidence({
      question: testCase.question,
      previousMessages: testCase.previousMessages,
      projectFacts: testCase.projectFacts,
      discover: async (options) => {
        const discovered = await discover({ ...options, testCase });
        casePaidModelCall ||= discovered?.paidModelCall === true;
        paidModelCall ||= discovered?.paidModelCall === true;
        return discovered;
      },
      resolveSection: (request) => resolveSection(request, testCase)
    });
    results.push(scoreCase({
      testCase,
      query,
      evidence,
      paidModelCall: casePaidModelCall
    }));
  }
  const checkCount = results.reduce((sum, result) => sum + result.checkCount, 0);
  const passedCheckCount = results.reduce((sum, result) => sum + result.passedCheckCount, 0);
  return {
    schemaVersion: 1,
    evaluationVersion: researchMultiturnAdversarialEvaluationVersion,
    benchmarkVersion: compactText(dataset.benchmarkVersion),
    diagnosticOnly: true,
    paidModelCall,
    summary: {
      caseCount: results.length,
      passedCaseCount: results.filter((result) => result.passed).length,
      checkCount,
      passedCheckCount,
      score: checkCount ? passedCheckCount / checkCount : 0
    },
    cases: results
  };
}

export function formatResearchMultiturnAdversarialReport(report) {
  const lines = [
    `Permitext Research multi-turn adversarial benchmark (${report.evaluationVersion})`
  ];
  for (const result of report.cases || []) {
    lines.push(
      `${result.id}: ${result.passed ? "pass" : "fail"}; action=${result.topicAction}; ` +
      `roles=${result.evidenceRoles.join(",") || "none"}; ` +
      `prefixes=${result.codePrefixes.join(",") || "none"}; ` +
      `score=${result.passedCheckCount}/${result.checkCount}`
    );
  }
  lines.push(
    `Summary: ${report.summary.passedCaseCount}/${report.summary.caseCount} cases; ` +
    `${report.summary.passedCheckCount}/${report.summary.checkCount} checks; ` +
    `paid model calls: ${report.paidModelCall ? "yes" : "no"}; diagnostic only.`
  );
  return lines.join("\n");
}
