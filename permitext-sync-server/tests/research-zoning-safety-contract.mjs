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

const appendixGeneralRuleWithSeparateBoundary = evaluateZoningResearchSafety({
  question: "What can the selected Appendix J material establish about designated areas, and what site-specific conclusion cannot be made without identifying the applicable map and location?",
  evidence: mapEvidence,
  answer: answer(
    "For self-service storage facilities, areas shown on Subarea 1 maps are subject to the as-of-right provisions of Section 42-19; areas shown on Subarea 2 maps are subject to a City Planning Commission special permit under Section 74-192. No site-specific conclusion can be made without the property's address or BBL and the applicable official Appendix J map.",
    ["zr-map"],
    ["The property's address or BBL and location on the applicable Appendix J map are not established."]
  )
});
assert.equal(
  appendixGeneralRuleWithSeparateBoundary.pass,
  true,
  JSON.stringify(appendixGeneralRuleWithSeparateBoundary.issues)
);

for (const sourceLevelAppendixRule of [
  "Self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19.",
  "Self-service storage facilities in Subarea 2 require a special permit.",
  "Self-service storage facilities in Subarea 2 are subject to special permit of the City Planning Commission pursuant to Section 74-192.",
  "Self-service storage facilities in Subarea 2 are subject to a special permit pursuant to Section 74-192.",
  "Self-service storage facilities in Subarea 2 require the approval of the City Planning Commission.",
  "Self-service storage facilities in Subarea 2 shall be subject to City Planning Commission approval.",
  "Self-service storage facilities in designated areas shown on Subarea 1 maps are subject to the as-of-right provisions of Section 42-19.",
  "Under Appendix J, self-service storage facilities in designated areas shown on Subarea 2 maps require a special permit.",
  "Designated areas shown on Subarea 2 maps require a special permit for self-service storage facilities.",
  "The self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19.",
  "For self-service storage facilities, the areas shown on Subarea 1 maps are subject to the as-of-right provisions of Section 42-19.",
  "Designated areas in which self-service storage facilities are subject to the as-of-right provisions of Section 42-19 are shown on the maps in Subarea 1.",
  "Designated areas shown on the maps in Subarea 1 are subject to the as-of-right provisions of Section 42-19.",
  "The designated areas shown on the maps in Subarea 1 are subject to the as-of-right provisions of Section 42-19."
]) {
  const sourceLevelAppendixResult = evaluateZoningResearchSafety({
    question: "What can the selected Appendix J material establish about designated areas, and what site-specific conclusion cannot be made without identifying the applicable map and location?",
    evidence: mapEvidence,
    answer: answer(
      `${sourceLevelAppendixRule} No site-specific conclusion can be made without the property's address or BBL and the applicable official Appendix J map.`,
      ["zr-map"],
      ["The property's address or BBL and location on the applicable Appendix J map are not established."]
    )
  });
  assert.equal(
    sourceLevelAppendixResult.pass,
    true,
    `${sourceLevelAppendixRule}: ${JSON.stringify(sourceLevelAppendixResult.issues)}`
  );

  const sourceLevelAppendixWithoutBoundary = evaluateZoningResearchSafety({
    question: "What can the selected Appendix J material establish about designated areas, and what site-specific conclusion cannot be made without identifying the applicable map and location?",
    evidence: mapEvidence,
    answer: answer(
      sourceLevelAppendixRule,
      ["zr-map"],
      ["The property's address or BBL and location on the applicable Appendix J map are not established."]
    )
  });
  assert(sourceLevelAppendixWithoutBoundary.issues.some((issue) =>
    issue.type === "zoning_missing_mapped_location"));
}

for (const completeSubareaTreatment of [
  "Self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19, while those in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192.",
  "Self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19, while those facilities in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192.",
  "Designated areas in which self-service storage facilities are subject to the as-of-right provisions of Section 42-19 are shown on the maps in Subarea 1, and those subject to a City Planning Commission special permit under Section 74-192 are shown on the maps in Subarea 2.",
  "Designated areas in which self-service storage facilities are subject to the as-of-right provisions of Section 42-19 are shown on the maps in Subarea 1, and those in which such uses are subject to a City Planning Commission special permit under Section 74-192 are shown on the maps in Subarea 2.",
  "Designated areas in which self-service storage facilities are subject to the as-of-right provisions of Section 42-19 are shown on the maps in Subarea 1, and those in which such uses are subject to special permit of the City Planning Commission pursuant to Section 74-192 are shown on the maps in Subarea 2.",
  "The designated areas shown on the maps in Subarea 1 are subject to the as-of-right provisions of Section 42-19, and those shown on the maps in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192."
]) {
  const completeSubareaResult = evaluateZoningResearchSafety({
    question: "What can the selected Appendix J material establish about designated areas, and what site-specific conclusion cannot be made without identifying the applicable map and location?",
    evidence: mapEvidence,
    answer: answer(
      `${completeSubareaTreatment} No site-specific conclusion can be made without the property's address or BBL and the applicable official Appendix J map.`,
      ["zr-map"],
      ["The property's address or BBL and location on the applicable Appendix J map are not established."]
    )
  });
  assert.equal(
    completeSubareaResult.pass,
    true,
    `${completeSubareaTreatment}: ${JSON.stringify(completeSubareaResult.issues)}`
  );

  const completeSubareaWithoutBoundary = evaluateZoningResearchSafety({
    question: "What can the selected Appendix J material establish about designated areas, and what site-specific conclusion cannot be made without identifying the applicable map and location?",
    evidence: mapEvidence,
    answer: answer(
      completeSubareaTreatment,
      ["zr-map"],
      ["The property's address or BBL and location on the applicable Appendix J map are not established."]
    )
  });
  assert(completeSubareaWithoutBoundary.issues.some((issue) =>
    issue.type === "zoning_missing_mapped_location"));
}

for (const citationLedAppendixTreatment of [
  "Appendix J establishes that self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19, while those in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192.",
  "Under Appendix J, self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19, while those in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192.",
  "In Appendix J, self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19, while those in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192.",
  "According to Appendix J, self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19, while those in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192.",
  "Appendix J indicates that self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19, while those in Subarea 2 are subject to a City Planning Commission special permit under Section 74-192."
]) {
  const citationLedAppendixResult = evaluateZoningResearchSafety({
    question: "What can the selected Appendix J material establish about designated areas, and what site-specific conclusion cannot be made without identifying the applicable map and location?",
    evidence: mapEvidence,
    answer: answer(
      `${citationLedAppendixTreatment} No site-specific conclusion can be made without the property's address or BBL and the applicable official Appendix J map.`,
      ["zr-map"],
      ["The property's address or BBL and location on the applicable Appendix J map are not established."]
    )
  });
  assert.equal(
    citationLedAppendixResult.pass,
    true,
    `${citationLedAppendixTreatment}: ${JSON.stringify(citationLedAppendixResult.issues)}`
  );
}

