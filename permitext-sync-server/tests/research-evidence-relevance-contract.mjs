import assert from "node:assert/strict";
import { validateResearchInterpretation } from "../app.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import {
  assembleResearchEvidence,
  researchEvidenceRetrievalQuery
} from "../research-evidence-assembly.mjs";

const mainQuestion = "Smoke barriers vs. smoke partitions: The code calls for smoke separation. Does that mean a smoke barrier, smoke partition, or something else, and what rating follows?";
const quotedTitleProvision = 'Is this text related? SECTION BC 101: GENERAL 101.1 Title. This code shall be known and may be cited as the "New York City Building Code," "NYCBC" or "BC". All section numbers in this code shall be deemed to be preceded by the designation "BC".';
const relevanceFollowUp = "Please confirm: is BC 101.1 substantively related to my main smoke-separation question, and should it count as governing evidence for the barrier-versus-partition decision or rating?";
const previousMessages = [
  { role: "user", question: mainQuestion },
  { role: "assistant", content: "A smoke barrier and smoke partition are different assemblies." },
  { role: "user", question: quotedTitleProvision }
];

const query = researchEvidenceRetrievalQuery({
  question: relevanceFollowUp,
  previousMessages
});

assert.equal(query.previousTopicApplied, true);
assert.equal(query.relevanceComparison, true);
assert.match(query.retrievalQuery, /Previous topic: Smoke barriers vs\. smoke partitions/);
assert.match(query.retrievalQuery, /Immediate context: Is this text related\? SECTION BC 101/);

const sections = [
  ["bc-709-1", "BC", "709.1", "General", "Smoke barriers shall comply with this section."],
  ["bc-709-3", "BC", "709.3", "Fire-resistance rating", "A 1-hour fire-resistance rating is required for smoke barriers in accordance with Section 703."],
  ["bc-710-1", "BC", "710.1", "General", "Smoke partitions shall comply with this section."],
  ["bc-710-3", "BC", "710.3", "Fire-resistance rating", "Unless required elsewhere, smoke partitions are not required to have a fire-resistance rating."],
  ["bc-101-1", "BC", "101.1", "Title", "This code shall be known and may be cited as the New York City Building Code or BC."],
  ["bc-703", "BC", "703", "Fire-resistance ratings", "This section contains the referenced fire-resistance test rules."],
  ["bc-1816-2-1", "BC", "1816.2.1", "Peak ground acceleration", "This section is unrelated to smoke separation."],
  ["bc-q108-1", "BC", "Q108.1", "Smoke control system table", "Table Q108.1 applies to a separate smoke control system topic."],
  ["fgc-101-1", "FGC", "101.1", "Title", "This code shall be known as the New York City Fuel Gas Code."],
  ["mc-101-1", "MC", "101.1", "Title", "This code shall be known as the New York City Mechanical Code."],
  ["pc-101-1", "PC", "101.1", "Title", "This code shall be known as the New York City Plumbing Code."]
].map(([id, codePrefix, sectionNumber, title, text]) => ({
  id,
  webSectionID: id,
  codePrefix,
  chapterNumber: "1",
  sectionNumber,
  title,
  text
}));

const invertedIndex = new Map([
  ["title", new Set(["bc-101-1", "fgc-101-1", "mc-101-1", "pc-101-1"])],
  ["code", new Set(sections.map((section) => section.id))],
  ["smoke", new Set(["bc-709-1", "bc-709-3", "bc-710-1", "bc-710-3", "bc-q108-1"])]
]);
const bodyFor = (section) => ({
  blocks: [{ id: `${section.id}-block`, kind: "paragraph", plainText: section.text, html: `<p>${section.text}</p>` }]
});

const discovery = await discoverRelevantEvidence({
  question: query.retrievalQuery,
  retrievalContext: {
    currentQuestion: query.question,
    conversationTopic: query.conversationTopic,
    immediateContext: query.immediateContext,
    contextDependentFollowUp: query.contextDependentFollowUp,
    relevanceComparison: query.relevanceComparison
  },
  catalog: sections,
  invertedIndex,
  readSectionBody: bodyFor,
  limit: 12
});

