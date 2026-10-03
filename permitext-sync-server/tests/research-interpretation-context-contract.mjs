import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";
import { constructionHTMLBodyForSection } from "../construction-html-content.mjs";
import { historicalConstructionSectionCatalog, historicalConstructionSection } from "../historical-construction-content.mjs";
import {
  researchInterpretationContextMaximumFamilies,
  researchInterpretationContextPlan,
  resolveResearchInterpretationContext
} from "../research-interpretation-context.mjs";

globalThis.fetch = async () => { throw new Error("Network/provider calls forbidden in interpretation-context contract."); };
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const current = registry.find(corpus => corpus.id === "nyc-2022-construction-codes");
const historical = registry.find(corpus => corpus.id === "nyc-2014-construction-codes");
const authority = corpus => ({ corpusID: corpus.id, codeVersion: corpus.codeVersion,
  codeEdition: corpus.codeEdition, jurisdiction: corpus.jurisdiction });
const primary = (codePrefix, extra = {}, corpus = current) => ({ ...authority(corpus),
  sourceID: `source-${codePrefix}`, sectionID: `fixture-${codePrefix}`, codePrefix,
  sectionNumber: "777.1", eligiblePrimary: true, origin: "permitext_discovered", ...extra });
const planFor = anchors => researchInterpretationContextPlan({ anchors });

assert.equal(researchInterpretationContextMaximumFamilies, 2);
const anchors = [primary("MC"), primary("PC"), primary("BC"), primary("FGC")];
const before = structuredClone(anchors);
const bounded = planFor(anchors);
assert.equal(bounded.references.length, 2);
assert.deepEqual(bounded.references.map(reference => reference.codePrefix), ["MC", "PC"]);
assert(bounded.skippedAnchors.every(entry => entry.reason === "family_limit"));
assert.deepEqual(anchors, before, "Planning never mutates operative sources.");
for (const reference of bounded.references) {
  assert.equal(reference.sectionNumber, "102.1");
  assert.equal(reference.sectionID, undefined, "Canonical IDs must come from the resolver.");
  assert.equal(reference.optional, true);
  assert.equal(reference.selectedText, undefined, "No legal answer is supplied by the plan.");
  assert.deepEqual(Object.fromEntries(Object.keys(authority(current)).map(field => [field, reference[field]])), authority(current));
}
for (const codePrefix of ["BC", "MC", "FGC", "PC"]) assert.equal(planFor([primary(codePrefix)]).references[0].codePrefix, codePrefix);
for (const codePrefix of ["FC", "ZR", "AC", "EBC", "BC68"]) {
  const corpus = registry.find(value => value.codePrefixes.includes(codePrefix));
  assert.equal(planFor([primary(codePrefix, {}, corpus)]).references.length, 0,
    `A ${codePrefix} operative rule cannot borrow construction-code 102.1 by number.`);
}
for (const field of Object.keys(authority(current))) {
  const source = primary("MC"); delete source[field];
  assert.equal(planFor([source]).references.length, 0, `Missing ${field} cannot be inferred.`);
}
for (const extra of [{ codeVersion: historical.codeVersion }, { corpusID: historical.id },
  { codeEdition: historical.codeEdition }, { jurisdiction: "Another City" }]) {
  assert.equal(planFor([primary("MC", extra)]).references.length, 0, "Mixed authority identity is rejected.");
}
assert.equal(planFor([primary("MC", { eligiblePrimary: false })]).references.length, 0);
assert.equal(planFor([primary("MC", { sectionNumber: "" })]).references.length, 0);
assert.equal(planFor([primary("MC", { sourceID: undefined, sectionID: undefined })]).references.length, 0,
  "A bare code family/corpus identity is not an operative source.");
assert.equal(planFor([primary("MC", { sectionNumber: "102.1", canonicalContextComplete: true })]).references.length, 0,
  "Complete primary interpretation context is not fetched again as an optional copy.");
assert.equal(planFor([primary("MC"), primary("MC", { sectionNumber: "102.1", canonicalContextComplete: true })]).references.length, 0,
  "Another operative source in the same family cannot duplicate already supplied primary context.");
for (const extra of [{ referenceOnly: true }, { selectionMode: "section_reference" }, { contextualReference: true }, { signals: { contextualReference: true } },
  { evidencePriority: { evidenceRole: "contextual" } }, { targetedDefinition: true },
  { interpretationContext: true }, { authorityClass: "official_guidance" }]) {
  assert.equal(planFor([primary("MC", extra)]).references.length, 0, "References and supplemental context are not new operative anchors.");
}
const dedup = planFor([primary("MC"), primary("MC", { sourceID: "another-source", sectionID: "another-section" })]);
assert.equal(dedup.references.length, 1);
assert.deepEqual(dedup.references[0].anchorSourceIDs, ["source-MC", "another-source"]);

