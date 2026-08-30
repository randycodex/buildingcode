import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { researchInputForEvidence } from "../app.mjs";
import {
  applyZoningResearchDeterministicRepairs,
  evaluateZoningResearchSafety,
  zoningResearchSafetyPromptContext,
  zoningResearchSafetyVersion
} from "../research-zoning-safety.mjs";

function source({
  sourceID,
  sectionNumber,
  title,
  text,
  richSourceGrids = null,
  visualSources = []
}) {
  return {
    sourceID,
    sectionID: `section-${sectionNumber}`,
    sectionNumber,
    title,
    codePrefix: "ZR",
    corpusID: "nyc-zoning-resolution",
    corpusLabel: "NYC Zoning Resolution",
    codeEdition: "NYC Zoning Resolution — text through 2026-08-13",
    codeVersion: "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1",
    applicabilityStatus: "continuously-amended",
    sectionTextHash: createHash("sha256").update(text).digest("hex"),
    text,
    ...(richSourceGrids ? {
      richSourceID: `${sourceID}-table`,
      richSourceCanonicalReference: `ZR Table ${sectionNumber}`,
      richSourceContentHash: createHash("sha256").update(JSON.stringify(richSourceGrids)).digest("hex"),
      richSourceGrids
    } : {}),
    visualSources
  };
}

function answer(answerText, sourceIDs = [], missingFacts = []) {
  return {
    answerText,
    conclusion: answerText,
    explanation: "",
    supportedPoints: sourceIDs.length ? [{
      heading: "Supported Zoning point",
      explanation: answerText,
      sourceIDs
    }] : [],
    citations: sourceIDs.length ? [{
      sectionID: "section",
      sourceIDs,
      corpusID: "nyc-zoning-resolution"
    }] : [],
    missingFacts,
    evidenceLimitations: ["This answer is limited to the selected enacted Zoning Resolution passages."]
  };
}

const mapEvidence = [source({
  sourceID: "zr-map",
  sectionNumber: "Appendix J",
  title: "Designated Areas Within Manufacturing Districts",
  text: "The Appendix J maps identify designated areas, but this passage does not identify the subject parcel.",
  visualSources: [{ id: "appendix-j-map", contentHash: "abc123" }]
})];
const mapQuestion = "Is this proposed self-service storage site within the Appendix J designated area?";
const mapPrompt = zoningResearchSafetyPromptContext({ question: mapQuestion, evidence: mapEvidence });
assert.match(mapPrompt, new RegExp(zoningResearchSafetyVersion));
assert.match(mapPrompt, /missing-location/);
assert.match(mapPrompt, /mapped-applicability/);
assert.match(mapPrompt, /Do not infer a parcel's mapped district/);
assert.match(mapPrompt, /property identifier such as the address or BBL/);

const modelInput = researchInputForEvidence(mapQuestion, [{ ...mapEvidence[0], visualSources: [] }]);
assert.match(modelInput, /ZONING RESEARCH SAFETY CONTRACT/);
assert.match(modelInput, new RegExp(`PASSAGE_TEXT_SHA256: ${mapEvidence[0].sectionTextHash}`));

const constructionOnly = source({
  sourceID: "bc-source",
  sectionNumber: "101.2",
  title: "Scope",
  text: "Construction Code scope."
});
constructionOnly.codePrefix = "BC";
constructionOnly.corpusID = "nyc-2022-construction-codes";
assert.equal(zoningResearchSafetyPromptContext({
  question: "What is the scope?",
  evidence: [constructionOnly]
}), "");
assert.equal(evaluateZoningResearchSafety({
  question: "What is the scope?",
  evidence: [constructionOnly],
  answer: answer("The selected passage states the scope.", ["bc-source"])
}).applies, false);

const unbound = evaluateZoningResearchSafety({
  question: "Is this proposed site permitted in the mapped district?",
  evidence: mapEvidence,
  answer: answer("This site is permitted in the mapped district.")
});
assert.equal(unbound.pass, false);
assert(unbound.issues.some((issue) => issue.type === "zoning_unbound_conclusion"));
assert(unbound.issues.some((issue) => issue.type === "zoning_missing_mapped_location"));

const safeMapBoundary = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: answer(
    "The selected Appendix J passage establishes designated-area boundaries, but it cannot establish a property-specific result without locating the subject parcel on the applicable official map.",
    ["zr-map"],
    ["The subject property's address or BBL and its location on the applicable Appendix J map are not established."]
  )
});
assert.equal(safeMapBoundary.pass, true, JSON.stringify(safeMapBoundary.issues));