const bc101 = discovery.candidates.find((candidate) =>
  candidate.codePrefix === "BC" && candidate.sectionNumber === "101.1"
);
assert(bc101, "The provision being compared must remain available as contextual evidence.");
assert.equal(bc101.signals.exactReference, true);
assert.equal(bc101.signals.contextualReference, true);
for (const sectionNumber of ["709.1", "709.3", "710.1", "710.3"]) {
  assert(
    discovery.candidates.some((candidate) =>
      candidate.codePrefix === "BC" && candidate.sectionNumber === sectionNumber &&
      candidate.signals.exactTopicRouteTarget
    ),
    `The governing smoke topic must retain BC ${sectionNumber}.`
  );
}

const byID = new Map(sections.map((section) => [section.id, section]));
const assembled = await assembleResearchEvidence({
  question: relevanceFollowUp,
  previousMessages,
  discover: async () => discovery,
  resolveSection: async (request) => {
    const section = byID.get(request.sectionID) || sections.find((candidate) =>
      candidate.codePrefix === request.codePrefix && candidate.sectionNumber === request.sectionNumber
    );
    return section ? {
      sectionID: section.id,
      codePrefix: section.codePrefix,
      sectionNumber: section.sectionNumber,
      title: section.title,
      canonicalText: section.text,
      crossReferences: section.sectionNumber === "709.3"
        ? [{ codePrefix: "BC", sectionNumber: "1816.2.1" }]
        : []
    } : null;
  }
});

const assembledReferences = assembled.sources.map((source) => `${source.codePrefix} ${source.sectionNumber}`);
for (const required of ["BC 709.1", "BC 709.3", "BC 710.1", "BC 710.3", "BC 101.1"]) {
  assert(assembledReferences.includes(required), `${required} must remain in the bounded comparison package.`);
}
for (const rejected of ["FGC 101.1", "MC 101.1", "PC 101.1"]) {
  assert(!assembledReferences.includes(rejected), `${rejected} is same-number noise and must be rejected.`);
}
assert(!assembledReferences.includes("BC Q108.1"), "A same-term table outside the routed smoke-separation hierarchy must be rejected.");
assert(assembledReferences.includes("BC 703"), "An enacted cross-reference written in a governing passage must remain available.");
assert(
  !assembledReferences.includes("BC 1816.2.1"),
  "A structured cross-reference that is not written in the selected passage must not enter a relevance comparison."
);
const contextual = assembled.sources.find((source) =>
  source.codePrefix === "BC" && source.sectionNumber === "101.1"
);
assert.equal(contextual.evidencePriority.evidenceRole, "contextual");
assert.equal(contextual.evidencePriority.claimCoverageRequired, false);
assert.equal(assembled.usage.nonMaterialCandidateCount, 6);

const governing = assembled.sources.find((source) =>
  source.codePrefix === "BC" && source.sectionNumber === "709.3"
);
const interpretation = {
  conclusion: "No. BC 101.1 is contextual only and does not establish the smoke-separation assembly or rating.",
  supportedPoints: [{
    heading: "Smoke-barrier rating",
    explanation: "The smoke-barrier provision supplies the material rating rule.",
    sectionID: governing.sectionID,
    sourceIDs: [governing.sourceID]
  }],
  explanation: "BC 101.1 supplies the citation convention, not the technical smoke-separation rule.",
  assumptions: [],
  missingFacts: ["Identify the provision that requires the smoke separation."],
  followUpQuestions: [],
  evidenceLimitations: ["The exact scoping provision requiring the separation is not supplied."],
  additionalEvidenceNeeded: [],
  supportingSourceUses: [],
  citations: [{
    sectionID: governing.sectionID,
    sourceIDs: [governing.sourceID],
    relevance: "Establishes the smoke-barrier rating."
  }, {
    sectionID: contextual.sectionID,
    sourceIDs: [contextual.sourceID],
    relevance: "Confirms that BC 101.1 is only the code-title and citation provision."
  }]
};
const validated = validateResearchInterpretation(interpretation, assembled.sources);
assert.equal(validated.citations.find((citation) => citation.sectionID === contextual.sectionID).evidenceRole, "contextual");
const contextualPoint = validateResearchInterpretation({
  ...interpretation,
  supportedPoints: [{
    heading: "Code title and citation convention only",
    explanation: "This title provision does not control the smoke assembly or its rating.",
    sectionID: contextual.sectionID,
    sourceIDs: [contextual.sourceID]
  }]
}, assembled.sources).supportedPoints[0];
assert.equal(
  contextualPoint.evidenceRole,
  "contextual",
  "A contextual comparison point must remain visibly non-governing."
);
console.log("Permitext Research follow-up evidence relevance contract passed.");
