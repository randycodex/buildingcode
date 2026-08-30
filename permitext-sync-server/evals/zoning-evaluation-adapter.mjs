import { targetedDefinitionExcerpt } from "../research-definition-excerpts.mjs";
import { structuredRichSources } from "../evidence-discovery.mjs";

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
  return (section?.blocks || []).some((block) =>
    /<img\b[^>]*\bsrc=["'][^"']+["']/i.test(String(block?.html || ""))
  );
}

function evidenceTerms(testCase, sectionID) {
  const sectionTerms = testCase.evidenceReviewTermsBySection?.[String(sectionID)] || [];
  const terms = sectionTerms.length ? sectionTerms : (testCase.evidenceReviewTerms || []);
  return Array.from(new Set(terms.map((term) => String(term || "").trim()).filter(Boolean)));
}

function passageRangeAroundTerm(text, term) {
  const index = text.toLocaleLowerCase("en-US").indexOf(term.toLocaleLowerCase("en-US"));
  if (index < 0) return null;
  return {
    start: Math.max(0, index - selectedPassageContextBefore),
    end: Math.min(text.length, index + term.length + selectedPassageContextAfter)
  };
}

function selectedPassages(testCase, sectionID, section) {
  const text = canonicalBodyText(section);
  assert(text, `${testCase.id} section ${sectionID} has no canonical Zoning text.`);
  const terms = evidenceTerms(testCase, sectionID);
  if (
    terms.length &&
    text.length >= 20_000 &&
    /\bdefinitions?\b/i.test(String(section?.title || ""))
  ) {
    const excerpt = targetedDefinitionExcerpt({
      ...section,
      body: { blocks: section.blocks || [] },
      canonicalText: text,
      codePrefix: "ZR"
    }, testCase.question, {
      maximumDefinitions: 4,
      maximumCharacters: maximumSelectedPassageCharacters,
      requiredTextTerms: terms
    });
    assert(excerpt, `${testCase.id} could not resolve its reviewed definition terms in section ${sectionID}.`);
    return excerpt.passages;
  }
  if (!terms.length && text.length <= maximumSelectedPassageCharacters) return [text];
  assert(
    terms.length > 0,
    `${testCase.id} section ${sectionID} exceeds the passage limit and needs reviewed evidence terms.`
  );
  const ranges = terms.map((term) => passageRangeAroundTerm(text, term));
  assert(
    ranges.every(Boolean),
    `${testCase.id} has a reviewed evidence term missing from section ${sectionID}.`
  );
  const mergedRanges = [];
  for (const range of ranges.sort((left, right) => left.start - right.start)) {
    const previous = mergedRanges.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else mergedRanges.push({ ...range });
  }
  const uniquePassages = mergedRanges.map((range) => text.slice(range.start, range.end).trim());
  assert(
    uniquePassages.reduce((sum, passage) => sum + passage.length, 0) <= maximumSelectedPassageCharacters,
    `${testCase.id} section ${sectionID} reviewed passages exceed the bounded evidence limit.`
  );
  return uniquePassages;
}

