import assert from "node:assert/strict";
import {
  assembleResearchEvidence,
  researchEvidenceAssemblyLimits,
  researchEvidenceAssemblyVersion,
  researchEvidenceRetrievalQuery,
  researchEvidenceStrategies,
  researchEvidenceStrategyForTurn
} from "../research-evidence-assembly.mjs";

const canonicalSections = new Map([
  ["pinned", {
    sectionID: "pinned",
    codePrefix: "BC",
    sectionNumber: "1019.3",
    title: "Occupancies other than Groups I-2 and I-3",
    canonicalText: "BC 1019.3 Occupancies other than Groups I-2 and I-3. Interior exit access stairways shall be enclosed unless an exception applies.",
    crossReferences: [{ sectionID: "cross-1", codePrefix: "BC", sectionNumber: "1006.2" }]
  }],
  ["candidate-1", {
    sectionID: "candidate-1",
    codePrefix: "BC",
    sectionNumber: "1019.3.1",
    title: "Two-story openings",
    canonicalText: "BC 1019.3.1 Two-story openings. This is the complete canonical section context, not merely the discovered passage. See Section 1006.3.",
    crossReferences: [{ sectionID: "cross-2", codePrefix: "BC", sectionNumber: "1006.3" }]
  }],
  ["candidate-2", {
    sectionID: "candidate-2",
    codePrefix: "BC",
    sectionNumber: "1019.3.2",
    title: "Other opening",
    canonicalText: "BC 1019.3.2 Other opening. Additional complete canonical enacted context."
  }],
  ["candidate-3", {
    sectionID: "candidate-3",
    codePrefix: "BC",
    sectionNumber: "1019.3.3",
    title: "Overflow candidate",
    canonicalText: "BC 1019.3.3 Overflow candidate. This candidate must be excluded by the discovered-source bound."
  }],
  ["prose-table", {
    sectionID: "prose-table",
    codePrefix: "BC",
    sectionNumber: "1006.3.2",
    title: "Single exits",
    canonicalText: "Item 7 permits one exit for a Group R-2 Type I or II building not exceeding six stories and 2,000 square feet per story. See Table 1006.3.2.",
    richSources: [{
      id: "table-1006.3.2",
      kind: "table",
      reference: "BC Table 1006.3.2",
      contentHash: "b".repeat(64),
      rowCount: 1,
      text: "Story Occupancy Maximum occupant load First R-2 10",
      grids: [{ rows: [{ cells: [{ text: "First" }, { text: "R-2" }, { text: "10" }] }] }]
    }]
  }],
  ["cross-1", {
    sectionID: "cross-1",
    codePrefix: "BC",
    sectionNumber: "1006.2",
    title: "Egress from spaces",
    canonicalText: "BC 1006.2 Egress from spaces. Canonical cross-reference one."
  }],
  ["cross-2", {
    sectionID: "cross-2",
    codePrefix: "BC",
    sectionNumber: "1006.3",
    title: "Egress from stories",
    canonicalText: "BC 1006.3 Egress from stories. Canonical cross-reference two."
  }],
  ["range-root", {
    sectionID: "range-root",
    codePrefix: "BC",
    sectionNumber: "1107.6",
    title: "Group R",
    canonicalText: "Accessible unit categories shall comply with Sections 1107.6.1 through 1107.6.3."
  }],
  ["range-one", {
    sectionID: "range-one",
    codePrefix: "BC",
    sectionNumber: "1107.6.1",
    title: "Group R-1",
    canonicalText: "Group R-1 enacted text."
  }],
  ["range-two", {
    sectionID: "range-two",
    codePrefix: "BC",
    sectionNumber: "1107.6.2",
    title: "Group R-2",
    canonicalText: "Group R-2 enacted text."
  }],
  ["range-three", {
    sectionID: "range-three",
    codePrefix: "BC",
    sectionNumber: "1107.6.3",
    title: "Group R-3",
    canonicalText: "Group R-3 enacted text."
  }],
  ["zr-range-root", {
    sectionID: "zr-range-root",
    codePrefix: "ZR",
    sectionNumber: "73-62",
    title: "Bulk modifications",
    canonicalText: "The special permit provisions are set forth in ZR Sections 73-621 through 73-624."
  }],
  ["deep-pinned", {
    sectionID: "deep-pinned",
    codePrefix: "BC",
    sectionNumber: "1107.2.2.7.2.2",
    title: "Forward approach",
    canonicalText: "A forward approach shall be provided at the water closet. See Table 1006.3.2.",
    crossReferences: [{
      sectionID: "prose-table",
      codePrefix: "BC",
      sectionNumber: "1006.3.2",
      referenceKind: "table"
    }]
  }],
  ["ancestor-clearance", {
    sectionID: "ancestor-clearance",
    codePrefix: "BC",
    sectionNumber: "1107.2.2.7.2",
    title: "Clearance",
    canonicalText: "Clearance shall be provided around the water closet."
  }],
  ["ancestor-water-closet", {
    sectionID: "ancestor-water-closet",
    codePrefix: "BC",
    sectionNumber: "1107.2.2.7",
    title: "Water closet",
    canonicalText: "At least one water closet shall comply with this section."
  }],
  ["ancestor-type-b-nyc", {
    sectionID: "ancestor-type-b-nyc",
    codePrefix: "BC",
    sectionNumber: "1107.2.2",
    title: "Type B+NYC unit toilet and bathing rooms",
    canonicalText: "Where toilet and bathing rooms are provided in a Type B+NYC dwelling unit or sleeping unit, the applicable fixtures shall comply with Sections 1107.2.2.1 through 1107.2.2.9."
  }],
  ...["73-621", "73-622", "73-623", "73-624"].map((sectionNumber) => [
    `zr-${sectionNumber}`,
    {
      sectionID: `zr-${sectionNumber}`,
      codePrefix: "ZR",
      sectionNumber,
      title: `Zoning provision ${sectionNumber}`,
      canonicalText: `ZR ${sectionNumber} enacted text.`
    }
  ])
]);

