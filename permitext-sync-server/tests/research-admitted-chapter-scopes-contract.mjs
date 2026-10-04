import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";
import { buildResearchPassageIndex } from "../research-passage-index.mjs";
import { nominateResearchChapterScopeCandidates, researchChapterScopeContextPlan } from "../research-chapter-scope-context.mjs";
import { assembleResearchEvidence, researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error("Network is forbidden in admitted chapter-scope contracts."); };
const hash = value => createHash("sha256").update(value).digest("hex");
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const current = registry.find(value => value.id === "nyc-2022-construction-codes");
const authority = { corpusID: current.id, codeVersion: current.codeVersion, codeEdition: current.codeEdition,
  jurisdiction: current.jurisdiction };
const make = (id, codePrefix, chapterNumber, sectionNumber, title, text) => ({ ...authority, id, sectionID: id,
  codePrefix, chapterNumber, sectionNumber, title, text, canonicalText: text,
  body: { blocks: [{ id: `${id}-body`, plainText: text }] } });
const groups = Array.from({ length: 7 }, (_, index) => {
  const prefix = ["BC", "PC", "MC"][index % 3];
  const chapter = String(7 + index);
  return {
    rule: make(`rule-${index}`, prefix, chapter, `${chapter}80.4`, "Equipment opening rule.",
      "The equipment opening retains its complete usable-area condition. All stated installation qualifications remain operative."),
    scope: make(`scope-${index}`, prefix, chapter, `${chapter}80.1`, "Scope.",
      "The provisions of this chapter shall govern the named equipment. Exception: The listed separate equipment class follows its own complete conditions.")
  };
});
const catalog = groups.flatMap(group => [group.rule, group.scope]);
const index = await buildResearchPassageIndex(catalog, async section => section.body);
const signals = [{}, {}, {}, {}, { currentQuestionForeground: { rank: 1, source: "literal_current_question" } },
  { currentQuestionForeground: { rank: 2, source: "positive_equipment_subject" } }, { exactReference: true }];
const candidates = groups.map((group, rank) => ({ ...group.rule, rank: rank + 1, signals: signals[rank] }));
const anchors = candidates.map(value => ({ ...value, sourceID: value.id, eligiblePrimary: true, origin: "permitext_discovered" }));
const nominations = nominateResearchChapterScopeCandidates(candidates, catalog, index);
const plan = options => researchChapterScopeContextPlan({ anchors, canonicalScopeRecords: nominations, ...options });
assert.equal(plan().references.length, 7, "Every qualified admitted chapter reaches the existing assembly budget, without a second chapter quota.");
assert.deepEqual(plan().references.slice(0, 3).map(value => value.sectionID), ["scope-6", "scope-5", "scope-4"],
  "Direct and strong current-equipment anchors lead over ordinary incidental chapters.");
for (const signal of [{}, { rank: 1 }, { source: "positive_equipment_subject" }, { rank: 0, source: "positive_equipment_subject" },
  { rank: 6, source: "positive_equipment_subject" }, { rank: "1", source: "positive_equipment_subject" },
  { rank: 1, source: "old_assistant_topic" }, { rank: NaN, source: "literal_current_question" }, "truthy"] ) {
  const value = plan({ anchors: [{ ...anchors[0], signals: { currentQuestionForeground: signal } }, anchors[4]] });
  assert.equal(value.references[0].sectionID, "scope-4");
  assert.equal(value.references.find(reference => reference.sectionID === "scope-0").scopeAnchorPriority, 1,
    "Malformed/truthy objects cannot receive current-question priority.");
}
const pinnedPlan = plan({ anchors: [{ ...anchors[0], origin: "user_pinned" }, anchors[5], anchors[6]], explicitlyAuthorizedBroadening: true });
assert.equal(pinnedPlan.references[0].sectionID, "scope-0", "An explicitly broadened pinned anchor keeps its priority.");
for (const options of [{ strictBoundary: true }, { strategy: { mode: "pinned_first" }, pinnedEvidence: [anchors[0]] },
  { anchors: anchors.map(anchor => ({ ...anchor, codeEdition: "2014" })) },
  { anchors: anchors.map(anchor => ({ ...anchor, corpusID: "foreign" })) },
  { anchors: anchors.map(anchor => ({ ...anchor, jurisdiction: "Another City" })) },
  { anchors: anchors.map(anchor => ({ ...anchor, inheritedAuthorityReference: true, activeTopic: false })) },
  { anchors: anchors.map(anchor => ({ ...anchor, referenceOnly: true })) },
  { anchors: anchors.map(anchor => ({ ...anchor, targetedDefinition: true })) }]) assert.equal(plan(options).references.length, 0);
