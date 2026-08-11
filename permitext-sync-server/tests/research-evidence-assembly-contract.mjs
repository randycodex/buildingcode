import assert from "node:assert/strict";
import {
  assembleResearchEvidence,
  researchEvidenceAssemblyLimits,
  researchEvidenceAssemblyVersion,
  researchEvidenceRetrievalQuery
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
  }]
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
assert.match(assembled.sources[0].text, /unless an exception applies/);
assert.equal(assembled.sources[0].canonicalContextResolved, true);
assert.equal(assembled.sources[0].canonicalContextComplete, true);
assert.equal(assembled.sources[0].evidencePriority.claimCoverageRequired, true);

const discovered = assembled.sources.filter((source) => source.origin === "permitext_discovered");
assert.equal(discovered.length, 2, "Automatically discovered enacted sources must be bounded.");
assert.deepEqual(discovered.map((source) => source.sectionID), ["candidate-1", "candidate-2"]);
assert.match(discovered[0].text, /complete canonical section context/);
assert.equal(discovered[0].evidencePriority.claimCoverageRequired, true);
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

assert.equal(researchEvidenceAssemblyLimits.maximumCandidates, 12);
assert.equal(researchEvidenceAssemblyLimits.maximumDiscovered, 10);
assert.equal(researchEvidenceAssemblyLimits.maximumCrossReferences, 6);
assert.equal(researchEvidenceAssemblyLimits.maximumCharacters, 48_000);
assert.throws(
  () => researchEvidenceRetrievalQuery({ question: "" }),
  /requires a text question/
);

console.log("Permitext Research evidence assembly contract passed.");
