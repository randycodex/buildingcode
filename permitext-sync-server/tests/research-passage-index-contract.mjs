import assert from "node:assert/strict";
import { enactedSection, enactedSectionCatalog } from "../enacted-code-content.mjs";
import {
  buildResearchPassageIndex,
  researchPassagesForSection,
  searchResearchPassages
} from "../research-passage-index.mjs";

const catalog = [
  { id: "fc315", codePrefix: "FC", codeEdition: "2022", codeVersion: "fixture-fc-1", sectionNumber: "315", title: "Combustible Materials Storage" },
  { id: "construction", codePrefix: "BC", codeEdition: "2022", codeVersion: "fixture-bc-1", sectionNumber: "3301", title: "Construction safety" },
  { id: "water", codePrefix: "PC", codeEdition: "2022", codeVersion: "fixture-pc-1", sectionNumber: "704.1", title: "Slope of horizontal drainage piping" },
  { id: "old-water", codePrefix: "PC", codeEdition: "2014", codeVersion: "fixture-pc-2014", sectionNumber: "704.1", title: "Slope of horizontal drainage piping" }
];
const storage = [
  "315.1 General.", "Storage shall comply with this section. Exception: Construction storage shall comply with Chapter 33.",
  "315.2 Storage in buildings.", "Storage shall be orderly and materials shall be stable.",
  "315.2.1 Ceiling clearance.", "Storage shall maintain the required clearance below sprinkler head deflectors.",
  "315.2.2 Means of egress.", "Materials shall not obstruct egress.",
  "315.2.3 Equipment rooms.", "Combustible material shall not be stored in boiler rooms, mechanical rooms or electrical equipment rooms.",
  "315.2.4 Attic storage.", "Concealed spaces shall have the specified protection.",
  "Exceptions:", "1.Areas protected throughout by sprinkler systems.", "2.Group R-3 occupancies."
].join("\n\n");
const tableText = "Horizontal drainage piping shall have slopes in Table 704.1. Size (inches) Minimum Slope (inch per foot) 2 1/2 or less 1/4 3 to 6 1/8 8 or larger 1/16. For SI: 1 inch = 25.4 mm.";
const bodies = new Map([
  ["fc315", { blocks: [{ id: "storage", plainText: storage }] }],
  ["construction", { blocks: [{ id: "long-construction", plainText: `${"Mechanical rooms and storage are mentioned during construction. ".repeat(60)}Construction shall comply with Chapter 33.` }] }],
  ["water", { blocks: [{ id: "slope-table", plainText: tableText, html: '<p>Horizontal drainage piping shall have slopes in Table 704.1.</p><table><tr><th>Size (inches)</th><th>Minimum Slope (inch per foot)</th></tr><tr><td>2 1/2 or less</td><td>1/4</td></tr><tr><td>3 to 6</td><td>1/8</td></tr><tr><td>8 or larger</td><td>1/16</td></tr></table><p>For SI: 1 inch = 25.4 mm.</p>' }] }],
  ["old-water", { blocks: [{ id: "old-slope", plainText: "Legacy drainage pipe slope requirements." }] }]
]);

const index = await buildResearchPassageIndex(catalog, async section => bodies.get(section.id));
const storageHits = searchResearchPassages(index, "Can cardboard boxes be stored in a mechanical room?");
assert.equal(storageHits[0].sectionID, "fc315", "A concise direct rule must outrank a long section with repeated incidental words.");
assert.equal(storageHits[0].subsectionNumber, "315.2.3");
assert.match(storageHits[0].text, /shall not be stored.*mechanical rooms/);
assert(storageHits[0].contextTexts.some(text => /Construction storage shall comply with Chapter 33/.test(text)), "General source exceptions must remain available.");
assert(storageHits[0].contextTexts.some(text => /Storage shall be orderly/.test(text)), "Numbered parent conditions must remain available.");
assert.equal(storageHits[0].scopeComplete, true);
assert.equal(storageHits[0].codeVersion, "fixture-fc-1");
assert.equal(storageHits[0].sectionNumber, "315", "Do not invent a canonical source ID for an embedded subsection.");
for (const hit of index.passages.filter(passage => passage.sectionID === "fc315")) {
  assert.equal(storage.slice(hit.sourceOffsets.start, hit.sourceOffsets.end), hit.text, "Every selected source must be an exact slice of the authoritative block.");
  for (const context of hit.contextTexts) assert(storage.includes(context));
}
const attic = searchResearchPassages(index, "FC 315.2.4 attic storage")[0];
assert.match(attic.text, /Exceptions:[\s\S]*Group R-3/);
assert.equal(attic.exactReference, true);
assert.equal(attic.scopeComplete, true, "The exception/list belongs to its preceding subsection.");
const parent = index.passages.find(passage => passage.subsectionNumber === "315.2");
assert.equal(parent.scopeComplete, false, "Parent heading text alone is incomplete when operative descendants exist.");
assert.match(parent.completeSubsectionText, /315\.2\.3[\s\S]*315\.2\.4/);