const question = "Explain the usable-area condition for these equipment openings, keeping their applicable scopes separate.";
let scopeReads = 0;
const allScopeReferences = groups.map(group => ({ ...group.scope, text: undefined, canonicalText: undefined, body: undefined }));
const resolver = async request => {
  const source = catalog.find(value => value.sectionID === request.sectionID);
  if (source?.id.startsWith("scope-")) scopeReads++;
  return source ? { ...source, crossReferences: source.id.startsWith("rule-") ? allScopeReferences : [] } : null;
};
const discover = async () => ({ candidates, chapterScopeCandidates: nominations });
const packet = await assembleResearchEvidence({ question, discover, resolveSection: resolver });
assert.equal(packet.usage.crossReferenceCount, 6);
assert.equal(packet.usage.chapterScopeContextCount, 6);
assert.equal(scopeReads, 6, "Scope nominations do not create reads outside the existing structural slots.");
assert(packet.sources.some(source => source.sectionID === "scope-6"));
assert(packet.sources.some(source => source.sectionID === "scope-5"));
const omitted = packet.limitations.filter(value => value.kind === "chapter-scope-context-slot-limit");
assert.equal(omitted.length, 1);
assert(omitted[0].anchorSourceIDs.length === 1);
const anchorWithGap = packet.sources.find(source => omitted[0].anchorSourceIDs.includes(source.sourceID));
assert(anchorWithGap.relationship.includes("chapter applicability"));
assert(anchorWithGap.chapterScopeContextGaps.some(value => value.reference === omitted[0].reference));
assert(!anchorWithGap.relationship.startsWith("undefined"));
for (const source of packet.sources.filter(source => source.chapterScopeContext)) {
  const canonical = catalog.find(value => value.sectionID === source.sectionID);
  assert.equal(source.text, canonical.text);
  assert(source.canonicalContextComplete && !source.truncated);
}
assert(packet.usage.characterCount <= 48000 && packet.sources.every(source => source.text.length <= 12000));
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const requests = evidence => [buildAnswerRequest(question, evidence, "offline-admitted-scope"),
  buildVerifierRequest(question, evidence, { answerText: "Synthetic scope coverage fixture." }, "offline-admitted-scope")];
for (const request of requests(packet.sources)) {
  assert(request.input.includes(anchorWithGap.relationship), "Both model request paths see the specific omitted qualification boundary.");
  assert(request.input.includes("Treat chapter applicability as unresolved"));
}
// Complete already-supplied scope consumes one primary read and no new
// structural read/slot; its delivered-count metadata matches the actual text.
let reuseReads = 0;
const reused = await assembleResearchEvidence({ question,
  discover: async () => ({ candidates: [candidates[5], groups[5].scope], chapterScopeCandidates: nominations }),
  resolveSection: async request => {
    if (request.sectionID === groups[5].scope.id) reuseReads++;
    return catalog.find(value => value.id === request.sectionID) || null;
  }
});
assert.equal(reuseReads, 1); assert.equal(reused.usage.crossReferenceCount, 0);
assert.equal(reused.usage.chapterScopeContextCount, 1);
assert.equal(reused.sources.filter(source => source.chapterScopeContext).length, 1);
const limited = await assembleResearchEvidence({ question,
  discover: async () => ({ candidates: [candidates[5]], chapterScopeCandidates: nominations }),
  resolveSection: async request => catalog.find(value => value.id === request.sectionID) || null,
  limits: { maximumCharacters: groups[5].rule.text.length + 40, maximumCharactersPerSource: 1000 }
});
assert(limited.usage.characterCount <= limited.limits.maximumCharacters);
assert(!limited.sources.some(source => source.sectionID === groups[5].scope.id));
assert(limited.limitations.some(value => value.kind === "chapter-scope-context-budget"));
for (const request of requests(limited.sources)) {
  assert(request.input.includes("Treat chapter applicability as unresolved"));
  assert(!request.input.includes(groups[5].scope.text), "Missing whole qualifications are never injected as cached legal text.");
}
const exactPin = { ...groups[5].rule, selectedText: "The equipment opening retains its complete usable-area condition." };
const pinned = await assembleResearchEvidence({ question: "Using only the selected passage, explain its condition.",
  pinnedEvidence: [exactPin], strategy: { mode: "pinned_first", reason: "question_explicitly_bounded_to_selected_evidence" }, discover,
  resolveSection: async request => catalog.find(value => value.id === request.sectionID) || null });
assert.equal(pinned.sources[0].text, exactPin.selectedText);
assert(!pinned.sources.some(source => source.chapterScopeContext || source.chapterScopeContextGaps));

