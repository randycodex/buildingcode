import assert from "node:assert/strict";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { researchRulePacketPlan, suppliedRuleReference } from "../research-rule-packets.mjs";

// Deliberately invented section numbers: recovery must follow evidence, not
// another hand-maintained list of answers to known benchmark questions.
const section = (number, text, extra = {}) => ({ sectionID: `MC-2022-${number}`,
  codePrefix: "MC", sectionNumber: number, codeEdition: "2022", codeVersion: "mc-v1",
  corpusID: "mc-2022", title: "Test provision", text, ...extra });
const sections = [
  section("777.1", "Components shall satisfy Section 777.2."),
  section("777.2", "Use the limits in Table 777.3, including its footnotes."),
  section("777.3", "Table 777.3. Component A: 6 units. Note a: only during occupied periods.", {
    richSources: [{ id: "test-table", kind: "table", reference: "MC Table 777.3",
      text: "Table 777.3. Component A: 6 units. Note a: only during occupied periods.",
      contentHash: "fixture", rowCount: 2, grids: [{ rows: [
        { cells: [{ text: "Component" }, { text: "Limit" }] },
        { cells: [{ text: "A" }, { text: "6 (a)" }] }
      ] }] }]
  })
];
let reads = [];
const assemble = (options = {}) => assembleResearchEvidence({ question: "Explain the component rule in MC 777.1.",
  discover: async () => ({ candidates: [{ ...sections[0], rank: 1, selectedText: sections[0].text,
    signals: { exactReference: true } }] }),
  resolveSection: async request => { reads.push(request); return sections.find(s => s.sectionNumber === request.sectionNumber); },
  ...options
});
const result = await assemble();
assert(result.sources.some(s => s.sectionNumber === "777.3" && s.richSourceGrids?.length));
assert.match(result.sources.find(s => s.sectionNumber === "777.3").text, /only during occupied periods/);
assert.equal(result.rulePackets.recoveredReferenceCount, 1);
assert.equal(result.rulePackets.recoveryReads, 1);
assert(!result.rulePackets.packets.find(p => p.sectionNumber === "777.2").missingReferences.length);
assert(reads.every(r => r.codeEdition === "2022" && r.corpusID === "mc-2022"));
assert(result.usage.characterCount <= result.limits.maximumCharacters);

reads = [];
const bounded = await assemble({ limits: { maximumCrossReferences: 1 } });
assert(!bounded.sources.some(s => s.sectionNumber === "777.3"));
assert(bounded.rulePackets.packets.some(p => p.missingReferences.some(r => r.sectionNumber === "777.3")));
assert.equal(bounded.rulePackets.recoveryReads, 0);

const strict = await assemble({ pinnedEvidence: [sections[0]],
  strategy: { mode: "pinned_first", reason: "question_explicitly_bounded_to_selected_evidence" } });
assert.equal(strict.rulePackets.recoveryReads, 0);
assert(!strict.sources.some(s => s.sectionNumber === "777.3"));

// A wrong edition or bare text is not a recovered table.
assert(!suppliedRuleReference([{ ...result.sources.find(s => s.sectionNumber === "777.3"), codeEdition: "2014" }],
  { codePrefix: "MC", sectionNumber: "777.3", referenceKind: "table", codeEdition: "2022" }));
assert(!suppliedRuleReference([{ ...sections[2], canonicalContextComplete: true }],
  { codePrefix: "MC", sectionNumber: "777.3", referenceKind: "table" }));
const cross = researchRulePacketPlan({ sources: [{ ...sections[0], origin: "permitext_discovered",
  retrievalRank: 1, sourceID: "source-a", canonicalContextComplete: true }], canonicalSources: sections,
  referencesFor: () => [{ codePrefix: "BC", sectionNumber: "888.1" }] });
assert.equal(cross.recoveryReferences[0].codeEdition, "2022");
assert.equal(cross.recoveryReferences[0].corpusID, undefined);
assert.equal(cross.recoveryReferences[0].codeVersion, undefined);
let searches = [];
const parent = { ...sections[2], sectionID: "MC-table-parent", sectionNumber: "777.4" };
const aliasTable = await assemble({
  discover: async request => {
    searches.push(request.question);
    return { candidates: [searches.length === 1 ? { ...sections[0], rank: 1 } : parent] };
  },
  resolveSection: async request => request.sectionID === parent.sectionID ? parent
    : sections.slice(0, 2).find(source => source.sectionNumber === request.sectionNumber)
});
assert.equal(aliasTable.rulePackets.recoverySearchCount, 1);
assert.equal(searches.length, 2, "Only one targeted library search after initial retrieval");
assert.equal(searches[1], "MC Table 777.3", "Recovery excludes conversation and project inventory noise");
assert(aliasTable.sources.some(source => source.sectionID === parent.sectionID && source.richSourceGrids));
const failedSearch = await assemble({ discover: async request => {
  if (request.question === "MC Table 777.3") throw new Error("Search unavailable");
  return { candidates: [{ ...sections[0], rank: 1 }] };
}, resolveSection: async request => sections.slice(0, 2).find(s => s.sectionNumber === request.sectionNumber) });
assert(failedSearch.sources.some(s => s.sectionNumber === "777.1"), "Recovery failure preserves supported primary evidence");
assert(failedSearch.rulePackets.packets.some(p => p.missingReferences.length));
console.log("Rule packets recover second-hop tables with notes, preserve bounds and pin scope, and isolate editions.");