const table = searchResearchPassages(index, "horizontal drainage piping 3 to 6 inches slope")[0];
assert.equal(table.sectionID, "water");
const tableRows = index.passages.filter(passage => passage.kind === "table_row");
assert.equal(tableRows.length, 3);
for (const row of tableRows) {
  assert.equal(row.text, tableText, "A table-row ranking hit must preserve the whole table source, including header and SI footnote.");
  assert.match(row.sourceHTML, /^<tr>/);
  assert.match(row.searchText, /Minimum Slope/);
}
assert(index.passagesByID.get(tableRows[0].id) === tableRows[0], "Vector/reranking integrations need stable passage lookup.");
const waterHits = searchResearchPassages(index, "PC 704.1 slope");
assert(waterHits.some(hit => hit.sectionID === "water" && hit.codeEdition === "2022"));
assert(waterHits.some(hit => hit.sectionID === "old-water" && hit.codeEdition === "2014"), "The index retains edition identities; the authorized caller determines the eligible corpus.");

const weighted = searchResearchPassages(index, "unrelated words", { queryWeights: new Map([["mechanical", 1], ["rooms", 1], ["combustible", 4]]) });
assert.equal(weighted[0].sectionID, "fc315");
assert.equal(searchResearchPassages(index, "").length, 0);
assert.equal(searchResearchPassages(index, "anything", { queryWeights: { mechanical: NaN, room: -1 } }).length, 0);
assert.equal(new Set(storageHits.map(hit => hit.sectionID)).size, storageHits.length, "Results are distinct canonical sections, not competing fragments of the same chapter.");

const excluded = researchPassagesForSection(catalog[0], { blocks: [{ id: "ineligible", plainText: "Editorial summary of combustible storage.", researchClaimEligible: false }] });
assert.equal(excluded.length, 0);
await assert.rejects(buildResearchPassageIndex([catalog[0], catalog[0]], async () => bodies.get("fc315")), /duplicate canonical section ID/);
await assert.rejects(buildResearchPassageIndex([catalog[0]], async () => { throw new Error("missing source"); }), /missing source/);
const split = researchPassagesForSection(catalog[1], bodies.get("construction"), { maximumCharacters: 500 });
assert(split.length > 1);
assert.equal(split.map(passage => passage.text).join(""), bodies.get("construction").blocks[0].plainText, "Chunking must neither lose nor change source characters.");
assert(split.every(passage => passage.scopeComplete === false));
const separateBlocks = researchPassagesForSection(catalog[1], { blocks: [
  { id: "condition", plainText: "Where the stated condition applies, the following requirements govern." },
  { id: "rule", plainText: "An enclosure is required around the equipment." },
  { id: "exception-heading", plainText: "Exceptions:" },
  { id: "exception-one", plainText: "1. The stated sprinkler protection exception." },
  { id: "notes", plainText: "Note: Additional source note." }
] });
const rule = separateBlocks.find(passage => passage.blockID === "rule");
assert(rule.contextTexts.some(text => /Where the stated condition/.test(text)));
assert(rule.contextTexts.some(text => /Exceptions:/.test(text)));
assert(rule.contextTexts.some(text => /sprinkler protection exception/.test(text)));
assert(rule.contextTexts.some(text => /Additional source note/.test(text)));

const changed = await buildResearchPassageIndex([catalog[0]], async () => ({ blocks: [{ id: "storage", plainText: `${storage}\nChanged enacted source.` }] }));
const original = await buildResearchPassageIndex([catalog[0]], async () => bodies.get("fc315"));
assert.notEqual(changed.fingerprint, original.fingerprint, "Changed enacted text must invalidate persisted passage/vector indexes.");
const changedVersion = await buildResearchPassageIndex([{ ...catalog[0], codeVersion: "fixture-fc-2" }], async () => bodies.get("fc315"));
assert.notEqual(changedVersion.fingerprint, original.fingerprint);
const changedTitle = await buildResearchPassageIndex([{ ...catalog[0], title: "Updated source heading" }], async () => bodies.get("fc315"));
assert.notEqual(changedTitle.fingerprint, original.fingerprint, "Title/context changes also invalidate semantic vectors and lexical rankings.");