const appendixGeneralRuleWithoutBoundary = evaluateZoningResearchSafety({
  question: "What can Appendix J establish, and what site-specific conclusion requires the applicable map and location?",
  evidence: mapEvidence,
  answer: answer(
    "For self-service storage facilities, areas shown on Subarea 1 maps are subject to the as-of-right provisions of Section 42-19.",
    ["zr-map"],
    ["The property's address or BBL and location on the applicable Appendix J map are not established."]
  )
});
assert(appendixGeneralRuleWithoutBoundary.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));

const appendixSpecificSiteContradiction = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: answer(
    "This site is within Subarea 1 and is subject to the as-of-right provisions of Section 42-19. No site-specific conclusion can be made without the applicable official map.",
    ["zr-map"],
    ["The property's address or BBL and mapped location are not established."]
  )
});
assert(appendixSpecificSiteContradiction.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));

for (const unsafeAppendixClaim of [
  "It is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The facility is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "This site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "That site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "This facility is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "This project is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "This parcel is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "A site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "An existing site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Any site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "One site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Site A is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The existing site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The current property is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The referenced parcel is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Our site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The applicant's property is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The applicant’s facility is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Our project is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Acme's site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The company's site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The developer's property is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "The tenant’s property is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Randy's site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Randy's existing site is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Higinio’s property is in an area shown on the Subarea 1 map and is permitted as-of-right.",
  "Proposed self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19.",
  "These self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19.",
  "Those self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19.",
  "The self-service storage facilities here are in areas shown on Subarea 1 maps and are permitted as-of-right.",
  "The self-service storage facilities in this application are in areas shown on Subarea 1 maps and are permitted as-of-right.",
  "The self-service storage facilities under review are in areas shown on Subarea 1 maps and are permitted as-of-right.",
  "The self-service storage facilities in Subarea 1 here are subject to Section 42-19 and permitted as-of-right.",
  "The self-service storage facilities in Subarea 1 in this application are subject to Section 42-19 and permitted as-of-right.",
  "The self-service storage facilities in Subarea 1 under review are subject to Section 42-19 and permitted as-of-right.",
  "These sites are in areas shown on the Subarea 1 map and are permitted as-of-right.",
  "Those properties are in areas shown on the Subarea 1 map and are permitted as-of-right.",
  "Our projects are in areas shown on the Subarea 1 map and are permitted as-of-right.",
  "The parcels are in areas shown on the Subarea 1 map and are permitted as-of-right.",
  "The buildings are in areas shown on the Subarea 1 map and are permitted as-of-right.",
  "These uses are in areas shown on the Subarea 1 map and are permitted as-of-right.",
  "Areas shown on Subarea 1 maps are areas where these self-service storage facilities are permitted as-of-right.",
  "Areas shown on Subarea 1 maps are areas where those self-service storage facilities are permitted as-of-right.",
  "This site requires a special permit.",
  "The project needs a special permit.",
  "This property requires authorization.",
  "The facility must obtain a special permit.",
  "The site may proceed only by special permit.",
  "This site has to obtain a special permit.",
  "This property must secure a special permit.",
  "The project cannot proceed without a special permit.",
  "The facility may proceed subject to a special permit.",
  "This use is contingent on CPC authorization.",
  "This site requires City Planning Commission approval.",
  "This site requires approval from the City Planning Commission.",
  "This site requires the approval of the City Planning Commission.",
  "This site requires the City Planning Commission's approval.",
  "This site shall be permitted only by special permit of the City Planning Commission pursuant to Section 74-192.",
  "This site shall be allowed only by special permit of the City Planning Commission pursuant to Section 74-192.",
  "This site shall be subject to City Planning Commission approval.",
  "This site must be subject to a special permit.",
  "This site must be permitted only by a special permit.",
  "This site must have City Planning Commission approval.",
  "This site may not proceed without a special permit.",
  "This site shall not proceed without a special permit.",
  "These are in an area shown on the Subarea 1 map and are permitted as-of-right.",
  "They are within Subarea 1 and are permitted as-of-right.",
  "Those are in an area shown on the Subarea 1 map and are permitted as-of-right.",
  "Both are in an area shown on the Subarea 1 map and are permitted as-of-right.",
  "This is within Subarea 1 and is permitted as-of-right.",
  "We are within Subarea 1 and are permitted as-of-right.",
  "Ours is within Subarea 1 and is permitted as-of-right.",
  "Each is within Subarea 1 and is permitted as-of-right.",
  "Permitted as-of-right in Subarea 1.",
  "Within Subarea 1 and permitted as-of-right.",
  "Residential use is permitted as-of-right but the mapped district is required before a final determination can be made.",
  "This facility is permitted as-of-right although no property-specific determination can be made without the map.",
  "The project is within Subarea 1 whereas the mapped district is required before a final determination can be made.",
  "This facility is permitted as-of-right though no property-specific determination can be made without the map.",
  "This facility is permitted as-of-right even though no property-specific determination can be made without the map.",
  "Even though no property-specific determination can be made without the map, this facility is permitted as-of-right.",
  "This project is within Subarea 1, nevertheless no site-specific conclusion can be made without the map.",
  "Despite the fact that no property-specific determination can be made without the map, this facility is permitted as-of-right.",
  "Notwithstanding that no property-specific determination can be made without the map, this facility is permitted as-of-right.",
  "Even with no property-specific determination available without the map, this facility is permitted as-of-right.",
  "This facility is permitted as-of-right, despite the fact that no property-specific determination can be made without the map.",
  "This project is within Subarea 1, notwithstanding that no site-specific conclusion can be made without the map.",
  "This site needs to obtain a special permit.",
  "This site needs to secure City Planning Commission approval.",
  "This site has to have City Planning Commission approval.",
  "This site has to be subject to a special permit."
]) {
  const unsafeAppendixResult = evaluateZoningResearchSafety({
    question: mapQuestion,
    evidence: mapEvidence,
    answer: answer(
      `${unsafeAppendixClaim} No site-specific conclusion can be made without the applicable official map.`,
      ["zr-map"],
      ["The property's address or BBL and mapped location are not established."]
    )
  });
  assert(unsafeAppendixResult.issues.some((issue) =>
    issue.type === "zoning_missing_mapped_location"));
}

