import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  adaptZoningEvaluationDataset,
  zoningAnswerKeySectionNumbers
} from "../evals/zoning-evaluation-adapter.mjs";
import { structuredRichSources } from "../evidence-discovery.mjs";
import { immutableEvidenceSnapshot } from "../project-foundation-contract.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";

const maximumSelectedPassageCharacters = 11_800;
assert.deepEqual(
  zoningAnswerKeySectionNumbers({
    question: "Do ZR Sections 23-154 and 23-155 apply?",
    expectedConclusion: "Compare Sections 24-01 through 24-03 of the ZR, ZR §11-331, and ZR §§52-42, 52-43, and 52-44.",
    requiredConcepts: ["Preserve ZR Appendix F and ZR Section 77-22."],
    missingFacts: ["Check Appendix J of the ZR and ZR 24-382."],
    forbiddenClaims: ["Do not invent ZR §99-99 or ZR 88-10–88-12."],
    forbiddenPhrases: ["ZR Sections 73-53 and 73-54"]
  }),
  [
    "23-154",
    "23-155",
    "11-331",
    "52-42",
    "52-43",
    "52-44",
    "APPENDIX F",
    "77-22",
    "24-382",
    "99-99",
    "88-10",
    "88-12",
    "73-53",
    "73-54",
    "24-01",
    "24-03",
    "APPENDIX J"
  ],
  "Answer-key source extraction must recognize grouped, ranged, symbol, worded, suffix, and Appendix ZR references."
);
assert.deepEqual(
  zoningAnswerKeySectionNumbers({
    question: "Do Sections 23-362 and 23-363 apply?",
    expectedConclusion: "Section 24-382 is not selected.",
    requiredConcepts: ["Compare §23-343 of the ZR and §§24-31, 24-382."],
    missingFacts: [],
    forbiddenClaims: [],
    forbiddenPhrases: []
  }),
  ["23-362", "23-363", "24-382", "23-343", "24-31"],
  "Answer-key source extraction must fail closed on bare Section and section-symbol references."
);
const zoningDataset = JSON.parse(await readFile(
  new URL("../evals/zoning-cases.json", import.meta.url),
  "utf8"
));
const adapted = await adaptZoningEvaluationDataset({
  zoningDataset,
  automaticScoring: {},
  sectionReader: zoningSection,
  sectionSummaryReader: zoningSectionSummary
});

assert.equal(adapted.cases.length, 21);
for (const testCase of adapted.cases) {
  assert(testCase.selectedEvidence.length > 0, `${testCase.id} has no selected evidence.`);
  for (const source of testCase.selectedEvidence) {
    assert.equal(source.pinDuringBenchmark, true, `${testCase.id} unexpectedly drops ${source.reference}.`);
    assert(source.exactPassages.length > 0, `${testCase.id} has no passage for ${source.reference}.`);
    assert(
      source.exactPassages.reduce((sum, passage) => sum + passage.length, 0) <=
        maximumSelectedPassageCharacters,
      `${testCase.id} exceeds the bounded passage limit for ${source.reference}.`
    );
  }
}

const appendixCase = adapted.cases.find((testCase) => testCase.id === "zr-appendix-map-boundaries");
const appendixText = appendixCase.selectedEvidence[0].exactPassages.join("\n");
assert.match(appendixText, /SUBAREA 1/i);
assert.match(appendixText, /SUBAREA 2/i);
assert.match(appendixText, /shown on the maps in this APPENDIX/i);
assert.equal(appendixCase.selectedEvidence[0].richSourceIDs.length, 2);
assert.equal(
  appendixCase.selectedEvidence[0].visualReviewDisposition,
  "diagnostic-structured-text-only"
);

const locationCase = adapted.cases.find((testCase) => testCase.id === "zr-missing-location-facts");
assert(locationCase.selectedEvidence.some((source) => source.reference === "ZR APPENDIX J"));

const affordableCase = adapted.cases.find((testCase) =>
  testCase.id === "zr-r7a-affordable-far-qualification"
);
const affordableDefinition = affordableCase.selectedEvidence.find((source) =>
  source.reference === "ZR 12-10"
).exactPassages.join("\n");
assert.match(affordableDefinition, /^qualifying affordable housing/im);
assert.match(affordableDefinition, /MIH developments/i);
assert.match(affordableDefinition, /UAP developments/i);
assert.match(affordableDefinition, /affordable housing regulatory agreement/i);
assert(
  affordableCase.selectedEvidence.flatMap((source) => source.exactPassages)
    .reduce((sum, passage) => sum + passage.length, 0) < 16_000,
  "The affordable-housing case must remain materially narrower than the failed diagnostic evidence."
);

