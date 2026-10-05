import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { recoverResearchEvidenceBeforeRepair, researchEvidenceAssemblyLimits, researchEvidenceStrategies } from "../research-evidence-assembly.mjs";

globalThis.fetch = () => { throw new Error("External/provider calls forbidden in repair retrieval contract."); };
const authority = { codePrefix: "MC", corpusID: "fixture-mc", codeVersion: "fixture-mc-2022",
  codeEdition: "2022 NYC Mechanical Code", jurisdiction: "NYC" };
const canonical = (number, text) => ({ ...authority, sectionID: `fixture-${number}`, sectionNumber: number,
  title: "Synthetic equipment provisions", text, body: { blocks: [{ id: `block-${number}`, plainText: text }] } });
const first = canonical("991.1", "The equipment shall comply with Section 991.2. Exception: This rule does not govern portable equipment.");
const second = canonical("991.2", "The equipment shall retain its guard. Exception: Listed enclosed equipment is exempt. Section 991.3 governs its inspection.");
const third = canonical("991.3", "Inspection applies only to fixed equipment. The complete inspection procedure and closing exception remain together.");
const source = { ...first, sourceID: "original-source", origin: "permitext_discovered", authorityClass: "enacted",
  canonicalContextComplete: true, evidencePriority: { evidenceRole: "governing" } };
const packet = { strategy: { mode: researchEvidenceStrategies.broad }, sources: [source], limits: researchEvidenceAssemblyLimits,
  usage: { characterCount: source.text.length, supplementalCharacterCeiling: 48_000 }, rulePackets: {} };
const issue = number => ({ type: "missed_material_conclusion", detail: `MC Section ${number} is missing from the supplied evidence.` });
const reads = [];
const resolver = async request => {
  reads.push(structuredClone(request));
  return [first, second, third].find(value => value.sectionNumber === request.sectionNumber) || null;
};
const recover = (value = packet, issues = [issue("991.2")], resolveSection = resolver, signal) =>
  recoverResearchEvidenceBeforeRepair({ evidencePackage: value, issues, resolveSection, signal });
const before = structuredClone(packet);
const result = await recover();
assert.equal(result.diagnostic.attemptedReads, 1);
assert.equal(result.diagnostic.supplied.length, 1);
assert.deepEqual(packet, before, "Recovery never mutates the frozen original writer packet.");
assert.deepEqual(result.evidencePackage.sources[0], source);
const addition = result.evidencePackage.sources[1];
assert.equal(addition.text, second.text, "The complete exception and closing reference survive the lookup.");
assert.equal(addition.origin, "permitext_cross_reference");
assert.equal(addition.canonicalContextComplete, true);
assert.equal(addition.truncated, false);
assert.equal(result.diagnostic.supplied[0].textSHA256, createHash("sha256").update(second.text).digest("hex"));
for (const field of Object.keys(authority)) assert.equal(reads[0][field], authority[field]);
assert.equal(result.evidencePackage.usage.characterCount, first.text.length + second.text.length);
assert.deepEqual((await recover(result.evidencePackage)).diagnostic.supplied, [], "A complete source is not re-read.");

reads.length = 0;
assert.equal((await recover(packet, [issue("991.3")])).diagnostic.attemptedReads, 0,
  "A reviewer cannot introduce a reference absent from the already supplied text.");
assert.equal((await recover(packet, [{ type: "incorrect_citation", detail: "MC Section 991.2 states the rule differently." }])).diagnostic.attemptedReads, 0,
  "An interpretation disagreement alone is not a missing-source signal.");
assert.equal((await recover({ ...packet, sources: [{ ...source, title: "Section 991.3", text: "An unrelated rule." }] }, [issue("991.3")])).diagnostic.attemptedReads, 0,
  "A source heading or search metadata cannot authorize a hidden lookup.");
for (const restricted of [
  { ...packet, strategy: { mode: researchEvidenceStrategies.pinnedFirst } },
  { ...packet, sources: [{ ...source, origin: "user_pinned" }] }
]) assert.equal((await recover(restricted)).diagnostic.attemptedReads, 0);
assert.equal(reads.length, 0, "Blocked nominations never invoke the resolver.");

