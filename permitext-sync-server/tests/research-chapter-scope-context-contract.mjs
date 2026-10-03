import assert from "node:assert/strict";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";
import { buildResearchPassageIndex } from "../research-passage-index.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { researchCorpusResources, researchBodyForCatalogSection, researchAssemblyCrossReferences } from "../app.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";
import { nominateResearchChapterScopeCandidates, researchChapterScopeContextPlan,
  resolveResearchChapterScopeContext } from "../research-chapter-scope-context.mjs";

globalThis.fetch = () => { throw Error("Provider/network calls forbidden in chapter-scope contract"); };
process.env.NODE_ENV = "test";
delete process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH;
delete process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH;
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const current = registry.find(value => value.id === "nyc-2022-construction-codes");
const historical = registry.find(value => value.id === "nyc-2014-construction-codes");
const authority = corpus => ({ corpusID: corpus.id, codeVersion: corpus.codeVersion,
  codeEdition: corpus.codeEdition, jurisdiction: corpus.jurisdiction });
const compact = value => String(value).replace(/\s+/g, " ").trim();
const fixture = (id, number, bodyText, extra = {}) => ({ ...authority(current), id, sectionID: id,
  codePrefix: "MC", chapterNumber: "9", sectionNumber: number, title: "Scope.",
  body: { blocks: [{ id: `${id}-text`, plainText: bodyText }] }, ...extra });
const anchor = fixture("anchor", "990.4", "The appliance retains its complete operative rule.", { title: "Appliance rule.",
  sourceID: "operative", eligiblePrimary: true, origin: "permitext_discovered" });
const scope = fixture("scope", "990.1", "The provisions of this chapter shall govern appliance installations.\nException: The listed separate appliance class follows its own code.");
const local = fixture("local", "991.1", "This section shall govern local appliance installations. Other provisions occur elsewhere in this chapter.");
const splitScope = fixture("split-scope", "990.2", "");
splitScope.body.blocks = [{ id: "opening", plainText: "This chapter shall govern these appliances." },
  { id: "closing", plainText: "Exception: Separately regulated appliance classes retain their complete separate conditions." }];
const catalog = [anchor, scope, local, splitScope];
const index = await buildResearchPassageIndex(catalog, async section => section.body, { maximumPassageCharacters: 80 });
const before = structuredClone(catalog);
const nominations = nominateResearchChapterScopeCandidates([anchor], catalog, index);
assert.deepEqual(nominations.map(value => value.sectionID), ["scope", "split-scope"]);
assert(nominations[1].indexedCanonicalScopeText.includes("complete separate conditions"), "Closing continuation text is part of the nomination.");
assert.deepEqual(catalog, before);
const plan = options => researchChapterScopeContextPlan({ anchors: [anchor], canonicalScopeRecords: nominations, ...options });
const reference = plan().references[0];
assert.equal(reference.sectionID, "scope");
assert.deepEqual(reference.anchorSourceIDs, ["operative"]);
assert.equal(reference.optional, true);
const canonical = value => ({ ...value, text: value.body.blocks.map(block => block.plainText).join("\n\n") });
const resolved = await resolveResearchChapterScopeContext(reference, async request => {
  assert.equal(request.indexedCanonicalScopeText, undefined, "Resolution never receives cached legal text.");
  assert.equal(request.selectedText, undefined);
  return canonical(scope);
});
assert(resolved.source);
assert.equal(resolved.source.evidencePriority.evidenceRole, "supporting");
assert.equal(resolved.source.evidencePriority.claimCoverageRequired, false);
assert.equal(resolved.source.signals.exactReference, undefined);
assert(resolved.source.text.endsWith("its own code."));
for (const options of [{ strictBoundary: true }, { strategy: { mode: "pinned_first" } },
  { pinnedEvidence: [anchor] }, { strictBoundary: true, explicitlyAuthorizedBroadening: true }])
  assert.equal(plan(options).references.length, 0, "Exact selected-source boundaries stay closed.");
assert.equal(plan({ pinnedEvidence: [anchor], explicitlyAuthorizedBroadening: true }).references.length, 1);
for (const extra of [{ eligiblePrimary: false }, { referenceOnly: true }, { selectionMode: "section_reference" },
  { targetedDefinition: true }, { evidencePriority: { evidenceRole: "contextual" } },
  { signals: { contextualReference: true } }, { inheritedAuthorityReference: true },
  { chapterScopeContext: true }, { chapterNumber: "" }, { jurisdiction: "Elsewhere" }])
  assert.equal(plan({ anchors: [{ ...anchor, ...extra }] }).references.length, 0);
