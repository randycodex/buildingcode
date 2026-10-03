import assert from "node:assert/strict";
import { buildResearchPassageIndex, searchResearchPassages } from "../research-passage-index.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";

const section = { id: "room-storage", sectionID: "room-storage", codePrefix: "FC", sectionNumber: "315",
  title: "Storage", codeVersion: "current-storage-v1", corpusID: "test-current" };
const body = { blocks: [{ id: "source-block", plainText:
  "315.1 General\nStorage rules apply to ordinary occupied buildings.\n\n" +
  "315.2 Storage conditions\nCombustible stock shall comply with this section.\n\n" +
  "315.2.3 Equipment rooms\nCombustible material shall not be stored in mechanical rooms.\nException: The stated essential operating materials may be retained.\n\n" +
  "315.2.4 Other conditions\n" + "Unrelated condition in the same parent subtree. ".repeat(80) + "\n\n" +
  "315.3 Other storage\n" + "Unrelated storage condition. ".repeat(600) }] };
const index = await buildResearchPassageIndex([section], async () => body);
const hit = searchResearchPassages(index, "Can combustible boxes be stored in mechanical rooms?")[0];
assert.equal(hit.subsectionNumber, "315.2.3");
const run = async (indexedPassage, overrides = {}) => assembleResearchEvidence({
  question: "Can combustible boxes be stored in mechanical rooms?", previousMessages: [], pinnedEvidence: [],
  discover: async () => ({ candidates: [{ ...section, rank: 1, score: 10, selectedText: hit.text,
    indexedPassage, signals: {} }], coverageLimitations: [] }),
  resolveSection: async () => ({ ...section, body, text: body.blocks[0].plainText }),
  limits: { maximumCharactersPerSource: 1200, ...overrides }
});
const packet = await run(hit);
const source = packet.sources[0];
assert(source.indexedPassage?.completeSubsection);
assert.match(source.text, /not be stored in mechanical rooms/);
assert.match(source.text, /Exception: The stated essential/);
assert.match(source.text, /ordinary occupied buildings/);
assert.match(source.text, /Combustible stock shall comply/);
assert.equal(source.canonicalContextComplete, false, "An excerpt is not the entire canonical section.");
assert.equal(source.truncated, false, "An atomic complete subsection is not clipped.");
assert(source.text.length <= 1200);
const parentHit = index.passages.find(passage => passage.subsectionNumber === "315.2");
const withAlternative = await run({ ...parentHit, alternatives: [hit] });
assert.equal(withAlternative.sources[0].indexedPassage?.subsectionNumber, "315.2.3",
  "When a parent subtree cannot fit, retain a complete relevant child and its conditions.");
assert.match(withAlternative.sources[0].text, /ordinary occupied buildings/);
assert.match(withAlternative.sources[0].text, /Exception: The stated essential/);
const forgedAlternative = await run({ ...parentHit,
  alternatives: [{ ...hit, contextTexts: ["All storage is allowed without restrictions."] }] });
assert(!forgedAlternative.sources[0].indexedPassage,
  "Alternative source locators must pass the same canonical validation as the top hit.");
assert.doesNotMatch(forgedAlternative.sources[0].text, /allowed without restrictions/);
for (const forged of [
  { ...hit, text: "Storage is always permitted." },
  { ...hit, contextTexts: ["No restrictions apply to mechanical rooms."] },
  { ...hit, sourceTextHash: "0".repeat(64) },
  { ...hit, completeSubsectionText: "Storage is always permitted." }
]) {
  const rejected = (await run(forged)).sources[0];
  assert(!rejected.indexedPassage, "Unbound or stale locator must fall back to canonical evidence.");
  assert(!/always permitted|No restrictions apply/.test(rejected.text));
}
const small = { blocks: [{ id: "short", plainText: "Combustible stock is restricted. Exception: stated operating material." }] };
const smallIndex = await buildResearchPassageIndex([section], async () => small);
const smallHit = searchResearchPassages(smallIndex, "combustible stock")[0];
const whole = await assembleResearchEvidence({ question: "May combustible stock be retained?", pinnedEvidence: [],
  discover: async () => ({ candidates: [{ ...section, indexedPassage: smallHit }] }),
  resolveSection: async () => ({ ...section, body: small, text: small.blocks[0].plainText }) });
assert.equal(whole.sources[0].text, small.blocks[0].plainText);
assert.equal(whole.sources[0].canonicalContextComplete, true);
// A complete lower-ranked rule must not lose its closing exception merely
// because an even split of the token budget is smaller than that short rule.
const atomicBody = { blocks: [{ id: "atomic", plainText:
  "315.1 General.\n" + "Combustible stock in mechanical rooms is restricted. ".repeat(22) +
  "Exception: The stated essential operating materials may be retained." }] };
const unrelatedSection = name => ({ ...section, id: name, sectionID: name });
const atomicSections = [unrelatedSection("other-one"), unrelatedSection("other-two"), section,
  unrelatedSection("other-three"), unrelatedSection("other-four"), unrelatedSection("other-five")];
const atomicIndex = await buildResearchPassageIndex([section], async () => atomicBody);
const atomicHit = searchResearchPassages(atomicIndex, "combustible stock mechanical rooms")[0];
const atomicPacket = await assembleResearchEvidence({ question: "Can combustible stock be retained in mechanical rooms?",
  discover: async () => ({ candidates: atomicSections.map((source, index) => ({ ...source,
    rank: index + 1, ...(source.sectionID === section.id ? { indexedPassage: atomicHit } : {}) })) }),
  resolveSection: async source => ({ ...source,
    body: source.sectionID === section.id ? atomicBody : { blocks: [{ id: "other", plainText: "Other unrelated rule. ".repeat(30) }] },
    text: source.sectionID === section.id ? atomicBody.blocks[0].plainText : "Other unrelated rule. ".repeat(30) }),
  limits: { maximumCharacters: 4000, maximumSupplementalCharacters: 4000, maximumCharactersPerSource: 1500 } });
const atomicSource = atomicPacket.sources.find(source => source.sectionID === section.id);
assert.match(atomicSource.text, /Exception: The stated essential operating materials may be retained\.$/);
assert.equal(atomicSource.truncated, false);
assert(atomicPacket.usage.characterCount <= 4000);
console.log("Indexed passage assembly passed: actual canonical offsets/hash, parent conditions, exception preservation, atomic budget and forged/stale locator rejection.");