function expectedUncertainty(testCase) {
  if (
    ["explicit-uncertainty", "mapped-applicability"].includes(testCase.category) ||
    /missing/.test(String(testCase.evidenceMode || ""))
  ) {
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

function answerKeyEvidenceMismatches(testCase, selectedEvidence) {
  const selectedSectionNumbers = new Set(selectedEvidence.map((source) => source.sectionNumber));
  const keyText = [
    testCase.expectedConclusion,
    ...(testCase.requiredConcepts || [])
  ].join(" ");
  return Array.from(new Set(
    Array.from(keyText.matchAll(/\bZR\s+(\d{1,3}(?:-[A-Z0-9]+)+(?:\.\d+)?)\b/gi))
      .map((match) => match[1])
      .filter((sectionNumber) => !selectedSectionNumbers.has(sectionNumber))
  ));
}

export async function adaptZoningEvaluationDataset({
  zoningDataset,
  automaticScoring,
  sectionReader,
  sectionSummaryReader,
  paidExecution = false
}) {
  assert(zoningDataset?.schemaVersion === 1, "Zoning evaluation dataset must use schemaVersion 1.");
  assert(zoningDataset.libraryID === "nyc-zoning-resolution", "Unexpected Zoning evaluation library.");
  assert(zoningDataset.researchEligibility === false, "Zoning public Research eligibility must remain disabled.");
  if (paidExecution) {
    assert(zoningDataset.governance?.paidEvaluationAllowed === true, "Paid Zoning execution is not authorized.");
    assert(
      zoningDataset.governance?.paidEvaluationAuthorization?.status === "authorized",
      "Paid Zoning authorization is not active."
    );
  } else {
    assert(zoningDataset.governance?.paidEvaluationAllowed === false, "Paid Zoning evaluation must be locked before no-cost reuse.");
    assert(
      ["consumed", "locked"].includes(zoningDataset.governance?.paidEvaluationAuthorization?.status),
      "Zoning paid authorization must be consumed or explicitly locked."
    );
  }
  assert(zoningDataset.governance?.professionalZoningSignoff === false, "This benchmark cannot represent professional Zoning sign-off.");
  assert(zoningDataset.governance?.publicResearchReleaseAuthorized === false, "This benchmark cannot authorize public Zoning Research.");
  const expectedCaseCount = zoningDataset.governance?.frozenCaseCount || 21;
  assert(
    zoningDataset.cases?.length === expectedCaseCount,
    `The frozen Zoning benchmark must contain exactly ${expectedCaseCount} cases.`
  );

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
      const richSources = structuredRichSources(section);
      const amendmentHistorySource = testCase.category === "amendment-history"
        ? richSources.find((source) => source.kind === "amendment-history")
        : null;
      if (testCase.category === "amendment-history") {
        assert(amendmentHistorySource, `${testCase.id} has no official amendment-history metadata source.`);
      }
      const visualReferencesPresent = hasVisualReferences(section);
      const appendixVisualIndex = visualReferencesPresent && /^APPENDIX\b/i.test(String(summary.sectionNumber));
      const reviewedTableSourceIDs = appendixVisualIndex || testCase.category === "table"
        ? richSources.filter((source) => source.kind === "table").map((source) => source.id)
        : [];
      if (appendixVisualIndex) {
        assert(
          reviewedTableSourceIDs.length > 0,
          `${testCase.id} cannot use a visual-bearing section without reviewed structured text evidence.`
        );
      }
      const reviewedStructuredSources = Array.from(new Map([
        ...(amendmentHistorySource ? [[amendmentHistorySource.id, amendmentHistorySource]] : []),
        ...richSources
          .filter((source) => reviewedTableSourceIDs.includes(source.id))
          .map((source) => [source.id, source])
      ]).values());
      const richSourceIDs = reviewedStructuredSources.map((source) => source.id);
      selectedEvidence.push({
        sectionID: String(sectionID),
        reference: `ZR ${summary.sectionNumber}`,
        codePrefix: "ZR",
        sectionNumber: String(summary.sectionNumber),
        exactPassages: selectedPassages(testCase, sectionID, section),
        pinDuringBenchmark: true,
        ...(visualReferencesPresent
          ? { visualReviewDisposition: "diagnostic-structured-text-only" }
          : {}),
        ...(richSourceIDs.length ? {
          richSourceIDs,
          reviewedStructuredPassages: reviewedStructuredSources.map((source) => source.text)
        } : {})
      });
    }
    const requiredCitations = selectedEvidence.map((source) => source.reference);
    const keyEvidenceMismatches = answerKeyEvidenceMismatches(testCase, selectedEvidence);
    cases.push({
      id: testCase.id,
      title: testCase.title || caseTitle(testCase),
      status: "approved",
      difficulty: "advanced",
      topics: ["NYC Zoning Resolution", testCase.category],
      codeEdition: zoningDataset.codeVersion,
      jurisdiction: "New York City, New York",
      projectContext: {},
      selectedEvidence,
      answerKeyEvidenceMismatches: keyEvidenceMismatches,
      question: testCase.question,
      expectedConclusion: testCase.expectedConclusion || testCase.requiredConcepts.join(" "),
      expectedUncertainty: expectedUncertainty(testCase),
      sourceType: "deliberately constructed edge case",
      sourceReference: zoningDataset.name || "Permitext owner-approved Zoning Resolution evaluation set.",
      reviewer: testCase.reviewer,
      reviewedAt: testCase.reviewedAt,
      notes: "Diagnostic evaluation only; paid execution requires separate authorization and this is not professional Zoning sign-off or public-release authorization.",
      requiredConcepts: testCase.requiredConcepts,
      missingFacts: missingFacts(testCase),
      forbiddenClaims: testCase.forbiddenClaims,
      requiredCitations
    });
  }

  return {
    schemaVersion: 3,
    name: zoningDataset.name || "Permitext owner-approved Zoning diagnostic benchmark",
    description: `A diagnostic adapter over the frozen ${cases.length}-case Zoning set. Public Zoning Research remains disabled.`,
    responseLanguage: "en",
    automaticScoring,
    cases
  };
}