assert.equal(plan({ anchors: [{ ...anchor, inheritedAuthorityReference: true, activeTopic: true }] }).references.length, 1);
assert.equal(plan({ canonicalScopeRecords: [{ ...nominations[0], matchedAnchorSectionIDs: ["other"] }] }).references.length, 0);
assert.equal(plan({ canonicalScopeRecords: [{ ...nominations[0], indexedCanonicalScopeText: "Invented chapter qualification" }] }).references.length, 0);
for (const field of ["codePrefix", "corpusID", "codeVersion", "codeEdition", "jurisdiction", "chapterNumber", "sectionNumber", "sectionID"]) {
  const missing = canonical(scope); delete missing[field]; if (field === "sectionID") delete missing.id;
  assert.equal((await resolveResearchChapterScopeContext(reference, async () => missing)).source, null, `Missing canonical ${field} is rejected.`);
  const foreign = { ...canonical(scope), [field]: "foreign" };
  assert.equal((await resolveResearchChapterScopeContext(reference, async () => foreign)).source, null, `Foreign ${field} is rejected.`);
}
for (const extra of [{ body: undefined, text: canonical(scope).text + " Changed closing qualification." }, { truncated: true },
  { canonicalContextComplete: false }, { referenceOnly: true }, { authorityClass: "commentary" },
  { title: "Local detail." }, { body: { ...scope.body, truncated: true } }])
  assert.equal((await resolveResearchChapterScopeContext(reference, async () => ({ ...canonical(scope), ...extra }))).source, null);
const old = { ...anchor, ...authority(historical) };
assert.equal(plan({ anchors: [old] }).references.length, 0, "Current scope cannot migrate into historical anchors.");
assert.equal(nominateResearchChapterScopeCandidates([{ ...anchor, chapterNumber: "8" }], catalog, index).length, 0);
assert.equal(nominateResearchChapterScopeCandidates([old], catalog, index).length, 0);
const damagedIndex = { ...index, passages: index.passages.filter(p => p.sectionID !== "scope" || p.sourceOffsets.start !== 0) };
assert(!nominateResearchChapterScopeCandidates([anchor], catalog, damagedIndex).some(value => value.sectionID === "scope"),
  "Incomplete indexed text cannot nominate a full chapter scope.");
const foreignPassages = index.passages.map(value => value.sectionID === "scope" ? { ...value, jurisdiction: "Another City" } : value);
assert(!nominateResearchChapterScopeCandidates([anchor], catalog, { ...index, passages: foreignPassages,
  passagesByID: new Map(foreignPassages.map(value => [value.id, value])) }).some(value => value.sectionID === "scope"),
  "A conflicting supplied indexed jurisdiction is rejected even when section registration is genuine.");

// Two actual currently operative chapters lead over a low-ranked incidental
// chapter, and sourceChapterNumber binds source rather than navigation labels.
const other = fixture("other", "880.1", "This chapter shall govern other appliances.", { codePrefix: "PC", chapterNumber: "8" });
const third = fixture("third", "770.1", "This chapter shall govern third appliances.", { codePrefix: "BC", chapterNumber: "7" });
const manyCatalog = [scope, other, third];
const manyIndex = await buildResearchPassageIndex(manyCatalog, async value => value.body);
const manyAnchors = [anchor, { ...other, eligiblePrimary: true, title: "Operative rule", signals: { exactReference: true } },
  { ...third, eligiblePrimary: true, title: "Operative rule", signals: { currentQuestionForeground: true } }];
const many = researchChapterScopeContextPlan({ anchors: manyAnchors,
  canonicalScopeRecords: nominateResearchChapterScopeCandidates(manyAnchors, manyCatalog, manyIndex) });
assert.deepEqual(many.references.map(value => value.codePrefix), ["PC", "BC"]);
assert(many.skippedAnchors.some(value => value.reason === "chapter_limit"));
assert.equal(plan({ anchors: [{ ...anchor, chapterNumber: "navigation-only", sourceChapterNumber: "9" }] }).references.length, 1);

