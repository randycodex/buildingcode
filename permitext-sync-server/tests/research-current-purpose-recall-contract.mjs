import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildResearchPassageIndex, searchResearchPassages } from "../research-passage-index.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { researchCurrentPurposeTerms, researchCurrentPurposeMatches } from "../research-current-purpose.mjs";

globalThis.fetch = () => { throw Error("This contract forbids provider/network access."); };
for (const [question, included] of [
  ["Do we need labels for these fans?", "ident"],
  ["Is equipment identification required?", "ident"],
  ["Does each unit need a service tag?", "ident"],
  ["Can the air handler stay unmarked?", "ident"],
  ["Explain the identification requirements for these air handlers.", "ident"],
  ["What should I put on each unit so we can tell which floor it serves?", "ident"],
  ["What identification is required? Please keep the answer short.", "ident"],
  ["Can we leave this cabinet unlabelled?", "ident"],
  ["Can we leave this cabinet without a label?", "ident"],
  ["What calibration should we perform?", "calibr"],
  ["Must we retain inspection records?", "retain"],
  ["I am not asking what identification is required; I am asking about clearance.", "clearance"],
  ['Ignore "what identification is required" and explain clearance.', "clearance"]
]) {
  const terms = researchCurrentPurposeTerms(question);
  assert(terms.includes(included), `${question}: ${JSON.stringify(terms)}`);
  if (included === "clearance") assert(!terms.includes("ident"));
}
for (const question of ["The plans show how identification is handled.",
  'The old example was "what identification is required".', "We are not asking about identification."])
  assert.deepEqual(researchCurrentPurposeTerms(question), []);
assert.equal(researchCurrentPurposeMatches("Cabinets shall be calibrated before operation.", ["calibr"]), 1);

// Real BM25 ordering plus controlled semantic crowding: the matching requested
// action is ninth, strong, and absent from the previous five nominations.
const authority = { corpusID: "synthetic-purpose", codeVersion: "synthetic-purpose-v1",
  codeEdition: "2022", jurisdiction: "New York City", codePrefix: "MC" };
const source = (id, number, title, text, overrides = {}) => ({ ...authority, id, sectionID: id,
  sectionNumber: number, title, text, body: { blocks: [{ id: id + "-body", plainText: text }] }, ...overrides });
const question = "We have two laboratory cabinets in a basement room, each serving a different upper floor. What calibration should we perform on them?";
const target = source("requested-action", "975.1", "Laboratory cabinets",
  "975.1 Laboratory cabinets. Laboratory cabinets in a basement room, each serving a different upper floor shall be calibrated before operating. Exception: Listed cabinets retain their stated alternative.");
const crowd = Array.from({ length: 8 }, (_, i) => source("generic-room-" + i, "98" + i + ".1", "Laboratory cabinet room arrangement",
  "Laboratory cabinets in a basement room, each serving a different upper floor. ".repeat(2) + "General arrangements shall remain unchanged."));