const missingLocationIdentifier = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: answer(
    "The official Appendix J map must be reviewed before reaching a parcel-specific conclusion.",
    ["zr-map"],
    ["The controlling Appendix J map and mapped district are not established."]
  )
});
assert(missingLocationIdentifier.issues.some((issue) =>
  issue.type === "zoning_missing_location_identifier"
));

const inferredMap = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: answer(
    "This property is within the Appendix J designated area.",
    ["zr-map"],
    ["The property's BBL remains unknown."]
  )
});
assert(inferredMap.issues.some((issue) => issue.type === "zoning_map_inference"));

const specialEvidence = [source({
  sourceID: "zr-special",
  sectionNumber: "101-75",
  title: "Demolition",
  text: "Within the Atlantic Avenue Subdistrict of the Special Downtown Brooklyn District, demolition requires the stated prerequisites."
})];
const specialQuestion = "Within the Atlantic Avenue Subdistrict of the Special Downtown Brooklyn District, when may demolition occur?";
const generalizedSpecial = evaluateZoningResearchSafety({
  question: specialQuestion,
  evidence: specialEvidence,
  answer: answer("The selected special-district rule permits demolition after both prerequisites are met.", ["zr-special"])
});
assert(generalizedSpecial.issues.some((issue) => issue.type === "zoning_special_district_scope"));
const scopedSpecial = evaluateZoningResearchSafety({
  question: specialQuestion,
  evidence: specialEvidence,
  answer: answer(
    "Within the Atlantic Avenue Subdistrict of the Special Downtown Brooklyn District, the selected passage permits demolition only after both stated prerequisites are met.",
    ["zr-special"]
  )
});
assert.equal(scopedSpecial.pass, true, JSON.stringify(scopedSpecial.issues));

const tableEvidence = [source({
  sourceID: "zr-table",
  sectionNumber: "42-111",
  title: "Use Group I",
  text: "Table 42-111 uses a star symbol to identify the condition stated in its footnote.",
  richSourceGrids: [{ rows: [{ cells: [{ text: "Use Group I" }, { text: "*" }] }] }]
})];
const tableQuestion = "Using only selected Table 42-111, explain the Use Group I symbols and footnotes.";
const uncitedTable = evaluateZoningResearchSafety({
  question: tableQuestion,
  evidence: tableEvidence,
  answer: answer("The asterisk symbol refers to a footnote condition.")
});
assert(uncitedTable.issues.some((issue) => issue.type === "zoning_table_binding"));
const citedTable = evaluateZoningResearchSafety({
  question: tableQuestion,
  evidence: tableEvidence,
  answer: answer("The asterisk symbol refers to the supplied footnote condition; the table must be read with that footnote.", ["zr-table"])
});
assert.equal(citedTable.pass, true, JSON.stringify(citedTable.issues));

const farEvidence = [source({
  sourceID: "zr-far",
  sectionNumber: "23-22",
  title: "Maximum Floor Area Ratio",
  text: "The table supplies a basic maximum residential floor area ratio of 4.0 for R7A."
})];
const farQuestion = "Does 42,000 square feet on a 10,000-square-foot R7A lot fit a basic maximum FAR of 4.0?";
const missingMath = evaluateZoningResearchSafety({
  question: farQuestion,
  evidence: farEvidence,
  answer: answer("The proposal exceeds the basic maximum.", ["zr-far"])
});
assert(missingMath.issues.some((issue) => issue.type === "zoning_arithmetic_omission"));
const shownMath = evaluateZoningResearchSafety({
  question: farQuestion,
  evidence: farEvidence,
  answer: answer(
    "42,000 square feet divided by the 10,000-square-foot zoning lot equals 4.2 FAR, which exceeds the selected basic maximum FAR of 4.0; this numeric comparison does not establish overall zoning compliance.",
    ["zr-far"]
  )
});
assert.equal(shownMath.pass, true, JSON.stringify(shownMath.issues));

const amendmentEvidence = [source({
  sourceID: "zr-history",
  sectionNumber: "42-00",
  title: "General Provisions",
  text: "Current official metadata identifies an amendment effective August 13, 2026."
})];
const amendmentQuestion = "Can current amendment-history metadata reconstruct the Zoning text in force on a particular historical date?";
const unsafeHistory = evaluateZoningResearchSafety({
  question: amendmentQuestion,
  evidence: amendmentEvidence,
  answer: answer("The metadata reconstructs the historical text.", ["zr-history"])
});
assert(unsafeHistory.issues.some((issue) => issue.type === "zoning_amendment_history_boundary"));
const safeHistory = evaluateZoningResearchSafety({
  question: amendmentQuestion,
  evidence: amendmentEvidence,
  answer: answer(
    "The current metadata does not reconstruct the historical text in force on that date; the dated enacted amendment and archived text must be verified.",
    ["zr-history"]
  )
});
assert.equal(safeHistory.pass, true, JSON.stringify(safeHistory.issues));