// Current-turn primary families lead; remembered citations qualify only while
// the caller's topic decision marks them both primary and currently active.
const inherited = primary("BC", { inheritedAuthorityReference: true });
assert.equal(planFor([inherited]).references.length, 0);
assert.equal(planFor([{ ...inherited, activeTopic: true }]).references.length, 1);
assert.equal(planFor([primary("MC", { signals: { inheritedAuthorityReference: true } })]).references.length, 0);
const precedence = planFor([{ ...inherited, activeTopic: true }, primary("MC"), primary("PC")]);
assert.deepEqual(precedence.references.map(reference => reference.codePrefix), ["MC", "PC"]);
const editions = planFor([primary("BC"), primary("BC", {}, historical)]).references;
assert.equal(editions.length, 2, "Each authority/family pair counts toward the shared two-reference cap.");
assert.equal(editions[0].codeVersion, current.codeVersion);
assert.equal(editions[1].codeVersion, historical.codeVersion);

const pin = primary("MC", { origin: "user_pinned", selectedText: "Exact user-selected text." });
const selectedBefore = structuredClone(pin);
for (const options of [
  { strictBoundary: true },
  { strategy: { mode: "pinned_first" } },
  { strategy: { mode: "pinned_first", reason: "question_explicitly_bounded_to_selected_evidence" }, explicitlyAuthorizedBroadening: true },
  { pinnedEvidence: [pin] },
  { anchors: [pin] }
]) assert.equal(researchInterpretationContextPlan({ anchors: [primary("MC")], ...options }).references.length, 0);
assert.equal(researchInterpretationContextPlan({ anchors: [primary("MC")], strictBoundary: true,
  explicitlyAuthorizedBroadening: true }).references.length, 0, "Authorization cannot override an explicit strict boundary.");
assert.equal(researchInterpretationContextPlan({ anchors: [pin], strategy: { mode: "pinned_first" },
  pinnedEvidence: [pin], explicitlyAuthorizedBroadening: true }).references.length, 1);
assert.equal(researchInterpretationContextPlan({ anchors: [primary("MC", { selectionMode: "section_reference" })],
  explicitlyAuthorizedBroadening: true }).references.length, 0, "Broadening does not promote a reference-only anchor into operative evidence.");
assert.deepEqual(pin, selectedBefore, "Permitted broadening still never changes the pin itself.");

const reference = planFor([primary("MC")]).references[0];
const canonical = { ...authority(current), codePrefix: "MC", sectionNumber: "102.1", sectionID: "canonical-id",
  title: "Canonical fixture title", text: "Canonical enacted fixture text.", chapterTitle: "Canonical chapter title" };
const referenceBefore = structuredClone(reference);
const canonicalBefore = structuredClone(canonical);
let reads = 0;
const good = await resolveResearchInterpretationContext(reference, async request => {
  reads++;
  assert.equal(request.origin, "permitext_cross_reference");
  assert.equal(request.sectionID, undefined);
  assert.equal(request.selectedText, undefined);
  assert.equal(request.codeEdition, current.codeEdition);
  return canonical;
});
assert.equal(reads, 1);
assert.equal(good.limitation, null);
assert.equal(good.source.sectionID, canonical.sectionID);
assert.equal(good.source.text, canonical.text);
assert.equal(good.source.chapterTitle, canonical.chapterTitle);
assert.equal(good.source.evidencePriority.evidenceRole, "supporting");
assert(good.source.evidencePriority.functions.includes("supporting_cross_reference"));
assert(!good.source.evidencePriority.functions.includes("contextual"));
assert.equal(good.source.evidencePriority.claimCoverageRequired, false);
assert.equal(good.source.signals.exactReference, undefined);
assert.equal(good.source.canonicalContextComplete, true);
assert.deepEqual(reference, referenceBefore);
assert.deepEqual(canonical, canonicalBefore);
const rememberedSignals = await resolveResearchInterpretationContext(reference, async () => ({ ...canonical,
  signals: { exactReference: true, exactTopicRouteTarget: true, contextualReference: true },
  evidencePriority: { claimCoverageRequired: true, evidenceRole: "governing" } }));
assert.equal(rememberedSignals.source.signals.exactReference, undefined);
assert.equal(rememberedSignals.source.evidencePriority.claimCoverageRequired, false);
assert.equal(rememberedSignals.source.evidencePriority.evidenceRole, "supporting",
  "Resolved canonical text cannot inherit a prior user-reference/mandatory claim classification.");