for (const mutate of [
  value => ({ ...value, codeVersion: "fixture-mc-2014" }),
  value => ({ ...value, codeEdition: "2014 NYC Mechanical Code" }),
  value => ({ ...value, corpusID: "other-corpus" }),
  value => ({ ...value, jurisdiction: undefined }),
  value => ({ ...value, sectionNumber: "991.3" }),
  value => ({ ...value, authorityClass: "official_guidance" }),
  value => ({ ...value, referenceOnly: true }),
  value => ({ ...value, researchClaimEligible: false }),
  value => ({ ...value, truncated: true }),
  value => ({ ...value, body: undefined }),
  value => ({ ...value, body: { blocks: [{ plainText: value.text, truncated: true }] } }),
  value => ({ ...value, text: value.text.replace("exempt", "never exempt") }),
  value => ({ ...value, text: value.text.slice(0, 30) })
]) {
  const invalid = await recover(packet, [issue("991.2")], async () => mutate(second));
  assert.equal(invalid.diagnostic.supplied.length, 0, "Mismatched authority, altered words and incomplete bodies fail closed.");
  assert.deepEqual(invalid.evidencePackage.sources, packet.sources);
}
const flattened = canonical("991.2", "The complete requirement.\n\nException: The enclosed equipment is exempt.");
const whitespace = await recover(packet, [issue("991.2")], async () => ({ ...flattened, text: flattened.text.replace(/\s+/g, " ") }));
assert.equal(whitespace.diagnostic.supplied.length, 1, "Whitespace serialization does not erase complete canonical evidence.");
const rejectedBudget = await recover({ ...packet, limits: { ...packet.limits,
  maximumCharacters: first.text.length + second.text.length - 1 } });
assert.equal(rejectedBudget.diagnostic.unresolved[0].reason, "complete_source_exceeds_budget");
assert.deepEqual(rejectedBudget.evidencePackage.sources, packet.sources, "Recovery never clips an exception to fit.");
const lowerSupplement = await recover({ ...packet, limits: { ...packet.limits, maximumSupplementalCharacters: first.text.length + 1 } });
assert.equal(lowerSupplement.diagnostic.supplied.length, 0);
const fullCrossReferenceBudget = await recover({ ...packet, limits: { ...packet.limits, maximumCrossReferences: 1 },
  sources: [source, { ...third, origin: "permitext_cross_reference", authorityClass: "enacted", canonicalContextComplete: true }] });
assert.equal(fullCrossReferenceBudget.diagnostic.attemptedReads, 0);

const incomplete = { ...second, text: "The equipment shall retain its guard.", origin: "permitext_discovered",
  sourceID: "existing-child", canonicalContextComplete: false, authorityClass: "enacted", indexedPassage: { stale: true } };
const upgraded = await recover({ ...packet, sources: [source, incomplete] });
assert.equal(upgraded.evidencePackage.sources.length, 2);
assert.equal(upgraded.evidencePackage.sources[1].sourceID, incomplete.sourceID);
assert.equal(upgraded.evidencePackage.sources[1].text, second.text);
assert.equal(upgraded.evidencePackage.sources[1].indexedPassage, undefined, "A whole source must not retain stale child offsets.");

const fourRefs = { ...source, text: "Sections 991.2 through 991.5 govern this equipment." };
const capped = await recover({ ...packet, sources: [fourRefs] }, [2, 3, 4, 5].map(value => issue(`991.${value}`)), async request =>
  canonical(request.sectionNumber, `Complete synthetic text for ${request.sectionNumber}.`));
assert.equal(capped.diagnostic.attemptedReads, 2);
assert.equal(capped.diagnostic.supplied.length, 2, "The two-read limit applies across the entire review.");
const crossCode = await recover({ ...packet, sources: [{ ...source, text: "BC Section 991.2 governs this equipment." }] },
  [{ type: "incorrect_citation", detail: "BC Section 991.2 is missing." }]);
assert.equal(crossCode.diagnostic.attemptedReads, 0, "A cross-code reference does not establish an edition for another code.");
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(recover(packet, [issue("991.2")], resolver, cancelled.signal), { name: "AbortError" });
console.log("Repair retrieval contract passed: grounded edition-matched full sources, shared budgets, selections, hashes and cancellation.");
