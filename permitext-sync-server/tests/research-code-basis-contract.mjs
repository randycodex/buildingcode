import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { immutableEvidenceSnapshot, immutableResearchAnswer } from "../project-foundation-contract.mjs";
import { resolveResearchCodeBasis } from "../research-code-basis.mjs";
import {
  createResearchCorpusRegistry,
  routeResearchCorpora
} from "../research-corpus-registry.mjs";

const availableCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const availableCodeEdition = "2022 New York City Construction Codes";
const resolvedAt = "2026-08-10T12:00:00.000Z";
const registry = createResearchCorpusRegistry();
const constructionPlan = routeResearchCorpora({
  question: "What does BC 101.1 require?",
  registry
});

const unassigned = resolveResearchCodeBasis({
  availableCorpora: registry,
  corpusPlan: constructionPlan,
  resolvedAt
});
assert.equal(unassigned.codeYear, 2022);
assert.equal(unassigned.retrievalScope, "routed-multi-corpus");
assert.equal(unassigned.basisSource, "permitext-router");
assert.deepEqual(unassigned.searchedCorpora.map((corpus) => corpus.id), ["nyc-2022-construction-codes"]);
assert.match(unassigned.disclosure, /Sources searched: 2022 NYC Construction Codes/);

const mixedPlan = routeResearchCorpora({
  question: "Compare BC 903 with FC 901.",
  registry
});
const mixedBasis = resolveResearchCodeBasis({
  availableCorpora: registry,
  corpusPlan: mixedPlan,
  resolvedAt
});
assert.equal(mixedBasis.codeYear, null);
assert.equal(mixedBasis.codeVersion, "multiple-authorized-corpora");
assert.equal(mixedBasis.searchedCorpora.length, 2);
assert.match(mixedBasis.disclosure, /2022 NYC Construction Codes · 2022 NYC Fire Code/);

const projectDefault = resolveResearchCodeBasis({
  projectID: "project-1",
  projectCodeVersion: "nyc-2022",
  availableCorpora: registry,
  corpusPlan: constructionPlan,
  resolvedAt
});
assert.equal(projectDefault.basisSource, "project-default");
assert.equal(projectDefault.projectCodeVersionSupported, true);
assert.match(projectDefault.disclosure, /Project default/);

const zoningPlan = routeResearchCorpora({
  question: "What does ZR 12-01 control?",
  registry
});
const unavailableZoning = resolveResearchCodeBasis({
  projectID: "project-2",
  projectCodeVersion: "NYC Zoning Resolution",
  availableCorpora: registry,
  corpusPlan: zoningPlan,
  resolvedAt
});
assert.equal(unavailableZoning.projectCodeVersionRecognized, true);
assert.equal(unavailableZoning.projectCodeVersionSupported, false);
assert.equal(unavailableZoning.retrievalScope, "routed-multi-corpus");
assert.deepEqual(unavailableZoning.searchedCorpora, []);
assert.deepEqual(unavailableZoning.unavailableCorpora.map((corpus) => corpus.id), ["nyc-zoning-resolution"]);
assert.match(unavailableZoning.disclosure, /Zoning Resolution unavailable for Research/);
assert.match(unavailableZoning.limitation, /was not searched.*approval/i);

const historicalProjectPlan = routeResearchCorpora({
  question: "What does the selected code require?",
  projectCodeVersion: "2014 NYC Construction Codes",
  registry
});
const historicalProjectDefault = resolveResearchCodeBasis({
  projectID: "project-3",
  projectCodeVersion: "2014 NYC Construction Codes",
  availableCorpora: registry,
  corpusPlan: historicalProjectPlan,
  resolvedAt
});
assert.equal(historicalProjectDefault.projectCodeVersionSupported, true);
assert.equal(historicalProjectDefault.projectCodeVersionRetrieved, true);
assert.deepEqual(
  historicalProjectDefault.searchedCorpora.map((corpus) => corpus.id),
  ["nyc-2014-construction-codes"]
);
assert.match(historicalProjectDefault.disclosure, /Project default applied/);
assert.equal(historicalProjectDefault.limitation, null);

const existingBuildingCorpus = registry.find((corpus) => corpus.id === "nyc-existing-building-code-2027");
const explicitFutureBasis = resolveResearchCodeBasis({
  projectID: "project-4",
  projectCodeVersion: "EBC",
  availableCorpora: registry,
  corpusPlan: {
    registryVersion: "test",
    routingMode: "question-and-conversation-topic",
    selected: [],
    pinnedCorpora: [{ ...existingBuildingCorpus, routeReason: "explicitly pinned evidence" }],
    unavailable: [],
    excluded: []
  },
  resolvedAt
});
assert.deepEqual(explicitFutureBasis.searchedCorpora, []);
assert.deepEqual(explicitFutureBasis.pinnedCorpora.map((corpus) => corpus.id), [
  "nyc-existing-building-code-2027"
]);
assert.equal(explicitFutureBasis.projectCodeVersionRetrieved, true);
assert.match(explicitFutureBasis.disclosure, /Explicit evidence reviewed: NYC Existing Building Code/);
assert.doesNotMatch(explicitFutureBasis.disclosure, /unavailable for Research/);

const evidence = immutableEvidenceSnapshot({
  id: "evidence-1",
  source: {
    sourceID: "source-1",
    sectionID: "section-1",
    sectionNumber: "101.1",
    chapterNumber: "1",
    codePrefix: "BC",
    codeEdition: availableCodeEdition,
    codeVersion: availableCodeVersion,
    text: "This is the immutable enacted passage used by the answer."
  },
  approvedAt: resolvedAt
});
const answerPayload = {
  codeBasis: projectDefault,
  conclusion: "The cited provision controls.",
  assumptions: [],
  missingFacts: [],
  evidenceLimitations: [],
  additionalEvidenceNeeded: []
};
const answer = immutableResearchAnswer({
  id: "answer-1",
  owner: { kind: "user", id: "user-1" },
  conversationID: "conversation-1",
  projectID: "project-1",
  question: "Which edition applies?",
  answer: answerPayload,
  evidence: [evidence],
  citations: [{ sectionID: "section-1", sourceIDs: ["source-1"], relevance: "Direct support" }],
  model: "test",
  researchSystemVersion: "test",
  createdAt: resolvedAt
});
answerPayload.codeBasis.disclosure = "tampered";
assert.match(answer.codeBasis.disclosure, /Project default/);

const root = dirname(fileURLToPath(import.meta.url));
const appSource = await readFile(join(root, "../app.mjs"), "utf8");
const uiSource = await readFile(join(root, "../public/app.js"), "utf8");
const styles = await readFile(join(root, "../public/styles.css"), "utf8");
assert.match(appSource, /codeBasis: answerCodeBasis/);
assert.match(appSource, /Do not imply that an unavailable or unsearched corpus was retrieved/);
assert.match(appSource, /Ordinary internal corpus exclusions are not user-facing evidence limitations/);
assert.doesNotMatch(appSource, /`EXCLUDED_CORPORA:/);
assert.match(uiSource, /research-answer-code-basis/);
assert.match(styles, /workspace-panel:not\(\.reader-panel\) \.research-answer-code-basis\s*\{[\s\S]*?font-size: 10px !important;/);

console.log("permitext Research code-basis contract passed");
