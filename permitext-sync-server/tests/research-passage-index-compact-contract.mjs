import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildResearchPassageIndex, mergeResearchPassageIndexes, searchResearchPassages } from "../research-passage-index.mjs";
import { researchPassageEmbeddingText } from "../research-semantic-passages.mjs";

const catalog = Array.from({ length: 41 }, (_, position) => ({
  id: `current-${position}`, codePrefix: "PC", sectionNumber: String(700 + position),
  title: position % 2 ? "Pipe slope" : "Fixture storage", codeEdition: "2022",
  codeVersion: "current-fixture", corpusID: "authorized-current", applicabilityStatus: "current",
  headerLine: `SECTION PC ${700 + position}`, headingLine: `SOURCE HEADING ${position}`,
  chapterNumber: 7, chapterTitle: "Sanitary Drainage"
}));
const sources = new Map(catalog.map((section, position) => [section.id, { blocks: [{
  id: `block-${position}`, plainText: `${"pipe ".repeat(position === 0 ? 600 : position + 1)}slope storage ${position % 3 ? "room" : "distance"}.\nExact Unicode source: café, \"quoted\" and a tab\t.`
}]}]));
const index = await buildResearchPassageIndex(catalog, async section => sources.get(section.id), { maximumCharacters: 12000 });

for (const postings of [index.postings, index.titlePostings]) {
  for (const values of postings.values()) {
    assert(values instanceof Uint32Array, "Posting lists must use bounded compact integer storage.");
    assert.equal(values.byteLength, values.length * 4);
    assert.equal(values.byteLength, values.buffer.byteLength, "Final postings must not retain unused builder capacity.");
    assert.equal(values.length % 2, 0);
    let last = -1;
    for (let offset = 0; offset < values.length; offset += 2) {
      assert(values[offset] > last, "Posting ordinals preserve catalog source order and are unique per term.");
      assert(values[offset + 1] > 0);
      last = values[offset];
    }
  }
}
assert.equal(index.postings.get("pipe")[1], 600, "Term frequencies above 255 must not be truncated.");
assert.equal(index.postings.get("pipe").length, catalog.length * 2, "Growing posting buffers must retain every matching passage.");

// This is the prior fingerprint contract, deliberately serialized in one JSON
// value so the new streaming implementation must preserve the exact bytes.
const legacyFingerprint = createHash("sha256").update(JSON.stringify(index.passages.map(passage => ({
  id: passage.id, sectionID: passage.sectionID,
  codePrefix: passage.codePrefix, codeVersion: passage.codeVersion, codeEdition: passage.codeEdition,
  corpusID: passage.corpusID, parentTitle: passage.parentTitle, passageTitle: passage.passageTitle,
  sourceTextHash: passage.sourceTextHash, sourceOffsets: passage.sourceOffsets,
  searchText: passage.searchText, contextTexts: passage.contextTexts, kind: passage.kind
})))).digest("hex");
assert.equal(index.fingerprint, legacyFingerprint, "Compact storage must preserve persisted fingerprints.");