const resolverCalls = [];
async function resolveSection(request) {
  resolverCalls.push(request);
  const byID = canonicalSections.get(request.sectionID);
  if (byID) return byID;
  return Array.from(canonicalSections.values()).find((section) =>
    section.codePrefix === request.codePrefix && section.sectionNumber === request.sectionNumber
  ) || null;
}

let discoveryRequest;
async function discover(request) {
  discoveryRequest = request;
  return {
    retrievalVersion: "test-retrieval-v1",
    searchedSectionCount: 250,
    candidates: [{
      sectionID: "candidate-1",
      codePrefix: "BC",
      sectionNumber: "1019.3.1",
      title: "Two-story openings",
      selectedText: "A narrow discovered passage.",
      whyRelevant: "The question concerns an interior stair.",
      signals: { exactTopicRouteTarget: true }
    }, {
      sectionID: "pinned",
      codePrefix: "BC",
      sectionNumber: "1019.3",
      selectedText: "Duplicate of pinned section."
    }, {
      sectionID: "candidate-2",
      codePrefix: "BC",
      sectionNumber: "1019.3.2",
      selectedText: "Another narrow passage."
    }, {
      sectionID: "candidate-3",
      codePrefix: "BC",
      sectionNumber: "1019.3.3",
      selectedText: "Overflow passage."
    }]
  };
}

const assembled = await assembleResearchEvidence({
  question: "Explain that in more detail.",
  previousMessages: [{ role: "user", content: "Can the open stair use BC 1019.3 Exception 2?" }],
  pinnedEvidence: [{
    id: "user-pinned-source",
    sectionID: "pinned",
    codePrefix: "BC",
    sectionNumber: "1019.3",
    selectedText: "Interior exit access stairways shall be enclosed."
  }],
  discover,
  resolveSection,
  limits: {
    maximumCandidates: 3,
    maximumDiscovered: 2,
    maximumCrossReferences: 1,
    maximumCharacters: 2_000,
    maximumCharactersPerSource: 800,
    ignoredUnsafeOverride: 1_000_000
  }
});

assert.equal(assembled.schemaVersion, 1);
assert.equal(assembled.assemblyVersion, researchEvidenceAssemblyVersion);
assert.equal(assembled.sourceMode, "text_only");
assert.equal(assembled.sourceScope, "authorized_enacted_text");
assert.equal(assembled.previousTopicApplied, true);
assert.match(assembled.retrievalQuery, /Can the open stair use BC 1019\.3 Exception 2\?/);
assert.match(assembled.retrievalQuery, /Follow-up: Explain that in more detail\./);
assert.equal(discoveryRequest.question, assembled.retrievalQuery);
assert.equal(discoveryRequest.limit, 3, "Discovery must receive the applied candidate limit.");
assert.equal(assembled.limits.maximumCandidates, 3);
assert.equal(assembled.limits.maximumDiscovered, 2);
assert.equal(assembled.limits.maximumCrossReferences, 1);
assert.equal(assembled.limits.maximumCharacters, 2_000);
assert.equal(assembled.discovery.retrievalVersion, "test-retrieval-v1");
assert.equal(assembled.discovery.searchedSectionCount, 250);

