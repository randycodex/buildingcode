import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { researchInputForEvidence } from "../app.mjs";
import {
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
    "amendment",
    "effective-date",
    "historical-substantive-text"
  ],
  publicResearchEnabled: false
});
