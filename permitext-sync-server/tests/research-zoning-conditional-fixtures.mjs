// Handwritten provider doubles for pipeline tests, never production answers or
// evidence of live generation quality. Bind only to the actual request sources.
export const conditionalFixtures = {
  "ZR-06": {
    lead: "Cannot determine whether the proposed facility is permitted as-of-right on this property from the supplied facts.",
    rules: [
      ["42-192", "Conditional storage paths", "ZR 42-192 distinguishes the Appendix J subareas: Subarea 1 has a conditional as-of-right path requiring industrial or business-sized storage space, while Subarea 2 uses the City Planning Commission special-permit path under ZR 74-192. Neither rule locates this property. Existing-facility treatment requires proof satisfactory to DOB of qualifying existence on December 19, 2017. Enlargement relief depends on unchanged zoning-lot area; documented reconstruction has a floor-area limit; inadequate documentation leads to nonconforming-use treatment. Those historical facts cannot be assumed."],
      ["42-193", "Performance requirements", "ZR 42-193 also subjects Manufacturing District uses to the applicable performance standards. A use allowance alone does not establish compliance."]
    ],
    application: "The address or BBL and controlling official map are needed before any parcel-specific conclusion. Confirm the mapped district, special-district status, Appendix J subarea, lot area and any claimed existing-facility history; the selected rules do not establish these facts.",
    missingFacts: ["Property address or BBL", "Controlling official map and mapped zoning district", "Special-district status", "Applicable Appendix J subarea", "Lot area", "December 19, 2017 existing-facility status and documentation, including any later lot-area change"],
    limitation: "The supplied provisions establish conditional rules, not this property's eligibility or complete design compliance."
  },
  "ZR-07": {
    lead: "Cannot determine the maximum permitted residential FAR until the mapped zoning district is established.",
    rules: [["11-14", "Controlling district maps", "ZR 11-14 incorporates the zoning maps, including amendments, into the Resolution and places district boundaries on those maps."]],
    application: "A Bronx location, 10,000-square-foot lot and proposed 40,000-square-foot residential building do not establish the applicable district or its permitted FAR. The proposal does not establish a Residence District. Confirm the property address or BBL and the controlling official map before selecting a permitted-FAR rule or calculating allowed floor area.",
    missingFacts: ["Property address or BBL", "Controlling official map and mapped zoning district", "Applicable overlays and special-district status"],
    limitation: "The incorporated map rule does not supply this property's mapped status or permitted FAR."
  },
  "ZR-13": {
    lead: "Cannot confirm that the proposed 20-foot rear yard equivalent is sufficient from the 150-foot lot depth alone.",
    rules: [["23-343", "Historical shallow-lot condition", "ZR 23-343 conditions the shallow-lot reduction on the shallow condition existing on December 15, 1961 and remaining unchanged in depth afterward. It reduces the standard required depth by one foot per foot below 190 feet, with a 20-foot minimum. The section also provides categorical exceptions for certain lots under 110 feet deep, large sites, qualifying through/corner-lot configurations and entire-block lots."]],
    application: "The stated depth does not establish the historical condition. Verify that history and whether an exception applies before accepting 20 feet; the required location and permitted-obstruction rules also remain applicable where a rear yard equivalent is required.",
    missingFacts: ["Historical shallow-lot condition on December 15, 1961 and any subsequent depth change", "Whether a stated categorical exception applies", "Proposed yard location and actual obstructions"],
    limitation: "Current lot depth alone does not establish eligibility for the historical shallow-lot reduction."
  }
};

export function conditionalFixtureAnswer(id, evidence) {
  const fixture = conditionalFixtures[id];
  const supportedPoints = fixture.rules.map(([number, heading, explanation]) => {
    const sources = evidence.filter((item) => item.sectionNumber === number);
    if (!sources.length) throw new Error(`Missing fixture source: ${number}`);
    return { heading, explanation, sectionID: String(sources[0].sectionID), sourceIDs: sources.map((source) => source.sourceID) };
  });
  return {
    answerText: [fixture.lead, ...supportedPoints.map((point) => point.explanation), fixture.application].join("\n\n"),
    supportedPoints, citations: supportedPoints.map(({ sectionID, sourceIDs, heading }) => ({ sectionID, sourceIDs, relevance: heading })),
    assumptions: [], missingFacts: [...fixture.missingFacts], followUpQuestions: [],
    evidenceLimitations: [fixture.limitation], additionalEvidenceNeeded: [], supportingSourceUses: []
  };
}