// Actual full current enacted sources, including local Scope false positives.
const resources = await researchCorpusResources({ selected: [current] });
const actualCatalog = resources.catalog;
const find = (codePrefix, sectionNumber) => {
  const value = actualCatalog.find(value => value.codePrefix === codePrefix && value.sectionNumber === sectionNumber);
  assert(value, `${codePrefix} ${sectionNumber} is present in the current canonical catalog.`); return value;
};
const actualAnchorSummaries = [find("MC", "703.1.1"), find("FGC", "304.6.1")];
const actualScopeSummaries = [find("MC", "701.1"), find("FGC", "301.1")];
const localScopeSummaries = [find("MC", "513.1"), find("PC", "609.1"), find("BC", "1012.1"), find("BC", "1003.1")];
const chapterScopeSummaries = [find("MC", "501.1"), find("PC", "601.1")];
const actualIndexCatalog = [...actualAnchorSummaries, ...actualScopeSummaries, ...localScopeSummaries, ...chapterScopeSummaries];
const bodies = new Map();
for (const summary of actualIndexCatalog) bodies.set(String(summary.id), await researchBodyForCatalogSection(summary));
const actualIndex = await buildResearchPassageIndex(actualIndexCatalog, async summary => bodies.get(String(summary.id)));
const actualNominations = nominateResearchChapterScopeCandidates(actualAnchorSummaries, actualIndexCatalog, actualIndex);
assert.deepEqual(actualNominations.map(value => `${value.codePrefix}:${value.sectionNumber}`), ["MC:701.1", "FGC:301.1"]);
assert.match(actualNominations[0].indexedCanonicalScopeText, /other than gas-fired appliances/);
assert.match(actualNominations[0].indexedCanonicalScopeText, /shall be in accordance with the New York City Fuel Gas Code/);
const localNominations = nominateResearchChapterScopeCandidates(localScopeSummaries, actualIndexCatalog, actualIndex);
assert.deepEqual(localNominations.map(value => `${value.codePrefix}:${value.sectionNumber}`), ["MC:501.1", "PC:601.1"]);

const actualResolver = async request => {
  const summary = actualCatalog.find(summary => String(summary.id) === String(request.sectionID)) ||
    actualCatalog.find(summary => summary.codePrefix === request.codePrefix && summary.sectionNumber === request.sectionNumber &&
      (!request.corpusID || request.corpusID === summary.corpusID));
  if (!summary) return null;
  const body = bodies.get(String(summary.id)) || await researchBodyForCatalogSection(summary);
  const text = compact(body.blocks.filter(block => block.researchClaimEligible !== false).map(block => block.plainText || "").join("\n\n"));
  return { ...summary, sectionID: String(summary.id), body, text,
    canonicalText: `${summary.sectionNumber} ${summary.title} ${text}`,
    crossReferences: researchAssemblyCrossReferences({ ...summary, text }, actualCatalog) };
};
const actualReferences = researchChapterScopeContextPlan({
  anchors: actualAnchorSummaries.map((value, index) => ({ ...value, sectionID: String(value.id),
    sourceID: `actual-${index}`, eligiblePrimary: true })), canonicalScopeRecords: actualNominations }).references;
for (const value of actualReferences) assert((await resolveResearchChapterScopeContext(value, actualResolver)).source,
  "The wrapper accepts the actual app body/heading separation without losing complete scope text.");

// Reproduce the six-slot pressure with actual MC/FGC sources and six ordinary
// cross-references: scopes replace optional expansion, not operative evidence.
const genericReferences = ["302.1", "303.1", "305.1", "306.1", "307.1", "308.1"].map(number => find("FGC", number));
const pressuredResolver = async request => {
  const value = await actualResolver(request);
  if (value && actualAnchorSummaries.some(anchor => String(anchor.id) === value.sectionID)) value.crossReferences = genericReferences.map(ref => ({
    sectionID: String(ref.id), codePrefix: ref.codePrefix, sectionNumber: ref.sectionNumber }));
  return value;
};
const discover = async () => ({ candidates: actualAnchorSummaries.map((value, rank) => ({ ...value,
  sectionID: String(value.id), rank: rank + 1 })), chapterScopeCandidates: actualNominations });
