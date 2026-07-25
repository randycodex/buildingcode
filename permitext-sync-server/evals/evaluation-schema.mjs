export const evaluationStatuses = ["draft", "reviewed", "approved", "rejected", "retired"];
export const evaluationDifficulties = ["basic", "intermediate", "advanced"];
export const evaluationSourceTypes = [
  "real project",
  "RFI",
  "plan-review objection",
  "code-consultant coordination",
  "accessibility review",
  "fire-protection review",
  "MEP coordination",
  "Permitext user feedback",
  "confirmed production failure",
  "official agency interpretation",
  "Buildings Bulletin",
  "public determination or decision",
  "professional code forum",
  "educational discussion",
  "deliberately constructed edge case",
  "tester feedback",
  "professional contributor",
  "synthetic variation",
  "production failure"
];
export const evaluationCertainties = [
  "supported",
  "conditional",
  "insufficient evidence",
  "outside selected authority"
];

export const evaluationDimensions = [
  "structuralValidity",
  "citationCorrectness",
  "citationCompleteness",
  "requiredConceptCoverage",
  "unsupportedInventedClaims",
  "appropriateUncertainty",
  "missingFactRecognition",
  "evidenceInsufficiencyRecognition",
  "practicalUsefulness",
  "directlyAddressesQuestion"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nonemptyStrings(value, message, { allowEmpty = false } = {}) {
  assert(Array.isArray(value) && (allowEmpty || value.length > 0), message);
  assert(value.every((item) => typeof item === "string" && item.trim()), message);
}

export function validateEvaluationDataset(dataset) {
  assert(dataset?.schemaVersion === 3, "Research eval dataset must use schemaVersion 3.");
  assert(
    dataset.responseLanguage === undefined ||
      (typeof dataset.responseLanguage === "string" && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(dataset.responseLanguage)),
    "Research eval responseLanguage must be a supported language tag."
  );
  assert(Array.isArray(dataset.cases) && dataset.cases.length > 0, "Research eval dataset has no cases.");
  const scoring = dataset.automaticScoring;
  assert(scoring && typeof scoring === "object", "Research eval dataset needs automaticScoring configuration.");
  assert(
    evaluationDimensions.length === scoring.dimensions?.length &&
      evaluationDimensions.every((dimension) => scoring.dimensions.includes(dimension)),
    "Research eval scoring dimensions must exactly match the supported automatic scores."
  );
  assert(
    Object.keys(scoring.weights || {}).length === evaluationDimensions.length &&
      evaluationDimensions.every((dimension) => dimension in scoring.weights),
    "Research eval scoring weights must exactly match the automatic score dimensions."
  );
  const weightTotal = evaluationDimensions.reduce(
    (total, dimension) => total + Number(scoring.weights?.[dimension] || 0),
    0
  );
  assert(Math.abs(weightTotal - 1) < 0.0001, "Research eval scoring weights must total 1.");
  assert(scoring.scoreScale?.minimum === 0 && scoring.scoreScale?.maximum === 4, "Research eval score scale must run from 0 through 4.");
  assert(Number(scoring.scoreScale?.passing) >= 0 && Number(scoring.scoreScale?.passing) <= 4, "Research eval passing score is invalid.");
  for (const thresholdName of ["responseTimeMilliseconds", "tokenCost"]) {
    const thresholds = scoring[thresholdName];
    assert(
      ["score4AtOrBelow", "score3AtOrBelow", "score2AtOrBelow", "score1AtOrBelow"]
        .every((name) => Number.isFinite(Number(thresholds?.[name]))),
      `Research eval ${thresholdName} thresholds are incomplete.`
    );
    assert(
      thresholds.score4AtOrBelow <= thresholds.score3AtOrBelow &&
        thresholds.score3AtOrBelow <= thresholds.score2AtOrBelow &&
        thresholds.score2AtOrBelow <= thresholds.score1AtOrBelow,
      `Research eval ${thresholdName} thresholds must increase from score 4 to score 1.`
    );
  }

  const ids = new Set();
  for (const testCase of dataset.cases) {
    assert(typeof testCase.id === "string" && testCase.id, "Every research eval case needs an ID.");
    assert(!ids.has(testCase.id), `Duplicate research eval case ID: ${testCase.id}.`);
    ids.add(testCase.id);
    assert(typeof testCase.title === "string" && testCase.title, `${testCase.id} needs a title.`);
    assert(evaluationStatuses.includes(testCase.status), `${testCase.id} has an invalid status.`);
    assert(evaluationDifficulties.includes(testCase.difficulty), `${testCase.id} has an invalid difficulty.`);
    nonemptyStrings(testCase.topics, `${testCase.id} needs topics.`);
    assert(typeof testCase.codeEdition === "string" && testCase.codeEdition, `${testCase.id} needs a code edition.`);
    assert(typeof testCase.jurisdiction === "string" && testCase.jurisdiction, `${testCase.id} needs a jurisdiction.`);
    assert(testCase.projectContext && typeof testCase.projectContext === "object" && !Array.isArray(testCase.projectContext), `${testCase.id} needs projectContext.`);
    assert(typeof testCase.question === "string" && testCase.question.length >= 3, `${testCase.id} needs a question.`);
    assert(typeof testCase.expectedConclusion === "string" && testCase.expectedConclusion, `${testCase.id} needs an expected conclusion.`);
    assert(
      testCase.expectedUncertainty &&
        evaluationCertainties.includes(testCase.expectedUncertainty.level) &&
        typeof testCase.expectedUncertainty.description === "string" &&
        testCase.expectedUncertainty.description.trim(),
      `${testCase.id} has an invalid expected uncertainty.`
    );
    assert(evaluationSourceTypes.includes(testCase.sourceType), `${testCase.id} has an invalid source type.`);
    assert(typeof testCase.sourceReference === "string" && testCase.sourceReference.trim(), `${testCase.id} needs a source reference.`);
    assert(testCase.reviewer === null || (typeof testCase.reviewer === "string" && testCase.reviewer.trim()), `${testCase.id} has an invalid reviewer.`);
    assert(testCase.reviewedAt === null || Number.isFinite(Date.parse(testCase.reviewedAt)), `${testCase.id} has an invalid reviewedAt timestamp.`);
    assert(typeof testCase.notes === "string", `${testCase.id} needs notes, which may be an empty string.`);
    if (["reviewed", "approved", "rejected", "retired"].includes(testCase.status)) {
      assert(testCase.reviewer && testCase.reviewedAt, `${testCase.id} must identify the reviewer and review date for status ${testCase.status}.`);
    }
    assert(Array.isArray(testCase.selectedEvidence) && testCase.selectedEvidence.length > 0, `${testCase.id} needs selected evidence.`);
    nonemptyStrings(testCase.requiredConcepts, `${testCase.id} needs required concepts.`);
    nonemptyStrings(testCase.missingFacts, `${testCase.id} needs missing facts.`, { allowEmpty: true });
    nonemptyStrings(testCase.forbiddenClaims, `${testCase.id} needs forbidden claims.`);
    if (testCase.forbiddenPhrases !== undefined) {
      nonemptyStrings(testCase.forbiddenPhrases, `${testCase.id} has invalid forbidden literal phrases.`);
    }
    nonemptyStrings(testCase.requiredCitations, `${testCase.id} needs required citations.`);
    assert(
      new Set(testCase.requiredCitations).size === testCase.requiredCitations.length,
      `${testCase.id} repeats a required citation.`
    );
    if (testCase.requiredCitationClaims !== undefined) {
      assert(
        Array.isArray(testCase.requiredCitationClaims) &&
          testCase.requiredCitationClaims.length === testCase.requiredCitations.length,
        `${testCase.id} must describe the claim required from every citation.`
      );
      assert(
        testCase.requiredCitationClaims.every((item) =>
          item && typeof item === "object" &&
          typeof item.reference === "string" && item.reference.trim() &&
          typeof item.requiredClaim === "string" && item.requiredClaim.trim()
        ),
        `${testCase.id} has an invalid required citation claim.`
      );
      const claimReferences = testCase.requiredCitationClaims.map((item) => item.reference.trim());
      assert(
        new Set(claimReferences).size === claimReferences.length &&
          testCase.requiredCitations.every((reference) => claimReferences.includes(reference)),
        `${testCase.id} citation claims must exactly match its required citations.`
      );
    }
    const references = new Set();
    const sectionIDs = new Set();
    for (const source of testCase.selectedEvidence) {
      assert(/^\d+$/.test(String(source.sectionID || "")), `${testCase.id} has evidence without a canonical numeric sectionID.`);
      assert(!sectionIDs.has(source.sectionID), `${testCase.id} repeats canonical sectionID ${source.sectionID}.`);
      sectionIDs.add(source.sectionID);
      assert(typeof source.reference === "string" && source.reference, `${testCase.id} has a source without a reference.`);
      assert(!references.has(source.reference), `${testCase.id} repeats ${source.reference}.`);
      references.add(source.reference);
      assert(source.reference === `${source.codePrefix} ${source.sectionNumber}`, `${testCase.id} has an inconsistent source reference.`);
      nonemptyStrings(source.exactPassages, `${source.reference} needs exact selected passages.`);
    }
    for (const reference of testCase.requiredCitations) {
      assert(references.has(reference), `${testCase.id} requires citation ${reference}, but it is not selected evidence.`);
    }
    for (const item of testCase.requiredCitationClaims || []) {
      assert(
        testCase.requiredCitations.includes(item.reference),
        `${testCase.id} describes ${item.reference}, but that reference is not a required citation.`
      );
    }
  }
  return dataset;
}

export function approvedEvaluationCases(dataset) {
  return dataset.cases.filter((testCase) => testCase.status === "approved");
}