const transitionEvidence = [source({
  sourceID: "zr-transition",
  sectionNumber: "25-211",
  title: "Parking Requirements",
  text: "The transition depends on whether the certificate of occupancy is issued after December 5, 2024."
})];
const transitionQuestion = "For an R7A development in the Inner Transit Zone, what applies when the certificate is issued after December 5, 2024?";
const missingDate = evaluateZoningResearchSafety({
  question: transitionQuestion,
  evidence: transitionEvidence,
  answer: answer("The post-transition rule applies.", ["zr-transition"])
});
assert(missingDate.issues.some((issue) => issue.type === "zoning_effective_date_omission"));
const tiedDate = evaluateZoningResearchSafety({
  question: transitionQuestion,
  evidence: transitionEvidence,
  answer: answer("Because the certificate is issued after December 5, 2024, the cited post-transition rule applies to the stated scenario.", ["zr-transition"])
});
assert.equal(tiedDate.pass, true, JSON.stringify(tiedDate.issues));

const oldRulesQuestion = "May this project continue under the old zoning rules through the City of Yes transition?";
const oldRulesPrompt = zoningResearchSafetyPromptContext({
  question: oldRulesQuestion,
  evidence: [transitionEvidence[0]]
});
assert.match(oldRulesPrompt, /historical-substantive-text/);
assert.match(oldRulesPrompt, /official archived substantive text/);
const missingOldRules = evaluateZoningResearchSafety({
  question: oldRulesQuestion,
  evidence: [transitionEvidence[0]],
  answer: answer(
    "The current transition provision permits continued work under the old rules if its stated conditions are met.",
    ["zr-transition"]
  )
});
assert(missingOldRules.issues.some((issue) =>
  issue.type === "zoning_historical_substantive_text"
));
const boundedOldRules = evaluateZoningResearchSafety({
  question: oldRulesQuestion,
  evidence: [transitionEvidence[0]],
  answer: answer(
    "If the current transition conditions are met, the project may continue under the preserved prior rules, but the verified official archived pre-City-of-Yes zoning text must be reviewed to determine the substantive requirements preserved.",
    ["zr-transition"]
  )
});
assert.equal(boundedOldRules.pass, true, JSON.stringify(boundedOldRules.issues));
const repairedOldRulesAnswer = applyZoningResearchDeterministicRepairs(
  answer(
    "The current transition provision permits continued work under the old rules if its stated conditions are met.",
    ["zr-transition"]
  ),
  [transitionEvidence[0]],
  { question: oldRulesQuestion }
);
assert.match(repairedOldRulesAnswer.answerText, /official archived pre-amendment Zoning text/);
assert.equal(evaluateZoningResearchSafety({
  question: oldRulesQuestion,
  evidence: [transitionEvidence[0]],
  answer: repairedOldRulesAnswer
}).pass, true);

const cellarDefinitionEvidence = [source({
  sourceID: "zr-cellar-definition",
  sectionNumber: "12-10",
  title: "Definitions",
  text: "Cellar is a defined term with special measurement rules and a retail-only parking consequence."
})];
const cellarPrompt = zoningResearchSafetyPromptContext({
  question: "Does this cellar count as zoning floor area?",
  evidence: cellarDefinitionEvidence
});
assert.match(cellarPrompt, /"definition"/);
assert.match(cellarPrompt, /special measurement clause/);
assert.match(cellarPrompt, /Do not generalize a consequence listed only for parking/);

const cellarPolarity = evaluateZoningResearchSafety({
  question: "A storage cellar is not used for dwelling purposes. Does it count as zoning floor area?",
  evidence: cellarDefinitionEvidence,
  answer: answer(
    "Yes. Under the cited definition, the stated non-dwelling cellar does not count as zoning floor area.",
    ["zr-cellar-definition"]
  )
});
assert(cellarPolarity.issues.some((issue) => issue.type === "zoning_answer_polarity_conflict"));

