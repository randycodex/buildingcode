import assert from "node:assert/strict";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import { routeResearchCorpora } from "../research-corpus-registry.mjs";

// Reproduce a practical failure: a broad glossary mentions every scenario word
// somewhere, while the short governing rule uses a punctuated plural and a
// hyphenated equipment name. Neither scenario contains the expected citation.
const catalog = [
  { id: "rule", codePrefix: "MC", sectionNumber: "504.4", title: "Exhaust installation" },
  { id: "glossary", codePrefix: "BC", sectionNumber: "202", title: "Definitions" },
  ...Array.from({ length: 18 }, (_, index) => ({ id: `other-${index}`, codePrefix: "BC", sectionNumber: `1705.${index + 1}`, title: "Building installation" }))
];
const bodies = new Map([
  ["rule", { blocks: [{ id: "rule-text", plainText: "Clothes-dryer exhaust ducts shall terminate outside the building. Screens shall not be installed at the duct termination.", html: '<p>Clothes-dryer exhaust ducts shall terminate outside the building. Screens shall not be installed at the duct termination.</p><img src="rule.png">' }] }],
  ["glossary", { blocks: Array.from({ length: 80 }, (_, index) => ({ id: `entry-${index}`, plainText: `${["Building", "exhaust", "installation", "screen", "dryer", "pest"][index % 6]} definition. ${"Unrelated general background. ".repeat(70)}` })) }],
  ...catalog.slice(2).map((item) => [item.id, { blocks: [{ id: item.id, plainText: "Building installation and inspection requirements.", html: `<p>Building installation and inspection requirements.</p><img src="${item.id}.png">` }] }])
]);
const index = new Map([
  ["screens.", ["rule", "glossary"]], ["clothes-dryer", ["rule"]], ["exhaust", ["rule", "glossary"]],
  ["building", catalog.map((item) => item.id)], ["installation", catalog.map((item) => item.id)],
  ["pest", ["glossary"]]
]);
let visualCalls = 0;
const result = await discoverRelevantEvidence({
  question: "May an insect screen cover the clothes dryer exhaust termination?", catalog, invertedIndex: index,
  readSectionBody: async (section) => bodies.get(section.id),
  resolveVisualSource: async () => { visualCalls += 1; return null; }, limit: 1
});
assert.equal(result.candidates[0].sectionID, "rule");
assert.equal(result.candidates.length, 1);
assert.equal(result.candidates[0].preparationEligible, false, "Deferring image inspection must retain the selected source's blocking requirement.");
assert.equal(visualCalls, 1, "Unselected candidates must not invoke image resolution.");
assert.equal(result.supplementalDefinitionCandidates.length, 0, "A glossary from an unselected discipline is not a definition dependency.");

const question = "For an alteration using the optional 1968 Building Code, does that election also cover new mechanical and plumbing work?";
const routed = routeResearchCorpora({ question });
assert(routed.selected.some((corpus) => corpus.id === "nyc-2022-construction-codes"));
assert(routed.excluded.some((corpus) => corpus.id === "nyc-1968-building-code"));
assert.equal(routeResearchCorpora({ question: "Under the 1968 Building Code, what is the required stair width?" }).selected.length, 0);

const typeCatalog = [
  { id: "hood", codePrefix: "MC", sectionNumber: "507.1", title: "Commercial kitchen hoods" },
  { id: "frame", codePrefix: "BC", sectionNumber: "601.1", title: "Building elements" },
  { id: "type", codePrefix: "BC", sectionNumber: "602.2", title: "Types I and II" }
];
const typed = (question) => discoverRelevantEvidence({ question, catalog: typeCatalog,
  invertedIndex: new Map([["hood", ["hood"]], ["type", ["type"]], ["structural", ["frame"]]]),
  readSectionBody: async (section) => ({ blocks: [{ plainText: section.id === "hood"
    ? "Type I and Type II commercial kitchen hoods shall meet the applicable exhaust requirements."
    : "The fire-resistance rating of the structural frame depends on construction type." }] }), limit: 3 });
const hood = await typed("Can a Type II hood cover a cooking appliance that needs a Type I hood?");
assert(!hood.candidates.filter((item) => item.codePrefix === "BC").some((item) => item.signals.exactTopicRouteTarget));
const frame = await typed("Can sprinklers reduce the required fire-resistance rating of the building structural frame?");
assert(frame.candidates.find((item) => item.sectionID === "frame")?.signals.exactTopicRouteTarget);
console.log("Passage ranking contracts passed: glossary dilution, index punctuation and hyphens, deferred visual checks, and prior-code technical scope.");