const zoningLotCase = adapted.cases.find((testCase) =>
  testCase.id === "zr-zoning-lot-contiguity-definition"
);
const zoningLotText = zoningLotCase.selectedEvidence[0].exactPassages.join("\n");
assert.equal(zoningLotCase.selectedEvidence[0].richSourceIDs, undefined);
assert.equal(
  zoningLotCase.selectedEvidence[0].visualReviewDisposition,
  "diagnostic-structured-text-only"
);
for (const expected of [
  "(a) a lot of record existing on December 15, 1961",
  "(b) a tract of land",
  "minimum of 10 linear feet",
  "Declaration of Restrictions",
  "may or may not coincide"
]) assert.match(zoningLotText, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

const cellarCase = adapted.cases.find((testCase) => testCase.id === "zr-cellar-floor-area-definition");
const cellarText = cellarCase.selectedEvidence[0].exactPassages.join("\n");
for (const expected of [
  "sloping base plane",
  "street wall line level",
  "December 5, 1990",
  "cellar space, except where such space is used for dwelling purposes",
  "Cellar space used for retailing"
]) assert.match(cellarText, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

const standardHeightCase = adapted.cases.find((testCase) => testCase.id === "zr-r7a-standard-height");
assert(
  standardHeightCase.selectedEvidence.every((source) => source.richSourceIDs?.length === 1),
  "Reviewed table cases must carry their exact structured official grids into the diagnostic."
);
assert(
  standardHeightCase.selectedEvidence.every((source) =>
    source.reviewedStructuredPassages?.length === source.richSourceIDs.length &&
      source.reviewedStructuredPassages.every((passage) => passage.trim())
  ),
  "Reviewed table cases must expose their canonical structured text to independent scoring."
);

const historyCase = adapted.cases.find((testCase) => testCase.id === "zr-amendment-history");
const historyEvidence = historyCase.selectedEvidence[0];
assert.equal(historyEvidence.richSourceIDs.length, 1);
const historySection = await zoningSection(historyEvidence.sectionID);
const historySource = structuredRichSources(historySection).find((source) =>
  source.id === historyEvidence.richSourceIDs[0]
);
assert(historySource, "The selected amendment-history source must resolve from current official metadata.");
assert.equal(historySource.kind, "amendment-history");
assert.deepEqual(historyEvidence.reviewedStructuredPassages, [historySource.text]);
assert.match(historySource.text, /N240290ZRY/);
assert.match(historySource.text, /N240011ZRY/);
assert.match(historySource.text, /N240010ZRY/);
assert.match(historySource.text, /does not reproduce every historical version/i);
assert.equal(historySource.rowCount, historySource.grids[0].rows.length);
assert(
  historySource.grids[0].rows.every((row) =>
    row.cells.every((cell) => cell.text && cell.rowSpan === 1 && cell.columnSpan === 1)
  ),
  "The amendment-history evidence must use the immutable structured-row schema."
);
const historySnapshot = immutableEvidenceSnapshot({
  id: "zoning-amendment-history-snapshot",
  source: {
    sourceID: "zoning-amendment-history-passage",
    sectionID: historyEvidence.sectionID,
    sectionNumber: "42-00",
    chapterNumber: "IV-2",
    codePrefix: "ZR",
    codeEdition: zoningDataset.codeVersion,
    codeVersion: zoningDataset.codeVersion,
    text: historySource.text,
    richSourceID: historySource.id,
    richSourceKind: historySource.kind,
    richSourceReference: historySource.reference,
    richSourceContentHash: historySource.contentHash,
    richSourceRowCount: historySource.rowCount,
    richSourceGrids: historySource.grids
  }
});
assert.equal(historySnapshot.structuredSource.rowCount, historySource.rowCount);

const successorDataset = JSON.parse(await readFile(
  new URL("../evals/zoning-cases-expanded-batch-1-successor.json", import.meta.url),
  "utf8"
));
const successorAdapted = await adaptZoningEvaluationDataset({
  zoningDataset: successorDataset,
  automaticScoring: {},
  sectionReader: zoningSection,
  sectionSummaryReader: zoningSectionSummary
});
assert.deepEqual(
  successorAdapted.cases
    .filter((testCase) => testCase.answerKeyEvidenceMismatches.length)
    .map((testCase) => ({
      id: testCase.id,
      answerKeyEvidenceMismatches: testCase.answerKeyEvidenceMismatches
    })),
  [
    {
      id: "zr-special-district-demolition",
      answerKeyEvidenceMismatches: ["101-70"]
    },
    {
      id: "zr-narrow-attached-rear-yard",
      answerKeyEvidenceMismatches: ["23-34"]
    },
    {
      id: "zr-candidate-b1-deep-through-lot-vertical-yard",
      answerKeyEvidenceMismatches: ["24-382"]
    }
  ],
  "The current successor must fail closed on every bare or prefixed answer-key provision absent from selected evidence."
);

const remediationSuccessor2Dataset = JSON.parse(await readFile(
  new URL("../evals/zoning-cases-expanded-batch-1-successor-remediation-2.json", import.meta.url),
  "utf8"
));
const remediationSuccessor2Adapted = await adaptZoningEvaluationDataset({
  zoningDataset: remediationSuccessor2Dataset,
  automaticScoring: {},
  sectionReader: zoningSection,
  sectionSummaryReader: zoningSectionSummary
});
assert.equal(remediationSuccessor2Adapted.cases.length, 30);
assert.deepEqual(
  remediationSuccessor2Adapted.cases
    .filter((testCase) => testCase.answerKeyEvidenceMismatches.length)
    .map((testCase) => ({
      id: testCase.id,
      answerKeyEvidenceMismatches: testCase.answerKeyEvidenceMismatches
    })),
  [],
  "The separately frozen remediation successor 2 must contain no answer-key reference absent from selected evidence."
);

const remediationSuccessor3Dataset = JSON.parse(await readFile(
  new URL("../evals/zoning-cases-expanded-batch-1-successor-remediation-3.json", import.meta.url),
  "utf8"
));
const remediationSuccessor3Adapted = await adaptZoningEvaluationDataset({
  zoningDataset: remediationSuccessor3Dataset,
  automaticScoring: {},
  sectionReader: zoningSection,
  sectionSummaryReader: zoningSectionSummary
});
assert.equal(remediationSuccessor3Adapted.cases.length, 30);
assert.deepEqual(
  remediationSuccessor3Adapted.cases
    .filter((testCase) => testCase.answerKeyEvidenceMismatches.length)
    .map((testCase) => ({
      id: testCase.id,
      answerKeyEvidenceMismatches: testCase.answerKeyEvidenceMismatches
    })),
  [],
  "The separately frozen remediation successor 3 must contain no answer-key reference absent from selected evidence."
);

console.log("zoning evaluation adapter contract passed");