assert.equal(assembled.sources[0].sourceID, "user-pinned-source");
assert.equal(assembled.sources[0].origin, "user_pinned");
assert.equal(assembled.sources[0].text, "Interior exit access stairways shall be enclosed.");
assert.match(assembled.sources[0].canonicalContextText, /unless an exception applies/);
assert.equal(assembled.sources[0].canonicalContextResolved, true);
assert.equal(assembled.sources[0].canonicalContextComplete, true);
assert.equal(assembled.sources[0].pinnedSelectionExact, true);
assert.equal(assembled.sources[0].evidencePriority.claimCoverageRequired, true);

const discovered = assembled.sources.filter((source) => source.origin === "permitext_discovered");
assert.equal(discovered.length, 2, "Automatically discovered enacted sources must be bounded.");
assert.deepEqual(discovered.map((source) => source.sectionID), ["candidate-1", "candidate-2"]);
assert.match(discovered[0].text, /complete canonical section context/);
assert.equal(
  discovered[0].evidencePriority.claimCoverageRequired,
  false,
  "Discovery should supplement an aligned user-pinned passage without becoming mandatory answer coverage."
);
assert.doesNotMatch(discovered[0].text, /narrow discovered passage/);
assert(!assembled.sources.some((source) => source.sectionID === "candidate-3"));
assert.equal(
  assembled.sources.filter((source) => source.sectionID === "pinned").length,
  1,
  "Discovery must not duplicate a user-pinned section."
);

const crossReferences = assembled.sources.filter((source) => source.origin === "permitext_cross_reference");
assert.equal(crossReferences.length, 1, "Direct cross-reference expansion must be bounded.");
assert.equal(crossReferences[0].sectionID, "cross-1");
assert.match(crossReferences[0].text, /Canonical cross-reference one/);
assert.equal(crossReferences[0].evidencePriority.claimCoverageRequired, false);
assert.equal(assembled.usage.crossReferenceCount, 1);
assert(
  assembled.limitations.some((item) => item.kind === "cross-reference-limit"),
  "A bounded package must disclose omitted direct cross-references."
);
assert(
  assembled.usage.characterCount <= assembled.limits.maximumCharacters,
  "The per-answer evidence package must stay within the aggregate character limit."
);
assert(
  assembled.sources.every((source) => !Object.hasOwn(source, "visualSources")),
  "The first Research evidence assembly phase is text-only."
);
assert(
  resolverCalls.some((call) => call.origin === "user_pinned") &&
  resolverCalls.some((call) => call.origin === "permitext_discovered") &&
  resolverCalls.some((call) => call.origin === "permitext_cross_reference"),
  "Every source class must use the canonical section resolver."
);

const pinnedFallback = await assembleResearchEvidence({
  question: "Does this comply?",
  previousTopic: "BC 1019.3 open communicating stair",
  pinnedEvidence: [{
    id: "pin-a",
    sectionID: "missing-pin-a",
    selectedText: "Pinned enacted passage A remains available."
  }, {
    id: "pin-b",
    sectionID: "missing-pin-b",
    selectedText: "Pinned enacted passage B remains available."
  }],
  discover: async () => ({ candidates: [] }),
  resolveSection: async () => null,
  limits: { maximumCharacters: 50, maximumCharactersPerSource: 50 }
});

assert.deepEqual(
  pinnedFallback.sources.map((source) => source.sourceID),
  ["pin-a", "pin-b"],
  "Pinned evidence must remain represented even when canonical resolution fails."
);
assert(pinnedFallback.sources.every((source) => source.origin === "user_pinned"));
assert(pinnedFallback.sources.every((source) => source.text.length > 0));
assert(pinnedFallback.usage.characterCount <= 50);
assert.equal(pinnedFallback.usage.resolverFailureCount, 2);

