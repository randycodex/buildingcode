import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildResearchPassageIndex, searchResearchPassages } from "../research-passage-index.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { researchCurrentPurposeTerms, researchCurrentPurposeMatches, researchCurrentEditionContext } from "../research-current-purpose.mjs";

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

// Edition belongs to the affirmative authority, not the first date. The
// helper is vocabulary-only and treats a true comparison conservatively.
for (const [request, edition, ambiguous = false] of [
  ["Under the 2022 codes, what calibration is required?", "2022"],
  ["Ignore the 2014 code. Under the 2022 codes, what calibration is required?", "2022"],
  ["Ignore the 2014 code and use the 2022 code. What calibration is required?", "2022"],
  ["The previous 2014 code assumption was wrong. Under the 2022 codes, what calibration is required?", "2022"],
  ['The example says "under the 2014 code". Under the 2022 codes, what calibration is required?', "2022"],
  ["Use the 2022 code, rather than the 2014 edition. What calibration is required?", "2022"],
  ["The building was constructed in 2014. Under the 2022 codes, what calibration is required?", "2022"],
  ["The equipment was installed in 2014 under the 2022 codes. What calibration is required?", "2022"],
  ["Our 2014 building is under the codes. What calibration is required?", null],
  ["The cabinets were installed in 2014. What calibration does the code require?", null],
  ["The 2014 building must meet the code. Under the 2022 code, what calibration is required?", "2022"],
  ["The 2014 equipment follows the code. Under the 2022 code, what calibration is required?", "2022"],
  ["The 2014 cabinet follows code and the 2022 code governs. What calibration is required?", "2022"],
  ["Under the 2022 New York City Construction Codes, what calibration is required?", "2022"],
  ["Under the 2014 NYC Mechanical Code, what calibration is required?", "2014"],
  ["Under the 2014 Fuel Gas Code, what calibration is required?", "2014"],
  ["Under the 2022 Existing Building Code, what calibration is required?", "2022"],
  ["Under the 2014 MC, what calibration is required?", "2014"],
  ["Under MC 2014, what calibration is required?", "2014"],
  ["Under the 2014 code, what calibration is required?", "2014"],
  ["Under the old 2014 code, what calibration should we perform?", "2014"],
  ["The old equipment was installed in 2014 and is reviewed under the 2022 code. What calibration should we perform?", "2022"],
  ["The equipment has an incorrect label under the 2022 code. What identification is required?", "2022"],
  ["In the code edition of 2014, what calibration is required?", "2014"],
  ["Compare the 2014 and 2022 codes. What calibration is required?", null, true],
  ["Under the 2014 code or the 2022 code, what calibration is required?", null, true],
  ["Under the 2014 code. Under the 2022 code. What calibration is required?", null, true],
  ["Can we leave the cabinet without a label under the 2022 code?", "2022"],
  ["Not under the 2014 code. Under the 2022 code, what calibration is required?", "2022"],
  ["What calibration is required under the 2022 code, not the 2014 code?", "2022"]
]) assert.deepEqual(researchCurrentEditionContext(request), { edition, ambiguous }, request);

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
    ...(options.context || {}) }, catalog: options.catalog || catalog, passageIndex: options.index || index, invertedIndex: new Map(),
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

// Matched actual discovery paths: ignored/retracted/quoted/construction years
// retain the same complete purpose candidate in the unchanged three slots.
const affirmative = question.replace("on them?", "on them under the 2022 codes?");
for (const request of [affirmative, "Ignore the 2014 code. " + affirmative,
  "The previous 2014 code assumption was wrong. " + affirmative,
  'Ignore "under the 2014 code". ' + affirmative,
  "The building was constructed in 2014. " + affirmative,
  "The cabinets were installed in 2014. " + affirmative,
  "The 2014 building must meet the code. " + affirmative,
  "The 2014 equipment follows the code. " + affirmative]) {
  const found = await run({ question: request });
  assert.equal(found.candidates.find(item => item.sectionID === target.id)?.signals.currentQuestionLexicalReservation?.kind,
    "current_requested_purpose", request);
  assert.equal(found.candidates.length, 3);
}
// Noncurrent editions are equally eligible when they are the affirmative
// request and the indexed/fresh authority really belongs to that edition.
const historicalCatalog = catalog.map(item => ({ ...item, codeEdition: "2014", codeVersion: "synthetic-historical-v1" }));
const historicalIndex = await buildResearchPassageIndex(historicalCatalog, async item => item.body);
const historicalSemantic = historicalCatalog.slice(0, 8).map((item, i) =>
  ({ ...historicalIndex.passages.find(hit => hit.sectionID === item.id), score: 1 - i / 1000 }));
const historical = await run({ question: question.replace("on them?", "on them under the 2014 code?"),
  catalog: historicalCatalog, index: historicalIndex, semantic: historicalSemantic });
assert.equal(historical.candidates.find(item => item.sectionID === target.id)?.signals.currentQuestionLexicalReservation?.kind,
  "current_requested_purpose");
const foreignTarget = { ...target, codeEdition: "2014", codeVersion: "synthetic-historical-v1" };
const mixedCatalog = [...crowd, foreignTarget];
const mixedIndex = await buildResearchPassageIndex(mixedCatalog, async item => item.body);
const foreignFound = await run({ question: affirmative, catalog: mixedCatalog, index: mixedIndex });
assert(!foreignFound.candidates.find(item => item.sectionID === target.id)?.signals.currentQuestionLexicalReservation,
  "An actually indexed/fresh foreign edition cannot receive current-purpose nomination or reservation.");
for (const request of ["Compare the 2014 and 2022 codes. " + question,
  question.replace("on them?", "on them under the 2014 code or the 2022 code?")]) {
  const found = await run({ question: request });
  assert(!found.candidates.find(item => item.sectionID === target.id)?.signals.currentQuestionLexicalReservation);
}

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
  assembledCount: delivered.usage.discoveredCount, ordinaryLanguageAndBoundaries: true, purposePassageSurvivesSameSectionMerge: true, affirmativeEditionContrasts: true }));