const unsafeMappedHeadingAnswer = answer(
  "No site-specific conclusion can be made without the property's address or BBL and the applicable official Appendix J map.",
  ["zr-map"],
  ["The property's address or BBL and location on the applicable Appendix J map are not established."]
);
unsafeMappedHeadingAnswer.supportedPoints[0].heading =
  "This site is permitted as-of-right in Subarea 1";
unsafeMappedHeadingAnswer.supportedPoints[0].explanation =
  "The selected Appendix J passage describes designated-area treatment.";
const unsafeMappedHeading = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: unsafeMappedHeadingAnswer
});
assert(unsafeMappedHeading.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));

const safeSourceLevelHeadingAnswer = answer(
  "No site-specific conclusion can be made without the property's address or BBL and the applicable official Appendix J map.",
  ["zr-map"],
  ["The property's address or BBL and location on the applicable Appendix J map are not established."]
);
safeSourceLevelHeadingAnswer.supportedPoints[0].heading =
  "Self-service storage facilities in Subarea 1 are subject to the as-of-right provisions of Section 42-19";
safeSourceLevelHeadingAnswer.supportedPoints[0].explanation =
  "No site-specific conclusion can be made without the property's address or BBL and the applicable official Appendix J map.";
const safeSourceLevelHeading = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: safeSourceLevelHeadingAnswer
});
assert.equal(
  safeSourceLevelHeading.pass,
  true,
  JSON.stringify(safeSourceLevelHeading.issues)
);

const positiveFormMapBoundary = evaluateZoningResearchSafety({
  question: "What FAR applies to this property in the mapped district?",
  evidence: mapEvidence,
  answer: answer(
    "The property location and mapped district are required before FAR can be determined.",
    ["zr-map"],
    ["The property's address or BBL and mapped zoning district are required."]
  )
});
assert.equal(positiveFormMapBoundary.pass, true, JSON.stringify(positiveFormMapBoundary.issues));

const contradictoryMapBoundary = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: answer(
    "This property is within the Appendix J designated area. Separately, the selected passage cannot establish a property-specific result without the applicable official map.",
    ["zr-map"],
    ["The property's address or BBL and mapped location are not established."]
  )
});
assert(contradictoryMapBoundary.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));

const commonUnsafeMappedConclusion = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: answer(
    "Residential use is permitted as-of-right in the mapped district.",
    ["zr-map"],
    ["The property's address or BBL and mapped location are not established."]
  )
});
assert(commonUnsafeMappedConclusion.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));

for (const commonMappedGrant of [
  "Residential use would be permitted as-of-right.",
  "Residential use qualifies as-of-right.",
  "Residential use may proceed as-of-right.",
  "Residential use is lawful as-of-right.",
  "Residential use is authorized as-of-right.",
  "The proposed project can go forward as-of-right."
]) {
  const commonMappedGrantResult = evaluateZoningResearchSafety({
    question: mapQuestion,
    evidence: mapEvidence,
    answer: answer(
      commonMappedGrant,
      ["zr-map"],
      ["The property's address or BBL and mapped location are not established."]
    )
  });
  assert(commonMappedGrantResult.issues.some((issue) =>
    issue.type === "zoning_missing_mapped_location"));
}

const adversativeMappedContradiction = evaluateZoningResearchSafety({
  question: mapQuestion,
  evidence: mapEvidence,
  answer: answer(
    "Residential use is permitted as-of-right, but the mapped district is required before a final determination can be made.",
    ["zr-map"],
    ["The property's address or BBL and mapped location are not established."]
  )
});
assert(adversativeMappedContradiction.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));
for (const adversative of ["although", "whereas"]) {
  const alternateAdversativeMappedContradiction = evaluateZoningResearchSafety({
    question: mapQuestion,
    evidence: mapEvidence,
    answer: answer(
      `Residential use is permitted as-of-right, ${adversative} the mapped district is required before a final determination can be made.`,
      ["zr-map"],
      ["The property's address or BBL and mapped location are not established."]
    )
  });
  assert(alternateAdversativeMappedContradiction.issues.some((issue) =>
    issue.type === "zoning_missing_mapped_location"));
}

const addressOnlyMappedQuestion = evaluateZoningResearchSafety({
  question: "What residential use applies at 123 Main Street when the mapped zoning district has not been established?",
  evidence: mapEvidence,
  answer: answer(
    "Residential use is permitted as-of-right in the mapped district.",
    ["zr-map"],
    ["The mapped zoning district and controlling official map are not established."]
  )
});
assert(addressOnlyMappedQuestion.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));
assert(!addressOnlyMappedQuestion.issues.some((issue) =>
  issue.type === "zoning_missing_location_identifier"));

const compactBBLMappedQuestion = evaluateZoningResearchSafety({
  question: "What residential use applies to BBL 1001230001 when the mapped zoning district has not been established?",
  evidence: mapEvidence,
  answer: answer(
    "Residential use is permitted as-of-right in the mapped district.",
    ["zr-map"],
    ["The mapped zoning district and controlling official map are not established."]
  )
});
assert(compactBBLMappedQuestion.issues.some((issue) =>
  issue.type === "zoning_missing_mapped_location"));
assert(!compactBBLMappedQuestion.issues.some((issue) =>
  issue.type === "zoning_missing_location_identifier"));

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
const tiedAbbreviatedDate = evaluateZoningResearchSafety({
  question: transitionQuestion,
  evidence: transitionEvidence,
  answer: answer(
    "Because the certificate is issued after Dec. 5, 2024, the cited post-transition rule applies to the stated scenario.",
    ["zr-transition"]
  )
});
assert.equal(tiedAbbreviatedDate.pass, true, JSON.stringify(tiedAbbreviatedDate.issues));
const dateWithoutEventLink = evaluateZoningResearchSafety({
  question: transitionQuestion,
  evidence: transitionEvidence,
  answer: answer(
    "An unrelated application was filed on Dec. 5, 2024, but the answer does not tie the certificate date to the transition.",
    ["zr-transition"]
  )
});
assert(dateWithoutEventLink.issues.some((issue) =>
  issue.type === "zoning_effective_date_omission"));