// A reference scorer retains the old array-of-pairs representation and union
// counting. Query keys here are explicit, singular terms with no morphology,
// isolating storage migration from the existing query language normalizer.
function legacySearch(query, weights, exactNumber, limit = 60, perSection = 3) {
  const pairs = map => new Map([...map].map(([term, values]) => [term,
    Array.from({ length: values.length / 2 }, (_, offset) => [values[offset * 2], values[offset * 2 + 1]])]));
  const body = pairs(index.postings);
  const title = pairs(index.titlePostings);
  const scores = new Map();
  const matches = new Map();
  const add = (ordinal, term, score) => {
    scores.set(ordinal, (scores.get(ordinal) || 0) + score);
    if (!matches.has(ordinal)) matches.set(ordinal, new Set());
    matches.get(ordinal).add(term);
  };
  for (const [term, weight] of weights) {
    const bodyList = body.get(term) || [];
    const titleList = title.get(term) || [];
    const frequency = new Set([...bodyList, ...titleList].map(pair => pair[0])).size;
    if (!frequency) continue;
    const inverse = Math.log(1 + (index.records.length - frequency + 0.5) / (frequency + 0.5));
    for (const [ordinal, count] of bodyList) {
      const length = index.records[ordinal].bodyLength;
      add(ordinal, term, weight * inverse * (count * 2.2 / (count + 1.2 * (0.25 + 0.75 * length / Math.max(1, index.averageLength)))));
    }
    for (const [ordinal, count] of titleList) add(ordinal, term, weight * inverse * (1.25 * count / (count + 1)));
  }
  const exact = new Set();
  for (const [ordinal, { passage }] of index.records.entries()) {
    if (passage.codePrefix === "PC" && passage.subsectionNumber === exactNumber) {
      exact.add(ordinal);
      scores.set(ordinal, (scores.get(ordinal) || 0) + 100);
    }
  }
  const groups = new Map();
  for (const [ordinal, score] of scores) {
    if (score <= 0) continue;
    const passage = index.records[ordinal].passage;
    const hit = { ...passage, score, exactReference: exact.has(ordinal), matchedTerms: [...(matches.get(ordinal) || [])], ordinal };
    if (!groups.has(passage.sectionID)) groups.set(passage.sectionID, []);
    groups.get(passage.sectionID).push(hit);
  }
  const order = (a, b) => Number(b.exactReference) - Number(a.exactReference) || b.score - a.score || a.ordinal - b.ordinal;
  return [...groups.values()].map(hits => {
    hits.sort(order);
    const seen = new Set();
    const selected = [];
    for (const hit of hits) {
      const key = `${hit.blockID}:${hit.sourceOffsets.start}:${hit.sourceOffsets.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(hit);
      if (selected.length >= perSection) break;
    }
    return { ...hits[0], passages: selected };
  }).sort(order).slice(0, limit);
}
for (const [query, entries, exactNumber, limit] of [
  ["ordinary pipe question", [["pipe", 1], ["slope", 1]], null, 60],
  ["storage in a room", [["room", 4], ["storage", 1], ["absent", 2]], null, 8],
  ["PC 708", [["pipe", 0.1], ["distance", 1]], "708", 20],
  ["no matching word", [["absent", 1]], null, 60]
]) {
  const weights = new Map(entries);
  assert.deepEqual(searchResearchPassages(index, query, { queryWeights: weights, limit }), legacySearch(query, weights, exactNumber, limit),
    "Compact postings must preserve exact scores, matches, passage selection and tie ordering.");
}

for (const passage of index.passages) {
  const canonical = index.sections.get(passage.sectionID);
  for (const field of ["headerLine", "headingLine", "chapterNumber", "chapterTitle"]) {
    assert.equal(passage[field], canonical[field], `Canonical ${field} must survive retrieval.`);
  }
  assert.equal(researchPassageEmbeddingText(passage), researchPassageEmbeddingText({
    ...passage, headerLine: "Different header", headingLine: "Different heading", chapterNumber: 88, chapterTitle: "Changed chapter"
  }), "New navigation metadata must not silently change the frozen embedding input.");
}
const dependencyCatalog = [{ ...catalog[0], sectionNumber: "315" }];
const dependencyIndex = await buildResearchPassageIndex(dependencyCatalog, async () => ({ blocks: [{
  id: "nested", plainText: "315.1 General.\n\nSee Section 315.2.\n\n315.2 Precautions.\n\n1. Keep the pipe accessible."
}] }));
const dependency = dependencyIndex.passages.find(passage => passage.subsectionNumber === "315.1").sameSectionReferences[0];
assert(dependency);
assert.equal(dependency.headerLine, catalog[0].headerLine);
assert.equal(dependency.chapterTitle, catalog[0].chapterTitle);
const empty = await buildResearchPassageIndex([], async () => { throw new Error("must not read"); });
assert.equal(empty.fingerprint, createHash("sha256").update("[]").digest("hex"));
assert.deepEqual(searchResearchPassages(empty, "pipe"), []);
assert.equal(index.passages.some(passage => passage.corpusID !== "authorized-current"), false);

const partitionCatalogs = [catalog.slice(0, 11), catalog.slice(11, 24), catalog.slice(24)];
const partitions = await Promise.all(partitionCatalogs.map(partition =>
  buildResearchPassageIndex(partition, async section => sources.get(section.id), { maximumCharacters: 12000 })));
const merged = mergeResearchPassageIndexes(partitions);
for (const field of ["version", "averageLength", "sectionCount", "passageCount", "fingerprint"]) {
  assert.equal(merged[field], index[field], `Merged ${field} must match a fresh combined build.`);
}
for (const field of ["records", "passages", "passagesByID", "sections", "postings", "titlePostings"]) {
  assert.deepEqual(merged[field], index[field], `Merged ${field} must match fresh catalog order and source data.`);
}
let combinedPosition = 0;
for (const partition of partitions) {
  for (const [position, passage] of partition.passages.entries()) {
    assert.equal(merged.passages[combinedPosition], passage, "Merged views must share canonical passage objects.");
    assert.equal(merged.records[combinedPosition], partition.records[position], "Merged views must share source records.");
    assert.equal(merged.passagesByID.get(passage.id), passage);
    combinedPosition += 1;
  }
}
for (const question of ["pipe slope", "storage in a room", "PC 708", "distance", "absent"]) {
  assert.deepEqual(searchResearchPassages(merged, question), searchResearchPassages(index, question),
    "Merged retrieval must preserve exact BM25 scores, document frequencies, ordinal ties and selected passages.");
}
assert.equal(mergeResearchPassageIndexes([partitions[0]]), partitions[0], "Single-corpus views reuse their entire canonical index.");
assert.deepEqual(mergeResearchPassageIndexes([]), empty);
const reordered = mergeResearchPassageIndexes([partitions[2], partitions[0]]);
const reorderedFresh = await buildResearchPassageIndex([...partitionCatalogs[2], ...partitionCatalogs[0]],
  async section => sources.get(section.id), { maximumCharacters: 12000 });
assert.equal(reordered.fingerprint, reorderedFresh.fingerprint);
assert.deepEqual(searchResearchPassages(reordered, "pipe room slope"), searchResearchPassages(reorderedFresh, "pipe room slope"),
  "Caller-selected partition order determines the same tie ordering as fresh indexing.");
assert(!reordered.passages.some(passage => partitionCatalogs[1].some(section => section.id === passage.sectionID)),
  "A merged view must not introduce any unselected canonical section.");

const historical = await buildResearchPassageIndex([{ ...catalog[0], id: "historical-700", codeEdition: "2014",
  codeVersion: "prior-fixture", corpusID: "historical-explicit", applicabilityStatus: "prior-edition-case-specific" }],
  async () => sources.get(catalog[0].id), { maximumCharacters: 12000 });
const future = await buildResearchPassageIndex([{ ...catalog[0], id: "future-700", codeEdition: "2027",
  codeVersion: "future-fixture", corpusID: "future-explicit", applicabilityStatus: "future-effective" }],
  async () => sources.get(catalog[0].id), { maximumCharacters: 12000 });
assert(!merged.passages.some(passage => /historical|future/.test(passage.corpusID)),
  "Preparing excluded editions elsewhere must never place them in a selected current view.");
const explicitlySelected = mergeResearchPassageIndexes([partitions[0], historical]);
assert.equal(explicitlySelected.passages.filter(passage => passage.corpusID === "historical-explicit").length, historical.passageCount);
assert(!explicitlySelected.passages.some(passage => passage.corpusID === "future-explicit"));
assert(searchResearchPassages(explicitlySelected, "PC 700").some(hit => hit.sectionID === "historical-700"),
  "Explicitly selected prior-edition canonical identity stays separate from the current section with the same number.");
assert.equal(future.passages[0].applicabilityStatus, "future-effective", "Merging must not reclassify legal applicability.");
assert.throws(() => mergeResearchPassageIndexes([partitions[0], partitions[0]]), /duplicate canonical section ID/);
assert.throws(() => mergeResearchPassageIndexes([{ ...partitions[0], version: "incompatible" }]), /Compatible canonical/);
const foreign = { ...partitions[0], passages: [{ ...partitions[0].passages[0], corpusID: "unselected" }, ...partitions[0].passages.slice(1)] };
foreign.records = [{ ...partitions[0].records[0], passage: foreign.passages[0] }, ...partitions[0].records.slice(1)];
assert.throws(() => mergeResearchPassageIndexes([foreign]), /canonical source and corpus identity/);
const badPostings = { ...partitions[0], postings: new Map([["pipe", new Uint32Array([partitions[0].records.length, 1])]]) };
assert.throws(() => mergeResearchPassageIndexes([badPostings, partitions[1]]), /Posting ordinals/);

const inheritedQuery = "pipe slope\nPreviously discussed provisions: PC 708";
const currentQuery = "pipe slope";
const exactKeys = new Map([["pipe", 1], ["slope", 1]]);
assert.equal(searchResearchPassages(index, inheritedQuery, { queryWeights: exactKeys })[0].exactReference, true,
  "The default exact-reference query remains backward compatible.");
assert.deepEqual(searchResearchPassages(index, inheritedQuery, { queryWeights: exactKeys, explicitReferenceQuery: currentQuery }),
  searchResearchPassages(index, currentQuery, { queryWeights: exactKeys }),
  "Inherited lexical citations must not receive the hidden exact-reference boost when the current question is supplied.");
assert(searchResearchPassages(index, inheritedQuery, { queryWeights: exactKeys, explicitReferenceQuery: "" })
  .every(hit => hit.exactReference === false), "An explicitly empty reference question means no direct reference priority.");
assert.equal(searchResearchPassages(index, currentQuery, { queryWeights: exactKeys, explicitReferenceQuery: "PC 708" })[0].sectionNumber, "708",
  "A current direct reference retains priority even when lexical retrieval uses separate context.");

console.log("Compact passage index contracts passed: exact legacy and merged ranking/fingerprints, shared canonical records, selected-corpus boundaries, bounded typed postings and unchanged embedding inputs.");