const gasQuestion = "For a gas-fired boiler using two outdoor-air openings with vertical ducts, how large must each opening be?";
const pressured = await assembleResearchEvidence({ question: gasQuestion, discover, resolveSection: pressuredResolver });
assert.equal(pressured.usage.crossReferenceCount, 6);
assert.equal(pressured.usage.chapterScopeContextCount, 2);
assert(pressured.sources.some(source => source.codePrefix === "MC" && source.sectionNumber === "703.1.1"));
assert(pressured.sources.some(source => source.codePrefix === "FGC" && source.sectionNumber === "304.6.1"));
assert(pressured.sources.some(source => source.chapterScopeContext && /other than gas-fired appliances/.test(source.text)));
assert(pressured.usage.characterCount <= pressured.limits.maximumCharacters);
let fullScopeReads = 0;
const alreadyComplete = await assembleResearchEvidence({ question: gasQuestion,
  discover: async () => ({ ...(await discover()), candidates: [...actualAnchorSummaries, actualScopeSummaries[0]]
    .map((value, rank) => ({ ...value, sectionID: String(value.id), rank: rank + 1 })) }),
  resolveSection: async request => {
    if (String(request.sectionID) === String(actualScopeSummaries[0].id)) fullScopeReads++;
    return pressuredResolver(request);
  } });
assert.equal(fullScopeReads, 1, "An independently supplied full canonical scope is reused without another read.");
assert.equal(alreadyComplete.sources.filter(source => source.codePrefix === "MC" && source.sectionNumber === "701.1").length, 1);
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
for (const question of [gasQuestion, "For an oil-fired boiler using two outdoor-air openings with vertical ducts, explain the sizing rule.",
  "Compare the outdoor combustion-air provisions for a gas-fired boiler and an oil-fired boiler."]) {
  const assembled = question === gasQuestion ? pressured : await assembleResearchEvidence({ question, discover, resolveSection: pressuredResolver });
  const scopeSource = assembled.sources.find(source => source.codePrefix === "MC" && source.chapterScopeContext);
  assert(scopeSource && scopeSource.anchorSourceIDs.length);
  for (const request of [buildAnswerRequest(question, assembled.sources, "offline-chapter-scope"),
    buildVerifierRequest(question, assembled.sources, { answerText: "Synthetic scope-envelope fixture." }, "offline-chapter-scope")]) {
    assert(request.input.includes(scopeSource.text), "Both actual request paths receive the complete enacted exclusion.");
    assert(request.input.includes("other than gas-fired appliances"));
    assert(request.input.includes("New York City Fuel Gas Code"));
  }
  assert(assembled.sources.some(source => source.codePrefix === "MC" && source.sectionNumber === "703.1.1"),
    "Scope text does not ban parallel code or erase an independently requested comparison.");
}
const limited = await assembleResearchEvidence({ question: gasQuestion, discover, resolveSection: pressuredResolver,
  limits: { maximumCharacters: 600, maximumCharactersPerSource: 600 } });
assert(limited.usage.characterCount <= 600);
assert(limited.limitations.some(value => /chapter-scope-context/.test(value.kind)));
assert(!limited.sources.some(source => source.chapterScopeContext && source.truncated));
const noSlots = await assembleResearchEvidence({ question: gasQuestion, discover, resolveSection: pressuredResolver,
  limits: { maximumCrossReferences: 1 } });
assert(noSlots.limitations.some(value => value.kind === "chapter-scope-context-slot-limit"));
assert.equal(noSlots.usage.chapterScopeContextCount, 1);
const exactPin = { ...actualAnchorSummaries[0], sectionID: String(actualAnchorSummaries[0].id),
  selectedText: "Each opening shall have a minimum free area of 1 square inch per 4,000 Btu/h" };
const selected = await assembleResearchEvidence({ question: "Using only the selected passage, explain its rule.",
  pinnedEvidence: [exactPin], strategy: { mode: "pinned_first", reason: "question_explicitly_bounded_to_selected_evidence" },
  discover, resolveSection: actualResolver });
assert.equal(selected.sources.find(value => value.origin === "user_pinned").text, exactPin.selectedText);
assert(!selected.sources.some(value => value.chapterScopeContext));
console.log("Chapter scope passed: exact full-index scope; actual gas/non-gas parallel sources and both envelopes; six-slot priority; identity/stale/local-scope/selected and character boundaries, no provider calls.");
