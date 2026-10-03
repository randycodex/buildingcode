import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { targetedDefinitionExcerpt } from "../research-definition-excerpts.mjs";
import { researchAssemblyCrossReferences, researchBodyForCatalogSection } from "../app.mjs";
import { zoningSectionCatalog, zoningSection, zoningSyncCodeVersion } from "../zoning-content.mjs";

globalThis.fetch = () => { throw new Error("Network/provider calls forbidden in cross-reference completeness regression."); };
const compact = value => String(value).replace(/\s+/g, " ").trim();
const catalog = await zoningSectionCatalog();
async function zoning(number) {
  const summary = catalog.find(section => section.sectionNumber === number);
  const body = await zoningSection(summary.id);
  return { ...summary, sectionID: String(summary.id), body, zoning: body.zoning,
    codeVersion: zoningSyncCodeVersion, codeEdition: body.zoning.version, corpusID: "nyc-zoning-resolution",
    text: body.blocks.map(block => block.plainText || "").join("\n\n") };
}
async function construction(id) {
  const body = await researchBodyForCatalogSection({ id, corpusID: "nyc-2022-construction-codes", codePrefix: "BC" });
  return { sectionID: id, codePrefix: "BC", sectionNumber: body.sectionNumber, title: body.title, body,
    codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1",
    codeEdition: "2022 New York City Construction Codes", corpusID: "nyc-2022-construction-codes",
    text: body.blocks.map(block => block.plainText || "").join("\n\n") };
}
const cases = [
  { primary: await zoning("36-461"), dependency: await zoning("36-48"), definitions: await zoning("12-10"),
    question: "Can owners use electric vehicle charging stations in accessory parking in a building designed for residential use?",
    decisive: /owners, occupants, employees, customers, residents or visitors/ },
  { primary: await construction("2438"), dependency: await construction("2437"), definitions: await construction("113"),
    question: "Can ordinary ventilation ducts pass through an interior exit stair enclosure?",
    decisive: /Exception: Membrane penetrations[\s\S]+714\.3\.2\./ }
];
for (const test of cases) {
  const values = [test.primary, test.dependency, test.definitions];
  for (const value of values) value.crossReferences = researchAssemblyCrossReferences(value,
    values.map(source => ({ ...source, id: source.sectionID })));
  const definitionQuery = `${test.question}\n${test.primary.text.slice(0, 4000)}`;
  const optional = targetedDefinitionExcerpt(test.definitions, definitionQuery, { maximumCharacters: 2500 });
  assert(optional && optional.text.length > compact(test.dependency.text).length,
    "The actual supplemental definition packet can consume the room needed by the complete referenced rule.");
  const budget = compact(test.primary.text).length + optional.text.length;
  const packet = await assembleResearchEvidence({ question: test.question,
    discover: async () => ({ candidates: [{ ...test.primary, rank: 1 }],
      supplementalDefinitionCandidates: [{ ...test.definitions,
        evidencePriority: { primaryFunction: "definition", functions: ["definition"] } }] }),
    resolveSection: async request => values.find(source =>
      source.codePrefix === request.codePrefix && source.sectionNumber === request.sectionNumber),
    limits: { maximumCharacters: budget, maximumSupplementalCharacters: budget, maximumCharactersPerSource: 12000 }
  });
  const dependency = packet.sources.find(source => source.sectionID === test.dependency.sectionID);
  assert(dependency, `${test.dependency.sectionNumber}: direct source must arrive before optional definitions.`);
  assert.equal(compact(dependency.text), compact(test.dependency.text));
  assert.equal(dependency.canonicalContextComplete, true);
  assert.equal(dependency.truncated, false);
  assert.match(dependency.text, test.decisive);
  assert(packet.usage.characterCount <= budget);
  assert.equal(packet.usage.characterCount, packet.sources.reduce((sum, source) => sum + source.text.length, 0));
  const definition = packet.sources.find(source => source.sectionID === test.definitions.sectionID);
  assert(!definition || packet.sources.indexOf(dependency) < packet.sources.indexOf(definition));
  assert.equal(dependency.codeEdition, test.dependency.codeEdition);
}