const structuredPinned = await assembleResearchEvidence({
  question: "Which table row controls?",
  pinnedEvidence: [{
    id: "structured-pin",
    sectionID: "pinned",
    codePrefix: "BC",
    sectionNumber: "1019.3",
    text: "Exact structured table text.",
    richSourceID: "table-source-1",
    richSourceKind: "table",
    richSourceReference: "BC Table 1019.3",
    richSourceContentHash: "a".repeat(64),
    richSourceRowCount: 1,
    richSourceGrids: [{ rows: [{ cells: [{ text: "Exact structured table text.", rowSpan: 1, columnSpan: 1 }] }] }]
  }],
  discover: async () => ({ candidates: [] }),
  resolveSection,
  limits: { maximumCharacters: 2_000, maximumCharactersPerSource: 1_000 }
});
assert.equal(structuredPinned.sources[0].text, "Exact structured table text.");
assert.equal(structuredPinned.sources[0].richSourceID, "table-source-1");
assert.equal(structuredPinned.sources[0].richSourceGrids[0].rows[0].cells[0].rowSpan, 1);

const pinnedProseWithinTableSection = await assembleResearchEvidence({
  question: "Can this six-story R-2 building use one exit?",
  pinnedEvidence: [{
    id: "pinned-item-seven",
    sectionID: "prose-table",
    codePrefix: "BC",
    sectionNumber: "1006.3.2",
    selectedText: "Item 7 permits one exit for a Group R-2 Type I or II building not exceeding six stories and 2,000 square feet per story."
  }],
  discover: async () => ({ candidates: [] }),
  resolveSection,
  limits: { maximumCharacters: 2_000, maximumCharactersPerSource: 1_000 }
});
assert.equal(
  pinnedProseWithinTableSection.sources[0].text,
  "Item 7 permits one exit for a Group R-2 Type I or II building not exceeding six stories and 2,000 square feet per story.",
  "A pinned prose item must not be replaced by a structured table from the same canonical section."
);
assert.match(pinnedProseWithinTableSection.sources[0].canonicalContextText, /Item 7 permits one exit/);
assert.doesNotMatch(pinnedProseWithinTableSection.sources[0].canonicalContextText, /Story Occupancy/);
assert.equal(pinnedProseWithinTableSection.sources[0].pinnedSelectionExact, true);
assert.equal(pinnedProseWithinTableSection.sources[0].richSourceID, undefined);

const structuredProse = await assembleResearchEvidence({
  question: "Can this six-story R-2 building use one exit?",
  discover: async () => ({
    candidates: [{
      sectionID: "prose-table",
      codePrefix: "BC",
      sectionNumber: "1006.3.2",
      richSourceIDs: [],
      signals: { exactTopicRouteTarget: true, referencesTable: false, includesStructuredTable: false }
    }]
  }),
  resolveSection,
  limits: { maximumDiscovered: 1, maximumCharacters: 2_000, maximumCharactersPerSource: 1_000 }
});
assert.match(structuredProse.sources[0].text, /Item 7 permits one exit/);
assert.equal(structuredProse.sources[0].richSourceID, undefined);

const structuredTableOnly = await assembleResearchEvidence({
  question: "What does Table 1006.3.2 say?",
  discover: async () => ({
    candidates: [{
      sectionID: "prose-table",
      codePrefix: "BC",
      sectionNumber: "1006.3.2",
      richSourceIDs: ["table-1006.3.2"],
      signals: { exactTopicRouteTarget: true, referencesTable: true, includesStructuredTable: true }
    }]
  }),
  resolveSection,
  limits: { maximumDiscovered: 1, maximumCharacters: 2_000, maximumCharactersPerSource: 1_000 }
});
assert.equal(structuredTableOnly.sources[0].text, "Story Occupancy Maximum occupant load First R-2 10");
assert.equal(structuredTableOnly.sources[0].richSourceID, "table-1006.3.2");

const rangedCrossReferences = await assembleResearchEvidence({
  question: "Which residential accessibility category applies?",
  discover: async () => ({ candidates: [{ sectionID: "range-root", codePrefix: "BC", sectionNumber: "1107.6" }] }),
  resolveSection,
  limits: { maximumDiscovered: 1, maximumCrossReferences: 3, maximumCharacters: 2_000 }
});
assert.deepEqual(
  rangedCrossReferences.sources
    .filter((source) => source.origin === "permitext_cross_reference")
    .map((source) => source.sectionNumber),
  ["1107.6.1", "1107.6.2", "1107.6.3"],
  "Same-parent enacted section ranges must expand into each direct cross-reference."
);