// Test the actual shipped monolithic Fire Code source, not only a synthetic
// splitting fixture. Ordinary questions must retrieve its decisive paragraph.
const enactedCatalog = await enactedSectionCatalog();
const fireStorage = enactedCatalog.find(section => section.codePrefix === "FC" && /^(?:FC\s*)?315$/.test(section.sectionNumber));
assert(fireStorage);
const realIndex = await buildResearchPassageIndex([fireStorage], enactedSectionFromCatalog);
const realHit = searchResearchPassages(realIndex, "Can cardboard boxes be kept in a mechanical room?")[0];
assert.equal(realHit.subsectionNumber, "315.2.3");
assert.match(realHit.text, /Combustible material shall not be stored in boiler rooms, mechanical rooms or electrical equipment rooms\./);
assert(realHit.contextTexts.some(text => /construction and demolition operations/.test(text)));
assert.equal(realHit.scopeComplete, true);
async function enactedSectionFromCatalog(section) { return enactedSection(section.id); }

const fireFlames = enactedCatalog.find(section => section.codePrefix === "FC" && /^(?:FC\s*)?308$/.test(section.sectionNumber));
assert(fireFlames);
const flameBody = await enactedSection(fireFlames.id);
const flamePassages = researchPassagesForSection(fireFlames, flameBody);
const assemblyException = flamePassages.find(passage => passage.subsectionNumber === "308.5.1");
const generalPrecaution = assemblyException.sameSectionReferences.find(reference => reference.subsectionNumber === "308.4");
assert(generalPrecaution, "An internal numbered cross-reference must retain an exact candidate even without a separately cataloged source ID.");
assert.match(generalPrecaution.text, /shall be kept at least 3 feet.*combustible material/);
assert.equal(flameBody.blocks[0].plainText.slice(generalPrecaution.sourceOffsets.start, generalPrecaution.sourceOffsets.end), generalPrecaution.text);
assert.equal(generalPrecaution.sectionID, String(fireFlames.id));
assert.equal(generalPrecaution.applicabilityUnresolved, true, "Retrieving a cross-reference does not decide its application to the user's scenario.");
assert(!assemblyException.contextTexts.includes(generalPrecaution.text), "Alternative dependencies must not forcibly consume the primary rule's evidence budget.");
const safety = flamePassages.find(passage => passage.subsectionNumber === "308.4");
assert.equal(safety.atomicUnits.length, 6);
const distance = safety.atomicUnits.find(unit => unit.itemNumber === "4");
assert.match(distance.text, /^4\.Open flames.*at least 3 feet[\s\S]*combustible waste/);
assert(distance.contextTexts.some(context => /When their use is allowed by this section/.test(context)), "Selecting one list item must preserve its conditional lead-in.");
assert.equal(distance.completeUnit, true);
assert.equal(distance.scopeComplete, false, "A complete listed requirement must never masquerade as a complete enclosing subsection.");
assert.equal(flameBody.blocks[0].plainText.slice(distance.sourceOffsets.start, distance.sourceOffsets.end), distance.text);
const securedSurface = safety.atomicUnits.find(unit => unit.itemNumber === "3");
assert.match(securedSurface.text, /except open-flame devices designed to be surface mounted/);
const decoration = flamePassages.find(passage => passage.subsectionNumber === "308.5.2");
const tipOver = decoration.atomicUnits.find(unit => unit.itemNumber === "4");
assert.match(tipOver.text, /Exception: Devices that self-extinguish/);
const allowedUses = assemblyException.atomicUnits.find(unit => unit.itemNumber === "1");
assert.match(allowedUses.text, /provided that safety precautions are taken/);
assert.match(allowedUses.text, /1\.1\.Use of candles[\s\S]*1\.6\.Where necessary/);

const foreignReferenceText = "315.1 General.\n\nThis section contains rules.\n\n315.2 Equipment.\n\nSee PC Section 315.4 and Section 315.5 of the Building Code.\n\n315.4 Plumbing-number collision.\n\nA different fire requirement.\n\n315.5 Building-number collision.\n\nAnother fire requirement.";
const foreignReferences = researchPassagesForSection(catalog[0], { blocks: [{ id: "foreign-references", plainText: foreignReferenceText }] });
assert.equal(foreignReferences.find(passage => passage.subsectionNumber === "315.2").sameSectionReferences.length, 0, "Do not bind explicitly different-code references to a coincidentally numbered internal rule.");

console.log(`Research passage index contract passed: exact numbered source slices, parent conditions, exceptions, complete table sources, source invalidation and actual FC 315 recall (${realIndex.passageCount} passages).`);