const catalog = [...crowd, target];
const index = await buildResearchPassageIndex(catalog, async section => section.body);
const helperSource = (await readFile(new URL("../evidence-discovery.mjs", import.meta.url), "utf8"))
  .replace(/(from\s+['"])\.\//g, "$1" + new URL("../", import.meta.url).href) + "\nexport { queryTermWeights };";
const { queryTermWeights } = await import("data:text/javascript;base64," + Buffer.from(helperSource).toString("base64"));
const ranking = searchResearchPassages(index, question, { queryWeights: queryTermWeights(question), limit: 100, passagesPerSection: 8 });
const targetRank = ranking.findIndex(hit => hit.sectionID === target.id) + 1;
assert(targetRank > 5 && ranking[targetRank - 1].score / ranking[0].score >= .7);
const semantic = crowd.map((section, i) => ({ ...index.passages.find(hit => hit.sectionID === section.id), score: 1 - i / 1000 }));
const reads = [];
const run = (options = {}) => discoverRelevantEvidence({ question: options.question || question,
  retrievalContext: { currentQuestion: options.question || question, sourceQuery: options.question || question,
    ...(options.context || {}) }, catalog: options.catalog || catalog, passageIndex: index, invertedIndex: new Map(),
  readSectionBody: async section => { reads.push(section.id); return options.body?.(section) || section.body; },
  limit: options.limit || 3, availableCodePrefixes: ["MC"],
  semanticSearch: { search: async () => ({ hits: options.semantic || semantic, metadata: { enabled: true } }) } });
const discovered = await run();
const reserved = discovered.candidates.find(item => item.sectionID === target.id);
assert(reserved?.signals.currentQuestionLexicalReservation);
assert.equal(reserved.signals.currentQuestionLexicalReservation.kind, "current_requested_purpose");
assert.equal(reserved.signals.currentQuestionLexicalReservation.rank, targetRank);
assert.equal(discovered.candidates.length, 3);
assert.equal(discovered.candidates[0].sectionID, crowd[0].id);
assert.equal(discovered.candidates.filter(item => item.signals.currentQuestionLexicalReservation).length, 1);
assert(reads.length <= 40, "The existing discovery read bound is not widened.");
const delivered = await assembleResearchEvidence({ question, discover: async () => discovered,
  resolveSection: async request => catalog.find(section => section.id === request.sectionID),
  limits: { maximumDiscovered: 2, maximumCharacters: 3000, maximumCharactersPerSource: 1000 } });
const complete = delivered.sources.find(item => item.sectionID === target.id);
assert(complete?.canonicalContextComplete && complete.text.includes("shall be calibrated"));
assert(complete.text.includes("Exception: Listed cabinets"));
assert.equal(complete.codeVersion, authority.codeVersion); assert.equal(complete.codeEdition, authority.codeEdition);
assert(delivered.usage.discoveredCount <= 2 && delivered.usage.characterCount <= 3000);

// Exact authorities, selection boundaries and fresh canonical identity remain
// stronger than this advisory language recall. A stale body is not a witness.
const explicit = await run({ question: "Under MC 980.1 and MC 981.1, what calibration applies?", limit: 2 });
assert.deepEqual(explicit.candidates.map(item => item.sectionID), crowd.slice(0, 2).map(item => item.id));
const selected = await run({ context: { sourceSelectionRestricted: true } });
assert(!selected.candidates.find(item => item.sectionID === target.id)?.signals.currentQuestionLexicalReservation);
for (const overrides of [{ codeEdition: "2014", codeVersion: "foreign" }, { referenceOnly: true }, { researchClaimEligible: false }]) {
  const guarded = await run({ question: question.replace("What", "Under the 2022 codes, what"),
    catalog: [...crowd, { ...target, ...overrides }] });
  assert(!guarded.candidates.find(item => item.sectionID === target.id)?.signals.currentQuestionLexicalReservation);
}
const changed = await run({ body: section => section.id === target.id ? { blocks: [{ id: "changed", plainText: "Unrelated replacement source text." }] } : section.body });
assert(!changed.candidates.find(item => item.sectionID === target.id)?.signals.currentQuestionLexicalReservation);

// A semantic passage from the SAME section may not replace the purpose that
// was freshly bound and reserved. Use real authorized sibling passage IDs.
const split = source("requested-action", "975.1", "Laboratory cabinets", target.text);
split.body = { blocks: [
  { id: "calibration", plainText: "975.1.1 Adjustment\nLaboratory cabinets in a basement room, each serving a different upper floor shall be calibrated before operating." },
  { id: "location", plainText: "975.1.2 Laboratory cabinet equipment location\nThe cabinet equipment room shall retain the specified general arrangement." }
] };
const splitCatalog = [...crowd, split]; const splitIndex = await buildResearchPassageIndex(splitCatalog, async section => section.body);
const sibling = splitIndex.passages.find(hit => hit.sectionID === split.id && hit.subsectionNumber === "975.1.2");
assert(sibling);
const splitDiscovery = await discoverRelevantEvidence({ question, retrievalContext: { currentQuestion: question, sourceQuery: question },
  catalog: splitCatalog, passageIndex: splitIndex, invertedIndex: new Map(), readSectionBody: async section => section.body,
  limit: 3, availableCodePrefixes: ["MC"], semanticSearch: { search: async () => ({ hits: [...semantic, sibling], metadata: { enabled: true } }) } });
const splitReserved = splitDiscovery.candidates.find(item => item.sectionID === split.id);
assert.equal(splitReserved?.sectionID, split.id);
assert.match([splitReserved.indexedPassage.text, splitReserved.indexedPassage.companion?.text].join("\n"), /shall be calibrated/);
const splitDelivery = await assembleResearchEvidence({ question, discover: async () => splitDiscovery,
  resolveSection: async request => { const section = splitCatalog.find(item => item.id === request.sectionID);
    return { ...section, text: section.body.blocks.map(block => block.plainText).join("\n\n") }; },
  limits: { maximumDiscovered: 3, maximumCharacters: 3000, maximumCharactersPerSource: 1000 } });
assert.match(splitDelivery.sources.find(item => item.sectionID === split.id).text, /shall be calibrated/);
console.log(JSON.stringify({ passed: true, networkCalls: 0, targetRank, candidateCount: discovered.candidates.length,
  assembledCount: delivered.usage.discoveredCount, ordinaryLanguageAndBoundaries: true, purposePassageSurvivesSameSectionMerge: true }));