const zoningRangedCrossReferences = await assembleResearchEvidence({
  question: "Which provisions govern this zoning special permit?",
  discover: async () => ({
    candidates: [{ sectionID: "zr-range-root", codePrefix: "ZR", sectionNumber: "73-62" }]
  }),
  resolveSection,
  limits: { maximumDiscovered: 1, maximumCrossReferences: 4, maximumCharacters: 3_000 }
});
assert.deepEqual(
  zoningRangedCrossReferences.sources
    .filter((source) => source.origin === "permitext_cross_reference")
    .map((source) => source.sectionNumber),
  ["73-621", "73-622", "73-623", "73-624"],
  "Zoning Resolution hyphen ranges must expand into every bounded interior provision."
);

const independentQuery = researchEvidenceRetrievalQuery({
  question: "What occupant load factor applies to an office?",
  previousTopic: "Unrelated stair discussion"
});
assert.equal(independentQuery.previousTopicApplied, false);
assert.equal(independentQuery.retrievalQuery, independentQuery.question);

const longPreviousTopicFollowUp = researchEvidenceRetrievalQuery({
  question: "Explain that.",
  previousTopic: `BC 1019.3 ${"prior discussion ".repeat(150)}`
});
assert.equal(longPreviousTopicFollowUp.previousTopicApplied, true);
assert.match(longPreviousTopicFollowUp.retrievalQuery, /^Follow-up: Explain that\./);
assert.match(longPreviousTopicFollowUp.retrievalQuery, /Previous topic: BC 1019\.3/);
assert(longPreviousTopicFollowUp.retrievalQuery.length <= 2_000);

const maximumLengthQuestion = researchEvidenceRetrievalQuery({
  question: `Why ${"x".repeat(1_995)}`,
  previousTopic: "This older topic must not displace the current question.",
  projectFacts: ["A fact that cannot fit must not be reported as applied."]
});
assert.equal(maximumLengthQuestion.retrievalQuery, maximumLengthQuestion.question);
assert.equal(maximumLengthQuestion.previousTopicApplied, false);
assert.equal(maximumLengthQuestion.projectFactsApplied, false);

const zoningFactAfterBuildingFacts = researchEvidenceRetrievalQuery({
  question: "What FAR applies in this zoning district?",
  projectFacts: [
    ...Array.from({ length: 35 }, (_, index) =>
      `Building / Code Fact — Building detail ${index + 1}: ${"unrelated ".repeat(8)}`
    ),
    "Zoning Fact — Zoning District(s): R7A (NYC Planning sourced data; verify current official records)",
    "Zoning Fact — Zoning Map: 3b (NYC Planning sourced data; verify current official records)"
  ]
});
assert.equal(zoningFactAfterBuildingFacts.projectFactsApplied, true);
assert.match(zoningFactAfterBuildingFacts.retrievalQuery, /Zoning District\(s\): R7A/);
assert.match(zoningFactAfterBuildingFacts.retrievalQuery, /Zoning Map: 3b/);
assert(
  zoningFactAfterBuildingFacts.retrievalQuery.indexOf("Zoning District(s): R7A") <
    zoningFactAfterBuildingFacts.retrievalQuery.indexOf("Building detail 1"),
  "Question-relevant Zoning facts must be inserted before unrelated building facts can consume the retrieval limit."
);

assert.equal(researchEvidenceAssemblyLimits.maximumCandidates, 12);
assert.equal(researchEvidenceAssemblyLimits.maximumDiscovered, 10);
assert.equal(researchEvidenceAssemblyLimits.maximumCrossReferences, 6);
assert.equal(researchEvidenceAssemblyLimits.maximumCharacters, 48_000);