// Invented numbers exercise canonical dependency boundaries independently of
// legal-answer keys. Oversized dependency recovery must not claim that a child
// retained enclosing scope or closing exceptions across arbitrary source blocks.
const defaultScope = { id: "scope", plainText: "990.1 General\nThese provisions apply only to outdoor installations." };
const child = { id: "child", plainText: "990.2 Heat extraction fans\nHeat extraction fans shall discharge through a dedicated outlet." };
const descendant = { id: "descendant", plainText: "990.2.1 Outlet condition\nThe outlet must retain its stated protective screening." };
const exception = { id: "exception", plainText: "Exception: Stated sealed-loop devices are exempt." };
const largeSibling = { id: "large-sibling", plainText: "990.3 Other devices\n" + "Unrelated control provision. ".repeat(400) };
const table = { id: "table", plainText: "Outlet configuration | Constraint\nStandard | stated mesh\n990.3 Control | stated grille",
  html: "<table><tr><th>Outlet configuration</th><th>Constraint</th></tr><tr><td>Standard</td><td>stated mesh</td></tr><tr><td>990.3 Control</td><td>stated grille</td></tr></table>" };
const matrix = [
  { name: "single-block child and local exception", blocks: [{ id: "single", plainText:
    `${defaultScope.plainText}\n\n${child.plainText}\n${exception.plainText}\n\n${largeSibling.plainText}` }] },
  { name: "large preceding scope", blocks: [{ ...defaultScope, plainText:
    `${defaultScope.plainText}\n${"Complete enclosing installation conditions. ".repeat(80)}` }, child, exception, largeSibling] },
  { name: "split descendant and closing exception", blocks: [defaultScope, child, descendant, exception, largeSibling] },
  { name: "unnumbered continuation", blocks: [defaultScope, child,
    { id: "continuation", plainText: "The outlet must also retain its weather hood." }, exception, largeSibling] },
  { name: "table markup with numeric-looking cell and footnote", blocks: [defaultScope, child, table,
    { id: "footnote", plainText: "Footnote: The stated grille condition applies only to the enclosed configuration." }, exception, largeSibling] },
  { name: "closing enclosing exception after a sibling", blocks: [defaultScope, child,
    { id: "next-child", plainText: "990.2.2 Other outlets\n" + "Further outlet condition. ".repeat(200) },
    { id: "parent-exception", plainText: "Exception to Section 990.2: Stated sealed-loop installations are exempt." }, largeSibling] },
  { name: "referenced parent itself is a nested section", root: "990.2", blocks: [
    { id: "parent", plainText: "990.2 Outlet provisions\nThese provisions apply only to outdoor installations." },
    descendant,
    { id: "sibling", plainText: "990.2.2 Other outlets\n" + "Further outlet condition. ".repeat(200) },
    { id: "parent-exception", plainText: "Exception to Section 990.2: Stated sealed-loop installations are exempt." }
  ] }
];
async function fixturePacket({ blocks, root = "990", richSources = [], limits = { maximumCharacters: 1200, maximumCharactersPerSource: 800 }, strict = false }) {
  const primary = { sectionID: "mc-primary", codePrefix: "MC", sectionNumber: "991", title: "Equipment",
    codeEdition: "2022", codeVersion: "fixture-v1", corpusID: "fixture-mc",
    text: `Equipment shall comply with Section ${root}.`, crossReferences: [{ codePrefix: "MC", sectionNumber: root }] };
  const parent = { ...primary, sectionID: "mc-parent", sectionNumber: root, title: "Equipment provisions",
    crossReferences: [], body: { blocks }, text: blocks.map(block => block.plainText).join("\n\n"), richSources };
  return assembleResearchEvidence({ question: strict ? "Using only the selected passage, explain the rule."
      : "How do heat extraction fans discharge?",
    discover: async () => ({ candidates: [{ ...primary, rank: 1 }] }),
    resolveSection: async request => [primary, parent].find(source => source.sectionNumber === request.sectionNumber), limits,
    ...(strict ? { pinnedEvidence: [{ ...primary, selectedText: primary.text }],
      strategy: { mode: "pinned_first", reason: "question_explicitly_bounded_to_selected_evidence" } } : {})
  });
}
for (const item of matrix) {
  const packet = await fixturePacket(item);
  assert(!packet.sources.some(source => source.sectionID === "mc-parent"), item.name);
  assert(packet.limitations.some(limitation => limitation.kind === "cross-reference-context-incomplete"), item.name);
  assert(packet.rulePackets.packets[0].missingReferences.some(reference => reference.sectionNumber === (item.root || "990")), item.name);
  assert(packet.sources.every(source => !source.indexedPassage?.completeSubsection), item.name);
  assert(packet.usage.characterCount <= packet.limits.maximumCharacters, item.name);
}

