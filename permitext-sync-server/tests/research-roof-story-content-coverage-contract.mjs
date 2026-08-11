import assert from "node:assert/strict";
import { evaluateResearchRequiredClaimCoverage } from "../research-required-claim-coverage.mjs";
import { withOfflineResearchHTTPHarness } from "./research-benchmark-http-harness.mjs";

const question =
  "If a roof is designed for occupants as a terrace, does the occupied roof automatically count as another story above grade plane?";

function normalizedSectionText(section) {
  return (section?.body?.blocks || [])
    .map((block) => String(block?.plainText || ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function requiredMatch(text, pattern, label) {
  const match = String(text || "").match(pattern);
  assert(match, `The canonical enacted corpus did not supply ${label}.`);
  return match[0].replace(/\s+/g, " ").trim();
}

await withOfflineResearchHTTPHarness("roof-story-content-coverage", async ({ resolveSection }) => {
  const [definitionsSection, storyTableSection] = await Promise.all([
    resolveSection({ sectionID: "113", codePrefix: "BC", sectionNumber: "202" }),
    resolveSection({ sectionID: "847", codePrefix: "BC", sectionNumber: "504.4" })
  ]);
  const definitionsText = normalizedSectionText(definitionsSection);
  const storyTableText = normalizedSectionText(storyTableSection);
  const storyDefinition = requiredMatch(
    definitionsText,
    /STORY\s*\.\s*That portion of a building included between the upper surface of a floor and the upper surface of the floor or roof next above[\s\S]*?(?=STORY ABOVE GRADE PLANE\s*\.)/i,
    "the complete BC 202 STORY definition"
  );
  const storyAboveGradePlaneDefinition = requiredMatch(
    definitionsText,
    /STORY ABOVE GRADE PLANE\s*\.\s*Any story having its finished floor surface entirely above grade plane[\s\S]*?(?=STREET\s*\.)/i,
    "the complete BC 202 STORY ABOVE GRADE PLANE definition"
  );
  const table5044 = requiredMatch(
    storyTableText,
    /Table 504\.4[\s\S]*?Allowable Number of Stories above Grade Plane[\s\S]*?R-2\s+S13R[\s\S]*?(?=Section BC 505:|$)/i,
    "Table 504.4, including its allowable-story content"
  );

  assert.match(storyDefinition, /topmost story/i);
  assert.match(storyAboveGradePlaneDefinition, /basement shall also be considered a story above grade plane/i);
  assert.match(table5044, /Type of Construction/i);
  assert.match(table5044, /R-2\s+S13R/i);

  const evidence = [
    {
      sectionID: "113",
      sectionNumber: "202",
      sourceID: "bc-202-section-start",
      passageText: definitionsText.slice(0, 5_000)
    },
    {
      sectionID: "113",
      sectionNumber: "202",
      sourceID: "bc-202-definition-story",
      passageText: storyDefinition
    },
    {
      sectionID: "113",
      sectionNumber: "202",
      sourceID: "bc-202-definition-story-above-grade-plane",
      passageText: storyAboveGradePlaneDefinition
    },
    {
      sectionID: "847",
      sectionNumber: "504.4",
      sourceID: "bc-504.4-heading-only",
      passageText: "504.4 Allowable number of stories. See Table 504.4."
    },
    {
      sectionID: "847",
      sectionNumber: "504.4",
      sourceID: "bc-504.4-table-content",
      passageText: table5044
    },
    {
      sectionID: "2183",
      sectionNumber: "1006.3",
      sourceID: "bc-1006.3-occupied-roof-egress",
      passageText: "The means of egress system serving any story, or occupied roof designed for human occupancy or use..."
    }
  ];
  const requiredClaims = [
    {
      id: "story-definitions",
      label: "Definitions controlling whether the terrace creates another story above grade plane",
      sourceIDs: [
        "bc-202-definition-story",
        "bc-202-definition-story-above-grade-plane"
      ]
    },
    {
      id: "allowable-story-table",
      label: "Table 504.4 allowable-story content",
      sourceIDs: ["bc-504.4-table-content"]
    }
  ];

  const liveFailureShape = evaluateResearchRequiredClaimCoverage({
    requiredClaims,
    evidence,
    answer: {
      conclusion:
        "The definitions and Table 504.4 are missing, so the occupied roof cannot be classified from this evidence.",
      supportedPoints: [
        { heading: "Definitions absent", sourceIDs: ["bc-202-section-start"] },
        { heading: "Table absent", sourceIDs: ["bc-504.4-heading-only"] },
        { heading: "Occupied-roof egress", sourceIDs: ["bc-1006.3-occupied-roof-egress"] }
      ],
      citations: [
        { sectionID: "113", sourceIDs: ["bc-202-section-start"] },
        { sectionID: "847", sourceIDs: ["bc-504.4-heading-only"] },
        { sectionID: "2183", sourceIDs: ["bc-1006.3-occupied-roof-egress"] }
      ]
    }
  });
  assert.equal(liveFailureShape.pass, false);
  assert.deepEqual(
    liveFailureShape.missingClaimIDs,
    ["story-definitions", "allowable-story-table"],
    "Section-level citations without the target enacted content disguised the live roof-terrace omissions."
  );

  const completeAnswer = {
    conclusion:
      "An occupied roof does not become another story above grade plane solely because occupants use it; apply the enacted definitions and evaluate applicable Chapter 5 story limits separately.",
    supportedPoints: [
      {
        heading: "Defined story concepts",
        sourceIDs: [
          "bc-202-definition-story",
          "bc-202-definition-story-above-grade-plane"
        ]
      },
      { heading: "Allowable-story table", sourceIDs: ["bc-504.4-table-content"] },
      { heading: "Occupied-roof egress", sourceIDs: ["bc-1006.3-occupied-roof-egress"] }
    ],
    citations: [
      {
        sectionID: "113",
        sourceIDs: [
          "bc-202-definition-story",
          "bc-202-definition-story-above-grade-plane"
        ]
      },
      { sectionID: "847", sourceIDs: ["bc-504.4-table-content"] },
      { sectionID: "2183", sourceIDs: ["bc-1006.3-occupied-roof-egress"] }
    ]
  };
  const completeCoverage = evaluateResearchRequiredClaimCoverage({
    requiredClaims,
    evidence,
    answer: completeAnswer
  });
  assert.equal(completeCoverage.pass, true);
  assert(
    completeCoverage.nonRequiredEvidenceSourceIDs.includes("bc-1006.3-occupied-roof-egress"),
    "The content gate must not turn every retrieved supporting source into a required claim."
  );
  const citedText = completeAnswer.citations
    .flatMap((citation) => citation.sourceIDs)
    .map((sourceID) => evidence.find((source) => source.sourceID === sourceID)?.passageText || "")
    .join(" ");
  assert.match(citedText, /STORY\s*\.\s*That portion of a building/i);
  assert.match(citedText, /STORY ABOVE GRADE PLANE\s*\.\s*Any story/i);
  assert.match(citedText, /Table 504\.4[\s\S]*Allowable Number of Stories above Grade Plane/i);

  console.log(`Roof-terrace exact-content coverage contract passed for: ${question}`);
});