const twoReaderPins = [{ codePrefix: "PC", sectionNumber: "101.1" }, {
  codePrefix: "PC",
  sectionNumber: "101.2"
}];
for (const originSurface of ["reader", "ios-reader"]) {
  assert.deepEqual(
    researchEvidenceStrategyForTurn({
      question: "Explain this passage.",
      pinnedEvidence: [twoReaderPins[0]],
      originSurface
    }),
    {
      mode: researchEvidenceStrategies.pinnedFirst,
      reason: "reader_question_bounded_to_selected_evidence"
    },
    `${originSurface} did not keep a direct selected-passage explanation anchored to its enacted text.`
  );
}
assert.deepEqual(
  researchEvidenceStrategyForTurn({
    question: "Using both selected passages, what does PC 101.1 establish and what is within PC 101.2's scope?",
    pinnedEvidence: twoReaderPins,
    originSurface: "reader"
  }),
  {
    mode: researchEvidenceStrategies.pinnedFirst,
    reason: "reader_question_bounded_to_selected_evidence"
  },
  "A Reader question explicitly bounded to its selected passages should begin with those passages."
);
for (const question of [
  "Do the selected passages establish compliance?",
  "Which exception applies beyond these passages?",
  "Using these passages and PC 202, what definition controls?"
]) {
  assert.equal(
    researchEvidenceStrategyForTurn({
      question,
      pinnedEvidence: twoReaderPins,
      originSurface: "reader"
    }).mode,
    researchEvidenceStrategies.broad,
    `Broader legal question did not expand retrieval: ${question}`
  );
}
assert.equal(
  researchEvidenceStrategyForTurn({
    question: "Using both selected passages, summarize them.",
    pinnedEvidence: twoReaderPins,
    originSurface: "evidenceDiscovery"
  }).mode,
  researchEvidenceStrategies.broad,
  "Only explicitly Reader-started Research should use the Reader adaptive path."
);
assert.deepEqual(
  researchEvidenceStrategyForTurn({
    question: "Based only on the selected Building Code passages, what can be concluded?",
    pinnedEvidence: twoReaderPins,
    originSurface: "evidenceDiscovery"
  }),
  {
    mode: researchEvidenceStrategies.pinnedFirst,
    reason: "question_explicitly_bounded_to_selected_evidence"
  },
  "An explicit selected-evidence boundary must be honored from every Research surface."
);

let adaptiveDiscoveryCalls = 0;
const adaptivePinnedOnly = await assembleResearchEvidence({
  question: "Using both selected passages, keep PC 101.1 and PC 101.2 distinct.",
  pinnedEvidence: [{
    id: "pin-reader-1",
    sectionID: "pinned",
    codePrefix: "BC",
    sectionNumber: "1019.3",
    selectedText: "Interior exit access stairways shall be enclosed."
  }],
  strategy: {
    mode: researchEvidenceStrategies.pinnedFirst,
    reason: "reader_question_bounded_to_selected_evidence"
  },
  discover: async () => {
    adaptiveDiscoveryCalls += 1;
    return { candidates: [{ sectionID: "candidate-1" }] };
  },
  resolveSection,
  limits: { maximumCrossReferences: 1, maximumCharacters: 2_000 }
});
assert.equal(adaptiveDiscoveryCalls, 0, "Pinned-first assembly still performed broad corpus discovery.");
assert.equal(adaptivePinnedOnly.strategy.mode, researchEvidenceStrategies.pinnedFirst);
assert.equal(adaptivePinnedOnly.usage.discoveredCount, 0);
assert.equal(adaptivePinnedOnly.discovery.searchedSectionCount, 0);
assert(adaptivePinnedOnly.sources.some((source) => source.origin === "user_pinned"));
assert(
  adaptivePinnedOnly.sources.every((source) => source.origin !== "permitext_discovered"),
  "Pinned-first assembly unexpectedly included broad discovered evidence."
);

let strictBoundaryDiscoveryCalls = 0;
const strictPinnedOnly = await assembleResearchEvidence({
  question: "Based only on the selected Building Code passages, what is established?",
  pinnedEvidence: [{
    id: "pin-strict-1",
    sectionID: "pinned",
    codePrefix: "BC",
    sectionNumber: "1019.3",
    selectedText: "Interior exit access stairways shall be enclosed."
  }],
  strategy: {
    mode: researchEvidenceStrategies.pinnedFirst,
    reason: "question_explicitly_bounded_to_selected_evidence"
  },
  discover: async () => {
    strictBoundaryDiscoveryCalls += 1;
    return { candidates: [{ sectionID: "candidate-1" }] };
  },
  resolveSection,
  limits: { maximumCrossReferences: 3, maximumCharacters: 2_000 }
});
assert.equal(strictBoundaryDiscoveryCalls, 0);
assert.equal(strictPinnedOnly.usage.discoveredCount, 0);
assert.equal(strictPinnedOnly.usage.crossReferenceCount, 0);
assert.deepEqual(
  strictPinnedOnly.sources.map((source) => source.origin),
  ["user_pinned"],
  "A strict selected-evidence question must not silently add discovery or cross-references."
);