// Complete canonical dependencies remain eligible: every scope condition,
// descendant, prose continuation, table value, note and exception stays intact.
const completeBlocks = [defaultScope, child, descendant,
  { id: "continuation", plainText: "The outlet must retain its weather hood." }, table,
  { id: "footnote", plainText: "Footnote: The grille condition applies only to enclosed configurations." }, exception];
const complete = await fixturePacket({ blocks: completeBlocks });
const completeParent = complete.sources.find(source => source.sectionID === "mc-parent");
assert(completeParent?.canonicalContextComplete);
assert.equal(completeParent.truncated, false);
assert.equal(completeParent.text, completeBlocks.map(block => block.plainText).join("\n\n"));
assert(!complete.rulePackets.packets[0].missingReferences.length);
assert(complete.usage.characterCount <= complete.limits.maximumCharacters);

// A canonically resolved complete grid still fits normally. Its text is
// accounted in the unchanged budget, and it does not claim full parent scope.
const tableText = `MC Table 990.2\n${table.plainText}`;
const grids = [{ rows: [
  { cells: [{ text: "Outlet configuration" }, { text: "Constraint" }] },
  { cells: [{ text: "Standard" }, { text: "stated mesh" }] },
  { cells: [{ text: "990.3 Control" }, { text: "stated grille" }] }
] }];
const canonicalTable = { id: "canonical-outlet-grid", kind: "table", reference: "MC Table 990.2",
  text: tableText, rowCount: 3, grids,
  contentHash: createHash("sha256").update(JSON.stringify({ reference: "MC Table 990.2", text: tableText, grids })).digest("hex") };
const withGrid = await fixturePacket({ blocks: [defaultScope,
  { ...child, plainText: `${child.plainText} See Table 990.2.` }, table, exception, largeSibling], richSources: [canonicalTable] });
const gridSource = withGrid.sources.find(source => source.richSourceID === canonicalTable.id);
assert(gridSource);
assert.equal(gridSource.text, tableText);
assert.deepEqual(gridSource.richSourceGrids, grids);
assert.equal(gridSource.canonicalContextComplete, false);
assert.equal(gridSource.indexedPassage, undefined);
assert(withGrid.rulePackets.packets[0].missingReferences.some(reference => reference.sectionNumber === "990"));
assert.equal(withGrid.usage.characterCount, withGrid.sources.reduce((sum, source) => sum + source.text.length, 0));
assert(withGrid.usage.characterCount <= withGrid.limits.maximumCharacters);

const strict = await fixturePacket({ blocks: completeBlocks, strict: true });
assert.equal(strict.sources[0].text, "Equipment shall comply with Section 990.");
assert(!strict.sources.some(source => source.sectionID === "mc-parent"));
assert.equal(strict.rulePackets.recoveryReads, 0);
console.log("Cross-reference completeness passed: actual ZR36-48 and BC1023.5 closing text precedes optional definitions; oversized child recovery stays explicitly unresolved across split scope/descendants/prose/table markup/parent exceptions; complete canonical references and complete grids still fit normally; selection/edition/total-budget boundaries intact; no API calls.");