const permitDateCannotSubstituteForCertificateDate = evaluateZoningResearchSafety({
  question: transitionQuestion,
  evidence: transitionEvidence,
  answer: answer(
    "A permit was issued after December 5, 2024, but the answer does not establish when the certificate of occupancy was issued.",
    ["zr-transition"]
  )
});
assert(permitDateCannotSubstituteForCertificateDate.issues.some((issue) =>
  issue.type === "zoning_effective_date_omission"));
const reversedDateRelation = evaluateZoningResearchSafety({
  question: transitionQuestion,
  evidence: transitionEvidence,
  answer: answer(
    "Because the certificate is issued before December 5, 2024, the cited pre-transition rule applies.",
    ["zr-transition"]
  )
});
assert(reversedDateRelation.issues.some((issue) =>
  issue.type === "zoning_effective_date_omission"));
for (const incompatibleDateStatement of [
  "The certificate was issued on December 5, 2024.",
  "The certificate was issued December 5, 2024.",
  "The certificate was not issued after December 5, 2024.",
  "No certificate was issued after December 5, 2024.",
  "The certificate wasn't issued after December 5, 2024.",
  "The certificate was issued prior to December 5, 2024."
]) {
  const incompatibleDateRelation = evaluateZoningResearchSafety({
    question: transitionQuestion,
    evidence: transitionEvidence,
    answer: answer(incompatibleDateStatement, ["zr-transition"])
  });
  assert(incompatibleDateRelation.issues.some((issue) =>
    issue.type === "zoning_effective_date_omission"));
}
const certificateAliasDate = evaluateZoningResearchSafety({
  question: transitionQuestion,
  evidence: transitionEvidence,
  answer: answer(
    "Because the CO was issued after December 5, 2024, the cited post-transition rule applies.",
    ["zr-transition"]
  )
});
assert.equal(certificateAliasDate.pass, true, JSON.stringify(certificateAliasDate.issues));
for (const unrelatedCompanyDate of [
  "Acme Co filed after December 5, 2024.",
  "The co-applicant filed after December 5, 2024."
]) {
  const unrelatedCompanyDateResult = evaluateZoningResearchSafety({
    question: transitionQuestion,
    evidence: transitionEvidence,
    answer: answer(unrelatedCompanyDate, ["zr-transition"])
  });
  assert(unrelatedCompanyDateResult.issues.some((issue) =>
    issue.type === "zoning_effective_date_omission"));
}

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

const exactCityOfYesQuestion = "We filed a new-building application for one building on November 20, 2024, and DOB issued the permit on December 4, 2024. By December 5, 2024, about 60 percent of the foundation work was complete. The design complies with the zoning rules that existed before City of Yes but not with the new rules. Can we keep building under the old zoning?";
const exactCityOfYesEvidence = [source({
  sourceID: "zr-city-of-yes-11-31",
  sectionNumber: "11-31",
  title: "General Provisions",
  text: "A lawfully issued building permit and complete plans are required for the applicable right to continue construction."
}), source({
  sourceID: "zr-city-of-yes-11-331",
  sectionNumber: "11-331",
  title: "Right to construct if foundations completed",
  text: "For a minor development, all foundation work must have been completed before the effective date of the applicable amendment."
}), source({
  sourceID: "zr-city-of-yes-11-333",
  sectionNumber: "11-333",
  title: "Special allowances for building permits issued prior to certain dates",
  text: "A City of Yes application filed by December 5, 2024 may continue under the prior rules if DOB approved a qualifying application based on a complete zoning analysis by December 5, 2025 and the other stated requirements are met."
})];
const exactCityOfYesUnrepaired = answer(
  "The November 20, 2024 filing and December 4, 2024 permit do not alone decide the result. Sixty percent foundation completion by December 5, 2024 does not satisfy the general minor-development rule in ZR 11-331, which requires all foundation work. A separate ZR 11-333 route may apply if DOB approved the qualifying application based on a complete zoning analysis by its stated deadline, so the DOB records must be reviewed before deciding whether work may continue under the old rules.",
  exactCityOfYesEvidence.map((item) => item.sourceID)
);
const exactCityBeforeRepair = evaluateZoningResearchSafety({
  question: exactCityOfYesQuestion,
  evidence: exactCityOfYesEvidence,
  answer: exactCityOfYesUnrepaired
});
assert.deepEqual(
  exactCityBeforeRepair.issues.map((issue) => issue.type),
  ["zoning_historical_substantive_text"]
);
const exactCityConclusionBeforeRepair = exactCityOfYesUnrepaired.conclusion;
const exactCityCitationsBeforeRepair = structuredClone(exactCityOfYesUnrepaired.citations);
const exactCityRepaired = applyZoningResearchDeterministicRepairs(
  exactCityOfYesUnrepaired,
  exactCityOfYesEvidence,
  { question: exactCityOfYesQuestion }
);
assert.equal(evaluateZoningResearchSafety({
  question: exactCityOfYesQuestion,
  evidence: exactCityOfYesEvidence,
  answer: exactCityRepaired
}).pass, true);
assert.equal(exactCityRepaired.conclusion, exactCityConclusionBeforeRepair);
assert.deepEqual(exactCityRepaired.citations, exactCityCitationsBeforeRepair);
assert.equal(exactCityRepaired.evidenceLimitations.filter((item) =>
  item === "The current transition provision may preserve prior rules but does not reproduce their substantive requirements."
).length, 1);
assert.equal(exactCityRepaired.additionalEvidenceNeeded.filter((item) =>
  item === "Verify the dated enacted or official archived pre-amendment Zoning text to determine the substantive rules preserved for the project."
).length, 1);
assert.deepEqual(
  applyZoningResearchDeterministicRepairs(
    exactCityRepaired,
    exactCityOfYesEvidence,
    { question: exactCityOfYesQuestion }
  ),
  exactCityRepaired
);
const abbreviatedCityDates = applyZoningResearchDeterministicRepairs(
  answer(
    "The Nov. 20, 2024 filing and Dec. 4, 2024 permit do not alone decide the result. Sixty percent foundation completion by Dec. 5, 2024 does not satisfy the general minor-development rule. The separate transition may apply only after the qualifying DOB record is verified.",
    exactCityOfYesEvidence.map((item) => item.sourceID)
  ),
  exactCityOfYesEvidence,
  { question: exactCityOfYesQuestion }
);
assert.equal(evaluateZoningResearchSafety({
  question: exactCityOfYesQuestion,
  evidence: exactCityOfYesEvidence,
  answer: abbreviatedCityDates
}).pass, true);
const swappedCityDateEvents = applyZoningResearchDeterministicRepairs(
  answer(
    "The Nov. 20, 2024 permit and Dec. 4, 2024 filing do not alone decide the result. Sixty percent foundation completion by Dec. 5, 2024 does not satisfy the general minor-development rule. The separate transition may apply only after the qualifying DOB record is verified.",
    exactCityOfYesEvidence.map((item) => item.sourceID)
  ),
  exactCityOfYesEvidence,
  { question: exactCityOfYesQuestion }
);
assert(evaluateZoningResearchSafety({
  question: exactCityOfYesQuestion,
  evidence: exactCityOfYesEvidence,
  answer: swappedCityDateEvents
}).issues.some((issue) => issue.type === "zoning_effective_date_omission"));

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
const repairedLoweredYard = applyZoningResearchDeterministicRepairs(
  answer(
    "No final classification can be made because the result depends on whether the relevant yard was lowered after December 5, 1990.",
    ["zr-cellar-lowered-yard"]
  ),
  loweredYardEvidence,
  { question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?" }
);
assert(repairedLoweredYard.missingFacts.some((fact) =>
  /yard was lowered after December 5, 1990/i.test(fact)));
assert.equal(evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: repairedLoweredYard
}).pass, true);
assert.deepEqual(
  applyZoningResearchDeterministicRepairs(
    repairedLoweredYard,
    loweredYardEvidence,
    { question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?" }
  ),
  repairedLoweredYard
);
const unconditionalLoweredYard = applyZoningResearchDeterministicRepairs(
  answer("No, the stated level is excluded as a cellar.", ["zr-cellar-lowered-yard"]),
  loweredYardEvidence,
  { question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?" }
);
assert(unconditionalLoweredYard.missingFacts.length === 0);
assert(evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: unconditionalLoweredYard
}).issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"));
const buriedLoweredYardBoundary = applyZoningResearchDeterministicRepairs(
  {
    ...answer("No, the stated level is excluded as a cellar.", ["zr-cellar-lowered-yard"]),
    evidenceLimitations: [
      "The result depends on whether the relevant yard was lowered after December 5, 1990."
    ]
  },
  loweredYardEvidence,
  { question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?" }
);
assert.equal(buriedLoweredYardBoundary.missingFacts.length, 0);
assert(evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: buriedLoweredYardBoundary
}).issues.some((issue) => issue.type === "zoning_definition_lowered_yard_fact"));
const unconditionalLoweredYardWithMissingFact = evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: answer(
    "No, the stated level is excluded as a cellar.",
    ["zr-cellar-lowered-yard"],
    ["Whether the relevant yard was lowered after December 5, 1990 remains unknown and must be verified."]
  )
});
assert(unconditionalLoweredYardWithMissingFact.issues.some((issue) =>
  issue.type === "zoning_definition_lowered_yard_fact"));