let realProof = null;
if (process.argv.includes("--real-corpus")) {
  process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1"; process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL = "1";
  process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
  const { researchCorpusResources, researchBodyForCatalogSection, researchAssemblyCrossReferences } = await import("../app.mjs");
  const selected = registry.filter(value => ["nyc-2022-construction-codes", "nyc-2022-fire-code", "nyc-zoning-resolution"].includes(value.id));
  const resources = await researchCorpusResources({ selected });
  const ordinaryQuestion = "For a hypothetical new NYC building using the 2022 codes, we are bringing outdoor air into a gas equipment room through metal louvers. The manufacturer gives no open-area rating. What fraction of the opening can we count as usable airflow area?";
  const find = (prefix, number) => resources.catalog.find(value => value.codePrefix === prefix && value.sectionNumber === number);
  const mockNumbers = ["403.3.1.1", "403.3.1.3", "401.5", "403.3", "403.3.1.1.1.1", "403.3.1.1.1", "403.2.1", "403.1", "401.1", "403.2", "403.3.1.2"];
  const mockHits = mockNumbers.map(number => find("MC", number)).map(section => resources.passageIndex.passages.find(p => p.sectionID === String(section.id)));
  const query = researchEvidenceRetrievalQuery({ question: ordinaryQuestion });
  const discovery = await discoverRelevantEvidence({ question: ordinaryQuestion, ...resources, retrievalContext: { ...query, currentQuestion: ordinaryQuestion },
    readSectionBody: researchBodyForCatalogSection, limit: 12, semanticSearch: { search: async () => ({
      hits: mockHits.map((passage, rank) => ({ ...passage, score: 1 - rank / 100, passages: [passage] })),
      metadata: { enabled: true, mockProvider: true }
    }) } });
  const canonicalResolver = async request => {
    const section = resources.catalog.find(value => String(value.id) === String(request.sectionID) || (!request.sectionID &&
      value.codePrefix === request.codePrefix && value.sectionNumber === request.sectionNumber));
    if (!section) return null;
    const body = await researchBodyForCatalogSection(section);
    const text = [section.sectionNumber, section.title, ...body.blocks.filter(block => block.researchClaimEligible !== false).map(block => block.plainText || "")]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const value = { ...section, sectionID: String(section.id), body, text, canonicalText: text };
    return { ...value, crossReferences: researchAssemblyCrossReferences(value, resources.catalog) };
  };
  const assembled = await assembleResearchEvidence({ question: ordinaryQuestion, discover: async () => discovery, resolveSection: canonicalResolver });
  const requiredScopes = [["MC", "401.1"], ["FGC", "301.1"], ["MC", "701.1"]];
  const delivered = [];
  for (const [prefix, number] of requiredScopes) {
    const section = find(prefix, number); const body = await researchBodyForCatalogSection(section);
    const exact = body.blocks.filter(block => block.researchClaimEligible !== false).map(block => block.plainText || "").join("\n\n");
    const source = assembled.sources.find(value => value.sectionID === String(section.id));
    assert(source?.chapterScopeContext && source.canonicalContextComplete && !source.truncated, `${prefix} ${number} complete scope is delivered.`);
    assert(source.text.replace(/\s+/g, " ").includes(exact.replace(/\s+/g, " ")));
    assert.equal(source.codeEdition, section.codeEdition); assert.equal(source.corpusID, section.corpusID);
    assert.equal(source.codeVersion, section.codeVersion); assert.equal(source.jurisdiction, section.jurisdiction);
    delivered.push({ reference: `${prefix} ${number}`, sectionID: source.sectionID, canonicalBodySHA256: hash(exact),
      suppliedTextSHA256: hash(source.text), textCharacters: source.text.length, canonicalContextComplete: source.canonicalContextComplete });
  }
  assert.equal(assembled.usage.chapterScopeContextCount, assembled.sources.filter(source => source.chapterScopeContext).length);
  assert(assembled.usage.crossReferenceCount <= 6 && assembled.usage.characterCount <= 48000 && assembled.usage.discoveredCount <= 10);
  assert(!assembled.limitations.some(value => value.kind.startsWith("chapter-scope-context")));
  for (const request of [buildAnswerRequest(ordinaryQuestion, assembled.sources, "offline-actual-three-scopes"),
    buildVerifierRequest(ordinaryQuestion, assembled.sources, { answerText: "Synthetic scoped comparison." }, "offline-actual-three-scopes")]) {
    assert(request.input.includes("other than gas-fired appliances"));
  }
  realProof = { actualLiveSemanticRanksKnown: false, mockSemantics: true, originalQuestionUnchanged: ordinaryQuestion,
    facts: [], passageCount: resources.passageIndex.passages.length, query, candidates: discovery.candidates.map(value => ({
      reference: `${value.codePrefix} ${value.sectionNumber}`, rank: value.rank, signals: value.signals })),
    references: assembled.sources.map(value => `${value.codePrefix} ${value.sectionNumber}`), usage: assembled.usage,
    limits: assembled.limits, delivered, providerCalls };
}
assert.equal(providerCalls, 0);
const report = { test: "research-admitted-chapter-scopes-contract", malformedForegroundCases: 9, boundaryNegativeCases: 8,
  allQualifiedPlanChapters: plan().references.length, structuralSlots: packet.usage.crossReferenceCount,
  scopeGapVisibleInBothRequests: true, completeScopeReuse: true, strictPinExact: true, providerCalls, realProof };
if (process.env.PERMITEXT_CHAPTER_SCOPE_VALIDATION_PATH) fs.writeFileSync(process.env.PERMITEXT_CHAPTER_SCOPE_VALIDATION_PATH,
  JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