for (const field of ["codePrefix", "sectionNumber", ...Object.keys(authority(current))]) {
  const value = { ...canonical }; delete value[field];
  const result = await resolveResearchInterpretationContext(reference, async () => value);
  assert.equal(result.source, null);
  assert.equal(result.limitation.reason, "missing_canonical_identity");
  assert(result.limitation.fields.includes(field));
  assert.equal(result.limitation.optional, true, "Unavailable context creates no mandatory claim gap.");
}
for (const [field, value] of Object.entries({ ...authority(historical), jurisdiction: "Another City",
  codePrefix: "FC", sectionNumber: "102.2" })) {
  const result = await resolveResearchInterpretationContext(reference, async () => ({ ...canonical, [field]: value }));
  assert.equal(result.source, null);
  assert.equal(result.limitation.reason, "canonical_identity_mismatch");
  assert(result.limitation.fields.includes(field));
}
for (const value of [null, { ...canonical, text: "", selectedText: "A selected fragment is not canonical text." },
  { ...canonical, sectionID: undefined }, { ...canonical, truncated: true },
  { ...canonical, canonicalContextComplete: false }, { ...canonical, discoveryPassageOnly: true },
  { ...canonical, pinnedSelectionExact: true }, { ...canonical, referenceOnly: true },
  { ...canonical, authorityClass: "official_guidance" }]) {
  assert.equal((await resolveResearchInterpretationContext(reference, async () => value)).source, null);
}
assert.equal((await resolveResearchInterpretationContext(reference, async () => { throw new Error("offline"); }))
  .limitation.reason, "canonical_resolution_failed");
let invalidReads = 0;
const invalid = await resolveResearchInterpretationContext({ ...reference, codePrefix: "FC" }, async () => { invalidReads++; return canonical; });
assert.equal(invalidReads, 0, "An unsupported reference cannot dispatch a canonical read.");
assert.equal(invalid.limitation.reason, "invalid_context_reference");

// Actual current canonical Chapter 1 bodies use the existing HTML fallback.
// IDs are looked up from the imported mapping, never maintained in this helper.
const mapping = JSON.parse(await readFile(new URL("../config/canonical-section-ids.json", import.meta.url), "utf8"));
for (const codePrefix of ["BC", "MC", "FGC", "PC"]) {
  const actualReference = planFor([primary(codePrefix)]).references[0];
  const id = mapping.byCodeChapterSection[`${codePrefix}:1:102.1`];
  assert(id, `Canonical mapping includes ${codePrefix} 102.1.`);
  const body = await constructionHTMLBodyForSection({ id, codePrefix, chapterNumber: "1", sectionNumber: "102.1" });
  assert(body?.blocks?.length);
  const canonicalText = body.blocks.filter(block => block.researchClaimEligible !== false)
    .map(block => block.plainText || "").join("\n\n");
  const result = await resolveResearchInterpretationContext(actualReference, async () => ({
    ...authority(current), codePrefix, sectionNumber: body.sectionNumber,
    sectionID: String(body.sectionID), text: canonicalText, title: body.title, body
  }));
  assert(result.source, `Actual ${codePrefix} 102.1 canonical context is available.`);
  assert.equal(result.source.text, canonicalText.trim(), "The full actual canonical rule is preserved.");
  assert.match(result.source.text, /specific requirement shall (?:be applicable|govern)/i);
  assert.match(result.source.text, /most restrictive shall govern/i);
  assert.equal(result.source.evidencePriority.claimCoverageRequired, false);
}
const historicalCatalog = await historicalConstructionSectionCatalog();
const oldSummary = historicalCatalog.find(source => source.codePrefix === "MC" && source.sectionNumber === "102.1");
assert(oldSummary, "Historical context is resolved within its own catalog.");
const oldBody = await historicalConstructionSection(oldSummary.id);
const oldReference = planFor([primary("MC", {}, historical)]).references[0];
const oldText = oldBody.blocks.filter(block => block.researchClaimEligible !== false).map(block => block.plainText || "").join("\n\n");
const old = await resolveResearchInterpretationContext(oldReference, async () => ({
  ...oldSummary, ...authority(historical), sectionID: String(oldSummary.id), text: oldText
}));
assert(old.source);
assert.equal(old.source.codeVersion, historical.codeVersion);
assert.equal(old.source.text, oldText.trim());
assert.equal((await resolveResearchInterpretationContext(oldReference, async () => canonical)).source, null,
  "A missing historical section cannot fall back to a same-numbered current provision.");

console.log("research-interpretation-context-contract: passed (bounded canonical families, identity, source boundaries, actual current/historical bodies)");