const conciseCautiousCellarConclusion = evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: {
    ...answer(
      "The classification depends on whether the relevant yard was lowered after December 5, 1990, which remains unresolved.",
      ["zr-cellar-lowered-yard"],
      ["Whether the relevant yard was lowered after December 5, 1990 remains unknown and must be verified."]
    ),
    conclusion: "No final classification can be made."
  }
});
assert.equal(conciseCautiousCellarConclusion.pass, true, JSON.stringify(conciseCautiousCellarConclusion.issues));
const contradictoryCellarSupportedPoint = evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: {
    ...answer(
      "The classification depends on whether the relevant yard was lowered after December 5, 1990, which remains unresolved.",
      ["zr-cellar-lowered-yard"],
      ["Whether the relevant yard was lowered after December 5, 1990 remains unknown and must be verified."]
    ),
    conclusion: "No final classification can be made.",
    supportedPoints: [{
      heading: "Cellar classification",
      explanation: "No, the stated level is excluded as a cellar.",
      sourceIDs: ["zr-cellar-lowered-yard"]
    }]
  }
});
assert(contradictoryCellarSupportedPoint.issues.some((issue) =>
  issue.type === "zoning_definition_lowered_yard_fact"));
for (const safeConditionalCellarAnswer of [
  "It cannot be determined whether the level is a cellar because the result depends on whether the yard was lowered after December 5, 1990.",
  "If the yard was not lowered after December 5, 1990, the level is a cellar; if it was lowered, the classification may differ."
]) {
  const safeConditionalCellar = evaluateZoningResearchSafety({
    question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
    evidence: loweredYardEvidence,
    answer: answer(
      safeConditionalCellarAnswer,
      ["zr-cellar-lowered-yard"],
      ["Whether the relevant yard was lowered after December 5, 1990 remains unknown and must be verified."]
    )
  });
  assert.equal(
    safeConditionalCellar.pass,
    true,
    `${safeConditionalCellarAnswer}: ${JSON.stringify(safeConditionalCellar.issues)}`
  );
}
const contradictoryCellarFloorAreaDisposition = evaluateZoningResearchSafety({
  question: "A below-grade storage level is below the base plane. Does it count as zoning floor area?",
  evidence: loweredYardEvidence,
  answer: {
    ...answer(
      "The classification depends on whether the relevant yard was lowered after December 5, 1990, which remains unresolved.",
      ["zr-cellar-lowered-yard"],
      ["Whether the relevant yard was lowered after December 5, 1990 remains unknown and must be verified."]
    ),
    conclusion: "No final classification can be made.",
    supportedPoints: [{
      heading: "Floor-area treatment",
      explanation: "The area must be omitted from zoning floor area.",
      sourceIDs: ["zr-cellar-lowered-yard"]
    }]
  }
});
assert(contradictoryCellarFloorAreaDisposition.issues.some((issue) =>
  issue.type === "zoning_definition_lowered_yard_fact"));

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
  text: "(a) a lot of record existing on December 15, 1961; (b) a tract of land in single ownership on December 15, 1961; (c) contiguous lots of record; or (d) contiguous lots subject to a Declaration of Restrictions. A zoning lot may or may not coincide with a lot shown on the official tax map."
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
assert(omittedHistoricalBranch.issues.some((issue) =>
  issue.type === "zoning_definition_tax_map_distinction_omission"));
