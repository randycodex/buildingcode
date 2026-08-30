const maximumSelectedPassageCharacters = 11_800;
const selectedPassageContextBefore = 700;
const selectedPassageContextAfter = 3_800;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalBodyText(section) {
  return (section?.blocks || [])
    .map((block) => String(block?.plainText || ""))
    .filter((text) => text.trim())
    .join("\n\n")
    .trim();
}

function hasVisualReferences(section) {
  return (section?.blocks || []).some((block) => /<img\b[^>]*\bsrc=["'][^"']+["']/i.test(String(block?.html || "")));
}

function evidenceTerms(testCase, sectionID) {
  return Array.from(new Set([
    ...(testCase.evidenceReviewTermsBySection?.[String(sectionID)] || []),
    ...(testCase.evidenceReviewTerms || [])
  ].map((term) => String(term || "").trim()).filter(Boolean)));
}

function passageAroundTerm(text, term) {
  const index = text.toLocaleLowerCase("en-US").indexOf(term.toLocaleLowerCase("en-US"));
  if (index < 0) return null;
  const start = Math.max(0, index - selectedPassageContextBefore);
  const end = Math.min(text.length, index + term.length + selectedPassageContextAfter);
  return text.slice(start, end).trim();
}

function selectedPassages(testCase, sectionID, section) {
  const text = canonicalBodyText(section);
  assert(text, `${testCase.id} section ${sectionID} has no canonical Zoning text.`);
  if (text.length <= maximumSelectedPassageCharacters) return [text];

  const terms = evidenceTerms(testCase, sectionID);
  assert(
    terms.length > 0,
    `${testCase.id} section ${sectionID} exceeds the passage limit and needs reviewed evidence terms.`
  );
  const passages = terms
    .map((term) => passageAroundTerm(text, term))
    .filter(Boolean);
  assert(
    passages.length > 0,
    `${testCase.id} has no reviewed evidence term in long section ${sectionID}.`
  );
  return Array.from(new Set(passages));
}

function expectedUncertainty(testCase) {
  if (["explicit-uncertainty", "mapped-applicability"].includes(testCase.category)) {
    return {
      level: "insufficient evidence",
      description: "The answer must identify the missing applicability facts and must not make a property-specific determination from the reviewed evidence alone."
    };
  }
  if ([
    "map",
    "amendment-history",
    "conditional-qualification",
    "effective-date-transition",
    "special-purpose-district",
    "definition",
    "nonconforming-use"
  ].includes(testCase.category)) {
    return {
      level: "conditional",
      description: "The answer must preserve every qualification and evidence boundary stated in the reviewed concepts and avoid every forbidden conclusion."
    };
  }
  return {
    level: "supported",
    description: "The answer may state only the bounded conclusion established by the reviewed Zoning evidence and scenario facts."
  };
}

function missingFacts(testCase) {
  return testCase.requiredConcepts.filter((concept) =>
    /\b(?:missing|unknown|not (?:provided|established)|still needed|additional fact|requires? .*fact|must (?:confirm|verify|establish)|before (?:concluding|reaching)|without (?:the|those|identifying|establishing)|checks? (?:the|for))\b/i.test(concept)
  );
}

function caseTitle(testCase) {
  return testCase.id
    .replace(/^zr-/, "")
    .split("-")
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}

export async function adaptZoningEvaluationDataset({
  zoningDataset,
  automaticScoring,
  sectionReader,
  sectionSummaryReader
}) {
  assert(zoningDataset?.schemaVersion === 1, "Zoning evaluation dataset must use schemaVersion 1.");
  assert(zoningDataset.libraryID === "nyc-zoning-resolution", "Unexpected Zoning evaluation library.");
  assert(zoningDataset.researchEligibility === false, "Zoning public Research eligibility must remain disabled.");
  assert(zoningDataset.governance?.paidEvaluationAllowed === false, "Completed Zoning authorization must be closed before reuse.");
  assert(zoningDataset.governance?.paidEvaluationAuthorization?.status === "consumed", "Completed Zoning authorization must be recorded as consumed.");
  assert(zoningDataset.governance?.professionalZoningSignoff === false, "This benchmark cannot represent professional Zoning sign-off.");
  assert(zoningDataset.governance?.publicResearchReleaseAuthorized === false, "This benchmark cannot authorize public Zoning Research.");
  assert(zoningDataset.cases?.length === 21, "The frozen Zoning benchmark must contain exactly 21 cases.");

  const cases = [];
  for (const testCase of zoningDataset.cases) {
    assert(testCase.status === "approved", `${testCase.id} is not owner-approved for this benchmark.`);
    assert(testCase.reviewer && testCase.reviewedAt, `${testCase.id} lacks reviewer metadata.`);
    const selectedEvidence = [];
    for (const sectionID of testCase.selectedEvidenceSectionIDs) {
      const [summary, section] = await Promise.all([
        sectionSummaryReader(sectionID),
        sectionReader(sectionID)
      ]);
      assert(summary && section, `${testCase.id} references unknown Zoning section ${sectionID}.`);
      selectedEvidence.push({
        sectionID: String(sectionID),
        reference: `ZR ${summary.sectionNumber}`,
        codePrefix: "ZR",
        sectionNumber: String(summary.sectionNumber),
        exactPassages: selectedPassages(testCase, sectionID, section),
        pinDuringBenchmark: !hasVisualReferences(section)
      });
    }
    const requiredCitations = selectedEvidence.map((source) => source.reference);
    cases.push({
      id: testCase.id,
      title: caseTitle(testCase),
      status: "approved",
      difficulty: "advanced",
      topics: ["NYC Zoning Resolution", testCase.category],
      codeEdition: zoningDataset.codeVersion,
      jurisdiction: "New York City, New York",
      projectContext: {},
      selectedEvidence,
      question: testCase.question,
      expectedConclusion: testCase.requiredConcepts.join(" "),
      expectedUncertainty: expectedUncertainty(testCase),
      sourceType: "deliberately constructed edge case",
      sourceReference: "Permitext owner-approved Zoning Resolution evaluation set.",
      reviewer: testCase.reviewer,
      reviewedAt: testCase.reviewedAt,
      notes: "Diagnostic paid benchmark only; not professional Zoning sign-off or public-release authorization.",
      requiredConcepts: testCase.requiredConcepts,
      missingFacts: missingFacts(testCase),
      forbiddenClaims: testCase.forbiddenClaims,
      requiredCitations
    });
  }

  return {
    schemaVersion: 3,
    name: "Permitext owner-approved Zoning diagnostic benchmark",
    description: "A diagnostic adapter over the frozen 21-case Zoning set. Public Zoning Research remains disabled.",
    responseLanguage: "en",
    automaticScoring,
    cases
  };
}