const pinnedAncestorContext = await assembleResearchEvidence({
  question: "What does the selected forward-approach rule require for this project?",
  pinnedEvidence: [{
    sectionID: "deep-pinned",
    codePrefix: "BC",
    sectionNumber: "1107.2.2.7.2.2"
  }],
  strategy: {
    mode: researchEvidenceStrategies.pinnedFirst,
    reason: "reader_question_bounded_to_selected_evidence"
  },
  discover: async () => ({ candidates: [] }),
  resolveSection,
  limits: { maximumCrossReferences: 3, maximumCharacters: 4_000 }
});
const ancestorContextSources = pinnedAncestorContext.sources.filter((source) =>
  source.origin === "permitext_cross_reference"
);
assert.deepEqual(
  ancestorContextSources.map((source) => source.sectionNumber),
  ["1107.2.2.7.2", "1107.2.2.7", "1107.2.2"],
  "Deeply nested pinned evidence must include its nearest governing ancestor scopes."
);
assert.match(ancestorContextSources[2].title, /Type B\+NYC/);
assert.match(ancestorContextSources[2].relationship, /Governing ancestor scope/);
assert.equal(ancestorContextSources[2].evidencePriority.claimCoverageRequired, false);
assert.equal(pinnedAncestorContext.usage.crossReferenceCount, 3);

canonicalSections.set("passage-only", {
  sectionID: "passage-only",
  codePrefix: "BC",
  sectionNumber: "1101.3.1",
  title: "Changes of use or occupancy",
  canonicalText: "Item 1 applies to an entire building. Item 2 applies throughout the changed space, including its immediate entrances. Item 2.2 separately addresses rooftops.",
  crossReferences: [{ sectionID: "cross-1", codePrefix: "BC", sectionNumber: "1006.2" }]
});
canonicalSections.set("outside-selected-bc", {
  sectionID: "outside-selected-bc",
  codePrefix: "AC",
  sectionNumber: "28-118.3",
  title: "Certificate of occupancy exception",
  canonicalText: "This Administrative Code provision was not among the selected Building Code passages."
});
const passageBoundedDiscovery = await assembleResearchEvidence({
  question: "Based only on the selected Building Code passage, what accessibility consequence applies throughout the space?",
  discover: async () => ({
    retrievalVersion: "passage-only-test-v1",
    searchedSectionCount: 1,
    candidates: [{
      sectionID: "passage-only",
      codePrefix: "BC",
      sectionNumber: "1101.3.1",
      title: "Changes of use or occupancy",
      selectedText: "Item 2 applies throughout the changed space, including its immediate entrances.",
      whyRelevant: "The question is expressly bounded to this routed passage.",
      signals: { exactTopicRouteTarget: true, useSelectedPassageOnly: true }
    }, {
      sectionID: "outside-selected-bc",
      codePrefix: "AC",
      sectionNumber: "28-118.3",
      title: "Certificate of occupancy exception",
      selectedText: "This Administrative Code provision is outside the selected Building Code passages.",
      whyRelevant: "Lexically related but outside the explicit passage boundary.",
      signals: { exactTopicRouteTarget: false }
    }]
  }),
  resolveSection,
  limits: { maximumDiscovered: 1, maximumCrossReferences: 2, maximumCharacters: 2_000 }
});
const passageBoundedSource = passageBoundedDiscovery.sources.find((source) =>
  source.sectionID === "passage-only"
);
assert.equal(
  passageBoundedSource.text,
  "Item 2 applies throughout the changed space, including its immediate entrances."
);
assert.equal(passageBoundedSource.discoveryPassageOnly, true);
assert.equal(passageBoundedSource.canonicalContextComplete, false);
assert.equal(
  passageBoundedDiscovery.sources.some((source) => source.sectionID === "outside-selected-bc"),
  false,
  "An explicit selected-Building-Code passage boundary must exclude lexically related Administrative Code text."
);
assert.equal(
  passageBoundedDiscovery.sources.some((source) => source.origin === "permitext_cross_reference"),
  false,
  "A passage-bounded route must not expand cross-references from omitted canonical section text."
);
assert.throws(
  () => researchEvidenceRetrievalQuery({ question: "" }),
  /requires a text question/
);

console.log("Permitext Research evidence assembly contract passed.");