const completeDefinitionBranches = evaluateZoningResearchSafety({
  question: zoningLotQuestion,
  evidence: zoningLotDefinitionEvidence,
  answer: answer(
    "No. Separately, paragraph (a) asks whether either was a lot of record existing on December 15, 1961; paragraph (b) addresses historical single ownership; and the current contiguous-lot and Declaration routes have their own conditions. A zoning lot may or may not coincide with a lot shown on the official tax map.",
    ["zr-zoning-lot-definition"]
  )
});
assert(!completeDefinitionBranches.issues.some((issue) => issue.type === "zoning_definition_branch_omission"));
assert(!completeDefinitionBranches.issues.some((issue) =>
  issue.type === "zoning_definition_tax_map_distinction_omission"));
assert.equal(completeDefinitionBranches.pass, true, JSON.stringify(completeDefinitionBranches.issues));

const overstrongTaxMapDistinction = evaluateZoningResearchSafety({
  question: zoningLotQuestion,
  evidence: zoningLotDefinitionEvidence,
  answer: answer(
    "No. Paragraph (a) addresses a lot of record existing on December 15, 1961; paragraph (b) addresses historical single ownership; and paragraphs (c) and (d) address the current contiguous-lot and Declaration routes. A zoning lot is distinct from a tax lot.",
    ["zr-zoning-lot-definition"]
  )
});
assert(overstrongTaxMapDistinction.issues.some((issue) =>
  issue.type === "zoning_definition_tax_map_distinction_omission"));
const maskedTaxMapOverstatement = evaluateZoningResearchSafety({
  question: zoningLotQuestion,
  evidence: zoningLotDefinitionEvidence,
  answer: answer(
    "No. Paragraph (a) addresses a lot of record existing on December 15, 1961; paragraph (b) addresses historical single ownership; and paragraphs (c) and (d) address the current contiguous-lot and Declaration routes. A zoning lot may or may not coincide with a tax lot. Zoning lots are always distinct from tax lots.",
    ["zr-zoning-lot-definition"]
  )
});
assert(maskedTaxMapOverstatement.issues.some((issue) =>
  issue.type === "zoning_definition_tax_map_distinction_omission"));
for (const maskedOverstatement of [
  "A zoning lot may or may not coincide with a tax lot. They are always distinct.",
  "A zoning lot may or may not coincide with a tax lot. Zoning lots and tax lots are always different.",
  "A zoning lot may or may not coincide with a tax lot. The two never coincide.",
  "A zoning lot may or may not coincide with a tax lot. A zoning lot is always different from a tax lot.",
  "A zoning lot may or may not coincide with a tax lot. These two are always different.",
  "A zoning lot may or may not coincide with a tax lot. Zoning and tax lots are always different.",
  "A zoning lot may or may not coincide with a tax lot. A zoning lot and a tax lot can never be the same."
]) {
  const maskedEquivalentOverstatement = evaluateZoningResearchSafety({
    question: zoningLotQuestion,
    evidence: zoningLotDefinitionEvidence,
    answer: answer(
      `No. Paragraph (a) addresses a lot of record existing on December 15, 1961; paragraph (b) addresses historical single ownership; and paragraphs (c) and (d) address the current contiguous-lot and Declaration routes. ${maskedOverstatement}`,
      ["zr-zoning-lot-definition"]
    )
  });
  assert(maskedEquivalentOverstatement.issues.some((issue) =>
    issue.type === "zoning_definition_tax_map_distinction_omission"));
}

for (const supportedTaxMapDistinction of [
  "A zoning lot and a tax lot are not necessarily the same.",
  "Tax-lot and zoning-lot identity is not automatic.",
  "A tax lot is not automatically the same as a zoning lot."
]) {
  const equivalentTaxMapDistinction = evaluateZoningResearchSafety({
    question: zoningLotQuestion,
    evidence: zoningLotDefinitionEvidence,
    answer: answer(
      `No. Paragraph (a) addresses a lot of record existing on December 15, 1961; paragraph (b) addresses historical single ownership; and paragraphs (c) and (d) address the current contiguous-lot and Declaration routes. ${supportedTaxMapDistinction}`,
      ["zr-zoning-lot-definition"]
    )
  });
  assert.equal(equivalentTaxMapDistinction.pass, true, JSON.stringify(equivalentTaxMapDistinction.issues));
}

const hyphenatedZoningLotQuestion = evaluateZoningResearchSafety({
  question: "Can two tax-lots now be treated as one zoning-lot merely because they share ownership?",
  evidence: zoningLotDefinitionEvidence,
  answer: answer(
    "No. Paragraph (a) asks whether either was a lot of record existing on December 15, 1961; paragraph (b) addresses historical single ownership; and the current contiguous-lot and Declaration routes have their own conditions. A zoning-lot may or may not coincide with a lot shown on the official tax map.",
    ["zr-zoning-lot-definition"]
  )
});
assert.equal(hyphenatedZoningLotQuestion.pass, true, JSON.stringify(hyphenatedZoningLotQuestion.issues));

for (const incidentalQuestion of [
  "Does 42,000 square feet of residential floor area fit the basic FAR on a 10,000-square-foot R7A zoning lot?",
  "Can a standard development cover 8,500 square feet of a 10,000-square-foot R7A zoning lot?",
  "Are two apartment buildings 30 feet apart on the same zoning lot?",
  "Can a C4-4 zoning lot contain apartments under the underlying use rules?"
]) {
  const incidentalDefinition = evaluateZoningResearchSafety({
    question: incidentalQuestion,
    evidence: zoningLotDefinitionEvidence,
    answer: answer(
      "The supplied project rule answers the stated dimensional or use question; the question does not ask whether separate tax lots form one zoning lot.",
      ["zr-zoning-lot-definition"]
    )
  });
  assert(!incidentalDefinition.issues.some((issue) =>
    issue.type === "zoning_definition_branch_omission"),
  `Incidental zoning-lot wording incorrectly triggered all definition branches: ${incidentalQuestion}`);
}

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

const weakSpecialParkingEvidence = [source({
  sourceID: "zr-special-parking-geography-only",
  sectionNumber: "12-10",
  title: "Definitions — Greater Transit Zone",
  text: "The Greater Transit Zone includes special parking areas."
})];
const unsupportedSpecialParkingAlternative = evaluateZoningResearchSafety({
  question: parkingQuestion,
  evidence: weakSpecialParkingEvidence,
  answer: answer(
    "The special parking area may supply another path.",
    ["zr-special-parking-geography-only"]
  )
});
assert(unsupportedSpecialParkingAlternative.issues.some((issue) =>
  issue.type === "zoning_parking_geography_evidence_boundary"));