const loweredYardEvidence = [source({
  sourceID: "zr-cellar-lowered-yard",
  sectionNumber: "12-10",
  title: "Definitions",
  text: "A cellar is measured from the base plane, except that where a yard was lowered after December 5, 1990, the level of the yard before it was lowered shall apply."
})];
const unresolvedLoweredYard = evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: answer("No, the stated level is excluded as a cellar.", ["zr-cellar-lowered-yard"])
});
assert(unresolvedLoweredYard.issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"));
const preservedLoweredYard = evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: answer(
    "No, subject to the unresolved special measurement rule for a lowered yard.",
    ["zr-cellar-lowered-yard"],
    ["Whether the relevant yard was lowered after December 5, 1990 remains unknown and must be verified."]
  )
});
assert(!preservedLoweredYard.issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"));

const lotCoverageEvidence = [source({
  sourceID: "zr-lot-coverage",
  sectionNumber: "23-362",
  title: "Maximum Lot Coverage",
  text: "The basic maximum lot coverage for an interior lot is 80 percent."
})];
const lotCoverageQuestion = "Under the basic lot-coverage rule, can 8,500 square feet cover a 10,000-square-foot lot?";
const overclaimedLotCoverage = evaluateZoningResearchSafety({
  question: lotCoverageQuestion,
  evidence: lotCoverageEvidence,
  answer: answer("No. The permitted coverage is 8,000 square feet.", ["zr-lot-coverage"])
});
assert(overclaimedLotCoverage.issues.some((issue) => issue.type === "zoning_basic_lot_coverage_boundary"));
const boundedLotCoverage = evaluateZoningResearchSafety({
  question: lotCoverageQuestion,
  evidence: lotCoverageEvidence,
  answer: answer(
    "No. The basic 80 percent cap is 8,000 square feet, but independently applicable yard or open-area rules may be more restrictive.",
    ["zr-lot-coverage"]
  )
});
assert(!boundedLotCoverage.issues.some((issue) => issue.type === "zoning_basic_lot_coverage_boundary"));

const zoningLotDefinitionEvidence = [source({
  sourceID: "zr-zoning-lot-definition",
  sectionNumber: "12-10",
  title: "Definitions — zoning lot",
  text: "(a) a lot of record existing on December 15, 1961; (b) a tract of land in single ownership on December 15, 1961; (c) contiguous lots of record; or (d) contiguous lots subject to a Declaration of Restrictions."
})];
const zoningLotQuestion = "Can two tax lots now be treated as one zoning lot merely because they share ownership?";
const omittedHistoricalBranch = evaluateZoningResearchSafety({
  question: zoningLotQuestion,
  evidence: zoningLotDefinitionEvidence,
  answer: answer(
    "No. The current contiguous-lot route and Declaration route do not apply, and historical single ownership is not established.",
    ["zr-zoning-lot-definition"]
  )
});
assert(omittedHistoricalBranch.issues.some((issue) => issue.type === "zoning_definition_branch_omission"));
const completeDefinitionBranches = evaluateZoningResearchSafety({
  question: zoningLotQuestion,
  evidence: zoningLotDefinitionEvidence,
  answer: answer(
    "No. Separately, paragraph (a) asks whether either was a lot of record existing on December 15, 1961; paragraph (b) addresses historical single ownership; and the current contiguous-lot and Declaration routes have their own conditions.",
    ["zr-zoning-lot-definition"]
  )
});
assert(!completeDefinitionBranches.issues.some((issue) => issue.type === "zoning_definition_branch_omission"));

const parkingGeographyEvidence = [source({
  sourceID: "zr-parking-geography",
  sectionNumber: "25-211",
  title: "Residential Parking Requirements",
  text: "Different requirements apply in the Inner Transit Zone, Outer Transit Zone, beyond the Greater Transit Zone, and in a special parking area or special district."
})];
const parkingQuestion = "How does the parking result change among the Inner, Outer, and Greater Transit Zone geographies?";
const omittedParkingAlternative = evaluateZoningResearchSafety({
  question: parkingQuestion,
  evidence: parkingGeographyEvidence,
  answer: answer("The result differs in the Inner, Outer, and Greater Transit Zones.", ["zr-parking-geography"])
});
assert(omittedParkingAlternative.issues.some((issue) => issue.type === "zoning_parking_geography_omission"));
const completeParkingGeography = evaluateZoningResearchSafety({
  question: parkingQuestion,
  evidence: parkingGeographyEvidence,
  answer: answer(
    "The result differs in the Inner, Outer, and Greater Transit Zones, and a special parking area or special district may supply another path.",
    ["zr-parking-geography"]
  )
});
assert(!completeParkingGeography.issues.some((issue) => issue.type === "zoning_parking_geography_omission"));

const existingFacilityQuestion = "Can this unidentified property qualify when any December 19, 2017 existing-facility facts have not been provided?";
const missingExistingFacility = evaluateZoningResearchSafety({
  question: existingFacilityQuestion,
  evidence: [source({
    sourceID: "zr-existing-facility",
    sectionNumber: "42-192",
    title: "Self-service storage",
    text: "Separate provisions apply based on lot area and the status of a facility on December 19, 2017."
  })],
  answer: answer(
    "No property-specific conclusion can be made.",
    ["zr-existing-facility"],
    ["The lot area on December 19, 2017 is unknown."]
  )
});
assert(missingExistingFacility.issues.some((issue) => issue.type === "zoning_missing_existing_condition"));
const preservedExistingFacility = evaluateZoningResearchSafety({
  question: existingFacilityQuestion,
  evidence: [source({
    sourceID: "zr-existing-facility",
    sectionNumber: "42-192",
    title: "Self-service storage",
    text: "Separate provisions apply based on lot area and the status of a facility on December 19, 2017."
  })],
  answer: answer(
    "No property-specific conclusion can be made.",
    ["zr-existing-facility"],
    ["Whether an existing facility or use was present on December 19, 2017 is unknown."]
  )
});
assert(!preservedExistingFacility.issues.some((issue) => issue.type === "zoning_missing_existing_condition"));

const confirmedMIHQuestion = "The property is confirmed to be in an MIH area. Does the small-development exception apply?";
const confirmedMIHPrompt = zoningResearchSafetyPromptContext({
  question: confirmedMIHQuestion,
  evidence: [source({
    sourceID: "zr-mih",
    sectionNumber: "27-131",
    title: "Mandatory Inclusionary Housing areas",
    text: "The exception applies only under the stated MIH development conditions."
  })]
});
assert.doesNotMatch(confirmedMIHPrompt, /"missing-location"/);

const mihHistoricalEvidence = [source({
  sourceID: "zr-mih-historical-lot",
  sectionNumber: "27-131",
  title: "Mandatory Inclusionary Housing areas",
  text: "The requirements do not apply to a single development of not more than 10 dwelling units and not more than 12,500 square feet of residential floor area on a zoning lot that existed on the date of establishment of the applicable Mandatory Inclusionary Housing area."
}), source({
  sourceID: "zr-zoning-lot-definition-mih",
  sectionNumber: "12-10",
  title: "Definitions — zoning lot",
  text: "A zoning lot may or may not coincide with a lot shown on the official tax map and may depend on ownership or a recorded Declaration of Restrictions."
})];
const mihHistoricalQuestion = "The property is confirmed to be in an MIH area the owner says was established in 2017. The project has eight apartments and 10,000 square feet of residential floor area, and the current tax lots were combined in 2025. Does the small-development exception apply?";
const mihHistoricalPrompt = zoningResearchSafetyPromptContext({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence
});
assert.match(mihHistoricalPrompt, /mih-historical-zoning-lot/);
assert.doesNotMatch(mihHistoricalPrompt, /"missing-location"/);
assert.match(mihHistoricalPrompt, /satisfying the unit and residential-floor-area thresholds is not enough/i);
const numericalOnlyMIH = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: answer(
    "The project qualifies because eight units is no more than 10 and 10,000 square feet is no more than 12,500 square feet.",
    ["zr-mih-historical-lot"]
  )
});
for (const issueType of [
  "zoning_mih_numerical_only_conclusion",
  "zoning_mih_historical_lot_requirement",
  "zoning_mih_historical_records"
]) assert(numericalOnlyMIH.issues.some((issue) => issue.type === issueType));
const boundedMIH = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "The numerical thresholds are satisfied, but that alone does not establish the exception. The relevant zoning lot must have existed on the applicable MIH-area establishment date. Current tax lots may differ from the zoning lot, so the 2025 combination does not prove the historical zoning-lot configuration.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"],
      [
        "Verify the official MIH establishment date rather than relying on the owner's 2017 characterization.",
        "Obtain official historical zoning-lot evidence, including any relevant recorded declaration, legal description, ownership, or equivalent configuration record."
      ]
    ),
    additionalEvidenceNeeded: []
  }
});
assert.equal(boundedMIH.pass, true, JSON.stringify(boundedMIH.issues));

console.log("Zoning Research safety contract passed", {
  version: zoningResearchSafetyVersion,
  categories: [
    "citation-boundary",
    "stable-passage",
    "missing-location",
    "mapped-applicability",
    "map",
    "special-district",
    "table",
    "arithmetic",
    "definition",
    "mih-historical-zoning-lot",
    "amendment",
    "effective-date",
    "historical-substantive-text"
  ],
  publicResearchEnabled: false
});