const maskedUnsupportedSpecialParkingAlternative = evaluateZoningResearchSafety({
  question: parkingQuestion,
  evidence: weakSpecialParkingEvidence,
  answer: {
    ...answer(
      "A special parking area may supply another path. The selected evidence does not supply the special parking area rule, so no alternative result can be stated from it.",
      ["zr-special-parking-geography-only"]
    ),
    additionalEvidenceNeeded: [
      "Obtain the controlling enacted special parking area provision."
    ]
  }
});
assert(maskedUnsupportedSpecialParkingAlternative.issues.some((issue) =>
  issue.type === "zoning_parking_geography_evidence_boundary"));
for (const unsupportedClaim of [
  "The result may differ in a special parking area.",
  "Different requirements may apply in a special parking area.",
  "A special parking area is subject to a different result.",
  "A special parking area could lead to a different outcome.",
  "Special parking areas have different requirements.",
  "Different parking rules govern special parking areas."
]) {
  const mixedUnsupportedClaim = evaluateZoningResearchSafety({
    question: parkingQuestion,
    evidence: weakSpecialParkingEvidence,
    answer: {
      ...answer(
        `${unsupportedClaim} The selected evidence does not supply the special parking area rule, so no alternative result can be stated from it.`,
        ["zr-special-parking-geography-only"]
      ),
      additionalEvidenceNeeded: [
        "Obtain the controlling enacted special parking area provision."
      ]
    }
  });
  assert(mixedUnsupportedClaim.issues.some((issue) =>
    issue.type === "zoning_parking_geography_evidence_boundary"));
}
const boundedSpecialParkingEvidence = evaluateZoningResearchSafety({
  question: parkingQuestion,
  evidence: weakSpecialParkingEvidence,
  answer: {
    ...answer(
      "The selected evidence does not supply the special parking area rule, so no alternative result can be stated from it.",
      ["zr-special-parking-geography-only"]
    ),
    additionalEvidenceNeeded: [
      "Obtain the controlling enacted special parking area provision."
    ]
  }
});
assert.equal(boundedSpecialParkingEvidence.pass, true, JSON.stringify(boundedSpecialParkingEvidence.issues));

const negativeSpecialParkingEvidence = [source({
  sourceID: "zr-special-parking-negative-source",
  sectionNumber: "12-10",
  title: "Definitions — Greater Transit Zone",
  text: "No unique parking regulations for special parking areas are supplied in this passage."
})];
const boundedNegativeSpecialParkingEvidence = evaluateZoningResearchSafety({
  question: parkingQuestion,
  evidence: negativeSpecialParkingEvidence,
  answer: {
    ...answer(
      "The selected evidence does not supply the special parking area rule, so no alternative result can be stated from it.",
      ["zr-special-parking-negative-source"]
    ),
    additionalEvidenceNeeded: [
      "Obtain the controlling enacted special parking area provision."
    ]
  }
});
assert.equal(
  boundedNegativeSpecialParkingEvidence.pass,
  true,
  JSON.stringify(boundedNegativeSpecialParkingEvidence.issues)
);

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
const unrelatedAffordableQuestion =
  "My R6A lot is outside an MIH area. Does 31,000 square feet fit a 3.90 FAR when 6,200 square feet is intended to be affordable?";
const unrelatedAffordablePrompt = zoningResearchSafetyPromptContext({
  question: unrelatedAffordableQuestion,
  evidence: mihHistoricalEvidence
});
assert.doesNotMatch(unrelatedAffordablePrompt, /mih-historical-zoning-lot/);
const unrelatedAffordableAnswer = evaluateZoningResearchSafety({
  question: unrelatedAffordableQuestion,
  evidence: mihHistoricalEvidence,
  answer: answer(
    "The stated project is outside an MIH area, so this answer does not rely on the MIH small-development exception.",
    ["zr-mih-historical-lot"]
  )
});
assert(!unrelatedAffordableAnswer.issues.some((issue) =>
  issue.type.startsWith("zoning_mih_")));
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

const retainedEquivalentMIH = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts alone. The numerical elements are satisfied: 8 dwelling units is no more than 10, and 10,000 square feet of residential floor area is no more than 12,500. But those numerical elements do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the development tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: [
      "The exact MIH establishment amendment and effective date remain to be verified.",
      "Whether the tract was a zoning lot on that establishment date is not established."
    ],
    additionalEvidenceNeeded: [
      "The enacted MIH establishment amendment, including its effective date.",
      "Historic title, survey, and any recorded zoning-lot declaration materials showing the tract's status on that date."
    ]
  }
});
assert.equal(retainedEquivalentMIH.pass, true, JSON.stringify(retainedEquivalentMIH.issues));

const numericalOnlyMIHWithoutHistoricalBoundary = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "The project qualifies because it has eight units and 10,000 square feet of residential floor area. The current tax lots differ from the zoning lot.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: [
      "Verify the official MIH establishment date.",
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert(numericalOnlyMIHWithoutHistoricalBoundary.issues.some((issue) =>
  issue.type === "zoning_mih_numerical_only_conclusion"
));

const unjustifiedCategoricalMIHDenial = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "The project does not qualify for the exception. The unit and floor-area thresholds do not establish the historical element. A zoning lot may or may not coincide with a tax lot, and whether this zoning lot existed on the MIH-area establishment date is not established.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: [
      "Verify the official MIH establishment date.",
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert(unjustifiedCategoricalMIHDenial.issues.some((issue) =>
  issue.type === "zoning_mih_numerical_only_conclusion"
));

const bareNoWithUnresolvedMIHHistory = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "The numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot, and whether this zoning-lot existed on the MIH-area establishment date is not established.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    conclusion: "No.",
    missingFacts: [
      "Verify the official MIH establishment date.",
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert(bareNoWithUnresolvedMIHHistory.issues.some((issue) =>
  issue.type === "zoning_mih_numerical_only_conclusion"
));

const scopedNumericalMIHDenial = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts. The project does not qualify based on the 8-unit and 10,000-square-foot thresholds alone; whether the historical zoning-lot existed on the MIH-area establishment date is unresolved. A zoning-lot may or may not coincide with a tax-lot.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: [
      "Verify the official MIH establishment date.",
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert.equal(scopedNumericalMIHDenial.pass, true, JSON.stringify(scopedNumericalMIHDenial.issues));

const scopedDirectNumericalMIHDenial = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts. The 8-unit and 10,000-square-foot figures satisfy the numerical thresholds but do not establish the historical element. A zoning-lot may or may not coincide with a tax-lot, and the tract must have existed as a zoning-lot on the MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    conclusion: "The project does not qualify based on those numerical thresholds alone.",
    missingFacts: [
      "Verify the official MIH establishment date.",
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert.equal(scopedDirectNumericalMIHDenial.pass, true, JSON.stringify(scopedDirectNumericalMIHDenial.issues));

const conditionalMIHGrant = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts. The 8-unit and 10,000-square-foot figures satisfy the numerical thresholds but do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project qualifies only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: [
      "Verify the official MIH establishment date.",
      "Whether the tract was a zoning-lot on that date is not established."
    ],
    additionalEvidenceNeeded: [
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert.equal(conditionalMIHGrant.pass, true, JSON.stringify(conditionalMIHGrant.issues));

const contradictoryMixedMIHGrant = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "The project qualifies for the exception. The 8-unit and 10,000-square-foot figures satisfy the numerical thresholds, but whether this zoning-lot existed on the MIH-area establishment date is unresolved. A zoning-lot may or may not coincide with a tax-lot. The project could qualify only if official historical zoning-lot records establish that element.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    conclusion: "Not established.",
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: [
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert(contradictoryMixedMIHGrant.issues.some((issue) =>
  issue.type === "zoning_mih_numerical_only_conclusion"
));

const conditionalMIHExceptionApplies = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts. The 8-unit and 10,000-square-foot figures satisfy the numerical thresholds but do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The exception applies only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: [
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert.equal(
  conditionalMIHExceptionApplies.pass,
  true,
  JSON.stringify(conditionalMIHExceptionApplies.issues)
);

const cautiousNoFinalDetermination = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "No final qualification determination can be made. Eight units is no more than 10, and 10,000 square feet is no more than 12,500 square feet, but those thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project qualifies only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    conclusion: "No final qualification determination can be made.",
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: [
      "Obtain official historical title, survey, or recorded zoning-lot declaration materials."
    ]
  }
});
assert.equal(
  cautiousNoFinalDetermination.pass,
  true,
  JSON.stringify(cautiousNoFinalDetermination.issues)
);

const crossSentenceHistoricalLotBoundary = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established. Eight units is no more than 10, and 10,000 square feet is no more than 12,500 square feet, but those comparisons do not prove the exception. The official MIH establishment date must be verified. The tract also must have been a zoning-lot on that date. The 2025 combination involved tax-lots. That later event does not prove the legal zoning-lot configuration in 2017.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    conclusion: "Not established.",
    missingFacts: [
      "Verify the official MIH establishment date.",
      "Whether the tract was already the relevant zoning-lot then remains unresolved."
    ],
    additionalEvidenceNeeded: [
      "Obtain historical title and survey records and any recorded Declaration of Restrictions showing the tract configuration and ownership in 2017."
    ]
  }
});
assert.equal(
  crossSentenceHistoricalLotBoundary.pass,
  true,
  JSON.stringify(crossSentenceHistoricalLotBoundary.issues)
);

const vagueHistoricalEvidenceRequest = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts alone. Eight units is no more than 10, and 10,000 square feet is no more than 12,500 square feet, but those numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: ["Obtain official historical zoning-lot evidence."]
  }
});
assert(vagueHistoricalEvidenceRequest.issues.some((issue) =>
  issue.type === "zoning_mih_historical_records"
));

const vagueHistoricalStatusRequest = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts alone. The numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: ["Verify historical zoning-lot status."]
  }
});
assert(vagueHistoricalStatusRequest.issues.some((issue) =>
  issue.type === "zoning_mih_historical_records"
));

const crossItemHistoricalRecordContamination = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts alone. The numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: [
      "Obtain official historical zoning-lot evidence.",
      "Obtain a current site survey."
    ]
  }
});
assert(crossItemHistoricalRecordContamination.issues.some((issue) =>
  issue.type === "zoning_mih_historical_records"
));

const sameItemHistoricalRecordContamination = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts alone. The numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: [
      "Obtain official historical zoning-lot evidence. Obtain a current site survey."
    ]
  }
});
assert(sameItemHistoricalRecordContamination.issues.some((issue) =>
  issue.type === "zoning_mih_historical_records"
));

for (const contaminatedHistoricalRequest of [
  "Obtain official historical zoning-lot evidence, and obtain a current site survey.",
  "Obtain official historical zoning-lot evidence while a current site survey covers dimensions.",
  "Obtain official historical zoning-lot evidence, not the current site survey.",
  "Obtain official historical zoning-lot evidence and a current site survey.",
  "Obtain official historical zoning-lot evidence with a current site survey."
]) {
  const boundedHistoricalRecordContamination = evaluateZoningResearchSafety({
    question: mihHistoricalQuestion,
    evidence: mihHistoricalEvidence,
    answer: {
      ...answer(
        "Not established on the stated facts alone. The numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
        ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
      ),
      missingFacts: ["Verify the official MIH establishment date."],
      additionalEvidenceNeeded: [contaminatedHistoricalRequest]
    }
  });
  assert(boundedHistoricalRecordContamination.issues.some((issue) =>
    issue.type === "zoning_mih_historical_records"));
}

const historicalDeedChainRequest = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts alone. Eight units is no more than 10, and 10,000 square feet is no more than 12,500 square feet, but those numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: [
      "Obtain the recorded historical deed chain for the tract as of the establishment date."
    ]
  }
});
assert.equal(historicalDeedChainRequest.pass, true, JSON.stringify(historicalDeedChainRequest.issues));

const datedSurveyRequest = evaluateZoningResearchSafety({
  question: mihHistoricalQuestion,
  evidence: mihHistoricalEvidence,
  answer: {
    ...answer(
      "Not established on the stated facts alone. Eight units is no more than 10, and 10,000 square feet is no more than 12,500 square feet, but those numerical thresholds do not establish the exception. A zoning-lot may or may not coincide with a tax-lot. The project may qualify only if the tract was already a zoning-lot on the applicable MIH-area establishment date.",
      ["zr-mih-historical-lot", "zr-zoning-lot-definition-mih"]
    ),
    missingFacts: ["Verify the official MIH establishment date."],
    additionalEvidenceNeeded: ["Obtain the recorded 2017 survey for the tract."]
  }
});
assert.equal(datedSurveyRequest.pass, true, JSON.stringify(datedSurveyRequest.issues));

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
